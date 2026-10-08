import { isIP } from 'node:net';
import serverModule from '../server/index.js';
import roomModule from '../server/redis-room.cjs';
import policy from '../server/policy.cjs';

const configured = policy.parseOrigins(process.env.ALLOWED_ORIGINS);
for (const host of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL]) {
  if (host && /^[a-zA-Z0-9.-]+\.vercel\.app$/.test(host)) configured.push(`https://${host}`);
}
if (!configured.length) throw new Error('Thiếu origin triển khai.');
const room = roomModule.createRedisRoom({
  url: process.env.REDIS_URL,
  salt: process.env.ONLINE_IP_SALT,
  namespace: process.env.VERCEL_ENV === 'production' ? 'starfall:production:v1' : `starfall:preview:${process.env.VERCEL_URL.replaceAll('.', '_')}`,
  maxClients: 60, maxPerIp: 8
});

export default serverModule.createGameServer({
  room, backendOnly: true, allowedOrigins: configured,
  // Vercel overwrites this header at the edge. Never use it on a local server.
  resolveIp(request) {
    const ip = request.headers['x-vercel-forwarded-for'];
    return process.env.VERCEL === '1' && typeof ip === 'string' && isIP(ip) ? ip : request.socket.remoteAddress || 'unknown';
  }
});
