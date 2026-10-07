'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { createGameServer, WORLD } = require('../server');

async function startServer(t, options = {}) {
  const server = createGameServer({ snapshotInterval: 30, ...options });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => server.shutdown());
  return server;
}

function request(server, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: requestPath, method }, response => {
      const body = [];
      response.on('data', chunk => body.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(body).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

function maskedFrame(message, options = {}) {
  const payload = Buffer.isBuffer(message) ? message : Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
  const masked = options.masked !== false;
  const opcode = options.opcode ?? 1;
  let header;
  if (payload.length < 126) header = Buffer.from([0x80 | opcode, (masked ? 0x80 : 0) | payload.length]);
  else {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = (masked ? 0x80 : 0) | 126;
    header.writeUInt16BE(payload.length, 2);
  }
  if (!masked) return Buffer.concat([header, payload]);
  const mask = crypto.randomBytes(4);
  const encoded = Buffer.from(payload);
  for (let i = 0; i < encoded.length; i++) encoded[i] ^= mask[i % 4];
  return Buffer.concat([header, mask, encoded]);
}

class TestClient extends EventEmitter {
  constructor(socket, head = Buffer.alloc(0), autoPong = true, autoClose = true) {
    super();
    this.socket = socket;
    this.messages = [];
    this.controls = [];
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.autoPong = autoPong;
    this.autoClose = autoClose;
    this.closedPromise = new Promise(resolve => socket.on('close', () => { this.closed = true; resolve(); }));
    socket.on('error', () => {});
    socket.on('data', data => this.read(data));
    if (head.length) this.read(head);
  }
  read(incoming) {
    this.buffer = Buffer.concat([this.buffer, incoming]);
    while (this.buffer.length >= 2) {
      const opcode = this.buffer[0] & 0x0f;
      let length = this.buffer[1] & 0x7f, offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        length = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (this.buffer.length < offset + length) return;
      const payload = this.buffer.subarray(offset, offset + length);
      this.buffer = this.buffer.subarray(offset + length);
      if (opcode === 1) {
        const message = JSON.parse(payload.toString('utf8'));
        this.messages.push(message);
        this.emit('message', message);
      } else {
        this.controls.push({ opcode, payload });
        this.emit('control', { opcode, payload });
        if (opcode === 9 && this.autoPong) this.socket.write(maskedFrame(payload, { opcode: 10 }));
        if (opcode === 8 && this.autoClose) this.socket.end(maskedFrame('', { opcode: 8 }));
      }
    }
  }
  send(message) { this.socket.write(maskedFrame(message)); }
  waitFor(predicate, timeout = 2500) {
    const found = this.messages.find(predicate);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const listener = message => {
        if (!predicate(message)) return;
        clearTimeout(timer);
        this.off('message', listener);
        resolve(message);
      };
      const timer = setTimeout(() => { this.off('message', listener); reject(new Error('Timed out waiting for server message')); }, timeout);
      this.on('message', listener);
    });
  }
  async waitClosed(timeout = 2500) {
    if (this.closed) return;
    let timer;
    await Promise.race([this.closedPromise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Socket did not close')), timeout); })]);
    clearTimeout(timer);
  }
}

function connect(t, server, options = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const socket = net.connect({ host: '127.0.0.1', port, allowHalfOpen: options.allowHalfOpen === true });
    t.after(() => socket.destroy());
    const key = options.key ?? crypto.randomBytes(16).toString('base64');
    const headers = [
      `GET ${options.path || '/play'} HTTP/1.1`, `Host: 127.0.0.1:${port}`,
      'Upgrade: websocket', 'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`, `Sec-WebSocket-Version: ${options.version || '13'}`,
      ...(options.origin === null ? [] : [`Origin: ${options.origin || `http://127.0.0.1:${port}`}`]), '', ''
    ].join('\r\n');
    let pending = Buffer.alloc(0);
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Handshake timed out')); }, 2500);
    const errorListener = error => { clearTimeout(timer); reject(error); };
    socket.once('error', errorListener);
    const onData = data => {
      pending = Buffer.concat([pending, data]);
      const end = pending.indexOf('\r\n\r\n');
      if (end < 0) return;
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', errorListener);
      const header = pending.subarray(0, end).toString('utf8');
      const status = Number(header.split(' ')[1]);
      if (status !== 101) { socket.destroy(); resolve({ status, header }); return; }
      const client = new TestClient(socket, pending.subarray(end + 4), options.autoPong !== false, options.autoClose !== false);
      client.status = status;
      client.header = header;
      resolve(client);
    };
    socket.on('data', onData);
    socket.on('connect', () => socket.write(headers));
  });
}

async function snapshotAfterMove(sender, packet, predicate, receiver = sender) {
  // Exercise normal frames without being caught by the existing 40ms throttle.
  await new Promise(resolve => setTimeout(resolve, 60));
  receiver.messages.length = 0;
  sender.send(packet);
  const snapshot = await receiver.waitFor(message => message.type === 'snapshot' && message.players.some(predicate));
  return snapshot.players.find(predicate);
}

test('HTTP serves only the client allowlist, with correct GET/HEAD types and query strings', async t => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-server-test-'));
  const names = ['index.html', 'styles.css', 'game-data.js', 'game-core.js', 'npc-ai.js', 'world-paths.js', 'world-effects.js', 'world-actors.js', 'game.js'];
  for (const name of names) fs.writeFileSync(path.join(fixtureRoot, name), `fixture:${name}`);
  t.after(() => {
    const resolved = path.resolve(fixtureRoot);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('starfall-server-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const server = await startServer(t, { rootDir: fixtureRoot });
  for (const [file, type] of [['index.html', 'text/html'], ['styles.css', 'text/css'], ['game-data.js', 'text/javascript'], ['game-core.js', 'text/javascript'], ['npc-ai.js', 'text/javascript'], ['world-paths.js', 'text/javascript'], ['world-effects.js', 'text/javascript'], ['world-actors.js', 'text/javascript'], ['game.js', 'text/javascript']]) {
    const response = await request(server, `/${file}?v=123`);
    assert.equal(response.status, 200);
    assert.equal(response.body, `fixture:${file}`);
    assert.ok(response.headers['content-type'].startsWith(type));
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    const head = await request(server, `/${file}`, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(head.headers['content-length'], String(Buffer.byteLength(`fixture:${file}`)));
  }
  assert.equal((await request(server, '/')).body, 'fixture:index.html');
});

test('HTTP rejects traversal, non-game files, malformed encoding and unsupported methods', async t => {
  const server = await startServer(t);
  for (const requestPath of ['/../index.html', '/%2e%2e/index.html', '/%2e%2e%2findex.html', '/..%5cindex.html', '/.%2findex.html', '/server.js', '/README.md', '/.git/config', '/missing', '/__proto__']) {
    assert.equal((await request(server, requestPath)).status, 404, requestPath);
  }
  assert.equal((await request(server, '/bad%XX')).status, 400);
  const post = await request(server, '/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  const health = await request(server, '/health');
  assert.deepEqual(JSON.parse(health.body), { ok: true, game: 'Thung Lũng Sao Rơi', players: 0 });
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal((await request(server, '/health', 'HEAD')).body, '');
});

test('The actual project client assets are all available through the game server', async t => {
  const server = await startServer(t);
  for (const file of ['index.html', 'styles.css', 'game-data.js', 'game-core.js', 'npc-ai.js', 'world-paths.js', 'world-effects.js', 'world-actors.js', 'game.js']) {
    const response = await request(server, `/${file}`);
    assert.equal(response.status, 200, file);
    assert.equal(response.body, fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), file);
    assert.ok(response.body.length > 0, file);
  }
});

test('WebSocket joins two guests with unique self IDs, broadcasts snapshots, and removes disconnects', async t => {
  const server = await startServer(t);
  const first = await connect(t, server), second = await connect(t, server);
  assert.equal(first.status, 101);
  first.send({ type: 'join', name: '<Mây>\u0000', map: 'invalid', x: 'bad', y: null });
  const welcomeA = await first.waitFor(message => message.type === 'welcome');
  first.send({ type: 'join', name: 'Duplicate' });
  second.send({ type: 'join', name: 'Sương', map: 'forest', x: 100, y: 120 });
  const welcomeB = await second.waitFor(message => message.type === 'welcome');
  assert.notEqual(welcomeA.id, welcomeB.id);
  const both = await first.waitFor(message => message.type === 'snapshot' && message.players.length === 2);
  const own = both.players.find(player => player.id === welcomeA.id);
  assert.equal(own.name, 'Mây');
  assert.equal(own.map, 'village');
  assert.equal(own.x, 800);
  assert.equal(own.y, 550);
  assert.equal(own.direction, 'down');
  assert.equal(own.running, false);
  assert.ok(both.players.some(player => player.id === welcomeB.id && player.map === 'forest'));
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 2);
  assert.ok(first.messages.some(message => message.type === 'notice' && message.text.includes('Thung Lũng Sao Rơi')));
  second.socket.end(maskedFrame('', { opcode: 8 }));
  await second.waitClosed();
  await first.waitFor(message => message.type === 'snapshot' && message.players.length === 1 && message.players[0].id === welcomeA.id);
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 1);
});

test('A masked close removes the guest immediately even when its TCP write side stays open', async t => {
  const server = await startServer(t);
  const observer = await connect(t, server);
  const closing = await connect(t, server, { allowHalfOpen: true, autoClose: false });
  observer.send({ type: 'join', name: 'Observer' });
  const observerWelcome = await observer.waitFor(message => message.type === 'welcome');
  closing.send({ type: 'join', name: 'Closing' });
  await closing.waitFor(message => message.type === 'welcome');
  await observer.waitFor(message => message.type === 'snapshot' && message.players.length === 2);
  observer.messages.length = 0;
  closing.socket.write(maskedFrame('', { opcode: 8 }));
  await observer.waitFor(message => message.type === 'notice' && message.text === 'Closing đã rời thung lũng.');
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 1);
  assert.equal(closing.closed, false, 'TCP write side remains open while the guest is already absent');
  const remaining = await observer.waitFor(message => message.type === 'snapshot' && message.players.length === 1);
  assert.equal(remaining.players[0].id, observerWelcome.id);
  closing.socket.destroy();
  await closing.waitClosed();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(observer.messages.filter(message => message.type === 'notice' && message.text === 'Closing đã rời thung lũng.').length, 1);
});

test('A TCP half-close without a WebSocket close frame removes the guest and produces only one departure notice', async t => {
  const server = await startServer(t);
  const observer = await connect(t, server), closing = await connect(t, server, { allowHalfOpen: true, autoClose: false });
  observer.send({ type: 'join', name: 'Observer' });
  await observer.waitFor(message => message.type === 'welcome');
  closing.send({ type: 'join', name: 'Halfclose' });
  await closing.waitFor(message => message.type === 'welcome');
  await observer.waitFor(message => message.type === 'snapshot' && message.players.length === 2);
  observer.messages.length = 0;
  closing.socket.end();
  await observer.waitFor(message => message.type === 'notice' && message.text === 'Halfclose đã rời thung lũng.');
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 1);
  await closing.waitClosed();
  await observer.waitFor(message => message.type === 'snapshot' && message.players.length === 1);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(observer.messages.filter(message => message.type === 'notice' && message.text === 'Halfclose đã rời thung lũng.').length, 1);
});

test('Movement accepts valid steps and map transitions, clamps bounds, rejects teleporting and non-finite input', async t => {
  const server = await startServer(t);
  const client = await connect(t, server);
  client.send({ type: 'join', name: 'Linh', map: 'village', x: 100, y: 100 });
  const { id } = await client.waitFor(message => message.type === 'welcome');
  client.send({ type: 'move', map: 'village', x: 110, y: 108, facingRight: false, moving: true });
  const valid = await client.waitFor(message => message.type === 'snapshot' && message.players.some(player => player.id === id && player.x === 110));
  assert.equal(valid.players[0].y, 108);
  assert.equal(valid.players[0].moving, true);
  assert.equal(valid.players[0].facingRight, false);
  client.send({ type: 'move', map: 'village', x: 1400, y: 1000 });
  client.send({ type: 'move', map: 'invalid', x: '1000', y: null, moving: false });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(client.messages.filter(message => message.type === 'snapshot').at(-1).players[0].x, 110);
  client.send({ type: 'move', map: 'ruins', x: 9999, y: -20 });
  const clamped = await client.waitFor(message => message.type === 'snapshot' && message.players.some(player => player.id === id && player.map === 'ruins'));
  assert.equal(clamped.players[0].x, WORLD.ruins[0]);
  assert.equal(clamped.players[0].y, 0);
});

test('Movement spam is throttled while the normal 100 ms client cadence is accepted', async t => {
  const server = await startServer(t);
  const client = await connect(t, server);
  client.send({ type: 'join', name: 'Đi bộ', x: 100, y: 100 });
  await client.waitFor(message => message.type === 'welcome');
  client.socket.write(Buffer.concat([
    maskedFrame({ type: 'move', map: 'village', x: 110, y: 100 }),
    maskedFrame({ type: 'move', map: 'village', x: 120, y: 100 }),
    maskedFrame({ type: 'move', map: 'village', x: 130, y: 100 })
  ]));
  await client.waitFor(message => message.type === 'snapshot' && message.players[0].x === 110);
  assert.ok(!client.messages.some(message => message.type === 'snapshot' && message.players[0].x > 110));
  await new Promise(resolve => setTimeout(resolve, 100));
  client.send({ type: 'move', map: 'village', x: 125, y: 100 });
  await client.waitFor(message => message.type === 'snapshot' && message.players[0].x === 125);
});

test('Snapshots replicate four-direction orientation and running to another online guest', async t => {
  const server = await startServer(t), runner = await connect(t, server), observer = await connect(t, server);
  runner.send({ type:'join', name:'Người chạy', x:200, y:200, direction:'up', running:true });
  const { id } = await runner.waitFor(message => message.type === 'welcome');
  observer.send({ type:'join', name:'Người xem' });
  await observer.waitFor(message => message.type === 'welcome');
  const joined = await observer.waitFor(message => message.type === 'snapshot' && message.players.length === 2);
  const initial = joined.players.find(player => player.id === id);
  assert.equal(initial.direction,'down');assert.equal(initial.running,false);
  for(const [x,y,direction,facingRight] of [[220,200,'right',true],[220,220,'down',true],[200,220,'left',false],[200,200,'up',false]]){
    const guest = await snapshotAfterMove(runner,{type:'move',map:'village',x,y,direction,moving:true,running:true,facingRight},
      player => player.id === id && player.x === x && player.y === y && player.direction === direction && player.running === true,observer);
    assert.equal(guest.moving,true);assert.equal(guest.facingRight,facingRight);
  }
});

test('Absent or invalid directions derive from accepted travel, with a legacy-facing fallback while stationary', async t => {
  const server = await startServer(t), client = await connect(t, server);
  client.send({type:'join',name:'Khách cũ',x:200,y:200});
  const {id} = await client.waitFor(message => message.type === 'welcome');
  for(const [x,y,direction,expected] of [[220,200,undefined,'right'],[220,220,'north','down'],[200,220,[],'left'],[200,200,{},'up']]){
    const guest = await snapshotAfterMove(client,{type:'move',x,y,direction,moving:true},
      player => player.id === id && player.x === x && player.y === y && player.direction === expected);
    assert.equal(guest.running,false);assert.equal(guest.moving,true);
  }
  const idleLeft = await snapshotAfterMove(client,{type:'move',x:200,y:200,direction:null,facingRight:false,moving:false,running:true},
    player => player.id === id && player.direction === 'left' && player.moving === false);
  assert.equal(idleLeft.running,false);assert.equal(idleLeft.facingRight,false);
  const idleRight = await snapshotAfterMove(client,{type:'move',x:200,y:200,direction:'__proto__',facingRight:true,moving:false},
    player => player.id === id && player.direction === 'right' && player.moving === false);
  assert.equal(idleRight.running,false);assert.equal(idleRight.facingRight,true);
});

test('Running requires a literal boolean and actual accepted movement, including idle and rejected teleport packets', async t => {
  const server = await startServer(t), client = await connect(t, server);
  client.send({type:'join',name:'Kiểm tra bước',x:100,y:100});
  const {id} = await client.waitFor(message => message.type === 'welcome');
  let x=100;
  for(const running of ['true','false',1,{},[],null,undefined]){
    x+=8;
    const guest = await snapshotAfterMove(client,{type:'move',x,y:100,direction:'right',moving:true,running},
      player => player.id === id && player.x === x);
    assert.equal(guest.running,false);
  }
  x+=8;
  const silentStep = await snapshotAfterMove(client,{type:'move',x,y:100,direction:'right',moving:false,running:true},
    player => player.id === id && player.x === x);
  assert.equal(silentStep.running,false);assert.equal(silentStep.moving,false);
  x+=8;
  const active = await snapshotAfterMove(client,{type:'move',x,y:100,direction:'right',moving:true,running:true},
    player => player.id === id && player.x === x && player.running === true);
  assert.equal(active.moving,true);
  const idle = await snapshotAfterMove(client,{type:'move',x,y:100,direction:'up',moving:true,running:true},
    player => player.id === id && player.x === x && player.running === false && player.direction === 'up');
  assert.equal(idle.y,100);
  x+=8;
  await snapshotAfterMove(client,{type:'move',x,y:100,direction:'right',moving:true,running:true},
    player => player.id === id && player.x === x && player.running === true);
  const rejected = await snapshotAfterMove(client,{type:'move',map:'village',x:1400,y:1000,direction:'invalid',facingRight:false,moving:true,running:true},
    player => player.id === id && player.x === x && player.running === false && player.direction === 'left');
  assert.equal(rejected.y,100);assert.equal(rejected.facingRight,false);
});

test('The maximum upgraded sprint at 371.25 px/s fits the unchanged 100ms movement allowance', async t => {
  const server = await startServer(t), client = await connect(t, server);
  client.send({type:'join',name:'Giày lữ hành',x:100,y:100});
  const {id} = await client.waitFor(message => message.type === 'welcome');
  let x=100;
  for(let index=0;index<4;index++){
    await new Promise(resolve => setTimeout(resolve,100));
    x+=371.25*.1;
    client.messages.length=0;
    client.send({type:'move',x,y:100,direction:'right',moving:true,running:true});
    const snapshot = await client.waitFor(message => message.type === 'snapshot' && message.players.some(player => player.id === id && player.x === x));
    const guest=snapshot.players.find(player=>player.id===id);
    assert.equal(guest.direction,'right');assert.equal(guest.running,true);
  }
});

test('Chat sanitizes name/text, truncates safely, broadcasts to guests, and throttles repeated sends', async t => {
  const server = await startServer(t);
  const first = await connect(t, server), second = await connect(t, server);
  first.send({ type: 'join', name: '🙂'.repeat(30) });
  second.send({ type: 'join', name: 'Người nghe' });
  await first.waitFor(message => message.type === 'welcome');
  await second.waitFor(message => message.type === 'welcome');
  first.send({ type: 'chat', text: ' <hello>\nworld\u0000 ' + '🙂'.repeat(160) });
  const chat = await second.waitFor(message => message.type === 'chat');
  assert.equal(Array.from(chat.name).length, 18);
  assert.equal(Array.from(chat.text).length, 140);
  assert.ok(chat.text.startsWith('hello world  '));
  assert.ok(!/[<>\u0000-\u001f\u007f]/.test(chat.text));
  assert.ok(!chat.text.includes('\ufffd'));
  first.send({ type: 'chat', text: 'too soon' });
  first.send({ type: 'chat', text: {} });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(second.messages.filter(message => message.type === 'chat').length, 1);
  await new Promise(resolve => setTimeout(resolve, 920));
  first.send({ type: 'chat', text: 'Tin nhắn thứ hai' });
  await second.waitFor(message => message.type === 'chat' && message.text === 'Tin nhắn thứ hai');
});

test('Malformed JSON and pre-join actions are ignored; split masked frames and ping/pong work', async t => {
  const server = await startServer(t);
  const client = await connect(t, server);
  client.send('bad json');
  client.send([]);
  client.send({ type: 'chat', text: 'not joined' });
  client.send({ type: 'move', x: 900, y: 500 });
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 0);
  const joinFrame = maskedFrame({ type: 'join', name: 'Bình' });
  client.socket.write(joinFrame.subarray(0, 3));
  client.socket.write(joinFrame.subarray(3, 9));
  client.socket.write(joinFrame.subarray(9));
  await client.waitFor(message => message.type === 'welcome');
  client.socket.write(maskedFrame(Buffer.from('ping-body'), { opcode: 9 }));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(client.controls.some(control => control.opcode === 10 && control.payload.toString() === 'ping-body'));
  assert.equal(client.messages.filter(message => message.type === 'chat').length, 0);
});

