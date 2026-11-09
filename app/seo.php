<?php
// What search engines and link previews see: every page address is answered by
// page.php with the built index.html, completed on the server with the page's
// title, description, canonical address, sharing preview (Open Graph), schema.org
// data, and its main text as plain HTML (React replaces it once loaded).
// Also sitemap.xml and robots.txt. Unknown addresses get a real 404.
declare(strict_types=1);

// The public address of the site (canonical links, sitemap, previews).
function site_url(): string
{
    $configured = rtrim((string) (config()['site_url'] ?? ''), '/');
    return $configured !== '' && config()['production'] ? $configured : site_origin();
}

// A page text: the one saved by the turner, else the built-in text (exported at
// build time from src/contentBlocks.js into app/content-fallbacks.json).
function page_text(string $key): string
{
    static $fallbacks, $saved;
    $fallbacks ??= is_file(__DIR__ . '/content-fallbacks.json') ? (json_decode((string) file_get_contents(__DIR__ . '/content-fallbacks.json'), true) ?: []) : [];
    if ($saved === null) {
        $saved = [];
        foreach (all("SELECT key, value FROM page_content WHERE lang='fr'") as $row) $saved[$row['key']] = $row['value'];
    }
    return (string) ($saved[$key] ?? $fallbacks[$key] ?? '');
}

function excerpt(string $text, int $length = 158): string
{
    $text = trim((string) preg_replace('/\s+/u', ' ', $text));
    if (mb_strlen($text) <= $length) return $text;
    $cut = mb_substr($text, 0, $length - 1);
    return (preg_replace('/\s+\S*$/u', '', $cut) ?: $cut) . '…';
}

function owner_person(): array
{
    return ['@type' => 'Person', 'name' => config()['owner_name'], 'jobTitle' => 'Tourneur sur bois', 'url' => site_url() . '/a-propos', 'address' => ['@type' => 'PostalAddress', 'addressRegion' => page_text('footer.location'), 'addressCountry' => 'CH']];
}

const KIND_NAMES = ['vase' => 'Vase', 'bowl' => 'Bol', 'plate' => 'Plat', 'box' => 'Boîte', 'mill' => 'Moulin à poivre', 'pen' => 'Stylo', 'light' => 'Luminaire', 'sculpture' => 'Sculpture', 'other' => 'Pièce tournée'];

