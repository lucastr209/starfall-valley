'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const actorArt = require('../world-actors.js');

// Exercise the shipped browser source. The stubs model events, storage and canvas
// calls; real browser rendering/fullscreen remains a separate visual check.
function loadGame({ storage = new Map(), saved, search = '?qa=1', hostname = 'localhost', now = 1700000000000, width = 960, height = 600, viewportWidth, viewportHeight, visualViewportWidth, visualViewportHeight, userAgent = '', platform = '', maxTouchPoints = 0, standalone = false, legacyStandalone = false, reducedMotion = false, expectQA = true } = {}) {
  const calls = [], elements = new Map(), raf = [], sockets = [], timers = new Map(), observers = [], clicks = [], downloads = [], objectURLs = new Map();
  const markup = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
      super(); this.id = id; this.tagName = tagName; this.dataset = {}; this.attributes = {}; this.style = { setProperty(name, value) { this[name] = String(value); }, getPropertyValue(name) { return this[name] || ''; }, removeProperty(name) { const value = this[name] || ''; delete this[name]; return value; } }; this.children = []; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.open = false; this.width = 960; this.height = 600; this.capturedPointers = new Set();
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
    getBoundingClientRect() {
      const rect = this.rect || (this.id === 'touch-joystick' ? {left:20,top:180,width:116,height:116} : {left:0,top:0,width:this.clientWidth || this.width,height:this.clientHeight || this.height});
      return {...rect,right:rect.left+rect.width,bottom:rect.top+rect.height,x:rect.left,y:rect.top};
    }
    focus() { document.activeElement = this; void this.dispatch('focus', { bubbles: false }); }
    blur() { if (document.activeElement === this) document.activeElement = null; void this.dispatch('blur', { bubbles: false }); }
    click() { clicks.push(this); const name=this.download||this.getAttribute('download'),href=this.href||this.getAttribute('href'); if (name) downloads.push({name,blob:objectURLs.get(href)}); void this.dispatch('click'); }
    getContext() { if (!this.context) this.context = makeContext(this); return this.context; }
  }
  function makeContext(element) {
    const c = { canvas: element, globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', strokeStyle: '', font: '', textAlign: '', stack: [] };
    const add = (name, args) => calls.push({ context: element.id, name, args: Array.from(args), composite: c.globalCompositeOperation, fillStyle: c.fillStyle, strokeStyle: c.strokeStyle, alpha: c.globalAlpha });
    for (const name of ['fillRect', 'clearRect', 'drawImage', 'translate', 'scale', 'rotate', 'fillText', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'closePath', 'arc', 'ellipse', 'clip', 'quadraticCurveTo', 'bezierCurveTo', 'setLineDash']) c[name] = function (...args) { add(name, args); };
    const styleKeys = ['globalCompositeOperation', 'globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign'];
    c.save = () => { c.stack.push(Object.fromEntries(styleKeys.map(key => [key, c[key]]))); add('save', []); };
    c.restore = () => { const old = c.stack.pop(); if (old) Object.assign(c, old); add('restore', []); };
    c.createRadialGradient = (...args) => { const gradient = { stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } }; add('createRadialGradient', args); return gradient; };
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
      if (id === 'canvas-stage') { element.clientWidth = width; element.clientHeight = height; }
      elements.set(id, element);
      const parent = id === 'game-wrapper' ? document : ['game-dialog', 'start-screen', 'play-screen'].includes(id) ? document.getElementById('game-wrapper') : ['player-name', 'start-form', 'btn-start', 'save-label', 'titleCanvas'].includes(id) ? document.getElementById('start-screen') : id.startsWith('dialog-') ? document.getElementById('game-dialog') : ['chat-input', 'chat-form', 'chat-log', 'player-count'].includes(id) ? document.getElementById('mobile-chat-panel') : document.getElementById('play-screen');
      element.parent = parent;
    }
    return elements.get(id);
  };
  document.createElement = tag => new Element(`created-${created++}`, tag.toUpperCase());
  document.createTextNode = text => ({ textContent: String(text) });
  const directions = ['up', 'down', 'left', 'right'].map(move => { const e = new Element(`move-${move}`, 'BUTTON'); e.setAttribute('data-move', move); e.parent = document.getElementById('play-screen'); return e; });
  document.querySelectorAll = selector => selector === '[data-move]' ? directions : [];
  document.documentElement = new Element('document-root', 'HTML');
  document.body = new Element('document-body', 'BODY'); document.documentElement.parent = document; document.documentElement.append(document.body);
  const window = new Target();
  if (viewportWidth != null) window.innerWidth = viewportWidth;
  if (viewportHeight != null) window.innerHeight = viewportHeight;
  const visualViewport = new Target();
  if (visualViewportWidth != null || visualViewportHeight != null) {
    visualViewport.width = visualViewportWidth ?? viewportWidth ?? width;
    visualViewport.height = visualViewportHeight ?? viewportHeight ?? height;
    visualViewport.scale = 1;
    visualViewport.offsetTop = visualViewport.offsetLeft = 0;
    window.visualViewport = visualViewport;
  }
  const motionPreference = new Target(); motionPreference.matches = reducedMotion;
  const displayMode = new Target(); displayMode.matches = standalone;
  const matchMedia = query => query === '(display-mode: standalone)' ? displayMode : motionPreference; window.matchMedia = matchMedia;
  const navigator = { userAgent, platform, maxTouchPoints, standalone: legacyStandalone }; window.navigator = navigator;
  class FakeDate extends Date { static now() { return clock; } }
  class FakeSocket {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    send(text) { this.sent.push(JSON.parse(text)); }
    close() { this.readyState = 3; if (this.onclose) this.onclose(); }
  }
  class FakeResizeObserver { constructor(callback) { this.callback = callback; observers.push(this); } observe(element) { this.element = element; this.callback(); } }
  class FakeBlob {
    constructor(parts = [], options = {}) { this.parts = parts; this.type = options.type || ''; this.size = Buffer.byteLength(parts.join('')); }
    async text() { return this.parts.join(''); }
  }
  class BrowserURL extends URL {
    static createObjectURL(blob) { const url=`blob:qa-${objectURLs.size}`;objectURLs.set(url,blob);return url; }
    static revokeObjectURL(url) { objectURLs.delete(url); }
  }
  const sandbox = { document, window, navigator, location: { search, protocol: 'http:', host: `${hostname}:4173`, hostname }, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)) }, Date: FakeDate, performance: { now: () => performanceClock }, URLSearchParams, structuredClone, WebSocket: FakeSocket,
    Blob:FakeBlob,URL:BrowserURL,matchMedia, ResizeObserver: FakeResizeObserver, requestAnimationFrame: callback => raf.push(callback), setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: id => timers.delete(id), console };
  if (saved) storage.set(search.includes('qa=1') ? 'starfall-valley-qa-save' : 'starfall-valley-save-v1', JSON.stringify(saved));
  vm.createContext(sandbox);
  for (const file of ['game-data.js', 'game-core.js', 'npc-ai.js', 'world-paths.js', 'world-effects.js', 'world-actors.js', 'minimap.js', 'onboarding.js', 'save-transfer.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
    // Production exports stay frozen; a test-owned wrapper lets this harness
    // observe the real renderer inputs without changing the shipped module.
    if (file === 'world-actors.js') sandbox.StardropActors = { ...sandbox.StardropActors };
  }
  const qa = sandbox.StardropQA;
  if (expectQA) assert.ok(qa, 'Local QA API is available'); else assert.equal(qa, undefined, 'Debug API is absent outside QA mode');
  const env = { qa, elements, calls, storage, sockets, document, window, navigator, visualViewport, displayMode, directions, raf, timers, motionPreference, clicks, downloads, objectURLs, effects: sandbox.StardropEffects, paths: sandbox.StardropPaths, actors: sandbox.StardropActors, minimap: sandbox.StardropMinimap, saveTransfer:sandbox.StardropSaveTransfer,
    el: id => document.getElementById(id),
    advance(ms) { clock += ms; performanceClock += ms; },
    resize(width, height) { const stage = this.el('canvas-stage'); stage.clientWidth = width; stage.clientHeight = height; observers.forEach(o => o.callback()); },
    async viewport(width, height) { window.innerWidth = width; window.innerHeight = height; await window.dispatch('resize'); },
    async visualViewportResize(width, height) { visualViewport.width = width; visualViewport.height = height; await visualViewport.dispatch('resize'); },
    step(seconds) { this.advance(seconds * 1000); qa.update(seconds); },
    set(patch) { qa.setState({ ...qa.getState(), ...patch }); },
    at(o, patch = {}) { this.set({ map: o.map || qa.getState().map, x: o.x, y: o.y, ...patch }); },
    async start(name = 'QA Lữ khách') { this.el('player-name').value = name; await this.el('start-form').dispatch('submit'); },
    async button(data) { const b = new Element('virtual-button', 'BUTTON'); Object.entries(data).forEach(([key, value]) => { b.setAttribute(`data-${key.replace(/[A-Z]/g, letter => '-'+letter.toLowerCase())}`, value); }); await document.dispatch('click', { target: b }); },
    async key(key, type = 'keydown', extra = {}) { await document.dispatch(type, { key, repeat: false, ...extra }); },
    tick(ms = 16) { this.advance(ms); const callback = raf.shift(); assert.ok(callback); callback(performanceClock); }
  };
  return env;
}

const objects = (e, map = e.qa.getState().map) => e.qa.getWorld()[map].objects;
const object = (e, kind, item, map) => objects(e, map).find(o => o.kind === kind && (!item || o.item === item));
const unlocked = e => e.qa.data.upgrades.map(u => u.id);
const npc = (e, id) => e.qa.getNPCs().find(n => n.id === id);
const residentPositions = e => JSON.stringify(e.qa.getNPCs().map(n => [n.id, n.map, n.x, n.y]));
function joystickPointer(e, x = 0, y = 0, pointerId = 201, extra = {}) {
  const rect = e.el('touch-joystick').getBoundingClientRect();
  return {pointerId,pointerType:'touch',button:0,isPrimary:true,clientX:rect.left+rect.width/2+x*rect.width,clientY:rect.top+rect.height/2+y*rect.height,...extra};
}
function advanceResidents(e, seconds) { for (let i = 0; i < Math.ceil(seconds * 10); i++) e.step(.1); }
function moveResidentFromHome(e, id, minimum = 110) {
  const catalog = e.qa.data.npcs.find(n => n.id === id);
  e.set({ map: catalog.map, x: 1500, y: 100, health: 100 });
  for (let i = 0; i < 900; i++) {
    e.step(.1);
    const moving = npc(e, id);
    if (Math.hypot(moving.x - catalog.x, moving.y - catalog.y) > minimum) return moving;
  }
  assert.fail(`${id} should leave its original position while the player is far away`);
}

test('Actual game starts with a cleaned name, initial story, separate QA storage and working local connection', async () => {
  const e = loadGame(); await e.start(' <Mây>\u0000 ');
  const s = e.qa.getState(); assert.equal(s.name, 'Mây'); assert.equal(s.quests.story01.status, 'active');
  assert.equal(e.el('start-screen').hidden, true); assert.equal(e.el('play-screen').hidden, false);
  assert.equal(e.qa.storageKey, 'starfall-valley-qa-save'); assert.ok(e.storage.has(e.qa.storageKey)); assert.equal(e.storage.has('starfall-valley-save-v1'), false);
  assert.equal(e.sockets[0].url, 'ws://localhost:4173/play');
  const ws = e.sockets[0]; ws.readyState = 1; ws.onopen(); assert.equal(ws.sent[0].type, 'join'); assert.equal(ws.sent[0].name, 'Mây');
  ws.onmessage({ data: '{bad' }); ws.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self' }) }); ws.onmessage({ data: JSON.stringify({ type: 'snapshot', players: [{ id: 'self', name: 'Mây', map: 'village', x: 800, y: 550, color: '#ffffff' }] }) });
  assert.equal(e.el('player-count').textContent, '1 người');
});

test('Client rejects malformed/oversized server packets and renders chat as text', async () => {
  const e = loadGame(); await e.start(); const socket = e.sockets[0]; socket.readyState = 1; socket.onopen();
  for (const data of ['{bad', 'null', '[]', 'x'.repeat(65537), new Uint8Array(2)]) assert.doesNotThrow(() => socket.onmessage({ data }));
  socket.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self' }) });
  socket.onmessage({ data: JSON.stringify({ type: 'welcome', id: { fake: true } }) });
  const renders = [], original = e.actors.draw;
  e.actors.draw = (ctx, args) => { renders.push(args); return original(ctx, args); };
  const peer = { id: 'peer-valid', name: 'Bạn', map: 'village', x: 850, y: 600, moving: false };
  socket.onmessage({ data: JSON.stringify({ type: 'snapshot', players: [null, { ...peer, id: 'self' }, { ...peer, id: 'bad-name', name: {} }, { ...peer, id: 'bad-map', map: '__proto__' }, { ...peer, id: 'bad-position', x: null }, peer] }) });
  e.qa.drawGame();
  assert.ok(renders.some(actor => actor.id === 'peer-valid'));
  assert.equal(renders.some(actor => ['self', 'bad-name', 'bad-map', 'bad-position'].includes(actor.id)), false);
  socket.onmessage({ data: JSON.stringify({ type: 'chat', name: '<img src=x onerror=alert(1)>', text: '<script>alert(1)</script>' }) });
  const line = e.el('chat-log').children.at(-1);
  assert.equal(line.innerHTML, '');
  assert.equal(line.children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(line.children[1].textContent, '<script>alert(1)</script>');
  const count = e.el('chat-log').children.length;
  socket.onmessage({ data: JSON.stringify({ type: 'chat', name: {}, text: [] }) });
  assert.equal(e.el('chat-log').children.length, count);
  e.el('chat-input').value = 'Chào'; await e.el('chat-form').dispatch('submit');
  assert.equal(socket.sent.at(-1).type, 'chat', 'A malformed welcome cannot replace the valid identity');
});

test('Repeated connection failures back off with jitter, reset on open, and stop on returning home', async () => {
  const e = loadGame(); await e.start();
  for (const minimum of [4000, 8000, 16000, 30000, 30000]) {
    const socket = e.sockets.at(-1); socket.close();
    assert.equal(e.timers.size, 1);
    const [id, timer] = [...e.timers][0];
    assert.ok(timer.delay >= minimum && timer.delay < minimum + 1000);
    e.timers.delete(id); timer.fn();
  }
  const socket = e.sockets.at(-1); socket.readyState = 1; socket.onopen(); socket.close();
  assert.ok([...e.timers.values()][0].delay < 5000);
  await e.el('btn-home').dispatch('click');
  assert.equal(e.timers.size, 0);
});

test('Page lifecycle closes sockets without ghost reconnects and restores a persisted game without drawing its own online avatar', async () => {
  const e = loadGame(); await e.start(); const first = e.sockets[0]; first.readyState = 1; first.onopen();
  first.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self-1' }) });
  first.onmessage({ data: JSON.stringify({ type: 'snapshot', players: [{ id: 'peer-1', name: 'OldPeer', map: 'village', x: 900, y: 600, color: '#bb8899' }] }) });
  e.calls.length = 0; e.qa.drawGame(); assert.ok(e.calls.some(c => c.name === 'fillText' && c.args[0] === 'OldPeer'));
  first.readyState = 3; first.onclose(); assert.equal(e.timers.size, 1, 'Unexpected disconnect schedules reconnect');
  e.set({ coins: 789 }); await e.window.dispatch('pagehide');
  assert.equal(first.readyState, 3); assert.equal(first.onclose, null); assert.equal(e.timers.size, 0, 'Pagehide cancels reconnect timer before closing');
  assert.equal(JSON.parse(e.storage.get(e.qa.storageKey)).coins, 789);
  e.calls.length = 0; e.qa.drawGame(); assert.equal(e.calls.some(c => c.name === 'fillText' && c.args[0] === 'OldPeer'), false, 'Old peers are cleared');
  await e.window.dispatch('pageshow', { persisted: false }); assert.equal(e.sockets.length, 1);
  await e.window.dispatch('pageshow', { persisted: true }); assert.equal(e.sockets.length, 2);
  const second = e.sockets[1]; second.readyState = 1; second.onopen(); second.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self-2' }) });
  second.onmessage({ data: JSON.stringify({ type: 'snapshot', players: [{ id: 'self-2', name: 'DuplicateSelf', map: 'village', x: 850, y: 565, color: '#fe00ad' }, { id: 'peer-2', name: 'NewPeer', map: 'village', x: 900, y: 600, color: '#bb8899' }] }) });
  e.calls.length = 0; e.qa.drawGame(); assert.equal(e.calls.some(c => c.name === 'fillText' && c.args[0] === 'DuplicateSelf'), false); assert.ok(e.calls.some(c => c.name === 'fillText' && c.args[0] === 'NewPeer')); assert.equal(e.el('player-count').textContent, '2 người');
  await e.window.dispatch('pagehide'); assert.equal(second.readyState, 3); assert.equal(e.timers.size, 0); await e.el('btn-home').dispatch('click'); await e.window.dispatch('pageshow', { persisted: true }); assert.equal(e.sockets.length, 2, 'Title screen does not reconnect');
});

function prepareNamDelivery(e) {
  const s = e.qa.getState();
  e.qa.data.quests.filter(q => q.kind === 'story').slice(0, 8).forEach(q => { s.quests[q.id] = { status: 'claimed', progress: q.objectives.map(o => o.count) }; });
  s.upgrades = ['well', 'workshop']; s.visited = ['village', 'forest']; s.shrines = ['forest']; s.inventory.lantern = 1; s.x = 400; s.y = 575; e.qa.setState(s);
}

test('HUD delivery chooses the closest NPC when Huy and Nam are both within range', async () => {
  const e = loadGame(); prepareNamDelivery(e); await e.start(); await e.button({ accept: 'side12' });
  assert.equal(e.qa.getState().quests.side12.status, 'active'); await e.button({ claim: 'side12' });
  const s = e.qa.getState(); assert.equal(s.quests.side12.status, 'claimed', 'Nam is 45px away, closer than Huy at 55px'); assert.equal(s.inventory.lantern, 0); assert.equal(s.inventory.star, 2);
});

test('An open NPC dialog delivers to that NPC even when another NPC becomes closer', async () => {
  const e = loadGame(); prepareNamDelivery(e); await e.start(); await e.button({ accept: 'side12' }); e.qa.interact(); assert.equal(e.el('dialog-title').textContent, 'Nam');
  e.set({ x: 400, y: 540 }); await e.button({ claim: 'side12' }); assert.equal(e.qa.getState().quests.side12.status, 'claimed', 'Selected Nam dialog remains the delivery context');
});

test('Resource collection uses real interaction, stamina, XP, cooldown and inventory capacity', async () => {
  const e = loadGame(); await e.start(); const o = object(e, 'resource', 'wood'); e.at(o);
  let s = e.qa.getState(); const xp = s.xp; e.qa.interact(); s = e.qa.getState();
  assert.equal(s.inventory.wood, 3); assert.equal(s.stamina, 96); assert.equal(s.xp, xp + 4); assert.equal(e.qa.resourceReady(o), false);
  const previous = JSON.stringify(s); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), previous);
  e.advance(29999); assert.equal(e.qa.resourceReady(o), false); e.advance(1); assert.equal(e.qa.resourceReady(o), true);
  e.qa.interact(); assert.equal(e.qa.getState().inventory.wood, 6);
  e.advance(30000); s = e.qa.getState(); s.inventory.wood = 100; e.qa.setState(s); const full = JSON.stringify(e.qa.getState()); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), full);
  s.inventory.wood = 99; e.qa.setState(s); e.qa.interact(); assert.equal(e.qa.getState().inventory.wood, 100); assert.equal(e.qa.getState().stamina, s.stamina - 4);
  e.advance(30000); e.set({ stamina: 3 }); const tired = JSON.stringify(e.qa.getState()); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), tired);
});

test('Rain herb and night interaction objectives use the actual weather and action hooks', async () => {
  const e = loadGame(); await e.start(); const herb = object(e, 'resource', 'herb');
  const s = e.qa.getState(); s.day = 2; s.minutes = 1200; e.qa.setState(s); e.at(herb); e.qa.interact();
  const result = e.qa.getState(); assert.equal(result.stats['rain:herb'], 1); assert.equal(result.stats['night:village'], 1); assert.equal(result.stats['gather:herb'], 3);
  e.advance(30000); e.set({ day: 3, minutes: 600 }); e.qa.interact(); assert.equal(e.qa.getState().stats['rain:herb'], 1); assert.equal(e.qa.getState().stats['night:village'], 1);
});

test('Farm planting and harvesting enforce timers, greenhouse speed and full-bag preservation', async () => {
  const e = loadGame(); await e.start(); const plot = object(e, 'plot'); e.at(plot); e.qa.interact();
  let s = e.qa.getState(); assert.ok(s.crops[0] > 0); assert.equal(s.stamina, 97); assert.equal(s.stats['plant:berry'], 1);
  e.advance(15999); e.qa.interact(); assert.equal(e.qa.getState().inventory.berry, 0); e.advance(1); e.qa.interact();
  s = e.qa.getState(); assert.equal(s.crops[0], null); assert.equal(s.inventory.berry, 4); assert.equal(s.stats['harvest:berry'], 1); assert.equal(s.stats['gather:berry'], 4);
  e.set({ upgrades: ['workshop', 'greenhouse'] }); e.qa.interact(); e.advance(7999); e.qa.interact(); assert.notEqual(e.qa.getState().crops[0], null); e.advance(1); e.qa.interact(); assert.equal(e.qa.getState().inventory.berry, 8);
  e.qa.interact(); e.advance(8000); s = e.qa.getState(); s.inventory.berry = 100; e.qa.setState(s); const planted = e.qa.getState().crops[0]; e.qa.interact(); assert.equal(e.qa.getState().crops[0], planted);
  e.set({ stamina: 2, crops: [null, null, null, null] }); e.qa.interact(); assert.equal(e.qa.getState().crops[0], null);
});

