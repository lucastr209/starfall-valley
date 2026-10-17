(function(){
  'use strict';
  const D=globalThis.StardropAwakeningData,$=id=>document.getElementById(id),canvas=$('awakening-canvas'),ctx=canvas.getContext('2d');
  const backend=globalThis.STARDROP_CONFIG?.coopUrl||location.origin;
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname),query=new URLSearchParams(location.search);
  const AUTH='starfall-awakening-auth',ROOM='starfall-awakening-room',VERIFIER='starfall-awakening-pkce';
  let config,session,state,previous,receivedAt=0,socket,sequence=0,keys=new Set(),touch=new Set(),run=false,retry=0,retryTimer,refreshTimer,closed=false,lastNotice='',partyKey='',chaptersKey='',audio,sound=false,musicAt=0,refreshing,authEpoch=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tell(message){$('message').textContent=message;}
  function read(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
  function remember(key,value){if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify(value));}
  function resetInput(){keys.clear();touch.clear();run=false;$('run').setAttribute('aria-pressed','false');sendInput();}
  function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
  function command(action,extra={}){
    if(socket?.readyState!==WebSocket.OPEN||!state)return tell('Cần kết nối với nhóm trước.');
    socket.send(JSON.stringify({v:1,type:'command',action,...extra}));
  }
  async function request(path,body){
    const response=await fetch(config.supabaseUrl+'/auth/v1/'+path,{method:'POST',headers:{apikey:config.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    const data=await response.json();if(!response.ok)throw new Error('Đăng nhập chưa thành công. Hãy thử lại.');return data;
  }
  function saveSession(data){
    authEpoch++;
    session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600)};remember(AUTH,session);authenticated();
  }
  function authenticated(){
    $('login').hidden=!!session;$('room-actions').hidden=!session;$('logout').hidden=!session;
    $('account').textContent=session?'Chọn chuyến đi của bạn':'Đăng nhập để khởi hành';
    if(session&&!session.qa){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(logout),Math.max(1000,(session.expires_at*1000-Date.now())-60000));}
  }
  // PKCE gắn authorization code với verifier của tab; không nhận token hoặc user ID từ URL.
  async function login(){
    const bytes=crypto.getRandomValues(new Uint8Array(48));const verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
    const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    remember(VERIFIER,verifier);const url=new URL(config.supabaseUrl+'/auth/v1/authorize');
    url.searchParams.set('provider','google');url.searchParams.set('redirect_to',location.origin+'/awakening.html');url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','s256');location.assign(url.href);
  }
  async function refresh(){
    if(session?.qa)return;if(refreshing)return refreshing;
    const current=session,epoch=authEpoch;
    refreshing=request('token?grant_type=refresh_token',{refresh_token:current.refresh_token}).then(data=>{
      if(session===current&&authEpoch===epoch)saveSession(data);
    }).catch(error=>{if(session===current&&authEpoch===epoch)throw error;}).finally(()=>{refreshing=null;});return refreshing;
  }
  function logout(){
    authEpoch++;
    if(socket?.readyState===WebSocket.OPEN)command('leave');closed=true;clearTimeout(retryTimer);clearTimeout(refreshTimer);socket?.close();
    remember(AUTH,null);remember(ROOM,null);session=null;state=null;$('expedition').hidden=true;$('lobby').hidden=false;$('welcome').hidden=false;authenticated();tell('Đã đăng xuất. Tiến trình online đã lưu vẫn giữ nguyên.');
  }
  function connect(code){
    if(!session)return tell('Hãy đăng nhập trước.');
    closed=false;socket?.close();const ws=new WebSocket(backend.replace(/^http/,'ws')+'/coop');socket=ws;let welcomed=false;
    tell('Đang mở chuyến đi…');
    ws.addEventListener('open',()=>ws.send(JSON.stringify({v:1,type:'hello',token:session.access_token,...(code?{code}: {})})));
    ws.addEventListener('message',event=>{
      if(socket!==ws)return;let m;try{m=JSON.parse(event.data);}catch{return;}
      if(m.v!==1)return;
      if(m.type==='error'){tell(m.message);tone(180,.08);if(!welcomed){closed=true;remember(ROOM,null);state=null;resetInput();$('expedition').hidden=true;$('lobby').hidden=false;$('welcome').hidden=false;}return;}
      if(m.type==='closed'){
        closed=true;remember(ROOM,null);state=null;resetInput();$('expedition').hidden=true;$('lobby').hidden=false;$('welcome').hidden=false;tell(m.message);return;
      }
      if(m.type!=='state')return;
      welcomed=true;previous=state;state=m;receivedAt=performance.now();retry=0;sequence=Math.max(sequence,m.players.find(p=>p.id===m.you)?.seq||0);
      if(previous&&(previous.chapter!==m.chapter||previous.room!==m.room||m.paused&&!previous.paused))resetInput();
      if(!previous)tell('Nhóm đã sẵn sàng. Chia sẻ mã '+m.code+' để mời bạn.');
      remember(ROOM,m.code);$('expedition').hidden=false;$('lobby').hidden=true;$('welcome').hidden=true;
      if(m.notice&&m.notice!==lastNotice){lastNotice=m.notice;tell(m.notice);tone(660,.2);}
      update();
    });
    ws.addEventListener('close',async event=>{
      if(socket!==ws||closed)return;
      resetInput();if(event.code===4001){closed=true;remember(ROOM,null);tell('Nhân vật đã được mở trên thiết bị khác.');state=null;$('expedition').hidden=true;$('lobby').hidden=false;return;}
      const saved=read(ROOM);if(!saved)return;
      $('pause').hidden=false;$('pause').textContent='Mất kết nối. Đang tìm lại nhóm…';tell('Đang kết nối lại. Tiến trình đã lưu vẫn an toàn.');
      clearTimeout(retryTimer);retryTimer=setTimeout(async()=>{try{if(!session.qa&&session.expires_at*1000<Date.now()+60000)await refresh();connect(saved);}catch{logout();}},Math.min(5000,500*2**retry++));
    });
    ws.addEventListener('error',()=>tell('Không kết nối được trạm thám hiểm. Hãy thử lại.'));
  }
  function action(name){
    if(name==='revive'){
      const me=state?.players.find(p=>p.id===state.you);const down=state?.players.filter(p=>p.health===0&&p.connected).sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y))[0];
      if(down)command('revive',{target:down.id});else tell('Chưa có đồng đội cần cứu.');return;
    }
    command(name);
  }
  function sendInput(){
    if(!state||socket?.readyState!==WebSocket.OPEN)return;
    const has=(...values)=>values.some(v=>keys.has(v)||touch.has(v));
    const x=Number(has('d','arrowright','right'))-Number(has('a','arrowleft','left'));
    const y=Number(has('s','arrowdown','down'))-Number(has('w','arrowup','up'));
    command('input',{seq:++sequence,x,y,running:run||keys.has('shift')});
  }
  function update(){
    const me=state.players.find(p=>p.id===state.you),host=state.host===state.you,c=D.chapters[state.chapter];
    $('group-code').textContent=state.code;$('chapter-label').textContent=c?c.name+' · PHÒNG '+(state.room+1)+'/5':'LÀNG HỒI SINH · THẾ GIỚI CỦA CHỦ PHÒNG';
    $('room-title').textContent=c?c.rooms[state.room]:'Trại Ánh Sao';$('vitals').textContent='♥ '+Math.ceil(me.health)+' · ⚡ '+me.stamina;$('weapon-label').textContent=D.weapons[me.weapon].name;
    $('pause').hidden=!state.paused;if(state.paused)$('pause').textContent='Đang chờ chủ phòng… Nhóm được giữ tối đa 60 giây.';
    $('camp-panel').hidden=state.chapter!==-1;$('wallet').textContent=`${state.character.coins} xu · ${state.character.materials} vật liệu · Kho làng: ${state.world.stock}/8`;
    $('weapon').value=me.weapon;$('contribute').disabled=state.character.materials<8;$('build').disabled=!host||state.world.stock<8||!D.chapters.some(ch=>state.world.cleared.includes(ch.id)&&!state.world.buildings.includes(ch.id));
    for(const b of document.querySelectorAll('[data-action="advance"], [data-action="camp"]'))b.disabled=!host||state.chapter<0;
    $('village-story').textContent=state.world.buildings.length?state.world.buildings.map(id=>D.chapters.find(ch=>ch.id===id).building).join(' · ')+'. Những cư dân đã trở về.':'Làng đang chờ những hạt sáng đầu tiên từ chuyến đi.';
    const pk=JSON.stringify(state.players.map(p=>[p.id,p.health,p.connected,p.revive]));
    if(pk!==partyKey){partyKey=pk;$('party').replaceChildren(...state.players.map(p=>{const row=node('div','','member');row.append(node('b',(p.id===state.host?'♛ ':'')+p.name+(p.id===state.you?' · Bạn':'')),node('small',!p.connected?'Mất mạng':p.health===0?'Cần cứu':Math.ceil(p.health)+' ♥','health'));return row;}));}
    const ck=JSON.stringify([state.world,host,state.chapter]);if(ck!==chaptersKey){chaptersKey=ck;$('chapters').replaceChildren(...D.chapters.map((ch,i)=>{
      const cleared=state.world.cleared.includes(ch.id),open=i===0||state.world.cleared.includes(D.chapters[i-1].id),el=node('div','','chapter');
      el.append(node('strong',(cleared?'✓ ':open?'◇ ':'🔒 ')+ch.name),node('small',cleared?ch.abilityName+' · '+(state.world.buildings.includes(ch.id)?ch.building:'Công trình chờ xây'):ch.subtitle));
      const button=node('button',cleared?'Khám phá lại →':'Khởi hành →');button.disabled=!host||!open||state.chapter!==-1;button.onclick=()=>command('travel',{chapter:i});el.append(button);return el;
    }));}
    let objective='Chọn vũ khí, chia sẻ mã phòng để mời bạn. Chủ phòng chọn chương để cả nhóm khởi hành.';
    if(c){if(state.finished)objective='Boss đã ngã! Phần thưởng đã lưu. Chủ phòng chọn Về trại, góp 8 vật liệu và xây '+c.building+'.';
      else if(state.room===1)objective=state.puzzleSolved?'Cơ chế đã mở. Chủ phòng đến cổng phía đông và chọn Qua cổng.':c.clue;
      else if(state.room===3)objective=c.resident+': “'+c.dialogue+'” Đến gần trại, nhấn Tương tác để hồi phục rồi tiếp tục.';
      else objective=state.mobs.some(m=>m.hp>0)?'Hạ toàn bộ người canh. Né vùng vàng, phản công khi boss lộ lõi màu xanh.': 'Phòng đã an toàn. Chủ phòng đến cổng phía đông và chọn Qua cổng.';}
    if(me.health===0)objective='Bạn bị hạ. Đồng đội đến gần và nhấn Cứu; giữ vị trí trong hai giây. Cả đội bị hạ sẽ trở về trại.';
    $('objective').textContent=objective;
  }
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function text(str,x,y,color='#f6edcf',size=12){ctx.fillStyle=color;ctx.font=size+'px system-ui';ctx.textAlign='center';ctx.fillText(str,x,y);}
  function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function tree(x,y,color){rect(x-6,y-18,12,42,'#745d46');circle(x,y-45,33,color);circle(x-18,y-30,25,color);circle(x+18,y-30,25,color);rect(x-15,y-52,7,5,'#92a66f66');}
  function house(x,y,color,label){rect(x-38,y-50,76,50,'#d4bf86');ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-49,y-48);ctx.lineTo(x,y-87);ctx.lineTo(x+49,y-48);ctx.fill();rect(x-8,y-28,16,28,'#584332');rect(x-29,y-34,12,12,'#f5d47f');text(label,x,y+20,'#e5d9a8',11);}
  function draw(now){
    requestAnimationFrame(draw);if(!state||document.hidden)return;
    const c=D.chapters[state.chapter],t=reduced?0:now/1000,alpha=Math.min(1,(now-receivedAt)/100);
    rect(0,0,800,560,c?c.floor:'#527052');
    // Họa tiết cố định theo tọa độ, không dùng random mỗi frame để tránh nhấp nháy.
    for(let y=0;y<560;y+=24)for(let x=0;x<800;x+=24){rect(x+((y*3+x)%11),y+7,3,2,c?'#e1e7ce18':'#a4c57c33');}
    rect(20,255,760,42,c?'#a8a38544':'#b4aa7466');rect(15,20,770,12,c?c.color:'#314c38');rect(15,530,770,14,c?c.color:'#314c38');
    if(c){
      for(const o of D.obstacles[state.room]){rect(o.x+5,o.y+9,o.w,o.h,'#1b302b77');rect(o.x,o.y,o.w,o.h,c.color);rect(o.x,o.y,o.w,7,c.accent+'66');}
      if(state.room===1)D.switches.forEach((s,i)=>{circle(s.x,s.y,42,state.puzzleSolved?'#a8d99b44':'#e8cf7144');rect(s.x-17,s.y-32,34,42,c.color);text(i===0?'☘':'☽',s.x,s.y-4,c.accent,25);text(i===0?'BIA TÂY':'BIA ĐÔNG',s.x,s.y+29,c.accent,10);});
      if(state.room===3){circle(400,350,26,'#f4c36a44');text('✦',400,358,'#ffdb87',30);text(c.resident+' · Tương tác để nghỉ',400,400,'#fff2c4',13);}
      if(state.room<4){rect(752,230,26,90,state.mobs.some(m=>m.hp>0)||(state.room===1&&!state.puzzleSolved)?'#b6a27a':'#c6e8b0');text('→',763,282,'#253d30',25);}
      if(state.finished){text('✦ '+c.name.toUpperCase()+' ĐÃ THỨC TỈNH ✦',400,100,c.accent,19);text('Phần thưởng đã lưu · Trở về làng',400,127,'#fff4d8',13);}
    }else{
      house(125,170,'#a56a4f','Trại Ánh Sao');tree(70,420,'#2c543e');tree(730,410,'#2e5742');tree(720,130,'#284c39');
      D.chapters.forEach((ch,i)=>{const x=320+i*180;if(state.world.buildings.includes(ch.id))house(x,465,['#6b915a','#5b8193','#84749a'][i],ch.building);else{rect(x-35,435,70,25,'#3c563e');text(ch.building,x,485,'#c2cba5',10);}});
      D.secrets.forEach((s,i)=>{const open=state.world.abilities.includes(D.chapters[i].ability),found=state.world.secrets.includes(D.chapters[i].id);
        rect(s.x-48,s.y-90,96,116,i===1?'#467d88':i===2?'#8d80a0':'#769765');
        for(const wall of s.walls)rect(wall.x,wall.y,wall.w,wall.h,'#2a4538');
        if(!open){rect(s.gate.x,s.gate.y,s.gate.w,s.gate.h,i===0?'#825f43':i===1?'#214f6e':'#554d75');text(i===0?'♧':i===1?'≈':'◇',s.x,s.y+7,'#c4c9a5',24);}
        else rect(s.gate.x,s.gate.y,s.gate.w,s.gate.h,'#d5c28b');
        rect(s.chest.x-12,s.chest.y-12,24,19,found?'#6a7156':'#e0bf6e');rect(s.chest.x-2,s.chest.y-12,4,19,'#8c7243');
        text(found?'Đã khám phá':s.name,s.x,s.y+51,'#d8d8b8',10);});
    }
    // Vùng báo đòn luôn ở trên nền và dưới nhân vật; màu xanh là thời điểm phản công.
    for(const e of state.mobs)if(e.hp>0){
      if(e.stage==='windup'||e.stage==='active'){
        ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.atan2(e.dy??0,e.dx??1));ctx.fillStyle=e.stage==='windup'?'#ffda5a70':'#ff775b90';ctx.strokeStyle='#ffea82';ctx.lineWidth=2;
        const tell=e.tell;
        if(e.style==='charge'){ctx.fillRect(-tell.radius,-tell.radius,tell.chargeLength+2*tell.radius,2*tell.radius);ctx.strokeRect(-tell.radius,-tell.radius,tell.chargeLength+2*tell.radius,2*tell.radius);}
        else{const arc=(e.style==='projectile'?tell.projectileArc:tell.arc)*Math.PI/360,range=e.style==='projectile'?tell.projectileRange:tell.range;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,range,-arc,arc);ctx.closePath();ctx.fill();ctx.stroke();}ctx.restore();
      }
      if(e.boss&&e.stage==='recovery')circle(e.x,e.y,45,'#a9efcf44');
    }
    for(const e of state.mobs)if(e.hp>0){
      const size=e.boss?31:19,colors={slime:'#c0ce80',sprout:'#acc36d',warden:'#afa799',forestBoss:'#b7a56d',tideBoss:'#86c7cf',skyBoss:'#c3ace2'};
      circle(e.x,e.y+8,size,'#21342b55');rect(e.x-size,e.y-size,size*2,size*2,colors[e.kind]);rect(e.x-size+4,e.y-size+5,size*2-8,5,'#d9e5b788');rect(e.x-10,e.y-5,6,6,'#2a352a');rect(e.x+5,e.y-5,6,6,'#2a352a');
      if(e.boss){text(e.kind==='forestBoss'?'Hộ Vệ Rêu Cổ':e.kind==='tideBoss'?'Hộ Vệ Sóng Ngầm':'Hộ Vệ Thiên Thạch',e.x,e.y-53,'#fff3d8',12);text('PHA '+e.phase+(e.stage==='recovery'?' · LỘ LÕI':''),e.x,e.y+49,e.stage==='recovery'?'#c3ffda':'#ffe4a3',11);}
      rect(e.x-28,e.y-size-14,56,5,'#243d30');rect(e.x-28,e.y-size-14,56*e.hp/e.maxHp,5,'#ebad84');if(e.id===state.marked)text('⚑',e.x,e.y-size-27,'#fff0a3',23);
    }
    for(const p of [...state.players].sort((a,b)=>a.y-b.y)){
      const before=previous?.chapter===state.chapter&&previous?.room===state.room?previous.players.find(a=>a.id===p.id):null;
      const x=before&&Math.hypot(before.x-p.x,before.y-p.y)<80?before.x+(p.x-before.x)*alpha:p.x,y=before&&Math.hypot(before.x-p.x,before.y-p.y)<80?before.y+(p.y-before.y)*alpha:p.y;
      ctx.save();ctx.globalAlpha=p.connected?1:.4;
      if(p.health===0){circle(x,y,22,'#c3897866');text('♡',x,y+4,'#ffc4aa',25);}else globalThis.StardropActors.draw(ctx,{id:'player',isPlayer:true,x,y,direction:p.direction,distance:p.travel,moving:p.moving,running:p.running,motionWeight:p.moving?1:0,runWeight:p.running?1:0,reducedMotion:reduced,time:t,shirt:p.id===state.you?'#e2b46e':'#7cb6ac'});
      rect(x-22,y-70,44,4,'#20362a');rect(x-22,y-70,44*p.health/100,4,p.id===state.you?'#e7ce87':'#8ed5bd');text(p.name,x,y-79,p.id===state.you?'#ffe3a5':'#deefdf',11);
      if(p.revive)text('Cứu '+Math.min(100,Math.round(p.revive.time/2*100))+'%',x,y+30,'#d3f4d5',12);ctx.restore();
    }
    for(const s of state.projectiles){circle(s.x,s.y,s.friendly?4:7,s.friendly?'#ffe5a0':'#ffbb8d');}
    for(const f of state.effects){if(['attack','help','wait'].includes(f.kind)){circle(f.x,f.y,35,'#f0da9055');text(f.kind==='help'?'♡':f.kind==='wait'?'◷':'⚑',f.x,f.y-30,'#ffebad',25);}else{ctx.strokeStyle='#f5e2a9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,32,0,Math.PI);ctx.stroke();}}
  }
  function tone(frequency,duration=.12){if(!sound||!audio)return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='triangle';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+duration);}
  $('sound').onclick=async()=>{try{audio ||= new (window.AudioContext||window.webkitAudioContext)();await audio.resume();sound=!sound;$('sound').textContent='Âm thanh: '+(sound?'Bật':'Tắt');$('sound').setAttribute('aria-pressed',String(sound));tone(440,.3);}catch{tell('Trình duyệt chưa mở được âm thanh.');}};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else tell('Hãy mở game từ Màn hình chính để dùng trọn màn hình.');}catch{tell('Trình duyệt chưa cho phép toàn màn hình.');}};
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Thu màn hình':'Toàn màn hình';});
  $('login').onclick=()=>login().catch(e=>tell(e.message));$('logout').onclick=logout;
  $('qa-login').onclick=()=>{saveSession({qa:true,access_token:'qa:'+$('qa-user').value});tell('Nhân vật QA riêng đã sẵn sàng.');};
  $('create').onclick=()=>connect();$('join-form').onsubmit=e=>{e.preventDefault();connect($('room-code').value.trim().toUpperCase());};
  $('leave').onclick=()=>command('leave');$('weapon').onchange=()=>command('weapon',{weapon:$('weapon').value});$('contribute').onclick=()=>command('contribute',{amount:8});$('build').onclick=()=>command('build');
  $('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(state.code);tell('Đã sao chép mã '+state.code+'. Gửi mã này cho bạn bè.');}catch{tell('Mã nhóm: '+state.code);}};
  $('run').onclick=()=>{run=!run;$('run').setAttribute('aria-pressed',String(run));sendInput();};
  for(const b of document.querySelectorAll('[data-action]'))b.addEventListener('click',()=>action(b.dataset.action));
  for(const b of document.querySelectorAll('[data-ping]'))b.onclick=()=>command('ping',{kind:b.dataset.ping,target:state?.mobs.find(m=>m.hp>0)?.id});
  for(const b of document.querySelectorAll('[data-dir]')){
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.dir);sendInput();});
    const release=()=>{touch.delete(b.dataset.dir);sendInput();};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  }
  document.addEventListener('keydown',e=>{
    if(!state||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const key=e.key.toLowerCase();
    if([' ','v','e','r','w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){e.preventDefault();keys.add(key);sendInput();}
    if(!e.repeat){if(key===' ')action('attack');if(key==='v')action('dodge');if(key==='e')action('interact');if(key==='r')action('revive');}
  });
  document.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());sendInput();});window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
  setInterval(()=>{if(!document.hidden)sendInput();if(sound&&state&&!document.hidden&&performance.now()-musicAt>1800){musicAt=performance.now();const notes=state.chapter===1?[293.66,349.23,440,523.25]:state.chapter===2?[261.63,311.13,392,466.16]:[261.63,329.63,392,523.25];tone(notes[Math.floor(musicAt/1800)%4],1.2);}},100);
  async function init(){
    try{
      const wakeTimer=setTimeout(()=>{tell('Đang đánh thức trạm thám hiểm (khoảng 30 giây), vui lòng chờ…');},3000);
      let response;
      try{response=await fetch(backend+'/coop/config',{signal:AbortSignal.timeout(50000)});}finally{clearTimeout(wakeTimer);}
      if(!response.ok)throw new Error();config=await response.json();
      if(config.v!==1)throw new Error();const qa=config.qa&&local&&query.get('qa')==='1';$('qa-picker').hidden=!qa;
      if(qa){$('qa-user').value=query.get('user')||'1';$('login-note').textContent='QA localhost · Nhân vật và phòng thử tách hoàn toàn save Legacy.';}
      $('login').disabled=qa||!config.supabaseUrl||!config.supabaseKey;
      if(query.has('error')){history.replaceState({},'',location.pathname);throw new Error('Đăng nhập đã bị hủy. Hãy thử lại.');}
      if(query.has('code')){
        const verifier=read(VERIFIER);if(!verifier)throw new Error('Phiên đăng nhập đã hết. Hãy đăng nhập lại.');
        const code=query.get('code');history.replaceState({},'',location.pathname);saveSession(await request('token?grant_type=pkce',{auth_code:code,code_verifier:verifier}));remember(VERIFIER,null);
      }else{session=read(AUTH);if(session?.qa&&!qa){session=null;remember(AUTH,null);}if(session&&!session.qa&&session.expires_at*1000<Date.now()+60000)await refresh();authenticated();}
      tell(qa?'Chọn một nhân vật QA để thử solo hoặc mở nhiều tab cùng nhóm.':config.supabaseUrl?'Trạm đã sẵn sàng. Đăng nhập để bắt đầu.':'Chế độ co-op chưa được cấu hình. Hành trình Legacy vẫn sẵn sàng.');
      const code=read(ROOM);if(session&&code)connect(code);
    }catch(e){tell(e.message||'Trạm co-op chưa sẵn sàng. Bạn có thể tiếp tục hành trình Legacy.');}
  }
  requestAnimationFrame(draw);init();
})();
