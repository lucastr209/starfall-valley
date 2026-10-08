'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/js/game-core.js');
const D = require('../public/js/game-data.js');
const fresh = () => C.createState('Người thử nghiệm', D);
const snapshot = s => JSON.stringify(s);

function supply(s, item, count) {
  const missing = Math.max(0, count - s.inventory[item]);
  assert.equal(C.addItem(s, item, missing, D), missing, `Supply ${item}`);
}

function buildWithMaterials(s, id) {
  if (s.upgrades.includes(id)) return;
  const u = D.upgrades.find(u => u.id === id);
  u.prerequisites.forEach(id => buildWithMaterials(s, id));
  Object.entries(u.materials).forEach(([item, count]) => supply(s, item, count));
  assert.ok(s.coins >= u.cost, `Enough earned coins for ${id}: ${s.coins}/${u.cost}`);
  assert.equal(C.build(s, id, D).ok, true, `Build ${id}`);
}

function performObjectives(s, q) {
  q.objectives.forEach((o, i) => {
    const left = o.count - C.progress(s, q)[i];
    if (left <= 0) return;
    switch (o.type) {
      case 'deliver': supply(s, o.target, o.count); break;
      case 'build': buildWithMaterials(s, o.target); break;
      case 'visit': assert.equal(C.visit(s, o.target, D), true); break;
      case 'shrine':
        s.shrines.push(o.target); C.event(s, o.type, o.target, 1, D); break;
      case 'chest':
        for (let j = 0; j < left; j++) s.chests.push(`test-chest-${s.chests.length}`);
        C.event(s, o.type, o.target, left, D); break;
      case 'craft': {
        const r = D.recipes.find(r => r.id === o.target);
        if (r.requires) buildWithMaterials(s, r.requires);
        for (let j = 0; j < left; j++) {
          Object.entries(r.input).forEach(([item, count]) => supply(s, item, count));
          assert.equal(C.craft(s, r.id, D).ok, true, `Craft ${r.id}`);
        }
        break;
      }
      case 'gather': {
        if (s.inventory[o.target] + left > C.capacity(s)) assert.equal(C.sell(s, o.target, left, D).ok, true);
        assert.equal(C.addItem(s, o.target, left, D), left);
        C.event(s, o.type, o.target, left, D); break;
      }
      case 'night': s.minutes = 1140; C.event(s, o.type, o.target, left, D); break;
      case 'rain': s.day = 2; C.event(s, o.type, o.target, left, D); break;
      default: C.event(s, o.type, o.target, left, D);
    }
  });
  assert.equal(C.complete(s, q), true, `Complete ${q.id}`);
}

function claimAndCheck(s, q) {
  const before = { coins: s.coins, xp: s.xp, renown: s.renown, inventory: { ...s.inventory } };
  assert.equal(C.claim(s, q.id, D, q.giver).ok, true, `Claim ${q.id}`);
  assert.equal(s.coins, before.coins + q.reward.coins);
  assert.equal(s.xp, before.xp + q.reward.xp);
  assert.equal(s.renown, before.renown + q.reward.renown);
  for (const id of Object.keys(D.items)) {
    const delivered = q.objectives.filter(o => o.type === 'deliver' && o.target === id).reduce((n, o) => n + o.count, 0);
    assert.equal(s.inventory[id], before.inventory[id] - delivered + (q.reward.items?.[id] || 0), `${q.id} reward/delivery ${id}`);
  }
  assert.equal(s.quests[q.id].status, 'claimed');
  const claimed = snapshot(s);
  assert.equal(C.claim(s, q.id, D, q.giver).ok, false);
  assert.equal(snapshot(s), claimed, `${q.id} cannot reward twice`);
}

