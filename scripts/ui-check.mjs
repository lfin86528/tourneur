// Browser check of the built site (site/) on a throwaway demo database:
// visitor pages on desktop and phone (no horizontal scrolling), the contact form,
// then the turner's session (add a piece, read the message). Screenshots in artifacts/.
//   npm run build && npm run test:ui
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { startPhpServer } from './php.mjs';

const root = path.resolve(import.meta.dirname, '..');
const shots = path.join(root, 'artifacts');
mkdirSync(shots, { recursive: true });
const tmp = mkdtempSync(path.join(os.tmpdir(), 'tourneur-ui-'));
const server = await startPhpServer({ docroot: path.join(root, 'site'), port: 4290, env: { TURNERY_ENV: 'development', TURNERY_DATA_DIR: path.join(tmp, 'data'), TURNERY_UPLOADS_DIR: path.join(tmp, 'uploads') } });
const browser = await chromium.launch();
const errors = [];
const watch = (page) => { page.on('pageerror', (error) => errors.push(error.message)); return page; };
const noOverflow = async (page, label) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `${label}: no horizontal scrolling`);
const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(shots, name), fullPage });

try {
  const desktop = watch(await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'fr-CH' }));
  const phone = watch(await browser.newPage({ viewport: { width: 375, height: 812 }, locale: 'fr-CH', isMobile: true, hasTouch: true }));
  for (const [route, ready, name] of [['/', '.dashboard-heading', 'home'], ['/portfolio', '.gallery-card', 'portfolio'], ['/portfolio?by=wood', '.gallery-section', 'portfolio-wood'], ['/news', '.news-page, .empty-state, .news-card-lead', 'news'], ['/documents', '.resources-page', 'documents'], ['/a-propos', '.about-signature', 'about'], ['/contact', '.join-form', 'contact'], ['/login', '.login-form', 'login']]) {
    for (const [page, device] of [[desktop, 'desktop'], [phone, 'phone']]) {
      await page.goto(server.base + route, { waitUntil: 'networkidle' });
      await page.locator(ready).first().waitFor();
      await noOverflow(page, `${route} (${device})`);
      await shot(page, `${name}-${device}.png`, device === 'desktop');
    }
  }
  await desktop.goto(server.base + '/', { waitUntil: 'networkidle' });
  assert.equal(await desktop.locator('.public-nav a').count(), 5);
  await phone.goto(server.base + '/', { waitUntil: 'networkidle' });
  assert.equal(await phone.locator('.public-bottom-nav a').count(), 5);
  const text = await desktop.evaluate(() => document.body.innerText);
  assert.doesNotMatch(text, /amicale|ART sur bois|membres?\b/i, 'Nothing left of the club site');

  // A visitor writes; the full-screen viewer opens on a piece.
  await desktop.goto(server.base + '/contact', { waitUntil: 'networkidle' });
  await desktop.locator('input[autocomplete=name]').fill('Claire Martin');
  await desktop.locator('input[type=email]').fill('claire@example.ch');
  await desktop.locator('textarea').fill('Faites-vous des saladiers sur commande ?');
  await desktop.getByRole('button', { name: 'Envoyer le message' }).click();
  await desktop.locator('.join-thanks').waitFor();
  await desktop.goto(server.base + '/portfolio', { waitUntil: 'networkidle' });
  await desktop.locator('.gallery-image').first().click();
  await desktop.locator('.viewer img').waitFor();
  await desktop.keyboard.press('Escape');

  // The turner signs in from the footer, adds a piece from the phone, reads the message.
  await phone.goto(server.base + '/', { waitUntil: 'networkidle' });
  await phone.goto(server.base + '/login', { waitUntil: 'networkidle' });
  await phone.getByRole('button', { name: 'Se connecter' }).click();
  await phone.locator('.bottom-upload').waitFor();
  assert.equal(await phone.locator('.bottom-nav a', { hasText: 'Messages' }).locator('i').count(), 1, 'A new message is signalled');
  await shot(phone, 'admin-home-phone.png', false);
  await phone.locator('.bottom-upload').click();
  const photo = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#8a5a33' } }).jpeg().toBuffer();
  await phone.locator('.upload-modal input[type=file]').first().setInputFiles({ name: 'bol.jpg', mimeType: 'image/jpeg', buffer: photo });
  await phone.locator('.upload-modal input[required]').first().fill('Bol en frêne');
  await phone.locator('.upload-modal select').selectOption('bowl');
  await phone.locator('.upload-modal input[maxlength="100"]').fill('Frêne');
  await shot(phone, 'admin-add-piece-phone.png', false);
  await phone.getByRole('button', { name: 'Mettre en ligne' }).click();
  await phone.locator('.gallery-card', { hasText: 'Bol en frêne' }).waitFor();
  await phone.goto(server.base + '/admin/messages', { waitUntil: 'networkidle' });
  await phone.locator('.membership-request', { hasText: 'Claire Martin' }).waitFor();
  await noOverflow(phone, 'Messages (phone)');
  await shot(phone, 'admin-messages-phone.png');
  const admin = watch(await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'fr-CH' }));
  await admin.goto(server.base + '/login', { waitUntil: 'networkidle' });
  await admin.getByRole('button', { name: 'Se connecter' }).click();
  await admin.locator('.sidebar').waitFor();
  await admin.goto(server.base + '/admin/stats', { waitUntil: 'networkidle' });
  await admin.locator('.stats-tiles').waitFor();
  await shot(admin, 'admin-stats-desktop.png', false);
  await admin.goto(server.base + '/', { waitUntil: 'networkidle' });
  await shot(admin, 'admin-home-desktop.png', false);
  assert.deepEqual(errors, [], 'No script errors');
  console.log(`UI checks passed: visitor pages (desktop and phone), contact form, viewer, admin on phone (add a piece, messages), statistics. Screenshots in ${path.relative(root, shots)}/`);
} finally {
  await browser.close();
  await server.stop();
  rmSync(tmp, { recursive: true, force: true });
}