// The page for an address: [status, title, description, image, schema.org, main HTML, indexable].
function page_for(string $path): array
{
    $e = fn ($value) => htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    $site = 'tourneur.ch';
    $defaultImage = '/images/partage.jpg';
    $pieces = fn (int $limit = 200) => all("SELECT * FROM photos WHERE status='approved' ORDER BY created_at DESC LIMIT $limit");
    $pieceList = function (array $rows) use ($e): string {
        if (!$rows) return '';
        return '<ul>' . implode('', array_map(fn ($p) => '<li><a href="/portfolio/' . $e($p['slug']) . '">' . $e($p['title']) . '</a>' . ($p['wood'] ? ' — ' . $e($p['wood']) : '') . '</li>', $rows)) . '</ul>';
    };
    $intro = fn (string $prefix) => '<h1>' . $e(page_text("$prefix.title")) . '</h1><p>' . $e(page_text("$prefix.description")) . '</p>';
    $path = rtrim($path, '/') ?: '/';

    if ($path === '/') {
        $description = page_text('home.intro');
        $news = all('SELECT id, title FROM news WHERE published=1 ORDER BY created_at DESC LIMIT 5');
        $html = '<h1>' . $e(page_text('home.title')) . '</h1><p>' . $e($description) . '</p><h2>Dernières créations</h2>' . $pieceList($pieces(6))
            . ($news ? '<h2>Nouvelles</h2><ul>' . implode('', array_map(fn ($n) => '<li><a href="/news/' . $e($n['id']) . '">' . $e($n['title']) . '</a></li>', $news)) . '</ul>' : '');
        $schema = [['@type' => 'WebSite', 'name' => $site, 'url' => site_url() . '/', 'inLanguage' => 'fr-CH', 'author' => owner_person()], owner_person()];
        return [200, page_text('home.title') . ' — ' . $site, $description, $defaultImage, $schema, $html, true];
    }
    if ($path === '/portfolio') {
        $rows = $pieces();
        $schema = [['@type' => 'CollectionPage', 'name' => page_text('gallery.title'), 'url' => site_url() . '/portfolio', 'hasPart' => array_map(fn ($p) => ['@type' => 'VisualArtwork', 'name' => $p['title'], 'url' => site_url() . '/portfolio/' . $p['slug']], array_slice($rows, 0, 50))]];
        return [200, 'Portfolio — ' . page_text('gallery.title') . ' · ' . $site, page_text('gallery.description'), $rows[0]['image_url'] ?? $defaultImage, $schema, $intro('gallery') . $pieceList($rows), true];
    }
    if (preg_match('#^/portfolio/([a-z0-9-]+)$#', $path, $m)) {
        $p = one("SELECT * FROM photos WHERE slug=? AND status='approved'", [$m[1]]);
        if (!$p) return [404, 'Pièce introuvable — ' . $site, '', $defaultImage, [], '<h1>Pièce introuvable</h1><p><a href="/portfolio">Voir le portfolio</a></p>', false];
        $kind = KIND_NAMES[$p['kind']] ?? KIND_NAMES['other'];
        $description = $p['story'] ?: "$kind tourné à la main" . ($p['wood'] ? ' en ' . mb_strtolower($p['wood']) : '') . ', par ' . config()['owner_name'] . '.';
        $schema = [['@type' => 'VisualArtwork', 'name' => $p['title'], 'url' => site_url() . '/portfolio/' . $p['slug'], 'image' => site_url() . $p['image_url'], 'artform' => $kind, 'artMedium' => $p['wood'] ?: 'Bois', 'description' => $description, 'dateCreated' => substr($p['created_at'], 0, 10), 'creator' => owner_person()]];
        $html = '<h1>' . $e($p['title']) . '</h1><p>' . $e($kind) . ($p['wood'] ? ' · ' . $e($p['wood']) : '') . '</p><img src="' . $e($p['image_url']) . '" alt="' . $e($p['title']) . '" width="' . (int) $p['width'] . '" height="' . (int) $p['height'] . '"><p>' . $e($p['story']) . '</p><p><a href="/portfolio">Tout le portfolio</a></p>';
        return [200, $p['title'] . ' — ' . $site, $description, $p['image_url'], $schema, $html, true];
    }
    if ($path === '/news') {
        $news = all('SELECT * FROM news WHERE published=1 ORDER BY created_at DESC');
        $html = $intro('news') . '<ul>' . implode('', array_map(fn ($n) => '<li><a href="/news/' . $e($n['id']) . '">' . $e($n['title']) . '</a> — ' . $e($n['summary']) . '</li>', $news)) . '</ul>';
        return [200, page_text('news.title') . ' — Nouvelles · ' . $site, page_text('news.description'), $defaultImage, [], $html, true];
    }
    if (preg_match('#^/news/([A-Za-z0-9-]+)$#', $path, $m)) {
        $n = one('SELECT * FROM news WHERE id=? AND published=1', [$m[1]]);
        if (!$n) return [404, 'Nouvelle introuvable — ' . $site, '', $defaultImage, [], '<h1>Nouvelle introuvable</h1><p><a href="/news">Toutes les nouvelles</a></p>', false];
        $image = $n['image_url'] ?: $defaultImage;
        $schema = [['@type' => 'BlogPosting', 'headline' => $n['title'], 'description' => $n['summary'], 'datePublished' => $n['created_at'], 'dateModified' => $n['updated_at'] ?: $n['created_at'], 'image' => site_url() . $image, 'url' => site_url() . '/news/' . $n['id'], 'inLanguage' => 'fr-CH', 'author' => owner_person()]];
        $html = '<article><h1>' . $e($n['title']) . '</h1>' . implode('', array_map(fn ($para) => '<p>' . nl2br($e($para)) . '</p>', preg_split('/\n\s*\n/', $n['body']))) . '</article><p><a href="/news">Toutes les nouvelles</a></p>';
        return [200, $n['title'] . ' — ' . $site, $n['summary'] ?: excerpt($n['body']), $image, $schema, $html, true];
    }
    if ($path === '/documents') {
        $docs = all("SELECT * FROM resources WHERE file_url != '' ORDER BY category, title");
        $html = $intro('resources') . '<ul>' . implode('', array_map(fn ($d) => '<li><a href="' . $e($d['file_url']) . '">' . $e($d['title']) . '</a>' . ($d['description'] ? ' — ' . $e($d['description']) : '') . '</li>', $docs)) . '</ul>';
        return [200, 'Documents — ' . page_text('resources.title') . ' · ' . $site, page_text('resources.description'), $defaultImage, [], $html, true];
    }
    if ($path === '/a-propos') {
        $text = page_text('about.text');
        $html = '<h1>' . $e(page_text('about.title')) . '</h1>' . implode('', array_map(fn ($para) => '<p>' . $e($para) . '</p>', preg_split('/\n\s*\n/', $text))) . '<p>' . $e(page_text('about.signature')) . '</p>';
        return [200, 'À propos — ' . page_text('about.title') . ' · ' . $site, excerpt($text), $defaultImage, [['@type' => 'AboutPage', 'url' => site_url() . '/a-propos', 'mainEntity' => owner_person()]], $html, true];
    }
    if ($path === '/contact') {
        $email = page_text('contact.email');
        $html = $intro('contact') . '<p><a href="mailto:' . $e($email) . '">' . $e($email) . '</a></p>';
        return [200, 'Contact — ' . page_text('contact.title') . ' · ' . $site, page_text('contact.description'), $defaultImage, [['@type' => 'ContactPage', 'url' => site_url() . '/contact', 'mainEntity' => owner_person() + ['email' => $email]]], $html, true];
    }
    // Pages of the turner only: shown, never indexed.
    if (preg_match('#^/(login|profile|admin)(/|$)#', $path)) return [200, 'Administration — ' . $site, '', $defaultImage, [], '', false];
    return [404, 'Page introuvable — ' . $site, '', $defaultImage, [], '<h1>Page introuvable</h1><p><a href="/">Retour à l’accueil</a></p>', false];
}

