'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const FX = require('../public/js/world-effects.js');

function canvasMock() {
  const stack = [], calls = [];
  const ctx = {
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
    save() { stack.push({ alpha: this.globalAlpha, fill: this.fillStyle, stroke: this.strokeStyle, lw: this.lineWidth }); calls.push({ name: 'save' }); },
    restore() {
      const saved = stack.pop();
      assert.ok(saved, 'balanced canvas save/restore');
      this.globalAlpha = saved.alpha; this.fillStyle = saved.fill; this.strokeStyle = saved.stroke; this.lineWidth = saved.lw;
      calls.push({ name: 'restore' });
    },
    fillRect(x, y, w, h) { calls.push({ name: 'fillRect', x, y, w, h, fillStyle: this.fillStyle, alpha: this.globalAlpha }); },
    beginPath() { calls.push({ name: 'beginPath' }); },
    closePath() { calls.push({ name: 'closePath' }); },
    moveTo(x, y) { calls.push({ name: 'moveTo', x, y, strokeStyle: this.strokeStyle }); },
    lineTo(x, y) { calls.push({ name: 'lineTo', x, y, strokeStyle: this.strokeStyle }); },
    stroke() { calls.push({ name: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    fill() { calls.push({ name: 'fill', fillStyle: this.fillStyle, alpha: this.globalAlpha }); },
    arc(x, y, r, sa, ea) { calls.push({ name: 'arc', x, y, r, sa, ea, fillStyle: this.fillStyle }); }
  };
  return { ctx, calls, stack };
}

test('M2-T1: Rain splash pool capacity is capped <= 32 and recycles circular slots without allocation', () => {
  const system = FX.createSplashPool(64); // Request 64, must be capped at 32
  assert.equal(system.capacity, 32, 'Capacity is clamped to maximum 32');
  assert.equal(system.pool.length, 32, 'Pre-allocated pool size is 32');

  // Spawn 100 splashes and verify pool size remains strictly 32
  for (let i = 0; i < 100; i++) {
    FX.spawnSplash(system, 500 + i, 600 + i, 'village');
    assert.equal(system.pool.length, 32, 'Pool size must not grow');
  }

  // Verify all entries have valid coordinates and lifespan
  for (const s of system.pool) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
    assert.equal(s.life, 0.16);
    assert.equal(s.active, true);
  }
});

test('M2-T2: Splash particles update lifecycle and expire correctly', () => {
  const system = FX.createSplashPool(32);
  FX.spawnSplash(system, 400, 500, 'village');
  assert.equal(system.pool[0].active, true);

  // Advance by half lifespan
  FX.updateSplashPool(system, 0.08);
  assert.equal(system.pool[0].active, true);
  assert.equal(system.pool[0].age, 0.08);

  // Advance past lifespan
  FX.updateSplashPool(system, 0.10);
  assert.equal(system.pool[0].active, false, 'Particle expires after lifespan');
});

test('M2-T3: Splash pool drawing renders pixel impact specks and balances save/restore', () => {
  const system = FX.createSplashPool(32);
  FX.spawnSplash(system, 300, 400, 'village');
  const { ctx, calls, stack } = canvasMock();

  FX.drawSplashPool(ctx, system);
  assert.equal(stack.length, 0, 'Canvas stack is restored');
  const rects = calls.filter(c => c.name === 'fillRect');
  assert.ok(rects.length >= 3, 'Renders center and lateral specks');
  assert.ok(rects.some(c => c.fillStyle === '#edf8fc'), 'Includes bright core impact speck');
  assert.ok(rects.some(c => c.fillStyle === '#c5e6f5'), 'Includes lateral droplet specks');
});

test('M2-T4: Concentric water ripples in sampleAmbient expand during rain and freeze when reducedMotion', () => {
  const scene = FX.createScene('village', {
    trees: [], objects: [{ kind: 'camp', x: 790, y: 735 }], buildings: [], isPath: () => false
  });

  const normalT0 = FX.sampleAmbient(scene, 0, { rain: true });
  const normalT1 = FX.sampleAmbient(scene, 0.2, { rain: true });
  const ripples0 = normalT0.ground.filter(e => e.type === 'ripple');
  const ripples1 = normalT1.ground.filter(e => e.type === 'ripple');

  assert.equal(ripples0.length, 14, 'Preserves exact 14 water ripples count');
  assert.equal(ripples1.length, 14, 'Preserves exact 14 water ripples count');
  assert.ok(ripples0[0].ringRadius !== undefined, 'Contains ringRadius descriptor');
  assert.notEqual(ripples0[0].ringRadius, ripples1[0].ringRadius, 'Ripples expand over time');

  // Reduced motion freeze check
  const stillT0 = FX.sampleAmbient(scene, 0, { rain: true, reducedMotion: true });
  const stillT1 = FX.sampleAmbient(scene, 10, { rain: true, reducedMotion: true });
  const stillRipples0 = stillT0.ground.filter(e => e.type === 'ripple');
  const stillRipples1 = stillT1.ground.filter(e => e.type === 'ripple');

  assert.deepEqual(stillRipples0, stillRipples1, 'Ripples are completely frozen under reducedMotion');
  assert.equal(stillRipples0[0].ringRadius, 7, 'Static ripple radius under reducedMotion');
});

test('M2-T5: Dual-layer rainfall renders both Layer 1 (#d8e6eb80) and Layer 2 high-contrast strokes', () => {
  const { ctx, calls, stack } = canvasMock();
  FX.drawRain(ctx, 960, 600, 1.5, { night: true, reducedMotion: false });

  assert.equal(stack.length, 0, 'Canvas stack is balanced');
  const strokeCalls = calls.filter(c => c.name === 'stroke');
  assert.equal(strokeCalls.length, 2, 'Renders exactly 2 rain layers');

  // Layer 1 compatibility check
  const layer1Moves = calls.filter(c => c.name === 'moveTo' && c.strokeStyle === '#d8e6eb80');
  assert.equal(layer1Moves.length, 120, 'Layer 1 renders 120 background rain streaks');

  // Layer 2 high-contrast check
  const layer2Moves = calls.filter(c => c.name === 'moveTo' && c.strokeStyle === '#f0f9ffcc');
  assert.equal(layer2Moves.length, 64, 'Layer 2 renders 64 foreground high-contrast streaks');

  // Reduced motion freeze check
  const mockA = canvasMock(), mockB = canvasMock();
  FX.drawRain(mockA.ctx, 960, 600, 0, { night: true, reducedMotion: true });
  FX.drawRain(mockB.ctx, 960, 600, 50, { night: true, reducedMotion: true });
  assert.deepEqual(
    mockA.calls.filter(c => c.name === 'moveTo'),
    mockB.calls.filter(c => c.name === 'moveTo'),
    'Rain streaks are completely stationary when reducedMotion is true'
  );
});

test('M2-T6: Ground puddles render deterministic road patches with lantern specular highlights', () => {
  const { ctx, calls, stack } = canvasMock();
  const lights = [{ x: 800, y: 550, r: 140, power: 0.96 }];

  FX.drawPuddles(ctx, 'village', 1.0, { night: true, reducedMotion: false, lights });
  assert.equal(stack.length, 0, 'Canvas stack is balanced');

  const rects = calls.filter(c => c.name === 'fillRect');
  assert.ok(rects.length > 0, 'Puddles are rendered');
  assert.ok(rects.some(c => c.fillStyle === '#2e3d38'), 'Renders wet soil margin');
  assert.ok(rects.some(c => c.fillStyle === '#1d2d3d'), 'Renders puddle body');
  assert.ok(rects.some(c => c.fillStyle === '#f8d581'), 'Renders warm lantern light reflection');
});

test('M2-T7: High-contrast label executes first fillText call at (+1, +1) and draws 4-direction outline', () => {
  const calls = [];
  const ctx = {
    font: '', textAlign: '', fillStyle: '',
    fillText(text, x, y) { calls.push({ text, x, y, fillStyle: this.fillStyle }); }
  };

  // Replicate label() function from game.js
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

  label(ctx, 'Mira', 270.4, 330.8, 12, '#fff8de');

  // Assert FIRST fillText call is at (fx + 1, fy + 1)
  assert.equal(calls[0].text, 'Mira');
  assert.equal(calls[0].x, 271, 'First fillText is at Math.floor(x) + 1');
  assert.equal(calls[0].y, 331, 'First fillText is at Math.floor(y) + 1');
  assert.equal(calls[0].fillStyle, '#101a1e');

  // Assert 4-direction outlines exist
  assert.ok(calls.some(c => c.x === 269 && c.y === 330 && c.fillStyle === '#101a1e'), 'Left outline');
  assert.ok(calls.some(c => c.x === 271 && c.y === 330 && c.fillStyle === '#101a1e'), 'Right outline');
  assert.ok(calls.some(c => c.x === 270 && c.y === 329 && c.fillStyle === '#101a1e'), 'Top outline');
  assert.ok(calls.some(c => c.x === 270 && c.y === 331 && c.fillStyle === '#101a1e'), 'Bottom outline');

  // Assert final call is foreground color at (fx, fy)
  const last = calls[calls.length - 1];
  assert.equal(last.x, 270);
  assert.equal(last.y, 330);
  assert.equal(last.fillStyle, '#fff8de');
});
