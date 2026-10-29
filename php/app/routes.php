<?php
// API routes of tourneur.ch: a public site and a single moderator (the turner).
declare(strict_types=1);

// ---------------------------------------------------------------- mapping rows to API objects
function public_user(array $u): array
{
    return ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role'], 'status' => $u['status'], 'craft' => $u['craft'], 'location' => $u['location'], 'bio' => $u['bio'], 'initials' => $u['initials'], 'joinedAt' => $u['joined_at']];
}
function map_photo(array $p): array
{
    return ['id' => $p['id'], 'slug' => $p['slug'] ?? '', 'userId' => $p['user_id'], 'title' => $p['title'], 'story' => $p['story'], 'wood' => $p['wood'], 'imageUrl' => $p['image_url'], 'thumbnailUrl' => $p['thumbnail_url'], 'status' => $p['status'], 'width' => (int) $p['width'], 'height' => (int) $p['height'], 'sizeBytes' => (int) $p['size_bytes'], 'moderationNote' => $p['moderation_note'], 'kind' => $p['kind'] ?? 'other', 'maker' => $p['maker'], 'createdAt' => $p['created_at'], 'reviewedAt' => $p['reviewed_at'], 'author' => $p['maker'] ?: config()['owner_name'], 'authorInitials' => initials_of($p['maker'] ?: config()['owner_name'])];
}
// Visitors do not see internal fields.
function public_photo(array $photo): array
{
    unset($photo['userId'], $photo['moderationNote'], $photo['maker']);
    return $photo;
}
function map_news(array $n): array
{
    return ['id' => $n['id'], 'title' => $n['title'], 'summary' => $n['summary'], 'body' => $n['body'], 'imageUrl' => $n['image_url'], 'published' => (bool) $n['published'], 'author' => $n['author'], 'createdAt' => $n['created_at'], 'updatedAt' => $n['updated_at'], 'mediaCount' => (int) ($n['media_count'] ?? 0)];
}
function map_media(array $m): array
{
    return ['id' => $m['id'], 'kind' => $m['kind'], 'url' => $m['url'], 'caption' => $m['caption']];
}

// Types of piece, for sorting the gallery (labels are translated by the client).
const PHOTO_KINDS = ['vase', 'bowl', 'plate', 'box', 'mill', 'pen', 'light', 'sculpture', 'other'];
function photo_kind(): string
{
    return in_array(input('kind'), PHOTO_KINDS, true) ? input('kind') : 'other';
}
// A piece's date (YYYY-MM-DD from the form), kept as an instant at noon in Zurich.
function piece_date(?string $current = null): string
{
    $value = (string) input('date', '');
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return iso(new DateTimeImmutable("$value 12:00", new DateTimeZone('Europe/Zurich')));
    return $current ?? now();
}
const PHOTO_QUERY = 'SELECT p.* FROM photos p';
const NEWS_QUERY = 'SELECT n.*, (SELECT COUNT(*) FROM news_media m WHERE m.news_id=n.id) AS media_count FROM news n';
const CONTENT_LANGUAGES = ['fr'];

function news_with_media(string $id): ?array
{
    $item = one(NEWS_QUERY . ' WHERE n.id=?', [$id]);
    if (!$item) return null;
    return map_news($item) + ['media' => array_map('map_media', all('SELECT * FROM news_media WHERE news_id=? ORDER BY position, rowid', [$id]))];
}
function load_content(): object
{
    $content = [];
    foreach (all('SELECT key, lang, value FROM page_content') as $row) $content[$row['key']][$row['lang']] = $row['value'];
    return (object) array_map(fn ($languages) => (object) $languages, $content);
}
function flag(mixed $value): bool
{
    return $value === true || $value === 1 || $value === 'true' || $value === '1';
}

