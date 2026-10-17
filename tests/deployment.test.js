'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { build } = require('../scripts/build.cjs');
const { CLIENT_FILES, onlineEndpoint, securityHeaders } = require('../config/deployment.cjs');
const { parseOrigins, originAllowed, createIpResolver, createRateLimiter, environmentOptions } = require('../server/policy.cjs');

// Dựng client riêng để kiểm build mà không sửa nguồn hoặc tiến trình người chơi.
function clientFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-deploy-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starfall-deploy-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const name of CLIENT_FILES) {
    const target = path.join(root, 'public', name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, name === 'index.html' ? fs.readFileSync(path.join(__dirname, '../public/index.html')) : `client ${name}`);
  }
  return root;
}

// Chạy cấu hình công khai đúng như trình duyệt, không phụ thuộc cách ghép chuỗi của build.
function clientConfig(out) {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(out, 'js/client-config.js'), 'utf8'), sandbox);
  return sandbox.STARDROP_CONFIG;
}

test('Client build version is deterministic and ignores output timestamps and unlisted files', t => {
  const root = clientFixture(t), options = { root, endpoint: 'wss://online.game.test/play' };
  const first = clientConfig(build(options));
  assert.match(first.buildId, /^[a-f0-9]{12}$/);
  assert.equal(first.onlineUrl, options.endpoint);
  fs.writeFileSync(path.join(root, 'public', 'unlisted.txt'), 'not shipped');
  const asset = path.join(root, 'public/js/game.js');
  fs.utimesSync(asset, new Date(1), new Date(1));
  assert.equal(clientConfig(build(options)).buildId, first.buildId);
  assert.equal(Object.isFrozen(first), true);
});

test('Client build version changes for each shipped source asset and the public endpoint', t => {
  const root = clientFixture(t), options = { root, endpoint: '' };
  const first = clientConfig(build(options)).buildId;
  assert.match(first, /^[a-f0-9]{12}$/);
  for (const name of CLIENT_FILES.filter(name => name !== 'js/client-config.js')) {
    const target = path.join(root, 'public', name), original = fs.readFileSync(target);
    fs.appendFileSync(target, '\nchanged');
    assert.notEqual(clientConfig(build(options)).buildId, first, name);
    fs.writeFileSync(target, original);
  }
  assert.notEqual(clientConfig(build({ ...options, endpoint: 'wss://online.game.test/play' })).buildId, first);
  assert.equal(clientConfig(build({ ...options, endpoint: 'wss://online.game.test' })).buildId,
    clientConfig(build({ ...options, endpoint: 'wss://online.game.test/' })).buildId, 'Canonical endpoint has one version');
});

test('Built HTML versions every local CSS and script URL with the published build version', t => {
  const root = clientFixture(t), source = path.join(root, 'public/index.html');
  fs.appendFileSync(source, '\n<script src="/js/game.js?mode=test#ready"></script><link href="./css/styles.css?v=old&amp;theme=night" rel="stylesheet"><a href="privacy.html">Privacy</a><script src="https://external.test/game.js"></script>');
  const original = fs.readFileSync(source, 'utf8'), out = build({ root, endpoint: '' });
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8'), { buildId } = clientConfig(out);
  const urls = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  const localAssets = urls.filter(url => /^(?:\.\/|\/)?(?:js|css)\//.test(url));
  assert.ok(localAssets.length > 10);
  for (const url of localAssets) {
    const parsed = new URL(url.replaceAll('&amp;', '&'), 'https://game.test/');
    assert.equal(parsed.searchParams.get('v'), buildId, url);
    assert.equal(parsed.searchParams.getAll('v').length, 1, url);
    assert.ok(CLIENT_FILES.includes(parsed.pathname.slice(1)), url);
  }
  assert.ok(html.includes(`/js/game.js?mode=test&v=${buildId}#ready`));
  assert.ok(html.includes('theme=night'));
  assert.ok(urls.includes('privacy.html'));
  assert.ok(urls.includes('https://external.test/game.js'));
  assert.equal(fs.readFileSync(source, 'utf8'), original, 'Versioning never rewrites public source');
});

test('Deployment output is an allowlist and never copies server, secrets, archives or tests', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-deploy-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starfall-deploy-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const name of CLIENT_FILES) {
    const target = path.join(root, 'public', name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `client ${name}`);
  }
  fs.writeFileSync(path.join(root, 'public', 'unlisted.js'), 'PRIVATE_SENTINEL');
  fs.writeFileSync(path.join(root, 'public', 'js', 'unlisted.js'), 'PRIVATE_SENTINEL');
  for (const name of ['server.js', '.env', 'README.md', 'test.js']) fs.writeFileSync(path.join(root, name), 'PRIVATE_SENTINEL');
  fs.mkdirSync(path.join(root, 'archive'));
  fs.writeFileSync(path.join(root, 'archive', 'old.html'), 'PRIVATE_SENTINEL');
  const out = build({ root, endpoint: 'wss://online.game.test/play', requireOnline: true });
  fs.writeFileSync(path.join(out, 'leftover-secret'), 'PRIVATE_SENTINEL');
  build({ root, endpoint: 'wss://online.game.test/play', requireOnline: true });
  assert.deepEqual(fs.readdirSync(out, { recursive: true }).filter(name => fs.statSync(path.join(out, name)).isFile()).map(name => name.split(path.sep).join('/')).sort(), [...CLIENT_FILES, 'vercel.json'].sort());
  for (const name of [...CLIENT_FILES, 'vercel.json']) assert.ok(!fs.readFileSync(path.join(out, name), 'utf8').includes('PRIVATE_SENTINEL'), name);
  assert.ok(fs.readFileSync(path.join(out, 'js/client-config.js'), 'utf8').includes('wss://online.game.test/play'));
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
