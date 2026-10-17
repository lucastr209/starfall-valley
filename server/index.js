'use strict';

// HTTP + WebSocket; localhost dùng RAM, Vercel dùng room Redis được truyền vào.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');
const { CLIENT_FILES, securityHeaders } = require('../config/deployment.cjs');
const { parseOrigins, originAllowed, createIpResolver, createRateLimiter, environmentOptions } = require('./policy.cjs');

const WORLD = Object.freeze({
  village: [1600, 1100], forest: [1600, 1100],
  coast: [1600, 1100], ruins: [1600, 1100]
});
const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
});
// The local server and deployment build publish the same explicit allowlist.
const ASSETS = Object.freeze(Object.fromEntries([
  ['/', ['index.html', CONTENT_TYPES['.html']]],
  ...CLIENT_FILES.map(file => ['/' + file, [file, CONTENT_TYPES[path.extname(file)]]])
]));
const MAX_FRAME_BYTES = 16 * 1024;
const utf8 = new TextDecoder('utf-8', { fatal: true });

function frame(data, opcode = 0x1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(
    typeof data === 'string' ? data : JSON.stringify(data)
  );
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

function cleanName(value) {
  if (typeof value !== 'string') return 'Lữ khách';
  const name = value.replace(/[<>\u0000-\u001f\u007f]/g, '').trim();
  return Array.from(name).slice(0, 18).join('') || 'Lữ khách';
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim())
    .slice(0, 140).join('');
}

