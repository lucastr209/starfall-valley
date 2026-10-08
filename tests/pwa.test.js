'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const zlib = require('node:zlib');
const { CLIENT_FILES, securityHeaders } = require('../deployment-config.cjs');
const { build } = require('../scripts/build.cjs');
const { createGameServer } = require('../server.js');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
const publicAssets = new Map([
  ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['icon-192.png', 'image/png'],
  ['icon-512.png', 'image/png'],
  ['apple-touch-icon.png', 'image/png'],
  ['save-transfer.js', 'text/javascript; charset=utf-8']
]);

test('Home-screen game launch uses the same origin, root scope and landscape standalone display', () => {
  assert.equal(manifest.name, 'Thung Lũng Sao Rơi');
  assert.equal(manifest.lang, 'vi');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'landscape');
  assert.equal(manifest.theme_color, '#fff9e8');
  assert.equal(manifest.background_color, '#d7e5b4');
});

function checkPng(filename, size) {
  const data = fs.readFileSync(path.join(root, filename));
  assert.deepEqual(data.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(data.toString('ascii', 12, 16), 'IHDR');
  assert.equal(data.readUInt32BE(16), size, filename);
  assert.equal(data.readUInt32BE(20), size, filename);
  assert.equal(data[24], 8, '8-bit icon');
  assert.equal(data[25], 2, 'solid RGB icon prevents a transparent background on iOS');
  assert.equal(data[28], 0, 'non-interlaced icon');
  const chunks = [];
  let offset = 8;
  let ended = false;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const kind = data.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + length + 12 <= data.length, 'complete PNG chunk');
    if (kind === 'IDAT') chunks.push(data.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (kind === 'IEND') { ended = true; break; }
  }
  assert.ok(ended, 'complete PNG image');
  const pixels = zlib.inflateSync(Buffer.concat(chunks));
  assert.equal(pixels.length, size * (size * 3 + 1), 'all image rows decode');
  for (let y = 0; y < size; y++) assert.ok(pixels[y * (size * 3 + 1)] <= 4, 'valid PNG filter');
}

test('Manifest icons and iPhone home-screen icon are real opaque PNGs at the declared sizes', () => {
  assert.equal(manifest.icons.length, 2);
  for (const [index, size] of [192, 512].entries()) {
    const icon = manifest.icons[index];
    assert.equal(icon.src, `/icon-${size}.png`);
    assert.equal(icon.sizes, `${size}x${size}`);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.purpose, 'any');
    checkPng(icon.src.slice(1), size);
  }
  checkPng('apple-touch-icon.png', 180);
});

test('Deployment publishes every home-screen asset through its public allowlist', () => {
  for (const filename of publicAssets.keys()) {
    assert.ok(CLIENT_FILES.includes(filename), filename);
  }
  assert.match(securityHeaders()['Content-Security-Policy'], /(?:^|;)\s*manifest-src 'self'(?:;|$)/);
});

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];
}

test('Entry page supplies iPhone standalone metadata and loads save transfer after the core', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
  assert.equal(attr(links.find(tag => attr(tag, 'rel') === 'manifest'), 'href'), '/manifest.webmanifest');
  const appleIcon = links.find(tag => attr(tag, 'rel') === 'apple-touch-icon');
  assert.equal(attr(appleIcon, 'href'), '/apple-touch-icon.png');
  assert.equal(attr(appleIcon, 'sizes'), '180x180');
  assert.equal(attr(metas.find(tag => attr(tag, 'name') === 'apple-mobile-web-app-capable'), 'content'), 'yes');
  assert.match(attr(metas.find(tag => attr(tag, 'name') === 'viewport'), 'content'), /viewport-fit=cover/);
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(match => attr(match[0], 'src'));
  assert.ok(scripts.indexOf('game-core.js') >= 0);
  assert.ok(scripts.indexOf('save-transfer.js') > scripts.indexOf('game-core.js'));
  assert.ok(scripts.indexOf('game.js') > scripts.indexOf('save-transfer.js'));
});

test('Actual client build preserves new binary/text assets and both Vercel configs permit the manifest', t => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-pwa-build-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(outputRoot)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(outputRoot).startsWith('starfall-pwa-build-'));
    fs.rmSync(outputRoot, { recursive: true, force: true });
  });
  const out = build({ root, outputRoot, endpoint: 'wss://online.game.test/play' });
  for (const filename of publicAssets.keys()) {
    assert.deepEqual(fs.readFileSync(path.join(out, filename)), fs.readFileSync(path.join(root, filename)), filename);
  }
  for (const configPath of [path.join(root, 'vercel.json'), path.join(out, 'vercel.json')]) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const headers = config.headers.find(entry => entry.source === '/(.*)').headers;
    const csp = headers.find(header => header.key.toLowerCase() === 'content-security-policy').value;
    assert.match(csp, /(?:^|;)\s*manifest-src 'self'(?:;|$)/, configPath);
    assert.equal(headers.find(header => header.key.toLowerCase() === 'cache-control').value, 'no-cache');
  }
});

function request(server, filename, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/' + filename, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(2500, () => req.destroy(new Error('Static asset request timed out')));
    req.on('error', reject);
    req.end();
  });
}

test('HTTP serves manifest, PNGs and save transfer unchanged with correct MIME, CSP and HEAD responses', async t => {
  const server = createGameServer();
  t.after(() => server.shutdown());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  for (const [filename, mime] of publicAssets) {
    const source = fs.readFileSync(path.join(root, filename));
    const get = await request(server, filename);
    assert.equal(get.status, 200, filename);
    assert.equal(get.headers['content-type'], mime, filename);
    assert.equal(Number(get.headers['content-length']), source.length, filename);
    assert.equal(get.headers['x-content-type-options'], 'nosniff');
    assert.equal(get.headers['cache-control'], 'no-cache');
    assert.match(get.headers['content-security-policy'], /(?:^|;)\s*manifest-src 'self'(?:;|$)/);
    assert.deepEqual(get.body, source, filename);
    const head = await request(server, filename, 'HEAD');
    assert.equal(head.status, 200, filename);
    assert.equal(head.body.length, 0, filename);
    assert.equal(head.headers['content-type'], mime, filename);
    assert.equal(Number(head.headers['content-length']), source.length, filename);
  }
});
