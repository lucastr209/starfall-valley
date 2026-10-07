'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const FX = require('../world-effects.js');
const MAPS = ['village', 'forest', 'coast', 'ruins'];

function fixture(map) {
  return {
    trees: [{x:200,y:280},{x:380,y:800},{x:990,y:210}],
    objects: map === 'village' ? [{kind:'camp',x:790,y:735},{kind:'plot',x:490,y:770},{kind:'well',x:920,y:725}] : [{kind:'shrine',x:800,y:280},{kind:'chest',x:1400,y:940}],
    buildings: map === 'village' ? [{x:270,y:330,w:146,h:125,kind:'home'}, {x:610,y:335,w:154,h:137,kind:'workshop',upgrade:'workshop'}, {x:1340,y:350,w:122,h:108,kind:'kitchen',upgrade:'kitchen'}] : [],
    isPath: (x,y,margin) => Math.abs(x-800)<35+margin || Math.abs(y-550)<35+margin
  };
}
function canvasMock() {
  const stack = [], calls = [];
  const ctx = {
    globalAlpha: .47, fillStyle: '#abcdef',
    save() { stack.push({alpha:this.globalAlpha,style:this.fillStyle}); },
    restore() { const saved=stack.pop(); assert.ok(saved, 'balanced canvas save/restore');this.globalAlpha=saved.alpha;this.fillStyle=saved.style; },
    fillRect(x,y,w,h) { calls.push({x,y,w,h,alpha:this.globalAlpha,color:this.fillStyle}); }
  };
  return {ctx,calls,stack};
}