// ---------------------------------------------------------------- uploads
function save_news_image(array $file): string
{
    $image = load_image($file['tmp_name']);
    if (!$image) fail(400, 'We could not read the image dimensions.');
    return '/uploads/news/' . save_image(resize_image($image, 1800), config()['uploads_dir'] . '/news', uuid(), 85);
}
function add_album_images(string $newsId, array $files): void
{
    $position = (int) scalar('SELECT COALESCE(MAX(position), -1) FROM news_media WHERE news_id=?', [$newsId]);
    foreach (array_slice($files, 0, 20) as $file) {
        query('INSERT INTO news_media (id,news_id,kind,url,caption,position) VALUES (?,?,?,?,?,?)', [uuid(), $newsId, 'image', save_news_image($file), '', ++$position]);
    }
}
function remove_album_media(string $newsId, array $ids): void
{
    foreach ($ids as $id) {
        $media = one('SELECT url FROM news_media WHERE id=? AND news_id=?', [(string) $id, $newsId]);
        if (!$media) continue;
        query('DELETE FROM news_media WHERE id=?', [(string) $id]);
        remove_upload($media['url']);
    }
}
function id_list(mixed $value): array
{
    if (is_array($value)) return $value;
    $decoded = json_decode((string) ($value ?? '[]'), true);
    return is_array($decoded) ? $decoded : [];
}
function news_fields(): array
{
    $title = clean(input('title'), 160);
    // Multipart form fields arrive with CRLF line endings.
    $body = clean(preg_replace('/\r\n?/', "\n", (string) input('body', '')), 20000);
    $summary = clean(preg_replace('/\s+/u', ' ', (string) input('summary', '')), 400) ?: mb_substr(explode("\n", $body)[0], 0, 280);
    if ($title === '' || $body === '') fail(400, 'A title and message are required.');
    return ['title' => $title, 'body' => $body, 'summary' => $summary, 'published' => input('published') === null ? 1 : (int) flag(input('published'))];
}
// When a request exceeds post_max_size, PHP silently drops the whole body.
function check_post_size(): void
{
    $setting = trim((string) ini_get('post_max_size'));
    $limit = (int) $setting * match (strtoupper(substr($setting, -1))) { 'G' => 1 << 30, 'M' => 1 << 20, 'K' => 1 << 10, default => 1 };
    if ($limit > 0 && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) fail(413, 'The image is larger than 15 MB.');
}

