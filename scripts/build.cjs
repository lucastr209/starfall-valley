'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CLIENT_FILES, onlineEndpoint, securityHeaders } = require('../config/deployment.cjs');
const ROOT = path.resolve(__dirname, '..');

function build({ root = ROOT, outputRoot = root, endpoint = process.env.ONLINE_WS_URL || '', requireOnline = false } = {}) {
  endpoint = onlineEndpoint(endpoint);
  if (requireOnline && !endpoint) throw new Error('Chưa cấu hình ONLINE_WS_URL cho server online.');
  const out = path.resolve(outputRoot, 'dist');
  if (path.dirname(out) !== path.resolve(outputRoot) || path.basename(out) !== 'dist' ||
      (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink())) throw new Error('Thư mục build không an toàn.');
  // Chỉ làm sạch thư mục đầu ra đã xác minh, không sao chép cả repository.
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const file of CLIENT_FILES) {
    fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
    if (file === 'js/client-config.js') {
      fs.writeFileSync(path.join(out, file), "'use strict';\nglobalThis.STARDROP_CONFIG = Object.freeze(" + JSON.stringify({ onlineUrl: endpoint }) + ');\n');
    } else {
      fs.copyFileSync(path.join(root, 'public', file), path.join(out, file));
    }
  }
  const config = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    headers: [{ source: '/(.*)', headers: Object.entries({ ...securityHeaders(endpoint), 'Cache-Control': 'no-cache' }).map(([key, value]) => ({ key, value })) }]
  };
  fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify(config, null, 2) + '\n');
  return out;
}

if (require.main === module) {
  try { console.log(`Đã tạo bản client an toàn: ${build({ requireOnline: process.argv.includes('--require-online') })}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build };
