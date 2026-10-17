'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const corePath = path.join(__dirname, '../public/js/combat-core.js');
const dataPath = path.join(__dirname, '../public/js/combat-data.js');

// Nạp đúng module phát hành; khi chưa có engine, lỗi RED chỉ rõ tính năng thiếu.
function engine() {
  assert.ok(fs.existsSync(corePath), 'Thiếu engine combat độc lập');
  assert.ok(fs.existsSync(dataPath), 'Thiếu dữ liệu combat độc lập');
  return require(corePath);
}
function fixture(mobs = [], patch = {}, extra = {}) {
  const combat = engine(), runtime = combat.createRuntime();
  const actor = { x: 300, y: 300, health: 100, stamina: 100, ...patch };
  const hits = [], defeats = [], hurts = [], dodges = [];
  const ctx = { actor, mobs, isBlocked: () => false,
    onHit: (mob, damage) => hits.push([mob.id, damage, mob.hp]),
    onDefeat: mob => defeats.push(mob.id), onHurt: damage => hurts.push(damage),
    onDodge: () => dodges.push(true), ...extra };
  return { combat, runtime, actor, mobs, ctx, hits, defeats, hurts, dodges };
}
function mob(id, kind = 'slime', x = 350, y = 300, hp = 20) {
  return { id, kind, hp, x, y, homeX: x, homeY: y, phase: 0, deadUntil: 0, hitTime: 0 };
}
// Chia theo FPS thật thay vì gọi một dt lớn bị giới hạn bù frame.
function run(e, seconds, fps = 60) {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) e.combat.advance(e.runtime, 1 / fps, e.ctx);
}
function almost(value, expected, message, epsilon = 1e-7) { assert.ok(Math.abs(value - expected) < epsilon, message + ': ' + value + ' / ' + expected); }

test('Browser UMD and Node expose the same combat API without wall-clock dependencies', () => {
  const combat = engine(), sandbox = {};
  vm.runInNewContext(fs.readFileSync(dataPath, 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(corePath, 'utf8'), sandbox);
  for (const key of ['createRuntime', 'requestAttack', 'requestDodge', 'cancelInputs', 'resetActions', 'advance']) {
    assert.equal(typeof sandbox.StardropCombat[key], 'function'); assert.equal(typeof combat[key], 'function');
  }
  for (const kind of ['slime', 'sprout', 'warden', 'rootBoss']) {
    const enemy = sandbox.StardropCombatData.enemies[kind];
    assert.ok(enemy.name && enemy.color && enemy.maxHp > 0, kind + ' has render metadata');
  }
  const runtime = sandbox.StardropCombat.createRuntime(), actor = { x: 0, y: 0, health: 100, stamina: 100 };
  assert.equal(sandbox.StardropCombat.requestAttack(runtime, actor, 'right'), true);
  sandbox.StardropCombat.advance(runtime, 1 / 60, { actor, mobs: [], isBlocked: () => false });
});

test('Sword waits for windup, hits once per target and rejects repeats until recovery ends', () => {
  const e = fixture([mob('a'), mob('b', 'slime', 355, 315)]);
  assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'right'), true); assert.equal(e.actor.stamina, 98);
  assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'right'), false);
  run(e, 5 / 60); assert.equal(e.hits.length, 0);
  run(e, 2 / 60); assert.equal(e.hits.length, 2);
  run(e, 10 / 60); assert.equal(e.hits.length, 2); assert.deepEqual(e.mobs.map(m => m.hp), [19, 19]);
  run(e, 7 / 60); assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'right'), true);
});

for (const [direction, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['up', 0, -1], ['down', 0, 1]]) {
  test('Sword uses the ' + direction + ' facing instead of nearest radial target', () => {
    const e = fixture([mob('front', 'slime', 300 + dx * 50, 300 + dy * 50), mob('back', 'slime', 300 - dx * 20, 300 - dy * 20), mob('side', 'slime', 300 - dy * 40, 300 + dx * 40)]);
    e.combat.requestAttack(e.runtime, e.actor, direction); run(e, .3);
    assert.deepEqual(e.hits.map(h => h[0]), ['front']);
  });
}

