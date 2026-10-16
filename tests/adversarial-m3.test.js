'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../public/js/game-core.js');
const data = require('../public/js/game-data.js');

function loadGame({ storage = new Map(), saved, search = '?qa=1', hostname = 'localhost', now = 1700000000000, width = 960, height = 600 } = {}) {
  const calls = [], elements = new Map(), raf = [], sockets = [], timers = new Map(), observers = [];
  const markup = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  let clock = now, performanceClock = 0, created = 0, timerId = 0;

  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
    removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(listener => listener !== fn)); }
    async dispatch(type, event = {}) {
      const e = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...event };
      for (let target = this; target; target = e.bubbles === false || e.propagationStopped ? null : target.parent) {
        e.currentTarget = target;
        for (const listener of target.listeners.get(type) || []) await listener(e);
      }
      return e;
    }
  }

  class Element extends Target {
    constructor(id, tagName = 'DIV') {
      super(); this.id = id; this.tagName = tagName; this.dataset = {}; this.attributes = {};
      this.style = { setProperty(name, value) { this[name] = String(value); }, getPropertyValue(name) { return this[name] || ''; }, removeProperty(name) { delete this[name]; } };
      this.children = []; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.open = false; this.width = 960; this.height = 600; this.capturedPointers = new Set();
      const classes = new Set(); this.classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n) };
    }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
    append(child) { child.parent = this; this.children.push(child); }
    get firstChild() { return this.children[0]; }
    get scrollHeight() { return this.children.length; }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    matches(selector) {
      return selector.split(',').some(part => {
        const value = part.trim();
        if (value.startsWith('#')) return this.id === value.slice(1);
        const attributeValue = value.match(/^\[([-\w]+)="([^"]*)"\]$/); if (attributeValue) return this.getAttribute(attributeValue[1]) === attributeValue[2];
        if (/^\[[-\w]+\]$/.test(value)) return this.hasAttribute(value.slice(1, -1));
        return this.tagName === value.toUpperCase();
      });
    }
    closest(selector) { for (let element = this; element instanceof Element; element = element.parent) if (element.matches(selector)) return element; return null; }
    contains(child) { for (let element = child; element; element = element.parent) if (element === this) return true; return false; }
    showModal() { this.open = true; }
    close() { this.open = false; void this.dispatch('close'); }
    setPointerCapture(pointerId) { this.capturedPointers.add(pointerId); }
    hasPointerCapture(pointerId) { return this.capturedPointers.has(pointerId); }
    releasePointerCapture(pointerId) { if (this.capturedPointers.delete(pointerId)) void this.dispatch('lostpointercapture', { pointerId }); }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height, x: 0, y: 0 }; }
    focus() { document.activeElement = this; void this.dispatch('focus', { bubbles: false }); }
    blur() { if (document.activeElement === this) document.activeElement = null; void this.dispatch('blur', { bubbles: false }); }
    click() { void this.dispatch('click'); }
    getContext() { if (!this.context) this.context = makeContext(this); return this.context; }
  }

  function makeContext(element) {
    const c = { canvas: element, globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', strokeStyle: '', font: '', textAlign: '', stack: [] };
    const add = (name, args) => calls.push({ context: element.id, name, args: Array.from(args) });
    for (const name of ['fillRect', 'clearRect', 'drawImage', 'translate', 'scale', 'rotate', 'fillText', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'closePath', 'arc', 'ellipse', 'clip', 'quadraticCurveTo', 'bezierCurveTo', 'setLineDash']) c[name] = function (...args) { add(name, args); };
    c.save = () => { add('save', []); };
    c.restore = () => { add('restore', []); };
    c.createRadialGradient = () => ({ addColorStop() {} });
    return c;
  }

  const document = new Target(); document.activeElement = null; document.hidden = false;
  document.getElementById = id => {
    if (!elements.has(id)) {
      const element = new Element(id, /Canvas$/.test(id) ? 'CANVAS' : /form$/.test(id) ? 'FORM' : ['player-name', 'chat-input'].includes(id) ? 'INPUT' : id === 'btn-home' ? 'A' : id === 'game-dialog' ? 'DIALOG' : /^(btn-|touch-)/.test(id) || id === 'dialog-close' ? 'BUTTON' : 'DIV');
      const tag = markup.match(new RegExp(`<([\\w-]+)\\b([^>]*\\bid="${id}"[^>]*)>`));
      if (tag) {
        element.tagName = tag[1].toUpperCase();
        for (const attribute of tag[2].matchAll(/([-\w:]+)(?:="([^"]*)")?/g)) element.setAttribute(attribute[1], attribute[2] ?? '');
        element.hidden = element.hasAttribute('hidden');
      }
      elements.set(id, element);
    }
    return elements.get(id);
  };
  document.createElement = tag => new Element(`created-${created++}`, tag.toUpperCase());
  document.createTextNode = text => ({ textContent: String(text) });
  document.querySelectorAll = () => [];
  document.documentElement = new Element('document-root', 'HTML');
  document.body = new Element('document-body', 'BODY');
  document.documentElement.parent = document;
  document.documentElement.append(document.body);

  const window = new Target();
  window.innerWidth = width;
  window.innerHeight = height;
  const visualViewport = new Target();
  visualViewport.width = width; visualViewport.height = height; visualViewport.scale = 1;
  window.visualViewport = visualViewport;

  const motionPreference = new Target(); motionPreference.matches = false;
  const displayMode = new Target(); displayMode.matches = false;
  window.matchMedia = query => query === '(display-mode: standalone)' ? displayMode : motionPreference;
  window.navigator = { userAgent: '', platform: '', maxTouchPoints: 0, standalone: false };

  class FakeDate extends Date { static now() { return clock; } }
  class FakeSocket {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    send(text) { this.sent.push(JSON.parse(text)); }
    close() { this.readyState = 3; if (this.onclose) this.onclose(); }
  }
  class FakeResizeObserver { constructor(callback) { this.callback = callback; observers.push(this); } observe() { this.callback(); } }

  const sandbox = {
    document, window, navigator: window.navigator,
    location: { search, protocol: 'http:', host: `${hostname}:4173`, hostname },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)) },
    Date: FakeDate, performance: { now: () => performanceClock },
    URLSearchParams, structuredClone, WebSocket: FakeSocket,
    ResizeObserver: FakeResizeObserver,
    requestAnimationFrame: cb => raf.push(cb),
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    setInterval: () => 0, clearInterval: () => {},
    console
  };

  vm.createContext(sandbox);
  for (const [, file] of markup.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8'), sandbox, { filename: file });
  }

  const qa = sandbox.StardropQA;
  assert.ok(qa, 'StardropQA initialized');

  return {
    qa,
    elements,
    sandbox,
    sockets,
    document,
    window,
    el: id => document.getElementById(id),
    advance(ms) { clock += ms; performanceClock += ms; },
    step(seconds) { this.advance(seconds * 1000); qa.update(seconds); },
    set(patch) { qa.setState({ ...qa.getState(), ...patch }); },
    at(o, patch = {}) { this.set({ map: o.map || qa.getState().map, x: o.x, y: o.y, ...patch }); },
    async start(name = 'QA Lữ khách') {
      document.getElementById('player-name').value = name;
      await document.getElementById('start-form').dispatch('submit');
    },
    async key(key, type = 'keydown', extra = {}) {
      await document.dispatch(type, { key, repeat: false, ...extra });
    }
  };
}

