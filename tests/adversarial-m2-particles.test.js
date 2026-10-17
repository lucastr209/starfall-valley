'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const FX = require('../public/js/world-effects.js');
const Paths = require('../public/js/world-paths.js');

function canvasMock() {
  const stack = [], calls = [];
  const ctx = {
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() {
      stack.push({ alpha: this.globalAlpha, fill: this.fillStyle, stroke: this.strokeStyle, lw: this.lineWidth });
      calls.push({ name: 'save' });
    },
    restore() {
      const saved = stack.pop();
      assert.ok(saved, 'balanced canvas save/restore');
      this.globalAlpha = saved.alpha; this.fillStyle = saved.fill; this.strokeStyle = saved.stroke; this.lineWidth = saved.lw;
      calls.push({ name: 'restore' });
    },
    fillRect(x, y, w, h) { calls.push({ name: 'fillRect', x, y, w, h, fillStyle: this.fillStyle, alpha: this.globalAlpha }); },
    beginPath() { calls.push({ name: 'beginPath' }); },
    closePath() { calls.push({ name: 'closePath' }); },
    moveTo(x, y) { calls.push({ name: 'moveTo', x, y }); },
    lineTo(x, y) { calls.push({ name: 'lineTo', x, y }); },
    stroke() { calls.push({ name: 'stroke' }); }
  };
  return { ctx, calls, stack };
}

