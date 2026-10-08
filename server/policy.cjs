'use strict';

const { isIP, BlockList } = require('node:net');

function positiveInteger(value, fallback, max = 10000) {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new Error('Giới hạn server phải là số nguyên dương trong phạm vi cho phép.');
  return number;
}

function parseOrigins(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(',')).map(entry => {
    entry = entry.trim();
    const url = new URL(entry);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
      throw new Error('ALLOWED_ORIGINS phải chứa origin chính xác, không dùng wildcard.');
    }
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Origin công khai phải dùng HTTPS.');
    }
    return url.origin;
  });
}

function originAllowed(request, origins, allowLocalWithoutOrigin = true) {
  const raw = request.headers.origin;
  const remote = request.socket.remoteAddress || '';
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
  if (!raw) return origins.length === 0 && allowLocalWithoutOrigin && local;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || raw !== url.origin) return false;
    if (origins.length) return origins.includes(url.origin);
    return local && url.host === request.headers.host;
  } catch (_) { return false; }
}

function createIpResolver(trustedProxyIps = '') {
  const proxies = new BlockList();
  for (const entry of trustedProxyIps.split(',').map(value => value.trim()).filter(Boolean)) {
    const [address, prefix] = entry.split('/');
    const family = isIP(address);
    if (!family) throw new Error('TRUSTED_PROXY_IPS chứa địa chỉ không hợp lệ.');
    if (prefix === undefined) proxies.addAddress(address, family === 4 ? 'ipv4' : 'ipv6');
    else {
      const bits = Number(prefix);
      if (!Number.isInteger(bits) || bits < 0 || bits > (family === 4 ? 32 : 128)) throw new Error('CIDR proxy không hợp lệ.');
      proxies.addSubnet(address, bits, family === 4 ? 'ipv4' : 'ipv6');
    }
  }
  return request => {
    const remote = String(request.socket.remoteAddress || '').replace(/^::ffff:/, '');
    const family = isIP(remote);
    // Chỉ proxy do operator chỉ định mới được cung cấp X-Real-IP đã ghi đè.
    const forwarded = request.headers['x-real-ip'];
    if (family && proxies.check(remote, family === 4 ? 'ipv4' : 'ipv6') && typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
    return remote;
  };
}

function createRateLimiter({ limit, windowMs, maxKeys = 4096 }) {
  const entries = new Map();
  return {
    allow(key, now = Date.now()) {
      let entry = entries.get(key);
      if (!entry || now - entry.started >= windowMs) {
        if (!entry && entries.size >= maxKeys) {
          for (const [id, old] of entries) if (now - old.started >= windowMs) entries.delete(id);
          if (entries.size >= maxKeys) return false;
        }
        entry = { started: now, count: 0 };
        entries.set(key, entry);
      }
      return ++entry.count <= limit;
    },
    prune(now = Date.now()) { for (const [key, entry] of entries) if (now - entry.started >= windowMs) entries.delete(key); },
    get size() { return entries.size; }
  };
}

function environmentOptions(env = process.env) {
  const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS);
  if (env.NODE_ENV === 'production' && !allowedOrigins.length) throw new Error('Production yêu cầu ALLOWED_ORIGINS trước khi nhận khách online.');
  return {
    allowedOrigins,
    maxClients: positiveInteger(env.MAX_CLIENTS, 60, 200),
    maxConnectionsPerIp: positiveInteger(env.MAX_CONNECTIONS_PER_IP, 8, 200),
    trustedProxyIps: env.TRUSTED_PROXY_IPS || ''
  };
}

module.exports = { positiveInteger, parseOrigins, originAllowed, createIpResolver, createRateLimiter, environmentOptions };
