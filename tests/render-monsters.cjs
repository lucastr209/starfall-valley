'use strict';
// Reproducible visual fixture for Monsters & Bosses in Thung Lũng Sao Rơi.
// Uses zero external dependencies: pure Node.js Buffer, zlib, and math.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const CombatData = require('../public/js/combat-data.js');

const width = 960, height = 750;
const pixels = Buffer.alloc(width * height * 4);
const shapes = [], stack = [];

const ctx = {
  fillStyle: '#f5eedb', globalAlpha: 1, matrix: [1, 0, 0, 1, 0, 0],
  save() { stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, matrix: this.matrix.slice() }); },
  restore() { Object.assign(this, stack.pop()); },
  translate(x, y) { const m = this.matrix; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
  scale(x, y) { const m = this.matrix; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
  fillRect(x, y, w, h) {
    const m = this.matrix, ax = m[0] * x + m[4], ay = m[3] * y + m[5], bw = m[0] * w, bh = m[3] * h;
    const left = Math.floor(Math.min(ax, ax + bw)), top = Math.floor(Math.min(ay, ay + bh)),
          right = Math.ceil(Math.max(ax, ax + bw)), bottom = Math.ceil(Math.max(ay, ay + bh));
    const hex = this.fillStyle.slice(1);
    const color = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const alpha = (hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1) * this.globalAlpha;
    shapes.push(`<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`);
    for (let py = Math.max(0, top); py < Math.min(height, bottom); py++) {
      for (let px = Math.max(0, left); px < Math.min(width, right); px++) {
        const index = (py * width + px) * 4;
        for (let channel = 0; channel < 3; channel++) {
          pixels[index + channel] = Math.round(color[channel] * alpha + pixels[index + channel] * (1 - alpha));
        }
        pixels[index + 3] = 255;
      }
    }
  }
};

const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.floor(x), Math.floor(y), w, h); };
const pixelEllipse = (c, x, y, w, h, color) => { rect(c, x - w / 2 + 4, y - h / 2, w - 8, h, color); rect(c, x - w / 2, y - h / 2 + 3, w, h - 6, color); };

const text = [];
const caption = (label, x, y, size = 12) => text.push(`<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" text-anchor="middle" fill="#344449">${label}</text>`);
const label = (c, str, x, y, size = 12, color = '#fff8de') => {
  caption(str, Math.floor(x), Math.floor(y), size);
};

