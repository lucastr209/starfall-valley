'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../public/js/game-data.js');
const core = require('../public/js/game-core.js');

test('Adversarial M2-1: Milestone rewards unlock at 2, 4, 5 hearts and never duplicate on FP fluctuations', () => {
  for (const npc of data.npcs) {
    const s = core.createState('Hero', data);
    s.inventory.wood = 0;
    s.inventory.berry = 0;
    s.inventory.meal = 0;
    s.inventory.plank = 0;
    s.inventory.tea = 0;
    s.inventory.star = 0;
    s.coins = 0;
    s.renown = 0;
    s.xp = 0;

    const f = s.friendship[npc.id];
    assert.ok(f, `NPC ${npc.id} exists in state.friendship`);
    assert.equal(f.points, 0);
    assert.deepEqual(f.unlockedRewards, []);

    // 1. Advance to 199 FP: no milestone unlocked
    f.points = 199;
    let res = core.checkMilestones(s, npc.id, data);
    assert.equal(res.length, 0, '199 FP should not unlock 2 hearts');
    assert.deepEqual(f.unlockedRewards, []);

    // Record baseline stats
    const coinsBefore2 = s.coins;
    const renownBefore2 = s.renown;
    const xpBefore2 = s.xp;

    // 2. Cross 2 hearts boundary (200 FP)
    f.points = 200;
    res = core.checkMilestones(s, npc.id, data);
    assert.equal(res.length, 1, 'Crossing 200 FP must unlock milestone 2');
    assert.equal(res[0].milestone, 2);
    assert.deepEqual(f.unlockedRewards, [2]);

    const coinsAfter2 = s.coins;
    const r2 = npc.milestoneRewards[2];
    if (r2.coins) assert.equal(coinsAfter2, coinsBefore2 + r2.coins);
    if (r2.renown) assert.equal(s.renown, renownBefore2 + r2.renown);
    if (r2.xp) assert.equal(s.xp, xpBefore2 + r2.xp);

    // 3. Drop below 2 hearts (e.g. 185 FP via disliked gift)
    f.points = 185;
    res = core.checkMilestones(s, npc.id, data);
    assert.equal(res.length, 0, 'Dropping below 2 hearts should unlock nothing');
    assert.deepEqual(f.unlockedRewards, [2], 'unlockedRewards must retain [2]');

    // 4. Climb back to 2 hearts (200 FP) - MUST NOT DUPLICATE
    f.points = 200;
    res = core.checkMilestones(s, npc.id, data);
    assert.equal(res.length, 0, 'Climbing back to 200 FP must NOT grant reward again');
    assert.deepEqual(f.unlockedRewards, [2]);
    assert.equal(s.coins, coinsAfter2, 'Coins must not increase on second visit to 2 hearts');

    // 5. Fluctuate around 2 hearts repeatedly
    for (let i = 0; i < 20; i++) {
      f.points = (i % 2 === 0) ? 170 : 220;
      const subRes = core.checkMilestones(s, npc.id, data);
      assert.equal(subRes.length, 0);
      assert.deepEqual(f.unlockedRewards, [2]);
    }
    assert.equal(s.coins, coinsAfter2);

    // 6. Cross 4 hearts boundary (400 FP)
    const coinsBefore4 = s.coins;
    f.points = 400;
    res = core.checkMilestones(s, npc.id, data);
    assert.equal(res.length, 1, 'Crossing 400 FP must unlock milestone 4');
    assert.equal(res[0].milestone, 4);
    assert.deepEqual(f.unlockedRewards, [2, 4]);

    const coinsAfter4 = s.coins;
    const r4 = npc.milestoneRewards[4];
    if (r4.coins) assert.equal(coinsAfter4, coinsBefore4 + r4.coins);

    // 7. Drop below 4 hearts (385 FP) and climb back (400 FP)
    f.points = 385;
    assert.equal(core.checkMilestones(s, npc.id, data).length, 0);
    f.points = 400;
    assert.equal(core.checkMilestones(s, npc.id, data).length, 0);
    assert.deepEqual(f.unlockedRewards, [2, 4]);
    assert.equal(s.coins, coinsAfter4);

    // 8. Cross 5 hearts boundary (500 FP)
    const renownBefore5 = s.renown;
    f.points = 500;
    res = core.checkMilestones(s, npc.id, data);
    assert.equal(res.length, 1, 'Crossing 500 FP must unlock milestone 5');
    assert.equal(res[0].milestone, 5);
    assert.deepEqual(f.unlockedRewards, [2, 4, 5]);

    const r5 = npc.milestoneRewards[5];
    if (r5.renown) assert.equal(s.renown, renownBefore5 + r5.renown);

    // 9. Drop below 5 hearts and climb back
    f.points = 485;
    assert.equal(core.checkMilestones(s, npc.id, data).length, 0);
    f.points = 500;
    assert.equal(core.checkMilestones(s, npc.id, data).length, 0);
    assert.deepEqual(f.unlockedRewards, [2, 4, 5]);

    // 10. Call checkMilestones 100 times consecutively (idempotency)
    for (let i = 0; i < 100; i++) {
      assert.equal(core.checkMilestones(s, npc.id, data).length, 0);
    }
    assert.deepEqual(f.unlockedRewards, [2, 4, 5]);
  }
});

