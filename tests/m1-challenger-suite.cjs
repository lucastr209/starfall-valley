'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

console.log('================================================================');
console.log('  CHALLENGER M1 EMPIRICAL VERIFICATION SUITE');
console.log('================================================================\n');

// ---------------------------------------------------------------------------
// Helper: Load game environment via VM sandbox
// ---------------------------------------------------------------------------
function createGameHarness({ search = '?qa=1' } = {}) {
  const calls = [];
  const elements = new Map();
  const markup = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  let clock = 1700000000000, perfClock = 0, createdCount = 0;
  const createdCanvases = [];

  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
    removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(l => l !== fn)); }
    async dispatch(type, event = {}) {
      const e = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...event };
      for (const l of this.listeners.get(type) || []) await l(e);
      return e;
    }
  }

  class Element extends Target {
    constructor(id, tagName = 'DIV') {
      super();
      this.id = id;
      this.tagName = tagName;
      this.dataset = {};
      this.attributes = {};
      this.style = { setProperty(k, v) { this[k] = String(v); }, getPropertyValue(k) { return this[k] || ''; }, removeProperty(k) { delete this[k]; } };
      this.children = [];
      this.value = '';
      this.textContent = '';
      this.hidden = false;
      this.width = 960;
      this.height = 600;
      this.classList = { add() {}, remove() {}, contains: () => false };
      if (tagName === 'CANVAS') createdCanvases.push(this);
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    hasAttribute(k) { return Object.hasOwn(this.attributes, k); }
    append(child) { child.parent = this; this.children.push(child); }
    getContext() {
      if (!this.context) this.context = makeContext(this);
      return this.context;
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height, x: 0, y: 0 };
    }
  }

  function makeContext(element) {
    const c = { canvas: element, globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', strokeStyle: '', font: '', textAlign: '', stack: [] };
    const add = (name, args) => calls.push({ context: element.id, name, args: Array.from(args) });
    for (const name of ['fillRect', 'clearRect', 'drawImage', 'translate', 'scale', 'rotate', 'fillText', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'closePath', 'arc', 'ellipse', 'clip']) {
      c[name] = function (...args) { add(name, args); };
    }
    c.save = () => add('save', []);
    c.restore = () => add('restore', []);
    c.createRadialGradient = (...args) => ({ stops: [], addColorStop() {} });
    return c;
  }

  const document = new Target();
  document.activeElement = null;
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element(id, /Canvas$/.test(id) ? 'CANVAS' : 'DIV'));
    return elements.get(id);
  };
  document.createElement = tag => new Element(`created-${createdCount++}`, tag.toUpperCase());
  document.createTextNode = t => ({ textContent: String(t) });
  document.querySelectorAll = () => [];
  document.documentElement = new Element('root', 'HTML');
  document.body = new Element('body', 'BODY');

  const window = new Target();
  window.innerWidth = 1280;
  window.innerHeight = 720;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.navigator = { userAgent: 'NodeTest', platform: 'Win32' };

  const raf = [];
  const sandbox = {
    document, window, navigator: window.navigator,
    location: { search, protocol: 'http:', host: 'localhost:4173', hostname: 'localhost', reload() {} },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)) },
    Date: class extends Date { static now() { return clock; } },
    performance: { now: () => perfClock },
    URLSearchParams, structuredClone,
    WebSocket: class { constructor() { this.readyState = 0; } send() {} close() {} },
    Blob: class { constructor(parts = []) { this.size = parts.length; } async text() { return ''; } },
    URL: class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} },
    matchMedia: window.matchMedia,
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: callback => raf.push(callback),
    setTimeout: () => 1, clearTimeout: () => {},
    console
  };
  window.location = sandbox.location;

  vm.createContext(sandbox);
  for (const [, file] of markup.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8'), sandbox, { filename: file });
  }

  return { sandbox, calls, createdCanvases, qa: sandbox.StardropQA, document };
}

// ===========================================================================
// CHALLENGE TASK 1: Empirical Collision Verification
// ===========================================================================
console.log('--- TASK 1: Collision Envelope Verification ---');

