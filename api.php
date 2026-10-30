<?php
// Single entry point for /api/* and /uploads/* (see .htaccess).
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/http.php';
require __DIR__ . '/app/images.php';
require __DIR__ . '/app/mail.php';
require __DIR__ . '/app/contact.php';
require __DIR__ . '/app/stats.php';
require __DIR__ . '/app/documents.php';
require __DIR__ . '/app/legacy.php';
require __DIR__ . '/app/routes.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');
header('Cross-Origin-Resource-Policy: same-origin');
header_remove('X-Powered-By');

try {
    route($_SERVER['REQUEST_METHOD'] ?? 'GET', (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
} catch (HttpError $error) {
    json_response(['error' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    error_log('[tourneur.ch] ' . $error);
    @file_put_contents(config()['data_dir'] . '/error.log', '[' . date('c') . '] ' . $error . "\n", FILE_APPEND | LOCK_EX);
    json_response(['error' => 'Something went wrong. Please try again.'], 500);
}
