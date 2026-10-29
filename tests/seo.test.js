import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startPhpServer } from '../scripts/php.mjs';

// What search engines and link previews receive, before any JavaScript runs.
const dir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-seo-'));
const indexHtml = path.join(dir, 'index.html');
// The shape of the page Vite builds.
writeFileSync(indexHtml, '<!doctype html>\n<html lang="fr">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="description" content="Built-in description" />\n    <title>Built-in title</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n');
let server;
const page = async (pathName) => {
  const response = await fetch(server.base + pathName, { redirect: 'manual' });
  return { status: response.status, html: await response.text(), headers: response.headers };
};
const meta = (html, attribute, name) => html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`))?.[1];
const schema = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];

before(async () => {
  server = await startPhpServer({ port: 4292, env: { TURNERY_ENV: 'development', TURNERY_DATA_DIR: path.join(dir, 'data'), TURNERY_UPLOADS_DIR: path.join(dir, 'uploads'), TURNERY_INDEX_HTML: indexHtml } });
});
after(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
});

test('every page has its own title, description, canonical address and sharing preview', async () => {
  const home = await page('/');
  assert.equal(home.status, 200);
  assert.match(home.html, /<title>Pour donner vie au bois — tourneur\.ch<\/title>/);
  assert.doesNotMatch(home.html, /Built-in (title|description)/, 'the built page’s own title and description are replaced');
  assert.match(meta(home.html, 'name', 'description'), /^Passionné de tournage sur bois/);
  assert.match(home.html, new RegExp(`<link rel="canonical" href="${server.base}/" />`));
  assert.equal(meta(home.html, 'property', 'og:image'), `${server.base}/images/partage.jpg`);
  assert.equal(meta(home.html, 'name', 'twitter:card'), 'summary_large_image');
  assert.deepEqual(schema(home.html).map((item) => item['@type']), ['WebSite', 'Person']);
  assert.match(home.html, /<div id="root"><main class="prerender"><h1>Pour donner vie au bois<\/h1>/, 'the main text is in the page itself');
  assert.match(home.html, /<a href="\/portfolio\/grand-bol-en-noyer">Grand bol en noyer<\/a>/, 'links to the pieces');

  const about = await page('/a-propos');
  assert.match(about.html, /<title>À propos — Un type tourne du bois · tourneur\.ch<\/title>/);
  assert.match(about.html, /Le tournage sur bois est avant tout une passion/);
  const contact = await page('/contact');
  assert.equal(schema(contact.html)[0].mainEntity.email, 'info@tourneur.ch');
});

test('each piece has a page: VisualArtwork data, its photo as preview, a stable address', async () => {
  const piece = await page('/portfolio/grand-bol-en-noyer');
  assert.equal(piece.status, 200);
  assert.match(piece.html, /<title>Grand bol en noyer — tourneur\.ch<\/title>/);
  assert.match(meta(piece.html, 'property', 'og:image'), /\/uploads\/legacy-bol-noyer\.(webp|jpg)$/);
  const [artwork] = schema(piece.html);
  assert.deepEqual({ type: artwork['@type'], form: artwork.artform, medium: artwork.artMedium, date: artwork.dateCreated, creator: artwork.creator.name }, { type: 'VisualArtwork', form: 'Bol', medium: 'Noyer', date: '2026-02-10', creator: 'Lino Finini' });
  const list = await page('/portfolio');
  assert.equal(schema(list.html)[0].hasPart.length, 4);
  // The API gives the same address.
  const { photos } = await (await fetch(`${server.base}/api/photos`)).json();
  assert.equal(photos.find((photo) => photo.id === 'legacy-bol-noyer').slug, 'grand-bol-en-noyer');
  assert.equal((await (await fetch(`${server.base}/api/photos/grand-bol-en-noyer`)).json()).photo.title, 'Grand bol en noyer');
});

test('unknown addresses are real 404s; admin pages are never indexed', async () => {
  for (const pathName of ['/nimporte-quoi', '/portfolio/piece-inconnue', '/news/inconnue']) {
    const missing = await page(pathName);
    assert.equal(missing.status, 404, pathName);
    assert.match(missing.html, /<meta name="robots" content="noindex" \/>/);
  }
  const login = await page('/login');
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('x-robots-tag'), 'noindex');
  assert.doesNotMatch(login.html, /rel="canonical"/);
});

test('sitemap.xml lists the pages, pieces and published news; robots.txt protects test copies', async () => {
  const sitemap = await (await fetch(`${server.base}/sitemap.xml`)).text();
  for (const pathName of ['/', '/portfolio', '/news', '/documents', '/a-propos', '/contact', '/portfolio/grand-bol-en-noyer', '/news/news-demo']) {
    assert.ok(sitemap.includes(`<loc>${server.base}${pathName}</loc>`), pathName);
  }
  assert.match(sitemap, /<loc>[^<]*\/portfolio\/grand-bol-en-noyer<\/loc><lastmod>2026-02-10<\/lastmod>/);
  assert.equal(await (await fetch(`${server.base}/robots.txt`)).text(), 'User-agent: *\nDisallow: /\n', 'a development copy is not indexed');
});