describe('Adversarial M2 Particle & Memory Challenger Suite', () => {

  test('ADV-M2-01: 100,000 Splash Spawns Ring Buffer Strict Capacity <= 32 & Zero Heap Exhaustion', () => {
    // 1. Capacity Clamping Tests
    const clampedLarge = FX.createSplashPool(100000);
    assert.equal(clampedLarge.capacity, 32, 'Capacity requested as 100,000 must be clamped to <= 32');
    assert.equal(clampedLarge.pool.length, 32, 'Pool array length must be exactly 32');

    const clampedZero = FX.createSplashPool(0);
    assert.equal(clampedZero.capacity, 1, 'Capacity requested as 0 must clamp to 1');
    assert.equal(clampedZero.pool.length, 1);

    const clampedNegative = FX.createSplashPool(-50);
    assert.equal(clampedNegative.capacity, 1, 'Capacity requested as negative must clamp to 1');

    // 2. Rapid 100,000 Spawn Stress Test
    const system = FX.createSplashPool(32);
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    const SPAWN_COUNT = 100000;
    for (let i = 0; i < SPAWN_COUNT; i++) {
      const x = (i * 17) % 1600;
      const y = (i * 31) % 1100;
      FX.spawnSplash(system, x, y, 'village');

      // Invariant check on head pointer and pool length
      if (i % 10000 === 0) {
        assert.equal(system.pool.length, 32, `Pool length resized at iteration ${i}`);
        assert.ok(system.head >= 0 && system.head < 32, `Head pointer out of bounds at iteration ${i}`);
      }
    }

    const elapsedMs = performance.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDeltaKb = (endMemory - startMemory) / 1024;

    assert.equal(system.pool.length, 32, 'Final pool size must be strictly 32');
    assert.equal(system.capacity, 32, 'Capacity must remain strictly 32');
    assert.ok(elapsedMs < 500, `Execution took ${elapsedMs.toFixed(2)}ms, exceeding 500ms budget`);
    assert.ok(memoryDeltaKb < 1024, `Memory delta ${memoryDeltaKb.toFixed(2)}KB indicates potential leak`);

    // Verify all 32 ring buffer slots are active with valid coordinates
    for (let i = 0; i < system.capacity; i++) {
      const particle = system.pool[i];
      assert.equal(particle.active, true, `Slot ${i} must be active`);
      assert.ok(Number.isFinite(particle.x) && particle.x >= 0 && particle.x <= 1600);
      assert.ok(Number.isFinite(particle.y) && particle.y >= 0 && particle.y <= 1100);
      assert.equal(particle.life, 0.16);
      assert.equal(particle.age, 0);
    }
  });

  test('ADV-M2-02: Zero Object Allocation per Frame in Splash Update Loop Across 60,000 Frames', () => {
    const system = FX.createSplashPool(32);
    // Fill the pool
    for (let i = 0; i < 32; i++) {
      FX.spawnSplash(system, 100 + i * 10, 200 + i * 10, 'village');
    }

    // Capture object identities of every slot
    const slotReferences = system.pool.map(p => p);
    const poolArrayRef = system.pool;

    // Simulate 60,000 frames (1,000 seconds of gameplay at 60 FPS)
    const dt = 1 / 60;
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    for (let frame = 0; frame < 60000; frame++) {
      // Re-spawn particles periodically as they expire to test update loop under active load
      if (frame % 10 === 0) {
        FX.spawnSplash(system, 500, 500, 'village');
      }
      FX.updateSplashPool(system, dt, { reducedMotion: false });

      // Invariant: Pool array reference and slot object references must never change
      if (frame % 5000 === 0) {
        assert.equal(system.pool, poolArrayRef, 'Pool array reference was reallocated');
        for (let i = 0; i < 32; i++) {
          assert.equal(system.pool[i], slotReferences[i], `Slot object ${i} was replaced`);
        }
      }
    }

    const elapsedMs = performance.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDeltaKb = (endMemory - startMemory) / 1024;

    assert.ok(elapsedMs < 1000, `60,000 updates took ${elapsedMs.toFixed(2)}ms, exceeding 1000ms`);
    assert.ok(memoryDeltaKb < 2048, `Memory drift ${memoryDeltaKb.toFixed(2)}KB across 60k frames`);

    // Reduced motion test: updateSplashPool must return immediately without updating particles
    const particleBefore = { ...system.pool[0] };
    FX.updateSplashPool(system, 0.05, { reducedMotion: true });
    assert.deepEqual(system.pool[0], particleBefore, 'updateSplashPool must do zero work under reducedMotion');
  });

  test('ADV-M2-03: Concentric Ripples in sampleAmbient NEVER Exceed sample.ground.length <= 84 Across All Dimensions', () => {
    const maps = ['village', 'forest', 'coast', 'ruins'];
    const seasonDayOffsets = [1, 91, 182, 273]; // Spring, Summer, Autumn, Winter
    const timesOfDay = [0, 360, 600, 720, 1080, 1140, 1260, 3599]; // Dawn, morning, noon, dusk, night, midnight
    const extremeTimes = [-100, 1e6, NaN, Infinity];

    let totalEvaluated = 0;
    const maxGroundObserved = {};

    for (const map of maps) {
      maxGroundObserved[map] = 0;
      // Create scene using standard mock options
      const scene = FX.createScene(map, {
        trees: [{ x: 200, y: 280 }, { x: 380, y: 800 }],
        objects: [{ kind: 'camp', x: 790, y: 735 }, { kind: 'shrine', x: 800, y: 280 }],
        buildings: [{ x: 270, y: 330, w: 146, h: 125, kind: 'home' }, { x: 610, y: 335, w: 154, h: 137, kind: 'workshop', upgrade: 'workshop' }],
        isPath: (x, y) => Math.abs(x - 800) < 35 || Math.abs(y - 550) < 35
      });

      for (const seasonDay of seasonDayOffsets) {
        for (const time of [...timesOfDay, ...extremeTimes]) {
          for (const rain of [false, true]) {
            for (const night of [false, true]) {
              for (const reducedMotion of [false, true]) {
                for (const shrineActive of [false, true]) {
                  const options = { rain, night, reducedMotion, shrineActive, upgrades: ['workshop', 'kitchen'] };
                  const sample = FX.sampleAmbient(scene, time, options);

                  totalEvaluated++;
                  const groundCount = sample.ground.length;
                  if (groundCount > maxGroundObserved[map]) {
                    maxGroundObserved[map] = groundCount;
                  }

                  // Core Invariant Assertion
                  assert.ok(groundCount <= 84, `Exceeded ground cap! map=${map}, count=${groundCount}`);

                  // Concentric ripple verification during rain
                  const ripples = sample.ground.filter(e => e.type === 'ripple');
                  assert.equal(ripples.length, 14, `Water ripple count must strictly remain 14 on ${map}`);

                  if (rain) {
                    for (const r of ripples) {
                      assert.equal(r.rain, true);
                      assert.ok(Number.isFinite(r.ringRadius));
                      assert.ok(Number.isFinite(r.ringAlpha));
                      assert.ok(r.ringAlpha >= 0 && r.ringAlpha <= 1);
                      if (reducedMotion) {
                        assert.equal(r.ringRadius, 7, 'Static ripple radius under reduced motion');
                        assert.equal(r.ringAlpha, 0.35, 'Static ripple alpha under reduced motion');
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    assert.ok(totalEvaluated >= 3000, `Evaluated ${totalEvaluated} permutations`);
    for (const [map, maxCount] of Object.entries(maxGroundObserved)) {
      assert.ok(maxCount <= 84, `Map ${map} max count ${maxCount} > 84`);
    }
  });

  test('ADV-M2-04A: Missing/Empty Maps Safety in drawPuddles', () => {
    const { ctx } = canvasMock();
    const badMaps = [null, undefined, '', 'nonexistent', 'space_station', {}, 123, NaN];

    for (const badMap of badMaps) {
      assert.doesNotThrow(() => {
        FX.drawPuddles(ctx, badMap, 1.0, { night: true });
      }, `drawPuddles should not throw on bad map: ${badMap}`);
    }
  });

  test('ADV-M2-04B: Puddle Coordinates and Lantern Reflections Stay Strictly Within Road Bounding Boxes', () => {
    const maps = ['village', 'forest', 'coast', 'ruins'];

    for (const map of maps) {
      const layout = Paths.createLayout(map);
      // Compute Road Network AABB
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          if (layout.cells[r * layout.cols + c]) {
            const x = c * layout.cellSize, y = r * layout.cellSize;
            if (x < minX) minX = x;
            if (x + layout.cellSize > maxX) maxX = x + layout.cellSize;
            if (y < minY) minY = y;
            if (y + layout.cellSize > maxY) maxY = y + layout.cellSize;
          }
        }
      }

      const puddles = FX.PUDDLE_PRESETS[map];
      assert.ok(Array.isArray(puddles) && puddles.length > 0, `Puddles must exist for ${map}`);

      // 1. Verify every puddle outer bounds stay within Road AABB
      for (const p of puddles) {
        const pLeft = p.x - p.w / 2 - 2;
        const pRight = p.x + p.w / 2 + 2;
        const pTop = p.y - p.h / 2 - 1;
        const pBottom = p.y + p.h / 2 + 1;

        assert.ok(pLeft >= minX, `${map}: Puddle left ${pLeft} < road minX ${minX}`);
        assert.ok(pRight <= maxX, `${map}: Puddle right ${pRight} > road maxX ${maxX}`);
        assert.ok(pTop >= minY, `${map}: Puddle top ${pTop} < road minY ${minY}`);
        assert.ok(pBottom <= maxY, `${map}: Puddle bottom ${pBottom} > road maxY ${maxY}`);
      }

      // 2. Verify lantern highlights stay within road bounds for normal light sources
      const lights = [
        { x: minX + 20, y: minY + 20, r: 140, power: 0.9 },
        { x: (minX + maxX) / 2, y: (minY + maxY) / 2, r: 160, power: 1.0 },
        { x: maxX - 20, y: maxY - 20, r: 140, power: 0.8 }
      ];

      const { ctx, calls } = canvasMock();
      FX.drawPuddles(ctx, map, 0.5, { lights, night: true });

      const fillCalls = calls.filter(c => c.name === 'fillRect');
      for (const call of fillCalls) {
        assert.ok(Number.isFinite(call.x), `${map}: fillRect x must be finite, got ${call.x}`);
        assert.ok(Number.isFinite(call.y), `${map}: fillRect y must be finite, got ${call.y}`);
        assert.ok(call.x >= minX - 10, `${map}: fillRect x ${call.x} outside road minX ${minX}`);
        assert.ok(call.x + call.w <= maxX + 10, `${map}: fillRect right ${call.x + call.w} outside road maxX ${maxX}`);
        assert.ok(call.y >= minY - 10, `${map}: fillRect y ${call.y} outside road minY ${minY}`);
        assert.ok(call.y + call.h <= maxY + 10, `${map}: fillRect bottom ${call.y + call.h} outside road maxY ${maxY}`);
      }
    }
  });

  test('ADV-M2-04C: [ADVERSARIAL STRESS] Zero-Distance Light Source (Coinciding Center) Invariant', () => {
    // When a player or lantern stands directly at the center of a puddle (dist === 0)
    // dx / dist is 0 / 0 = NaN in naive division.
    // Coordinates must NEVER become NaN.
    const { ctx, calls } = canvasMock();
    const puddle = FX.PUDDLE_PRESETS.village[0]; // { x: 800, y: 560 }
    const lights = [{ x: puddle.x, y: puddle.y, r: 100, power: 1.0 }];

    FX.drawPuddles(ctx, 'village', 0, { lights, night: true });

    const nanCalls = calls.filter(c => c.name === 'fillRect' && (Number.isNaN(c.x) || Number.isNaN(c.y)));
    assert.equal(nanCalls.length, 0, `Adversarial zero-distance light generated NaN coordinates in fillRect: ${JSON.stringify(nanCalls)}`);
  });

});
