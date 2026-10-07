'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../game-data.js');
const AI = require('../npc-ai.js');

const boundary = (_map,x,y) => x<25||x>1575||y<40||y>1075;
const distantPlayer = { x:1500, y:1050 };
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function advance(npcs,map,seconds,isBlocked=boundary,player=distantPlayer,observe) {
  for(let i=0;i<Math.ceil(seconds*60);i++){
    AI.updateNPCs(npcs,1/60,{map,player,isBlocked});
    if(observe)observe(npcs);
  }
}
function walker() {
  const npc=AI.createNPCs([{id:'test',map:'village',x:200,y:550,name:'Test'}])[0];
  npc.patrol=[{x:200,y:550},{x:520,y:550},{x:200,y:800}];
  npc._wait=0;
  return npc;
}

test('creates independent runtime residents without mutating the catalogue',()=>{
  const original=JSON.stringify(D.npcs),a=AI.createNPCs(D.npcs),b=AI.createNPCs(D.npcs);
  assert.equal(a.length,11);assert.equal(new Set(a.map(n=>n.id)).size,11);
  a[0].x+=10;a[0].dialogue.push('test');a[0].patrol[0].x+=20;
  assert.equal(JSON.stringify(D.npcs),original);assert.equal(b[0].x,D.npcs[0].x);
  assert.notEqual(a[0].dialogue,b[0].dialogue);assert.notEqual(a[0].patrol,b[0].patrol);
});
test('all eleven residents have named routes spanning at least200px',()=>{
  for(const npc of AI.createNPCs(D.npcs)){
    assert.ok(npc.patrolName.length>10,npc.id);assert.ok(npc.patrol.length>=4,npc.id);
    assert.ok(npc.patrol.some(p=>dist(p,npc)>=200),npc.id);
    assert.equal(npc.homeX,D.npcs.find(n=>n.id===npc.id).x);
    assert.equal(npc.homeY,D.npcs.find(n=>n.id===npc.id).y);
  }
});
test('initial pauses and walking speeds are deterministic and varied',()=>{
  const a=AI.createNPCs(D.npcs),b=AI.createNPCs(D.npcs);
  assert.deepEqual(a,b);assert.ok(new Set(a.map(n=>n.speed)).size>1);
  for(const npc of a){assert.ok(npc._wait>=.4&&npc._wait<=1.2);assert.ok(npc.speed>=76&&npc.speed<=96);}
  advance(a,'village',15);advance(b,'village',15);assert.deepEqual(a,b);
});
test('runtime animation starts looking down without counting any walked distance',()=>{
  for(const npc of AI.createNPCs(D.npcs)){
    assert.equal(npc.direction,'down');assert.equal(npc.facing,1);
    assert.equal(npc.walkDistance,0);assert.equal(npc.running,false);assert.equal(npc.moving,false);
  }
});
test('successful walking faces all four directions and counts exact travelled distance',()=>{
  for(const [direction,dx,dy,facing] of [['right',100,0,1],['left',-100,0,-1],['down',0,100,1],['up',0,-100,1]]){
    const npc=walker();npc.x=400;npc.y=550;npc._checkedStart=true;npc._path=[{x:npc.x+dx,y:npc.y+dy}];
    const before={x:npc.x,y:npc.y};
    AI.updateNPCs([npc],.25,{map:'village',player:distantPlayer,isBlocked:boundary});
    assert.equal(npc.direction,direction);assert.equal(npc.facing,facing);assert.equal(npc.moving,true);
    assert.ok(Math.abs(npc.walkDistance-npc.speed*.25)<1e-8,direction);
    assert.ok(Math.abs(npc.walkDistance-dist(npc,before))<1e-8,direction);
    assert.equal(npc.running,false);
  }
});
test('diagonal steps use the dominant travel axis while preserving horizontal legacy facing',()=>{
  for(const [dx,dy,direction,facing] of [[100,20,'right',1],[-100,20,'left',-1],[20,100,'down',1],[-20,-100,'up',-1]]){
    const npc=walker();npc.x=400;npc.y=550;npc._checkedStart=true;npc._path=[{x:npc.x+dx,y:npc.y+dy}];
    AI.updateNPCs([npc],.25,{map:'village',player:distantPlayer,isBlocked:boundary});
    assert.equal(npc.direction,direction);assert.equal(npc.facing,facing);
  }
});
test('residents turn toward a nearby player above, below, left or right without walking',()=>{
  for(const [dx,dy,direction,facing] of [[0,-40,'up',1],[0,40,'down',1],[-40,0,'left',-1],[40,0,'right',1]]){
    const npc=walker();npc.walkDistance=12;const before={x:npc.x,y:npc.y,wait:npc._wait};
    advance([npc],'village',3,boundary,{x:npc.x+dx,y:npc.y+dy,map:'village'});
    assert.equal(npc.direction,direction);assert.equal(npc.facing,facing);assert.equal(npc.moving,false);
    assert.equal(npc.x,before.x);assert.equal(npc.y,before.y);assert.equal(npc._wait,before.wait);
    assert.equal(npc.walkDistance,12);
  }
});
test('nearby diagonal players use the dominant axis and an overlapping player preserves orientation',()=>{
  const npc=walker();
  AI.updateNPCs([npc],.1,{map:'village',player:{x:npc.x-20,y:npc.y-50},isBlocked:boundary});
  assert.equal(npc.direction,'up');assert.equal(npc.facing,-1);
  AI.updateNPCs([npc],.1,{map:'village',player:{x:npc.x+1,y:npc.y+1},isBlocked:boundary});
  assert.equal(npc.direction,'up');assert.equal(npc.facing,-1);assert.equal(npc.walkDistance,0);
});
test('arrival pauses stay between .8 and 1.8 seconds at the quicker pace',()=>{
  const npc=walker();npc._checkedStart=true;npc._path=[{x:npc.x+8,y:npc.y}];
  AI.updateNPCs([npc],.25,{map:'village',player:distantPlayer,isBlocked:boundary});
  assert.ok(npc._wait>=.8&&npc._wait<=1.8);assert.ok(Math.abs(npc.walkDistance-8)<1e-8);
  const wait=npc._wait,position={x:npc.x,y:npc.y};
  AI.updateNPCs([npc],.1,{map:'village',player:distantPlayer,isBlocked:boundary});
  assert.equal(npc.moving,false);assert.equal(npc.walkDistance,8);assert.deepEqual({x:npc.x,y:npc.y},position);
  assert.ok(Math.abs(npc._wait-(wait-.1))<1e-8);
});
test('every resident leaves their initial pause promptly and walks at least 80 pixels in three seconds',()=>{
  const npcs=AI.createNPCs(D.npcs);
  for(const map of D.regions.map(r=>r.id))advance(npcs,map,3);
  for(const npc of npcs)assert.ok(npc.walkDistance>=80,`${npc.id}: ${npc.walkDistance}`);
});
test('walk distance excludes initial recovery, stopped frames, blocked terrain and inactive maps',()=>{
  const npc=walker();npc._wait=1;
  const obstacle=(map,x,y)=>boundary(map,x,y)||(x>180&&x<225&&y>530&&y<575);
  AI.updateNPCs([npc],.1,{map:'village',player:distantPlayer,isBlocked:obstacle});
  assert.equal(npc.walkDistance,0);assert.equal(npc.moving,false);
  advance([npc],'village',3,()=>true);assert.equal(npc.walkDistance,0);
  const before=structuredClone(npc);
  advance([npc],'forest',3);
  assert.deepEqual(npc,before);
});
test('a capped frame spike counts at most half a second of actual walking',()=>{
  const npc=walker();npc._checkedStart=true;npc._path=[{x:800,y:550}];
  AI.updateNPCs([npc],100,{map:'village',player:distantPlayer,isBlocked:boundary});
  assert.ok(Math.abs(npc.walkDistance-npc.speed*.5)<1e-8);assert.equal(npc.direction,'right');
  assert.equal(npc.moving,true);
});
test('quicker movement still stops before a thin obstruction during a frame spike',()=>{
  const npc=walker();npc._checkedStart=true;npc._path=[{x:520,y:550}];
  const before={x:npc.x,y:npc.y},wall=(map,x,y)=>boundary(map,x,y)||(x>219&&x<221&&y>450&&y<650);
  AI.updateNPCs([npc],100,{map:'village',player:distantPlayer,isBlocked:wall});
  assert.ok(npc.x<215);assert.equal(wall(npc.map,npc.x,npc.y),false);assert.equal(npc._path.length,0);
  assert.ok(npc.walkDistance<=npc.speed*.5);assert.ok(Math.abs(npc.walkDistance-dist(npc,before))<1e-8);
  const walked=npc.walkDistance;
  AI.updateNPCs([npc],.1,{map:'village',player:distantPlayer,isBlocked:wall});
  assert.equal(npc.walkDistance,walked);assert.equal(npc.moving,false);
});
test('every resident walks a meaningful distance on their own map',()=>{
  const npcs=AI.createNPCs(D.npcs),furthest=new Map(npcs.map(n=>[n.id,0])),walked=new Set();
  for(const map of D.regions.map(r=>r.id))advance(npcs,map,45,boundary,distantPlayer,residents=>{
    for(const n of residents.filter(n=>n.map===map)){
      furthest.set(n.id,Math.max(furthest.get(n.id),dist(n,{x:n.homeX,y:n.homeY})));
      if(n.moving)walked.add(n.id);
    }
  });
  for(const npc of npcs){assert.ok(walked.has(npc.id),npc.id);assert.ok(furthest.get(npc.id)>180,`${npc.id}: ${furthest.get(npc.id)}`);}
});
test('residents wait briefly after arriving and continue to another destination',()=>{
  const npc=walker();let arrived=false,paused=false,resumed=false;
  advance([npc],'village',36,boundary,distantPlayer,()=>{
    if(npc.x>490)arrived=true;
    if(arrived&&!npc.moving&&npc._wait>0)paused=true;
    if(paused&&npc.moving&&npc.y>580)resumed=true;
  });
  assert.ok(arrived);assert.ok(paused);assert.ok(resumed);
});
test('only the current map advances and map changes preserve positions',()=>{
  const npcs=AI.createNPCs(D.npcs),sen=npcs.find(n=>n.id==='sen');const original={x:sen.x,y:sen.y,wait:sen._wait};
  advance(npcs,'village',12);assert.deepEqual({x:sen.x,y:sen.y,wait:sen._wait},original);
  advance(npcs,'forest',12);assert.ok(dist(sen,original)>100);
  const away={x:sen.x,y:sen.y,wait:sen._wait};advance(npcs,'coast',10);
  assert.deepEqual({x:sen.x,y:sen.y,wait:sen._wait},away);advance(npcs,'forest',6);assert.ok(dist(sen,away)>0);
});
test('nearby residents stop immediately, face the player and resume after they leave',()=>{
  const npc=walker();advance([npc],'village',2);assert.ok(npc.moving);
  const position={x:npc.x,y:npc.y},player={x:npc.x-40,y:npc.y,map:'village'},wait=npc._wait;
  advance([npc],'village',5,boundary,player);assert.equal(npc.moving,false);assert.equal(npc.facing,-1);
  assert.equal(npc.x,position.x);assert.equal(npc.y,position.y);assert.equal(npc._wait,wait);
  advance([npc],'village',2);assert.ok(dist(npc,position)>40);assert.equal(npc.facing,1);
});
test('player proximity also pauses the initial wait timer',()=>{
  const npc=AI.createNPCs(D.npcs)[0],wait=npc._wait;
  advance([npc],'village',10,boundary,{x:npc.x+30,y:npc.y});assert.equal(npc._wait,wait);
  advance([npc],'village',6);assert.ok(npc.moving);
});
test('does not walk into a player who is standing ahead on the path',()=>{
  const npc=walker(),player={x:400,y:550,map:'village'};
  advance([npc],'village',20,boundary,player,()=>assert.ok(dist(npc,player)>=AI.TALK_DISTANCE));
  assert.ok(npc.x>290&&npc.x<305);assert.equal(npc.moving,false);
  advance([npc],'village',3);assert.ok(npc.x>350);
});
test('an unrelated-map player does not stop residents',()=>{
  const npc=walker();advance([npc],'village',3,boundary,{x:npc.x,y:npc.y,map:'forest'});assert.ok(npc.x>250);
});
test('pathfinding walks around a building footprint without clipping it',()=>{
  const npc=walker(),obstacle=(map,x,y)=>boundary(map,x,y)||(x>300&&x<340&&y>430&&y<670);let crossed=false;
  advance([npc],'village',30,obstacle,distantPlayer,()=>{
    assert.equal(obstacle(npc.map,npc.x,npc.y),false);
    if(npc.x>340)crossed=true;
  });
  assert.ok(crossed);assert.ok(npc.x>400||npc.y>650);
});
test('pathfinding detects a thin wall between open grid centers',()=>{
  const npc=walker(),obstacle=(map,x,y)=>boundary(map,x,y)||(x>300&&x<303&&y>460&&y<640);let around=false;
  advance([npc],'village',25,obstacle,distantPlayer,()=>{
    assert.equal(obstacle(npc.map,npc.x,npc.y),false);
    if(npc.x>303)around=true;
  });assert.ok(around);
});
test('chooses a nearby free stop when the intended destination is occupied',()=>{
  const npc=walker(),obstacle=(map,x,y)=>boundary(map,x,y)||(x>490&&x<550&&y>520&&y<580);let approached=false;
  advance([npc],'village',25,obstacle,distantPlayer,()=>{
    assert.equal(obstacle(npc.map,npc.x,npc.y),false);
    if(dist(npc,{x:520,y:550})<80)approached=true;
  });assert.ok(approached);
});
test('skips an unreachable patrol stop and keeps walking elsewhere',()=>{
  const npc=walker();npc.patrol=[{x:200,y:550},{x:520,y:550},{x:200,y:800}];
  const obstacle=(map,x,y)=>boundary(map,x,y)||(x>350&&x<700&&y>300&&y<750);
  advance([npc],'village',12,obstacle);assert.ok(npc.y>700);assert.equal(obstacle(npc.map,npc.x,npc.y),false);
});
test('replans after a new obstruction blocks the current leg',()=>{
  const npc=walker();advance([npc],'village',1);const before={x:npc.x,y:npc.y},wallX=npc.x+12;
  const obstacle=(map,x,y)=>boundary(map,x,y)||(x>wallX&&x<wallX+35&&y>450&&y<650);
  let walkedAgain=false;
  advance([npc],'village',22,obstacle,distantPlayer,()=>{assert.equal(obstacle(npc.map,npc.x,npc.y),false);if(dist(npc,before)>120)walkedAgain=true;});
  assert.ok(walkedAgain);
});
test('recovers a blocked start to a safe nearby position',()=>{
  const npc=walker(),obstacle=(map,x,y)=>boundary(map,x,y)||(x>180&&x<225&&y>530&&y<575);
  AI.updateNPCs([npc],1/60,{map:'village',player:distantPlayer,isBlocked:obstacle});
  assert.equal(obstacle(npc.map,npc.x,npc.y),false);assert.ok(dist(npc,{x:200,y:550})<80);
  let walked=false;
  advance([npc],'village',6,obstacle,distantPlayer,()=>{if(npc.moving)walked=true;});
  assert.ok(walked);assert.ok(npc.walkDistance>150);
});
test('fully blocked terrain leaves a finite bounded resident instead of inventing movement',()=>{
  const npc=walker();advance([npc],'village',5,()=>true);assert.equal(npc.moving,false);
  assert.equal(npc.x,200);assert.equal(npc.y,550);
});
test('frame spikes cannot teleport residents or tunnel through obstacles',()=>{
  const npc=walker(),before={x:npc.x,y:npc.y};
  AI.updateNPCs([npc],100,{map:'village',player:distantPlayer,isBlocked:boundary});
  assert.ok(dist(npc,before)<=npc.speed*.5+.001);assert.ok(npc.moving);
});
test('zero, negative and non-finite time do not change the runtime',()=>{
  const npcs=AI.createNPCs(D.npcs),before=structuredClone(npcs);
  for(const dt of [0,-1,NaN,Infinity])AI.updateNPCs(npcs,dt,{map:'village',player:distantPlayer,isBlocked:boundary});
  assert.deepEqual(npcs,before);
});
test('unknown residents get a bounded fallback patrol and invalid coordinates are repaired',()=>{
  const npc=AI.createNPCs([{id:'visitor',map:'village',x:NaN,y:Infinity}])[0];
  assert.equal(npc.x,800);assert.equal(npc.y,550);assert.equal(npc.patrol.length,4);
  advance([npc],'village',12);assert.ok(npc.moving);assert.ok(Number.isFinite(npc.x)&&Number.isFinite(npc.y));
});
test('long deterministic walks stay in bounds and never touch scattered obstacles',()=>{
  const npcs=AI.createNPCs(D.npcs);let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const trunks=Array.from({length:90},()=>({x:50+random()*1500,y:65+random()*970})).filter(p=>Math.abs(p.y-550)>90&&Math.abs(p.x-800)>90);
  const obstacle=(map,x,y)=>boundary(map,x,y)||(x>1110&&x<1490&&y>625&&y<905)||trunks.some(p=>Math.abs(x-p.x)<13&&Math.abs(y-p.y)<11);
  for(const map of D.regions.map(r=>r.id))advance(npcs,map,30,obstacle,distantPlayer,()=>{
    for(const n of npcs.filter(n=>n.map===map)){assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));assert.equal(obstacle(map,n.x,n.y),false,n.id);assert.ok(n.x>=25&&n.x<=1575&&n.y>=40&&n.y<=1075,n.id);}
  });
});
