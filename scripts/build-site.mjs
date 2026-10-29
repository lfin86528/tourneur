// Assembles site/: the folder uploaded to the web hosting by FTP.
//   React build (dist/) + PHP API (php/). Run after `vite build`.
// data/ and uploads/ are not part of it: they are created on the server at the
// first visit, or uploaded separately (see DEPLOYMENT.md).
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const site = path.join(root, 'site');
if (!existsSync(path.join(root, 'dist', 'index.html'))) throw new Error('Run `vite build` first.');
// The built-in page texts, for the pages completed by PHP (app/seo.php).
const { contentFallbacks } = await import(pathToFileURL(path.join(root, 'src', 'contentBlocks.js')));
writeFileSync(path.join(root, 'php', 'app', 'content-fallbacks.json'), `${JSON.stringify(contentFallbacks, null, 1)}\n`);
rmSync(site, { recursive: true, force: true });
cpSync(path.join(root, 'dist'), site, { recursive: true });
cpSync(path.join(root, 'php'), site, { recursive: true, filter: (source) => !/[\\/]app[\\/]config\.php$/.test(source) });
console.log(`Site assembled in ${path.relative(root, site)}/ — upload its contents to the web root.`);
