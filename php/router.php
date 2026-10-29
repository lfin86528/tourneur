<?php
// Router for PHP's built-in web server (local development and tests only):
//   php -S 127.0.0.1:8080 router.php
// Mirrors .htaccess, which Apache uses in production.
$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (preg_match('#^/(api|uploads)(/|$)#', $path)) {
    require __DIR__ . '/api.php';
    return true;
}
if (preg_match('#^/(app|data)(/|$)|^/router\.php$|/\.|(^|/)(setup-key\.txt|secret\.key|mail\.log|error\.log|tourneur[^/]*\.db)$#', $path)) {
    http_response_code(403);
    return true;
}
if ($path !== '/' && $path !== '/index.html' && is_file(__DIR__ . $path)) return false;
// Pages, sitemap.xml and robots.txt: page.php (needs the built index.html).
if (is_file(getenv('TURNERY_INDEX_HTML') ?: __DIR__ . '/index.html')) {
    require __DIR__ . '/page.php';
    return true;
}
http_response_code(404);
return true;
