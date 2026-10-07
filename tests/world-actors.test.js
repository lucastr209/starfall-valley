'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Actors = require('../world-actors.js');
const data = require('../game-data.js');
const FRAME_COUNT = 8;
const WALK_FRAME = Actors.artMetrics.walkFrameDistance, RUN_FRAME = Actors.artMetrics.runFrameDistance;
const WALK_CYCLE = Actors.artMetrics.walkCycleDistance, RUN_CYCLE = Actors.artMetrics.runCycleDistance;
const WALK_DISTANCES = Array.from({length:FRAME_COUNT},(_,i)=>i*WALK_FRAME), RUN_DISTANCES = Array.from({length:FRAME_COUNT},(_,i)=>i*RUN_FRAME);

function canvasMock() {
  const calls = [], stack = [];
  const ctx = {
    fillStyle: '#012345', globalAlpha: .37, matrix: [1, 0, 0, 1, 0, 0],
    save() { stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,matrix:this.matrix.slice()}); },
    restore() { const saved = stack.pop(); assert.ok(saved, 'restore has a matching save'); Object.assign(this, saved); },
    translate(x,y) { const m=this.matrix;m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y; },
    scale(x,y) { const m=this.matrix;m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y; },
    fillRect(x,y,w,h) { const m=this.matrix;calls.push({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5],w:m[0]*w,h:m[3]*h,color:this.fillStyle,alpha:this.globalAlpha}); }
  };
  return {ctx,calls,stack};
}
function trace(options = {}) { const canvas = canvasMock();Actors.draw(canvas.ctx,{id:'player',isPlayer:true,...options});return canvas.calls; }
function normalized(calls) { return calls.map(c=>({x:Math.min(c.x,c.x+c.w),y:Math.min(c.y,c.y+c.h),w:Math.abs(c.w),h:Math.abs(c.h),color:c.color,alpha:c.alpha})); }
const SHADOWS = new Set(['#213c4038', '#213c4024']);
const SKIN = new Set(['#efc5a2', '#f9d8b5', '#c88f78']);
function pixels(calls, includeShadow = true) {
  const result = new Map();
  for (const c of normalized(calls)) {
    if (!includeShadow && SHADOWS.has(c.color)) continue;
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) result.set(`${x},${y}`, {x,y,color:c.color,alpha:c.alpha});
  }
  return [...result.values()];
}
function paintSignature(calls) { return pixels(calls).sort((a,b)=>a.y-b.y||a.x-b.x).map(c=>[c.x,c.y,c.color,c.alpha]); }
function paintLayerPixels(calls, colors) {
  const result=new Map();
  for(const c of normalized(calls))if(colors.has(c.color))
    for(let y=c.y;y<c.y+c.h;y++)for(let x=c.x;x<c.x+c.w;x++)
      result.set(`${x},${y},${c.color}`,{x,y,color:c.color});
  return [...result.values()];
}
function extents(points) { assert.ok(points.length, 'A rendered pixel group exists'); return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x))+1,top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))+1}; }
function tint(hex, amount) { const n=parseInt(hex.slice(1),16),target=amount>0?255:0,blend=Math.abs(amount);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.round(v+(target-v)*blend).toString(16).padStart(2,'0')).join(''); }
function movesWithin(a, b, limit, matchColor = false) {
  const key = p => `${p.x},${p.y}${matchColor ? ',' + p.color : ''}`;
  const offsets=[];for(let dy=-limit;dy<=limit;dy++)for(let dx=-limit;dx<=limit;dx++)offsets.push([dx,dy]);offsets.sort((a,b)=>Math.max(Math.abs(a[0]),Math.abs(a[1]))-Math.max(Math.abs(b[0]),Math.abs(b[1])));
  const near = (from,to) => {
    const occupied=new Set(to.map(key));
    return from.every(p=>{
      for(const [dx,dy] of offsets)if(occupied.has(key({...p,x:p.x+dx,y:p.y+dy})))return true;
      return false;
    });
  };
  return a.length>0 && b.length>0 && near(a,b) && near(b,a);
}