test('Handshake rejects foreign/malformed origin, wrong path/version, and invalid key', async t => {
  const server = await startServer(t);
  for (const options of [{ origin: 'https://example.com' }, { origin: 'null' }, { path: '/index.html' }, { path: '/%70lay' }, { version: '12' }, { key: 'not-base64' }]) {
    const rejected = await connect(t, server, options);
    assert.equal(rejected.status, 403, JSON.stringify(options));
  }
});

test('Unmasked, binary, fragmented, reserved-bit, oversized and malformed control frames disconnect', async t => {
  const server = await startServer(t);
  const cases = [
    maskedFrame('{}', { masked: false }),
    maskedFrame('{}', { opcode: 2 }),
    Buffer.from([0x01, 0x80, 1, 2, 3, 4]),
    Buffer.from([0xc1, 0x80, 1, 2, 3, 4]),
    Buffer.from([0x81, 0xfe, 0x80, 0x00]),
    maskedFrame('a'.repeat(126), { opcode: 9 }),
    maskedFrame('a', { opcode: 8 })
  ];
  for (const invalid of cases) {
    const client = await connect(t, server);
    client.socket.write(invalid);
    await client.waitClosed();
  }
});

test('Player capacity rejects another join without adding a ghost guest', async t => {
  const server = await startServer(t, { maxClients: 1 });
  const first = await connect(t, server), second = await connect(t, server);
  first.send({ type: 'join', name: 'Một' });
  await first.waitFor(message => message.type === 'welcome');
  second.send({ type: 'join', name: 'Hai' });
  const notice = await second.waitFor(message => message.type === 'notice');
  assert.ok(notice.text.includes('đang đông'));
  await second.waitClosed();
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 1);
});

