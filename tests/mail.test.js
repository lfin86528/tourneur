import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startPhpServer } from '../scripts/php.mjs';

// A tiny SMTP server standing in for the real mail server (no TLS in tests).
const received = [];
let rejectAuth = false;
const smtp = net.createServer((socket) => {
  const session = { auth: [], from: '', to: '', data: '' };
  let mode = 'command';
  let buffer = '';
  socket.write('220 test-smtp ready\r\n');
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (mode === 'data') {
        if (line === '.') { mode = 'command'; received.push(session); socket.write('250 queued\r\n'); }
        else session.data += line + '\n';
        continue;
      }
      if (mode === 'auth-user') { session.auth.push(Buffer.from(line, 'base64').toString()); mode = 'auth-pass'; socket.write('334 UGFzc3dvcmQ6\r\n'); continue; }
      if (mode === 'auth-pass') { session.auth.push(Buffer.from(line, 'base64').toString()); mode = 'command'; socket.write(rejectAuth ? '535 5.7.8 Authentication failed\r\n' : '235 ok\r\n'); continue; }
      if (/^EHLO /.test(line)) socket.write('250-test-smtp\r\n250 AUTH LOGIN\r\n');
      else if (line === 'AUTH LOGIN') { mode = 'auth-user'; socket.write('334 VXNlcm5hbWU6\r\n'); }
      else if (line.startsWith('MAIL FROM:')) { session.from = line; socket.write('250 ok\r\n'); }
      else if (line.startsWith('RCPT TO:')) { session.to = line; socket.write('250 ok\r\n'); }
      else if (line === 'DATA') { mode = 'data'; socket.write('354 go\r\n'); }
      else if (line === 'QUIT') { socket.end('221 bye\r\n'); }
      else socket.write('500 unknown\r\n');
    }
  });
});

const dir = mkdtempSync(path.join(os.tmpdir(), 'tourneur-mail-'));
let server;
const jars = {};
const call = async (pathName, options = {}, jar = 'moderator') => {
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (jars[jar]) headers.cookie = jars[jar];
  const response = await fetch(`${server.base}/api${pathName}`, { ...options, headers });
  const cookie = response.headers.get('set-cookie');
  if (cookie) jars[jar] = cookie.split(';')[0];
  return { response, body: await response.json() };
};

before(async () => {
  await new Promise((resolve) => smtp.listen(4183, '127.0.0.1', resolve));
  server = await startPhpServer({ port: 4184, env: {
    TURNERY_ENV: 'development', TURNERY_DATA_DIR: path.join(dir, 'data'), TURNERY_UPLOADS_DIR: path.join(dir, 'uploads'), TURNERY_LEGACY_IMPORT: '0',
    TURNERY_SMTP_HOST: '127.0.0.1', TURNERY_SMTP_PORT: '4183', TURNERY_SMTP_ENCRYPTION: 'none',
    TURNERY_SMTP_USERNAME: 'noreply@tourneur.ch', TURNERY_SMTP_PASSWORD: 'secret-de-test',
  } });
});
after(async () => {
  await server.stop();
  await new Promise((resolve) => smtp.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

const decodeSubject = (headers) => headers.match(/^Subject: (.+(?:\n[ \t].+)*)/m)[1]
  .replace(/\?=\s+=\?/g, '?==?')
  .replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (match, data) => Buffer.from(data, 'base64').toString());
const contact = { name: 'Marc Keller', email: 'marc@example.ch', message: 'Faites-vous des stylos ?' };

test('contact messages go out through authenticated SMTP, with the sender as Reply-To', async () => {
  const before = received.length;
  assert.equal((await call('/messages', { method: 'POST', body: JSON.stringify(contact) })).response.status, 201);
  const [notice, receipt] = received.slice(before);
  assert.deepEqual(notice.auth, ['noreply@tourneur.ch', 'secret-de-test']);
  assert.equal(notice.from, 'MAIL FROM:<noreply@tourneur.ch>', 'The sender is the authenticated mailbox');
  assert.equal(notice.to, 'RCPT TO:<info@tourneur.ch>');
  const [headers, body] = notice.data.split('\n\n');
  assert.match(headers, /^Reply-To: <marc@example\.ch>$/m, 'Answering the e-mail writes to the sender');
  assert.equal(decodeSubject(headers), 'Message de Marc Keller');
  assert.match(Buffer.from(body.replace(/\s+/g, ''), 'base64').toString(), /Faites-vous des stylos/);
  assert.equal(receipt.to, 'RCPT TO:<marc@example.ch>');
  assert.equal(decodeSubject(receipt.data.split('\n\n')[0]), 'Votre message à tourneur.ch');
});

test('a refused SMTP login keeps the message and never logs the password', async () => {
  rejectAuth = true;
  const sent = await call('/messages', { method: 'POST', body: JSON.stringify({ ...contact, name: 'Anne' }) });
  rejectAuth = false;
  assert.equal(sent.response.status, 201, 'The visitor is not blamed for the mail server');
  const log = readFileSync(path.join(dir, 'data', 'mail.log'), 'utf8');
  assert.match(log, /NOT SENT via SMTP 127\.0\.0\.1 to info@tourneur\.ch — SMTP AUTH: 535 5\.7\.8 Authentication failed/);
  assert.doesNotMatch(log, /secret-de-test/);
  await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@tourneur.test', password: 'Demo2026!' }) });
  assert.ok((await call('/messages')).body.messages.some((message) => message.name === 'Anne'), 'The message waits in the inbox');
});