test('Catalogue: all 60 quests, 12 upgrades and 4 recipes have valid references and no dependency cycles', () => {
  assert.equal(D.quests.length, 60);
  assert.equal(D.quests.filter(q => q.kind === 'story').length, 24);
  assert.equal(D.quests.filter(q => q.kind === 'side').length, 24);
  assert.equal(D.quests.filter(q => q.kind === 'daily').length, 12);
  assert.equal(D.upgrades.length, 12); assert.equal(D.recipes.length, 4);
  const tables = [D.quests, D.upgrades, D.recipes, D.npcs, D.regions];
  tables.forEach(entries => assert.equal(new Set(entries.map(x => x.id)).size, entries.length));
  const idSet = list => new Set(list.map(x => x.id));
  const quests = idSet(D.quests), upgrades = idSet(D.upgrades), npcs = idSet(D.npcs), regions = idSet(D.regions), recipes = idSet(D.recipes), items = new Set(Object.keys(D.items));
  const targets = { talk: npcs, gather: items, deliver: items, craft: recipes, visit: regions, build: upgrades, fish: new Set(['fish']), fight: new Set(['slime']), plant: new Set(['berry']), harvest: new Set(['berry']), shrine: new Set(['forest', 'coast', 'ruins']), chest: new Set(['treasure']), night: new Set(['village']), rain: new Set(['herb']) };
  D.quests.forEach(q => {
    assert.ok(['story', 'side', 'daily'].includes(q.kind));
    q.requires.forEach(id => assert.ok(quests.has(id)));
    if (q.upgrade) assert.ok(upgrades.has(q.upgrade));
    if (q.giver) assert.ok(npcs.has(q.giver));
    q.objectives.forEach(o => { assert.ok(targets[o.type]?.has(o.target)); assert.ok(Number.isInteger(o.count) && o.count > 0); if (o.type === 'deliver') assert.ok(q.giver); });
    ['coins', 'xp', 'renown'].forEach(key => assert.ok(Number.isInteger(q.reward[key]) && q.reward[key] >= 0));
    Object.entries(q.reward.items || {}).forEach(([id, n]) => { assert.ok(items.has(id)); assert.ok(Number.isInteger(n) && n > 0); });
  });
  D.upgrades.forEach(u => { u.prerequisites.forEach(id => assert.ok(upgrades.has(id))); Object.keys(u.materials).forEach(id => assert.ok(items.has(id))); });
  D.recipes.forEach(r => { if (r.requires) assert.ok(upgrades.has(r.requires)); [...Object.keys(r.input), ...Object.keys(r.output)].forEach(id => assert.ok(items.has(id))); });
  for (const [entries, field] of [[D.quests, 'requires'], [D.upgrades, 'prerequisites']]) {
    const map = new Map(entries.map(x => [x.id, x])), complete = new Set(), active = new Set();
    function visit(id) { assert.ok(!active.has(id), `No cycle at ${id}`); if (complete.has(id)) return; active.add(id); map.get(id)[field].forEach(visit); active.delete(id); complete.add(id); }
    entries.forEach(x => visit(x.id));
  }
});

test('All 60 quests can be accepted, completed and rewarded through supported gameplay events', async t => {
  const s = fresh();
  assert.equal(C.accept(s, 'story24', D), false);
  assert.equal(C.accept(s, 'story01', D), true);
  for (const q of D.quests.filter(q => q.kind === 'story')) {
    await t.test(q.id, () => {
      assert.equal(s.quests[q.id]?.status, 'active', 'Story automatically advances');
      performObjectives(s, q); claimAndCheck(s, q);
    });
  }
  assert.ok(s.upgrades.includes('beacon'));
  assert.ok(s.coins >= 0, 'Story rewards cover every required construction cost');
  for (const q of D.quests.filter(q => q.kind === 'side')) {
    await t.test(q.id, () => { assert.equal(C.accept(s, q.id, D), true); performObjectives(s, q); claimAndCheck(s, q); });
  }
  const seen = new Set();
  // Fixed day seeds cover the complete daily rotation; claim resets on each dawn.
  for (let day = 1; day <= 3; day++) {
    if (day > 1) C.nextDay(s, D); else { C.nextDay(s, D); s.day = 1; }
    for (const q of C.dailyQuests(s, D)) {
      await t.test(`${q.id}-day${day}`, () => {
        assert.equal(C.accept(s, q.id, D), true); performObjectives(s, q); claimAndCheck(s, q); seen.add(q.id);
      });
    }
  }
  assert.equal(seen.size, 12);
});