test('Combat applies cooldown, drops/rewards, mob respawn and player recovery after defeat', async () => {
  const e = loadGame(); await e.start(); e.set({ map: 'forest', x: 420, y: 670 }); const mob = e.qa.getWorld().forest.mobs[0];
  e.calls.length = 0; e.qa.drawGame(); assert.equal(e.calls.filter(c => c.context === 'gameCanvas' && c.name === 'fillRect' && c.fillStyle === '#629f89').length, 5, 'All live slimes have visible bodies');
  const initial = e.qa.getState(); e.qa.attack(); assert.equal(mob.hp, 2); e.qa.attack(); assert.equal(mob.hp, 2);
  e.step(.4); e.qa.attack(); assert.equal(mob.hp, 1); e.step(.4); e.qa.attack(); assert.ok(mob.deadUntil > 0);
  let s = e.qa.getState(); assert.equal(s.coins, initial.coins + 18); assert.equal(s.xp, initial.xp + 18); assert.equal(s.inventory.ore, 1); assert.equal(s.stats['fight:slime'], 1);
  e.calls.length = 0; e.qa.drawGame(); assert.equal(e.calls.filter(c => c.context === 'gameCanvas' && c.name === 'fillRect' && c.fillStyle === '#629f89').length, 4, 'Defeated slime is hidden until respawn');
  e.step(.4); e.qa.attack(); assert.equal(e.qa.getState().stats['fight:slime'], 1);
  e.advance(35000); e.qa.update(.01); assert.equal(mob.hp, 3);
  e.set({ map: 'forest', x: mob.x, y: mob.y, health: 8, coins: 10 }); e.step(1.3);
  s = e.qa.getState(); assert.equal(s.map, 'village'); assert.equal(s.health, 100); assert.equal(s.stamina, 70); assert.equal(s.coins, 0); assert.equal(s.x, 800); assert.equal(s.y, 720);
  e.set({ stamina: 1 }); const before = JSON.stringify(e.qa.getState()); e.qa.attack(); assert.equal(JSON.stringify(e.qa.getState()), before);
});

test('Locked gates explain upgrades; unlocked travel records visits and safe spawn positions', async () => {
  const e = loadGame(); await e.start(); const gates = objects(e, 'village').filter(o => o.kind === 'gate');
  for (const to of ['coast', 'ruins']) { const gate = gates.find(g => g.to === to); e.at(gate, { map: 'village' }); e.qa.interact(); assert.equal(e.qa.getState().map, 'village'); }
  e.set({ upgrades: ['bridge', 'archive'] }); const coast = gates.find(g => g.to === 'coast'); e.at(coast, { map: 'village' }); e.qa.interact();
  assert.equal(e.qa.getState().map, 'coast'); assert.ok(e.qa.getState().visited.includes('coast')); assert.equal(e.qa.collides(e.qa.getState().x, e.qa.getState().y), false);
  const back = objects(e).find(o => o.kind === 'gate'); e.at(back); e.qa.interact(); assert.equal(e.qa.getState().map, 'village'); assert.equal(e.qa.getState().y, 170);
  const ruins = gates.find(g => g.to === 'ruins'); e.at(ruins); e.qa.interact(); assert.equal(e.qa.getState().map, 'ruins'); assert.ok(e.qa.getState().visited.includes('ruins'));
});

test('Fishing wins in the timing window, loses outside it, and handles a full fish bag', async () => {
  const e = loadGame(); await e.start(); const spot = object(e, 'fish'); e.at(spot); e.qa.interact(); assert.equal(e.el('fishing').hidden, false);
  e.step(Math.PI / 2 / 3.8); e.qa.interact(); let s = e.qa.getState(); assert.equal(s.inventory.fish, 1); assert.equal(s.stamina, 94); assert.equal(s.xp, 12); assert.equal(s.stats['fish:fish'], 1); assert.equal(e.el('fishing').hidden, true);
  e.qa.interact(); e.qa.interact(); s = e.qa.getState(); assert.equal(s.inventory.fish, 1); assert.equal(s.stamina, 88); assert.equal(s.xp, 12);
  s.inventory.fish = 100; e.qa.setState(s); e.qa.interact(); e.step(Math.PI / 2 / 3.8); e.qa.interact(); assert.equal(e.qa.getState().inventory.fish, 100); assert.equal(e.qa.getState().stats['fish:fish'], 1);
  e.set({ stamina: 5 }); e.qa.interact(); assert.equal(e.el('fishing').hidden, true);
});

test('Camp changes to night or a fresh day; bench/well and consumables restore actual health and stamina', async () => {
  const e = loadGame(); await e.start(); const camp = object(e, 'camp'); e.at(camp); e.qa.interact(); assert.equal(e.el('game-dialog').open, true);
  await e.button({ night: '' }); assert.equal(e.qa.getState().minutes, 1140); assert.equal(e.el('game-dialog').open, false);
  e.set({ health: 30, stamina: 10 }); e.at(camp); e.qa.interact(); const day = e.qa.getState().day; await e.button({ rest: '' });
  assert.equal(e.qa.getState().day, day + 1); assert.equal(e.qa.getState().minutes, 480); assert.equal(e.qa.getState().health, 100); assert.equal(e.qa.getState().stamina, 100);
  const bench = object(e, 'bench'); e.at(bench, { health: 30, stamina: 10 }); e.qa.interact(); assert.equal(e.qa.getState().health, 45); assert.equal(e.qa.getState().stamina, 45);
  e.at(object(e, 'well'), { upgrades: ['well'], health: 30, stamina: 10 }); e.qa.interact(); assert.equal(e.qa.getState().health, 65); assert.equal(e.qa.getState().stamina, 80);
  let s = e.qa.getState(); s.inventory.tea = 1; s.inventory.meal = 1; s.health = 30; s.stamina = 10; e.qa.setState(s);
  await e.button({ use: 'tea' }); assert.equal(e.qa.getState().stamina, 45); assert.equal(e.qa.getState().inventory.tea, 0); await e.button({ use: 'meal' }); assert.equal(e.qa.getState().health, 100); assert.equal(e.qa.getState().stamina, 100);
});

test('Shrines and chests apply real one-time rewards and history is retained after reload', async () => {
  const e = loadGame(); await e.start(); e.set({ map: 'forest' }); const shrine = object(e, 'shrine'); e.at(shrine); e.qa.interact();
  let s = e.qa.getState(); assert.deepEqual(s.shrines, ['forest']); assert.equal(s.inventory.star, 2); assert.equal(s.xp, 35); const shrineState = JSON.stringify(s); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), shrineState);
  const chest = object(e, 'chest'); e.at(chest); e.qa.interact(); s = e.qa.getState(); assert.deepEqual(s.chests, [chest.id]); assert.equal(s.coins, 270); assert.equal(s.inventory.star, 4); assert.equal(s.inventory.ore, 3); assert.equal(s.xp, 55);
  const chestState = JSON.stringify(s); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), chestState);
  const loaded = loadGame({ storage: e.storage }); assert.deepEqual(loaded.qa.getState().chests, [chest.id]); assert.deepEqual(loaded.qa.getState().shrines, ['forest']);
});

test('Full bags preserve unopened shrine/chest rewards until all drops fit', async () => {
  const e = loadGame(); await e.start(); e.set({ map: 'forest' }); const shrine = object(e, 'shrine');
  let s = e.qa.getState(); s.inventory.star = 99; e.qa.setState(s); e.at(shrine); let before = JSON.stringify(e.qa.getState()); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), before);
  s = e.qa.getState(); s.inventory.star = 98; e.qa.setState(s); e.qa.interact(); assert.equal(e.qa.getState().inventory.star, 100); assert.equal(e.qa.getState().shrines.length, 1);
  const chest = object(e, 'chest'); e.at(chest); before = JSON.stringify(e.qa.getState()); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), before);
  s = e.qa.getState(); s.inventory.star = 98; s.inventory.ore = 98; e.qa.setState(s); before = JSON.stringify(e.qa.getState()); e.qa.interact(); assert.equal(JSON.stringify(e.qa.getState()), before);
  s.inventory.ore = 97; e.qa.setState(s); e.qa.interact(); assert.equal(e.qa.getState().inventory.star, 100); assert.equal(e.qa.getState().inventory.ore, 100); assert.equal(e.qa.getState().chests.length, 1);
});

test('Lamps, held lantern, upgraded street lights and beacon create actual darkness cutouts after rain', async () => {
  const e = loadGame(); await e.start(); e.set({ minutes: 1200, day: 2 });
  const base = e.qa.lightSources(); assert.equal(base[0].r, 62); assert.equal(base.filter(l => l.r === 140).length, 6);
  let s = e.qa.getState(); s.inventory.lantern = 1; s.upgrades = ['lamps']; e.qa.setState(s);
  let lights = e.qa.lightSources(); assert.equal(lights[0].r, 170); assert.equal(lights[0].power, .97); assert.equal(lights.filter(l => l.r === 140).length, 11);
  e.set({ upgrades: unlocked(e) }); lights = e.qa.lightSources(); assert.ok(lights.some(l => l.r === 340 && l.power === 1));
  e.calls.length = 0; e.qa.drawGame();
  const mask = e.calls.find(c => c.name === 'fillRect' && c.fillStyle === 'rgba(25,35,61,0.64)'); assert.ok(mask, 'Night + rain darkness is capped at 0.64');
  const cutouts = e.calls.filter(c => c.context === mask.context && c.name === 'fillRect' && c.composite === 'destination-out'); assert.equal(cutouts.length, lights.length);
  const maskDraw = e.calls.findIndex(c => c.context === 'gameCanvas' && c.name === 'drawImage' && c.args[0].id === mask.context);
  const lastRain = e.calls.findLastIndex(c => c.context === 'gameCanvas' && c.name === 'stroke'); assert.ok(lastRain >= 0 && lastRain < maskDraw, 'Rain renders before lamp lighting');
  assert.ok(e.calls.some(c => c.context === 'gameCanvas' && c.composite === 'screen' && c.name === 'fillRect'), 'Warm visible glows are rendered');
  assert.equal(e.el('gameCanvas').getContext().globalCompositeOperation, 'source-over');
  e.set({ map: 'forest', shrines: ['forest'] }); assert.ok(e.qa.lightSources().some(l => l.r === 160));
});

test('Keyboard and touch movement work while chat input and open dialogs prevent gameplay', async () => {
  const e = loadGame(); await e.start(); const originalX = e.qa.getState().x;
  await e.key('d'); e.step(.05); await e.key('d', 'keyup'); assert.ok(e.qa.getState().x > originalX);
  e.document.activeElement = e.el('chat-input'); const typingX = e.qa.getState().x; await e.key('d'); e.step(.05); assert.equal(e.qa.getState().x, typingX); e.document.activeElement = null;
  await e.el('btn-journal').dispatch('click'); await e.key('d'); e.step(.05); assert.equal(e.qa.getState().x, typingX); await e.el('dialog-close').dispatch('click');
  await e.directions.find(b => b.dataset.move === 'right').dispatch('pointerdown', { pointerId: 1 }); e.step(.05); assert.ok(e.qa.getState().x > typingX); await e.directions.find(b => b.dataset.move === 'right').dispatch('pointercancel', { pointerId: 1 }); const released = e.qa.getState().x; e.step(.05); assert.equal(e.qa.getState().x, released);
  await e.key('d'); await e.window.dispatch('blur'); e.step(.05); assert.equal(e.qa.getState().x, released);
});

test('Held game controls block native menus and selection without disabling editable fields or other page content', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start();
  const nestedLabel = e.document.createElement('span'); e.el('touch-run').append(nestedLabel);
  for (const target of [e.directions[0], e.el('touch-run'), nestedLabel, e.el('touch-interact'), e.el('touch-attack'), e.el('btn-journal'), e.el('dialog-close'), e.el('btn-home'), e.el('gameCanvas')]) {
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
      const event = await e.document.dispatch(type, { target });
      assert.equal(event.defaultPrevented, true, `${type} is blocked for ${target.id}`);
    }
  }
  const editable = e.document.createElement('span'); editable.setAttribute('contenteditable', 'true'); e.el('touch-run').append(editable);
  for (const target of [e.el('player-name'), e.el('chat-input'), editable, e.document.createElement('p'), e.document.createElement('button')]) {
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
      const event = await e.document.dispatch(type, { target });
      assert.equal(event.defaultPrevented, false, `${type} still works for editable fields and unrelated content`);
    }
  }
  assert.equal(e.el('game-dialog').open, false, 'Holding an action does not activate its click handler');
  assert.equal(locomotion(e).touchRun, false, 'Holding the run toggle does not turn it on');
});

test('Each held direction belongs to its pointer, so cancellation preserves other fingers and opposing releases cannot latch movement', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start(); e.set({ x: 800, y: 550 });
  const direction = name => e.directions.find(button => button.dataset.move === name), right = direction('right'), left = direction('left'), up = direction('up');
  const down = await right.dispatch('pointerdown', { pointerId: 101, pointerType: 'touch', button: 0 });
  assert.equal(down.defaultPrevented, true, 'Touch arrows suppress the browser hold gesture on pointerdown');
  assert.equal(right.hasPointerCapture(101), true);
  await up.dispatch('pointerdown', { pointerId: 102, pointerType: 'touch', button: 0 }); e.step(.05);
  let before = e.qa.getState(); assert.ok(before.x > 800 && before.y < 550, 'Two active directions move diagonally');
  await up.dispatch('pointercancel', { pointerId: 102 }); e.step(.05);
  let after = e.qa.getState(); almost(after.x - before.x, 9, 'Releasing one finger preserves the right arrow'); assert.equal(after.y, before.y);
  before = after; await right.dispatch('pointerup', { pointerId: 999 }); e.step(.05);
  after = e.qa.getState(); almost(after.x - before.x, 9, 'An unrelated pointer cannot release a held arrow');
  await left.dispatch('pointerdown', { pointerId: 103, pointerType: 'touch', button: 0 }); before = e.qa.getState(); e.step(.05); assert.equal(e.qa.getState().x, before.x, 'Opposing held directions cancel');
  await right.dispatch('pointerup', { pointerId: 101 }); e.step(.05); almost(e.qa.getState().x - before.x, -9, 'Only the remaining left pointer moves');
  await left.dispatch('lostpointercapture', { pointerId: 103 }); before = e.qa.getState(); e.step(.05); assert.equal(e.qa.getState().x, before.x);
  await right.dispatch('pointerdown', { pointerId: 104, pointerType: 'touch', button: 0 }); await right.dispatch('pointerdown', { pointerId: 105, pointerType: 'touch', button: 0 });
  await right.dispatch('pointerup', { pointerId: 104 }); before = e.qa.getState(); e.step(.05); almost(e.qa.getState().x - before.x, 9, 'Two fingers on one arrow retain the second pointer');
  await right.dispatch('pointercancel', { pointerId: 105 }); before = e.qa.getState(); e.step(.05); assert.equal(e.qa.getState().x, before.x, 'Last pointer cancellation leaves no held direction');
});

test('A native control context menu cancels held keyboard and touch movement, then fresh pointer input works normally', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start(); e.set({ x: 800, y: 550 });
  const right = e.directions.find(button => button.dataset.move === 'right');
  await e.key('d'); await e.key('Shift'); await e.el('touch-run').dispatch('click'); await right.dispatch('pointerdown', { pointerId: 111, pointerType: 'touch', button: 0 }); e.step(.05);
  const menu = await right.dispatch('contextmenu'); assert.equal(menu.defaultPrevented, true); const before = e.qa.getState(), distance = locomotion(e).distance;
  e.step(.05); assert.equal(e.qa.getState().x, before.x); assert.equal(locomotion(e).distance, distance); assert.equal(locomotion(e).touchRun, false); assert.equal(locomotion(e).running, false);
  await right.dispatch('pointerdown', { pointerId: 112, pointerType: 'touch', button: 0 }); e.step(.05); almost(e.qa.getState().x - before.x, 9, 'A fresh pointer resumes normal walking after cancellation');
  await right.dispatch('pointerup', { pointerId: 112 });
});

test('Secondary mouse buttons cannot move, and document releases recover from missing capture without cancelling a fresh hold', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start(); e.set({ x: 800, y: 550 });
  const right = e.directions.find(button => button.dataset.move === 'right');
  for (const button of [1, 2]) { await right.dispatch('pointerdown', { pointerId: 120, pointerType: 'mouse', button }); e.step(.05); assert.equal(e.qa.getState().x, 800, `Mouse button ${button} does not latch movement`); }
  right.setPointerCapture = () => { throw new Error('Capture unsupported'); };
  await right.dispatch('pointerdown', { pointerId: 121, pointerType: 'touch', button: 0 }); e.step(.05); assert.ok(e.qa.getState().x > 800, 'Capture failure still permits normal touch movement');
  await e.document.dispatch('pointerup', { pointerId: 121, target: e.el('gameCanvas') }); let before = e.qa.getState(); e.step(.05); assert.equal(e.qa.getState().x, before.x, 'Release outside the button stops the uncaptured pointer');
  await right.dispatch('pointerdown', { pointerId: 122, pointerType: 'touch', button: 0 }); await e.window.dispatch('blur'); await right.dispatch('pointerdown', { pointerId: 123, pointerType: 'touch', button: 0 });
  await e.document.dispatch('pointercancel', { pointerId: 122 }); before = e.qa.getState(); e.step(.05); almost(e.qa.getState().x - before.x, 9, 'A stale release after lifecycle reset cannot cancel a fresh hold');
  await e.document.dispatch('pointercancel', { pointerId: 123 }); before = e.qa.getState(); e.step(.05); assert.equal(e.qa.getState().x, before.x);
});

test('Mobile action buttons retain native click activation for touch, mouse and keyboard without double toggling run', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start(); const toggle = e.el('touch-run');
  const touchDown = await toggle.dispatch('pointerdown', { pointerId: 131, pointerType: 'touch', button: 0 });
  assert.equal(touchDown.defaultPrevented, false, 'Native action clicks are not disabled by the hold protection'); assert.equal(locomotion(e).touchRun, false);
  await toggle.dispatch('pointerup', { pointerId: 131, pointerType: 'touch', button: 0 }); assert.equal(locomotion(e).touchRun, false);
  await toggle.dispatch('click', { detail: 1, pointerType: 'touch' }); assert.equal(locomotion(e).touchRun, true);
  await toggle.dispatch('click', { detail: 1, pointerType: 'mouse' }); assert.equal(locomotion(e).touchRun, false);
  e.document.activeElement = toggle; const key = await e.document.dispatch('keydown', { key: ' ', repeat: false }); assert.equal(key.defaultPrevented, false, 'Keyboard Space retains native button activation');
  await toggle.dispatch('click', { detail: 0 }); assert.equal(locomotion(e).touchRun, true); assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  e.document.activeElement = null; await toggle.dispatch('contextmenu'); assert.equal(locomotion(e).touchRun, false);
  for (const target of [e.el('touch-interact'), e.el('touch-attack')]) { const event = await target.dispatch('pointerdown', { pointerId: 132, pointerType: 'touch', button: 0 }); assert.equal(event.defaultPrevented, false); }
});

test('Space/Enter preserve browser button activation and modal controls; Escape cancels fishing/fallback fullscreen', async () => {
  const e = loadGame(); await e.start(); e.document.activeElement = e.el('btn-journal');
  for (const key of [' ', 'Enter']) { let prevented = false; const before = JSON.stringify(e.qa.getState()); await e.key(key, 'keydown', { preventDefault: () => { prevented = true; } }); assert.equal(prevented, false); assert.equal(JSON.stringify(e.qa.getState()), before); }
  e.document.activeElement = null; await e.el('btn-journal').dispatch('click'); let prevented = false; await e.key(' ', 'keydown', { preventDefault: () => { prevented = true; } }); assert.equal(prevented, false); await e.el('dialog-close').dispatch('click');
  e.at(object(e, 'fish')); e.qa.interact(); assert.equal(e.el('fishing').hidden, false); await e.key('Escape'); assert.equal(e.el('fishing').hidden, true);
  await e.el('btn-fullscreen').dispatch('click'); assert.equal(e.el('game-wrapper').classList.contains('pseudo-fullscreen'), true); await e.key('Escape'); assert.equal(e.el('game-wrapper').classList.contains('pseudo-fullscreen'), false);
});

test('Autosave, reload and title return preserve progress and clean player name', async () => {
  const e = loadGame(); await e.start('Mây'); const wood = object(e, 'resource', 'wood'); e.at(wood); e.qa.interact(); e.set({ coins: 777 }); e.step(5.1);
  const saved = JSON.parse(e.storage.get(e.qa.storageKey)); assert.equal(saved.coins, 777); assert.equal(saved.inventory.wood, 3);
  const loaded = loadGame({ storage: e.storage }); assert.equal(loaded.el('player-name').value, 'Mây'); assert.equal(loaded.qa.getState().coins, 777); assert.match(loaded.el('btn-start').innerHTML, /Tiếp tục/);
  await loaded.start(' <Bình Minh> '); assert.equal(loaded.qa.getState().name, 'Bình Minh'); await loaded.el('btn-home').dispatch('click'); assert.equal(loaded.el('start-screen').hidden, false); assert.equal(loaded.el('play-screen').hidden, true); assert.equal(loaded.el('player-name').value, 'Bình Minh');
  loaded.tick(); assert.ok(loaded.calls.some(c => c.context === 'titleCanvas' && c.name === 'fillRect'), 'Animated title renderer still runs');
});

