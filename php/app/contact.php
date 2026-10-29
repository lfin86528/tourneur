<?php
// Messages sent with the contact form: kept for the moderator, mailed to the
// contact address (answer = reply to the e-mail), and acknowledged to the sender.
declare(strict_types=1);

function map_message(array $m): array
{
    return ['id' => $m['id'], 'name' => $m['name'], 'email' => $m['email'], 'phone' => $m['phone'], 'subject' => $m['subject'], 'message' => $m['message'], 'status' => $m['status'], 'handledAt' => $m['handled_at'], 'createdAt' => $m['created_at']];
}

function contact_input(): array
{
    $values = [
        'name' => clean(input('name'), 120),
        'email' => strtolower(clean(input('email'), 160)),
        'phone' => clean(input('phone'), 50),
        'subject' => clean(input('subject'), 160),
        'message' => clean(preg_replace('/\r\n?/', "\n", (string) input('message', '')), 5000),
    ];
    if ($values['name'] === '' || $values['message'] === '') fail(400, 'Please fill in all the required fields.');
    if (!filter_var($values['email'], FILTER_VALIDATE_EMAIL)) fail(400, 'Please enter a valid e-mail address.');
    return $values;
}

// [subject, text] for the turner, then for the sender.
function contact_mails(array $m): array
{
    $details = implode("\n", array_filter(["De : {$m['name']} <{$m['email']}>", $m['phone'] !== '' ? "Téléphone : {$m['phone']}" : '', $m['subject'] !== '' ? "Sujet : {$m['subject']}" : '']));
    $notice = [
        'Message de ' . $m['name'] . ($m['subject'] !== '' ? ' : ' . $m['subject'] : ''),
        "$details\n\n{$m['message']}\n\n—\nRépondez directement à ce message pour écrire à {$m['name']}.\nTous les messages : " . site_origin() . "/admin/messages",
    ];
    $receipt = [
        'Votre message à tourneur.ch',
        "Bonjour {$m['name']},\n\nMerci pour votre message, il m’est bien parvenu. Je vous réponds dès que possible.\n\nVotre message :\n{$m['message']}\n\n" . config()['owner_name'] . "\ntourneur.ch",
    ];
    return [$notice, $receipt];
}

function site_origin(): string
{
    return (https() ? 'https://' : 'http://') . ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost');
}
