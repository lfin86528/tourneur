<?php
// Creates the moderator account, or resets it (new e-mail, name, password) — SSH.
// tourneur.ch has a single account: an existing one is updated, never doubled.
//   php app/cli/create-moderator.php --name "Prénom Nom" --email adresse@example.ch
// Prints a temporary password once; change it after signing in.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/../bootstrap.php';

$options = getopt('', ['name:', 'email:']);
$name = clean($options['name'] ?? '', 120);
$email = strtolower(clean($options['email'] ?? '', 160));
if ($name === '' || !preg_match('/^\S+@\S+\.\S+$/', $email)) {
    fwrite(STDERR, "Usage: php app/cli/create-moderator.php --name \"Prénom Nom\" --email adresse@example.ch\n");
    exit(1);
}
$password = rtrim(strtr(base64_encode(random_bytes(9)), '+/', '-_'), '=');
$existing = one('SELECT id FROM users WHERE email=?', [$email]) ?? one('SELECT id FROM users ORDER BY joined_at LIMIT 1');
if ($existing) query("UPDATE users SET name=?, email=?, role='moderator', status='active', password_hash=?, initials=? WHERE id=?", [$name, $email, hash_password($password), initials_of($name), $existing['id']]);
else query("INSERT INTO users (id,name,email,password_hash,role,status,initials) VALUES (?,?,?,?,'moderator','active',?)", [uuid(), $name, $email, hash_password($password), initials_of($name)]);
echo ($existing ? 'Updated' : 'Created') . " moderator $name <$email>\n";
echo "Temporary password (shown once): $password\n";