const objects = (e, map = e.qa.getState().map) => e.qa.getWorld()[map].objects;
const object = (e, kind, item, map) => objects(e, map).find(o => o.kind === kind && (!item || o.item === item));

// ============================================================================
// TEST SUITE 1: Precision Timing Windows & Oscillation Boundaries
// ============================================================================
test('Fishing Timing Window: Precision verification of sweet spot [0.38, 0.62] vs misses', async () => {
  const e = loadGame();
  await e.start();
  const spot = object(e, 'fish');
  e.at(spot);

  // Math model: position = (sin(elapsed * 3.8 - pi/2) + 1) / 2
  // 1. At elapsed = 0: position = 0 -> MISS
  e.qa.interact(); // starts fishing
  assert.equal(e.el('fishing').hidden, false);
  e.qa.interact(); // pull immediately at t = 0
  let s = e.qa.getState();
  assert.equal(s.inventory.fish, 0, 'Miss at t=0 (position 0)');
  assert.equal(e.el('fishing').hidden, true);

  // 2. Exact lower boundary entry:
  // position = 0.38 when sin(t * 3.8 - pi/2) = -0.24
  // t_entry = (asin(-0.24) + pi/2) / 3.8 ~ 0.349568s
  // Test slightly before entry: t = 0.30s -> position ~ 0.309 < 0.38 -> MISS
  e.qa.interact();
  e.step(0.30);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 0, 'Miss at t=0.30s (position < 0.38)');

  // Test inside sweet spot: t = 0.38s -> position ~ 0.435 -> CATCH
  e.qa.interact();
  e.step(0.38);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 1, 'Catch at t=0.38s (inside sweet spot [0.38, 0.62])');
  assert.equal(s.stats['fish:fish'], 1);

  // Test sweet spot center: t = pi / 2 / 3.8 ~ 0.41337s -> position = 0.50 -> CATCH
  e.qa.interact();
  e.step(Math.PI / 2 / 3.8);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 2, 'Catch at center sweet spot position = 0.50');
  assert.equal(s.stats['fish:fish'], 2);

  // Test inside upper half of sweet spot: t = 0.45s -> position ~ 0.575 -> CATCH
  e.qa.interact();
  e.step(0.45);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 3, 'Catch at t=0.45s (position ~ 0.575)');

  // Test past upper boundary: t_exit ~ 0.477s.
  // Test at t = 0.55s -> position ~ 0.73 > 0.62 -> MISS
  e.qa.interact();
  e.step(0.55);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 3, 'Miss at t=0.55s (position ~ 0.73 > 0.62)');

  // Test peak crest: t = pi / 3.8 ~ 0.8267s -> position = 1.0 -> MISS
  e.qa.interact();
  e.step(Math.PI / 3.8);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 3, 'Miss at peak t=0.8267s (position = 1.0)');

  // Test descent back into sweet spot: t = 1.20s -> position ~ 0.56 -> CATCH
  e.qa.interact();
  e.step(1.20);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 4, 'Catch on descending swing at t=1.20s');

  // Test trough valley: t = 2 * pi / 3.8 ~ 1.6535s -> position = 0.0 -> MISS
  e.qa.interact();
  e.step(2 * Math.PI / 3.8);
  e.qa.interact();
  s = e.qa.getState();
  assert.equal(s.inventory.fish, 4, 'Miss at valley t=1.6535s (position = 0.0)');
});

