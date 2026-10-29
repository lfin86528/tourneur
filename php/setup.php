<?php
// First-run page: checks the hosting and creates the moderator account (the only
// account of tourneur.ch). It only works while the site has no moderator, and asks for the setup key
// stored in data/setup-key.txt (readable with FTP or the Plesk file manager only). Afterwards it is inert.
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/http.php';
require __DIR__ . '/app/images.php';
require __DIR__ . '/app/legacy.php';

header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex');

$escape = fn ($value) => htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
$bytes = function (string $setting): int {
    $value = trim((string) ini_get($setting));
    return (int) $value * match (strtoupper(substr($value, -1))) { 'G' => 1 << 30, 'M' => 1 << 20, 'K' => 1 << 10, default => 1 };
};

// ---------------------------------------------------------------- hosting checks
$checks = [];
$add = function (string $label, bool $ok, string $detail = '', bool $required = true) use (&$checks) { $checks[] = compact('label', 'ok', 'detail', 'required'); };
$add('PHP 8.1 ou plus récent', PHP_VERSION_ID >= 80100, PHP_VERSION);
$add('Extension PDO SQLite (base de données)', extension_loaded('pdo_sqlite'));
$add('Extension GD (traitement des photos)', extension_loaded('gd'));
$add('Photos au format WebP', function_exists('imagewebp'), function_exists('imagewebp') ? '' : 'les photos seront enregistrées en JPEG', false);
$add('Extension EXIF (orientation des photos de téléphone)', function_exists('exif_read_data'), '', false);
$add('Extension fileinfo (contrôle des fichiers envoyés)', class_exists('finfo'));
$add('Envoi de fichiers (photos 15 Mo, documents 20 Mo)', $bytes('upload_max_filesize') >= 20 << 20 && $bytes('post_max_size') >= 21 << 20, 'upload_max_filesize = ' . ini_get('upload_max_filesize') . ', post_max_size = ' . ini_get('post_max_size'));
$problem = '';
$database = false;
try {
    $config = config();
    $add('Dossier data/ accessible en écriture', is_writable($config['data_dir']));
    $add('Dossier uploads/ accessible en écriture', is_writable($config['uploads_dir']));
    // The SQLite version, read before opening the site's database (shown even if that fails).
    $version = (string) (new PDO('sqlite::memory:'))->query('SELECT sqlite_version()')->fetchColumn();
    $add('SQLite 3.7 ou plus récent', version_compare($version, '3.7.0', '>='), $version);
    db();
    $database = true;
    $pieces = (int) scalar("SELECT COUNT(*) FROM photos");
    $add('Portfolio', true, $pieces . ' pièce(s), dont celles de l’ancien site importées automatiquement', false);
} catch (Throwable $error) {
    $add('Base de données', false, $error->getMessage());
}
$ready = !array_filter($checks, fn ($check) => $check['required'] && !$check['ok']);