test('Adversarial M2-2: Multi-milestone single-step jump unlocks all passed milestones simultaneously', () => {
  for (const npc of data.npcs) {
    const s = core.createState('Hero', data);
    s.inventory.wood = 0;
    s.inventory.berry = 0;
    s.inventory.meal = 0;
    s.inventory.plank = 0;
    s.inventory.tea = 0;
    s.inventory.star = 0;
    s.coins = 0;
    s.renown = 0;
    s.xp = 0;

    // Jump from 0 directly to 500 in one step
    s.friendship[npc.id].points = 500;
    const unlocked = core.checkMilestones(s, npc.id, data);
    assert.equal(unlocked.length, 3, 'Must unlock 2, 4, and 5 together');
    assert.deepEqual(unlocked.map(u => u.milestone), [2, 4, 5]);
    assert.deepEqual(s.friendship[npc.id].unlockedRewards, [2, 4, 5]);

    // Calculate expected total coins and renown
    let expectedCoins = 0;
    let expectedRenown = 0;
    let expectedXp = 0;
    for (const m of [2, 4, 5]) {
      const r = npc.milestoneRewards[m];
      if (r.coins) expectedCoins += r.coins;
      if (r.renown) expectedRenown += r.renown;
      if (r.xp) expectedXp += r.xp;
    }
    assert.equal(s.coins, expectedCoins);
    assert.equal(s.renown, expectedRenown);
    assert.equal(s.xp, expectedXp);

    // Calling again returns nothing
    assert.deepEqual(core.checkMilestones(s, npc.id, data), []);
  }
});

test('Adversarial M2-3: Gifting flow triggers milestone rewards correctly through giveGift()', () => {
  const s = core.createState('Hero', data);
  // Prepare inventory with 10 stars (loved gift for Mira)
  s.inventory.star = 10;
  s.coins = 0;
  s.friendship.mira.points = 160;

  // Gift 1 loved item (+80 FP) -> 240 FP (crosses 2 hearts!)
  const res1 = core.giveGift(s, 'mira', 'star', data);
  assert.equal(res1.ok, true);
  assert.equal(res1.points, 240);
  assert.equal(res1.hearts, 2);
  assert.equal(res1.rewards.length, 1);
  assert.equal(res1.rewards[0].milestone, 2);
  assert.deepEqual(s.friendship.mira.unlockedRewards, [2]);
  assert.equal(s.coins, 50, 'Mira 2 hearts reward gives 50 coins');

  // Attempt second gift in same day -> blocked
  const resBlocked = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resBlocked.ok, false);
  assert.equal(s.friendship.mira.points, 240);
  assert.equal(s.inventory.star, 9);

  // Next day -> give disliked gift (ore: -15 FP) -> 225 FP (still 2 hearts)
  core.nextDay(s, data);
  s.inventory.ore = 5;
  const resDislike = core.giveGift(s, 'mira', 'ore', data);
  assert.equal(resDislike.ok, true);
  assert.equal(resDislike.tier, 'disliked');
  assert.equal(resDislike.pointsDelta, -15);
  assert.equal(resDislike.points, 225);
  assert.equal(resDislike.rewards.length, 0);
  assert.deepEqual(s.friendship.mira.unlockedRewards, [2]);

  // Next day -> give disliked gifts until dropping below 200 FP
  core.nextDay(s, data);
  core.giveGift(s, 'mira', 'ore', data); // 210
  core.nextDay(s, data);
  core.giveGift(s, 'mira', 'ore', data); // 195 (drops to 1 heart!)
  assert.equal(s.friendship.mira.points, 195);
  assert.deepEqual(s.friendship.mira.unlockedRewards, [2]);

  // Next day -> give loved gift (star: +80 FP) -> 275 FP (crosses 2 hearts again!)
  core.nextDay(s, data);
  const coinsBeforeReclimb = s.coins;
  const resReclimb = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resReclimb.ok, true);
  assert.equal(resReclimb.points, 275);
  assert.equal(resReclimb.rewards.length, 0, 'Must NOT grant milestone 2 rewards again');
  assert.equal(s.coins, coinsBeforeReclimb);
  assert.deepEqual(s.friendship.mira.unlockedRewards, [2]);
});