test('Every upgrade charges exact costs, respects prerequisites and refuses duplicate purchases atomically', async t => {
  for (const u of D.upgrades) await t.test(u.id, () => {
    const s = fresh(); s.coins = 10000;
    if (u.prerequisites.length) { const before = snapshot(s); assert.equal(C.build(s, u.id, D).ok, false); assert.equal(snapshot(s), before); }
    u.prerequisites.forEach(id => buildWithMaterials(s, id));
    Object.entries(u.materials).forEach(([item, n]) => supply(s, item, n));
    s.coins = u.cost - 1;
    let before = snapshot(s); assert.equal(C.build(s, u.id, D).ok, false); assert.equal(snapshot(s), before);
    s.coins = u.cost;
    const [missingItem, amount] = Object.entries(u.materials)[0]; s.inventory[missingItem] = amount - 1;
    before = snapshot(s); assert.equal(C.build(s, u.id, D).ok, false); assert.equal(snapshot(s), before);
    s.inventory[missingItem] = amount;
    const inventory = { ...s.inventory }, xp = s.xp;
    assert.equal(C.build(s, u.id, D).ok, true); assert.equal(s.coins, 0); assert.equal(s.xp, xp + 25);
    Object.entries(u.materials).forEach(([item, n]) => assert.equal(s.inventory[item], inventory[item] - n));
    before = snapshot(s); assert.equal(C.build(s, u.id, D).ok, false); assert.equal(snapshot(s), before);
  });
});

test('Every recipe checks unlocks, consumes exact inputs and produces exact outputs atomically', async t => {
  for (const r of D.recipes) await t.test(r.id, () => {
    const s = fresh(); s.coins = 10000;
    Object.entries(r.input).forEach(([item, n]) => supply(s, item, n));
    if (r.requires) { const before = snapshot(s); assert.equal(C.craft(s, r.id, D).ok, false); assert.equal(snapshot(s), before); buildWithMaterials(s, r.requires); }
    Object.entries(r.input).forEach(([item, n]) => supply(s, item, n));
    const [missing, amount] = Object.entries(r.input)[0]; s.inventory[missing] = amount - 1;
    let before = snapshot(s); assert.equal(C.craft(s, r.id, D).ok, false); assert.equal(snapshot(s), before);
    s.inventory[missing] = amount;
    const [output] = Object.keys(r.output); s.inventory[output] = C.capacity(s);
    before = snapshot(s); assert.equal(C.craft(s, r.id, D).ok, false); assert.equal(snapshot(s), before);
    s.inventory[output] = 0;
    const inventory = { ...s.inventory }, xp = s.xp;
    assert.equal(C.craft(s, r.id, D).ok, true); assert.equal(s.xp, xp + 6);
    for (const id of Object.keys(D.items)) assert.equal(s.inventory[id], inventory[id] - (r.input[id] || 0) + (r.output[id] || 0));
    assert.equal(s.stats[`craft:${r.id}`], 1);
  });
});

test('Deliveries require the correct NPC, deduct only once, and never consume items on failed claims', () => {
  const s = fresh(); s.quests.story01 = { status: 'claimed', progress: [1] }; s.quests.story02 = { status: 'claimed', progress: [6, 3] };
  assert.equal(C.accept(s, 'story03', D), true); supply(s, 'wood', 4);
  const before = snapshot(s); assert.equal(C.claim(s, 'story03', D, 'mira').ok, false); assert.equal(snapshot(s), before);
  s.inventory.wood = 3; const short = snapshot(s); assert.equal(C.claim(s, 'story03', D, 'huy').ok, false); assert.equal(snapshot(s), short);
  supply(s, 'wood', 4); assert.equal(C.claim(s, 'story03', D, 'huy').ok, true); assert.equal(s.inventory.wood, 0);
  const claimed = snapshot(s); assert.equal(C.claim(s, 'story03', D, 'huy').ok, false); assert.equal(snapshot(s), claimed);
});

