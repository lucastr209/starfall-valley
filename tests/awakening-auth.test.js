'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('a pending token refresh cannot resurrect a logged out account',async()=>{
  const storage=new Map([['starfall-awakening-auth',JSON.stringify({access_token:'old',refresh_token:'old-refresh',expires_at:0})]]),elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',hidden:false,setAttribute(){},addEventListener(){},getContext(){return {};},replaceChildren(){}});return elements.get(id);};
  let resolveRefresh,started;const ready=new Promise(r=>{started=r;});
  const context={document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){}},location:{origin:'https://game.test',hostname:'game.test',search:''},matchMedia:()=>({matches:false}),sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{addEventListener(){}},URLSearchParams,URL,AbortSignal,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame(){},WebSocket:{OPEN:1},fetch:async url=>url.endsWith('/coop/config')?{ok:true,json:async()=>({v:1,qa:false,supabaseUrl:'https://auth.test',supabaseKey:'public'})}:new Promise(r=>{resolveRefresh=r;started();})};
  vm.runInNewContext(fs.readFileSync('public/js/ui/awakening.js','utf8'),context);
  await ready;element('logout').onclick();assert.equal(storage.get('starfall-awakening-auth'),undefined);
  resolveRefresh({ok:true,json:async()=>({access_token:'renewed-old',refresh_token:'renewed',expires_in:3600})});
  await new Promise(r=>setImmediate(r));assert.equal(storage.get('starfall-awakening-auth'),undefined);
});
