import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { startPhpServer } from '../scripts/php.mjs';

// The PHP API on a fresh demo database: one moderator (admin@tourneur.test),
// and the pieces of the former site imported at first start.
const dir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-test-'));
let server;
const jars = {};
const call = async (pathName, options = {}, jar = 'visitor') => {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['content-type'] ??= 'application/json';
  if (jars[jar]) headers.cookie = jars[jar];
  const response = await fetch(`${server.base}/api${pathName}`, { ...options, headers });
  const cookie = response.headers.get('set-cookie');
  if (cookie) jars[jar] = cookie.split(';')[0];
  return { response, body: await response.json() };
};
const send = (method, pathName, body, jar) => call(pathName, { method, body: body && JSON.stringify(body) }, jar);
const login = (jar, password = 'Demo2026!') => send('POST', '/auth/login', { email: 'admin@tourneur.test', password }, jar);
const mailLog = () => (existsSync(path.join(dir, 'data', 'mail.log')) ? readFileSync(path.join(dir, 'data', 'mail.log'), 'utf8') : '');
const jpeg = (width, height, options = {}) => sharp({ create: { width, height, channels: 3, background: '#7a5a3f' } }).jpeg().withMetadata(options).toBuffer();
const pieceForm = async (fields, image) => {
  const form = new FormData();
  form.append('photo', new Blob([image ?? await jpeg(1600, 1200)], { type: 'image/jpeg' }), 'piece.jpg');
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  return { method: 'POST', body: form };
};

before(async () => {
  server = await startPhpServer({ port: 4280, env: { TURNERY_ENV: 'development', TURNERY_DATA_DIR: path.join(dir, 'data'), TURNERY_UPLOADS_DIR: path.join(dir, 'uploads') } });
  assert.equal((await login('owner')).response.status, 200);
});
after(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
});

test('the pieces of the former site are imported once, with their dates, types and woods', async () => {
  const { photos } = (await call('/photos')).body;
  const legacy = photos.filter((photo) => photo.id.startsWith('legacy-'));
  assert.deepEqual(legacy.map((photo) => photo.title), ['Poivrier transparent en olivier', 'Batte de baseball', 'Grand bol en noyer', 'Lot de poivriers à une main'], 'newest first');
  const bowl = legacy.find((photo) => photo.id === 'legacy-bol-noyer');
  assert.deepEqual({ kind: bowl.kind, wood: bowl.wood, day: bowl.createdAt.slice(0, 10), author: bowl.author }, { kind: 'bowl', wood: 'Noyer', day: '2026-02-10', author: 'Lino Finini' });
  assert.equal((await fetch(server.base + bowl.thumbnailUrl)).status, 200);
  assert.equal('userId' in photos[0], false, 'visitors get no internal fields');
});

test('only the moderator adds pieces; they are published at once, then edited or removed', async () => {
  assert.equal((await call('/photos', await pieceForm({ title: 'Intrus' }))).response.status, 401, 'visitors cannot add');
  const added = await call('/photos', await pieceForm({ title: 'Vase en if', kind: 'vase', wood: 'If', story: 'Finition huile.', date: '2026-09-14' }), 'owner');
  assert.equal(added.response.status, 201);
  const piece = added.body.photo;
  assert.deepEqual({ status: piece.status, kind: piece.kind, day: piece.createdAt.slice(0, 10) }, { status: 'approved', kind: 'vase', day: '2026-09-14' });
  assert.ok((await call('/photos')).body.photos.some((photo) => photo.id === piece.id), 'visible to visitors right away');
  assert.equal((await fetch(server.base + piece.imageUrl)).status, 200);

  assert.equal((await send('PATCH', `/photos/${piece.id}`, { title: 'X' })).response.status, 401);
  const edited = await send('PATCH', `/photos/${piece.id}`, { title: 'Grand vase en if', kind: 'sculpture', wood: 'If – Buis', story: 'Huile dure.', date: '2026-09-20' }, 'owner');
  assert.deepEqual({ title: edited.body.photo.title, kind: edited.body.photo.kind, wood: edited.body.photo.wood, day: edited.body.photo.createdAt.slice(0, 10) }, { title: 'Grand vase en if', kind: 'sculpture', wood: 'If – Buis', day: '2026-09-20' });
  const keptDate = await send('PATCH', `/photos/${piece.id}`, { title: 'Grand vase en if', kind: 'sculpture' }, 'owner');
  assert.equal(keptDate.body.photo.createdAt.slice(0, 10), '2026-09-20', 'no date sent: the date is kept');

  const files = () => readdirSync(path.join(dir, 'uploads')).filter((name) => name.startsWith(piece.id));
  assert.equal(files().length, 2, 'photo and thumbnail');
  assert.equal((await send('DELETE', `/photos/${piece.id}`, null)).response.status, 401);
  assert.equal((await send('DELETE', `/photos/${piece.id}`, null, 'owner')).response.status, 200);
  assert.equal(files().length, 0, 'files removed');
  assert.equal((await fetch(server.base + piece.imageUrl)).status, 404);
  const journal = (await call('/admin/stats?days=7&action=photo', {}, 'owner')).body.audit.map((entry) => entry.action);
  assert.deepEqual(journal.slice(0, 4), ['photo.deleted', 'photo.updated', 'photo.updated', 'photo.created']);
});