function clamp(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function createGameServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, '..', 'public'));
  const maxClients = options.maxClients ?? 60;
  const snapshotInterval = options.snapshotInterval ?? 150;
  const heartbeatInterval = options.heartbeatInterval ?? 20000;
  const idleTimeout = options.idleTimeout ?? 45000;
  const joinTimeout = options.joinTimeout ?? 15000;
  const origins = parseOrigins(options.allowedOrigins || []);
  const maxConnectionsPerIp = options.maxConnectionsPerIp ?? 8;
  const maxFramesPerSecond = options.maxFramesPerSecond ?? 80;
  const maxBytesPerSecond = options.maxBytesPerSecond ?? 64 * 1024;
  const resolveIp = options.resolveIp || createIpResolver(options.trustedProxyIps || '');
  const room = options.room;
  const dirty = new Set();
  const pendingRoom = new Set();
  const failOnline = () => {
    if (shutdownPromise) return;
    console.error('Dịch vụ đồng bộ online tạm thời không khả dụng.');
    for (const socket of clients) socket.destroy();
  };
  const upgradeLimit = createRateLimiter({ limit: options.maxUpgradesPerMinute ?? 40, windowMs: 60000 });
  const httpLimit = createRateLimiter({ limit: options.maxHttpPerMinute ?? 240, windowMs: 60000 });
  const ipConnections = new Map();
  const protectedHeaders = securityHeaders(options.onlineUrl || '');
  const clients = new Set();
  // Presence ends at the close frame; TCP transport may finish its handshake later.
  const transports = new Set();
  const players = new Map();
  let shutdownPromise;

  // The Vercel bridge adds internal headers; retain a finite bound above those.
  const server = http.createServer({ maxHeaderSize: options.backendOnly ? 64 * 1024 : 16 * 1024 }, (request, response) => {
    const headers = {
      ...protectedHeaders, 'Cache-Control': 'no-cache'
    };
    if (!httpLimit.allow(resolveIp(request))) {
      response.writeHead(429, { ...headers, 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Too many requests');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { ...headers, Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }

    // Inspect the raw path first; URL normalization would conceal /../ traversal.
    let requestPath;
    try { requestPath = decodeURIComponent((request.url || '').split('?')[0]); }
    catch (_) {
      response.writeHead(400, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Bad request');
      return;
    }
    if (requestPath.includes('\\') || requestPath.includes('\0') ||
        requestPath.split('/').some(part => part === '.' || part === '..')) {
      response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    if (requestPath === '/health') {
      const body = JSON.stringify({ ok: true, game: 'Thung Lũng Sao Rơi', players: players.size });
      response.writeHead(200, {
        ...headers, 'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body)
      });
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    if (options.backendOnly) {
      response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const asset = Object.hasOwn(ASSETS, requestPath) ? ASSETS[requestPath] : null;
    if (!asset) {
      response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    fs.readFile(path.join(rootDir, asset[0]), (error, body) => {
      if (error) {
        response.writeHead(500, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Không đọc được tài nguyên trò chơi.');
        return;
      }
      const download=({'recovery/forest-checkpoint.json':{'Content-Disposition':'attachment; filename="starfall-valley-forest-recovery.json"'},'recovery/cave-checkpoint.json':{'Content-Disposition':'attachment; filename="starfall-valley-cave-checkpoint.json"'}})[asset[0]]||{};
      response.writeHead(200, { ...headers, ...download, 'Content-Type': asset[1], 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    });
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = options.backendOnly ? 128 : 32;

  function send(socket, data, opcode = 0x1) {
    if (socket.writableLength > MAX_FRAME_BYTES * 4) { socket.destroy(); return; }
    if (!socket.destroyed && socket.writable) socket.write(frame(data, opcode));
  }

  function broadcast(data) {
    const output = frame(data);
    for (const socket of clients) {
      if (!socket.joined) continue;
      if (socket.writableLength > MAX_FRAME_BYTES * 4) { socket.destroy(); continue; }
      if (!socket.destroyed && socket.writable) socket.write(output);
    }
  }

  function snapshot() {
    const shared = new Map((room ? room.snapshot() : []).map(player => [player.id, player]));
    for (const player of players.values()) shared.set(player.id, player);
    return {
      type: 'snapshot',
      players: [...shared.values()].map(({ id, name, map, x, y, color, facingRight, moving, direction, running }) =>
        ({ id, name, map, x, y, color, facingRight, moving, direction, running }))
    };
  }

  function removeClient(socket) {
    if (!clients.delete(socket)) return;
    const player = socket.player;
    socket.joined = false;
    socket.player = null;
    if (player && players.delete(player.id)) {
      dirty.delete(player.id);
      if (room) trackRoom(room.leave(player));
      announce({ type: 'notice', text: `${player.name} đã rời thung lũng.` });
    }
  }

  function announce(message) {
    if (room) trackRoom(room.publish(message));
    else broadcast(message);
  }
  function trackRoom(promise) {
    const task = promise.catch(failOnline).finally(() => pendingRoom.delete(task));
    pendingRoom.add(task);
    return task;
  }
  if (room) { room.on('message', broadcast); room.on('unavailable', failOnline); }

  async function handleMessage(socket, payload) {
    if (!clients.has(socket)) return;
    let message;
    try { message = JSON.parse(utf8.decode(payload)); }
    catch (_) { return; }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;

    if (message.type === 'join' && !socket.joined) {
      if (players.size >= maxClients) {
        send(socket, { type: 'notice', text: 'Thung lũng đang đông, hãy thử lại sau.' });
        send(socket, '', 0x8);
        socket.end();
        return;
      }
      const map = Object.hasOwn(WORLD, message.map) ? message.map : 'village';
      const [width, height] = WORLD[map];
      const player = {
        id: crypto.randomUUID(), name: cleanName(message.name), map,
        x: clamp(message.x, 0, width, 800), y: clamp(message.y, 0, height, 550),
        color: ['#f3ba68', '#88c8c0', '#d8a5de', '#a5c46d', '#df8190'][players.size % 5],
        facingRight: true, moving: false, direction: 'down', running: false,
        lastMoveAt: Date.now(), lastMoveMessageAt: 0, lastChatAt: 0
      };
      if (room && !await room.join(player, socket.clientIp)) {
        send(socket, { type: 'notice', text: 'Thung lũng đang đông, hãy thử lại sau.' });
        send(socket, '', 0x8); socket.end(); return;
      }
      if (socket.destroyed || !clients.has(socket)) {
        if (room) await room.leave(player);
        return;
      }
      socket.joined = true;
      socket.player = player;
      players.set(player.id, player);
      send(socket, { type: 'welcome', id: player.id });
      send(socket, { type: 'notice', text: `Chào mừng ${player.name} đến Thung Lũng Sao Rơi!` });
      announce({ type: 'notice', text: `${player.name} vừa đến thung lũng.` });
      broadcast(snapshot());
      return;
    }

    const player = socket.player;
    if (!player) return;
    if (message.type === 'move') {
      const now = Date.now();
      if (now - player.lastMoveMessageAt < 40) return;
      player.lastMoveMessageAt = now;
      const map = Object.hasOwn(WORLD, message.map) ? message.map : player.map;
      const [width, height] = WORLD[map];
      const nextX = clamp(message.x, 0, width, player.x);
      const nextY = clamp(message.y, 0, height, player.y);
      const elapsed = Math.max(0, now - player.lastMoveAt);
      // Map transitions may place guests at the matching portal in another region.
      // This bounds same-map teleports; quests/economy remain local browser state.
      const dx = nextX - player.x, dy = nextY - player.y;
      const accepted = map !== player.map || Math.hypot(dx, dy) <= Math.min(220, 22 + elapsed * 0.5);
      if (accepted) {
        player.map = map;
        player.x = nextX;
        player.y = nextY;
      }
      player.lastMoveAt = now;
      player.facingRight = message.facingRight === undefined ? player.facingRight : !!message.facingRight;
      player.moving = !!message.moving;
      const displaced = accepted && Math.hypot(dx, dy) > 1e-9;
      const derivedDirection = displaced
        ? (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
        : (player.facingRight ? 'right' : 'left');
      player.direction = ['up', 'down', 'left', 'right'].includes(message.direction) ? message.direction : derivedDirection;
      player.running = message.running === true && player.moving && displaced;
      dirty.add(player.id);
      return;
    }
    if (message.type === 'chat') {
      const text = cleanText(message.text);
      const now = Date.now();
      if (!text || now - player.lastChatAt < 900) return;
      player.lastChatAt = now;
      announce({ type: 'chat', name: player.name, text, at: now });
    }
  }

  function parseFrames(socket, incoming) {
    const now = Date.now();
    if (now - socket.rateStarted >= 1000) { socket.rateStarted = now; socket.rateFrames = 0; socket.rateBytes = 0; }
    socket.rateBytes += incoming.length;
    if (socket.rateBytes > maxBytesPerSecond) return socket.destroy();
    socket.buffer = Buffer.concat([socket.buffer, incoming]);
    if (socket.buffer.length > MAX_FRAME_BYTES * 2) return socket.destroy();
    while (socket.buffer.length >= 2) {
      const first = socket.buffer[0], second = socket.buffer[1];
      const opcode = first & 0x0f;
      let length = second & 0x7f, offset = 2;
      if ((first & 0x70) !== 0 || !(first & 0x80) || !(second & 0x80) ||
          ![0x1, 0x8, 0x9, 0xA].includes(opcode)) return socket.destroy();
      if (opcode >= 0x8 && length > 125) return socket.destroy();
      if (length === 126) {
        if (socket.buffer.length < 4) return;
        length = socket.buffer.readUInt16BE(2);
        offset = 4;
        if (length < 126) return socket.destroy();
      } else if (length === 127) {
        if (socket.buffer.length < 10) return;
        const largeLength = socket.buffer.readBigUInt64BE(2);
        if (largeLength > BigInt(MAX_FRAME_BYTES) || largeLength <= 0xffffn) return socket.destroy();
        length = Number(largeLength);
        offset = 10;
      }
      if (length > MAX_FRAME_BYTES || (opcode === 0x8 && length === 1)) return socket.destroy();
      if (socket.buffer.length < offset + 4 + length) return;
      if (++socket.rateFrames > maxFramesPerSecond) return socket.destroy();
      const mask = socket.buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(socket.buffer.subarray(offset + 4, offset + 4 + length));
      for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
      socket.buffer = socket.buffer.subarray(offset + 4 + length);
      if (opcode === 0x8) {
        removeClient(socket);
        send(socket, '', 0x8);
        socket.end();
        if (!socket.closingTimer) {
          socket.closingTimer = setTimeout(() => socket.destroy(), 1000);
          socket.closingTimer.unref();
        }
        return;
      }
      if (opcode === 0x9) { send(socket, payload, 0xA); continue; }
      if (opcode === 0xA) { socket.lastPongAt = Date.now(); continue; }
      if (++socket.queuedMessages > 48) return socket.destroy();
      socket.messages = socket.messages.then(() => handleMessage(socket, payload))
        .catch(() => socket.destroy()).finally(() => socket.queuedMessages--);
    }
  }

  server.on('upgrade', async (request, socket, head) => {
    const reject = () => socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    const rawPath = (request.url || '').split('?')[0];
    const key = request.headers['sec-websocket-key'];
    const version = request.headers['sec-websocket-version'];
    const connection = String(request.headers.connection || '').toLowerCase().split(',').map(value => value.trim());
    const ip = resolveIp(request);
    const originMatches = originAllowed(request, origins);
    const upgradeAllowed = upgradeLimit.allow(ip);
    const validKey = typeof key === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(key) && Buffer.from(key, 'base64').length === 16;
    if (request.method !== 'GET' || !['/play', '/api/play'].includes(rawPath) || version !== '13' || !validKey || !originMatches ||
        String(request.headers.upgrade || '').toLowerCase() !== 'websocket' || !connection.includes('upgrade') ||
        shutdownPromise || !upgradeAllowed || (ipConnections.get(ip) || 0) >= maxConnectionsPerIp || transports.size >= maxClients * 2) {
      reject();
      return;
    }
    if (room) {
      socket.pause();
      try { if (!await room.admit(ip)) { reject(); return; } }
      catch (_) { reject(); return; }
      if (socket.destroyed || shutdownPromise || (ipConnections.get(ip) || 0) >= maxConnectionsPerIp || transports.size >= maxClients * 2) { reject(); return; }
    }
    const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setNoDelay(true);
    socket.buffer = Buffer.alloc(0);
    socket.joined = false;
    socket.clientIp = ip; socket.messages = Promise.resolve(); socket.queuedMessages = 0;
    socket.rateStarted = Date.now(); socket.rateFrames = 0; socket.rateBytes = 0;
    socket.connectedAt = socket.lastPongAt = Date.now();
    clients.add(socket);
    transports.add(socket);
    ipConnections.set(ip, (ipConnections.get(ip) || 0) + 1);
    socket.on('data', data => parseFrames(socket, data));
    socket.on('error', () => removeClient(socket));
    socket.on('end', () => { removeClient(socket); socket.end(); });
    socket.on('close', () => { clearTimeout(socket.closingTimer); transports.delete(socket); removeClient(socket); const count = (ipConnections.get(ip) || 1) - 1; if (count) ipConnections.set(ip, count); else ipConnections.delete(ip); });
    if (head.length) parseFrames(socket, head);
    socket.resume();
  });

  const snapshotTimer = setInterval(() => { if (players.size) broadcast(snapshot()); }, snapshotInterval);
  const heartbeatTimer = setInterval(() => {
    const now = Date.now();
    upgradeLimit.prune(now); httpLimit.prune(now);
    for (const socket of clients) {
      if (now - socket.lastPongAt > idleTimeout || (!socket.joined && now - socket.connectedAt > joinTimeout)) socket.destroy();
      else send(socket, '', 0x9);
    }
  }, heartbeatInterval);
  snapshotTimer.unref();
  heartbeatTimer.unref();
  let flushing = false, lastRefresh = 0;
  const sharedTimer = room ? setInterval(async () => {
    if (flushing || !players.size) return;
    const now = Date.now(), refresh = now - lastRefresh >= 10000;
    const updates = [...players.values()].filter(player => refresh || dirty.has(player.id)).map(player => ({ ...player }));
    if (!updates.length) return;
    for (const player of updates) dirty.delete(player.id);
    flushing = true;
    try { await trackRoom(room.update(updates)); if (refresh) lastRefresh = now; }
    catch (_) { failOnline(); }
    finally { flushing = false; }
  }, options.sharedInterval ?? 500) : null;
  sharedTimer?.unref();

  server.shutdown = () => {
    if (shutdownPromise) return shutdownPromise;
    clearInterval(snapshotTimer);
    clearInterval(heartbeatTimer);
    clearInterval(sharedTimer);
    shutdownPromise = new Promise(resolve => {
      const inFlightMessages = [...transports].map(socket => socket.messages);
      const deadline = setTimeout(() => {
        for (const socket of transports) socket.destroy();
        server.closeAllConnections();
      }, 500);
      deadline.unref();
      for (const socket of transports) { send(socket, '', 0x8); socket.end(); }
      server.close(async () => {
        clearTimeout(deadline);
        if (room) {
          await Promise.allSettled(inFlightMessages);
          await Promise.allSettled([...pendingRoom]);
          room.off('message', broadcast); room.off('unavailable', failOnline);
          await room.close();
        }
        resolve();
      });
    });
    return shutdownPromise;
  };
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 4173;
  const host = process.env.HOST || '0.0.0.0';
  const server = createGameServer(environmentOptions());
  server.listen(port, host, () => {
    console.log(`Thung Lũng Sao Rơi đang chạy tại http://localhost:${port}`);
    console.log(`Cùng mạng: http://<IP-máy-chủ>:${port}. Dừng máy chủ bằng Ctrl+C.`);
  });
  server.on('error', error => { console.error(`Không mở được máy chủ: ${error.message}`); process.exitCode = 1; });
  const shutdown = () => server.shutdown().then(() => { process.exitCode = 0; });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

module.exports = { createGameServer, WORLD };