test('Duplicate delivery targets cannot count the same item twice', () => {
  const q = { id: 'delivery-test', title: 'Test', kind: 'side', description: '', giver: 'huy', requires: [], upgrade: null, objectives: [{ type: 'deliver', target: 'wood', count: 3 }, { type: 'deliver', target: 'wood', count: 3 }], reward: { coins: 1, xp: 1, renown: 1 } };
  const data = { ...D, quests: [q] }, s = C.createState('Test', data);
  C.accept(s, q.id, data); C.addItem(s, 'wood', 4, data);
  assert.deepEqual(C.progress(s, q), [3, 1]); assert.equal(C.complete(s, q), false);
  C.addItem(s, 'wood', 2, data); assert.equal(C.claim(s, q.id, data, 'huy').ok, true); assert.equal(s.inventory.wood, 0);
});

test('Reward inventory capacity is checked before any delivery or reward mutation', () => {
  const s = fresh(); C.accept(s, 'story01', D); C.event(s, 'talk', 'mira', 1, D); C.addItem(s, 'berry', 100, D);
  const before = snapshot(s); assert.equal(C.claim(s, 'story01', D, 'mira').ok, false); assert.equal(snapshot(s), before);
  C.sell(s, 'berry', 2, D); assert.equal(C.claim(s, 'story01', D, 'mira').ok, true); assert.equal(s.inventory.berry, 100);
});

test('Permanent world objectives count actions done before accepting a quest', () => {
  const q = { id: 'history-test', title: 'Test', kind: 'side', giver: null, requires: [], upgrade: null, objectives: [{ type: 'build', target: 'well', count: 1 }, { type: 'visit', target: 'forest', count: 1 }, { type: 'shrine', target: 'forest', count: 1 }, { type: 'chest', target: 'treasure', count: 3 }], reward: { coins: 1, xp: 1, renown: 1 } };
  const data = { ...D, quests: [q] }, s = C.createState('Test', data); s.upgrades.push('well'); s.visited.push('forest'); s.shrines.push('forest'); s.chests.push('forest-1', 'forest-2', 'coast-1');
  C.accept(s, q.id, data); assert.deepEqual(C.progress(s, q), [1, 1, 1, 3]); assert.equal(C.complete(s, q), true);
});

test('Daily board offers eligible quests, retains accepted entries during unlocks, and rotates on dawn', () => {
  const s = fresh(); assert.deepEqual(C.dailyQuests(s, D), []);
  s.quests.story01 = { status: 'claimed', progress: [1] };
  const early = C.dailyQuests(s, D); assert.equal(early.length, 4); early.forEach(q => assert.ok(C.available(s, q, D)));
  assert.equal(C.accept(s, 'daily09', D), false);
  const keep = early[0]; C.accept(s, keep.id, D);
  D.quests.filter(q => q.kind === 'story').forEach(q => { s.quests[q.id] = { status: 'claimed', progress: q.objectives.map(o => o.count) }; });
  s.upgrades = D.upgrades.map(u => u.id);
  assert.ok(C.dailyQuests(s, D).some(q => q.id === keep.id));
  const dayOne = C.dailyQuests(s, D).map(q => q.id); assert.equal(dayOne.length, 6); assert.equal(new Set(dayOne).size, 6);
  s.quests[keep.id].status = 'claimed'; s.tracked = keep.id; C.nextDay(s, D);
  assert.equal(s.quests[keep.id], undefined); assert.equal(s.tracked, null); assert.equal(s.minutes, 480); assert.equal(s.health, 100); assert.equal(s.stamina, 100);
  const dayTwo = C.dailyQuests(s, D).map(q => q.id); assert.notDeepEqual(dayTwo, dayOne);
});