// ============================================================================
// TEST SUITE 2: Tension Bar Dynamics (Build, Decay, Auto-catch at 1.0)
// ============================================================================
test('Tension Bar Dynamics: Accumulation in zone, decay outside zone, and automatic catch at 1.0', async () => {
  const e = loadGame();
  await e.start();
  const spot = object(e, 'fish');
  e.at(spot);

  // 1. Initial tension is 0%
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false);
  const tensionBar = e.el('fish-tension-bar');
  assert.equal(tensionBar.style.width, '0%');

  // 2. Accumulation when in zone:
  e.step(0.413);
  const widthAfterInZone = parseFloat(tensionBar.style.width);
  assert.ok(widthAfterInZone > 0, `Tension accumulated: ${widthAfterInZone}%`);

  // Step into crest outside zone (t reaches 0.826s, position ~ 1.0 > 0.62)
  e.step(0.413);
  const peakWidth = parseFloat(tensionBar.style.width);
  e.step(0.1); // still outside zone at crest
  const decayWidth = parseFloat(tensionBar.style.width);
  assert.ok(decayWidth <= peakWidth, `Tension decays outside zone: ${decayWidth}% <= ${peakWidth}%`);

  // Cancel to clean up
  await e.key('Escape');
  assert.equal(e.el('fishing').hidden, true);

  // 3. Continuous tension accumulation leading to AUTO-CATCH at tension = 1.0
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false);
  const fishBeforeAuto = e.qa.getState().inventory.fish;

  let autoClosed = false;
  for (let step = 0; step < 100; step++) {
    e.step(0.04);
    if (e.el('fishing').hidden) {
      autoClosed = true;
      break;
    }
  }

  assert.ok(autoClosed, 'Fishing modal auto-closed when tension bar reached 1.0');
  const sAfterAuto = e.qa.getState();
  assert.equal(sAfterAuto.inventory.fish, fishBeforeAuto + 1, 'Fish caught automatically by tension filling to 100%');
  assert.equal(sAfterAuto.stats['fish:fish'], 1, 'Fish quest stat recorded');
});