test('original actor module works in a browser without a DOM or dependencies',()=>{
  const scope={};vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'../world-actors.js'),'utf8'),scope);
  assert.equal(typeof scope.StardropActors.draw,'function');assert.deepEqual(Array.from(scope.StardropActors.directions),['down','up','left','right']);
});
test('frozen art metrics declare the chibi dimensions and eight cyclic gait poses',()=>{
  assert.equal(Object.isFrozen(Actors),true);assert.equal(Object.isFrozen(Actors.artMetrics),true);
  assert.equal(Actors.artMetrics.pixelSize,2);assert.equal(Actors.artMetrics.logicalPixel,2);assert.equal(Actors.artMetrics.bodyWidth,48);assert.equal(Actors.artMetrics.bodyHeight,60);assert.equal(Actors.artMetrics.baseHeight,54);assert.equal(Actors.artMetrics.headHeight,32);assert.equal(Actors.artMetrics.nameOffset,66);
  assert.equal(Actors.artMetrics.walkFrameDistance,WALK_FRAME);assert.equal(Actors.artMetrics.runFrameDistance,RUN_FRAME);assert.equal(Actors.artMetrics.walkCycleDistance,WALK_CYCLE);assert.equal(Actors.artMetrics.runCycleDistance,RUN_CYCLE);
  assert.equal(WALK_CYCLE,84);assert.equal(RUN_CYCLE,96);assert.equal(WALK_FRAME,10.5);assert.equal(RUN_FRAME,12);assert.equal(Actors.artMetrics.gaitFrames,FRAME_COUNT);
  assert.equal(Actors.artMetrics.walkCycleDistance/Actors.artMetrics.walkFrameDistance,FRAME_COUNT);assert.equal(Actors.artMetrics.runCycleDistance/Actors.artMetrics.runFrameDistance,FRAME_COUNT);
  for(const npc of data.npcs)assert.equal(Object.isFrozen(Actors.profileFor(npc.id)),true);
});
test('four directions render four real views and back does not paint face pixels',()=>{
  const traces=Actors.directions.map(direction=>trace({direction}));
  assert.equal(new Set(traces.map(c=>JSON.stringify(paintSignature(c)))).size,4);
  const front=pixels(traces[0],false),back=pixels(traces[1],false);
  assert.ok(front.some(c=>c.color==='#b77b71'),'front has a visible mouth');assert.ok(front.some(c=>c.color==='#f9d8b5'&&c.y<-25),'front has a light face');
  assert.ok(front.some(c=>c.color==='#fff0ca'&&c.y>=-40&&c.y<-28),'front has visible eye whites');
  assert.equal(back.some(c=>c.color==='#b77b71'),false,'back head has no mouth');assert.equal(back.some(c=>SKIN.has(c.color)&&c.y<-28),false,'back head has no face');
  assert.equal(back.some(c=>c.color==='#fff0ca'&&c.y>=-40&&c.y<-28),false,'back head has no eye whites');
  assert.ok(back.some(c=>c.color==='#9f734d'&&c.y<-10),'back shows a visible backpack');
});
test('left is an exact horizontal mirror of right, including gear and lantern',()=>{
  const poses=[{moving:false,distance:0},...[false,true].flatMap(running=>Array.from({length:FRAME_COUNT*2},(_,index)=>({moving:true,running,distance:index*(running?RUN_FRAME:WALK_FRAME)/2})))];
  for(const npc of data.npcs.concat([{id:'player'}]))for(const pose of poses){
    const opts={...npc,x:0,y:0,isPlayer:npc.id==='player',...pose,time:1,lantern:true};
    const right=pixels(trace({...opts,direction:'right'}));
    const left=pixels(trace({...opts,direction:'left'})).sort((a,b)=>a.y-b.y||a.x-b.x);
    const mirrored=right.map(c=>({...c,x:-c.x-1})).sort((a,b)=>a.y-b.y||a.x-b.x);
    assert.deepEqual(left,mirrored,npc.id+' pose='+JSON.stringify(pose));
  }
});
test('eight walk key poses are driven by distance and repeat after a full stride',()=>{
  const frames=WALK_DISTANCES.map(distance=>Actors.frameFor({moving:true,distance,time:0}));
  assert.deepEqual(frames.map(f=>f.index),[0,1,2,3,4,5,6,7]);
  for(const direction of Actors.directions)assert.equal(new Set(WALK_DISTANCES.map(distance=>JSON.stringify(paintSignature(trace({moving:true,distance,direction}))))).size,FRAME_COUNT,direction+' has eight distinct poses');
  assert.deepEqual(Actors.frameFor({moving:true,distance:0}),Actors.frameFor({moving:true,distance:WALK_CYCLE}));
  const a=trace({moving:true,distance:14,time:0}),b=trace({moving:true,distance:14,time:500});assert.deepEqual(paintSignature(a),paintSignature(b),'elapsed time alone cannot make moving feet slide');
  assert.notDeepEqual(paintSignature(trace({moving:true,distance:0})),paintSignature(trace({moving:true,distance:14})));
});
test('run has longer steps, directional lean and a separate distance cadence',()=>{
  const walk=Actors.frameFor({moving:true,phase:.25,direction:'right'}),run=Actors.frameFor({moving:true,running:true,phase:.25,direction:'right'});
  assert.ok(Math.abs(run.step)>Math.abs(walk.step));assert.equal(run.lean,2);assert.equal(walk.lean,0);
  assert.deepEqual(RUN_DISTANCES.map(distance=>Actors.frameFor({moving:true,running:true,distance}).index),[0,1,2,3,4,5,6,7]);
  for(const direction of Actors.directions)assert.equal(new Set(RUN_DISTANCES.map(distance=>JSON.stringify(paintSignature(trace({moving:true,running:true,distance,direction}))))).size,FRAME_COUNT,direction+' has eight distinct run poses');
  assert.deepEqual(Actors.frameFor({moving:true,running:true,distance:0}),Actors.frameFor({moving:true,running:true,distance:RUN_CYCLE}));
  assert.notDeepEqual(paintSignature(trace({moving:true,distance:28,direction:'right'})),paintSignature(trace({moving:true,running:true,distance:32,direction:'right'})));
  assert.equal(Actors.frameFor({running:true}).running,false,'a stationary actor does not use running pose');
});
test('walking and running phase boundaries retain the 84 and 96 pixel cycle cadence',()=>{
  for(const running of [false,true]){
    const unit=running?RUN_FRAME:WALK_FRAME,cycle=running?RUN_CYCLE:WALK_CYCLE;
    for(let index=0;index<FRAME_COUNT;index++){
      assert.equal(Actors.frameFor({moving:true,running,distance:index*unit}).index,index);assert.equal(Actors.frameFor({moving:true,running,distance:(index+1)*unit-.001}).index,index);
      assert.equal(Actors.frameFor({moving:true,running,distance:index*unit+cycle*100}).index,index);
    }
    assert.equal(Actors.frameFor({moving:true,running,distance:cycle}).index,0);assert.equal(Actors.frameFor({moving:false,running,distance:cycle*.7}).index,0);
  }
});
test('explicit normalized phase overrides distance and wraps without changing the pose',()=>{
  for(const running of [false,true])for(const phase of [0,.125,.25,.375,.5,.625,.75,.875]){
    const options={moving:true,running,phase,distance:23,time:0};
    assert.deepEqual(Actors.frameFor(options),Actors.frameFor({...options,phase:phase+10,distance:700}),'a normalized phase remains authoritative across repeated cycles');
    const cycle=running?RUN_CYCLE:WALK_CYCLE;
    assert.deepEqual(paintSignature(trace(options)),paintSignature(trace({moving:true,running,distance:phase*cycle,time:0})),'explicit phase draws the same pose as its travelled distance');
  }
});
test('gait is a continuous cyclic path instead of jumping from an extended leg to center',()=>{
  for(const running of [false,true]){
    const samples=Array.from({length:129},(_,index)=>Actors.frameFor({moving:true,running,phase:index/128}));
    assert.deepEqual(samples[0],samples[128],'end of a cycle matches its beginning');
    for(let index=1;index<samples.length;index++){
      assert.ok(Math.abs(samples[index].step-samples[index-1].step)<=1,`${running?'run':'walk'} limb displacement is bounded at sample ${index}`);
      assert.ok(Math.abs(samples[index].bob-samples[index-1].bob)<=1,`head bob is bounded at sample ${index}`);
      for(const leg of ['nearFoot','farFoot'])for(const value of ['offset','lift','bend'])
        assert.ok(Math.abs(samples[index][leg][value]-samples[index-1][leg][value])<=1,`${leg} ${value} cannot jump at sample ${index}`);
    }
    const peak=Actors.frameFor({moving:true,running,phase:.25}),after=Actors.frameFor({moving:true,running,phase:.25+1/128});
    assert.ok(Math.abs(after.step)>=Math.abs(peak.step)-1,'the planted leg recovers through nearby poses, without an extended-to-center snap');
    assert.ok(samples.some(f=>f.step>0)&&samples.some(f=>f.step<0),'both legs take turns leading');
  }
});
test('intermediate distance samples change the final raster inside the same key pose interval',()=>{
  for(const direction of Actors.directions)for(const running of [false,true]){
    const cycle=running?RUN_CYCLE:WALK_CYCLE;
    const poses=Array.from({length:64},(_,index)=>({frame:Actors.frameFor({moving:true,running,direction,distance:index*cycle/64}),signature:JSON.stringify(paintSignature(trace({moving:true,running,direction,distance:index*cycle/64})))}));
    assert.ok(new Set(poses.map(p=>p.signature)).size>FRAME_COUNT,`${direction}/${running} renders more than eight held key frames`);
    assert.ok(poses.some((pose,index)=>index>0&&pose.frame.index===poses[index-1].frame.index&&pose.signature!==poses[index-1].signature),`${direction}/${running} produces an actual intermediate drawing within a key pose`);
  }
});
test('close cyclic samples keep the occupied silhouette and colored boots near their previous pixels',()=>{
  const boots=new Set(['#66554b','#95816a']);
  for(const direction of Actors.directions)for(const running of [false,true]){
    const drawings=Array.from({length:65},(_,index)=>trace({direction,moving:true,running,phase:index/64}));
    const rasters=drawings.map(c=>pixels(c,false)),bootLayers=drawings.map(c=>paintLayerPixels(c,boots));
    for(let index=1;index<rasters.length;index++){
      const previous=rasters[index-1],current=rasters[index];
      // A closing leg gap turns a former contour into an interior pixel at the
      // same position. Compare occupied pixels so harmless occlusion is allowed,
      // while actual silhouette displacement and colored boot jumps stay bounded.
      assert.ok(movesWithin(previous,current,2),`${direction}/${running} silhouette cannot teleport at cycle sample ${index}`);
      // Visible boot pixels may disappear behind the near leg or emerge again.
      // Isolate boot paint before occlusion and retain each shade to catch actual
      // geometry jumps or palette pops, alongside the final silhouette above.
      assert.ok(movesWithin(bootLayers[index-1],bootLayers[index],2,true),`${direction}/${running} boot paint cannot skip its in-between pose at sample ${index}`);
    }
  }
});
test('weight transfer raises the torso over the passing support leg and settles at wide contact',()=>{
  for(const running of [false,true]){
    for(const phase of [0,.5])assert.equal(Actors.frameFor({moving:true,running,phase}).bob,-1);
    for(const phase of [.25,.75])assert.equal(Actors.frameFor({moving:true,running,phase}).bob,0);
    assert.equal(Actors.frameFor({moving:true,running,phase:0,motionWeight:0}).bob,0);
  }
});
test('a stopped actor settles a frozen stride while start and stop weights blend toward neutral',()=>{
  for(const direction of Actors.directions)for(const running of [false,true]){
    const common={direction,phase:.25,runWeight:running?1:0};
    const moving=Actors.frameFor({...common,moving:true,running,motionWeight:1}),settling=Actors.frameFor({...common,moving:false,running,motionWeight:1});
    assert.equal(settling.step,moving.step,'the first stopped sample preserves the visible stride');
    assert.equal(settling.lean,moving.lean,'the run stance does not vanish in the first stopped sample');
    const frozenA=trace({...common,moving:false,running,motionWeight:.75,time:0}),frozenB=trace({...common,moving:false,running,motionWeight:.75,time:1});
    assert.deepEqual(paintSignature(frozenA),paintSignature(frozenB),'settling never advances the held gait from elapsed time');
    let previous=Infinity;
    for(const motionWeight of [1,.75,.5,.25,0]){
      const frame=Actors.frameFor({...common,moving:false,running,motionWeight});
      assert.ok(Math.abs(frame.step)<=previous,'foot spread eases monotonically toward neutral');previous=Math.abs(frame.step);
    }
    const neutral=trace({...common,moving:false,running,motionWeight:0,time:0}),idle=trace({direction,time:0});
    assert.deepEqual(paintSignature(neutral),paintSignature(idle),'fully settled feet and torso match neutral idle');
    assert.deepEqual(paintSignature(trace({...common,moving:true,running,motionWeight:0,time:0})),paintSignature(idle),'starting at zero weight cannot snap straight to the extended stride');
    assert.notDeepEqual(paintSignature(trace({...common,moving:true,running,motionWeight:.5,time:0})),paintSignature(idle),'a partial start blend still paints actual motion');
  }
});
test('feet alternate a bent swing with a planted support foot through the full cycle',()=>{
  for(const running of [false,true]){
    const frames=Array.from({length:64},(_,index)=>Actors.frameFor({moving:true,running,phase:index/64}));
    for(const frame of frames){
      assert.ok(frame.nearFoot && frame.farFoot,'each foot has an independent pose');
      for(const foot of [frame.nearFoot,frame.farFoot]){
        assert.ok([foot.offset,foot.lift,foot.bend].every(Number.isFinite),'foot offsets are finite');
        assert.ok(foot.lift>=0&&foot.lift<=(running?3:2),'lifting remains small for the short chibi legs');
        assert.ok(foot.bend>=0&&foot.bend<=(running?2.5:1.5),'knees bend during the swing instead of moving a rigid leg block');
      }
      assert.ok(frame.nearFoot.lift===0||frame.farFoot.lift===0,'at least one supporting foot remains planted');
      assert.ok(Math.abs(frame.nearFoot.offset+frame.farFoot.offset)<1e-9,'opposing legs counterstep');
    }
    assert.ok(frames.some(f=>f.nearFoot.lift>0&&f.nearFoot.bend>0),'near leg has an actual lift and bend');
    assert.ok(frames.some(f=>f.farFoot.lift>0&&f.farFoot.bend>0),'far leg has an actual lift and bend');
  }
});
test('every NPC outfit renders eight distinct key poses in both walking and running',()=>{
  for(const npc of data.npcs)for(const direction of Actors.directions)for(const running of [false,true]){
    const distances=running?RUN_DISTANCES:WALK_DISTANCES;
    const poses=distances.map(distance=>JSON.stringify(paintSignature(trace({...npc,isPlayer:false,direction,moving:true,running,distance}))));
    assert.equal(new Set(poses).size,FRAME_COUNT,`${npc.id}/${direction}/${running} is animated through all eight key poses`);
  }
});
test('idle gently breathes and blinks without sliding its boots or shadow',()=>{
  const a=trace({time:0}),b=trace({time:.6});assert.notDeepEqual(paintSignature(a),paintSignature(b));
  const roots=calls=>pixels(calls).filter(c=>c.y>=-12&&[...SHADOWS,'#66554b','#95816a'].includes(c.color)).sort((a,b)=>a.y-b.y||a.x-b.x);
  assert.deepEqual(roots(a),roots(b));
  assert.equal(Actors.frameFor({id:'player',time:3.3}).blink,true);assert.equal(Actors.frameFor({id:'player',time:0}).blink,false);
  assert.notDeepEqual(paintSignature(trace({id:'player',time:3.3})),paintSignature(trace({id:'player',time:0})));
});
test('reduced motion freezes idle, walk and run decoration while retaining orientation',()=>{
  for(const direction of Actors.directions)for(const moving of [false,true]){
    const options={direction,moving,running:moving,reducedMotion:true};
    assert.deepEqual(paintSignature(trace({...options,distance:0,time:0})),paintSignature(trace({...options,distance:23,time:70})));
    const frame=Actors.frameFor({...options,distance:23,time:70});assert.equal(frame.index,0);assert.equal(frame.step,0);assert.equal(frame.bob,0);assert.equal(frame.blink,false);assert.equal(frame.lean,0);
    assert.deepEqual(paintSignature(trace({...options,moving:false,phase:.25,motionWeight:1,runWeight:1,time:0})),paintSignature(trace({...options,phase:.75,motionWeight:.5,runWeight:.5,time:70})),'settling and explicit phase also honor reduced motion');
  }
  assert.notDeepEqual(trace({direction:'up',reducedMotion:true}),trace({direction:'down',reducedMotion:true}));
});
test('all eleven NPC identities have distinct gear and silhouettes even with identical colors',()=>{
  assert.equal(data.npcs.length,11);
  const front=data.npcs.map(n=>trace({id:n.id,isPlayer:false,shirt:'#7e9aa1',hair:'#554433'}));
  const back=data.npcs.map(n=>trace({id:n.id,isPlayer:false,shirt:'#7e9aa1',hair:'#554433',direction:'up'}));
  assert.equal(new Set(front.map(c=>JSON.stringify(paintSignature(c)))).size,11);assert.equal(new Set(back.map(c=>JSON.stringify(paintSignature(c)))).size,11);
  assert.equal(new Set(data.npcs.map(n=>Actors.profileFor(n.id).gear)).size,11);
  assert.equal(Actors.profileFor('mira').gear,'cartographer');assert.equal(Actors.profileFor('son').gear,'cook');assert.equal(Actors.profileFor('unknown').gear,'villager');
});
test('every outfit and gait phase stays within 48 by 60 pixels and keeps an exactly grounded foot',()=>{
  for(const npc of data.npcs.concat([{id:'player'}]))for(const direction of Actors.directions)for(const running of [false,true]){
    for(let index=0;index<FRAME_COUNT*2;index++){
      const opts={...npc,isPlayer:npc.id==='player',x:120,y:200,direction,moving:true,running,distance:index*(running?RUN_FRAME:WALK_FRAME)/2},rendered=trace(opts),body=pixels(rendered,false),bounds=extents(body),feet=extents(body.filter(c=>c.y>=190)),shadow=extents(pixels(rendered.filter(c=>SHADOWS.has(c.color))));
      assert.ok(bounds.right-bounds.left<=48,`${npc.id}/${direction}/${running}/${index} width <=48`);assert.ok(bounds.bottom-bounds.top<=60,`${npc.id}/${direction}/${running}/${index} height <=60`);
      assert.ok(bounds.left>=96&&bounds.right<=144,`${npc.id} silhouette stays within 24 pixels of its anchor`);assert.ok(bounds.top>=142&&bounds.bottom<=202,`${npc.id} height includes hats and the grounded foot`);
      assert.ok(body.some(c=>c.y>=190&&['#66554b','#95816a'].includes(c.color)),'Boot color is visible at the grounded feet');assert.equal(feet.bottom,202,`${npc.id}/${direction}/${running}/${index} one boot sole is always at anchor+2`);assert.equal(shadow.left,104);assert.equal(shadow.right,136);assert.equal(shadow.top,200);assert.equal(shadow.bottom,204,'Shadow remains anchored despite lean/bob');
    }
  }
});