// Shipped game.js drawing routines:
function drawStandardMob(c, m, def, x, y, animation, reducedMotion) {
  pixelEllipse(c, x + 3, m.y + 4, 38, 10, '#344c5540');
  rect(c, x - 19, y - 18, 38, 16, def.color);
  rect(c, x - 14, y - 28, 28, 18, def.color);
  rect(c, x - 9, y - 30, 18, 6, '#d4d5ab');

  if (m.kind === 'sprout') {
    rect(c, x - 16, y - 6, 32, 4, '#8e6393');
    rect(c, x - 11, y - 27, 22, 3, '#d8addd');
    const footWaddle = reducedMotion ? 0 : Math.round(Math.sin(animation * 7 + m.phase) * 2);
    rect(c, x - 12 + footWaddle, y - 2, 6, 4, '#5e4635');
    rect(c, x + 6 - footWaddle, y - 2, 6, 4, '#5e4635');
    const leafSway = reducedMotion ? 0 : Math.round(Math.sin(animation * 4 + m.phase) * 2);
    rect(c, x - 3, y - 48, 6, 22, '#4e7a4b');
    rect(c, x - 15 + leafSway, y - 44, 12, 6, '#76ad72');
    rect(c, x - 12 + leafSway, y - 46, 6, 3, '#9dd199');
    rect(c, x + 3 - leafSway, y - 44, 12, 6, '#76ad72');
    rect(c, x + 6 - leafSway, y - 46, 6, 3, '#9dd199');
    rect(c, x - 6, y - 52, 12, 6, '#e2a6d4');
    rect(c, x - 3, y - 50, 6, 3, '#fbe089');
    rect(c, x - 10, y - 16, 4, 4, '#3d1a3c'); rect(c, x - 9, y - 16, 1, 1, '#fbe089');
    rect(c, x + 6, y - 16, 4, 4, '#3d1a3c'); rect(c, x + 7, y - 16, 1, 1, '#fbe089');
    rect(c, x - 2, y - 9, 4, 2, '#3d1a3c');
  } else if (m.kind === 'warden') {
    rect(c, x - 17, y - 6, 34, 4, '#4e3c27');
    rect(c, x - 23, y - 44, 12, 34, '#6b5336'); rect(c, x - 21, y - 42, 8, 30, '#a68c65');
    rect(c, x + 11, y - 44, 12, 34, '#6b5336'); rect(c, x + 13, y - 42, 8, 30, '#a68c65');
    rect(c, x - 26, y - 54, 4, 12, '#6b5336'); rect(c, x - 30, y - 58, 6, 4, '#8a6e4d');
    rect(c, x + 22, y - 54, 4, 12, '#6b5336'); rect(c, x + 24, y - 58, 6, 4, '#8a6e4d');
    rect(c, x - 22, y - 34, 10, 5, '#48683f'); rect(c, x - 20, y - 32, 6, 4, '#6e9663');
    rect(c, x + 12, y - 34, 10, 5, '#48683f'); rect(c, x + 14, y - 32, 6, 4, '#6e9663');
    rect(c, x - 10, y - 28, 20, 4, '#6e9663');
    const eyeGlow = reducedMotion ? '#74dfaa' : (Math.sin(animation * 6) > 0 ? '#b5f5d3' : '#74dfaa');
    rect(c, x - 4, y - 18, 8, 5, '#2d4229'); rect(c, x - 3, y - 17, 6, 3, eyeGlow);
  } else {
    rect(c, x - 17, y - 6, 34, 4, '#6a9867');
    rect(c, x - 12, y - 29, 24, 3, '#b5deb2');
    rect(c, x - 16, y - 19, 4, 15, '#b5deb2');
    rect(c, x - 10, y - 25, 3, 2, '#ffffff');
    rect(c, x + 7, y - 23, 2, 2, '#ffffff');
    const coreY = y - 16 + (reducedMotion ? 0 : Math.round(Math.sin(animation * 4 + m.phase) * 1.5));
    rect(c, x - 2, coreY - 2, 4, 4, '#fef08a');
    rect(c, x - 1, coreY - 1, 2, 2, '#fffbeb');
    rect(c, x - 12, y - 14, 4, 4, '#33595b'); rect(c, x - 11, y - 14, 1, 1, '#ffffff');
    rect(c, x + 7, y - 14, 4, 4, '#33595b'); rect(c, x + 8, y - 14, 1, 1, '#ffffff');
    rect(c, x - 3, y - 7, 8, 3, '#dce5b6');
  }

  rect(c, x - 17, y + 6, 34, 4, '#426c5b');
  rect(c, x - 17, y + 6, Math.max(0, m.hp) / def.maxHp * 34, 4, '#e8c16b');
}

