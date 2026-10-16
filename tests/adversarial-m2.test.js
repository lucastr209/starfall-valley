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
    },
    async button(data) {
      const b = new Element('virtual-button', 'BUTTON');
      Object.entries(data).forEach(([key, value]) => {
        b.setAttribute(`data-${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`, value);
      });
      await document.dispatch('click', { target: b });
    }
  };
}

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 1: Gifting Boundary Conditions
// -------------------------------------------------------------
test('Adversarial Gifting: Count = 0, negative counts, non-existent NPC, double-gifting, invalid items', () => {
  const s = core.createState('Tester', data);

  // 1. Gifting item player does not own (count = 0)
  assert.equal(s.inventory.star, 0);
  const resZero = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resZero.ok, false);
  assert.equal(resZero.success, false);
  assert.equal(s.friendship.mira.points, 0);
  assert.equal(s.friendship.mira.giftedToday, false);
  assert.equal(s.inventory.star, 0);

  // 2. Gifting with negative item count in inventory (e.g. corrupted inventory)
  s.inventory.star = -3;
  const resNeg = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resNeg.ok, false);
  assert.equal(resNeg.success, false);
  assert.equal(s.friendship.mira.points, 0);
  assert.equal(s.inventory.star, -3); // Not further decremented

  // 3. Gifting non-existent NPC ID
  s.inventory.wood = 5;
  const resBadNpc = core.giveGift(s, 'non_existent_npc', 'wood', data);
  assert.equal(resBadNpc.ok, false);
  assert.equal(resBadNpc.success, false);
  assert.equal(s.inventory.wood, 5);

  // 4. Gifting invalid item IDs (not in catalog, prototype pollution keys)
  for (const badItem of ['__proto__', 'constructor', 'invalid_ruby', null, undefined, 123]) {
    const resBadItem = core.giveGift(s, 'mira', badItem, data);
    assert.equal(resBadItem.ok, false);
    assert.equal(resBadItem.success, false);
  }

  // 5. Gifting twice on the same day
  s.inventory.star = 2;
  const resFirst = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resFirst.ok, true);
  assert.equal(resFirst.success, true);
  assert.equal(resFirst.tier, 'loved');
  assert.equal(resFirst.pointsDelta, 80);
  assert.equal(s.friendship.mira.points, 80);
  assert.equal(s.friendship.mira.giftedToday, true);
  assert.equal(s.inventory.star, 1);

  // Attempting second gift on same day must be rejected
  const resSecond = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resSecond.ok, false);
  assert.equal(resSecond.success, false);
  assert.match(resSecond.message, /Hôm nay bạn đã tặng quà/);
  assert.equal(s.friendship.mira.points, 80, 'Points must not increase on rejected second gift');
  assert.equal(s.inventory.star, 1, 'Inventory must not be decremented on rejected second gift');

  // Third attempt with different item also rejected
  s.inventory.tea = 5;
  const resThird = core.giveGift(s, 'mira', 'tea', data);
  assert.equal(resThird.ok, false);
  assert.equal(resThird.success, false);
  assert.equal(s.inventory.tea, 5);
  assert.equal(s.friendship.mira.points, 80);

  // 6. After nextDay(), gifting works again
  core.nextDay(s, data);
  assert.equal(s.friendship.mira.giftedToday, false);
  const resNextDay = core.giveGift(s, 'mira', 'tea', data);
  assert.equal(resNextDay.ok, true);
  assert.equal(resNextDay.tier, 'liked');
  assert.equal(resNextDay.pointsDelta, 45);
  assert.equal(s.friendship.mira.points, 125);
  assert.equal(s.inventory.tea, 4);
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 2: FP Score Clamping Underflow & Overflow
// -------------------------------------------------------------
test('Adversarial Clamping: Strict boundaries [0, 500] under heavy negative and positive stress', () => {
  const s = core.createState('Tester', data);

  // --- UNDERFLOW RESILIENCE ---
  // Mira dislikes ore (-15)
  s.inventory.ore = 100;
  assert.equal(s.friendship.mira.points, 0);

  // 1. Disliked gift when points = 0 -> must clamp to 0
  const resUnder1 = core.giveGift(s, 'mira', 'ore', data);
  assert.equal(resUnder1.ok, true);
  assert.equal(resUnder1.pointsDelta, -15);
  assert.equal(s.friendship.mira.points, 0, 'FP must not drop below 0');

  // 2. Loop 50 days of disliked gifts at 0 FP
  for (let day = 0; day < 50; day++) {
    core.nextDay(s, data);
    core.giveGift(s, 'mira', 'ore', data);
    assert.equal(s.friendship.mira.points, 0, `Day ${day}: FP must remain strictly 0`);
  }

  // 3. Start at 10 FP, disliked gift (-15) -> clamp to 0 (not -5)
  core.nextDay(s, data);
  s.friendship.mira.points = 10;
  core.giveGift(s, 'mira', 'ore', data);
  assert.equal(s.friendship.mira.points, 0, 'FP 10 - 15 must clamp to 0');

  // --- OVERFLOW RESILIENCE ---
  // Mira loves meal (+80)
  s.inventory.meal = 100;
  s.friendship.mira.points = 480;

  // 4. Loved gift when points = 480 -> 480 + 80 = 560 -> clamp to 500
  core.nextDay(s, data);
  const resOver1 = core.giveGift(s, 'mira', 'meal', data);
  assert.equal(resOver1.ok, true);
  assert.equal(s.friendship.mira.points, 500, 'FP must clamp to 500');

  // 5. Talking when points = 500 -> must remain 500
  core.nextDay(s, data);
  core.event(s, 'talk', 'mira', 1, data);
  assert.equal(s.friendship.mira.points, 500, 'Talking at 500 FP must not exceed 500');

  // 6. Loop 50 days of loved gifts and conversations at 500 FP
  for (let day = 0; day < 50; day++) {
    core.nextDay(s, data);
    core.event(s, 'talk', 'mira', 1, data);
    assert.equal(s.friendship.mira.points, 500);
    core.giveGift(s, 'mira', 'meal', data);
    assert.equal(s.friendship.mira.points, 500, `Day ${day}: FP must never exceed 500`);
  }
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 3: Daily Conversation Bonus (+10 FP)
// -------------------------------------------------------------
test('Adversarial Conversation: Daily +10 FP given exactly once per day, reset on nextDay, isolated per NPC', () => {
  const s = core.createState('Tester', data);

  // Day 1
  assert.equal(s.friendship.mira.points, 0);
  assert.equal(s.friendship.mira.talkedToday, false);
  assert.equal(s.friendship.huy.points, 0);
  assert.equal(s.friendship.huy.talkedToday, false);

  // 1. Talk to Mira: +10 FP
  const talk1 = core.event(s, 'talk', 'mira', 1, data);
  assert.equal(talk1, true);
  assert.equal(s.friendship.mira.points, 10);
  assert.equal(s.friendship.mira.talkedToday, true);

  // 2. Stress: 100 consecutive talk events to Mira on Day 1
  for (let i = 0; i < 100; i++) {
    core.event(s, 'talk', 'mira', 1, data);
    assert.equal(s.friendship.mira.points, 10, 'Repeated conversation must never grant bonus again on same day');
  }

  // 3. Isolated per NPC: Talking to Mira did NOT mark Huy as talkedToday
  assert.equal(s.friendship.huy.talkedToday, false);
  assert.equal(s.friendship.huy.points, 0);
  core.event(s, 'talk', 'huy', 1, data);
  assert.equal(s.friendship.huy.points, 10);
  assert.equal(s.friendship.huy.talkedToday, true);

  // 4. Advance to Day 2 via nextDay()
  core.nextDay(s, data);
  assert.equal(s.friendship.mira.talkedToday, false);
  assert.equal(s.friendship.huy.talkedToday, false);
  assert.equal(s.friendship.mira.points, 10, 'Points carry over across days');
  assert.equal(s.friendship.huy.points, 10);

  // Talk on Day 2 grants +10 again
  core.event(s, 'talk', 'mira', 1, data);
  assert.equal(s.friendship.mira.points, 20);
  assert.equal(s.friendship.mira.talkedToday, true);

  // Another 50 spam talks on Day 2
  for (let i = 0; i < 50; i++) {
    core.event(s, 'talk', 'mira', 1, data);
  }
  assert.equal(s.friendship.mira.points, 20);

  // Advance to Day 3
  core.nextDay(s, data);
  core.event(s, 'talk', 'mira', 1, data);
  assert.equal(s.friendship.mira.points, 30);
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 4: All 11 NPCs Integrity and Preference Matrix
// -------------------------------------------------------------
test('Adversarial Catalog: All 11 NPCs define valid preferences, reactions, dialogues and rewards', () => {
  const expectedNpcIds = ['mira', 'huy', 'linh', 'thao', 'bao', 'nam', 'yen', 'son', 'sen', 'kiet', 'ly'];
  assert.equal(data.npcs.length, 11);
  assert.deepEqual(data.npcs.map(n => n.id), expectedNpcIds);

  const validItemIds = Object.keys(data.items);

  for (const npc of data.npcs) {
    // 1. Gift preferences
    assert.ok(npc.giftPreferences, `NPC ${npc.id} must have giftPreferences`);
    for (const tier of ['loved', 'liked', 'neutral', 'disliked']) {
      assert.ok(Array.isArray(npc.giftPreferences[tier]), `NPC ${npc.id} must have array for tier ${tier}`);
      assert.ok(npc.giftPreferences[tier].length > 0, `NPC ${npc.id} must have non-empty array for tier ${tier}`);
      for (const itemId of npc.giftPreferences[tier]) {
        assert.ok(validItemIds.includes(itemId), `NPC ${npc.id} tier ${tier} item '${itemId}' must exist in data.items`);
      }
    }

    // 2. Gift reactions
    assert.ok(npc.giftReactions, `NPC ${npc.id} must have giftReactions`);
    for (const tier of ['loved', 'liked', 'neutral', 'disliked']) {
      assert.equal(typeof npc.giftReactions[tier], 'string', `NPC ${npc.id} reaction for ${tier} must be string`);
      assert.ok(npc.giftReactions[tier].length > 5, `NPC ${npc.id} reaction for ${tier} must be descriptive`);
    }

    // 3. Heart dialogues (2, 4, 5)
    assert.ok(npc.heartDialogues, `NPC ${npc.id} must have heartDialogues`);
    for (const lvl of [2, 4, 5]) {
      assert.equal(typeof npc.heartDialogues[lvl], 'string', `NPC ${npc.id} dialogue for heart ${lvl} must be string`);
      assert.ok(npc.heartDialogues[lvl].length > 10, `NPC ${npc.id} dialogue for heart ${lvl} must be descriptive`);
    }

    // 4. Milestone rewards (2, 4, 5)
    assert.ok(npc.milestoneRewards, `NPC ${npc.id} must have milestoneRewards`);
    for (const lvl of [2, 4, 5]) {
      const reward = npc.milestoneRewards[lvl];
      assert.ok(reward && typeof reward === 'object', `NPC ${npc.id} reward for heart ${lvl} must be object`);
      const hasCoins = typeof reward.coins === 'number' && reward.coins > 0;
      const hasRenown = typeof reward.renown === 'number' && reward.renown > 0;
      const hasItems = reward.items && Object.keys(reward.items).length > 0;
      assert.ok(hasCoins || hasRenown || hasItems, `NPC ${npc.id} reward for heart ${lvl} must grant at least coins, renown, or items`);
    }

    // 5. Test gifting in each tier for this NPC
    const s = core.createState('Tester', data);
    for (const tier of ['loved', 'liked', 'neutral', 'disliked']) {
      const item = npc.giftPreferences[tier][0];
      s.inventory[item] = 10;
      const res = core.giveGift(s, npc.id, item, data);
      assert.equal(res.ok, true, `giveGift to ${npc.id} with ${tier} item ${item} must succeed`);
      assert.equal(res.tier, tier);
      assert.equal(res.pointsDelta, { loved: 80, liked: 45, neutral: 20, disliked: -15 }[tier]);
      assert.equal(res.reaction, npc.giftReactions[tier]);
      core.nextDay(s, data);
    }
  }
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 5: Milestone Unlocking & Duplicate Prevention
// -------------------------------------------------------------
test('Adversarial Milestones: Multi-tier jumps, reward grants, and duplicate prevention on FP drop/recovery', () => {
  const s = core.createState('Tester', data);
  s.coins = 0;
  s.renown = 0;

  // Mira rewards:
  // 2: { coins: 50, items: { berry: 2 } }
  // 4: { coins: 100, items: { star: 1 } }
  // 5: { renown: 3, items: { meal: 1 } }

  // Jump straight to 250 FP (crosses milestone 2)
  s.friendship.mira.points = 250;
  const unl1 = core.checkMilestones(s, 'mira', data);
  assert.equal(unl1.length, 1);
  assert.equal(unl1[0].milestone, 2);
  assert.deepEqual(s.friendship.mira.unlockedRewards, [2]);
  assert.equal(s.coins, 50);
  assert.equal(s.inventory.berry, 2);

  // Calling checkMilestones again at 250 FP must NOT re-grant milestone 2
  const unlDup = core.checkMilestones(s, 'mira', data);
  assert.equal(unlDup.length, 0);
  assert.equal(s.coins, 50, 'Coins must not duplicate');
  assert.equal(s.inventory.berry, 2, 'Items must not duplicate');

  // FP Drops below 200 due to disliked gifts
  s.inventory.ore = 10;
  s.friendship.mira.points = 180;
  // Recover back to 200 FP
  s.friendship.mira.points = 200;
  const unlRecover = core.checkMilestones(s, 'mira', data);
  assert.equal(unlRecover.length, 0, 'Recovering to milestone 2 must not re-trigger reward');
  assert.equal(s.coins, 50);

  // Jump from 200 to 500 FP (crosses BOTH milestone 4 and 5 in one step)
  s.friendship.mira.points = 500;
  const unlJump = core.checkMilestones(s, 'mira', data);
  assert.equal(unlJump.length, 2, 'Must unlock both milestone 4 and 5');
  assert.deepEqual(s.friendship.mira.unlockedRewards, [2, 4, 5]);
  assert.equal(s.coins, 150, '50 + 100 coins from milestone 4');
  assert.equal(s.inventory.star, 1, '1 star from milestone 4');
  assert.equal(s.renown, 3, '3 renown from milestone 5');
  assert.equal(s.inventory.meal, 1, '1 meal from milestone 5');

  // At 500 FP, subsequent checkMilestones produces nothing
  const unlFinal = core.checkMilestones(s, 'mira', data);
  assert.equal(unlFinal.length, 0);
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 6: Savegame Serialization & Resilience
// -------------------------------------------------------------
test('Adversarial Savegame: Corrupt values, negative/overflow points, missing fields, roundtrip preservation', () => {
  // 1. Completely missing friendship (old save)
  const oldSave = {
    version: 1,
    name: 'OldHero',
    coins: 100,
    day: 5
  };
  const restoredOld = core.restoreState(oldSave, data);
  assert.ok(restoredOld.friendship);
  assert.equal(Object.keys(restoredOld.friendship).length, 11);
  for (const npcId of Object.keys(restoredOld.friendship)) {
    assert.deepEqual(restoredOld.friendship[npcId], {
      points: 0,
      talkedToday: false,
      giftedToday: false,
      unlockedRewards: []
    });
  }

  // 2. Corrupt friendship fields: negative points, NaN points, string points, invalid unlockedRewards
  const corruptSave = {
    version: 1,
    name: 'Corrupt',
    friendship: {
      mira: { points: -999, talkedToday: 1, giftedToday: 'yes', unlockedRewards: [1, 2, 'bad', 99, 2] },
      huy: { points: 999999, talkedToday: false, giftedToday: false, unlockedRewards: [4, 5] },
      linh: { points: 'invalid_points' },
      badNpc: { points: 500 }
    }
  };
  const restoredCorrupt = core.restoreState(corruptSave, data);
  // Mira: negative points clamped to 0, unlockedRewards filtered to valid [2]
  assert.equal(restoredCorrupt.friendship.mira.points, 0);
  assert.equal(restoredCorrupt.friendship.mira.talkedToday, true);
  assert.equal(restoredCorrupt.friendship.mira.giftedToday, true);
  assert.deepEqual(restoredCorrupt.friendship.mira.unlockedRewards, [2]);

  // Huy: overflow points clamped to 500
  assert.equal(restoredCorrupt.friendship.huy.points, 500);
  assert.deepEqual(restoredCorrupt.friendship.huy.unlockedRewards, [4, 5]);

  // Linh: string points fallback to 0
  assert.equal(restoredCorrupt.friendship.linh.points, 0);

  // badNpc should not be imported (only data.npcs are populated)
  assert.equal(restoredCorrupt.friendship.badNpc, undefined);

  // 3. Roundtrip serialization check
  const fresh = core.createState('Explorer', data);
  fresh.friendship.mira.points = 240;
  fresh.friendship.mira.talkedToday = true;
  fresh.friendship.mira.giftedToday = true;
  fresh.friendship.mira.unlockedRewards = [2];

  const serialized = JSON.parse(JSON.stringify(fresh));
  const reloaded = core.restoreState(serialized, data);
  assert.deepEqual(reloaded.friendship, fresh.friendship);
  assert.equal(Object.hasOwn(serialized, 'npcs'), false, 'NPC definitions must not be stored in player save');
});

// -------------------------------------------------------------
// ADVERSARIAL TEST SUITE 7: UI & DOM Integration Edge Cases
// -------------------------------------------------------------
test('Adversarial UI: Gift menu empty inventory notice, already gifted notice, dialog progression', async () => {
  const env = loadGame();
  await env.start('UI Tester');
  const qa = env.qa;

  // 1. Empty inventory -> showGiftMenu displays empty notice
  qa.setState({
    ...qa.getState(),
    inventory: Object.fromEntries(Object.keys(qa.data.items).map(id => [id, 0]))
  });

  const miraObj = qa.getNPCs().find(n => n.id === 'mira');
  env.set({ x: miraObj.x, y: miraObj.y });
  qa.interact(); // Opens Mira dialog

  // Click gift button
  await env.button({ giftNpc: 'mira' });

  const dialogBody = env.elements.get('dialog-body').innerHTML;
  assert.match(dialogBody, /Túi đồ của bạn đang trống/, 'Empty inventory notice must be displayed');

  // 2. Put item in inventory, give gift, then try opening gift menu again
  qa.setState({
    ...qa.getState(),
    inventory: { ...qa.getState().inventory, star: 2 }
  });

  // Give gift via QA
  const giftRes = qa.giveGift('mira', 'star');
  assert.equal(giftRes.ok, true);

  // Try opening gift menu again while giftedToday is true
  qa.interact();
  await env.button({ giftNpc: 'mira' });

  const dialogBodyAfter = env.elements.get('dialog-body').innerHTML;
  assert.match(dialogBodyAfter, /Hôm nay bạn đã tặng quà cho Mira rồi/, 'Already gifted notice must be displayed');
});