const harness = createGameHarness();
const qa = harness.qa;
assert.ok(qa, 'StardropQA must be exposed in ?qa=1 mode');

// 1.1 Pond Collision Verification
console.log('Evaluating pond perimeter (x: 1110..1490, y: 625..905) in village map...');
const pondXMin = 1110, pondXMax = 1490;
const pondYMin = 625, pondYMax = 905;

let pondPointsTested = 0;
let pondBlockedCount = 0;

// Test full interior grid at 4px steps
for (let y = pondYMin + 1; y < pondYMax; y += 4) {
  for (let x = pondXMin + 1; x < pondXMax; x += 4) {
    pondPointsTested++;
    const blocked = qa.blockedAt('village', x, y);
    if (blocked) pondBlockedCount++;
  }
}

// Test top perimeter line (y = pondYMin + 1)
for (let x = pondXMin + 1; x < pondXMax; x++) {
  pondPointsTested++;
  if (qa.blockedAt('village', x, pondYMin + 1)) pondBlockedCount++;
}

// Test bottom perimeter line (y = pondYMax - 1)
for (let x = pondXMin + 1; x < pondXMax; x++) {
  pondPointsTested++;
  if (qa.blockedAt('village', x, pondYMax - 1)) pondBlockedCount++;
}

// Test left perimeter line (x = pondXMin + 1)
for (let y = pondYMin + 1; y < pondYMax; y++) {
  pondPointsTested++;
  if (qa.blockedAt('village', pondXMin + 1, y)) pondBlockedCount++;
}

// Test right perimeter line (x = pondXMax - 1)
for (let y = pondYMin + 1; y < pondYMax; y++) {
  pondPointsTested++;
  if (qa.blockedAt('village', pondXMax - 1, y)) pondBlockedCount++;
}

console.log(`Pond points tested: ${pondPointsTested}, Blocked: ${pondBlockedCount} (100.0%)`);
assert.equal(pondBlockedCount, pondPointsTested, `All ${pondPointsTested} tested pond perimeter and interior points must be strictly blocked`);

// Verify exact perimeter boundary behavior at the outer envelope
assert.equal(qa.blockedAt('village', pondXMin + 0.5, 760), true, 'Just inside left boundary is blocked');
assert.equal(qa.blockedAt('village', pondXMax - 0.5, 760), true, 'Just inside right boundary is blocked');
assert.equal(qa.blockedAt('village', 1300, pondYMin + 0.5), true, 'Just inside top boundary is blocked');
assert.equal(qa.blockedAt('village', 1300, pondYMax - 0.5), true, 'Just inside bottom boundary is blocked');

// 1.2 Building Hitbox Verification
console.log('Evaluating building hitboxes in game.js:891 across all regions...');
const world = qa.getWorld();
const regions = ['village', 'forest', 'coast', 'ruins'];
let buildingsTested = 0;
let buildingPointsTested = 0;

const villageBuildings = [
  { x: 270, y: 330, w: 146, h: 125, name: 'Nhà Mira', kind: 'home' },
  { x: 610, y: 335, w: 154, h: 137, name: 'Xưởng Gió', upgrade: 'workshop', kind: 'workshop' },
  { x: 1060, y: 330, w: 160, h: 132, name: 'Thư viện Mây', upgrade: 'archive', kind: 'archive' },
  { x: 1340, y: 350, w: 122, h: 108, name: 'Bếp Nắng', upgrade: 'kitchen', kind: 'kitchen' },
  { x: 280, y: 850, w: 136, h: 122, name: 'Vườn kính', upgrade: 'greenhouse', kind: 'greenhouse' },
  { x: 1015, y: 875, w: 145, h: 120, name: 'Chợ Lá', upgrade: 'market', kind: 'market' },
  { x: 1350, y: 1035, w: 125, h: 125, name: 'Đài Sao', upgrade: 'observatory', kind: 'observatory' }
];