function drawBossMob(c, m, def, x, y, animation, reducedMotion) {
  pixelEllipse(c, x, y, 88, 24, '#344c5540');
  const bossKind = m.kind || 'rootBoss';
  const vulnerable = m.combat?.style === 'vulnerable';

  if (bossKind === 'forestBoss') {
    rect(c, x - 32, y - 68, 64, 65, '#353c36');
    rect(c, x - 28, y - 64, 56, 58, '#525c53');
    rect(c, x - 46, y - 52, 18, 50, '#353c36');
    rect(c, x - 42, y - 48, 12, 42, '#525c53');
    rect(c, x + 28, y - 52, 18, 50, '#353c36');
    rect(c, x + 30, y - 48, 12, 42, '#525c53');
    rect(c, x - 36, y - 72, 72, 10, '#506846');
    rect(c, x - 32, y - 70, 64, 6, '#79946c');
    rect(c, x - 20, y - 84, 40, 26, '#525c53');
    rect(c, x - 22, y - 86, 44, 6, '#79946c');
    rect(c, x - 32, y - 96, 10, 32, '#506846');
    rect(c, x + 22, y - 96, 10, 32, '#506846');
    rect(c, x - 14, y - 74, 6, 5, '#6ee7b7');
    rect(c, x + 8, y - 74, 6, 5, '#6ee7b7');
    if (vulnerable) {
      rect(c, x - 12, y - 48, 24, 26, '#353c36');
      rect(c, x - 8, y - 44, 16, 20, '#6ee7b7');
      rect(c, x - 4, y - 40, 8, 12, '#c5f0b1');
    } else {
      rect(c, x - 9, y - 45, 18, 23, '#506846');
      rect(c, x - 5, y - 41, 10, 15, '#79946c');
    }
  } else if (bossKind === 'tideBoss') {
    rect(c, x - 30, y - 68, 60, 65, '#3e636b');
    rect(c, x - 26, y - 64, 52, 58, '#6e9ca4');
    rect(c, x - 44, y - 52, 18, 50, '#3e636b');
    rect(c, x - 40, y - 48, 12, 42, '#6e9ca4');
    rect(c, x + 26, y - 52, 18, 50, '#3e636b');
    rect(c, x + 28, y - 48, 12, 42, '#6e9ca4');
    rect(c, x - 46, y - 44, 4, 8, '#e07a7a');
    rect(c, x + 42, y - 44, 4, 8, '#e07a7a');
    rect(c, x - 22, y - 84, 44, 28, '#4d757d');
    rect(c, x - 34, y - 98, 10, 32, '#e07a7a'); rect(c, x - 32, y - 104, 6, 8, '#f2a4a4');
    rect(c, x + 24, y - 98, 10, 32, '#e07a7a'); rect(c, x + 26, y - 104, 6, 8, '#f2a4a4');
    rect(c, x - 4, y - 102, 8, 24, '#f2a4a4');
    rect(c, x - 13, y - 73, 6, 5, '#a5f3fc');
    rect(c, x + 7, y - 73, 6, 5, '#a5f3fc');
    if (vulnerable) {
      rect(c, x - 12, y - 48, 24, 26, '#3e636b');
      rect(c, x - 8, y - 44, 16, 20, '#67e8f9');
      rect(c, x - 4, y - 40, 8, 12, '#f0fdfa');
    } else {
      rect(c, x - 9, y - 45, 18, 23, '#4d757d');
      rect(c, x - 5, y - 41, 10, 15, '#6e9ca4');
    }
  } else if (bossKind === 'skyBoss') {
    rect(c, x - 30, y - 68, 60, 65, '#261b30');
    rect(c, x - 26, y - 64, 52, 58, '#433352');
    const shardLev = reducedMotion ? 0 : Math.round(Math.sin(animation * 3 + m.phase) * 3);
    rect(c, x - 46, y - 56 + shardLev, 16, 44, '#433352');
    rect(c, x - 42, y - 52 + shardLev, 10, 36, '#a38cb6');
    rect(c, x + 30, y - 56 - shardLev, 16, 44, '#433352');
    rect(c, x + 32, y - 52 - shardLev, 10, 36, '#a38cb6');
    rect(c, x - 22, y - 86, 44, 30, '#352445');
    rect(c, x - 34, y - 100, 10, 32, '#a38cb6'); rect(c, x - 32, y - 106, 6, 8, '#c084fc');
    rect(c, x + 24, y - 100, 10, 32, '#a38cb6'); rect(c, x + 26, y - 106, 6, 8, '#c084fc');
    rect(c, x - 5, y - 108, 10, 30, '#f3e8ff');
    rect(c, x - 13, y - 74, 6, 5, '#f472b6');
    rect(c, x + 7, y - 74, 6, 5, '#f472b6');
    if (vulnerable) {
      rect(c, x - 12, y - 48, 24, 26, '#261b30');
      rect(c, x - 8, y - 44, 16, 20, '#e879f9');
      rect(c, x - 4, y - 40, 8, 12, '#fdf4ff');
    } else {
      rect(c, x - 9, y - 45, 18, 23, '#433352');
      rect(c, x - 5, y - 41, 10, 15, '#a38cb6');
    }
  } else {
    rect(c, x - 28, y - 68, 56, 65, '#5c402b');
    rect(c, x - 24, y - 64, 48, 58, '#c79068');
    rect(c, x - 40, y - 54, 16, 50, '#5c402b');
    rect(c, x - 38, y - 52, 12, 44, def.color);
    rect(c, x + 24, y - 54, 16, 50, '#5c402b');
    rect(c, x + 26, y - 52, 12, 44, def.color);
    rect(c, x - 20, y - 84, 40, 28, '#4b6e42');
    rect(c, x - 18, y - 82, 36, 24, '#899b65');
    rect(c, x - 36, y - 98, 12, 34, '#8a623f');
    rect(c, x - 42, y - 104, 8, 8, '#fef08a');
    rect(c, x + 24, y - 98, 12, 34, '#8a623f');
    rect(c, x + 34, y - 104, 8, 8, '#fef08a');
    rect(c, x - 12, y - 73, 5, 5, '#74dfaa');
    rect(c, x + 7, y - 73, 5, 5, '#74dfaa');
    if (vulnerable) {
      rect(c, x - 12, y - 48, 24, 26, '#5c402b');
      rect(c, x - 8, y - 44, 16, 20, '#74dfaa');
      rect(c, x - 4, y - 40, 8, 12, '#c5f0b1');
    } else {
      rect(c, x - 9, y - 45, 18, 23, '#edbd72');
      rect(c, x - 6, y - 42, 12, 17, '#c79068');
    }
  }

  label(c, `${def.name} · Pha ${m.combat?.phase || 1}`, x, y - 108, 12);
  rect(c, x - 40, y + 9, 80, 5, '#594d49');
  rect(c, x - 40, y + 9, 80 * m.hp / def.maxHp, 5, '#ddaa71');
}