test('Adversarial M2-4: Savegame corrupted data, missing fields, negative numbers, and nulls fuzzing', () => {
  // 1. Completely missing raw, null, undefined, primitive values
  for (const badRaw of [null, undefined, 0, 1, false, true, '', 'corrupted', [], Symbol('bad')]) {
    const s = core.restoreState(badRaw, data);
    assert.ok(s.friendship, 'friendship must exist');
    assert.equal(Object.keys(s.friendship).length, 11, 'All 11 NPCs present');
    for (const npc of data.npcs) {
      assert.equal(s.friendship[npc.id].points, 0);
      assert.equal(s.friendship[npc.id].talkedToday, false);
      assert.equal(s.friendship[npc.id].giftedToday, false);
      assert.deepEqual(s.friendship[npc.id].unlockedRewards, []);
    }
  }

  // 2. Missing friendship field in version 1 save
  const baseSave = {
    version: 1,
    name: 'Player',
    coins: 100,
    health: 100,
    stamina: 100,
    day: 1,
    minutes: 480,
    map: 'village',
    x: 800,
    y: 550
  };
  const sNoFriendship = core.restoreState(baseSave, data);
  assert.ok(sNoFriendship.friendship);
  assert.equal(Object.keys(sNoFriendship.friendship).length, 11);
  for (const npc of data.npcs) {
    assert.equal(sNoFriendship.friendship[npc.id].points, 0);
    assert.equal(sNoFriendship.friendship[npc.id].talkedToday, false);
    assert.equal(sNoFriendship.friendship[npc.id].giftedToday, false);
    assert.deepEqual(sNoFriendship.friendship[npc.id].unlockedRewards, []);
  }

  // 3. Corrupted friendship field (non-object or hostile object)
  for (const badFriendship of [null, undefined, 12345, 'text', [], true, () => {}]) {
    const s = core.restoreState({ ...baseSave, friendship: badFriendship }, data);
    assert.ok(s.friendship);
    assert.equal(Object.keys(s.friendship).length, 11);
    for (const npc of data.npcs) {
      assert.equal(s.friendship[npc.id].points, 0);
    }
  }

  // 4. Corrupted individual NPC entries (negative numbers, extreme values, NaN, floats, objects)
  const hostileFriendship = {
    mira: { points: -99999, talkedToday: 1, giftedToday: 'true', unlockedRewards: [-10, 0, 1, 2, 2, 4, 999, 'bad', null, undefined] },
    huy: { points: 999999, talkedToday: null, giftedToday: undefined, unlockedRewards: [2, 4, 5] },
    linh: { points: 250.78, talkedToday: false, giftedToday: false, unlockedRewards: [4, 2] }, // float and unsorted
    thao: null,
    bao: 'corrupted',
    nam: 42,
    yen: [],
    son: { points: NaN, unlockedRewards: {} },
    sen: { points: Infinity, unlockedRewards: 'all' },
    kiet: { points: -Infinity },
    ly: { points: '500' } // string
  };

  const sHostile = core.restoreState({ ...baseSave, friendship: hostileFriendship }, data);

  // mira: negative clamped to 0, unlockedRewards sanitized to valid unique sorted [2, 4]
  assert.equal(sHostile.friendship.mira.points, 0);
  assert.equal(sHostile.friendship.mira.talkedToday, true);
  assert.equal(sHostile.friendship.mira.giftedToday, true);
  assert.deepEqual(sHostile.friendship.mira.unlockedRewards, [2, 4]);

  // huy: 999999 clamped to 500, falsy flags to false
  assert.equal(sHostile.friendship.huy.points, 500);
  assert.equal(sHostile.friendship.huy.talkedToday, false);
  assert.equal(sHostile.friendship.huy.giftedToday, false);
  assert.deepEqual(sHostile.friendship.huy.unlockedRewards, [2, 4, 5]);

  // linh: float 250.78 floored to 250, [4, 2] sorted to [2, 4]
  assert.equal(sHostile.friendship.linh.points, 250);
  assert.deepEqual(sHostile.friendship.linh.unlockedRewards, [2, 4]);

  // thao, bao, nam, yen: null/string/number/array fallbacks
  for (const id of ['thao', 'bao', 'nam', 'yen']) {
    assert.equal(sHostile.friendship[id].points, 0);
    assert.equal(sHostile.friendship[id].talkedToday, false);
    assert.equal(sHostile.friendship[id].giftedToday, false);
    assert.deepEqual(sHostile.friendship[id].unlockedRewards, []);
  }

  // son, sen, kiet, ly: NaN / Infinity / string fallbacks
  assert.equal(sHostile.friendship.son.points, 0);
  assert.deepEqual(sHostile.friendship.son.unlockedRewards, []);
  assert.equal(sHostile.friendship.sen.points, 0);
  assert.deepEqual(sHostile.friendship.sen.unlockedRewards, []);
  assert.equal(sHostile.friendship.kiet.points, 0);
  assert.equal(sHostile.friendship.ly.points, 0);
});