test('Inventory, sale price upgrades and invalid amounts remain bounded', () => {
  const s = fresh(); assert.equal(C.capacity(s), 100);
  for (const amount of [-1, NaN, Infinity, '2']) assert.equal(C.addItem(s, 'wood', amount, D), 0);
  assert.equal(C.addItem(s, 'wood', 500, D), 100); assert.equal(C.addItem(s, 'wood', 1, D), 0);
  assert.equal(C.addItem(s, '__proto__', 1, D), 0); assert.equal(C.addItem(s, 'missing', 1, D), 0);
  const before = s.coins; C.sell(s, 'wood', 2, D); assert.equal(s.coins, before + 16); assert.equal(s.inventory.wood, 98);
  s.upgrades.push('market'); const market = s.coins; C.sell(s, 'wood', 2, D); assert.equal(s.coins, market + 24);
  const stable = snapshot(s); assert.equal(C.sell(s, '__proto__', 1, D).ok, false); assert.equal(C.sell(s, 'wood', -1, D).ok, false); assert.equal(snapshot(s), stable);
  s.upgrades.push('bag'); assert.equal(C.capacity(s), 250); assert.equal(C.addItem(s, 'wood', 300, D), 154); assert.equal(s.inventory.wood, 250);
});

test('Events reject invalid inputs and cap objective progress without retroactive repeat events', () => {
  const s = fresh(); C.accept(s, 'story01', D);
  for (const n of [-2, NaN, Infinity, 0]) assert.equal(C.event(s, 'talk', 'mira', n, D), false);
  assert.equal(C.event(s, '__proto__', 'mira', 1, D), false); assert.equal(C.event(s, 'talk', 'missing', 1, D), false);
  assert.equal(C.event(s, 'talk', 'mira', 200, D), true); assert.deepEqual(C.progress(s, D.quests[0]), [1]);
  const s2 = fresh(); C.event(s2, 'talk', 'mira', 1, D); C.accept(s2, 'story01', D); assert.deepEqual(C.progress(s2, D.quests[0]), [0]);
});

test('Travel unlocks, weather and night boundaries behave correctly', () => {
  const s = fresh(); assert.equal(C.visit(s, 'coast', D), false); assert.equal(C.visit(s, 'ruins', D), false); assert.equal(C.visit(s, 'missing', D), false);
  assert.equal(C.visit(s, 'forest', D), true); assert.equal(C.visit(s, 'forest', D), true); assert.equal(s.visited.filter(x => x === 'forest').length, 1);
  s.upgrades.push('bridge'); assert.equal(C.visit(s, 'coast', D), true); s.upgrades.push('archive'); assert.equal(C.visit(s, 'ruins', D), true);
  for (const [minutes, night] of [[0, true], [359, true], [360, false], [1139, false], [1140, true], [1439, true]]) { s.minutes = minutes; assert.equal(C.isNight(s), night); }
  for (const [day, weather] of [[1, 'clear'], [2, 'rain'], [3, 'clear'], [4, 'clear'], [5, 'rain']]) { s.day = day; assert.equal(C.weather(s), weather); }
  for (const [xp, level] of [[0, 1], [159, 1], [160, 2], [320, 3]]) { s.xp = xp; assert.equal(C.level(s), level); }
});

test('Valid saves round-trip inventory, progression, world history, crops and active objectives', () => {
  const s = fresh(); s.coins = 300; C.accept(s, 'story01', D); C.event(s, 'talk', 'mira', 1, D); C.claim(s, 'story01', D, 'mira'); C.event(s, 'gather', 'wood', 3, D); C.addItem(s, 'wood', 12, D);
  s.upgrades.push('well'); s.visited.push('forest'); s.shrines.push('forest'); s.chests.push('forest-1'); s.resources['forest-wood-1'] = 12345; s.crops = [0, 1500, null, 123456]; s.map = 'forest'; s.x = 400; s.y = 550; s.health = 0;
  const loaded = C.restoreState(JSON.parse(snapshot(s)), D);
  assert.deepEqual(loaded, s);
});

