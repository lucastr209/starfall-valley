'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Minimap = require('../public/js/minimap.js');
const MAPS = ['village','forest','coast','ruins'];

function canvasMock() {
  const calls=[],stack=[];
  const ctx={canvas:{width:160,height:110},fillStyle:'#abcdef',strokeStyle:'#123456',globalAlpha:.45,lineWidth:7,
    imageSmoothingEnabled:true,transform:[2,0,0,2,3,4],dash:[3,2],currentPath:[],
    save(){stack.push({fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,globalAlpha:this.globalAlpha,lineWidth:this.lineWidth,
      imageSmoothingEnabled:this.imageSmoothingEnabled,transform:this.transform,dash:this.dash});},
    restore(){const saved=stack.pop();assert.ok(saved,'balanced canvas state');Object.assign(this,saved);},
    setTransform(...args){this.transform=args;},setLineDash(dash){this.dash=dash;},
    clearRect(...args){calls.push({kind:'clear',args});},
    fillRect(...args){calls.push({kind:'rect',args,color:this.fillStyle});},
    strokeRect(...args){calls.push({kind:'outline',args,color:this.strokeStyle});},
    drawImage(...args){calls.push({kind:'image',args});},
    beginPath(){this.currentPath=[];},arc(...args){this.currentPath.push({kind:'arc',args});},
    moveTo(...args){this.currentPath.push({kind:'move',args});},lineTo(...args){this.currentPath.push({kind:'line',args});},
    closePath(){this.currentPath.push({kind:'close',args:[]});},
    fill(){calls.push({kind:'path',path:this.currentPath.slice(),color:this.fillStyle});},
    stroke(){calls.push({kind:'stroke',path:this.currentPath.slice(),color:this.strokeStyle});}
  };
  return {ctx,calls,stack};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);

