'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const zlib = require('node:zlib');
const { CLIENT_FILES, securityHeaders } = require('../config/deployment.cjs');
const { build } = require('../scripts/build.cjs');
const { createGameServer } = require('../server/index.js');
const root = path.join(__dirname, '..');
const publicRoot = path.join(root, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, 'manifest.webmanifest'), 'utf8'));
const publicAssets = new Map([
  ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['assets/icons/icon-192.png', 'image/png'],
  ['assets/icons/icon-512.png', 'image/png'],
  ['assets/icons/apple-touch-icon.png', 'image/png'],
  ['js/save-transfer.js', 'text/javascript; charset=utf-8']
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
  const data = fs.readFileSync(path.join(publicRoot, filename));
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
    assert.equal(icon.src, `/assets/icons/icon-${size}.png`);
    assert.equal(icon.sizes, `${size}x${size}`);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.purpose, 'any');
    checkPng(icon.src.slice(1), size);
  }
  checkPng('assets/icons/apple-touch-icon.png', 180);
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
  const html = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
  assert.equal(attr(links.find(tag => attr(tag, 'rel') === 'manifest'), 'href'), '/manifest.webmanifest');
  const appleIcon = links.find(tag => attr(tag, 'rel') === 'apple-touch-icon');
  assert.equal(attr(appleIcon, 'href'), '/assets/icons/apple-touch-icon.png');
  assert.equal(attr(appleIcon, 'sizes'), '180x180');
  assert.equal(attr(metas.find(tag => attr(tag, 'name') === 'apple-mobile-web-app-capable'), 'content'), 'yes');
  assert.match(attr(metas.find(tag => attr(tag, 'name') === 'viewport'), 'content'), /viewport-fit=cover/);
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(match => attr(match[0], 'src'));
  assert.ok(scripts.indexOf('js/game-core.js') >= 0);
  assert.ok(scripts.indexOf('js/save-transfer.js') > scripts.indexOf('js/game-core.js'));
  assert.ok(scripts.indexOf('js/game.js') > scripts.indexOf('js/save-transfer.js'));
});

test('Actual client build preserves nested assets, HTML references and manifest security policy', t => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-pwa-build-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(outputRoot)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(outputRoot).startsWith('starfall-pwa-build-'));
    fs.rmSync(outputRoot, { recursive: true, force: true });
  });
  const out = build({ root, outputRoot, endpoint: 'wss://online.game.test/play' });
  for (const filename of CLIENT_FILES.filter(file => !['js/client-config.js','index.html'].includes(file))) {
    assert.deepEqual(fs.readFileSync(path.join(out, filename)), fs.readFileSync(path.join(publicRoot, filename)), filename);
  }
  assert.equal(fs.readFileSync(path.join(out,'index.html'),'utf8').replace(/\?v=[a-f0-9]{12}(?=["'])/g,''),fs.readFileSync(path.join(publicRoot,'index.html'),'utf8'),'Only public asset versions change the built HTML');
  for (const page of ['index.html', 'privacy.html']) {
    const html = fs.readFileSync(path.join(out, page), 'utf8');
    for (const [, reference] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (reference.startsWith('#') || /^(?:data:|https?:)/.test(reference)) continue;
      const filename = new URL(reference, `https://game.test/${page}`).pathname.slice(1) || 'index.html';
      assert.ok(CLIENT_FILES.includes(filename), `${page} references a published asset: ${reference}`);
      assert.ok(fs.statSync(path.join(out, filename)).isFile(), reference);
    }
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
    const source = fs.readFileSync(path.join(publicRoot, filename));
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

test('Forest recovery is an intentional public download with a valid limited checkpoint and matching build headers', async t => {
  const filename='recovery/forest-checkpoint.json',server=createGameServer();t.after(()=>server.shutdown());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const r=await request(server,filename);assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/json; charset=utf-8');assert.equal(r.headers['content-disposition'],'attachment; filename="starfall-valley-forest-recovery.json"');
  const D=require('../public/js/game-data'),T=require('../public/js/save-transfer'),s=T.decode(r.body.toString(),D);assert.equal(s.quests.adv04.status,'active');assert.equal(s.quests.advside03.status,'active');assert.equal(s.quests.adv06,undefined);assert.equal(s.inventory.rootblade,0);assert.equal(s.coins,180);
  assert.ok(CLIENT_FILES.includes(filename));const configuration=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));assert.equal(configuration.headers.find(e=>e.source==='/'+filename).headers.find(h=>h.key==='Content-Disposition').value,r.headers['content-disposition']);
  const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starfall-recovery-'));t.after(()=>fs.rmSync(outputRoot,{recursive:true,force:true}));const out=build({root,outputRoot});assert.deepEqual(fs.readFileSync(path.join(out,filename)),r.body);const built=JSON.parse(fs.readFileSync(path.join(out,'vercel.json'),'utf8'));assert.equal(built.headers.find(e=>e.source==='/'+filename).headers.find(h=>h.key==='Content-Disposition').value,r.headers['content-disposition']);
});

test('Cave checkpoint downloads an importable prepared save with all caves and their quests still uncompleted',async t=>{
  const filename='recovery/cave-checkpoint.json',server=createGameServer();t.after(()=>server.shutdown());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const r=await request(server,filename);assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/json; charset=utf-8');assert.equal(r.headers['content-disposition'],'attachment; filename="starfall-valley-cave-checkpoint.json"');
  const D=require('../public/js/game-data'),T=require('../public/js/save-transfer'),X=require('../public/js/exploration-core'),s=T.decode(r.body.toString(),D);
  assert.equal(s.map,'forest');assert.equal(s.x,1280);assert.equal(s.y,315);assert.equal(s.quests.story20.status,'claimed');assert.equal(s.quests.story24,undefined);assert.equal(s.adventure.weapon,'copperblade');assert.equal(s.exploration.outfit,'sailorcoat');assert.ok(s.inventory.meal>=5);assert.ok(s.inventory.tea>=5);
  for(const room of D.exploration.rooms.filter(r=>r.kind==='cave')){assert.ok(X.unlocked(s,room.id,D));assert.ok(!s.exploration.clues.includes(room.id));assert.ok(!s.exploration.solved.includes(room.id));assert.ok(!s.exploration.cleared.includes(room.id));assert.ok(!s.exploration.looted.includes(room.id));for(const item of Object.keys(room.loot))assert.equal(s.inventory[item],0);}
  for(const id of ['cave01','cave02','cave03','cave04'])assert.equal(s.quests[id].status,'active');
  const header=config=>config.headers.find(e=>e.source==='/'+filename).headers.find(h=>h.key==='Content-Disposition').value;
  assert.ok(CLIENT_FILES.includes(filename));assert.equal(header(JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'))),r.headers['content-disposition']);
  const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starfall-cave-checkpoint-'));t.after(()=>fs.rmSync(outputRoot,{recursive:true,force:true}));const out=build({root,outputRoot});assert.deepEqual(fs.readFileSync(path.join(out,filename)),r.body);assert.equal(header(JSON.parse(fs.readFileSync(path.join(out,'vercel.json'),'utf8'))),r.headers['content-disposition']);
});
