'use strict';

const { createClient } = require('redis');
const { createHmac } = require('node:crypto');
const { EventEmitter } = require('node:events');

// Atomic room membership. Only presence is stored; chat travels through Pub/Sub.
const PRUNE = `
local expired = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
for _, id in ipairs(expired) do
  redis.call('HDEL', KEYS[1], id)
  redis.call('ZREM', KEYS[2], id)
end
`;
const JOIN = PRUNE + `
local all = redis.call('HVALS', KEYS[1])
if #all >= tonumber(ARGV[3]) then return {0} end
local same = 0
for _, item in ipairs(all) do
  if cjson.decode(item).ip == ARGV[4] then same = same + 1 end
end
if same >= tonumber(ARGV[5]) then return {0} end
redis.call('HSET', KEYS[1], ARGV[6], ARGV[7])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[6])
redis.call('EXPIRE', KEYS[1], 120)
redis.call('EXPIRE', KEYS[2], 120)
redis.call('PUBLISH', KEYS[3], ARGV[8])
return {1, redis.call('HVALS', KEYS[1])}
`;
const UPDATE = PRUNE + `
local changes = cjson.decode(ARGV[3])
local public = {}
for _, player in ipairs(changes) do
  local old = redis.call('HGET', KEYS[1], player.id)
  if old then
    local entry = cjson.decode(old)
    entry.player = player
    entry.seen = tonumber(ARGV[1])
    redis.call('HSET', KEYS[1], player.id, cjson.encode(entry))
    redis.call('ZADD', KEYS[2], ARGV[2], player.id)
    table.insert(public, player)
  end
end
redis.call('EXPIRE', KEYS[1], 120)
redis.call('EXPIRE', KEYS[2], 120)
if #public > 0 then
  redis.call('PUBLISH', KEYS[3], cjson.encode({kind='presence', seen=tonumber(ARGV[1]), players=public}))
end
return 1
`;
const LEAVE = `
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('PUBLISH', KEYS[3], ARGV[2])
return 1
`;
const LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return count
`;

function createRedisRoom({ url, salt, namespace = 'starfall:production:v1', maxClients = 60, maxPerIp = 8, leaseMs = 45000 } = {}) {
  if (!url || new URL(url).protocol !== 'rediss:') throw new Error('Redis yêu cầu kết nối TLS.');
  if (typeof salt !== 'string' || salt.length < 32) throw new Error('Thiếu ONLINE_IP_SALT riêng tư.');
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(namespace)) throw new Error('Namespace Redis không hợp lệ.');
  const events = new EventEmitter();
  const cache = new Map();
  const keys = [`${namespace}:players`, `${namespace}:leases`, `${namespace}:events`];
  let client, subscriber, ready, closing = false;
  const ipTag = ip => createHmac('sha256', salt).update(ip).digest('hex');
  const fail = () => { if (!closing) events.emit('unavailable'); };
  const apply = packet => {
    if (packet.kind === 'presence') for (const player of packet.players) cache.set(player.id, { player, seen: packet.seen });
    if (packet.kind === 'leave') cache.delete(packet.id);
    if (packet.kind === 'chat' || packet.kind === 'notice') events.emit('message', packet.message);
  };
  async function ensure() {
    if (!ready) ready = (async () => {
      client = createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: 8000, reconnectStrategy: false } });
      subscriber = client.duplicate();
      for (const connection of [client, subscriber]) {
        connection.on('error', fail);
        connection.on('end', fail);
      }
      await client.connect();
      await subscriber.connect();
      await subscriber.subscribe(keys[2], raw => {
        try { apply(JSON.parse(raw)); } catch (_) { fail(); }
      });
    })().catch(async () => { await close(); throw new Error('Dịch vụ online chưa sẵn sàng.'); });
    await ready;
    if (!client.isReady || !subscriber.isReady) {
      await close();
      throw new Error('Dịch vụ online chưa sẵn sàng.');
    }
  }
  async function close() {
    closing = true;
    for (const connection of [subscriber, client]) if (connection?.isOpen) connection.destroy();
    cache.clear(); ready = null; client = subscriber = null;
    closing = false;
  }
  const publicPlayer = ({ id, name, map, x, y, color, facingRight, moving, direction, running }) =>
    ({ id, name, map, x, y, color, facingRight, moving, direction, running });
  return Object.assign(events, {
    async admit(ip) {
      await ensure();
      return await client.eval(LIMIT, { keys: [`${namespace}:upgrade:${ipTag(ip)}`], arguments: [] }) <= 40;
    },
    async join(player, ip) {
      await ensure();
      const now = Date.now(), data = publicPlayer(player);
      const result = await client.eval(JOIN, { keys, arguments: [String(now), String(now + leaseMs), String(maxClients), ipTag(ip), String(maxPerIp), player.id,
        JSON.stringify({ player: data, ip: ipTag(ip), seen: now }), JSON.stringify({ kind: 'presence', players: [data], seen: now })] });
      if (result[0] !== 1) return false;
      for (const raw of result[1]) { const item = JSON.parse(raw); cache.set(item.player.id, { player: item.player, seen: item.seen }); }
      return true;
    },
    async update(players) {
      if (!players.length) return;
      await ensure();
      const now = Date.now();
      await client.eval(UPDATE, { keys, arguments: [String(now), String(now + leaseMs), JSON.stringify(players.map(publicPlayer))] });
    },
    async leave(player) {
      cache.delete(player.id);
      await ensure();
      await client.eval(LEAVE, { keys, arguments: [player.id, JSON.stringify({ kind: 'leave', id: player.id })] });
    },
    async publish(message) {
      await ensure();
      await client.publish(keys[2], JSON.stringify({ kind: message.type, message }));
    },
    snapshot(now = Date.now()) {
      for (const [id, entry] of cache) if (now - entry.seen >= leaseMs) cache.delete(id);
      return [...cache.values()].map(entry => entry.player);
    },
    close
  });
}

module.exports = { createRedisRoom };
