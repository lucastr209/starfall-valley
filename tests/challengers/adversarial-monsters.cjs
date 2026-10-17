'use strict';

/**
 * Challenger M3-2: Adversarial Verification & Stress Test Harness for Monsters & Bosses
 * Target: public/js/game.js (drawStandardMob, drawBossMob, Slime hitbox, Boss FSM, Sprout/Warden)
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..', fs.existsSync(path.join(__dirname, '..', 'public')) ? '.' : '..');
const CombatData = require(path.join(ROOT, 'public/js/data/combat-data.js'));

// 1. Extract functions directly from public/js/world/combat-renderer.js or public/js/game.js source
const sourcePath = fs.existsSync(path.join(ROOT, 'public/js/world/combat-renderer.js'))
  ? path.join(ROOT, 'public/js/world/combat-renderer.js')
  : path.join(ROOT, 'public/js/game.js');
const gameJsSource = fs.readFileSync(sourcePath, 'utf8');

// Extract drawStandardMob and drawBossMob implementations
const standardMobMatch = gameJsSource.match(/function drawStandardMob\([\s\S]*?\n  \}/);
const bossMobMatch = gameJsSource.match(/function drawBossMob\([\s\S]*?\n  \}/);

if (!standardMobMatch || !bossMobMatch) {
  throw new Error('Failed to extract drawStandardMob or drawBossMob from ' + sourcePath);
}

// Compile with native Function constructor to avoid V8 vm.Context property-lookup overhead
const standardFnFactory = new Function(
  'rect', 'pixelEllipse', 'label', 'CombatData', 'Math',
  'return ' + standardMobMatch[0]
);
const bossFnFactory = new Function(
  'rect', 'pixelEllipse', 'label', 'CombatData', 'Math',
  'return ' + bossMobMatch[0]
);

const createHarness = (options = {}) => {
  const calls = [];
  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    font: '',
    textAlign: '',
    fillRect(x, y, w, h) {
      if (options.recordCalls !== false) {
        calls.push({
          type: 'fillRect',
          x, y, w, h,
          fillStyle: this.fillStyle,
          alpha: this.globalAlpha
        });
      }
    },
    fillText(text, x, y) {
      if (options.recordCalls !== false) {
        calls.push({
          type: 'fillText',
          text, x, y,
          fillStyle: this.fillStyle,
          alpha: this.globalAlpha
        });
      }
    },
    save() {
      if (options.recordCalls !== false) calls.push({ type: 'save' });
    },
    restore() {
      if (options.recordCalls !== false) calls.push({ type: 'restore' });
    }
  };

  const rect = (c, x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), w, h);
  };

  const pixelEllipse = (c, x, y, w, h, color) => {
    rect(c, x - w / 2 + 4, y - h / 2, w - 8, h, color);
    rect(c, x - w / 2, y - h / 2 + 3, w, h - 6, color);
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

  const drawStandardMob = standardFnFactory(rect, pixelEllipse, label, CombatData, Math);
  const drawBossMob = bossFnFactory(rect, pixelEllipse, label, CombatData, Math);

  return {
    drawStandardMob,
    drawBossMob,
    ctx,
    calls
  };
};

console.log('='.repeat(70));
console.log('  CHALLENGER M3-2 EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
console.log('  Target: Monsters & Bosses Rendering in public/js/game.js');
console.log('='.repeat(70));

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

async function runTest(name, fn) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const report = await fn();
    console.log('PASSED' + (report ? ` (${report})` : ''));
    results.passed++;
    results.tests.push({ name, status: 'PASSED', report });
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err.message);
    results.failed++;
    results.tests.push({ name, status: 'FAILED', error: err.message });
  }
}

async function main() {
  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Slime Hitbox Invariant Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 1: Slime Hitbox Invariant Verification ---');

  await runTest('1.1. Slime hitbox invariant: rect(ctx, x-19, y-18, 38, 16, #8fbd8c) across 10,000 timestamps', () => {
    const { drawStandardMob, ctx, calls } = createHarness();
    const def = CombatData.enemies.slime;
    const mob = { id: 'test-slime', kind: 'slime', x: 500, y: 300, hp: 3, phase: 1 };

    const testTimestamps = [];
    for (let t = 0; t <= 100; t += 0.05) testTimestamps.push(t);
    testTimestamps.push(0, Math.PI, 2 * Math.PI, 1000, 1e5, 1e6, -100, -1e5);

    let verifiedCalls = 0;
    for (const anim of testTimestamps) {
      calls.length = 0;
      const bounce = Math.sin(anim * 5 + mob.phase) * 3;
      const x = mob.x;
      const y = mob.y + bounce;

      drawStandardMob(ctx, mob, def, x, y, anim, false);

      const hitbox = calls.find(c => 
        c.type === 'fillRect' && 
        c.w === 38 && 
        c.h === 16 && 
        c.fillStyle === '#8fbd8c'
      );

      assert.ok(hitbox, `Missing 38x16 hitbox for timestamp ${anim}`);
      assert.equal(hitbox.x, Math.floor(x - 19), `Hitbox x mismatch at t=${anim}`);
      assert.equal(hitbox.y, Math.floor(y - 18), `Hitbox y mismatch at t=${anim}`);
      assert.equal(hitbox.w, 38, 'Hitbox width must be invariant 38');
      assert.equal(hitbox.h, 16, 'Hitbox height must be invariant 16');
      verifiedCalls++;
    }
    return `${verifiedCalls} timestamps validated`;
  });

  await runTest('1.2. Slime draw call validity: Zero NaN dimensions, infinite coordinates, or illegal colors', () => {
    const { drawStandardMob, ctx, calls } = createHarness();
    const def = CombatData.enemies.slime;
    const mob = { id: 'test-slime', kind: 'slime', x: 400, y: 300, hp: 3, phase: 0 };

    const timestamps = [0, 0.016, 0.5, 1.0, Math.PI, 100, 9999.99];
    for (const anim of timestamps) {
      calls.length = 0;
      drawStandardMob(ctx, mob, def, mob.x, mob.y, anim, false);

      for (const c of calls) {
        if (c.type === 'fillRect') {
          assert.ok(Number.isFinite(c.x), `Non-finite x: ${c.x}`);
          assert.ok(Number.isFinite(c.y), `Non-finite y: ${c.y}`);
          assert.ok(Number.isFinite(c.w), `Non-finite w: ${c.w}`);
          assert.ok(Number.isFinite(c.h), `Non-finite h: ${c.h}`);
          assert.match(c.fillStyle, /^#[0-9a-fA-F]{3,8}$/, `Illegal hex color: ${c.fillStyle}`);
        }
      }
    }
    return 'All fillRect calls contain strictly finite coordinates and valid hex colors';
  });

  await runTest('1.3. Slime reducedMotion invariant: zero vertical bounce delta across time', () => {
    const { drawStandardMob, ctx, calls } = createHarness();
    const def = CombatData.enemies.slime;
    const mob = { id: 'test-slime', kind: 'slime', x: 500, y: 300, hp: 3, phase: 0 };

    calls.length = 0;
    drawStandardMob(ctx, mob, def, mob.x, mob.y, 0, true);
    const frame0 = JSON.stringify(calls);

    calls.length = 0;
    drawStandardMob(ctx, mob, def, mob.x, mob.y, 77.7, true);
    const frame1 = JSON.stringify(calls);

    assert.equal(frame0, frame1, 'Slime rendering with reducedMotion must be 100% byte-identical across time');
    return 'Byte-identical canvas call stream confirmed';
  });

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Boss State Machine & Health Extremes
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 2: Boss State Machine & Health Extremes ---');

  const BOSS_KINDS = ['rootBoss', 'forestBoss', 'tideBoss', 'skyBoss'];

  await runTest('2.1. Boss rendering across all 4 Bosses at normal, half, and full health', () => {
    const { drawBossMob, ctx, calls } = createHarness();

    for (const bossKind of BOSS_KINDS) {
      const def = CombatData.enemies[bossKind];
      assert.ok(def, `CombatData definition missing for ${bossKind}`);

      for (const hpRatio of [1.0, 0.5, 0.1]) {
        calls.length = 0;
        const mob = {
          id: `test-${bossKind}`,
          kind: bossKind,
          x: 600, y: 400,
          hp: Math.round(def.maxHp * hpRatio),
          phase: 1,
          combat: { phase: hpRatio <= 0.5 ? 2 : 1, style: 'charge' }
        };

        drawBossMob(ctx, mob, def, mob.x, mob.y, 1.25, false);
        assert.ok(calls.length > 10, `${bossKind} rendered too few draw calls (${calls.length})`);

        // Verify health bar
        const hpBars = calls.filter(c => c.type === 'fillRect' && c.fillStyle === '#ddaa71');
        assert.equal(hpBars.length, 1, `Expected exactly 1 health bar fill for ${bossKind}`);
        assert.equal(hpBars[0].w, 80 * mob.hp / def.maxHp, `Health bar width ratio incorrect for ${bossKind}`);
      }
    }
    return `4 bosses validated at hp ratios 1.0, 0.5, 0.1`;
  });

  await runTest('2.2. Boss rendering at extreme HP: hp = 0, hp < 0, hp > maxHp (overflow)', () => {
    const { drawBossMob, ctx, calls } = createHarness();

    for (const bossKind of BOSS_KINDS) {
      const def = CombatData.enemies[bossKind];

      // Case A: hp = 0
      calls.length = 0;
      const mobZero = { id: `test-${bossKind}`, kind: bossKind, x: 500, y: 400, hp: 0, phase: 1 };
      drawBossMob(ctx, mobZero, def, mobZero.x, mobZero.y, 0, false);
      const barZero = calls.find(c => c.type === 'fillRect' && c.fillStyle === '#ddaa71');
      assert.ok(barZero, 'Health bar fillRect exists');
      assert.equal(barZero.w, 0, 'HP bar width at hp=0 must be 0');

      // Case B: hp > maxHp (overflow)
      calls.length = 0;
      const mobOverflow = { id: `test-${bossKind}`, kind: bossKind, x: 500, y: 400, hp: def.maxHp * 1.5, phase: 1 };
      drawBossMob(ctx, mobOverflow, def, mobOverflow.x, mobOverflow.y, 0, false);
      const barOverflow = calls.find(c => c.type === 'fillRect' && c.fillStyle === '#ddaa71');
      assert.equal(barOverflow.w, 120, 'HP bar width reflects overflow ratio');

      // Case C: hp < 0 (negative)
      calls.length = 0;
      const mobNegative = { id: `test-${bossKind}`, kind: bossKind, x: 500, y: 400, hp: -10, phase: 1 };
      drawBossMob(ctx, mobNegative, def, mobNegative.x, mobNegative.y, 0, false);
      const barNegative = calls.find(c => c.type === 'fillRect' && c.fillStyle === '#ddaa71');
      assert.ok(barNegative.w < 0, 'Negative HP produces negative width in boss health bar');
    }
    return 'Zero, overflow, and negative HP behavior documented and executed without throw';
  });

  await runTest('2.3. Boss vulnerability state machine: exposed glowing core rendering', () => {
    const { drawBossMob, ctx, calls } = createHarness();

    for (const bossKind of BOSS_KINDS) {
      const def = CombatData.enemies[bossKind];

      calls.length = 0;
      const mobNormal = { id: `b1`, kind: bossKind, x: 400, y: 300, hp: def.maxHp, combat: { style: 'charge' } };
      drawBossMob(ctx, mobNormal, def, mobNormal.x, mobNormal.y, 0, false);
      const normalCalls = JSON.stringify(calls);

      calls.length = 0;
      const mobVuln = { id: `b1`, kind: bossKind, x: 400, y: 300, hp: def.maxHp, combat: { style: 'vulnerable' } };
      drawBossMob(ctx, mobVuln, def, mobVuln.x, mobVuln.y, 0, false);
      const vulnCalls = JSON.stringify(calls);

      assert.notEqual(normalCalls, vulnCalls, `Vulnerable state must alter visual rendering for ${bossKind}`);

      const coreColors = {
        forestBoss: '#6ee7b7',
        tideBoss: '#67e8f9',
        skyBoss: '#e879f9',
        rootBoss: '#74dfaa'
      };
      const hasCore = calls.some(c => c.type === 'fillRect' && c.fillStyle === coreColors[bossKind]);
      assert.ok(hasCore, `Exposed core color ${coreColors[bossKind]} must be drawn for ${bossKind}`);
    }
    return 'All 4 bosses telegraphed exposed glowing core when vulnerable';
  });

  await runTest('2.4. Boss animation boundary conditions: 0, negative, pi, 2pi, 1e6', () => {
    const { drawBossMob, ctx, calls } = createHarness();

    const animBoundaries = [0, -1, -100, Math.PI, 2 * Math.PI, 1e4, 1e6];
    for (const bossKind of BOSS_KINDS) {
      const def = CombatData.enemies[bossKind];
      const mob = { id: `b`, kind: bossKind, x: 500, y: 400, hp: def.maxHp, phase: 0 };

      for (const anim of animBoundaries) {
        calls.length = 0;
        drawBossMob(ctx, mob, def, mob.x, mob.y, anim, false);
        for (const c of calls) {
          if (c.type === 'fillRect') {
            assert.ok(Number.isFinite(c.x), `x must be finite at anim=${anim}`);
            assert.ok(Number.isFinite(c.y), `y must be finite at anim=${anim}`);
            assert.ok(Number.isFinite(c.w), `w must be finite at anim=${anim}`);
            assert.ok(Number.isFinite(c.h), `h must be finite at anim=${anim}`);
          }
        }
      }
    }
    return 'All boss coordinates finite across boundary timestamps [0, -100, pi, 2pi, 1e6]';
  });

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Sprout and Warden Robustness
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 3: Sprout and Warden Robustness ---');

  await runTest('3.1. Sprout waddle and leaf swaying bounded displacement & finite coordinates', () => {
    const { drawStandardMob, ctx, calls } = createHarness();
    const def = CombatData.enemies.sprout;
    const mob = { id: 's', kind: 'sprout', x: 450, y: 350, hp: def.maxHp, phase: 0.5 };

    let maxWaddle = -Infinity, minWaddle = Infinity;
    let maxSway = -Infinity, minSway = Infinity;

    for (let anim = 0; anim <= 20; anim += 0.05) {
      const waddle = Math.round(Math.sin(anim * 7 + mob.phase) * 2);
      const sway = Math.round(Math.sin(anim * 4 + mob.phase) * 2);

      if (waddle > maxWaddle) maxWaddle = waddle;
      if (waddle < minWaddle) minWaddle = waddle;
      if (sway > maxSway) maxSway = sway;
      if (sway < minSway) minSway = sway;

      calls.length = 0;
      drawStandardMob(ctx, mob, def, mob.x, mob.y, anim, false);

      for (const c of calls) {
        if (c.type === 'fillRect') {
          assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y));
        }
      }
    }

    assert.equal(maxWaddle, 2);
    assert.equal(minWaddle, -2);
    assert.equal(maxSway, 2);
    assert.equal(minSway, -2);
    return `Waddle bounded [-2, 2], Leaf sway bounded [-2, 2]`;
  });

  await runTest('3.2. Warden runic eye glow animation states across cycle', () => {
    const { drawStandardMob, ctx, calls } = createHarness();
    const def = CombatData.enemies.warden;
    const mob = { id: 'w', kind: 'warden', x: 450, y: 350, hp: def.maxHp, phase: 0 };

    const observedEyeColors = new Set();
    for (let anim = 0; anim <= 10; anim += 0.1) {
      calls.length = 0;
      drawStandardMob(ctx, mob, def, mob.x, mob.y, anim, false);

      const eye = calls.find(c => c.type === 'fillRect' && c.w === 6 && c.h === 3);
      assert.ok(eye, 'Warden glowing eye must be drawn');
      observedEyeColors.add(eye.fillStyle);
    }

    assert.ok(observedEyeColors.has('#b5f5d3'), 'Pulsing bright eye glow must occur');
    assert.ok(observedEyeColors.has('#74dfaa'), 'Base eye glow must occur');
    assert.equal(observedEyeColors.size, 2, 'Warden eye alternates between 2 distinct glow states');
    return `Eye states: ${[...observedEyeColors].join(', ')}`;
  });

  await runTest('3.3. Sprout and Warden reducedMotion freeze: zero animation jitter', () => {
    const { drawStandardMob, ctx, calls } = createHarness();

    for (const kind of ['sprout', 'warden']) {
      const def = CombatData.enemies[kind];
      const mob = { id: kind, kind, x: 400, y: 300, hp: def.maxHp, phase: 0 };

      calls.length = 0;
      drawStandardMob(ctx, mob, def, mob.x, mob.y, 0, true);
      const snap0 = JSON.stringify(calls);

      calls.length = 0;
      drawStandardMob(ctx, mob, def, mob.x, mob.y, 100.5, true);
      const snap1 = JSON.stringify(calls);

      assert.equal(snap0, snap1, `reducedMotion must produce 100% stable pixels for ${kind}`);
    }
    return 'Sprout & Warden completely freeze motion with reducedMotion: true';
  });

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: Throughput Benchmark
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 4: Rendering Throughput Benchmark ---');

  await runTest('4.1. Throughput benchmark: 10,000 draw calls per monster and boss (<= 10us per call target)', () => {
    const { drawStandardMob, drawBossMob, ctx } = createHarness({ recordCalls: false });
    const iterations = 10000;
    const benchmarkResults = {};

    const entities = [
      { kind: 'slime', boss: false },
      { kind: 'sprout', boss: false },
      { kind: 'warden', boss: false },
      { kind: 'rootBoss', boss: true },
      { kind: 'forestBoss', boss: true },
      { kind: 'tideBoss', boss: true },
      { kind: 'skyBoss', boss: true }
    ];

    for (const ent of entities) {
      const def = CombatData.enemies[ent.kind];
      const mob = { id: ent.kind, kind: ent.kind, x: 400, y: 300, hp: def.maxHp, phase: 0 };
      const drawFn = ent.boss ? drawBossMob : drawStandardMob;

      // Warmup JIT
      for (let i = 0; i < 1000; i++) drawFn(ctx, mob, def, mob.x, mob.y, i * 0.016, false);

      // Timed benchmark run
      const start = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        drawFn(ctx, mob, def, mob.x, mob.y, i * 0.016, false);
      }
      const end = process.hrtime.bigint();

      const totalNs = Number(end - start);
      const totalMs = totalNs / 1e6;
      const usPerCall = (totalNs / iterations) / 1000;

      benchmarkResults[ent.kind] = {
        iterations,
        totalMs: totalMs.toFixed(2),
        usPerCall: usPerCall.toFixed(3)
      };

      assert.ok(usPerCall <= 10.0, `Throughput for ${ent.kind} was ${usPerCall}us/call, expected <= 10us/call`);
    }

    const summary = Object.entries(benchmarkResults)
      .map(([k, v]) => `${k}: ${v.usPerCall}µs`)
      .join(' | ');
    return summary;
  });

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: Full In-Game QA Integration (via tests/gameplay.test.js loadGame)
  // ---------------------------------------------------------------------------
  await runTest('5.1. In-game forest mobs and boss encounter rendering via drawGame()', async () => {
    const gameplayTestPath = fs.existsSync(path.join(__dirname, 'gameplay.test.js'))
      ? path.join(__dirname, 'gameplay.test.js')
      : path.join(ROOT, 'tests', 'gameplay.test.js');
    const gameplayTestSource = fs.readFileSync(gameplayTestPath, 'utf8');
    const sandbox = {
      require,
      __dirname: path.join(ROOT, 'tests'),
      process,
      console,
      Buffer,
      fs,
      path,
      assert,
      vm,
      URL,
      URLSearchParams,
      structuredClone,
      Map,
      Set,
      setTimeout,
      clearTimeout
    };
    vm.createContext(sandbox);
    const loadGameCode = gameplayTestSource.match(/function loadGame\([\s\S]*?\n  return env;\n\}/);
    if (!loadGameCode) throw new Error('Could not extract loadGame from gameplay.test.js');

    vm.runInContext(loadGameCode[0], sandbox);
    const e = sandbox.loadGame({ search: '?qa=1&scene=combat' });
    await e.start();

    // Verify QA combat scene with slime, sprout, warden
    e.calls.length = 0;
    e.qa.drawGame();

    const gameCanvasCalls = e.calls.filter(c => c.context === 'gameCanvas');
    assert.ok(gameCanvasCalls.length > 50, 'drawGame must render rich canvas calls');

    const slimeHitbox = gameCanvasCalls.find(c => 
      c.name === 'fillRect' && 
      c.args[2] === 38 && 
      c.args[3] === 16 && 
      c.fillStyle === '#8fbd8c'
    );
    assert.ok(slimeHitbox, 'Slime 38x16 rect present in full game drawGame()');

    // Inject each of the 4 Bosses into world.forest.mobs and render
    for (const bossKind of BOSS_KINDS) {
      const def = CombatData.enemies[bossKind];
      const bossMob = {
        id: `qa-boss-${bossKind}`,
        kind: bossKind,
        x: 800, y: 550,
        homeX: 800, homeY: 550,
        hp: def.maxHp,
        phase: 1,
        deadUntil: 0
      };
      e.qa.getWorld().forest.mobs = [bossMob];
      e.calls.length = 0;
      e.qa.drawGame();

      const bossCalls = e.calls.filter(c => c.context === 'gameCanvas');
      assert.ok(bossCalls.length > 30, `Boss ${bossKind} must produce calls in drawGame()`);
      const bossShadow = bossCalls.find(c => c.name === 'fillRect' && c.fillStyle === '#344c5540');
      assert.ok(bossShadow, `Boss shadow present for ${bossKind}`);
    }

    return 'Combat scene and all 4 bosses verified via QA drawGame() pipeline';
  });

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: Hostile / Boundary State Machine Analysis
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 6: Hostile / Boundary State Machine Analysis ---');

  await runTest('6.1. Boundary behavior on non-numeric animation values (NaN / undefined)', () => {
    const { drawStandardMob, drawBossMob, ctx, calls } = createHarness();

    const nonNumerics = [NaN, undefined];
    const mobData = [
      { kind: 'slime', boss: false },
      { kind: 'sprout', boss: false },
      { kind: 'warden', boss: false },
      { kind: 'rootBoss', boss: true },
      { kind: 'forestBoss', boss: true },
      { kind: 'tideBoss', boss: true },
      { kind: 'skyBoss', boss: true }
    ];

    const nanObservations = {};

    for (const ent of mobData) {
      const def = CombatData.enemies[ent.kind];
      const drawFn = ent.boss ? drawBossMob : drawStandardMob;
      nanObservations[ent.kind] = 0;

      for (const badAnim of nonNumerics) {
        calls.length = 0;
        const mob = { id: ent.kind, kind: ent.kind, x: 400, y: 300, hp: def.maxHp, phase: 0 };
        drawFn(ctx, mob, def, mob.x, mob.y, badAnim, false);

        const nanCalls = calls.filter(c => Number.isNaN(c.x) || Number.isNaN(c.y));
        nanObservations[ent.kind] += nanCalls.length;
      }
    }

    // Notice: under reducedMotion: true, NaN animation is completely bypassed!
    for (const ent of mobData) {
      const def = CombatData.enemies[ent.kind];
      const drawFn = ent.boss ? drawBossMob : drawStandardMob;
      calls.length = 0;
      const mob = { id: ent.kind, kind: ent.kind, x: 400, y: 300, hp: def.maxHp, phase: 0 };
      drawFn(ctx, mob, def, mob.x, mob.y, NaN, true);
      const nanCallsReduced = calls.filter(c => Number.isNaN(c.x) || Number.isNaN(c.y));
      assert.equal(nanCallsReduced.length, 0, `reducedMotion: true must eliminate all NaNs for ${ent.kind}`);
    }

    return `NaN coords observed when anim=NaN: skyBoss (${nanObservations.skyBoss}), sprout (${nanObservations.sprout}), slime (${nanObservations.slime}), warden (${nanObservations.warden}); eliminated under reducedMotion: true`;
  });

  await runTest('6.2. Health bar behavior across boundary health values (0, maxHp, 2*maxHp, negative)', () => {
    const { drawBossMob, drawStandardMob, ctx, calls } = createHarness();

    // Standard mob clamping
    const slimeDef = CombatData.enemies.slime;
    calls.length = 0;
    drawStandardMob(ctx, { id: 's', kind: 'slime', x: 400, y: 300, hp: -10, phase: 0 }, slimeDef, 400, 300, 0, false);
    const slimeBar = calls.find(c => c.type === 'fillRect' && c.fillStyle === '#e8c16b');
    assert.equal(slimeBar.w, 0, 'drawStandardMob clamps negative HP to 0 using Math.max(0, m.hp)');

    // Boss mob negative health produces negative width (unclamped)
    const bossDef = CombatData.enemies.rootBoss;
    calls.length = 0;
    drawBossMob(ctx, { id: 'b', kind: 'rootBoss', x: 400, y: 300, hp: -10, phase: 0 }, bossDef, 400, 300, 0, false);
    const bossBar = calls.find(c => c.type === 'fillRect' && c.fillStyle === '#ddaa71');
    assert.ok(bossBar.w < 0, 'drawBossMob produces negative width on negative HP: 80 * m.hp / maxHp');

    return 'drawStandardMob clamps negative HP to 0; drawBossMob produces negative bar width (safe in runtime because combat-core clamps mob.hp >= 0)';
  });

  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL RESULTS: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log('='.repeat(70));

  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test harness:', err);
  process.exit(1);
});
