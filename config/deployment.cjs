'use strict';

const CLIENT_FILES = Object.freeze([
  'index.html', 'css/styles.css', 'js/client-config.js', 'privacy.html',
  'awakening.html', 'css/awakening.css', 'js/data/awakening-data.js', 'js/ui/awakening.js',
  'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png', 'recovery/forest-checkpoint.json', 'recovery/cave-checkpoint.json',
  'js/data/game-data.js', 'js/data/adventure-data.js', 'js/data/combat-data.js', 'js/data/exploration-data.js',
  'js/core/game-core.js', 'js/core/adventure-core.js', 'js/core/combat-core.js', 'js/core/exploration-core.js', 'js/core/npc-ai.js',
  'js/world/world-paths.js', 'js/world/world-effects.js', 'js/world/world-actors.js', 'js/world/exploration-scene.js', 'js/world/lighting.js', 'js/world/combat-renderer.js',
  'js/ui/minimap.js', 'js/ui/install-gate.js', 'js/ui/onboarding.js', 'js/ui/save-transfer.js', 'js/ui/title-screen.js', 'js/ui/hud-dialogs.js', 'js/ui/input-controls.js',
  'js/game.js'
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

function coopEndpoint(value = '') {
  if (!value) return '';
  const url = new URL(value), local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('COOP_SERVER_URL phải là origin HTTPS, không chứa token hoặc đường dẫn.');
  return url.origin;
}
function securityHeaders(endpoint = '', coop = '') {
  let connect = endpoint ? ` 'self' ${new URL(onlineEndpoint(endpoint)).origin}` : " 'self'";
  if (coop) { const origin = coopEndpoint(coop); connect += ` ${origin} ${origin.replace(/^http/, 'ws')}`; }
  // Auth PKCE chỉ truy cập tenant Supabase qua HTTPS; server luôn xác minh access token.
  connect += ' https://*.supabase.co';
  return {
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; manifest-src 'self'; connect-src" + connect + "; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self)'
  };
}

module.exports = { CLIENT_FILES, onlineEndpoint, coopEndpoint, securityHeaders };
