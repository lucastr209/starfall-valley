'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { createClient } = require('redis');
const { createRedisRoom } = require('../redis-room.cjs');
const { createGameServer } = require('../server.js');

const live = process.env.RUN_REDIS_TESTS === '1';
function packet(socket, predicate, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.removeEventListener('message', receive); reject(new Error('Thiếu gói đồng bộ')); }, timeout);
    function receive(event) {
      const data = JSON.parse(event.data);
      if (!predicate(data)) return;
      clearTimeout(timer); socket.removeEventListener('message', receive); resolve(data);
    }
    socket.addEventListener('message', receive);
  });
}
async function connect(t, server, name) {
  const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/play`);
  t.after(() => { if (socket.readyState < 2) socket.close(); });
  const welcome = packet(socket, data => data.type === 'welcome');
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.send(JSON.stringify({ type: 'join', name, map: 'village', x: 800, y: 550 }));
  return { socket, id: (await welcome).id };
}

test('Real Redis shares presence/movement/chat across independent servers, enforces global capacity, and expires private data', { skip: !live, timeout: 30000 }, async t => {
  const namespace = `starfall:qa:${randomUUID()}`, salt = randomBytes(32).toString('hex');
  const url = process.env.REDIS_URL;
  const inspector = createClient({ url, socket: { reconnectStrategy: false, connectTimeout: 8000 } });
  inspector.on('error', () => {});
  await inspector.connect();
  t.after(async () => {
    const keys = await inspector.keys(`${namespace}:*`);
    if (keys.length) await inspector.del(keys);
    await inspector.close();
  });
  const servers = [];
  for (let i = 0; i < 3; i++) {
    const room = createRedisRoom({ url, salt, namespace, maxClients: 2, maxPerIp: 2 });
    const server = createGameServer({ room, snapshotInterval: 30, sharedInterval: 100 });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    t.after(() => server.shutdown());
  }
  const first = await connect(t, servers[0], 'QA Sao Một');
  const twoOnFirst = packet(first.socket, data => data.type === 'snapshot' && data.players.length === 2);
  const second = await connect(t, servers[1], 'QA Sao Hai');
  assert.equal((await twoOnFirst).players.some(player => player.id === second.id), true);
  const moved = packet(second.socket, data => data.type === 'snapshot' && data.players.some(player => player.id === first.id && player.x === 810 && player.direction === 'right' && player.running));
  first.socket.send(JSON.stringify({ type: 'move', map: 'village', x: 810, y: 550, direction: 'right', moving: true, running: true }));
  await moved;
  const chat = packet(second.socket, data => data.type === 'chat');
  first.socket.send(JSON.stringify({ type: 'chat', text: '<script>QA</script>' }));
  assert.equal((await chat).text, 'scriptQA/script');
  const third = new WebSocket(`ws://127.0.0.1:${servers[2].address().port}/play`);
  const rejected = packet(third, data => data.type === 'notice' && data.text.includes('đang đông'));
  await new Promise(resolve => third.addEventListener('open', resolve, { once: true }));
  third.send(JSON.stringify({ type: 'join', name: 'QA Capacity' }));
  await rejected;
  const presence = await inspector.hVals(`${namespace}:players`);
  assert.equal(presence.length, 2);
  assert.equal(presence.some(raw => raw.includes('127.0.0.1') || raw.includes('scriptQA')), false);
  const keys = await inspector.keys(`${namespace}:*`);
  assert.equal(keys.some(key => /chat|save|password/.test(key)), false);
  for (const key of keys) { const ttl = await inspector.ttl(key); assert.ok(ttl > 0 && ttl <= 120, `TTL ${ttl}`); }
  const departure = packet(second.socket, data => data.type === 'snapshot' && data.players.length === 1);
  first.socket.close();
  await departure;
  assert.equal(await inspector.hLen(`${namespace}:players`), 1);
});

test('Redis configuration refuses plaintext transport and weak or missing server secrets', () => {
  assert.throws(() => createRedisRoom({ url: 'redis://localhost' }), /TLS/);
  assert.throws(() => createRedisRoom({ url: 'rediss://localhost', salt: 'short' }), /SALT/);
});

test('Real Redis admission is atomic; expired and departed guests cannot be revived by late movement', { skip: !live, timeout: 20000 }, async t => {
  const namespace = `starfall:qa:${randomUUID()}`;
  const config = { url: process.env.REDIS_URL, salt: randomBytes(32).toString('hex'), namespace, maxClients: 1, maxPerIp: 1, leaseMs: 250 };
  const one = createRedisRoom(config), two = createRedisRoom(config);
  let failures = 0;
  one.on('unavailable', () => failures++); two.on('unavailable', () => failures++);
  const inspector = createClient({ url: config.url, socket: { reconnectStrategy: false } });
  inspector.on('error', () => {}); await inspector.connect();
  t.after(async () => {
    await one.close(); await two.close();
    const keys = await inspector.keys(`${namespace}:*`); if (keys.length) await inspector.del(keys);
    await inspector.close();
  });
  const player = id => ({ id, name: 'QA Race', map: 'village', x: 800, y: 550, direction: 'down', moving: false, running: false });
  const a = player(randomUUID()), b = player(randomUUID());
  const attempts = await Promise.all([one.join(a, '127.0.0.1'), two.join(b, '127.0.0.1')]);
  assert.equal(attempts.filter(Boolean).length, 1);
  await new Promise(resolve => setTimeout(resolve, 300));
  const replacement = player(randomUUID());
  assert.equal(await two.join(replacement, '127.0.0.1'), true);
  await one.update([a, b]); // Both old leases expired: UPDATE must not re-add them.
  assert.equal(await inspector.hLen(`${namespace}:players`), 1);
  await two.leave(replacement);
  await two.update([replacement]); // Normal close/flush race produces no malformed Pub/Sub packet.
  assert.equal(await inspector.hLen(`${namespace}:players`), 0);
  assert.equal(failures, 0);
});
