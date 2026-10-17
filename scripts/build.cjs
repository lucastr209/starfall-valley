'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { CLIENT_FILES, onlineEndpoint, securityHeaders } = require('../config/deployment.cjs');
const ROOT = path.resolve(__dirname, '..');

// Chỉ đổi URL CSS/JS trong allowlist; giữ đường dẫn, query khác và fragment của trang.
function versionAssets(markup, buildId) {
  return markup.replace(/\b(src|href)=(["'])([^"']+)\2/g, (match, attribute, quote, url) => {
    const asset = url.match(/^((?:\.\/|\/)?((?:js|css)\/[^?#]+))(\?[^#]*)?(#.*)?$/);
    if (!asset || !CLIENT_FILES.includes(asset[2]) || !/\.(?:js|css)$/.test(asset[2])) return match;
    const query = new URLSearchParams((asset[3] || '').slice(1).replaceAll('&amp;', '&'));
    query.set('v', buildId);
    return `${attribute}=${quote}${asset[1]}?${query}${asset[4] || ''}${quote}`;
  });
}

// Tạo một bản client đồng nhất từ nguồn công khai đã chụp, không đọc cấu hình bí mật.
function build({ root = ROOT, outputRoot = root, endpoint = process.env.ONLINE_WS_URL || '', requireOnline = false } = {}) {
  endpoint = onlineEndpoint(endpoint);
  if (requireOnline && !endpoint) throw new Error('Chưa cấu hình ONLINE_WS_URL cho server online.');
  const sources = new Map(), hash = createHash('sha256');
  hash.update(JSON.stringify({ onlineUrl: endpoint }));
  // Kèm tên và độ dài để phân biệt ranh giới asset; config sinh từ endpoint không tự hash lại.
  for (const file of CLIENT_FILES) {
    if (file === 'js/client-config.js') continue;
    const bytes = fs.readFileSync(path.join(root, 'public', file));
    sources.set(file, bytes);
    hash.update(JSON.stringify([file, bytes.length]));
    hash.update(bytes);
  }
  const buildId = hash.digest('hex').slice(0, 12);
  const out = path.resolve(outputRoot, 'dist');
  if (path.dirname(out) !== path.resolve(outputRoot) || path.basename(out) !== 'dist' ||
      (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink())) throw new Error('Thư mục build không an toàn.');
  // Chỉ làm sạch thư mục đầu ra đã xác minh, không sao chép cả repository.
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const file of CLIENT_FILES) {
    fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
    if (file === 'js/client-config.js') {
      fs.writeFileSync(path.join(out, file), "'use strict';\nglobalThis.STARDROP_CONFIG = Object.freeze(" + JSON.stringify({ onlineUrl: endpoint, buildId }) + ');\n');
    } else {
      const bytes = sources.get(file);
      fs.writeFileSync(path.join(out, file), file === 'index.html' ? versionAssets(bytes.toString('utf8'), buildId) : bytes);
    }
  }
  const config = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    headers: [{ source: '/(.*)', headers: Object.entries({ ...securityHeaders(endpoint), 'Cache-Control': 'no-cache' }).map(([key, value]) => ({ key, value })) },{source:'/recovery/forest-checkpoint.json',headers:[{key:'Content-Disposition',value:'attachment; filename="starfall-valley-forest-recovery.json"'}]},{source:'/recovery/cave-checkpoint.json',headers:[{key:'Content-Disposition',value:'attachment; filename="starfall-valley-cave-checkpoint.json"'}]}]
  };
  fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify(config, null, 2) + '\n');
  return out;
}

if (require.main === module) {
  try { console.log(`Đã tạo bản client an toàn: ${build({ requireOnline: process.argv.includes('--require-online') })}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build };
