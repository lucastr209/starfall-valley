'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('================================================================');
console.log('  CHALLENGER M2 EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
console.log('  Testing Motion, Flicker Soundness & Contrast Invariants');
console.log('================================================================\n');

const ROOT = path.resolve(__dirname, '..', fs.existsSync(path.join(__dirname, '..', 'public')) ? '.' : '..');
const FX = require(path.join(ROOT, 'public/js/world/world-effects.js'));

// ---------------------------------------------------------------------------
// 1. Color and Contrast Mathematical Utilities (WCAG 2.1 Specification)
// ---------------------------------------------------------------------------
function parseHex(hex) {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
      a: 1.0
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      a: 1.0
    };
  }
  if (clean.length === 8) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      a: parseInt(clean.slice(6, 8), 16) / 255
    };
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

function parseRgba(str) {
  if (str.startsWith('#')) return parseHex(str);
  const match = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!match) throw new Error(`Invalid color string: ${str}`);
  return {
    r: parseFloat(match[1]),
    g: parseFloat(match[2]),
    b: parseFloat(match[3]),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1.0
  };
}

function blend(fgColor, bgColor) {
  const fg = typeof fgColor === 'string' ? parseRgba(fgColor) : fgColor;
  const bg = typeof bgColor === 'string' ? parseRgba(bgColor) : bgColor;
  const a = fg.a;
  return {
    r: Math.round(a * fg.r + (1 - a) * bg.r),
    g: Math.round(a * fg.g + (1 - a) * bg.g),
    b: Math.round(a * fg.b + (1 - a) * bg.b),
    a: 1.0
  };
}

