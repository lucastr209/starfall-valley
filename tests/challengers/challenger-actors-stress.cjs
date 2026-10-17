'use strict';

const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..', fs.existsSync(path.join(__dirname, '..', 'public')) ? '.' : '..');
const Actors = require(path.join(ROOT, 'public/js/world/world-actors.js'));
const data = require(path.join(ROOT, 'public/js/data/game-data.js'));

const ALL_CHARACTERS = ['player', ...data.npcs.map(n => n.id)];
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const SHADOW_COLORS = new Set(['#213c4038', '#213c4024']);

function canvasMock() {
  const calls = [], stack = [];
  const ctx = {
    fillStyle: '#012345',
    globalAlpha: 1.0,
    matrix: [1, 0, 0, 1, 0, 0],
    save() {
      stack.push({
        fillStyle: this.fillStyle,
        globalAlpha: this.globalAlpha,
        matrix: this.matrix.slice()
      });
    },
    restore() {
      const saved = stack.pop();
      assert.ok(saved, 'restore has a matching save');
      Object.assign(this, saved);
    },
    translate(x, y) {
      const m = this.matrix;
      m[4] += m[0] * x + m[2] * y;
      m[5] += m[1] * x + m[3] * y;
    },
    scale(x, y) {
      const m = this.matrix;
      m[0] *= x;
      m[1] *= x;
      m[2] *= y;
      m[3] *= y;
    },
    fillRect(x, y, w, h) {
      const m = this.matrix;
      calls.push({
        x: m[0] * x + m[2] * y + m[4],
        y: m[1] * x + m[3] * y + m[5],
        w: m[0] * w,
        h: m[3] * h,
        color: this.fillStyle,
        alpha: this.globalAlpha
      });
    }
  };
  return { ctx, calls, stack };
}

function trace(options = {}) {
  const canvas = canvasMock();
  Actors.draw(canvas.ctx, { id: 'player', isPlayer: true, ...options });
  return canvas.calls;
}

function normalized(calls) {
  return calls.map(c => ({
    x: Math.min(c.x, c.x + c.w),
    y: Math.min(c.y, c.y + c.h),
    w: Math.abs(c.w),
    h: Math.abs(c.h),
    color: c.color,
    alpha: c.alpha
  }));
}

function pixels(calls, includeShadow = true) {
  const result = new Map();
  for (const c of normalized(calls)) {
    if (!includeShadow && SHADOW_COLORS.has(c.color)) continue;
    for (let y = c.y; y < c.y + c.h; y++) {
      for (let x = c.x; x < c.x + c.w; x++) {
        result.set(`${x},${y}`, { x, y, color: c.color, alpha: c.alpha });
      }
    }
  }
  return [...result.values()];
}

function extents(points) {
  assert.ok(points.length > 0, 'Extents requires non-empty point set');
  return {
    left: Math.min(...points.map(p => p.x)),
    right: Math.max(...points.map(p => p.x)) + 1,
    top: Math.min(...points.map(p => p.y)),
    bottom: Math.max(...points.map(p => p.y)) + 1
  };
}

let passed = 0, failed = 0;

function run(name, fn) {
  process.stdout.write(`CHALLENGE: ${name}... `);
  try {
    const res = fn();
    console.log(`PASSED ${res ? `(${res})` : ''}`);
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error(err);
    failed++;
  }
}

console.log('================================================================');
console.log('  CHALLENGER M3-3 ADVERSARIAL STRESS HARNESS (ACTOR REMEDIATION)');
console.log('================================================================\n');

