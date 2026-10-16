'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../public/js/game-core.js');
const data = require('../public/js/game-data.js');
const actorArt = require('../public/js/world-actors.js');

function loadGame({ storage = new Map(), saved, search = '?qa=1', hostname = 'localhost', now = 1700000000000, width = 960, height = 600 } = {}) {
  const calls = [], elements = new Map(), raf = [], sockets = [], timers = new Map(), observers = [], clicks = [], downloads = [], objectURLs = new Map();
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
    set(patch) { qa.setState({ ...qa.getState(), ...patch }); },
    async start(name = 'QA Lữ khách') {
      document.getElementById('player-name').value = name;
      await document.getElementById('start-form').dispatch('submit');
    }
  };
}

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 1: Pet Movement Edge Cases
// -------------------------------------------------------------
test('Pet Movement Edge Cases: teleportation, rapid map switching, and boundary clamps', async () => {
  const env = loadGame();
  await env.start();
  const qa = env.qa;
  assert.ok(qa, 'QA hooks available');
  const pet = qa.getPet();
  assert.ok(pet, 'Pet instance exists');

  // Unlock all maps so travel to coast and ruins is permitted
  qa.setState({ ...qa.getState(), upgrades: ['bridge', 'archive'] });

  // 1.1 Player Teleportation across map (>260px away)
  qa.setState({ ...qa.getState(), map: 'village', x: 200, y: 200 });
  pet.x = 1200;
  pet.y = 900;
  assert.ok(Math.hypot(qa.getState().x - pet.x, qa.getState().y - pet.y) > 260, 'Distance is > 260 before update');

  // Trigger update step: pet must snap/teleport back near player
  qa.update(0.1);
  const snapDist = Math.hypot(qa.getState().x - pet.x, qa.getState().y - pet.y);
  assert.ok(snapDist <= 45, `Pet snapped to player on teleportation (current dist: ${snapDist})`);
  assert.equal(pet.moving, false, 'Pet settles after snap');

  // 1.2 Rapid Map Switching (village -> forest -> coast -> ruins -> village)
  const maps = ['forest', 'coast', 'ruins', 'village'];
  for (const nextMap of maps) {
    qa.setState({ ...qa.getState(), map: nextMap, x: 800, y: 550 });
    qa.update(0.05);
    assert.equal(pet.map, nextMap, `Pet map synchronized to ${nextMap}`);
    assert.ok(Number.isFinite(pet.x) && Number.isFinite(pet.y), 'Pet coordinates remain finite numbers');
    assert.ok(pet.x >= 0 && pet.x <= 1600 && pet.y >= 0 && pet.y <= 1200, 'Pet stays within map boundaries');
  }

  // 1.3 Boundary Clamps (Player placed at corners)
  const corners = [
    { x: 32, y: 32 },
    { x: 1568, y: 32 },
    { x: 32, y: 1068 },
    { x: 1568, y: 1068 }
  ];
  for (const corner of corners) {
    qa.setState({ ...qa.getState(), x: corner.x, y: corner.y });
    qa.update(0.1);
    assert.ok(Number.isFinite(pet.x) && Number.isFinite(pet.y), 'Pet coordinates remain finite at corners');
    assert.ok(!Number.isNaN(pet.x) && !Number.isNaN(pet.y), 'Pet coordinates not NaN');
  }

  // 1.4 Deadband settling
  // Distance <= 40 -> moving is false
  // Distance > 45 -> moving becomes true
  const curState = qa.getState();
  pet.x = curState.x - 30;
  pet.y = curState.y;
  qa.update(0.05);
  assert.equal(pet.moving, false, 'Pet stays stationary within deadband <= 40px');

  pet.x = curState.x - 70;
  pet.y = curState.y;
  qa.update(0.05);
  assert.equal(pet.moving, true, 'Pet starts following when distance > 45px');
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 2: Petting Stamina Overflow Protection
// -------------------------------------------------------------
test('Petting Stamina Overflow: stamina strictly capped at 100 under repeated petting', async () => {
  const env = loadGame();
  await env.start();
  const qa = env.qa;

  // 2.1 Starting at stamina 98 -> +2 = 100
  let state = qa.getState();
  state.stamina = 98;
  qa.setState(state);
  qa.petCompanion();
  assert.equal(qa.getState().stamina, 100, 'Stamina 98 + 2 clamps to 100');

  // 2.2 Starting at stamina 99 -> +2 = 100 (not 101)
  state = qa.getState();
  state.stamina = 99;
  qa.setState(state);
  qa.petCompanion();
  assert.equal(qa.getState().stamina, 100, 'Stamina 99 + 2 clamps to 100');

  // 2.3 Starting at stamina 100 -> +2 = 100
  state = qa.getState();
  state.stamina = 100;
  qa.setState(state);
  qa.petCompanion();
  assert.equal(qa.getState().stamina, 100, 'Stamina 100 + 2 clamps to 100');

  // 2.4 Stress test: 100 consecutive pets must never overflow 100
  for (let i = 0; i < 100; i++) {
    qa.petCompanion();
    assert.ok(qa.getState().stamina <= 100, `Stamina overflowed at iteration ${i}: ${qa.getState().stamina}`);
  }
  assert.equal(qa.getState().stamina, 100, 'Final stamina remains exactly 100');
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 3: Corrupted & Legacy Savegame Round-Trip
// -------------------------------------------------------------
test('Savegame Resilience: corrupted crops, negative numbers, prototype pollution, and missing fields', () => {
  // 3.1 Non-object / corrupted primitives
  for (const bad of [null, undefined, 0, false, '', 'corrupted', 12345, [], { version: 999 }]) {
    assert.doesNotThrow(() => {
      const s = core.restoreState(bad, data);
      assert.ok(s, 'Should return a valid state object');
      assert.equal(s.version, 1);
      assert.ok(Array.isArray(s.crops) && s.crops.length === 4);
      assert.ok(s.crops.every(c => c === null || (Number.isFinite(c) && c >= 0)));
      assert.ok(Array.isArray(s.cropTypes) && s.cropTypes.length === 4);
      assert.ok(Array.isArray(s.watered) && s.watered.length === 4);
      assert.equal(typeof s.selectedSeed, 'string');
      assert.ok(s.pet && typeof s.pet === 'object');
      assert.equal(s.pet.type, 'dog');
    }, `Failed on input: ${JSON.stringify(bad)}`);
  }

  // 3.2 Legacy Save (V1 without cropTypes, watered, selectedSeed, pet)
  const legacy = {
    version: 1,
    name: 'Cựu Chiến Binh',
    coins: 500,
    xp: 120,
    health: 80,
    stamina: 60,
    crops: [1700000000000, null, 1700000005000, null]
  };
  const restoredLegacy = core.restoreState(legacy, data);
  assert.equal(restoredLegacy.name, 'Cựu Chiến Binh');
  assert.deepEqual(restoredLegacy.crops, [1700000000000, null, 1700000005000, null]);
  assert.deepEqual(restoredLegacy.cropTypes, ['berry', 'berry', 'berry', 'berry']);
  assert.deepEqual(restoredLegacy.watered, [false, false, false, false]);
  assert.equal(restoredLegacy.selectedSeed, 'berry');
  assert.deepEqual(restoredLegacy.pet, { name: 'Cún Sao', type: 'dog' });

  // 3.3 Corrupted crops array (negatives, string, NaN, objects, missing slots)
  const corruptedCrops = {
    version: 1,
    crops: [-9999, 'invalid_time', NaN, 1700000000000, 999999999]
  };
  const restoredCrops = core.restoreState(corruptedCrops, data);
  assert.equal(restoredCrops.crops.length, 4, 'Crops array is strictly 4 elements');
  assert.equal(restoredCrops.crops[0], null, 'Negative timestamp sanitized to null');
  assert.equal(restoredCrops.crops[1], null, 'String timestamp sanitized to null');
  assert.equal(restoredCrops.crops[2], null, 'NaN timestamp sanitized to null');
  assert.equal(restoredCrops.crops[3], 1700000000000, 'Valid timestamp preserved');

  // 3.4 Prototype pollution attempt
  const polluted = JSON.parse('{"version": 1, "__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "pet": {"__proto__": {"evil": true}, "name": "<script>alert(\'xss\')</script>", "type": "evil-type-!@#"}}');
  const restoredPolluted = core.restoreState(polluted, data);
  assert.equal(Object.prototype.polluted, undefined, 'Global prototype pollution prevented');
  assert.equal(Object.prototype.evil, undefined, 'Pet prototype pollution prevented');
  assert.equal(restoredPolluted.pet.name, "scriptalert('xss')", 'Angle brackets stripped from pet name');
  assert.equal(restoredPolluted.pet.type, 'dog', 'Invalid pet type reset to default dog');

  // 3.5 State symmetry round-trip
  const original = core.createState('Hero', data);
  const serialized = JSON.parse(JSON.stringify(original));
  const restored = core.restoreState(serialized, data);
  assert.deepEqual(restored, original, 'createState and restoreState maintain complete symmetry');
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 4: actorLabels() Village Length Invariant == 10
// -------------------------------------------------------------
test('ActorLabels Invariant: actorLabels() length remains 10 in village with 1 peer, player, and 8 NPCs (Pet excluded)', async () => {
  const env = loadGame();
  await env.start();
  const qa = env.qa;

  // Set player and all village NPCs at village center (crowd fixture)
  qa.setState({ ...qa.getState(), map: 'village', x: 800, y: 810 });
  for (const n of qa.getNPCs().filter(n => n.map === 'village')) {
    n.x = 800;
    n.y = 810;
    n.moving = false;
  }

  // Socket mock with peer-crowd in village and peer-away in forest (same fixture as gameplay.test.js:1474)
  const socket = env.sockets[0];
  assert.ok(socket, 'Socket fixture exists');
  socket.readyState = 1;
  socket.onopen();
  socket.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self' }) });
  socket.onmessage({
    data: JSON.stringify({
      type: 'snapshot',
      players: [
        { id: 'peer-crowd', name: 'Người bạn', map: 'village', x: 800, y: 810, color: '#669988' },
        { id: 'peer-away', name: 'Ở rừng', map: 'forest', x: 800, y: 810, color: '#669988' }
      ]
    })
  });

  // Check actorLabels: exactly 10 tags (1 player + 1 peer in village + 8 village NPCs)
  const tags = qa.getActorLabels();
  assert.equal(tags.length, 10, `actorLabels() count is exactly 10 in village crowd fixture (got ${tags.length})`);
  assert.equal(tags.some(t => t.id === 'pet' || t.name === 'Cún Sao'), false, 'Pet is strictly excluded from actorLabels');

  // Move pet directly onto player and verify actorLabels length is STILL 10
  const pet = qa.getPet();
  pet.x = 800;
  pet.y = 810;
  const tagsWithPetAtCenter = qa.getActorLabels();
  assert.equal(tagsWithPetAtCenter.length, 10, 'actorLabels() length remains 10 even when pet is directly on player anchor');
  assert.equal(tagsWithPetAtCenter.some(t => t.id === 'pet' || t.name === 'Cún Sao'), false, 'Pet remains excluded');

  // Move pet far away and verify again
  pet.x = 0;
  pet.y = 0;
  const tagsWithPetFar = qa.getActorLabels();
  assert.equal(tagsWithPetFar.length, 10, 'actorLabels() length remains 10 when pet is distant');
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 5: 100-Cycle Rapid Map Switching & Distance Fuzzing
// -------------------------------------------------------------
test('Stress Thrashing: 100 consecutive rapid map switches and distance fuzzing', async () => {
  const env = loadGame();
  await env.start();
  const qa = env.qa;
  const pet = qa.getPet();

  qa.setState({ ...qa.getState(), upgrades: ['bridge', 'archive'] });
  const mapList = ['village', 'forest', 'coast', 'ruins'];

  for (let i = 0; i < 100; i++) {
    const targetMap = mapList[i % mapList.length];
    qa.setState({ ...qa.getState(), map: targetMap, x: 500 + (i % 50), y: 500 + (i % 30) });
    qa.update(0.016);
    assert.equal(pet.map, targetMap, `Pet map matches target on cycle ${i}`);
    assert.ok(Number.isFinite(pet.x) && Number.isFinite(pet.y), 'Pet coords finite');
    assert.ok(Math.hypot(qa.getState().x - pet.x, qa.getState().y - pet.y) <= 45, 'Pet stays tethered near player');
  }

  // Distance fuzzing near thresholds: 39, 41, 44, 46, 259, 261
  const player = qa.getState();
  const testDistances = [39, 40, 41, 44, 45, 46, 100, 259, 260, 261, 500, 1000];
  for (const dist of testDistances) {
    pet.x = player.x - dist;
    pet.y = player.y;
    qa.update(0.02);
    assert.ok(Number.isFinite(pet.x) && Number.isFinite(pet.y), `Pet coords finite at dist ${dist}`);
    if (dist > 260) {
      assert.ok(Math.hypot(player.x - pet.x, player.y - pet.y) <= 45, `Pet snapped from distant ${dist}px`);
    }
  }
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 6: Foraging Assist Under Inventory Constraints
// -------------------------------------------------------------
test('Pet Foraging Assist: inventory full behavior and item validation', async () => {
  const env = loadGame();
  await env.start();
  const qa = env.qa;

  // Max out inventory
  const state = qa.getState();
  const maxCap = core.capacity(state);
  for (const item of Object.keys(data.items)) {
    state.inventory[item] = maxCap;
  }
  qa.setState(state);

  // Attempt foraging assist with full bag
  qa.petForage('berry');
  assert.equal(qa.getState().inventory.berry, maxCap, 'Inventory remains capped, no overflow');

  // Free 1 slot for berry
  state.inventory.berry = maxCap - 1;
  qa.setState(state);
  qa.petForage('berry');
  assert.equal(qa.getState().inventory.berry, maxCap, 'Foraged berry successfully picked up to max cap');
});