test('Sword respects 78 pixel range, 100 degree cone and a wall between sword and enemy', () => {
  const angle = 49 * Math.PI / 180;
  const e = fixture([mob('edge', 'slime', 300 + 77 * Math.cos(angle), 300 + 77 * Math.sin(angle)), mob('far', 'slime', 379, 300), mob('wide', 'slime', 340, 360), mob('wall', 'slime', 355, 300)], {}, { isBlocked: (x, y) => x >= 330 && x <= 333 && Math.abs(y - 300) < 8 });
  e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .25);
  assert.deepEqual(e.hits.map(h => h[0]), ['edge']);
});

test('Combat requests validate life, stamina and direction without consuming failed actions', () => {
  for (const patch of [{ stamina: 1 }, { health: 0 }, { stamina: NaN }]) {
    const e = fixture([], patch); assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'right'), false);
  }
  const e = fixture([], { stamina: 9 }); assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'right'), false); assert.equal(e.actor.stamina, 9);
  assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'diagonal'), false); assert.equal(e.actor.stamina, 9);
  e.actor.stamina = 100; assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'up'), true); assert.equal(e.actor.stamina, 90);
  assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'up'), false); assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'up'), false);
});

test('Damage comes from bounded equipment context and defeat fires exactly once', () => {
  for (const [damage, expected] of [[undefined, 1], [Infinity, 1], [-4, 1], [99, 10], [2, 2]]) {
    const e = fixture([mob('target')], {}, { damage }); e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .25);
    assert.deepEqual(e.hits, [['target', expected, 20 - expected]]);
  }
  const e = fixture([mob('dead', 'slime', 350, 300, 1)]); e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, 1);
  e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, 1);
  assert.deepEqual(e.defeats, ['dead']); assert.equal(e.hits.length, 1); assert.equal(e.mobs[0].hp, 0);
});

test('Stamina regenerates at six per second only after eight tenths without an action', () => {
  const e = fixture([], { stamina: 50 }); e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .8);
  almost(e.actor.stamina, 48, 'Regen delay consumes exactly .8 seconds'); run(e, .5); almost(e.actor.stamina, 51, 'Half second regens three points');
  e.combat.requestDodge(e.runtime, e.actor, 'right'); run(e, .8); almost(e.actor.stamina, 41, 'Dodge restarts regen delay'); run(e, .5); almost(e.actor.stamina, 44, 'Dodge allows subsequent regen');
  e.actor.stamina = 99; run(e, 1); assert.equal(e.actor.stamina, 100);
});

test('Village can disable stamina regen while action delays and dodge movement still tick', () => {
  const village = fixture([], { stamina: 57 }, { regen: false }); run(village, 1);
  assert.equal(village.actor.stamina, 57, 'Village keeps its existing stamina contract');
  const combat = fixture([], { stamina: 57 }); run(combat, 1);
  almost(combat.actor.stamina, 63, 'Default combat regen remains enabled');
  village.combat.requestDodge(village.runtime, village.actor, 'right'); run(village, 1);
  assert.equal(village.actor.stamina, 47); almost(village.actor.x, 379.2, 'Disabled regen does not pause dodge');
  assert.equal(village.runtime.dodge, null); assert.equal(village.runtime.dodgeCooldown, 0);
  village.ctx.regen = true; run(village, .5);
  almost(village.actor.stamina, 50, 'Action delay elapsed while regen was disabled');
});

test('Dodge travels for .22 seconds, stops at thin walls and waits for its cooldown', () => {
  const e = fixture([], {}, { isBlocked: x => x >= 330 && x <= 331 });
  assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'right'), true); run(e, .3);
  assert.ok(e.actor.x < 330 && e.actor.x >= 326, 'No wall tunneling'); assert.equal(e.actor.y, 300);
  assert.equal(e.runtime.dodge, null); assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'right'), false);
  run(e, .5); assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'left'), true);
  const free = fixture(); free.combat.requestDodge(free.runtime, free.actor, 'down'); run(free, .3);
  almost(free.actor.y, 379.2, 'Partial final simulation step preserves dodge distance');
});

