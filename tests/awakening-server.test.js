'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const WebSocket=require('ws');
const {createCoopServer}=require('../server/awakening/server.cjs');const {MemoryStore}=require('../server/awakening/store.cjs');
async function start(t,options={}){
  const store=new MemoryStore();const app=createCoopServer({store,verifyToken:async token=>{if(!/^[a-e]$/.test(token))throw new Error('Sai đăng nhập');return {id:token,name:'Bạn '+token};},...options});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
  return {...app,store,url:'http://127.0.0.1:'+app.server.address().port};
}
async function client(app,id,code){
  let latest;const ws=new WebSocket(app.url.replace('http:','ws:')+'/coop',{origin:app.url});const queue=[];ws.on('message',raw=>{const m=JSON.parse(raw);queue.push(m);if(m.type==='state')latest=m;});
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  const wait=async predicate=>{for(let i=0;i<200;i++){const at=queue.findIndex(predicate);if(at>=0)return queue.splice(at,1)[0];await new Promise(r=>setTimeout(r,10));}throw new Error('Timeout '+JSON.stringify(queue).slice(0,250));};
  ws.send(JSON.stringify({v:1,type:'hello',token:id,code}));
  return {ws,wait,latest:()=>latest,send:m=>ws.send(JSON.stringify({v:1,type:'command',...m}))};
}
test('real sockets authenticate, isolate private rooms, reject fifth member and guest travel',async t=>{
  const app=await start(t);const a=await client(app,'a');const s=await a.wait(m=>m.type==='state');
  const clients=[a];for(const id of ['b','c','d']){const b=await client(app,id,s.code);clients.push(b);await b.wait(m=>m.type==='state'&&m.players.length===clients.length);}
  const e=await client(app,'e',s.code);await e.wait(m=>m.type==='error'&&/đầy/.test(m.message));e.ws.close();
  clients[1].send({action:'travel',chapter:0});await clients[1].wait(m=>m.type==='error'&&/Chủ phòng/.test(m.message));
  a.send({action:'travel',chapter:0});const snapshot=await a.wait(m=>m.type==='state'&&m.chapter===0);assert.equal(snapshot.encounterSize,4);
  const forged=await client(app,'forged');await forged.wait(m=>m.type==='error');forged.ws.close();
  for(const c of clients)c.ws.close();
});
test('real reconnect replaces socket, resumes host pause and keeps one room per account',async t=>{
  const app=await start(t);const a=await client(app,'a');const initial=await a.wait(m=>m.type==='state');
  const b=await client(app,'b',initial.code);await b.wait(m=>m.type==='state');a.ws.close();
  await b.wait(m=>m.type==='state'&&m.paused);
  const again=await client(app,'a',initial.code);const state=await again.wait(m=>m.type==='state'&&!m.paused);assert.equal(state.code,initial.code);
  const dup=await client(app,'b');await dup.wait(m=>m.type==='error'&&/phòng/.test(m.message));dup.ws.close();again.ws.close();b.ws.close();
});
test('persistent reward survives server restart and cannot be doubled; save errors fail closed',async t=>{
  const app=await start(t);const a=await client(app,'a');const first=await a.wait(m=>m.type==='state');const room=app.rooms.get(first.code);
  a.send({action:'travel',chapter:0});await a.wait(m=>m.type==='state'&&m.chapter===0);
  room.roomIndex=4;room.spawn();for(const m of room.mobs)m.hp=0;
  await a.wait(m=>m.type==='state'&&m.finished&&m.character.coins===100);
  assert.equal((await app.store.load('a')).character.coins,100);
  a.ws.close();await app.close();
  const second=await start(t,{store:app.store});const b=await client(second,'a');const state=await b.wait(m=>m.type==='state');
  assert.equal(state.character.coins,100);assert.deepEqual(state.world.cleared,['deepwood']);b.ws.close();
});
test('reject unknown origins and unversioned packets, QA is disabled by default',async t=>{
  const app=await start(t);
  assert.equal((await fetch(app.url+'/coop/config')).status,200);
  const config=await (await fetch(app.url+'/coop/config')).json();assert.equal(config.qa,false);assert.equal(config.serviceKey,undefined);
  const ws=new WebSocket(app.url.replace('http:','ws:')+'/coop',{origin:'https://evil.example'});
  const status=await new Promise(r=>{ws.on('unexpected-response',(_,res)=>{res.resume();r(res.statusCode);});ws.on('error',()=>{});});assert.equal(status,403);ws.terminate();
  const c=await client(app,'a');await c.wait(m=>m.type==='state');c.ws.send(JSON.stringify({type:'command',action:'reward'}));await c.wait(m=>m.type==='error'&&/phiên bản/.test(m.message));c.ws.close();
});
test('a join finishing after host closes the room cannot strand the guest membership',async t=>{
  const app=await start(t);const a=await client(app,'a');const initial=await a.wait(m=>m.type==='state');
  let release,waiting;const gate=new Promise(r=>{waiting=r;});
  app.store.session=async room=>{if(room.players.size===2&&!room.closed){waiting();await new Promise(r=>{release=r;});}};
  const b=await client(app,'b',initial.code);await gate;a.send({action:'leave'});await a.wait(m=>m.type==='closed');release();
  const response=await b.wait(m=>m.type==='error'||m.type==='state');assert.equal(response.type,'error');b.ws.close();
  const fresh=await client(app,'b');await fresh.wait(m=>m.type==='state');fresh.ws.close();
});
test('database failures close the room before any uncommitted character state reaches clients',async t=>{
  const app=await start(t);const a=await client(app,'a');await a.wait(m=>m.type==='state');
  app.store.commit=async()=>{throw new Error('database offline');};a.send({action:'weapon',weapon:'bow'});
  await a.wait(m=>m.type==='closed'&&/Không lưu/.test(m.message));assert.equal((await app.store.load('a')).character.weapon,'sword');
});
test('four real WebSocket players clear all five rooms and reload personal rewards', {timeout:60000},async t=>{
  const D=require('../public/js/data/awakening-data.js'),{route}=require('./helpers/awakening-pilot.cjs');
  const app=await start(t),clients=[await client(app,'a')],first=await clients[0].wait(m=>m.type==='state');
  for(const id of ['b','c','d']){const c=await client(app,id,first.code);clients.push(c);await c.wait(m=>m.type==='state');}
  clients[0].send({action:'travel',chapter:0});await clients[0].wait(m=>m.type==='state'&&m.chapter===0);
  let frame=0;const visited=new Set(),seq=[0,0,0,0];
  const timer=setInterval(()=>{
    frame++;
    for(let i=0;i<4;i++){
      const c=clients[i],s=c.latest();if(!s||s.chapter<0||s.finished)continue;visited.add(s.room);
      const p=s.players.find(p=>p.id===s.you);if(p.health<=0)continue;
      const mobs=s.mobs.filter(m=>m.hp>0),room={blocked:(x,y)=>x<24||y<35||x>776||y>536||D.obstacles[s.room].some(o=>x>o.x-14&&x<o.x+o.w+14&&y>o.y-14&&y<o.y+o.h+14)};
      let target={x:735,y:280};if(s.room===1&&!s.puzzleSolved)target=D.switches[i===0?0:1];else if(mobs.length)target=mobs.reduce((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)<Math.hypot(p.x-b.x,p.y-b.y)?a:b);
      const point=route(room,p,target),dx=point.x-p.x,dy=point.y-p.y,length=Math.hypot(dx,dy)||1;
      const direction=Math.abs(target.x-p.x)>=Math.abs(target.y-p.y)?(target.x>p.x?'right':'left'):(target.y>p.y?'down':'up');
      c.send({action:'input',seq:++seq[i],x:length<10?0:dx/length,y:length<10?0:dy/length,direction,running:true});
      if(mobs.length&&frame%5===0)c.send({action:'attack'});
      if(s.room===1&&!s.puzzleSolved&&Math.hypot(p.x-target.x,p.y-target.y)<60)c.send({action:'interact'});
      if(i===0&&!mobs.length&&(s.room!==1||s.puzzleSolved)&&s.room<4&&p.x>680)c.send({action:'advance'});
    }
  },100);t.after(()=>clearInterval(timer));
  const end=Date.now()+50000;
  while(Date.now()<end&&!clients.every(c=>c.latest()?.finished))await new Promise(r=>setTimeout(r,100));
  clearInterval(timer);
  assert.ok(clients.every(c=>c.latest()?.finished),'four players must finish without fixture victories: '+JSON.stringify(clients[0].latest()));assert.equal(visited.size,5);
  for(const id of ['a','b','c','d']){const saved=await app.store.load(id);assert.equal(saved.character.coins,100);assert.deepEqual(saved.character.victories,['deepwood']);if(id!=='a')assert.deepEqual(saved.world.cleared,[]);}
  for(const c of clients)c.ws.close();
});
