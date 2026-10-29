import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import { runPhp, startPhpServer } from '../scripts/php.mjs';

const dirs = (base) => ({ TURNERY_DATA_DIR: path.join(base, 'data'), TURNERY_UPLOADS_DIR: path.join(base, 'uploads'), TURNERY_LEGACY_IMPORT: '0' });
const accounts = (base) => {
  const db = new DatabaseSync(path.join(base, 'data', 'tourneur.db'));
  const rows = db.prepare('SELECT name, email, role FROM users').all().map((row) => ({ ...row }));
  db.close();
  return rows;
};

test('the command line creates the single account, then resets it instead of adding another', (t) => {
  const site = mkdtempSync(path.join(os.tmpdir(), 'tourneur-cli-'));
  t.after(() => rmSync(site, { recursive: true, force: true }));
  const created = runPhp(['php/app/cli/create-moderator.php', '--name', 'Lino Finini', '--email', 'lino@example.ch'], dirs(site));
  assert.equal(created.status, 0, created.stderr);
  assert.match(created.stdout, /Temporary password \(shown once\): \S{10,}/);
  const reset = runPhp(['php/app/cli/create-moderator.php', '--name', 'Lino Finini', '--email', 'info@tourneur.ch'], dirs(site));
  assert.match(reset.stdout, /^Updated/);
  assert.deepEqual(accounts(site), [{ name: 'Lino Finini', email: 'info@tourneur.ch', role: 'moderator' }]);
});

test('setup page creates the account once, with the setup key', async (t) => {
  const site = mkdtempSync(path.join(os.tmpdir(), 'tourneur-setup-'));
  const server = await startPhpServer({ port: 4281, env: dirs(site) });
  t.after(async () => { await server.stop(); rmSync(site, { recursive: true, force: true }); });
  const page = async (body) => (await fetch(`${server.base}/setup.php`, body ? { method: 'POST', body: new URLSearchParams(body) } : {})).text();

  assert.match(await page(), /Clé d’installation/);
  const key = readFileSync(path.join(site, 'data', 'setup-key.txt'), 'utf8').trim();
  const account = { name: 'Lino Finini', email: 'lino@example.ch', password: 'un-mot-de-passe-long', confirm: 'un-mot-de-passe-long' };
  assert.match(await page({ ...account, key: 'WRONG' }), /clé d’installation est incorrecte/);
  assert.match(await page({ ...account, key }), /Votre compte est créé/);
  assert.match(await page(), /le compte d’administration existe déjà/, 'The page is inert afterwards');
  assert.doesNotMatch(await page({ ...account, email: 'intrus@example.ch', key }), /Votre compte est créé/);
  assert.equal(accounts(site).length, 1);

  const login = await fetch(`${server.base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'lino@example.ch', password: 'un-mot-de-passe-long' }) });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.role, 'moderator');
  assert.equal((await fetch(`${server.base}/data/tourneur.db`)).status, 403, 'The database is never served');
  assert.equal((await fetch(`${server.base}/api/config`).then((response) => response.json())).demo, false);
});
