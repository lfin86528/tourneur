<?php
// Shared setup for the API, the setup page, and the command-line tools:
// configuration, SQLite connection, schema migrations, demo seed, helpers.
// (tourneur.ch: the same base as the ART sur bois site, with a single moderator.)
declare(strict_types=1);

const APP_ROOT = __DIR__ . '/..';

function config(): array
{
    static $config;
    if ($config !== null) return $config;
    // Defaults < app/config.php (optional) < environment variables (local development, tests).
    $config = [
        'environment' => 'production',
        'demo_mode' => false,
        'data_dir' => APP_ROOT . '/data',
        'uploads_dir' => APP_ROOT . '/uploads',
        // The public address (canonical links, sitemap, sharing previews).
        'site_url' => 'https://tourneur.ch',
        // The turner: credited on every piece and news item.
        'owner_name' => 'Lino Finini',
        // Sender of e-mails; default noreply@<site domain>.
        'mail_from' => '',
        // Authenticated SMTP (recommended); null = PHP mail().
        'smtp' => null,
        // Receives the messages of the contact form.
        'contact_email' => 'info@tourneur.ch',
        // Import the pieces of the former site into an empty portfolio (once).
        'import_legacy' => true,
    ];
    // app/config.php, or tourneur-config.php next to the web folder (outside httpdocs:
    // never touched by a Git deployment). The second one wins.
    foreach ([__DIR__ . '/config.php', dirname(__DIR__, 2) . '/tourneur-config.php'] as $file) {
        if (is_file($file)) $config = array_merge($config, (array) require $file);
    }
    $env = [
        'TURNERY_ENV' => 'environment',
        'TURNERY_DATA_DIR' => 'data_dir',
        'TURNERY_UPLOADS_DIR' => 'uploads_dir',
    ];
    foreach ($env as $variable => $key) {
        $value = getenv($variable);
        if ($value !== false && $value !== '') $config[$key] = $value;
    }
    if (getenv('TURNERY_LEGACY_IMPORT') === '0') $config['import_legacy'] = false;
    if (getenv('TURNERY_DEMO_MODE') !== false) $config['demo_mode'] = getenv('TURNERY_DEMO_MODE') === '1';
    // Outgoing mail server (tests and local development); production uses app/config.php.
    if (getenv('TURNERY_SMTP_HOST')) $config['smtp'] = ['host' => getenv('TURNERY_SMTP_HOST'), 'port' => (int) getenv('TURNERY_SMTP_PORT'), 'encryption' => getenv('TURNERY_SMTP_ENCRYPTION') ?: 'ssl', 'username' => getenv('TURNERY_SMTP_USERNAME') ?: '', 'password' => getenv('TURNERY_SMTP_PASSWORD') ?: ''];
    $config['production'] = $config['environment'] !== 'development';
    // Demo mode seeds a demo moderator account and a news item into an empty database
    // and shows the account on the login page. Always on in development.
    $config['demo_mode'] = !$config['production'] || (bool) $config['demo_mode'];
    foreach (['data_dir', 'uploads_dir'] as $key) {
        if (!is_dir($config[$key])) mkdir($config[$key], 0775, true);
        $config[$key] = realpath($config[$key]);
        // Never served directly by Apache. The database is refused outright; photo
        // requests are handed to api.php, which checks who may see them. (A plain
        // "deny" in uploads/ would win over the site's rewrite rules.)
        $rules = $key === 'data_dir'
            ? "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n"
            : "<IfModule mod_rewrite.c>\n  RewriteEngine On\n  RewriteRule ^ /api.php [L]\n</IfModule>\n<IfModule !mod_rewrite.c>\n  Require all denied\n</IfModule>\n";
        $htaccess = $config[$key] . '/.htaccess';
        if (!is_file($htaccess) || file_get_contents($htaccess) !== $rules) @file_put_contents($htaccess, $rules);
    }
    if (!is_dir($config['uploads_dir'] . '/news')) mkdir($config['uploads_dir'] . '/news', 0775, true);
    return $config;
}

function secret(): string
{
    // Signs session cookies. Generated once and kept next to the database.
    $file = config()['data_dir'] . '/secret.key';
    if (!is_file($file)) {
        file_put_contents($file, bin2hex(random_bytes(48)), LOCK_EX);
        @chmod($file, 0600);
    }
    return trim((string) file_get_contents($file));
}

function db(): PDO
{
    static $db;
    if ($db) return $db;
    $db = new PDO('sqlite:' . config()['data_dir'] . '/tourneur.db', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);
    // Rollback journal rather than WAL: WAL needs shared memory, which shared
    // hosting storage does not always support.
    $db->exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    migrate($db);
    if (config()['demo_mode']) seed($db);
    // The pieces of the former (Astro) site, imported once.
    if (config()['import_legacy'] && function_exists('import_legacy_pieces')) import_legacy_pieces($db);
    ensure_slugs($db);
    return $db;
}

