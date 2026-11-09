<?php
// Image processing with GD: EXIF rotation, resizing, metadata removal, and
// conversion to WebP (JPEG when the host's GD has no WebP support).
declare(strict_types=1);

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function image_extension(): string
{
    return function_exists('imagewebp') ? 'webp' : 'jpg';
}

// Uploaded files of one form field, normalised to a list (supports "field[]").
function uploaded_files(string $field): array
{
    $entry = $_FILES[$field] ?? null;
    if (!$entry) return [];
    if (!is_array($entry['name'])) return [$entry];
    $files = [];
    foreach (array_keys($entry['name']) as $index) {
        $files[] = array_combine(array_keys($entry), array_map(fn ($values) => $values[$index], $entry));
    }
    return $files;
}

// Accepted image uploads only (JPEG, PNG, WebP, at most 15 MB), like the browser checks.
function accepted_images(string $field): array
{
    $accepted = [];
    foreach (uploaded_files($field) as $file) {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_INI_SIZE || ($file['size'] ?? 0) > MAX_UPLOAD_BYTES) throw new HttpError(413, 'The image is larger than 15 MB.');
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) continue;
        $type = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (in_array($type, ACCEPTED_TYPES, true)) $accepted[] = $file + ['type_detected' => $type];
    }
    return $accepted;
}

// Loads an image file, applies its EXIF orientation, and returns the GD image.
function load_image(string $path): ?GdImage
{
    @ini_set('memory_limit', '512M');
    $data = @file_get_contents($path);
    $image = $data === false ? false : @imagecreatefromstring($data);
    if (!$image) return null;
    $orientation = 1;
    if (function_exists('exif_read_data') && str_starts_with($data, "\xFF\xD8")) {
        $exif = @exif_read_data($path);
        $orientation = (int) ($exif['Orientation'] ?? 1);
    }
    // imagerotate() turns counter-clockwise: -90 is a quarter turn clockwise.
    $turned = match ($orientation) {
        3 => imagerotate($image, 180, 0),
        5, 6 => imagerotate($image, -90, 0),
        7, 8 => imagerotate($image, 90, 0),
        default => $image,
    } ?: $image;
    if (in_array($orientation, [2, 5, 7], true)) imageflip($turned, IMG_FLIP_HORIZONTAL);
    if ($orientation === 4) imageflip($turned, IMG_FLIP_VERTICAL);
    return $turned;
}

// Fits the image inside a square of $maxEdge pixels without enlarging it.
function resize_image(GdImage $image, int $maxEdge): GdImage
{
    $width = imagesx($image);
    $height = imagesy($image);
    $scale = min(1, $maxEdge / max($width, $height));
    if ($scale >= 1) return $image;
    $target = imagecreatetruecolor(max(1, (int) round($width * $scale)), max(1, (int) round($height * $scale)));
    imagealphablending($target, false);
    imagesavealpha($target, true);
    imagecopyresampled($target, $image, 0, 0, 0, 0, imagesx($target), imagesy($target), $width, $height);
    return $target;
}

// Writes the image as WebP (or JPEG) and returns the file name used.
function save_image(GdImage $image, string $directory, string $name, int $quality): string
{
    $file = $name . '.' . image_extension();
    $path = $directory . '/' . $file;
    if (image_extension() === 'webp') {
        imagesavealpha($image, true);
        imagewebp($image, $path, $quality);
    } else {
        // JPEG has no transparency: flatten on white.
        $flat = imagecreatetruecolor(imagesx($image), imagesy($image));
        imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
        imagecopy($flat, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
        imagejpeg($flat, $path, $quality);
    }
    return $file;
}
