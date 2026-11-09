<?php
// Every page address of the site (see .htaccess): the React page, completed on the
// server for search engines and link previews (app/seo.php). Also sitemap.xml and robots.txt.
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/http.php';
require __DIR__ . '/app/images.php';
require __DIR__ . '/app/legacy.php';
require __DIR__ . '/app/contact.php';
require __DIR__ . '/app/seo.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header_remove('X-Powered-By');

$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
try {
    if ($path === '/sitemap.xml') render_sitemap();
    if ($path === '/robots.txt') render_robots();
    render_page($path);
} catch (Throwable $error) {
    // The page itself never fails because of the database: React loads its data anyway.
    error_log('[tourneur.ch] ' . $error);
    http_response_code(200);
    readfile(getenv('TURNERY_INDEX_HTML') ?: __DIR__ . '/index.html');
}
