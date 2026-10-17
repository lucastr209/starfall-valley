'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createGameHarness(options = {}) {
  const gameplayTestSource = fs.readFileSync(path.join(__dirname, 'gameplay.test.js'), 'utf8');
  const sandbox = {
    require,
    __dirname,
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
  return sandbox.loadGame(options);
}

function paintTrace(e, context = 'titleCanvas') {
  return JSON.stringify(
    e.calls
      .filter(c => c.context === context && ['fillRect', 'fillText', 'fill', 'moveTo', 'lineTo', 'translate', 'scale'].includes(c.name))
      .map(c => ({
        name: c.name,
        args: c.args,
        color: ['fillRect', 'fillText', 'fill'].includes(c.name) ? c.fillStyle : undefined,
        alpha: c.alpha
      }))
  );
}

describe('Feature 16: Sunrise Title Screen (#titleCanvas)', () => {
  test('T1: Seed determinism & zero-randomness across identical animation timestamps', () => {
    const e = createGameHarness();
    e.calls.length = 0;
    e.qa.drawTitle();
    const firstTrace = paintTrace(e);

    e.calls.length = 0;
    e.qa.drawTitle();
    const secondTrace = paintTrace(e);

    assert.equal(firstTrace, secondTrace, 'Two consecutive drawTitle() calls with identical animation state produce identical paint traces');
  });

  test('T2: Reduced motion absolute freeze vs normal motion animation progression', () => {
    // Reduced motion test:
    const rmGame = createGameHarness({ reducedMotion: true });
    rmGame.calls.length = 0;
    rmGame.tick(16);
    const rmFirst = paintTrace(rmGame);
    const rmTime = rmGame.qa.getAnimationTime();

    rmGame.calls.length = 0;
    rmGame.tick(1000);
    const rmSecond = paintTrace(rmGame);

    assert.equal(rmSecond, rmFirst, 'When reducedMotion is true, title screen paint trace is completely frozen');
    assert.equal(rmGame.qa.getAnimationTime(), rmTime, 'Animation time counter does not increment under reducedMotion');

    // Normal motion test:
    const normGame = createGameHarness({ reducedMotion: false });
    normGame.calls.length = 0;
    normGame.tick(16);
    const normFirst = paintTrace(normGame);
    const normTime = normGame.qa.getAnimationTime();

    normGame.calls.length = 0;
    normGame.tick(1000);
    const normSecond = paintTrace(normGame);

    assert.notEqual(normSecond, normFirst, 'Under normal motion, title screen advances animation smoothly');
    assert.ok(normGame.qa.getAnimationTime() > normTime, 'Animation time counter advances under normal motion');
  });

  test('T3: Multi-tier sunrise sky dithering presence with 4x4 Bayer blocks', () => {
    const e = createGameHarness();
    e.calls.length = 0;
    e.qa.drawTitle();

    const titleCalls = e.calls.filter(c => c.context === 'titleCanvas');
    const skyDitherBlocks = titleCalls.filter(c =>
      c.name === 'fillRect' &&
      c.args[2] === 4 &&
      c.args[3] === 4 &&
      c.args[1] < 400
    );

    assert.ok(skyDitherBlocks.length >= 100, `Expected at least 100 4x4 dither blocks in the sky region, found ${skyDitherBlocks.length}`);

    const colors = new Set(skyDitherBlocks.map(c => c.fillStyle));
    const expectedPalette = ['#df9b8e', '#f4b486', '#f8cf94', '#fce2ab', '#fff3c8'];
    const matchedColors = expectedPalette.filter(p => colors.has(p));
    assert.ok(matchedColors.length >= 3, `Expected at least 3 sunrise palette colors in dither transitions, found ${matchedColors.join(', ')}`);
  });

  test('T4: Two-tier mountain silhouettes presence (Alpine Peaks & Forest Ridges)', () => {
    const e = createGameHarness();
    e.calls.length = 0;
    e.qa.drawTitle();

    const titleCalls = e.calls.filter(c => c.context === 'titleCanvas');

    // Far alpine peaks fill color #9bb0ab and snowcap #fffbe8
    const farAlpinePeaks = titleCalls.filter(c => c.name === 'fill' && c.fillStyle === '#9bb0ab');
    assert.ok(farAlpinePeaks.length >= 5, `Expected at least 5 far alpine peak fills (#9bb0ab), found ${farAlpinePeaks.length}`);

    const snowcaps = titleCalls.filter(c => c.name === 'fill' && c.fillStyle === '#fffbe8');
    assert.ok(snowcaps.length >= 5, `Expected at least 5 snowcap fills (#fffbe8), found ${snowcaps.length}`);

    // Near forest ridges left shade #6c8976 and right lit #8aa88e
    const nearRidgesShade = titleCalls.filter(c => c.name === 'fill' && c.fillStyle === '#6c8976');
    assert.ok(nearRidgesShade.length >= 4, `Expected at least 4 near forest ridge shade fills (#6c8976), found ${nearRidgesShade.length}`);

    const nearRidgesLit = titleCalls.filter(c => c.name === 'fill' && c.fillStyle === '#8aa88e');
    assert.ok(nearRidgesLit.length >= 4, `Expected at least 4 near forest ridge lit fills (#8aa88e), found ${nearRidgesLit.length}`);
  });

  test('T5: Three-tier parallax cloud velocity layers (Cirrus, Cumulus, Stratus)', () => {
    const e = createGameHarness();

    // Sample at t = 0
    e.calls.length = 0;
    e.qa.drawTitle();
    const calls0 = e.calls.filter(c => c.context === 'titleCanvas' && c.name === 'fillRect');

    const cirrus0 = calls0.find(c => c.fillStyle === '#fff5de' && c.args[1] < 80);
    const cumulus0 = calls0.find(c => c.fillStyle === '#fff6dc' && c.args[1] >= 90 && c.args[1] <= 190);
    const stratus0 = calls0.find(c => c.fillStyle === '#fff1d088' && c.args[1] >= 250 && c.args[1] <= 330);

    assert.ok(cirrus0, 'Cirrus cloud (#fff5de) found at y < 80');
    assert.ok(cumulus0, 'Cumulus cloud (#fff6dc) found at 90 <= y <= 190');
    assert.ok(stratus0, 'Valley stratus cloud (#fff1d088) found at 250 <= y <= 330');

    // Advance 2 seconds (40 frames of 50ms to respect frame dt clamp)
    for (let i = 0; i < 39; i++) e.tick(50);
    e.calls.length = 0;
    e.tick(50);
    const calls2 = e.calls.filter(c => c.context === 'titleCanvas' && c.name === 'fillRect');

    const cirrus2 = calls2.find(c => c.fillStyle === '#fff5de' && c.args[1] === cirrus0.args[1]);
    const cumulus2 = calls2.find(c => c.fillStyle === '#fff6dc' && c.args[1] === cumulus0.args[1]);
    const stratus2 = calls2.find(c => c.fillStyle === '#fff1d088' && c.args[1] === stratus0.args[1]);

    assert.ok(cirrus2, 'Matching Cirrus cloud found at t=2');
    assert.ok(cumulus2, 'Matching Cumulus cloud found at t=2');
    assert.ok(stratus2, 'Matching Stratus cloud found at t=2');

    const deltaCirrus = cirrus2.args[0] - cirrus0.args[0];
    const deltaCumulus = cumulus2.args[0] - cumulus0.args[0];
    const deltaStratus = stratus2.args[0] - stratus0.args[0];

    // Speed rates over 2 seconds: Cirrus 1.8 px/s (floored: 3px); Stratus 3.2 px/s (floored: 6px); Cumulus 5.2 px/s (floored: 10px)
    assert.ok(deltaCirrus >= 3 && deltaCirrus <= 4, `Cirrus displacement expected 3..4, got ${deltaCirrus}`);
    assert.ok(deltaStratus >= 6 && deltaStratus <= 7, `Stratus displacement expected 6..7, got ${deltaStratus}`);
    assert.ok(deltaCumulus >= 10 && deltaCumulus <= 11, `Cumulus displacement expected 10..11, got ${deltaCumulus}`);
    assert.ok(deltaCirrus < deltaStratus && deltaStratus < deltaCumulus, 'Three parallax cloud layers travel at distinctly different velocities');
  });

  test('T6: Water reflections with sun column and oscillating shimmer lines', () => {
    const e = createGameHarness();
    e.calls.length = 0;
    e.qa.drawTitle();

    const titleCalls = e.calls.filter(c => c.context === 'titleCanvas' && c.name === 'fillRect');
    const waterCalls = titleCalls.filter(c => c.args[0] >= 1100 && c.args[1] >= 700);

    // Sun reflection column fills in water
    const sunColumnFills = waterCalls.filter(c => ['#f6e3ab38', '#fce8b150', '#fff4cc65'].includes(c.fillStyle));
    assert.ok(sunColumnFills.length >= 2, `Expected sun reflection column fills in pond, found ${sunColumnFills.length}`);

    // Oscillating shimmer lines: height <= 2, colors #fffdf0, #fdebb3, #8ee0d3, #b8f2e8
    const shimmerLines = waterCalls.filter(c => c.args[3] <= 2 && ['#fffdf0', '#fdebb3', '#8ee0d3', '#b8f2e8'].includes(c.fillStyle));
    assert.ok(shimmerLines.length >= 10, `Expected at least 10 water ripple shimmer lines, found ${shimmerLines.length}`);
  });

  test('T7: Canvas state transform balance & no external assets', () => {
    const e = createGameHarness();
    e.calls.length = 0;
    e.qa.drawTitle();

    const ctx = e.el('titleCanvas').getContext();
    assert.equal(ctx.stack.length, 0, 'Canvas save/restore stack is balanced (stack length 0)');

    const imageCalls = e.calls.filter(c => c.context === 'titleCanvas' && c.name === 'drawImage');
    assert.equal(imageCalls.length, 0, 'Zero drawImage calls with external images on title canvas');
  });
});
