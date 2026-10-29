<?php
// Library documents uploaded by moderators (uploads/documents/). Public documents
// are open to everyone; "members" documents only to signed-in members. Files are
// always served through api.php, never directly.
declare(strict_types=1);

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

// Allowed extensions and the content types PHP may detect for them. Office files
// are ZIP containers, which some servers report as application/zip.
const DOCUMENT_TYPES = [
    'pdf' => ['application/pdf'],
    'doc' => ['application/msword', 'application/vnd.ms-office', 'application/octet-stream', 'application/CDFV2'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
    'xls' => ['application/vnd.ms-excel', 'application/vnd.ms-office', 'application/octet-stream', 'application/CDFV2'],
    'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
    'ppt' => ['application/vnd.ms-powerpoint', 'application/vnd.ms-office', 'application/octet-stream', 'application/CDFV2'],
    'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'],
    'odt' => ['application/vnd.oasis.opendocument.text', 'application/zip'],
    'ods' => ['application/vnd.oasis.opendocument.spreadsheet', 'application/zip'],
    'jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'png' => ['image/png'], 'webp' => ['image/webp'],
];
// What the browser is told when the file is sent (never the uploader's claim).
const DOCUMENT_SEND_TYPES = [
    'pdf' => 'application/pdf', 'doc' => 'application/msword', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt' => 'application/vnd.ms-powerpoint', 'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odt' => 'application/vnd.oasis.opendocument.text', 'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp',
];

function documents_dir(): string
{
    $dir = config()['uploads_dir'] . '/documents';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    return $dir;
}

function map_resource(array $r): array
{
    return [
        'id' => $r['id'], 'title' => $r['title'], 'category' => $r['category'], 'description' => $r['description'],
        'visibility' => $r['visibility'] ?? 'public', 'featured' => (bool) ($r['featured'] ?? 0),
        'fileUrl' => ($r['file_url'] ?? '') ?: null, 'fileName' => $r['file_name'] ?? '', 'fileType' => $r['file_type'] ?? '', 'fileSize' => (int) ($r['file_size'] ?? 0),
        'updatedAt' => $r['updated_at'],
    ];
}

// The uploaded document of the request, validated; null when none was sent.
function uploaded_document(): ?array
{
    $file = $_FILES['file'] ?? null;
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || ($file['size'] ?? 0) > MAX_DOCUMENT_BYTES) fail(413, 'The document is larger than 20 MB.');
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) fail(400, 'The document could not be received. Please try again.');
    $extension = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
    $detected = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset(DOCUMENT_TYPES[$extension]) || !in_array($detected, DOCUMENT_TYPES[$extension], true)) fail(400, 'Choose a PDF, Word, Excel, PowerPoint, OpenDocument, or image file.');
    $name = preg_replace('/[^\p{L}\p{N} ._()\'-]+/u', '_', basename((string) $file['name'])) ?: "document.$extension";
    return ['tmp' => $file['tmp_name'], 'extension' => $extension, 'name' => mb_substr($name, 0, 160), 'size' => (int) $file['size']];
}

function store_document(array $document): string
{
    $file = uuid() . '.' . $document['extension'];
    if (!move_uploaded_file($document['tmp'], documents_dir() . "/$file")) throw new RuntimeException('Could not store the document.');
    return "/uploads/documents/$file";
}

// Sends a document: PDFs and images open in the browser, other files download,
// both under their original name.
function send_document(array $resource): never
{
    $file = basename((string) $resource['file_url']);
    $path = documents_dir() . "/$file";
    if (!is_file($path)) fail(404, 'Document not found.');
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $inline = in_array($extension, ['pdf', 'jpg', 'jpeg', 'png', 'webp'], true);
    $name = (string) ($resource['file_name'] ?: $file);
    $ascii = preg_replace('/[^A-Za-z0-9 ._()-]+/', '_', $name);
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($name));
    header('Content-Type: ' . (DOCUMENT_SEND_TYPES[$extension] ?? 'application/octet-stream'));
    // Chromium-based browsers (Chrome, Brave, Edge) refuse to open a sandboxed PDF
    // (ERR_BLOCKED_BY_CLIENT); PDFs run in the browser's own viewer, which isolates them.
    if ($extension !== 'pdf') header('Content-Security-Policy: default-src \'none\'; img-src \'self\'; style-src \'unsafe-inline\'; sandbox');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: ' . (($resource['visibility'] ?? 'public') === 'public' ? 'public, max-age=3600' : 'private, no-store'));
    header('X-Content-Type-Options: nosniff');
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
    readfile($path);
    exit;
}