// ---------------------------------------------------------------- routing
function route(string $method, string $path): never
{
    $production = config()['production'];

    // Stored images: published ones are public; the rest only for their owner and moderators.
    if (preg_match('#^/uploads/news/([^/]+)$#', $path, $m) && in_array($method, ['GET', 'HEAD'], true)) {
        $file = basename($m[1]);
        $url = "/uploads/news/$file";
        $item = one('SELECT published FROM news WHERE image_url=? UNION ALL SELECT n.published FROM news_media m JOIN news n ON n.id=m.news_id WHERE m.url=?', [$url, $url]);
        if (!$item || (!$item['published'] && (current_user()['role'] ?? '') !== 'moderator')) fail(404, 'Image not found.');
        send_file(config()['uploads_dir'] . "/news/$file", $production && $item['published'] ? 'public, max-age=604800' : 'no-store');
    }
    // Library documents (all public).
    if (preg_match('#^/uploads/documents/([^/]+)$#', $path, $m) && in_array($method, ['GET', 'HEAD'], true)) {
        $resource = one('SELECT * FROM resources WHERE file_url=?', ['/uploads/documents/' . basename($m[1])]);
        if (!$resource) fail(404, 'Document not found.');
        send_document($resource);
    }
    // Resized home page photos: public, like the folder they come from.
    if (preg_match('#^/uploads/home/([^/]+)$#', $path, $m) && in_array($method, ['GET', 'HEAD'], true)) {
        send_file(config()['uploads_dir'] . '/home/' . basename($m[1]), $production ? 'public, max-age=604800' : 'no-store');
    }
    if (preg_match('#^/uploads/([^/]+)$#', $path, $m) && in_array($method, ['GET', 'HEAD'], true)) {
        $file = basename($m[1]);
        if (!one('SELECT 1 FROM photos WHERE id=?', [preg_replace('/(-thumb)?\.(webp|jpg)$/', '', $file)])) fail(404, 'Image not found.');
        send_file(config()['uploads_dir'] . "/$file", $production ? 'public, max-age=604800' : 'no-store');
    }
    if (!str_starts_with($path, '/api/')) fail(404, 'API route not found.');
    check_origin();
    $route = substr($path, 4);
    $is = function (string $verb, string $pattern) use ($method, $route, &$params): bool {
        if ($method !== $verb && !($verb === 'GET' && $method === 'HEAD')) return false;
        return (bool) preg_match('#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#', $route, $params);
    };
    $params = [];

    // -------- general
    if ($is('GET', '/health')) json_response(['ok' => true, 'service' => 'tourneur-api', 'time' => now()]);
    if ($is('GET', '/config')) json_response(['demo' => config()['demo_mode']]);

    // -------- authentication
    if ($is('POST', '/auth/login')) {
        limit_attempts();
        $email = strtolower(clean(input('email'), 160));
        $user = one('SELECT * FROM users WHERE email=?', [$email]);
        if (!$user || $user['status'] === 'suspended' || !password_verify((string) input('password', ''), $user['password_hash'])) {
            // Unknown addresses are not stored; for an existing account its name is kept.
            audit('auth.login_failed', 'user', $user['id'] ?? null, ['reason' => !$user ? 'unknown address' : ($user['status'] === 'suspended' ? 'suspended' : 'wrong password'), 'account' => $user['name'] ?? null], ['id' => null, 'name' => '']);
            fail(401, 'Email or password is incorrect.');
        }
        if ($user['status'] === 'invited') {
            query("UPDATE users SET status='active' WHERE id=?", [$user['id']]);
            $user['status'] = 'active';
        }
        audit('auth.login', 'user', $user['id'], [], $user);
        set_session_cookie(sign_session($user), time() + SESSION_DAYS * 86400);
        json_response(['user' => public_user($user)]);
    }
    if ($is('POST', '/auth/logout')) {
        set_session_cookie('', time() - 3600);
        json_response(['ok' => true]);
    }
    if ($is('GET', '/auth/me')) json_response(['user' => public_user(require_user())]);
    if ($is('POST', '/auth/password')) {
        $user = require_user();
        limit_attempts();
        $current = (string) input('currentPassword', '');
        $next = (string) input('newPassword', '');
        if (!password_verify($current, $user['password_hash'])) fail(400, 'Your current password is incorrect.');
        if (mb_strlen($next) < 10 || mb_strlen($next) > 200) fail(400, 'The new password must be at least 10 characters long.');
        if ($next === $current) fail(400, 'Choose a password different from the current one.');
        query('UPDATE users SET password_hash=? WHERE id=?', [hash_password($next), $user['id']]);
        audit('auth.password', 'user', $user['id']);
        json_response(['ok' => true]);
    }
    if ($is('GET', '/manifest')) {
        require_user();
        header('Content-Type: application/manifest+json');
        header('Cache-Control: private, no-store');
        echo json_encode([
            'name' => 'tourneur.ch — Administration', 'short_name' => 'tourneur.ch',
            'description' => 'Ajouter des pièces, des nouvelles et lire les messages de tourneur.ch.',
            'start_url' => '/', 'display' => 'standalone', 'background_color' => '#f7f3ec', 'theme_color' => '#4a2e1b', 'orientation' => 'any',
            'icons' => [
                ['src' => '/icons/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
                ['src' => '/icons/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -------- overview
    if ($is('GET', '/bootstrap')) {
        $moderator = (current_user()['role'] ?? '') === 'moderator';
        $photos = array_map('map_photo', all(PHOTO_QUERY . " WHERE p.status='approved' ORDER BY p.created_at DESC LIMIT 6"));
        json_response([
            'photos' => $moderator ? $photos : array_map('public_photo', $photos),
            'news' => array_map('map_news', all('SELECT * FROM news WHERE published=1 ORDER BY created_at DESC LIMIT 3')),
            'pieceCount' => (int) scalar("SELECT COUNT(*) FROM photos WHERE status='approved'"),
            'messageCount' => $moderator ? (int) scalar("SELECT COUNT(*) FROM messages WHERE status='new'") : 0,
        ]);
    }

    // -------- portfolio: published at once (the moderator is the turner)
    if ($is('GET', '/photos')) {
        $photos = array_map('map_photo', all(PHOTO_QUERY . " WHERE p.status='approved' ORDER BY p.created_at DESC"));
        json_response(['photos' => current_user() ? $photos : array_map('public_photo', $photos)]);
    }
    if ($is('POST', '/photos')) {
        $user = require_moderator();
        check_post_size();
        $file = accepted_images('photo')[0] ?? null;
        if (!$file) fail(400, 'Choose a JPEG, PNG, or WebP image up to 15 MB.');
        $title = clean(input('title'), 140);
        if ($title === '') fail(400, 'Give your piece a title.');
        $image = load_image($file['tmp_name']);
        if (!$image) fail(400, 'We could not read the image dimensions.');
        $id = uuid();
        [$width, $height] = [imagesx($image), imagesy($image)];
        $full = resize_image($image, 2400);
        $dir = config()['uploads_dir'];
        $fullName = save_image($full, $dir, $id, 88);
        $thumbName = save_image(resize_image($full, 800), $dir, "$id-thumb", 80);
        query("INSERT INTO photos (id,slug,user_id,title,story,wood,kind,image_url,thumbnail_url,status,width,height,size_bytes,created_at,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,'approved',?,?,?,?,?)", [$id, unique_slug(db(), $title), $user['id'], $title, clean(input('story'), 1500), clean(input('wood'), 100), photo_kind(), "/uploads/$fullName", "/uploads/$thumbName", $width, $height, (int) $file['size'], piece_date(), now()]);
        audit('photo.created', 'photo', $id, ['title' => $title]);
        json_response(['photo' => map_photo(one(PHOTO_QUERY . ' WHERE p.id=?', [$id]))], 201);
    }
    // One piece, by its address (or its id).
    if ($is('GET', '/photos/{slug}')) {
        $photo = one(PHOTO_QUERY . " WHERE (p.slug=? OR p.id=?) AND p.status='approved'", [$params['slug'], $params['slug']]);
        if (!$photo) fail(404, 'Photo not found.');
        json_response(['photo' => current_user() ? map_photo($photo) : public_photo(map_photo($photo))]);
    }
    // The moderator edits a piece's details (title, type, wood, date, story); its address stays.
    if ($is('PATCH', '/photos/{id}')) {
        require_moderator();
        $photo = one('SELECT * FROM photos WHERE id=?', [$params['id']]);
        if (!$photo) fail(404, 'Photo not found.');
        $title = clean(input('title', $photo['title']), 140);
        if ($title === '') fail(400, 'Give your piece a title.');
        query('UPDATE photos SET title=?, kind=?, wood=?, story=?, created_at=? WHERE id=?', [$title, photo_kind(), clean(input('wood', $photo['wood']), 100), clean(input('story', $photo['story']), 1500), piece_date($photo['created_at']), $photo['id']]);
        audit('photo.updated', 'photo', $photo['id'], ['title' => $title]);
        json_response(['photo' => map_photo(one(PHOTO_QUERY . ' WHERE p.id=?', [$photo['id']]))]);
    }
    if ($is('DELETE', '/photos/{id}')) {
        require_moderator();
        $photo = one('SELECT * FROM photos WHERE id=?', [$params['id']]);
        if (!$photo) fail(404, 'Photo not found.');
        query('DELETE FROM photos WHERE id=?', [$photo['id']]);
        remove_upload($photo['image_url']);
        remove_upload($photo['thumbnail_url']);
        audit('photo.deleted', 'photo', $photo['id'], ['title' => $photo['title']]);
        json_response(['ok' => true]);
    }

    // -------- contact form: anyone may write; the moderator reads the messages here too
    if ($is('POST', '/messages')) {
        limit_attempts();
        // A filled hidden field means a robot: answer as usual, keep nothing.
        if (clean(input('website'), 200) !== '') json_response(['ok' => true], 201);
        $values = contact_input();
        $id = uuid();
        query('INSERT INTO messages (id,name,email,phone,subject,message,created_at) VALUES (?,?,?,?,?,?,?)', [$id, $values['name'], $values['email'], $values['phone'], $values['subject'], $values['message'], now()]);
        audit('message.received', 'message', $id, ['name' => $values['name']], ['id' => null, 'name' => '']);
        [$notice, $receipt] = contact_mails($values);
        $recipient = (string) (config()['contact_email'] ?? '');
        if ($recipient !== '') send_mail($recipient, $notice[0], $notice[1], $values['email']);
        send_mail($values['email'], $receipt[0], $receipt[1], $recipient);
        json_response(['ok' => true], 201);
    }
    if ($is('GET', '/messages')) {
        require_moderator();
        json_response(['messages' => array_map('map_message', all("SELECT * FROM messages ORDER BY status='done', created_at DESC"))]);
    }
    if ($is('PATCH', '/messages/{id}')) {
        require_moderator();
        $message = one('SELECT * FROM messages WHERE id=?', [$params['id']]);
        if (!$message) fail(404, 'Message not found.');
        $done = input('status') === 'done';
        query('UPDATE messages SET status=?, handled_at=? WHERE id=?', [$done ? 'done' : 'new', $done ? now() : null, $message['id']]);
        audit($done ? 'message.done' : 'message.reopened', 'message', $message['id'], ['name' => $message['name']]);
        json_response(['message' => map_message(one('SELECT * FROM messages WHERE id=?', [$message['id']]))]);
    }
    if ($is('DELETE', '/messages/{id}')) {
        require_moderator();
        $message = one('SELECT * FROM messages WHERE id=?', [$params['id']]);
        if (!$message) fail(404, 'Message not found.');
        query('DELETE FROM messages WHERE id=?', [$message['id']]);
        audit('message.deleted', 'message', $message['id'], ['name' => $message['name']]);
        json_response(['ok' => true]);
    }

    // -------- documents: all public
    if ($is('GET', '/resources')) {
        $rows = all('SELECT * FROM resources ORDER BY category, title');
        json_response(['resources' => array_map('map_resource', $rows)]);
    }
    $resourceFields = function (): array {
        $title = clean(input('title'), 160);
        if ($title === '') fail(400, 'Give the document a title.');
        return [
            'title' => $title,
            'category' => clean(input('category'), 60) ?: 'Documents',
            'description' => clean(preg_replace('/\r\n?/', "\n", (string) input('description', '')), 600),
            'visibility' => 'public',
            'featured' => (int) flag(input('featured')),
        ];
    };
    if ($is('POST', '/resources')) {
        $user = require_moderator();
        check_post_size();
        $fields = $resourceFields();
        $document = uploaded_document();
        if (!$document) fail(400, 'Choose the file to add.');
        $id = uuid();
        $url = store_document($document);
        transaction(function () use ($fields, $document, $url, $id, $user) {
            // Only one document is featured in the "Start here" box.
            if ($fields['featured']) query('UPDATE resources SET featured=0');
            query('INSERT INTO resources (id,title,category,description,url,file_url,file_name,file_type,file_size,visibility,featured,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [$id, $fields['title'], $fields['category'], $fields['description'], $url, $url, $document['name'], $document['extension'], $document['size'], $fields['visibility'], $fields['featured'], now(), $user['name']]);
        });
        audit('resource.created', 'resource', $id, ['title' => $fields['title'], 'visibility' => $fields['visibility']]);
        json_response(['resource' => map_resource(one('SELECT * FROM resources WHERE id=?', [$id]))], 201);
    }
    if ($is('POST', '/resources/{id}')) {
        $user = require_moderator();
        check_post_size();
        $item = one('SELECT * FROM resources WHERE id=?', [$params['id']]);
        if (!$item) fail(404, 'Document not found.');
        $fields = $resourceFields();
        $document = uploaded_document();
        $url = $document ? store_document($document) : $item['file_url'];
        transaction(function () use ($fields, $document, $url, $item, $user) {
            if ($fields['featured']) query('UPDATE resources SET featured=0 WHERE id != ?', [$item['id']]);
            query('UPDATE resources SET title=?, category=?, description=?, visibility=?, featured=?, url=?, file_url=?, file_name=?, file_type=?, file_size=?, updated_at=?, updated_by=? WHERE id=?', [$fields['title'], $fields['category'], $fields['description'], $fields['visibility'], $fields['featured'], $url ?: '#', $url, $document['name'] ?? $item['file_name'], $document['extension'] ?? $item['file_type'], $document['size'] ?? $item['file_size'], now(), $user['name'], $item['id']]);
        });
        if ($document) remove_upload($item['file_url']);
        audit('resource.updated', 'resource', $item['id'], ['title' => $fields['title'], 'newFile' => (bool) $document, 'visibility' => $fields['visibility']]);
        json_response(['resource' => map_resource(one('SELECT * FROM resources WHERE id=?', [$item['id']]))]);
    }
    if ($is('DELETE', '/resources/{id}')) {
        require_moderator();
        $item = one('SELECT * FROM resources WHERE id=?', [$params['id']]);
        if (!$item) fail(404, 'Document not found.');
        query('DELETE FROM resources WHERE id=?', [$item['id']]);
        remove_upload($item['file_url']);
        audit('resource.deleted', 'resource', $item['id'], ['title' => $item['title']]);
        json_response(['ok' => true]);
    }

    // -------- news: public when published; the moderator also sees and manages drafts
    if ($is('GET', '/news')) {
        $all = (current_user()['role'] ?? '') === 'moderator' && ($_GET['all'] ?? '') === '1';
        $limit = min(max((int) ($_GET['limit'] ?? 100) ?: 100, 1), 500);
        json_response(['news' => array_map('map_news', all(NEWS_QUERY . ($all ? '' : ' WHERE n.published=1') . ' ORDER BY n.created_at DESC LIMIT ?', [$limit]))]);
    }
    if ($is('GET', '/news/{id}')) {
        $item = one('SELECT published FROM news WHERE id=?', [$params['id']]);
        if (!$item || (!$item['published'] && (current_user()['role'] ?? '') !== 'moderator')) fail(404, 'News item not found.');
        json_response(['news' => news_with_media($params['id'])]);
    }
    if ($is('POST', '/news')) {
        $user = require_moderator();
        check_post_size();
        $fields = news_fields();
        $id = uuid();
        $lead = accepted_images('image')[0] ?? null;
        $gallery = accepted_images('gallery');
        transaction(function () use ($id, $fields, $lead, $gallery, $user) {
            query('INSERT INTO news (id,title,summary,body,image_url,published,author,created_at) VALUES (?,?,?,?,?,?,?,?)', [$id, $fields['title'], $fields['summary'], $fields['body'], $lead ? save_news_image($lead) : '', $fields['published'], $user['name'], now()]);
            add_album_images($id, $gallery);
        });
        audit('news.created', 'news', $id, ['title' => $fields['title'], 'published' => (bool) $fields['published']]);
        json_response(['news' => news_with_media($id)], 201);
    }
    // Updates: PUT with JSON, or POST with a multipart form (PHP only parses uploads on POST).
    if ($is('PUT', '/news/{id}') || $is('POST', '/news/{id}')) {
        require_moderator();
        check_post_size();
        $item = one('SELECT * FROM news WHERE id=?', [$params['id']]);
        if (!$item) fail(404, 'News item not found.');
        $fields = news_fields();
        $lead = accepted_images('image')[0] ?? null;
        $imageUrl = $item['image_url'];
        if ($lead || flag(input('removeImage'))) {
            remove_upload($item['image_url']);
            $imageUrl = $lead ? save_news_image($lead) : '';
        }
        query('UPDATE news SET title=?, summary=?, body=?, image_url=?, published=?, updated_at=? WHERE id=?', [$fields['title'], $fields['summary'], $fields['body'], $imageUrl, $fields['published'], now(), $item['id']]);
        remove_album_media($item['id'], id_list(input('removeMedia')));
        add_album_images($item['id'], accepted_images('gallery'));
        audit('news.updated', 'news', $item['id'], ['title' => $fields['title'], 'published' => (bool) $fields['published']]);
        json_response(['news' => news_with_media($item['id'])]);
    }
    if ($is('DELETE', '/news/{id}')) {
        require_moderator();
        $item = one('SELECT image_url, title FROM news WHERE id=?', [$params['id']]);
        if (!$item) fail(404, 'News item not found.');
        $media = all('SELECT url FROM news_media WHERE news_id=?', [$params['id']]);
        query('DELETE FROM news WHERE id=?', [$params['id']]);
        audit('news.deleted', 'news', $params['id'], ['title' => $item['title']]);
        remove_upload($item['image_url']);
        foreach ($media as $entry) remove_upload($entry['url']);
        json_response(['ok' => true]);
    }

    // -------- home page photos, rotated from a folder (images/accueil by default)
    if ($is('GET', '/home-images')) {
        header('Cache-Control: public, max-age=300');
        json_response(['images' => home_images()]);
    }

    // -------- statistics: anonymous page views, and the moderator's dashboard
    if ($is('POST', '/stats/view')) {
        $path = (string) input('path', '');
        // Paths only: no address, no cookie, nothing that identifies the visitor.
        if (preg_match('#^/[A-Za-z0-9/_-]{0,120}$#', $path) && !preg_match('#^/(admin|login)(/|$)#', $path)) {
            // Without INSERT … ON CONFLICT (SQLite 3.24+), for older hosting.
            if (!query('UPDATE page_views SET views=views+1 WHERE day=? AND path=?', [local_day(), $path])->rowCount()) query('INSERT OR IGNORE INTO page_views (day,path,views) VALUES (?,?,1)', [local_day(), $path]);
        }
        json_response(['ok' => true]);
    }
    if ($is('GET', '/admin/stats')) {
        require_moderator();
        json_response(statistics(min(max((int) ($_GET['days'] ?? 30), 7), 365), (string) ($_GET['action'] ?? '')));
    }

    // -------- editable page texts (keys defined by the client in src/contentBlocks.js)
    if ($is('GET', '/content')) {
        header('Cache-Control: no-cache');
        json_response(['content' => load_content()]);
    }
    if ($is('PUT', '/content')) {
        $user = require_moderator();
        $entries = is_array(input('entries')) ? input('entries') : [];
        if (!$entries || count($entries) > 500) fail(400, 'No content changes were sent.');
        foreach ($entries as $entry) {
            if (!is_array($entry) || !preg_match('/^[a-z][a-zA-Z0-9_.-]{0,79}$/', (string) ($entry['key'] ?? '')) || !in_array($entry['lang'] ?? null, CONTENT_LANGUAGES, true)) fail(400, 'Invalid page content entry.');
        }
        transaction(function () use ($entries, $user) {
            foreach ($entries as $entry) {
                $text = clean($entry['value'] ?? '', 5000);
                if ($text !== '') query('INSERT OR REPLACE INTO page_content (key,lang,value,updated_at,updated_by) VALUES (?,?,?,?,?)', [$entry['key'], $entry['lang'], $text, now(), $user['name']]);
                else query('DELETE FROM page_content WHERE key=? AND lang=?', [$entry['key'], $entry['lang']]);
            }
        });
        audit('content.updated', 'page', null, ['keys' => array_values(array_unique(array_map(fn ($entry) => $entry['key'], $entries)))]);
        json_response(['content' => load_content()]);
    }

    fail(404, 'API route not found.');
}