test('Malformed saves discard unknown IDs, impossible dependencies, poisoned keys and invalid numbers', () => {
  const raw = JSON.parse('{"version":1,"name":"<X>\\u0000","coins":-40,"xp":null,"renown":1e99,"health":-1,"stamina":200,"day":-9,"minutes":2000,"map":"ruins","x":-500,"y":1e99,"inventory":{"wood":-6,"ore":1e99,"star":"8","__proto__":9},"upgrades":["beacon","archive","missing","well","well"],"visited":["village","coast","ruins","missing"],"quests":{"story24":{"status":"claimed","progress":[100]},"story01":{"status":"active","progress":[-1]},"missing":{"status":"claimed"}},"resources":{"__proto__":2,"constructor":3,"forest-1":-1,"forest-2":123},"crops":[-1,"50",null,9],"shrines":["coast","ruins","forest","missing","forest"],"chests":["__proto__","constructor","forest-1","forest-1",{},"bad id"],"stats":{"__proto__":12,"talk:mira":-4,"gather:wood":1e99},"tracked":"story24"}');
  const s = C.restoreState(raw, D);
  assert.equal(s.name, 'X'); assert.equal(s.coins, 0); assert.equal(s.xp, 0); assert.equal(s.renown, 1000000); assert.equal(s.health, 0); assert.equal(s.stamina, 100); assert.equal(s.day, 1); assert.equal(s.minutes, 1439);
  assert.equal(s.map, 'village'); assert.equal(s.x, 800); assert.equal(s.y, 550); assert.deepEqual(s.upgrades, ['well']); assert.deepEqual(s.visited, ['village']);
  assert.equal(s.inventory.wood, 0); assert.equal(s.inventory.ore, 100); assert.equal(s.inventory.star, 0); assert.ok(!Object.hasOwn(s.inventory, '__proto__'));
  assert.equal(s.quests.story24, undefined); assert.deepEqual(s.quests.story01, { status: 'active', progress: [0] }); assert.equal(s.tracked, null);
  assert.deepEqual(s.resources, { 'forest-2': 123 }); assert.deepEqual(s.crops, [null, null, null, 9]); assert.deepEqual(s.shrines, ['forest']); assert.deepEqual(s.chests, ['forest-1']);
  assert.equal(s.stats['talk:mira'], 0); assert.equal(s.stats['gather:wood'], 1000000); assert.ok(!Object.hasOwn(s.stats, '__proto__')); assert.equal({}.polluted, undefined);
  for (const raw of [null, undefined, 'bad', [], { version: 99 }]) assert.deepEqual(C.restoreState(raw, D), freshWithDefaultName());
  function freshWithDefaultName() { return C.createState('', D); }
});

test('Restore permits unordered valid upgrade and quest histories, and tracks only active known quests', () => {
  const s = fresh(); s.upgrades = ['archive', 'bridge', 'observatory', 'workshop']; s.visited = ['village', 'coast', 'ruins']; s.map = 'ruins';
  s.quests = { story03: { status: 'claimed', progress: [0] }, story02: { status: 'claimed', progress: [6, 3] }, story01: { status: 'claimed', progress: [1] }, story04: { status: 'active', progress: [0] } }; s.tracked = 'story04';
  const restored = C.restoreState(s, D); assert.equal(restored.map, 'ruins'); assert.deepEqual(new Set(restored.upgrades), new Set(s.upgrades)); assert.equal(restored.quests.story03.status, 'claimed'); assert.equal(restored.tracked, 'story04');
  s.tracked = 'story03'; assert.equal(C.restoreState(s, D).tracked, null);
  s.inventory.wood = 200; s.upgrades.push('bag'); assert.equal(C.restoreState(s, D).inventory.wood, 200);
});