test('Dodge immunity avoids actual attacks and ends after .16 seconds', () => {
  const e = fixture([mob('heavy', 'warden', 300, 300)]);
  e.mobs[0].combat = { stage: 'active', timer: .4, aimX: 300, aimY: 300, style: 'heavy' };
  e.ctx.isBlocked = () => true; e.combat.requestDodge(e.runtime, e.actor, 'right'); run(e, .1);
  assert.equal(e.actor.health, 100); assert.equal(e.hurts.length, 0); assert.equal(e.dodges.length, 1);
  run(e, .1); assert.ok(e.actor.health < 100, 'Active attack becomes dangerous after dodge immunity ends'); assert.equal(e.hurts.length, 1);
});

test('Idle, windup and recovery enemies do not cause contact damage', () => {
  for (const stage of ['idle', 'windup', 'recovery']) {
    const e = fixture([mob(stage, 'warden', 300, 300)]);
    e.mobs[0].combat = { stage, timer: .6, aimX: 300, aimY: 300, style: 'heavy' }; run(e, .2);
    assert.equal(e.actor.health, 100, stage); assert.deepEqual(e.hurts, []);
  }
});

test('outfit armor reduces real enemy damage with a bounded numeric value and never grants immunity',()=>{
  for(const [armor,reduction]of [[0,0],[1,1],[3,3],[999,3],[-5,0],[Infinity,0],['3',0]]){
    const e=fixture([mob('heavy','warden',300,300)],{},{armor});
    e.mobs[0].combat={stage:'active',timer:.4,aimX:300,aimY:300,style:'heavy'};
    run(e,1/60);assert.equal(e.actor.health,100-(14-reduction));assert.deepEqual(e.hurts,[14-reduction]);
  }
});
test('all cave guardians keep armor until a recovery opening and use their configured patterns',()=>{
  const data=require(dataPath);
  for(const kind of ['forestBoss','tideBoss','skyBoss']){
    const def=data.enemies[kind];assert.ok(def,`Có thông số ${kind}`);assert.equal(def.boss,true);
    const m=mob('guardian',kind,350,300,def.maxHp),e=fixture([m],{health:10000},{damage:3});
    m.combat={stage:'recovery',style:'heavy',timer:10,cycle:0};e.combat.requestAttack(e.runtime,e.actor,'right');run(e,.25);assert.equal(m.hp,def.maxHp);
    run(e,.3);m.combat={stage:'recovery',style:'vulnerable',timer:10,cycle:0};e.combat.requestAttack(e.runtime,e.actor,'right');run(e,.25);assert.equal(m.hp,def.maxHp-3);
    const p=fixture([mob('pattern',kind,350,300,def.maxHp)],{health:10000});run(p,1/60);assert.equal(p.mobs[0].combat.style,def.pattern[0]);
  }
});
test('sea and sky guardians fire distinct bounded projectile fans',()=>{
  for(const [kind,count]of [['tideBoss',3],['skyBoss',5]]){
    const m=mob('fan',kind,300,300,100),e=fixture([m],{x:600,y:300});m.combat={stage:'active',style:'projectile',timer:.2,vx:1,vy:0,emitted:false,cycle:0};
    run(e,1/60);assert.equal(e.runtime.projectiles.length,count);assert.ok(e.runtime.projectiles.some(p=>p.vy<0));assert.ok(e.runtime.projectiles.some(p=>p.vy>0));
  }
});

test('Slime telegraphs for .6 seconds before a locked-direction charge and recovers', () => {
  const e = fixture([mob('slime', 'slime', 380, 300, 3)]); run(e, .6);
  assert.equal(e.actor.health, 100); assert.equal(e.mobs[0].x, 380); assert.equal(e.mobs[0].combat.stage, 'windup'); assert.equal(e.mobs[0].combat.style, 'charge');
  run(e, .3); assert.ok(e.mobs[0].x < 380); assert.ok(e.actor.health < 100); assert.equal(e.hurts.length, 1);
  run(e, .2); assert.equal(e.mobs[0].combat.stage, 'recovery');
});

test('Slime charge stops at a wall instead of dealing damage through it', () => {
  const e = fixture([mob('slime', 'slime', 380, 300, 3)], {}, { isBlocked: x => x >= 340 && x <= 342 }); run(e, 1.2);
  assert.ok(e.mobs[0].x > 342); assert.equal(e.actor.health, 100);
});