for (const map of regions) {
  const mapBuildings = map === 'village'
    ? villageBuildings
    : world[map].buildings;

  assert.ok(mapBuildings && mapBuildings.length > 0, `Map ${map} must have buildings`);

  for (const b of mapBuildings) {
    buildingsTested++;
    const halfW = b.w / 2;
    const xMin = b.x - halfW - 8;
    const xMax = b.x + halfW + 8;
    const yMin = b.y - 62;
    const yMax = b.y + 9;

    // Test building center
    const centerBlocked = qa.blockedAt(map, b.x, b.y - 25);
    assert.ok(centerBlocked, `Building ${b.name || b.id} center (${b.x}, ${b.y - 25}) must be blocked in ${map}`);
    buildingPointsTested++;

    // Test 4 inner corner points
    const corners = [
      { x: xMin + 0.5, y: yMin + 0.5 },
      { x: xMax - 0.5, y: yMin + 0.5 },
      { x: xMin + 0.5, y: yMax - 0.5 },
      { x: xMax - 0.5, y: yMax - 0.5 },
    ];
    for (const pt of corners) {
      const blocked = qa.blockedAt(map, pt.x, pt.y);
      assert.ok(blocked, `Building ${b.name || b.id} corner (${pt.x}, ${pt.y}) must be blocked in ${map}`);
      buildingPointsTested++;
    }

    // Dense sample inside the building footprint
    for (let sy = yMin + 2; sy < yMax - 1; sy += 6) {
      for (let sx = xMin + 2; sx < xMax - 1; sx += 6) {
        buildingPointsTested++;
        assert.ok(qa.blockedAt(map, sx, sy), `Building ${b.name} interior point (${sx}, ${sy}) must be blocked in ${map}`);
      }
    }
  }
}

console.log(`Buildings tested: ${buildingsTested}, Points tested: ${buildingPointsTested} (100.0% blocked)`);
console.log('✔ Task 1 PASSED: Pond perimeter and building hitboxes are 100% strictly blocked.\n');

// ===========================================================================
// CHALLENGE TASK 2: Determinism Verification
// ===========================================================================
console.log('--- TASK 2: Determinism Verification ---');

const P = require('../public/js/world-paths.js');
assert.ok(P && typeof P.draw === 'function', 'world-paths.js must export P.draw');

function recordDrawCalls(layout) {
  const operations = [];
  const mockCtx = {
    fillStyle: '',
    fillRect(x, y, w, h) {
      operations.push({ op: 'fillRect', color: this.fillStyle, x, y, w, h });
    }
  };
  P.draw(mockCtx, layout);
  return operations;
}

for (const map of regions) {
  console.log(`Testing determinism of P.draw for map '${map}' across 50 iterations...`);
  const layout = P.createLayout(map);
  const baselineCalls = recordDrawCalls(layout);
  assert.ok(baselineCalls.length > 0, `Map '${map}' must produce draw calls`);

  for (let iter = 1; iter <= 50; iter++) {
    const iterCalls = recordDrawCalls(layout);
    assert.equal(iterCalls.length, baselineCalls.length, `Iteration ${iter} for '${map}' changed draw call count`);
    for (let c = 0; c < baselineCalls.length; c++) {
      assert.deepStrictEqual(iterCalls[c], baselineCalls[c], `Draw call mismatch in '${map}' at index ${c} on iteration ${iter}`);
    }
  }
  console.log(`  Map '${map}': 50/50 runs produced 100% bit-identical ${baselineCalls.length} draw calls.`);
}

// Test fresh layout generation determinism
for (const map of regions) {
  const layout1 = P.createLayout(map);
  const layout2 = P.createLayout(map);
  const calls1 = recordDrawCalls(layout1);
  const calls2 = recordDrawCalls(layout2);
  assert.deepStrictEqual(calls1, calls2, `Independent layout creations for '${map}' must yield identical draw calls`);
}
console.log('Independent layout creation determinism verified.');
console.log('✔ Task 2 PASSED: P.draw produces 100% identical outputs on repeated calls.\n');

// ===========================================================================
// CHALLENGE TASK 3: Performance & Caching Check
// ===========================================================================
console.log('--- TASK 3: Performance & Caching Verification ---');

// Fresh harness to monitor canvas creations during drawGame()
const perfHarness = createGameHarness();
const perfQA = perfHarness.qa;

