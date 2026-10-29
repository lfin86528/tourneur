// Finds a PHP binary and runs PHP's built-in server for local development and tests.
// Set PHP_BINARY to choose a specific PHP; otherwise `php` on the PATH, then WampServer.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');

export function phpBinary() {
  if (process.env.PHP_BINARY) return process.env.PHP_BINARY;
  if (spawnSync('php', ['-v'], { stdio: 'ignore' }).status === 0) return 'php';
  const wamp = 'C:/wamp64/bin/php';
  if (existsSync(wamp)) {
    const versions = readdirSync(wamp).filter((name) => /^php8\.\d+/.test(name)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const binary = path.join(wamp, version, 'php.exe');
      if (existsSync(binary)) return binary;
    }
  }
  throw new Error('PHP 8.1+ is required. Install it or set PHP_BINARY to its path.');
}

// Same limits as .user.ini on the hosting.
export const phpSettings = ['-d', 'xdebug.mode=off', '-d', 'upload_max_filesize=21M', '-d', 'post_max_size=330M', '-d', 'max_file_uploads=25', '-d', 'memory_limit=512M', '-d', 'display_errors=stderr'];

export function runPhp(args, env = {}) {
  return spawnSync(phpBinary(), [...phpSettings, ...args], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
}

// Starts `php -S` on docroot (a folder with router.php) and waits until it answers.
export async function startPhpServer({ docroot = path.join(root, 'php'), port, env = {}, quiet = true } = {}) {
  const server = spawn(phpBinary(), [...phpSettings, '-S', `127.0.0.1:${port}`, '-t', docroot, path.join(docroot, 'router.php')], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = [];
  server.stdout.on('data', (chunk) => output.push(String(chunk)));
  server.stderr.on('data', (chunk) => { output.push(String(chunk)); if (!quiet) process.stderr.write(chunk); });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`PHP server exited:\n${output.join('')}`);
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (attempt === 59) throw new Error(`PHP server did not start:\n${output.join('')}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const stop = () => new Promise((resolve) => { if (server.exitCode !== null) return resolve(); server.once('exit', resolve); server.kill(); });
  return { base, stop, output, process: server };
}
