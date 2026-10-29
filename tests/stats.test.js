import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startPhpServer } from '../scripts/php.mjs';

const dir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-stats-'));
let server;
const jars = {};
const call = async (pathName, options = {}, jar) => {
  const headers = { 'content-type': 'application/json' };
  if (jars[jar]) headers.cookie = jars[jar];
  const response = await fetch(`${server.base}/api${pathName}`, { ...options, headers });
  const cookie = response.headers.get('set-cookie');
  if (cookie) jars[jar] = cookie.split(';')[0];
  return { response, body: await response.json() };
};
const post = (body) => ({ method: 'POST', body: JSON.stringify(body) });

before(async () => {
  server = await startPhpServer({ port: 4286, env: { TURNERY_ENV: 'development', TURNERY_DATA_DIR: path.join(dir, 'data'), TURNERY_UPLOADS_DIR: path.join(dir, 'uploads'), TURNERY_LEGACY_IMPORT: '0' } });
});
after(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
});

test('statistics: anonymous page views, messages per day, journal for the moderator only', async () => {
  for (const pathName of ['/', '/', '/news', '/news/news-demo', '/admin/stats', '/login', '/../etc', '/x?y=1']) await call('/stats/view', post({ path: pathName }));
  assert.equal((await call('/admin/stats')).response.status, 401);

  await call('/auth/login', post({ email: 'admin@tourneur.test', password: 'wrong' }));
  await call('/auth/login', post({ email: 'admin@tourneur.test', password: 'Demo2026!' }), 'owner');
  await call('/messages', post({ name: 'Anne', email: 'anne@example.ch', message: 'Bonjour' }));
  await call('/news', post({ title: 'Marché', body: 'Samedi à Nyon.' }), 'owner');

  const stats = (await call('/admin/stats?days=30', {}, 'owner')).body;
  assert.equal(stats.series.length, 30);
  assert.equal(stats.period.views, 4, 'Admin, login and invalid paths are not counted');
  assert.deepEqual(stats.topPages.map((page) => [page.path, page.views]), [['/', 2], ['/news', 1], ['/news/news-demo', 1]]);
  assert.equal(stats.topPages.find((page) => page.path === '/news/news-demo').label, 'Nouveau site');
  assert.equal(stats.period.messages, 1);
  assert.equal(stats.series.at(-1).messages, 1);
  assert.equal(stats.period.failedLogins, 1);
  assert.deepEqual(stats.totals, { pieces: 0, publishedNews: 2, draftNews: 0, documents: 0, newMessages: 1, messages: 1 });

  const actions = stats.audit.map((entry) => entry.action);
  for (const action of ['auth.login', 'auth.login_failed', 'message.received', 'news.created']) assert.ok(actions.includes(action), action);
  const received = stats.audit.find((entry) => entry.action === 'message.received');
  assert.deepEqual([received.actor, received.details.name], ['', 'Anne'], 'Visitors are not shown as the actor');
  assert.ok(!JSON.stringify(stats.audit).includes('Demo2026'), 'No password in the journal');
  const filtered = (await call('/admin/stats?action=auth', {}, 'owner')).body.audit;
  assert.ok(filtered.length > 0 && filtered.every((entry) => entry.action.startsWith('auth.')));
});
