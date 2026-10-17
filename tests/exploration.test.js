'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../public/js/game-data.js'),C=require('../public/js/game-core.js'),X=require('../public/js/exploration-core.js');
const fresh=()=>C.createState('Người khám phá',D);
const open=s=>{for(let n=1;n<=5;n++)s.quests['story0'+n]={status:'claimed',progress:[1,1]};s.visited=['village','forest'];s.upgrades=['well','bridge','archive'];return s;};

test('shop purchase is atomic for unknown items, invalid amounts, insufficient funds and full bags',()=>{
  const s=fresh();s.coins=1000;const before=JSON.stringify(s);
  for(const [id,n] of [['missing',1],['wood',0],['wood',-1],['wood',1.5],['wood',Infinity],['wood','1']])assert.equal(X.buy(s,id,n,D).ok,false);
  assert.equal(JSON.stringify(s),before);
  s.inventory.wood=C.capacity(s);assert.equal(X.buy(s,'wood',1,D).ok,false);assert.equal(s.coins,1000);
  s.inventory.wood=0;s.coins=1;assert.equal(X.buy(s,'wood',1,D).ok,false);assert.equal(s.inventory.wood,0);
  s.coins=1000;assert.equal(X.buy(s,'wood',3,D).ok,true);assert.equal(s.coins,958);assert.equal(s.inventory.wood,3);
  assert.equal(s.stats['gather:wood'],undefined);
});
test('shop unique equipment cannot be duplicated or equipped before ownership; sell is blocked',()=>{
  const s=fresh();s.coins=2000;assert.equal(X.equip(s,'copperblade',D).ok,false);
  assert.equal(X.buy(s,'copperblade',1,D).ok,true);const coins=s.coins;
  assert.equal(X.buy(s,'copperblade',1,D).ok,false);assert.equal(s.coins,coins);
  assert.equal(X.buy(s,'travelercoat',2,D).ok,false);assert.equal(X.buy(s,'travelercoat',1,D).ok,true);
  assert.equal(X.equip(s,'copperblade',D).ok,true);assert.equal(X.damage(s,D),2);
  assert.equal(X.equip(s,'travelercoat',D).ok,true);assert.equal(X.armor(s,D),1);
  assert.equal(C.sell(s,'copperblade',1,D).ok,false);assert.equal(s.inventory.copperblade,1);
});
test('each cave requires its map unlock, reading its clue, correct sequence and victory before unique loot',()=>{
  for(const cave of D.exploration.rooms.filter(r=>r.kind==='cave')){
    const s=open(fresh());assert.equal(X.claimLoot(s,cave.id,D).ok,false);
    assert.equal(X.puzzleInput(s,cave.id,cave.sequence[0],D).ok,false);
    assert.equal(X.readClue(s,cave.id,D).ok,true);
    assert.equal(X.puzzleInput(s,cave.id,'bad',D).ok,false);
    for(const symbol of ['star','star','star'])X.puzzleInput(s,cave.id,symbol,D);
    assert.equal(X.solve(s,cave.id,D).ok,false);assert.equal(X.markVictory(s,cave.id,D).ok,false);
    assert.equal(X.resetPuzzle(s,cave.id,D).ok,true);
    for(const symbol of cave.sequence)assert.equal(X.puzzleInput(s,cave.id,symbol,D).ok,true);
    assert.equal(X.solve(s,cave.id,D).ok,true);assert.equal(X.markVictory(s,cave.id,D).ok,true);
    assert.equal(X.markVictory(s,cave.id,D).ok,false);
    const item=Object.keys(cave.loot)[0];s.inventory[item]=C.capacity(s);const coins=s.coins;
    assert.equal(X.claimLoot(s,cave.id,D).ok,false);assert.equal(s.coins,coins);assert.deepEqual(s.exploration.looted,[]);
    s.inventory[item]=0;assert.equal(X.claimLoot(s,cave.id,D).ok,true);assert.equal(s.inventory[item],cave.loot[item]);
    const after=JSON.stringify(s);assert.equal(X.claimLoot(s,cave.id,D).ok,false);assert.equal(JSON.stringify(s),after);
  }
  const locked=fresh();assert.equal(X.readClue(locked,'cave-coast',D).ok,false);assert.equal(X.readClue(locked,'__proto__',D).ok,false);
});
test('old and malformed saves restore safely and keep only valid dependent exploration records',()=>{
  const old=fresh();delete old.exploration;const restored=C.restoreState(old,D);assert.deepEqual(restored.exploration,X.create());
  const s=open(fresh());s.inventory.copperblade=1;s.adventure.weapon='copperblade';
  s.exploration={visited:['home-mira','bad','cave-forest'],clues:['cave-forest'],solved:['cave-forest','cave-coast'],cleared:['cave-forest','cave-ruins'],looted:['cave-forest','cave-coast'],puzzles:{'cave-forest':['leaf'],'__proto__':['moon']},outfit:'cloudcoat'};
  const r=C.restoreState(s,D);assert.deepEqual(r.exploration.cleared,['cave-forest']);assert.deepEqual(r.exploration.looted,['cave-forest']);assert.equal(r.exploration.outfit,null);assert.equal(r.adventure.weapon,'copperblade');
  r.inventory.copperblade=0;assert.equal(C.restoreState(r,D).adventure.weapon,'starter');
  const malformed=fresh();malformed.exploration={visited:4,clues:null,solved:'cave-forest',puzzles:[],outfit:{}};assert.deepEqual(C.restoreState(malformed,D).exploration,X.create());
});