// ---------------------------------------------------------------- first moderator
$keyFile = $database ? config()['data_dir'] . '/setup-key.txt' : '';
$configured = $database && active_moderators() > 0;
$created = false;
$form = ['name' => '', 'email' => ''];
$keyReady = false;
if ($database && !$configured) {
    if (!is_file($keyFile)) @file_put_contents($keyFile, strtoupper(bin2hex(random_bytes(5))) . "\n", LOCK_EX);
    $keyReady = is_file($keyFile) && trim((string) file_get_contents($keyFile)) !== '';
    if ($keyReady && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $form = ['name' => clean($_POST['name'] ?? '', 120), 'email' => strtolower(clean($_POST['email'] ?? '', 160))];
        $password = (string) ($_POST['password'] ?? '');
        try {
            limit_attempts();
            if (!hash_equals(strtoupper(trim((string) file_get_contents($keyFile))), strtoupper(trim((string) ($_POST['key'] ?? ''))))) $problem = 'La clé d’installation est incorrecte.';
            elseif ($form['name'] === '' || !preg_match('/^\S+@\S+\.\S+$/', $form['email'])) $problem = 'Indiquez un nom et une adresse e-mail valide.';
            elseif (mb_strlen($password) < 10) $problem = 'Le mot de passe doit comporter au moins 10 caractères.';
            elseif ($password !== (string) ($_POST['confirm'] ?? '')) $problem = 'Les deux mots de passe ne correspondent pas.';
            else {
                $existing = one('SELECT id FROM users WHERE email=?', [$form['email']]);
                if ($existing) query("UPDATE users SET name=?, role='moderator', status='active', password_hash=?, initials=? WHERE id=?", [$form['name'], hash_password($password), initials_of($form['name']), $existing['id']]);
                else query("INSERT INTO users (id,name,email,password_hash,role,status,initials) VALUES (?,?,?,?,'moderator','active',?)", [uuid(), $form['name'], $form['email'], hash_password($password), initials_of($form['name'])]);
                audit('setup.moderator', 'user', null, ['name' => $form['name']], ['id' => null, 'name' => $form['name']]);
                unlink($keyFile);
                $created = true;
                $configured = true;
            }
        } catch (HttpError $error) {
            $problem = 'Trop de tentatives. Réessayez dans 15 minutes.';
        }
    }
}
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Installation — tourneur.ch</title>
<style>
  :root { --green: #4a2e1b; --ink: #2a2018; --muted: #6f655b; --line: #e6ddd0; --paper: #f7f3ec; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 40px 16px 60px; }
  h1 { font-family: Georgia, serif; font-weight: 400; font-size: 34px; margin: 0 0 6px; }
  h2 { font-size: 17px; margin: 30px 0 12px; }
  p { margin: 0 0 12px; color: var(--muted); }
  ul { list-style: none; padding: 0; margin: 0; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
  li { display: flex; gap: 10px; padding: 11px 14px; border-top: 1px solid var(--line); }
  li:first-child { border-top: 0; }
  li small { display: block; color: var(--muted); }
  .ok { color: #287343; } .ko { color: #a44d3d; } .warn { color: #926b15; }
  form { display: grid; gap: 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
  label { display: grid; gap: 5px; font-weight: 600; font-size: 13px; }
  input { font: inherit; padding: 10px 12px; border: 1px solid #d9ded5; border-radius: 8px; }
  button, .button { display: inline-block; background: var(--green); color: #fff; border: 0; border-radius: 8px; padding: 12px 18px; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
  .notice { padding: 12px 14px; border-radius: 10px; background: #edf2ec; color: #355a45; margin: 16px 0; }
  .error { background: #fff0ec; color: #9b4133; }
  code { background: #eceee7; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
<main>
  <h1>tourneur.ch</h1>
  <p>Vérification de l’hébergement et création de votre compte d’administration.</p>

  <h2>Hébergement</h2>
  <ul>
    <?php foreach ($checks as $check): $class = $check['ok'] ? 'ok' : ($check['required'] ? 'ko' : 'warn'); ?>
      <li><span class="<?= $class ?>"><?= $check['ok'] ? '✔' : ($check['required'] ? '✖' : '!') ?></span><span><?= $escape($check['label']) ?><?php if ($check['detail']): ?><small><?= $escape($check['detail']) ?></small><?php endif; ?></span></li>
    <?php endforeach; ?>
  </ul>
  <?php if (!$ready): ?>
    <div class="notice error">Un élément obligatoire manque. Dans Plesk, ouvrez le domaine → <strong>Paramètres PHP</strong> pour choisir PHP 8.1 ou plus récent et activer les extensions, puis rechargez cette page.</div>
  <?php endif; ?>
  <p>Contrôle de sécurité : <a href="/data/tourneur.db">ce lien</a> doit afficher « Forbidden » (accès refusé). S’il télécharge un fichier, le fichier <code>.htaccess</code> n’a pas été envoyé.</p>

  <h2>Compte d’administration</h2>
  <?php if ($created): ?>
    <div class="notice">Votre compte est créé. Cette page est désormais désactivée.</div>
    <a class="button" href="/login">Se connecter</a>
  <?php elseif ($configured): ?>
    <div class="notice">Le site est configuré : le compte d’administration existe déjà. Pour changer son mot de passe sans pouvoir vous connecter, utilisez <code>php app/cli/create-moderator.php</code> en SSH.</div>
    <a class="button" href="/">Ouvrir le site</a>
  <?php elseif (!$database): ?>
    <div class="notice error">La base de données n’est pas accessible (voir la ligne en rouge ci-dessus) : la clé d’installation sera créée dès que ce point sera corrigé. Rechargez alors cette page.</div>
  <?php elseif (!$keyReady): ?>
    <div class="notice error">Impossible d’écrire la clé d’installation dans <code><?= $escape($keyFile) ?></code>. Vérifiez (FTP ou Gestionnaire de fichiers Plesk) que le dossier <code>data/</code> est accessible en écriture (droits 755 ou 775), puis rechargez cette page.</div>
  <?php else: ?>
    <p>La clé vient d’être créée dans le fichier <code>setup-key.txt</code> du dossier <code>data/</code> (sur le serveur : <code><?= $escape($keyFile) ?></code>). Ouvrez-le avec le Gestionnaire de fichiers de Plesk (ou par FTP) et recopiez la clé.</p>
    <?php if ($problem): ?><div class="notice error"><?= $escape($problem) ?></div><?php endif; ?>
    <form method="post" autocomplete="off">
      <label>Clé d’installation <input name="key" required></label>
      <label>Nom complet <input name="name" required value="<?= $escape($form['name']) ?>"></label>
      <label>Adresse e-mail <input name="email" type="email" required value="<?= $escape($form['email']) ?>"></label>
      <label>Mot de passe (10 caractères minimum) <input name="password" type="password" minlength="10" required autocomplete="new-password"></label>
      <label>Répétez le mot de passe <input name="confirm" type="password" minlength="10" required autocomplete="new-password"></label>
      <button>Créer mon compte</button>
    </form>
  <?php endif; ?>
</main>
</body>
</html>
