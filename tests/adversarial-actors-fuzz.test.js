'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Actors = require('../public/js/world/world-actors.js');
const data = require('../public/js/data/game-data.js');

const ALL_CHARACTERS = ['player', ...data.npcs.map(n => n.id)];
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const SHADOW_COLORS = new Set(['#213c4038', '#213c4024']);
const FACE_SKIN_COLORS = new Set([
  '#efc5a2', '#f9d8b5', '#c88f78', // standard skin, light, shade
  '#f6d3b3', '#ecd7bc', '#f4cebe', // dispatch prompt skin tones
  '#e7ac95', '#d89a83'             // blush tones
]);

function canvasMock() {
  const calls = [], stack = [];
  const ctx = {
    fillStyle: '#012345',
    globalAlpha: 0.37,
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

function paintSignature(calls) {
  return pixels(calls)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(c => [c.x, c.y, c.color, c.alpha]);
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

describe('Adversarial Actors Verification & Fuzzing Suite', () => {

  test('Fuzz 1: Exhaustive Bounding Box & Grounded Sole Anchor (+2)', () => {
    // 12 characters * 4 directions * 100 gait distances (0 to 1000px)
    // Total iterations: 12 * 4 * 100 = 4,800 poses
    const distances = Array.from({ length: 100 }, (_, i) => i * 10.1); // fractional steps up to 999.9px
    const anchorX = 120, anchorY = 200;

    for (const charId of ALL_CHARACTERS) {
      for (const direction of DIRECTIONS) {
        for (let i = 0; i < distances.length; i++) {
          const distance = distances[i];
          const running = (i % 2 === 1); // alternate walk and run
          const lantern = (i % 5 === 0);

          const calls = trace({
            id: charId,
            isPlayer: charId === 'player',
            x: anchorX,
            y: anchorY,
            direction,
            moving: true,
            running,
            distance,
            lantern
          });

          const bodyPixels = pixels(calls, false);
          assert.ok(bodyPixels.length > 0, `Character ${charId} rendered body pixels at dist ${distance}`);
          const bounds = extents(bodyPixels);
          const width = bounds.right - bounds.left;
          const height = bounds.bottom - bounds.top;

          // 1. Width <= 48
          assert.ok(
            width <= 48,
            `Width overflow for ${charId} ${direction} run=${running} dist=${distance}: width=${width} > 48 (bounds: ${bounds.left}..${bounds.right})`
          );

          // 2. Height <= 60
          assert.ok(
            height <= 60,
            `Height overflow for ${charId} ${direction} run=${running} dist=${distance}: height=${height} > 60 (bounds: ${bounds.top}..${bounds.bottom})`
          );

          // 3. Silhouette within 24px of x anchor (x in [96, 144])
          assert.ok(
            bounds.left >= anchorX - 24 && bounds.right <= anchorX + 24,
            `X bounds out of 24px radius for ${charId} ${direction} run=${running}: [${bounds.left}, ${bounds.right}]`
          );

          // 4. Stance boot sole must touch anchor + 2 (anchorY + 2 = 202)
          const feetPixels = bodyPixels.filter(c => c.y >= anchorY - 10);
          assert.ok(feetPixels.length > 0, `Feet pixels missing for ${charId} at dist ${distance}`);
          const feetBounds = extents(feetPixels);
          assert.equal(
            feetBounds.bottom,
            anchorY + 2,
            `Grounded sole violated for ${charId} ${direction} run=${running} dist=${distance}: bottom=${feetBounds.bottom} !== 202`
          );

          // 5. Shadow geometry invariant
          const shadowPixels = pixels(calls.filter(c => SHADOW_COLORS.has(c.color)));
          assert.ok(shadowPixels.length > 0, 'Shadow missing');
          const shadowBounds = extents(shadowPixels);
          assert.equal(shadowBounds.left, anchorX - 16, 'Shadow left anchor');
          assert.equal(shadowBounds.right, anchorX + 16, 'Shadow right anchor');
          assert.equal(shadowBounds.top, anchorY, 'Shadow top anchor');
          assert.equal(shadowBounds.bottom, anchorY + 4, 'Shadow bottom anchor');
        }
      }
    }
  });

  test('Fuzz 2: Back-View Privacy Leak Fuzzing (Zero Face Skin, Mouth, and Eye Whites in Face/Eye Zone)', () => {
    // 12 characters facing 'up' across 50 gait frames (walk & run)
    const distances = Array.from({ length: 50 }, (_, i) => i * 15.3);

    for (const charId of ALL_CHARACTERS) {
      for (const running of [false, true]) {
        for (let i = 0; i < distances.length; i++) {
          const distance = distances[i];
          const calls = trace({
            id: charId,
            isPlayer: charId === 'player',
            x: 0,
            y: 0,
            direction: 'up',
            moving: true,
            running,
            distance,
            lantern: i % 2 === 0
          });

          const rendered = pixels(calls, false);
          // Entire head region is y < -28 Canvas px
          const headPixels = rendered.filter(p => p.y < -28);
          assert.ok(headPixels.length > 0, `Head pixels missing for ${charId} facing up`);

          // Invariant 1: Assert ZERO face skin tones anywhere on the entire head (y < -28)
          const leakedSkin = headPixels.filter(p => FACE_SKIN_COLORS.has(p.color));
          assert.deepEqual(
            leakedSkin,
            [],
            `Back-view skin leak for ${charId} running=${running} dist=${distance}: ${JSON.stringify(leakedSkin)}`
          );

          // Invariant 2: Assert ZERO mouth / lip tones (#b77b71) anywhere on the entire head (y < -28)
          const leakedMouth = headPixels.filter(p => p.color === '#b77b71');
          assert.deepEqual(
            leakedMouth,
            [],
            `Back-view mouth leak for ${charId} running=${running} dist=${distance}`
          );

          // Invariant 3: Assert ZERO eye whites (#fff0ca, #ffffff) in the eye zone (y in [-40, -28])
          // Eyes are physically located at ry = -17 (y = -34). The facial eye zone spans [-40, -28].
          const eyeZonePixels = rendered.filter(p => p.y >= -40 && p.y < -28);
          const leakedEyes = eyeZonePixels.filter(p => p.color === '#fff0ca' || p.color === '#ffffff');
          assert.deepEqual(
            leakedEyes,
            [],
            `Back-view eye whites leak in eye zone [-40, -28] for ${charId} running=${running} dist=${distance}: ${JSON.stringify(leakedEyes)}`
          );

          // Invariant 4: Across the entire upper head (y < -40), verify that only Linh's tea-hairpin
          // flower bud at the bun crown (y = -55..-54) may contain #fff0ca, and no other character leaks #fff0ca/#ffffff.
          const crownWhitePixels = headPixels.filter(p => p.y < -40 && (p.color === '#fff0ca' || p.color === '#ffffff'));
          if (charId !== 'linh') {
            assert.deepEqual(
              crownWhitePixels,
              [],
              `Unexpected white/cream pixels on crown for ${charId} facing up: ${JSON.stringify(crownWhitePixels)}`
            );
          } else {
            // Linh has exactly 4 pixels of #fff0ca for her jade hairpin bud which moves with body sway and bob
            assert.ok(
              crownWhitePixels.every(p => p.color === '#fff0ca' && p.x >= 7 && p.x <= 11 && p.y >= -56 && p.y <= -52),
              `Linh crown pixels outside tea hairpin bounds: ${JSON.stringify(crownWhitePixels)}`
            );
          }
        }
      }
    }
  });

  test('Fuzz 3: Adversarial Dynamic Inputs & Non-Crashing Robustness', () => {
    const extremeTimes = [Infinity, -Infinity, NaN, -1, 0, 1e12, -1e12, 1e-12, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    const extremeWeights = [-5, -1, 0, 0.5, 1, 1.5, 10, 100, Infinity, -Infinity, NaN];
    const extremeDistances = [-1000, -1, 0, 1, 100, 1e9, Infinity, -Infinity, NaN];
    const extremePhases = [-10, -0.5, 0, 0.25, 0.5, 1, 10, Infinity, -Infinity, NaN];
    const extremeDirections = ['down', 'up', 'left', 'right', 'north', 'south', 'diagonal', '', null, undefined, 42, {}, []];
    const extremeIds = ['player', 'mira', '__proto__', 'constructor', 'toString', 'unknown_guy', '', null, undefined, 123, {}, []];

    // Combinatorial stress
    for (const time of extremeTimes) {
      for (const motionWeight of extremeWeights) {
        for (const runWeight of [-5, 10, NaN]) {
          const opts = {
            id: 'player',
            time,
            motionWeight,
            runWeight,
            distance: 50,
            direction: 'right'
          };
          const canvas = canvasMock();
          assert.doesNotThrow(() => Actors.draw(canvas.ctx, opts), `Crashed on input: ${JSON.stringify(opts)}`);
          assert.equal(canvas.stack.length, 0, 'Canvas stack restored on extreme inputs');
          assert.ok(canvas.calls.every(c => [c.x, c.y, c.w, c.h, c.alpha].every(Number.isFinite)), 'All call numbers finite');
        }
      }
    }

    // Fuzz distance and phase
    for (const distance of extremeDistances) {
      for (const phase of extremePhases) {
        const opts = { moving: true, distance, phase, direction: 'down' };
        const canvas = canvasMock();
        assert.doesNotThrow(() => Actors.draw(canvas.ctx, opts));
        assert.equal(canvas.stack.length, 0);
      }
    }

    // Fuzz direction and id
    for (const direction of extremeDirections) {
      for (const id of extremeIds) {
        const opts = { id, direction, x: 50, y: 50 };
        const canvas = canvasMock();
        assert.doesNotThrow(() => Actors.draw(canvas.ctx, opts));
        assert.equal(canvas.stack.length, 0);
      }
    }

    // Fuzz input object non-mutation
    const inputSnapshot = {
      id: 'mira',
      x: 100,
      y: 100,
      direction: 'left',
      moving: true,
      running: true,
      distance: 42,
      phase: 0.5,
      motionWeight: 0.8,
      runWeight: 0.8,
      lantern: true,
      shirt: '#123456',
      hair: '#654321'
    };
    const serializedBefore = JSON.stringify(inputSnapshot);
    const canvas = canvasMock();
    Actors.draw(canvas.ctx, inputSnapshot);
    Actors.frameFor(inputSnapshot);
    const serializedAfter = JSON.stringify(inputSnapshot);
    assert.equal(serializedAfter, serializedBefore, 'draw() and frameFor() MUST NOT mutate their input options');
  });

  test('Fuzz 4: Mirror Symmetry Fuzzing (Left === Mirrored Right for all characters & 50 gait frames)', () => {
    // 12 characters * 50 poses * lantern(true/false)
    const distances = Array.from({ length: 50 }, (_, i) => i * 14.7);

    for (const charId of ALL_CHARACTERS) {
      for (const running of [false, true]) {
        for (let i = 0; i < distances.length; i++) {
          const distance = distances[i];
          const lantern = (i % 3 === 0);
          const baseOpts = {
            id: charId,
            isPlayer: charId === 'player',
            x: 0,
            y: 0,
            moving: true,
            running,
            distance,
            lantern,
            time: 1.0
          };

          const rightPixels = pixels(trace({ ...baseOpts, direction: 'right' }));
          const leftPixels = pixels(trace({ ...baseOpts, direction: 'left' })).sort((a, b) => a.y - b.y || a.x - b.x);

          // Mirror right pixels: x_left = -x_right - 1
          const mirroredRight = rightPixels
            .map(c => ({ ...c, x: -c.x - 1 }))
            .sort((a, b) => a.y - b.y || a.x - b.x);

          assert.deepEqual(
            leftPixels,
            mirroredRight,
            `Mirror symmetry violation for ${charId} running=${running} dist=${distance} lantern=${lantern}`
          );
        }
      }
    }
  });

  test('Fuzz 5: Reduced Motion 100% Byte Identity Across 100 Random Timestamps', () => {
    // For every character in all 4 directions, reducedMotion: true must freeze all animation
    // Byte signature at any random timestamp t in [0, 1e6] must be 100% identical to t = 0
    const randomTimestamps = Array.from({ length: 100 }, () => Math.random() * 1000000);

    for (const charId of ALL_CHARACTERS) {
      for (const direction of DIRECTIONS) {
        const baseSig = JSON.stringify(
          paintSignature(trace({
            id: charId,
            isPlayer: charId === 'player',
            direction,
            moving: true,
            running: true,
            distance: 23,
            reducedMotion: true,
            time: 0
          }))
        );

        for (const randTime of randomTimestamps) {
          const testSig = JSON.stringify(
            paintSignature(trace({
              id: charId,
              isPlayer: charId === 'player',
              direction,
              moving: true,
              running: true,
              distance: 23 + Math.random() * 500,
              reducedMotion: true,
              time: randTime,
              motionWeight: Math.random(),
              runWeight: Math.random()
            }))
          );

          assert.equal(
            testSig,
            baseSig,
            `Reduced motion divergence for ${charId} ${direction} at time ${randTime}`
          );
        }
      }
    }
  });

  test('Fuzz 6: Gait Continuity and Finite Bounds', () => {
    // 256 fine samples across a full cycle
    for (const running of [false, true]) {
      const cycle = running ? Actors.artMetrics.runCycleDistance : Actors.artMetrics.walkCycleDistance;
      const samples = Array.from({ length: 256 }, (_, i) => {
        return Actors.frameFor({
          moving: true,
          running,
          distance: (i / 256) * cycle
        });
      });

      // Continuity checks
      for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1], curr = samples[i];
        assert.ok(Math.abs(curr.step - prev.step) <= 1.0, `Step displacement jumped at sample ${i}`);
        assert.ok(Math.abs(curr.bob - prev.bob) <= 1.0, `Bob displacement jumped at sample ${i}`);
        assert.ok(Math.abs(curr.nearFoot.offset - prev.nearFoot.offset) <= 1.0, `Near foot jumped at sample ${i}`);
        assert.ok(Math.abs(curr.farFoot.offset - prev.farFoot.offset) <= 1.0, `Far foot jumped at sample ${i}`);
      }

      // Exact cycle wrap
      const start = samples[0];
      const end = Actors.frameFor({ moving: true, running, distance: cycle });
      assert.deepEqual(start.nearFoot, end.nearFoot, 'Cycle wrap near foot identity');
      assert.deepEqual(start.farFoot, end.farFoot, 'Cycle wrap far foot identity');
      assert.equal(start.bob, end.bob, 'Cycle wrap bob identity');
      assert.equal(start.step, end.step, 'Cycle wrap step identity');
    }
  });

});
