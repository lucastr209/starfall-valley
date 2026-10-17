'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Room, character, world, chapters, weapons } = require('../server/awakening/room.cjs');
const user = id => ({ id, name: 'Bạn ' + id });
const make = () => new Room({ host: user('a'), character: character('a'), world: world('a'), code: 'ABC123' });

test('three five-room chapters, weapon roles and fresh online saves are independent of Legacy', () => {
  assert.equal(chapters.length, 3);
  assert.ok(chapters.every(c => c.rooms.length === 5 && c.ability && c.building));
  assert.deepEqual(Object.keys(weapons), ['sword', 'bow', 'staff']);
  assert.equal(character('a').coins, 0);
  assert.deepEqual(world('a').cleared, []);
});
test('private room caps membership at four and rejoining retains the same actor', () => {
  const r = make();
  for (const id of ['b','c','d']) r.join(user(id), character(id));
  assert.throws(() => r.join(user('e'), character('e')), /đầy/);
  const before = r.players.get('b'); r.disconnect('b', 1000); r.join(user('b'), character('b'));
  assert.equal(r.players.get('b'), before);
  assert.equal(before.connected, true);
});
test('only host changes rooms/buildings; guests contribute without changing their own world', () => {
  const r = make(); const c = character('b'); c.materials = 10; r.join(user('b'), c);
  assert.throws(() => r.command('b', { action: 'travel', chapter: 0 }), /Chủ phòng/);
  assert.throws(() => r.command('a', { action: 'travel', chapter: 2 }), /chưa mở/);
  r.command('b', { action: 'contribute', amount: 5 });
  assert.equal(r.players.get('b').character.materials, 5); assert.equal(c.materials, 10); assert.equal(r.world.stock, 5);
  assert.deepEqual(world('b').cleared, []);
  assert.throws(() => r.command('b', { action: 'build' }), /Chủ phòng/);
});
test('server clamps movement and rejects invalid, replayed and fabricated actions', () => {
  const r = make();
  r.command('a', { action: 'input', seq: 1, x: 1, y: 1, running: true });
  r.tick(.05, 1000); const p = r.players.get('a');
  assert.ok(Math.hypot(p.x-120, p.y-280) < 16);
  assert.throws(() => r.command('a', { action: 'input', seq: 1, x: 1, y: 0 }), /thứ tự/);
  assert.throws(() => r.command('a', { action: 'input', seq: 2, x: NaN, y: 0 }), /điều khiển/);
  assert.throws(() => r.command('a', { action: 'reward', coins: 999 }), /không hợp lệ/);
  assert.throws(() => r.command('a', { action: 'weapon', weapon: '__proto__' }), /Vũ khí/);
});
test('host disconnect pauses exactly sixty seconds; reconnect resumes, expiry closes safely', () => {
  const r = make(); r.disconnect('a', 1000); const p = r.players.get('a');
  r.tick(.05, 60999); assert.equal(r.closed, false); assert.equal(p.x, 120);
  r.join(user('a'), character('a')); assert.equal(r.paused, false);
  r.disconnect('a', 70000); r.tick(.05, 130000); assert.equal(r.closed, true);
});
test('puzzle completes solo and requires distinct cooperative switches for a group', () => {
  const r = make(); r.command('a', { action: 'travel', chapter: 0 });
  r.mobs = []; r.roomIndex = 1; r.players.get('a').x = 190; r.players.get('a').y = 180;
  r.command('a', { action: 'interact' }); assert.equal(r.puzzleSolved, true);
  const group = make(); group.join(user('b'), character('b')); group.command('a', { action: 'travel', chapter: 0 });
  group.roomIndex = 1; group.mobs = [];
  group.players.get('a').x = 190; group.players.get('a').y = 180;
  group.command('a', { action: 'interact' }); assert.equal(group.puzzleSolved, false);
  group.players.get('b').x = 610; group.players.get('b').y = 380;
  group.command('b', { action: 'interact' }); assert.equal(group.puzzleSolved, true);
});
test('revival requires proximity and a living teammate; wipe returns safely to camp', () => {
  const r = make(); r.join(user('b'), character('b')); r.command('a', { action: 'travel', chapter: 0 });
  const a=r.players.get('a'), b=r.players.get('b'); b.health=0; b.x=a.x+25; b.y=a.y;
  r.command('a', { action: 'revive', target: 'b' });
  for(let i=0;i<40;i++)r.tick(.05,1000+i*50);
  assert.equal(b.health, 35);
  b.health=0; a.health=0; r.tick(.05, 1000); assert.equal(r.chapterIndex, -1); assert.equal(a.health,100);
});
test('boss has two phases, scaling is frozen on encounter start and victory is saved once', () => {
  const r = make(); r.join(user('b'), character('b')); r.command('a', { action:'travel', chapter:0 });
  const scaled=r.encounterSize; r.disconnect('b',1000); assert.equal(r.encounterSize,scaled);
  r.roomIndex=4; r.spawn(); const boss=r.mobs.find(m=>m.boss);
  boss.hp=boss.maxHp*.4; r.tick(.05,2000); assert.equal(boss.phase,2);
  for(const m of r.mobs)m.hp=0; r.tick(.05,2100);
  assert.equal(r.world.cleared.includes('deepwood'),true); assert.equal(r.dirty,true);
  assert.equal(r.players.get('a').character.materials,8);
  r.tick(.05,2150); assert.equal(r.players.get('a').character.materials,8);
  assert.ok(r.world.abilities.includes('roots'));
});
test('camp weapons, host construction, abilities and secrets carry through all chapters', () => {
  const r=make(); r.command('a',{action:'weapon',weapon:'staff'}); assert.equal(r.players.get('a').character.weapon,'staff');
  for(let i=0;i<3;i++){
    r.command('a',{action:'travel',chapter:i}); r.roomIndex=4; r.spawn(); for(const m of r.mobs)m.hp=0; r.tick(.05,1000+i*100);
    r.command('a',{action:'camp'}); r.command('a',{action:'contribute',amount:8}); r.command('a',{action:'build'});
    const secret=require('../public/js/data/awakening-data.js').secrets[i];Object.assign(r.players.get('a'),secret.chest);
    r.command('a',{action:'secret',chapter:i});
  }
  assert.equal(r.world.buildings.length,3); assert.equal(r.world.secrets.length,3);
  assert.equal(r.players.get('a').character.coins,390);
});
