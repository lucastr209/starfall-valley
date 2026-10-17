(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropLighting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.floor(x), Math.floor(y), w, h); };

  const pixelEllipse = (c, x, y, w, h, color) => {
    rect(c, x - w / 2 + 4, y - h / 2, w - 8, h, color);
    rect(c, x - w / 2, y - h / 2 + 2, w, h - 4, color);
  };

  const drawDropShadow = (c, x, y, w, h, options = {}) => {
    const { blur = 0, color = '#344c5538', shape = 'ellipse' } = options;
    if (blur <= 0) {
      if (shape === 'ellipse') pixelEllipse(c, x, y, w, h, color);
      else rect(c, x - w / 2, y - h / 2, w, h, color);
      return;
    }
    const layers = Math.min(3, Math.max(2, Math.floor(blur)));
    for (let l = layers; l >= 0; l--) {
      const spread = l * 3, lw = w + spread * 2, lh = h + spread * 1.5;
      const alpha = Math.max(0.04, 0.22 / (l + 1));
      const col = `rgba(52, 76, 85, ${alpha.toFixed(3)})`;
      if (shape === 'ellipse') pixelEllipse(c, x, y, lw, lh, col);
      else rect(c, x - lw / 2, y - lh / 2, lw, lh, col);
    }
  };

  const organicFlicker = (t, phase = 0, reducedMotion = false) => {
    if (reducedMotion) return 0;
    return Math.sin(t * 5.03 + phase) * 0.48 +
           Math.sin(t * 15.10 + phase * 1.7) * 0.28 +
           Math.sin(t * 35.80 + phase * 3.1) * 0.16 +
           Math.sin(t * 76.70 + phase * 5.3) * 0.08;
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

  function collectLightSources(env) {
    const { state, lamps, extraLamps, buildings, camp, world, animation, reducedMotion, resourceReady } = env;
    const sources = [{ x: state.x, y: state.y - 20, r: state.inventory.lantern ? 170 : 62, power: state.inventory.lantern ? 0.97 : 0.38 }];
    if (state.map === 'village') {
      [...lamps, ...(state.upgrades.includes('lamps') ? extraLamps : [])].forEach(l => sources.push({ x: l.x, y: l.y - 62, r: 140, power: 0.96 }));
      buildings.forEach(b => { if (!b.upgrade || state.upgrades.includes(b.upgrade)) sources.push({ x: b.x, y: b.y - 36, r: 95, power: 0.65 }); });
      const cFlicker = organicFlicker(animation, 0.4, reducedMotion);
      sources.push({ x: camp.x, y: camp.y + 4, r: 110 + (reducedMotion ? 0 : Math.round(cFlicker * 6)), power: Number((0.8 + (reducedMotion ? 0 : cFlicker * 0.07)).toFixed(3)) });
      if (state.upgrades.includes('beacon')) sources.push({ x: 800, y: 310, r: 340, power: 1 });
    } else {
      (world[state.map]?.objects || []).filter(o => o.kind === 'shrine' && state.shrines.includes(state.map)).forEach(o => sources.push({ x: o.x, y: o.y - 40, r: 160, power: 0.8 }));
    }
    (world[state.map]?.objects || []).filter(o => o.item === 'star' && (!resourceReady || resourceReady(o))).forEach(o => sources.push({ x: o.x, y: o.y - 12, r: 38, power: 0.3 }));
    return sources;
  }

  function drawWindowLightCasting(c, cam, env) {
    const { state, buildings, world, viewWidth, viewHeight } = env;
    const bList = state.map === 'village' ? buildings : (world[state.map]?.buildings || []);
    for (const b of bList) {
      const active = !b.upgrade || state.upgrades.includes(b.upgrade);
      if (!active) continue;
      if (b.x + b.w / 2 < cam.x - 40 || b.x - b.w / 2 > cam.x + viewWidth + 40 ||
          b.y < cam.y - 40 || b.y - b.h > cam.y + viewHeight + 40) continue;

      const left = b.x - b.w / 2, groundY = b.y - cam.y;
      const castDist = 34;

      if (b.kind === 'greenhouse') {
        const x0 = left + 14 - cam.x, x1 = left + b.w - 14 - cam.x;
        c.fillStyle = 'rgba(200, 240, 190, 0.16)';
        c.beginPath();
        c.moveTo(x0, groundY); c.lineTo(x1, groundY);
        c.lineTo(x1 + 10, groundY + 28); c.lineTo(x0 - 10, groundY + 28);
        c.closePath(); c.fill();
        continue;
      }
      if (b.kind === 'market') continue;

      const winOffsets = [left + 17, left + b.w - 47];
      for (const wx of winOffsets) {
        const cx = wx + 13 - cam.x;
        c.fillStyle = 'rgba(255, 176, 58, 0.18)';
        c.beginPath();
        c.moveTo(cx - 11, groundY); c.lineTo(cx - 2, groundY);
        c.lineTo(cx - 4, groundY + castDist); c.lineTo(cx - 21, groundY + castDist);
        c.closePath(); c.fill();
        c.beginPath();
        c.moveTo(cx + 2, groundY); c.lineTo(cx + 11, groundY);
        c.lineTo(cx + 21, groundY + castDist); c.lineTo(cx + 4, groundY + castDist);
        c.closePath(); c.fill();

        c.fillStyle = 'rgba(255, 215, 95, 0.25)';
        c.beginPath();
        c.moveTo(cx - 9, groundY); c.lineTo(cx + 9, groundY);
        c.lineTo(cx + 13, groundY + 18); c.lineTo(cx - 13, groundY + 18);
        c.closePath(); c.fill();

        for (let dx = -18; dx <= 18; dx += 4) {
          rect(c, cx + dx, groundY + castDist - 1, 2, 2, 'rgba(255, 176, 58, 0.12)');
        }
      }

      const dx = b.x - cam.x;
      c.fillStyle = 'rgba(255, 190, 70, 0.20)';
      c.beginPath();
      c.moveTo(dx - 10, groundY); c.lineTo(dx + 10, groundY);
      c.lineTo(dx + 14, groundY + 16); c.lineTo(dx - 14, groundY + 16);
      c.closePath(); c.fill();
    }
  }

  function drawLighting(env) {
    const { ctx, darkCanvas, dc, state, camera, viewWidth, viewHeight, C, lightSources } = env;
    const night = C.isNight(state), rain = C.weather(state) === 'rain';
    let dusk = 0;
    if (state.minutes >= 1020 && state.minutes < 1140) dusk = (state.minutes - 1020) / 120 * 0.36;
    else if (state.minutes >= 360 && state.minutes < 420) dusk = (420 - state.minutes) / 60 * 0.3;
    const darkness = Math.min(0.64, (night ? 0.53 : dusk) + (rain ? 0.13 : 0));
    dc.clearRect(0, 0, viewWidth, viewHeight);
    dc.globalCompositeOperation = 'source-over';
    dc.fillStyle = `rgba(25,35,61,${darkness})`;
    dc.fillRect(0, 0, viewWidth, viewHeight);
    const lights = lightSources();
    dc.globalCompositeOperation = 'destination-out';
    lights.forEach(l => {
      const x = l.x - camera.x, y = l.y - camera.y;
      const gradient = dc.createRadialGradient(x, y, 4, x, y, l.r);
      gradient.addColorStop(0, `rgba(0,0,0,${l.power})`);
      gradient.addColorStop(0.2, `rgba(0,0,0,${(l.power * 0.95).toFixed(3)})`);
      gradient.addColorStop(0.5, `rgba(0,0,0,${(l.power * 0.65).toFixed(3)})`);
      gradient.addColorStop(0.8, `rgba(0,0,0,${(l.power * 0.25).toFixed(3)})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = gradient;
      dc.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    });
    dc.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkCanvas, 0, 0);
    if (darkness > 0.05) {
      ctx.globalCompositeOperation = 'screen';
      drawWindowLightCasting(ctx, camera, env);
      lights.filter(l => l.power > 0.6).forEach(l => {
        const x = l.x - camera.x, y = l.y - camera.y;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, l.r * 0.65);
        glow.addColorStop(0, 'rgba(255,176,58,0.36)');
        glow.addColorStop(0.25, 'rgba(255,136,0,0.22)');
        glow.addColorStop(0.65, 'rgba(215,95,12,0.08)');
        glow.addColorStop(1, 'rgba(215,95,12,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
        if (l.r >= 110) {
          for (let i = 0; i < 12; i++) {
            const angle = i * Math.PI / 6, dist = l.r * (0.52 + 0.1 * (((i * 7) % 5) / 5));
            rect(ctx, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 2, 2, 'rgba(255,176,58,0.14)');
          }
        }
      });
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function computeActorLabels(env) {
    const { state, peers, currentResidents, npcMarker, actorMetrics, interior } = env;
    const placed = [];
    const actors = [
      { id: 'player', name: state.name, x: state.x, y: state.y, color: '#fff4d7', marker: '' },
      ...[...peers.values()].filter(p => !interior && p.map === state.map).map(p => ({ ...p, color: '#bce9e1', marker: '' })),
      ...currentResidents().slice().sort((a, b) => a.y - b.y || a.id.localeCompare(b.id)).map(n => ({ ...n, color: '#fff8de', marker: npcMarker(n) }))
    ];
    const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 4 && a.top < b.bottom + 4 && a.bottom > b.top - 4;
    actors.forEach(a => {
      const baseY = a.y - actorMetrics.nameOffset, width = Math.max(36, String(a.name).length * 7 + 12), height = a.marker ? 34 : 14;
      let tag = { id: a.id, name: a.name, x: a.x, y: baseY, baseY, width, top: baseY - height, bottom: baseY + 3, marker: a.marker, color: a.color, anchorX: a.x };
      let found = false;
      for (const shift of [0, -96, 96, -192, 192]) {
        for (let row = 0; row < 24; row++) {
          const y = baseY - row * 16, candidate = { ...tag, x: a.x + shift, y, top: y - height, bottom: y + 3 };
          const coversBody = actors.some(other => other.id !== a.id && overlaps(candidate, { x: other.x, width: actorMetrics.bodyWidth, top: other.y - actorMetrics.bodyHeight, bottom: other.y + 4 }));
          if (!coversBody && !placed.some(p => overlaps(candidate, p))) { tag = candidate; found = true; break; }
        }
        if (found) break;
      }
      placed.push(tag);
    });
    return placed;
  }

  function drawActorLabels(ctx, env) {
    ctx.save();
    computeActorLabels(env).forEach(t => {
      if (t.y !== t.baseY || t.x !== t.anchorX) {
        ctx.strokeStyle = '#f5edc488'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(t.x, t.y + 5); ctx.lineTo(t.anchorX, t.baseY + 8); ctx.stroke();
      }
      const textLen = String(t.name).length;
      const pillW = Math.max(34, textLen * 7.5 + 10);
      const pillH = 15;
      const pillX = Math.round(t.x - pillW / 2);
      const pillY = Math.round(t.y - 12);
      ctx.fillStyle = 'rgba(16, 24, 30, 0.78)';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(70, 95, 105, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillRect(pillX, pillY, pillW, pillH);
      }
      if (t.marker) {
        const my = t.y - 20, badgeR = 10;
        const isClaim = t.marker === '✓', isNew = t.marker === '?';
        const badgeColor = isClaim ? 'rgba(18, 52, 32, 0.88)' : (isNew ? 'rgba(56, 42, 10, 0.88)' : 'rgba(24, 42, 54, 0.88)');
        const rimColor = isClaim ? 'rgba(110, 231, 183, 0.6)' : (isNew ? 'rgba(250, 204, 21, 0.6)' : 'rgba(125, 211, 252, 0.6)');
        ctx.beginPath();
        ctx.arc(t.x, my, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = badgeColor;
        ctx.fill();
        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      label(ctx, t.name, t.x, t.y, t.id === 'player' ? 11 : 12, t.color);
      if (t.marker) label(ctx, t.marker, t.x, t.y - 19, 18, t.marker === '✓' ? '#86efac' : '#ffd166');
    });
    ctx.restore();
  }

  return {
    rect,
    pixelEllipse,
    drawDropShadow,
    organicFlicker,
    label,
    collectLightSources,
    drawWindowLightCasting,
    drawLighting,
    computeActorLabels,
    drawActorLabels
  };
});