test('minimap loads without a browser, DOM or external dependency',()=>{
  const scope={};vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/js/minimap.js'),'utf8'),scope);
  assert.equal(typeof scope.StardropMinimap.draw,'function');
  assert.equal(typeof scope.StardropMinimap.project,'function');
  assert.deepEqual(Object.keys(scope),['StardropMinimap']);
});
test('coordinate projection preserves the whole region and its aspect ratio at portrait and landscape sizes',()=>{
  for(const [width,height] of [[160,110],[112,82],[220,90],[80,160]]){
    const options={width,height,worldWidth:1600,worldHeight:1100};
    const first=Minimap.project(0,0,options),last=Minimap.project(1600,1100,options),middle=Minimap.project(800,550,options);
    assert.ok(first.x>=5&&first.y>=5);assert.ok(last.x<=width-5&&last.y<=height-5);
    close(middle.x,width/2);close(middle.y,height/2);
    close((last.x-first.x)/(last.y-first.y),1600/1100);
    assert.deepEqual(Minimap.project(-800,-100,options),first);
    assert.deepEqual(Minimap.project(1800,1200,options),last);
  }
});
test('invalid positions and dimensions cannot leak NaN into canvas operations',()=>{
  for(const [x,y] of [[NaN,1],[Infinity,0],[1,-Infinity],['5',1]])assert.equal(Minimap.project(x,y),null);
  for(const field of ['width','height','worldWidth','worldHeight'])for(const bad of [0,-1,NaN,Infinity,'20']){
    assert.equal(Minimap.project(1,1,{[field]:bad}),null);
    const mock=canvasMock();assert.equal(Minimap.draw(mock.ctx,{[field]:bad}),false);assert.equal(mock.calls.length,0);
  }
  assert.equal(Minimap.draw(null),false);
  const mock=canvasMock();assert.equal(Minimap.draw(mock.ctx,{map:'village',player:{x:NaN,y:0},npcs:[null,{x:0,y:Infinity}],
    peers:[{x:'10',y:10}],objects:[{kind:'gate',x:NaN,y:5}],target:{x:2,y:NaN},camera:{x:0,y:0,width:NaN,height:10}}),true);
  assert.equal(mock.calls.filter(call=>call.kind==='path').length,0);
});
test('each current region renders cached terrain and only its own actors and gates',()=>{
  for(const map of MAPS){
    const other=MAPS.find(name=>name!==map),terrain={id:`terrain-${map}`},mock=canvasMock();
    const options={map,terrain,player:{x:800,y:550},npcs:[{id:'local',map,x:500,y:350},{id:'elsewhere',map:other,x:400,y:250}],
      peers:[{id:'peer',map,x:1000,y:700},{id:'hidden',map:other,x:700,y:700}],
      objects:[{kind:'gate',map,x:800,y:100,to:other},{kind:'gate',map:other,x:500,y:100},{kind:'resource',x:200,y:300}],
      target:{map:other,x:500,y:350}};
    const before=JSON.stringify(options);
    assert.equal(Minimap.draw(mock.ctx,options),true);assert.equal(JSON.stringify(options),before,'world state stays unchanged');
    assert.equal(mock.calls.filter(call=>call.kind==='image').length,1);
    assert.equal(mock.calls.find(call=>call.kind==='image').args[0],terrain);
    assert.equal(mock.calls.filter(call=>call.kind==='rect'&&call.color==='#64d8eb').length,1,'one local gate');
    assert.equal(mock.calls.filter(call=>call.kind==='path'&&call.color==='#80e0b8').length,1,'one local NPC');
    assert.equal(mock.calls.filter(call=>call.kind==='path'&&call.color==='#89baff').length,1,'one local peer');
    assert.equal(mock.calls.filter(call=>call.kind==='path'&&call.color==='#ffe08a').length,0,'other-map quest stays hidden');
    assert.equal(mock.calls.filter(call=>call.kind==='path'&&call.color==='#ffffff').length,1,'one player');
  }
});
test('player, nearby quests, tracked target and portals have different shapes and colors without names',()=>{
  const mock=canvasMock();
  Minimap.draw(mock.ctx,{map:'forest',player:{x:800,y:550,name:'private player name'},npcs:[{x:500,y:350,marker:'quest',name:'NPC'}],
    peers:[{map:'forest',x:600,y:350,name:'peer name',chat:'private message'}],
    objects:[{kind:'portal',x:0,y:1100,to:'village'}],target:{map:'forest',x:1400,y:940}});
  const target=mock.calls.find(call=>call.kind==='path'&&call.color==='#ffe08a');
  assert.deepEqual(target.path.map(command=>command.kind),['move','line','line','line','close']);
  assert.ok(mock.calls.some(call=>call.kind==='path'&&call.color==='#eacd72'&&call.path[0].kind==='arc'));
  assert.ok(mock.calls.some(call=>call.kind==='stroke'&&call.color==='#51efda'));
  assert.ok(mock.calls.some(call=>call.kind==='rect'&&call.color==='#64d8eb'));
  assert.ok(!JSON.stringify(mock.calls).includes('private'),'does not render player/chat strings');
});
test('camera rectangle tracks actual world-space view and clips it to region edges',()=>{
  const mock=canvasMock(),options={map:'coast',camera:{x:-100,y:900,width:900,height:400}};
  Minimap.draw(mock.ctx,options);
  const box=mock.calls.find(call=>call.kind==='outline'&&call.color==='rgba(255,255,255,.75)');
  const first=Minimap.project(0,900),last=Minimap.project(800,1100);
  box.args.forEach((n,index)=>close(n,[first.x,first.y,last.x-first.x,last.y-first.y][index]));
  for(const camera of [{x:1700,y:0,width:100,height:100},{x:0,y:0,width:-1,height:10},{x:0,y:0,width:10,height:0}]){
    const empty=canvasMock();Minimap.draw(empty.ctx,{camera});
    assert.equal(empty.calls.some(call=>call.kind==='outline'&&call.color==='rgba(255,255,255,.75)'),false);
  }
});
test('all actor and gate coordinates are clamped while input data and canvas settings are preserved',()=>{
  const mock=canvasMock(),settings={fillStyle:mock.ctx.fillStyle,strokeStyle:mock.ctx.strokeStyle,globalAlpha:mock.ctx.globalAlpha,
    lineWidth:mock.ctx.lineWidth,imageSmoothingEnabled:mock.ctx.imageSmoothingEnabled,transform:mock.ctx.transform,dash:mock.ctx.dash};
  Minimap.draw(mock.ctx,{player:{x:-20,y:2000},npcs:[{x:Infinity,y:2},{x:1900,y:-300}],peers:[{x:-40,y:-40}],objects:[{kind:'gate',x:2000,y:2000}],target:{x:2000,y:-20}});
  for(const call of mock.calls)if(call.kind==='path'||call.kind==='stroke')for(const command of call.path){
    if(command.kind==='arc'||command.kind==='move'||command.kind==='line'){
      assert.ok(command.args[0]>=0&&command.args[0]<=160);assert.ok(command.args[1]>=0&&command.args[1]<=110);
    }
  }
  for(const [key,value] of Object.entries(settings))assert.deepEqual(mock.ctx[key],value,key);
  assert.equal(mock.stack.length,0);
});
test('optional unavailable terrain falls back safely and drawing failures restore caller canvas state',()=>{
  const mock=canvasMock();mock.ctx.drawImage=()=>{throw new Error('image not ready');};
  assert.equal(Minimap.draw(mock.ctx,{map:'ruins',terrain:{},player:{x:800,y:550}}),true);
  assert.equal(mock.stack.length,0);assert.ok(mock.calls.some(call=>call.kind==='path'&&call.color==='#ffffff'));
  const broken=canvasMock(),initialFill=broken.ctx.fillStyle;
  broken.ctx.fillRect=()=>{throw new Error('canvas failure');};
  assert.throws(()=>Minimap.draw(broken.ctx,{map:'village'}),/canvas failure/);
  assert.equal(broken.ctx.fillStyle,initialFill);assert.equal(broken.stack.length,0);
});