test('Adversarial M2-5: Prototype pollution attempts during restoreState', () => {
  const jsonWithProto = JSON.stringify({
    version: 1,
    name: 'ProtoAttacker',
    __proto__: { pollutedGlobal: true },
    friendship: {
      __proto__: { pollutedFriendship: true, fakeNpc: { points: 500 } },
      mira: {
        __proto__: { pollutedMira: true },
        points: 200,
        unlockedRewards: [2]
      }
    }
  });

  const parsed = JSON.parse(jsonWithProto);
  const restored = core.restoreState(parsed, data);

  // Check prototype pollution did not pollute global Object
  assert.equal(Object.prototype.pollutedGlobal, undefined);
  assert.equal(Object.prototype.pollutedFriendship, undefined);
  assert.equal(Object.prototype.pollutedMira, undefined);

  // Check friendship keys strictly match data.npcs
  const expectedNpcIds = data.npcs.map(n => n.id);
  assert.deepEqual(Object.keys(restored.friendship).sort(), expectedNpcIds.sort());
  assert.equal(Object.hasOwn(restored.friendship, 'fakeNpc'), false);
  assert.equal(Object.hasOwn(restored.friendship, '__proto__'), false);
});

test('Adversarial M2-6: Savegame serialization round-trip preservation and stability', () => {
  const sOriginal = core.createState('Explorer', data);
  sOriginal.friendship.mira.points = 230;
  sOriginal.friendship.mira.talkedToday = true;
  sOriginal.friendship.mira.giftedToday = true;
  sOriginal.friendship.mira.unlockedRewards = [2];

  sOriginal.friendship.huy.points = 450;
  sOriginal.friendship.huy.talkedToday = false;
  sOriginal.friendship.huy.giftedToday = true;
  sOriginal.friendship.huy.unlockedRewards = [2, 4];

  sOriginal.friendship.linh.points = 500;
  sOriginal.friendship.linh.unlockedRewards = [2, 4, 5];

  // Serialize to JSON and restore
  const serialized = JSON.stringify(sOriginal);
  const deserialized = JSON.parse(serialized);
  const sRestored = core.restoreState(deserialized, data);

  // Check deep equality for the entire state and specifically friendship
  assert.deepEqual(sRestored.friendship, sOriginal.friendship);
  assert.deepEqual(sRestored, sOriginal);

  // Double round-trip
  const secondSerialized = JSON.stringify(sRestored);
  const sDoubleRestored = core.restoreState(JSON.parse(secondSerialized), data);
  assert.deepEqual(sDoubleRestored, sOriginal);
});