// Clear any initial calls
perfHarness.calls.length = 0;
const initialCanvasCount = perfHarness.createdCanvases.length;

console.log(`Initial canvas elements in DOM: ${initialCanvasCount}`);

// Frame 1: Cold start
const t0 = process.hrtime.bigint();
perfQA.drawGame();
const t1 = process.hrtime.bigint();
const coldDurationMs = Number(t1 - t0) / 1e6;

const canvasCountAfterFrame1 = perfHarness.createdCanvases.length;
console.log(`Frame 1 (Cold Start): Duration = ${coldDurationMs.toFixed(3)}ms`);
console.log(`Canvas count after frame 1: ${canvasCountAfterFrame1} (+${canvasCountAfterFrame1 - initialCanvasCount})`);

// Find the drawImage call in Frame 1
const frame1DrawImage = perfHarness.calls.find(c => c.name === 'drawImage');
assert.ok(frame1DrawImage, 'drawGame() must call drawImage to blit terrain');
const cachedCanvasInstance = frame1DrawImage.args[0];
assert.ok(cachedCanvasInstance, 'drawImage argument 0 must be a valid canvas instance');
assert.equal(cachedCanvasInstance.tagName, 'CANVAS', 'Cached instance must be a CANVAS element');

// Frames 2..100: Hot frames
const hotDurations = [];
for (let frame = 2; frame <= 100; frame++) {
  perfHarness.calls.length = 0;
  const startCanvasCount = perfHarness.createdCanvases.length;

  const ft0 = process.hrtime.bigint();
  perfQA.drawGame();
  const ft1 = process.hrtime.bigint();
  hotDurations.push(Number(ft1 - ft0) / 1e6);

  // Assert NO new canvases were created
  assert.equal(perfHarness.createdCanvases.length, startCanvasCount, `Frame ${frame} created a new canvas! terrainCache leak.`);

  // Assert drawImage called with the EXACT SAME canvas instance
  const drawImageCall = perfHarness.calls.find(c => c.name === 'drawImage');
  assert.ok(drawImageCall, `Frame ${frame} did not call drawImage`);
  assert.strictEqual(drawImageCall.args[0], cachedCanvasInstance, `Frame ${frame} used a different canvas instance!`);
}

hotDurations.sort((a, b) => a - b);
const medianHotMs = hotDurations[Math.floor(hotDurations.length / 2)];
const minHotMs = hotDurations[0];
const maxHotMs = hotDurations[hotDurations.length - 1];

console.log(`Frames 2..100 (Hot Caching):`);
console.log(`  Min: ${minHotMs.toFixed(3)}ms, Median: ${medianHotMs.toFixed(3)}ms, Max: ${maxHotMs.toFixed(3)}ms`);
console.log(`  New canvas allocations during 99 hot frames: 0`);
console.log(`  Cached canvas pointer identity: 100% identical`);

// Region switching test: verify terrainCache caches multiple regions
console.log('Testing cross-region caching behavior...');
const state = perfQA.getState();

// Switch to forest
state.map = 'forest';
perfQA.setState(state);
const forestCanvasesBefore = perfHarness.createdCanvases.length;
perfQA.drawGame();
const forestCanvasesAfter = perfHarness.createdCanvases.length;
assert.equal(forestCanvasesAfter, forestCanvasesBefore + 1, 'Switching to forest for the first time must generate exactly 1 cached canvas');

// Draw forest again
perfQA.drawGame();
assert.equal(perfHarness.createdCanvases.length, forestCanvasesAfter, 'Second frame in forest must NOT allocate a canvas');

// Switch back to village
state.map = 'village';
perfQA.setState(state);
const villageReturnCanvases = perfHarness.createdCanvases.length;
perfQA.drawGame();
assert.equal(perfHarness.createdCanvases.length, villageReturnCanvases, 'Returning to village must use existing cached canvas without re-generating');

console.log('✔ Task 3 PASSED: terrain(map) caches in terrainCache; repeated frames execute in O(1) via drawImage(cache).\n');

console.log('================================================================');
console.log('  ALL EMPIRICAL VERIFICATION CHECKS PASSED (100%)');
console.log('================================================================');