test('Sprout fires a straight projectile after its tell; projectile hits once', () => {
  const e = fixture([mob('sprout', 'sprout', 440, 300, 5)]); run(e, .6); assert.equal(e.runtime.projectiles.length, 0);
  run(e, .1); assert.equal(e.runtime.projectiles.length, 1); assert.equal(e.actor.health, 100);
  run(e, .7); assert.equal(e.hurts.length, 1); assert.ok(e.actor.health < 100); assert.equal(e.runtime.projectiles.length, 0);
});

test('Projectile traces thin walls, expires, and never follows a dodging target', () => {
  const blocked = fixture([mob('sprout', 'sprout', 440, 300, 5)], {}, { isBlocked: x => x >= 350 && x <= 351 }); run(blocked, 1.5);
  assert.equal(blocked.actor.health, 100); assert.equal(blocked.runtime.projectiles.length, 0);
  const missed = fixture([mob('sprout', 'sprout', 440, 300, 5)]); run(missed, .7); missed.actor.y = 390; run(missed, 1);
  assert.equal(missed.actor.health, 100); assert.ok(missed.runtime.projectiles.every(p => Math.abs(p.y - 300) < .01));
  run(missed, 3); assert.ok(missed.runtime.projectiles.length <= 2, 'Projectiles have bounded lifetime');
});

test('Warden heavy attack has a safe tell and a punishable recovery', () => {
  const e = fixture([mob('warden', 'warden', 350, 300, 8)]); run(e, .7); assert.equal(e.actor.health, 100); assert.equal(e.mobs[0].combat.stage, 'windup');
  run(e, .3); assert.equal(e.hurts.length, 1); assert.equal(e.mobs[0].combat.stage, 'recovery');
  e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .3); assert.equal(e.mobs[0].hp, 7);
});

test('Root boss cycles sweep, charge and vulnerable recovery with a second telegraphed beat below half health', () => {
  const e = fixture([mob('boss', 'rootBoss', 370, 300, 90)], { health: 10000 });
  const stages = [];
  for (let i = 0; i < 360; i++) { e.combat.advance(e.runtime, 1 / 60, e.ctx); const c = e.mobs[0].combat; stages.push(c.stage + ':' + c.style); }
  for (const value of ['windup:sweep', 'active:sweep', 'windup:charge', 'active:charge', 'recovery:vulnerable']) assert.ok(stages.includes(value), value);
  const low = fixture([mob('boss', 'rootBoss', 370, 300, 44)], { health: 10000 }); let previous = '', tells = 0, firstRecovery = false;
  for (let i = 0; i < 180 && !firstRecovery; i++) { low.combat.advance(low.runtime, 1 / 60, low.ctx); const c = low.mobs[0].combat; if (c.stage === 'windup' && previous !== 'windup') tells++; if (c.stage === 'recovery') firstRecovery = true; previous = c.stage; }
  assert.equal(tells, 2, 'Phase two adds a new visible tell before the repeated beat'); assert.equal(firstRecovery, true);
});

test('Reset discards player combat actions, projectiles and accumulated catchup without touching progress', () => {
  const e = fixture([mob('sprout', 'sprout', 440, 300, 5)], { coins: 712, checkpoint: 'forest-camp' }); run(e, .7);
  assert.ok(e.runtime.projectiles.length); e.combat.requestDodge(e.runtime, e.actor, 'up'); e.combat.advance(e.runtime, .005, e.ctx);
  const before = { ...e.actor }, hp = e.mobs[0].hp; e.combat.resetActions(e.runtime);
  for (const key of ['attack', 'dodge']) assert.equal(e.runtime[key], null);
  for (const key of ['invulnerable', 'cooldown', 'dodgeCooldown', 'accumulator']) assert.equal(e.runtime[key], 0);
  assert.equal(e.runtime.projectiles.length, 0); assert.deepEqual(e.actor, before); assert.equal(e.mobs[0].hp, hp);
  e.mobs.length = 0; e.combat.advance(e.runtime, 0, e.ctx); assert.deepEqual(e.actor, before);
});