test('Heartbeat closes idle clients and unjoined sockets while responsive guests remain', async t => {
  const server = await startServer(t, { heartbeatInterval: 25, idleTimeout: 100, joinTimeout: 80 });
  const idle = await connect(t, server, { autoPong: false });
  const unjoined = await connect(t, server);
  const active = await connect(t, server);
  idle.send({ type: 'join', name: 'Idle' });
  active.send({ type: 'join', name: 'Active' });
  await active.waitFor(message => message.type === 'welcome');
  await Promise.all([idle.waitClosed(), unjoined.waitClosed()]);
  assert.equal(active.closed, false);
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 1);
});

test('Graceful shutdown is idempotent and closes connected WebSocket clients', async t => {
  const server = await startServer(t);
  const client = await connect(t, server);
  client.send({ type: 'join', name: 'Bye' });
  await client.waitFor(message => message.type === 'welcome');
  const shutdownA = server.shutdown(), shutdownB = server.shutdown();
  assert.equal(shutdownA, shutdownB);
  await shutdownA;
  await client.waitClosed();
  assert.equal(server.listening, false);
});

test('The standard WebSocket API connects, receives its identity, and reconnects as a fresh guest', async t => {
  const server = await startServer(t);
  async function joinGuest() {
    const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/play`);
    t.after(() => socket.close());
    const welcome = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('Native WebSocket welcome timeout')); }, 2500);
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Native WebSocket failed')); }, { once: true });
      socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.type === 'welcome') { clearTimeout(timer); resolve(message); }
      });
    });
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', name: 'Khách chuẩn', map: 'coast', x: 600, y: 500 })), { once: true });
    return { socket, welcome: await welcome };
  }
  const first = await joinGuest();
  const closed = new Promise(resolve => first.socket.addEventListener('close', resolve, { once: true }));
  first.socket.close();
  await closed;
  const next = await joinGuest();
  assert.notEqual(first.welcome.id, next.welcome.id);
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 1);
});

test('Shutdown also releases a closing transport that keeps its TCP write side open', async t => {
  const server = await startServer(t);
  const closing = await connect(t, server, { allowHalfOpen: true, autoClose: false });
  closing.send({ type: 'join', name: 'Closing transport' });
  await closing.waitFor(message => message.type === 'welcome');
  closing.socket.write(maskedFrame('', { opcode: 8 }));
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(JSON.parse((await request(server, '/health')).body).players, 0);
  assert.equal(closing.closed, false);
  await server.shutdown();
  // Release the client's own write half after the server has finished shutting down.
  closing.socket.end();
  await closing.waitClosed();
  assert.equal(server.listening, false);
});

test('Configured public origins accept the frontend and reject missing or forged origins', async t => {
  const server = await startServer(t, { allowedOrigins: ['https://starfall.game.test'] });
  assert.equal((await connect(t, server, { origin: 'https://starfall.game.test' })).status, 101);
  for (const origin of [null, 'https://starfall.game.test.evil.test', 'https://unknown.game.test']) assert.equal((await connect(t, server, { origin })).status, 403);
});

test('Per-IP connection and upgrade limits stop repeated joins', async t => {
  const server = await startServer(t, { maxConnectionsPerIp: 1, maxUpgradesPerMinute: 3 });
  const first = await connect(t, server);
  assert.equal(first.status, 101);
  assert.equal((await connect(t, server)).status, 403);
  first.socket.destroy();
  await first.waitClosed();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal((await connect(t, server)).status, 101, 'Disconnect releases the IP slot');
  assert.equal((await connect(t, server)).status, 403, 'Upgrade budget cannot be reset by reconnecting');
});

test('Flooded small frames and bytes disconnect without crashing the server', async t => {
  const server = await startServer(t, { maxFramesPerSecond: 4, maxBytesPerSecond: 500 });
  const frames = await connect(t, server);
  frames.socket.write(Buffer.concat(Array.from({ length: 5 }, () => maskedFrame('{}'))));
  await frames.waitClosed();
  const bytes = await connect(t, server);
  bytes.socket.write(maskedFrame('a'.repeat(600)));
  await bytes.waitClosed();
  assert.equal((await request(server, '/health')).status, 200);
});

test('HTTP requests receive restrictive security headers and an IP rate limit', async t => {
  const server = await startServer(t, { maxHttpPerMinute: 2 });
  const response = await request(server, '/');
  assert.ok(response.headers['content-security-policy'].includes("frame-ancestors 'none'"));
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal((await request(server, '/health')).status, 200);
  assert.equal((await request(server, '/')).status, 429);
});
