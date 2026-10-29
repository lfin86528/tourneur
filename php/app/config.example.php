<?php
// Optional settings. Copy this file to config.php (same folder) to change them.
// config.php is never in Git nor replaced by a deployment: keep the SMTP password there.
return [
    // 'production' or 'development'. Development seeds demo data and shows errors.
    'environment' => 'production',

    // true: an empty database receives a demo account (admin@tourneur.test,
    // password Demo2026!) shown on the login page. For reviews only.
    'demo_mode' => false,

    // Where the SQLite database and the uploaded photos are kept. Both default to
    // folders inside the site (protected by .htaccess). With Plesk Git deployment,
    // folders outside httpdocs are safest, e.g. the domain's private folder:
    // 'data_dir' => __DIR__ . '/../../private/tourneur-data',
    // 'uploads_dir' => __DIR__ . '/../../private/tourneur-uploads',

    // Credited on every piece and news item.
    // 'owner_name' => 'Lino Finini',

    // Receives the messages of the contact form (replies go straight to the sender).
    // 'contact_email' => 'info@tourneur.ch',

    // Outgoing e-mail (contact form). Authenticated SMTP with a real mailbox is the
    // most reliable; the sender is that mailbox.
    // 'smtp' => [
    //     'host' => 'mail.example.ch',
    //     'port' => 465,
    //     'encryption' => 'ssl',           // 465: 'ssl'; 587: 'starttls'
    //     'username' => 'noreply@tourneur.ch',
    //     'password' => 'mot-de-passe-de-la-boite',
    // ],

    // Without SMTP, PHP's mail() is used with this sender.
    // 'mail_from' => 'noreply@tourneur.ch',
];