test('Opening UI cancels a swing without bypassing recovery or erasing enemy projectiles', () => {
  const e = fixture([mob('sprout', 'sprout', 440, 300, 5)]); run(e, .7);
  assert.equal(e.runtime.projectiles.length, 1); e.combat.requestAttack(e.runtime, e.actor, 'up'); run(e, .05);
  e.combat.advance(e.runtime, .005, e.ctx);
  const projectiles = structuredClone(e.runtime.projectiles), cooldown = e.runtime.cooldown, delay = e.runtime.staminaDelay, actor = { ...e.actor };
  e.combat.cancelInputs(e.runtime);
  assert.equal(e.runtime.attack, null); assert.equal(e.runtime.accumulator, 0); assert.equal(e.runtime.cooldown, cooldown);
  assert.equal(e.runtime.staminaDelay, delay); assert.deepEqual(e.runtime.projectiles, projectiles); assert.deepEqual(e.actor, actor);
  assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'up'), false, 'Closing UI cannot create an early swing');
  run(e, .35); assert.equal(e.combat.requestAttack(e.runtime, e.actor, 'up'), true);
});

test('Opening UI stops dodge movement but preserves dodge cooldown and existing immunity', () => {
  const e = fixture(); e.combat.requestDodge(e.runtime, e.actor, 'down'); run(e, .05);
  const y = e.actor.y, invulnerable = e.runtime.invulnerable, cooldown = e.runtime.dodgeCooldown;
  e.combat.cancelInputs(e.runtime);
  assert.equal(e.runtime.dodge, null); assert.equal(e.runtime.invulnerable, invulnerable); assert.equal(e.runtime.dodgeCooldown, cooldown);
  assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'down'), false);
  run(e, .3); assert.equal(e.actor.y, y, 'Cancelled dodge cannot resume behind a modal');
  run(e, .45); assert.equal(e.combat.requestDodge(e.runtime, e.actor, 'down'), true);
});

test('Root boss armor blocks each swing once outside the exposed recovery window', () => {
  for (const [stage, style] of [['idle', 'sweep'], ['windup', 'sweep'], ['active', 'sweep'], ['recovery', 'sweep'], ['windup', 'vulnerable']]) {
    const boss = mob('boss', 'rootBoss', 350, 300, 90), e = fixture([boss], {}, { damage: 3 }), blocked = [];
    boss.combat = { stage, timer: 100, style, aimX: 300, aimY: 300, vx: -1, vy: 0 };
    e.ctx.onBlocked = target => blocked.push(target.id);
    e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .25);
    assert.equal(boss.hp, 90, stage + ':' + style + ' stays armored'); assert.deepEqual(e.hits, []); assert.deepEqual(e.defeats, []);
    assert.deepEqual(blocked, ['boss'], 'Armor feedback is not repeated every fixed step');
  }
});

test('Root boss takes equipment damage in exposed recovery and can be defeated only once', () => {
  const boss = mob('boss', 'rootBoss', 350, 300, 3), e = fixture([boss], {}, { damage: 3 }), blocked = [];
  boss.combat = { stage: 'recovery', timer: 100, style: 'vulnerable', aimX: 300, aimY: 300 };
  e.ctx.onBlocked = target => blocked.push(target.id); e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, 1);
  assert.equal(boss.hp, 0); assert.deepEqual(e.hits, [['boss', 3, 0]]); assert.deepEqual(e.defeats, ['boss']); assert.deepEqual(blocked, []);
  e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .4); assert.deepEqual(e.defeats, ['boss']);
});

test('Armor callback context changes cancel the swing before hitting other enemies', () => {
  const boss = mob('boss', 'rootBoss', 350, 300, 90), e = fixture([boss, mob('other')], { map: 'forest' });
  boss.combat = { stage: 'windup', timer: 100, style: 'sweep', aimX: 300, aimY: 300 };
  e.ctx.onBlocked = () => { e.actor.map = 'village'; };
  e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .2);
  assert.equal(boss.hp, 90); assert.equal(e.mobs[1].hp, 20); assert.equal(e.runtime.attack, null); assert.deepEqual(e.hits, []);
});

