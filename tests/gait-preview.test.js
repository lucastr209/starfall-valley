'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const project=path.join(__dirname,'..');
const output=execFileSync(process.execPath,[path.join(__dirname,'render-gait.cjs')],{encoding:'utf8'});
const html=fs.readFileSync(path.join(project,'test-artifacts/handheld-gait-preview.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(s=>s[1]);
function preview(){
  let raf;const draws=[],controls=new Map();
  for(const id of ['pace','status','moving','pause','reduced'])controls.set(id,{value:id==='pace'?'walk':'',listeners:{},attributes:{},addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(k,v){this.attributes[k]=v;}});
  const stack=[],ctx={fillStyle:'#000000',globalAlpha:1,save(){stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha});},restore(){assert.ok(stack.length);Object.assign(this,stack.pop());},translate(){},scale(){},fillRect(){},fillText(){}};
  controls.set('sheet',{width:960,height:520,getContext:()=>ctx});
  const scope={document:{getElementById:id=>{assert.ok(controls.has(id));return controls.get(id);}},requestAnimationFrame:fn=>raf=fn};
  Object.defineProperty(scope,'localStorage',{get(){throw new Error('Preview must not access any save');}});
  vm.createContext(scope);vm.runInContext(scripts[0],scope);
  const renderer=scope.StardropActors;scope.StardropActors={...renderer,draw(c,o){draws.push({...o});return renderer.draw(c,o);}};
  vm.runInContext(scripts[1],scope);
  return {controls,ctx,tick(stamp){draws.length=0;raf(stamp);assert.equal(stack.length,0);return draws.slice();},click(id){controls.get(id).listeners.click();},state(){return JSON.parse(vm.runInContext('JSON.stringify({phases,motionWeight,runWeight,time,moving,paused,reduced})',scope));}};
}
test('exported gait preview is self contained, parses, and renders every original character in four directions without save access',()=>{
  assert.match(output,/12 characters; embedded syntax PASS/);assert.equal(scripts.length,2);
  assert.doesNotMatch(html,/<script\s+src=|<link\s|https?:\/\//i);
  const p=preview(),draws=p.tick(1000);assert.equal(draws.length,48);
  assert.equal(new Set(draws.map(o=>o.id)).size,12);
  for(const id of new Set(draws.map(o=>o.id)))assert.deepEqual(draws.filter(o=>o.id===id).map(o=>o.direction),['down','up','left','right']);
  assert.equal(p.ctx.imageSmoothingEnabled,false);
});
test('preview controls preserve phase across walk/run, freeze stopped travel and settle with the game timing',()=>{
  const p=preview();p.tick(1000);p.tick(1016);const before=p.state();
  p.controls.get('pace').value='run';p.tick(1032);let state=p.state();
  assert.ok(Math.abs(state.phases[0]-(before.phases[0]+297*.016/96))<1e-9);assert.ok(state.runWeight>0&&state.runWeight<1);
  p.click('moving');const phase=state.phases;p.tick(1082);state=p.state();assert.deepEqual(state.phases,phase);assert.ok(state.motionWeight>0&&state.motionWeight<1);
  p.tick(1132);p.tick(1182);assert.equal(p.state().motionWeight,0);assert.equal(p.state().runWeight,0);assert.equal(p.controls.get('moving').attributes['aria-pressed'],'false');
  p.click('moving');p.tick(1198);assert.ok(p.state().motionWeight>0&&p.state().motionWeight<1);
});
test('preview pause and reduced motion freeze decoration while controls remain reversible',()=>{
  const p=preview();p.tick(1000);p.tick(1016);p.click('pause');const before=p.state();p.tick(1032);
  assert.deepEqual(p.state(),before);p.click('pause');p.tick(1048);assert.ok(p.state().time>before.time);
  p.click('reduced');const phases=p.state().phases;const draws=p.tick(1064);
  assert.equal(p.state().motionWeight,0);assert.equal(p.state().runWeight,0);assert.deepEqual(p.state().phases,phases);assert.ok(draws.every(o=>o.reducedMotion));
  p.click('reduced');p.tick(1080);assert.ok(p.state().motionWeight>0);assert.ok(p.state().phases[0]>phases[0]);
});
