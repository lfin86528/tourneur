<?php
// Moderators' statistics (from the audit trail and daily page views) and the
// rotating home page photos.
declare(strict_types=1);

const AUDIT_KEEP_DAYS = 730;
const VIEWS_KEEP_DAYS = 400;

function zurich(): DateTimeZone
{
    return new DateTimeZone('Europe/Zurich');
}
function local_day(?DateTimeInterface $at = null): string
{
    return DateTimeImmutable::createFromInterface($at ?? new DateTimeImmutable())->setTimezone(zurich())->format('Y-m-d');
}

function statistics(int $days, string $actionFilter = ''): array
{
    // Keep the trail for two years and page views for about a year.
    query('DELETE FROM audit_log WHERE at < ?', [iso(new DateTimeImmutable('-' . AUDIT_KEEP_DAYS . ' days'))]);
    query('DELETE FROM page_views WHERE day < ?', [local_day(new DateTimeImmutable('-' . VIEWS_KEEP_DAYS . ' days'))]);

    $today = new DateTimeImmutable('today', zurich());
    $firstDay = $today->modify('-' . ($days - 1) . ' days');
    $sinceDay = $firstDay->format('Y-m-d');
    $sinceIso = iso($firstDay);

    $series = [];
    for ($day = $firstDay; $day <= $today; $day = $day->modify('+1 day')) $series[$day->format('Y-m-d')] = ['day' => $day->format('Y-m-d'), 'views' => 0, 'messages' => 0];
    foreach (all('SELECT day, SUM(views) AS views FROM page_views WHERE day >= ? GROUP BY day', [$sinceDay]) as $row) {
        if (isset($series[$row['day']])) $series[$row['day']]['views'] = (int) $row['views'];
    }
    // Contact messages per day (deleted messages still count: the journal keeps them).
    foreach (all("SELECT at FROM audit_log WHERE action='message.received' AND at >= ?", [$sinceIso]) as $row) {
        $day = local_day(new DateTimeImmutable($row['at']));
        if (isset($series[$day])) $series[$day]['messages']++;
    }

    // Most viewed pages; news articles are shown by their title.
    $titles = [];
    foreach (all('SELECT id, title FROM news') as $row) $titles[$row['id']] = $row['title'];
    $topPages = array_map(function ($row) use ($titles) {
        $label = null;
        if (preg_match('#^/news/(.+)$#', $row['path'], $m)) $label = $titles[$m[1]] ?? null;
        return ['path' => $row['path'], 'label' => $label, 'views' => (int) $row['views']];
    }, all('SELECT path, SUM(views) AS views FROM page_views WHERE day >= ? GROUP BY path ORDER BY views DESC, path LIMIT 10', [$sinceDay]));

    $count = fn (string $sql, array $params = []) => (int) scalar($sql, $params);
    $filter = preg_match('/^[a-z_.]{1,40}$/', $actionFilter) ? $actionFilter : '';
    $audit = array_map(fn ($row) => [
        'id' => (int) $row['id'], 'at' => $row['at'], 'actor' => $row['actor_name'], 'action' => $row['action'],
        'targetType' => $row['target_type'], 'targetId' => $row['target_id'], 'details' => json_decode($row['details'], true) ?: (object) [],
    ], $filter
        ? all('SELECT * FROM audit_log WHERE action = ? OR action LIKE ? ORDER BY id DESC LIMIT 200', [$filter, $filter . '.%'])
        : all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200'));

    return [
        'days' => $days,
        'totals' => [
            'pieces' => $count("SELECT COUNT(*) FROM photos WHERE status='approved'"),
            'publishedNews' => $count('SELECT COUNT(*) FROM news WHERE published=1'),
            'draftNews' => $count('SELECT COUNT(*) FROM news WHERE published=0'),
            'documents' => $count('SELECT COUNT(*) FROM resources'),
            'newMessages' => $count("SELECT COUNT(*) FROM messages WHERE status='new'"),
            'messages' => $count('SELECT COUNT(*) FROM messages'),
        ],
        'period' => [
            'views' => array_sum(array_column($series, 'views')),
            'messages' => array_sum(array_column($series, 'messages')),
            'piecesAdded' => $count("SELECT COUNT(*) FROM audit_log WHERE action='photo.created' AND at >= ?", [$sinceIso]),
            'failedLogins' => $count("SELECT COUNT(*) FROM audit_log WHERE action='auth.login_failed' AND at >= ?", [$sinceIso]),
        ],
        'series' => array_values($series),
        'topPages' => $topPages,
        'audit' => $audit,
    ];
}

// ---------------------------------------------------------------- home page photos
// Any JPEG, PNG or WebP placed in the folder (by FTP) joins the rotation. Each is
// resized once to a light WebP copy in uploads/home/, so phone photos are fine.
function home_images_dir(): string
{
    return getenv('TURNERY_HOME_IMAGES_DIR') ?: (config()['home_images_dir'] ?? APP_ROOT . '/images/accueil');
}

function home_images(): array
{
    $source = home_images_dir();
    $cache = config()['uploads_dir'] . '/home';
    if (!is_dir($cache)) mkdir($cache, 0775, true);
    $files = is_dir($source) ? array_values(array_filter(scandir($source) ?: [], fn ($name) => preg_match('/^[^.].*\.(jpe?g|png|webp)$/i', $name))) : [];
    sort($files, SORT_NATURAL | SORT_FLAG_CASE);
    $images = [];
    $keep = [];
    foreach (array_slice($files, 0, 40) as $name) {
        $path = "$source/$name";
        $base = substr(sha1($name . '|' . filemtime($path) . '|' . filesize($path)), 0, 20);
        $existing = glob("$cache/$base.*") ?: [];
        if ($existing) $file = basename($existing[0]);
        else {
            $image = load_image($path);
            if (!$image) continue;
            $file = save_image(resize_image($image, 1600), $cache, $base, 82);
        }
        $keep[$file] = true;
        $images[] = ['url' => "/uploads/home/$file", 'name' => pathinfo($name, PATHINFO_FILENAME)];
    }
    // Copies of photos removed from the folder are deleted too.
    foreach (glob("$cache/*") ?: [] as $old) if (!isset($keep[basename($old)])) @unlink($old);
    return $images;
}