test('A zero-health save resumes at camp; returning to title exits fullscreen', async () => {
  const initial = loadGame(); let saved = initial.qa.getState(); saved.health = 0; saved.stamina = 0; saved.map = 'forest'; saved.x = 420; saved.y = 700;
  const e = loadGame({ saved }); assert.equal(e.qa.getState().health, 100); assert.equal(e.qa.getState().stamina, 70); assert.equal(e.qa.getState().map, 'village'); assert.equal(e.qa.getState().y, 720);
  await e.start(); await e.el('btn-fullscreen').dispatch('click'); await e.el('btn-home').dispatch('click'); assert.equal(e.el('game-wrapper').classList.contains('pseudo-fullscreen'), false); assert.equal(e.el('btn-fullscreen').attributes['aria-pressed'], 'false');
  await e.start(); const wrapper = e.el('game-wrapper'); e.document.fullscreenElement = wrapper; let exited = 0; e.document.exitFullscreen = async () => { exited++; e.document.fullscreenElement = null; await e.document.dispatch('fullscreenchange'); };
  await e.el('btn-home').dispatch('click'); assert.equal(exited, 1); assert.equal(e.document.fullscreenElement, null);
});

test('Canvas and darkness mask resize together for desktop, mobile and fullscreen aspect ratios', async () => {
  const e = loadGame(); await e.start();
  for (const [width, height] of [[960, 600], [1366, 600], [390, 350], [1920, 1080], [390, 700], [320, 460], [700, 320], [701, 320], [390, 844], [320, 700], [900, 100], [800, 1200]]) {
    e.resize(width, height); e.qa.update(0); e.calls.length = 0; e.qa.drawGame();
    const canvas = e.el('gameCanvas'), clear = e.calls.find(c => c.context === 'gameCanvas' && c.name === 'clearRect');
    assert.ok(canvas.width > 0 && canvas.width <= 960); if (width <= 700) assert.ok(canvas.width < 700, 'Phone view shows less world so the same sprites appear larger'); else if (960 * height / width <= 1100) assert.equal(canvas.width, 960);
    assert.equal(clear.args[2], canvas.width); assert.equal(clear.args[3], canvas.height); assert.ok(canvas.height > 0 && canvas.height <= 1100);
    assert.ok(Math.abs(canvas.width * height - canvas.height * width) <= Math.max(width, height), 'The canvas retains the stage aspect ratio without stretching sprites');
    const mask = e.calls.find(c => c.name === 'fillRect' && typeof c.fillStyle === 'string' && c.fillStyle.startsWith('rgba(25,35,61,')); assert.equal(mask.args[2], canvas.width); assert.equal(mask.args[3], canvas.height); assert.equal(e.el('gameCanvas').getContext().imageSmoothingEnabled, false);
    const translation = e.calls.find(c => c.context === 'gameCanvas' && c.name === 'translate'); assert.ok(translation.args[0] <= 0 && -translation.args[0] <= 1600 - canvas.width); assert.ok(translation.args[1] <= 0 && -translation.args[1] <= 1100 - canvas.height);
    const state = e.qa.getState();
    if (state.x >= canvas.width / 2 && state.x <= 1600 - canvas.width / 2) assert.ok(Math.abs(state.x + translation.args[0] - canvas.width / 2) <= .5, 'Camera follows the center of the resized horizontal view');
    if (state.y >= canvas.height / 2 && state.y <= 1100 - canvas.height / 2) assert.ok(Math.abs(state.y + translation.args[1] - canvas.height / 2) <= .5, 'Camera follows the center of the resized vertical view');
    assert.ok(e.calls.some(c => c.context === 'gameCanvas' && c.name === 'fillText' && c.args[0] === 'QA Lữ khách'), 'Player is rendered after resize');
  }
});

test('Mobile zoom enlarges the same sprite without changing movement speed, weather viewport or saved progress through fullscreen resize', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start(); e.set({ x: 800, y: 550, coins: 712, stamina: 57 });
  const mobileWidth = e.el('gameCanvas').width, mobileSpriteCSSWidth = actorArt.artMetrics.bodyWidth * 390 / mobileWidth;
  assert.ok(mobileSpriteCSSWidth >= actorArt.artMetrics.bodyWidth * 390 / 960 * 1.5, 'At a fixed phone width the character is visibly larger than the previous 960px view');
  const weather = [], drawGround = e.effects.drawGround;
  e.effects.drawGround = (context, scene, time, options) => { weather.push(options); return drawGround(context, scene, time, options); };
  for (const [width, height, expanded] of [[390, 600, false], [390, 760, true], [960, 600, true], [390, 600, false]]) {
    if (expanded !== (e.el('btn-fullscreen').getAttribute('aria-pressed') === 'true')) await e.el('btn-fullscreen').dispatch('click');
    e.resize(width, height); e.set({ x: 800, y: 550, day: 2, minutes: 1200 }); const before = e.qa.getState();
    await e.key('d'); e.step(.05); await e.key('d', 'keyup'); almost(e.qa.getState().x - before.x, 9, 'Zoom and fullscreen do not change the 180px/s world movement');
    assert.equal(e.qa.getState().stamina, 57); assert.equal(locomotion(e).speed, 180); weather.length = 0; e.qa.drawGame();
    assert.ok(weather.length > 0); assert.equal(weather[0].viewport.width, e.el('gameCanvas').width); assert.equal(weather[0].viewport.height, e.el('gameCanvas').height); assert.equal(weather[0].rain, true); assert.equal(weather[0].night, true);
  }
  await e.window.dispatch('pagehide'); const save = JSON.parse(e.storage.get(e.qa.storageKey)); assert.equal(save.coins, 712); assert.equal(save.stamina, 57); assert.equal(Object.hasOwn(save, 'viewWidth'), false); assert.equal(Object.hasOwn(save, 'viewHeight'), false);
});

test('Mobile information panels start closed, open one at a time and stop held movement without discarding chat drafts or desktop panels', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start(); e.set({ x: 800, y: 550 });
  const quests = e.el('btn-mobile-quests'), chat = e.el('btn-mobile-chat'), panel = () => e.el('play-screen').getAttribute('data-mobile-panel-open');
  assert.equal(panel(), ''); assert.equal(quests.getAttribute('aria-expanded'), 'false'); assert.equal(chat.getAttribute('aria-expanded'), 'false');
  await e.key('d'); await e.key('Shift'); await e.el('touch-run').dispatch('click'); await e.directions.find(button => button.dataset.move === 'down').dispatch('pointerdown', { pointerId: 141, pointerType: 'touch', button: 0 }); e.step(.05);
  await quests.dispatch('click'); assert.equal(panel(), 'quests'); assert.equal(quests.getAttribute('aria-expanded'), 'true'); assert.equal(chat.getAttribute('aria-expanded'), 'false');
  const before = e.qa.getState(), distance = locomotion(e).distance; e.step(.05); assert.equal(e.qa.getState().x, before.x); assert.equal(e.qa.getState().y, before.y); assert.equal(locomotion(e).distance, distance); assert.equal(locomotion(e).touchRun, false);
  await chat.dispatch('click'); assert.equal(panel(), 'chat'); assert.equal(quests.getAttribute('aria-expanded'), 'false'); assert.equal(chat.getAttribute('aria-expanded'), 'true'); assert.equal(e.document.activeElement, null, 'Opening the panel does not automatically bring up a phone keyboard');
  const input = e.el('chat-input'); input.value = 'Bản nháp vẫn còn'; input.focus();
  await quests.dispatch('click');
  assert.equal(panel(), 'quests'); assert.equal(chat.getAttribute('aria-expanded'), 'false'); assert.equal(e.document.activeElement, null, 'Switching to quests releases focus from the now-concealed chat input'); assert.equal(input.value, 'Bản nháp vẫn còn', 'Switching panels preserves the unsent chat draft');
  const right = e.directions.find(button => button.dataset.move === 'right'), switchedX = e.qa.getState().x;
  await right.dispatch('pointerdown', { pointerId: 142, pointerType: 'touch', button: 0 }); e.step(.05); await right.dispatch('pointerup', { pointerId: 142 });
  almost(e.qa.getState().x - switchedX, 9, 'Movement resumes after switching away from a focused chat input');
  await chat.dispatch('click'); input.focus(); await chat.dispatch('click');
  assert.equal(panel(), ''); assert.equal(chat.getAttribute('aria-expanded'), 'false'); assert.equal(e.document.activeElement, null, 'Closing chat releases focus from its concealed input'); assert.equal(input.value, 'Bản nháp vẫn còn');
  e.resize(1280, 800); assert.equal(e.el('mobile-chat-panel').hidden, false); assert.equal(e.el('mobile-quests-panel').hidden, false, 'Mobile toggles never set hidden on the desktop information sections');
  await quests.dispatch('click'); await quests.dispatch('click'); assert.equal(panel(), '');
});

test('Opening a mobile information panel cancels fishing, Escape closes it, and returning home clears panel session state', async () => {
  const e = loadGame({ width: 390, height: 600 }); await e.start(); e.set({ coins: 719 });
  e.at(object(e, 'fish')); e.qa.interact(); assert.equal(e.el('fishing').hidden, false); const before = e.qa.getState();
  await e.el('btn-mobile-quests').dispatch('click'); assert.equal(e.el('fishing').hidden, true); assert.equal(e.qa.getState().inventory.fish, before.inventory.fish); assert.equal(e.qa.getState().stamina, before.stamina, 'Cancelling fishing does not award a catch or charge stamina');
  await e.el('btn-fullscreen').dispatch('click'); await e.key('Escape'); assert.equal(e.el('play-screen').dataset.mobilePanelOpen, ''); assert.equal(e.el('btn-mobile-quests').getAttribute('aria-expanded'), 'false'); assert.equal(e.el('btn-fullscreen').getAttribute('aria-pressed'), 'true', 'Escape closes the open information panel first');
  await e.key('Escape'); assert.equal(e.el('btn-fullscreen').getAttribute('aria-pressed'), 'false');
  await e.el('btn-mobile-chat').dispatch('click'); await e.el('btn-home').dispatch('click'); assert.equal(e.el('play-screen').dataset.mobilePanelOpen, ''); assert.equal(e.el('btn-mobile-chat').getAttribute('aria-expanded'), 'false');
  const save = JSON.parse(e.storage.get(e.qa.storageKey)); assert.equal(save.coins, 719); assert.equal(Object.hasOwn(save, 'mobilePanel'), false); assert.equal(Object.hasOwn(save, 'mobilePanelOpen'), false);
  await e.start(); assert.equal(e.el('play-screen').dataset.mobilePanelOpen, ''); assert.equal(e.qa.getState().coins, 719);
});

test('Native and fallback fullscreen can enter and shrink repeatedly', async () => {
  const e = loadGame(); await e.start(); const wrapper = e.el('game-wrapper'), button = e.el('btn-fullscreen');
  wrapper.requestFullscreen = async () => { e.document.fullscreenElement = wrapper; await e.document.dispatch('fullscreenchange'); };
  e.document.exitFullscreen = async () => { e.document.fullscreenElement = null; await e.document.dispatch('fullscreenchange'); };
  for (let i = 0; i < 2; i++) { await button.dispatch('click'); assert.equal(button.attributes['aria-pressed'], 'true'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), false); await button.dispatch('click'); assert.equal(button.attributes['aria-pressed'], 'false'); }
  wrapper.requestFullscreen = undefined; await button.dispatch('click'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), true); await button.dispatch('click'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), false);
  wrapper.requestFullscreen = async () => { throw Error('Blocked'); }; await button.dispatch('click'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), true); await button.dispatch('click'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), false);
});

test('A native fullscreen request that resolves without entering fullscreen still opens the fallback view', async () => {
  const e = loadGame(); await e.start(); const wrapper = e.el('game-wrapper'), button = e.el('btn-fullscreen');
  let requested = 0; wrapper.requestFullscreen = async () => { requested++; };
  await button.dispatch('click');
  assert.equal(requested, 1); assert.equal(e.document.fullscreenElement, undefined);
  assert.equal(wrapper.classList.contains('pseudo-fullscreen'), true, 'Promise resolution alone must not claim native fullscreen succeeded');
  assert.equal(button.getAttribute('aria-pressed'), 'true'); assert.match(button.getAttribute('aria-label'), /Thu nhỏ/);
  await button.dispatch('click'); assert.equal(requested, 1, 'Shrinking the fallback does not request native fullscreen again');
  assert.equal(wrapper.classList.contains('pseudo-fullscreen'), false); assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test('Repeated fullscreen taps wait for the current native transition', async () => {
  const e = loadGame(); await e.start(); const wrapper = e.el('game-wrapper'), button = e.el('btn-fullscreen');
  let resolveRequest, requested = 0; wrapper.requestFullscreen = () => { requested++; return new Promise(resolve => { resolveRequest = resolve; }); };
  const entering = button.dispatch('click'); await button.dispatch('click');
  assert.equal(requested, 1, 'An unresolved transition owns the fullscreen button');
  e.document.fullscreenElement = wrapper; resolveRequest(); await entering;
  assert.equal(button.getAttribute('aria-pressed'), 'true'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), false);
  let resolveExit, exited = 0; e.document.exitFullscreen = () => { exited++; return new Promise(resolve => { resolveExit = resolve; }); };
  const leaving = button.dispatch('click'); await button.dispatch('click'); assert.equal(exited, 1);
  e.document.fullscreenElement = null; resolveExit(); await leaving;
  assert.equal(button.getAttribute('aria-pressed'), 'false'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), false);
});