function render_page(string $path): never
{
    [$status, $title, $description, $image, $schema, $html, $indexable] = page_for($path);
    $e = fn ($value) => htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    $canonical = site_url() . (rtrim($path, '/') ?: '/');
    $absolute = str_starts_with($image, 'http') ? $image : site_url() . $image;
    $head = [
        '<title>' . $e($title) . '</title>',
        $description !== '' ? '<meta name="description" content="' . $e(excerpt($description)) . '" />' : '',
        $indexable ? '<link rel="canonical" href="' . $e($canonical) . '" />' : '<meta name="robots" content="noindex" />',
        '<meta property="og:site_name" content="tourneur.ch" />',
        '<meta property="og:locale" content="fr_CH" />',
        '<meta property="og:type" content="' . (str_starts_with($path, '/news/') ? 'article' : 'website') . '" />',
        '<meta property="og:title" content="' . $e($title) . '" />',
        $description !== '' ? '<meta property="og:description" content="' . $e(excerpt($description, 200)) . '" />' : '',
        '<meta property="og:url" content="' . $e($canonical) . '" />',
        '<meta property="og:image" content="' . $e($absolute) . '" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        $schema ? '<script type="application/ld+json">' . json_encode(['@context' => 'https://schema.org', '@graph' => $schema], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . '</script>' : '',
    ];
    // The built page (tests point TURNERY_INDEX_HTML at their own).
    $page = (string) @file_get_contents(getenv('TURNERY_INDEX_HTML') ?: APP_ROOT . '/index.html');
    if ($page === '') fail(500, 'Something went wrong. Please try again.');
    // The built page's own title and description are replaced.
    $page = preg_replace(['#<title>.*?</title>#s', '#\s*<meta name="description"[^>]*>#'], ['', ''], $page);
    $page = str_replace('</head>', '    ' . implode("\n    ", array_filter($head)) . "\n  </head>", $page);
    if ($html !== '') $page = str_replace('<div id="root"></div>', '<div id="root"><main class="prerender">' . $html . '</main></div>', $page);
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    if (!$indexable) header('X-Robots-Tag: noindex');
    echo $page;
    exit;
}

function render_sitemap(): never
{
    $url = fn (string $path, ?string $modified = null) => '  <url><loc>' . htmlspecialchars(site_url() . $path, ENT_XML1) . '</loc>' . ($modified ? '<lastmod>' . substr($modified, 0, 10) . '</lastmod>' : '') . '</url>';
    $latest = (string) (scalar("SELECT MAX(created_at) FROM photos WHERE status='approved'") ?: '');
    $lines = [$url('/', $latest ?: null), $url('/portfolio', $latest ?: null), $url('/news', (string) scalar('SELECT MAX(created_at) FROM news WHERE published=1') ?: null), $url('/documents'), $url('/a-propos'), $url('/contact')];
    foreach (all("SELECT slug, created_at FROM photos WHERE status='approved' AND slug != '' ORDER BY created_at DESC") as $p) $lines[] = $url('/portfolio/' . $p['slug'], $p['created_at']);
    foreach (all('SELECT id, created_at, updated_at FROM news WHERE published=1 ORDER BY created_at DESC') as $n) $lines[] = $url('/news/' . $n['id'], $n['updated_at'] ?: $n['created_at']);
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" . implode("\n", $lines) . "\n</urlset>\n";
    exit;
}

function render_robots(): never
{
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: public, max-age=86400');
    // A test copy (development) is never indexed.
    if (!config()['production']) { echo "User-agent: *\nDisallow: /\n"; exit; }
    echo "User-agent: *\nDisallow: /admin\nDisallow: /login\nDisallow: /profile\nDisallow: /api/\nDisallow: /setup.php\n\nSitemap: " . site_url() . "/sitemap.xml\n";
    exit;
}
