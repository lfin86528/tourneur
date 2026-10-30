<?php
// Outgoing e-mail. Authenticated SMTP with a real mailbox is the most reliable:
// set 'smtp' in app/config.php (see config.example.php). Without it, PHP's mail()
// is tried in production (it must be enabled in the Manager and is often filtered).
// Every attempt is written to data/mail.log, with the error when it fails.
declare(strict_types=1);

function mail_last_error(?string $set = null): string
{
    static $error = '';
    if ($set !== null) $error = $set;
    return $error;
}

function mail_sender(): string
{
    $smtp = config()['smtp'] ?? null;
    // With SMTP the sender must be the authenticated mailbox (else "sender mismatch").
    if (is_array($smtp) && !empty($smtp['username'])) return (string) ($smtp['from'] ?? $smtp['username']);
    $configured = (string) (config()['mail_from'] ?? '');
    if ($configured !== '') return $configured;
    $host = preg_replace(['/:\d+$/', '/^(www|new)\./'], '', strtolower($_SERVER['HTTP_HOST'] ?? 'localhost'));
    return 'noreply@' . $host;
}

// $replyTo: where answers go (e.g. the sender of a contact message).
function send_mail(string $to, string $subject, string $text, string $replyTo = ''): bool
{
    if (!filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $replyTo = '';
    mail_last_error('');
    $smtp = config()['smtp'] ?? null;
    $method = 'logged only';
    $sent = false;
    try {
        if (is_array($smtp) && !empty($smtp['host'])) {
            $method = 'SMTP ' . $smtp['host'];
            smtp_send($smtp, mail_sender(), $to, $subject, $text, $replyTo);
            $sent = true;
        } elseif (config()['production']) {
            $method = 'PHP mail()';
            if (!function_exists('mail')) throw new RuntimeException('PHP mail() is disabled on this hosting. Configure SMTP in app/config.php.');
            $from = mail_sender();
            $headers = implode("\r\n", ['From: tourneur.ch <' . $from . '>', ...($replyTo !== '' ? ["Reply-To: <$replyTo>"] : []), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit']);
            $sent = @mail($to, mb_encode_mimeheader($subject, 'UTF-8'), $text, $headers, '-f' . $from);
            if (!$sent) throw new RuntimeException('PHP mail() refused the message (check the mail settings in Plesk, or configure SMTP).');
        } else {
            mail_last_error('Development: e-mails are only written to data/mail.log.');
        }
    } catch (Throwable $error) {
        mail_last_error($error->getMessage());
    }
    @file_put_contents(config()['data_dir'] . '/mail.log', sprintf("[%s] %s via %s to %s%s\nSubject: %s\n\n%s\n\n", date('c'), $sent ? 'SENT' : 'NOT SENT', $method, $to, $sent ? '' : ' — ' . mail_last_error(), $subject, $text), FILE_APPEND | LOCK_EX);
    return $sent;
}

// Minimal SMTP client: implicit TLS (465), STARTTLS (587), or none (local tests).
function smtp_send(array $smtp, string $from, string $to, string $subject, string $text, string $replyTo = ''): void
{
    $host = (string) $smtp['host'];
    $encryption = strtolower((string) ($smtp['encryption'] ?? 'ssl'));
    $port = (int) ($smtp['port'] ?? ($encryption === 'ssl' ? 465 : 587));
    $context = stream_context_create(['ssl' => ['peer_name' => $host, 'verify_peer' => true, 'verify_peer_name' => true, 'crypto_method' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT : 0)]]);
    $socket = @stream_socket_client(($encryption === 'ssl' ? 'ssl://' : 'tcp://') . "$host:$port", $errno, $errstr, 20, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) throw new RuntimeException("Cannot connect to $host:$port ($errstr)");
    stream_set_timeout($socket, 20);
    $read = function () use ($socket): array {
        $lines = '';
        while (($line = fgets($socket, 1024)) !== false) {
            $lines .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return [(int) substr($lines, 0, 3), trim($lines)];
    };
    // $label names the step in errors; credentials and message bodies are never shown.
    $command = function (?string $line, array $expected, ?string $label = null) use ($socket, $read): string {
        if ($line !== null) fwrite($socket, $line . "\r\n");
        [$code, $reply] = $read();
        if (!in_array($code, $expected, true)) throw new RuntimeException('SMTP ' . ($label ?? $line ?? 'connect') . ": $reply");
        return $reply;
    };
    try {
        $helo = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '') ?: 'localhost';
        $command(null, [220]);
        $command("EHLO $helo", [250]);
        if ($encryption === 'starttls') {
            $command('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT)) throw new RuntimeException('STARTTLS negotiation failed');
            $command("EHLO $helo", [250]);
        }
        if (!empty($smtp['username'])) {
            $command('AUTH LOGIN', [334], 'AUTH');
            $command(base64_encode((string) $smtp['username']), [334], 'AUTH');
            $command(base64_encode((string) ($smtp['password'] ?? '')), [235], 'AUTH');
        }
        $command("MAIL FROM:<$from>", [250]);
        $command("RCPT TO:<$to>", [250, 251]);
        $command('DATA', [354]);
        $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
        $message = implode("\r\n", [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . mb_encode_mimeheader('tourneur.ch', 'UTF-8') . " <$from>",
            "To: <$to>",
            ...($replyTo !== '' ? ["Reply-To: <$replyTo>"] : []),
            'Subject: ' . mb_encode_mimeheader($subject, 'UTF-8'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . "@$domain>",
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode(str_replace("\n", "\r\n", $text)), 76, "\r\n")),
        ]);
        $command($message . "\r\n.", [250], 'DATA');
        $command('QUIT', [221]);
    } finally {
        fclose($socket);
    }
}
