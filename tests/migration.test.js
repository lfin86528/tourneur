import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import { runPhp } from '../scripts/php.mjs';

const tables = ['users', 'photos', 'news', 'news_media', 'resources', 'page_content', 'messages', 'login_attempts', 'audit_log', 'page_views'];

test('an empty data folder gets the whole schema, without a backup copy', () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-migration-'));
  const result = runPhp(['-r', "require 'php/app/bootstrap.php'; db();"], { TURNERY_DATA_DIR: dataDir, TURNERY_UPLOADS_DIR: path.join(dataDir, 'uploads') });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const db = new DatabaseSync(path.join(dataDir, 'tourneur.db'));
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  assert.ok(db.prepare('PRAGMA table_info(photos)').all().some((column) => column.name === 'slug'), 'pieces have an address');
  for (const table of tables) assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sqlite_master WHERE name=?').get(table).count, 1, table);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0, 'Production is not seeded with a demo account');
  assert.ok(!readdirSync(dataDir).some((name) => name.startsWith('tourneur-before-')), 'Nothing to back up yet');
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('the first page view (several requests at once) sets the database up once', async (t) => {
  const { startPhpServer } = await import('../scripts/php.mjs');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-race-'));
  const server = await startPhpServer({ port: 4295, env: { TURNERY_DATA_DIR: path.join(dir, 'data'), TURNERY_UPLOADS_DIR: path.join(dir, 'uploads') } });
  t.after(async () => { await server.stop(); rmSync(dir, { recursive: true, force: true }); });
  const statuses = await Promise.all(['/api/content', '/api/bootstrap', '/api/photos', '/api/content', '/api/bootstrap', '/api/photos'].map((url) => fetch(server.base + url).then((response) => response.status)));
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200]);
  const { photos } = await (await fetch(`${server.base}/api/photos`)).json();
  assert.equal(photos.length, 4, 'The former pieces are imported once');
});

test('a database stuck halfway (version 1) is finished and backed up', async (t) => {
  const { startPhpServer } = await import('../scripts/php.mjs');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-halfway-'));
  const dataDir = path.join(dir, 'data');
  const env = { TURNERY_DATA_DIR: dataDir, TURNERY_UPLOADS_DIR: path.join(dir, 'uploads'), TURNERY_LEGACY_IMPORT: '0' };
  // Only the first migration, as left by the failed first visit online.
  const first = runPhp(['-r', "require 'php/app/bootstrap.php'; $db = new PDO('sqlite:' . config()['data_dir'] . '/tourneur.db'); $db->exec(migrations()[0]); $db->exec('PRAGMA user_version = 1');"], env);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const server = await startPhpServer({ port: 4296, env });
  t.after(async () => { await server.stop(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal((await fetch(`${server.base}/api/photos`)).status, 200);
  assert.ok(readdirSync(dataDir).some((name) => /^tourneur-before-v2-\d+\.db$/.test(name)), 'A backup is kept');
});