// ============================================================================
// TEST SUITE 3: Key Interaction & Pull Timing via Keyboard
// ============================================================================
test('Key Interaction: Pressing E or Enter during fishing finishes the catch attempt', async () => {
  const e = loadGame();
  await e.start();
  const spot = object(e, 'fish');
  e.at(spot);

  // 1. Pressing E when phao is inside sweet spot triggers instant successful catch
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false);
  e.step(Math.PI / 2 / 3.8); // inside sweet spot
  await e.key('e'); // pressing 'e' key
  assert.equal(e.el('fishing').hidden, true, 'Fishing modal closed by E key press');
  assert.equal(e.qa.getState().inventory.fish, 1, 'Fish caught via E key press');

  // 2. Pressing Enter when phao is inside sweet spot also catches
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false);
  e.step(Math.PI / 2 / 3.8);
  await e.key('Enter');
  assert.equal(e.el('fishing').hidden, true, 'Fishing modal closed by Enter key press');
  assert.equal(e.qa.getState().inventory.fish, 2, 'Fish caught via Enter key press');

  // 3. Pressing E outside sweet spot results in miss
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false);
  // at t=0, phao is at 0 (outside)
  await e.key('e');
  assert.equal(e.el('fishing').hidden, true);
  assert.equal(e.qa.getState().inventory.fish, 2, 'No fish caught on miss via E key');
});

// ============================================================================
// TEST SUITE 4: Edge Conditions (Stamina Depletion, Esc Canceling, Bag 100)
// ============================================================================
test('Edge Conditions: Stamina depletion prevents fishing (<6), Escape cancels cleanly, full bag prevents catch', async () => {
  const e = loadGame();
  await e.start();
  const spot = object(e, 'fish');
  e.at(spot);

  // Initial state: #fishing is hidden
  assert.equal(e.el('fishing').hidden, true);

  // 1. Stamina depletion: stamina < 6 cannot start fishing
  for (const invalidStamina of [5, 4, 1, 0]) {
    e.set({ stamina: invalidStamina });
    e.qa.interact();
    assert.equal(e.el('fishing').hidden, true, `Fishing blocked when stamina = ${invalidStamina}`);
  }

  // Exactly 6 stamina allows fishing and drops stamina to 0
  e.set({ stamina: 6 });
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false, 'Fishing allowed when stamina = 6');
  e.step(Math.PI / 2 / 3.8);
  e.qa.interact();
  assert.equal(e.qa.getState().stamina, 0, 'Stamina drops to exactly 0 (no negative stamina)');
  assert.equal(e.qa.getState().inventory.fish, 1);

  // 2. Escape canceling:
  // Restores stamina, starts fishing, presses Escape -> no stamina deducted, no fish
  e.set({ stamina: 100 });
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false);
  e.step(0.4); // partially into sweet spot, tension building
  assert.ok(parseFloat(e.el('fish-tension-bar').style.width) > 0);
  await e.key('Escape');
  assert.equal(e.el('fishing').hidden, true, 'Fishing modal closed by Escape');
  assert.equal(e.qa.getState().stamina, 100, 'Zero stamina consumed on Escape cancel');
  assert.equal(e.qa.getState().inventory.fish, 1, 'No fish awarded on Escape cancel');

  // Verify reopening after Escape starts fresh with 0 tension
  e.qa.interact();
  assert.equal(e.el('fish-tension-bar').style.width, '0%', 'Tension reset to 0% after cancel');
  await e.key('Escape');

  // 3. Full fish bag: 100 fish in inventory
  let s = e.qa.getState();
  s.inventory.fish = 100;
  e.set(s);
  assert.equal(e.qa.getState().inventory.fish, 100);

  // Interacting and succeeding with full bag
  e.qa.interact();
  assert.equal(e.el('fishing').hidden, false);
  e.step(Math.PI / 2 / 3.8);
  const staminaBeforeCatch = e.qa.getState().stamina;
  e.qa.interact();

  // Verifications:
  assert.equal(e.qa.getState().inventory.fish, 100, 'Fish bag capped at 100, cannot exceed capacity');
  assert.equal(e.el('fishing').hidden, true, 'Modal closed after full bag attempt');
  assert.equal(e.qa.getState().stamina, staminaBeforeCatch - 6, 'Stamina consumed on fishing attempt even if bag full');
});

