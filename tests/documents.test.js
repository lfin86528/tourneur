import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startPhpServer } from '../scripts/php.mjs';

const dir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-docs-'));
let server;
const jars = {};
const call = async (pathName, options = {}, jar) => {
  const headers = { ...(options.headers || {}) };
  if (jars[jar]) headers.cookie = jars[jar];
  const response = await fetch(`${server.base}/api${pathName}`, { ...options, headers });
  const cookie = response.headers.get('set-cookie');
  if (cookie) jars[jar] = cookie.split(';')[0];
  return { response, body: await response.json() };
};
const login = (email, jar) => call('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo2026!' }) }, jar);
const pdf = (text) => new Blob([`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% ${text}\ntrailer << /Root 1 0 R >>\n%%EOF\n`], { type: 'application/pdf' });
const form = (fields, file, name) => {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, String(value)));
  if (file) body.append('file', file, name);
  return { method: 'POST', body };
};
const download = (url, jar) => fetch(server.base + url, { headers: jars[jar] ? { cookie: jars[jar] } : {} });

before(async () => {
  server = await startPhpServer({ port: 4187, env: { TURNERY_ENV: 'development', TURNERY_DATA_DIR: path.join(dir, 'data'), TURNERY_UPLOADS_DIR: path.join(dir, 'uploads'), TURNERY_LEGACY_IMPORT: '0' } });
  await login('admin@tourneur.test', 'owner');
});
after(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
});

test('the moderator adds documents; visitors read and open them', async () => {
  assert.equal((await call('/resources', form({ title: 'X' }, pdf('x'), 'x.pdf'), 'anonymous')).response.status, 401);
  assert.equal((await call('/resources', form({ title: 'Sans fichier' }), 'owner')).response.status, 400);
  assert.equal((await call('/resources', form({ title: 'Page' }, new Blob(['<html><script>alert(1)</script></html>'], { type: 'text/html' }), 'page.html'), 'owner')).response.status, 400, 'HTML is refused');
  assert.equal((await call('/resources', form({ title: 'Faux PDF' }, new Blob(['just text'], { type: 'application/pdf' }), 'faux.pdf'), 'owner')).response.status, 400, 'The content must match the extension');

  const care = await call('/resources', form({ title: 'Entretien des bols', category: 'Entretien', description: 'Huile et cire', visibility: 'members' }, pdf('entretien'), 'Entretien des bols.pdf'), 'owner');
  assert.equal(care.response.status, 201);
  assert.deepEqual([care.body.resource.fileName, care.body.resource.fileType, care.body.resource.visibility], ['Entretien des bols.pdf', 'pdf', 'public'], 'everything is public on tourneur.ch');
  const visible = (await call('/resources', {}, 'anonymous')).body.resources.map((resource) => resource.title);
  assert.ok(visible.includes('Entretien des bols'));
  const open = await download(care.body.resource.fileUrl);
  assert.equal(open.status, 200);
  assert.equal(open.headers.get('content-type'), 'application/pdf');
  assert.match(open.headers.get('content-disposition'), /^inline; .*filename\*=UTF-8''Entretien%20des%20bols\.pdf/);
  assert.equal(open.headers.get('content-security-policy'), null, 'Chromium blocks sandboxed PDFs');
});

test('the moderator edits, replaces, and deletes documents', async () => {
  const added = await call('/resources', form({ title: 'Tarifs', category: 'Tarifs' }, pdf('v1'), 'tarifs-v1.pdf'), 'owner');
  const first = added.body.resource;
  const edited = await call(`/resources/${first.id}`, form({ title: 'Tarifs 2027', category: 'Tarifs' }), 'owner');
  assert.deepEqual([edited.body.resource.title, edited.body.resource.fileUrl], ['Tarifs 2027', first.fileUrl], 'Editing keeps the file');

  const replaced = await call(`/resources/${first.id}`, form({ title: 'Tarifs 2027', category: 'Tarifs' }, pdf('v2'), 'tarifs-v2.pdf'), 'owner');
  assert.notEqual(replaced.body.resource.fileUrl, first.fileUrl);
  assert.equal((await download(first.fileUrl)).status, 404, 'The previous version is removed');
  assert.match(await (await download(replaced.body.resource.fileUrl)).text(), /v2/);

  assert.equal((await call(`/resources/${first.id}`, { method: 'DELETE' }, 'anonymous')).response.status, 401);
  assert.equal((await call(`/resources/${first.id}`, { method: 'DELETE' }, 'owner')).response.status, 200);
  assert.equal((await download(replaced.body.resource.fileUrl)).status, 404);
  const stored = readdirSync(path.join(dir, 'uploads', 'documents'));
  assert.ok(!stored.some((name) => replaced.body.resource.fileUrl.endsWith(name)), 'The file is deleted from disk');
  const journal = (await call('/admin/stats?action=resource', {}, 'owner')).body.audit.map((entry) => entry.action);
  for (const action of ['resource.created', 'resource.updated', 'resource.deleted']) assert.ok(journal.includes(action), action);
});