// 1. STANCE SOLE ANCHOR PINNING UNDER FRACTIONAL COORDINATES & CONTINUOUS PHASES
run('1. Sole anchor strictly pinned to anchorY + 2 across fractional anchors & gait cycles', () => {
  const testAnchors = [
    { x: 100, y: 200 },
    { x: 100.25, y: 200.25 },
    { x: 100.5, y: 200.5 },
    { x: 100.75, y: 200.75 },
    { x: 0, y: 0 },
    { x: -50.4, y: -80.6 }
  ];

  let verifiedCount = 0;
  for (const anchor of testAnchors) {
    const expectedSoleBottom = Math.round(anchor.y) + 2;
    for (const charId of ALL_CHARACTERS) {
      for (const direction of DIRECTIONS) {
        // Sample 25 points along walk & run cycle
        for (let step = 0; step < 25; step++) {
          const distance = step * 3.7;
          for (const running of [false, true]) {
            const calls = trace({
              id: charId,
              isPlayer: charId === 'player',
              x: anchor.x,
              y: anchor.y,
              direction,
              moving: true,
              running,
              distance
            });

            const bodyPixels = pixels(calls, false);
            const feetPixels = bodyPixels.filter(p => p.y >= expectedSoleBottom - 10);
            assert.ok(feetPixels.length > 0, `No feet pixels found near sole bottom`);
            const feetBox = extents(feetPixels);

            assert.equal(
              feetBox.bottom,
              expectedSoleBottom,
              `Sole bottom violated for ${charId} ${direction} at anchor (${anchor.x},${anchor.y}): expected ${expectedSoleBottom}, got ${feetBox.bottom}`
            );
            verifiedCount++;
          }
        }
      }
    }
  }
  return `${verifiedCount} pose permutations verified`;
});

// 2. BOUNDING BOX <= 48x60 IN EXTREME AND EDGE CONDITIONS
run('2. Strict Bounding Box (<= 48x60) with Lantern, High RunWeight, Extreme Lean', () => {
  let checked = 0;
  let maxWidth = 0, maxHeight = 0;

  for (const charId of ALL_CHARACTERS) {
    for (const direction of DIRECTIONS) {
      for (const lantern of [false, true]) {
        for (let dist = 0; dist < 100; dist += 4.5) {
          const calls = trace({
            id: charId,
            isPlayer: charId === 'player',
            x: 50,
            y: 50,
            direction,
            moving: true,
            running: true,
            distance: dist,
            lantern
          });

          const bodyPixels = pixels(calls, false);
          const box = extents(bodyPixels);
          const w = box.right - box.left;
          const h = box.bottom - box.top;

          if (w > maxWidth) maxWidth = w;
          if (h > maxHeight) maxHeight = h;

          assert.ok(w <= 48, `Width ${w} exceeds 48 for ${charId} ${direction} lantern=${lantern} dist=${dist}`);
          assert.ok(h <= 60, `Height ${h} exceeds 60 for ${charId} ${direction} lantern=${lantern} dist=${dist}`);
          checked++;
        }
      }
    }
  }
  return `${checked} configurations checked, max dimensions: ${maxWidth}x${maxHeight}`;
});