// ============================================================================
// TEST SUITE 5: Input Isolation & Immobility during Fishing
// ============================================================================
test('Input Isolation: Player movement is frozen during fishing, no position change', async () => {
  const e = loadGame();
  await e.start();
  const spot = object(e, 'fish');
  e.at(spot);

  const startX = e.qa.getState().x;
  const startY = e.qa.getState().y;

  e.qa.interact(); // start fishing
  assert.equal(e.el('fishing').hidden, false);

  // Send movement keys
  await e.key('w', 'keydown');
  await e.key('d', 'keydown');
  e.step(0.2);

  assert.equal(e.qa.getState().x, startX, 'X coordinate did not change while fishing');
  assert.equal(e.qa.getState().y, startY, 'Y coordinate did not change while fishing');
  assert.equal(e.qa.getState().moving, false, 'moving state is false while fishing');

  await e.key('w', 'keyup');
  await e.key('d', 'keyup');
  await e.key('Escape');
});

// ============================================================================
// TEST SUITE 6: Cloud Ruins Stele Sequence & Secret Chest Stress Testing
// ============================================================================
test('Cloud Ruins Puzzle: All stele sequence permutations, chest isolation, capacity checks', async () => {
  const e = loadGame();
  await e.start();
  // Enable upgrades but without 'bag' upgrade so capacity is exactly 100
  const upgradesWithoutBag = e.qa.data.upgrades.map(u => u.id).filter(id => id !== 'bag');
  e.set({ map: 'ruins', x: 800, y: 550, upgrades: upgradesWithoutBag });

  const ruinsObjs = objects(e, 'ruins');
  const west = ruinsObjs.find(o => o.id === 'stele-ruins-west');
  const north = ruinsObjs.find(o => o.id === 'stele-ruins-north');
  const east = ruinsObjs.find(o => o.id === 'stele-ruins-east');
  const secretChest = ruinsObjs.find(o => o.id === 'chest-ruins-secret');

  assert.ok(west && north && east && secretChest);

  // 1. Locked chest cannot be looted before solving
  e.at(secretChest);
  e.qa.interact();
  assert.equal(e.qa.getState().chests.includes('chest-ruins-secret'), false);

  // 2. Out-of-order activations:
  // North first -> fails
  e.at(north); e.qa.interact();
  assert.equal(e.qa.getState().puzzles.includes('ruins-steles'), false);

  // East first -> fails
  e.at(east); e.qa.interact();
  assert.equal(e.qa.getState().puzzles.includes('ruins-steles'), false);

  // West -> East (skip North) -> resets
  e.at(west); e.qa.interact(); // 1/3
  e.at(east); e.qa.interact(); // resets!
  assert.equal(e.qa.getState().puzzles.includes('ruins-steles'), false);

  // West -> West (double tap) -> stays at 1/3
  e.at(west); e.qa.interact();
  e.at(west); e.qa.interact();
  assert.equal(e.qa.getState().puzzles.includes('ruins-steles'), false);

  // West -> North -> North (double tap) -> stays at 2/3
  e.at(north); e.qa.interact();
  e.at(north); e.qa.interact();
  assert.equal(e.qa.getState().puzzles.includes('ruins-steles'), false);

  // West -> North -> West (wrong third) -> resets
  e.at(west); e.qa.interact();
  assert.equal(e.qa.getState().puzzles.includes('ruins-steles'), false);

  // 3. Perfect sequence: West -> North -> East
  e.at(west); e.qa.interact();
  e.at(north); e.qa.interact();
  e.at(east); e.qa.interact();
  assert.ok(e.qa.getState().puzzles.includes('ruins-steles'), 'Puzzle solved and recorded in puzzles array');

  // Re-interacting with steles after completion does not crash or reset
  e.at(west); e.qa.interact();
  assert.ok(e.qa.getState().puzzles.includes('ruins-steles'));

  // 4. Secret Chest Bag Capacity Protection:
  // Chest gives +3 crystals and +3 stars. Capacity is 100 (without bag upgrade).
  // Set crystals = 98 (98 + 3 = 101 > 100) -> cannot open!
  let s = e.qa.getState();
  s.inventory.crystal = 98;
  e.set(s);
  e.at(secretChest);
  e.qa.interact();
  assert.equal(e.qa.getState().chests.includes('chest-ruins-secret'), false, 'Chest rejected when crystal capacity exceeded');

  // Set stars = 98 -> cannot open!
  s = e.qa.getState();
  s.inventory.crystal = 10;
  s.inventory.star = 98;
  e.set(s);
  e.at(secretChest);
  e.qa.interact();
  assert.equal(e.qa.getState().chests.includes('chest-ruins-secret'), false, 'Chest rejected when star capacity exceeded');

  // Free capacity: opens successfully!
  s = e.qa.getState();
  s.inventory.star = 10;
  e.set(s);
  const coinsBefore = s.coins;
  const xpBefore = s.xp;
  e.at(secretChest);
  e.qa.interact();

  const afterChest = e.qa.getState();
  assert.ok(afterChest.chests.includes('chest-ruins-secret'), 'Secret chest recorded in chests array');
  assert.equal(afterChest.coins, coinsBefore + 120, '+120 coins awarded');
  assert.equal(afterChest.xp, xpBefore + 50, '+50 XP awarded');
  assert.equal(afterChest.inventory.crystal, 13, '+3 crystals awarded');
  assert.equal(afterChest.inventory.star, 13, '+3 stars awarded');
  assert.equal(afterChest.stats['chest:treasure'], 1, 'Chest quest objective tracked');

  // Re-opening chest yields no extra rewards
  e.qa.interact();
  assert.equal(e.qa.getState().coins, afterChest.coins, 'No duplicate rewards on chest re-interaction');
});

