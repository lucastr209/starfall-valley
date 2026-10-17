/* Deterministic pixel scenery. Rendering never changes gameplay or save data. */
(function (root) {
  'use strict';
  const MAPS = ['village', 'forest', 'coast', 'ruins'];
  const WIDTH = 1600, HEIGHT = 1100;
  const POND = Object.freeze({ left: 1120, right: 1472, top: 626, bottom: 891 });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const wrap = (value, size) => ((value % size) + size) % size;
  function randomFor(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  }
  const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
  function timeValue(time) { return Number.isFinite(time) ? wrap(time, 3600) : 0; }
  function isWater(x, y, margin = 0) {
    return x > POND.left - margin && x < POND.right + margin && y > POND.top - margin && y < POND.bottom + margin;
  }

  function createScene(map, options = {}) {
    if (!MAPS.includes(map)) throw new RangeError('Unknown scenery region: ' + map);
    const random = randomFor(9127 + MAPS.indexOf(map) * 251), flora = [], water = [], butterflies = [], fireflies = [], leaves = [], birds = [];
    const trees = (options.trees || []).filter(validPoint);
    const objects = (options.objects || []).filter(validPoint);
    const buildings = (options.buildings || []).filter(b => validPoint(b) && Number.isFinite(b.w) && Number.isFinite(b.h));
    const isPath = typeof options.isPath === 'function' ? options.isPath : () => false;
    function freeGround(x, y) {
      if (isWater(x, y, 22) || isPath(x, y, 15)) return false;
      if (trees.some(t => Math.hypot(x - t.x, y - t.y) < 24)) return false;
      if (objects.some(o => Math.hypot(x - o.x, y - o.y) < (o.kind === 'plot' ? 45 : 30))) return false;
      return !buildings.some(b => Math.abs(x - b.x) < b.w / 2 + 25 && y > b.y - b.h - 12 && y < b.y + 32);
    }
    // Rejection is bounded, including the case where the entire map is a road.
    for (let attempt = 0; flora.length < 64 && attempt < 640; attempt++) {
      const x = Math.floor((45 + random() * 1510) / 2) * 2, y = Math.floor((70 + random() * 965) / 2) * 2;
      if (!freeGround(x, y)) continue;
      flora.push({ x, y, phase: random() * Math.PI * 2, height: 7 + Math.floor(random() * 7), flower: flora.length % 4 === 0, tone: flora.length % 3 });
    }
    for (let i = 0; i < 14; i++) water.push({ x: 1150 + random() * 275, y: 656 + random() * 201, phase: random() * Math.PI * 2, width: 12 + random() * 13 });
    const anchors = flora.length ? flora : [{ x: 470, y: 470 }, { x: 960, y: 770 }];
    if (map === 'village' || map === 'forest') {
      for (let i = 0; i < 5; i++) {
        const anchor = anchors[Math.floor(random() * anchors.length)];
        butterflies.push({ x: anchor.x, y: anchor.y - 18, phase: random() * Math.PI * 2, tone: i % 3 });
      }
      for (let i = 0; i < 8; i++) {
        const anchor = anchors[Math.floor(random() * anchors.length)];
        fireflies.push({ x: anchor.x, y: anchor.y - 12, phase: random() * Math.PI * 2 });
      }
    }
    if (map === 'forest') for (let i = 0; i < 10; i++) {
      const anchor = trees.length ? trees[Math.floor(random() * trees.length)] : anchors[i % anchors.length];
      leaves.push({ x: anchor.x, y: Math.max(45, anchor.y - 60), phase: random(), tone: i % 3 });
    }
    if (map === 'coast') for (let i = 0; i < 3; i++) birds.push({ x: 940 + i * 190, y: 380 + i * 61, phase: i * 2.1 });
    const chimneys = map === 'village' ? buildings.filter(b => ['home', 'workshop', 'kitchen'].includes(b.kind)).slice(0, 3).map(b => ({ x: b.x + b.w / 2 - 29, y: b.y - b.h - 5, upgrade: b.upgrade || null })) : [];
    const camp = objects.find(o => o.kind === 'camp');
    const shrine = objects.find(o => o.kind === 'shrine');
    return {
      map, flora, water, butterflies, fireflies, leaves, birds, chimneys,
      camp: camp ? { x: camp.x, y: camp.y + 1 } : null,
      shrine: shrine ? { x: shrine.x, y: shrine.y } : null
    };
  }

  function sampleAmbient(scene, time, options = {}) {
    const t = timeValue(time), still = !!options.reducedMotion, motionTime = still ? 0 : t;
    const night = !!options.night, rain = !!options.rain, ground = [], air = [], names = new Set();
    for (const plant of scene.flora) {
      const sway = still ? 0 : Math.sin(t * (rain ? 2.4 : 1.65) + plant.phase) * (rain ? 3 : 2);
      ground.push({ type: plant.flower ? 'flower' : 'grass', x: plant.x, y: plant.y, height: plant.height, sway, tone: plant.tone });
    }
    if (scene.flora.length) names.add(still ? 'garden-detail' : 'grass-and-flower-sway');
    for (const water of scene.water) {
      ground.push({
        type: 'ripple',
        x: water.x + Math.sin(motionTime * .85 + water.phase) * (still ? 0 : 6),
        y: water.y,
        width: water.width + Math.sin(motionTime * 1.6 + water.phase) * (still ? 0 : 5),
        alpha: .24 + (still ? .1 : (Math.sin(t * 1.6 + water.phase) + 1) * .16),
        rain: rain,
        ringRadius: rain ? (still ? 7 : 3 + wrap(motionTime * 1.8 + water.phase, 1) * 15) : 0,
        ringAlpha: rain ? (still ? .35 : (1 - wrap(motionTime * 1.8 + water.phase, 1)) * .55) : 0
      });
    }
    names.add(still ? 'water-detail' : 'water-ripples');
    if (scene.map === 'coast') {
      for (let i = 0; i < 4; i++) {
        const phase = still ? i / 4 : wrap(motionTime * .13 + i / 4, 1);
        ground.push({ type: 'surf', x: POND.left + 8 + phase * 16, y: 668 + i * 54, width: 15 + phase * 8, alpha: .18 + Math.sin(phase * Math.PI) * .24 });
      }
      names.add(still ? 'shore-detail' : 'shore-waves');
    }
    if (!still) {
      if (!night && !rain) for (const b of scene.butterflies) {
        air.push({ type: 'butterfly', x: clamp(b.x + Math.sin(t * .73 + b.phase) * 40, 30, WIDTH - 30), y: clamp(b.y + Math.cos(t * 1.13 + b.phase) * 17, 30, HEIGHT - 30), wing: 1 + Math.abs(Math.sin(t * 12 + b.phase)) * 5, tone: b.tone });
      }
      if (night) for (const f of scene.fireflies.slice(0, rain ? 4 : 8)) {
        air.push({ type: 'firefly', x: clamp(f.x + Math.sin(t * .51 + f.phase) * 28, 25, WIDTH - 25), y: clamp(f.y + Math.cos(t * .83 + f.phase) * 14, 30, HEIGHT - 25), alpha: .35 + (Math.sin(t * 2 + f.phase) + 1) * .3 });
      }
      for (const leaf of scene.leaves) {
        const life = wrap(t * (rain ? .15 : .09) + leaf.phase, 1);
        air.push({ type: 'leaf', x: clamp(leaf.x + life * 92 + Math.sin(t * 2 + leaf.phase) * 14, 25, WIDTH - 25), y: clamp(leaf.y + life * 80, 25, HEIGHT - 25), tilt: Math.sin(t * 5 + leaf.phase), alpha: Math.sin(life * Math.PI) * .8, tone: leaf.tone });
      }
      if (!night && !rain) for (const bird of scene.birds) {
        air.push({ type: 'gull', x: 890 + wrap(bird.x - 890 + t * 32, 620), y: bird.y + Math.sin(t * .8 + bird.phase) * 19, wing: Math.sin(t * 5 + bird.phase) * 5 });
      }
      const activeChimneys = scene.chimneys.filter(c => !c.upgrade || (options.upgrades || []).includes(c.upgrade));
      // Eight puffs total, even when every workshop and kitchen is complete.
      for (let i = 0; i < 8 && activeChimneys.length; i++) {
        const chimney = activeChimneys[i % activeChimneys.length], life = wrap(t * .15 + i / 8, 1);
        air.push({ type: 'smoke', x: clamp(chimney.x + life * (rain ? 34 : 15) + Math.sin(t + i) * 3, 20, WIDTH - 20), y: clamp(chimney.y - life * 46, 20, HEIGHT - 20), size: 4 + life * 8, alpha: (1 - life) * (rain ? .23 : .34) });
      }
      if (scene.camp) for (let i = 0; i < 5; i++) {
        const life = wrap(t * .45 + i / 5, 1);
        air.push({ type: 'ember', x: scene.camp.x + Math.sin(t * 2.3 + i) * (3 + life * 12), y: scene.camp.y - life * 50, alpha: (1 - life) * .9 });
      }
      if (scene.map === 'ruins') for (let i = 0; i < (rain ? 4 : 8); i++) {
        const x = 580 + (i * 79) % 420, y = 220 + (i * 61) % 250;
        air.push({ type: 'mote', x: x + Math.sin(t * .65 + i) * 18, y: y + Math.sin(t * 1.1 + i) * 12, alpha: .25 + (Math.sin(t * 1.8 + i) + 1) * .23 });
      }
    }
    if (scene.shrine && options.shrineActive) {
      for (let i = 0; i < 2; i++) {
        const phase = still ? i * .5 : wrap(motionTime * .2 + i * .5, 1);
        ground.push({ type: 'rune-ring', x: scene.shrine.x, y: scene.shrine.y + 5, radius: 32 + phase * 24, alpha: still ? .35 : (1 - phase) * .5 });
      }
      names.add(still ? 'shrine-rune' : 'shrine-resonance');
    }
    const airNames = { butterfly: 'butterfly-flight', firefly: 'firefly-glow', leaf: 'falling-leaves', gull: 'gull-flight', smoke: 'chimney-smoke', ember: 'camp-embers', mote: 'ruins-motes' };
    for (const effect of air) names.add(airNames[effect.type]);
    return { ground, air, effectNames: [...names] };
  }

  function visible(effect, viewport) {
    return !viewport || (effect.x > viewport.x - 100 && effect.x < viewport.x + viewport.width + 100 && effect.y > viewport.y - 100 && effect.y < viewport.y + viewport.height + 100);
  }
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
  function drawGround(ctx, scene, time, options = {}) {
    ctx.save();
    const colors = scene.map === 'coast' ? ['#648c70', '#769f76', '#b1be87'] : scene.map === 'ruins' ? ['#73847e', '#8b9d83', '#b2bb93'] : ['#59815b', '#719755', '#a4b56b'];
    for (const e of sampleAmbient(scene, time, options).ground) {
      if (!visible(e, options.viewport)) continue;
      ctx.globalAlpha = 1;
      if (e.type === 'grass' || e.type === 'flower') {
        rect(ctx, e.x - 4, e.y, 10, 2, '#34544825');
        rect(ctx, e.x - 1, e.y - e.height / 2, 2, e.height / 2 + 1, colors[0]);
        rect(ctx, e.x - 1 + e.sway / 2, e.y - e.height, 2, e.height / 2 + 2, colors[1]);
        rect(ctx, e.x - 6 + e.sway, e.y - 7, 4, 3, colors[1]);
        rect(ctx, e.x + 2 + e.sway, e.y - 10, 4, 3, colors[2]);
        if (e.type === 'flower') {
          const headX = e.x + e.sway, headY = e.y - e.height;
          rect(ctx, headX - 4, headY - 2, 9, 3, ['#ecc09b', '#f2d38d', '#c7bfd8'][e.tone]);
          rect(ctx, headX - 1, headY - 5, 3, 9, ['#f4d8b6', '#f9e5a7', '#ded3eb'][e.tone]);
          rect(ctx, headX - 1, headY - 2, 3, 3, '#d09c65');
        }
      } else if (e.type === 'ripple') {
        if (!e.rain) {
          ctx.globalAlpha = e.alpha;
          rect(ctx, e.x - e.width / 2, e.y, e.width, 2, '#d4ead6');
          rect(ctx, e.x - e.width / 2 + 4, e.y + 4, Math.max(3, e.width - 9), 1, '#a8d4cc');
        } else {
          const r = Math.max(1, Math.round(e.ringRadius));
          const ry = Math.max(1, Math.round(r * 0.45));
          ctx.globalAlpha = Math.max(0, Math.min(1, e.ringAlpha));
          // Outer concentric ring
          rect(ctx, e.x - r, e.y, r * 2, 1, '#d8f0ed');
          rect(ctx, e.x - Math.max(1, Math.round(r * 0.7)), e.y - ry, Math.max(2, Math.round(r * 1.4)), 1, '#c2e7e2');
          rect(ctx, e.x - Math.max(1, Math.round(r * 0.7)), e.y + ry, Math.max(2, Math.round(r * 1.4)), 1, '#c2e7e2');
          // Inner concentric ring
          if (r > 5) {
            const r2 = Math.max(1, Math.round(r * 0.5));
            const ry2 = Math.max(1, Math.round(r2 * 0.45));
            rect(ctx, e.x - r2, e.y, r2 * 2, 1, '#eaf7f5');
            rect(ctx, e.x - Math.max(1, Math.round(r2 * 0.6)), e.y - ry2, Math.max(1, Math.round(r2 * 1.2)), 1, '#d4f2ec');
            rect(ctx, e.x - Math.max(1, Math.round(r2 * 0.6)), e.y + ry2, Math.max(1, Math.round(r2 * 1.2)), 1, '#d4f2ec');
          }
        }
      } else if (e.type === 'surf') {
        ctx.globalAlpha = e.alpha;
        rect(ctx, e.x, e.y, e.width, 2, '#f0ead2');
        rect(ctx, e.x - 2, e.y + 5, e.width - 3, 2, '#d7e9d4');
        rect(ctx, e.x + 4, e.y - 4, e.width - 5, 1, '#ecf0d9');
      } else if (e.type === 'rune-ring') {
        ctx.globalAlpha = e.alpha;
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8;
          rect(ctx, e.x + Math.cos(a) * e.radius - 2, e.y + Math.sin(a) * e.radius * .35 - 1, 4, 2, '#beddd1');
        }
      }
    }
    ctx.restore();
  }
  function drawAir(ctx, scene, time, options = {}) {
    ctx.save();
    for (const e of sampleAmbient(scene, time, options).air) {
      if (!visible(e, options.viewport)) continue;
      ctx.globalAlpha = e.alpha === undefined ? 1 : e.alpha;
      if (e.type === 'butterfly') {
        const color = ['#f5d09c', '#ddadc2', '#b5d4d7'][e.tone];
        rect(ctx, e.x - e.wing - 1, e.y - 3, e.wing, 5, color);
        rect(ctx, e.x + 1, e.y - 3, e.wing, 5, color);
        rect(ctx, e.x - 1, e.y - 3, 2, 6, '#7e695d');
        rect(ctx, e.x - 4, e.y + 1, 2, 2, '#fff1cf');
      } else if (e.type === 'firefly') {
        ctx.globalAlpha = e.alpha * .19; rect(ctx, e.x - 4, e.y - 4, 10, 10, '#dbecaa');
        ctx.globalAlpha = e.alpha * .4; rect(ctx, e.x - 2, e.y - 2, 6, 6, '#e9f5b9');
        ctx.globalAlpha = e.alpha; rect(ctx, e.x, e.y, 2, 2, '#fff6c6');
      } else if (e.type === 'leaf') {
        rect(ctx, e.x, e.y, e.tilt > 0 ? 6 : 3, e.tilt > 0 ? 3 : 6, ['#c8b772', '#8cab73', '#d2a06c'][e.tone]);
        rect(ctx, e.x + 1, e.y + 1, 2, 2, '#e0cb8c');
      } else if (e.type === 'gull') {
        rect(ctx, e.x - 1, e.y, 3, 3, '#f6f1da');
        rect(ctx, e.x - 7, e.y - e.wing, 6, 2, '#f6f1da');
        rect(ctx, e.x + 2, e.y - e.wing, 6, 2, '#f6f1da');
        rect(ctx, e.x + 5, e.y - e.wing + 2, 3, 1, '#6d8989');
      } else if (e.type === 'smoke') {
        rect(ctx, e.x - e.size / 2, e.y - e.size / 2, e.size, e.size, '#d9d6c0');
        rect(ctx, e.x - e.size / 2 + 2, e.y - e.size / 2 - 2, Math.max(2, e.size - 4), e.size + 4, '#e6decc');
      } else if (e.type === 'ember') {
        rect(ctx, e.x, e.y, 2, 3, '#ffd28d');
      } else if (e.type === 'mote') {
        rect(ctx, e.x - 1, e.y, 5, 2, '#d7dbd0');
        rect(ctx, e.x + 1, e.y - 2, 1, 6, '#e8e4bc');
      }
    }
    ctx.restore();
  }
  // --- Feature 9: Dual-Layer Rainfall System ---
  function drawRain(ctx, width, height, time, options = {}) {
    const still = !!options.reducedMotion;
    const rainTime = still ? 0 : timeValue(time);
    const night = !!options.night;

    ctx.save();

    // Layer 1: Background Soft Rain Layer (Preserves exact test compatibility with #d8e6eb80)
    ctx.strokeStyle = '#d8e6eb80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const bgCount = still ? 40 : 120;
    for (let i = 0; i < bgCount; i++) {
      const x = (i * 73 + rainTime * 140) % (width + 50) - 25;
      const y = (i * 97 + rainTime * 330) % (height + 50) - 25;
      ctx.moveTo(Math.round(x), Math.round(y));
      ctx.lineTo(Math.round(x - 6), Math.round(y + 12));
    }
    ctx.stroke();

    // Layer 2: Foreground High-Contrast Rain Layer (Bright on dark night skies)
    ctx.strokeStyle = night ? '#f0f9ffcc' : '#ffffffb8';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    const fgCount = still ? 24 : 64;
    for (let i = 0; i < fgCount; i++) {
      const x = (i * 109 + rainTime * 190 + 37) % (width + 60) - 30;
      const y = (i * 131 + rainTime * 440 + 51) % (height + 60) - 30;
      ctx.moveTo(Math.round(x), Math.round(y));
      ctx.lineTo(Math.round(x - 8), Math.round(y + 20));
    }
    ctx.stroke();

    ctx.restore();
  }

  // --- Feature 10 Part A: Splash Pool System <= 32 ---
  function createSplashPool(capacity = 32) {
    const cap = Math.min(32, Math.max(1, capacity));
    const pool = [];
    for (let i = 0; i < cap; i++) {
      pool.push({ active: false, x: 0, y: 0, age: 0, life: 0.16, map: '' });
    }
    return { pool, capacity: cap, head: 0 };
  }

  function spawnSplash(system, x, y, map) {
    const s = system.pool[system.head];
    system.head = (system.head + 1) % system.capacity;
    s.active = true;
    s.x = Math.round(x);
    s.y = Math.round(y);
    s.age = 0;
    s.life = 0.16;
    s.map = map;
  }

  function updateSplashPool(system, dt, options = {}) {
    if (options.reducedMotion) return;
    for (let i = 0; i < system.capacity; i++) {
      const s = system.pool[i];
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.life) s.active = false;
    }
  }

  function drawSplashPool(ctx, system, options = {}) {
    ctx.save();
    const vp = options.viewport;
    for (let i = 0; i < system.capacity; i++) {
      const s = system.pool[i];
      if (!s.active) continue;
      if (vp && (s.x < vp.x - 20 || s.x > vp.x + vp.width + 20 || s.y < vp.y - 20 || s.y > vp.y + vp.height + 20)) continue;
      const progress = Math.min(1, s.age / s.life);
      const alpha = (1 - progress) * 0.85;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      const spread = Math.round(progress * 4);
      const lift = Math.round(Math.sin(progress * Math.PI) * 3);
      rect(ctx, s.x, s.y - lift, 2, 2, '#edf8fc');
      rect(ctx, s.x - spread - 1, s.y - lift + 1, 1, 1, '#c5e6f5');
      rect(ctx, s.x + spread + 2, s.y - lift + 1, 1, 1, '#c5e6f5');
    }
    ctx.restore();
  }

  // --- Feature 11: Ground Puddles & Wet Sheen ---
  const PUDDLE_PRESETS = Object.freeze({
    village: [
      { x: 800, y: 560, w: 42, h: 22 },
      { x: 770, y: 830, w: 36, h: 18 },
      { x: 460, y: 560, w: 32, h: 16 },
      { x: 1080, y: 560, w: 38, h: 20 },
      { x: 800, y: 380, w: 30, h: 16 },
      { x: 350, y: 780, w: 34, h: 18 }
    ],
    forest: [
      { x: 800, y: 550, w: 38, h: 20 },
      { x: 420, y: 550, w: 32, h: 16 },
      { x: 1180, y: 550, w: 34, h: 18 },
      { x: 800, y: 820, w: 36, h: 18 }
    ],
    coast: [
      { x: 800, y: 550, w: 36, h: 18 },
      { x: 520, y: 550, w: 32, h: 16 },
      { x: 800, y: 780, w: 40, h: 20 }
    ],
    ruins: [
      { x: 800, y: 550, w: 38, h: 20 },
      { x: 620, y: 380, w: 32, h: 16 },
      { x: 980, y: 720, w: 34, h: 18 }
    ]
  });

  function drawPuddles(ctx, map, time, options = {}) {
    const list = PUDDLE_PRESETS[map];
    if (!list || !list.length) return;
    const still = !!options.reducedMotion;
    const t = timeValue(time);
    const night = !!options.night;
    const vp = options.viewport;
    const lights = options.lights || [];

    ctx.save();
    for (const p of list) {
      if (vp && (p.x + p.w / 2 < vp.x || p.x - p.w / 2 > vp.x + vp.width || p.y + p.h / 2 < vp.y || p.y - p.h / 2 > vp.y + vp.height)) continue;

      // 1. Outer wet soil border
      ctx.globalAlpha = 0.35;
      rect(ctx, p.x - p.w / 2 - 2, p.y - p.h / 2 - 1, p.w + 4, p.h + 2, '#2e3d38');

      // 2. Water puddle surface
      ctx.globalAlpha = night ? 0.65 : 0.5;
      rect(ctx, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, night ? '#1d2d3d' : '#466980');
      ctx.globalAlpha = night ? 0.45 : 0.35;
      rect(ctx, p.x - p.w / 2 + 4, p.y - p.h / 2 + 3, p.w - 8, p.h - 6, night ? '#2b455c' : '#628fa8');

      // 3. Dynamic Lantern Reflection
      if (lights.length) {
        for (const l of lights) {
          const dx = l.x - p.x, dy = l.y - p.y, dist = Math.hypot(dx, dy);
          if (dist < l.r * 1.1) {
            const reflectAlpha = (1 - dist / (l.r * 1.1)) * (night ? 0.5 : 0.3);
            ctx.globalAlpha = Math.max(0, Math.min(1, reflectAlpha));
            const normX = dist > 0.001 ? dx / dist : 0;
            const normY = dist > 0.001 ? dy / dist : 0;
            const rx = p.x + Math.round(normX * Math.min(p.w / 4, 8));
            const ry = p.y + Math.round(normY * Math.min(p.h / 4, 4));
            rect(ctx, rx - 4, ry - 2, 8, 4, '#f8d581');
            rect(ctx, rx - 2, ry - 1, 4, 2, '#fff1b4');
          }
        }
      }

      // 4. Specular water glint shimmer
      const shimmer = still ? 0.7 : Math.sin(t * 2 + p.x);
      if (shimmer > 0.5) {
        ctx.globalAlpha = night ? 0.4 : 0.5;
        rect(ctx, p.x - 3, p.y - 1, 6, 2, night ? '#a5cfdf' : '#dff3fa');
      }
    }
    ctx.restore();
  }

  const api = {
    createScene, sampleAmbient, drawGround, drawAir,
    effectNames: (scene, options = {}) => sampleAmbient(scene, 0, options).effectNames,
    isWater, drawRain, createSplashPool, spawnSplash, updateSplashPool, drawSplashPool,
    drawPuddles, PUDDLE_PRESETS
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StardropEffects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
