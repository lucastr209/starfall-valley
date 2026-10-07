'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { build } = require('../scripts/build.cjs');
const { CLIENT_FILES, onlineEndpoint, securityHeaders } = require('../deployment-config.cjs');
const { parseOrigins, originAllowed, createIpResolver, createRateLimiter, environmentOptions } = require('../server-policy.cjs');

test('Deployment output is an allowlist and never copies server, secrets, archives or tests', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-deploy-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starfall-deploy-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const name of CLIENT_FILES) fs.writeFileSync(path.join(root, name), `client ${name}`);
  for (const name of ['server.js', '.env', 'README.md', 'test.js']) fs.writeFileSync(path.join(root, name), 'PRIVATE_SENTINEL');
  fs.mkdirSync(path.join(root, 'archive'));
  fs.writeFileSync(path.join(root, 'archive', 'old.html'), 'PRIVATE_SENTINEL');
  const out = build({ root, endpoint: 'wss://online.game.test/play', requireOnline: true });
  fs.writeFileSync(path.join(out, 'leftover-secret'), 'PRIVATE_SENTINEL');
  build({ root, endpoint: 'wss://online.game.test/play', requireOnline: true });
  assert.deepEqual(fs.readdirSync(out).sort(), [...CLIENT_FILES, 'vercel.json'].sort());
  for (const name of fs.readdirSync(out)) assert.ok(!fs.readFileSync(path.join(out, name), 'utf8').includes('PRIVATE_SENTINEL'), name);
  assert.ok(fs.readFileSync(path.join(out, 'client-config.js'), 'utf8').includes('wss://online.game.test/play'));
  const headers = JSON.parse(fs.readFileSync(path.join(out, 'vercel.json'), 'utf8')).headers[0].headers;
  assert.ok(headers.some(h => h.key === 'Content-Security-Policy' && h.value.includes('wss://online.game.test')));
});

test('Public endpoint validation rejects plaintext, embedded secrets and missing online configuration', () => {
  assert.equal(onlineEndpoint('ws://localhost:4173/play'), 'ws://localhost:4173/play');
  for (const url of ['http://game.test/play', 'ws://game.test/play', 'wss://user:secret@game.test/play', 'wss://game.test/play?token=secret', 'wss://game.test/play#secret']) assert.throws(() => onlineEndpoint(url));
  assert.throws(() => build({ requireOnline: true, endpoint: '' }), /ONLINE_WS_URL/);
  const headers = securityHeaders();
  assert.ok(headers['Content-Security-Policy'].includes("script-src 'self'"));
  assert.ok(!headers['Content-Security-Policy'].includes('unsafe-inline'));
  assert.equal(headers['X-Frame-Options'], 'DENY');
});

test('Origin policy is explicit in production and resists host and wildcard bypasses', () => {
  const origins = parseOrigins('https://starfall.game.test,https://preview.game.test');
  const request = { headers: { origin: 'https://starfall.game.test', host: 'backend.game.test' }, socket: { remoteAddress: '203.0.113.10' } };
  assert.equal(originAllowed(request, origins), true);
  for (const origin of ['https://starfall.game.test.evil.test', 'null', 'https://starfall.game.test/', undefined]) {
    request.headers.origin = origin;
    assert.equal(originAllowed(request, origins), false, String(origin));
  }
  assert.throws(() => parseOrigins('https://*.game.test'));
  assert.throws(() => parseOrigins('http://game.test'));
  assert.throws(() => environmentOptions({ NODE_ENV: 'production' }), /ALLOWED_ORIGINS/);
  assert.throws(() => environmentOptions({ MAX_CLIENTS: '-1' }));
});

test('Untrusted forwarding headers cannot evade IP limits', () => {
  const req = { socket: { remoteAddress: '::ffff:203.0.113.10' }, headers: { 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '198.51.100.3' } };
  assert.equal(createIpResolver()(req), '203.0.113.10');
  assert.equal(createIpResolver('203.0.113.10')(req), '198.51.100.2');
  req.headers['x-real-ip'] = 'bad,header';
  assert.equal(createIpResolver('203.0.113.0/24')(req), '203.0.113.10');
  assert.throws(() => createIpResolver('203.0.113.0/99'));
});

test('Rate limiter blocks floods, has bounded memory and expires old addresses', () => {
  const rate = createRateLimiter({ limit: 2, windowMs: 1000, maxKeys: 2 });
  assert.equal(rate.allow('one', 0), true);
  assert.equal(rate.allow('one', 1), true);
  assert.equal(rate.allow('one', 2), false);
  assert.equal(rate.allow('two', 2), true);
  assert.equal(rate.allow('three', 3), false);
  assert.equal(rate.size, 2);
  assert.equal(rate.allow('three', 1002), true);
  rate.prune(2002);
  assert.equal(rate.size, 0);
});
