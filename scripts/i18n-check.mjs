// Checks that every interface string passed to t('…') and every API error message
// has a French text in src/locales/fr.js. (tourneur.ch is in French only; texts
// written directly in French in the components are not checked.)
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PIECE_KINDS } from '../src/gallery.js';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, 'src');
const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'locales') walk(full); }
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
  }
};
walk(sourceRoot);
// Strings chosen at run time: t(variable).
const keys = new Set([...PIECE_KINDS.map(([, label]) => label), 'Everything', 'Wood', 'Type of piece', '1 piece', '{{count}} pieces']);
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*'((?:\\.|[^'\\])*)'/g)) keys.add(match[1].replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\'));
}
for (const file of readdirSync(path.join(root, 'php', 'app')).filter((name) => name.endsWith('.php'))) {
  const source = readFileSync(path.join(root, 'php', 'app', file), 'utf8');
  for (const match of source.matchAll(/\b(?:fail|HttpError)\(\s*\d+,\s*'((?:\\.|[^'\\])*)'/g)) keys.add(match[1].replace(/\\'/g, "'"));
}
keys.delete('\n');
const { default: fr } = await import(pathToFileURL(path.join(sourceRoot, 'locales', 'fr.js')));
const missing = [...keys].filter((key) => !fr[key]).sort();
console.log(`FR: ${keys.size - missing.length}/${keys.size} strings covered`);
if (missing.length) { console.log(missing.map((key) => `  ${key}`).join('\n')); process.exitCode = 1; }
else console.log('All interface and server-error strings have a French text.');