test('chibi views have a large head and a petite torso measured from the final raster',()=>{
  const hair='#554433',shirt='#7e9aa1',hairColors=new Set([hair,tint(hair,.26),tint(hair,-.22),tint(hair,-.48),...SKIN]),shirtColors=new Set([shirt,tint(shirt,.26),tint(shirt,-.26)]);
  for(const direction of Actors.directions){
    const raster=pixels(trace({direction,hair,shirt}),false),body=extents(raster),head=extents(raster.filter(p=>p.y<-20&&hairColors.has(p.color))),torso=extents(raster.filter(p=>p.y>-28&&shirtColors.has(p.color))),headHeight=head.bottom-head.top,bodyHeight=body.bottom-body.top;
    assert.ok(headHeight>=26&&headHeight<=36,`${direction} head has the reference's large pixel silhouette`);assert.ok(headHeight/bodyHeight>=.48&&headHeight/bodyHeight<=.66,`${direction} head occupies about half of the full figure (${headHeight}/${bodyHeight})`);
    assert.ok(head.right-head.left>=28,`${direction} has a broad rounded/spiky head`);assert.ok(head.right-head.left>=(torso.right-torso.left)*1.15,`${direction} head is visibly wider than its petite torso`);
    assert.ok(torso.bottom-torso.top<=18,`${direction} shirt does not stretch into a long upright body`);
  }
});