test('Adversarial M2-7: Save transfer export/import strips unknown friendship properties and preserves valid state', () => {
  const transfer = require('../public/js/save-transfer.js');
  const s = core.createState('Explorer', data);
  s.friendship.mira.points = 350;
  s.friendship.mira.talkedToday = true;
  s.friendship.mira.giftedToday = true;
  s.friendship.mira.unlockedRewards = [2];
  s.friendship.mira.injectedProperty = 'hacked';
  s.friendship.extraFakeNpc = { points: 999 };

  const encoded = transfer.encode(s, data);
  const rawEnvelope = JSON.parse(encoded);

  // Raw envelope must NOT contain injectedProperty or extraFakeNpc
  assert.equal(Object.hasOwn(rawEnvelope.progress.friendship.mira, 'injectedProperty'), false);
  assert.equal(Object.hasOwn(rawEnvelope.progress.friendship, 'extraFakeNpc'), false);

  const decoded = transfer.decode(encoded, data);
  assert.equal(decoded.friendship.mira.points, 350);
  assert.equal(decoded.friendship.mira.talkedToday, true);
  assert.equal(decoded.friendship.mira.giftedToday, true);
  assert.deepEqual(decoded.friendship.mira.unlockedRewards, [2]);
  assert.equal(Object.hasOwn(decoded.friendship.mira, 'injectedProperty'), false);
  assert.equal(Object.hasOwn(decoded.friendship, 'extraFakeNpc'), false);
});

test('Adversarial M2-8: Inventory capacity handling when milestone rewards grant items', () => {
  const s = core.createState('Hero', data);
  // Fill Mira's milestone reward item (berry) to maximum capacity (100)
  s.inventory.berry = 100;
  s.coins = 0;
  s.friendship.mira.points = 200;

  // Trigger milestone 2 (awards 50 coins and 2 berries)
  const rewards = core.checkMilestones(s, 'mira', data);
  assert.equal(rewards.length, 1);
  assert.equal(s.coins, 50);
  // Berry cannot exceed capacity 100, clamped safely without throwing
  assert.equal(s.inventory.berry, 100);
  // Unlocked rewards still records [2]
  assert.deepEqual(s.friendship.mira.unlockedRewards, [2]);
});

test('Adversarial M2-9: event("talk") edge cases and boundaries', () => {
  const s = core.createState('Hero', data);

  // 1. Invalid targets or amounts
  assert.equal(core.event(s, 'talk', 'ghost', 1, data), false);
  assert.equal(core.event(s, 'talk', 'mira', 0, data), false);
  assert.equal(core.event(s, 'talk', 'mira', -5, data), false);
  assert.equal(core.event(s, 'talk', 'mira', NaN, data), false);
  assert.equal(s.friendship.mira.points, 0);
  assert.equal(s.friendship.mira.talkedToday, false);

  // 2. First valid talk today -> +10 FP, talkedToday = true
  assert.equal(core.event(s, 'talk', 'mira', 1, data), true);
  assert.equal(s.friendship.mira.points, 10);
  assert.equal(s.friendship.mira.talkedToday, true);

  // 3. Second talk today -> stat increments, but NO additional FP
  assert.equal(core.event(s, 'talk', 'mira', 1, data), true);
  assert.equal(s.friendship.mira.points, 10);
  assert.equal(s.stats['talk:mira'], 2);

  // 4. Talking when at 495 FP -> clamps to 500 max
  s.friendship.mira.points = 495;
  s.friendship.mira.talkedToday = false;
  assert.equal(core.event(s, 'talk', 'mira', 1, data), true);
  assert.equal(s.friendship.mira.points, 500);
});

test('Adversarial M2-10: Fuzzing giveGift with illegal and edge case inputs', () => {
  const s = core.createState('Hero', data);

  // Illegal NPC IDs
  for (const badNpc of [null, undefined, '', 'ghost', '__proto__', 'constructor', 123, {}]) {
    const res = core.giveGift(s, badNpc, 'star', data);
    assert.equal(res.ok, false);
    assert.equal(res.success, false);
  }

  // Illegal item IDs
  for (const badItem of [null, undefined, '', 'nuclear_bomb', '__proto__', 'constructor', 456, {}]) {
    const res = core.giveGift(s, 'mira', badItem, data);
    assert.equal(res.ok, false);
    assert.equal(res.success, false);
  }

  // Valid item but 0 in inventory
  s.inventory.star = 0;
  const resEmpty = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resEmpty.ok, false);
  assert.equal(resEmpty.success, false);

  // Valid item but negative in inventory
  s.inventory.star = -1;
  const resNegative = core.giveGift(s, 'mira', 'star', data);
  assert.equal(resNegative.ok, false);
  assert.equal(resNegative.success, false);
});