// 3. EYE CATCHLIGHT PIXEL INTEGRITY & ZERO LEAKAGE
run('3. Pupil catchlight (#ffffff) renders in front/side, never leaks to back view', () => {
  for (const charId of ALL_CHARACTERS) {
    const isPlayer = charId === 'player';
    // Normal open-eye frame (time = 0)
    const frontCalls = trace({ id: charId, isPlayer, direction: 'down', x: 0, y: 0, time: 0 });
    const frontPixels = pixels(frontCalls, false);
    // 1. Raw eye() draw calls: Every character without exception paints 2 eye glints in front view
    const rawEyeGlints = frontCalls.filter(c =>
      c.color === '#ffffff' &&
      Math.abs(c.w) === 1 && Math.abs(c.h) === 1 &&
      c.y === -34
    );
    assert.equal(rawEyeGlints.length, 2, `Expected exactly 2 raw eye() catchlight calls for ${charId} front view, found ${rawEyeGlints.length}`);

    // 2. Final raster surface: 11 of 12 characters expose specular glints on the face surface;
    // Yen wears scholar spectacles with tinted glass (#dcebf0) layered over her eyes in drawHeadgear().
    const eyeZoneGlints = frontPixels.filter(p => p.y >= -36 && p.y <= -32 && p.color === '#ffffff');
    const eyeZoneWhites = frontPixels.filter(p => p.y >= -36 && p.y <= -32 && p.color === '#fff0ca');
    if (charId !== 'yen') {
      assert.equal(eyeZoneGlints.length, 2, `Expected 2 eye catchlight glints on face for ${charId} front view, found ${eyeZoneGlints.length}`);
      assert.ok(eyeZoneWhites.length >= 8, `Expected >= 8 eye white pixels for ${charId} front view, found ${eyeZoneWhites.length}`);
    } else {
      assert.equal(eyeZoneGlints.length, 0, `Yen scholar spectacles tinted glass correctly overlays eyes`);
    }

    // Natural blink frame calculation: wrap(time + id.length * 0.23, 4.8) > 4.64
    const offset = charId.length * 0.23;
    const blinkTime = (4.70 - (offset % 4.8) + 4.8) % 4.8;
    const blinkCalls = trace({ id: charId, isPlayer, direction: 'down', x: 0, y: 0, time: blinkTime });
    const blinkPixels = pixels(blinkCalls, false);
    // In the facial eye area (y in [-36, -30]), catchlights and eye whites must be 0
    const blinkEyeZoneGlints = blinkPixels.filter(p => p.y >= -36 && p.y <= -30 && p.color === '#ffffff');
    assert.equal(blinkEyeZoneGlints.length, 0, `Eye glints must be 0 during blink for ${charId}`);

    // Side view: exactly 1 catchlight glint in eye zone (raw and surface)
    for (const sideDir of ['left', 'right']) {
      const sideCalls = trace({ id: charId, isPlayer, direction: sideDir, x: 0, y: 0, time: 0 });
      const rawSideGlints = sideCalls.filter(c =>
        c.color === '#ffffff' &&
        Math.abs(c.w) === 1 && Math.abs(c.h) === 1 &&
        c.y === -34
      );
      assert.equal(rawSideGlints.length, 1, `Expected 1 raw side catchlight call for ${charId} ${sideDir}`);

      const sidePixels = pixels(sideCalls, false);
      const sideGlints = sidePixels.filter(p => p.y >= -36 && p.y <= -32 && p.color === '#ffffff');
      if (charId !== 'yen') {
        assert.equal(sideGlints.length, 1, `Expected 1 eye catchlight glint for ${charId} ${sideDir} view, found ${sideGlints.length}`);
      }
    }

    // Back view: ZERO catchlight glints (#ffffff) anywhere in the entire upper head region (y < -28)
    const backCalls = trace({ id: charId, isPlayer, direction: 'up', x: 0, y: 0, time: 0 });
    const backPixels = pixels(backCalls, false);
    const backHeadGlints = backPixels.filter(p => p.y < -28 && p.color === '#ffffff');
    assert.equal(backHeadGlints.length, 0, `Leaked #ffffff glint in back view head for ${charId}`);
  }
  return `All 12 characters validated across front, side, blink, and back views`;
});

// 4. BOOT CUFFS, RUGGED SOLE, AND PALETTE COMPOSITION
run('4. Boot cuffs (#a8947d) and rugged sole (#3a2c20) present without obliterating base boot tones', () => {
  for (const charId of ALL_CHARACTERS) {
    const calls = trace({ id: charId, isPlayer: charId === 'player', direction: 'down', x: 0, y: 0 });
    const px = pixels(calls, false);

    // Boot cuff color: #a8947d
    const cuffPixels = px.filter(p => p.color === '#a8947d');
    assert.ok(cuffPixels.length > 0, `Missing boot cuff pixels (#a8947d) for ${charId}`);

    // Boot sole color: #3a2c20
    const solePixels = px.filter(p => p.color === '#3a2c20');
    assert.ok(solePixels.length > 0, `Missing boot sole pixels (#3a2c20) for ${charId}`);

    // Base boot colors: #66554b or #95816a
    const baseBootPixels = px.filter(p => p.color === '#66554b' || p.color === '#95816a');
    assert.ok(baseBootPixels.length > 0, `Base boot body colors obliterated for ${charId}`);
  }
  return `All 12 characters contain cuff (#a8947d), sole (#3a2c20), and base boot colors`;
});

