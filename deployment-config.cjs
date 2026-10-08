'use strict';

const CLIENT_FILES = Object.freeze([
  'index.html', 'styles.css', 'client-config.js', 'privacy.html',
  'game-data.js', 'game-core.js', 'npc-ai.js', 'world-paths.js',
  'world-effects.js', 'world-actors.js', 'minimap.js', 'onboarding.js', 'game.js'
]);

function onlineEndpoint(value = '') {
  if (!value) return '';
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'wss:' && !(local && url.protocol === 'ws:')) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('ONLINE_WS_URL phải là địa chỉ WSS, không chứa thông tin đăng nhập, query hoặc fragment.');
  }
  return url.href;
}

function securityHeaders(endpoint = '') {
  const connect = endpoint ? ` 'self' ${new URL(onlineEndpoint(endpoint)).origin}` : " 'self'";
  return {
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src" + connect + "; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self)'
  };
}

module.exports = { CLIENT_FILES, onlineEndpoint, securityHeaders };