test('module runs in browsers without a DOM or external dependency',()=>{
  const scope={};vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../world-effects.js'),'utf8'),scope);
  assert.equal(typeof scope.StardropEffects.createScene,'function');
  assert.equal(scope.StardropEffects.createScene('forest').map,'forest');
});
test('each region creates deterministic, bounded scenery without modifying world data',()=>{
  for(const map of MAPS){
    const options=fixture(map), original=JSON.stringify(options),a=FX.createScene(map,options),b=FX.createScene(map,options);
    assert.deepEqual(a,b,map);assert.equal(JSON.stringify(options),original,map);
    assert.ok(a.flora.length>40&&a.flora.length<=64,map);
    assert.equal(a.water.length,14);assert.ok(a.butterflies.length<=5);assert.ok(a.fireflies.length<=8);assert.ok(a.leaves.length<=10);assert.ok(a.birds.length<=3);
    if(a.camp)a.camp.x+=20;
    assert.equal(JSON.stringify(options),original,'scene owns its anchor data');
  }
});
test('rejects unknown maps and tolerates invalid decoration points',()=>{
  assert.throws(()=>FX.createScene('bad'),RangeError);
  const scene=FX.createScene('village',{trees:[null,{x:NaN,y:3}],objects:[null,{x:3,y:Infinity}],buildings:[null,{x:0,y:0,w:NaN,h:5}]});
  assert.equal(scene.flora.length,64);assert.equal(scene.chimneys.length,0);
});
test('grass and flowers avoid roads, water, buildings, trees, and interactable objects',()=>{
  const options=fixture('village'),scene=FX.createScene('village',options);
  for(const plant of scene.flora){
    assert.equal(options.isPath(plant.x,plant.y,15),false);
    assert.equal(FX.isWater(plant.x,plant.y,22),false);
    assert.ok(options.trees.every(t=>Math.hypot(t.x-plant.x,t.y-plant.y)>=24));
    assert.ok(options.objects.every(o=>Math.hypot(o.x-plant.x,o.y-plant.y)>=(o.kind==='plot'?45:30)));
    assert.ok(options.buildings.every(b=>Math.abs(plant.x-b.x)>=b.w/2+25||plant.y<=b.y-b.h-12||plant.y>=b.y+32));
  }
});
test('creation is bounded when no safe ground exists',()=>{
  let checks=0;const scene=FX.createScene('forest',{isPath:()=>{checks++;return true;}});
  assert.equal(scene.flora.length,0);assert.ok(checks<=640);
  assert.equal(scene.butterflies.length,5,'air effects remain available');
  assert.equal(FX.sampleAmbient(scene,10).ground.length,14);
});
test('sampling is deterministic and never mutates the scene',()=>{
  for(const map of MAPS){
    const scene=FX.createScene(map,fixture(map)), original=JSON.stringify(scene),options={night:true,shrineActive:true,upgrades:['workshop','kitchen']};
    assert.deepEqual(FX.sampleAmbient(scene,12.75,options),FX.sampleAmbient(scene,12.75,options));
    FX.sampleAmbient(scene,40,options);assert.equal(JSON.stringify(scene),original);
  }
});
test('all regions animate grass and water across time while plant roots stay in place',()=>{
  for(const map of MAPS){
    const scene=FX.createScene(map,fixture(map)),a=FX.sampleAmbient(scene,0),b=FX.sampleAmbient(scene,1);
    assert.notDeepEqual(a.ground,b.ground,map);
    const before=a.ground.filter(e=>e.type==='grass'||e.type==='flower'),after=b.ground.filter(e=>e.type==='grass'||e.type==='flower');
    assert.deepEqual(before.map(e=>[e.x,e.y]),after.map(e=>[e.x,e.y]));
    assert.ok(before.some((e,i)=>e.sway!==after[i].sway));
    assert.notDeepEqual(a.ground.filter(e=>e.type==='ripple'),b.ground.filter(e=>e.type==='ripple'));
  }
});
test('butterflies flutter by day and fireflies take over at night in village and forest',()=>{
  for(const map of ['village','forest']){
    const scene=FX.createScene(map,fixture(map)),day=FX.sampleAmbient(scene,0),later=FX.sampleAmbient(scene,1),night=FX.sampleAmbient(scene,0,{night:true});
    assert.equal(day.air.filter(e=>e.type==='butterfly').length,5);
    assert.equal(day.air.filter(e=>e.type==='firefly').length,0);
    assert.notDeepEqual(day.air.filter(e=>e.type==='butterfly'),later.air.filter(e=>e.type==='butterfly'));
    assert.equal(night.air.filter(e=>e.type==='butterfly').length,0);
    assert.equal(night.air.filter(e=>e.type==='firefly').length,8);
    assert.ok(day.effectNames.includes('butterfly-flight'));assert.ok(night.effectNames.includes('firefly-glow'));
  }
});
test('rain suppresses butterflies and gulls, reduces fireflies, and bends foliage further',()=>{
  const forest=FX.createScene('forest',fixture('forest')),coast=FX.createScene('coast',fixture('coast'));
  assert.equal(FX.sampleAmbient(forest,1,{rain:true}).air.filter(e=>e.type==='butterfly').length,0);
  assert.equal(FX.sampleAmbient(forest,1,{rain:true,night:true}).air.filter(e=>e.type==='firefly').length,4);
  assert.equal(FX.sampleAmbient(coast,1,{rain:true}).air.filter(e=>e.type==='gull').length,0);
  assert.notDeepEqual(FX.sampleAmbient(forest,1).ground,FX.sampleAmbient(forest,1,{rain:true}).ground);
});
test('region effects distinguish woodland, coast, village, and ruins',()=>{
  const names=Object.fromEntries(MAPS.map(map=>[map,FX.effectNames(FX.createScene(map,fixture(map)))]));
  assert.ok(names.forest.includes('falling-leaves'));assert.ok(!names.village.includes('falling-leaves'));
  assert.ok(names.coast.includes('gull-flight'));assert.ok(names.coast.includes('shore-waves'));
  assert.ok(names.village.includes('chimney-smoke'));assert.ok(names.village.includes('camp-embers'));
  assert.ok(names.ruins.includes('ruins-motes'));
  assert.ok(!names.ruins.includes('butterfly-flight'));assert.ok(!names.forest.includes('chimney-smoke'));
});
test('smoke originates from existing chimneys and respects completed building upgrades',()=>{
  const scene=FX.createScene('village',fixture('village'));
  assert.deepEqual(scene.chimneys[0],{x:314,y:200,upgrade:null});
  const homeOnly=FX.sampleAmbient(scene,0).air.filter(e=>e.type==='smoke');
  const completed=FX.sampleAmbient(scene,0,{upgrades:['workshop','kitchen']}).air.filter(e=>e.type==='smoke');
  assert.equal(homeOnly.length,8);assert.equal(completed.length,8,'cap stays eight puffs across all chimneys');
  assert.ok(homeOnly.every(e=>Math.abs(e.x-scene.chimneys[0].x)<21));
  assert.ok(completed.some(e=>e.x>1000),'completed kitchen emits smoke');
  const unbuilt=FX.createScene('village',{buildings:[fixture('village').buildings[1]]});
  assert.equal(FX.sampleAmbient(unbuilt,2).air.filter(e=>e.type==='smoke').length,0);
  assert.equal(FX.sampleAmbient(unbuilt,2,{upgrades:['workshop']}).air.filter(e=>e.type==='smoke').length,8);
});
test('activated shrines emit gently expanding ground rings; unactivated shrines do not',()=>{
  const scene=FX.createScene('ruins',fixture('ruins'));
  assert.equal(FX.sampleAmbient(scene,0).ground.filter(e=>e.type==='rune-ring').length,0);
  const a=FX.sampleAmbient(scene,0,{shrineActive:true}),b=FX.sampleAmbient(scene,1,{shrineActive:true});
  assert.equal(a.ground.filter(e=>e.type==='rune-ring').length,2);
  assert.notDeepEqual(a.ground.filter(e=>e.type==='rune-ring'),b.ground.filter(e=>e.type==='rune-ring'));
  assert.ok(a.effectNames.includes('shrine-resonance'));
});
test('reduced motion gives stable planted and water detail with no flying or drifting particles',()=>{
  for(const map of MAPS){
    const scene=FX.createScene(map,fixture(map)),opts={reducedMotion:true,shrineActive:true,night:true,upgrades:['workshop','kitchen']};
    const a=FX.sampleAmbient(scene,0,opts),b=FX.sampleAmbient(scene,100,opts);
    assert.deepEqual(a,b,map);assert.equal(a.air.length,0,map);
    assert.ok(a.ground.some(e=>e.type==='ripple'));assert.ok(a.ground.some(e=>e.type==='flower'));
    assert.ok(a.ground.filter(e=>e.type==='grass'||e.type==='flower').every(e=>e.sway===0));
  }
});
test('all combinations and extreme times produce finite bounded descriptors with modest counts',()=>{
  for(const map of MAPS)for(const night of [false,true])for(const rain of [false,true])for(const time of [0,1,3599,1e308,-50,NaN,Infinity]){
    const scene=FX.createScene(map,fixture(map)),sample=FX.sampleAmbient(scene,time,{night,rain,shrineActive:true,upgrades:['workshop','kitchen']});
    assert.ok(sample.ground.length<=84);assert.ok(sample.air.length<=21);
    for(const e of [...sample.ground,...sample.air]){
      assert.ok(e.x>=0&&e.x<=1600&&e.y>=0&&e.y<=1100,`${map}/${e.type}`);
      for(const [key,value] of Object.entries(e))if(typeof value==='number')assert.ok(Number.isFinite(value),`${map}/${e.type}/${key}`);
      if(e.alpha!==undefined)assert.ok(e.alpha>=0&&e.alpha<=1);
      if(e.width!==undefined)assert.ok(e.width>0);
    }
  }
});
test('ground and air render pixel rectangles and restore canvas alpha/style',()=>{
  for(const map of MAPS){
    const scene=FX.createScene(map,fixture(map)),{ctx,calls,stack}=canvasMock(),original=JSON.stringify(scene);
    FX.drawGround(ctx,scene,2,{shrineActive:true});
    FX.drawAir(ctx,scene,2,{night:true,upgrades:['workshop','kitchen']});
    assert.ok(calls.length>200,map);assert.equal(stack.length,0);assert.equal(ctx.globalAlpha,.47);assert.equal(ctx.fillStyle,'#abcdef');
    assert.equal(JSON.stringify(scene),original);
    for(const call of calls){
      for(const v of [call.x,call.y,call.w,call.h])assert.ok(Number.isInteger(v));
      assert.ok(call.w>0&&call.h>0);assert.ok(call.alpha>=0&&call.alpha<=1);assert.match(call.color,/^#[a-f0-9]{6}([a-f0-9]{2})?$/i);
    }
  }
});
test('offscreen effects are culled without moving their anchors or leaking canvas state',()=>{
  const scene=FX.createScene('forest',fixture('forest')),{ctx,calls}=canvasMock(),viewport={x:-10000,y:-10000,width:200,height:200};
  FX.drawGround(ctx,scene,4,{viewport});FX.drawAir(ctx,scene,4,{viewport});
  assert.equal(calls.length,0);assert.equal(ctx.globalAlpha,.47);
  FX.drawGround(ctx,scene,4);FX.drawAir(ctx,scene,4);assert.ok(calls.length>0);
});
test('all available map effects change their rendered pixels at different times',()=>{
  for(const map of MAPS){
    const scene=FX.createScene(map,fixture(map)),a=canvasMock(),b=canvasMock(),opts={shrineActive:true,upgrades:['workshop','kitchen']};
    FX.drawGround(a.ctx,scene,0,opts);FX.drawAir(a.ctx,scene,0,opts);
    FX.drawGround(b.ctx,scene,1,opts);FX.drawAir(b.ctx,scene,1,opts);
    assert.notDeepEqual(a.calls,b.calls,map);
  }
});
