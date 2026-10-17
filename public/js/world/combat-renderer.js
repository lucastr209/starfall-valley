(function (root, factory) {
  'use strict';
  const CombatData = typeof module === 'object' && module.exports
    ? (() => { try { return require('../data/combat-data.js'); } catch (_) { return require('../combat-data.js'); } })()
    : root.StardropCombatData;
  const api = factory(CombatData);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropCombatRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CombatData) {
  'use strict';

  const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.floor(x), Math.floor(y), w, h); };
  const pixelEllipse = (c, x, y, w, h, color) => {
    rect(c, x - w / 2 + 4, y - h / 2, w - 8, h, color);
    rect(c, x - w / 2, y - h / 2 + 2, w, h - 4, color);
  };
  const label = (c, text, x, y, size = 12, color = '#fff8de') => {
    c.font = `bold ${size}px 'Segoe UI',sans-serif`;
    c.textAlign = 'center';
    const fx = Math.floor(x), fy = Math.floor(y);
    c.fillStyle = '#101a1e';
    c.fillText(text, fx + 1, fy + 1);
    c.fillText(text, fx - 1, fy);
    c.fillText(text, fx + 1, fy);
    c.fillText(text, fx, fy - 1);
    c.fillText(text, fx, fy + 1);
    c.fillStyle = color;
    c.fillText(text, fx, fy);
  };

  function drawCombatWarnings(ctx, mobs) {
    if (!mobs) return;
    for (const mob of mobs) {
      const c = mob.combat;
      if (mob.hp <= 0 || !c || !['windup', 'active'].includes(c.stage)) continue;
      const def = (CombatData && CombatData.enemies) ? CombatData.enemies[mob.kind || 'slime'] : { range: 60 };
      const angle = c.stage === 'active' && Number.isFinite(c.vx) && Number.isFinite(c.vy)
        ? Math.atan2(c.vy, c.vx)
        : Math.atan2(c.aimY - mob.y, c.aimX - mob.x);
      const color = c.stage === 'windup' ? '#ffd16b' : '#eb8d78';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.32;
      if (['charge', 'projectile'].includes(c.style)) {
        const length = c.style === 'charge' ? def.range : Math.min(def.range, 300);
        ctx.lineWidth = c.style === 'charge' ? 40 : 18;
        ctx.beginPath();
        ctx.moveTo(mob.x, mob.y);
        ctx.lineTo(mob.x + Math.cos(angle) * length, mob.y + Math.sin(angle) * length);
        ctx.stroke();
      } else {
        const arc = (def.arc || 140) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(mob.x, mob.y);
        ctx.arc(mob.x, mob.y, def.range, angle - arc / 2, angle + arc / 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.stroke();
      }
      ctx.restore();
      if (c.stage === 'windup') label(ctx, '!', mob.x, mob.y - 45, 18, color);
    }
  }

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

  return {
    drawStandardMob,
    drawBossMob,
    drawCombatWarnings,
    rect,
    pixelEllipse,
    label
  };
});
