// Copies the built site (site/) into the local WAMP copy and lists what changed,
// so exactly those files can be uploaded to the hosting.
//   npm run build && node scripts/sync-wamp.mjs [target]   (default C:/wamp64/www/tourneur.ch)
// Never touches data/, uploads/, app/config.php, or keys left in the target.
// Removes only built files that the new build no longer uses (old assets/*).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const site = path.join(root, 'site');
const target = path.resolve(process.argv[2] || 'C:/wamp64/www/tourneur.ch');
if (!existsSync(path.join(site, 'index.html'))) throw new Error('Run `npm run build` first.');
if (!existsSync(target)) throw new Error(`Target folder not found: ${target}`);

const kept = /^(data|uploads)(\/|$)|^app\/config\.php$|(^|\/)(setup-key\.txt|secret\.key)$/;
const files = (dir, base = dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? files(full, base) : [path.relative(base, full).split(path.sep).join('/')];
});
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

const changed = [], added = [], removed = [];
for (const name of files(site)) {
  if (kept.test(name)) continue;
  const from = path.join(site, name);
  const to = path.join(target, name);
  if (existsSync(to) && statSync(to).isFile() && hash(from) === hash(to)) continue;
  (existsSync(to) ? changed : added).push(name);
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
}
// Old hashed bundles (assets/index-XXXX.js|css) not produced by this build.
const current = new Set(files(site).filter((name) => name.startsWith('assets/')));
if (existsSync(path.join(target, 'assets'))) {
  for (const name of files(path.join(target, 'assets')).map((file) => `assets/${file}`)) {
    if (!current.has(name)) { rmSync(path.join(target, name)); removed.push(name); }
  }
}

const list = (title, names) => names.length && console.log(`${title} (${names.length}):\n${names.sort().map((name) => `  ${name}`).join('\n')}`);
console.log(`WAMP copy: ${target}`);
if (!changed.length && !added.length && !removed.length) console.log('Nothing changed.');
list('Changed — upload', changed);
list('New — upload', added);
list('Removed locally — delete on the hosting too', removed);