// Background fill
ctx.fillRect(0, 0, width, height);

// Sheet Title
caption('Thung Lũng Sao Rơi — Quái Vật & Thủ Lĩnh (Creatures & Bosses)', 480, 26, 18);

// Grid configuration: 7 rows
const rows = [
  { kind: 'slime', name: 'Slime (Tinh linh Rì Rào)', states: ['Đứng yên', 'Bật nảy', 'Tiếp đất', 'Tụ lực phóng', 'Bị trúng đòn'] },
  { kind: 'sprout', name: 'Sprout (Mầm gai Sao)', states: ['Đứng yên', 'Lá lay trái', 'Lá lay phải', 'Bước rễ', 'Hoa nở bắn gai'] },
  { kind: 'warden', name: 'Warden (Hộ vệ rễ cây)', states: ['Đứng yên', 'Mắt phát quang', 'Bước cội rễ', 'Quét rìu cành', 'Bị trúng đòn'] },
  { kind: 'rootBoss', name: 'Hộ Vệ Rễ Sao (Root Boss)', states: ['Pha 1 Thường', 'Chóp sao sáng', 'Lộ Lõi Sao (Choáng)', 'Pha 2 Thịnh nộ'] },
  { kind: 'forestBoss', name: 'Hộ Vệ Rêu Cổ (Forest Boss)', states: ['Megalith Thường', 'Rêu rủ vai', 'Nứt Lõi Khối Đá', 'Pha 2 Tấn công'] },
  { kind: 'tideBoss', name: 'Hộ Vệ Sóng Ngầm (Tide Boss)', states: ['Giáp San Hô', 'Chạc Ba Sóng', 'Vòng Xoáy Lộ Diện', 'Pha 2 Cuồng nộ'] },
  { kind: 'skyBoss', name: 'Hộ Vệ Thiên Thạch (Sky Boss)', states: ['Basalt Thiên Hà', 'Mảnh lơ lửng', 'Lõi Tinh Vân Siêu Tân Tinh', 'Pha 2 Bão sao'] }
];

const startY = 75, rowHeight = 92;

rows.forEach((row, rowIndex) => {
  const def = CombatData.enemies[row.kind];
  const y = startY + rowIndex * rowHeight;
  // Label for row
  caption(row.name, 110, y + 25, 12);

  const colWidth = 140, startX = 240;
  row.states.forEach((stateName, colIndex) => {
    const x = startX + colIndex * colWidth;
    ctx.fillStyle = (rowIndex + colIndex) % 2 ? '#ede3cb' : '#f9f3e5';
    ctx.fillRect(x - 55, y - 48, 110, 84);

    const isBoss = !!def.boss;
    const anim = colIndex * 1.5;
    const mob = {
      x, y: y + (isBoss ? 20 : 16),
      phase: colIndex * 0.8,
      hp: colIndex === 2 && isBoss ? Math.floor(def.maxHp * 0.4) : def.maxHp,
      kind: row.kind,
      hitTime: colIndex === 4 ? 0.2 : 0,
      combat: {
        stage: colIndex === 3 ? 'windup' : 'idle',
        style: colIndex === 2 && isBoss ? 'vulnerable' : 'normal',
        phase: colIndex >= 3 && isBoss ? 2 : 1
      }
    };

    if (isBoss) {
      drawBossMob(ctx, mob, def, x, mob.y, anim, false);
    } else {
      drawStandardMob(ctx, mob, def, x, mob.y, anim, false);
      if (mob.hitTime > 0) {
        ctx.save(); ctx.globalAlpha = 0.55;
        rect(ctx, x - 14, mob.y - 26, 28, 22, '#fff0c5');
        ctx.restore();
      }
    }

    caption(stateName, x, y + 44, 10);
  });
});

// PNG Encoding
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, bytes) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([size, name, bytes, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;

const scanlines = Buffer.alloc(height * (width * 4 + 1));
for (let r = 0; r < height; r++) {
  pixels.copy(scanlines, r * (width * 4 + 1) + 1, r * width * 4, (r + 1) * width * 4);
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(scanlines)),
  chunk('IEND', Buffer.alloc(0))
]);

const output = path.join(__dirname, '../test-artifacts');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'monsters-sprite-sheet.png'), png);
fs.writeFileSync(
  path.join(output, 'monsters-sprite-sheet.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${shapes.join('')}${text.join('')}</svg>`
);

console.log(`Rendered 3 monsters and 4 bosses across states (${width}×${height}) to monsters-sprite-sheet.png/.svg.`);