test('contact form: kept for the moderator, mailed to the turner, acknowledged to the sender', async () => {
  const message = { name: 'Claire Martin', email: 'Claire@Example.ch', phone: '079 123 45 67', subject: 'Un saladier', message: 'Bonjour,\nfaites-vous des saladiers sur commande ?' };
  assert.equal((await send('POST', '/messages', { ...message, name: '' })).response.status, 400);
  assert.equal((await send('POST', '/messages', { ...message, email: 'pas-une-adresse' })).response.status, 400);
  assert.equal((await send('POST', '/messages', { ...message, website: 'http://spam.example' })).response.status, 201, 'robots get an answer…');
  assert.equal((await send('POST', '/messages', message)).response.status, 201);
  const log = mailLog();
  assert.match(log, /to info@tourneur\.ch[\s\S]*Subject: Message de Claire Martin : Un saladier[\s\S]*Téléphone : 079 123 45 67[\s\S]*saladiers sur commande/);
  assert.match(log, /to claire@example\.ch[\s\S]*Subject: Votre message à tourneur\.ch[\s\S]*Bonjour Claire Martin/);

  assert.equal((await call('/messages')).response.status, 401);
  const inbox = (await call('/messages', {}, 'owner')).body.messages;
  assert.equal(inbox.length, 1, '…but nothing of theirs is kept');
  assert.deepEqual({ email: inbox[0].email, status: inbox[0].status }, { email: 'claire@example.ch', status: 'new' });
  assert.equal((await call('/bootstrap', {}, 'owner')).body.messageCount, 1);
  assert.equal((await call('/bootstrap')).body.messageCount, 0, 'visitors see no count');

  const done = await send('PATCH', `/messages/${inbox[0].id}`, { status: 'done' }, 'owner');
  assert.equal(done.body.message.status, 'done');
  assert.ok(done.body.message.handledAt);
  assert.equal((await call('/bootstrap', {}, 'owner')).body.messageCount, 0);
  assert.equal((await send('DELETE', `/messages/${inbox[0].id}`, null, 'owner')).response.status, 200);
  assert.equal((await send('DELETE', `/messages/${inbox[0].id}`, null, 'owner')).response.status, 404);
});

test('news: public reading, drafts for the moderator only', async () => {
  const draft = await send('POST', '/news', { title: 'Marché de Noël', body: 'Je serai au marché de Nyon.', published: false }, 'owner');
  assert.equal(draft.response.status, 201);
  assert.equal((await call(`/news/${draft.body.news.id}`)).response.status, 404, 'drafts are hidden');
  assert.equal((await send('POST', '/news', { title: 'x', body: 'y' })).response.status, 401);
  await send('PUT', `/news/${draft.body.news.id}`, { title: 'Marché de Noël', body: 'Je serai au marché de Nyon.', published: true }, 'owner');
  assert.equal((await call(`/news/${draft.body.news.id}`)).body.news.author, 'Lino Finini');
});

test('page texts: public reading, moderator editing in French', async () => {
  assert.equal((await send('PUT', '/content', { entries: [{ key: 'about.text', lang: 'fr', value: 'x' }] })).response.status, 401);
  assert.equal((await send('PUT', '/content', { entries: [{ key: 'about.text', lang: 'de', value: 'x' }] }, 'owner')).response.status, 400, 'French only');
  await send('PUT', '/content', { entries: [{ key: 'about.text', lang: 'fr', value: 'Tourneur depuis 2024.' }] }, 'owner');
  assert.equal((await call('/content')).body.content['about.text'].fr, 'Tourneur depuis 2024.');
});

test('PHP specifics: EXIF orientation, origin check, byte ranges, password, logout, rate limit', async () => {
  const uploaded = await call('/photos', await pieceForm({ title: 'Portrait', kind: 'vase' }, await jpeg(1200, 800, { orientation: 6 })), 'owner');
  assert.deepEqual([uploaded.body.photo.width, uploaded.body.photo.height], [800, 1200], 'phone photos are turned upright');
  const ranged = await fetch(server.base + uploaded.body.photo.imageUrl, { headers: { range: 'bytes=0-9' } });
  assert.equal(ranged.status, 206);
  assert.equal((await ranged.arrayBuffer()).byteLength, 10);
  const crossSite = await call('/news', { method: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ title: 'x', body: 'y' }) }, 'owner');
  assert.equal(crossSite.response.status, 403, 'cross-site requests are refused');
  assert.equal((await call('/nope')).response.status, 404);

  const change = (body) => send('POST', '/auth/password', body, 'owner');
  assert.equal((await change({ currentPassword: 'wrong', newPassword: 'un-nouveau-mot-de-passe' })).response.status, 400);
  assert.equal((await change({ currentPassword: 'Demo2026!', newPassword: 'court' })).response.status, 400);
  assert.equal((await change({ currentPassword: 'Demo2026!', newPassword: 'un-nouveau-mot-de-passe' })).response.status, 200);
  assert.equal((await login('again')).response.status, 401, 'the old password no longer works');
  assert.equal((await login('again', 'un-nouveau-mot-de-passe')).response.status, 200);

  await send('POST', '/auth/logout', null, 'owner');
  assert.equal((await call('/auth/me', {}, 'owner')).response.status, 401);
  let limited = false;
  for (let attempt = 0; attempt < 14 && !limited; attempt++) limited = (await send('POST', '/auth/login', { email: 'x@example.ch', password: 'wrong' }, 'attacker')).response.status === 429;
  assert.ok(limited, 'repeated sign-in attempts are limited');
});
