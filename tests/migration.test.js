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
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  for (const table of tables) assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sqlite_master WHERE name=?').get(table).count, 1, table);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0, 'Production is not seeded with a demo account');
  assert.ok(!readdirSync(dataDir).some((name) => name.startsWith('tourneur-before-')), 'Nothing to back up yet');
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});
