'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {Room,world,character}=require('../server/awakening/room.cjs');
const make=()=>new Room({host:{id:'a',name:'A'},character:character('a'),world:world('a'),code:'ABC123'});
test('dodge covers exactly 79.2 pixels and reconnect snapshot carries latest input sequence',()=>{
  const r=make(),p=r.players.get('a');p.direction='right';r.command('a',{action:'dodge'});for(let i=0;i<5;i++)r.tick(.05);
  assert.ok(Math.abs(p.x-120-79.2)<1e-6);r.command('a',{action:'input',seq:900,x:0,y:0});assert.equal(r.snapshot('a').players[0].seq,900);
});
test('remaining solo survivor can finish a cooperative puzzle after guest disconnect',()=>{
  const r=make();r.join({id:'b',name:'B'},character('b'));r.command('a',{action:'travel',chapter:0});r.roomIndex=1;r.mobs=[];
  r.disconnect('b');Object.assign(r.players.get('a'),{x:190,y:180});r.command('a',{action:'interact'});assert.equal(r.puzzleSolved,true);
});
test('a melee killing blow commits victory before an immediate retreat command',()=>{
  const r=make();r.command('a',{action:'travel',chapter:0});r.roomIndex=4;r.spawn();const boss=r.mobs[0],p=r.players.get('a');
  Object.assign(boss,{hp:12,x:500,y:280,stage:'recovery'});Object.assign(p,{x:450,y:280,direction:'right'});
  r.command('a',{action:'attack'});r.command('a',{action:'camp'});
  assert.ok(r.world.cleared.includes('deepwood'));assert.equal(p.character.coins,100);assert.equal(r.dirty,true);
});
test('enemy snapshots expose exact server hit geometry for vertical tells and charge width',()=>{
  const r=make();r.command('a',{action:'travel',chapter:0});r.roomIndex=4;r.chapterIndex=2;r.spawn();
  const boss=r.mobs[0];Object.assign(boss,{dx:0,dy:1,style:'charge',stage:'windup'});
  const tell=r.snapshot('a').mobs[0].tell;assert.equal(tell.arc,220);assert.equal(tell.radius,40);assert.equal(tell.chargeLength,126);assert.equal(r.snapshot('a').mobs[0].dx,0);
});
test('exploration abilities open physical old-world paths, and the chest requires reaching the far side',()=>{
  const r=make(),D=require('../public/js/data/awakening-data.js'),s=D.secrets[0];
  assert.equal(r.blocked(s.x,s.y),true);
  r.world.abilities.push('roots');assert.equal(r.blocked(s.x,s.y),false);
  Object.assign(r.players.get('a'),{x:s.x,y:s.y+40});assert.throws(()=>r.command('a',{action:'secret',chapter:0}),/rương/);
  Object.assign(r.players.get('a'),s.chest);r.command('a',{action:'secret',chapter:0});assert.equal(r.world.secrets.length,1);
});
