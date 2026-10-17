'use strict';
const crypto = require('node:crypto');
const D = require('../../public/js/data/awakening-data.js');
const Combat = require('../../public/js/core/combat-core.js');
const CombatData = require('../../public/js/data/combat-data.js');
const { chapters, weapons } = D;
const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const copy = value => structuredClone(value);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function character(id) { return { id, revision:0, weapon:'sword', coins:0, materials:0, victories:[] }; }
function world(id) { return { id, revision:0, cleared:[], abilities:[], buildings:[], secrets:[], stock:0 }; }
function need(condition, message) { if (!condition) throw new Error(message); }

// Mỗi Room chỉ tồn tại trên một process; dữ liệu bền được chụp sau lệnh có dirty và ghi giao dịch ở transport.
class Room {
  constructor({host,character:profile,world:save,code}) {
    this.code=code; this.host=host.id; this.world=copy(save); this.players=new Map();
    this.chapterIndex=-1; this.roomIndex=0; this.mobs=[]; this.projectiles=[]; this.effects=[];
    this.puzzleSolved=false; this.switches={}; this.encounterSize=1; this.paused=false; this.closed=false;
    this.events=[]; this.eventId=crypto.randomUUID(); this.dirty=false; this.finished=false; this.serial=0;
    this.join(host,profile);
  }
  join(user,profile) {
    let p=this.players.get(user.id);
    if(p){p.connected=true; p.disconnectedAt=null; if(user.id===this.host)this.paused=false; return p;}
    need(this.players.size<4,'Phòng đã đầy.');
    need(this.chapterIndex<0,'Nhóm đang thám hiểm. Hãy chờ trở về trại.');
    p={id:user.id,name:String(user.name||'Lữ khách').replace(/[<>\x00-\x1f]/g,'').slice(0,18),character:copy(profile),x:120,y:280+this.players.size*38,health:100,stamina:100,direction:'right',connected:true,input:{x:0,y:0,running:false},seq:-1,cooldown:0,dodgeCooldown:0,invulnerable:0,dodge:0,travel:0,moving:false,revive:null};
    this.players.set(user.id,p); return p;
  }
  disconnect(id,now=Date.now()) {
    const p=this.players.get(id); if(!p)return;
    p.connected=false;p.disconnectedAt=now;p.input={x:0,y:0,running:false};p.moving=false;p.revive=null;
    if(id===this.host){this.paused=true;this.hostDeadline=now+60000;}
  }
  blocked(x,y) {
    const obstacles=this.chapterIndex>=0?D.obstacles[this.roomIndex]:D.secrets.flatMap((s,i)=>[...s.walls,...(this.world.abilities.includes(chapters[i].ability)?[]:[s.gate])]);
    return x<24||y<35||x>776||y>536||obstacles.some(o=>x>o.x-14&&x<o.x+o.w+14&&y>o.y-14&&y<o.y+o.h+14);
  }
  mark() {this.dirty=true;}
  // Lệnh được whitelist; không nhận tọa độ, damage, loot hoặc bản save do client cung cấp.
  command(id,m) {
    const p=this.players.get(id); need(p?.connected&&!this.closed,'Phiên đã đóng.');
    need(!this.paused,'Đang chờ chủ phòng kết nối lại.');
    need(m&&typeof m.action==='string','Lệnh không hợp lệ.');
    const host=()=>need(id===this.host,'Chủ phòng mới được thực hiện thao tác này.');
    const camp=()=>need(this.chapterIndex===-1,'Chỉ thực hiện tại trại.');
    if(m.action==='input'){
      need(Number.isSafeInteger(m.seq)&&m.seq>p.seq,'Sai thứ tự điều khiển.');
      need(Number.isFinite(m.x)&&Number.isFinite(m.y)&&Math.abs(m.x)<=1&&Math.abs(m.y)<=1,'Dữ liệu điều khiển không hợp lệ.');
      p.seq=m.seq;p.input={x:m.x,y:m.y,running:m.running===true};p.inputAt=Date.now();
      if(Object.hasOwn(dirs,m.direction))p.direction=m.direction;
      return;
    }
    if(m.action==='travel'){
      host();camp();need(Number.isInteger(m.chapter)&&m.chapter>=0&&m.chapter<3,'Chương không hợp lệ.');
      need(m.chapter===0||this.world.cleared.includes(chapters[m.chapter-1].id),'Vùng này chưa mở.');
      this.chapterIndex=m.chapter;this.roomIndex=0;this.finished=false;this.startRoom();return;
    }
    if(m.action==='camp'){host();this.toCamp();return;}
    if(m.action==='advance'){
      host();need(this.chapterIndex>=0&&!this.finished,'Không có lối tiếp theo.');
      need(p.health>0&&p.x>680,'Đến cổng phía đông để đi tiếp.');
      need(!this.mobs.some(e=>e.hp>0)&&(this.roomIndex!==1||this.puzzleSolved),'Hãy hoàn thành phòng trước.');
      need(this.roomIndex<4,'Đã đến phòng cuối.');this.roomIndex++;this.startRoom();return;
    }
    if(m.action==='weapon'){camp();need(Object.hasOwn(weapons,m.weapon),'Vũ khí không hợp lệ.');p.character.weapon=m.weapon;this.mark();return;}
    if(m.action==='contribute'){
      camp();need(Number.isSafeInteger(m.amount)&&m.amount>0&&m.amount<=99&&p.character.materials>=m.amount,'Không đủ vật liệu hoặc số lượng không hợp lệ.');
      p.character.materials-=m.amount;this.world.stock+=m.amount;this.mark();return;
    }
    if(m.action==='build'){
      host();camp();const chapter=chapters.find(c=>this.world.cleared.includes(c.id)&&!this.world.buildings.includes(c.id));
      need(chapter&&this.world.stock>=8,'Cần thắng boss và góp đủ 8 vật liệu.');
      this.world.stock-=8;this.world.buildings.push(chapter.id);this.mark();return;
    }
    if(m.action==='secret'){
      camp();const c=chapters[m.chapter],s=D.secrets[m.chapter];
      need(c&&this.world.abilities.includes(c.ability),'Chưa có năng lực khám phá tương ứng.');
      need(distance(p,s.chest)<35,'Hãy đi qua lối đã mở và đến gần rương.');
      need(!this.world.secrets.includes(c.id),'Bí mật đã được tìm thấy.');
      this.world.secrets.push(c.id);for(const a of this.players.values())a.character.coins+=30;this.mark();return;
    }
    need(p.health>0,'Bạn đang bị hạ. Hãy chờ đồng đội cứu.');
    if(m.action==='interact'){
      if(this.chapterIndex<0){const index=D.secrets.findIndex(s=>distance(p,s)<70||distance(p,s.chest)<35);need(index>=0,'Đến gần một lối bí mật.');
        need(this.world.abilities.includes(chapters[index].ability),'Chưa có năng lực khám phá tương ứng.');
        if(distance(p,D.secrets[index].chest)>=35){this.notice=chapters[index].abilityName+' đã mở lối. Đi qua cửa và chạm rương phía trong.';return;}
        return this.command(id,{action:'secret',chapter:index});}
      if(this.roomIndex===1){
        const index=D.switches.findIndex(s=>distance(p,s)<65);need(index>=0,'Đến gần bia cộng hưởng.');
        this.switches[id]=index;
        const living=[...this.players.values()].filter(a=>a.connected&&a.health>0);
        this.puzzleSolved=living.length===1||new Set(living.filter(a=>D.switches[this.switches[a.id]]&&distance(a,D.switches[this.switches[a.id]])<65).map(a=>this.switches[a.id])).size===2;
        return;
      }
      if(this.roomIndex===3){p.health=100;p.stamina=100;return;}
      throw new Error('Không có cơ chế gần bạn.');
    }
    if(m.action==='revive'){
      const target=this.players.get(m.target);need(target&&target.id!==id&&target.health===0&&target.connected&&distance(p,target)<65,'Đến gần đồng đội bị hạ.');
      p.revive={target:m.target,time:0};return;
    }
    if(m.action==='ping'){
      need(['attack','help','wait'].includes(m.kind),'Tín hiệu không hợp lệ.');
      need(!p.pingCooldown||p.pingCooldown<=0,'Chờ một chút trước tín hiệu tiếp theo.');
      p.pingCooldown=1;this.effects.push({kind:m.kind,x:p.x,y:p.y,life:3,name:p.name});
      if(typeof m.target==='string'&&this.mobs.some(e=>e.id===m.target&&e.hp>0))this.marked=m.target;
      return;
    }
    if(m.action==='dodge'){
      need(p.stamina>=10&&p.dodgeCooldown<=0,'Chưa thể né.');p.stamina-=10;p.dodge=.22;p.dodgeCooldown=.8;p.invulnerable=.18;p.dodgeDirection=p.direction;p.revive=null;return;
    }
    if(m.action==='attack'){
      need(this.chapterIndex>=0,'Rút vũ khí khi thám hiểm.');const w=weapons[p.character.weapon];
      need(p.cooldown<=0&&p.stamina>=w.stamina&&p.dodge<=0,'Chưa thể tấn công.');
      p.stamina-=w.stamina;p.cooldown=w.cooldown;p.revive=null;
      // Trượng và kiếm dùng chung cung/đường nhìn của combat-core; cung phát đạn có thời gian bay.
      if(p.character.weapon==='bow'){
        const [dx,dy]=dirs[p.direction];this.projectiles.push({id:++this.serial,owner:p.id,friendly:true,x:p.x,y:p.y,vx:dx*480,vy:dy*480,life:w.range/480,damage:w.damage});
      }else{
        const [dx,dy]=dirs[p.direction];for(const e of this.mobs)if(e.hp>0&&Combat.inCone(p,e,dx,dy,w.range,w.arc,(x,y)=>this.blocked(x,y)))this.hitEnemy(e,w.damage);
        if(p.character.weapon==='staff')for(const a of this.players.values())if(a.health>0&&a.connected&&distance(a,p)<130)a.health=Math.min(100,a.health+5);
      }
      this.effects.push({kind:p.character.weapon,x:p.x,y:p.y,direction:p.direction,life:.25});this.checkVictory();return;
    }
    throw new Error('Lệnh không hợp lệ.');
  }
  toCamp(){this.chapterIndex=-1;this.roomIndex=0;this.mobs=[];this.projectiles=[];this.finished=false;this.resetPlayers();}
  resetPlayers(){let i=0;for(const p of this.players.values()){p.x=120;p.y=230+i++*45;p.health=100;p.stamina=100;p.input={x:0,y:0,running:false};p.moving=false;p.revive=null;p.cooldown=0;p.dodge=0;p.invulnerable=0;}}
  startRoom(){
    this.resetPlayers();this.switches={};this.puzzleSolved=false;this.encounterSize=[...this.players.values()].filter(p=>p.connected).length;
    this.spawn();
  }
  spawn(){
    this.mobs=[];this.projectiles=[];if(this.chapterIndex<0||[1,3].includes(this.roomIndex))return;
    const kinds=this.roomIndex===4?[chapters[this.chapterIndex].boss]:this.roomIndex===2?['warden','sprout','slime']:['slime','sprout'];
    kinds.forEach((kind,i)=>{const def=CombatData.enemies[kind];const hp=Math.ceil((def.boss?100+this.chapterIndex*35:kind==='slime'?24:36)*(1+.6*(this.encounterSize-1)));
      this.mobs.push({id:'mob-'+(++this.serial),kind,boss:!!def.boss,x:530+i*65,y:190+i*70,hp,maxHp:hp,stage:'idle',timer:.5,phase:1,cycle:0});});
  }
  hitEnemy(e,amount){if(e.boss&&e.stage!=='recovery')amount=Math.max(1,Math.floor(amount*.2));e.hp=Math.max(0,e.hp-amount);}
  hurt(p,damage){if(p.health<=0||p.invulnerable>0)return;p.health=Math.max(0,p.health-damage);p.invulnerable=.6;if(p.health===0){p.input={x:0,y:0,running:false};p.revive=null;}}
  // Khóa hướng khi báo đòn; mọi người cùng thấy một vùng nguy hiểm từ snapshot server.
  enemyStep(e,dt,alive){
    const def=CombatData.enemies[e.kind];e.phase=e.boss&&e.hp<e.maxHp*.5?2:1;e.timer-=dt;
    if(e.stage==='idle'){
      const target=alive.reduce((a,b)=>distance(e,a)<distance(e,b)?a:b);const d=distance(e,target);
      if(d> (e.boss?190:def.range)){
        Combat.moveSegment(e,(target.x-e.x)/d*def.speed*dt,(target.y-e.y)/d*def.speed*dt,(x,y)=>this.blocked(x,y));
      }else if(e.timer<=0){
        e.style=e.boss?def.pattern[e.cycle%def.pattern.length]:def.style;e.stage='windup';e.timer=(def.windup||.7)/(e.phase===2?1.2:1);
        const length=distance(e,target)||1;e.dx=(target.x-e.x)/length;e.dy=(target.y-e.y)/length;e.hit=[];
      }return;
    }
    if(e.stage==='windup'&&e.timer<=0){
      e.stage='active';e.timer=e.style==='charge'?.4:.18;
      if(e.style==='projectile'){
        const count=(def.projectileCount||1)+(e.phase===2?2:0),angle=Math.atan2(e.dy,e.dx);
        for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.25;this.projectiles.push({id:++this.serial,x:e.x,y:e.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,damage:def.damage,life:2.5});}
      }
    }
    if(e.stage==='active'){
      if(e.style==='charge')Combat.moveSegment(e,e.dx*def.chargeSpeed*dt,e.dy*def.chargeSpeed*dt,(x,y)=>this.blocked(x,y));
      for(const p of alive){
        const hit=e.style==='charge'?distance(e,p)<40:e.style!=='projectile'&&Combat.inCone(e,p,e.dx,e.dy,def.range,def.arc||140,(x,y)=>this.blocked(x,y));
        if(hit&&!e.hit.includes(p.id)){this.hurt(p,def.damage);e.hit.push(p.id);}
      }
      if(e.timer<=0){e.stage='recovery';e.timer=e.boss?2.2:def.recovery;e.cycle++;}return;
    }
    if(e.stage==='recovery'&&e.timer<=0){e.stage='idle';e.timer=.25;}
  }
  // Tiến thời gian bằng bước hữu hạn, không xử lý bù hàng giây khi server bị nghẽn.
  tick(dt,now=Date.now()){
    if(this.closed)return;if(this.paused){if(now>=this.hostDeadline)this.closed=true;return;}
    dt=Math.max(0,Math.min(.05,dt));
    for(const p of this.players.values()){
      p.cooldown=Math.max(0,p.cooldown-dt);p.dodgeCooldown=Math.max(0,p.dodgeCooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.pingCooldown=Math.max(0,(p.pingCooldown||0)-dt);
      if(!p.connected||p.health<=0){p.moving=false;continue;}
      p.stamina=Math.min(100,p.stamina+6*dt);
      if(p.inputAt&&Date.now()-p.inputAt>350)p.input={x:0,y:0,running:false};
      const oldX=p.x,oldY=p.y;let dx=p.input.x,dy=p.input.y,length=Math.hypot(dx,dy)||1,speed=p.input.running?297:180;
      if(p.dodge>0){[dx,dy]=dirs[p.dodgeDirection];length=1;speed=360*Math.min(dt,p.dodge)/dt;p.dodge=Math.max(0,p.dodge-dt);}
      if(dx||dy){p.direction=p.dodge>0?p.dodgeDirection:Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
        Combat.moveSegment(p,dx/length*speed*dt,0,(x,y)=>this.blocked(x,y));Combat.moveSegment(p,0,dy/length*speed*dt,(x,y)=>this.blocked(x,y));}
      const travel=Math.hypot(p.x-oldX,p.y-oldY);p.moving=travel>.01;p.travel+=travel;
      if(p.revive){const target=this.players.get(p.revive.target);if(!target||target.health>0||!target.connected||distance(p,target)>65||p.moving)p.revive=null;else{p.revive.time+=dt;if(p.revive.time>=2){target.health=35;target.invulnerable=1;p.revive=null;}}}
    }
    for(const fx of this.effects)fx.life-=dt;this.effects=this.effects.filter(f=>f.life>0).slice(-30);
    const alive=[...this.players.values()].filter(p=>p.health>0&&p.connected);
    if(this.chapterIndex<0){for(const p of alive)p.health=Math.min(100,p.health+12*dt);return;}
    if(!alive.length){this.toCamp();this.notice='Cả đội đã rút về trại. Checkpoint và chiến lợi phẩm đã lưu vẫn giữ nguyên.';return;}
    for(const e of this.mobs)if(e.hp>0)this.enemyStep(e,dt,alive);
    for(const shot of this.projectiles){
      shot.life-=dt;let target;
      Combat.moveSegment(shot,shot.vx*dt,shot.vy*dt,(x,y)=>this.blocked(x,y),()=>{
        target=(shot.friendly?this.mobs.filter(e=>e.hp>0):alive).find(a=>distance(a,shot)<23);
        if(target){if(shot.friendly)this.hitEnemy(target,shot.damage);else this.hurt(target,shot.damage);shot.life=0;return false;}return true;
      })|| (shot.life=0);
    }
    this.projectiles=this.projectiles.filter(s=>s.life>0).slice(-80);
    this.checkVictory();
  }
  checkVictory(){if(this.chapterIndex>=0&&this.roomIndex===4&&!this.finished&&this.mobs.length&&this.mobs.every(e=>e.hp<=0))this.victory();}
  victory(){
    const c=chapters[this.chapterIndex];this.finished=true;
    if(!this.world.cleared.includes(c.id))this.world.cleared.push(c.id);
    if(!this.world.abilities.includes(c.ability))this.world.abilities.push(c.ability);
    // Thưởng lần đầu theo nhân vật, không theo người nhặt; retry cùng sự kiện không cộng lần hai.
    for(const p of this.players.values())if(!p.character.victories.includes(c.id)){
      p.character.victories.push(c.id);p.character.coins+=100;p.character.materials+=8;
    }
    this.mark();this.notice=`Đã giải phóng ${c.name}. Năng lực: ${c.abilityName}. Trở về trại để phục hồi làng.`;
  }
  durable(){return {eventId:this.eventId,world:copy(this.world),characters:[...this.players.values()].map(p=>copy(p.character))};}
  saved(result){this.world=result.world;for(const c of result.characters){const p=this.players.get(c.id);if(p)p.character=c;}this.dirty=false;this.eventId=crypto.randomUUID();}
  snapshot(viewer){
    const p=this.players.get(viewer);return {v:D.protocol,type:'state',code:this.code,host:this.host,you:viewer,paused:this.paused,hostDeadline:this.hostDeadline,closed:this.closed,chapter:this.chapterIndex,room:this.roomIndex,world:copy(this.world),finished:this.finished,puzzleSolved:this.puzzleSolved,switches:this.switches,encounterSize:this.encounterSize,notice:this.notice||'',marked:this.marked,
      players:[...this.players.values()].map(a=>({id:a.id,name:a.name,x:a.x,y:a.y,health:a.health,stamina:Math.round(a.stamina),direction:a.direction,moving:a.moving,running:a.input.running,travel:a.travel,seq:a.seq,connected:a.connected,weapon:a.character.weapon,revive:a.revive})),
      character:p?copy(p.character):null,mobs:this.mobs.map(e=>{const def=CombatData.enemies[e.kind];return {...copy(e),tell:{range:def.range,arc:def.arc||140,radius:40,chargeLength:(def.chargeSpeed||0)*.4,projectileRange:550,projectileArc:Math.max(15,((def.projectileCount||1)+(e.phase===2?2:0)-1)*.25*180/Math.PI+12)}};}),projectiles:copy(this.projectiles),effects:copy(this.effects)};
  }
}
module.exports={Room,character,world,chapters,weapons};