test('A callback opening UI preserves recovery and projectiles when it cancels inputs mid-step', () => {
  const boss = mob('boss', 'rootBoss', 350, 300, 90), e = fixture([boss]);
  boss.combat = { stage: 'windup', timer: 100, style: 'sweep', aimX: 300, aimY: 300 };
  e.runtime.projectiles.push({ id: 1, owner: 'sprout', x: 500, y: 500, vx: -20, vy: 0, life: 2.5, damage: 10 });
  e.ctx.onBlocked = () => e.combat.cancelInputs(e.runtime);
  e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, 5 / 60);
  const shots = structuredClone(e.runtime.projectiles); e.combat.advance(e.runtime, 1 / 60, e.ctx);
  assert.equal(e.runtime.attack, null); almost(e.runtime.cooldown, .3, 'UI callback cannot reset attack recovery');
  assert.deepEqual(e.runtime.projectiles, shots, 'Aborting a paused step cannot erase the incoming shot');
});

test('Boss armor, second phase and cancelled actions remain deterministic at 30, 60 and 120 FPS', () => {
  const results = [30, 60, 120].map(fps => {
    const boss = mob('boss', 'rootBoss', 370, 300, 90), e = fixture([boss], { health: 10000 }), blocked = [];
    e.ctx.onBlocked = m => blocked.push(m.id); e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .2, fps);
    e.combat.cancelInputs(e.runtime); run(e, .8, fps); boss.hp = 44; run(e, 3, fps);
    return { actor: e.actor, boss, blocked, hits: e.hits, hurts: e.hurts, projectiles: e.runtime.projectiles };
  });
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});

test('Zero, negative and nonfinite elapsed time cannot tick combat or regeneration', () => {
  const e = fixture([mob('slime')]); e.combat.requestAttack(e.runtime, e.actor, 'right');
  const before = JSON.stringify({ actor: e.actor, runtime: e.runtime, mobs: e.mobs });
  for (const dt of [0, -1, NaN, Infinity]) e.combat.advance(e.runtime, dt, e.ctx);
  assert.equal(JSON.stringify({ actor: e.actor, runtime: e.runtime, mobs: e.mobs }), before);
});

test('Long suspended frames execute at most five fixed steps and discard backlog', () => {
  const e = fixture(); e.combat.requestDodge(e.runtime, e.actor, 'right'); e.combat.advance(e.runtime, 600, e.ctx);
  almost(e.actor.x, 330, 'Only five steps move the player'); assert.ok(e.runtime.accumulator < 1 / 60);
  e.combat.advance(e.runtime, 1 / 60, e.ctx); almost(e.actor.x, 336, 'No suspended-time backlog survives');
});

test('Simulation at 30, 60 and 120 FPS has identical attacks, motion, health and stamina', () => {
  const results = [30, 60, 120].map(fps => {
    const e = fixture([mob('slime', 'slime', 420, 300, 8), mob('sprout', 'sprout', 580, 300, 5)]);
    e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, .4, fps);
    e.combat.requestDodge(e.runtime, e.actor, 'down'); run(e, 1, fps);
    e.combat.requestAttack(e.runtime, e.actor, 'right'); run(e, 1, fps);
    return { actor: e.actor, mobs: e.mobs, hits: e.hits, defeats: e.defeats, hurts: e.hurts, dodges: e.dodges, projectiles: e.runtime.projectiles };
  });
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});

test('Death and map changes inside callbacks stop remaining hits in the same simulation frame', () => {
  const dead = fixture([mob('first', 'warden', 300, 300), mob('second', 'warden', 300, 300)], { health: 1 });
  dead.mobs.forEach(m => { m.combat = { stage: 'active', timer: .2, aimX: 300, aimY: 300, style: 'heavy' }; });
  dead.combat.advance(dead.runtime, 1 / 60, dead.ctx); assert.equal(dead.hurts.length, 1); assert.equal(dead.actor.health, 0);
  const moved = fixture([mob('first'), mob('second')], { map: 'forest' }); moved.ctx.onHit = m => { moved.hits.push(m.id); moved.actor.map = 'village'; };
  moved.combat.requestAttack(moved.runtime, moved.actor, 'right'); run(moved, .12); assert.equal(moved.hits.length, 1); assert.equal(moved.mobs[1].hp, 20);
});