function query(string $sql, array $params = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement;
}
function one(string $sql, array $params = []): ?array
{
    $row = query($sql, $params)->fetch();
    return $row === false ? null : $row;
}
function all(string $sql, array $params = []): array
{
    return query($sql, $params)->fetchAll();
}
function scalar(string $sql, array $params = []): mixed
{
    return query($sql, $params)->fetchColumn();
}
function transaction(callable $work): mixed
{
    db()->beginTransaction();
    try {
        $result = $work();
        db()->commit();
        return $result;
    } catch (Throwable $error) {
        db()->rollBack();
        throw $error;
    }
}

// Schema migrations, tracked with PRAGMA user_version. Each one runs once, in a
// transaction. Never edit a shipped migration: append a new one instead.
function migrations(): array
{
    return [
        // 1 — tourneur.ch: one moderator account, the portfolio, news, documents,
        // editable page texts, contact messages, audit trail and page views.
        "CREATE TABLE users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'moderator' CHECK(role IN ('member','moderator')),
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','suspended')),
            craft TEXT DEFAULT '',
            location TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            initials TEXT NOT NULL,
            joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE photos (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT NOT NULL,
            story TEXT DEFAULT '',
            wood TEXT DEFAULT '',
            kind TEXT NOT NULL DEFAULT 'other',
            image_url TEXT NOT NULL,
            thumbnail_url TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected')),
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            size_bytes INTEGER NOT NULL,
            moderation_note TEXT DEFAULT '',
            maker TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TEXT
        );
        CREATE INDEX photos_created ON photos(status, created_at);
        CREATE TABLE news (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL,
            image_url TEXT NOT NULL DEFAULT '',
            published INTEGER NOT NULL DEFAULT 1,
            author TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT
        );
        CREATE INDEX news_published_created ON news(published, created_at);
        CREATE TABLE news_media (
            id TEXT PRIMARY KEY,
            news_id TEXT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
            kind TEXT NOT NULL DEFAULT 'image' CHECK(kind IN ('image','video')),
            url TEXT NOT NULL,
            caption TEXT NOT NULL DEFAULT '',
            position INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX news_media_news ON news_media(news_id, position);
        CREATE TABLE resources (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            url TEXT NOT NULL DEFAULT '#',
            file_url TEXT NOT NULL DEFAULT '',
            file_name TEXT NOT NULL DEFAULT '',
            file_type TEXT NOT NULL DEFAULT '',
            file_size INTEGER NOT NULL DEFAULT 0,
            visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','members')),
            featured INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE page_content (
            key TEXT NOT NULL,
            lang TEXT NOT NULL CHECK(lang IN ('fr','de','it','en')),
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT NOT NULL DEFAULT '',
            PRIMARY KEY(key, lang)
        );
        CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','done')),
            handled_at TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX messages_status ON messages(status, created_at);
        CREATE TABLE login_attempts (ip TEXT NOT NULL, at INTEGER NOT NULL);
        CREATE INDEX login_attempts_ip ON login_attempts(ip, at);
        CREATE TABLE audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            at TEXT NOT NULL,
            actor_id TEXT,
            actor_name TEXT NOT NULL DEFAULT '',
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            details TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX audit_log_at ON audit_log(at);
        CREATE INDEX audit_log_action ON audit_log(action, at);
        CREATE TABLE page_views (
            day TEXT NOT NULL,
            path TEXT NOT NULL,
            views INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(day, path)
        );",
        // 2 — a stable address per piece (/portfolio/grand-bol-en-noyer), filled in by ensure_slugs().
        "ALTER TABLE photos ADD COLUMN slug TEXT NOT NULL DEFAULT '';
        CREATE UNIQUE INDEX photos_slug ON photos(slug) WHERE slug != '';",
    ];
}

function migrate(PDO $db): void
{
    $migrations = migrations();
    $version = (int) $db->query('PRAGMA user_version')->fetchColumn();
    if ($version >= count($migrations)) return;
    if ($version > 0) {
        // Keep a consistent copy of the database from before the upgrade.
        $backup = config()['data_dir'] . '/tourneur-before-v' . count($migrations) . '-' . time() . '.db';
        $db->exec('VACUUM INTO ' . $db->quote($backup));
    }
    for ($next = $version; $next < count($migrations); $next++) {
        $db->beginTransaction();
        try {
            $db->exec($migrations[$next]);
            $db->exec('PRAGMA user_version = ' . ($next + 1));
            $db->commit();
        } catch (Throwable $error) {
            $db->rollBack();
            throw $error;
        }
    }
}

// Development and reviews only: a moderator account (password Demo2026!) and a news item.
function seed(PDO $db): void
{
    if ((int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) return;
    $owner = config()['owner_name'];
    $db->prepare("INSERT INTO users (id,name,email,password_hash,role,initials) VALUES ('user-owner',?,?,?,'moderator',?)")->execute([$owner, 'admin@tourneur.test', password_hash('Demo2026!', PASSWORD_BCRYPT, ['cost' => 10]), initials_of($owner)]);
    $db->prepare('INSERT INTO news (id,title,summary,body,author,created_at) VALUES (?,?,?,?,?,?)')->execute(['news-demo', 'Nouveau site', 'Le site tourneur.ch fait peau neuve.', 'Le site tourneur.ch fait peau neuve : portfolio classé par bois et par type, nouvelles, documents et formulaire de contact.', $owner, add_days(-1)]);
}

// ---------------------------------------------------------------- helpers
// "Grand bol en noyer" → "grand-bol-en-noyer" (ASCII, for addresses).
function slugify(string $text): string
{
    $text = strtr(mb_strtolower(trim($text)), ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ç' => 'c', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'í' => 'i', 'ô' => 'o', 'ö' => 'o', 'ó' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ú' => 'u', 'ÿ' => 'y', 'ñ' => 'n', 'œ' => 'oe', 'æ' => 'ae', 'ß' => 'ss', '’' => '-', "'" => '-']);
    $slug = trim((string) preg_replace('/[^a-z0-9]+/', '-', $text), '-');
    return substr($slug, 0, 80) ?: 'piece';
}
// A free address for a new piece: "bol", then "bol-2", "bol-3"…
function unique_slug(PDO $db, string $title, string $exceptId = ''): string
{
    $base = slugify($title);
    for ($n = 1; ; $n++) {
        $slug = $n === 1 ? $base : "$base-$n";
        $taken = $db->prepare('SELECT COUNT(*) FROM photos WHERE slug=? AND id != ?');
        $taken->execute([$slug, $exceptId]);
        if (!(int) $taken->fetchColumn()) return $slug;
    }
}
// Pieces without an address yet get one (once: the address never changes afterwards).
function ensure_slugs(PDO $db): void
{
    foreach ($db->query("SELECT id, title FROM photos WHERE slug = '' ORDER BY created_at")->fetchAll() as $row) {
        $db->prepare('UPDATE photos SET slug=? WHERE id=?')->execute([unique_slug($db, $row['title'], $row['id']), $row['id']]);
    }
}

function now(): string
{
    return iso(new DateTimeImmutable('now'));
}
function iso(DateTimeInterface $date): string
{
    return DateTimeImmutable::createFromInterface($date)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
}
function add_days(int $days, int $hour = 18): string
{
    $date = (new DateTimeImmutable('now', new DateTimeZone('Europe/Zurich')))->modify("$days days")->setTime($hour, 30);
    return iso($date);
}
function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr(ord($bytes[6]) & 0x0f | 0x40);
    $bytes[8] = chr(ord($bytes[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}
function clean(mixed $value, int $max = 500): string
{
    return mb_substr(trim((string) ($value ?? '')), 0, $max);
}
function initials_of(string $name): string
{
    $parts = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    return mb_strtoupper(mb_substr(implode('', array_map(fn ($part) => mb_substr($part, 0, 1), $parts)), 0, 2));
}
function hash_password(string $password): string
{
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
}
function active_moderators(): int
{
    return (int) scalar("SELECT COUNT(*) FROM users WHERE role='moderator' AND status='active'");
}

// Records who did what, for the moderators' statistics and audit trail.
// $actor defaults to the signed-in user. Never store passwords or links here.
function audit(string $action, ?string $targetType = null, ?string $targetId = null, array $details = [], ?array $actor = null): void
{
    try {
        $actor ??= function_exists('current_user') ? current_user() : null;
        query('INSERT INTO audit_log (at,actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?,?)', [now(), $actor['id'] ?? null, $actor['name'] ?? '', $action, $targetType, $targetId, json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    } catch (Throwable $error) {
        // Statistics must never break the action itself.
        error_log('[tourneur.ch] audit failed: ' . $error->getMessage());
    }
}

// Removes a stored file given its public URL ("/uploads/...").
function remove_upload(?string $url): void
{
    if (!$url || !str_starts_with($url, '/uploads/')) return;
    $relative = substr($url, strlen('/uploads/'));
    if (str_contains($relative, '..')) return;
    $file = config()['uploads_dir'] . '/' . $relative;
    if (is_file($file)) unlink($file);
}
