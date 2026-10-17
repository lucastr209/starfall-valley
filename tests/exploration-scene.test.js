'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../public/js/data/game-data.js'),C=require('../public/js/core/game-core.js'),Scene=require('../public/js/world/exploration-scene.js');
test('all rooms provide reachable spawn, exit, residents and interactable points',()=>{
  for(const room of D.exploration.rooms){
    const scene=Scene.create(room,D);assert.equal(scene.id,room.id);
    assert.equal(Scene.blocked(scene,scene.spawn.x,scene.spawn.y,true),false,room.id);
    assert.equal(scene.objects.filter(o=>o.action==='exit').length,1);
    for(const actor of scene.residents)assert.equal(Scene.blocked(scene,actor.x,actor.y,true),false,`${room.id}:${actor.id}`);
    for(const object of scene.objects)assert.equal(Scene.blocked(scene,object.x,object.y,true),false,`${room.id}:${object.action}`);
    assert.equal(Scene.blocked(scene,0,0,true),true);assert.equal(Scene.blocked(scene,800,1000,true),true);
    assert.equal(Scene.blocked(scene,800,600,false),false);
    if(room.kind==='cave'){assert.equal(Scene.blocked(scene,800,440,false),true);assert.equal(Scene.blocked(scene,800,440,true),false);}
  }
});
test('interior renderer draws all rooms without changing progress or requiring ambient animation',()=>{
  const state=C.createState('Thử phòng',D),before=JSON.stringify(state),calls=[];
  const ctx={fillRect(...args){assert.ok(args.every(Number.isFinite));calls.push(args);},fillText(text,x,y){assert.equal(typeof text,'string');assert.ok(Number.isFinite(x)&&Number.isFinite(y));}};
  for(const room of D.exploration.rooms)Scene.draw(ctx,Scene.create(room,D),state);
  assert.ok(calls.length>100);assert.equal(JSON.stringify(state),before);
});
