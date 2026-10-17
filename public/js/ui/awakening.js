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
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));}
  function text(str,x,y,color='#f6edcf',size=12){ctx.fillStyle=color;ctx.font='bold '+size+'px system-ui';ctx.textAlign='center';ctx.fillText(str,Math.floor(x),Math.floor(y));}
  function circle(x,y,r,color){ctx.beginPath();ctx.arc(Math.floor(x),Math.floor(y),r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function pixelEllipse(x,y,w,h,color){rect(x-w/2+4,y-h/2,w-8,h,color);rect(x-w/2,y-h/2+3,w,h-6,color);}
  function dropShadow(x,y,w,h,alpha=0.35){rect(x-w/2+3,y-h/2,w-6,h,`rgba(18,32,24,${alpha*0.6})`);rect(x-w/2,y-h/2+2,w,h-4,`rgba(18,32,24,${alpha})`);}

  // Cây pixel đa tầng với bóng đổ dither và tán lá đung đưa
  function drawTree(x,y,size=1,tone=0,anim=0){
    ctx.save();ctx.translate(Math.floor(x),Math.floor(y));ctx.scale(size,size);
    dropShadow(5,2,54,15,0.4);
    rect(-5,-44,10,45,'#563f2e');rect(-2,-38,4,38,'#8a6542');rect(2,-32,3,30,'#3a2c20');
    const sway=reduced?0:Math.round(Math.sin(anim*1.2+x*0.03)*2);
    ctx.save();ctx.translate(sway,0);
    const pal=[['#2c5344','#3f7354','#5c9966','#8eb875'],['#345c52','#488065','#66a875','#9ec27e'],['#3c5f3c','#57854a','#78a35b','#b1bf76']][tone%3];
    rect(-18,-76,36,54,pal[0]);rect(-28,-68,56,38,pal[0]);rect(-34,-58,68,20,pal[0]);
    rect(-24,-71,44,36,pal[1]);rect(-30,-59,52,21,pal[1]);rect(-14,-81,28,18,pal[1]);
    rect(-15,-74,26,18,pal[2]);rect(-24,-61,20,14,pal[2]);rect(8,-63,12,10,pal[2]);
    rect(-10,-73,10,5,pal[3]);rect(-21,-58,7,4,pal[3]);rect(1,-67,7,4,pal[3]);
    rect(-29,-33,12,3,pal[0]);rect(13,-25,14,4,pal[0]);
    ctx.restore();ctx.restore();
  }

  // Nhà gỗ Trại Ánh Sao với vách gỗ, ngói cedar, ống khói nhả khói và đèn lồng ấm áp
  function drawCabin(x,y,anim=0){
    dropShadow(x+8,y+6,120,24,0.45);
    // Nền móng đá
    rect(x-52,y-8,104,16,'#4e5445');rect(x-50,y-6,100,5,'#6f7762');
    // Vách gỗ cabin
    rect(x-46,y-50,92,44,'#936b47');rect(x+26,y-50,20,44,'#6e4c30');
    for(let i=0;i<4;i++)rect(x-46,y-48+i*11,92,2,'#4e341f');
    // Trụ gỗ góc
    rect(x-46,y-50,6,44,'#4e341f');rect(x+40,y-50,6,44,'#3e2817');
    // Mái ngói xếp tầng
    for(let i=0;i<6;i++){const ins=(5-i)*7;rect(x-54+ins,y-86+i*7,108-ins*2,8,'#b55b46');rect(x-52+ins,y-84+i*7,104-ins*2,2,'#d47c66');}
    rect(x-54,y-46,108,6,'#5a281d');
    // Ống khói đá & khói bay
    rect(x+22,y-96,14,24,'#5c5f53');rect(x+20,y-98,18,5,'#767a6d');
    if(!reduced){const smokeY=(anim*16)%30;circle(x+29,y-102-smokeY,4+smokeY*0.18,'rgba(230,235,225,0.45)');}
    // Cửa gỗ & bậc thềm
    rect(x-11,y-26,22,26,'#4e341f');rect(x-9,y-24,18,24,'#68462b');rect(x+3,y-14,3,3,'#d6b35d');
    // Cửa sổ vàng ấm áp
    rect(x-38,y-38,18,16,'#2e1f13');rect(x-36,y-36,14,12,'#f8dc74');rect(x-30,y-36,2,12,'#5a3a1f');rect(x-36,y-31,14,2,'#5a3a1f');
    // Đèn lồng treo trước hiên
    rect(x+16,y-36,3,8,'#332214');rect(x+13,y-28,9,11,'#ffcd58');circle(x+17,y-23,12,'rgba(255,210,80,0.18)');
    text('Trại Ánh Sao',x,y+24,'#f3e6c0',11);
  }

  // Lửa trại nhấp nháy với đốm lửa bốc lên
  function drawCampfire(x,y,anim=0){
    dropShadow(x,y+2,42,12,0.4);
    // Vòng đá lửa
    for(let a=0;a<Math.PI*2;a+=Math.PI/4){rect(x+Math.cos(a)*14-3,y+Math.sin(a)*8-3,6,6,'#596058');rect(x+Math.cos(a)*14-2,y+Math.sin(a)*8-2,4,4,'#7a8378');}
    // Củi cháy
    rect(x-11,y-4,22,6,'#3d281a');rect(x-4,y-11,8,18,'#2a1c12');
    // Ngọn lửa nhảy múa
    const f=reduced?0:Math.sin(anim*8)*2,f2=reduced?0:Math.cos(anim*11)*1.5;
    circle(x,y-6+f*0.5,10+f2,'#ff7830');circle(x,y-9+f,7,'#ffa938');circle(x,y-11+f,4,'#fff07a');
    if(!reduced){const spark=(anim*22)%18;rect(x+f*2-1,y-16-spark,2,2,'#ffdf6d');}
  }

  // Các công trình phục hồi làng (Nhà Ươm Sao, Bến Hải Đăng, Đài Cầu Sao)
  function drawVillageBuilding(x,y,ch,built,anim=0){
    if(!built){
      // Khung gỗ công trình đang chờ xây
      dropShadow(x,y+4,80,18,0.3);
      rect(x-34,y-42,68,44,'#46352777');
      for(let i=0;i<4;i++)rect(x-34+i*22,y-42,4,44,'#8b6743');
      rect(x-34,y-42,68,4,'#8b6743');rect(x-34,y-20,68,3,'#6e5033');
      text('✦ CÔNG TRÌNH CHỜ XÂY ✦',x,y-22,'#f5d378',9);
      text(ch.building,x,y+20,'#c8d0b2',11);
      return;
    }
    dropShadow(x+6,y+6,94,22,0.45);
    if(ch.id==='deepwood'){
      // Nhà Ươm Sao: Nhà kính khung gỗ phủ rêu xanh
      rect(x-40,y-46,80,48,'#3d483b');rect(x-36,y-42,72,44,'#608f7588');
      for(let i=0;i<4;i++)rect(x-36+i*24,y-42,3,44,'#47664f');
      rect(x-36,y-22,72,3,'#47664f');
      for(let i=0;i<5;i++){const ins=(4-i)*6;rect(x-44+ins,y-76+i*6,88-ins*2,7,'#476d4f');rect(x-42+ins,y-74+i*6,84-ins*2,2,'#73a67d');}
      rect(x-10,y-26,20,26,'#2c3d31');text('🌱',x,y-8,'#a7f3d0',12);
      text(ch.building,x,y+24,'#d8f5d0',11);
    }else if(ch.id==='tideisles'){
      // Bến Hải Đăng: Tháp đá ngọc bích ven biển
      rect(x-34,y-50,68,52,'#456573');rect(x-30,y-46,60,48,'#6c94a3');
      rect(x-14,y-86,28,40,'#456573');rect(x-10,y-82,20,36,'#89b8c7');
      // Đèn hải đăng quay
      rect(x-16,y-96,32,12,'#e07a7a');circle(x,y-90,14,'rgba(165,243,252,0.3)');circle(x,y-90,6,'#fffbeb');
      rect(x-10,y-26,20,26,'#253b45');text('⚓',x,y-8,'#93c5fd',12);
      text(ch.building,x,y+24,'#cce7f5',11);
    }else{
      // Đài Cầu Sao: Kiến trúc tháp thiên văn tím huyền ảo
      rect(x-38,y-48,76,50,'#3b2f4a');rect(x-34,y-44,68,46,'#594770');
      for(let i=0;i<5;i++){const ins=(4-i)*6;rect(x-42+ins,y-78+i*6,84-ins*2,7,'#644b82');rect(x-40+ins,y-76+i*6,80-ins*2,2,'#a884d6');}
      // Ngôi sao pha lê trên đỉnh
      const glow=reduced?0:Math.sin(anim*4)*3;
      circle(x,y-86+glow,10,'rgba(232,121,249,0.3)');text('✦',x,y-82+glow,'#f5d0fe',15);
      rect(x-10,y-26,20,26,'#261b33');text('🔭',x,y-8,'#f0abfc',12);
      text(ch.building,x,y+24,'#eedcfc',11);
    }
  }

  // Khu vực lối bí mật & Rương kho báu
  function drawSecretPassage(s,i,open,found,anim=0){
    dropShadow(s.x,s.y-10,108,24,0.35);
    // Vách đá cổ kính bao quanh
    for(const w of s.walls){rect(w.x,w.y,w.w,w.h,'#344136');rect(w.x+1,w.y+1,w.w-2,w.h-2,'#516353');}
    // Cửa chắn năng lực
    if(!open){
      rect(s.gate.x,s.gate.y,s.gate.w,s.gate.h,i===0?'#4a3320':i===1?'#284e66':'#483b63');
      if(i===0){
        // Rễ cây chằng chịt
        for(let r=0;r<4;r++)rect(s.gate.x+6+r*22,s.gate.y-4,14,24,'#6e492b');
        text('♧ RỄ CỔ CHẮN',s.x,s.y+7,'#e2c293',11);
      }else if(i===1){
        // Dòng nước xoáy
        rect(s.gate.x,s.gate.y-2,s.gate.w,s.gate.h+4,'#2d637a');
        text('≈ NƯỚC SÂU CHẮN',s.x,s.y+7,'#a5f3fc',11);
      }else{
        // Cầu sao vỡ nát
        rect(s.gate.x,s.gate.y-2,s.gate.w,s.gate.h+4,'#4c3866');
        text('◇ CẦU SAO ĐỨT',s.x,s.y+7,'#e9d5ff',11);
      }
    }else{
      // Lối đã mở sạch sẽ
      rect(s.gate.x,s.gate.y,s.gate.w,s.gate.h,'#839775');
      rect(s.gate.x+2,s.gate.y+2,s.gate.w-4,s.gate.h-4,'#a6ba98');
    }
    // Rương kho báu gỗ bọc đồng
    const cx=s.chest.x,cy=s.chest.y;
    dropShadow(cx,cy+6,26,10,0.3);
    rect(cx-12,cy-10,24,18,found?'#4a4537':'#9c6f3d');
    rect(cx-10,cy-8,20,14,found?'#665e49':'#c99557');
    rect(cx-12,cy-10,24,3,'#e5c158');rect(cx-12,cy-2,24,2,'#734e28');
    rect(cx-3,cy-3,6,6,found?'#544d38':'#ffe07a');
    text(found?'✓ Đã nhận':s.name,s.x,s.y+34,found?'#8da88a':'#e8dcbe',10);
  }

  // Quái thường chuẩn Pixel Art (Slime, Sprout, Warden)
  function drawMobPixel(m,x,y,anim=0){
    const def={color:m.kind==='sprout'?'#6b9468':m.kind==='warden'?'#8a6e4d':'#7ca878',maxHp:m.maxHp};
    pixelEllipse(x+3,y+4,38,10,'#20322b66');
    rect(x-19,y-18,38,16,def.color);rect(x-14,y-28,28,18,def.color);rect(x-9,y-30,18,6,'#d4d5ab');
    if(m.kind==='sprout'){
      rect(x-16,y-6,32,4,'#8e6393');rect(x-11,y-27,22,3,'#d8addd');
      const footWaddle=reduced?0:Math.round(Math.sin(anim*7+m.id.charCodeAt(m.id.length-1))*2);
      rect(x-12+footWaddle,y-2,6,4,'#5e4635');rect(x+6-footWaddle,y-2,6,4,'#5e4635');
      const leafSway=reduced?0:Math.round(Math.sin(anim*4)*2);
      rect(x-3,y-48,6,22,'#4e7a4b');rect(x-15+leafSway,y-44,12,6,'#76ad72');rect(x+3-leafSway,y-44,12,6,'#76ad72');
      rect(x-6,y-52,12,6,'#e2a6d4');rect(x-3,y-50,6,3,'#fbe089');
      rect(x-10,y-16,4,4,'#3d1a3c');rect(x+6,y-16,4,4,'#3d1a3c');rect(x-9,y-16,1,1,'#fbe089');rect(x+7,y-16,1,1,'#fbe089');
    }else if(m.kind==='warden'){
      rect(x-17,y-6,34,4,'#4e3c27');
      rect(x-23,y-44,12,34,'#6b5336');rect(x-21,y-42,8,30,'#a68c65');
      rect(x+11,y-44,12,34,'#6b5336');rect(x+13,y-42,8,30,'#a68c65');
      rect(x-26,y-54,4,12,'#6b5336');rect(x+22,y-54,4,12,'#6b5336');
      rect(x-22,y-34,10,5,'#48683f');rect(x+12,y-34,10,5,'#48683f');
      const eyeGlow=reduced?'#74dfaa':(Math.sin(anim*6)>0?'#b5f5d3':'#74dfaa');
      rect(x-4,y-18,8,5,'#2d4229');rect(x-3,y-17,6,3,eyeGlow);
    }else{
      // Slime mọng nước
      rect(x-17,y-6,34,4,'#6a9867');rect(x-12,y-29,24,3,'#b5deb2');rect(x-16,y-19,4,15,'#b5deb2');
      rect(x-10,y-25,3,2,'#ffffff');rect(x+7,y-23,2,2,'#ffffff');
      const coreY=y-16+(reduced?0:Math.round(Math.sin(anim*4)*1.5));
      rect(x-2,coreY-2,4,4,'#fef08a');rect(x-1,coreY-1,2,2,'#fffbeb');
      rect(x-12,y-14,4,4,'#33595b');rect(x+7,y-14,4,4,'#33595b');rect(x-11,y-14,1,1,'#ffffff');rect(x+8,y-14,1,1,'#ffffff');
    }
    // Thanh máu
    rect(x-17,y+8,34,4,'#2d3b32');rect(x-17,y+8,Math.max(0,m.hp)/def.maxHp*34,4,'#f0a06c');
  }

  // Boss hùng mạnh chuẩn Pixel Art với Lõi phản công
  function drawBossPixel(m,x,y,anim=0){
    pixelEllipse(x,y+6,92,26,'#20322b66');
    const vulnerable=m.stage==='recovery';
    if(m.kind==='forestBoss'){
      // Hộ Vệ Rêu Cổ (Forest Titan)
      rect(x-32,y-68,64,65,'#353c36');rect(x-28,y-64,56,58,'#525c53');
      rect(x-46,y-52,18,50,'#353c36');rect(x-42,y-48,12,42,'#525c53');
      rect(x+28,y-52,18,50,'#353c36');rect(x+30,y-48,12,42,'#525c53');
      rect(x-36,y-72,72,10,'#506846');rect(x-32,y-70,64,6,'#79946c');
      rect(x-20,y-84,40,26,'#525c53');rect(x-22,y-86,44,6,'#79946c');
      rect(x-32,y-96,10,32,'#506846');rect(x+22,y-96,10,32,'#506846');
      rect(x-14,y-74,6,5,'#6ee7b7');rect(x+8,y-74,6,5,'#6ee7b7');
      if(vulnerable){
        circle(x,y-38,24,'rgba(110,231,183,0.35)');
        rect(x-12,y-48,24,26,'#353c36');rect(x-8,y-44,16,20,'#6ee7b7');rect(x-4,y-40,8,12,'#c5f0b1');
      }else{rect(x-9,y-45,18,23,'#506846');rect(x-5,y-41,10,15,'#79946c');}
      text('HỘ VỆ RÊU CỔ',x,y-104,'#fef08a',13);
    }else if(m.kind==='tideBoss'){
      // Hộ Vệ Sóng Ngầm (Tide Leviathan)
      rect(x-30,y-68,60,65,'#3e636b');rect(x-26,y-64,52,58,'#6e9ca4');
      rect(x-44,y-52,18,50,'#3e636b');rect(x-40,y-48,12,42,'#6e9ca4');
      rect(x+26,y-52,18,50,'#3e636b');rect(x+28,y-48,12,42,'#6e9ca4');
      rect(x-22,y-84,44,28,'#4d757d');
      rect(x-34,y-98,10,32,'#e07a7a');rect(x+24,y-98,10,32,'#e07a7a');
      rect(x-13,y-73,6,5,'#a5f3fc');rect(x+7,y-73,6,5,'#a5f3fc');
      if(vulnerable){
        circle(x,y-38,24,'rgba(103,232,249,0.35)');
        rect(x-12,y-48,24,26,'#3e636b');rect(x-8,y-44,16,20,'#67e8f9');rect(x-4,y-40,8,12,'#f0fdfa');
      }else{rect(x-9,y-45,18,23,'#4d757d');rect(x-5,y-41,10,15,'#6e9ca4');}
      text('HỘ VỆ SÓNG NGẦM',x,y-104,'#a5f3fc',13);
    }else{
      // Hộ Vệ Thiên Thạch (Sky Archon)
      rect(x-30,y-68,60,65,'#261b30');rect(x-26,y-64,52,58,'#433352');
      const lev=reduced?0:Math.round(Math.sin(anim*3)*4);
      rect(x-46,y-56+lev,16,44,'#433352');rect(x-42,y-52+lev,10,36,'#a38cb6');
      rect(x+30,y-56-lev,16,44,'#433352');rect(x+32,y-52-lev,10,36,'#a38cb6');
      rect(x-22,y-86,44,30,'#352445');rect(x-34,y-100,10,32,'#a38cb6');rect(x+24,y-100,10,32,'#a38cb6');
      rect(x-13,y-74,6,5,'#f472b6');rect(x+7,y-74,6,5,'#f472b6');
      if(vulnerable){
        circle(x,y-38,24,'rgba(232,121,249,0.35)');
        rect(x-12,y-48,24,26,'#261b30');rect(x-8,y-44,16,20,'#e879f9');rect(x-4,y-40,8,12,'#fdf4ff');
      }else{rect(x-9,y-45,18,23,'#433352');rect(x-5,y-41,10,15,'#a38cb6');}
      text('HỘ VỆ THIÊN THẠCH',x,y-104,'#f5d0fe',13);
    }
    // Trạng thái Pha & Lộ lõi
    text('PHA '+m.phase+(vulnerable?' · LỘ LÕI PHẢN CÔNG!':''),x,y+24,vulnerable?'#86efac':'#fde047',11);
    // Thanh HP Boss uy nghi
    rect(x-46,y-84,92,6,'#232a24');rect(x-45,y-83,90*Math.max(0,m.hp)/m.maxHp,4,vulnerable?'#4ade80':'#fb923c');
  }

  function draw(now){
    requestAnimationFrame(draw);if(!state||document.hidden)return;
    const c=D.chapters[state.chapter],t=reduced?0:now/1000,alpha=Math.min(1,(now-receivedAt)/100);

    // 1. Nền thế giới dither tự nhiên
    if(!c){
      // Bản đồ Trại Ánh Sao (Làng bình yên)
      rect(0,0,800,560,'#4a6e4d');
      // Ma trận hạt cỏ Bayer dither
      for(let y=0;y<560;y+=16)for(let x=0;x<800;x+=16){
        const p=((x*7+y*13)%23);
        if(p<8)rect(x,y+6,2,2,'#59835d');else if(p<12)rect(x+8,y+10,3,1,'#3b5c3e');
      }
      // Đường sỏi uốn lượn trung tâm với viền sỏi
      rect(20,250,760,52,'#c7b282');rect(20,248,760,2,'#a89569');rect(20,302,760,2,'#a89569');
      for(let x=24;x<770;x+=28){rect(x,254,4,2,'#ded0aa');rect(x+14,296,5,2,'#b09d72');}
      // Ranh giới tự nhiên
      rect(15,16,770,12,'#28422e');rect(15,532,770,14,'#28422e');
    }else{
      // Phòng Dungeon: Màu nền sàn đá chuyên biệt từng chương
      rect(0,0,800,560,c.floor);
      // Gạch lát sàn đá dither
      for(let y=0;y<560;y+=28)for(let x=0;x<800;x+=28){
        rect(x,y,27,27,c.color);rect(x,y,27,1,c.accent+'33');rect(x,y,1,27,c.accent+'22');
      }
      rect(15,16,770,12,'#1b2720');rect(15,532,770,14,'#1b2720');
    }

    // 2. Vật thể cảnh quan theo từng chế độ
    if(!c){
      // Trại Ánh Sao: Nhà chính, lửa trại, cây cối, lối bí mật & công trình
      drawCabin(130,175,t);
      drawCampfire(225,185,t);
      drawTree(68,430,1.2,0,t);drawTree(734,420,1.25,1,t);drawTree(720,135,1.1,2,t);
      // 3 Công trình xây làng
      D.chapters.forEach((ch,i)=>{drawVillageBuilding(320+i*180,470,ch,state.world.buildings.includes(ch.id),t);});
      // 3 Lối bí mật mở bằng năng lực
      D.secrets.forEach((s,i)=>{
        const open=state.world.abilities.includes(D.chapters[i].ability),found=state.world.secrets.includes(D.chapters[i].id);
        drawSecretPassage(s,i,open,found,t);
      });
    }else{
      // Trong Dungeon: Chướng ngại vật cổ, bia cơ chế, cổng chuyển phòng
      for(const o of D.obstacles[state.room]){
        dropShadow(o.x+o.w/2,o.y+o.h+4,o.w+12,16,0.4);
        rect(o.x,o.y,o.w,o.h,c.color);rect(o.x+2,o.y+2,o.w-4,o.h-4,c.floor);
        // Chạm khắc hoa văn rune trên cột đá
        for(let py=o.y+10;py<o.y+o.h-10;py+=18)rect(o.x+8,py,o.w-16,3,c.accent+'55');
        rect(o.x,o.y,o.w,4,c.accent+'aa');
      }
      // Phòng 2: Bia cơ chế cộng hưởng phong cách bia đá cổ
      if(state.room===1)D.switches.forEach((s,i)=>{
        dropShadow(s.x,s.y+14,54,16,0.35);
        circle(s.x,s.y,38,state.puzzleSolved?'rgba(167,243,208,0.25)':'rgba(253,230,138,0.2)');
        rect(s.x-16,s.y-34,32,46,'#323c34');rect(s.x-14,s.y-32,28,42,'#4e5c51');
        text(i===0?'☘':'☽',s.x,s.y-6,state.puzzleSolved?'#86efac':'#fde047',24);
        text(i===0?'BIA TÂY':'BIA ĐÔNG',s.x,s.y+26,c.accent,10);
      });
      // Phòng 4: Trạm nghỉ người giữ rừng (lều trại ấm cúng)
      if(state.room===3){
        dropShadow(400,360,70,18,0.4);
        // Lều nghỉ
        ctx.beginPath();ctx.moveTo(365,355);ctx.lineTo(400,310);ctx.lineTo(435,355);ctx.closePath();ctx.fillStyle='#856142';ctx.fill();
        ctx.beginPath();ctx.moveTo(385,355);ctx.lineTo(400,325);ctx.lineTo(415,355);ctx.closePath();ctx.fillStyle='#362415';ctx.fill();
        drawCampfire(455,352,t);
        text('✦ '+c.resident+' · Trạm Nghỉ',400,395,'#fef3c7',12);
      }
      // Cổng qua phòng phía Đông: Cổng đá cổ phát sáng
      if(state.room<4){
        const open=!state.mobs.some(m=>m.hp>0)&&(state.room!==1||state.puzzleSolved);
        rect(748,220,32,106,'#2c3830');rect(752,224,24,98,open?c.accent:'#524738');
        text(open?'CỔNG MỞ →':'KHÓA 🔒',740,210,open?'#86efac':'#fca5a5',10);
      }
      if(state.finished){
        text('✦ CHIẾN THẮNG: '+c.name.toUpperCase()+' ĐÃ THỨC TỈNH ✦',400,90,c.accent,20);
        text('Phần thưởng đã lưu bền vững · Trở về trại để phục hồi làng',400,118,'#fef9c3',12);
      }
    }

    // 3. Vùng báo đòn (Telegraph) rõ ràng dưới chân
    for(const e of state.mobs)if(e.hp>0){
      if(e.stage==='windup'||e.stage==='active'){
        ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.atan2(e.dy??0,e.dx??1));
        ctx.fillStyle=e.stage==='windup'?'rgba(250,204,21,0.45)':'rgba(239,68,68,0.55)';
        ctx.strokeStyle='#fef08a';ctx.lineWidth=2;const tell=e.tell;
        if(e.style==='charge'){
          ctx.fillRect(-tell.radius,-tell.radius,tell.chargeLength+2*tell.radius,2*tell.radius);
          ctx.strokeRect(-tell.radius,-tell.radius,tell.chargeLength+2*tell.radius,2*tell.radius);
        }else{
          const arc=(e.style==='projectile'?tell.projectileArc:tell.arc)*Math.PI/360,range=e.style==='projectile'?tell.projectileRange:tell.range;
          ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,range,-arc,arc);ctx.closePath();ctx.fill();ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 4. Quái vật & Boss với Sprite Pixel Art
    for(const e of state.mobs)if(e.hp>0){
      if(e.boss)drawBossPixel(e,e.x,e.y,t);else drawMobPixel(e,e.x,e.y,t);
      if(e.id===state.marked)text('⚑ MỤC TIÊU',e.x,e.y-(e.boss?120:44),'#fde047',12);
    }

    // 5. Nhân vật người chơi & Đồng đội (dùng StardropActors pixel chibi)
    for(const p of [...state.players].sort((a,b)=>a.y-b.y)){
      const before=previous?.chapter===state.chapter&&previous?.room===state.room?previous.players.find(a=>a.id===p.id):null;
      const x=before&&Math.hypot(before.x-p.x,before.y-p.y)<80?before.x+(p.x-before.x)*alpha:p.x,y=before&&Math.hypot(before.x-p.x,before.y-p.y)<80?before.y+(p.y-before.y)*alpha:p.y;
      ctx.save();ctx.globalAlpha=p.connected?1:0.4;
      if(p.health===0){
        circle(x,y,22,'rgba(239,68,68,0.3)');text('♡ CẦN CỨU',x,y+4,'#fca5a5',12);
      }else{
        globalThis.StardropActors.draw(ctx,{id:'player',isPlayer:true,x,y,direction:p.direction,distance:p.travel,moving:p.moving,running:p.running,motionWeight:p.moving?1:0,runWeight:p.running?1:0,reducedMotion:reduced,time:t,shirt:p.id===state.you?'#eab308':'#38bdf8'});
      }
      // Thanh máu & Tên nhân vật dạng backplate tối màu chuẩn WCAG
      rect(x-24,y-72,48,6,'#1a241e');
      rect(x-24,y-72,48*Math.max(0,p.health)/100,6,p.id===state.you?'#facc15':'#4ade80');
      text((p.id===state.host?'♛ ':'')+p.name,x,y-80,p.id===state.you?'#fef08a':'#e2e8f0',11);
      if(p.revive)text('Đang cứu '+Math.min(100,Math.round(p.revive.time/2*100))+'%',x,y+24,'#86efac',11);
      ctx.restore();
    }

    // 6. Đạn bay & Hiệu ứng phép thuật
    for(const s of state.projectiles){circle(s.x,s.y,s.friendly?5:8,s.friendly?'#fef08a':'#fb923c');}
    for(const f of state.effects){
      if(['attack','help','wait'].includes(f.kind)){
        circle(f.x,f.y,32,'rgba(253,224,71,0.25)');
        text(f.kind==='help'?'♡ CẦN GIÚP':f.kind==='wait'?'◷ CHỜ TÔI':'⚑ TẬP TRUNG',f.x,f.y-28,'#fef08a',12);
      }else{
        ctx.strokeStyle='#fef08a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,32,0,Math.PI);ctx.stroke();
      }
    }
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
