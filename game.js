(() => {
  'use strict';
  const D = globalThis.STARDROP_DATA, C = globalThis.StardropCore, NPC = globalThis.StardropNPC, P = globalThis.StardropPaths, E = globalThis.StardropEffects, A = globalThis.StardropActors;
  if (!D || !C || !NPC || !P || !E || !A) { document.getElementById('save-label').textContent = 'Không tải được dữ liệu game. Hãy tải lại trang.'; return; }
  const actorMetrics=A.artMetrics||{bodyWidth:40,bodyHeight:60,nameOffset:64};
  const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SAVE_KEY = 'starfall-valley-save-v1', qaMode = new URLSearchParams(location.search).get('qa') === '1';
  const storageKey = qaMode ? 'starfall-valley-qa-save' : SAVE_KEY;
  let saved = null; try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch (_) {}
  let state = C.restoreState(saved, D), running = false, modal = null, journalTab = 'story', lastTime = 0;
  if(!saved||saved.version!==1){state.x=850;state.y=565;}
  if(state.health<=0){state.health=100;state.stamina=70;state.map='village';state.x=800;state.y=720;}
  const canvas = $('gameCanvas'), ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const title = $('titleCanvas'), tc = title.getContext('2d'); tc.imageSmoothingEnabled = false;
  let viewHeight=600;
  const darkCanvas = document.createElement('canvas'); darkCanvas.width = 960; darkCanvas.height = 600;
  const dc = darkCanvas.getContext('2d'), camera = { x: 0, y: 0 }, keys = new Set(), touchKeys = new Set();
  let near = null, swing = 0, attackCooldown = 0, hurtCooldown = 0, animation = 0, facing = 1;
  let fishing = null, toastUntil = 0, lastSaved = 0, hudTimer = 0, regenTimer = 0;
  let socket = null, onlineId = null, reconnectTimer = null, moveTimer = 0, reconnectAttempts = 0;
  const peers = new Map(), particles = [], effects = [], terrainCache = new Map(), world = {};
  const motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion=!!motionPreference?.matches, stepTimer=0;
  let playerDirection='down',walkDistance=0,playerRunning=false,touchRun=false;
  // Visual envelopes are session-only: feet follow actual travel while input and
  // collision still stop immediately. One cycle fraction survives walk/run changes.
  const actorMotions=new Map();
  motionPreference?.addEventListener?.('change',e=>{reducedMotion=e.matches;if(reducedMotion){particles.length=0;effects.length=0;}});
  const npcs = NPC.createNPCs(D.npcs);
  let guidedNpcId = null;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n)), distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wantsRun = () => keys.has('shift')||touchRun;
  const moveSpeed = () => (state.upgrades.includes('boots')?225:180)*(wantsRun()?1.65:1);
  function directionFor(dx,dy,current=playerDirection) {
    if(Math.abs(dx)<.01&&Math.abs(dy)<.01)return current;
    if(Math.abs(dx)>Math.abs(dy))return dx>0?'right':'left';
    return dy>0?'down':'up';
  }
  function syncRunControl() {
    const runButton=$('touch-run'),pressed=String(touchRun),buttonText=touchRun?'Đang chạy':'Chạy',modeText=playerRunning?'Chạy':wantsRun()?'Sẵn sàng chạy':'Đi bộ';
    if(runButton.getAttribute?.('aria-pressed')!==pressed)runButton.setAttribute('aria-pressed',pressed);
    if(runButton.textContent!==buttonText)runButton.textContent=buttonText;
    if($('move-mode').textContent!==modeText)$('move-mode').textContent=modeText;
  }
  function clearMovement() {
    keys.clear();touchKeys.clear();touchRun=false;playerRunning=false;state.moving=false;stepTimer=0;syncRunControl();
    actorMotions.forEach(m=>{m.motionWeight=0;m.runWeight=0;});
  }
  function advanceActorMotion(key,total,moving,sprinting,dt,map) {
    let motion=actorMotions.get(key);
    if(!motion||motion.map!==map||total<motion.distance){motion={phase:0,motionWeight:0,runWeight:0,distance:motion?total:0,map};actorMotions.set(key,motion);}
    const travel=Math.max(0,total-motion.distance),elapsed=Number.isFinite(dt)?clamp(dt,0,.25):0;
    motion.distance=total;
    if(reducedMotion){motion.motionWeight=0;motion.runWeight=0;return;}
    if(moving&&travel>0){const cycle=sprinting?(actorMetrics.runCycleDistance||96):(actorMetrics.walkCycleDistance||84);motion.phase=(motion.phase+travel/cycle)%1;}
    const approach=(value,target,duration)=>value<target?Math.min(target,value+elapsed/duration):Math.max(target,value-elapsed/duration);
    motion.motionWeight=approach(motion.motionWeight,moving?1:0,moving?.08:.12);
    motion.runWeight=approach(motion.runWeight,sprinting?1:0,.1);
  }
  function updateActorMotions(dt,paused) {
    advanceActorMotion('player',walkDistance,state.moving,playerRunning,dt,state.map);
    npcs.forEach(n=>advanceActorMotion(`npc:${n.id}`,n.walkDistance,n.map===state.map&&n.moving,false,dt,n.map));
    if(paused)actorMotions.forEach(m=>{m.motionWeight=0;m.runWeight=0;});
  }
  const rng = seed => { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; };
  const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.floor(x), Math.floor(y), w, h); };
  const label = (c, text, x, y, size = 12, color = '#fff8de') => { c.font = `${size}px 'Segoe UI',sans-serif`; c.textAlign = 'center'; c.fillStyle = '#293e43'; c.fillText(text, Math.floor(x) + 1, Math.floor(y) + 1); c.fillStyle = color; c.fillText(text, Math.floor(x), Math.floor(y)); };
  const buildings = [
    { x: 270, y: 330, w: 146, h: 125, roof: '#ac6959', name: 'Nhà Mira', kind: 'home' },
    { x: 610, y: 335, w: 154, h: 137, roof: '#678c99', name: 'Xưởng Gió', upgrade: 'workshop', kind: 'workshop' },
    { x: 1060, y: 330, w: 160, h: 132, roof: '#9f7898', name: 'Thư viện Mây', upgrade: 'archive', kind: 'archive' },
    { x: 1340, y: 350, w: 122, h: 108, roof: '#c98656', name: 'Bếp Nắng', upgrade: 'kitchen', kind: 'kitchen' },
    { x: 280, y: 850, w: 136, h: 122, roof: '#669d91', name: 'Vườn kính', upgrade: 'greenhouse', kind: 'greenhouse' },
    { x: 1015, y: 875, w: 145, h: 120, roof: '#c7a054', name: 'Chợ Lá', upgrade: 'market', kind: 'market' },
    { x: 1350, y: 1035, w: 125, h: 125, roof: '#6b7398', name: 'Đài Sao', upgrade: 'observatory', kind: 'observatory' }
  ];
  const layouts=Object.fromEntries(D.regions.map(r=>[r.id,P.createLayout(r.id)]));
  const lamps = [{x:430,y:430},{x:830,y:385},{x:1210,y:430},{x:440,y:730},{x:780,y:860},{x:1050,y:730}];
  const extraLamps = [{x:165,y:550},{x:665,y:600},{x:1010,y:570},{x:1430,y:550},{x:680,y:890}];
  const plots = [0,1,2,3].map(i => ({ id: `plot-${i}`, kind: 'plot', x: 490 + (i % 2) * 65, y: 770 + Math.floor(i / 2) * 65, i }));
  const camp = {id:'camp', kind:'camp',x:790,y:735,name:'Trại Sao'}, well = {id:'well',kind:'well',x:920,y:725,name:'Giếng Mạch'}, bench = {id:'bench',kind:'bench',x:730,y:735,name:'Ghế nghỉ'};
  function makeWorld() {
    D.regions.forEach((region, index) => {
      const random = rng(731 + index * 131), objects = [], trees = [], mobs = [];
      const road = (x,y,margin=30) => P.contains(layouts[region.id],x,y,margin);
      for(let i=0;i<110;i++) {
        const x=Math.floor((50+random()*1500)/4)*4,y=Math.floor((65+random()*970)/4)*4;
        if(road(x,y) || (region.id==='village' && buildings.some(b=> Math.abs(x-b.x)<b.w+65&&Math.abs(y-b.y)<b.h+80)) || (x>1080&&x<1480&&y>580&&y<960)) continue;
        if(region.id==='village'&&plots.some(p=>Math.hypot(p.x-x,p.y-y)<90))continue;
        trees.push({x:Math.floor(x/4)*4,y:Math.floor(y/4)*4,size:random()>.75?1.3:1,tone:i%3});
      }
      const types = region.id==='village'?['wood','herb','berry','ore','star']:region.id==='forest'?['wood','herb','berry','ore','star']:region.id==='coast'?['herb','fish','star','ore']:['ore','crystal','star','herb'];
      types.forEach((type, k) => {
        for(let i=0;i<(type==='fish'?3:8);i++) {
          const x=180+(i%4)*360+(k%2)*48; let y=420+Math.floor(i/4)*235+(k%3)*40;
          if(x>1090&&y>610)y=170+k*60+Math.floor(i/4)*25;
          if(type==='fish') objects.push({id:`${region.id}-fish-${i}`,kind:'fish',item:'fish',x:1080,y:655+i*65,name:'Bờ câu cá'});
          else objects.push({id:`${region.id}-${type}-${i}`,kind:'resource',item:type,x,y,name:D.items[type].name});
        }
      });
      if(region.id==='village') { objects.push(...plots,camp,bench,well); objects.push({id:'village-fish',kind:'fish',item:'fish',x:1080,y:660,name:'Bờ câu cá'}); }
      else {
        objects.push({id:`shrine-${region.id}`,kind:'shrine',x:800,y:280,name:'Bia ký ức'});
        objects.push({id:`chest-${region.id}`,kind:'chest',x:1400,y:940,name:'Rương thất lạc'});
        for(let i=0;i<5;i++){const x=420+i*205,y=x>1110?940:700+(i%2)*110;mobs.push({id:`${region.id}-slime-${i}`,x,y,homeX:x,homeY:y,hp:3,deadUntil:0,phase:i});}
      }
      const gates = region.id==='village' ? [
        {id:'gate-forest',kind:'gate',x:800,y:100,to:'forest',name:D.regions.find(r=>r.id==='forest').name},
        {id:'gate-coast',kind:'gate',x:1500,y:550,to:'coast',name:D.regions.find(r=>r.id==='coast').name},
        {id:'gate-ruins',kind:'gate',x:100,y:550,to:'ruins',name:D.regions.find(r=>r.id==='ruins').name}
      ] : [{id:`return-${region.id}`,kind:'gate',x:800,y:1000,to:'village',name:'Trở về Làng Sao'}];
      const allObjects=objects.concat(gates);
      world[region.id]={objects:allObjects,trees,mobs,ambient:E.createScene(region.id,{trees,objects:allObjects,buildings:region.id==='village'?buildings:[],isPath:road})};
    });
  }
  makeWorld();
  // A saved position can become occupied after scenery is rearranged.
  if(saved&&blockedAt(state.map,state.x,state.y)){
    let safe=null;
    for(let radius=8;radius<=200&&!safe;radius+=8)for(let angle=0;angle<16&&!safe;angle++){
      const x=state.x+Math.cos(angle*Math.PI/8)*radius,y=state.y+Math.sin(angle*Math.PI/8)*radius;
      if(!blockedAt(state.map,x,y))safe={x,y};
    }
    if(safe)Object.assign(state,safe);else{state.map='village';state.x=850;state.y=565;}
  }
  $('player-name').value = state.name;
  if(saved?.version===1) { $('btn-start').innerHTML='Tiếp tục hành trình <span>→</span>'; $('save-label').textContent=`Ngày ${state.day} · Cấp ${C.level(state)} · ${Object.values(state.quests).filter(q=>q.status==='claimed').length} nhiệm vụ đã hoàn tất`; }
  function save() {
    try { localStorage.setItem(storageKey,JSON.stringify(state)); $('save-status').textContent='Đã lưu trên máy'; }
    catch(_) { $('save-status').textContent='Trình duyệt chưa cho phép lưu'; }
    lastSaved=performance.now();
  }
  function toast(message) { $('toast').textContent=message; $('toast').classList.add('visible'); toastUntil=performance.now()+4200; }
  function effect(kind,x,y,text='',color='#fff0a1') {
    if(reducedMotion)return;
    const life=kind==='text'?1.3:kind==='slash'?.25:kind==='dust'?.35:.6;
    if(effects.length>=80)effects.shift();
    effects.push({kind,map:state.map,x,y,text,color,age:0,life,facing,direction:playerDirection});
  }
  function reward(result) { toast(result.message); refreshHUD(); if(result.ok){effect('ring',state.x,state.y);effect('text',state.x,state.y-55,'✓','#c4efb3');save();} }
  function burst(x,y,color,text) {
    if(!reducedMotion){
      for(let i=0;i<10;i++){if(particles.length>=100)particles.shift();particles.push({kind:'particle',map:state.map,x,y,vx:(Math.random()-.5)*80,vy:-Math.random()*80,life:.65,age:0,color});}
      effect('ring',x,y,'',color);
    }
    if(text)toast(text);
  }
  const npcById = id => npcs.find(n=>n.id===id);
  const nearestNPC = () => npcs.filter(n=>n.map===state.map&&distance(n,state)<85).sort((a,b)=>distance(a,state)-distance(b,state))[0]?.id;
  function npcMarker(npc) {
    const quests=D.quests.filter(q=>q.giver===npc.id);
    if(quests.some(q=>state.quests[q.id]?.status==='active'&&C.complete(state,q)))return '✓';
    if(quests.some(q=>!state.quests[q.id]&&C.available(state,q,D)))return '?';
    return quests.some(q=>state.quests[q.id]?.status==='active')?'!':'';
  }
  function guideNPC() {
    if(guidedNpcId)return npcById(guidedNpcId);
    const q=activeQuest();if(!q)return null;
    const p=C.progress(state,q), talkTarget=q.objectives.find((o,i)=>o.type==='talk'&&p[i]<o.count);
    return npcById(talkTarget?.target||q.giver);
  }
  function npcDirection(npc) {
    if(npc.map!==state.map)return `Tại ${D.regions.find(r=>r.id===npc.map)?.name}`;
    const dist=distance(npc,state);
    if(dist<78)return 'Đang ở gần bạn · nhấn E để trò chuyện';
    const dx=npc.x-state.x,dy=npc.y-state.y;
    const horizontal=Math.abs(dx)>dist*.35?(dx>0?'đông':'tây'):'';
    const vertical=Math.abs(dy)>dist*.35?(dy>0?'nam':'bắc'):'';
    return `Phía ${[vertical,horizontal].filter(Boolean).join(' ')} · ${dist<180?'cách một đoạn ngắn':dist<450?'quanh khu vực này':'ở xa hơn trên bản đồ'}`;
  }
  function showResidents() {
    const cards=D.regions.map(region=>`<h3>${esc(region.name)}</h3><div class="cards">${npcs.filter(n=>n.map===region.id).map(n=>{
      const marker=npcMarker(n), status=marker==='✓'?'Có thể giao đồ / nhận thưởng':marker==='?'?'Có nhiệm vụ hoặc hợp đồng mới':marker==='!'?'Đang có việc bạn đã nhận':'Chưa có nhiệm vụ mới';
      return `<article class="card"><span class="badge">${esc(n.role)}</span><h3>${esc(n.name)} ${marker}</h3><p>${esc(n.patrolName)}</p><p class="good">${status}</p><button data-find-npc="${n.id}">Tìm ${esc(n.name)}</button></article>`;
    }).join('')}</div>`).join('');
    openDialog('residents','Cư dân thung lũng','NHỮNG NGƯỜI BẠN GẶP TRÊN ĐƯỜNG',`<p class="dialog-intro">Cư dân đi lại quanh nơi sinh hoạt và dừng khi bạn tới gần. Theo chỉ dẫn để tìm họ; nhấn E hoặc Tương tác để nhận việc. ? Có việc mới · ! Đang thực hiện · ✓ Sẵn sàng nhận thưởng.</p>${cards}`);
  }
  function objectiveText(o) {
    const target = D.items[o.target]?.name || npcById(o.target)?.name || D.regions.find(r=>r.id===o.target)?.name || D.upgrades.find(u=>u.id===o.target)?.name || D.recipes.find(r=>r.id===o.target)?.name;
    return ({talk:`Trò chuyện với ${target}`,gather:`Thu thập ${target}`,craft:`Chế tạo ${target}`,deliver:`Giao ${target}`,visit:`Khám phá ${target}`,build:`Xây ${target}`,fish:'Câu cá thành công',fight:'Đánh bại tinh linh nhầy',plant:'Gieo luống quả',harvest:'Thu hoạch quả',shrine:`Đánh thức bia ký ức ${D.regions.find(r=>r.id===o.target)?.name||''}`,chest:'Mở rương thất lạc',night:'Tương tác ở làng vào ban đêm',rain:'Hái thảo dược trong mưa'})[o.type] || o.type;
  }
  function activeQuest() { return D.quests.find(q=>q.id===state.tracked&&state.quests[q.id]?.status==='active') || D.quests.find(q=>q.kind==='story'&&state.quests[q.id]?.status==='active') || D.quests.find(q=>state.quests[q.id]?.status==='active'); }
  function refreshHUD() {
    $('coins').textContent=`◈ ${state.coins} xu`; $('level').textContent=`✦ Cấp ${C.level(state)} · ${state.xp%160}/160 XP`; $('renown').textContent=`♧ ${state.renown} uy tín`;
    $('health').textContent=Math.ceil(state.health); $('stamina').textContent=Math.ceil(state.stamina); $('player-label').textContent=state.name;
    const hours=Math.floor(state.minutes/60),minutes=Math.floor(state.minutes%60/10)*10;
    $('clock').textContent=`Ngày ${state.day} · ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
    $('map-name').textContent=D.regions.find(r=>r.id===state.map).name;
    $('weather-label').textContent=`${C.isNight(state)?'☾ Đêm':'☀ Ban ngày'} · ${C.weather(state)==='rain'?'☂ Mưa':'Trời trong'}`;
    const q=activeQuest();
    if(q) {
      const p=C.progress(state,q);
      $('quest-tracker').innerHTML=`<h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><ul>${q.objectives.map((o,i)=>`<li class="${p[i]>=o.count?'done':''}"><span>${p[i]>=o.count?'✓':'◇'} ${esc(objectiveText(o))}</span><b>${p[i]}/${o.count}</b></li>`).join('')}</ul>${C.complete(state,q)?`<button data-claim="${q.id}">Nhận thưởng${q.objectives.some(o=>o.type==='deliver')?' / giao đồ':''}</button>`:''}`;
    } else $('quest-tracker').innerHTML='<h3>Thung lũng đang chờ</h3><p>Mở sổ nhiệm vụ để nhận việc từ cư dân hoặc hợp đồng mới mỗi ngày.</p><button data-open-journal>Khám phá nhiệm vụ</button>';
    const guide=guideNPC();
    $('npc-guide').textContent=guide?`Tìm ${guide.name} · ${D.regions.find(r=>r.id===guide.map)?.name}: ${npcDirection(guide)}.`:'';
    $('npc-guide').hidden=!guide;
    const total=D.quests.filter(q=>q.kind!=='daily').length,done=D.quests.filter(q=>q.kind!=='daily'&&state.quests[q.id]?.status==='claimed').length;
    $('quest-count').textContent=`${done}/${total} hành trình · ${D.quests.filter(q=>state.quests[q.id]?.status==='active').length} nhiệm vụ đang nhận`;
    $('world-tip').textContent=C.weather(state)==='rain'?'Mưa làm thảo dược bừng sức sống. Đèn vẫn soi đường trong mưa và ban đêm.':C.isNight(state)?'Mảnh sao phát sáng khi đêm xuống. Chế tạo đèn lồng để mở rộng tầm nhìn.':'Cư dân dạo quanh làng. ? báo việc mới, ! là việc đang làm, ✓ là việc sẵn sàng nhận thưởng.';
  }
  function openDialog(kind,title,eyebrow,html) {
    fishing=null; $('fishing').hidden=true; clearMovement(); modal=kind;
    npcs.forEach(n=>{n.moving=false;});state.moving=false;
    $('dialog-title').textContent=title; $('dialog-eyebrow').textContent=eyebrow; $('dialog-body').innerHTML=html;
    if(!$('game-dialog').open)$('game-dialog').showModal();
  }
  function closeDialog() { $('game-dialog').close(); modal=null; clearMovement();save(); }
  $('dialog-close').addEventListener('click',closeDialog);
  $('game-dialog').addEventListener('cancel',()=>{modal=null;clearMovement();save();});
  $('game-dialog').addEventListener('close',()=>{modal=null;});
  function showJournal(tab=journalTab) {
    journalTab=tab;
    let list=tab==='daily'?C.dailyQuests(state,D):D.quests.filter(q=>q.kind===tab);
    const cards=list.map(q=>{
      const entry=state.quests[q.id],can=C.available(state,q,D),p=C.progress(state,q),ready=entry?.status==='active'&&C.complete(state,q);
      const action=entry?.status==='claimed'?'<button disabled>✓ Đã nhận thưởng</button>':entry?.status==='active'?`<div class="card-actions"><button data-track="${q.id}">${state.tracked===q.id?'Đang theo dõi':'Theo dõi'}</button>${ready?`<button data-claim="${q.id}">Nhận thưởng${q.objectives.some(o=>o.type==='deliver')?' / giao đồ':''}</button>`:'<button disabled>Đang thực hiện</button>'}</div>`:`<button data-accept="${q.id}" ${can?'':'disabled'}>${can?'Nhận nhiệm vụ':'Chưa mở khóa'}</button>`;
      const locked=q.requires.filter(id=>state.quests[id]?.status!=='claimed').map(id=>D.quests.find(x=>x.id===id)?.title).filter(Boolean);
      if(q.upgrade&&!state.upgrades.includes(q.upgrade))locked.push(D.upgrades.find(u=>u.id===q.upgrade)?.name);
      return `<article class="card ${!can&&!entry?'locked':''}"><span class="badge">${esc(npcById(q.giver)?.name||'BẢNG TIN LÀNG')} ${entry?.status==='claimed'?'· HOÀN TẤT':''}</span><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><ul>${q.objectives.map((o,i)=>`<li class="${p[i]>=o.count?'good':''}">${p[i]>=o.count?'✓':'◇'} ${esc(objectiveText(o))} · ${p[i]}/${o.count}</li>`).join('')}</ul>${locked.length?`<p class="quest-direction">Mở sau: ${esc(locked.join(' · '))}</p>`:''}${q.objectives.some(o=>o.type==='deliver')?`<p class="quest-direction">Giao tận tay ${esc(npcById(q.giver)?.name)} · ${esc(D.regions.find(r=>r.id===npcById(q.giver)?.map)?.name||'')}</p>`:''}<div class="reward">◈ ${q.reward.coins} xu · ✦ ${q.reward.xp} XP · ♧ ${q.reward.renown} uy tín</div>${action}</article>`;
    }).join('');
    openDialog('journal','Sổ hành trình',`NGÀY ${state.day} · CÂU CHUYỆN CỦA ${state.name}`,`<div class="tab-strip">${[['story','Cốt truyện'],['side','Việc của cư dân'],['daily','Hợp đồng hôm nay']].map(([id,name])=>`<button data-tab="${id}" class="${tab===id?'selected':''}">${name} (${id==='daily'?C.dailyQuests(state,D).length:D.quests.filter(q=>q.kind===id).length})</button>`).join('')}</div><p class="dialog-intro">Nhận nhiệm vụ trước khi làm mục tiêu thu thập, chế tạo hoặc chiến đấu. Mục tiêu giao hàng dùng vật phẩm trong túi; đến đúng cư dân để giao. Hợp đồng đổi khi sang ngày mới.</p><div class="cards">${cards}</div>`);
  }
  function showBuild() {
    const html=D.upgrades.map(u=>{
      const owned=state.upgrades.includes(u.id), prereq=u.prerequisites.filter(id=>!state.upgrades.includes(id));
      const enough=state.coins>=u.cost&&Object.entries(u.materials).every(([id,n])=>state.inventory[id]>=n)&&!prereq.length;
      return `<article class="card"><span class="badge">${owned?'✓ ĐÃ HOÀN THÀNH':'CÔNG TRÌNH LÀNG'}</span><h3>${esc(u.name)}</h3><p>${esc(u.description)}</p><p class="good">${esc(u.effect)}</p><div class="materials">◈ ${u.cost} xu ${Object.entries(u.materials).map(([id,n])=>`· ${esc(D.items[id].name)} ${state.inventory[id]}/${n}`).join(' ')}</div>${prereq.length?`<p>Tiền đề: ${esc(prereq.map(id=>D.upgrades.find(x=>x.id===id).name).join(', '))}</p>`:''}<button data-build="${u.id}" ${owned||!enough?'disabled':''}>${owned?'Đã xây':enough?'Xây công trình':'Cần thêm nguyên liệu / tiền đề'}</button></article>`;
    }).join('');
    openDialog('build','Xây lại Làng Sao',`${state.upgrades.length}/${D.upgrades.length} NÂNG CẤP`, `<p class="dialog-intro">Mỗi công trình thay đổi khả năng của bạn hoặc cảnh vật trong làng. Thu thập, làm nhiệm vụ và bán tài nguyên để có xu xây dựng.</p><div class="cards">${html}</div>`);
  }
  function showInventory() {
    const items=Object.entries(D.items).map(([id,item])=>`<div class="inventory-item">${item.icon} ${esc(item.name)}<b>${state.inventory[id]} / ${C.capacity(state)}</b>${state.inventory[id]>0?`<button data-sell="${id}">Bán 1 ${state.upgrades.includes('market')?'(+50%)':''}</button>${['tea','meal'].includes(id)?`<button data-use="${id}">Dùng hồi sức</button>`:''}`:''}</div>`).join('');
    const recipes=D.recipes.map(r=>`<article class="card"><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><div class="materials">${Object.entries(r.input).map(([id,n])=>`${esc(D.items[id].name)} ${state.inventory[id]}/${n}`).join(' · ')} → ${Object.entries(r.output).map(([id,n])=>`${n} ${esc(D.items[id].name)}`).join(', ')}</div><button data-craft="${r.id}" ${r.requires&&!state.upgrades.includes(r.requires)?'disabled':''}>${r.requires&&!state.upgrades.includes(r.requires)?`Cần ${esc(D.upgrades.find(u=>u.id===r.requires).name)}`:'Chế tạo'}</button></article>`).join('');
    openDialog('inventory','Túi đồ & chế tạo','MỌI CHUYẾN ĐI BẮT ĐẦU TỪ MỘT VẬT NHỎ',`<p class="dialog-intro">Đèn lồng trong túi tự soi sáng quanh bạn. Trà hồi 35 thể lực; bữa ăn hồi toàn bộ máu và thể lực. Tài nguyên có thể bán để kiếm xu; Chợ Lá tăng giá bán 50%.</p><div class="inventory-grid">${items}</div><h3>Công thức đã biết</h3><div class="cards">${recipes}</div>`);
  }
  function talk(npc,registerVisit=true) {
    if(registerVisit){C.event(state,'talk',npc.id,1,D);save();refreshHUD();}
    const related=D.quests.filter(q=>q.giver===npc.id&&state.quests[q.id]?.status!=='claimed'&&(state.quests[q.id]||C.available(state,q,D)));
    const actions=related.map(q=>`<article class="card"><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p>${state.quests[q.id]?`<button data-claim="${q.id}" ${C.complete(state,q)?'':'disabled'}>${C.complete(state,q)?'Giao đồ / nhận thưởng':'Chưa đủ mục tiêu'}</button>`:`<button data-accept="${q.id}">Nhận nhiệm vụ</button>`}</article>`).join('');
    openDialog(`npc:${npc.id}`,npc.name,npc.role,`<div class="dialogue-text">${esc(npc.dialogue[(state.day-1)%npc.dialogue.length])}</div>${actions?`<div class="cards">${actions}</div>`:'<p class="dialog-intro">Một cuộc trò chuyện cũng làm thung lũng ấm áp hơn.</p>'}<div class="npc-actions"><button data-open-journal>Mở sổ nhiệm vụ</button><button data-close>Hẹn gặp lại</button></div>`);
  }
  function updateModal() {
    if(modal==='journal')showJournal();else if(modal==='build')showBuild();else if(modal==='inventory')showInventory();
    else if(modal==='residents')showResidents();
    else if(modal?.startsWith('npc:')) { const npc=npcById(modal.slice(4)); if(npc)talk(npc,false); }
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.tab)showJournal(b.dataset.tab);
    if(b.hasAttribute('data-close'))closeDialog();
    if(b.hasAttribute('data-open-journal'))showJournal();
    if(b.dataset.findNpc) {const npc=npcById(b.dataset.findNpc);if(npc){guidedNpcId=npc.id;closeDialog();refreshHUD();toast(`Đang tìm ${npc.name}. Chỉ dẫn ở bảng hành trình sẽ theo vị trí hiện tại của họ.`);}}
    if(b.dataset.accept) { if(C.accept(state,b.dataset.accept,D)){ toast('Đã nhận nhiệm vụ. Mục tiêu sẽ được tính từ bây giờ.');save();refreshHUD();updateModal(); } }
    if(b.dataset.track) { state.tracked=b.dataset.track;guidedNpcId=null;save();refreshHUD();updateModal(); }
    if(b.dataset.claim) { reward(C.claim(state,b.dataset.claim,D,modal?.startsWith('npc:')?modal.slice(4):nearestNPC()));updateModal(); }
    if(b.dataset.build) { const result=C.build(state,b.dataset.build,D);reward(result);if(result.ok){const house=buildings.find(h=>h.upgrade===b.dataset.build);if(house)effect('ring',house.x,house.y,'','#e3c77b');}terrainCache.delete('village');updateModal(); }
    if(b.dataset.craft) {reward(C.craft(state,b.dataset.craft,D));updateModal();}
    if(b.dataset.sell) {reward(C.sell(state,b.dataset.sell,1,D));updateModal();}
    if(b.dataset.use) {const item=b.dataset.use;if(state.inventory[item]){state.inventory[item]--;state.stamina=clamp(state.stamina+(item==='meal'?100:35),0,100);if(item==='meal')state.health=100;save();refreshHUD();toast('Đã hồi sức.');updateModal();}}
    if(b.hasAttribute('data-rest')) {C.nextDay(state,D);closeDialog();toast('Một ngày mới bắt đầu. Hợp đồng hôm nay đã thay đổi!');refreshHUD();save();}
  });
  $('btn-journal').addEventListener('click',()=>showJournal());$('btn-tracker').addEventListener('click',()=>showJournal());
  $('btn-build').addEventListener('click',showBuild);$('btn-inventory').addEventListener('click',showInventory);
  $('btn-residents').addEventListener('click',showResidents);
  $('start-form').addEventListener('submit',e=>{
    e.preventDefault();state.name=C.cleanName($('player-name').value);clearMovement();running=true;$('start-screen').hidden=true;$('play-screen').hidden=false;window.scrollTo?.(0,0);resizeViewport();
    const first=D.quests.find(q=>q.kind==='story'&&C.available(state,q,D)&&!state.quests[q.id]);if(first)C.accept(state,first.id,D);
    refreshHUD();save();connect();toast('Chào mừng tới Làng Sao! E để trò chuyện; Q để mở sổ nhiệm vụ.');
  });
  $('btn-home').addEventListener('click',async e=>{e.preventDefault();clearMovement();save();running=false;if(socket){socket.onclose=null;socket.close();socket=null;}clearTimeout(reconnectTimer);peers.clear();onlineId=null;closeDialog();if(nativeFull())try{await(document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch(_){}$('game-wrapper').classList.remove('pseudo-fullscreen');syncFullscreen();$('play-screen').hidden=true;$('start-screen').hidden=false;$('btn-start').innerHTML='Tiếp tục hành trình <span>→</span>';$('save-label').textContent=`Ngày ${state.day} · Cấp ${C.level(state)} · Tiến trình đã lưu`;$('player-name').value=state.name;window.scrollTo?.(0,0);});
  function chatLine(name,text,notice=false) {
    const p=document.createElement('p');if(notice)p.className='notice';if(name){const b=document.createElement('b');b.textContent=name;p.append(b);}p.append(document.createTextNode(text));$('chat-log').append(p);while($('chat-log').children.length>40)$('chat-log').firstChild.remove();$('chat-log').scrollTop=$('chat-log').scrollHeight;
  }
  function connect() {
    if(!running||!/^https?:$/.test(location.protocol))return;
    if(socket&&[0,1].includes(socket.readyState))return;
    let onlineUrl=globalThis.STARDROP_CONFIG?.onlineUrl||`${location.protocol==='https:'?'wss':'ws'}://${location.host}/play`;
    if(location.protocol==='https:'&&!onlineUrl.startsWith('wss://'))return;
    try {socket=new WebSocket(onlineUrl);}catch(_){return;}
    socket.onopen=()=>{reconnectAttempts=0;socket.send(JSON.stringify({type:'join',name:state.name,map:state.map,x:state.x,y:state.y}));$('online-status').textContent='● Đã kết nối';};
    socket.onmessage=e=>{if(typeof e.data!=='string'||e.data.length>65536)return;let m;try{m=JSON.parse(e.data);}catch(_){return;}if(!m||typeof m!=='object'||Array.isArray(m))return;
      if(m.type==='welcome'&&typeof m.id==='string'&&m.id.length<=64)onlineId=m.id;
      if(m.type==='snapshot'&&Array.isArray(m.players)){
        const previous=new Map(peers);peers.clear();
        m.players.slice(0,60).forEach(p=>{if(p&&typeof p.id==='string'&&p.id.length<=64&&typeof p.name==='string'&&p.name.length<=72&&D.regions.some(r=>r.id===p.map)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.id!==onlineId){
          const old=previous.get(p.id),sameMap=old?.map===p.map,travel=sameMap?Math.hypot(p.x-old.x,p.y-old.y):0;
          peers.set(p.id,{...p,direction:['up','down','left','right'].includes(p.direction)?p.direction:sameMap&&travel>.01?directionFor(p.x-old.x,p.y-old.y,old.direction):p.facingRight===false?'left':'right',walkDistance:(sameMap?old.walkDistance||0:0)+(p.moving&&travel<220?travel:0),receivedAt:animation});
        }});$('player-count').textContent=`${m.players.length} người`;
      }
      if(m.type==='chat'&&typeof m.name==='string'&&typeof m.text==='string')chatLine(m.name.slice(0,72),m.text.slice(0,560));
      if(m.type==='notice'&&typeof m.text==='string')chatLine('',m.text.slice(0,560),true);
    };
    socket.onerror=()=>{};socket.onclose=()=>{peers.clear();onlineId=null;$('online-status').textContent='Chơi một mình';$('player-count').textContent='1 người';clearTimeout(reconnectTimer);if(running){const delay=Math.min(30000,4000*2**Math.min(reconnectAttempts++,3))+Math.floor(Math.random()*1000);reconnectTimer=setTimeout(connect,delay);}};
  }
  $('chat-form').addEventListener('submit',e=>{e.preventDefault();const text=$('chat-input').value.trim().slice(0,140);if(!text)return;if(socket?.readyState===1&&onlineId){socket.send(JSON.stringify({type:'chat',text}));$('chat-input').value='';}else toast('Chat cần mở game qua server: node server.js');});
  chatLine('','Tới gần cư dân và nhấn E để gặp gỡ. Chat trực tuyến khi mở game qua server.',true);
  const nativeFull = () => !!(document.fullscreenElement||document.webkitFullscreenElement);
  function syncFullscreen() {const expanded=nativeFull()||$('game-wrapper').classList.contains('pseudo-fullscreen');$('btn-fullscreen').innerHTML=`${expanded?'⊡':'⛶'} <span>${expanded?'Thu nhỏ':'Toàn màn hình'}</span>`;$('btn-fullscreen').setAttribute('aria-label',expanded?'Thu nhỏ màn hình':'Phóng toàn màn hình');$('btn-fullscreen').setAttribute('aria-pressed',String(expanded));}
  $('btn-fullscreen').addEventListener('click',async()=>{
    const w=$('game-wrapper');
    if(nativeFull()){try{await (document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch(_){toast('Trình duyệt chưa cho phép thu nhỏ. Bạn có thể nhấn Esc.');}w.classList.remove('pseudo-fullscreen');}
    else if(w.classList.contains('pseudo-fullscreen'))w.classList.remove('pseudo-fullscreen');
    else{const fn=w.requestFullscreen||w.webkitRequestFullscreen;if(!fn)w.classList.add('pseudo-fullscreen');else try{await fn.call(w);}catch(_){w.classList.add('pseudo-fullscreen');}}
    syncFullscreen();
  });
  for(const e of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(e,()=>{if(nativeFull())$('game-wrapper').classList.remove('pseudo-fullscreen');syncFullscreen();});
  const typing = () => ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  document.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='escape'){clearMovement();if(fishing){fishing=null;$('fishing').hidden=true;}else if($('game-wrapper').classList.contains('pseudo-fullscreen')){$('game-wrapper').classList.remove('pseudo-fullscreen');syncFullscreen();}return;}
    if(typing()||!running||modal)return;
    if(fishing){if(['e','enter'].includes(k)){e.preventDefault();interact();}return;}
    if(['BUTTON','A'].includes(document.activeElement?.tagName)&&[' ','enter'].includes(k))return;
    if(['arrowup','arrowdown','arrowleft','arrowright',' ','e','q','b','i'].includes(k))e.preventDefault();
    if(e.repeat)return;
    keys.add(k);
    if(k==='shift')syncRunControl();
    if(k==='e'||k==='enter')interact();if(k===' ')attack();if(k==='q')showJournal();if(k==='b')showBuild();if(k==='i')showInventory();
  });
  document.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='shift'){playerRunning=!!state.moving&&wantsRun();syncRunControl();}});
  window.addEventListener('blur',clearMovement);
  $('chat-input').addEventListener('focus',clearMovement);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearMovement();save();}});
  window.addEventListener('pagehide',()=>{clearMovement();save();clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.close();socket=null;}onlineId=null;peers.clear();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&running)connect();});
  document.querySelectorAll('[data-move]').forEach(b=>{
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(running&&!modal&&!fishing&&!typing())touchKeys.add(b.dataset.move);});
    for(const e of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(e,()=>touchKeys.delete(b.dataset.move));
  });
  $('touch-interact').addEventListener('click',interact);$('touch-attack').addEventListener('click',attack);
  $('touch-run').addEventListener('click',()=>{if(!running||modal||fishing||typing())return;touchRun=!touchRun;playerRunning=!!state.moving&&wantsRun();syncRunControl();});
  function resourceReady(o) {return Date.now()-(state.resources[o.id]||0)>=30000;}
  function pickNearest() {
    const residents=npcs.filter(n=>n.map===state.map&&distance(n,state)<78).sort((a,b)=>distance(a,state)-distance(b,state));
    // A resident walking past a resource remains easy to talk to with E.
    if(residents.length)return {...residents[0],kind:'npc'};
    const candidates=world[state.map].objects;
    return candidates.filter(o=>distance(o,state)<(o.kind==='gate'?100:78)).sort((a,b)=>distance(a,state)-distance(b,state))[0]||null;
  }
  function interact() {
    if(!running||modal||typing())return;
    if(fishing){finishFishing();return;}
    near=pickNearest();if(!near){toast('Tới gần cư dân, tài nguyên hoặc biển chỉ dẫn rồi nhấn E.');return;}
    if(C.isNight(state)&&state.map==='village')C.event(state,'night','village',1,D);
    const o=near;
    if(o.kind==='npc'){talk(o);return;}
    if(o.kind==='gate'){
      if(!C.visit(state,o.to,D)){toast(o.to==='coast'?'Xây Cầu Gió Biển để mở đường đến vịnh.':'Xây Kho Chuyện Mây để tìm đường tới tàn tích.');return;}
      state.x=800;state.y=o.to==='village'?170:910;near=null;clearMovement();playerDirection='down';walkDistance=0;actorMotions.delete('player');particles.length=0;effects.length=0;effect('ring',state.x,state.y,'','#c9ead2');refreshHUD();save();toast(`Đã tới ${D.regions.find(r=>r.id===o.to).name}`);return;
    }
    if(o.kind==='resource'){
      if(!resourceReady(o)){toast('Tài nguyên đang hồi phục. Hãy quay lại sau 30 giây.');return;}
      if(state.stamina<4){toast('Bạn cần nghỉ bên ghế hoặc dùng trà trong túi.');return;}
      const amount=o.item==='star'||o.item==='crystal'?1:3, gained=C.addItem(state,o.item,amount,D);
      if(!gained){toast('Túi đã đầy. Hãy bán, chế tạo hoặc nâng cấp túi.');return;}
      state.stamina-=4;state.resources[o.id]=Date.now();state.xp+=4;C.event(state,'gather',o.item,gained,D);
      if(o.item==='herb'&&C.weather(state)==='rain')C.event(state,'rain','herb',1,D);
      burst(o.x,o.y-20,o.item==='star'?'#fff0a1':'#c1e092',`${D.items[o.item].icon} +${gained} ${D.items[o.item].name}`);
      effect('text',o.x,o.y-42,`+${gained} ${D.items[o.item].name}`,'#fff4c9');
    }
    if(o.kind==='fish'){
      if(state.stamina<6){toast('Cần ít nhất 6 thể lực để thả câu.');return;}
      clearMovement();fishing={elapsed:0,rippleTimer:0,position:0,spot:o};effect('ripple',o.x+30,o.y,'','#bfe6dc');$('fishing').hidden=false;return;
    }
    if(o.kind==='plot'){
      const planted=state.crops[o.i],wait=state.upgrades.includes('greenhouse')?8000:16000;
      if(planted===null){if(state.stamina<3){toast('Bạn cần nghỉ trước khi gieo trồng.');return;}state.crops[o.i]=Date.now();state.stamina-=3;C.event(state,'plant','berry',1,D);effect('sprout',o.x,o.y,'','#b9dd83');toast('Đã gieo mâm xôi. Cây chín sau 16 giây; nhà kính rút còn 8 giây.');}
      else if(Date.now()-planted>=wait){const gained=C.addItem(state,'berry',4,D);if(!gained){toast('Túi mâm xôi đã đầy.');return;}state.crops[o.i]=null;C.event(state,'harvest','berry',1,D);C.event(state,'gather','berry',gained,D);state.xp+=8;burst(o.x,o.y,'#efa29c',`Thu hoạch +${gained} mâm xôi!`);effect('text',o.x,o.y-30,`+${gained} mâm xôi`,'#ffe4c5');}
      else toast(`Cây đang lớn. Còn ${Math.ceil((wait-Date.now()+planted)/1000)} giây.`);
    }
    if(o.kind==='shrine'){
      if(!state.shrines.includes(state.map)){if(state.inventory.star+2>C.capacity(state)){toast('Cần chỗ cho 2 mảnh sao trong túi trước khi đánh thức bia.');return;}state.shrines.push(state.map);state.xp+=35;C.event(state,'shrine',state.map,1,D);C.addItem(state,'star',2,D);burst(o.x,o.y-50,'#bceef0','Bia ký ức thức giấc. +2 mảnh sao, +35 XP!');}
      else toast('Bia đã thức giấc. Những vì sao là các hạt giống ánh sáng, hãy gom chúng để thắp Đèn Dẫn Sao.');
    }
    if(o.kind==='chest'){
      if(state.chests.includes(o.id)){toast('Chiếc rương này đã được khám phá.');return;}
      if(state.inventory.star+2>C.capacity(state)||state.inventory.ore+3>C.capacity(state)){toast('Cần chỗ cho 2 mảnh sao và 3 quặng trong túi trước khi mở rương.');return;}
      state.chests.push(o.id);state.coins+=90;state.xp+=20;C.addItem(state,'star',2,D);C.addItem(state,'ore',3,D);C.event(state,'chest','treasure',1,D);burst(o.x,o.y-20,'#fbd77f','Kho báu: +90 xu, +2 mảnh sao, +3 quặng!');
    }
    if(o.kind==='camp'){
      openDialog('camp','Nghỉ tại Trại Sao','DỪNG MỘT CHÚT ĐỂ ĐI XA HƠN','<p class="dialogue-text">Ngọn lửa kể lại những chuyến đi. Bạn có thể ngủ để hồi sức và nhận hợp đồng ngày mới, hoặc chờ đến tối để ngắm ánh đèn.</p><div class="npc-actions"><button data-rest>Ngủ tới sáng · hồi toàn bộ sức</button><button data-night>Chờ đến 19:00</button><button data-close>Tiếp tục khám phá</button></div>');return;
    }
    if(o.kind==='bench'||o.kind==='well'){
      const improved=state.upgrades.includes('well');state.stamina=clamp(state.stamina+(improved?70:35),0,100);state.health=clamp(state.health+(improved?35:15),0,100);toast(improved?'Nước suối hồi 70 thể lực, 35 máu.':'Nghỉ một chút: +35 thể lực, +15 máu. Xây giếng để hồi nhanh hơn.');
    }
    refreshHUD();save();
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-night]')){state.minutes=1140;closeDialog();refreshHUD();save();toast('Đêm xuống. Ánh đèn đã soi rõ đường làng.');}});
  function finishFishing() {
    if(!fishing)return;
    const success=fishing.position>=.38&&fishing.position<=.62;
    state.stamina=Math.max(0,state.stamina-6);
    if(success){const gain=C.addItem(state,'fish',1,D);if(gain){C.event(state,'fish','fish',1,D);C.event(state,'gather','fish',1,D);state.xp+=12;burst(fishing.spot.x,fishing.spot.y,'#d6f1ea','Câu được một cá vịnh! +12 XP');effect('text',fishing.spot.x,fishing.spot.y-35,'+1 cá vịnh','#d6f1ea');}else toast('Túi cá đã đầy.');}
    else toast('Cá thoát rồi! Bấm E khi phao nằm trong vùng vàng.');
    fishing=null;$('fishing').hidden=true;clearMovement();refreshHUD();save();
  }
  function attack() {
    if(!running||modal||fishing||typing()||attackCooldown>0)return;
    if(state.stamina<2){toast('Cần thêm thể lực để vung kiếm.');return;}
    swing=.25;attackCooldown=.4;state.stamina-=2;
    effect('slash',state.x,state.y-24,'','#fff4bc');
    const mob=world[state.map].mobs.filter(m=>m.deadUntil<=Date.now()&&distance(m,state)<105).sort((a,b)=>distance(a,state)-distance(b,state))[0];
    if(mob){mob.hp--;mob.hitTime=.2;burst(mob.x,mob.y-20,'#fff0a7');effect('text',mob.x,mob.y-50,'−1','#ffe7a9');if(mob.hp<=0){mob.deadUntil=Date.now()+35000;C.event(state,'fight','slime',1,D);state.coins+=18;state.xp+=18;const drop=state.map==='ruins'?'crystal':'ore',gained=C.addItem(state,drop,1,D);effect('text',mob.x,mob.y-65,'+18 xu','#f7e4a3');toast(`Tinh linh trở về rừng · +18 xu · +18 XP${gained?` · +1 ${D.items[drop].name}`:' · Túi đầy, không nhặt được vật liệu'}`);save();}}
    refreshHUD();
  }
  function blockedAt(map,x,y) {
    if(x<25||y<40||x>1575||y>1075)return true;
    // The pond's raised banks and building foundations have physical footprints.
    if(x>1110&&x<1490&&y>625&&y<905)return true;
    if(map==='village'&&buildings.some(b=>x>b.x-b.w/2-8&&x<b.x+b.w/2+8&&y>b.y-62&&y<b.y+9))return true;
    return world[map].trees.some(t=>Math.abs(x-t.x)<13&&Math.abs(y-t.y)<11);
  }
  function collides(x,y) {return blockedAt(state.map,x,y);}
  function movePlayer(dx,dy) {
    const steps=Math.ceil(Math.hypot(dx,dy)/4);
    if(!steps)return;
    for(let i=0;i<steps;i++){
      if(!collides(state.x+dx/steps,state.y))state.x+=dx/steps;
      if(!collides(state.x,state.y+dy/steps))state.y+=dy/steps;
    }
  }
  function moveMob(m,map,targetX,targetY,speed,dt) {
    const dx=targetX-m.x,dy=targetY-m.y,dist=Math.hypot(dx,dy);
    if(dist<.01)return;
    // Follow the whole segment in small steps, including after a blocked wander target.
    const travel=Math.min(dist,speed*Math.min(dt,.25)),steps=Math.ceil(travel/4);
    if(!steps)return;
    const stepX=dx/dist*travel/steps,stepY=dy/dist*travel/steps;
    for(let i=0;i<steps;i++){
      if(blockedAt(map,m.x+stepX,m.y+stepY))break;
      m.x+=stepX;m.y+=stepY;
    }
  }
  function update(dt) {
    const paused=!!modal||typing();
    if(!paused){animation+=dt;attackCooldown=Math.max(0,attackCooldown-dt);swing=Math.max(0,swing-dt);hurtCooldown=Math.max(0,hurtCooldown-dt);}
    if(!modal&&!typing()){
      if(fishing){fishing.elapsed+=dt;fishing.rippleTimer+=dt;if(fishing.rippleTimer>=.85){effect('ripple',fishing.spot.x+30,fishing.spot.y,'','#bfe6dc');fishing.rippleTimer=0;}fishing.position=(Math.sin(fishing.elapsed*3.8-Math.PI/2)+1)/2;$('fish-marker').style.left=`${fishing.position*98}%`;}
      else{
        const oldX=state.x,oldY=state.y;
        let dx=(keys.has('d')||keys.has('arrowright')||touchKeys.has('right')?1:0)-(keys.has('a')||keys.has('arrowleft')||touchKeys.has('left')?1:0),dy=(keys.has('s')||keys.has('arrowdown')||touchKeys.has('down')?1:0)-(keys.has('w')||keys.has('arrowup')||touchKeys.has('up')?1:0);
        if(dx||dy){playerDirection=directionFor(dx,dy);if(dx)facing=dx>0?1:-1;const len=Math.hypot(dx,dy),travel=moveSpeed()*Math.min(dt,.25);movePlayer(dx/len*travel,dy/len*travel);}
        const travelled=Math.hypot(state.x-oldX,state.y-oldY);
        state.moving=travelled>.01;playerRunning=state.moving&&wantsRun();walkDistance+=travelled;
        if(state.moving){stepTimer+=dt;if(stepTimer>=(playerRunning?.11:.18)){effect('dust',state.x,state.y+2,'',C.weather(state)==='rain'?'#c0dad1':state.map==='coast'?'#ebd5a8':'#daceb0');stepTimer=0;}}
        else stepTimer=0;
      }
      if(!fishing)NPC.updateNPCs(npcs,dt,{map:state.map,player:state,isBlocked:blockedAt});
      else {state.moving=false;playerRunning=false;npcs.forEach(n=>{n.moving=false;});}
      state.minutes+=dt*4;
      if(state.minutes>=1440){C.nextDay(state,D);state.minutes=0;toast('Sang ngày mới. Sổ hợp đồng vừa được cập nhật.');save();}
      regenTimer+=dt;
      if(regenTimer>2){state.stamina=clamp(state.stamina+(state.map==='village'&&state.upgrades.includes('well')?3:1),0,100);regenTimer=0;}
      const mobMap=state.map;
      world[mobMap].mobs.forEach(m=>{
        if(state.map!==mobMap)return;
        m.hitTime=Math.max(0,(m.hitTime||0)-dt);
        if(m.deadUntil>Date.now())return;if(m.hp<=0)m.hp=3;
        const dist=distance(m,state);
        if(dist<220&&dist>25)moveMob(m,mobMap,state.x,state.y,38,dt);
        else if(dist>=220)moveMob(m,mobMap,m.homeX+Math.sin(animation*.6+m.phase)*30,m.homeY+Math.cos(animation*.6+m.phase)*20,24,dt);
        if(dist<30&&hurtCooldown<=0){state.health-=8;hurtCooldown=1.2;burst(state.x,state.y-30,'#ed9c8c');if(state.health<=0){state.coins=Math.max(0,state.coins-30);state.health=100;state.stamina=70;state.map='village';state.x=800;state.y=720;clearMovement();playerDirection='down';walkDistance=0;toast('Mira đưa bạn về trại. Mất 30 xu, hãy nghỉ rồi tiếp tục.');save();}}
      });
    }else {state.moving=false;playerRunning=false;npcs.forEach(n=>{n.moving=false;});}
    updateActorMotions(dt,paused||!!fishing);
    syncRunControl();
    camera.x=clamp(Math.round(state.x-480),0,640);camera.y=clamp(Math.round(state.y-viewHeight/2),0,Math.max(0,1100-viewHeight));
    near=modal||fishing?null:pickNearest();
    const descriptions={npc:'Trò chuyện',resource:'Thu thập',gate:'Đi tới',plot:state.crops[near?.i]===null?'Gieo mâm xôi':'Kiểm tra / thu hoạch',fish:'Thả câu',camp:'Nghỉ / chờ tối',bench:'Hồi sức',well:'Hồi sức',shrine:'Đánh thức',chest:'Khám phá'};
    $('interaction-hint').textContent=near?`E · ${descriptions[near.kind]} ${near.name||''}`:'';
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];if(p.map!==state.map){particles.splice(i,1);continue;}if(!paused){p.age+=dt;p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;}if(p.life<=0)particles.splice(i,1);}
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];if(e.map!==state.map){effects.splice(i,1);continue;}if(!paused)e.age+=dt;if(e.age>=e.life)effects.splice(i,1);}
    if(performance.now()>toastUntil)$('toast').classList.remove('visible');
    hudTimer+=dt;if(hudTimer>.45){refreshHUD();hudTimer=0;}
    moveTimer+=dt;if(moveTimer>.1){if(socket?.readyState===1&&onlineId)socket.send(JSON.stringify({type:'move',map:state.map,x:state.x,y:state.y,facingRight:facing>0,direction:playerDirection,moving:state.moving,running:playerRunning}));moveTimer=0;}
    if(performance.now()-lastSaved>5000)save();
  }
  function pixelEllipse(c,x,y,w,h,color) {rect(c,x-w/2+4,y-h/2,w-8,h,color);rect(c,x-w/2,y-h/2+3,w,h-6,color);}
  function tree(c,x,y,size=1,tone=0) {
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(size,size);
    pixelEllipse(c,8,0,65,16,'#3d694738');
    rect(c,-6,-48,12,49,'#624c39');rect(c,-3,-42,4,42,'#a2784b');rect(c,3,-34,3,32,'#423d34');
    c.save();c.translate(reducedMotion?0:Math.round(Math.sin(animation*.95+x*.013)*2),0);
    const colors=[['#335f50','#4a8060','#6d9a66','#97b672'],['#3c6860','#518b71','#74aa7b','#a7c480'],['#466d46','#679657','#87af66','#bac784']][tone];
    rect(c,-20,-84,40,62,colors[0]);rect(c,-32,-74,64,41,colors[0]);rect(c,-39,-62,78,22,colors[0]);
    rect(c,-28,-77,50,40,colors[1]);rect(c,-35,-63,59,23,colors[1]);rect(c,-15,-89,32,20,colors[1]);
    rect(c,-17,-82,29,20,colors[2]);rect(c,-28,-65,22,16,colors[2]);rect(c,10,-68,13,11,colors[2]);
    rect(c,-12,-81,11,5,colors[3]);rect(c,-24,-62,8,4,colors[3]);rect(c,1,-72,8,4,colors[3]);
    rect(c,-33,-36,13,3,colors[0]);rect(c,15,-27,15,4,colors[0]);c.restore();c.restore();
  }
  function house(c,b,active=true) {
    const {x,y,w,h,roof}=b,left=x-w/2,top=y-h;
    pixelEllipse(c,x+14,y+10,w+38,25,'#344d4129');
    rect(c,left-7,y-10,w+24,18,'#6f7460');rect(c,left-7,y-8,w+24,5,'#9a9c7a');
    rect(c,left,top+43,w,h-43,'#e6d7a6');rect(c,left+w-24,top+43,24,h-43,'#baae84');
    for(let i=0;i<4;i++)rect(c,left,top+58+i*15,w,2,'#c7b68e');
    rect(c,left+3,y-6,w-6,6,'#9c855c');rect(c,left+w-20,top+56,4,h-64,'#a2936f');
    // Stepped roof silhouette, tile seams, eaves and a shaded right face give volume.
    for(let i=0;i<7;i++){const inset=(6-i)*8;rect(c,left-15+inset,top+i*7,w+30-inset*2,8,roof);}
    rect(c,left-15,top+45,w+30,8,'#694f53');rect(c,left-12,top+43,w+24,5,roof);
    c.fillStyle='#ffffff28';for(let row=0;row<6;row++)for(let col=0;col<8;col++){const tx=left-5+col*20+(row%2)*10;if(tx>left+(6-row)*7&&tx<left+w-(6-row)*7)c.fillRect(tx,top+row*7+4,14,2);}
    rect(c,x-10,top-5,20,7,'#715c58');rect(c,x-6,top-8,12,4,'#d8c28d');
    rect(c,left+w-36,top+1,13,22,'#a68b70');rect(c,left+w-40,top-4,21,7,'#d3bb98');
    const windowColor=active?'#edce85':'#a6aba0';
    [left+17,left+w-47].forEach(wx=>{rect(c,wx,top+66,26,29,'#847860');rect(c,wx+3,top+69,20,23,windowColor);rect(c,wx+12,top+69,3,23,'#7f7864');rect(c,wx+3,top+79,20,3,'#7f7864');rect(c,wx-3,top+95,32,5,'#758365');rect(c,wx+2,top+94,6,5,'#bf8067');rect(c,wx+16,top+94,7,5,'#d9a96e');});
    rect(c,x-15,y-44,30,44,'#786045');rect(c,x-11,y-41,22,37,active?'#a18a59':'#7c7970');rect(c,x+5,y-23,4,4,'#e9cf8b');rect(c,x-18,y,36,6,'#c3b18a');
    if(b.kind==='market'){rect(c,left-6,top+65,w+12,10,'#f1cc85');for(let i=0;i<6;i++)rect(c,left-6+i*28,top+65,14,10,'#c97869');}
    if(b.kind==='greenhouse'){rect(c,left+4,top+54,w-8,30,'#80b6aa');for(let i=0;i<5;i++)rect(c,left+12+i*23,top+57,3,25,'#e4e1b9');rect(c,left+10,top+60,w-20,3,'#b7d3be');}
    if(!active){rect(c,x-26,y-38,52,8,'#b19775');rect(c,x-27,y-20,54,7,'#b19775');}
    const name=b.upgrade?D.upgrades.find(u=>u.id===b.upgrade).name:b.name;
    label(c,name,x,y+24,11,active?'#fff8de':'#ecdfb4');
  }
  function actor(c,x,y,shirt,hair,moving=false,isPlayer=false,direction='down',distance=0,running=false,id=isPlayer?'player':'resident') {
    const local=isPlayer&&id==='player';
    const motion=c===ctx?actorMotions.get(local?'player':`npc:${id}`):null;
    return A.draw(c,{x,y,shirt,hair,id,direction,moving:!!moving,running:!!running,distance,...(motion?{phase:motion.phase,motionWeight:motion.motionWeight,runWeight:motion.runWeight}:{}),time:animation,reducedMotion,isPlayer,lantern:local&&state.inventory.lantern>0,hidden:local&&!reducedMotion&&hurtCooldown>.6&&Math.floor(animation*12)%2===0});
  }
  function lamp(c,x,y) {
    pixelEllipse(c,x+8,y+2,35,8,'#314b4838');rect(c,x-4,y-66,8,67,'#53626a');rect(c,x-2,y-65,3,66,'#85918a');rect(c,x-8,y-2,16,5,'#45525e');rect(c,x-11,y-79,22,8,'#50626b');rect(c,x-8,y-71,16,18,'#d8ae63');rect(c,x-5,y-68,10,12,'#fff1b0');rect(c,x-11,y-55,22,4,'#52636b');rect(c,x-2,y-83,4,5,'#52636b');
  }
  function resource(c,o) {
    const x=o.x,y=o.y,ready=resourceReady(o);pixelEllipse(c,x,y+2,28,8,'#314b482b');
    if(!ready){rect(c,x-5,y-5,10,5,'#917c54');return;}
    if(o.item==='wood'){rect(c,x-18,y-16,36,14,'#966744');rect(c,x-20,y-15,7,12,'#d6ac76');rect(c,x-18,y-12,3,6,'#a1744a');rect(c,x-10,y-15,23,3,'#b88b55');rect(c,x-12,y-2,31,3,'#72563b');}
    else if(o.item==='ore'||o.item==='crystal'){const crystal=o.item==='crystal';rect(c,x-15,y-16,30,14,crystal?'#7795c2':'#7e8a8f');rect(c,x-9,y-24,18,12,crystal?'#abc9e6':'#a4ac9a');rect(c,x-17,y-7,33,5,crystal?'#5b72a4':'#606f79');rect(c,x-8,y-20,7,5,crystal?'#d4e4ed':'#d29c75');rect(c,x+4,y-10,5,4,crystal?'#c9eced':'#e1b286');}
    else if(o.item==='herb'||o.item==='berry'){rect(c,x-3,y-25,6,25,'#527d51');rect(c,x-18,y-18,17,9,'#6a985b');rect(c,x+2,y-25,15,9,'#85af6b');rect(c,x-12,y-28,10,10,'#9cbe75');rect(c,x+4,y-13,14,9,'#547f58');if(o.item==='berry')[[x-12,y-16],[x+6,y-21],[x+10,y-8]].forEach(([bx,by])=>{rect(c,bx,by,6,6,'#d87b83');rect(c,bx,by,3,2,'#f2b1a3');});}
    else if(o.item==='star'){const pulse=reducedMotion?0:Math.sin(animation*3+o.x)*2;rect(c,x-4,y-25+pulse,8,25,'#eacb77');rect(c,x-12,y-17+pulse,24,8,'#f9e5a0');rect(c,x-2,y-19+pulse,4,12,'#fff6c9');if(state.upgrades.includes('observatory')){label(c,'✦',x,y-37,14,'#fff3bd');}}
  }
  function drawObject(c,o) {
    const x=o.x,y=o.y;
    if(o.kind==='resource'){resource(c,o);return;}
    if(o.kind==='gate'){
      rect(c,x-4,y-60,8,60,'#8a7050');rect(c,x-56,y-63,112,23,'#bb9961');rect(c,x-52,y-59,104,15,'#ecd49a');label(c,o.name,x,y-47,10,'#506356');rect(c,x-10,y-2,20,4,'#b4aa78');
      const locked=(o.to==='coast'&&!state.upgrades.includes('bridge'))||(o.to==='ruins'&&!state.upgrades.includes('archive'));
      label(c,locked?'⌑ Chưa mở':'E →',x,y+16,11,locked?'#edcdaf':'#fff8d6');
      if(o.to==='coast'){for(let i=0;i<5;i++)rect(c,x-55+i*24,y+35,19,12,state.upgrades.includes('bridge')?'#bb9362':'#6b8579');}
    }
    if(o.kind==='plot'){
      rect(c,x-25,y-26,52,47,'#5f5549');rect(c,x-22,y-23,46,40,'#8d6b50');for(let i=0;i<4;i++)rect(c,x-20,y-18+i*10,42,3,'#a6845c');
      if(state.crops[o.i]!==null){const grown=Date.now()-state.crops[o.i]>=(state.upgrades.includes('greenhouse')?8000:16000);for(let i=0;i<3;i++){rect(c,x-17+i*14,y-19,6,grown?25:12,'#638856');rect(c,x-20+i*14,y-11,13,6,'#97b966');if(grown)rect(c,x-18+i*14,y-18,7,7,'#df8690');}}
    }
    if(o.kind==='bench'){rect(c,x-29,y-30,58,8,'#b58d5a');rect(c,x-29,y-20,58,7,'#e0ba7d');rect(c,x-24,y-13,6,16,'#786852');rect(c,x+18,y-13,6,16,'#786852');}
    if(o.kind==='well'){pixelEllipse(c,x,y,56,25,'#647a6b');rect(c,x-25,y-28,50,27,state.upgrades.includes('well')?'#b2b19a':'#848d7b');rect(c,x-21,y-33,42,12,'#667978');rect(c,x-17,y-30,34,7,'#79b9c0');rect(c,x-26,y-51,5,31,'#927755');rect(c,x+21,y-51,5,31,'#927755');rect(c,x-29,y-57,58,8,'#aa7758');}
    if(o.kind==='camp'){rect(c,x-31,y-30,62,28,'#b47e5b');rect(c,x-25,y-42,50,15,'#dec793');rect(c,x-17,y-49,34,9,'#f1dba0');rect(c,x-10,y-30,20,28,'#675345');rect(c,x-10,y+10,25,6,'#8d6546');rect(c,x-8,y+2,15,13,'#d47e43');rect(c,x-5,y-5,9,17,'#f4c96d');rect(c,x-2,y-8+(reducedMotion?0:Math.sin(animation*6)*3),4,17,'#fff1b4');}
    if(o.kind==='fish'){rect(c,x-25,y-5,50,12,'#a58f63');for(let i=0;i<5;i++)rect(c,x-25+i*10,y-5,2,12,'#756d52');label(c,'≈',x+30,y-10,21,'#e2f1cc');}
    if(o.kind==='shrine'){const active=state.shrines.includes(state.map);pixelEllipse(c,x,y+3,75,15,'#46596e40');rect(c,x-30,y-10,60,12,'#888f93');rect(c,x-19,y-70,38,61,'#a9b4ad');rect(c,x+10,y-70,9,60,'#7e8d95');rect(c,x-12,y-77,24,8,'#cbd0b8');rect(c,x-9,y-56,18,4,active?'#dcf4c2':'#768d95');rect(c,x-4,y-60,8,28,active?'#f1eeb2':'#91a5a4');if(active)label(c,'✦',x,y-91,18,'#fff1b4');}
    if(o.kind==='chest'){const opened=state.chests.includes(o.id);rect(c,x-23,y-23,46,26,'#85694b');rect(c,x-24,y-27,48,10,opened?'#6b5a49':'#b08a52');rect(c,x-22,y-17,42,14,'#bc9460');rect(c,x-16,y-23,5,25,'#e2bb6d');rect(c,x+12,y-23,5,25,'#e2bb6d');rect(c,x-3,y-13,6,7,'#f6d88d');}
  }
  function terrain(map) {
    if(terrainCache.has(map))return terrainCache.get(map);
    const c=document.createElement('canvas');c.width=1600;c.height=1100;const g=c.getContext('2d'),random=rng(150+['village','forest','coast','ruins'].indexOf(map)*811);
    const colors=map==='village'?['#91b975','#9cbd7c','#8eb174','#a0bf81']:map==='forest'?['#719d73','#749d71','#689371','#7ba479']:map==='coast'?['#b9c99c','#c0cea0','#b0c59a','#c6cfa3']:['#a2aba2','#aab1a5','#9ea8a1','#b0b6a8'];
    for(let y=0;y<1100;y+=24)for(let x=0;x<1600;x+=24){rect(g,x,y,24,24,colors[Math.floor(random()*colors.length)]);if(random()>.35){rect(g,x+4+Math.floor(random()*12),y+6,3,4,'#57794f35');rect(g,x+7+Math.floor(random()*12),y+14,2,3,'#e3dd9c50');}}
    if(map==='coast'){rect(g,1010,590,550,420,'#e2d39c');for(let i=0;i<100;i++)rect(g,1020+random()*520,600+random()*400,3,2,'#b8ac7e');}
    P.draw(g,layouts[map]);
    // Layered bank: shaded earth below a lighter stone lip, then deep and shallow water.
    rect(g,1110,640,380,267,'#726f66');rect(g,1130,616,340,311,'#726f66');rect(g,1106,630,380,262,'#e1d7ad');rect(g,1124,608,344,298,'#e1d7ad');rect(g,1120,644,352,230,'#6a9d9e');rect(g,1140,626,310,265,'#6a9d9e');rect(g,1132,657,326,202,'#7fb6b0');rect(g,1152,642,286,232,'#79b2af');
    for(let i=0;i<70;i++){const x=1140+random()*300,y=650+random()*200;rect(g,x,y,12+random()*20,2,'#b3d7c160');}
    for(let i=0;i<30;i++){const x=1120+(i%15)*25,y=i<15?623:890;rect(g,x,y,8,5,'#c4bd94');}
    if(map==='ruins')for(let i=0;i<12;i++){const x=180+random()*1200,y=200+random()*700;if(P.contains(layouts[map],x+22,y,55)||(x>1060&&y>570))continue;rect(g,x,y,45,8,'#8e9894');rect(g,x+7,y-40,29,42,'#bcc2b4');rect(g,x+31,y-40,5,42,'#899b9c');rect(g,x+4,y-44,36,8,'#d1d0bc');}
    terrainCache.set(map,c);return c;
  }
  function drawEffects() {
    ctx.save();
    effects.filter(e=>e.map===state.map).forEach(e=>{
      const p=clamp(e.age/e.life,0,1);ctx.globalAlpha=1-p;
      if(e.kind==='text')label(ctx,e.text,e.x,e.y-p*30,12,e.color);
      else if(e.kind==='dust'){rect(ctx,e.x-8-p*8,e.y-p*5,5,3,e.color);rect(ctx,e.x+3+p*7,e.y-p*3,4,3,e.color);}
      else if(e.kind==='sprout'){const h=8+Math.sin(p*Math.PI)*12;rect(ctx,e.x-1,e.y-h,3,h,e.color);rect(ctx,e.x-8,e.y-h+2,8,4,e.color);rect(ctx,e.x+2,e.y-h-3,8,4,e.color);}
      else if(e.kind==='slash'){ctx.strokeStyle=e.color;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<8;i++){const a=-1.3+i*.3+p*.65,dx=Math.cos(a)*40,dy=Math.sin(a)*34,offset=e.direction==='left'?[-dx,dy]:e.direction==='up'?[dy,-dx]:e.direction==='down'?[-dy,dx]:[dx,dy],x=e.x+offset[0],y=e.y+offset[1];if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
      else {const radius=(e.kind==='ripple'?7:12)+p*25;for(let i=0;i<16;i++){const a=i*Math.PI/8;rect(ctx,e.x+Math.cos(a)*radius,e.y+Math.sin(a)*radius*.35,4,2,e.color);}}
    });
    ctx.restore();
  }
  function lightSources() {
    const sources=[{x:state.x,y:state.y-20,r:state.inventory.lantern?170:62,power:state.inventory.lantern?.97:.38}];
    if(state.map==='village'){
      [...lamps,...(state.upgrades.includes('lamps')?extraLamps:[])].forEach(l=>sources.push({x:l.x,y:l.y-62,r:140,power:.96}));
      buildings.forEach(b=>{if(!b.upgrade||state.upgrades.includes(b.upgrade))sources.push({x:b.x,y:b.y-36,r:95,power:.65});});
      sources.push({x:camp.x,y:camp.y+4,r:110,power:.8});
      if(state.upgrades.includes('beacon'))sources.push({x:800,y:310,r:340,power:1});
    }else world[state.map].objects.filter(o=>o.kind==='shrine'&&state.shrines.includes(state.map)).forEach(o=>sources.push({x:o.x,y:o.y-40,r:160,power:.8}));
    world[state.map].objects.filter(o=>o.item==='star'&&resourceReady(o)).forEach(o=>sources.push({x:o.x,y:o.y-12,r:38,power:.3}));
    return sources;
  }
  function drawLighting() {
    const night=C.isNight(state),rain=C.weather(state)==='rain';
    let dusk=0;if(state.minutes>=1020&&state.minutes<1140)dusk=(state.minutes-1020)/120*.36;else if(state.minutes>=360&&state.minutes<420)dusk=(420-state.minutes)/60*.3;
    const darkness=Math.min(.64,(night?.53:dusk)+(rain?.13:0));
    dc.clearRect(0,0,960,viewHeight);dc.globalCompositeOperation='source-over';dc.fillStyle=`rgba(25,35,61,${darkness})`;dc.fillRect(0,0,960,viewHeight);
    const lights=lightSources();dc.globalCompositeOperation='destination-out';
    lights.forEach(l=>{const x=l.x-camera.x,y=l.y-camera.y;const gradient=dc.createRadialGradient(x,y,4,x,y,l.r);gradient.addColorStop(0,`rgba(0,0,0,${l.power})`);gradient.addColorStop(.28,`rgba(0,0,0,${l.power*.8})`);gradient.addColorStop(1,'rgba(0,0,0,0)');dc.fillStyle=gradient;dc.fillRect(x-l.r,y-l.r,l.r*2,l.r*2);});
    dc.globalCompositeOperation='source-over';ctx.drawImage(darkCanvas,0,0);
    if(darkness>.05){ctx.globalCompositeOperation='screen';lights.filter(l=>l.power>.6).forEach(l=>{const x=l.x-camera.x,y=l.y-camera.y;const glow=ctx.createRadialGradient(x,y,0,x,y,l.r*.55);glow.addColorStop(0,'rgba(248,213,129,0.13)');glow.addColorStop(1,'rgba(248,213,129,0)');ctx.fillStyle=glow;ctx.fillRect(x-l.r,y-l.r,l.r*2,l.r*2);});ctx.globalCompositeOperation='source-over';}
  }
  function actorLabels() {
    const placed=[],actors=[{id:'player',name:state.name,x:state.x,y:state.y,color:'#fff4d7',marker:''},
      ...[...peers.values()].filter(p=>p.map===state.map).map(p=>({...p,color:'#bce9e1',marker:''})),
      ...npcs.filter(n=>n.map===state.map).sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id)).map(n=>({...n,color:'#fff8de',marker:npcMarker(n)}))];
    const overlaps=(a,b)=>Math.abs(a.x-b.x)<(a.width+b.width)/2+4&&a.top<b.bottom+4&&a.bottom>b.top-4;
    actors.forEach(a=>{
      const baseY=a.y-actorMetrics.nameOffset,width=Math.max(36,String(a.name).length*7+12),height=a.marker?34:14;
      let tag={id:a.id,name:a.name,x:a.x,y:baseY,baseY,width,top:baseY-height,bottom:baseY+3,marker:a.marker,color:a.color,anchorX:a.x};
      // Lift colliding labels in bounded rows, then try neighbouring columns for crowds.
      let found=false;
      for(const shift of [0,-96,96,-192,192]){
        for(let row=0;row<24;row++){
          const y=baseY-row*16,candidate={...tag,x:a.x+shift,y,top:y-height,bottom:y+3};
          const coversBody=actors.some(other=>other.id!==a.id&&overlaps(candidate,{x:other.x,width:actorMetrics.bodyWidth,top:other.y-actorMetrics.bodyHeight,bottom:other.y+4}));
          if(!coversBody&&!placed.some(p=>overlaps(candidate,p))){tag=candidate;found=true;break;}
        }
        if(found)break;
      }
      placed.push(tag);
    });
    return placed;
  }
  function drawActorLabels() {
    ctx.save();
    actorLabels().forEach(t=>{
      if(t.y!==t.baseY||t.x!==t.anchorX){ctx.strokeStyle='#f5edc488';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(t.x,t.y+5);ctx.lineTo(t.anchorX,t.baseY+8);ctx.stroke();}
      label(ctx,t.name,t.x,t.y,t.id==='player'?11:12,t.color);
      if(t.marker)label(ctx,t.marker,t.x,t.y-19,20,t.marker==='✓'?'#bcf0bd':'#ffdf7e');
    });
    ctx.restore();
  }
  function drawGame() {
    ctx.clearRect(0,0,960,viewHeight);ctx.save();ctx.translate(-camera.x,-camera.y);ctx.drawImage(terrain(state.map),0,0);
    const ambientOptions={night:C.isNight(state),rain:C.weather(state)==='rain',upgrades:state.upgrades,shrineActive:state.shrines.includes(state.map),reducedMotion,viewport:{x:camera.x,y:camera.y,width:960,height:viewHeight}};
    E.drawGround(ctx,world[state.map].ambient,animation,ambientOptions);
    const drawables=[];
    if(state.map==='village'){
      buildings.forEach(b=>drawables.push({y:b.y,draw:()=>house(ctx,b,!b.upgrade||state.upgrades.includes(b.upgrade))}));
      [...lamps,...(state.upgrades.includes('lamps')?extraLamps:[])].forEach(l=>drawables.push({y:l.y,draw:()=>lamp(ctx,l.x,l.y)}));
      if(state.upgrades.includes('beacon'))drawables.push({y:350,draw:()=>{rect(ctx,770,325,60,25,'#9ba7a2');rect(ctx,786,245,28,80,'#e0cfad');rect(ctx,776,235,48,18,'#718a91');rect(ctx,784,211,32,26,'#f1ca71');rect(ctx,794,205,12,32,'#fff1b4');label(ctx,'Đèn Dẫn Sao',800,377,12);}});
    }
    world[state.map].trees.forEach(t=>drawables.push({y:t.y,draw:()=>tree(ctx,t.x,t.y,t.size,t.tone)}));
    world[state.map].objects.forEach(o=>drawables.push({y:o.y,draw:()=>drawObject(ctx,o)}));
    world[state.map].mobs.filter(m=>m.deadUntil<=Date.now()).forEach(m=>drawables.push({y:m.y,draw:()=>{
      const bounce=reducedMotion?0:Math.sin(animation*5+m.phase)*3,x=m.x,y=m.y+bounce;
      pixelEllipse(ctx,x+3,m.y+4,38,10,'#344c5540');rect(ctx,x-19,y-18,38,16,'#629f89');rect(ctx,x-14,y-28,28,18,'#84bfa0');rect(ctx,x-9,y-30,18,6,'#afd9aa');rect(ctx,x-12,y-14,4,4,'#33595b');rect(ctx,x+7,y-14,4,4,'#33595b');rect(ctx,x-3,y-7,8,3,'#dce5b6');rect(ctx,x-17,y+6,34,4,'#426c5b');rect(ctx,x-17,y+6,Math.max(0,m.hp)/3*34,4,'#e8c16b');
      if(m.hitTime>0&&!reducedMotion){ctx.save();ctx.globalAlpha=.55;rect(ctx,x-14,y-26,28,22,'#fff0c5');ctx.restore();}
    }}));
    npcs.filter(n=>n.map===state.map).forEach(n=>drawables.push({y:n.y,draw:()=>actor(ctx,n.x,n.y,n.shirt,n.hair,n.moving,false,n.direction,n.walkDistance,n.running,n.id)}));
    peers.forEach(p=>{if(p.map===state.map)drawables.push({y:p.y,draw:()=>{const gaitDistance=p.walkDistance+(p.moving?Math.min(.2,Math.max(0,animation-p.receivedAt))*(p.running?297:180):0);actor(ctx,p.x,p.y,p.color,'#544152',p.moving,true,p.direction,gaitDistance,p.running,p.id);}});});
    drawables.push({y:state.y,draw:()=>{actor(ctx,state.x,state.y,'#579b9c','#564247',state.moving,true,playerDirection,walkDistance,playerRunning,'player');if(swing>0){const angle=reducedMotion?0:(.25-swing)/.25*1.8-.9,heading={up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2}[playerDirection];ctx.save();ctx.translate(state.x,state.y-22);ctx.rotate(heading+angle);rect(ctx,0,-42,5,38,'#dfe9dc');rect(ctx,-5,-8,15,4,'#e7c885');rect(ctx,0,-4,5,13,'#937052');ctx.restore();}}});
    drawables.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    drawActorLabels();
    if(near){ctx.strokeStyle='#fff0ae';ctx.lineWidth=2;ctx.strokeRect(near.x-22,near.y-14,44,22);}
    E.drawAir(ctx,world[state.map].ambient,animation,ambientOptions);
    drawEffects();
    particles.filter(p=>p.map===state.map).forEach(p=>{ctx.globalAlpha=clamp(p.life/.65,0,1);rect(ctx,p.x,p.y,4,4,p.color);});ctx.globalAlpha=1;
    ctx.restore();
    // Rain is drawn before the darkness mask, so lamps illuminate the rainy scene too.
    if(C.weather(state)==='rain'){const rainTime=reducedMotion?0:animation;ctx.strokeStyle='#d8e6eb80';ctx.lineWidth=1;for(let i=0;i<(reducedMotion?40:120);i++){const x=(i*73+rainTime*140)%1010-25,y=(i*97+rainTime*330)%(viewHeight+50)-25;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-6,y+12);ctx.stroke();}}
    drawLighting();
    if(!reducedMotion&&state.upgrades.includes('beacon')&&state.map==='village'){for(let i=0;i<15;i++){const x=(i*79+Math.sin(animation+i)*40)%960,y=70+(i*31)%350+Math.sin(animation*1.5+i)*10;rect(ctx,x,y,3,3,'#fff1a9');}}
  }
  function drawTitle() {
    const c=tc;rect(c,0,0,1440,900,'#f8d8a4');rect(c,0,0,1440,175,'#fbe1b7');rect(c,0,175,1440,170,'#e6d8ad');
    pixelEllipse(c,1120,140,100,100,'#fff0c2');pixelEllipse(c,1120,140,72,72,'#fff8d8');
    for(let i=0;i<7;i++){const x=(i*250+animation*5)%1800-200,y=60+(i%3)*50;rect(c,x,y,100,18,'#fff4d2');rect(c,x+18,y-12,50,15,'#fff4d2');rect(c,x+50,y+10,95,15,'#fff4d2');}
    for(let i=0;i<7;i++){const x=i*240-100,y=240+(i%2)*30;c.fillStyle=i%2?'#a3bdae':'#b5c6ad';c.beginPath();c.moveTo(x-200,440);c.lineTo(x+80,y);c.lineTo(x+320,440);c.fill();rect(c,x+65,y+10,30,10,'#e6e1bd');}
    rect(c,0,390,1440,510,'#a5bd82');rect(c,0,550,1440,350,'#94b47a');
    for(let y=415;y<900;y+=30)for(let x=0;x<1440;x+=30){if((x+y)%90===0)rect(c,x+7,y+5,4,3,'#c4cd9360');}
    // Original pixel village preview; no remote assets or fonts needed.
    rect(c,720,595,630,68,'#6f925f');rect(c,718,587,635,65,'#decba0');rect(c,967,410,70,490,'#dece9e');
    rect(c,1110,700,330,170,'#e2d4a1');rect(c,1125,715,315,145,'#6bada9');rect(c,1140,730,300,120,'#83bfb7');
    const preview=[{x:925,y:570,w:146,h:135,roof:'#bc775d',name:'Nhà của những điều ước',kind:'home'},{x:1220,y:520,w:142,h:126,roof:'#718fa3',name:'Xưởng Gió',kind:'home'},{x:740,y:780,w:140,h:124,roof:'#ae91a2',name:'Quán trà',kind:'home'}];
    preview.forEach(b=>house(c,b));
    [[690,500],[1070,490],[1380,585],[1060,840],[600,790],[1320,680],[1420,780],[1180,405],[850,405]].forEach(([x,y],i)=>tree(c,x,y,1.6,i%3));
    lamp(c,875,653);lamp(c,1070,675);actor(c,972,650,'#5f9895','#55414b',true,true,'right',animation*55,false,'player');actor(c,1130,630,'#d98870','#614331',false,false,'left',0,false,'mira');
    for(let i=0;i<12;i++){const x=700+(i*57)%720,y=420+(i*43)%440;rect(c,x,y,3,8,'#6e985c');rect(c,x-4,y,10,4,['#f4dc8f','#eebca5','#fff1c3'][i%3]);}
    for(let i=0;i<8;i++){const x=800+i*83+Math.sin(animation+i)*10,y=310+i*25+Math.cos(animation*.7+i)*15;rect(c,x,y,3,3,'#fff2b9');}
    // Slow migrating star trails keep the sunrise title alive.
    const sx=1120+(animation*22)%500,sy=40+(animation*9)%190;rect(c,sx,sy,5,5,'#fff4ce');rect(c,sx-12,sy-6,10,2,'#fff4ce80');
  }
  function loop(time) {
    const dt=Math.min((time-lastTime)/1000||0,.05);lastTime=time;
    if(running){update(dt);drawGame();}else{if(!reducedMotion)animation+=dt;drawTitle();}
    requestAnimationFrame(loop);
  }
  function resizeViewport(){const stage=$('canvas-stage');if(!stage.clientWidth||!stage.clientHeight)return;viewHeight=clamp(Math.round(960*stage.clientHeight/stage.clientWidth),240,1100);canvas.height=viewHeight;darkCanvas.height=viewHeight;ctx.imageSmoothingEnabled=false;}
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeViewport).observe($('canvas-stage'));
  refreshHUD();syncFullscreen();syncRunControl();requestAnimationFrame(loop);
  // Local QA scenarios use a separate save slot and never modify the player's save.
  if(qaMode&&['localhost','127.0.0.1'].includes(location.hostname)) {
    if(new URLSearchParams(location.search).get('motion')==='reduced')reducedMotion=true;
    const scene=new URLSearchParams(location.search).get('scene');
    if(scene){state=C.createState('QA Lữ khách',D);C.accept(state,'story01',D);state.coins=6000;Object.keys(state.inventory).forEach(id=>state.inventory[id]=40);state.inventory.lantern=0;state.x=850;state.y=565;
      if(scene==='night'||scene==='rain'){state.minutes=1200;state.day=scene==='rain'?2:1;state.x=850;state.y=530;}
      if(scene==='farm'){state.x=490;state.y=800;}
      if(scene==='fish'){state.x=1060;state.y=660;}
      if(scene==='battle'){state.map='forest';state.x=420;state.y=660;}
      if(scene==='camp'){state.x=790;state.y=720;}
      if(scene==='npc'){state.x=800;state.y=900;}
      if(scene==='actors'){state.x=800;state.y=810;const pose=new URLSearchParams(location.search).get('look');if(['up','down','left','right'].includes(pose))playerDirection=pose;}
      if(scene==='roads'){
        const params=new URLSearchParams(location.search),map=params.get('map'),weather=params.get('weather'),spot=params.get('spot');
        state.upgrades=D.upgrades.map(u=>u.id);if(D.regions.some(r=>r.id===map))state.map=map;
        state.x=800;state.y=550;if(spot==='south')state.y=850;if(spot==='shore'){state.x=1050;state.y=715;}if(spot==='shrine')state.y=350;
        if(spot==='observatory'&&state.map==='village'){state.x=1350;state.y=1065;}
        state.day=weather?.startsWith('rain')?2:1;state.minutes=weather==='night'||weather==='rain-night'?1200:600;
        if(state.map!=='village')state.shrines=[state.map];
      }
      $('player-name').value=state.name;refreshHUD();
    }
    globalThis.StardropQA={getState:()=>structuredClone(state),getWorld:()=>world,getNPCs:()=>npcs,npcMarker,getGuide:guideNPC,blockedAt,interact,attack,update,drawGame,lightSources,collides,resourceReady,
      getPaths:(map=state.map)=>layouts[map],pathContains:(map,x,y,margin=0)=>P.contains(layouts[map],x,y,margin),getAmbientScene:(map=state.map)=>world[map].ambient,
      getEffects:()=>({effects:structuredClone(effects),particles:structuredClone(particles)}),getAnimationTime:()=>animation,isReducedMotion:()=>reducedMotion,
      getLocomotion:()=>({direction:playerDirection,distance:walkDistance,running:playerRunning,speed:moveSpeed(),touchRun,...(actorMotions.get('player')||{phase:0,motionWeight:0,runWeight:0})}),
      getActorMotion:id=>structuredClone(actorMotions.get(id==='player'?'player':`npc:${id}`)||{phase:0,motionWeight:0,runWeight:0,distance:0}),
      getActorLabels:actorLabels,
      getAmbientSample:(map=state.map)=>E.sampleAmbient(world[map].ambient,animation,{night:C.isNight(state),rain:C.weather(state)==='rain',upgrades:state.upgrades,shrineActive:state.shrines.includes(map),reducedMotion}),
      setState:s=>{state=C.restoreState(s,D);refreshHUD();},core:C,data:D,storageKey,drawTitle};
  }
})();
