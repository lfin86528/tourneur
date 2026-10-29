<?php
// Requests, responses, sessions, and access control.
declare(strict_types=1);

const SESSION_COOKIE = 'tourneur_session';
const SESSION_DAYS = 14;

final class HttpError extends Exception
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

function json_response(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    if (!headers_sent() && !array_filter(headers_list(), fn ($header) => stripos($header, 'Cache-Control:') === 0)) header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}
function fail(int $status, string $message): never
{
    throw new HttpError($status, $message);
}

// JSON bodies (fetch with a JSON payload) or form fields (multipart uploads).
function body(): array
{
    static $body;
    if ($body !== null) return $body;
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($type, 'application/json')) {
        $decoded = json_decode((string) file_get_contents('php://input'), true);
        $body = is_array($decoded) ? $decoded : [];
    } else {
        $body = $_POST;
    }
    return $body;
}
function input(string $key, mixed $default = null): mixed
{
    return body()[$key] ?? $default;
}

function https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

// State-changing requests must come from this site (no cross-site form posts).
function check_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '' || in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD', 'OPTIONS'], true)) return;
    $host = strtolower($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '');
    if (strtolower((string) parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== $host) {
        fail(403, 'Invalid request origin.');
    }
}

// ---------------------------------------------------------------- sessions (signed token in an HTTP-only cookie)
function base64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function sign_session(array $user): string
{
    $header = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url(json_encode(['sub' => $user['id'], 'role' => $user['role'], 'iss' => 'tourneur-ch', 'iat' => time(), 'exp' => time() + SESSION_DAYS * 86400]));
    return "$header.$payload." . base64url(hash_hmac('sha256', "$header.$payload", secret(), true));
}
function read_session(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $signature] = $parts;
    if (!hash_equals(base64url(hash_hmac('sha256', "$header.$payload", secret(), true)), $signature)) return null;
    $claims = json_decode((string) base64_decode(strtr($payload, '-_', '+/')), true);
    if (!is_array($claims) || ($claims['iss'] ?? '') !== 'tourneur-ch' || ($claims['exp'] ?? 0) < time()) return null;
    return $claims;
}
function set_session_cookie(string $value, int $expires): void
{
    setcookie(SESSION_COOKIE, $value, ['expires' => $expires, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => https()]);
}

// The signed-in user, or null. With $required, answers 401 instead.
function current_user(bool $required = false): ?array
{
    static $resolved = false, $user = null, $problem = null;
    if (!$resolved) {
        $resolved = true;
        $token = $_COOKIE[SESSION_COOKIE] ?? '';
        if ($token === '') $problem = 'Please sign in.';
        else {
            $claims = read_session($token);
            if (!$claims) $problem = 'Your session has expired. Please sign in again.';
            else {
                $found = one('SELECT * FROM users WHERE id=?', [$claims['sub']]);
                if (!$found || $found['status'] === 'suspended') $problem = 'Your session is no longer active.';
                else $user = $found;
            }
        }
    }
    if ($required && !$user) fail(401, $problem ?? 'Please sign in.');
    return $user;
}
function require_user(): array
{
    return current_user(true);
}
function require_moderator(): array
{
    $user = require_user();
    if ($user['role'] !== 'moderator') fail(403, 'Moderator access required.');
    return $user;
}

// At most 12 attempts per 15 minutes and address (sign-in and password change).
function limit_attempts(): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $since = time() - 15 * 60;
    query('DELETE FROM login_attempts WHERE at < ?', [$since]);
    if ((int) scalar('SELECT COUNT(*) FROM login_attempts WHERE ip=? AND at>=?', [$ip, $since]) >= 12) {
        header('Retry-After: 900');
        fail(429, 'Too many attempts. Please wait 15 minutes and try again.');
    }
    query('INSERT INTO login_attempts (ip, at) VALUES (?, ?)', [$ip, time()]);
}

// Sends a stored file, with byte ranges (needed for video playback on iOS).
function send_file(string $path, string $cacheControl): never
{
    if (!is_file($path)) fail(404, 'Image not found.');
    $types = ['webp' => 'image/webp', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov' => 'video/quicktime'];
    $size = filesize($path);
    $start = 0;
    $end = $size - 1;
    header('Content-Type: ' . ($types[strtolower(pathinfo($path, PATHINFO_EXTENSION))] ?? 'application/octet-stream'));
    header('Cache-Control: ' . $cacheControl);
    header('Accept-Ranges: bytes');
    header('X-Content-Type-Options: nosniff');
    if (preg_match('/bytes=(\d*)-(\d*)/', $_SERVER['HTTP_RANGE'] ?? '', $range)) {
        if ($range[1] === '' && $range[2] !== '') $start = max(0, $size - (int) $range[2]);
        else {
            $start = (int) $range[1];
            if ($range[2] !== '') $end = min($end, (int) $range[2]);
        }
        if ($start > $end || $start >= $size) {
            http_response_code(416);
            header("Content-Range: bytes */$size");
            exit;
        }
        http_response_code(206);
        header("Content-Range: bytes $start-$end/$size");
    }
    header('Content-Length: ' . ($end - $start + 1));
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
    $handle = fopen($path, 'rb');
    fseek($handle, $start);
    $remaining = $end - $start + 1;
    while ($remaining > 0 && !feof($handle)) {
        $chunk = fread($handle, min(1 << 16, $remaining));
        echo $chunk;
        $remaining -= strlen($chunk);
    }
    fclose($handle);
    exit;
}
