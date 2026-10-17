'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {CLIENT_FILES,securityHeaders,coopEndpoint}=require('../config/deployment.cjs');const {build}=require('../scripts/build.cjs');
test('co-op page and modules are included in source server and versioned safe static build',()=>{
  for(const name of ['awakening.html','css/awakening.css','js/data/awakening-data.js','js/ui/awakening.js'])assert.ok(CLIENT_FILES.includes(name),name);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'awakening-build-'));
  try{
    build({outputRoot:temp,coopUrl:'https://coop.example.com'});
    const html=fs.readFileSync(path.join(temp,'dist/awakening.html'),'utf8');assert.match(html,/awakening\.js\?v=[a-f0-9]{12}/);
    const config=fs.readFileSync(path.join(temp,'dist/js/client-config.js'),'utf8');assert.match(config,/https:\/\/coop.example.com/);assert.doesNotMatch(config,/service_role/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('co-op endpoint validates origin and CSP permits only configured backend and Supabase auth',()=>{
  assert.equal(coopEndpoint('https://coop.example.com'),'https://coop.example.com');
  for(const url of ['http://evil.example','https://user:pass@example.com','https://example.com/?token=secret','javascript:alert(1)'])assert.throws(()=>coopEndpoint(url));
  const policy=securityHeaders('','https://coop.example.com')['Content-Security-Policy'];
  assert.match(policy,/https:\/\/coop.example.com/);assert.match(policy,/wss:\/\/coop.example.com/);assert.match(policy,/https:\/\/\*\.supabase.co/);
});
test('client separates Legacy storage, uses PKCE and never sends authoritative damage or loot',()=>{
  const js=fs.readFileSync('public/js/ui/awakening.js','utf8');new Function(js);
  assert.doesNotMatch(js,/starfall-valley-save-v1|giaoxu-tycoon-save/);
  assert.match(js,/code_challenge/);assert.match(js,/code_verifier/);assert.match(js,/refresh_token/);
  assert.doesNotMatch(js,/action:\s*['"](?:reward|damage|import)['"]/);
});
test('release configuration preserves Legacy routing and pins backend CSP without editing source config',()=>{
  const {configure}=require('../scripts/configure-coop.cjs');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'awakening-release-'));
  try{
    const source=fs.readFileSync('vercel.json','utf8');fs.writeFileSync(path.join(temp,'vercel.json'),source);
    const result=JSON.parse(fs.readFileSync(configure({root:temp,endpoint:'https://coop.example.com'}),'utf8'));
    assert.deepEqual(result.rewrites,JSON.parse(source).rewrites);
    assert.match(result.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value,/wss:\/\/coop.example.com/);
    assert.equal(fs.readFileSync(path.join(temp,'vercel.json'),'utf8'),source);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
