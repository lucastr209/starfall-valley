'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const data=require('../public/js/data/game-data.js'),core=require('../public/js/core/game-core.js'),transfer=require('../public/js/ui/save-transfer.js');

test('Save transfer preserves progression and only exports known persistent game fields',()=>{
  const state=core.createState('Lữ khách',data);state.coins=320;state.xp=213;state.day=2;state.inventory.wood=15;
  core.accept(state,'story01',data);state.moving=true;state.joystick={x:1,y:0};state.token='private';
  const encoded=transfer.encode(state,data),raw=JSON.parse(encoded),restored=transfer.decode(encoded,data);
  assert.equal(raw.format,'starfall-valley-progress');assert.equal(restored.coins,320);assert.equal(restored.xp,213);
  assert.equal(restored.inventory.wood,15);assert.deepEqual(restored.quests,state.quests);
  for(const key of ['moving','joystick','token','touchRun','direction'])assert.equal(Object.hasOwn(raw.progress,key),false);
  assert.equal(state.moving,true,'Export does not change a running session');
});

test('Import rejects broken, unrelated, oversized and unsupported files instead of resetting progress',()=>{
  const original=core.createState('QA',data),valid=JSON.parse(transfer.encode(original,data));
  for(const text of ['',null,'{','{}',JSON.stringify(original),'x'.repeat(transfer.maxBytes+1),
    JSON.stringify({...valid,version:2}),JSON.stringify({...valid,progress:{version:1}}),
    JSON.stringify({...valid,progress:{...valid.progress,map:'unknown'}}),JSON.stringify({...valid,progress:{...valid.progress,inventory:[]}})]){
    assert.throws(()=>transfer.decode(text,data));
  }
  assert.equal(original.coins,180);
});

test('Recognized imports sanitize unknown and poisoned fields through the game core',()=>{
  const raw=JSON.parse(transfer.encode(core.createState('QA',data),data));
  raw.progress.name='<script>QA</script>';raw.progress.coins=1e20;raw.progress.inventory.invalid=800;
  raw.progress.quests.__proto__={status:'claimed',progress:[999]};raw.progress.upgrades=['not-an-upgrade'];
  const restored=transfer.decode(JSON.stringify(raw),data);
  assert.equal(restored.name.includes('<'),false);assert.equal(restored.coins,1000000);
  assert.equal(Object.hasOwn(restored.inventory,'invalid'),false);assert.equal(Object.hasOwn(restored.quests,'__proto__'),false);
  assert.deepEqual(restored.upgrades,[]);assert.equal({}.status,undefined);
});