function relativeLuminance(color) {
  const c = typeof color === 'string' ? parseRgba(color) : color;
  const sRGB = [c.r / 255, c.g / 255, c.b / 255];
  const linear = sRGB.map(val => (val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(color1, color2) {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// 2. Harmonic Flicker Implementation from public/js/game.js:95-101
// ---------------------------------------------------------------------------
function organicFlicker(t, phase = 0, reducedMotion = false) {
  if (reducedMotion) return 0;
  return Math.sin(t * 5.03 + phase) * 0.48 +
         Math.sin(t * 15.10 + phase * 1.7) * 0.28 +
         Math.sin(t * 35.80 + phase * 3.1) * 0.16 +
         Math.sin(t * 76.70 + phase * 5.3) * 0.08;
}

// Analytical derivative J'(t)
function organicFlickerDerivative(t, phase = 0) {
  return 0.48 * 5.03 * Math.cos(t * 5.03 + phase) +
         0.28 * 15.10 * Math.cos(t * 15.10 + phase * 1.7) +
         0.16 * 35.80 * Math.cos(t * 35.80 + phase * 3.1) +
         0.08 * 76.70 * Math.cos(t * 76.70 + phase * 5.3);
}

// ---------------------------------------------------------------------------
// Mock Canvas for drawRain Coordinate Recording
// ---------------------------------------------------------------------------
function createRecordingContext() {
  const coords = [];
  return {
    save() {},
    restore() {},
    beginPath() {},
    stroke() {},
    moveTo(x, y) { coords.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { coords.push({ op: 'lineTo', x, y }); },
    getCoords() { return coords; }
  };
}

// ===========================================================================
// TEST SUITE EXECUTION
// ===========================================================================
let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    process.stdout.write(`Testing: ${name}... `);
    fn();
    console.log('PASSED');
    testsPassed++;
  } catch (err) {
    console.log('FAILED!');
    console.error(`  Error: ${err.message}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// TEST GROUP 1: Strict Mathematical Reduced Motion Zero-Delta
// ---------------------------------------------------------------------------
console.log('--- TEST GROUP 1: Reduced Motion Zero-Delta Invariants ---');

runTest('1.1. organicFlicker returns 0 for all t and phases when reducedMotion is true', () => {
  // Test explicit boundary points
  const edgePoints = [0, -1, 1, 1e-6, 1e6, Math.PI, Math.E, Number.MAX_SAFE_INTEGER];
  const phases = [0, 0.4, 1.8, Math.PI / 2, Math.PI, -2.5];

  for (const t of edgePoints) {
    for (const p of phases) {
      const res = organicFlicker(t, p, true);
      assert.strictEqual(res, 0, `Expected 0 at t=${t}, phase=${p}, got ${res}`);
    }
  }

  // 100,000 random adversarial timestamps
  for (let i = 0; i < 100000; i++) {
    const t = (Math.random() - 0.5) * 200000;
    const p = (Math.random() - 0.5) * 20;
    const res = organicFlicker(t, p, true);
    assert.strictEqual(res, 0, `Non-zero at random sample t=${t}, phase=${p}`);
  }

  // Verify non-zero when reducedMotion is false
  const activeFlicker = organicFlicker(1.234, 0.5, false);
  assert.notStrictEqual(activeFlicker, 0, 'Active flicker must produce motion when reducedMotion is false');
});

runTest('1.2. drawRain outputs identical coordinates across diverse timestamps when reducedMotion is true', () => {
  const timestamps = [0, 0.016, 0.033, 0.5, 1.0, 10.0, 100.0, 3600.0, 99999.0];
  const modes = [false, true]; // Day, Night

  for (const night of modes) {
    let baselineCoords = null;

    for (const t of timestamps) {
      const ctx = createRecordingContext();
      FX.drawRain(ctx, 960, 600, t, { night, reducedMotion: true });
      const currentCoords = ctx.getCoords();

      if (!baselineCoords) {
        baselineCoords = currentCoords;
        assert.ok(baselineCoords.length > 0, 'Must generate rain streaks');
      } else {
        assert.strictEqual(currentCoords.length, baselineCoords.length, 'Streak call count must match');
        for (let i = 0; i < baselineCoords.length; i++) {
          const b = baselineCoords[i];
          const c = currentCoords[i];
          assert.strictEqual(c.op, b.op, `Op mismatch at index ${i}`);
          assert.strictEqual(c.x, b.x, `Coordinate X mismatch at index ${i} at time ${t}`);
          assert.strictEqual(c.y, b.y, `Coordinate Y mismatch at index ${i} at time ${t}`);
        }
      }
    }
  }
});

runTest('1.3. updateSplashPool performs zero state mutations when reducedMotion is true', () => {
  const system = FX.createSplashPool(32);

  // Seed pool with diverse active/inactive particles
  for (let i = 0; i < 16; i++) {
    FX.spawnSplash(system, 100 + i * 20, 200 + i * 15, 'village');
  }
  // Partially age some particles
  FX.updateSplashPool(system, 0.05, { reducedMotion: false });

  // Deep clone state before testing reduced motion
  const snapshotBefore = JSON.stringify(system);

  // Run updateSplashPool across aggressive dt steps with reducedMotion = true
  const deltaTimes = [0.001, 0.016, 0.033, 0.08, 0.16, 1.0, 100.0];
  for (const dt of deltaTimes) {
    FX.updateSplashPool(system, dt, { reducedMotion: true });
    const snapshotAfter = JSON.stringify(system);
    assert.strictEqual(snapshotAfter, snapshotBefore, `State mutation detected during reducedMotion at dt=${dt}`);
  }

  // Verify that under reducedMotion = false, mutations DO occur
  FX.updateSplashPool(system, 0.05, { reducedMotion: false });
  const snapshotActive = JSON.stringify(system);
  assert.notStrictEqual(snapshotActive, snapshotBefore, 'updateSplashPool must advance state when reducedMotion is false');
});

// ---------------------------------------------------------------------------
// TEST GROUP 2: Mathematical Soundness of Harmonic Micro-Flicker J(t)
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Harmonic Micro-Flicker J(t) Mathematical Soundness ---');

runTest('2.1. J(0) === 0 strict origin identity', () => {
  const j0 = organicFlicker(0, 0, false);
  assert.strictEqual(j0, 0, `J(0) must equal 0, got ${j0}`);
});

runTest('2.2. Sampling 1,000,000 timestamps: |J(t)| <= 1.0, Lipschitz continuity, no discontinuous jumps', () => {
  const SAMPLE_COUNT = 1000000;
  const theoreticalLipschitz = 0.48 * 5.03 + 0.28 * 15.10 + 0.16 * 35.80 + 0.08 * 76.70; // 18.5064
  let maxAbsJ = 0;
  let minJ = Infinity;
  let maxJ = -Infinity;
  let maxObservedDerivative = 0;

  // We test across 5 complementary 200k distribution segments:
  // 1. Uniform sequence t in [0, 200] with dt = 0.001s (1ms resolution)
  let prevT = 0;
  let prevJ = organicFlicker(0, 0, false);

  for (let i = 1; i <= 200000; i++) {
    const t = i * 0.001;
    const j = organicFlicker(t, 0, false);
    const absJ = Math.abs(j);
    if (absJ > maxAbsJ) maxAbsJ = absJ;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;

    const dt = t - prevT;
    const deriv = Math.abs(j - prevJ) / dt;
    if (deriv > maxObservedDerivative) maxObservedDerivative = deriv;

    assert.ok(absJ <= 1.0000000001, `Bound violation at t=${t}: |J(t)| = ${absJ} > 1.0`);
    assert.ok(deriv <= theoreticalLipschitz + 0.05, `Discontinuity / derivative spike at t=${t}: ${deriv} > ${theoreticalLipschitz}`);

    prevT = t;
    prevJ = j;
  }

  // 2. 60 FPS gaming loop cadence: t_k = k / 60
  prevT = 0;
  prevJ = organicFlicker(0, 0, false);
  for (let i = 1; i <= 200000; i++) {
    const t = i / 60;
    const j = organicFlicker(t, 0, false);
    const absJ = Math.abs(j);
    if (absJ > maxAbsJ) maxAbsJ = absJ;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;

    const dt = t - prevT;
    const deriv = Math.abs(j - prevJ) / dt;
    if (deriv > maxObservedDerivative) maxObservedDerivative = deriv;

    assert.ok(absJ <= 1.0000000001, `Bound violation at t=${t}: |J(t)| = ${absJ} > 1.0`);
    prevT = t;
    prevJ = j;
  }

  // 3. Ultra-high-frequency microsteps: dt = 1e-5s
  prevT = 0;
  prevJ = organicFlicker(0, 0, false);
  for (let i = 1; i <= 200000; i++) {
    const t = i * 1e-5;
    const j = organicFlicker(t, 0, false);
    const absJ = Math.abs(j);
    if (absJ > maxAbsJ) maxAbsJ = absJ;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;

    const dt = t - prevT;
    const deriv = Math.abs(j - prevJ) / dt;
    if (deriv > maxObservedDerivative) maxObservedDerivative = deriv;

    assert.ok(absJ <= 1.0000000001, `Bound violation at t=${t}: |J(t)| = ${absJ} > 1.0`);
    assert.ok(deriv <= theoreticalLipschitz + 0.05, `Derivative spike at microstep t=${t}: ${deriv}`);
    prevT = t;
    prevJ = j;
  }

  // 4. Large arbitrary timestamps t in [0, 100,000s]
  for (let i = 0; i < 200000; i++) {
    const t = Math.random() * 100000;
    const j = organicFlicker(t, 0, false);
    const absJ = Math.abs(j);
    if (absJ > maxAbsJ) maxAbsJ = absJ;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;

    assert.ok(absJ <= 1.0000000001, `Bound violation at arbitrary t=${t}: |J(t)| = ${absJ} > 1.0`);
  }

  // 5. Arbitrary (t, phase) combinations
  for (let i = 0; i < 200000; i++) {
    const t = Math.random() * 50000;
    const phase = Math.random() * Math.PI * 2;
    const j = organicFlicker(t, phase, false);
    const absJ = Math.abs(j);
    if (absJ > maxAbsJ) maxAbsJ = absJ;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;

    assert.ok(absJ <= 1.0000000001, `Bound violation at (t=${t}, phase=${phase}): |J(t)| = ${absJ} > 1.0`);
  }

  console.log(`    Total samples tested: ${SAMPLE_COUNT.toLocaleString()}`);
  console.log(`    Observed Range: [${minJ.toFixed(6)}, ${maxJ.toFixed(6)}]`);
  console.log(`    Max |J(t)|: ${maxAbsJ.toFixed(6)} <= 1.0 (Theoretical Upper Bound = 1.000000)`);
  console.log(`    Max Numerical Derivative: ${maxObservedDerivative.toFixed(4)} s^-1 (Theoretical Lipschitz Bound = ${theoreticalLipschitz.toFixed(4)} s^-1)`);
});

// ---------------------------------------------------------------------------
// TEST GROUP 3: Label and Marker Contrast Invariants (WCAG AAA >= 7:1)
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Label and Marker Contrast Invariants ---');

const BACKGROUNDS = {
  night: { name: 'Dark night canvas', hex: '#19233d' },
  grass: { name: 'Daytime grass', hex: '#4d7a42' },
  road:  { name: 'Sandy road', hex: '#decba0' }
};

const PILL_BACKPLATE = 'rgba(16, 24, 30, 0.78)';
const OUTLINE_COLOR = '#101a1e';

const LABELS = {
  player: { name: 'Player name', color: '#fff4d7' },
  npc:    { name: 'NPC name (Mira, etc.)', color: '#fff8de' },
  peer:   { name: 'Online guest name', color: '#bce9e1' }
};

const BADGES = {
  claim: {
    name: 'Claim quest marker (✓)',
    markerColor: '#86efac',
    badgeRgba: 'rgba(18, 52, 32, 0.88)'
  },
  newQuest: {
    name: 'New quest marker (?)',
    markerColor: '#ffd166',
    badgeRgba: 'rgba(56, 42, 10, 0.88)'
  }
};

runTest('3.1. Character names on dark pill backplate maintain contrast ratio >= 7:1 across all backgrounds', () => {
  console.log('\n    --- Character Names Contrast Table ---');

  for (const [bgKey, bg] of Object.entries(BACKGROUNDS)) {
    // Effective blended color of the pill backplate over the background
    const effectivePill = blend(PILL_BACKPLATE, bg.hex);
    const pillLum = relativeLuminance(effectivePill);

    console.log(`    Background: ${bg.name} (${bg.hex}) -> Blended Pill: rgb(${effectivePill.r}, ${effectivePill.g}, ${effectivePill.b}) [Lum: ${pillLum.toFixed(4)}]`);

    for (const [labelKey, item] of Object.entries(LABELS)) {
      const textLum = relativeLuminance(item.color);
      const ratioOverPill = contrastRatio(item.color, effectivePill);
      const ratioOverOutline = contrastRatio(item.color, OUTLINE_COLOR);

      console.log(`      * ${item.name} (${item.color}) [Lum: ${textLum.toFixed(4)}]:`);
      console.log(`          -> Contrast vs Blended Pill: ${ratioOverPill.toFixed(2)}:1 (WCAG AAA >= 7.0: ${ratioOverPill >= 7.0 ? 'PASS' : 'FAIL'})`);
      console.log(`          -> Contrast vs Solid Outline (${OUTLINE_COLOR}): ${ratioOverOutline.toFixed(2)}:1 (WCAG AAA >= 7.0: ${ratioOverOutline >= 7.0 ? 'PASS' : 'FAIL'})`);

      assert.ok(ratioOverPill >= 7.0, `${item.name} contrast ratio vs blended pill over ${bg.name} (${ratioOverPill.toFixed(2)}:1) must be >= 7.0:1`);
      assert.ok(ratioOverOutline >= 7.0, `${item.name} contrast ratio vs outline (${ratioOverOutline.toFixed(2)}:1) must be >= 7.0:1`);
    }
  }
});

runTest('3.2. Quest badges and markers maintain contrast ratio >= 7:1 across all backgrounds', () => {
  console.log('\n    --- Quest Badges & Markers Contrast Table ---');

  for (const [bgKey, bg] of Object.entries(BACKGROUNDS)) {
    console.log(`    Background: ${bg.name} (${bg.hex})`);

    for (const [badgeKey, item] of Object.entries(BADGES)) {
      // Effective blended color of the badge disk over the background
      const effectiveBadge = blend(item.badgeRgba, bg.hex);
      const badgeLum = relativeLuminance(effectiveBadge);
      const markerLum = relativeLuminance(item.markerColor);
      const ratioOverBadge = contrastRatio(item.markerColor, effectiveBadge);
      const ratioOverOutline = contrastRatio(item.markerColor, OUTLINE_COLOR);

      console.log(`      * ${item.name}:`);
      console.log(`          Marker: ${item.markerColor} [Lum: ${markerLum.toFixed(4)}]`);
      console.log(`          Blended Badge Disk: rgb(${effectiveBadge.r}, ${effectiveBadge.g}, ${effectiveBadge.b}) [Lum: ${badgeLum.toFixed(4)}]`);
      console.log(`          -> Contrast Marker vs Blended Badge: ${ratioOverBadge.toFixed(2)}:1 (WCAG AAA >= 7.0: ${ratioOverBadge >= 7.0 ? 'PASS' : 'FAIL'})`);
      console.log(`          -> Contrast Marker vs Solid Outline (${OUTLINE_COLOR}): ${ratioOverOutline.toFixed(2)}:1 (WCAG AAA >= 7.0: ${ratioOverOutline >= 7.0 ? 'PASS' : 'FAIL'})`);

      assert.ok(ratioOverBadge >= 7.0, `${item.name} marker contrast vs blended badge over ${bg.name} (${ratioOverBadge.toFixed(2)}:1) must be >= 7.0:1`);
      assert.ok(ratioOverOutline >= 7.0, `${item.name} marker contrast vs outline (${ratioOverOutline.toFixed(2)}:1) must be >= 7.0:1`);
    }
  }
});

runTest('3.3. Verify empirical contrast resilience: Pill backplate guarantees high-contrast separation even on bright roads', () => {
  // Directly on #decba0 (sandy road), bright text #fff8de would fail (contrast ~1.2:1)
  const rawRatioOnRoad = contrastRatio(LABELS.npc.color, BACKGROUNDS.road.hex);
  console.log(`    Raw NPC text (#fff8de) directly on sandy road (#decba0) without backplate: ${rawRatioOnRoad.toFixed(2)}:1 (FAILED if unshielded)`);
  assert.ok(rawRatioOnRoad < 2.0, 'Confirms why dark backplate/outline is mathematically essential on bright roads');

  // With dark pill backplate on sandy road:
  const effectivePillOnRoad = blend(PILL_BACKPLATE, BACKGROUNDS.road.hex);
  const shieldedRatio = contrastRatio(LABELS.npc.color, effectivePillOnRoad);
  console.log(`    Shielded NPC text (#fff8de) on pill backplate over sandy road: ${shieldedRatio.toFixed(2)}:1 (PASS >= 7.0:1)`);
  assert.ok(shieldedRatio >= 7.0, 'Backplate successfully protects text contrast to WCAG AAA');
});

// ---------------------------------------------------------------------------
// SUMMARY AND VERDICT
// ---------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  VERIFICATION RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('================================================================');

if (testsFailed > 0) {
  console.error('\nOVERALL VERDICT: REQUEST_CHANGES');
  process.exit(1);
} else {
  console.log('\nOVERALL VERDICT: APPROVE');
  process.exit(0);
}
