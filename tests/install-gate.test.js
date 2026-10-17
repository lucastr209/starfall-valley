'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Gate=require('../public/js/install-gate.js');

test('mobile browser requires Home Screen launch; fullscreen cannot impersonate installation',()=>{
  for(const userAgent of ['Mozilla iPhone Safari','Mozilla Android Chrome','Mozilla iPad Safari']){
    assert.equal(Gate.policy({userAgent}).required,true);
    assert.equal(Gate.policy({userAgent,fullscreen:true}).required,true);
    assert.equal(Gate.policy({userAgent,standalone:true}).required,false);
  }
  assert.equal(Gate.policy({platform:'MacIntel',maxTouchPoints:5}).ios,true);
  assert.equal(Gate.policy({platform:'MacIntel',maxTouchPoints:5}).required,true);
  assert.equal(Gate.policy({userAgent:'Windows Chrome',maxTouchPoints:10}).required,false);
  assert.equal(Gate.policy({userAgent:'iPhone',legacyStandalone:true}).required,false);
});
test('QA bypass exists only on loopback, with a dedicated gate preview',()=>{
  assert.deepEqual(Gate.policy({hostname:'localhost',search:'?qa=1&scene=install'}),{required:true,ios:true});
  assert.deepEqual(Gate.policy({hostname:'localhost',search:'?qa=1&scene=install&device=android'}),{required:true,ios:false});
  assert.equal(Gate.policy({userAgent:'iPhone',hostname:'localhost',search:'?qa=1'}).required,false);
  assert.equal(Gate.policy({userAgent:'iPhone',hostname:'127.0.0.1',search:'?qa=1&scene=install'}).required,true);
  assert.equal(Gate.policy({userAgent:'iPhone',hostname:'starfall-valley.vercel.app',search:'?qa=1'}).required,true);
});
