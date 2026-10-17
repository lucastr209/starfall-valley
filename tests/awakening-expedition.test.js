'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {Room}=require('../server/awakening/room.cjs');const {MemoryStore}=require('../server/awakening/store.cjs');
const D=require('../public/js/data/awakening-data.js');const {route}=require('./helpers/awakening-pilot.cjs');

// Người chơi tự động chỉ dùng lệnh thật; không sửa máu, vị trí, mob hoặc chứng cứ thắng.
for(const count of [1,2,4])test(`${count} players finish all fifteen rooms through real input/combat and persist personal loot`,async()=>{
  const store=new MemoryStore(),a=await store.load('p0'),r=new Room({host:{id:'p0',name:'A'},character:a.character,world:a.world,code:'ABC123'});
  for(let i=1;i<count;i++){const save=await store.load('p'+i);r.join({id:'p'+i,name:'B'+i},save.character);}
  let ticks=0,seq=0,visited=new Set();
  for(let chapter=0;chapter<3;chapter++){
    r.command('p0',{action:'travel',chapter});
    for(let step=0;step<12000&&!r.finished;step++){
      assert.equal(r.chapterIndex,chapter,'party wiped');visited.add(chapter+':'+r.roomIndex);
      const mobs=r.mobs.filter(m=>m.hp>0),members=[...r.players.values()];
      for(let i=0;i<members.length;i++){
        const p=members[i];if(p.health<=0)continue;
        let target={x:735,y:280};
        if(r.roomIndex===1&&!r.puzzleSolved)target=D.switches[i===0?0:1];
        else if(mobs.length)target=mobs.reduce((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)<Math.hypot(p.x-b.x,p.y-b.y)?a:b);
        const point=route(r,p,target),dx=point.x-p.x,dy=point.y-p.y,near=Math.hypot(dx,dy)<10;
        const facing=Math.abs(target.x-p.x)>=Math.abs(target.y-p.y)?(target.x>p.x?'right':'left'):(target.y>p.y?'down':'up');
        const length=Math.hypot(dx,dy)||1;
        r.command(p.id,{action:'input',seq:++seq,x:near?0:dx/length,y:near?0:dy/length,direction:facing,running:true});
        if(mobs.length&&p.cooldown<=0&&p.stamina>=4)r.command(p.id,{action:'attack'});
        if(r.roomIndex===1&&!r.puzzleSolved&&Math.hypot(p.x-target.x,p.y-target.y)<60)r.command(p.id,{action:'interact'});
      }
      const host=r.players.get('p0');if(!mobs.length&&(r.roomIndex!==1||r.puzzleSolved)&&r.roomIndex<4&&host.x>680)r.command('p0',{action:'advance'});
      r.tick(.05,++ticks*50);
      if(r.dirty)r.saved(await store.commit(r.durable()));
    }
    assert.equal(r.finished,true,'boss must be defeated by server combat: '+JSON.stringify({chapter:r.chapterIndex,room:r.roomIndex,puzzle:r.puzzleSolved,players:[...r.players.values()].map(p=>({x:p.x,y:p.y,hp:p.health})),mobs:r.mobs}));r.command('p0',{action:'camp'});
    r.command('p0',{action:'contribute',amount:8});r.command('p0',{action:'build'});r.saved(await store.commit(r.durable()));
  }
  assert.equal(visited.size,15);assert.equal(r.world.buildings.length,3);
  for(let i=0;i<count;i++){const save=await store.load('p'+i);assert.equal(save.character.coins,300);assert.equal(save.character.victories.length,3);if(i)assert.deepEqual(save.world.cleared,[]);}
});
