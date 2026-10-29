<?php
// The pieces of the former site (Astro + Sveltia CMS, until October 2026), imported
// once into an empty portfolio: same titles, texts and dates; type and wood added.
// Afterwards the moderator edits or deletes them like any other piece.
declare(strict_types=1);

const LEGACY_PIECES = [
    ['legacy-poivrier-olivier', 'Poivrier transparent en olivier', 'Poivrier en olivier avec section transparente.', 'Olivier', 'mill', '2026-07-28', '1000073504.jpg'],
    ['legacy-batte-baseball', 'Batte de baseball', 'Batte de baseball en abricotier.', 'Abricotier', 'other', '2026-03-01', 'pxl_20240316_075533024.jpg'],
    ['legacy-bol-noyer', 'Grand bol en noyer', 'Grand bol tourné dans une pièce de noyer vert. Forme épurée.', 'Noyer', 'bowl', '2026-02-10', '1000066346.jpg'],
    ['legacy-poivriers-dully', 'Lot de poivriers à une main', 'Commande de la commune de Dully. Poivriers à une main en cerisier de la région. Kit PennState Industries.', 'Cerisier', 'mill', '2026-01-15', '1000072783.jpg'],
];

function import_legacy_pieces(PDO $db): void
{
    // Once only, even if the pieces are deleted later.
    if ((int) $db->query("SELECT COUNT(*) FROM audit_log WHERE action='legacy.imported'")->fetchColumn() > 0) return;
    if (!function_exists('load_image')) return; // images.php not loaded (command-line tools)
    $dir = config()['uploads_dir'];
    $imported = 0;
    foreach (LEGACY_PIECES as [$id, $title, $story, $wood, $kind, $date, $file]) {
        $source = __DIR__ . "/legacy/$file";
        if (!is_file($source) || $db->query('SELECT COUNT(*) FROM photos WHERE id=' . $db->quote($id))->fetchColumn()) continue;
        $image = load_image($source);
        if (!$image) continue;
        $full = resize_image($image, 2400);
        $fullName = save_image($full, $dir, $id, 88);
        $thumbName = save_image(resize_image($full, 800), $dir, "$id-thumb", 80);
        $at = iso(new DateTimeImmutable("$date 12:00", new DateTimeZone('Europe/Zurich')));
        $db->prepare("INSERT INTO photos (id,title,story,wood,kind,image_url,thumbnail_url,status,width,height,size_bytes,created_at,reviewed_at) VALUES (?,?,?,?,?,?,?,'approved',?,?,?,?,?)")
            ->execute([$id, $title, $story, $wood, $kind, "/uploads/$fullName", "/uploads/$thumbName", imagesx($image), imagesy($image), filesize($source), $at, $at]);
        $imported++;
    }
    $db->prepare("INSERT INTO audit_log (at,actor_name,action,details) VALUES (?,'','legacy.imported',?)")->execute([now(), json_encode(['pieces' => $imported])]);
}