// ============================================================================
// TEST SUITE 7: Savegame Sanitization & Backward Compatibility
// ============================================================================
test('Savegame Backward Compatibility & Sanitization: Malformed puzzles sanitized cleanly', () => {
  // 1. Missing puzzles field defaults to []
  const fresh = core.createState('Tester', data);
  assert.ok(Array.isArray(fresh.puzzles));
  assert.equal(fresh.puzzles.length, 0);

  // 2. Legacy save without puzzles restores to []
  const legacy = { version: 1, name: 'Old', coins: 100, xp: 50 };
  const restoredLegacy = core.restoreState(legacy, data);
  assert.ok(Array.isArray(restoredLegacy.puzzles));
  assert.equal(restoredLegacy.puzzles.length, 0);

  // 3. Malformed puzzles values (non-array, numbers, objects) sanitized to []
  for (const badPuzzles of [null, undefined, 'ruins-steles', 123, { id: 'ruins-steles' }, true]) {
    const corrupted = { ...legacy, puzzles: badPuzzles };
    const restored = core.restoreState(corrupted, data);
    assert.deepEqual(restored.puzzles, [], `Bad puzzles type ${typeof badPuzzles} must restore as empty array`);
  }

  // 4. Dirty puzzle array with injection / prototype pollution / non-string keys
  const dirtyPuzzles = ['ruins-steles', '<script>alert(1)</script>', '__proto__', 'constructor', 'invalid key with spaces', 999, null];
  const dirtySave = { ...legacy, puzzles: dirtyPuzzles };
  const restoredDirty = core.restoreState(dirtySave, data);
  assert.ok(restoredDirty.puzzles.includes('ruins-steles'), 'Valid safe key preserved');
  assert.ok(!restoredDirty.puzzles.includes('<script>alert(1)</script>'), 'Unsafe key stripped');
  assert.ok(!restoredDirty.puzzles.includes('invalid key with spaces'), 'Spaces stripped');
  assert.ok(!restoredDirty.puzzles.includes(999), 'Numbers stripped');
  assert.ok(!restoredDirty.puzzles.includes(null), 'Nulls stripped');
});
