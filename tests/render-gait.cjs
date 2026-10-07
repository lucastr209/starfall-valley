'use strict';
// Isolated renderer preview; never reads or changes a player's save.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const data=require('../game-data.js');
const source=fs.readFileSync(path.join(__dirname,'../world-actors.js'),'utf8').replace(/<\/script/gi,'<\\/script');
const profiles=[{id:'player',name:'Lữ khách',shirt:'#5f9895',hair:'#55414b'},...data.npcs];
const catalogue=JSON.stringify(profiles).replace(/</g,'\\u003c');
const html=`<!doctype html>
<html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thung Lũng Sao Rơi — kiểm tra dáng đi</title>
<style>
body{margin:0;background:#f5eedb;color:#344449;font:16px system-ui}main{max-width:1000px;margin:auto;padding:20px}
h1{font-size:22px;margin:0 0 8px}p,small{line-height:1.5}nav{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:16px 0}
button,select{font:inherit;padding:8px 12px;border:1px solid #9baf9d;border-radius:6px;background:#fff8e9;color:inherit;cursor:pointer}
button[aria-pressed=true]{background:#d3e7ce}canvas{display:block;width:960px;height:520px;image-rendering:pixelated;border:1px solid #b8b39f}
output{display:block;margin:10px 0;font-variant-numeric:tabular-nums}.scroll{overflow:auto}
</style><main>
<h1>Thung Lũng Sao Rơi — dáng đi liên tục</h1>
<p>Người chơi và đủ 11 cư dân ở bốn hướng. Có thể cuộn ngang bảng trên màn hình nhỏ.</p>
<nav aria-label="Điều khiển bảng sprite">
<label>Chế độ <select id="pace"><option value="walk">Đi bộ</option><option value="run">Chạy</option></select></label>
<button id="moving" type="button" aria-pressed="true">Dừng chuyển động</button>
<button id="pause" type="button" aria-pressed="false">Tạm dừng khung hình</button>
<button id="reduced" type="button" aria-pressed="false">Giảm chuyển động</button>
</nav><output id="status" aria-live="off"></output>
<div class="scroll"><canvas id="sheet" width="960" height="520" aria-label="Người chơi và 11 NPC ở hướng trước, sau, trái, phải"></canvas></div>
<small>Hàng: trước / sau / trái / phải. Đi bộ mẫu: người chơi 180 px/s, cư dân 76–96 px/s; chạy nhanh gấp 1,65. Chạy của NPC là tư thế mẫu để đối chiếu, cư dân trong game đi bộ. Bảng kiểm hình vẽ; thao tác trong game cần kiểm riêng.</small>
</main><script>${source}</script><script>
'use strict';
const profiles=${catalogue},actors=globalThis.StardropActors;
const canvas=document.getElementById('sheet'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const pace=document.getElementById('pace'),status=document.getElementById('status');
let moving=true,paused=false,reduced=false,last=0,time=0,motionWeight=1,runWeight=0;
const phases=profiles.map(()=>0),speeds=profiles.map((p,i)=>i?76+((i-1)*7)%21:180);
function toggle(id,read,write,on,off){document.getElementById(id).addEventListener('click',()=>{
write(!read());const b=document.getElementById(id);b.setAttribute('aria-pressed',String(read()));b.textContent=read()?on:off;});}
toggle('moving',()=>moving,v=>moving=v,'Dừng chuyển động','Bắt đầu chuyển động');
toggle('pause',()=>paused,v=>paused=v,'Tiếp tục khung hình','Tạm dừng khung hình');
toggle('reduced',()=>reduced,v=>reduced=v,'Bật chuyển động đầy đủ','Giảm chuyển động');
function approach(value,target,dt,duration){return value<target?Math.min(target,value+dt/duration):Math.max(target,value-dt/duration);}
function paint(stamp){
const dt=last?Math.min(.05,(stamp-last)/1000):0;last=stamp;
if(!paused){
time+=dt;
if(reduced){motionWeight=0;runWeight=0;}
else{
motionWeight=approach(motionWeight,Number(moving),dt,moving?.08:.12);
runWeight=approach(runWeight,Number(moving&&pace.value==='run'),dt,.1);
if(moving)profiles.forEach((p,i)=>{const sprint=pace.value==='run',speed=speeds[i]*(sprint?1.65:1);
const cycle=sprint?actors.artMetrics.runCycleDistance:actors.artMetrics.walkCycleDistance;
phases[i]=(phases[i]+dt*speed/cycle)%1;});
}}
ctx.fillStyle='#f5eedb';ctx.fillRect(0,0,canvas.width,canvas.height);
ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillStyle='#344449';
profiles.forEach((p,i)=>ctx.fillText(p.name,40+i*80,28));
actors.directions.forEach((direction,row)=>profiles.forEach((p,column)=>{
const x=40+column*80,y=110+row*125;
ctx.fillStyle=column%2?'#ede3cb':'#f9f3e5';ctx.fillRect(column*80,40+row*125,80,118);
ctx.fillStyle='#c7c1ab';ctx.fillRect(column*80+8,y+2,64,1);
actors.draw(ctx,{...p,x,y,isPlayer:p.id==='player',direction,moving,running:moving&&pace.value==='run',phase:phases[column],motionWeight,runWeight,time,reducedMotion:reduced});
ctx.fillStyle='#64716b';ctx.font='11px system-ui';ctx.fillText(['Trước','Sau','Trái','Phải'][row],x,y+30);
}));
status.textContent=actors.artMetrics.gaitFrames+' tư thế chính • '+(moving?'Đang chuyển động':'Đứng yên')+' • Bước '+motionWeight.toFixed(2)+' / chạy '+runWeight.toFixed(2)+(paused?' • Tạm dừng':'')+(reduced?' • Giảm chuyển động':'');
requestAnimationFrame(paint);
}
requestAnimationFrame(paint);
</script></html>`;
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if(scripts.length!==2)throw new Error('Preview must contain exactly two local scripts');
scripts.forEach((s,i)=>new vm.Script(s[1],{filename:'gait-preview-'+i+'.js'}));
const output=path.join(__dirname,'../test-artifacts');fs.mkdirSync(output,{recursive:true});
const file=path.join(output,'handheld-gait-preview.html');fs.writeFileSync(file,html,'utf8');
console.log('Exported standalone gait preview for '+profiles.length+' characters; embedded syntax PASS: '+file);
