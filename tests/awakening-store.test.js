'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MemoryStore,SupabaseStore}=require('../server/awakening/store.cjs');
test('atomic commits update world and every character, retries grant nothing twice',async()=>{
  const s=new MemoryStore();const a=await s.load('a'),b=await s.load('b');
  a.world.cleared=['deepwood'];a.character.coins=100;b.character.coins=100;
  const payload={eventId:'event-1',world:a.world,characters:[a.character,b.character]};
  const result=await s.commit(payload);assert.equal(result.world.revision,1);
  await s.commit(payload);assert.equal((await s.load('b')).character.coins,100);
  assert.deepEqual((await s.load('b')).world.cleared,[]);
});
test('stale revisions fail the whole transaction and previous saves remain intact',async()=>{
  const s=new MemoryStore();const a=await s.load('a'),b=await s.load('b');
  await s.commit({eventId:'first',world:b.world,characters:[b.character]});
  a.world.stock=50;
  await assert.rejects(s.commit({eventId:'stale',world:a.world,characters:[a.character,b.character]}),/xung đột/);
  assert.equal((await s.load('a')).world.stock,0);
  assert.equal((await s.load('a')).character.revision,0);
});
test('Supabase verification rejects forged users, expired tokens and malformed configuration',async()=>{
  assert.throws(()=>new SupabaseStore({url:'http://example.com',key:'secret',anonKey:'public'}),/HTTPS/);
  const s=new SupabaseStore({url:'https://example.supabase.co',key:'secret',anonKey:'public',fetch:async()=>new Response('{}',{status:401})});
  await assert.rejects(s.verifyToken('forged'),/đăng nhập/);
});