test('Returning home cancels a pending native fullscreen request and exits a late success', async () => {
  const e = loadGame(); await e.start(); const wrapper = e.el('game-wrapper'), button = e.el('btn-fullscreen');
  let resolveRequest, exited = 0;
  wrapper.requestFullscreen = () => new Promise(resolve => { resolveRequest = resolve; });
  e.document.exitFullscreen = async () => { exited++; e.document.fullscreenElement = null; await e.document.dispatch('fullscreenchange'); };
  const entering = button.dispatch('click'); await e.el('btn-home').dispatch('click');
  e.document.fullscreenElement = wrapper; resolveRequest(); await entering;
  assert.equal(exited, 1); assert.equal(e.document.fullscreenElement, null);
  assert.equal(e.el('start-screen').hidden, false); assert.equal(e.el('play-screen').hidden, true);
  assert.equal(button.getAttribute('aria-pressed'), 'false'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'), false);
});

test('Prefixed void fullscreen waits for the actual event and removes temporary listeners', async () => {
  const e = loadGame(); await e.start(); const wrapper=e.el('game-wrapper'),button=e.el('btn-fullscreen');
  const baseline=(e.document.listeners.get('webkitfullscreenchange')||[]).length;
  wrapper.webkitRequestFullscreen = () => {};
  const entering=button.dispatch('click'); await Promise.resolve();
  e.document.webkitFullscreenElement=wrapper;await e.document.dispatch('webkitfullscreenchange');await entering;
  assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(wrapper.classList.contains('pseudo-fullscreen'),false);
  assert.equal((e.document.listeners.get('webkitfullscreenchange')||[]).length,baseline,'Transition listeners are removed after native entry');
  e.document.webkitExitFullscreen=()=>{e.document.webkitFullscreenElement=null;void e.document.dispatch('webkitfullscreenchange');};
  await button.dispatch('click');assert.equal(button.getAttribute('aria-pressed'),'false');
});

test('An ineffective prefixed void fullscreen request times out into fallback and can shrink', async () => {
  const e=loadGame();await e.start();const wrapper=e.el('game-wrapper'),button=e.el('btn-fullscreen');
  wrapper.webkitRequestFullscreen=()=>{};const entering=button.dispatch('click');await Promise.resolve();
  const pending=[...e.timers.values()].filter(timer=>timer.delay===1200);assert.equal(pending.length,1,'Void APIs wait a bounded time for the native event');
  pending[0].fn();await entering;assert.equal(wrapper.classList.contains('pseudo-fullscreen'),true);assert.equal(button.getAttribute('aria-pressed'),'true');
  await button.dispatch('click');assert.equal(wrapper.classList.contains('pseudo-fullscreen'),false);assert.equal(button.getAttribute('aria-pressed'),'false');
});

const iPhoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
test('iPhone unsupported, rejected and ineffective native fullscreen give installation help without claiming fullscreen success', async () => {
  for (const native of ['unsupported', 'rejected', 'noop']) {
    const originalSave = '{"realPlayer":"preserved"}', storage = new Map([['starfall-valley-save-v1', originalSave]]);
    const e = loadGame({storage,userAgent:iPhoneSafari,platform:'iPhone',maxTouchPoints:5,viewportWidth:852,viewportHeight:393,width:790,height:267});
    await e.start(); e.set({x:800,y:550,coins:765});
    const wrapper = e.el('game-wrapper'), button = e.el('btn-fullscreen'), stick = e.el('touch-joystick');
    if (native === 'rejected') wrapper.requestFullscreen = async () => { throw Error('Not permitted'); };
    if (native === 'noop') wrapper.requestFullscreen = async () => {};
    await stick.dispatch('pointerdown',joystickPointer(e,.4)); await e.el('touch-run').dispatch('click'); e.step(.02);
    await button.dispatch('click');
    assert.equal(e.el('game-dialog').open,true,`${native}: iPhone gets actionable help`);
    assert.match(e.el('dialog-body').innerHTML,/Safari/); assert.match(e.el('dialog-body').innerHTML,/Chia sẻ|Share/); assert.match(e.el('dialog-body').innerHTML,/Màn hình chính/);
    assert.equal(wrapper.classList.contains('pseudo-fullscreen'),false,`${native}: CSS cannot hide iPhone browser chrome`);
    assert.equal(button.getAttribute('aria-pressed'),'false'); assert.equal(locomotion(e).joystickPointer,null); assert.equal(locomotion(e).touchRun,false);
    const stopped = e.qa.getState(); e.step(.05); assert.equal(e.qa.getState().x,stopped.x); assert.equal(e.qa.getState().y,stopped.y);
    await e.el('dialog-close').dispatch('click'); assert.equal(e.el('game-dialog').open,false);
    await e.window.dispatch('pagehide'); assert.equal(JSON.parse(storage.get(e.qa.storageKey)).coins,765); assert.equal(storage.get('starfall-valley-save-v1'),originalSave);
  }
});

test('Standalone display modes are already fullscreen and do not enter a fake fullscreen state', async () => {
  for (const mode of [{standalone:true},{legacyStandalone:true}]) {
    const e = loadGame({...mode,userAgent:iPhoneSafari,platform:'iPhone',maxTouchPoints:5,viewportWidth:852,viewportHeight:393}); await e.start();
    const wrapper = e.el('game-wrapper'), button = e.el('btn-fullscreen'); assert.equal(button.getAttribute('aria-pressed'),'true');
    await button.dispatch('click'); assert.equal(button.getAttribute('aria-pressed'),'true'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'),false);
    assert.equal(e.el('game-dialog').open,true); assert.match(e.el('dialog-body').innerHTML,/Màn hình chính|toàn màn hình/);
    await e.el('dialog-close').dispatch('click'); assert.equal(button.getAttribute('aria-pressed'),'true');
    await e.el('btn-home').dispatch('click'); assert.equal(wrapper.classList.contains('pseudo-fullscreen'),false); assert.equal(button.getAttribute('aria-pressed'),'true','The standalone shell remains active on the title screen');
  }
});

test('Exported local progress can be confirmed on the standalone title screen without changing the real player save', async () => {
  const source=loadGame({userAgent:iPhoneSafari,platform:'iPhone',maxTouchPoints:5,viewportWidth:852,viewportHeight:393});await source.start('Người thử di chuyển');
  const state=source.qa.getState();state.coins=843;state.inventory.star=7;state.quests.story01={status:'claimed',progress:[1]};source.qa.setState(state);
  await source.el('btn-fullscreen').dispatch('click');await source.button({exportSave:''});
  assert.equal(source.downloads.length,1);assert.match(source.downloads[0].name,/^starfall-valley-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const exported=await source.downloads[0].blob.text(),envelope=JSON.parse(exported);assert.equal(envelope.format,'starfall-valley-progress');assert.equal(envelope.progress.coins,843);
  for(const key of ['touchRun','joystick','joystickPointer','viewWidth','viewHeight'])assert.equal(Object.hasOwn(envelope.progress,key),false,'Runtime input and view state are not transferred');
  const originalSave='{"realPlayer":"untouched"}',storage=new Map([['starfall-valley-save-v1',originalSave]]);
  const target=loadGame({storage,standalone:true,userAgent:iPhoneSafari,platform:'iPhone',maxTouchPoints:5,viewportWidth:852,viewportHeight:393});const previous=target.saveTransfer.encode(target.qa.getState(),target.qa.data);
  await target.el('btn-import-start').dispatch('click');assert.ok(target.clicks.some(element=>element.id==='save-file'),'Title-screen import opens the local file picker');
  const input=target.el('save-file');input.files=[{name:source.downloads[0].name,size:Buffer.byteLength(exported),text:async()=>exported}];await input.dispatch('change');
  assert.equal(target.el('game-dialog').open,true);assert.equal(target.saveTransfer.encode(target.qa.getState(),target.qa.data),previous,'Selecting a file waits for explicit import confirmation');
  await target.button({importSave:''});const restored=target.qa.getState();assert.equal(restored.coins,843);assert.equal(restored.inventory.star,7);assert.equal(restored.name,envelope.progress.name);assert.equal(restored.quests.story01.status,'claimed');
  assert.equal(target.el('game-dialog').open,false);assert.match(target.el('btn-start').innerHTML,/Tiếp tục/);assert.equal(target.el('player-name').value,restored.name);
  assert.equal(JSON.parse(storage.get(target.qa.storageKey)).coins,843);assert.equal(storage.get('starfall-valley-save-v1'),originalSave);
  await target.start();assert.equal(target.qa.getState().coins,843);assert.equal(locomotion(target).touchRun,false);assert.equal(locomotion(target).joystickPointer,null);
});

test('Malformed and oversized imports show an error without replacing local progress', async () => {
  const e=loadGame();await e.start();e.set({coins:844,inventory:{...e.qa.getState().inventory,star:8}});await e.window.dispatch('pagehide');
  const state=JSON.stringify(e.qa.getState()),saved=e.storage.get(e.qa.storageKey),input=e.el('save-file');
  for(const [name,text]of[['broken.json','{'],['other-game.json','{"format":"other-game","version":1}'],['empty.json','']]){
    input.files=[{name,size:Buffer.byteLength(text),text:async()=>text}];await input.dispatch('change');
    assert.equal(e.el('game-dialog').open,true);assert.match(e.el('dialog-title').textContent,/Không đọc được tiến trình/);assert.match(e.el('dialog-body').innerHTML,/file \.json/);
    assert.equal(JSON.stringify(e.qa.getState()),state);assert.equal(e.storage.get(e.qa.storageKey),saved);
    await e.el('dialog-close').dispatch('click');
  }
  let read=false;input.files=[{name:'too-large.json',size:e.saveTransfer.maxBytes+1,text:async()=>{read=true;return '{}';}}];await input.dispatch('change');
  assert.equal(read,false,'Oversized files are rejected before allocating their contents');assert.equal(JSON.stringify(e.qa.getState()),state);assert.equal(e.storage.get(e.qa.storageKey),saved);
});

test('Importing during play clears input and requires confirmation while cancelling preserves progress', async () => {
  const e=loadGame({viewportWidth:852,viewportHeight:393});await e.start();e.set({x:800,y:550,coins:845});
  const incoming={...e.qa.getState(),coins:946},text=e.saveTransfer.encode(incoming,e.qa.data),input=e.el('save-file'),stick=e.el('touch-joystick');
  await stick.dispatch('pointerdown',joystickPointer(e,.4));await e.el('touch-run').dispatch('click');e.step(.02);
  input.files=[{name:'progress.json',size:Buffer.byteLength(text),text:async()=>text}];await input.dispatch('change');
  assert.equal(locomotion(e).joystickPointer,null);assert.equal(locomotion(e).touchRun,false);assert.equal(e.qa.getState().coins,845);
  await e.el('dialog-close').dispatch('click');await e.button({importSave:''});assert.equal(e.qa.getState().coins,845,'A stale confirmation button cannot import after the dialog closes');
  await input.dispatch('change');await e.button({importSave:''});assert.equal(e.qa.getState().coins,946);assert.equal(locomotion(e).joystickPointer,null);assert.equal(locomotion(e).touchRun,false);
  assert.equal(JSON.parse(e.storage.get(e.qa.storageKey)).coins,946);assert.equal(e.el('game-dialog').open,false);
});

test('A newer file selection owns import confirmation and home cancels an unfinished read', async () => {
  const e=loadGame();await e.start();e.set({coins:846});const input=e.el('save-file');
  const oldText=e.saveTransfer.encode({...e.qa.getState(),coins:947},e.qa.data),newText=e.saveTransfer.encode({...e.qa.getState(),coins:948},e.qa.data);
  let resolveOld;input.value='old.json';input.files=[{name:'old.json',size:Buffer.byteLength(oldText),text:()=>new Promise(resolve=>{resolveOld=resolve;})}];
  const oldRead=input.dispatch('change');assert.equal(input.value,'','The picker can choose the same file again after an attempt');
  input.files=[{name:'new.json',size:Buffer.byteLength(newText),text:async()=>newText}];await input.dispatch('change');resolveOld(oldText);await oldRead;
  await e.button({importSave:''});assert.equal(e.qa.getState().coins,948,'A late earlier read cannot replace the newest confirmation');
  let resolvePending;input.files=[{name:'pending.json',size:Buffer.byteLength(oldText),text:()=>new Promise(resolve=>{resolvePending=resolve;})}];const pendingRead=input.dispatch('change');
  await e.el('btn-home').dispatch('click');resolvePending(oldText);await pendingRead;
  assert.equal(e.el('game-dialog').open,false);assert.equal(e.el('start-screen').hidden,false);assert.equal(e.qa.getState().coins,948);await e.button({importSave:''});assert.equal(e.qa.getState().coins,948);
});

test('Cancelling a dialog invalidates unfinished file reads before the browser close event', async () => {
  const e=loadGame();await e.start();e.set({coins:849});await e.el('btn-journal').dispatch('click');
  const input=e.el('save-file'),text=e.saveTransfer.encode({...e.qa.getState(),coins:950},e.qa.data);
  let resolveRead;input.files=[{name:'pending.json',size:Buffer.byteLength(text),text:()=>new Promise(resolve=>{resolveRead=resolve;})}];
  const reading=input.dispatch('change');await e.el('game-dialog').dispatch('cancel');resolveRead(text);await reading;
  assert.doesNotMatch(e.el('dialog-body').innerHTML,/data-import-save/);await e.button({importSave:''});assert.equal(e.qa.getState().coins,849);
});

test('Fullscreen device overrides require local QA mode and never affect production or ordinary sessions', async () => {
  for(const mode of ['ios','standalone']){
    const local=loadGame({search:`?qa=1&fullscreen=${mode}`,viewportWidth:852,viewportHeight:393});await local.start();
    if(mode==='standalone')assert.equal(local.el('btn-fullscreen').getAttribute('aria-pressed'),'true');
    await local.el('btn-fullscreen').dispatch('click');assert.equal(local.el('game-dialog').open,true);assert.equal(local.el('game-wrapper').classList.contains('pseudo-fullscreen'),false);
    if(mode==='ios')assert.equal(local.el('btn-fullscreen').getAttribute('aria-pressed'),'false');
    const publicSession=loadGame({hostname:'starfall-valley.vercel.app',search:`?qa=1&fullscreen=${mode}`,expectQA:false});await publicSession.start();
    assert.equal(publicSession.el('btn-fullscreen').getAttribute('aria-pressed'),'false');await publicSession.el('btn-fullscreen').dispatch('click');
    assert.equal(publicSession.el('game-dialog').open,false);assert.equal(publicSession.el('game-wrapper').classList.contains('pseudo-fullscreen'),true);
    const normal=loadGame({search:`?fullscreen=${mode}`,expectQA:false,storage:new Map([['starfall-valley-save-v1-tutorial-v1','done']])});await normal.start();
    assert.equal(normal.el('btn-fullscreen').getAttribute('aria-pressed'),'false');await normal.el('btn-fullscreen').dispatch('click');assert.equal(normal.el('game-dialog').open,false);assert.equal(normal.el('game-wrapper').classList.contains('pseudo-fullscreen'),true);
  }
});

test('Visual viewport height tracks browser chrome without releasing a held joystick, and ignores pinch zoom', async () => {
  const e = loadGame({width:790,height:205,viewportWidth:852,viewportHeight:393,visualViewportWidth:852,visualViewportHeight:275}); await e.start(); e.set({x:800,y:550,coins:766});
  const wrapper = e.el('game-wrapper'), stick = e.el('touch-joystick'); assert.equal(wrapper.style.getPropertyValue('--game-viewport-height'),'275px');
  await stick.dispatch('pointerdown',joystickPointer(e,.4)); const pointer = locomotion(e).joystickPointer;
  for (const [available,stageHeight] of [[393,323],[247,177],[310,240]]) {
    e.resize(790,stageHeight); await e.visualViewportResize(852,available);
    assert.equal(wrapper.style.getPropertyValue('--game-viewport-height'),`${available}px`);
    assert.equal(locomotion(e).joystickPointer,pointer,'Browser bar resize does not cancel the gesture');
    const before = e.qa.getState(); e.step(.05); almost(e.qa.getState().x-before.x,9,'Movement continues at 180px/s while the viewport changes');
    assert.ok(Math.abs(e.el('gameCanvas').width*stageHeight-e.el('gameCanvas').height*790)<=790,'Camera and canvas keep the actual stage proportions');
  }
  e.visualViewport.scale = 2; await e.visualViewportResize(426,160); assert.equal(wrapper.style.getPropertyValue('--game-viewport-height'),'393px','Pinch zoom must not shrink the game layout');
  e.visualViewport.scale = 1; await e.visualViewportResize(852,0); assert.equal(wrapper.style.getPropertyValue('--game-viewport-height'),'393px','A transient invalid visual viewport falls back to the window height');
  await stick.dispatch('pointerup',joystickPointer(e,.4)); await e.window.dispatch('pagehide'); assert.equal(JSON.parse(e.storage.get(e.qa.storageKey)).coins,766);
});

test('Height-only window resize preserves the gesture while rotation clears joystick and run state', async () => {
  const e = loadGame({width:790,height:230,viewportWidth:852,viewportHeight:393}); await e.start(); e.set({x:800,y:550}); const stick=e.el('touch-joystick'),wrapper=e.el('game-wrapper');
  assert.equal(wrapper.style.getPropertyValue('--game-viewport-height'),'393px');
  await stick.dispatch('pointerdown',joystickPointer(e,.4)); await e.el('touch-run').dispatch('click'); const pointer=locomotion(e).joystickPointer;
  await e.viewport(852,330); assert.equal(wrapper.style.getPropertyValue('--game-viewport-height'),'330px'); assert.equal(locomotion(e).joystickPointer,pointer); assert.equal(locomotion(e).touchRun,true);
  const before=e.qa.getState();e.step(.05);almost(e.qa.getState().x-before.x,14.85,'Held running continues through browser toolbar changes');
  await e.viewport(393,852); assert.equal(locomotion(e).joystickPointer,null); assert.equal(locomotion(e).touchRun,false); assert.equal(e.el('rotate-notice').hidden,false);
  await e.viewport(852,393);const rotated=e.qa.getState();e.step(.05);assert.equal(e.qa.getState().x,rotated.x,'Rotating back does not resume a stale contact');
});

test('Landscape joystick deadzone, cardinal directions and diagonals follow the finger without faster diagonal travel', async () => {
  const e = loadGame({width:640,height:300,viewportWidth:852,viewportHeight:393}); await e.start(); e.set({x:800,y:550});
  const stick = e.el('touch-joystick');
  const down = await stick.dispatch('pointerdown', joystickPointer(e));
  assert.equal(down.defaultPrevented, true, 'Joystick suppresses native touch selection and pan');
  assert.equal(stick.hasPointerCapture(201), true);
  e.step(.05); assert.equal(e.qa.getState().x, 800); assert.equal(e.qa.getState().y, 550);
  await stick.dispatch('pointermove', joystickPointer(e,.02,.02)); e.step(.05);
  assert.equal(e.qa.getState().x, 800); assert.equal(e.qa.getState().y, 550, 'Small center jitter remains inside the deadzone');
  for (const [x,y,direction] of [[1,0,'right'],[0,-1,'up'],[-1,0,'left'],[0,1,'down'],[1,-1,'up']]) {
    e.set({x:800,y:550}); await e.document.dispatch('pointermove', joystickPointer(e,x,y));
    const before = e.qa.getState(); e.step(.05); const after = e.qa.getState();
    almost(Math.hypot(after.x-before.x,after.y-before.y),9,'Full joystick deflection retains 180px/s speed');
    assert.equal(locomotion(e).direction,direction);
    assert.equal(Math.sign(after.x-before.x),x); assert.equal(Math.sign(after.y-before.y),y);
    assert.ok(Math.hypot(locomotion(e).joystick.x,locomotion(e).joystick.y)<=1.00001,'Joystick vector is bounded');
  }
  await e.document.dispatch('pointerup',joystickPointer(e,1,-1));
  const stopped = e.qa.getState(), distance = locomotion(e).distance; e.step(.05);
  assert.equal(e.qa.getState().x,stopped.x); assert.equal(e.qa.getState().y,stopped.y); assert.equal(locomotion(e).distance,distance);
  assert.equal(locomotion(e).joystick.x,0); assert.equal(locomotion(e).joystick.y,0); assert.equal(locomotion(e).joystickPointer,null);
});

test('Joystick has one owner and unrelated fingers cannot steer or release it', async () => {
  const e = loadGame({viewportWidth:852,viewportHeight:393}); await e.start(); e.set({x:800,y:550}); const stick = e.el('touch-joystick');
  await stick.dispatch('pointerdown',joystickPointer(e,1,0,211));
  await stick.dispatch('pointerdown',joystickPointer(e,-1,0,212,{isPrimary:false}));
  await e.document.dispatch('pointermove',joystickPointer(e,-1,0,212));
  await e.document.dispatch('pointerup',joystickPointer(e,-1,0,212)); e.step(.05);
  almost(e.qa.getState().x-800,9,'The first finger still owns the rightward motion');
  assert.equal(locomotion(e).joystickPointer,211);
  await stick.dispatch('lostpointercapture',{pointerId:211}); const before = e.qa.getState(); e.step(.05);
  assert.equal(e.qa.getState().x,before.x); assert.equal(locomotion(e).joystickPointer,null);
  const rejected = await stick.dispatch('pointerdown',joystickPointer(e,-1,0,213,{pointerType:'mouse',button:2}));
  assert.equal(rejected.defaultPrevented,true); assert.equal(locomotion(e).joystickPointer,null);
});

test('Joystick capture failure still supports document drag, cancel and fresh input with the run button', async () => {
  const e = loadGame({viewportWidth:852,viewportHeight:393}); await e.start(); e.set({x:800,y:550}); const stick = e.el('touch-joystick');
  stick.setPointerCapture = () => {throw new Error('Pointer capture unavailable');};
  await e.el('touch-run').dispatch('click'); await stick.dispatch('pointerdown',joystickPointer(e,0,0,221));
  await e.document.dispatch('pointermove',joystickPointer(e,1,0,221)); e.step(.1);
  almost(e.qa.getState().x-800,29.7,'Joystick sprint matches keyboard sprint'); assert.equal(locomotion(e).running,true);
  await e.document.dispatch('pointercancel',joystickPointer(e,1,0,221)); const before = e.qa.getState(); e.step(.1);
  assert.equal(e.qa.getState().x,before.x); assert.equal(locomotion(e).running,false);
  await stick.dispatch('pointerdown',joystickPointer(e,-1,0,222)); e.step(.05);
  assert.ok(e.qa.getState().x<before.x,'A cancelled gesture does not trap the joystick');
  await stick.dispatch('contextmenu'); assert.equal(locomotion(e).joystickPointer,null); assert.equal(locomotion(e).touchRun,false);
});

test('Opening a dialog, chat or returning home clears joystick input and never persists its vector', async () => {
  const e = loadGame({viewportWidth:852,viewportHeight:393}); await e.start(); e.set({x:800,y:550,coins:731}); const stick = e.el('touch-joystick');
  for (const reset of [async()=>{await e.el('btn-journal').dispatch('click');await e.el('dialog-close').dispatch('click');},async()=>{e.el('chat-input').focus();e.el('chat-input').blur();},async()=>{await e.el('btn-home').dispatch('click');await e.start();}]) {
    await stick.dispatch('pointerdown',joystickPointer(e,1,0,231)); await e.el('touch-run').dispatch('click'); e.step(.02);
    await reset(); const before = e.qa.getState(); e.step(.05);
    assert.equal(e.qa.getState().x,before.x); assert.equal(e.qa.getState().y,before.y); assert.equal(locomotion(e).joystickPointer,null); assert.equal(locomotion(e).joystick.x,0); assert.equal(locomotion(e).joystick.y,0); assert.equal(locomotion(e).touchRun,false);
    await e.document.dispatch('pointermove',joystickPointer(e,1,0,231)); e.step(.05); assert.equal(e.qa.getState().x,before.x,'An old drag cannot resume after a modal or focus reset');
  }
  await e.window.dispatch('pagehide'); const save = JSON.parse(e.storage.get(e.qa.storageKey));
  assert.equal(save.coins,731); for (const key of ['joystick','joystickPointer','orientationBlocked','tutorial','minimapCollapsed']) assert.equal(Object.hasOwn(save,key),false,`${key} stays outside progress`);
});

test('Portrait phone pauses world and gameplay input until landscape; rotating back clears held controls', async () => {
  const e = loadGame({width:393,height:520,viewportWidth:393,viewportHeight:852}); await e.start(); e.set({x:800,y:550});
  assert.equal(e.el('rotate-notice').hidden,false);
  const before = e.qa.getState(), positions = residentPositions(e), animation = e.qa.getAnimationTime();
  await e.key('d'); await e.key('Shift'); await e.el('touch-run').dispatch('click'); await e.el('touch-joystick').dispatch('pointerdown',joystickPointer(e,1,0));
  e.step(.5); e.qa.interact(); e.qa.attack();
  assert.equal(e.qa.getState().x,before.x); assert.equal(e.qa.getState().y,before.y); assert.equal(e.qa.getState().stamina,before.stamina); assert.equal(e.qa.getState().minutes,before.minutes); assert.equal(residentPositions(e),positions); assert.equal(e.qa.getAnimationTime(),animation); assert.equal(locomotion(e).touchRun,false);
  await e.viewport(852,393); e.resize(660,300); assert.equal(e.el('rotate-notice').hidden,true);
  e.step(.05); assert.equal(e.qa.getState().x,before.x,'Input attempted behind the rotation notice cannot latch');
  await e.el('touch-joystick').dispatch('pointerdown',joystickPointer(e,1,0)); await e.el('touch-run').dispatch('click'); e.step(.05); assert.ok(e.qa.getState().x>before.x);
  await e.viewport(393,852); assert.equal(e.el('rotate-notice').hidden,false); assert.equal(locomotion(e).joystickPointer,null); assert.equal(locomotion(e).touchRun,false); const rotated = e.qa.getState();
  await e.viewport(852,393); e.step(.05); assert.equal(e.qa.getState().x,rotated.x,'Rotation never resumes an old joystick gesture');
  await e.viewport(1000,800); assert.equal(e.el('rotate-notice').hidden,true,'Desktop portrait-shaped windows are not forced to rotate');
});

test('Rotation closes the information drawer and releases chat focus without discarding its draft', async () => {
  const e=loadGame({viewportWidth:852,viewportHeight:393});await e.start();
  await e.el('btn-mobile-chat').dispatch('click');const input=e.el('chat-input');input.value='Bản nháp khi xoay máy';input.focus();
  await e.viewport(393,852);
  assert.equal(e.el('rotate-notice').hidden,false);assert.equal(e.el('play-screen').dataset.mobilePanelOpen,'');
  assert.equal(e.el('mobile-panel-backdrop').hidden,true);assert.equal(e.el('btn-mobile-chat').getAttribute('aria-expanded'),'false');
  assert.equal(e.document.activeElement,null);assert.equal(input.value,'Bản nháp khi xoay máy');
  await e.viewport(852,393);assert.equal(e.el('rotate-notice').hidden,true);assert.equal(e.el('play-screen').dataset.mobilePanelOpen,'');
});

test('First-player tutorial waits for landscape, pauses gameplay and completion uses a separate QA flag', async () => {
  const playerSave = '{"sentinel":"player-progress"}', storage = new Map([['starfall-valley-save-v1',playerSave]]);
  const e = loadGame({search:'?qa=1&tutorial=1',storage,viewportWidth:393,viewportHeight:852}); await e.start();
  const flag = e.qa.storageKey+'-tutorial-v1'; assert.equal(e.el('game-dialog').open,false); assert.equal(storage.has(flag),false);
  await e.viewport(852,393); assert.equal(e.el('game-dialog').open,true); assert.match(e.el('dialog-body').innerHTML,/Bước 1 trên 4.*joystick/s);
  const before = e.qa.getState(); await e.key('d'); await e.el('touch-joystick').dispatch('pointerdown',joystickPointer(e,1,0)); e.step(.05); assert.equal(e.qa.getState().x,before.x);
  await e.button({tutorialNext:''}); assert.match(e.el('dialog-body').innerHTML,/Bước 2 trên 4.*Mira/s); assert.equal(storage.has(flag),false);
  await e.viewport(393,852); assert.equal(e.el('game-dialog').open,false); assert.equal(e.el('rotate-notice').hidden,false); assert.equal(storage.has(flag),false);
  await e.viewport(852,393); assert.equal(e.el('game-dialog').open,true); assert.match(e.el('dialog-body').innerHTML,/Bước 2 trên 4/,'Rotating back resumes the same guide page');
  await e.button({tutorialPrev:''}); assert.match(e.el('dialog-body').innerHTML,/Bước 1 trên 4/);
  for (let index=0;index<3;index++) await e.button({tutorialNext:''}); assert.match(e.el('dialog-body').innerHTML,/Bắt đầu chơi/); assert.equal(storage.has(flag),false);
  await e.button({tutorialNext:''}); assert.equal(e.el('game-dialog').open,false); assert.equal(storage.get(flag),'done'); assert.equal(storage.get('starfall-valley-save-v1'),playerSave);
  const loaded = loadGame({search:'?qa=1&tutorial=1',storage,viewportWidth:852,viewportHeight:393}); await loaded.start(); assert.equal(loaded.el('game-dialog').open,false,'Finished tutorial does not reappear on reload');
});

test('Tutorial skip is explicit, closing X leaves it incomplete and existing players can replay help', async () => {
  const e = loadGame({search:'?qa=1&tutorial=1'}); await e.start(); const flag = e.qa.storageKey+'-tutorial-v1';
  assert.equal(e.el('game-dialog').open,true); await e.el('dialog-close').dispatch('click'); assert.equal(e.storage.has(flag),false,'Closing the dialog is not tutorial completion');
  await e.el('btn-help').dispatch('click'); await e.button({tutorialSkip:''}); assert.equal(e.storage.get(flag),'done'); assert.equal(e.el('game-dialog').open,false);
  const saved = JSON.parse(e.storage.get(e.qa.storageKey)), loaded = loadGame({saved}); await loaded.start(); assert.equal(loaded.el('game-dialog').open,false,'Existing saves are not interrupted by an automatic guide');
  await loaded.el('btn-help').dispatch('click'); assert.equal(loaded.el('game-dialog').open,true); assert.match(loaded.el('dialog-body').innerHTML,/Bước 1 trên 4.*WASD/s);
  const state = JSON.stringify(loaded.qa.getState()); await loaded.button({tutorialSkip:''}); assert.equal(JSON.stringify(loaded.qa.getState()),state,'Help navigation does not rewrite quests or items');
});

test('Default QA scenarios skip onboarding while fresh production players receive it once', async () => {
  const qa = loadGame({search:'?qa=1&scene=actors'}); await qa.start(); assert.equal(qa.el('game-dialog').open,false); assert.equal(qa.storage.has(qa.qa.storageKey+'-tutorial-v1'),false);
  const production = loadGame({search:'',expectQA:false}); await production.start(); assert.equal(production.el('game-dialog').open,true); assert.match(production.el('dialog-body').innerHTML,/Bước 1 trên 4/);
  await production.button({tutorialSkip:''}); assert.equal(production.storage.get('starfall-valley-save-v1-tutorial-v1'),'done');
  const loaded = loadGame({search:'',expectQA:false,storage:production.storage}); await loaded.start(); assert.equal(loaded.el('game-dialog').open,false);
});

test('Minimap integration follows the camera and guided resident, throttles redraws, and can collapse without pausing gameplay', async () => {
  const e = loadGame({width:640,height:300,viewportWidth:852,viewportHeight:393}); await e.start();
  const renders = [], original = e.minimap.draw;
  e.minimap.draw = (context,options) => {renders.push({context,options});return original(context,options);};
  e.set({x:800,y:550}); e.advance(201); e.qa.update(0); e.qa.drawGame();
  assert.equal(renders.length,1); const first = renders[0];
  assert.equal(first.context.canvas.id,'minimapCanvas'); assert.equal(first.options.map,'village'); assert.equal(first.options.player.x,e.qa.getState().x); assert.equal(first.options.player.y,e.qa.getState().y);
  assert.equal(first.options.camera.width,e.el('gameCanvas').width); assert.equal(first.options.camera.height,e.el('gameCanvas').height); assert.equal(first.options.target.id,'mira'); assert.equal(first.options.target.x,npc(e,'mira').x);
  e.qa.drawGame(); e.advance(100); e.qa.drawGame(); assert.equal(renders.length,1,'Repeated animation frames do not redraw the minimap before 200ms');
  e.advance(101); e.qa.drawGame(); assert.equal(renders.length,2);
  e.set({x:1500,y:100}); advanceResidents(e,1); e.qa.drawGame();
  const latest = renders.at(-1).options; assert.equal(latest.target.x,npc(e,'mira').x); assert.equal(latest.target.y,npc(e,'mira').y,'The minimap target follows the resident patrol');
  const toggle = e.el('btn-minimap'); await toggle.dispatch('click'); assert.equal(toggle.getAttribute('aria-expanded'),'false'); assert.equal(e.el('minimap-shell').getAttribute('data-collapsed'),'true');
  const count = renders.length; e.advance(250); e.qa.drawGame(); assert.equal(renders.length,count,'Collapsed minimap avoids rendering work');
  e.set({x:800,y:550}); await e.key('d'); e.step(.05); await e.key('d','keyup'); almost(e.qa.getState().x-800,9,'Collapsing the map does not suspend movement');
  await toggle.dispatch('click'); assert.equal(toggle.getAttribute('aria-expanded'),'true'); assert.equal(e.el('minimap-shell').getAttribute('data-collapsed'),'false'); e.qa.drawGame(); assert.equal(renders.length,count+1,'Reopening redraws immediately');
});

test('Minimap renders only the current region online peers and updates after map travel without changing saved progress', async () => {
  const e = loadGame(); await e.start(); e.set({x:800,y:550,coins:732}); const socket = e.sockets[0];
  socket.readyState=1; socket.onopen(); socket.onmessage({data:JSON.stringify({type:'welcome',id:'self'})});
  socket.onmessage({data:JSON.stringify({type:'snapshot',players:[{id:'self',name:'You',map:'village',x:800,y:550,moving:false},{id:'nearby',name:'Nearby',map:'village',x:850,y:550,moving:false},{id:'another-region',name:'Far',map:'forest',x:800,y:550,moving:false}]})});
  e.advance(201); e.calls.length=0; e.qa.drawGame();
  const peerDots = e.calls.filter(call=>call.context==='minimapCanvas'&&call.name==='fill'&&call.fillStyle==='#89baff'); assert.equal(peerDots.length,1,'The other region and local self are not duplicated on the minimap');
  const renders = [], original = e.minimap.draw; e.minimap.draw=(context,options)=>{renders.push(options);return original(context,options);};
  e.at(objects(e,'village').find(o=>o.kind==='gate'&&o.to==='forest')); e.qa.interact(); e.advance(201); e.qa.drawGame();
  assert.equal(renders.at(-1).map,'forest'); assert.equal(renders.at(-1).player.map,'forest'); assert.equal(renders.at(-1).player.x,e.qa.getState().x);
  await e.window.dispatch('pagehide'); const save=JSON.parse(e.storage.get(e.qa.storageKey)); assert.equal(save.coins,732); assert.equal(save.map,'forest'); assert.equal(Object.hasOwn(save,'minimap'),false);
});

test('Every generated NPC, resource, plot, shrine, chest and gate has a reachable selectable interaction point', () => {
  const e = loadGame(); const collisions = [];
  for (const region of e.qa.data.regions) {
    e.set({ map: region.id, upgrades: unlocked(e) });
    const candidates = [...e.qa.getNPCs().filter(n => n.map === region.id).map(n => ({ ...n, kind: 'npc' })), ...objects(e, region.id)];
    const occupied = new Map();
    for (const o of candidates) { const key = `${o.x},${o.y}`; if (occupied.has(key)) collisions.push(`${region.id}: ${occupied.get(key)} / ${o.id} at ${key}`); else occupied.set(key, o.id); }
    const queue = [[800, 550]], reached = new Set(['800,550']);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [nx, ny] of [[x + 10, y], [x - 10, y], [x, y + 10], [x, y - 10]]) {
        const key = `${nx},${ny}`; if (nx < 30 || nx > 1570 || ny < 40 || ny > 1070 || reached.has(key) || e.qa.collides(nx, ny)) continue;
        reached.add(key); queue.push([nx, ny]);
      }
    }
    for (const target of candidates) {
      const radius = target.kind === 'gate' ? 100 : 78;
      const selectable = queue.some(([x, y]) => {
        const dist = Math.hypot(target.x - x, target.y - y); if (dist >= radius) return false;
        return !candidates.some(o => o !== target && Math.hypot(o.x - x, o.y - y) < (o.kind === 'gate' ? 100 : 78) && (Math.hypot(o.x - x, o.y - y) < dist || Math.hypot(o.x - x, o.y - y) === dist && candidates.indexOf(o) < candidates.indexOf(target)));
      });
      assert.ok(selectable, `${region.id}/${target.id} needs a reachable point where it can be selected`);
    }
    assert.ok(e.qa.getWorld()[region.id].trees.length > 0);
  }
  assert.deepEqual(collisions, [], 'Generated interactables must not share exact positions');
});

test('All 11 residents walk real routes without entering buildings, water, trunks or map boundaries', async () => {
  const e = loadGame(); await e.start(); const originalCatalog = JSON.stringify(e.qa.data.npcs);
  const movement = new Map(e.qa.getNPCs().map(n => [n.id, 0])), animated = new Set();
  for (const region of e.qa.data.regions) {
    e.set({ map: region.id, x: 1500, y: 100, upgrades: unlocked(e) });
    const initial = new Map(e.qa.getNPCs().map(n => [n.id, { x: n.x, y: n.y }]));
    for (let frame = 0; frame < 900; frame++) {
      e.step(.1);
      for (const resident of e.qa.getNPCs()) {
        const origin = initial.get(resident.id), dist = Math.hypot(resident.x - origin.x, resident.y - origin.y);
        if (resident.map !== region.id) { assert.equal(dist, 0, `Hidden region resident ${resident.id} stays put`); continue; }
        assert.equal(e.qa.blockedAt(resident.map, resident.x, resident.y), false, `${resident.id} must stay on walkable terrain at ${resident.x},${resident.y}`);
        movement.set(resident.id, Math.max(movement.get(resident.id), dist));
        if (resident.moving) animated.add(resident.id);
      }
    }
  }
  for (const [id, dist] of movement) { assert.ok(dist > 180, `${id} walked ${dist}px and should traverse its route`); assert.ok(animated.has(id), `${id} must signal walking animation`); }
  assert.equal(movement.size, 11); assert.equal(JSON.stringify(e.qa.data.npcs), originalCatalog, 'Patrol movement must not mutate the content catalog');
});

test('Residents stop for a nearby player and resume walking after the player leaves', async () => {
  const e = loadGame(); await e.start(); const moving = moveResidentFromHome(e, 'mira');
  e.at({ ...moving, x: moving.x + 25 }); const before = { x: moving.x, y: moving.y };
  advanceResidents(e, 3); assert.equal(npc(e, 'mira').x, before.x); assert.equal(npc(e, 'mira').y, before.y); assert.equal(npc(e, 'mira').moving, false);
  assert.match(e.el('interaction-hint').textContent, /Mira/);
  e.set({ x: 1500, y: 100 }); advanceResidents(e, 5);
  assert.ok(Math.hypot(npc(e, 'mira').x - before.x, npc(e, 'mira').y - before.y) > 10, 'Mira resumes the same journey when the conversation area clears');
});

test('Modal, typing, fishing and title pause NPC movement without clearing patrol progress', async () => {
  const e = loadGame(); await e.start(); moveResidentFromHome(e, 'mira');
  await e.el('btn-journal').dispatch('click'); let positions = residentPositions(e); advanceResidents(e, 3); assert.equal(residentPositions(e), positions); await e.el('dialog-close').dispatch('click');
  e.document.activeElement = e.el('chat-input'); positions = residentPositions(e); advanceResidents(e, 3); assert.equal(residentPositions(e), positions); e.document.activeElement = null;
  e.at(object(e, 'fish')); e.qa.interact(); assert.equal(e.el('fishing').hidden, false); positions = residentPositions(e); advanceResidents(e, 3); assert.equal(residentPositions(e), positions); await e.key('Escape');
  e.set({ x: 1500, y: 100 }); positions = residentPositions(e); advanceResidents(e, 3); assert.notEqual(residentPositions(e), positions);
  await e.el('btn-home').dispatch('click'); positions = residentPositions(e); for (let i = 0; i < 30; i++) e.tick(100); assert.equal(residentPositions(e), positions, 'Title animation does not advance resident routes');
});

test('Interaction, hints and rendering follow a moving resident rather than the old catalog position', async () => {
  const e = loadGame(); await e.start(); const moving = moveResidentFromHome(e, 'mira'), home = e.qa.data.npcs.find(n => n.id === 'mira');
  e.at(home); e.qa.interact(); assert.equal(e.qa.getState().stats['talk:mira'] || 0, 0, 'No invisible Mira may remain at the former position'); if (e.el('game-dialog').open) await e.el('dialog-close').dispatch('click');
  e.at(moving); e.qa.update(0); assert.match(e.el('interaction-hint').textContent, /Mira/); e.qa.interact(); assert.equal(e.el('dialog-title').textContent, 'Mira'); assert.equal(e.qa.getState().stats['talk:mira'], 1);
  const paused = residentPositions(e); advanceResidents(e, 2); assert.equal(residentPositions(e), paused, 'The selected conversation stays reachable');
  e.calls.length = 0; e.qa.drawGame(); const name = e.calls.find(c => c.context === 'gameCanvas' && c.name === 'fillText' && c.args[0] === 'Mira');
  const tag = e.qa.getActorLabels().find(t => t.id === 'mira'); assert.ok(tag); assert.equal(tag.anchorX, npc(e, 'mira').x); assert.equal(tag.baseY, npc(e, 'mira').y - actorArt.artMetrics.nameOffset); assert.ok(tag.y <= tag.baseY);
  assert.ok(name); assert.equal(name.args[1], Math.floor(tag.x) + 1); assert.equal(name.args[2], Math.floor(tag.y) + 1);
});

test('A nearby resident remains selectable when their patrol passes a closer resource', async () => {
  const e = loadGame(); await e.start(); const wood = objects(e).find(o => o.kind === 'resource' && o.item === 'wood' && o.x === 900 && o.y === 655);
  assert.ok(wood); assert.ok(Math.hypot(npc(e, 'thao').x - wood.x, npc(e, 'thao').y - wood.y) < 78);
  e.at(wood); e.qa.update(0); assert.match(e.el('interaction-hint').textContent, /Thảo/); e.qa.interact();
  assert.equal(e.el('dialog-title').textContent, 'Thảo'); assert.equal(e.qa.getState().stats['talk:thao'], 1); assert.equal(e.qa.getState().inventory.wood, 0, 'Interaction does not silently collect a resource instead of opening the resident');
});

test('Delivery rewards require the giver at their current position and cannot be claimed from their old home', async () => {
  const e = loadGame(); prepareNamDelivery(e); await e.start(); await e.button({ accept: 'side12' }); const moving = moveResidentFromHome(e, 'nam');
  const home = e.qa.data.npcs.find(n => n.id === 'nam'); e.at(home); await e.button({ claim: 'side12' }); assert.equal(e.qa.getState().quests.side12.status, 'active'); assert.equal(e.qa.getState().inventory.lantern, 1);
  e.at(moving); await e.button({ claim: 'side12' }); const claimed = e.qa.getState(); assert.equal(claimed.quests.side12.status, 'claimed'); assert.equal(claimed.inventory.lantern, 0); assert.equal(claimed.inventory.star, 2);
  const coins = claimed.coins; await e.button({ claim: 'side12' }); assert.equal(e.qa.getState().coins, coins, 'Walking does not permit repeated rewards');
});

test('Quest icons reveal newly unlocked resident work and daily contracts, with ready rewards taking priority', async () => {
  const e = loadGame(); await e.start(); assert.equal(e.qa.npcMarker(npc(e, 'mira')), '!'); assert.equal(e.qa.npcMarker(npc(e, 'huy')), '');
  e.at(npc(e, 'mira')); e.qa.interact(); assert.equal(e.qa.npcMarker(npc(e, 'mira')), '✓'); await e.button({ claim: 'story01' }); await e.el('dialog-close').dispatch('click');
  assert.equal(e.qa.npcMarker(npc(e, 'huy')), '?'); e.at(npc(e, 'huy')); e.qa.interact();
  assert.match(e.el('dialog-body').innerHTML, /data-accept="side02"/); assert.match(e.el('dialog-body').innerHTML, /data-accept="daily01"/); assert.doesNotMatch(e.el('dialog-body').innerHTML, /data-accept="daily04"/, 'Locked contracts must not be offered');
  await e.button({ accept: 'daily01' }); let state = e.qa.getState(); state.quests.daily01.progress[0] = 5; e.qa.setState(state);
  assert.equal(e.qa.npcMarker(npc(e, 'huy')), '✓', 'Ready contract wins over other active or available quests');
  await e.button({ claim: 'daily01' }); assert.equal(e.qa.getState().quests.daily01.status, 'claimed'); const coins = e.qa.getState().coins; await e.button({ claim: 'daily01' }); assert.equal(e.qa.getState().coins, coins);
  await e.el('dialog-close').dispatch('click'); state = e.qa.getState(); e.qa.core.nextDay(state, e.qa.data); e.qa.setState(state); assert.notEqual(e.qa.getState().quests.daily01?.status, 'claimed');
  assert.ok(['?', '!'].includes(e.qa.npcMarker(npc(e, 'huy'))), 'New day exposes work again');
});

test('Refreshing an NPC dialog never invents talk events or completes a newly accepted conversation objective', async () => {
  const e = loadGame(); await e.start(); e.at(npc(e, 'mira')); e.qa.interact();
  assert.equal(e.qa.getState().stats['talk:mira'], 1); await e.button({ claim: 'story01' });
  assert.equal(e.qa.getState().stats['talk:mira'], 1, 'Claim refresh must not count as another visit'); assert.equal(e.el('game-dialog').open, true);
  await e.button({ accept: 'daily05' }); assert.equal(e.qa.getState().quests.daily05.status, 'active');
  assert.equal(e.qa.getState().quests.daily05.progress[0], 0, 'Accepting a Mira conversation contract while her dialog is open requires a later real interaction');
  assert.equal(e.qa.getState().stats['talk:mira'], 1, 'Accept refresh does not dispatch talk');
  await e.button({ track: 'daily05' }); const frozen = residentPositions(e); e.step(.5); e.qa.drawGame();
  assert.equal(e.qa.getState().stats['talk:mira'], 1); assert.equal(e.qa.getState().quests.daily05.progress[0], 0); assert.equal(residentPositions(e), frozen, 'Rendering a retained conversation keeps residents paused');
  await e.el('dialog-close').dispatch('click'); e.qa.interact(); assert.equal(e.qa.getState().stats['talk:mira'], 2); assert.equal(e.qa.getState().quests.daily05.progress[0], 1, 'A new physical conversation is counted once');
  await e.el('dialog-close').dispatch('click'); e.at(npc(e, 'bao')); e.qa.interact(); assert.equal(e.qa.getState().stats['talk:bao'], 1); assert.equal(e.qa.getState().quests.daily05.progress[1], 1);
  const before = e.qa.getState().stats; await e.button({ claim: 'daily05' }); assert.equal(e.qa.getState().quests.daily05.status, 'claimed'); assert.deepEqual(e.qa.getState().stats, before, 'Reward rendering dispatches no extra talk for the open NPC');
  await e.button({ claim: 'daily05' }); assert.deepEqual(e.qa.getState().stats, before, 'A rejected repeat claim also leaves visit counters unchanged');
});

test('Resident guide targets story conversations and updates a manually chosen resident as they walk', async () => {
  const e = loadGame(); await e.start(); assert.equal(e.qa.getGuide().id, 'mira');
  await e.el('btn-residents').dispatch('click'); assert.match(e.el('dialog-body').innerHTML, /data-find-npc="nam"/);
  await e.button({ findNpc: 'nam' }); assert.equal(e.el('game-dialog').open, false); assert.equal(e.qa.getGuide().id, 'nam');
  const moving = moveResidentFromHome(e, 'nam'); e.qa.update(0); const guide = e.qa.getGuide(); assert.equal(guide.x, moving.x); assert.equal(guide.y, moving.y);
  assert.match(e.el('npc-guide').textContent, /Nam/); assert.match(e.el('npc-guide').textContent, /Làng Ánh Sao/);
  e.at(moving); e.qa.update(0); assert.match(e.el('npc-guide').textContent, /E|gần|Trò chuyện/i, 'Arrival instruction lets the player start the conversation');
});

test('Patrol runtime remains separate from player progress and reload preserves the real player save', async () => {
  const playerSave = JSON.stringify({ sentinel: 'player-owned-save' }), storage = new Map([['starfall-valley-save-v1', playerSave]]);
  const e = loadGame({ storage }); await e.start('Người kiểm tra'); moveResidentFromHome(e, 'mira'); e.qa.interact(); e.step(5.1);
  const saved = JSON.parse(storage.get(e.qa.storageKey)); assert.equal(Object.hasOwn(saved, 'npcs'), false); assert.equal(storage.get('starfall-valley-save-v1'), playerSave);
  const loaded = loadGame({ storage }); assert.equal(loaded.qa.getState().name, 'Người kiểm tra'); assert.equal(loaded.qa.getNPCs().length, 11);
  assert.equal(npc(loaded, 'mira').x, loaded.qa.data.npcs.find(n => n.id === 'mira').x, 'Reload starts a fresh walk without damaging quest progress'); assert.equal(storage.get('starfall-valley-save-v1'), playerSave);
});

test('Shipped world uses distinct connected road masks and keeps trunks and decorative flora clear of every branch', () => {
  const e = loadGame(), signatures = new Set();
  for (const region of e.qa.data.regions) {
    const layout = e.qa.getPaths(region.id), area = e.qa.getWorld()[region.id];
    assert.equal(layout.map, region.id); assert.equal(layout.width, 1600); assert.equal(layout.height, 1100);
    signatures.add(JSON.stringify(layout.segments.map(s => s.points)));
    assert.ok(layout.landmarks.length >= 4, `${region.id} roads connect meaningful destinations`);
    for (const landmark of layout.landmarks) assert.equal(e.qa.pathContains(region.id, landmark.x, landmark.y), true, `${region.id}/${landmark.id} remains on its road`);
    for (const tree of area.trees) assert.equal(e.qa.pathContains(region.id, tree.x, tree.y, 16), false, `${region.id} trunk at ${tree.x},${tree.y} must not block a branch or junction`);
    for (const flora of e.qa.getAmbientScene(region.id).flora) assert.equal(e.qa.pathContains(region.id, flora.x, flora.y, 15), false, `${region.id} grass and flowers leave roads readable`);
    let roadCells = 0;
    for (let id = 0; id < layout.cells.length; id++) {
      if (!layout.cells[id]) continue;
      const x = (id % layout.cols) * layout.cellSize + layout.cellSize / 2, y = Math.floor(id / layout.cols) * layout.cellSize + layout.cellSize / 2;
      assert.equal(e.qa.blockedAt(region.id, x, y), false, `${region.id} road at ${x},${y} must not cross a house, tree or water`);
      roadCells++;
    }
    assert.ok(roadCells > 1000, `${region.id} has a real connected road network`);
    e.set({ map: region.id, upgrades: unlocked(e) }); assert.equal(e.qa.getState().map, region.id); e.calls.length = 0; e.qa.drawGame();
    assert.ok(e.calls.some(c => c.context !== 'gameCanvas' && c.name === 'fillRect' && c.fillStyle === layout.palette.base), `${region.id} renderer paints the shipped road layout`);
  }
  assert.equal(signatures.size, 4, 'Each region has its own road arrangement');
});

test('Terrain calls the unified path renderer once per cache entry and removes the old overlapping road rectangles', () => {
  const e = loadGame(), rendered = [], originalDraw = e.paths.draw;
  e.paths.draw = (context, layout) => { rendered.push(layout.map); return originalDraw(context, layout); };
  for (const region of e.qa.data.regions) {
    e.set({ map: region.id, upgrades: unlocked(e) }); assert.equal(e.qa.getState().map, region.id); e.calls.length = 0; e.qa.drawGame();
    assert.equal(rendered.filter(map => map === region.id).length, 1, `${region.id} terrain uses its actual unified road mask`);
    assert.equal(e.calls.some(c => c.context !== 'gameCanvas' && c.name === 'fillRect' && c.fillStyle === '#dece9d' && c.args[2] === 1600 && c.args[3] === 110), false, 'Legacy full-width road cannot cover the new junctions');
    assert.equal(e.calls.some(c => c.context !== 'gameCanvas' && c.name === 'fillRect' && c.fillStyle === '#dece9d' && c.args[2] === 106 && c.args[3] === 1100), false, 'Legacy full-height road cannot cover regional paths');
    e.qa.drawGame(); assert.equal(rendered.filter(map => map === region.id).length, 1, 'Repeated frames reuse terrain without repainting intersections');
  }
});

const allFeedback = e => { const { effects, particles } = e.qa.getEffects(); return [...effects, ...particles]; };
const feedback = (e, kind) => allFeedback(e).filter(effect => effect.kind === kind);
function shortSteps(e, seconds) { for (let i = 0; i < Math.ceil(seconds / .05); i++) e.step(.05); }

test('Footstep dust follows actual displacement in all regions and never appears when movement is blocked', async () => {
  const e = loadGame(); await e.start();
  for (const region of e.qa.data.regions) {
    e.set({ map: region.id, x: 800, y: 550, minutes: 600, day: 1, upgrades: unlocked(e) }); assert.equal(e.qa.getState().map, region.id); e.step(2);
    assert.equal(allFeedback(e).length, 0); const before = e.qa.getState().x;
    await e.key('d'); shortSteps(e, .2); await e.key('d', 'keyup');
    assert.ok(e.qa.getState().x > before); assert.ok(feedback(e, 'dust').length > 0, `${region.id} walking leaves brief ground feedback`);
    assert.ok(feedback(e, 'dust').every(effect => effect.map === region.id));
    e.step(2); e.set({ x: 800, y: 40 }); const boundary = e.qa.getState().y;
    await e.key('w'); shortSteps(e, .3); await e.key('w', 'keyup');
    assert.equal(e.qa.getState().y, boundary); assert.equal(e.qa.getState().moving, false); assert.equal(feedback(e, 'dust').length, 0, 'Pressed keys against the boundary are not footsteps');
  }
  e.set({ map: 'village', x: 800, y: 550, day: 2 }); await e.key('d'); shortSteps(e, .2); await e.key('d', 'keyup');
  assert.equal(feedback(e, 'dust')[0].color, '#c0dad1', 'Rain changes the ground feedback to wet footsteps');
});

test('Resource pickups create visible local reward text and rings; failed actions create no misleading feedback', async () => {
  const e = loadGame(); await e.start(); const wood = object(e, 'resource', 'wood'); e.at(wood); e.qa.interact();
  assert.equal(e.qa.getState().inventory.wood, 3); assert.equal(feedback(e, 'particle').length, 10);
  assert.ok(feedback(e, 'ring').some(f => f.x === wood.x && f.y === wood.y - 20));
  assert.ok(feedback(e, 'text').some(f => f.text === '+3 Gỗ thông' && f.map === 'village'));
  e.calls.length = 0; e.qa.drawGame(); assert.ok(e.calls.some(c => c.context === 'gameCanvas' && c.name === 'fillText' && c.args[0] === '+3 Gỗ thông'), 'Floating pickup reward is rendered in the world');
  let effects = JSON.stringify(allFeedback(e)); e.qa.interact(); assert.equal(JSON.stringify(allFeedback(e)), effects, 'Cooldown rejection must not replay pickup feedback');
  e.step(2); assert.equal(allFeedback(e).length, 0, 'Pickup effects expire without leaving persistent particles');
  e.advance(30000); const state = e.qa.getState(); state.inventory.wood = 100; e.qa.setState(state); effects = JSON.stringify(allFeedback(e)); e.qa.interact();
  assert.equal(JSON.stringify(allFeedback(e)), effects); assert.equal(e.qa.getState().inventory.wood, 100, 'Full bag produces neither reward nor reward animation');
});

test('Planting, harvesting, fishing and combat animate their real successful gameplay events', async () => {
  const e = loadGame(); await e.start(); const plot = object(e, 'plot'); e.at(plot); e.qa.interact();
  assert.equal(e.qa.getState().stats['plant:berry'], 1); assert.ok(feedback(e, 'sprout').some(f => f.x === plot.x && f.y === plot.y));
  e.step(2); e.advance(16000); e.qa.interact(); assert.equal(e.qa.getState().inventory.berry, 4); assert.ok(feedback(e, 'text').some(f => f.text === '+4 mâm xôi')); assert.ok(feedback(e, 'ring').length);
  e.step(2); const spot = object(e, 'fish'); e.at(spot); e.qa.interact(); assert.ok(feedback(e, 'ripple').length, 'Casting creates a local water ripple');
  e.step(Math.PI / 2 / 3.8); e.qa.interact(); assert.equal(e.qa.getState().inventory.fish, 1); assert.ok(feedback(e, 'text').some(f => f.text === '+1 cá vịnh'));
  e.set({ map: 'forest', x: 420, y: 670 }); e.step(0); const mob = e.qa.getWorld().forest.mobs[0]; e.qa.attack();
  assert.equal(mob.hp, 2); assert.ok(mob.hitTime > 0); assert.equal(feedback(e, 'slash').length, 1); assert.ok(feedback(e, 'text').some(f => f.text === '−1'));
  const effectCount = allFeedback(e).length, stamina = e.qa.getState().stamina; e.qa.attack(); assert.equal(allFeedback(e).length, effectCount); assert.equal(e.qa.getState().stamina, stamina, 'Attack cooldown rejects both gameplay and animation spam');
  e.step(.4); e.set({ x: 800, y: 170 }); e.qa.attack(); assert.equal(feedback(e, 'slash').length, 1, 'A real empty swing still has one sword trail'); assert.equal(feedback(e, 'particle').length, 10, 'A missed swing invents no impact particles');
});

test('Feedback remains bounded under repeated pickups and is discarded across region travel or defeat', async () => {
  const e = loadGame(); await e.start(); const wood = object(e, 'resource', 'wood'); e.at(wood);
  for (let i = 0; i < 130; i++) {
    const state = e.qa.getState(); state.inventory.wood = 0; state.stamina = 100; e.qa.setState(state); e.advance(30001); e.qa.interact();
    assert.ok(feedback(e, 'particle').length <= 100); assert.ok(allFeedback(e).filter(f => f.kind !== 'particle').length <= 80);
  }
  assert.equal(feedback(e, 'particle').length, 100, 'Stress case actually fills the particle budget'); assert.equal(allFeedback(e).filter(f => f.kind !== 'particle').length, 80, 'Stress case actually fills the feedback budget');
  e.set({ upgrades: unlocked(e) }); const gate = objects(e).find(o => o.kind === 'gate' && o.to === 'coast'); e.at(gate); e.qa.interact();
  assert.equal(e.qa.getState().map, 'coast'); assert.ok(allFeedback(e).every(f => f.map === 'coast'), 'Travel does not bring old pickup clouds into the new map');
  e.set({ map: 'forest', x: 420, y: 670 }); e.step(0); e.qa.attack(); assert.ok(allFeedback(e).some(f => f.map === 'forest'));
  const mob = e.qa.getWorld().forest.mobs[0]; e.set({ x: mob.x, y: mob.y, health: 8 }); e.step(1.3);
  assert.equal(e.qa.getState().map, 'village'); assert.ok(allFeedback(e).every(f => f.map === 'village'), 'Defeat also removes effects from the departed map');
  e.step(2); assert.equal(allFeedback(e).length, 0, 'Even a filled queue drains after lifetimes expire');
});

test('Dialogs and chat pause ambient time and action effects, then resume without expiring hidden feedback', async () => {
  const e = loadGame(); await e.start(); e.at(object(e, 'resource', 'wood')); e.qa.interact();
  const effects = JSON.stringify(allFeedback(e)), animation = e.qa.getAnimationTime();
  await e.el('btn-journal').dispatch('click'); e.step(.5); e.qa.drawGame(); assert.equal(e.qa.getAnimationTime(), animation); assert.equal(JSON.stringify(allFeedback(e)), effects);
  await e.el('dialog-close').dispatch('click'); e.document.activeElement = e.el('chat-input'); e.step(.5); assert.equal(e.qa.getAnimationTime(), animation); assert.equal(JSON.stringify(allFeedback(e)), effects);
  e.document.activeElement = null; e.step(.1); assert.ok(e.qa.getAnimationTime() > animation); assert.notEqual(JSON.stringify(allFeedback(e)), effects, 'Visible effects resume from the paused age');
});

test('Reduced motion suppresses decorative flight and action FX while preserving controls and rewards, including live preference changes', async () => {
  const e = loadGame({ reducedMotion: true }); await e.start(); const wood = object(e, 'resource', 'wood'); e.at(wood); e.qa.interact();
  assert.equal(e.qa.getState().inventory.wood, 3); assert.equal(allFeedback(e).length, 0); assert.match(e.el('toast').textContent, /\+3/);
  let options = null; const originalGround = e.effects.drawGround; e.effects.drawGround = (context, scene, time, opts) => { options = opts; return originalGround(context, scene, time, opts); };
  e.qa.drawGame(); assert.equal(options.reducedMotion, true);
  const scene = e.qa.getAmbientScene('village'); assert.equal(e.effects.sampleAmbient(scene, 0, options).air.length, 0); assert.equal(e.effects.sampleAmbient(scene, 5, options).air.length, 0);
  assert.equal(JSON.stringify(e.effects.sampleAmbient(scene, 0, options).ground), JSON.stringify(e.effects.sampleAmbient(scene, 5, options).ground), 'Remaining scenery detail is still');
  e.set({ x: 800, y: 550 }); const x = e.qa.getState().x; await e.key('d'); shortSteps(e, .2); await e.key('d', 'keyup'); assert.ok(e.qa.getState().x > x); assert.equal(allFeedback(e).length, 0);
  e.motionPreference.matches = false; await e.motionPreference.dispatch('change', { matches: false }); await e.key('d'); shortSteps(e, .2); await e.key('d', 'keyup'); assert.ok(feedback(e, 'dust').length);
  e.motionPreference.matches = true; await e.motionPreference.dispatch('change', { matches: true }); assert.equal(allFeedback(e).length, 0, 'Changing the OS preference clears in-flight decorative effects');
  const before = e.qa.getState().stamina; e.qa.attack(); assert.equal(e.qa.getState().stamina, before - 2); assert.equal(allFeedback(e).length, 0, 'Reduced motion still permits real combat');
});

test('All regional ground and air animations render in their intended layers before day, night and rainy lighting', async () => {
  const e = loadGame(); await e.start(); const originalGround = e.effects.drawGround, originalAir = e.effects.drawAir;
  e.effects.drawGround = (context, scene, time, options) => { e.calls.push({ name: 'ambientGround', scene, options, time }); return originalGround(context, scene, time, options); };
  e.effects.drawAir = (context, scene, time, options) => { e.calls.push({ name: 'ambientAir', scene, options, time }); return originalAir(context, scene, time, options); };
  for (const region of e.qa.data.regions) for (const weather of [{ day: 1, minutes: 600 }, { day: 1, minutes: 1200 }, { day: 2, minutes: 600 }, { day: 2, minutes: 1200 }]) {
    e.set({ ...weather, map: region.id, x: 800, y: 550, upgrades: unlocked(e), shrines: [region.id] }); e.qa.update(0); e.calls.length = 0; const before = JSON.stringify(e.qa.getState()); e.qa.drawGame();
    const ground = e.calls.findIndex(c => c.name === 'ambientGround'), air = e.calls.findIndex(c => c.name === 'ambientAir');
    const actor = e.calls.findIndex(c => c.context === 'gameCanvas' && c.name === 'fillText' && c.args[0] === 'QA Lữ khách');
    const mask = e.calls.find(c => c.name === 'fillRect' && typeof c.fillStyle === 'string' && c.fillStyle.startsWith('rgba(25,35,61,'));
    const lighting = e.calls.findIndex(c => c.context === 'gameCanvas' && c.name === 'drawImage' && c.args[0].id === mask?.context);
    assert.ok(ground >= 0 && ground < actor && actor < air && air < lighting, `${region.id}/${weather.day}/${weather.minutes} draws ground, actors, air and lighting in order`);
    assert.equal(e.calls[ground].scene, e.qa.getAmbientScene(region.id)); assert.equal(e.calls[air].scene.map, region.id);
    assert.equal(e.calls[ground].options.rain, weather.day === 2); assert.equal(e.calls[ground].options.night, weather.minutes === 1200); assert.equal(e.calls[ground].options.viewport.width, 960);
    assert.equal(JSON.stringify(e.qa.getState()), before, 'Rendering animations cannot invent gameplay progress');
    assert.equal(e.el('gameCanvas').getContext().globalCompositeOperation, 'source-over'); assert.equal(e.el('gameCanvas').getContext().globalAlpha, 1); assert.equal(e.el('gameCanvas').getContext().stack.length, 0);
    for (const call of e.calls) if (call.args) for (const value of call.args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${call.name} must never receive an invalid coordinate`);
  }
});

test('Road rearrangement safely relocates an occupied old save without losing inventory or quest progress', () => {
  const baseline = loadGame(), saved = baseline.qa.getState(); saved.map = 'village'; saved.x = 1015; saved.y = 850; saved.coins = 879; saved.inventory.star = 7; saved.quests.story01 = { status: 'claimed', progress: [1] };
  assert.equal(baseline.qa.blockedAt(saved.map, saved.x, saved.y), true, 'Fixture is inside the relocated market foundation');
  const e = loadGame({ saved }); assert.equal(e.qa.collides(e.qa.getState().x, e.qa.getState().y), false); assert.equal(e.qa.getState().coins, 879); assert.equal(e.qa.getState().inventory.star, 7); assert.equal(e.qa.getState().quests.story01.status, 'claimed');
  assert.ok(Math.hypot(e.qa.getState().x - saved.x, e.qa.getState().y - saved.y) > 0, 'Occupied saved position moves to a nearby free point');
});

test('Road QA scenes cover every region, destination and weather using a separate save with safe unlocked spawns', async () => {
  const positions = { main: [800, 550], south: [800, 850], shore: [1050, 715], shrine: [800, 350] };
  for (const map of ['village', 'forest', 'coast', 'ruins']) for (const weather of ['day', 'night', 'rain-day', 'rain-night']) for (const spot of Object.keys(positions)) {
    const ownedSave = 'player-save-unchanged', storage = new Map([['starfall-valley-save-v1', ownedSave]]);
    const e = loadGame({ storage, search: `?qa=1&scene=roads&map=${map}&weather=${weather}&spot=${spot}` }), state = e.qa.getState();
    assert.equal(state.map, map); assert.equal(state.x, positions[spot][0]); assert.equal(state.y, positions[spot][1]); assert.equal(e.qa.collides(state.x, state.y), false, `${map}/${spot} fixture must be on safe ground`);
    assert.equal(state.day, weather.startsWith('rain') ? 2 : 1); assert.equal(state.minutes, weather.endsWith('night') ? 1200 : 600); assert.equal(state.upgrades.length, 12); assert.equal(state.coins, 6000);
    assert.equal(state.shrines.includes(map), map !== 'village'); assert.equal(e.qa.storageKey, 'starfall-valley-qa-save'); assert.equal(storage.get('starfall-valley-save-v1'), ownedSave);
    await e.start(); assert.ok(storage.has('starfall-valley-qa-save')); assert.equal(storage.get('starfall-valley-save-v1'), ownedSave, 'Starting the test scene never replaces player progress');
    e.tick(); assert.equal(storage.get('starfall-valley-save-v1'), ownedSave); assert.equal(e.qa.getPaths().map, map); assert.equal(e.qa.getAmbientScene().map, map);
  }
  const fallback = loadGame({ search: '?qa=1&scene=roads&map=unknown&weather=unknown&spot=unknown' });
  assert.equal(fallback.qa.getState().map, 'village'); assert.equal(fallback.qa.getState().day, 1); assert.equal(fallback.qa.getState().minutes, 600); assert.equal(fallback.qa.getState().x, 800); assert.equal(fallback.qa.getState().y, 550);
  const observatory = loadGame({ search: '?qa=1&scene=roads&map=village&spot=observatory' });
  assert.equal(observatory.qa.getState().x, 1350); assert.equal(observatory.qa.getState().y, 1065); assert.equal(observatory.qa.collides(1350,1065), false);
  assert.equal(observatory.qa.pathContains('village',1350,1065), true);
});

test('Debug map, weather and motion query switches are applied only when QA mode is enabled', async () => {
  const baseline = loadGame(), saved = baseline.qa.getState(); saved.name = 'Người chơi thật'; saved.coins = 881; saved.inventory.star = 6;
  const stored = JSON.stringify(saved), storage = new Map([['starfall-valley-save-v1', stored]]);
  const ordinary = loadGame({ storage, search: '?scene=roads&map=coast&weather=rain-night&motion=reduced', expectQA: false });
  assert.equal(ordinary.el('player-name').value, saved.name); assert.equal(ordinary.el('coins').textContent, '◈ 881 xu'); assert.equal(ordinary.el('map-name').textContent, 'Làng Ánh Sao'); assert.match(ordinary.el('weather-label').textContent, /Ban ngày.*Trời trong/); assert.equal(storage.get('starfall-valley-save-v1'), stored);
  ordinary.calls.length = 0; ordinary.tick(16); const normalTitle = paintTrace(ordinary, 'titleCanvas'); ordinary.calls.length = 0; ordinary.tick(1000); assert.notEqual(paintTrace(ordinary, 'titleCanvas'), normalTitle, 'QA-only motion query does not override normal player preferences');
  await ordinary.start(saved.name); const resumed = JSON.parse(storage.get('starfall-valley-save-v1'));
  assert.equal(resumed.coins, 881); assert.equal(resumed.inventory.star, 6); assert.equal(resumed.upgrades.length, 0); assert.equal(storage.has('starfall-valley-qa-save'), false, 'Debug query cannot reset a normal game');
  const debug = loadGame({ search: '?qa=1&scene=roads&map=forest&motion=reduced' }); assert.equal(debug.qa.isReducedMotion(), true); assert.equal(debug.qa.getAmbientSample().air.length, 0);
});

function paintTrace(e, context) {
  return JSON.stringify(e.calls.filter(c => c.context === context && ['fillRect', 'fillText', 'fill', 'moveTo', 'lineTo', 'translate', 'scale'].includes(c.name)).map(c => ({ name: c.name, args: c.args, color: ['fillRect', 'fillText', 'fill'].includes(c.name) ? c.fillStyle : undefined, alpha: c.alpha })));
}
test('Reduced motion freezes the complete title illustration while normal title frames continue animating', () => {
  for (const reducedMotion of [false, true]) {
    const e = loadGame({ reducedMotion }); e.calls.length = 0; e.tick(16); const first = paintTrace(e, 'titleCanvas'), time = e.qa.getAnimationTime();
    e.calls.length = 0; e.tick(1000); const next = paintTrace(e, 'titleCanvas');
    if (reducedMotion) { assert.equal(next, first); assert.equal(e.qa.getAnimationTime(), time); }
    else { assert.notEqual(next, first); assert.ok(e.qa.getAnimationTime() > time); }
    assert.equal(e.el('titleCanvas').getContext().stack.length, 0, 'Tree canopy transforms are balanced on the title canvas');
  }
});

function sceneryTrace(e) {
  e.calls.length = 0; e.qa.drawGame();
  const canvasCalls = e.calls.filter(c => c.context === 'gameCanvas');
  return {
    canopy: JSON.stringify(canvasCalls.filter(c => c.name === 'translate' && c.args[1] === 0 && Math.abs(c.args[0]) <= 2).map(c => c.args)),
    trunk: JSON.stringify(canvasCalls.filter(c => c.name === 'fillRect' && c.fillStyle === '#624c39').map(c => c.args)),
    flame: JSON.stringify(canvasCalls.filter(c => c.name === 'fillRect' && c.fillStyle === '#fff1b4' && c.args[2] === 4 && c.args[3] === 17).map(c => c.args)),
    star: JSON.stringify(canvasCalls.filter(c => c.name === 'fillRect' && c.fillStyle === '#eacb77').map(c => c.args)),
    rain: JSON.stringify(canvasCalls.filter(c => ['moveTo', 'lineTo'].includes(c.name) && c.strokeStyle === '#d8e6eb80').map(c => c.args))
  };
}
test('Canopies, camp fire, resource stars, rain and walking feet respect reduced motion without moving tree trunks', async () => {
  for (const reducedMotion of [false, true]) {
    const e = loadGame({ search: '?qa=1&scene=roads&map=village&weather=rain-night', reducedMotion }); await e.start(); e.step(.27); const first = sceneryTrace(e);
    e.step(.27); const next = sceneryTrace(e); assert.equal(next.trunk, first.trunk, 'Wind never moves the collision trunk');
    assert.notEqual(first.canopy, '[]'); assert.notEqual(first.flame, '[]'); assert.notEqual(first.star, '[]'); assert.notEqual(first.rain, '[]');
    for (const kind of ['canopy', 'flame', 'star', 'rain']) {
      if (reducedMotion) assert.equal(next[kind], first[kind], `${kind} remains still`);
      else assert.notEqual(next[kind], first[kind], `${kind} visibly changes over time`);
    }
    if (reducedMotion) assert.ok(e.calls.filter(c => c.context === 'gameCanvas' && c.name === 'translate' && c.args[1] === 0 && Math.abs(c.args[0]) <= 2).every(c => c.args[0] === 0));
    const renders = [], drawActor = e.actors.draw;
    e.actors.draw = (ctx, options) => { if (options.isPlayer) renders.push({ ...options }); return drawActor(ctx, options); };
    await e.key('d');
    for (let i = 0; i < 2; i++) { e.step(.08); e.qa.drawGame(); }
    await e.key('d', 'keyup'); assert.equal(renders.length, 2); assert.ok(renders.every(r => r.moving && r.reducedMotion === reducedMotion)); assert.ok(renders[1].distance > renders[0].distance, 'Walking distance comes from actual travel even when animation is reduced');
    // Compare the real renderer at one fixed anchor so world movement cannot make
    // a static reduced-motion sprite look animated in the recorded canvas calls.
    const spritePaint = options => { e.calls.length = 0; drawActor(e.el('gameCanvas').getContext('2d'), { ...options, x: 0, y: 0 }); return JSON.stringify(e.calls.filter(c => c.name === 'fillRect').map(c => [c.args, c.fillStyle])); };
    const firstSprite = spritePaint(renders[0]), nextSprite = spritePaint(renders[1]);
    if (reducedMotion) assert.equal(nextSprite, firstSprite, 'Reduced walking has a static sprite pose'); else assert.notEqual(nextSprite, firstSprite, 'Normal walking feet advance their gait');
    assert.equal(e.el('gameCanvas').getContext().stack.length, 0);
  }
});

function assertMobLand(e, map, previous, maximumDisplacement = Infinity) {
  for (const mob of e.qa.getWorld()[map].mobs) {
    assert.equal(e.qa.blockedAt(map, mob.x, mob.y), false, `${map}/${mob.id} stays off water, trunks and boundaries at ${mob.x},${mob.y}`);
    if (!previous) continue;
    const from = previous.get(mob.id), distance = Math.hypot(mob.x - from.x, mob.y - from.y), count = Math.max(1, Math.ceil(distance / 3));
    assert.ok(distance <= maximumDisplacement + 1e-7, `${map}/${mob.id} moved ${distance}px, beyond the ${maximumDisplacement}px frame budget`);
    for (let i = 1; i <= count; i++) assert.equal(e.qa.blockedAt(map, from.x + (mob.x - from.x) * i / count, from.y + (mob.y - from.y) * i / count), false, `${map}/${mob.id} movement must not jump through terrain from ${from.x},${from.y} to ${mob.x},${mob.y}`);
  }
}
test('All regional slimes spawn and respawn on land, and their wandering and pursuit never enter water or trunks', async () => {
  const e = loadGame(); await e.start();
  for (const map of ['forest', 'coast', 'ruins']) {
    e.set({ map, x: 1500, y: 100, health: 100, upgrades: unlocked(e) }); const area = e.qa.getWorld()[map]; assert.equal(area.mobs.length, 5); assertMobLand(e, map);
    const last = area.mobs[4]; assert.equal(last.homeY, 940, `${map} last slime lives below the pond`);
    for (let frame = 0; frame < 300; frame++) { const before = new Map(area.mobs.map(m => [m.id, { x: m.x, y: m.y }])); e.step(.05); assertMobLand(e, map, before, 24 * .05); }
    const pursuing = area.mobs[0]; pursuing.x = 1140; pursuing.y = 610; e.set({ x: 1080, y: 660, health: 100 }); assertMobLand(e, map);
    for (let frame = 0; frame < 150; frame++) { const from = { x: pursuing.x, y: pursuing.y }; e.step(.05); assertMobLand(e, map); const distance = Math.hypot(pursuing.x - from.x, pursuing.y - from.y), count = Math.max(1, Math.ceil(distance / 3)); assert.ok(distance <= 38 * .05 + 1e-7, 'Pursuit keeps a steady bounded walking speed'); for (let i = 1; i <= count; i++) assert.equal(e.qa.blockedAt(map, from.x + (pursuing.x - from.x) * i / count, from.y + (pursuing.y - from.y) * i / count), false, 'Chasing around the pond corner cannot cut through water'); }
    const tree = area.trees.find(t => !e.qa.blockedAt(map, t.x - 36, t.y) && !e.qa.blockedAt(map, t.x + 36, t.y)); assert.ok(tree, `${map} has a trunk obstacle fixture`);
    pursuing.x = tree.x - 36; pursuing.y = tree.y; e.set({ x: tree.x + 36, y: tree.y, health: 100 });
    for (let frame = 0; frame < 150; frame++) { e.step(.05); assertMobLand(e, map); }
    last.hp = 0; last.deadUntil = 0; e.step(.05); assert.equal(last.hp, 3); assert.equal(e.qa.blockedAt(map, last.x, last.y), false, 'Respawned pond-side slime is still on land');
    assert.equal(e.qa.getState().map, map, 'Fixture player survives the pursuit check');
  }
});

test('Slime frame spikes are capped and hidden regions keep their own mob positions', async () => {
  const e = loadGame(); await e.start(); e.set({ map: 'forest', x: 1500, y: 100, upgrades: unlocked(e) });
  const hidden = JSON.stringify(['coast', 'ruins'].flatMap(map => e.qa.getWorld()[map].mobs.map(m => [m.id, m.x, m.y])));
  let before = new Map(e.qa.getWorld().forest.mobs.map(m => [m.id, { x: m.x, y: m.y }])); e.step(5); assertMobLand(e, 'forest', before, 24 * .25);
  const mob = e.qa.getWorld().forest.mobs[0]; mob.x = 1140; mob.y = 610; e.set({ x: 1080, y: 660, health: 100 });
  for (let frame = 0; frame < 3; frame++) { before = new Map(e.qa.getWorld().forest.mobs.map(m => [m.id, { x: m.x, y: m.y }])); e.step(5); assertMobLand(e, 'forest', before, 38 * .25); }
  assert.equal(JSON.stringify(['coast', 'ruins'].flatMap(map => e.qa.getWorld()[map].mobs.map(m => [m.id, m.x, m.y]))), hidden, 'Current-region animation cannot move distant map mobs');
});

const locomotion = e => e.qa.getLocomotion();
const cardinalKeys = [{ key: 'w', direction: 'up', dx: 0, dy: -1 }, { key: 's', direction: 'down', dx: 0, dy: 1 }, { key: 'a', direction: 'left', dx: -1, dy: 0 }, { key: 'd', direction: 'right', dx: 1, dy: 0 }];
const almost = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} instead of ${expected}`);

test('Player turns in four directions, keeps the idle facing and walks/runs at the intended speed with boots', async () => {
  for (const boots of [false, true]) for (const run of [false, true]) for (const { key, direction, dx, dy } of cardinalKeys) {
    const e = loadGame(); await e.start(); e.set({ x: 800, y: 550, stamina: 57, upgrades: boots ? ['boots'] : [] });
    const before = e.qa.getState(), initialDistance = locomotion(e).distance, speed = (boots ? 225 : 180) * (run ? 1.65 : 1);
    if (run) await e.key('Shift'); await e.key(key); e.step(.1); const after = e.qa.getState(), gait = locomotion(e);
    almost(after.x - before.x, dx * speed * .1, `${direction} x movement`); almost(after.y - before.y, dy * speed * .1, `${direction} y movement`);
    almost(gait.distance - initialDistance, speed * .1, 'Gait distance equals real movement'); almost(gait.speed, speed, 'Selected locomotion speed');
    assert.equal(gait.direction, direction); assert.equal(gait.running, run); assert.equal(after.moving, true); assert.equal(after.stamina, 57, 'Running does not drain resource/action stamina');
    await e.key(key, 'keyup'); if (run) await e.key('Shift', 'keyup'); const resting = { x: after.x, y: after.y, distance: gait.distance }; e.step(.1);
    assert.equal(e.qa.getState().x, resting.x); assert.equal(e.qa.getState().y, resting.y); assert.equal(locomotion(e).distance, resting.distance); assert.equal(locomotion(e).direction, direction); assert.equal(locomotion(e).running, false); assert.equal(e.qa.getState().moving, false);
  }
});

test('Diagonal walking and running are normalized; releasing Shift immediately returns to the walking gait', async () => {
  for (const [one, two, dx, dy] of [['w', 'a', -1, -1], ['w', 'd', 1, -1], ['s', 'a', -1, 1], ['s', 'd', 1, 1]]) for (const run of [false, true]) {
    const e = loadGame(); await e.start(); e.set({ x: 800, y: 550 }); if (run) await e.key('Shift'); await e.key(one); await e.key(two);
    const initial = locomotion(e).distance; e.step(.1); const state = e.qa.getState(), speed = 180 * (run ? 1.65 : 1), component = speed * .1 / Math.sqrt(2);
    almost(state.x - 800, dx * component, 'Normalized diagonal x'); almost(state.y - 550, dy * component, 'Normalized diagonal y'); almost(locomotion(e).distance - initial, speed * .1, 'Diagonal speed is the same as an axis');
  }
  const e = loadGame(); await e.start(); e.set({ x: 800, y: 550 }); await e.key('d'); await e.key('Shift'); e.step(.1); assert.equal(locomotion(e).running, true);
  const sprintX = e.qa.getState().x; await e.key('Shift', 'keyup'); e.step(.1); almost(e.qa.getState().x - sprintX, 18, 'Shift release returns to walking without releasing direction'); assert.equal(locomotion(e).running, false); assert.equal(locomotion(e).speed, 180);
});

test('Starting and stopping ease only the sprite amplitude while position and gait phase stop immediately', async () => {
  const e=loadGame();await e.start();e.set({x:800,y:550});await e.key('d');e.step(.016);
  let gait=locomotion(e);assert.ok(gait.motionWeight>0&&gait.motionWeight<1);almost(e.qa.getState().x-800,180*.016,'Input has no acceleration delay');
  almost(gait.phase,gait.distance/actorArt.artMetrics.walkCycleDistance,'Phase uses actual travelled distance');
  e.step(.064);assert.equal(locomotion(e).motionWeight,1);await e.key('d','keyup');
  const stop=e.qa.getState(),phase=locomotion(e).phase,travel=locomotion(e).distance;
  for(let i=0;i<3;i++){e.step(.016);gait=locomotion(e);assert.equal(e.qa.getState().x,stop.x);assert.equal(e.qa.getState().y,stop.y);assert.equal(gait.phase,phase);assert.equal(gait.distance,travel);assert.equal(e.qa.getState().moving,false);assert.ok(gait.motionWeight>0&&gait.motionWeight<1);}
  e.step(.08);assert.equal(locomotion(e).motionWeight,0);assert.equal(locomotion(e).phase,phase);
});

test('Walk/run transitions preserve the current foot phase and ease the sprint stance separately', async () => {
  const e=loadGame();await e.start();e.set({x:800,y:550});await e.key('d');e.step(.11);
  const before=locomotion(e);await e.key('Shift');e.step(.016);let gait=locomotion(e);
  almost(gait.phase,(before.phase+297*.016/actorArt.artMetrics.runCycleDistance)%1,'Sprint advances the previous phase');assert.ok(gait.runWeight>0&&gait.runWeight<1);assert.equal(gait.running,true);
  e.step(.084);assert.equal(locomotion(e).runWeight,1);const sprint=locomotion(e);await e.key('Shift','keyup');e.step(.016);gait=locomotion(e);
  almost(gait.phase,(sprint.phase+180*.016/actorArt.artMetrics.walkCycleDistance)%1,'Walk continues the sprint phase');assert.ok(gait.runWeight>0&&gait.runWeight<1);assert.equal(gait.running,false);almost(gait.speed,180,'Physics immediately uses walking speed');
  await e.key('d','keyup');e.step(.13);assert.equal(locomotion(e).runWeight,0);assert.equal(locomotion(e).motionWeight,0);
});

test('The softened gait depends on distance rather than rendering frequency and never cycles against a wall', async () => {
  const results=[];
  for(const steps of [1,12]){const e=loadGame();await e.start();e.set({x:800,y:550});await e.key('d');for(let i=0;i<steps;i++)e.step(.12/steps);results.push(locomotion(e));const before=locomotion(e);for(let i=0;i<10;i++)e.qa.drawGame();assert.deepEqual(locomotion(e),before,'Drawing does not advance animation state');}
  almost(results[0].phase,results[1].phase,'Frame partition preserves phase');almost(results[0].motionWeight,results[1].motionWeight,'Frame partition preserves envelope');
  const e=loadGame();await e.start();e.set({x:1560,y:550});await e.key('d');e.step(.25);const stop=e.qa.getState(),phase=locomotion(e).phase;
  for(let i=0;i<15;i++)e.step(.016);assert.equal(e.qa.getState().x,stop.x);assert.equal(locomotion(e).phase,phase);assert.equal(locomotion(e).motionWeight,0);assert.equal(e.qa.getState().moving,false);
});

test('Every resident uses a separate distance phase and settles without moving when the player approaches', async () => {
  for(const entry of actorArt.directions){assert.ok(entry);}
  const e=loadGame();await e.start();e.set({upgrades:unlocked(e)});
  for(const catalog of e.qa.data.npcs){const n=moveResidentFromHome(e,catalog.id),motion=e.qa.getActorMotion(n.id);assert.ok(motion.motionWeight>0,`${n.id} has an active gait`);almost(motion.phase,(n.walkDistance/actorArt.artMetrics.walkCycleDistance)%1,`${n.id} measured patrol distance`);
    e.set({x:n.x,y:n.y+20});const at={x:n.x,y:n.y},phase=motion.phase;e.step(.016);assert.equal(n.moving,false);assert.equal(n.x,at.x);assert.equal(n.y,at.y);assert.equal(e.qa.getActorMotion(n.id).phase,phase);assert.ok(e.qa.getActorMotion(n.id).motionWeight<motion.motionWeight);e.step(.13);assert.equal(e.qa.getActorMotion(n.id).motionWeight,0);
  }
});

test('Pauses and reduced motion neutralize visual envelopes while teleports reset the player phase', async () => {
  const e=loadGame();await e.start();e.set({x:800,y:550});await e.key('d');e.step(.09);assert.equal(locomotion(e).motionWeight,1);await e.el('btn-journal').dispatch('click');assert.equal(locomotion(e).motionWeight,0);const phase=locomotion(e).phase;e.step(.05);assert.equal(locomotion(e).phase,phase);await e.el('dialog-close').dispatch('click');e.step(.05);assert.equal(locomotion(e).motionWeight,0);
  e.motionPreference.matches=true;await e.motionPreference.dispatch('change',{matches:true});await e.key('d');e.step(.1);assert.ok(locomotion(e).distance>0);assert.equal(locomotion(e).phase,phase);assert.equal(locomotion(e).motionWeight,0);assert.equal(locomotion(e).runWeight,0);await e.key('d','keyup');
  e.motionPreference.matches=false;await e.motionPreference.dispatch('change',{matches:false});e.at(objects(e,'village').find(o=>o.kind==='gate'&&o.to==='forest'));e.qa.interact();assert.equal(locomotion(e).phase,0);assert.equal(locomotion(e).motionWeight,0);e.step(.03);assert.equal(locomotion(e).phase,0);
});

test('Real renderer receives independent continuous phases and settling weights without persisting them', async () => {
  const storage=new Map([['starfall-valley-save-v1','{"player":"preserved"}']]),e=loadGame({storage});await e.start();e.set({x:800,y:550});const draws=[],draw=e.actors.draw;e.actors.draw=(ctx,o)=>{draws.push({...o});return draw(ctx,o);};await e.key('d');e.step(.09);await e.key('d','keyup');e.step(.02);e.qa.drawGame();const player=draws.find(o=>o.id==='player');assert.equal(player.moving,false);assert.ok(player.motionWeight>0&&player.motionWeight<1);almost(player.phase,locomotion(e).phase,'Renderer keeps the stopped phase');
  const mira=moveResidentFromHome(e,'mira');draws.length=0;e.qa.drawGame();const resident=draws.find(o=>o.id==='mira');almost(resident.phase,e.qa.getActorMotion('mira').phase,'NPC has its own animation state');assert.ok(resident.motionWeight>0);assert.equal(resident.runWeight,0);assert.equal(resident.distance,mira.walkDistance);
  await e.window.dispatch('pagehide');const saved=JSON.parse(storage.get(e.qa.storageKey));for(const key of ['phase','motionWeight','runWeight','actorMotions'])assert.equal(Object.hasOwn(saved,key),false,`${key} is session-only`);assert.equal(storage.get('starfall-valley-save-v1'),'{"player":"preserved"}');
});

test('Mobile run toggle has an accessible state, combines with touch arrows and stops when pointers are cancelled', async () => {
  const e = loadGame({ width: 390, height: 844 }); await e.start(); e.set({ x: 800, y: 550 }); const toggle = e.el('touch-run'), right = e.directions.find(b => b.dataset.move === 'right');
  assert.equal(toggle.attributes['aria-pressed'], 'false'); await toggle.dispatch('click'); assert.equal(toggle.attributes['aria-pressed'], 'true'); assert.match(toggle.textContent, /Đang chạy/); assert.equal(locomotion(e).touchRun, true);
  await right.dispatch('pointerdown', { pointerId: 7 }); e.step(.1); almost(e.qa.getState().x - 800, 29.7, 'Mobile sprint has the same speed as Shift'); assert.equal(locomotion(e).running, true);
  await right.dispatch('pointercancel', { pointerId: 7 }); const stopped = e.qa.getState().x, phase = locomotion(e).distance; e.step(.1); assert.equal(e.qa.getState().x, stopped); assert.equal(locomotion(e).distance, phase); assert.equal(locomotion(e).running, false);
  await toggle.dispatch('click'); assert.equal(toggle.attributes['aria-pressed'], 'false'); assert.match(toggle.textContent, /Chạy/); assert.equal(locomotion(e).touchRun, false);
  for (const event of ['pointerup', 'lostpointercapture']) { await right.dispatch('pointerdown', { pointerId: 8 }); e.step(.02); await right.dispatch(event, { pointerId: 8 }); const x = e.qa.getState().x; e.step(.02); assert.equal(e.qa.getState().x, x, `${event} stops movement`); }
});

test('Chat, dialogs, fishing, page lifecycle and title return clear held movement and mobile sprint', async () => {
  const cases = [
    ['chat focus', async e => { e.document.activeElement = e.el('chat-input'); await e.el('chat-input').dispatch('focus'); e.step(.01); e.document.activeElement = null; }],
    ['dialog', async e => { await e.el('btn-journal').dispatch('click'); await e.el('dialog-close').dispatch('click'); }],
    ['fishing', async e => { e.at(object(e, 'fish')); e.qa.interact(); assert.equal(e.el('fishing').hidden, false); await e.key('Escape'); }],
    ['window blur', e => e.window.dispatch('blur')],
    ['hidden document', async e => { e.document.hidden = true; await e.document.dispatch('visibilitychange'); e.document.hidden = false; }],
    ['pagehide', e => e.window.dispatch('pagehide')],
    ['title return', async e => { await e.el('btn-home').dispatch('click'); await e.start(); }]
  ];
  for (const [name, reset] of cases) {
    const e = loadGame(); await e.start(); e.set({ x: 800, y: 550 }); await e.el('touch-run').dispatch('click'); await e.key('Shift'); await e.key('d'); await e.directions.find(b => b.dataset.move === 'down').dispatch('pointerdown', { pointerId: 9 }); e.step(.02); assert.equal(locomotion(e).running, true);
    await reset(e); const before = e.qa.getState(), distance = locomotion(e).distance; e.step(.05); const state = e.qa.getState(); assert.equal(state.x, before.x, `${name} clears keyboard and touch x`); assert.equal(state.y, before.y, `${name} clears keyboard and touch y`); assert.equal(locomotion(e).distance, distance, `${name} does not advance gait after reopening`); assert.equal(locomotion(e).touchRun, false, `${name} resets the run toggle`); assert.equal(locomotion(e).running, false); assert.equal(e.el('touch-run').attributes['aria-pressed'], 'false');
  }
});

test('Movement and run inputs pressed inside chat, dialogs, fishing or the title never leak into gameplay', async () => {
  const cases = [
    ['title', async () => {}, e => e.start()],
    ['dialog', async e => { await e.start(); await e.el('btn-journal').dispatch('click'); }, e => e.el('dialog-close').dispatch('click')],
    ['chat', async e => { await e.start(); e.document.activeElement = e.el('chat-input'); }, async e => { e.document.activeElement = null; }],
    ['fishing', async e => { await e.start(); e.at(object(e, 'fish')); e.qa.interact(); }, e => e.key('Escape')]
  ];
  for (const [name, pause, resume] of cases) {
    const e = loadGame(); await pause(e); await e.key('Shift'); await e.key('d'); await e.el('touch-run').dispatch('click'); await e.directions.find(b => b.dataset.move === 'down').dispatch('pointerdown', { pointerId: 11 });
    assert.equal(locomotion(e).touchRun, false, `${name} does not accept a run toggle`); await resume(e); const before = e.qa.getState(), distance = locomotion(e).distance; e.step(.05); assert.equal(e.qa.getState().x, before.x, `${name} cannot latch keyboard movement`); assert.equal(e.qa.getState().y, before.y, `${name} cannot latch touch movement`); assert.equal(locomotion(e).distance, distance); assert.equal(locomotion(e).running, false);
  }
});

test('Map travel and defeat clear movement/run input without turning teleports into gait distance', async () => {
  const e = loadGame(); await e.start(); const gate = objects(e, 'village').find(o => o.kind === 'gate' && o.to === 'forest'); e.at(gate); await e.el('touch-run').dispatch('click'); await e.key('Shift'); await e.key('d'); e.step(.01); assert.ok(locomotion(e).distance > 0); e.qa.interact(); assert.equal(e.qa.getState().map, 'forest'); assert.equal(locomotion(e).touchRun, false); assert.equal(locomotion(e).distance, 0, 'Map arrival resets gait instead of measuring the teleport'); const arrived = e.qa.getState(); e.step(.05); assert.equal(e.qa.getState().x, arrived.x); assert.equal(e.qa.getState().y, arrived.y);
  const mob = e.qa.getWorld().forest.mobs[0]; e.at({ map: 'forest', x: mob.x, y: mob.y }, { health: 1 }); await e.el('touch-run').dispatch('click'); await e.key('Shift'); await e.key('d'); e.step(.005); assert.equal(e.qa.getState().map, 'village', 'Damage fixture returns the player to camp'); assert.equal(locomotion(e).touchRun, false); assert.equal(locomotion(e).running, false); const returned = e.qa.getState(), distance = locomotion(e).distance; e.step(.05); assert.equal(e.qa.getState().x, returned.x); assert.equal(e.qa.getState().y, returned.y); assert.equal(locomotion(e).distance, distance, 'Recovery teleport cannot leave a run animation active');
});

test('Sprinting checks the travelled segment instead of tunnelling through trunks, ponds or map bounds', async () => {
  for (const map of ['village', 'forest', 'coast', 'ruins']) {
    const e = loadGame(); await e.start(); e.set({ map, upgrades: unlocked(e), x: 800, y: 550 });
    const tree = e.qa.getWorld()[map].trees.find(t => !e.qa.blockedAt(map, t.x - 40, t.y) && !e.qa.blockedAt(map, t.x + 53, t.y)); assert.ok(tree, `${map} has a narrow trunk fixture with open ground on both sides`);
    e.at({ map, x: tree.x - 40, y: tree.y }); await e.key('d'); await e.key('Shift'); const before = e.qa.getState(); e.step(.25); const after = e.qa.getState(); assert.ok(after.x < tree.x, `${map} sprint stops on the near side of the trunk`); assert.equal(e.qa.blockedAt(map, after.x, after.y), false);
    for (let x = before.x; x <= after.x; x += 1) assert.equal(e.qa.blockedAt(map, x, after.y), false, 'Every pixel traversed is on walkable ground');
    const phase = locomotion(e).distance; e.step(.25); assert.equal(locomotion(e).distance, phase, 'Holding run into a trunk does not animate footsteps'); assert.equal(locomotion(e).running, false); assert.equal(e.qa.getState().moving, false);
    e.set({ x: 1090, y: 715 }); e.step(.25); assert.ok(e.qa.getState().x < 1110, 'Sprint cannot leap onto or over the pond bank'); assert.equal(e.qa.collides(e.qa.getState().x, e.qa.getState().y), false);
    for (const [x, key, test] of [[1560, 'd', s => s.x <= 1575], [40, 'a', s => s.x >= 25]]) { await e.key('d', 'keyup'); await e.key('a', 'keyup'); e.set({ x, y: 550 }); await e.key(key); e.step(5); assert.ok(test(e.qa.getState()), `${map} large-frame sprint stays inside movement bounds`); assert.equal(e.qa.collides(e.qa.getState().x, e.qa.getState().y), false); }
  }
});

test('Real actor renderer receives player directions and distance gait, and NPC patrol rendering follows the live resident', async () => {
  const e = loadGame(); await e.start(); e.set({ x: 800, y: 550 }); const calls = [], draw = e.actors.draw; e.actors.draw = (ctx, options) => { calls.push({ ...options }); return draw(ctx, options); };
  for (const { key, direction } of cardinalKeys) { await e.key(key); e.step(.07); await e.key(key, 'keyup'); e.qa.drawGame(); const player = calls.filter(c => c.isPlayer).at(-1); assert.equal(player.direction, direction); assert.equal(player.moving, true); almost(player.distance, locomotion(e).distance, 'Player draw uses actual distance'); e.step(.01); e.qa.drawGame(); assert.equal(calls.filter(c => c.isPlayer).at(-1).moving, false); assert.equal(calls.filter(c => c.isPlayer).at(-1).direction, direction); }
  const mira = moveResidentFromHome(e, 'mira'); assert.equal(mira.moving, true); calls.length = 0; e.qa.drawGame(); const resident = calls.find(c => c.id === 'mira'); assert.ok(resident, 'Resident uses the new actor renderer'); assert.equal(resident.moving, true); assert.ok(['up', 'down', 'left', 'right'].includes(resident.direction)); assert.ok(resident.distance > 0); assert.equal(resident.running, false);
});

test('Online player snapshots preserve four-direction sprites and running while legacy peers remain visible', async () => {
  const e = loadGame(); await e.start(); const socket = e.sockets[0]; socket.readyState = 1; socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self' }) });
  const renders = [], draw = e.actors.draw; e.actors.draw = (ctx, options) => { renders.push({ ...options }); return draw(ctx, options); };
  socket.onmessage({ data: JSON.stringify({ type: 'snapshot', players: [{ id: 'self', name: 'OwnCopy', map: 'village', x: 800, y: 550, color: '#77aa99' }, { id: 'peer-new', name: 'Runner', map: 'village', x: 850, y: 600, color: '#bb8899', direction: 'up', moving: true, running: true }, { id: 'peer-old', name: 'Legacy', map: 'village', x: 900, y: 600, color: '#88aabb', moving: true, facingRight: false }] }) });
  e.qa.drawGame(); const modern = renders.find(r => r.id === 'peer-new'), legacy = renders.find(r => r.id === 'peer-old'); assert.ok(modern); assert.equal(modern.direction, 'up'); assert.equal(modern.running, true); assert.equal(modern.moving, true); assert.ok(legacy); assert.equal(legacy.direction, 'left'); assert.equal(legacy.running, false); assert.equal(renders.some(r => r.id === 'self'), false, 'The client does not duplicate its online avatar');
  e.set({ x: 800, y: 550 }); await e.key('w'); await e.key('Shift'); e.step(.12); const move = socket.sent.filter(p => p.type === 'move').at(-1); assert.ok(move); assert.equal(move.direction, 'up'); assert.equal(move.running, true); assert.equal(move.moving, true); assert.equal(typeof move.facingRight, 'boolean', 'Legacy facing field is retained');
});

test('Running state is transient and saving movement preserves progress without touching the player save', async () => {
  const storage = new Map([['starfall-valley-save-v1', '{"player":"untouched"}']]); const e = loadGame({ storage }); await e.start(); e.set({ x: 800, y: 550, coins: 718, stamina: 57 }); const state = e.qa.getState(); state.inventory.wood = 15; state.quests.story01.status = 'claimed'; e.qa.setState(state); await e.el('touch-run').dispatch('click'); await e.key('d'); e.step(.1); await e.window.dispatch('pagehide');
  const saved = JSON.parse(storage.get(e.qa.storageKey)); assert.equal(saved.coins, 718); assert.equal(saved.inventory.wood, 15); assert.equal(saved.quests.story01.status, 'claimed'); assert.equal(saved.stamina, 57); assert.equal(storage.get('starfall-valley-save-v1'), '{"player":"untouched"}');
  for (const ephemeral of ['direction', 'playerDirection', 'distance', 'walkDistance', 'running', 'touchRun', 'speed','phase','motionWeight','runWeight','actorMotions']) assert.equal(Object.hasOwn(saved, ephemeral), false, `${ephemeral} is runtime animation/input, not persisted progress`);
  const loaded = loadGame({ storage }); await loaded.start(); assert.equal(loaded.qa.getState().coins, 718); assert.equal(loaded.qa.getState().inventory.wood, 15); assert.equal(locomotion(loaded).touchRun, false); assert.equal(locomotion(loaded).running, false); assert.equal(locomotion(loaded).distance, 0);
});

test('Local actor QA fixtures preview every facing on safe ground and isolate their save from real progress', async () => {
  for (const direction of ['up', 'down', 'left', 'right', 'invalid']) {
    const storage = new Map([['starfall-valley-save-v1', '{"real":"preserved"}']]), e = loadGame({ storage, search: `?qa=1&scene=actors&look=${direction}` }); const state = e.qa.getState(); assert.equal(state.map, 'village'); assert.equal(state.x, 800); assert.equal(state.y, 810); assert.equal(e.qa.collides(state.x, state.y), false); assert.equal(locomotion(e).direction, direction === 'invalid' ? 'down' : direction); assert.equal(locomotion(e).distance, 0); assert.equal(locomotion(e).running, false); await e.start(); assert.equal(storage.get('starfall-valley-save-v1'), '{"real":"preserved"}'); assert.ok(storage.has(e.qa.storageKey));
  }
  const ordinary = loadGame({ search: '?scene=actors&look=up', expectQA: false }); await ordinary.start('Người chơi'); assert.equal(JSON.parse(ordinary.storage.get('starfall-valley-save-v1')).x, 850, 'Without QA mode the scene query cannot replace player progress');
});

test('Sword rendering and slash feedback face the same four directions as the player, including reduced motion', async () => {
  const heading = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  for (const reducedMotion of [false, true]) for (const { key, direction } of cardinalKeys) {
    const e = loadGame({ reducedMotion }); await e.start(); e.set({ x: 800, y: 550 }); await e.key(key); e.step(.005); await e.key(key, 'keyup'); e.qa.attack(); e.calls.length = 0; e.qa.drawGame(); const rotation = e.calls.find(c => c.context === 'gameCanvas' && c.name === 'rotate'); assert.ok(rotation, 'Sword is drawn in the attack frame'); almost(rotation.args[0], heading[direction] + (reducedMotion ? 0 : -.9), `${direction} attack orientation`);
    const slash = feedback(e, 'slash'); if (reducedMotion) assert.equal(slash.length, 0); else { assert.equal(slash.length, 1); assert.equal(slash[0].direction, direction, 'Slash effect records the facing at the time of the attack'); }
  }
});

function assertSeparatedTags(tags) {
  for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
    const a = tags[i], b = tags[j], overlap = Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 4 && a.top < b.bottom + 4 && a.bottom > b.top - 4;
    assert.equal(overlap, false, `${a.id}/${b.id} names and quest markers must not overlap`);
  }
}

function assertTagsAvoidBodies(tags, actors) {
  for (const tag of tags) for (const actor of actors) {
    if (tag.id === actor.id) continue;
    const overlap = Math.abs(tag.x - actor.x) < (tag.width + actorArt.artMetrics.bodyWidth) / 2 + 4 && tag.top < actor.y + 8 && tag.bottom > actor.y - actorArt.artMetrics.bodyHeight - 4;
    assert.equal(overlap, false, `${tag.id} label cannot cover ${actor.id} sprite`);
  }
}

test('Crowded player/resident labels separate full names and every quest marker without changing actors or their interaction positions', async () => {
  const e = loadGame(); await e.start(); const state = e.qa.getState(); state.x = 800; state.y = 810;
  state.upgrades = unlocked(e); state.visited = e.qa.data.regions.map(r => r.id); state.shrines = ['forest', 'coast', 'ruins'];
  const ids = ['mira', 'linh', 'thao'];
  for (const q of e.qa.data.quests) state.quests[q.id] = { status: 'claimed', progress: q.objectives.map(o => o.count) };
  state.quests.side01 = { status: 'active', progress: [1, 1, 1] }; state.quests.side03 = { status: 'active', progress: [0] }; state.inventory.herb = 0; delete state.quests.side13; e.qa.setState(state);
  ids.forEach((id, index) => { const n = npc(e, id); n.x = 800 + (index - 1) * 10; n.y = 810; n.moving = false; });
  assert.equal(e.qa.npcMarker(npc(e, 'mira')), '✓'); assert.equal(e.qa.npcMarker(npc(e, 'linh')), '!'); assert.equal(e.qa.npcMarker(npc(e, 'thao')), '?'); const positions = residentPositions(e);
  const tags = e.qa.getActorLabels(), cluster = tags.filter(t => ['player', ...ids].includes(t.id)); assert.equal(cluster.length, 4); assertSeparatedTags(tags); assert.ok(cluster.filter(t => t.id !== 'player').some(t => t.y < t.baseY || t.x !== t.anchorX), 'At least one crowded tag shifts from the actor anchor');
  const player = cluster.find(t => t.id === 'player'); assert.equal(tags[0].id, 'player'); assert.equal(player.x, player.anchorX, 'Player tag gets its first placement');
  assertTagsAvoidBodies(tags, [{ id: 'player', ...e.qa.getState() }, ...e.qa.getNPCs().filter(n => n.map === 'village')]);
  for (const t of cluster) { assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y)); assert.ok(t.y <= t.baseY && t.baseY - t.y <= 23 * 16); assert.ok(Math.abs(t.x - t.anchorX) <= 192); if (t.id !== 'player') { assert.equal(t.marker, e.qa.npcMarker(npc(e, t.id))); assert.equal(t.anchorX, npc(e, t.id).x); assert.equal(t.baseY, npc(e, t.id).y - actorArt.artMetrics.nameOffset); assert.ok(t.bottom - t.top >= 37, 'Bounds include the marker above the name'); } }
  e.calls.length = 0; e.qa.drawGame(); assert.equal(residentPositions(e), positions, 'Label placement never moves residents to fix text'); assert.ok(e.calls.some(c => c.context === 'gameCanvas' && c.name === 'stroke' && c.strokeStyle === '#f5edc488'), 'Displaced tags keep a leader line to their actors');
  for (const t of cluster) { const painted = e.calls.find(c => c.context === 'gameCanvas' && c.name === 'fillText' && c.args[0] === t.name); assert.ok(painted); assert.equal(painted.args[1], Math.floor(t.x) + 1); assert.equal(painted.args[2], Math.floor(t.y) + 1); }
  e.qa.update(0); assert.match(e.el('interaction-hint').textContent, /Linh|Mira|Thảo/, 'Selection still uses actual nearby actor positions');
});

test('Label placement remains bounded in a full crowd on mobile and desktop and follows only actors in the current region', async () => {
  const e = loadGame(); await e.start(); e.set({ x: 800, y: 810 }); for (const n of e.qa.getNPCs().filter(n => n.map === 'village')) { n.x = 800; n.y = 810; n.moving = false; }
  const socket = e.sockets[0]; socket.readyState = 1; socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self' }) }); socket.onmessage({ data: JSON.stringify({ type: 'snapshot', players: [{ id: 'peer-crowd', name: 'Người bạn', map: 'village', x: 800, y: 810, color: '#669988' }, { id: 'peer-away', name: 'Ở rừng', map: 'forest', x: 800, y: 810, color: '#669988' }] }) });
  for (const [width, height] of [[1280, 900], [390, 844]]) { e.resize(width, height); const tags = e.qa.getActorLabels(); assertSeparatedTags(tags); assertTagsAvoidBodies(tags, [{ id: 'player', ...e.qa.getState() }, { id: 'peer-crowd', x: 800, y: 810 }, ...e.qa.getNPCs().filter(n => n.map === 'village')]); assert.equal(tags.length, 10); assert.equal(tags.some(t => t.id === 'sen' || t.id === 'peer-away'), false); assert.ok(tags.some(t => t.id === 'peer-crowd')); for (const t of tags) { assert.ok(t.baseY - t.y <= 23 * 16); assert.ok(Math.abs(t.x - t.anchorX) <= 192); } }
  const mira = npc(e, 'mira'); mira.x = 1250; mira.y = 450; const moved = e.qa.getActorLabels().find(t => t.id === 'mira'); assert.equal(moved.anchorX, 1250); assert.equal(moved.baseY, 450 - actorArt.artMetrics.nameOffset); assert.equal(moved.x, 1250); assert.equal(moved.y, moved.baseY, 'An isolated resident returns to their normal label anchor');
  e.set({ map: 'forest', x: 1500, y: 100 }); const forest = e.qa.getActorLabels(); assert.equal(forest.some(t => t.id === 'mira' || t.id === 'peer-crowd'), false); assert.ok(forest.some(t => t.id === 'sen')); assert.ok(forest.some(t => t.id === 'peer-away')); assertSeparatedTags(forest);
});

test('Uncrowded labels stay at their ordinary actor anchors and the label function is deterministic', async () => {
  const e = loadGame(); await e.start(); e.set({ x: 1500, y: 100 }); const labels = e.qa.getActorLabels(), mira = labels.find(t => t.id === 'mira'); assert.equal(mira.anchorX, npc(e, 'mira').x); assert.equal(mira.x, mira.anchorX); assert.equal(mira.y, mira.baseY); assert.equal(mira.baseY, npc(e, 'mira').y - actorArt.artMetrics.nameOffset); assert.equal(JSON.stringify(e.qa.getActorLabels()), JSON.stringify(labels)); assertSeparatedTags(labels); assert.equal(locomotion(e).distance, 0, 'Placement queries do not advance actor animation');
});

test('Name and quest bounds use the chibi renderer footprint across all four regions', async () => {
  assert.ok(actorArt.artMetrics.bodyWidth >= 44, 'The larger head and hats need their full width');
  assert.ok(actorArt.artMetrics.nameOffset > actorArt.artMetrics.bodyHeight + 3, 'Names clear the tallest hair and hats');
  const e = loadGame(); await e.start(); e.set({ upgrades: unlocked(e) });
  for (const map of e.qa.data.regions.map(r => r.id)) {
    e.set({ map, x: 1500, y: 100 });
    const labels = e.qa.getActorLabels(), residents = e.qa.getNPCs().filter(n => n.map === map);
    for (const resident of residents) {
      const tag = labels.find(t => t.id === resident.id); assert.ok(tag);
      assert.equal(tag.baseY, resident.y - actorArt.artMetrics.nameOffset);
      assert.ok(tag.bottom < resident.y - actorArt.artMetrics.bodyHeight, 'A name cannot cover its own larger sprite');
    }
    assertTagsAvoidBodies(labels, [{ id: 'player', ...e.qa.getState() }, ...residents]);
    assertSeparatedTags(labels);
  }
});

test('Other online travellers never inherit the local lantern or damage blink', async () => {
  const e = loadGame(); await e.start(); const state = e.qa.getState(); state.map = 'forest'; state.x = 420; state.y = 700; state.inventory.lantern = 1; e.qa.setState(state); const socket = e.sockets[0]; socket.readyState = 1; socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'welcome', id: 'self' }) }); socket.onmessage({ data: JSON.stringify({ type: 'snapshot', players: [{ id: 'peer-visible', name: 'Bạn đi rừng', map: 'forest', x: 900, y: 550, color: '#bb8899', direction: 'left', moving: false }] }) });
  const renders = [], draw = e.actors.draw; e.actors.draw = (ctx, options) => { renders.push({ ...options }); return draw(ctx, options); }; e.step(.02); assert.equal(e.qa.getState().health, 92); e.qa.drawGame(); const player = renders.find(r => r.id === 'player'), peer = renders.find(r => r.id === 'peer-visible'); assert.ok(player && peer); assert.equal(player.hidden, true, 'The local hit frame blinks'); assert.equal(player.lantern, true); assert.equal(peer.hidden, false, 'Damage blink applies only to the struck local actor'); assert.equal(peer.lantern, false, 'A local held lantern cannot appear in another traveller hands'); assert.equal(peer.direction, 'left');
});