// 5. TROUSER BELT LOOPS AND METALLIC BUCKLE
run('5. Trouser belt loops (#536778) rendered in drawBody() with surface visibility on non-apron outfits', () => {
  for (const charId of ALL_CHARACTERS) {
    const isPlayer = charId === 'player';
    const calls = trace({ id: charId, isPlayer, direction: 'down', x: 0, y: 0 });

    // Verify raw drawBody() calls: every character paints belt loops at (-2, -6) and (2, -6)
    const beltLoopCalls = calls.filter(c =>
      c.color === '#536778' &&
      Math.abs(c.w) === 2 && Math.abs(c.h) === 2 &&
      c.y === -12
    );
    assert.equal(beltLoopCalls.length, 2, `Expected exactly 2 belt loop rect calls in drawBody() for ${charId}, got ${beltLoopCalls.length}`);

    // Verify surface visibility: 11 of 12 characters expose belt loops on front waist;
    // Thao's gardener apron pocket intentionally overlays front waist.
    const px = pixels(calls, false);
    const surfaceBeltLoops = px.filter(p => p.color === '#536778' && p.y >= -13 && p.y <= -11);
    if (charId !== 'thao') {
      assert.equal(surfaceBeltLoops.length, 8, `Expected 8 surface belt loop pixels for ${charId}, got ${surfaceBeltLoops.length}`);
    } else {
      assert.equal(surfaceBeltLoops.length, 0, `Thao gardener apron correctly overlays front waist`);
    }

    // Gold buckle #e9bb61 must be painted in drawBody()
    const buckleCalls = calls.filter(c => c.color === '#e9bb61' && c.y === -12);
    assert.ok(buckleCalls.length > 0, `Gold buckle call missing for ${charId}`);
  }
  return `Belt loop draw calls and front surface layering verified across all 12 characters`;
});

// 6. ADVENTURER GEAR DETAILING & SYMMETRY FOR PLAYER
run('6. Player adventurer back/side gear detailing & mirror symmetry', () => {
  // Player back gear: buckle gleam #fff0ca and retaining straps #9f734d
  const backCalls = trace({ id: 'player', isPlayer: true, direction: 'up', x: 0, y: 0 });
  const backPx = pixels(backCalls, false);
  const buckleGleam = backPx.filter(p => p.color === '#fff0ca' && p.y >= -21 && p.y <= -19);
  assert.ok(buckleGleam.length > 0, `Adventurer metallic buckle gleam missing on player back gear`);

  // Side view mirror symmetry
  const rightCalls = trace({ id: 'player', isPlayer: true, direction: 'right', x: 0, y: 0, moving: true, distance: 20 });
  const leftCalls = trace({ id: 'player', isPlayer: true, direction: 'left', x: 0, y: 0, moving: true, distance: 20 });
  const rightPx = pixels(rightCalls, false);
  const leftPx = pixels(leftCalls, false).sort((a, b) => a.y - b.y || a.x - b.x);

  const mirroredRight = rightPx
    .map(p => ({ ...p, x: -p.x - 1 }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  assert.deepEqual(leftPx, mirroredRight, `Left view is not exact mirror of right view`);
  return `Adventurer gear gleam and exact mirror symmetry verified`;
});

console.log('\n================================================================');
console.log(`TOTAL ADVERSARIAL CHALLENGES: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