test('pixel blocks and all animated offsets remain integral, including rounded fractional world anchors',()=>{
  for(const direction of Actors.directions)for(const running of [false,true])for(let index=0;index<FRAME_COUNT*2;index++){
    const canvas=canvasMock();Actors.draw(canvas.ctx,{id:'player',x:120.2,y:199.7,direction,moving:true,running,distance:index*(running?RUN_FRAME:WALK_FRAME)/2,lantern:true});
    assert.ok(canvas.calls.every(c=>[c.x,c.y,c.w,c.h].every(Number.isInteger)),`${direction}/${running}/${index} cannot blur between pixels`);assert.ok(canvas.calls.every(c=>Math.abs(c.w)>0&&c.h>0));assert.equal(canvas.stack.length,0);
  }
});
test('lantern adds bright pixels on the carried side and draw preserves alpha and canvas state',()=>{
  for(const direction of Actors.directions){
    const canvas=canvasMock(),matrix=canvas.ctx.matrix.slice();
    const before=trace({direction}),frame=Actors.draw(canvas.ctx,{id:'player',isPlayer:true,x:15,y:25,direction,lantern:true,moving:true,distance:14});
    assert.ok(canvas.calls.length>before.length);assert.ok(canvas.calls.some(c=>c.color==='#fff9d8'));
    const bounds=extents(pixels(canvas.calls,false));assert.ok(bounds.left>=-9&&bounds.right<=39,'Carried lamp also fits within 24 pixels of the rounded x anchor');assert.ok(bounds.right-bounds.left<=48);assert.ok(bounds.bottom-bounds.top<=60);
    assert.ok(canvas.calls.every(c=>c.alpha===.37));assert.equal(canvas.ctx.globalAlpha,.37);assert.equal(canvas.ctx.fillStyle,'#012345');assert.deepEqual(canvas.ctx.matrix,matrix);assert.equal(canvas.stack.length,0);assert.equal(frame.direction,direction);
  }
});
test('draw restores pre-existing canvas transforms and unwinds every save when painting fails',()=>{
  for(const failAfter of [null,3,25]){
    const canvas=canvasMock();canvas.ctx.matrix=[1.5,.25,-.2,2,17,29];const initial=canvas.ctx.matrix.slice(),paint=canvas.ctx.fillRect;let count=0;
    canvas.ctx.fillRect=function(...args){if(++count===failAfter)throw new Error('pixel paint failed');return paint.apply(this,args);};
    const draw=()=>Actors.draw(canvas.ctx,{id:'son',direction:'left',moving:true,running:true,distance:20,lantern:true});
    if(failAfter)assert.throws(draw,/pixel paint failed/);else assert.doesNotThrow(draw);
    assert.deepEqual(canvas.ctx.matrix,initial);assert.equal(canvas.ctx.fillStyle,'#012345');assert.equal(canvas.ctx.globalAlpha,.37);assert.equal(canvas.stack.length,0);
  }
});
test('hidden actors retain an anchored shadow without face, gear or lantern',()=>{
  const canvas=canvasMock();Actors.draw(canvas.ctx,{id:'player',x:20,y:30,hidden:true,lantern:true});
  assert.equal(canvas.calls.length,2);assert.ok(canvas.calls.every(c=>c.color.startsWith('#213c40')));assert.equal(canvas.stack.length,0);
});
test('malformed numbers, names and colors fall back safely without mutating inputs',()=>{
  for(const options of [undefined,null,42,'bad',{x:NaN,y:Infinity,time:Infinity,distance:NaN,phase:NaN,motionWeight:Infinity,runWeight:{},direction:'north',shirt:{},hair:'url(bad)',id:[]},{moving:true,phase:-Infinity,motionWeight:-7,runWeight:5}]){
    const canvas=canvasMock(),serialized=JSON.stringify(options);assert.doesNotThrow(()=>Actors.draw(canvas.ctx,options));
    assert.ok(canvas.calls.every(c=>[c.x,c.y,c.w,c.h,c.alpha].every(Number.isFinite)));assert.ok(canvas.calls.every(c=>typeof c.color==='string'));assert.equal(canvas.stack.length,0);assert.equal(JSON.stringify(options),serialized);
  }
  assert.equal(Actors.draw(null,{}),null);assert.equal(Actors.draw({},{}),null);
  assert.equal(Actors.frameFor({direction:'unknown'}).direction,'down');
  assert.equal(Actors.profileFor('__proto__').gear,'villager');assert.equal(Actors.profileFor({toString(){throw new Error('malformed id');}}).gear,'villager');
  assert.deepEqual(Actors.frameFor({moving:true,distance:-14}),Actors.frameFor({moving:true,distance:14}));
});
