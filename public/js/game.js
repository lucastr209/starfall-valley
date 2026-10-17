(() => {
  'use strict';
  const D = globalThis.STARDROP_DATA, C = globalThis.StardropCore, NPC = globalThis.StardropNPC, P = globalThis.StardropPaths, E = globalThis.StardropEffects, A = globalThis.StardropActors;
  if (!D || !C || !NPC || !P || !E || !A) { document.getElementById('save-label').textContent = 'Không tải được dữ liệu game. Hãy tải lại trang.'; return; }
  const actorMetrics=A.artMetrics||{bodyWidth:40,bodyHeight:60,nameOffset:64};
  const Mini=globalThis.StardropMinimap, Tutorial=globalThis.StardropOnboarding, Transfer=globalThis.StardropSaveTransfer;
  const Adventure=globalThis.StardropAdventure, Combat=globalThis.StardropCombat, CombatData=globalThis.StardropCombatData;
  const Exploration=globalThis.StardropExploration, InteriorScene=globalThis.StardropExplorationScene;
  const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SAVE_KEY = 'starfall-valley-save-v1', qaMode = new URLSearchParams(location.search).get('qa') === '1';
  const storageKey = qaMode ? 'starfall-valley-qa-save' : SAVE_KEY;
  const localQA=qaMode&&['localhost','127.0.0.1'].includes(location.hostname);
  const installGate=globalThis.StardropInstallGate?.mount({window,document});
  const qaFullscreen=localQA?new URLSearchParams(location.search).get('fullscreen'):null;
  let fullscreenBusy=false,fullscreenEpoch=0,pendingImport=null,saveReadEpoch=0;
  let inputViewportWidth=window.innerWidth,viewportHeightValue='';
  let saved = null; try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch (_) {}
  let state = C.restoreState(saved, D), running = false, hasPlayed=false, modal = null, journalTab = 'all', journalView = 'active', lastTime = 0;
  if(!saved||saved.version!==1){state.x=850;state.y=565;}
  if(state.health<=0){state.health=100;state.stamina=70;state.map='village';state.x=800;state.y=720;}
  const canvas = $('gameCanvas'), ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const title = $('titleCanvas'), tc = title.getContext('2d'); tc.imageSmoothingEnabled = false;
  const miniCanvas=$('minimapCanvas'),miniContext=miniCanvas.getContext('2d');miniCanvas.width=200;miniCanvas.height=140;
  let viewWidth=960,viewHeight=600;
  const darkCanvas = document.createElement('canvas'); darkCanvas.width = 960; darkCanvas.height = 600;
  const dc = darkCanvas.getContext('2d'), camera = { x: 0, y: 0 }, keys = new Set(), touchKeys = new Set();
  const touchPointers=new Map();
  let mobilePanel='';
  let joystickPointer=null,joystickX=0,joystickY=0,orientationBlocked=false,minimapOpen=true,lastMinimap=-Infinity,lastMinimapMap=null,tutorialIndex=0;
  const tutorialKey=storageKey+'-tutorial-v1';
  let tutorialCompleted=false;try{tutorialCompleted=localStorage.getItem(tutorialKey)==='done';}catch(_){}
  let tutorialPending=!!Tutorial&&!tutorialCompleted&&(!saved||saved.version!==1)&&(!qaMode||new URLSearchParams(location.search).get('tutorial')==='1');
  let festivalIndex=0,festivalTime=0,festivalPending=false;
  const mobileLayout=()=>!!window.innerWidth&&(window.innerWidth<=780||window.innerWidth<=1100&&window.innerHeight<=600&&window.innerWidth>window.innerHeight);
  // Mobile chỉ mở minimap khi cần xem đường, tránh che vùng chơi ngay lúc vào game.
  minimapOpen=!mobileLayout();
  $('minimap-shell').setAttribute('data-collapsed',String(!minimapOpen));
  $('btn-minimap').setAttribute('aria-expanded',String(minimapOpen));
  $('btn-minimap').setAttribute('aria-label',minimapOpen?'Ẩn bản đồ thu nhỏ':'Hiện bản đồ thu nhỏ');
  let near = null, swing = 0, swingDirection = 'down', attackCooldown = 0, hurtCooldown = 0, animation = 0, facing = 1;
  let fishing = null, toastUntil = 0, lastSaved = 0, hudTimer = 0, regenTimer = 0, steleSequence = [];
  let socket = null, onlineId = null, reconnectTimer = null, moveTimer = 0, reconnectAttempts = 0;
  const peers = new Map(), particles = [], effects = [], terrainCache = new Map(), world = {};
  let interior=null,returnPoint=null;
  const currentArea=()=>interior||world[state.map];
  const currentResidents=()=>interior?interior.residents:npcs.filter(n=>n.map===state.map);
  // Trong phòng chỉ lưu tọa độ cửa ngoài trời; reload/import không thể kẹt trong một cảnh tạm.
  const progressForSave=()=>interior?{...state,...returnPoint}:state;
  const combat=Combat.createRuntime();let encounter=null;
  const motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion=!!motionPreference?.matches, stepTimer=0;
  let playerDirection='down',walkDistance=0,playerRunning=false,touchRun=false;
  // Visual envelopes are session-only: feet follow actual travel while input and
  // collision still stop immediately. One cycle fraction survives walk/run changes.
  const actorMotions=new Map();
  const splashSystem=E.createSplashPool(32);let splashTimer=0;
  motionPreference?.addEventListener?.('change',e=>{reducedMotion=e.matches;if(reducedMotion){particles.length=0;effects.length=0;for(let i=0;i<splashSystem.capacity;i++)splashSystem.pool[i].active=false;}});
  const npcs = NPC.createNPCs(D.npcs);
  let guidedNpcId = null;
  const pet = {
    x: state.x - 28,
    y: state.y + 12,
    map: state.map,
    dir: 'down',
    moving: false,
    running: false,
    gait: 0,
    tailWag: 0,
    name: state.pet?.name || 'Cún Sao',
    forageTimer: 45 + Math.random() * 30,
    loveCooldown: 0
  };
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
    Combat.cancelInputs(combat);swing=0;attackCooldown=0;
    const held=[...touchPointers];touchPointers.clear();
    resetJoystick();
    keys.clear();touchKeys.clear();touchRun=false;playerRunning=false;state.moving=false;stepTimer=0;syncRunControl();
    held.forEach(([id,{button}])=>{try{if(button.hasPointerCapture?.(id))button.releasePointerCapture(id);}catch(_){}});
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
  const organicFlicker = (t, phase = 0) => {
    if (reducedMotion) return 0;
    return Math.sin(t * 5.03 + phase) * 0.48 +
           Math.sin(t * 15.10 + phase * 1.7) * 0.28 +
           Math.sin(t * 35.80 + phase * 3.1) * 0.16 +
           Math.sin(t * 76.70 + phase * 5.3) * 0.08;
  };
  const label = (c, text, x, y, size = 12, color = '#fff8de') => {
    c.font = `bold ${size}px 'Segoe UI',sans-serif`;
    c.textAlign = 'center';
    const fx = Math.floor(x), fy = Math.floor(y);
    c.fillStyle = '#101a1e';
    c.fillText(text, fx + 1, fy + 1);
    c.fillText(text, fx - 1, fy);
    c.fillText(text, fx + 1, fy);
    c.fillText(text, fx, fy - 1);
    c.fillText(text, fx, fy + 1);
    c.fillStyle = color;
    c.fillText(text, fx, fy);
  };
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
        if(region.id==='ruins'){
          objects.push(
            {id:'stele-ruins-west',kind:'stele',x:180,y:430,name:'Bia Sao Tây Đài',seq:'west'},
            {id:'stele-ruins-north',kind:'stele',x:740,y:240,name:'Bia Sao Bắc Điện',seq:'north'},
            {id:'stele-ruins-east',kind:'stele',x:920,y:460,name:'Bia Sao Đông Đài',seq:'east'},
            {id:'chest-ruins-secret',kind:'chest',x:860,y:240,name:'Rương Cổ Bí Mật'}
          );
        }
        for(let i=0;i<5;i++){const x=420+i*205,y=x>1110?940:700+(i%2)*110;mobs.push({id:`${region.id}-slime-${i}`,x,y,homeX:x,homeY:y,hp:3,deadUntil:0,phase:i});}
      }
      const gates = region.id==='village' ? [
        {id:'gate-forest',kind:'gate',x:800,y:100,to:'forest',name:D.regions.find(r=>r.id==='forest').name},
        {id:'gate-coast',kind:'gate',x:1500,y:550,to:'coast',name:D.regions.find(r=>r.id==='coast').name},
        {id:'gate-ruins',kind:'gate',x:100,y:550,to:'ruins',name:D.regions.find(r=>r.id==='ruins').name}
      ] : [{id:`return-${region.id}`,kind:'gate',x:800,y:1000,to:'village',name:'Trở về Làng Sao'}];
      const allObjects=objects.concat(gates);
      // Chừa khoảng trống cho địa điểm thám hiểm và đấu trường, giữ nguyên mạng đường cũ.
      for(const point of D.adventure.objects.filter(o=>o.map===region.id)){
        allObjects.push({...point,id:'adventure-'+point.id,proof:point.id,kind:'adventure'});
        for(let i=trees.length-1;i>=0;i--)if(Math.hypot(trees[i].x-point.x,trees[i].y-point.y)<(point.mode==='boss'?160:65))trees.splice(i,1);
      }
      if(region.id==='forest')allObjects.push({id:'forest-rest',kind:'adventureRest',x:800,y:440,name:'Trạm nghỉ đường mòn'});
      const rooms=D.exploration.rooms.filter(r=>r.map===region.id),huts=rooms.filter(r=>!r.building&&r.kind!=='cave').map(r=>({x:r.x,y:r.y-25,w:140,h:125,roof:r.palette,name:r.name,kind:'hut'}));
      for(const room of rooms){allObjects.push({...room,id:'door-'+room.id,roomId:room.id,kind:'door'});for(let i=trees.length-1;i>=0;i--)if(Math.hypot(trees[i].x-room.x,trees[i].y-room.y)<100||huts.some(b=>Math.abs(trees[i].x-b.x)<b.w/2+35&&trees[i].y>b.y-b.h-25&&trees[i].y<b.y+35))trees.splice(i,1);}
      world[region.id]={objects:allObjects,trees,mobs,buildings:huts,ambient:E.createScene(region.id,{trees,objects:allObjects,buildings:region.id==='village'?buildings:huts,isPath:road})};
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
  // Không ghi state mặc định đè save chưa đọc được chỉ vì người chơi đóng màn hình đầu.
  function save(force=false) {
    if(!hasPlayed&&!running&&!force)return false;
    let ok=false;
    try { const {moving,...progress}=progressForSave(),text=JSON.stringify(progress);localStorage.setItem(storageKey,text);if(localStorage.getItem(storageKey)!==text)throw Error('Save verification failed');$('save-status').textContent='Đã lưu trên máy';$('btn-export-start').disabled=false;ok=true; }
    catch(_) { $('save-status').textContent='Chưa lưu được · hãy xuất file sao lưu'; }
    lastSaved=performance.now();return ok;
  }
  // Reload trong cùng ứng dụng giữ vùng lưu; chỉ cho rời phiên sau khi đã ghi và đọc kiểm lại save.
  function refreshGame(){
    clearMovement();
    if((running||hasPlayed)&&!save()){openDialog('save-error','Chưa thể cập nhật an toàn','HÃY SAO LƯU TRƯỚC','<p>Trình duyệt chưa lưu được tiến trình hiện tại. Hãy xuất file vào Tệp trước; game chưa tải lại.</p><button data-export-save>Xuất tiến trình</button><button data-close>Quay lại chơi</button><p id="save-transfer-status" role="status"></p>');return;}
    location.reload();
  }
  $('btn-refresh-start').addEventListener('click',refreshGame);
  $('btn-export-start').disabled=saved?.version!==1;
  $('btn-export-start').addEventListener('click',exportSave);
  $('game-build').textContent=`Bản ${globalThis.STARDROP_CONFIG?.buildId||'local'}`;
  function toast(message) { $('toast').textContent=message; $('toast').classList.add('visible'); toastUntil=performance.now()+4200; }
  function chooseSave(){clearMovement();$('save-file').value='';$('save-file').click();}
  function exportSave(){
    if(!Transfer)return;
    const blob=new Blob([Transfer.encode(progressForSave(),D)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`starfall-valley-progress-${new Date().toISOString().slice(0,10)}.json`;
    link.hidden=true;$('game-wrapper').append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    const status=!$('install-screen').hidden?$('install-save-status'):$('save-transfer-status')||$('start-save-status');if(status)status.textContent='Đã tạo file sao lưu. Lưu file vào Tệp; nhập lại trước khi đổi trình duyệt hoặc cài lại ứng dụng.';
  }
  function refreshStartSave(){
    $('btn-start').innerHTML='Tiếp tục hành trình <span>→</span>';
    $('save-label').textContent=`Ngày ${state.day} · Cấp ${C.level(state)} · Tiến trình đã lưu`;
    $('player-name').value=state.name;
    $('btn-export-start').disabled=false;
  }
  $('btn-import-start').addEventListener('click',chooseSave);
  $('save-file').addEventListener('change',async()=>{
    const file=$('save-file').files?.[0];$('save-file').value='';if(!file||!Transfer)return;
    const ticket=++saveReadEpoch;pendingImport=null;clearMovement();
    try{
      if(file.size>Transfer.maxBytes)throw new Error('File quá lớn');
      const text=await file.text();if(ticket!==saveReadEpoch)return;
      pendingImport=Transfer.decode(text,D);
      openDialog('save-import','Khôi phục tiến trình?','KIỂM TRA BẢN TIẾN TRÌNH',`<p class="dialogue-text">${esc(pendingImport.name)} · Ngày ${pendingImport.day} · Cấp ${C.level(pendingImport)} · ${pendingImport.coins} xu</p><p>Tiến trình này sẽ thay thế tiến trình đang lưu trên trình duyệt này.</p><div class="npc-actions"><button data-import-save>Khôi phục tiến trình</button><button data-close>Hủy</button></div>`);
    }catch(_){
      if(ticket!==saveReadEpoch)return;pendingImport=null;
      openDialog('save-error','Không đọc được tiến trình','CHỌN LẠI FILE', '<p class="dialogue-text">Hãy chọn file .json đã xuất từ Thung Lũng Sao Rơi, tối đa 128 KB. Tiến trình hiện tại vẫn được giữ.</p><div class="npc-actions"><button data-choose-save>Chọn lại file</button><button data-close>Đóng</button></div>');
    }
  });
  function importSave(){
    if(modal!=='save-import'||!pendingImport)return;
    const previousState=state,previousInterior=interior,previousReturn=returnPoint;
    interior=null;returnPoint=null;
    state=pendingImport;pendingImport=null;tutorialPending=false;guidedNpcId=null;near=null;
    if(running){C.resumeStory(state,D);C.resumeAdventure(state,D);C.ensureTrackedQuest(state,D);}
    festivalIndex=0;festivalPending=running&&C.journeyProgress(state,D).finished&&!state.festivalSeen;
    if(state.health<=0){state.health=100;state.stamina=70;state.map='village';state.x=800;state.y=720;}
    if(blockedAt(state.map,state.x,state.y)){state.map='village';state.x=850;state.y=565;}
    if(pet){pet.map=state.map;pet.x=state.x-24;pet.y=state.y+12;pet.moving=false;pet.name=state.pet?.name||'Cún Sao';}
    clearMovement();actorMotions.clear();playerDirection='down';walkDistance=0;lastMinimap=-Infinity;
    if(!save(true)){state=previousState;interior=previousInterior;returnPoint=previousReturn;refreshHUD();updateCamera();openDialog('save-error','Chưa lưu được bản nhập','TIẾN TRÌNH CŨ ĐƯỢC GIỮ','<p>Game chưa thay thế tiến trình đang chơi. Giữ file đã nhập trong Tệp và thử lại khi trình duyệt cho phép lưu.</p><button data-export-save>Xuất tiến trình hiện tại</button><button data-close>Đóng</button><p id="save-transfer-status" role="status"></p>');return;}
    resetEncounter();
    closeDialog();refreshHUD();updateCamera();refreshStartSave();
    if(running&&socket){socket.onclose=null;socket.close();socket=null;peers.clear();onlineId=null;connect();}
    if(running&&!socket)connect();
    if(running)toast('Đã khôi phục tiến trình.');
  }
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
  const npcById = id => interior?.residents.find(n=>n.id===id)||npcs.find(n=>n.id===id);
  const nearestNPC = () => currentResidents().filter(n=>distance(n,state)<85).sort((a,b)=>distance(a,state)-distance(b,state))[0]?.id;
  function npcMarker(npc) {
    const quests=D.quests.filter(q=>q.giver===npc.id);
    if(quests.some(q=>state.quests[q.id]?.status==='active'&&C.complete(state,q)))return '✓';
    if(quests.some(q=>!state.quests[q.id]&&C.available(state,q,D)))return '?';
    return quests.some(q=>state.quests[q.id]?.status==='active')?'!':'';
  }
  function guideNPC() {
    if(guidedNpcId)return npcById(guidedNpcId);
    const q=activeQuest();if(!q)return null;
    if(q.kind==='adventure'){
      const objective=q.objectives.find(o=>o.type==='proof'&&!state.adventure.proofs.includes(o.target));
      const point=Adventure.target(state,objective?.target,D);return point?{...point,landmark:true}:null;
    }
    const p=C.progress(state,q),destination=q.objectives.find((o,i)=>['explore','cave'].includes(o.type)&&p[i]<o.count);
    if(destination){const room=D.exploration.rooms.find(r=>r.id===destination.target);if(room){if(interior?.id===room.id){const action=!state.exploration.clues.includes(room.id)?'clue':!state.exploration.solved.includes(room.id)?'puzzle':'boss';return {...interior.objects.find(o=>o.action===action),map:state.map,landmark:true};}return {...room,landmark:true,outdoor:true};}}
    const talkTarget=q.objectives.find((o,i)=>o.type==='talk'&&p[i]<o.count);
    return npcById(talkTarget?.target||q.giver);
  }
  function npcDirection(npc) {
    if(interior&&(npc.outdoor||!interior.residents.some(n=>n.id===npc.id)&&!interior.objects.some(o=>o.id===npc.id)))return 'Ra ngoài qua cửa phía nam để tiếp tục tìm đường.';
    if(npc.map!==state.map)return `Tại ${D.regions.find(r=>r.id===npc.map)?.name}`;
    const dist=distance(npc,state);
    if(dist<78)return npc.landmark?'Đang ở gần bạn · nhấn E để khám phá':'Đang ở gần bạn · nhấn E để trò chuyện';
    const dx=npc.x-state.x,dy=npc.y-state.y;
    const horizontal=Math.abs(dx)>dist*.35?(dx>0?'đông':'tây'):'';
    const vertical=Math.abs(dy)>dist*.35?(dy>0?'nam':'bắc'):'';
    return `Phía ${[vertical,horizontal].filter(Boolean).join(' ')} · ${dist<180?'cách một đoạn ngắn':dist<450?'quanh khu vực này':'ở xa hơn trên bản đồ'}`;
  }
  function showResidents() {
    const cards=D.regions.map(region=>`<h3>${esc(region.name)}</h3><div class="cards">${npcs.filter(n=>n.map===region.id).map(n=>{
      const marker=npcMarker(n), status=marker==='✓'?'Có thể giao đồ / nhận thưởng':marker==='?'?'Có nhiệm vụ hoặc hợp đồng mới':marker==='!'?'Đang có việc bạn đã nhận':'Chưa có nhiệm vụ mới';
      const f=state.friendship?.[n.id]||{points:0,talkedToday:false,giftedToday:false};
      const hearts=Math.floor(f.points/100);
      const heartMeter='♥'.repeat(hearts)+'♡'.repeat(5-hearts);
      const giftStatus=f.giftedToday?'✓ Đã tặng quà':'🎁 Chưa tặng quà';
      return `<article class="card"><span class="badge">${esc(n.role)}</span><h3>${esc(n.name)} ${marker}</h3><div class="resident-hearts" title="${f.points}/500 điểm thân thiết"><span class="hearts">${heartMeter}</span> <span class="heart-text">${hearts}/5 · ${giftStatus}</span></div><p>${esc(n.patrolName)}</p><p class="good">${status}</p><button data-find-npc="${n.id}">Tìm ${esc(n.name)}</button></article>`;
    }).join('')}</div>`).join('');
    openDialog('residents','Cư dân thung lũng','NHỮNG NGƯỜI BẠN GẶP TRÊN ĐƯỜNG',`<p class="dialog-intro">Cư dân đi lại quanh nơi sinh hoạt và dừng khi bạn tới gần. Theo chỉ dẫn để tìm họ; nhấn E hoặc Tương tác để nhận việc. ? Có việc mới · ! Đang thực hiện · ✓ Sẵn sàng nhận thưởng.</p>${cards}`);
  }
  function objectiveText(o) {
    if(['explore','cave'].includes(o.type))return `${o.type==='cave'?'Vượt Hộ Vệ tại':'Ghé bên trong'} ${D.exploration.rooms.find(r=>r.id===o.target)?.name||'địa điểm'}`;
    if(o.type==='proof'){
      const groups={trail:['trail','trail-2','trail-3'],rescue:['rescue-1','rescue-2','rescue-3'],inscriptions:['light-1','light-2'],'root-light':['light-1','light-2']},steps=groups[o.target];
      const detail=steps&&!state.adventure.proofs.includes(o.target)?` · ${steps.filter(id=>state.adventure.milestones.includes(id)).length}/${steps.length} ${o.target==='rescue'?'cột dây':o.target==='trail'?'dấu vết':'bia khắc'}`:'';
      return (D.adventure.proofs.find(p=>p.id===o.target)?.name||'Khám phá dấu vết')+detail;
    }
    const target = D.items[o.target]?.name || npcById(o.target)?.name || D.regions.find(r=>r.id===o.target)?.name || D.upgrades.find(u=>u.id===o.target)?.name || D.recipes.find(r=>r.id===o.target)?.name;
    return ({talk:`Trò chuyện với ${target}`,gather:`Thu thập ${target}`,craft:`Chế tạo ${target}`,deliver:`Giao ${target}`,visit:`Khám phá ${target}`,build:`Xây ${target}`,fish:'Câu cá thành công',fight:'Đánh bại tinh linh nhầy',plant:'Gieo luống quả',harvest:'Thu hoạch quả',shrine:`Đánh thức bia ký ức ${D.regions.find(r=>r.id===o.target)?.name||''}`,chest:'Mở rương thất lạc',night:'Tương tác ở làng vào ban đêm',rain:'Hái thảo dược trong mưa'})[o.type] || o.type;
  }
  function activeQuest() { return D.quests.find(q=>q.id===state.tracked&&state.quests[q.id]?.status==='active') || D.quests.find(q=>q.kind==='story'&&state.quests[q.id]?.status==='active') || D.quests.find(q=>state.quests[q.id]?.status==='active'); }
  function refreshHUD() {
    $('coins').textContent=`◈ ${state.coins} xu`; $('level').textContent=`✦ Cấp ${C.level(state)} · ${state.xp%160}/160 XP`; $('renown').textContent=`♧ ${state.renown} uy tín`;
    $('health').textContent=Math.ceil(state.health); $('stamina').textContent=Math.ceil(state.stamina); $('player-label').textContent=state.name;
    const hours=Math.floor(state.minutes/60),minutes=Math.floor(state.minutes%60/10)*10;
    $('clock').textContent=`Ngày ${state.day} · ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
    $('map-name').textContent=interior?interior.room.name:D.regions.find(r=>r.id===state.map).name;
    $('btn-leave-room').hidden=!interior;$('minimap-shell').hidden=!!interior;
    $('weather-label').textContent=`${C.isNight(state)?'☾ Đêm':'☀ Ban ngày'} · ${C.weather(state)==='rain'?'☂ Mưa':'Trời trong'}`;
    const journey=C.journeyProgress(state,D),stage=journey.stages[journey.current];
    const goal=C.personalGoals(state,D).find(g=>g.id===state.personalGoal);
    $('journey-goal').textContent=journey.finished?'✦ Đêm Hội Sao đã trở lại':D.journey.goal;
    $('journey-stage').textContent=journey.finished?(goal?`${goal.title} · ${goal.done}/${goal.total}${goal.complete?' · ✓ Hoàn thành':''}`:'Hành trình hoàn thành · Chọn chuyến đi tiếp theo'):`Chặng ${journey.current+1}/3 · ${stage.title}`;
    $('journey-count').textContent=`${journey.done}/${journey.total}`;
    $('journey-progress').value=journey.done;$('journey-progress').max=journey.total;
    if(Adventure.unlocked(state)&&(state.adventure.proofs.length||state.tracked?.startsWith('adv')&&!journey.finished)){
      const done=D.adventure.mainIds.filter(id=>state.quests[id]?.status==='claimed').length;
      $('journey-goal').textContent=done===6?'✦ Lõi rừng đã được giải phóng':'Giải phóng rừng khỏi Vết Nứt Sao';
      $('journey-stage').textContent=`Chương I · Rễ Sao · ${done===6?'Hoàn thành':'Chuẩn bị → thám hiểm → xây làng'}`;
      $('journey-count').textContent=`${done}/6`;$('journey-progress').value=done;$('journey-progress').max=6;
    }
    const q=activeQuest();
    if(q) {
      const p=C.progress(state,q);
      $('quest-tracker').innerHTML=`<h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><ul>${q.objectives.map((o,i)=>`<li class="${p[i]>=o.count?'done':''}"><span>${p[i]>=o.count?'✓':'◇'} ${esc(objectiveText(o))}</span><b>${p[i]}/${o.count}</b></li>`).join('')}</ul>${C.complete(state,q)?`<button data-claim="${q.id}">Nhận thưởng${q.objectives.some(o=>o.type==='deliver')?' / giao đồ':''}</button>`:''}`;
    } else $('quest-tracker').innerHTML=journey.finished?'<h3>Hành trình đã hoàn thành</h3><p>Đêm Hội Sao đã trở lại. Chọn mục tiêu của bạn, hoặc tiếp tục dạo chơi trong thung lũng.</p><button data-open-goals>Chọn mục tiêu tiếp theo</button>':'<h3>Thung lũng đang chờ</h3><p>Đưa Đêm Hội Sao trở lại. Mở sổ để xem bước tiếp theo.</p><button data-open-journal>Xem hành trình</button>';
    $('personal-goal-tracker').hidden=!journey.finished||!goal;
    $('personal-goal-tracker').innerHTML=goal?`<span class="tiny-label">MỤC TIÊU CỦA BẠN</span><h3>${esc(goal.title)}</h3><p>${goal.complete?'✓ Đã hoàn thành! Bạn có thể chọn một chuyến đi mới.':`${goal.done}/${goal.total} · ${esc(goal.description)}`}</p><button data-open-goals>${goal.complete?'Chọn mục tiêu khác':'Xem mục tiêu'}</button>`:'';
    const guide=guideNPC();
    $('npc-guide').textContent=guide?`Tìm ${guide.name} · ${D.regions.find(r=>r.id===guide.map)?.name}: ${npcDirection(guide)}.`:'';
    $('npc-guide').hidden=!guide;
    const total=D.quests.filter(q=>q.kind!=='daily').length,done=D.quests.filter(q=>q.kind!=='daily'&&state.quests[q.id]?.status==='claimed').length;
    $('quest-count').textContent=`${done}/${total} hành trình · ${D.quests.filter(q=>state.quests[q.id]?.status==='active').length} nhiệm vụ đang nhận`;
    $('world-tip').textContent=C.weather(state)==='rain'?'Mưa làm thảo dược bừng sức sống. Đèn vẫn soi đường trong mưa và ban đêm.':C.isNight(state)?'Mảnh sao phát sáng khi đêm xuống. Chế tạo đèn lồng để mở rộng tầm nhìn.':'Cư dân dạo quanh làng. ? báo việc mới, ! là việc đang làm, ✓ là việc sẵn sàng nhận thưởng.';
  }
  function openDialog(kind,title,eyebrow,html) {
    setMobileMenu(false);
    const previous=modal;
    fishing=null; $('fishing').hidden=true; clearMovement(); modal=kind;
    npcs.forEach(n=>{n.moving=false;});state.moving=false;
    $('dialog-title').textContent=title; $('dialog-eyebrow').textContent=eyebrow; $('dialog-body').innerHTML=html;
    // Cảnh kết cần bắt đầu từ ngọn đèn trên đầu khung, kể cả khi mở từ một danh sách đã cuộn xuống.
    if(kind!==previous||kind==='festival')$('game-dialog').scrollTop=0;
    $('game-dialog').classList.remove('tutorial-dialog');if(kind==='tutorial')$('game-dialog').classList.add('tutorial-dialog');
    if(!$('game-dialog').open)$('game-dialog').showModal();
  }
  // Đóng chủ động ghi nhận đã xem lễ hội; xoay màn hình hoặc về title giữ cảnh để tiếp tục sau.
  function closeDialog({preserveFestival=false}={}) { if(modal==='festival'){if(preserveFestival)festivalPending=true;else state.festivalSeen=true;}++saveReadEpoch;pendingImport=null;$('game-dialog').close(); modal=null; clearMovement();save(); }
  $('dialog-close').addEventListener('click',closeDialog);
  $('game-dialog').addEventListener('cancel',()=>{if(modal==='festival')state.festivalSeen=true;++saveReadEpoch;pendingImport=null;modal=null;clearMovement();save();});
  $('game-dialog').addEventListener('close',()=>{if($('game-dialog').open)return;++saveReadEpoch;pendingImport=null;modal=null;});
  function showTutorial(index=0) {
    if(!Tutorial||!running||orientationBlocked)return;
    tutorialPending=false;tutorialIndex=clamp(index,0,Tutorial.count-1);
    const step=Tutorial.step(tutorialIndex,mobileLayout());
    openDialog('tutorial',step.title,step.subtitle,Tutorial.render(tutorialIndex,mobileLayout()));
  }
  function finishTutorial(){tutorialCompleted=true;tutorialPending=false;try{localStorage.setItem(tutorialKey,'done');}catch(_){}closeDialog();}
  $('btn-help').addEventListener('click',()=>showTutorial());
  // Lọc trạng thái riêng với loại nhiệm vụ, không xóa dữ liệu đã hoàn thành khỏi save.
  function showJournal(tab=journalTab,view=journalView) {
    if(tab==='goals'){showGoals();return;}
    journalTab=tab;journalView=['active','available','history'].includes(view)?view:'active';
    const entries=C.journalEntries(state,D,tab),list=entries[journalView];
    const cards=list.map(q=>{
      const entry=state.quests[q.id],can=C.available(state,q,D),p=C.progress(state,q),ready=entry?.status==='active'&&C.complete(state,q);
      const action=entry?.status==='claimed'?'<button disabled>✓ Đã nhận thưởng</button>':entry?.status==='active'?`<div class="card-actions"><button data-track="${q.id}">${state.tracked===q.id?'Đang theo dõi':'Theo dõi'}</button>${ready?`<button data-claim="${q.id}">Nhận thưởng${q.objectives.some(o=>o.type==='deliver')?' / giao đồ':''}</button>`:'<button disabled>Đang thực hiện</button>'}</div>`:`<button data-accept="${q.id}" ${can?'':'disabled'}>${can?'Nhận nhiệm vụ':'Chưa mở khóa'}</button>`;
      const locked=q.requires.filter(id=>state.quests[id]?.status!=='claimed').map(id=>D.quests.find(x=>x.id===id)?.title).filter(Boolean);
      if(q.upgrade&&!state.upgrades.includes(q.upgrade))locked.push(D.upgrades.find(u=>u.id===q.upgrade)?.name);
      const chapter=q.kind==='story'?`CHẶNG ${D.journey.stages.findIndex(s=>s.quests.includes(q.id))+1} · `:'';
      return `<article data-quest-id="${q.id}" class="card ${!can&&!entry?'locked':''}"><span class="badge">${chapter}${esc(npcById(q.giver)?.name||'BẢNG TIN LÀNG')} ${entry?.status==='claimed'?'· HOÀN TẤT':ready?'· Sẵn sàng nhận thưởng':''}</span><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><ul>${q.objectives.map((o,i)=>`<li class="${p[i]>=o.count?'good':''}">${p[i]>=o.count?'✓':'◇'} ${esc(objectiveText(o))} · ${p[i]}/${o.count}</li>`).join('')}</ul>${locked.length?`<p class="quest-direction">Mở sau: ${esc(locked.join(' · '))}</p>`:''}${q.objectives.some(o=>o.type==='deliver')?`<p class="quest-direction">Giao tận tay ${esc(npcById(q.giver)?.name)} · ${esc(D.regions.find(r=>r.id===npcById(q.giver)?.map)?.name||'')}</p>`:''}<div class="reward">◈ ${q.reward.coins} xu · ✦ ${q.reward.xp} XP · ♧ ${q.reward.renown} uy tín</div>${action}</article>`;
    }).join('');
    const views=[['active','Đang làm'],['available','Có thể nhận'],['history','Lịch sử']],status=views.find(([id])=>id===journalView)[1];
    const empty={active:'Chưa có nhiệm vụ đang làm.',available:'Chưa có nhiệm vụ có thể nhận trong mục này.',history:'Chưa có nhiệm vụ đã nhận thưởng trong mục này.'};
    const adventure=encounter?.cave?`<section class="adventure-overview"><h3>${esc(interior.room.name)}</h3><p>${esc(interior.room.tactics)}</p><p>Đợt ${encounter.wave+1}/${interior.room.waves.length} · Tiếp tế còn ${state.adventure.supplies} phần</p><button data-field-heal ${state.adventure.supplies?'':'disabled'}>Dùng tiếp tế</button><button data-retreat>Rút lui về điểm nghỉ · giữ tiến trình</button></section>`:tab==='adventure'||encounter?`<section class="adventure-overview"><h3>${D.adventure.title}</h3><p>Đọc dấu rễ → học né → cứu cư dân → ba mạch rễ → chuẩn bị → Hộ Vệ. Kiếm khởi đầu đủ sức thắng; V hoặc nút Né để tránh vùng vàng.</p>${encounter?`<p>Đợt ${encounter.wave+1}/${D.adventure.encounters[encounter.id].length} · Tiếp tế còn ${state.adventure.supplies} phần</p><button data-field-heal ${state.adventure.supplies?'':'disabled'}>Dùng tiếp tế</button><button data-retreat>Rút lui về điểm nghỉ · giữ tiến trình</button>`:''}${state.quests.adv06?.status==='claimed'?'<p class="good">Lõi rừng đã hồi sinh. Kiếm Rễ Sao ở trong túi; xưởng có thêm công thức.</p><button data-open-build>Xây xưởng từ nguyên liệu được thưởng</button>':''}</section>`:'';
    openDialog('journal','Sổ hành trình',`NGÀY ${state.day} · CÂU CHUYỆN CỦA ${state.name}`,`<div class="tab-strip journal-views" aria-label="Trạng thái nhiệm vụ">${views.map(([id,name])=>`<button data-journal-view="${id}" aria-pressed="${journalView===id}" class="${journalView===id?'selected':''}">${name} (${entries[id].length})</button>`).join('')}</div>${journalTabs(tab)}${tab==='story'?journeyOverview():''}${adventure}<p id="journal-status" tabindex="-1" role="status">${status}: ${list.length} nhiệm vụ${tab==='daily'&&journalView==='history'?' · Đã hoàn tất hôm nay':''}.</p><p class="dialog-intro">Đủ mục tiêu → nhận thưởng → tự chuyển vào lịch sử. Nhiệm vụ giao đồ cần gặp đúng cư dân; hợp đồng làm mới mỗi ngày.</p><div class="cards">${cards||`<section class="quest-empty"><p>${empty[journalView]}</p><button data-journal-view="available">Tìm nhiệm vụ mới</button><button data-open-story>Xem bước tiếp theo</button></section>`}</div>`);
  }
  // Các tab cùng dùng một bộ điều hướng; mục tiêu tự chọn chỉ xuất hiện sau cốt truyện.
  function journalTabs(tab) {
    const tabs=[['all','Tất cả'],['adventure','Phiêu lưu'],['story','Hồi sinh làng'],['side','Việc của cư dân'],['daily','Hợp đồng hôm nay']];
    if(C.journeyProgress(state,D).finished)tabs.push(['goals','Sau lễ hội']);
    return `<div class="tab-strip journal-kinds" aria-label="Loại nhiệm vụ">${tabs.map(([id,name])=>`<button data-tab="${id}" class="${tab===id?'selected':''}" aria-pressed="${tab===id}">${name}${id==='goals'?'':` (${C.journalEntries(state,D,id)[journalView].length})`}</button>`).join('')}</div>`;
  }
  // Mỗi chặng thể hiện thành quả và nhiệm vụ kế tiếp, không trộn việc phụ vào tiến độ kết thúc.
  function journeyOverview() {
    const j=C.journeyProgress(state,D),q=j.next;
    const nextBuild=q?.objectives.find(o=>o.type==='build'&&!state.upgrades.includes(o.target));
    return `<section class="journey-overview"><span class="tiny-label">${j.finished?'HÀNH TRÌNH ĐÃ HOÀN THÀNH':'ĐÍCH ĐẾN CỦA BẠN'}</span><h3>${esc(j.finished?'Đêm Hội Sao đã trở lại':D.journey.goal)}</h3><p>${esc(D.journey.description)}</p><progress value="${j.done}" max="${j.total}" aria-label="${j.done}/${j.total} bước cốt truyện"></progress><p>${j.done}/${j.total} bước đã hoàn thành · Nhiệm vụ phụ không bắt buộc để kết thúc hành trình.</p><ol class="journey-stages">${j.stages.map((s,i)=>`<li class="${s.done===s.total?'completed':i===j.current?'current':'future'}"><span class="badge">CHẶNG ${i+1} · ${s.done===s.total?'✓ HOÀN THÀNH':i===j.current?'ĐANG THỰC HIỆN':'PHÍA TRƯỚC'}</span><h4>${esc(s.title)}</h4><p>${esc(s.description)}</p><small>${s.done}/${s.total} bước · ${esc(s.milestone)}</small></li>`).join('')}</ol>${q?`<p class="journey-next"><strong>Việc tiếp theo: ${esc(q.title)}</strong><br>${esc(q.description)}</p>${nextBuild?'<button data-open-build>Xem công trình cần xây</button>':''}`:'<div class="npc-actions"><button data-open-festival>Xem lại Đêm Hội Sao</button><button data-open-goals>Chọn mục tiêu tiếp theo</button></div>'}</section>`;
  }
  // Mục tiêu dài hạn là lựa chọn tự do, tiến độ được giữ khi đổi mục tiêu hoặc ngừng theo dõi.
  function showGoals() {
    if(!C.journeyProgress(state,D).finished){showJournal('story');return;}
    journalTab='goals';
    const cards=C.personalGoals(state,D).map(g=>`<article class="card"><span class="badge">${g.complete?'✓ HOÀN THÀNH':state.personalGoal===g.id?'ĐANG THEO DÕI':'TỰ CHỌN'}</span><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><progress value="${g.done}" max="${g.total}" aria-label="${esc(g.title)}"></progress><p>${g.done}/${g.total}</p><button data-goal="${state.personalGoal===g.id?'none':g.id}">${state.personalGoal===g.id?'Ngừng theo dõi':'Chọn mục tiêu này'}</button><button data-goal-action="${g.action}">${g.actionLabel}</button></article>`).join('');
    openDialog('journal','Chuyến đi sau lễ hội','ĐÊM HỘI SAO ĐÃ TRỞ LẠI',`${journalTabs('goals')}<p class="dialog-intro">Bạn đã hoàn thành hành trình hồi sinh. Những mục tiêu dưới đây là tùy chọn; chọn một mục tiêu để theo dõi, đổi hoặc dừng bất cứ lúc nào.</p><div class="cards">${cards}</div><div class="npc-actions"><button data-open-festival>Xem lại Đêm Hội Sao</button></div>`);
  }
  // Rương là vật thể cố định; hướng dẫn vị trí thật và trạng thái từng rương thay vì đếm lịch sử tùy ý.
  function showTreasure() {
    const cards=D.journey.treasureIds.map(id=>{const region=D.regions.find(r=>id===`chest-${r.id}`),opened=state.chests.includes(id);return `<article class="card"><span class="badge">${opened?'✓ ĐÃ MỞ':'CÒN CHỜ BẠN'}</span><h3>${esc(region.name)}</h3><p>Rương ở góc đông nam, trên bãi đất phía dưới hồ. Đi vòng phía nam hồ rồi theo bờ xuống dưới.</p></article>`;}).join('');
    openDialog('treasure','Rương thất lạc','BA CHUYẾN KHÁM PHÁ',`<p class="dialog-intro">Mỗi vùng ngoài làng có một rương. Rương chỉ trao thưởng một lần; mở rương sẽ tự cập nhật mục tiêu của bạn.</p><div class="cards">${cards}</div><div class="npc-actions"><button data-open-goals>Trở lại mục tiêu</button></div>`);
  }
  // Cảnh lễ hội độc lập với bản đồ chơi: không đổi giờ, vùng, vị trí NPC hoặc vật phẩm trong save.
  function showFestival(index=0) {
    if(!running||orientationBlocked||!C.journeyProgress(state,D).finished)return;
    festivalIndex=clamp(index,0,D.journey.festival.length-1);festivalPending=false;
    const page=D.journey.festival[festivalIndex],speaker=npcById(page.speaker),last=festivalIndex===D.journey.festival.length-1;
    openDialog('festival',page.title,`ĐÊM HỘI SAO · ${festivalIndex+1}/${D.journey.festival.length}`,`<section class="festival-scene"><canvas id="festivalCanvas" width="760" height="300" role="img" aria-label="Đèn Dẫn Sao thắp sáng quảng trường; bạn và 11 cư dân cùng tụ họp dưới bầu trời sao."></canvas><p>✦ ${esc(state.name)} · Người đưa lễ hội trở lại</p></section><div class="festival-dialogue"><span class="tiny-label">${esc(speaker.name)}</span><p>${esc(page.text)}</p></div>${last?'<p class="festival-complete">✓ Hành trình hồi sinh đã hoàn thành · 24/24 bước</p>':''}<div class="npc-actions">${festivalIndex?'<button data-festival-prev>Trước đó</button>':''}<button data-festival-next>${last?'Tiếp tục khám phá':'Tiếp tục câu chuyện'}</button><button data-festival-later>Đóng lễ hội</button></div>`);
    drawFestival();
  }
  // Vẽ đèn, quảng trường và toàn bộ cư dân bằng renderer thật; giảm chuyển động giữ cảnh đứng yên.
  function drawFestival() {
    const c=$('festivalCanvas').getContext('2d'),t=reducedMotion?0:festivalTime;c.imageSmoothingEnabled=false;
    rect(c,0,0,760,300,'#20374d');rect(c,0,164,760,136,'#365849');rect(c,0,203,760,97,'#8d9773');
    for(let i=0;i<32;i++){const x=(i*97+29)%760,y=15+(i*19)%125,size=i%5===0?3:2;rect(c,x,y,size,size,'#fbe3a0');}
    for(let i=0;i<12;i++){const x=30+i*64,y=68+Math.round(Math.sin(i*.45)*15);rect(c,x,y-10,2,14,'#d5bc83');rect(c,x-7,y+3,16,15,'#e1a45d');rect(c,x-4,y+5,10,10,'#ffe7a0');}
    for(const x of [80,650]){rect(c,x-35,126,70,55,'#658070');rect(c,x-43,119,86,12,'#b68169');rect(c,x-20,144,14,17,'#f4cf87');rect(c,x+9,144,14,17,'#f4cf87');}
    pixelEllipse(c,380,216,284,60,'#b7b58a');pixelEllipse(c,380,214,210,42,'#d8c592');
    rect(c,350,168,60,21,'#879b90');rect(c,369,100,22,68,'#e0cfad');rect(c,355,92,50,12,'#749397');rect(c,365,68,30,25,'#f3cb77');rect(c,375,62,10,30,'#fff4bc');
    const crowd=D.npcs.map((n,i)=>({...n,x:i<6?75+i*122:[100,220,300,460,620][i-6],y:i<6?220:292,direction:i<6?'down':'up'}));
    for(const n of crowd)A.draw(c,{...n,moving:false,time:t,reducedMotion});
    A.draw(c,{id:'player',isPlayer:true,x:380,y:280,direction:'up',shirt:'#579b9c',hair:'#564247',time:t,reducedMotion});
    for(let i=0;i<14;i++){const x=(i*53+21)%760,y=42+(i*31)%145+(reducedMotion?0:Math.sin(t+i)*4);rect(c,x,y,2,2,'#ffeab6');}
  }
  // Kết thúc cảnh chỉ ghi nhận đã xem, không phát lại thưởng nhiệm vụ khi xem lại lễ hội.
  function finishFestival() {
    state.festivalSeen=true;festivalPending=false;closeDialog();refreshHUD();
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
    const items=Object.entries(D.items).map(([id,item])=>{
      const gear=id==='rootblade'?{slot:'weapon',damage:3}:D.exploration.equipment[id];
      const selected=gear?.slot==='weapon'?state.adventure.weapon===id:state.exploration.outfit===id;
      const action=gear?`<button data-equip="${id}">${selected?'Đang trang bị':'Trang bị'} · ${gear.damage?`${gear.damage} sát thương`:`Giáp ${gear.armor}`}</button>`:['forestamber','coastpearl','cloudcore'].includes(id)?'<span>Vật phẩm nhiệm vụ · giữ lại để giao</span>':`<button data-sell="${id}">Bán 1 ${state.upgrades.includes('market')?'(+50%)':''}</button>${['tea','meal'].includes(id)?`<button data-use="${id}">Dùng hồi sức</button>`:''}`;
      return `<div class="inventory-item">${item.icon} ${esc(item.name)}<b>${state.inventory[id]} / ${C.capacity(state)}</b>${state.inventory[id]>0?action:''}</div>`;
    }).join('');
    const equipmentSummary=`Vũ khí: ${state.adventure.weapon==='starter'?'Kiếm khởi đầu':esc(D.items[state.adventure.weapon]?.name)} · ${Exploration.damage(state,D)} sát thương. Trang phục: ${state.exploration.outfit?esc(D.items[state.exploration.outfit].name):'Áo ban đầu'} · Giáp ${Exploration.armor(state,D)}.`;
    const recipes=D.recipes.map(r=>{const missing=r.proof&&!state.adventure.proofs.includes(r.proof)?'Cần giải phóng lõi rừng':r.requires&&!state.upgrades.includes(r.requires)?`Cần ${D.upgrades.find(u=>u.id===r.requires).name}`:'';return`<article class="card"><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><div class="materials">${Object.entries(r.input).map(([id,n])=>`${esc(D.items[id].name)} ${state.inventory[id]}/${n}`).join(' · ')} → ${Object.entries(r.output).map(([id,n])=>`${n} ${esc(D.items[id].name)}`).join(', ')}</div><button data-craft="${r.id}" ${missing?'disabled':''}>${esc(missing||'Chế tạo')}</button></article>`;}).join('');
    openDialog('inventory','Túi đồ & chế tạo','CHUẨN BỊ CHO CHUYẾN THÁM HIỂM',`<section class="save-management"><p>Save chỉ nằm trên trình duyệt/ứng dụng này. Xuất file vào Tệp trước khi xóa/cài lại. Cập nhật game giữ save trong cùng ứng dụng.</p><div class="npc-actions"><button data-export-save>Sao lưu ra file</button><button data-choose-save>Nhập tiến trình</button><button data-refresh-game>Cập nhật game</button></div><p id="save-transfer-status" role="status"></p></section><p class="dialog-intro">${equipmentSummary}</p><button data-equip="starter">Dùng kiếm khởi đầu</button><button data-equip="none">Dùng áo ban đầu</button><p class="dialog-intro">Đèn lồng trong túi tự soi sáng quanh bạn. Trà hồi 35 thể lực; bữa ăn hồi toàn bộ máu và thể lực. Tài nguyên có thể bán để kiếm xu; Chợ Lá tăng giá bán 50%.</p><div class="inventory-grid">${items}</div><h3>Công thức đã biết</h3><div class="cards">${recipes}</div>`);
  }
  function talk(npc,registerVisit=true) {
    if(registerVisit){C.event(state,'talk',npc.id,1,D);save();refreshHUD();}
    const f=state.friendship?.[npc.id]||{points:0,talkedToday:false,giftedToday:false};
    const hearts=Math.floor(f.points/100);
    const heartMeter='♥'.repeat(hearts)+'♡'.repeat(5-hearts);
    const eyebrow=`${npc.role} · ${heartMeter} (${hearts}/5)`;
    let speech='';
    if(hearts>=5&&npc.heartDialogues?.[5]) speech=npc.heartDialogues[5];
    else if(hearts>=4&&npc.heartDialogues?.[4]) speech=npc.heartDialogues[4];
    else if(hearts>=2&&npc.heartDialogues?.[2]) speech=npc.heartDialogues[2];
    else speech=npc.dialogue[(state.day-1)%npc.dialogue.length];
    const related=D.quests.filter(q=>q.giver===npc.id&&state.quests[q.id]?.status!=='claimed'&&(state.quests[q.id]||C.available(state,q,D)));
    const actions=related.map(q=>`<article class="card"><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p>${state.quests[q.id]?`<button data-claim="${q.id}" ${C.complete(state,q)?'':'disabled'}>${C.complete(state,q)?'Giao đồ / nhận thưởng':'Chưa đủ mục tiêu'}</button>`:`<button data-accept="${q.id}">Nhận nhiệm vụ</button>`}</article>`).join('');
    const heartBar=`<div class="npc-hearts-bar"><span class="npc-hearts">${heartMeter}</span> <span class="npc-hearts-text">${f.points}/500 điểm thân thiết (${hearts}/5 Tim) · ${f.giftedToday?'✓ Đã tặng quà hôm nay':'🎁 Chưa tặng quà hôm nay'}</span></div>`;
    const giftBtn=`<button data-gift-npc="${npc.id}">🎁 Tặng quà</button>`;
    const shopBtn=npc.id==='bao'&&canShop()?'<button data-open-shop>Xem cửa hàng</button>':'';
    openDialog(`npc:${npc.id}`,npc.name,eyebrow,`${heartBar}<div class="dialogue-text">${esc(speech)}</div>${actions?`<div class="cards">${actions}</div>`:'<p class="dialog-intro">Một cuộc trò chuyện cũng làm thung lũng ấm áp hơn.</p>'}<div class="npc-actions">${shopBtn}${giftBtn}<button data-open-journal>Mở sổ nhiệm vụ</button><button data-close>Hẹn gặp lại</button></div>`);
  }
  function showGiftMenu(npc) {
    const f=state.friendship?.[npc.id]||{points:0,talkedToday:false,giftedToday:false};
    const hearts=Math.floor(f.points/100);
    const heartMeter='♥'.repeat(hearts)+'♡'.repeat(5-hearts);
    const eyebrow=`${npc.role} · ${heartMeter} (${hearts}/5)`;
    if(f.giftedToday){
      openDialog(`gift:${npc.id}`,`Tặng quà cho ${npc.name}`,eyebrow,`<p class="dialog-intro">Hôm nay bạn đã tặng quà cho ${esc(npc.name)} rồi. Hãy quay lại vào ngày mai nhé!</p><div class="npc-actions"><button data-talk-back="${npc.id}">Quay lại trò chuyện</button><button data-close>Đóng</button></div>`);
      return;
    }
    const giftableItems=Object.entries(D.items).filter(([id])=>(state.inventory[id]||0)>0);
    if(!giftableItems.length){
      openDialog(`gift:${npc.id}`,`Tặng quà cho ${npc.name}`,eyebrow,`<p class="dialog-intro">Túi đồ của bạn đang trống. Hãy thu thập hoặc chế tạo vật phẩm trước khi tặng quà!</p><div class="npc-actions"><button data-talk-back="${npc.id}">Quay lại trò chuyện</button><button data-close>Đóng</button></div>`);
      return;
    }
    const itemsHtml=giftableItems.map(([id,item])=>`<button class="gift-item" data-give-gift="${id}" data-npc="${npc.id}"><span class="gift-icon">${item.icon}</span><span class="gift-name">${esc(item.name)}</span><span class="gift-count">x${state.inventory[id]}</span></button>`).join('');
    openDialog(`gift:${npc.id}`,`Tặng quà cho ${npc.name}`,eyebrow,`<div class="gift-menu"><p class="dialog-intro">Chọn một món quà từ túi đồ để tặng cho ${esc(npc.name)}:</p><div class="gift-grid">${itemsHtml}</div></div><div class="npc-actions"><button data-talk-back="${npc.id}">Quay lại trò chuyện</button><button data-close>Đóng</button></div>`);
  }
  function openGiftReactionDialog(npc,result) {
    const f=state.friendship?.[npc.id]||{points:result.points,talkedToday:false,giftedToday:true};
    const hearts=Math.floor(f.points/100);
    const heartMeter='♥'.repeat(hearts)+'♡'.repeat(5-hearts);
    const eyebrow=`${npc.role} · ${heartMeter} (${hearts}/5)`;
    const sign=result.pointsDelta>=0?'+':'';
    const milestoneNote=result.rewards&&result.rewards.length>0?`<div class="reward">✦ Mở khóa mốc thân thiết ${result.rewards.map(r=>r.milestone).join(', ')} tim!</div>`:'';
    const heartBar=`<div class="npc-hearts-bar"><span class="npc-hearts">${heartMeter}</span> <span class="npc-hearts-text">${f.points}/500 điểm thân thiết (${hearts}/5 Tim)</span></div>`;
    openDialog(`npc:${npc.id}`,npc.name,eyebrow,`${heartBar}<div class="dialogue-text">${esc(result.reaction)}</div><p class="good">${sign}${result.pointsDelta} Điểm thân thiết (${result.points}/500 điểm · ${hearts}/5 Tim)</p>${milestoneNote}<div class="npc-actions"><button data-talk-back="${npc.id}">Tiếp tục trò chuyện</button><button data-close>Hẹn gặp lại</button></div>`);
  }
  function updateModal() {
    if(modal==='journal')showJournal();else if(modal==='build')showBuild();else if(modal==='inventory')showInventory();
    else if(modal==='residents')showResidents();else if(modal==='shop')showShop();
    else if(modal?.startsWith('npc:')) { const npc=npcById(modal.slice(4)); if(npc)talk(npc,false); }
    else if(modal?.startsWith('gift:')) { const npc=npcById(modal.slice(5)); if(npc)showGiftMenu(npc); }
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(modal==='cave-puzzle'&&interior){
      if(b.dataset.caveSymbol){const result=Exploration.puzzleInput(state,interior.id,b.dataset.caveSymbol,D);refreshCavePuzzle(result.message);save();return;}
      if(b.hasAttribute('data-cave-reset')){const result=Exploration.resetPuzzle(state,interior.id,D);refreshCavePuzzle(result.message);save();return;}
      if(b.hasAttribute('data-cave-check')){const result=Exploration.solve(state,interior.id,D);if(result.ok){closeDialog();reward(result);}else refreshCavePuzzle(result.message);save();return;}
    }
    if(b.hasAttribute('data-open-shop')){showShop();return;}
    if(b.dataset.buy){if(modal==='shop'&&canShop()){const result=Exploration.buy(state,b.dataset.buy,Number(b.dataset.quantity),D);reward(result);showShop(result.message);}return;}
    if(b.hasAttribute('data-export-save')){exportSave();return;}
    if(b.hasAttribute('data-refresh-game')){refreshGame();return;}
    if(b.hasAttribute('data-choose-save')){chooseSave();return;}
    if(b.hasAttribute('data-import-save')){importSave();return;}
    if(b.hasAttribute('data-open-goals')){showGoals();return;}
    if(b.hasAttribute('data-open-build')){showBuild();return;}
    if(b.hasAttribute('data-open-festival')){showFestival();return;}
    if(modal==='festival'){
      if(b.hasAttribute('data-festival-next')){if(festivalIndex===D.journey.festival.length-1)finishFestival();else showFestival(festivalIndex+1);return;}
      if(b.hasAttribute('data-festival-prev')){showFestival(festivalIndex-1);return;}
      if(b.hasAttribute('data-festival-later')){finishFestival();return;}
    }
    if(b.dataset.goal){if(C.chooseGoal(state,b.dataset.goal==='none'?null:b.dataset.goal,D)){save();refreshHUD();showGoals();}return;}
    if(b.dataset.goalAction){if(b.dataset.goalAction==='side')showJournal('side');else if(b.dataset.goalAction==='build')showBuild();else if(b.dataset.goalAction==='treasure')showTreasure();return;}
    if(modal==='tutorial'){
      if(b.hasAttribute('data-tutorial-next')){if(tutorialIndex===Tutorial.count-1)finishTutorial();else showTutorial(tutorialIndex+1);return;}
      if(b.hasAttribute('data-tutorial-prev')){showTutorial(tutorialIndex-1);return;}
      if(b.hasAttribute('data-tutorial-skip')){finishTutorial();return;}
    }
    if(b.dataset.tab)showJournal(b.dataset.tab);
    if(b.dataset.journalView){$('game-dialog').scrollTop=0;showJournal(journalTab,b.dataset.journalView);}
    if(b.hasAttribute('data-open-story'))showJournal('story','active');
    if(b.hasAttribute('data-close'))closeDialog();
    if(b.hasAttribute('data-open-journal'))showJournal();
    if(b.hasAttribute('data-open-inventory'))showInventory();
    if(b.dataset.findNpc) {const npc=npcById(b.dataset.findNpc);if(npc){guidedNpcId=npc.id;closeDialog();refreshHUD();toast(`Đang tìm ${npc.name}. Chỉ dẫn ở bảng hành trình sẽ theo vị trí hiện tại của họ.`);}}
    if(b.dataset.giftNpc) {const npc=npcById(b.dataset.giftNpc);if(npc)showGiftMenu(npc);return;}
    if(b.dataset.giveGift) {
      const npcId=b.dataset.npc||(modal?.startsWith('gift:')?modal.slice(5):modal?.startsWith('npc:')?modal.slice(4):nearestNPC());
      const npc=npcById(npcId), itemId=b.dataset.giveGift;
      if(npc&&itemId){
        const result=C.giveGift(state,npc.id,itemId,D);
        if(result.ok){
          const heartBurst=(result.pointsDelta>=0?'+':'')+result.pointsDelta+' ♥';
          burst(npc.x,npc.y,'#ff6b8b',heartBurst);
          effect('text',npc.x,npc.y-55,heartBurst,'#ff6b8b');
          toast(`${npc.name}: "${result.reaction}" (${heartBurst})`);
          if(result.rewards&&result.rewards.length>0)toast(`Mở khóa mốc thân thiết! Nhận thưởng từ ${npc.name}.`);
          save();refreshHUD();openGiftReactionDialog(npc,result);
        } else toast(result.message);
      }
      return;
    }
    if(b.dataset.talkBack) {const npc=npcById(b.dataset.talkBack);if(npc)talk(npc,false);return;}
    if(b.dataset.accept) { if(C.accept(state,b.dataset.accept,D)){ toast('Đã nhận nhiệm vụ. Mục tiêu sẽ được tính từ bây giờ.');save();refreshHUD();updateModal(); } }
    if(b.dataset.track) { state.tracked=b.dataset.track;guidedNpcId=null;save();refreshHUD();updateModal(); }
    if(b.dataset.claim) { const followed=state.tracked===b.dataset.claim,result=C.claim(state,b.dataset.claim,D,modal?.startsWith('npc:')?modal.slice(4):nearestNPC());if(result.ok&&followed&&b.dataset.claim==='story05'&&state.quests.adv01?.status==='active')state.tracked='adv01';reward(result);if(result.ok&&b.dataset.claim===D.journey.finalQuest){festivalIndex=0;festivalTime=0;festivalPending=true;guidedNpcId=null;showFestival();}else{updateModal();if(result.ok&&modal==='journal'){$('dialog-body').querySelector?.('[data-quest-id] button:not([disabled])')?.focus();if(!document.activeElement||!$('dialog-body').contains?.(document.activeElement))$('journal-status')?.focus();}} }
    if(b.dataset.equip){if(Adventure.equip(state,b.dataset.equip,D)){save();refreshHUD();showInventory();}}
    if(b.dataset.landmark&&modal==='landmarks'){const o=currentArea().objects.find(o=>o.proof===b.dataset.landmark||o.id===b.dataset.landmark);closeDialog();if(o&&distance(o,state)<=85){if(o.kind==='door')enterInterior(o);else if(o.kind==='indoor')interactInterior(o);else if(o.kind==='adventureRest')restAtCamp();else interactAdventure(o);}return;}
    if(b.dataset.talkNear&&modal==='landmarks'){const n=npcById(b.dataset.talkNear);closeDialog();if(n&&n.map===state.map&&distance(n,state)<85)talk(n);return;}
    if(b.dataset.rescueRoute&&modal==='rescue'){const route=b.dataset.rescueRoute,result=route==='path'?Adventure.beginRescue(state,D):null;closeDialog();if(route==='fight')startEncounter('rescue');else reward(result);return;}
    if(b.dataset.puzzle&&modal==='root-puzzle'){const result=Adventure.puzzleInput(state,b.dataset.puzzle,b.dataset.symbol,D);refreshPuzzle(b.dataset.puzzle,result.message||'');save();return;}
    if(b.dataset.puzzleCheck&&modal==='root-puzzle'){const result=Adventure.solvePuzzle(state,b.dataset.puzzleCheck,D);if(result.ok){closeDialog();reward(result);}else refreshPuzzle(b.dataset.puzzleCheck,result.message);return;}
    if(b.dataset.prepare&&modal==='supply'){const result=Adventure.prepare(state,b.dataset.prepare,D);closeDialog();reward(result);return;}
    if(b.hasAttribute('data-field-heal')&&encounter){const result=Adventure.useSupply(state);reward(result);if(result.ok)closeDialog();return;}
    if(b.dataset.travel){
      if(!C.visit(state,b.dataset.travel,D))return;
      // Chỉ bỏ ngữ cảnh phòng sau khi đích hợp lệ; save phải ghi vị trí vùng vừa tới.
      closeDialog();resetEncounter();interior=null;returnPoint=null;state.x=800;state.y=state.map==='forest'?440:650;clearMovement();walkDistance=0;updateCamera();refreshHUD();save();if(!socket)connect();
    }
    if(b.hasAttribute('data-retreat')){closeDialog();resetEncounter();interior=null;returnPoint=null;state.map=state.adventure.checkpoint?'forest':'village';state.x=800;state.y=state.map==='forest'?440:720;state.health=100;state.stamina=70;clearMovement();save();refreshHUD();if(!socket)connect();toast('Bạn rút về điểm nghỉ. Trận chưa thắng được đặt lại.');}
    if(b.dataset.build) { const result=C.build(state,b.dataset.build,D);reward(result);if(result.ok){const house=buildings.find(h=>h.upgrade===b.dataset.build);if(house)effect('ring',house.x,house.y,'','#e3c77b');}terrainCache.delete('village');updateModal(); }
    if(b.dataset.craft) {reward(C.craft(state,b.dataset.craft,D));updateModal();}
    if(b.dataset.sell) {reward(C.sell(state,b.dataset.sell,1,D));updateModal();}
    if(b.dataset.use) {const item=b.dataset.use;if(state.inventory[item]){state.inventory[item]--;state.stamina=clamp(state.stamina+(item==='meal'?100:35),0,100);if(item==='meal')state.health=100;save();refreshHUD();toast('Đã hồi sức.');updateModal();}}
    if(b.hasAttribute('data-rest')) {C.nextDay(state,D);closeDialog();toast('Một ngày mới bắt đầu. Hợp đồng hôm nay đã thay đổi!');refreshHUD();save();}
  });
  $('btn-journal').addEventListener('click',()=>showJournal());$('btn-tracker').addEventListener('click',()=>showJournal());
  $('btn-journey').addEventListener('click',()=>showJournal(Adventure.unlocked(state)&&(state.adventure.proofs.length||state.tracked?.startsWith('adv')&&!C.journeyProgress(state,D).finished)?'adventure':C.journeyProgress(state,D).finished?'goals':'story'));
  $('btn-build').addEventListener('click',showBuild);$('btn-inventory').addEventListener('click',showInventory);
  $('btn-residents').addEventListener('click',showResidents);
  // Menu tiện ích chỉ phủ bản đồ khi người chơi chủ động mở; tự thu gọn khi chọn chức năng.
  function setMobileMenu(open) {
    $('play-screen').dataset.mobileMenuOpen=String(open);
    $('btn-mobile-menu').setAttribute('aria-expanded',String(open));
    $('btn-mobile-menu').setAttribute('aria-label',open?'Đóng các chức năng':'Mở các chức năng');
  }
  $('btn-mobile-menu').addEventListener('click',()=>setMobileMenu($('play-screen').dataset.mobileMenuOpen!=='true'));
  for(const id of ['btn-journal','btn-build','btn-inventory','btn-help','btn-mobile-quests','btn-mobile-chat'])$(id).addEventListener('click',()=>setMobileMenu(false));
  document.addEventListener('pointerdown',e=>{if($('play-screen').dataset.mobileMenuOpen==='true'&&!e.target.closest('.actionbar,.mobile-panel-tabs'))setMobileMenu(false);});
  function setMobilePanel(panel) {
    setMobileMenu(false);
    for(const previous of ['quests','chat'])if(previous!==panel&&$('mobile-'+previous+'-panel').contains?.(document.activeElement))document.activeElement?.blur?.();
    mobilePanel=panel;
    $('play-screen').setAttribute('data-mobile-panel-open',panel);
    $('btn-mobile-quests').setAttribute('aria-expanded',String(panel==='quests'));
    $('btn-mobile-chat').setAttribute('aria-expanded',String(panel==='chat'));
    $('mobile-panel-backdrop').hidden=!panel;
    if(panel){clearMovement();if(fishing){fishing=null;$('fishing').hidden=true;}}
  }
  for(const panel of ['quests','chat'])$('btn-mobile-'+panel).addEventListener('click',()=>setMobilePanel(mobilePanel===panel?'':panel));
  for(const id of ['mobile-panel-close','mobile-panel-backdrop'])$(id).addEventListener('click',()=>setMobilePanel(''));
  $('btn-portrait-home').addEventListener('click',()=>$('btn-home').click());
  $('btn-minimap').addEventListener('click',()=>{minimapOpen=!minimapOpen;$('minimap-shell').setAttribute('data-collapsed',String(!minimapOpen));$('btn-minimap').setAttribute('aria-expanded',String(minimapOpen));$('btn-minimap').setAttribute('aria-label',minimapOpen?'Ẩn bản đồ thu nhỏ':'Hiện bản đồ thu nhỏ');lastMinimap=-Infinity;});
  $('start-form').addEventListener('submit',e=>{
    if(installGate&&!installGate.canPlay()){e.preventDefault();return;}
    e.preventDefault();state.name=C.cleanName($('player-name').value);clearMovement();running=true;hasPlayed=true;C.resumeStory(state,D);C.resumeAdventure(state,D);C.ensureTrackedQuest(state,D);festivalPending=C.journeyProgress(state,D).finished&&!state.festivalSeen;$('start-screen').hidden=true;$('play-screen').hidden=false;window.scrollTo?.(0,0);resizeViewport();
    refreshHUD();save();connect();toast('Chào mừng tới Làng Sao! E để trò chuyện; Q để mở sổ nhiệm vụ.');
    if(festivalPending&&!modal&&!orientationBlocked)showFestival(festivalIndex);
  });
  $('btn-home').addEventListener('click',async e=>{
    e.preventDefault();++fullscreenEpoch;++saveReadEpoch;fullscreenBusy=false;pendingImport=null;
    if(interior)exitInterior(false);
    clearMovement();setMobilePanel('');save();running=false;syncOrientation();
    if(socket){socket.onclose=null;socket.close();socket=null;}clearTimeout(reconnectTimer);peers.clear();onlineId=null;closeDialog({preserveFestival:true});
    if(nativeFull())await exitNativeFullscreen();
    $('game-wrapper').classList.remove('pseudo-fullscreen');syncFullscreen();
    $('play-screen').hidden=true;$('start-screen').hidden=false;refreshStartSave();window.scrollTo?.(0,0);
  });
  function chatLine(name,text,notice=false) {
    const p=document.createElement('p');if(notice)p.className='notice';if(name){const b=document.createElement('b');b.textContent=name;p.append(b);}p.append(document.createTextNode(text));$('chat-log').append(p);while($('chat-log').children.length>40)$('chat-log').firstChild.remove();$('chat-log').scrollTop=$('chat-log').scrollHeight;
  }
  function connect() {
    if(interior)return;
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
  $('chat-form').addEventListener('submit',e=>{e.preventDefault();const text=$('chat-input').value.trim().slice(0,140);if(!text)return;if(socket?.readyState===1&&onlineId){socket.send(JSON.stringify({type:'chat',text}));$('chat-input').value='';}else toast('Chat cần kết nối với máy chủ game.');});
  chatLine('','Tới gần cư dân và nhấn E để gặp gỡ. Chat trực tuyến khi mở game qua server.',true);
  const nativeFull = () => !!(document.fullscreenElement||document.webkitFullscreenElement);
  const standalone=()=>qaFullscreen==='standalone'||!!globalThis.navigator?.standalone||!!window.matchMedia?.('(display-mode: standalone)').matches;
  const iosBrowser=()=>qaFullscreen==='ios'||/iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent||'')||globalThis.navigator?.platform==='MacIntel'&&globalThis.navigator?.maxTouchPoints>1;
  async function exitNativeFullscreen(){try{const fn=document.exitFullscreen||document.webkitExitFullscreen;if(fn)await fn.call(document);}catch(_){}}
  function syncFullscreen() {
    const app=standalone(),expanded=app||nativeFull()||$('game-wrapper').classList.contains('pseudo-fullscreen'),button=$('btn-fullscreen');
    button.innerHTML=`${app?'✓':expanded?'⊡':'⛶'} <span>${app?'Ứng dụng':expanded?'Thu nhỏ':'Toàn màn hình'}</span>`;
    button.setAttribute('aria-label',app?'Chế độ ứng dụng và tiến trình':expanded?'Thu nhỏ màn hình':'Phóng toàn màn hình');
    button.setAttribute('aria-pressed',String(expanded));button.setAttribute('data-fullscreen-mode',app?'standalone':nativeFull()?'native':expanded?'pseudo':'browser');
    button.setAttribute('aria-busy',String(fullscreenBusy));
  }
  function showFullscreenHelp(){
    const app=standalone();
    openDialog('fullscreen-help',app?'Game đang ở chế độ ứng dụng':'Chơi trọn màn hình trên iPhone',app?'MÀN HÌNH CHÍNH':'SAFARI',`<div class="fullscreen-help">${app?'<p>Bạn đang mở game từ Màn hình chính. Xoay điện thoại nằm ngang để chơi với toàn bộ vùng màn hình.</p>':'<p>Safari chưa cho phép game ẩn thanh địa chỉ bằng nút này. Mở game từ Màn hình chính để chơi không có thanh Safari.</p><ol><li>Trong Safari, nhấn <b>Chia sẻ</b> → <b>Thêm vào Màn hình chính</b>.</li><li>Bật <b>Mở dạng ứng dụng</b> nếu xuất hiện, rồi nhấn <b>Thêm</b>.</li><li>Mở biểu tượng <b>Thung Lũng Sao Rơi</b> và xoay điện thoại nằm ngang.</li></ol>'}<p>Để mang tiến trình sang chế độ ứng dụng, xuất file ở đây rồi nhập file khi mở game từ Màn hình chính.</p><div class="npc-actions save-transfer-actions"><button data-export-save>Xuất tiến trình</button><button data-choose-save>Nhập tiến trình</button><button data-close>Tiếp tục chơi</button></div><p id="save-transfer-status" role="status"></p></div>`);
  }
  function requestNativeFullscreen(w,fn){
    return new Promise(resolve=>{
      let timer,done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);for(const event of ['fullscreenchange','webkitfullscreenchange'])document.removeEventListener(event,changed);resolve(ok);};
      const changed=()=>{if(nativeFull())finish(true);};
      for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,changed);
      timer=setTimeout(()=>finish(nativeFull()),1200);
      try{const result=fn.call(w);if(nativeFull())finish(true);else if(result?.then)Promise.resolve(result).then(()=>finish(nativeFull()),()=>finish(false));}catch(_){finish(false);}
    });
  }
  $('btn-fullscreen').addEventListener('click',async()=>{
    if(fullscreenBusy)return;
    clearMovement();const w=$('game-wrapper'),ticket=++fullscreenEpoch;fullscreenBusy=true;syncFullscreen();
    try{
      if(nativeFull()){await exitNativeFullscreen();w.classList.remove('pseudo-fullscreen');if(nativeFull())toast('Trình duyệt chưa cho phép thu nhỏ. Bạn có thể nhấn Esc.');}
      else if(w.classList.contains('pseudo-fullscreen'))w.classList.remove('pseudo-fullscreen');
      else if(standalone())showFullscreenHelp();
      else{
        const fn=qaFullscreen==='ios'?null:w.requestFullscreen||w.webkitRequestFullscreen;
        const entered=fn?await requestNativeFullscreen(w,fn):false;
        if(ticket!==fullscreenEpoch||!running){if(nativeFull())await exitNativeFullscreen();return;}
        if(!entered){if(iosBrowser())showFullscreenHelp();else w.classList.add('pseudo-fullscreen');}
      }
    }finally{if(ticket===fullscreenEpoch)fullscreenBusy=false;syncFullscreen();resizeViewport();}
  });
  for(const e of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(e,()=>{
    if(nativeFull()){$('game-wrapper').classList.remove('pseudo-fullscreen');if(!running)void exitNativeFullscreen();else if(modal==='fullscreen-help')closeDialog();}
    syncFullscreen();resizeViewport();
  });
  const typing = () => ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  const panelBlocks=()=>!!mobilePanel&&mobileLayout();
  const gamePaused=()=>!!modal||typing()||orientationBlocked||panelBlocks()||!!document.hidden;
  document.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='escape'){clearMovement();if(fishing){fishing=null;$('fishing').hidden=true;}else if(mobilePanel)setMobilePanel('');else if($('play-screen').dataset.mobileMenuOpen==='true')setMobileMenu(false);else if($('game-wrapper').classList.contains('pseudo-fullscreen')){$('game-wrapper').classList.remove('pseudo-fullscreen');syncFullscreen();}return;}
    if(!running||gamePaused())return;
    if(fishing){if(['e','enter'].includes(k)){e.preventDefault();interact();}return;}
    if(['BUTTON','A'].includes(document.activeElement?.tagName)&&[' ','enter'].includes(k))return;
    if(['arrowup','arrowdown','arrowleft','arrowright',' ','e','q','b','i','r','1','2','3'].includes(k))e.preventDefault();
    if(e.repeat)return;
    keys.add(k);
    if(k==='shift')syncRunControl();
    if(k==='1'){state.selectedSeed='berry';toast('Đã chọn hạt: Quả mâm xôi');refreshHUD();save();}
    if(k==='2'){state.selectedSeed='carrot';toast('Đã chọn hạt: Cà rốt sao');refreshHUD();save();}
    if(k==='3'){state.selectedSeed='wheat';toast('Đã chọn hạt: Lúa mì vàng');refreshHUD();save();}
    if(k==='r')waterPlot();
    if(k==='e'||k==='enter')interact();if(k===' ')attack();if(k==='v')dodge();if(k==='q')showJournal();if(k==='b')showBuild();if(k==='i')showInventory();
  });
  document.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='shift'){playerRunning=!!state.moving&&wantsRun();syncRunControl();}});
  window.addEventListener('blur',clearMovement);
  $('chat-input').addEventListener('focus',clearMovement);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearMovement();save();}});
  window.addEventListener('pagehide',()=>{clearMovement();save();clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.close();socket=null;}onlineId=null;peers.clear();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&running)connect();});
  // Track contacts rather than directions: releasing one finger must not release
  // another finger on the same arrow. Document release also covers capture failure.
  function syncTouchKeys(){touchKeys.clear();touchPointers.forEach(p=>touchKeys.add(p.button.dataset.move));}
  function releaseTouch(e,button) {
    const id=e.pointerId??button;
    const held=touchPointers.get(id);
    if(!held||button&&held.button!==button)return;
    touchPointers.delete(id);syncTouchKeys();
    try{if(held.button.hasPointerCapture?.(id))held.button.releasePointerCapture(id);}catch(_){}
  }
  document.querySelectorAll('[data-move]').forEach(b=>{
    b.addEventListener('pointerdown',e=>{
      e.preventDefault();
      if(e.button>0||!running||gamePaused()||fishing)return;
      const id=e.pointerId??b;touchPointers.set(id,{button:b});syncTouchKeys();
      try{b.setPointerCapture(e.pointerId);}catch(_){}
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>releaseTouch(e,b));
  });
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>releaseTouch(e));
  function resetJoystick() {
    const id=joystickPointer;joystickPointer=null;joystickX=joystickY=0;
    $('joystick-knob').style.transform='translate(-50%, -50%)';$('touch-joystick').setAttribute('data-active','false');
    try{if(id!==null&&$('touch-joystick').hasPointerCapture?.(id))$('touch-joystick').releasePointerCapture(id);}catch(_){}
  }
  function moveJoystick(e) {
    if(joystickPointer!==e.pointerId)return;
    e.preventDefault();
    if(!running||gamePaused()||fishing){resetJoystick();return;}
    const r=$('touch-joystick').getBoundingClientRect(),radius=Math.max(12,Math.min(r.width,r.height)/2-23);
    if(!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;
    const dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;
    const x=dx*scale,y=dy*scale;
    joystickX=length<radius*.18?0:x/radius;joystickY=length<radius*.18?0:y/radius;
    $('joystick-knob').style.transform=`translate(-50%, -50%) translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  $('touch-joystick').addEventListener('pointerdown',e=>{
    e.preventDefault();if(e.button>0||joystickPointer!==null||!running||gamePaused()||fishing)return;
    joystickPointer=e.pointerId;$('touch-joystick').setAttribute('data-active','true');
    try{$('touch-joystick').setPointerCapture(e.pointerId);}catch(_){}moveJoystick(e);
  });
  for(const target of [$('touch-joystick'),document]){
    target.addEventListener('pointermove',moveJoystick);
    for(const type of ['pointerup','pointercancel'])target.addEventListener(type,e=>{if(joystickPointer===e.pointerId)resetJoystick();});
  }
  $('touch-joystick').addEventListener('lostpointercapture',e=>{if(joystickPointer===e.pointerId)resetJoystick();});
  for(const type of ['contextmenu','selectstart','dragstart'])document.addEventListener(type,e=>{
    const target=e.target?.closest?e.target:e.target?.parentElement;
    if(!target?.closest('#game-wrapper')||target.closest('input, textarea, select, [contenteditable="true"]')||!target.closest('button, #btn-home, #gameCanvas, #minimapCanvas'))return;
    e.preventDefault();if(type==='contextmenu')clearMovement();
  });
  $('touch-interact').addEventListener('click',interact);$('touch-attack').addEventListener('click',attack);
  $('touch-dodge').addEventListener('click',dodge);
  $('touch-run').addEventListener('click',()=>{if(!running||gamePaused()||fishing)return;touchRun=!touchRun;playerRunning=!!state.moving&&wantsRun();syncRunControl();});
  function resourceReady(o) {return Date.now()-(state.resources[o.id]||0)>=30000;}
  // Hai địa điểm nằm sát nhau phải chọn được bằng tên, kể cả khi trạm nghỉ/lối tắt gần chân hơn bia.
  function nearbyLandmarks(){return currentArea().objects.filter(o=>distance(o,state)<=85&&(['door','indoor'].includes(o.kind)||Adventure.unlocked(state)&&(o.kind==='adventureRest'?state.adventure.proofs.includes('rescue'):o.kind==='adventure'&&!(o.mode==='route'&&(!state.adventure.milestones.includes('rescue-route')||state.adventure.milestones.includes(o.proof)))&&!(o.mode==='survey'&&state.adventure.milestones.includes(o.proof))))).sort((a,b)=>distance(a,state)-distance(b,state));}
  // Cảnh trong nhà tách khỏi map online; không cho vị trí căn phòng xuất hiện ở quảng trường.
  function enterInterior(door){
    if(interior||encounter||door.map!==state.map||distance(door,state)>85){toast('Hãy tới gần cửa khi đã rời giao tranh.');return;}
    const result=Exploration.enter(state,door.roomId,D);if(!result.ok){reward(result);return;}
    returnPoint={map:state.map,x:state.x,y:state.y};interior=InteriorScene.create(D.exploration.rooms.find(r=>r.id===door.roomId),D);Object.assign(state,interior.spawn);
    if(socket){socket.onclose=null;socket.close();socket=null;}clearTimeout(reconnectTimer);peers.clear();onlineId=null;$('online-status').textContent='Trong nhà · chơi riêng';
    resetEncounter();clearMovement();npcs.forEach(n=>{n.moving=false;});walkDistance=0;actorMotions.clear();near=null;particles.length=0;effects.length=0;lastMinimap=-Infinity;refreshHUD();updateCamera();save();toast(`${interior.room.name} · cửa ra ở phía nam.`);
  }
  function exitInterior(reconnect=true){
    if(!interior)return;if(modal)closeDialog();resetEncounter();Object.assign(state,returnPoint);interior=null;returnPoint=null;
    clearMovement();walkDistance=0;actorMotions.clear();near=null;particles.length=0;effects.length=0;lastMinimap=-Infinity;refreshHUD();updateCamera();save();if(reconnect&&running)connect();
  }
  $('btn-leave-room').addEventListener('click',()=>exitInterior());
  function canShop(){return interior?.room.kind==='shop'&&[...interior.objects.filter(o=>o.action==='shop'),...interior.residents.filter(n=>n.id==='bao')].some(o=>distance(o,state)<=85);}
  function showShop(message=''){
    if(!canShop()){toast('Ghé quầy Chợ Lá hoặc trò chuyện với Bảo trong cửa hàng.');return;}
    const cards=D.exploration.shop.map(entry=>{const item=D.items[entry.item],gear=D.exploration.equipment[entry.item],owned=entry.unique&&state.inventory[entry.item]>0;return `<article class="card"><span class="badge">${gear?gear.slot==='weapon'?'VŨ KHÍ':'TRANG PHỤC':'VẬT LIỆU & TIẾP TẾ'}</span><h3>${item.icon} ${esc(item.name)}</h3><p>${gear?gear.damage?`${gear.damage} sát thương`:`Giảm ${gear.armor} sát thương mỗi đòn · đổi màu áo`:'Mua để chế tạo và chuẩn bị; không tính là tự thu thập.'}</p><p class="materials">${entry.price} xu / món · Trong túi: ${state.inventory[entry.item]}</p><div class="shop-purchases">${(entry.unique?[1]:[1,5,10]).map(n=>`<button data-buy="${entry.item}" data-quantity="${n}" ${owned||state.coins<entry.price*n||state.inventory[entry.item]+n>C.capacity(state)?'disabled':''}>${owned?'Đã sở hữu':`Mua ${n} · ${entry.price*n} xu`}</button>`).join('')}</div></article>`;}).join('');
    openDialog('shop','Cửa hàng Chợ Lá',`${state.coins} XU · CHUẨN BỊ CHO CHUYẾN ĐI`,`<p class="dialog-intro">Trang bị độc bản có thể chọn trong Túi. Chợ nâng cấp giúp bạn bán vật liệu giá tốt hơn.</p><p class="good" role="status">${esc(message)}</p><button data-open-inventory>Mở Túi để trang bị</button><div class="cards">${cards}</div>`);
  }
  function interactInterior(o){
    if(!interior||distance(o,state)>85)return;
    if(o.action==='exit'){exitInterior();return;}
    if(o.action==='shop'){showShop();return;}
    if(o.action==='clue'){const result=Exploration.readClue(state,interior.id,D);if(result.ok){save();openDialog('cave-clue','Bia manh mối · '+interior.room.name,'ĐỌC THEO THỨ TỰ CÂU CHUYỆN',`<p class="dialogue-text">${esc(result.message)}</p><p>Ghi nhớ ba biểu tượng, rồi tới ấn ở phía đông để sắp xếp.</p><button data-close>Đã ghi nhớ</button>`);}return;}
    if(o.action==='puzzle'){showCavePuzzle();return;}
    if(o.action==='boss'){startCaveEncounter();return;}
    if(o.action==='loot'){reward(Exploration.claimLoot(state,interior.id,D));return;}
    if(o.action==='note')openDialog('room-note',interior.room.name,'GHI CHÉP TRONG NHÀ',`<p class="dialogue-text">${esc(interior.room.note)}</p><button data-close>Tiếp tục khám phá</button>`);
  }
  function showCavePuzzle(){
    if(!interior)return;
    if(!state.exploration.clues.includes(interior.id)){openDialog('cave-locked','Ấn chưa hồi đáp','ĐỌC BIA Ở PHÍA TÂY',`<p>Hãy đọc bia manh mối trong ${esc(interior.room.name)} trước khi xếp biểu tượng.</p><button data-close>Đi tìm bia</button>`);return;}
    if(state.exploration.solved.includes(interior.id)){toast('Ấn đã mở. Đi về phía bắc để gặp Hộ Vệ.');return;}
    openDialog('cave-puzzle','Ấn ba biểu tượng','XẾP TỪ TRÁI SANG PHẢI',`<section class="puzzle-panel"><p class="puzzle-hint">${esc(interior.room.clue)}</p><div class="puzzle-slots">${[0,1,2].map(i=>`<output id="cave-slot-${i}" aria-label="Ô ${i+1}"></output>`).join('')}</div><div class="puzzle-pool">${Object.entries(puzzleLabels).map(([symbol,name])=>`<button data-cave-symbol="${symbol}">${name}</button>`).join('')}</div><p id="cave-feedback" role="status" aria-live="polite"></p><div class="puzzle-tools"><button data-cave-check>Xác nhận</button><button data-cave-reset>Xếp lại</button><button data-close>Quay lại hang</button></div></section>`);
    refreshCavePuzzle();$('game-dialog').scrollTop=0;
  }
  // Giữ nguyên nút dưới ngón tay; chỉ cập nhật ba ô và phản hồi khi xếp trên mobile.
  function refreshCavePuzzle(message=''){
    const draft=state.exploration.puzzles[interior.id]||[];for(let i=0;i<3;i++)$('cave-slot-'+i).textContent=`${i+1} · ${puzzleLabels[draft[i]]||'Trống'}`;
    $('cave-feedback').textContent=message||`Đã xếp ${draft.length}/3. Chọn biểu tượng theo thứ tự trên bia.`;
  }
  function startCaveEncounter(){
    if(!interior||interior.room.kind!=='cave')return;
    if(!state.exploration.solved.includes(interior.id)){toast('Giải ấn trước khi đánh thức Hộ Vệ.');return;}
    if(state.exploration.cleared.includes(interior.id)){toast('Hang đã bình yên. Rương ở phía bắc giữ phần thưởng của bạn.');return;}
    if(encounter){toast('Trận đang diễn ra. Không thể gọi thêm Hộ Vệ.');return;}
    Combat.resetActions(combat);encounter={id:interior.id,cave:true,map:state.map,wave:0,pending:0};spawnEncounterWave();toast(interior.room.tactics);
  }
  function pickNearest() {
    const residents=currentResidents().filter(n=>distance(n,state)<78).sort((a,b)=>distance(a,state)-distance(b,state));
    // Biển thám hiểm ở sát chân phải chọn được dù cư dân đứng gần; tài nguyên vẫn nhường NPC.
    {
      const landmark=nearbyLandmarks()[0];
      if(landmark&&(!residents.length||distance(landmark,state)<distance(residents[0],state)))return landmark;
    }
    // A resident walking past a resource remains easy to talk to with E.
    if(residents.length)return {...residents[0],kind:'npc'};
    const candidates=[...currentArea().objects,...(pet&&pet.map===state.map?[{x:pet.x,y:pet.y,name:pet.name||'Cún Sao',kind:'pet'}]:[])];
    return candidates.filter(o=>(!['adventure','adventureRest'].includes(o.kind)||Adventure.unlocked(state))&&(o.kind!=='adventureRest'||state.adventure.proofs.includes('rescue'))&&distance(o,state)<(o.kind==='gate'?100:o.kind==='pet'?55:78)).sort((a,b)=>distance(a,state)-distance(b,state))[0]||null;
  }
  function waterPlot(plotIndex) {
    if(!running||gamePaused())return;
    const target=(typeof plotIndex==='number'&&plots[plotIndex])?plots[plotIndex]:(near&&near.kind==='plot'?near:null);
    if(!target){toast('Tới gần luống đất để tưới nước.');return;}
    const isWatered=Boolean(state.watered?.[target.i])||C.weather(state)==='rain';
    if(isWatered){toast('Luống đất đã có đủ nước.');return;}
    if(state.stamina<2){toast('Cần ít nhất 2 thể lực để tưới nước.');return;}
    state.stamina-=2;
    if(!state.watered)state.watered=[false,false,false,false];
    state.watered[target.i]=true;
    effect('ripple',target.x,target.y,'','#79b9c0');
    toast('Đã tưới nước cho luống đất. Đất ẩm giúp tăng thêm sản lượng khi thu hoạch!');
    refreshHUD();save();
  }
  function petThePet() {
    state.stamina=clamp(state.stamina+2,0,100);
    effect('text',pet.x,pet.y-20,'♥','#ff6b8b');
    burst(pet.x,pet.y-12,'#ff9ebb',`${pet.name||'Cún Sao'} vẫy đuôi mừng rỡ! +2 thể lực ♥`);
    pet.tailWag+=12;
    refreshHUD();
    save();
  }
  function petForageAssist(chosenItem) {
    const pool=['berry','berry','herb','herb','wood','star'];
    const itemId=chosenItem||pool[Math.floor(Math.random()*pool.length)];
    const gained=C.addItem(state,itemId,1,D);
    if(!gained){
      toast(`${pet.name||'Cún Sao'} tìm thấy ${D.items[itemId].name} nhưng túi bạn đã đầy.`);
      return;
    }
    C.event(state,'gather',itemId,1,D);
    effect('text',pet.x,pet.y-25,`+1 ${D.items[itemId].name}`,'#ffd700');
    burst(pet.x,pet.y-10,'#ffd700',`${pet.name||'Cún Sao'} vừa đánh hơi và tìm thấy 1 ${D.items[itemId].name} cho bạn! ✦`);
    refreshHUD();
    save();
  }
  function interact() {
    if(!running||gamePaused())return;
    if(fishing){finishFishing();return;}
    const landmarks=nearbyLandmarks(),residents=currentResidents().filter(n=>distance(n,state)<78);
    if(landmarks.length>1||landmarks.length&&residents.length){openDialog('landmarks','Bạn muốn khám phá đâu?','CÁC ĐỊA ĐIỂM Ở GẦN',`<p>Chọn đúng địa điểm; không cần đứng chính xác lên biểu tượng.</p><div class="landmark-choices">${landmarks.map(o=>`<button data-landmark="${o.proof||o.id}">${esc(o.name)}${state.adventure.proofs.includes(o.proof)?' · ✓':''}</button>`).join('')}${residents.map(n=>`<button data-talk-near="${n.id}">Trò chuyện với ${esc(n.name)}</button>`).join('')}</div>`);return;}
    near=pickNearest();if(!near){toast('Tới gần cư dân, tài nguyên hoặc biển chỉ dẫn rồi nhấn E.');return;}
    if(C.isNight(state)&&state.map==='village')C.event(state,'night','village',1,D);
    const o=near;
    if(o.kind==='door'){enterInterior(o);return;}
    if(o.kind==='indoor'){interactInterior(o);return;}
    if(o.kind==='adventure'){interactAdventure(o);return;}
    if(o.kind==='adventureRest'){
      restAtCamp();return;
    }
    if(o.kind==='npc'){talk(o);return;}
    if(o.kind==='pet'){petThePet();return;}
    if(o.kind==='gate'){
      if(encounter){toast('Hãy dùng nút Rút lui trong sổ phiêu lưu để rời giao tranh.');return;}
      if(!C.visit(state,o.to,D)){toast(o.to==='coast'?'Xây Cầu Gió Biển để mở đường đến vịnh.':'Xây Kho Chuyện Mây để tìm đường tới tàn tích.');return;}
      resetEncounter();state.x=800;state.y=o.to==='village'?170:910;near=null;clearMovement();playerDirection='down';walkDistance=0;actorMotions.delete('player');particles.length=0;effects.length=0;effect('ring',state.x,state.y,'','#c9ead2');
      if(pet){pet.map=state.map;pet.x=state.x-24;pet.y=state.y+12;pet.moving=false;}
      refreshHUD();save();toast(`Đã tới ${D.regions.find(r=>r.id===o.to).name}`);return;
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
      clearMovement();fishing={elapsed:0,rippleTimer:0,position:0,tension:0,spot:o};effect('ripple',o.x+30,o.y,'','#bfe6dc');$('fish-marker').style.left='0%';const bar=$('fish-tension-bar');if(bar)bar.style.width='0%';$('fishing').hidden=false;return;
    }
    if(o.kind==='stele'){
      if(state.puzzles&&state.puzzles.includes('ruins-steles')){
        toast('Trận đồ bia sao cổ đang tỏa sáng rực rỡ.');
        return;
      }
      if(o.seq==='west'){
        if(!steleSequence.includes('west')){
          steleSequence=['west'];
          effect('ring',o.x,o.y,'','#fff0a1');
          effect('text',o.x,o.y-45,'+ Bia sao ngân vang (1/3)','#fff0a1');
          toast('Bia Sao Tây Đài đã ngân vang (1/3)...');
        }else{
          toast('Bia Sao Tây Đài đang ngân vang (1/3).');
        }
      }else if(o.seq==='north'){
        if(steleSequence.length===1&&steleSequence[0]==='west'){
          steleSequence.push('north');
          effect('ring',o.x,o.y,'','#fff0a1');
          effect('text',o.x,o.y-45,'+ Bia sao ngân vang (2/3)','#fff0a1');
          toast('Bia Sao Bắc Điện đã ngân vang (2/3)...');
        }else if(steleSequence.includes('north')){
          toast('Bia Sao Bắc Điện đang ngân vang (2/3).');
        }else{
          steleSequence=[];
          effect('dust',o.x,o.y,'','#daceb0');
          toast('Tiếng ngân tắt lịm... Thứ tự chưa đúng, hãy thử lại từ Bia Tây!');
        }
      }else if(o.seq==='east'){
        if(steleSequence.length===2&&steleSequence[0]==='west'&&steleSequence[1]==='north'){
          steleSequence.push('east');
          if(!state.puzzles)state.puzzles=[];
          if(!state.puzzles.includes('ruins-steles'))state.puzzles.push('ruins-steles');
          burst(o.x,o.y-30,'#fff0a1','Trận đồ bia sao cộng hưởng trọn vẹn (3/3)! Rương Cổ Bí Mật đã mở phong ấn!');
          effect('ring',o.x,o.y,'','#fff0a1');
          effect('text',o.x,o.y-45,'+ Bia sao ngân vang (3/3)','#fff0a1');
          toast('Trận đồ bia sao đã kích hoạt! Rương Cổ Bí Mật đã mở phong ấn!');
          save();
        }else{
          steleSequence=[];
          effect('dust',o.x,o.y,'','#daceb0');
          toast('Tiếng ngân tắt lịm... Thứ tự chưa đúng, hãy thử lại từ Bia Tây!');
        }
      }
      refreshHUD();
      return;
    }
    if(o.kind==='plot'){
      const planted=state.crops[o.i],wait=state.upgrades.includes('greenhouse')?8000:16000;
      if(planted===null){
        if(state.stamina<3){toast('Bạn cần nghỉ trước khi gieo trồng.');return;}
        const seed=state.selectedSeed||'berry';
        state.crops[o.i]=Date.now();
        if(!state.cropTypes)state.cropTypes=['berry','berry','berry','berry'];
        state.cropTypes[o.i]=seed;
        if(!state.watered)state.watered=[false,false,false,false];
        state.watered[o.i]=C.weather(state)==='rain';
        state.stamina-=3;
        C.event(state,'plant',seed,1,D);
        effect('sprout',o.x,o.y,'','#b9dd83');
        const seedName=seed==='berry'?'mâm xôi':D.items[seed].name.toLowerCase();
        toast(`Đã gieo ${seedName}. Cây chín sau 16 giây; nhà kính rút còn 8 giây.`);
      }
      else if(Date.now()-planted>=wait){
        const cropId=state.cropTypes?.[o.i]||'berry';
        const isWatered=Boolean(state.watered?.[o.i])||C.weather(state)==='rain';
        const harvestCount=isWatered?5:4;
        const cropName=cropId==='berry'?'mâm xôi':D.items[cropId].name.toLowerCase();
        const gained=C.addItem(state,cropId,harvestCount,D);
        if(!gained){toast(`Túi ${cropName} đã đầy.`);return;}
        state.crops[o.i]=null;
        if(state.watered)state.watered[o.i]=false;
        C.event(state,'harvest',cropId,1,D);
        C.event(state,'gather',cropId,gained,D);
        state.xp+=8;
        const burstColor=cropId==='berry'?'#efa29c':cropId==='carrot'?'#f7a868':'#f3d677';
        burst(o.x,o.y,burstColor,`Thu hoạch +${gained} ${cropName}!${isWatered?' (Đất ẩm +1)':''}`);
        effect('text',o.x,o.y-30,`+${gained} ${cropName}`,'#ffe4c5');
      }
      else toast(`Cây đang lớn. Còn ${Math.ceil((wait-Date.now()+planted)/1000)} giây.${Boolean(state.watered?.[o.i])||C.weather(state)==='rain'?' (Đất ẩm)':' (Nhấn R tưới nước)'}`);
    }
    if(o.kind==='shrine'){
      if(!state.shrines.includes(state.map)){if(state.inventory.star+2>C.capacity(state)){toast('Cần chỗ cho 2 mảnh sao trong túi trước khi đánh thức bia.');return;}state.shrines.push(state.map);state.xp+=35;C.event(state,'shrine',state.map,1,D);C.addItem(state,'star',2,D);burst(o.x,o.y-50,'#bceef0','Bia ký ức thức giấc. +2 mảnh sao, +35 XP!');}
      else toast('Bia đã thức giấc. Những vì sao là các hạt giống ánh sáng, hãy gom chúng để thắp Đèn Dẫn Sao.');
    }
    if(o.kind==='chest'){
      if(state.chests.includes(o.id)){toast('Chiếc rương này đã được khám phá.');return;}
      if(o.id==='chest-ruins-secret'){
        const solved=Boolean(state.puzzles&&state.puzzles.includes('ruins-steles'));
        if(!solved){toast('Rương Cổ Bí Mật đang bị phong ấn bởi trận đồ bia sao.');return;}
        if(state.inventory.crystal+3>C.capacity(state)||state.inventory.star+3>C.capacity(state)){toast('Cần chỗ cho 3 tinh thể trời và 3 mảnh sao trong túi trước khi mở rương.');return;}
        state.chests.push(o.id);
        state.coins+=120;
        state.xp+=50;
        C.addItem(state,'crystal',3,D);
        C.addItem(state,'star',3,D);
        C.event(state,'chest','treasure',1,D);
        burst(o.x,o.y-20,'#fbd77f','Rương Cổ Bí Mật: +120 xu, +3 tinh thể trời, +3 mảnh sao, +50 XP!');
        effect('text',o.x,o.y-45,'+120 xu · +3 tinh thể · +3 sao','#ffd700');
        refreshHUD();save();
        return;
      }
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
    const success=(fishing.position>=.38&&fishing.position<=.62)||(fishing.tension>=1.0);
    state.stamina=Math.max(0,state.stamina-6);
    if(success){const gain=C.addItem(state,'fish',1,D);if(gain){C.event(state,'fish','fish',1,D);C.event(state,'gather','fish',1,D);state.xp+=12;burst(fishing.spot.x,fishing.spot.y,'#d6f1ea','Câu được một cá vịnh! +12 XP');effect('text',fishing.spot.x,fishing.spot.y-35,'+1 cá vịnh','#d6f1ea');}else toast('Túi cá đã đầy.');}
    else toast('Cá thoát rồi! Bấm E khi phao nằm trong vùng vàng.');
    fishing=null;$('fishing').hidden=true;clearMovement();refreshHUD();save();
  }
  function attack() {
    if(!running||gamePaused()||fishing)return;
    if(!Combat.requestAttack(combat,state,playerDirection)){if(state.stamina<2)toast('Cần thêm thể lực để vung kiếm.');return;}
    swing=.25;swingDirection=playerDirection;
    effect('slash',state.x,state.y-24,'','#fff4bc');
    refreshHUD();
  }
  // Né theo hướng đang nhìn; mô phỏng xử lý từng đoạn ngắn để không xuyên vật cản.
  function dodge(){if(!running||gamePaused()||fishing)return;if(Combat.requestDodge(combat,state,playerDirection)){effect('ring',state.x,state.y,'','#c2e4e4');refreshHUD();}else if(state.stamina<10)toast('Cần 10 thể lực để né.');}
  // Xóa riêng trận chưa thắng khi đổi save/vùng hoặc rút lui; chứng cứ đã thắng nằm trong save.
  function resetEncounter(){for(const area of [...Object.values(world),...(interior?[interior]:[])]){area.mobs=area.mobs.filter(m=>!m.encounter);for(const mob of area.mobs){mob.combat=null;mob.hitTime=0;}}encounter=null;Combat.resetActions(combat);}
  // Mỗi cuộc chạm trán có ID cố định để không nhân quái hoặc thưởng khi bấm tương tác nhiều lần.
  function startEncounter(id){
    if(encounter){toast('Cuộc giao tranh đang diễn ra. Đọc vùng báo đòn rồi phản công.');return;}
    Combat.resetActions(combat);encounter={id,map:state.map,wave:0,pending:0};spawnEncounterWave();
    toast(id==='rootBoss'?'Hộ Vệ thức giấc! Né vùng vàng, đánh khi lõi lộ sáng.':'Vùng vàng báo trước đòn đánh. V / Né để tránh, Space / Kiếm để phản công.');
  }
  // Đợt mới sinh sau khoảng nghỉ, không sửa danh sách địch ngay trong callback xử lý hit.
  function spawnEncounterWave(){
    const {id,wave,cave}=encounter,point=cave?{x:800,y:500}:D.adventure.objects.find(o=>o.id===id),waves=cave?interior.room.waves:D.adventure.encounters[id];
    waves[wave].forEach((kind,i)=>{const x=point.x+(i-(waves[wave].length-1)/2)*40,y=point.y-30;currentArea().mobs.push({id:`encounter-${id}-${wave}-${i}`,encounter:id,kind,x,y,homeX:x,homeY:y,hp:CombatData.enemies[kind].maxHp,deadUntil:0,phase:i});});
    toast(`Đợt ${wave+1}/${waves.length} · ${point.name}`);refreshHUD();
  }
  const puzzleLabels={leaf:'❧ Lá',star:'✦ Sao',moon:'☾ Trăng'};
  function showRootPuzzle(id){
    const relic=id==='relic',hint=relic?'Trăng soi lá, lá hứng sao. Trăng ở đầu, sao ở cuối.':'Mỗi phiến xoay Lá → Sao → Trăng. Ghép theo hai bia khắc ở phía bắc.';
    openDialog('root-puzzle',relic?'Hộp di vật ba ánh sao':'Mạch ánh sáng','ĐỌC DẤU VẾT · XẾP · XÁC NHẬN',`<section class="puzzle-panel"><p class="puzzle-hint">${hint}</p><div class="puzzle-slots" aria-label="Ba vị trí từ trái sang phải">${[0,1,2].map(i=>relic?`<output id="puzzle-slot-${i}" aria-label="Ô ${i+1}"></output>`:`<button id="puzzle-slot-${i}" data-puzzle="${id}" data-symbol="${i}"></button>`).join('')}</div>${relic?`<div class="puzzle-pool">${Object.entries(puzzleLabels).map(([symbol,label])=>`<button id="puzzle-pick-${symbol}" data-puzzle="${id}" data-symbol="${symbol}">${label}</button>`).join('')}</div>`:''}<p id="puzzle-feedback" role="status" aria-live="polite"></p><div class="puzzle-tools"><button data-puzzle-check="${id}">Xác nhận</button><button data-puzzle="${id}" data-symbol="reset">Xếp lại</button><button data-close>Quay lại rừng</button></div><details><summary>Sổ manh mối</summary><p>${relic?'Đọc từ trái sang phải. Mỗi biểu tượng chỉ dùng một lần.':`${state.adventure.milestones.includes('light-1')?'Lá đứng trước sao, không cạnh trăng.':'Chưa đọc bia phía tây bắc (650, 280).'}<br>${state.adventure.milestones.includes('light-2')?'Trăng đứng cuối bên phải.':'Chưa đọc bia phía đông bắc (950, 300).'}`}</p></details></section>`);
    refreshPuzzle(id);
    $('game-dialog').scrollTop=0;
  }
  // Chỉ đổi nhãn/trạng thái; giữ nguyên nút đang chạm và focus trên màn hình cảm ứng.
  function refreshPuzzle(id,message=''){
    const draft=state.adventure.puzzles[id];for(let i=0;i<3;i++){$('puzzle-slot-'+i).textContent=`${i+1} · ${puzzleLabels[draft[i]]||'Trống'}`;if(id==='root-light')$('puzzle-slot-'+i).setAttribute('aria-label',`Xoay phiến ${i+1}: ${puzzleLabels[draft[i]]}`);}
    if(id==='relic')for(const symbol of Object.keys(puzzleLabels)){$('puzzle-pick-'+symbol).disabled=draft.includes(symbol);$('puzzle-pick-'+symbol).setAttribute('aria-pressed',String(draft.includes(symbol)));}
    $('puzzle-feedback').textContent=message||(id==='relic'?`Đã xếp ${draft.length}/3 ô. Chạm Xác nhận khi sẵn sàng.`:'Chạm từng phiến để xoay, rồi Xác nhận.');
  }
  function restAtCamp(){
    if(encounter){toast('Kết thúc giao tranh hoặc rút lui trước khi nghỉ.');return;}
    clearMovement();state.health=100;state.stamina=100;Adventure.refill(state);save();refreshHUD();
    openDialog('rest','Trạm nghỉ đường mòn','ĐIỂM HỒI SINH AN TOÀN',`<p>Đã hồi đầy sức. Tiếp tế: ${state.adventure.supplies} phần. Lối tắt giúp bạn quay lại đấu trường.</p><button data-travel="village">Về bàn tiếp tế ở làng</button><button data-close>Tiếp tục khám phá</button>`);
  }
  // Nối địa điểm với giao tranh/câu đố/tiếp tế sau khi core đã kiểm khoảng cách và tiền đề.
  function interactAdventure(o){
    if(o.proof==='shortcut'&&state.adventure.proofs.includes('shortcut')){if(encounter){toast('Kết thúc giao tranh trước khi dùng đường tắt.');return;}clearMovement();state.x=800;state.y=440;updateCamera();toast('Bạn đi theo lối tắt tới trạm nghỉ.');return;}
    if(o.proof==='prepared'&&state.adventure.proofs.includes('prepared')){openDialog('supply','Bàn tiếp tế','CĂN CỨ THÁM HIỂM','<p>Đổi bộ tiếp tế trước chuyến đi mới. Mỗi lựa chọn bổ sung đủ số phần.</p><div class="landmark-choices"><button data-prepare="healer">Bộ Y tế · 2 phần</button><button data-prepare="runner">Bộ Bền sức · 1 phần</button><button data-travel="forest">Đi nhanh tới trạm nghỉ</button><button data-open-build>Xây và nâng cấp xưởng</button></div>');return;}
    const result=Adventure.interact(state,o.proof,D);if(!result.ok){openDialog('landmark-locked',o.name,'ĐIỀU KIỆN KHÁM PHÁ',`<p>${esc(result.message)}</p><button data-tab="adventure">Xem nhiệm vụ phiêu lưu</button><button data-close>Quay lại rừng</button>`);return;}
    if(result.mode==='encounter'||result.mode==='boss'){startEncounter(o.proof);return;}
    if(result.mode==='rescue'){openDialog('rescue','Người giữ đường mắc kẹt','CHỌN CÁCH GIẢI CỨU','<p>Những rễ cây bị tha hóa chặn đường chính. Dấu dây buộc bên vách chỉ một lối vòng.</p><button data-rescue-route="fight">Đánh qua đám rễ</button><button data-rescue-route="path">Theo dây buộc mở lối vòng</button>');return;}
    if(result.mode==='puzzle'){showRootPuzzle(o.proof);return;}
    if(result.mode==='prepare'){openDialog('supply','Chuẩn bị cho Hộ Vệ','CHỌN BỘ TIẾP TẾ','<p>Bộ Y tế: 2 phần, mỗi phần hồi 45 máu và 25 thể lực. Bộ Bền sức: 1 phần, hồi 25 máu và đầy thể lực. Bổ sung miễn phí tại trạm nghỉ; không thể nghỉ giữa trận.</p><div class="landmark-choices"><button data-prepare="healer">Mang bộ Y tế · 2 phần</button><button data-prepare="runner">Mang bộ Bền sức · 1 phần</button></div>');return;}
    reward(result);
  }
  // Core chiến đấu quyết định hit; client chỉ phát phản hồi, ghi chứng cứ và nhận thưởng thường.
  function updateCombat(dt){
    const map=state.map,area=currentArea(),oldX=state.x,oldY=state.y;
    for(const mob of area.mobs){mob.hitTime=Math.max(0,(mob.hitTime||0)-dt);if(mob.hp<=0&&mob.deadUntil<=Date.now()){mob.hp=CombatData.enemies[mob.kind||'slime'].maxHp;mob.combat=null;}}
    Combat.advance(combat,dt,{actor:state,mobs:area.mobs,regen:map!=='village',damage:Adventure.damage(state,D),armor:Exploration.armor(state,D),isBlocked:(x,y)=>blockedAt(map,x,y),
      onHit:(mob,damage)=>{mob.hitTime=.2;burst(mob.x,mob.y-20,'#fff0a7');effect('text',mob.x,mob.y-50,`−${damage}`,'#ffe7a9');},
      onDefeat:mob=>{
        mob.deadUntil=mob.encounter?Infinity:Date.now()+35000;
        if(!CombatData.enemies[mob.kind||'slime'].boss){if(!mob.kind||mob.kind==='slime')C.event(state,'fight','slime',1,D);state.coins+=18;state.xp+=18;C.addItem(state,map==='ruins'?'crystal':'ore',1,D);effect('text',mob.x,mob.y-65,'+18 xu','#f7e4a3');}
        if(encounter&&!encounter.pending&&area.mobs.filter(m=>m.encounter===encounter.id).every(m=>m.hp<=0)){
          const waves=encounter.cave?interior.room.waves:D.adventure.encounters[encounter.id];
          if(encounter.wave+1<waves.length){encounter.pending=2;toast('Đợt đã qua. Đợt tiếp theo đến sau 2 giây — chọn lại vị trí!');}
          else if(encounter.cave){const result=Exploration.markVictory(state,encounter.id,D);encounter=null;Combat.resetActions(combat);toast(result.message);}
          else{const id=encounter.id;C.recordProof(state,id,D);encounter=null;toast(id==='rootBoss'?'Lõi rừng đã bình yên! Nhận thưởng để mở Kiếm Rễ Sao và khôi phục xưởng.':'Đã vượt tất cả các đợt. Địa điểm được thanh tẩy.');}
        }
        save();refreshHUD();
      },onBlocked:mob=>{effect('text',mob.x,mob.y-50,'Giáp rễ · chờ lõi lộ','#a6d3c5');},onHurt:()=>{hurtCooldown=1.2;burst(state.x,state.y-30,'#ed9c8c');}});
    if(encounter?.pending){encounter.pending=Math.max(0,encounter.pending-dt);if(!encounter.pending){encounter.wave++;spawnEncounterWave();}}
    // Bước né là chuyển động độc lập; chỉ cộng quãng đường thực, không cộng thêm tốc độ đi/chạy.
    const dodged=Math.hypot(state.x-oldX,state.y-oldY);if(dodged>.01&&state.map===map){walkDistance+=dodged;state.moving=true;playerRunning=false;}
    if(map==='village'){regenTimer+=dt;if(regenTimer>2){state.stamina=clamp(state.stamina+(state.upgrades.includes('well')?3:1),0,100);regenTimer=0;}}
    if(state.health<=0){
      resetEncounter();interior=null;returnPoint=null;state.coins=Math.max(0,state.coins-30);state.health=100;state.stamina=70;state.map=state.adventure.checkpoint==='forest-rest'?'forest':'village';state.x=800;state.y=state.map==='forest'?440:720;clearMovement();playerDirection='down';walkDistance=0;toast('Bạn được đưa về điểm nghỉ. Mất 30 xu; tiến trình và chiến thắng đã giữ nguyên.');save();refreshHUD();if(!socket)connect();
    }
  }
  function blockedAt(map,x,y) {
    if(interior&&map===state.map)return InteriorScene.blocked(interior,x,y,state.exploration.solved.includes(interior.id));
    if(x<25||y<40||x>1575||y>1075)return true;
    // The pond's raised banks and building foundations have physical footprints.
    if(x>1110&&x<1490&&y>625&&y<905)return true;
    if((map==='village'?buildings:world[map].buildings).some(b=>x>b.x-b.w/2-8&&x<b.x+b.w/2+8&&y>b.y-62&&y<b.y+9))return true;
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
    const paused=gamePaused();
    if(!paused){animation+=dt;attackCooldown=Math.max(0,attackCooldown-dt);swing=Math.max(0,swing-dt);hurtCooldown=Math.max(0,hurtCooldown-dt);}
    if(!paused){
      if(fishing){
        fishing.elapsed+=dt;
        fishing.rippleTimer+=dt;
        if(fishing.rippleTimer>=.85){effect('ripple',fishing.spot.x+30,fishing.spot.y,'','#bfe6dc');fishing.rippleTimer=0;}
        fishing.position=(Math.sin(fishing.elapsed*3.8-Math.PI/2)+1)/2;
        const inZone=fishing.position>=.38&&fishing.position<=.62;
        const holdingPull=keys.has('e')||keys.has('enter')||touchKeys.has('interact');
        if(inZone){
          const rate=holdingPull?2.3:2.0;
          fishing.tension=Math.min(1.0,(fishing.tension||0)+dt*rate);
        }else{
          fishing.tension=Math.max(0,(fishing.tension||0)-dt*0.02);
        }
        $('fish-marker').style.left=`${fishing.position*98}%`;
        const bar=$('fish-tension-bar');
        if(bar)bar.style.width=`${Math.round((fishing.tension||0)*100)}%`;
        if(fishing.tension>=1.0){finishFishing();return;}
      }
      else{
        const oldX=state.x,oldY=state.y;
        let dx=(keys.has('d')||keys.has('arrowright')||touchKeys.has('right')?1:0)-(keys.has('a')||keys.has('arrowleft')||touchKeys.has('left')?1:0),dy=(keys.has('s')||keys.has('arrowdown')||touchKeys.has('down')?1:0)-(keys.has('w')||keys.has('arrowup')||touchKeys.has('up')?1:0);
        if(!dx&&!dy){dx=joystickX;dy=joystickY;}
        if((dx||dy)&&!combat.dodge){playerDirection=directionFor(dx,dy);if(dx)facing=dx>0?1:-1;const len=Math.hypot(dx,dy),travel=moveSpeed()*Math.min(dt,.25);movePlayer(dx/len*travel,dy/len*travel);}
        const travelled=Math.hypot(state.x-oldX,state.y-oldY);
        state.moving=travelled>.01;playerRunning=state.moving&&wantsRun();walkDistance+=travelled;
        if(state.moving){stepTimer+=dt;if(stepTimer>=(playerRunning?.11:.18)){effect('dust',state.x,state.y+2,'',C.weather(state)==='rain'?'#c0dad1':state.map==='coast'?'#ebd5a8':'#daceb0');stepTimer=0;}}
        else stepTimer=0;
      }
      if(!fishing){if(!interior)NPC.updateNPCs(npcs,dt,{map:state.map,player:state,isBlocked:blockedAt});}
      else {state.moving=false;playerRunning=false;npcs.forEach(n=>{n.moving=false;});}
      if(pet&&!fishing){
        if(pet.map!==state.map){
          pet.map=state.map;pet.x=state.x-24;pet.y=state.y+12;pet.moving=false;
        }
        const pDist=distance(pet,state);
        if(pDist>260){
          pet.x=state.x-24;pet.y=state.y+12;pet.moving=false;
        }else if(pDist>45){
          pet.moving=true;
          pet.running=playerRunning;
          const speed=(playerRunning?305:190)*(pDist>130?1.35:1.05);
          const travel=Math.min(pDist-38,speed*Math.min(dt,0.25));
          const steps=Math.ceil(travel/4);
          if(steps>0){
            const dx=state.x-pet.x,dy=state.y-pet.y;
            const stepX=(dx/pDist)*(travel/steps),stepY=(dy/pDist)*(travel/steps);
            let movedDist=0;
            for(let i=0;i<steps;i++){
              let mx=false,my=false;
              if(!blockedAt(state.map,pet.x+stepX,pet.y)){pet.x+=stepX;mx=true;}
              if(!blockedAt(state.map,pet.x,pet.y+stepY)){pet.y+=stepY;my=true;}
              if(mx||my)movedDist+=Math.hypot(mx?stepX:0,my?stepY:0);
              else break;
            }
            pet.gait+=movedDist;
            if(Math.abs(dx)>Math.abs(dy))pet.dir=dx>0?'right':'left';
            else if(Math.abs(dy)>0.1)pet.dir=dy>0?'down':'up';
          }
        }else if(pDist<=40){
          pet.moving=false;
        }
        pet.tailWag+=dt*(pet.moving?14:5);
        if(pet.loveCooldown>0)pet.loveCooldown=Math.max(0,pet.loveCooldown-dt);
        if(state.moving){
          pet.forageTimer-=dt;
          if(pet.forageTimer<=0){
            petForageAssist();
            pet.forageTimer=65+Math.random()*35;
          }
        }
      }
      state.minutes+=dt*4;
      if(state.minutes>=1440){C.nextDay(state,D);state.minutes=0;toast('Sang ngày mới. Sổ hợp đồng vừa được cập nhật.');save();}
      if(!fishing)updateCombat(dt);
    }else {state.moving=false;playerRunning=false;npcs.forEach(n=>{n.moving=false;});}
    updateActorMotions(dt,paused||!!fishing);
    syncRunControl();
    updateCamera();
    near=paused||fishing?null:pickNearest();
    const descriptions={door:'Vào',indoor:'Tương tác',adventure:'Khám phá',adventureRest:'Nghỉ / đi nhanh',npc:'Trò chuyện',pet:'Vuốt ve',stele:'Kích hoạt',resource:'Thu thập',gate:'Đi tới',plot:state.crops[near?.i]===null?`Gieo ${state.selectedSeed==='berry'?'mâm xôi':D.items[state.selectedSeed||'berry']?.name||'hạt'} (1-3 đổi hạt)`:Date.now()-state.crops[near?.i]>=(state.upgrades.includes('greenhouse')?8000:16000)?`Thu hoạch ${D.items[state.cropTypes?.[near?.i]||'berry']?.name}`:`Kiểm tra${Boolean(state.watered?.[near?.i])||C.weather(state)==='rain'?' (Đất ẩm)':' (R để tưới)'}`,fish:'Thả câu',camp:'Nghỉ / chờ tối',bench:'Hồi sức',well:'Hồi sức',shrine:'Đánh thức',chest:'Khám phá'};
    $('interaction-hint').textContent=near?`E · ${descriptions[near.kind]} ${near.name||''}`:'';
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];if(p.map!==state.map){particles.splice(i,1);continue;}if(!paused){p.age+=dt;p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;}if(p.life<=0)particles.splice(i,1);}
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];if(e.map!==state.map){effects.splice(i,1);continue;}if(!paused)e.age+=dt;if(e.age>=e.life)effects.splice(i,1);}
    if(!interior&&C.weather(state)==='rain'){
      E.updateSplashPool(splashSystem,dt,{reducedMotion});
      if(!reducedMotion&&!paused){
        splashTimer+=dt;
        if(splashTimer>=.04){
          splashTimer=0;
          const sx=camera.x+Math.random()*viewWidth,sy=camera.y+Math.random()*viewHeight;
          if(!E.isWater(sx,sy,5))E.spawnSplash(splashSystem,sx,sy,state.map);
        }
      }
    }
    if(performance.now()>toastUntil)$('toast').classList.remove('visible');
    hudTimer+=dt;if(hudTimer>.45){refreshHUD();hudTimer=0;}
    moveTimer+=dt;if(moveTimer>.1){if(socket?.readyState===1&&onlineId)socket.send(JSON.stringify({type:'move',map:state.map,x:state.x,y:state.y,facingRight:facing>0,direction:playerDirection,moving:state.moving,running:playerRunning}));moveTimer=0;}
    if(performance.now()-lastSaved>5000)save();
  }
  function pixelEllipse(c,x,y,w,h,color) {rect(c,x-w/2+4,y-h/2,w-8,h,color);rect(c,x-w/2,y-h/2+3,w,h-6,color);}
  function drawDropShadow(c, x, y, w, h, options = {}) {
    const darkCore = options.darkCore ?? 0.40;
    const penumbra = options.penumbra ?? 0.20;
    const tint = options.tint || '22, 42, 35';
    const cPenumbra = `rgba(${tint}, ${penumbra})`;
    const cDarkCore = `rgba(${tint}, ${darkCore})`;

    rect(c, x - w / 2 + 3, y - h / 2, w - 6, h, cPenumbra);
    rect(c, x - w / 2 + 1, y - h / 2 + 2, w - 2, h - 4, cPenumbra);
    rect(c, x - w / 2, y - h / 2 + 4, w, h - 8, cPenumbra);

    const cw = Math.round(w * 0.65), ch = Math.round(h * 0.6);
    const cx = x - Math.round(w * 0.04), cy = y - Math.round(h * 0.05);
    rect(c, cx - cw / 2 + 2, cy - ch / 2, cw - 4, ch, cDarkCore);
    rect(c, cx - cw / 2, cy - ch / 2 + 1, cw, ch - 2, cDarkCore);

    if (options.grounding) {
      const cGround = `rgba(${tint}, ${Math.min(0.65, darkCore + 0.18)})`;
      rect(c, x - options.grounding.w / 2, y + options.grounding.yOffset, options.grounding.w, options.grounding.h, cGround);
    }
  }
  function tree(c,x,y,size=1,tone=0) {
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(size,size);
    drawDropShadow(c, 7, 1, 66, 17, { darkCore: 0.40, penumbra: 0.22, tint: '24, 46, 36' });
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
    const {x,y,w,h,roof,kind}=b,left=x-w/2,top=y-h;
    drawDropShadow(c, x + 12, y + 8, w + 40, 26, { darkCore: 0.45, penumbra: 0.22, tint: '20, 36, 30', grounding: { w: w + 16, yOffset: -3, h: 4 } });

    // 1. Foundation & Plinth
    rect(c, left - 7, y - 10, w + 24, 18, '#555948');
    rect(c, left - 7, y - 8, w + 24, 5, '#787d65');
    for (let i = 0; i < 4; i++) rect(c, left + 10 + i * 35, y - 6, 2, 8, '#3c4033');

    // 2. Base Wall & Studs
    const isHut = kind === 'hut';
    const wallBaseColor = isHut && b.name.includes('Sen') ? '#6e4c34' : isHut && (b.name.includes('Thủy Triều') || b.name.includes('Kiệt')) ? '#7d9b9a' : isHut && (b.name.includes('Thám Hiểm') || b.name.includes('Ly')) ? '#8b7a94' : '#f5ecd5';
    const wallShadeColor = isHut && b.name.includes('Sen') ? '#4f3422' : isHut && (b.name.includes('Thủy Triều') || b.name.includes('Kiệt')) ? '#5e7c7b' : isHut && (b.name.includes('Thám Hiểm') || b.name.includes('Ly')) ? '#6f6078' : '#ded0b4';
    rect(c, left, top + 43, w, h - 43, wallBaseColor);
    rect(c, left + w - 24, top + 43, 24, h - 43, wallShadeColor);
    for (let i = 0; i < 4; i++) rect(c, left, top + 58 + i * 15, w, 2, isHut ? '#4a3325' : '#c7b68e');
    rect(c, left + 3, y - 6, w - 6, 6, '#4a3325');
    rect(c, left + w - 20, top + 56, 4, h - 64, '#38251a');
    rect(c, left, top + 43, 6, h - 43, '#4a3325');
    rect(c, left + w - 6, top + 43, 6, h - 43, '#38251a');
    rect(c, left, top + 56, w, 4, '#4a3325');

    // 3. Stepped Roof Silhouette
    for (let i = 0; i < 7; i++) {
      const inset = (6 - i) * 8;
      rect(c, left - 15 + inset, top + i * 7, w + 30 - inset * 2, 8, roof);
    }
    rect(c, left - 15, top + 45, w + 30, 8, '#694f53');
    rect(c, left - 12, top + 43, w + 24, 5, roof);

    // Specialized Roof Textures & Details per Building
    if (kind === 'home') {
      for (let row = 0; row < 6; row++) {
        const inset = (6 - row) * 8;
        for (let j = left - 10 + inset; j < left + w + 10 - inset; j += 14) {
          rect(c, j, top + row * 7 + 4, 12, 3, '#c97b69');
          rect(c, j + 2, top + row * 7 + 6, 8, 2, '#7e4438');
        }
      }
      rect(c, left + Math.round(w / 2) - 18, top + 34, 4, 16, '#4a3325');
      rect(c, left + Math.round(w / 2) + 14, top + 34, 4, 16, '#4a3325');
      rect(c, x - 2, top - 12, 4, 8, '#e8c850');
      rect(c, x - 6, top - 10, 12, 2, '#e8c850');
      rect(c, left - 16, top + 64, 14, 18, '#8a6842');
      rect(c, left - 14, top + 66, 10, 14, '#ebd8b0');
      label(c, '🗺', left - 9, top + 78, 9, '#5c4530');
    } else if (kind === 'workshop') {
      for (let row = 0; row < 6; row++) {
        const inset = (6 - row) * 8;
        rect(c, left - 14 + inset, top + row * 7 + 5, w + 28 - inset * 2, 2, '#486673');
        for (let j = left - 8 + inset; j < left + w + 8 - inset; j += 18) {
          rect(c, j, top + row * 7 + 1, 2, 6, '#82a8b8');
        }
      }
      rect(c, x - 3, top + 26, 6, 26, '#38251a');
      for (let i = 0; i < 4; i++) {
        rect(c, left + w + 2 + i * 3, y - 24 + i * 2, 6, 22, '#b88b55');
        rect(c, left + w + 3 + i * 3, y - 23 + i * 2, 4, 3, '#d6ac76');
      }
      rect(c, x - 12, top + 48, 24, 10, '#5a4228');
      label(c, '🪚', x, top + 56, 8, '#ded5b8');
    } else if (kind === 'archive') {
      c.fillStyle = '#ffffff24';
      for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) {
        const tx = left - 5 + col * 20 + (row % 2) * 10;
        if (tx > left + (6 - row) * 7 && tx < left + w - (6 - row) * 7) c.fillRect(tx, top + row * 7 + 4, 14, 2);
      }
      rect(c, left + 15, top - 6, w - 30, 3, '#423d45');
      for (let i = left + 20; i < left + w - 20; i += 12) rect(c, i, top - 10, 3, 5, '#5c5460');
      rect(c, x - 14, top - 22, 28, 22, '#534563');
      rect(c, x - 8, top - 18, 16, 16, '#fff9e6');
      rect(c, x - 1, top - 15, 2, 6, '#333');
      rect(c, x - 1, top - 11, 4, 2, '#333');
      rect(c, left - 16, top + 64, 15, 20, '#534563');
      label(c, '📖', left - 9, top + 79, 10, '#fffae8');
    } else if (kind === 'kitchen') {
      for (let row = 0; row < 6; row++) {
        const inset = (6 - row) * 8;
        for (let j = left - 10 + inset; j < left + w + 10 - inset; j += 10) {
          rect(c, j, top + row * 7, 6, 7, '#e09d6d');
          rect(c, j + 5, top + row * 7, 2, 7, '#935836');
        }
      }
      for (let i = 0; i < 3; i++) {
        rect(c, left + 20 + i * 14, top + 47, 4, 11, '#ffffff');
        rect(c, left + 26 + i * 14, top + 47, 3, 13, '#d03030');
      }
      rect(c, x - 11, top + 48, 22, 10, '#5c3a28');
      label(c, '🍲', x, top + 56, 8, '#fff');
    } else if (kind === 'greenhouse') {
      rect(c, left + 4, top + 10, w - 8, 38, '#92cec288');
      for (let i = 0; i < 6; i++) rect(c, left + 10 + i * 20, top + 8, 3, 40, '#4d8075');
      rect(c, left + 6, top + 26, w - 12, 3, '#4d8075');
      for (let i = 0; i < 3; i++) {
        rect(c, left + 18 + i * 44, top + 48, 8, 14, '#a87ec7');
        rect(c, left + 20 + i * 44, top + 52, 4, 12, '#c4a2dd');
      }
      rect(c, left + w - 22, y - 16, 8, 10, '#c46d50');
      rect(c, left + w - 12, y - 14, 8, 8, '#68a698');
      rect(c, x - 10, top + 48, 20, 10, '#3a5e42');
      label(c, '🌱', x, top + 56, 9, '#b6e8a0');
    } else if (kind === 'market') {
      rect(c, left - 6, top + 62, w + 12, 14, '#f0c75a');
      for (let i = 0; i < 7; i++) rect(c, left - 6 + i * 22, top + 62, 11, 14, '#c84e45');
      rect(c, left + 14, top + 74, w - 28, 14, '#8d6546');
      rect(c, left + 20, top + 72, 14, 6, '#d84040');
      rect(c, left + 38, top + 72, 12, 6, '#4da6ff');
      rect(c, x - 11, top + 46, 22, 10, '#5a4630');
      label(c, '⚖', x, top + 54, 9, '#f5e28a');
    } else if (kind === 'observatory') {
      for (let row = 0; row < 6; row++) {
        const inset = (6 - row) * 8;
        rect(c, left - 15 + inset, top + row * 7, w + 30 - inset * 2, 8, '#454c6b');
        if (row % 2 === 0) {
          rect(c, left + inset + 12, top + row * 7 + 2, 2, 2, '#f2ea9b');
          rect(c, left + w - inset - 14, top + row * 7 + 2, 2, 2, '#f2ea9b');
        }
      }
      rect(c, x - 4, top + 6, 8, 30, '#25293d');
      label(c, '✦', x, top - 10, 15, '#ffd56b');
      rect(c, x - 10, top + 48, 20, 10, '#3e4359');
      label(c, '🏮', x, top + 56, 9, '#ff7043');
    } else if (isHut) {
      if (b.name.includes('Sen')) {
        for (let row = 0; row < 6; row++) {
          const inset = (6 - row) * 8;
          rect(c, left - 15 + inset, top + row * 7, w + 30 - inset * 2, 8, '#4f7048');
          for (let j = left - 10 + inset; j < left + w + 10 - inset; j += 16) {
            rect(c, j, top + row * 7 + 4, 8, 4, '#73916a');
          }
        }
        rect(c, left + w + 1, y - 20, 10, 18, '#966744');
        rect(c, left + w + 2, y - 19, 8, 4, '#d6ac76');
        rect(c, x - 10, top + 48, 20, 10, '#4a3325');
        label(c, 'Y', x, top + 56, 9, '#e3d2b3');
      } else if (b.name.includes('Thủy Triều') || b.name.includes('Kiệt')) {
        for (let row = 0; row < 6; row++) {
          const inset = (6 - row) * 8;
          rect(c, left - 15 + inset, top + row * 7, w + 30 - inset * 2, 8, '#6f9ea8');
          for (let j = left - 10 + inset; j < left + w + 10 - inset; j += 14) {
            rect(c, j, top + row * 7 + 5, 10, 3, '#8eb4bd');
          }
        }
        rect(c, left + 12, top + 60, 24, 30, '#4e7a6855');
        rect(c, left + 14, top + 64, 4, 4, '#c89658');
        rect(c, left + 28, top + 74, 4, 4, '#c89658');
      } else {
        for (let row = 0; row < 6; row++) {
          const inset = (6 - row) * 8;
          rect(c, left - 15 + inset, top + row * 7, w + 30 - inset * 2, 8, '#a18aad');
          rect(c, left - 12 + inset, top + row * 7 + 5, w + 24 - inset * 2, 2, '#bfa6cb');
        }
        rect(c, left - 14, y - 22, 12, 20, '#8c7050');
        label(c, '▲', left - 8, y - 13, 8, '#f0d060');
      }
    } else {
      c.fillStyle = '#ffffff28';
      for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) {
        const tx = left - 5 + col * 20 + (row % 2) * 10;
        if (tx > left + (6 - row) * 7 && tx < left + w - (6 - row) * 7) c.fillRect(tx, top + row * 7 + 4, 14, 2);
      }
    }

    // 4. Chimney Stack (Centered at b.x + b.w/2 - 29, b.y - b.h - 5)
    if (['home', 'workshop', 'kitchen'].includes(kind) || (isHut && b.name.includes('Sen'))) {
      const chimX = left + w - 36, chimY = top + 1;
      const brickColor = kind === 'kitchen' ? '#a84838' : '#a68b70';
      const capColor = kind === 'kitchen' ? '#d96c5b' : '#d3bb98';
      rect(c, chimX, chimY, 13, 22, brickColor);
      rect(c, chimX - 4, chimY - 5, 21, 7, capColor);
      if (kind === 'kitchen') {
        rect(c, chimX + 2, chimY + 4, 9, 3, '#c55a48');
        rect(c, chimX + 2, chimY + 11, 9, 3, '#c55a48');
      }
    }

    // 5. Windows & Planters
    const windowColor = active ? '#ffdf78' : '#7a8076';
    if (kind !== 'greenhouse' && kind !== 'market') {
      [left + 17, left + w - 47].forEach(wx => {
        rect(c, wx, top + 66, 26, 29, '#4a3325');
        rect(c, wx + 3, top + 69, 20, 23, windowColor);
        rect(c, wx + 12, top + 69, 3, 23, '#4a3325');
        rect(c, wx + 3, top + 79, 20, 3, '#4a3325');
        rect(c, wx - 3, top + 95, 32, 5, '#5c4028');
        rect(c, wx + 1, top + 93, 7, 5, '#e05a78');
        rect(c, wx + 11, top + 92, 8, 6, '#f0c040');
        rect(c, wx + 21, top + 93, 7, 5, '#ffffff');
        rect(c, wx - 1, top + 96, 30, 2, '#4e7a3e');
      });
    }

    // 6. Door & Threshold
    rect(c, x - 16, y - 46, 32, 46, '#4a3325');
    rect(c, x - 12, y - 42, 24, 40, active ? '#684b32' : '#575550');
    rect(c, x - 9, y - 38, 8, 14, '#8b6645');
    rect(c, x + 1, y - 38, 8, 14, '#8b6645');
    rect(c, x - 9, y - 20, 8, 15, '#8b6645');
    rect(c, x + 1, y - 20, 8, 15, '#8b6645');
    rect(c, x + 5, y - 22, 4, 4, '#e8c850');
    rect(c, x - 18, y, 36, 6, '#9a9c8a');

    if (kind === 'observatory') {
      rect(c, x - 26, y - 32, 6, 10, '#ffd56b');
      rect(c, x + 20, y - 32, 6, 10, '#ffd56b');
      rect(c, x - 27, y - 34, 8, 2, '#8c703d');
      rect(c, x + 19, y - 34, 8, 2, '#8c703d');
    }

    if (!active) {
      rect(c, left + 5, top + 48, 31, 7, '#b19775');
    }

    const name = b.upgrade ? D.upgrades.find(u => u.id === b.upgrade).name : b.name;
    label(c, name, x, y + 24, 11, active ? '#fff8de' : '#ecdfb4');
  }
  function actor(c,x,y,shirt,hair,moving=false,isPlayer=false,direction='down',distance=0,running=false,id=isPlayer?'player':'resident') {
    const local=isPlayer&&id==='player';
    const motion=c===ctx?actorMotions.get(local?'player':`npc:${id}`):null;
    return A.draw(c,{x,y,shirt:local?(D.exploration.equipment[state.exploration.outfit]?.color||shirt):shirt,hair,id,direction,moving:!!moving,running:!!running,distance,...(motion?{phase:motion.phase,motionWeight:motion.motionWeight,runWeight:motion.runWeight}:{}),time:animation,reducedMotion,isPlayer,lantern:local&&state.inventory.lantern>0,hidden:local&&!reducedMotion&&hurtCooldown>.6&&Math.floor(animation*12)%2===0});
  }
  function lamp(c,x,y) {
    drawDropShadow(c, x + 7, y + 2, 34, 9, { darkCore: 0.38, penumbra: 0.18, tint: '22, 38, 34' });
    rect(c,x-4,y-66,8,67,'#53626a');rect(c,x-2,y-65,3,66,'#85918a');rect(c,x-8,y-2,16,5,'#45525e');rect(c,x-11,y-79,22,8,'#50626b');rect(c,x-8,y-71,16,18,'#d8ae63');rect(c,x-5,y-68,10,12,'#fff1b0');rect(c,x-11,y-55,22,4,'#52636b');rect(c,x-2,y-83,4,5,'#52636b');
  }
  function resource(c,o) {
    const x=o.x,y=o.y,ready=resourceReady(o);
    drawDropShadow(c, x + 1, y + 2, 28, 8, { darkCore: 0.38, penumbra: 0.18, tint: '22, 38, 34' });
    if(!ready){rect(c,x-5,y-5,10,5,'#917c54');return;}
    if(o.item==='wood'){rect(c,x-18,y-16,36,14,'#966744');rect(c,x-20,y-15,7,12,'#d6ac76');rect(c,x-18,y-12,3,6,'#a1744a');rect(c,x-10,y-15,23,3,'#b88b55');rect(c,x-12,y-2,31,3,'#72563b');}
    else if(o.item==='ore'||o.item==='crystal'){const crystal=o.item==='crystal';rect(c,x-15,y-16,30,14,crystal?'#7795c2':'#7e8a8f');rect(c,x-9,y-24,18,12,crystal?'#abc9e6':'#a4ac9a');rect(c,x-17,y-7,33,5,crystal?'#5b72a4':'#606f79');rect(c,x-8,y-20,7,5,crystal?'#d4e4ed':'#d29c75');rect(c,x+4,y-10,5,4,crystal?'#c9eced':'#e1b286');}
    else if(o.item==='herb'||o.item==='berry'){rect(c,x-3,y-25,6,25,'#527d51');rect(c,x-18,y-18,17,9,'#6a985b');rect(c,x+2,y-25,15,9,'#85af6b');rect(c,x-12,y-28,10,10,'#9cbe75');rect(c,x+4,y-13,14,9,'#547f58');if(o.item==='berry')[[x-12,y-16],[x+6,y-21],[x+10,y-8]].forEach(([bx,by])=>{rect(c,bx,by,6,6,'#d87b83');rect(c,bx,by,3,2,'#f2b1a3');});}
    else if(o.item==='star'){const pulse=reducedMotion?0:Math.sin(animation*3+o.x)*2;rect(c,x-4,y-25+pulse,8,25,'#eacb77');rect(c,x-12,y-17+pulse,24,8,'#f9e5a0');rect(c,x-2,y-19+pulse,4,12,'#fff6c9');if(state.upgrades.includes('observatory')){label(c,'✦',x,y-37,14,'#fff3bd');}}
  }
  function drawObject(c,o) {
    if(o.kind==='door'){
      const room = D.exploration.rooms.find(r=>r.id===o.roomId);
      if(room?.kind==='cave'){
        drawDropShadow(c, o.x, o.y - 2, 130, 22, { darkCore: 0.45, penumbra: 0.22, tint: '15, 25, 20' });
        if(room.id==='cave-forest'){
          pixelEllipse(c, o.x, o.y - 36, 144, 104, '#3d5444');
          rect(c, o.x - 65, o.y - 70, 130, 68, '#2e4235');
          rect(c, o.x - 70, o.y - 20, 140, 18, '#54735e');
          rect(c, o.x - 55, o.y - 50, 22, 10, '#628a6f');
          rect(c, o.x + 35, o.y - 58, 26, 12, '#628a6f');
          rect(c, o.x - 36, o.y - 64, 72, 64, '#17241e');
          rect(c, o.x - 22, o.y - 42, 44, 38, '#2a4d3a');
          rect(c, o.x - 12, o.y - 28, 24, 22, '#4ade8055');
          label(c, '✦', o.x, o.y - 20, 12, '#6ee7b7');
        } else if(room.id==='cave-coast'){
          pixelEllipse(c, o.x, o.y - 36, 144, 104, '#344854');
          rect(c, o.x - 65, o.y - 70, 130, 68, '#24343d');
          rect(c, o.x - 70, o.y - 20, 140, 18, '#4b6878');
          rect(c, o.x - 58, o.y - 54, 24, 10, '#5d7f91');
          rect(c, o.x + 32, o.y - 60, 28, 12, '#5d7f91');
          rect(c, o.x - 36, o.y - 64, 72, 64, '#131e24');
          rect(c, o.x - 22, o.y - 42, 44, 38, '#1e3e4a');
          rect(c, o.x - 12, o.y - 28, 24, 22, '#2dd4bf55');
          label(c, '≈', o.x, o.y - 18, 14, '#67e8f9');
        } else {
          pixelEllipse(c, o.x, o.y - 36, 144, 104, '#382e4a');
          rect(c, o.x - 65, o.y - 70, 130, 68, '#292138');
          rect(c, o.x - 70, o.y - 20, 140, 18, '#52436b');
          rect(c, o.x - 58, o.y - 72, 18, 68, '#433757');
          rect(c, o.x + 40, o.y - 72, 18, 68, '#433757');
          rect(c, o.x - 36, o.y - 64, 72, 64, '#181224');
          rect(c, o.x - 22, o.y - 42, 44, 38, '#321f47');
          rect(c, o.x - 12, o.y - 28, 24, 22, '#c084fc55');
          label(c, '✦', o.x, o.y - 20, 12, '#e879f9');
        }
        label(c, o.name, o.x, o.y + 25, 12);
      } else {
        rect(c, o.x - 17, o.y - 7, 34, 10, '#e9ce8a');
        label(c, '↓ Vào', o.x, o.y + 9, 10);
      }
      return;
    }
    // Địa điểm mới dùng biển và lõi phát sáng; màu xanh ghi nhận thành quả đã lưu.
    if(o.kind==='adventure'||o.kind==='adventureRest'){
      if(!Adventure.unlocked(state)||o.kind==='adventureRest'&&!state.adventure.proofs.includes('rescue'))return;
      const done=state.adventure.proofs.includes(o.proof)||state.adventure.milestones.includes(o.proof),color=done?'#b9e3aa':'#efcb78';
      rect(c,o.x-4,o.y-24,8,25,'#806b50');rect(c,o.x-17,o.y-43,34,23,'#516c62');rect(c,o.x-12,o.y-39,24,15,color);
      label(c,o.kind==='adventureRest'?'⌂':done?'✓':'✦',o.x,o.y-25,13,'#354b4b');
      if(distance(o,state)<170)label(c,o.name,o.x,o.y-56,11);return;
    }
    const x=o.x,y=o.y;
    if(o.kind==='resource'){resource(c,o);return;}
    if(o.kind==='gate'){
      rect(c,x-4,y-60,8,60,'#8a7050');rect(c,x-56,y-63,112,23,'#bb9961');rect(c,x-52,y-59,104,15,'#ecd49a');label(c,o.name,x,y-47,10,'#506356');rect(c,x-10,y-2,20,4,'#b4aa78');
      const locked=(o.to==='coast'&&!state.upgrades.includes('bridge'))||(o.to==='ruins'&&!state.upgrades.includes('archive'));
      label(c,locked?'⌑ Chưa mở':'E →',x,y+16,11,locked?'#edcdaf':'#fff8d6');
      if(o.to==='coast'){for(let i=0;i<5;i++)rect(c,x-55+i*24,y+35,19,12,state.upgrades.includes('bridge')?'#bb9362':'#6b8579');}
    }
    if(o.kind==='plot'){
      const isMoist=Boolean(state.watered?.[o.i])||C.weather(state)==='rain';
      rect(c,x-25,y-26,52,47,isMoist?'#3e3328':'#5f5549');
      rect(c,x-22,y-23,46,40,isMoist?'#5c4331':'#8d6b50');
      for(let i=0;i<4;i++)rect(c,x-20,y-18+i*10,42,3,isMoist?'#75563e':'#a6845c');
      if(isMoist){
        rect(c,x-15,y-17,3,2,'#9ecfd6');
        rect(c,x+10,y+3,3,2,'#9ecfd6');
      }
      if(state.crops[o.i]!==null){
        const wait=state.upgrades.includes('greenhouse')?8000:16000;
        const elapsed=Date.now()-state.crops[o.i];
        const grown=elapsed>=wait;
        const cropId=state.cropTypes?.[o.i]||'berry';
        if(elapsed<wait*0.45){
          for(let i=0;i<3;i++){
            rect(c,x-16+i*14,y-12,4,7,'#7ca352');
            rect(c,x-18+i*14,y-14,8,3,'#a5cc6c');
          }
        }else if(!grown){
          for(let i=0;i<3;i++){
            if(cropId==='berry'){
              rect(c,x-17+i*14,y-19,6,14,'#638856');
              rect(c,x-20+i*14,y-11,13,6,'#97b966');
            }else if(cropId==='carrot'){
              rect(c,x-16+i*14,y-18,5,13,'#488b49');
              rect(c,x-18+i*14,y-14,9,4,'#7ec850');
            }else{
              rect(c,x-16+i*14,y-20,4,15,'#8da848');
              rect(c,x-18+i*14,y-15,8,4,'#b5c45a');
            }
          }
        }else{
          for(let i=0;i<3;i++){
            if(cropId==='berry'){
              rect(c,x-17+i*14,y-19,6,25,'#638856');
              rect(c,x-20+i*14,y-11,13,6,'#97b966');
              rect(c,x-18+i*14,y-18,7,7,'#df8690');
              rect(c,x-16+i*14,y-16,3,3,'#ba4d5d');
            }else if(cropId==='carrot'){
              rect(c,x-16+i*14,y-22,5,12,'#488b49');
              rect(c,x-19+i*14,y-18,11,4,'#7ec850');
              rect(c,x-17+i*14,y-13,6,9,'#f0802b');
              rect(c,x-15+i*14,y-8,2,5,'#e66c23');
            }else{
              rect(c,x-16+i*14,y-24,4,20,'#d1aa3b');
              rect(c,x-18+i*14,y-20,8,12,'#f4d467');
              rect(c,x-19+i*14,y-22,10,3,'#e5b839');
            }
          }
        }
      }
    }
    if(o.kind==='bench'){
      drawDropShadow(c, x, y - 6, 54, 8, { darkCore: 0.32, penumbra: 0.16 });
      rect(c,x-29,y-30,58,8,'#b58d5a');rect(c,x-29,y-20,58,7,'#e0ba7d');rect(c,x-24,y-13,6,16,'#786852');rect(c,x+18,y-13,6,16,'#786852');
    }
    if(o.kind==='well'){
      drawDropShadow(c, x, y + 2, 56, 18, { darkCore: 0.42, penumbra: 0.20, tint: '24, 42, 36' });
      rect(c,x-25,y-28,50,27,state.upgrades.includes('well')?'#b2b19a':'#848d7b');rect(c,x-21,y-33,42,12,'#667978');rect(c,x-17,y-30,34,7,'#79b9c0');rect(c,x-26,y-51,5,31,'#927755');rect(c,x+21,y-51,5,31,'#927755');rect(c,x-29,y-57,58,8,'#aa7758');
    }
    if(o.kind==='camp'){
      drawDropShadow(c, x - 2, y - 8, 64, 16, { darkCore: 0.35, penumbra: 0.18, tint: '30, 38, 30' });
      rect(c,x-31,y-30,62,28,'#b47e5b');rect(c,x-25,y-42,50,15,'#dec793');rect(c,x-17,y-49,34,9,'#f1dba0');rect(c,x-10,y-30,20,28,'#675345');
      rect(c,x-10,y+10,25,6,'#8d6546');
      rect(c,x-8,y+8,6,3,'#ff7a36');
      rect(c,x+2,y+8,5,3,'#ff9642');
      const j1 = organicFlicker(animation, 0), j2 = organicFlicker(animation, 1.8);
      const hRed = 13 + Math.round(j1 * 2);
      rect(c, x - 8 + Math.round(j2 * 1), y + 15 - hRed, 15, hRed, '#d47e43');
      const hAmber = 17 + Math.round(j1 * 3);
      rect(c, x - 5 + Math.round(j2 * 1.2), y + 12 - hAmber, 9, hAmber, '#f4c96d');
      rect(c, x - 2 + (reducedMotion ? 0 : Math.round(j2 * 0.8)), y - 8 + (reducedMotion ? 0 : Math.round(j1 * 3)), 4, 17, '#fff1b4');
    }
    if(o.kind==='fish'){rect(c,x-25,y-5,50,12,'#a58f63');for(let i=0;i<5;i++)rect(c,x-25+i*10,y-5,2,12,'#756d52');label(c,'≈',x+30,y-10,21,'#e2f1cc');}
    if(o.kind==='stele'){
      const active=(state.puzzles&&state.puzzles.includes('ruins-steles'))||steleSequence.includes(o.seq);
      pixelEllipse(c,x,y+2,32,10,'#314b4838');
      rect(c,x-14,y-6,28,7,'#6f7775');
      rect(c,x-11,y-12,22,6,'#8a938f');
      rect(c,x-8,y-48,16,36,'#9ca59f');
      rect(c,x+4,y-48,4,36,'#7a847f');
      rect(c,x-8,y-48,3,36,'#b8c2bc');
      rect(c,x-12,y-54,24,6,'#8a938f');
      rect(c,x-10,y-58,20,4,'#b2beb6');
      rect(c,x-4,y-62,8,4,'#d5ded2');
      if(active){
        rect(c,x-2,y-36,4,12,'#fff4a8');
        rect(c,x-6,y-32,12,4,'#fff4a8');
        rect(c,x-1,y-35,2,10,'#ffffff');
        rect(c,x-5,y-31,10,2,'#ffffff');
        label(c,'✦',x,y-66,13,'#fff0a1');
      }else{
        rect(c,x-1,y-35,2,10,'#636d68');
        rect(c,x-5,y-31,10,2,'#636d68');
      }
    }
    if(o.kind==='shrine'){
      const active=state.shrines.includes(state.map);
      drawDropShadow(c, x, y + 3, 76, 16, { darkCore: 0.48, penumbra: 0.24, tint: '30, 45, 55' });
      rect(c,x-30,y-10,60,12,'#888f93');rect(c,x-19,y-70,38,61,'#a9b4ad');rect(c,x+10,y-70,9,60,'#7e8d95');rect(c,x-12,y-77,24,8,'#cbd0b8');rect(c,x-9,y-56,18,4,active?'#dcf4c2':'#768d95');rect(c,x-4,y-60,8,28,active?'#f1eeb2':'#91a5a4');if(active)label(c,'✦',x,y-91,18,'#fff1b4');
    }
    if(o.kind==='chest'){
      const opened=state.chests.includes(o.id);
      const sealed=o.id==='chest-ruins-secret'&&!(state.puzzles&&state.puzzles.includes('ruins-steles'));
      drawDropShadow(c, x, y + 1, 44, 10, { darkCore: 0.42, penumbra: 0.20, tint: '25, 35, 30' });
      rect(c,x-23,y-23,46,26,'#85694b');
      rect(c,x-24,y-27,48,10,opened?'#6b5a49':sealed?'#635b75':'#b08a52');
      rect(c,x-22,y-17,42,14,sealed?'#7e7492':'#bc9460');
      rect(c,x-16,y-23,5,25,sealed?'#b09ee0':'#e2bb6d');
      rect(c,x+12,y-23,5,25,sealed?'#b09ee0':'#e2bb6d');
      rect(c,x-3,y-13,6,7,sealed?'#d4c4ff':'#f6d88d');
      if(sealed)label(c,'🔒',x,y-32,10,'#d5c8fa');
    }
  }
  function drawPet(c,p) {
    const x=Math.round(p.x),y=Math.round(p.y);
    const bob=(!reducedMotion&&p.moving)?(Math.sin(p.gait*0.3)>0?1:0):0;
    const legSwing=(!reducedMotion&&p.moving)?Math.sin(p.gait*0.35)*3:0;
    const tailCycle=reducedMotion?0:Math.sin(p.tailWag||(animation*8))*(p.moving?4:2.5);
    pixelEllipse(c,x,y+2,22,7,'#344c5538');
    if(p.dir==='down'){
      rect(c,x-7,y-3+(p.moving?legSwing:0),4,4,'#f2bc68');
      rect(c,x-7,y-1+(p.moving?legSwing:0),4,2,'#fef3db');
      rect(c,x+3,y-3-(p.moving?legSwing:0),4,4,'#f2bc68');
      rect(c,x+3,y-1-(p.moving?legSwing:0),4,2,'#fef3db');
      rect(c,x-7,y-9-bob,14,8,'#f2bc68');
      rect(c,x-4,y-7-bob,8,6,'#fef3db');
      rect(c,x+tailCycle-2,y-13-bob,4,5,'#f2bc68');
      rect(c,x+tailCycle-1,y-15-bob,2,3,'#fef3db');
      rect(c,x-8,y-18-bob,16,11,'#f2bc68');
      rect(c,x-2,y-17-bob,4,3,'#fef3db');
      rect(c,x-11,y-19-bob,4,8,'#bf7932');
      rect(c,x-10,y-12-bob,3,2,'#9e5b22');
      rect(c,x+7,y-19-bob,4,8,'#bf7932');
      rect(c,x+7,y-12-bob,3,2,'#9e5b22');
      rect(c,x-4,y-12-bob,8,5,'#fef3db');
      rect(c,x-1.5,y-13-bob,3,2,'#22140c');
      rect(c,x-5,y-15-bob,2,3,'#2a1a0e');
      rect(c,x-5,y-15-bob,1,1,'#ffffff');
      rect(c,x+3,y-15-bob,2,3,'#2a1a0e');
      rect(c,x+3,y-15-bob,1,1,'#ffffff');
      rect(c,x-6,y-8-bob,12,2,'#d34b42');
      rect(c,x-2,y-7-bob,4,4,'#ffe043');
      rect(c,x-1,y-6-bob,2,2,'#fff7a8');
    }else if(p.dir==='up'){
      rect(c,x-7,y-4+legSwing,4,4,'#e0a350');
      rect(c,x+3,y-4-legSwing,4,4,'#e0a350');
      rect(c,x-7,y-10-bob,14,9,'#f2bc68');
      rect(c,x-5,y-8-bob,10,5,'#e0a350');
      rect(c,x-2+tailCycle,y-16-bob,4,7,'#f2bc68');
      rect(c,x-1+tailCycle,y-18-bob,2,3,'#fef3db');
      rect(c,x-8,y-19-bob,16,10,'#f2bc68');
      rect(c,x-11,y-20-bob,4,9,'#bf7932');
      rect(c,x+7,y-20-bob,4,9,'#bf7932');
      rect(c,x-6,y-10-bob,12,2,'#d34b42');
    }else if(p.dir==='left'){
      rect(c,x-6-legSwing,y-4,3,5,'#c98a3e');
      rect(c,x+5+legSwing,y-4,3,5,'#c98a3e');
      rect(c,x-7+legSwing,y-3,3,5,'#f2bc68');
      rect(c,x-8+legSwing,y-1,4,2,'#fef3db');
      rect(c,x+4-legSwing,y-3,3,5,'#f2bc68');
      rect(c,x+3-legSwing,y-1,4,2,'#fef3db');
      rect(c,x-7,y-9-bob,15,7,'#f2bc68');
      rect(c,x-5,y-6-bob,8,4,'#fef3db');
      rect(c,x+8,y-13-bob+tailCycle,4,6,'#f2bc68');
      rect(c,x+9,y-15-bob+tailCycle,3,3,'#fef3db');
      rect(c,x-13,y-17-bob,11,10,'#f2bc68');
      rect(c,x-16,y-13-bob,5,5,'#fef3db');
      rect(c,x-17,y-13-bob,2,2,'#22140c');
      rect(c,x-11,y-15-bob,2,3,'#2a1a0e');
      rect(c,x-11,y-15-bob,1,1,'#ffffff');
      rect(c,x-6,y-18-bob,4,8,'#bf7932');
      rect(c,x-7,y-10-bob,2,5,'#d34b42');
      rect(c,x-9,y-7-bob,3,3,'#ffe043');
    }else{
      rect(c,x+3+legSwing,y-4,3,5,'#c98a3e');
      rect(c,x-8-legSwing,y-4,3,5,'#c98a3e');
      rect(c,x+4-legSwing,y-3,3,5,'#f2bc68');
      rect(c,x+4-legSwing,y-1,4,2,'#fef3db');
      rect(c,x-7+legSwing,y-3,3,5,'#f2bc68');
      rect(c,x-7+legSwing,y-1,4,2,'#fef3db');
      rect(c,x-8,y-9-bob,15,7,'#f2bc68');
      rect(c,x-3,y-6-bob,8,4,'#fef3db');
      rect(c,x-12,y-13-bob+tailCycle,4,6,'#f2bc68');
      rect(c,x-12,y-15-bob+tailCycle,3,3,'#fef3db');
      rect(c,x+2,y-17-bob,11,10,'#f2bc68');
      rect(c,x+11,y-13-bob,5,5,'#fef3db');
      rect(c,x+15,y-13-bob,2,2,'#22140c');
      rect(c,x+9,y-15-bob,2,3,'#2a1a0e');
      rect(c,x+10,y-15-bob,1,1,'#ffffff');
      rect(c,x+2,y-18-bob,4,8,'#bf7932');
      rect(c,x+5,y-10-bob,2,5,'#d34b42');
      rect(c,x+6,y-7-bob,3,3,'#ffe043');
    }
    if(distance(p,state)<65){
      label(c,p.name||'Cún Sao',x,y-22,10,'#fff4ce');
    }
  }

  const REGION_PALETTES = {
    village: {
      deep: '#5a8b3d', shade: '#6c9e47', base: '#7cb34f', warm: '#8fbf5d', light: '#a4cf6e',
      soil: '#ba9e6e', flowerWhite: '#fffdf0', flowerYellow: '#f5cf53', flowerPink: '#efa5ba', cloverDark: '#446e30'
    },
    forest: {
      deep: '#365d3e', shade: '#46724e', base: '#56865f', warm: '#699872', light: '#7eac86',
      soil: '#887854', flowerWhite: '#eaf4e8', flowerYellow: '#e8cb64', flowerPink: '#d99bb8', cloverDark: '#2c4b31'
    },
    coast: {
      deep: '#78955c', shade: '#8ba66c', base: '#9eb87d', warm: '#b2c88f', light: '#c6d8a3',
      soil: '#dbcc96', flowerWhite: '#fdfef4', flowerYellow: '#fae082', flowerPink: '#f8b9b7', cloverDark: '#597341'
    },
    ruins: {
      deep: '#607267', shade: '#728378', base: '#84968a', warm: '#97a79b', light: '#a9b9ae',
      soil: '#949282', flowerWhite: '#f0f3ee', flowerYellow: '#e5d796', flowerPink: '#c8a8c4', cloverDark: '#4c5c53'
    }
  };

  function terrainHash(x, y, seed = 0) {
    let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1013904223, 374761393) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function terrainNoise(x, y, scale, seed = 0) {
    const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
    const fx = (x / scale) - gx, fy = (y / scale) - gy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const n00 = terrainHash(gx, gy, seed);
    const n10 = terrainHash(gx + 1, gy, seed);
    const n01 = terrainHash(gx, gy + 1, seed);
    const n11 = terrainHash(gx + 1, gy + 1, seed);
    const top = n00 + sx * (n10 - n00);
    const bot = n01 + sx * (n11 - n01);
    return top + sy * (bot - top);
  }

  function terrain(map) {
    if(terrainCache.has(map))return terrainCache.get(map);
    const c=document.createElement('canvas');c.width=1600;c.height=1100;const g=c.getContext('2d');
    const seed = 150 + ['village','forest','coast','ruins'].indexOf(map) * 811;
    const pal = REGION_PALETTES[map] || REGION_PALETTES.village;

    // 1. Organic Terrain Dithering: Multi-octave continuous value noise with 5-tier regional ramps
    for(let y = 0; y < 1100; y += 8) {
      for(let x = 0; x < 1600; x += 8) {
        const v = terrainNoise(x, y, 96, seed) * 0.7 + terrainNoise(x, y, 32, seed + 11) * 0.3;
        const bayer = ((Math.floor(x / 8) % 2) === (Math.floor(y / 8) % 2)) ? 0.04 : -0.04;
        const vd = v + bayer;
        let col = pal.base;
        if(vd < 0.28) col = pal.deep;
        else if(vd < 0.45) col = pal.shade;
        else if(vd < 0.62) col = pal.base;
        else if(vd < 0.78) col = pal.warm;
        else col = pal.light;
        rect(g, x, y, 8, 8, col);
      }
    }

    // 2. Organic Micro-Tufts & Wildflowers clustered in meadow negative space
    for(let y = 30; y < 1070; y += 24) {
      for(let x = 30; x < 1570; x += 24) {
        const h = terrainHash(x, y, seed + 42);
        if(P.contains(layouts[map], x, y, 12) || (x > 1100 && x < 1500 && y > 615 && y < 915) || (map === 'coast' && x > 980 && y > 560)) continue;
        if(h < 0.40) continue;
        const jx = x + Math.floor((h * 100) % 16) - 8;
        const jy = y + Math.floor((h * 1000) % 16) - 8;
        const type = Math.floor(h * 10) % 4;
        if(type === 0) {
          rect(g, jx, jy, 2, 4, pal.deep);
          rect(g, jx + 3, jy + 1, 2, 3, pal.light);
        } else if(type === 1) {
          rect(g, jx, jy + 1, 2, 3, pal.deep);
          rect(g, jx + 2, jy, 2, 4, pal.shade);
          rect(g, jx + 4, jy + 1, 2, 3, pal.light);
        } else if(type === 2) {
          rect(g, jx + 1, jy, 2, 2, pal.flowerWhite);
          rect(g, jx, jy + 1, 2, 2, pal.flowerWhite);
          rect(g, jx + 2, jy + 1, 2, 2, pal.flowerWhite);
          rect(g, jx + 1, jy + 2, 2, 2, pal.flowerWhite);
          rect(g, jx + 1, jy + 1, 2, 2, pal.flowerYellow);
        } else {
          if(h > 0.85) {
            rect(g, jx + 1, jy + 1, 2, 2, pal.flowerPink);
            rect(g, jx, jy + 2, 4, 1, pal.flowerPink);
          } else {
            rect(g, jx, jy, 2, 2, pal.cloverDark);
            rect(g, jx + 3, jy, 2, 2, pal.cloverDark);
            rect(g, jx + 1, jy + 2, 2, 2, pal.cloverDark);
            rect(g, jx + 1, jy + 1, 2, 2, pal.shade);
          }
        }
      }
    }

    // 3. Coast Beach Overhaul
    if(map === 'coast') {
      for(let y = 570; y < 1100; y += 4) {
        const sandStartX = Math.round(1010 + Math.sin(y * 0.015) * 35 + Math.cos(y * 0.04) * 15);
        for(let x = sandStartX - 32; x < sandStartX; x += 4) {
          const dither = terrainHash(x, y, seed + 88) > ((sandStartX - x) / 32);
          if(dither) rect(g, x, y, 4, 4, '#e8d9a6');
        }
        rect(g, sandStartX, y, 1340 - sandStartX, 4, '#e8d9a6');
        if((y % 16) === 0) rect(g, sandStartX + 20, y + 1, Math.min(260, 1320 - sandStartX), 1, '#dfce98');
        rect(g, 1340, y, 80, 4, '#c2b083');
        rect(g, 1420, y, 60, 4, '#50b8b0');
        rect(g, 1480, y, 120, 4, '#185068');
        rect(g, 1420 + Math.round(Math.sin(y * 0.05) * 4), y, 3, 4, '#ffffff');
      }
      for(let i = 0; i < 60; i++) {
        const sx = 1040 + Math.floor(terrainHash(i * 17, i * 31, seed) * 300);
        const sy = 600 + Math.floor(terrainHash(i * 19, i * 37, seed) * 440);
        rect(g, sx, sy, 3, 2, i % 2 === 0 ? '#fae8d2' : '#dfcbb5');
      }
    }

    // 4. Render Roads via world-paths.js
    P.draw(g, layouts[map]);

    // 5. Road Edge Fringing (boundary grass teeth & warm pebble crumbs)
    const roadLayout = layouts[map];
    for(let r = 0; r < roadLayout.rows; r += 2) {
      for(let col = 0; col < roadLayout.cols; col += 2) {
        const rx = col * 8, ry = r * 8;
        if(!roadLayout.cells[r * roadLayout.cols + col]) continue;
        const isEdge = !roadLayout.cells[Math.max(0, r - 1) * roadLayout.cols + col] ||
                       !roadLayout.cells[Math.min(roadLayout.rows - 1, r + 1) * roadLayout.cols + col] ||
                       !roadLayout.cells[r * roadLayout.cols + Math.max(0, col - 1)] ||
                       !roadLayout.cells[r * roadLayout.cols + Math.min(roadLayout.cols - 1, col + 1)];
        if(isEdge) {
          const eh = terrainHash(col, r, seed + 99);
          if(eh > 0.6) {
            rect(g, rx + 2 + Math.floor(eh * 3), ry + 2 + Math.floor((eh * 7) % 3), 2, 2, pal.base);
          } else if(eh > 0.35) {
            rect(g, rx + 1 + Math.floor(eh * 4), ry + 1 + Math.floor((eh * 5) % 4), 1, 1, pal.soil);
          }
        }
      }
    }

    // 6. Natural Water & Shorelines: Pond Overhaul (strictly within 1110..1490, 625..905)
    rect(g, 1110, 625, 380, 280, '#534c3e');
    rect(g, 1114, 628, 372, 274, '#726f66');
    rect(g, 1124, 638, 352, 254, '#4eb5b0');
    rect(g, 1150, 654, 300, 222, '#2b8196');
    for(let px = 1150; px < 1450; px += 4) {
      rect(g, px, 652, 2, 2, '#4eb5b0');
      rect(g, px, 876, 2, 2, '#4eb5b0');
    }
    rect(g, 1186, 678, 228, 174, '#134a5e');
    for(let px = 1186; px < 1414; px += 4) {
      rect(g, px, 676, 2, 2, '#2b8196');
      rect(g, px, 852, 2, 2, '#2b8196');
    }
    // Perimeter river stones (cobblestones)
    for(let i = 0; i < 46; i++) {
      const sx = 1116 + i * 8;
      rect(g, sx, 626, 7, 3, '#ded5b8');
      rect(g, sx, 629, 7, 5, '#8a948c');
      rect(g, sx, 634, 7, 3, '#455650');

      rect(g, sx, 893, 7, 3, '#ded5b8');
      rect(g, sx, 896, 7, 5, '#8a948c');
      rect(g, sx, 901, 7, 3, '#455650');
    }
    for(let i = 0; i < 32; i++) {
      const sy = 638 + i * 8;
      rect(g, 1112, sy, 4, 7, '#ded5b8');
      rect(g, 1116, sy, 5, 7, '#8a948c');
      rect(g, 1121, sy, 3, 7, '#455650');

      rect(g, 1468, sy, 3, 7, '#ded5b8');
      rect(g, 1471, sy, 5, 7, '#8a948c');
      rect(g, 1476, sy, 4, 7, '#455650');
    }
    // Shoreline foam lip
    rect(g, 1124, 637, 352, 1, '#e2f7f4');
    rect(g, 1124, 892, 352, 1, '#e2f7f4');
    rect(g, 1124, 637, 1, 255, '#e2f7f4');
    rect(g, 1476, 637, 1, 255, '#e2f7f4');
    // Specular water glints
    for(let i = 0; i < 40; i++) {
      const gx = 1140 + Math.floor(terrainHash(i * 23, i * 47, seed + 123) * 310);
      const gy = 648 + Math.floor(terrainHash(i * 29, i * 53, seed + 456) * 230);
      rect(g, gx, gy, 8, 2, '#d4f7f080');
    }
    // Lily pads & pink lotus blossoms
    const lilyPads = [
      { x: 1160, y: 670 }, { x: 1172, y: 678 }, { x: 1184, y: 668 },
      { x: 1420, y: 710 }, { x: 1432, y: 722 },
      { x: 1220, y: 840 }, { x: 1234, y: 846 }, { x: 1248, y: 838 },
      { x: 1390, y: 820 }, { x: 1404, y: 826 }
    ];
    lilyPads.forEach((pad, idx) => {
      rect(g, pad.x, pad.y, 10, 7, '#3d7a46');
      rect(g, pad.x + 1, pad.y + 1, 8, 2, '#64a86d');
      rect(g, pad.x + 4, pad.y + 3, 2, 2, '#2b8196');
      if(idx % 3 === 0) {
        rect(g, pad.x + 2, pad.y - 2, 6, 4, '#f8bbd0');
        rect(g, pad.x + 3, pad.y - 4, 4, 3, '#ffffff');
        rect(g, pad.x + 4, pad.y, 2, 2, '#c2185b');
      }
    });

    // 7. Ruins Pillars
    if(map === 'ruins') {
      const ruinRandom = rng(999);
      for(let i = 0; i < 12; i++) {
        const x = 180 + ruinRandom() * 1200, y = 200 + ruinRandom() * 700;
        if(P.contains(layouts[map], x + 22, y, 55) || (x > 1060 && y > 570)) continue;
        rect(g, x, y, 45, 8, '#728378');
        rect(g, x + 7, y - 40, 29, 42, '#a9b9ae');
        rect(g, x + 31, y - 40, 5, 42, '#607267');
        rect(g, x + 4, y - 44, 36, 8, '#c8d4c6');
        rect(g, x + 16, y - 28, 8, 12, '#82748e');
        rect(g, x + 18, y - 26, 4, 8, '#c084fc');
      }
    }

    terrainCache.set(map, c);
    return c;
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
      const cFlicker = organicFlicker(animation, 0.4);
      sources.push({x:camp.x,y:camp.y+4,r:110 + (reducedMotion ? 0 : Math.round(cFlicker * 6)),power:Number((0.8 + (reducedMotion ? 0 : cFlicker * 0.07)).toFixed(3))});
      if(state.upgrades.includes('beacon'))sources.push({x:800,y:310,r:340,power:1});
    }else{
      world[state.map].objects.filter(o=>o.kind==='shrine'&&state.shrines.includes(state.map)).forEach(o=>sources.push({x:o.x,y:o.y-40,r:160,power:.8}));
      world[state.map].objects.filter(o=>o.kind==='stele'&&((state.puzzles&&state.puzzles.includes('ruins-steles'))||steleSequence.includes(o.seq))).forEach(o=>sources.push({x:o.x,y:o.y-30,r:70,power:.65}));
    }
    world[state.map].objects.filter(o=>o.item==='star'&&resourceReady(o)).forEach(o=>sources.push({x:o.x,y:o.y-12,r:38,power:.3}));
    return sources;
  }
  function drawWindowLightCasting(c, cam) {
    const bList = state.map === 'village' ? buildings : (world[state.map]?.buildings || []);
    for (const b of bList) {
      const active = !b.upgrade || state.upgrades.includes(b.upgrade);
      if (!active) continue;
      if (b.x + b.w / 2 < cam.x - 40 || b.x - b.w / 2 > cam.x + viewWidth + 40 ||
          b.y < cam.y - 40 || b.y - b.h > cam.y + viewHeight + 40) continue;

      const left = b.x - b.w / 2, groundY = b.y - cam.y;
      const castDist = 34;

      if (b.kind === 'greenhouse') {
        const x0 = left + 14 - cam.x, x1 = left + b.w - 14 - cam.x;
        c.fillStyle = 'rgba(200, 240, 190, 0.16)';
        c.beginPath();
        c.moveTo(x0, groundY); c.lineTo(x1, groundY);
        c.lineTo(x1 + 10, groundY + 28); c.lineTo(x0 - 10, groundY + 28);
        c.closePath(); c.fill();
        continue;
      }
      if (b.kind === 'market') continue;

      const winOffsets = [left + 17, left + b.w - 47];
      for (const wx of winOffsets) {
        const cx = wx + 13 - cam.x;
        c.fillStyle = 'rgba(255, 176, 58, 0.18)';
        c.beginPath();
        c.moveTo(cx - 11, groundY); c.lineTo(cx - 2, groundY);
        c.lineTo(cx - 4, groundY + castDist); c.lineTo(cx - 21, groundY + castDist);
        c.closePath(); c.fill();
        c.beginPath();
        c.moveTo(cx + 2, groundY); c.lineTo(cx + 11, groundY);
        c.lineTo(cx + 21, groundY + castDist); c.lineTo(cx + 4, groundY + castDist);
        c.closePath(); c.fill();

        c.fillStyle = 'rgba(255, 215, 95, 0.25)';
        c.beginPath();
        c.moveTo(cx - 9, groundY); c.lineTo(cx + 9, groundY);
        c.lineTo(cx + 13, groundY + 18); c.lineTo(cx - 13, groundY + 18);
        c.closePath(); c.fill();

        for (let dx = -18; dx <= 18; dx += 4) {
          rect(c, cx + dx, groundY + castDist - 1, 2, 2, 'rgba(255, 176, 58, 0.12)');
        }
      }

      const dx = b.x - cam.x;
      c.fillStyle = 'rgba(255, 190, 70, 0.20)';
      c.beginPath();
      c.moveTo(dx - 10, groundY); c.lineTo(dx + 10, groundY);
      c.lineTo(dx + 14, groundY + 16); c.lineTo(dx - 14, groundY + 16);
      c.closePath(); c.fill();
    }
  }
  function drawLighting() {
    const night=C.isNight(state),rain=C.weather(state)==='rain';
    let dusk=0;if(state.minutes>=1020&&state.minutes<1140)dusk=(state.minutes-1020)/120*.36;else if(state.minutes>=360&&state.minutes<420)dusk=(420-state.minutes)/60*.3;
    const darkness=Math.min(.64,(night?.53:dusk)+(rain?.13:0));
    dc.clearRect(0,0,viewWidth,viewHeight);dc.globalCompositeOperation='source-over';dc.fillStyle=`rgba(25,35,61,${darkness})`;dc.fillRect(0,0,viewWidth,viewHeight);
    const lights=lightSources();dc.globalCompositeOperation='destination-out';
    lights.forEach(l=>{
      const x=l.x-camera.x,y=l.y-camera.y;
      const gradient=dc.createRadialGradient(x,y,4,x,y,l.r);
      gradient.addColorStop(0,`rgba(0,0,0,${l.power})`);
      gradient.addColorStop(.2,`rgba(0,0,0,${(l.power*.95).toFixed(3)})`);
      gradient.addColorStop(.5,`rgba(0,0,0,${(l.power*.65).toFixed(3)})`);
      gradient.addColorStop(.8,`rgba(0,0,0,${(l.power*.25).toFixed(3)})`);
      gradient.addColorStop(1,'rgba(0,0,0,0)');
      dc.fillStyle=gradient;
      dc.fillRect(x-l.r,y-l.r,l.r*2,l.r*2);
    });
    dc.globalCompositeOperation='source-over';ctx.drawImage(darkCanvas,0,0);
    if(darkness>.05){
      ctx.globalCompositeOperation='screen';
      drawWindowLightCasting(ctx, camera);
      lights.filter(l=>l.power>.6).forEach(l=>{
        const x=l.x-camera.x,y=l.y-camera.y;
        const glow=ctx.createRadialGradient(x,y,0,x,y,l.r*.65);
        glow.addColorStop(0,'rgba(255,176,58,0.36)');
        glow.addColorStop(.25,'rgba(255,136,0,0.22)');
        glow.addColorStop(.65,'rgba(215,95,12,0.08)');
        glow.addColorStop(1,'rgba(215,95,12,0)');
        ctx.fillStyle=glow;
        ctx.fillRect(x-l.r,y-l.r,l.r*2,l.r*2);
        if(l.r>=110){
          for(let i=0;i<12;i++){
            const angle=i*Math.PI/6,dist=l.r*(.52+.1*(((i*7)%5)/5));
            rect(ctx,x+Math.cos(angle)*dist,y+Math.sin(angle)*dist,2,2,'rgba(255,176,58,0.14)');
          }
        }
      });
      ctx.globalCompositeOperation='source-over';
    }
  }
  function actorLabels() {
    const placed=[],actors=[{id:'player',name:state.name,x:state.x,y:state.y,color:'#fff4d7',marker:''},
      ...[...peers.values()].filter(p=>!interior&&p.map===state.map).map(p=>({...p,color:'#bce9e1',marker:''})),
      ...currentResidents().slice().sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id)).map(n=>({...n,color:'#fff8de',marker:npcMarker(n)}))];
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
      const textLen = String(t.name).length;
      const pillW = Math.max(34, textLen * 7.5 + 10);
      const pillH = 15;
      const pillX = Math.round(t.x - pillW / 2);
      const pillY = Math.round(t.y - 12);
      ctx.fillStyle = 'rgba(16, 24, 30, 0.78)';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(70, 95, 105, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillRect(pillX, pillY, pillW, pillH);
      }
      if (t.marker) {
        const my = t.y - 20;
        const badgeR = 10;
        const isClaim = t.marker === '✓';
        const isNew = t.marker === '?';
        const badgeColor = isClaim ? 'rgba(18, 52, 32, 0.88)' : (isNew ? 'rgba(56, 42, 10, 0.88)' : 'rgba(24, 42, 54, 0.88)');
        const rimColor = isClaim ? 'rgba(110, 231, 183, 0.6)' : (isNew ? 'rgba(250, 204, 21, 0.6)' : 'rgba(125, 211, 252, 0.6)');
        ctx.beginPath();
        ctx.arc(t.x, my, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = badgeColor;
        ctx.fill();
        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      label(ctx,t.name,t.x,t.y,t.id==='player'?11:12,t.color);
      if(t.marker)label(ctx,t.marker,t.x,t.y-19,18,t.marker==='✓'?'#86efac':'#ffd166');
    });
    ctx.restore();
  }
  // Vùng nguy hiểm dùng đúng hướng đã khóa trong FSM; vẫn vẽ khi giảm chuyển động.
  function drawCombatWarnings(){
    for(const mob of currentArea().mobs){
      const c=mob.combat;if(mob.hp<=0||!c||!['windup','active'].includes(c.stage))continue;
      const def=CombatData.enemies[mob.kind||'slime'],angle=c.stage==='active'&&Number.isFinite(c.vx)&&Number.isFinite(c.vy)?Math.atan2(c.vy,c.vx):Math.atan2(c.aimY-mob.y,c.aimX-mob.x),color=c.stage==='windup'?'#ffd16b':'#eb8d78';
      ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3;ctx.globalAlpha=.32;
      if(['charge','projectile'].includes(c.style)){
        const length=c.style==='charge'?def.range:Math.min(def.range,300);ctx.lineWidth=c.style==='charge'?40:18;ctx.beginPath();ctx.moveTo(mob.x,mob.y);ctx.lineTo(mob.x+Math.cos(angle)*length,mob.y+Math.sin(angle)*length);ctx.stroke();
      }else{const arc=(def.arc||140)*Math.PI/180;ctx.beginPath();ctx.moveTo(mob.x,mob.y);ctx.arc(mob.x,mob.y,def.range,angle-arc/2,angle+arc/2);ctx.closePath();ctx.fill();ctx.globalAlpha=.85;ctx.stroke();}
      ctx.restore();if(c.stage==='windup')label(ctx,'!',mob.x,mob.y-45,18,color);
    }
  }
  function drawStandardMob(c, m, def, x, y, animation, reducedMotion) {
    pixelEllipse(c, x + 3, m.y + 4, 38, 10, '#344c5540');
    rect(c, x - 19, y - 18, 38, 16, def.color);
    rect(c, x - 14, y - 28, 28, 18, def.color);
    rect(c, x - 9, y - 30, 18, 6, '#d4d5ab');

    if (m.kind === 'sprout') {
      rect(c, x - 16, y - 6, 32, 4, '#8e6393');
      rect(c, x - 11, y - 27, 22, 3, '#d8addd');
      const footWaddle = reducedMotion ? 0 : Math.round(Math.sin(animation * 7 + m.phase) * 2);
      rect(c, x - 12 + footWaddle, y - 2, 6, 4, '#5e4635');
      rect(c, x + 6 - footWaddle, y - 2, 6, 4, '#5e4635');
      const leafSway = reducedMotion ? 0 : Math.round(Math.sin(animation * 4 + m.phase) * 2);
      rect(c, x - 3, y - 48, 6, 22, '#4e7a4b');
      rect(c, x - 15 + leafSway, y - 44, 12, 6, '#76ad72');
      rect(c, x - 12 + leafSway, y - 46, 6, 3, '#9dd199');
      rect(c, x + 3 - leafSway, y - 44, 12, 6, '#76ad72');
      rect(c, x + 6 - leafSway, y - 46, 6, 3, '#9dd199');
      rect(c, x - 6, y - 52, 12, 6, '#e2a6d4');
      rect(c, x - 3, y - 50, 6, 3, '#fbe089');
      rect(c, x - 10, y - 16, 4, 4, '#3d1a3c'); rect(c, x - 9, y - 16, 1, 1, '#fbe089');
      rect(c, x + 6, y - 16, 4, 4, '#3d1a3c'); rect(c, x + 7, y - 16, 1, 1, '#fbe089');
      rect(c, x - 2, y - 9, 4, 2, '#3d1a3c');
    } else if (m.kind === 'warden') {
      rect(c, x - 17, y - 6, 34, 4, '#4e3c27');
      rect(c, x - 23, y - 44, 12, 34, '#6b5336'); rect(c, x - 21, y - 42, 8, 30, '#a68c65');
      rect(c, x + 11, y - 44, 12, 34, '#6b5336'); rect(c, x + 13, y - 42, 8, 30, '#a68c65');
      rect(c, x - 26, y - 54, 4, 12, '#6b5336'); rect(c, x - 30, y - 58, 6, 4, '#8a6e4d');
      rect(c, x + 22, y - 54, 4, 12, '#6b5336'); rect(c, x + 24, y - 58, 6, 4, '#8a6e4d');
      rect(c, x - 22, y - 34, 10, 5, '#48683f'); rect(c, x - 20, y - 32, 6, 4, '#6e9663');
      rect(c, x + 12, y - 34, 10, 5, '#48683f'); rect(c, x + 14, y - 32, 6, 4, '#6e9663');
      rect(c, x - 10, y - 28, 20, 4, '#6e9663');
      const eyeGlow = reducedMotion ? '#74dfaa' : (Math.sin(animation * 6) > 0 ? '#b5f5d3' : '#74dfaa');
      rect(c, x - 4, y - 18, 8, 5, '#2d4229'); rect(c, x - 3, y - 17, 6, 3, eyeGlow);
    } else {
      rect(c, x - 17, y - 6, 34, 4, '#6a9867');
      rect(c, x - 12, y - 29, 24, 3, '#b5deb2');
      rect(c, x - 16, y - 19, 4, 15, '#b5deb2');
      rect(c, x - 10, y - 25, 3, 2, '#ffffff');
      rect(c, x + 7, y - 23, 2, 2, '#ffffff');
      const coreY = y - 16 + (reducedMotion ? 0 : Math.round(Math.sin(animation * 4 + m.phase) * 1.5));
      rect(c, x - 2, coreY - 2, 4, 4, '#fef08a');
      rect(c, x - 1, coreY - 1, 2, 2, '#fffbeb');
      rect(c, x - 12, y - 14, 4, 4, '#33595b'); rect(c, x - 11, y - 14, 1, 1, '#ffffff');
      rect(c, x + 7, y - 14, 4, 4, '#33595b'); rect(c, x + 8, y - 14, 1, 1, '#ffffff');
      rect(c, x - 3, y - 7, 8, 3, '#dce5b6');
    }

    rect(c, x - 17, y + 6, 34, 4, '#426c5b');
    rect(c, x - 17, y + 6, Math.max(0, m.hp) / def.maxHp * 34, 4, '#e8c16b');
  }
  function drawBossMob(c, m, def, x, y, animation, reducedMotion) {
    pixelEllipse(c, x, y, 88, 24, '#344c5540');
    const bossKind = m.kind || 'rootBoss';
    const vulnerable = m.combat?.style === 'vulnerable';

    if (bossKind === 'forestBoss') {
      rect(c, x - 32, y - 68, 64, 65, '#353c36');
      rect(c, x - 28, y - 64, 56, 58, '#525c53');
      rect(c, x - 46, y - 52, 18, 50, '#353c36');
      rect(c, x - 42, y - 48, 12, 42, '#525c53');
      rect(c, x + 28, y - 52, 18, 50, '#353c36');
      rect(c, x + 30, y - 48, 12, 42, '#525c53');
      rect(c, x - 36, y - 72, 72, 10, '#506846');
      rect(c, x - 32, y - 70, 64, 6, '#79946c');
      rect(c, x - 20, y - 84, 40, 26, '#525c53');
      rect(c, x - 22, y - 86, 44, 6, '#79946c');
      rect(c, x - 32, y - 96, 10, 32, '#506846');
      rect(c, x + 22, y - 96, 10, 32, '#506846');
      rect(c, x - 14, y - 74, 6, 5, '#6ee7b7');
      rect(c, x + 8, y - 74, 6, 5, '#6ee7b7');
      if (vulnerable) {
        rect(c, x - 12, y - 48, 24, 26, '#353c36');
        rect(c, x - 8, y - 44, 16, 20, '#6ee7b7');
        rect(c, x - 4, y - 40, 8, 12, '#c5f0b1');
      } else {
        rect(c, x - 9, y - 45, 18, 23, '#506846');
        rect(c, x - 5, y - 41, 10, 15, '#79946c');
      }
    } else if (bossKind === 'tideBoss') {
      rect(c, x - 30, y - 68, 60, 65, '#3e636b');
      rect(c, x - 26, y - 64, 52, 58, '#6e9ca4');
      rect(c, x - 44, y - 52, 18, 50, '#3e636b');
      rect(c, x - 40, y - 48, 12, 42, '#6e9ca4');
      rect(c, x + 26, y - 52, 18, 50, '#3e636b');
      rect(c, x + 28, y - 48, 12, 42, '#6e9ca4');
      rect(c, x - 46, y - 44, 4, 8, '#e07a7a');
      rect(c, x + 42, y - 44, 4, 8, '#e07a7a');
      rect(c, x - 22, y - 84, 44, 28, '#4d757d');
      rect(c, x - 34, y - 98, 10, 32, '#e07a7a'); rect(c, x - 32, y - 104, 6, 8, '#f2a4a4');
      rect(c, x + 24, y - 98, 10, 32, '#e07a7a'); rect(c, x + 26, y - 104, 6, 8, '#f2a4a4');
      rect(c, x - 4, y - 102, 8, 24, '#f2a4a4');
      rect(c, x - 13, y - 73, 6, 5, '#a5f3fc');
      rect(c, x + 7, y - 73, 6, 5, '#a5f3fc');
      if (vulnerable) {
        rect(c, x - 12, y - 48, 24, 26, '#3e636b');
        rect(c, x - 8, y - 44, 16, 20, '#67e8f9');
        rect(c, x - 4, y - 40, 8, 12, '#f0fdfa');
      } else {
        rect(c, x - 9, y - 45, 18, 23, '#4d757d');
        rect(c, x - 5, y - 41, 10, 15, '#6e9ca4');
      }
    } else if (bossKind === 'skyBoss') {
      rect(c, x - 30, y - 68, 60, 65, '#261b30');
      rect(c, x - 26, y - 64, 52, 58, '#433352');
      const shardLev = reducedMotion ? 0 : Math.round(Math.sin(animation * 3 + m.phase) * 3);
      rect(c, x - 46, y - 56 + shardLev, 16, 44, '#433352');
      rect(c, x - 42, y - 52 + shardLev, 10, 36, '#a38cb6');
      rect(c, x + 30, y - 56 - shardLev, 16, 44, '#433352');
      rect(c, x + 32, y - 52 - shardLev, 10, 36, '#a38cb6');
      rect(c, x - 22, y - 86, 44, 30, '#352445');
      rect(c, x - 34, y - 100, 10, 32, '#a38cb6'); rect(c, x - 32, y - 106, 6, 8, '#c084fc');
      rect(c, x + 24, y - 100, 10, 32, '#a38cb6'); rect(c, x + 26, y - 106, 6, 8, '#c084fc');
      rect(c, x - 5, y - 108, 10, 30, '#f3e8ff');
      rect(c, x - 13, y - 74, 6, 5, '#f472b6');
      rect(c, x + 7, y - 74, 6, 5, '#f472b6');
      if (vulnerable) {
        rect(c, x - 12, y - 48, 24, 26, '#261b30');
        rect(c, x - 8, y - 44, 16, 20, '#e879f9');
        rect(c, x - 4, y - 40, 8, 12, '#fdf4ff');
      } else {
        rect(c, x - 9, y - 45, 18, 23, '#433352');
        rect(c, x - 5, y - 41, 10, 15, '#a38cb6');
      }
    } else {
      rect(c, x - 28, y - 68, 56, 65, '#5c402b');
      rect(c, x - 24, y - 64, 48, 58, '#c79068');
      rect(c, x - 40, y - 54, 16, 50, '#5c402b');
      rect(c, x - 38, y - 52, 12, 44, def.color);
      rect(c, x + 24, y - 54, 16, 50, '#5c402b');
      rect(c, x + 26, y - 52, 12, 44, def.color);
      rect(c, x - 20, y - 84, 40, 28, '#4b6e42');
      rect(c, x - 18, y - 82, 36, 24, '#899b65');
      rect(c, x - 36, y - 98, 12, 34, '#8a623f');
      rect(c, x - 42, y - 104, 8, 8, '#fef08a');
      rect(c, x + 24, y - 98, 12, 34, '#8a623f');
      rect(c, x + 34, y - 104, 8, 8, '#fef08a');
      rect(c, x - 12, y - 73, 5, 5, '#74dfaa');
      rect(c, x + 7, y - 73, 5, 5, '#74dfaa');
      if (vulnerable) {
        rect(c, x - 12, y - 48, 24, 26, '#5c402b');
        rect(c, x - 8, y - 44, 16, 20, '#74dfaa');
        rect(c, x - 4, y - 40, 8, 12, '#c5f0b1');
      } else {
        rect(c, x - 9, y - 45, 18, 23, '#edbd72');
        rect(c, x - 6, y - 42, 12, 17, '#c79068');
      }
    }

    label(c, `${def.name} · Pha ${m.combat?.phase || 1}`, x, y - 108, 12);
    rect(c, x - 40, y + 9, 80, 5, '#594d49');
    rect(c, x - 40, y + 9, 80 * m.hp / def.maxHp, 5, '#ddaa71');
  }
  function drawGame() {
    ctx.clearRect(0,0,viewWidth,viewHeight);ctx.save();ctx.translate(-camera.x,-camera.y);if(interior)InteriorScene.draw(ctx,interior,state);else ctx.drawImage(terrain(state.map),0,0);
    const ambientOptions={night:C.isNight(state),rain:C.weather(state)==='rain',upgrades:state.upgrades,shrineActive:state.shrines.includes(state.map),reducedMotion,viewport:{x:camera.x,y:camera.y,width:viewWidth,height:viewHeight}};
    if(!interior)E.drawGround(ctx,world[state.map].ambient,animation,ambientOptions);
    if(!interior&&C.weather(state)==='rain')E.drawPuddles(ctx,state.map,animation,{night:C.isNight(state),reducedMotion,lights:lightSources(),viewport:{x:camera.x,y:camera.y,width:viewWidth,height:viewHeight}});
    if(!interior&&state.map==='village'&&state.quests.adv06?.status==='claimed'){
      rect(ctx,815,660,105,22,'#91ae75');rect(ctx,830,640,65,12,'#bc9665');rect(ctx,838,652,8,24,'#6c624c');rect(ctx,879,652,8,24,'#6c624c');label(ctx,'✦ Góc làng hồi sinh',867,622,11,'#e9f1bc');
    }
    drawCombatWarnings();
    const drawables=[];
    if(!interior&&state.map==='village'){
      buildings.forEach(b=>drawables.push({y:b.y,draw:()=>house(ctx,b,!b.upgrade||state.upgrades.includes(b.upgrade))}));
      [...lamps,...(state.upgrades.includes('lamps')?extraLamps:[])].forEach(l=>drawables.push({y:l.y,draw:()=>lamp(ctx,l.x,l.y)}));
      if(state.upgrades.includes('beacon'))drawables.push({y:350,draw:()=>{rect(ctx,770,325,60,25,'#9ba7a2');rect(ctx,786,245,28,80,'#e0cfad');rect(ctx,776,235,48,18,'#718a91');rect(ctx,784,211,32,26,'#f1ca71');rect(ctx,794,205,12,32,'#fff1b4');label(ctx,'Đèn Dẫn Sao',800,377,12);}});
    }
    if(!interior)world[state.map].buildings.forEach(b=>drawables.push({y:b.y,draw:()=>house(ctx,b,true)}));
    currentArea().trees.forEach(t=>drawables.push({y:t.y,draw:()=>tree(ctx,t.x,t.y,t.size,t.tone)}));
    if(!interior)currentArea().objects.forEach(o=>drawables.push({y:o.y,draw:()=>drawObject(ctx,o)}));
    currentArea().mobs.filter(m=>m.deadUntil<=Date.now()).forEach(m=>drawables.push({y:m.y,draw:()=>{
      const bounce=reducedMotion?0:Math.sin(animation*5+m.phase)*3,x=m.x,y=m.y+bounce;
      const def=CombatData.enemies[m.kind||'slime'];
      if(def.boss){
        drawBossMob(ctx, m, def, x, y, animation, reducedMotion);
      }else{
        drawStandardMob(ctx, m, def, x, y, animation, reducedMotion);
      }
      if(m.hitTime>0&&!reducedMotion){ctx.save();ctx.globalAlpha=.55;rect(ctx,x-14,y-26,28,22,'#fff0c5');ctx.restore();}
    }}));
    currentResidents().forEach(n=>drawables.push({y:n.y,draw:()=>actor(ctx,n.x,n.y,n.shirt,n.hair,n.moving,false,n.direction,n.walkDistance,n.running,n.id)}));
    peers.forEach(p=>{if(!interior&&p.map===state.map)drawables.push({y:p.y,draw:()=>{const gaitDistance=p.walkDistance+(p.moving?Math.min(.2,Math.max(0,animation-p.receivedAt))*(p.running?297:180):0);actor(ctx,p.x,p.y,p.color,'#544152',p.moving,true,p.direction,gaitDistance,p.running,p.id);}});});
    if(pet&&pet.map===state.map)drawables.push({y:pet.y,draw:()=>drawPet(ctx,pet)});
    drawables.push({y:state.y,draw:()=>{actor(ctx,state.x,state.y,'#579b9c','#564247',state.moving,true,playerDirection,walkDistance,playerRunning,'player');if(swing>0){const angle=reducedMotion?0:(.25-swing)/.25*1.8-.9,heading={up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2}[swingDirection];ctx.save();ctx.translate(state.x,state.y-22);ctx.rotate(heading+angle);rect(ctx,0,-42,5,38,'#dfe9dc');rect(ctx,-5,-8,15,4,'#e7c885');rect(ctx,0,-4,5,13,'#937052');ctx.restore();}}});
    drawables.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    for(const p of combat.projectiles){pixelEllipse(ctx,p.x,p.y,14,14,'#d8a2b8');rect(ctx,p.x-2,p.y-2,4,4,'#fff0ba');}
    drawActorLabels();
    if(near){ctx.strokeStyle='#fff0ae';ctx.lineWidth=2;ctx.strokeRect(near.x-22,near.y-14,44,22);}
    if(!interior)E.drawAir(ctx,world[state.map].ambient,animation,ambientOptions);
    drawEffects();
    particles.filter(p=>p.map===state.map).forEach(p=>{ctx.globalAlpha=clamp(p.life/.65,0,1);rect(ctx,p.x,p.y,4,4,p.color);});ctx.globalAlpha=1;
    if(!interior&&C.weather(state)==='rain')E.drawSplashPool(ctx,splashSystem,{viewport:{x:camera.x,y:camera.y,width:viewWidth,height:viewHeight},reducedMotion});
    ctx.restore();
    // Rain is drawn before the darkness mask, so lamps illuminate the rainy scene too.
    if(!interior&&C.weather(state)==='rain')E.drawRain(ctx,viewWidth,viewHeight,animation,{reducedMotion,night:C.isNight(state)});
    if(!interior)drawLighting();
    if(!interior&&!reducedMotion&&state.upgrades.includes('beacon')&&state.map==='village'){for(let i=0;i<15;i++){const x=(i*79+Math.sin(animation+i)*40)%viewWidth,y=70+(i*31)%350+Math.sin(animation*1.5+i)*10;rect(ctx,x,y,3,3,'#fff1a9');}}
    drawMinimap();
  }
  function drawMinimap() {
    if(interior||!Mini||!minimapOpen||orientationBlocked)return;
    const time=performance.now();if(state.map===lastMinimapMap&&time-lastMinimap<200)return;
    lastMinimap=time;lastMinimapMap=state.map;
    Mini.draw(miniContext,{width:miniCanvas.width,height:miniCanvas.height,map:state.map,terrain:terrain(state.map),worldWidth:1600,worldHeight:1100,
      player:state,npcs:npcs.map(n=>({...n,marker:npcMarker(n)})),peers:[...peers.values()],objects:world[state.map].objects,target:guideNPC(),
      camera:{...camera,width:viewWidth,height:viewHeight}});
  }
  // --- FEATURE 16: PROCEDURAL SUNRISE TITLE SCREEN DATA & HELPERS ---
  const TITLE_BAYER_4X4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  const TITLE_SKY_BANDS = [
    { yEnd: 64,  color: '#df9b8e' }, // Dawn Mauve
    { yEnd: 136, color: '#f4b486' }, // Warm Peach
    { yEnd: 216, color: '#f8cf94' }, // Sunrise Apricot
    { yEnd: 304, color: '#fce2ab' }, // Dawn Amber
    { yEnd: 396, color: '#fff3c8' }  // Horizon Glow Cream
  ];

  const TITLE_FAR_MOUNTAINS = [
    { x: -60,  peakY: 220, w: 280 },
    { x: 160,  peakY: 195, w: 320 },
    { x: 420,  peakY: 230, w: 260 },
    { x: 620,  peakY: 180, w: 340 },
    { x: 900,  peakY: 210, w: 290 },
    { x: 1140, peakY: 175, w: 330 },
    { x: 1380, peakY: 225, w: 280 }
  ];

  const TITLE_NEAR_RIDGES = [
    { x: -40,  peakY: 290, w: 340 },
    { x: 240,  peakY: 275, w: 320 },
    { x: 500,  peakY: 310, w: 280 },
    { x: 740,  peakY: 265, w: 350 },
    { x: 1040, peakY: 280, w: 300 },
    { x: 1280, peakY: 270, w: 320 }
  ];

  const TITLE_CIRRUS_CLOUDS = [
    { initX: 80,   y: 45,  w: 160, h: 10 },
    { initX: 480,  y: 65,  w: 210, h: 12 },
    { initX: 890,  y: 40,  w: 180, h: 9 },
    { initX: 1260, y: 70,  w: 150, h: 11 }
  ];

  const TITLE_CUMULUS_CLOUDS = [
    { initX: 20,   y: 110, w: 140, h: 22 },
    { initX: 260,  y: 150, w: 180, h: 26 },
    { initX: 540,  y: 95,  w: 130, h: 20 },
    { initX: 790,  y: 160, w: 160, h: 24 },
    { initX: 1050, y: 120, w: 150, h: 22 },
    { initX: 1320, y: 140, w: 170, h: 25 }
  ];

  const TITLE_VALLEY_STRATUS = [
    { initX: 120,  y: 285, w: 220, h: 8 },
    { initX: 520,  y: 320, w: 180, h: 7 },
    { initX: 860,  y: 295, w: 240, h: 8 },
    { initX: 1220, y: 315, w: 190, h: 7 }
  ];

  function drawTitle() {
    const c = tc;

    // 1. DITHERED SUNRISE SKY
    let prevY = 0;
    for (let b = 0; b < TITLE_SKY_BANDS.length; b++) {
      const band = TITLE_SKY_BANDS[b];
      rect(c, 0, prevY, 1440, band.yEnd - prevY, band.color);

      // Bayer 4x4 dither transition into next band
      if (b < TITLE_SKY_BANDS.length - 1) {
        const nextColor = TITLE_SKY_BANDS[b + 1].color;
        const transY = band.yEnd - 8;
        for (let dy = 0; dy < 16; dy += 4) {
          const t = dy / 16;
          const py = transY + dy;
          const by = Math.floor(py / 4) % 4;
          for (let px = 0; px < 1440; px += 4) {
            const bx = Math.floor(px / 4) % 4;
            if (t > TITLE_BAYER_4X4[by][bx] / 16) {
              rect(c, px, py, 4, 4, nextColor);
            }
          }
        }
      }
      prevY = band.yEnd;
    }

    // 2. SUNRISE SUN & MULTI-TIER DAWN HALO
    pixelEllipse(c, 1120, 140, 140, 140, '#fde3b040');
    pixelEllipse(c, 1120, 140, 104, 104, '#fff0c2');
    pixelEllipse(c, 1120, 140, 72, 72, '#fffbe8');

    // 3. LAYER 1: HIGH CIRRUS CLOUDS (Speed: 1.8 px/s)
    for (let i = 0; i < TITLE_CIRRUS_CLOUDS.length; i++) {
      const cloud = TITLE_CIRRUS_CLOUDS[i];
      const cx = ((cloud.initX + animation * 1.8) % 1640) - 150;
      rect(c, cx, cloud.y, cloud.w, cloud.h, '#fff5de');
      rect(c, cx + 15, cloud.y - 3, cloud.w - 30, 3, '#fffbf2');
      rect(c, cx + 8, cloud.y + cloud.h, cloud.w - 16, 2, '#fbe0ca');
    }

    // 4. LAYER 2: FAR MOUNTAIN SILHOUETTES (Alpine Peaks with Snowcaps)
    for (let i = 0; i < TITLE_FAR_MOUNTAINS.length; i++) {
      const m = TITLE_FAR_MOUNTAINS[i];
      const peakX = m.x + m.w / 2;
      // Main mountain body
      c.fillStyle = '#9bb0ab';
      c.beginPath();
      c.moveTo(m.x, 396);
      c.lineTo(peakX, m.peakY);
      c.lineTo(m.x + m.w, 396);
      c.closePath();
      c.fill();

      // East-facing sunlit slope
      c.fillStyle = '#b4c7c1';
      c.beginPath();
      c.moveTo(peakX, m.peakY);
      c.lineTo(m.x + m.w, 396);
      c.lineTo(peakX + 15, 396);
      c.closePath();
      c.fill();

      // Snowcap
      const snowHeight = 32;
      const snowPeakY = m.peakY;
      const snowBaseY = snowPeakY + snowHeight;
      const snowLeft = peakX - (m.w / 2) * (snowHeight / (396 - m.peakY));
      const snowRight = peakX + (m.w / 2) * (snowHeight / (396 - m.peakY));
      c.fillStyle = '#fffbe8';
      c.beginPath();
      c.moveTo(snowLeft, snowBaseY);
      c.lineTo(peakX, snowPeakY);
      c.lineTo(snowRight, snowBaseY);
      c.closePath();
      c.fill();

      // Snow shadow facet (west slope)
      c.fillStyle = '#dce8e4';
      c.beginPath();
      c.moveTo(snowLeft, snowBaseY);
      c.lineTo(peakX, snowPeakY);
      c.lineTo(peakX - 4, snowBaseY);
      c.closePath();
      c.fill();
    }

    // Atmospheric valley mist at far mountain base
    for (let x = 0; x < 1440; x += 8) {
      if ((x % 16) === 0) rect(c, x, 380, 8, 8, '#fff3c860');
      rect(c, x, 388, 8, 8, '#fff3c890');
    }

    // 5. LAYER 3: MID CUMULUS CLOUDS (Speed: 5.2 px/s)
    for (let i = 0; i < TITLE_CUMULUS_CLOUDS.length; i++) {
      const cloud = TITLE_CUMULUS_CLOUDS[i];
      const cx = ((cloud.initX + animation * 5.2) % 1700) - 200;
      // Main cloud body
      rect(c, cx, cloud.y, cloud.w, cloud.h, '#fff6dc');
      // Sunlit upper puffs
      rect(c, cx + 18, cloud.y - 14, Math.floor(cloud.w * 0.45), 14, '#fffef0');
      rect(c, cx + Math.floor(cloud.w * 0.4), cloud.y - 10, Math.floor(cloud.w * 0.42), 10, '#fffef0');
      // Underbelly lavender-peach shade
      rect(c, cx + 12, cloud.y + cloud.h - 4, cloud.w - 24, 6, '#ebd6c5');
    }

    // 6. LAYER 4: NEAR MOUNTAIN RIDGES (Dual-tone Forest Slopes)
    for (let i = 0; i < TITLE_NEAR_RIDGES.length; i++) {
      const r = TITLE_NEAR_RIDGES[i];
      const peakX = r.x + r.w / 2;
      // Left slope (shaded)
      c.fillStyle = '#6c8976';
      c.beginPath();
      c.moveTo(r.x, 440);
      c.lineTo(peakX, r.peakY);
      c.lineTo(peakX, 440);
      c.closePath();
      c.fill();

      // Right slope (lit by morning sun)
      c.fillStyle = '#8aa88e';
      c.beginPath();
      c.moveTo(peakX, r.peakY);
      c.lineTo(r.x + r.w, 440);
      c.lineTo(peakX, 440);
      c.closePath();
      c.fill();

      // Sharp ridge highlight rim
      rect(c, peakX - 2, r.peakY, 4, 18, '#a8c5ab');
    }

    // 7. LAYER 5: LOW VALLEY STRATUS / DRIFTING MIST (Speed: 3.2 px/s)
    for (let i = 0; i < TITLE_VALLEY_STRATUS.length; i++) {
      const s = TITLE_VALLEY_STRATUS[i];
      const sx = ((s.initX + animation * 3.2) % 1640) - 150;
      rect(c, sx, s.y, s.w, s.h, '#fff1d088');
      rect(c, sx + 20, s.y + 1, s.w - 40, s.h - 2, '#fff1d0bb');
    }

    // 8. MEADOW GROUND & SOIL FOREGROUND
    rect(c, 0, 396, 1440, 504, '#a5bd82');
    // Meadow dithering transition
    for (let y = 396; y < 440; y += 8) {
      for (let x = 0; x < 1440; x += 16) {
        if ((x + y) % 32 === 0) rect(c, x, y, 8, 4, '#b4cc90');
      }
    }
    rect(c, 0, 550, 1440, 350, '#94b47a');
    for (let y = 550; y < 580; y += 6) {
      for (let x = 0; x < 1440; x += 12) {
        if ((x + y) % 24 === 0) rect(c, x, y, 6, 3, '#a2be88');
      }
    }
    for (let y = 415; y < 900; y += 30) {
      for (let x = 0; x < 1440; x += 30) {
        if ((x + y) % 90 === 0) rect(c, x + 7, y + 5, 4, 3, '#c4cd9360');
      }
    }

    // 9. VILLAGE ROADS & PROPS PREVIEW
    rect(c, 720, 595, 630, 68, '#6f925f');
    rect(c, 718, 587, 635, 65, '#decba0');
    rect(c, 967, 410, 70, 490, '#dece9e');

    // 10. MULTI-DEPTH POND, WATER REFLECTIONS & RIPPLE SHIMMER
    // Embankment
    rect(c, 1110, 700, 330, 170, '#e2d4a1');
    rect(c, 1116, 708, 324, 162, '#466963');
    // Shallow water
    rect(c, 1125, 715, 315, 145, '#5c9e97');
    // Deep water
    rect(c, 1140, 730, 300, 120, '#3a706b');
    rect(c, 1160, 755, 280, 85, '#2e5753');

    // Vertical sunrise sun reflection column in water
    rect(c, 1135, 718, 90, 140, '#f6e3ab38');
    rect(c, 1145, 725, 65, 125, '#fce8b150');
    rect(c, 1155, 735, 45, 105, '#fff4cc65');

    // Animated horizontal ripple shimmer lines (Frozen when reducedMotion is true)
    for (let k = 0; k < 9; k++) {
      const ripY = 724 + k * 13;
      const ripW = 24 + ((k * 17) % 35);
      const ripPhase = k * 1.1;
      const ripShift = Math.sin(animation * 1.6 + ripPhase) * 8;
      const ripPulse = Math.sin(animation * 2.2 + ripPhase) * 5;

      // Ripple in golden sun reflection column
      const goldX = 1145 + ((k * 13) % 40) + ripShift;
      rect(c, goldX, ripY, Math.max(12, ripW + ripPulse), 2, '#fffdf0');
      rect(c, goldX + 3, ripY + 2, Math.max(8, ripW - 6), 1, '#fdebb3');

      // Ambient ripples across water basin
      const ambX1 = 1240 + ((k * 29) % 90) + ripShift * 0.7;
      rect(c, ambX1, ripY + 4, Math.max(14, ripW * 0.8), 2, '#8ee0d3');
      const ambX2 = 1350 + ((k * 23) % 65) - ripShift * 0.6;
      rect(c, ambX2, ripY - 2, Math.max(10, ripW * 0.7), 1, '#b8f2e8');
    }

    // 11. VILLAGE PREVIEW BUILDINGS, TREES, ACTORS & PARTICLES
    const preview = [
      { x: 925,  y: 570, w: 146, h: 135, roof: '#bc775d', name: 'Nhà của những điều ước', kind: 'home' },
      { x: 1220, y: 520, w: 142, h: 126, roof: '#718fa3', name: 'Xưởng Gió', kind: 'home' },
      { x: 740,  y: 780, w: 140, h: 124, roof: '#ae91a2', name: 'Quán trà', kind: 'home' }
    ];
    preview.forEach(b => house(c, b));

    [[690, 500], [1070, 490], [1380, 585], [1060, 840], [600, 790], [1320, 680], [1420, 780], [1180, 405], [850, 405]]
      .forEach(([x, y], i) => tree(c, x, y, 1.6, i % 3));

    lamp(c, 875, 653);
    lamp(c, 1070, 675);

    actor(c, 972, 650, '#5f9895', '#55414b', true, true, 'right', animation * 55, false, 'player');
    actor(c, 1130, 630, '#d98870', '#614331', false, false, 'left', 0, false, 'mira');

    for (let i = 0; i < 12; i++) {
      const x = 700 + (i * 57) % 720, y = 420 + (i * 43) % 440;
      rect(c, x, y, 3, 8, '#6e985c');
      rect(c, x - 4, y, 10, 4, ['#f4dc8f', '#eebca5', '#fff1c3'][i % 3]);
    }
    for (let i = 0; i < 8; i++) {
      const x = 800 + i * 83 + Math.sin(animation + i) * 10;
      const y = 310 + i * 25 + Math.cos(animation * 0.7 + i) * 15;
      rect(c, x, y, 3, 3, '#fff2b9');
    }

    // Slow migrating star trails keep the sunrise title alive.
    const sx = 1120 + (animation * 22) % 500, sy = 40 + (animation * 9) % 190;
    rect(c, sx, sy, 5, 5, '#fff4ce');
    rect(c, sx - 12, sy - 6, 10, 2, '#fff4ce80');
  }
  function loop(time) {
    const dt=Math.min((time-lastTime)/1000||0,.05);lastTime=time;
    if(running){if(festivalPending&&!modal&&!orientationBlocked&&!tutorialPending)showFestival(festivalIndex);update(dt);drawGame();if(modal==='festival'){if(!reducedMotion)festivalTime+=dt;drawFestival();}}else{if(!reducedMotion)animation+=dt;drawTitle();}
    requestAnimationFrame(loop);
  }
  // Phòng có biên riêng; camera không cuộn ra vùng trống của map ngoài trời khi đứng sát cửa.
  function updateCamera(){const b=interior?{left:320,top:240,right:1280,bottom:920}:{left:0,top:0,right:1600,bottom:1100};camera.x=clamp(Math.round(state.x-viewWidth/2),b.left,Math.max(b.left,b.right-viewWidth));camera.y=clamp(Math.round(state.y-viewHeight/2),b.top,Math.max(b.top,b.bottom-viewHeight));}
  function syncOrientation(){
    const blocked=running&&mobileLayout()&&window.innerHeight>window.innerWidth;
    if(blocked!==orientationBlocked){
      clearMovement();if(fishing){fishing=null;$('fishing').hidden=true;}
      if(blocked)setMobilePanel('');
      if(blocked&&modal){if(modal==='tutorial')tutorialPending=true;closeDialog({preserveFestival:true});}
    }
    orientationBlocked=blocked;$('rotate-notice').hidden=!blocked;
    if(running&&!blocked&&tutorialPending&&!modal)showTutorial(tutorialIndex);
  }
  function resizeViewport(){
    const visual=window.visualViewport,height=visual&&Math.abs((visual.scale||1)-1)<.01&&Number.isFinite(visual.height)&&visual.height>0?visual.height:window.innerHeight;
    if(Number.isFinite(height)&&height>0){const value=`${height}px`;if(value!==viewportHeightValue){$('game-wrapper').style.setProperty('--game-viewport-height',value);viewportHeightValue=value;}}
    syncOrientation();
    const stage=$('canvas-stage');if(!stage.clientWidth||!stage.clientHeight)return;
    viewWidth=mobileLayout()&&window.innerWidth>window.innerHeight?720:stage.clientWidth<=700?540:960;
    viewHeight=Math.max(1,Math.round(viewWidth*stage.clientHeight/stage.clientWidth));
    // Preserve pixel proportions even in tall fullscreen viewports at map bounds.
    if(viewHeight>1100){viewHeight=1100;viewWidth=Math.max(1,Math.round(viewHeight*stage.clientWidth/stage.clientHeight));}
    canvas.width=darkCanvas.width=viewWidth;canvas.height=darkCanvas.height=viewHeight;ctx.imageSmoothingEnabled=false;updateCamera();lastMinimap=-Infinity;
  }
  window.addEventListener('resize',()=>{if(window.innerWidth!==inputViewportWidth){inputViewportWidth=window.innerWidth;clearMovement();}resizeViewport();});
  window.visualViewport?.addEventListener('resize',resizeViewport);
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
      if(scene==='journal'){
        C.event(state,'talk','mira',1,D);C.claim(state,'story01',D,'mira');C.accept(state,'side01',D);C.accept(state,'side02',D);C.event(state,'gather','wood',8,D);state.tracked='story02';
      }
      // Các fixture mới dùng ngân sách nhỏ và tiến trình cũ hợp lệ để không che khóa tài nguyên.
      if(['adventure','boss','combat'].includes(scene)){
        state=C.createState('QA Rễ Sao',D);state.upgrades=['well'];state.visited=['village','forest'];
        for(const q of D.quests.filter(q=>q.kind==='story').slice(0,5))state.quests[q.id]={status:'claimed',progress:q.objectives.map(o=>o.count)};
        state.map='forest';state.x=800;state.y=850;C.resumeStory(state,D);C.resumeAdventure(state,D);state.tracked='adv01';
        if(scene==='boss'){
          for(const proof of D.adventure.proofs.filter(p=>!['rootBoss','missing-notes','trail-repair','relic'].includes(p.id)))C.recordProof(state,proof.id,D);
          for(const id of D.adventure.mainIds.slice(0,5)){const q=D.quests.find(q=>q.id===id);state.quests[id]={status:'claimed',progress:q.objectives.map(o=>o.count)};}
          C.resumeAdventure(state,D);state.tracked='adv06';state.adventure.checkpoint='forest-rest';state.x=800;state.y=205;
        }
        if(scene==='combat'){
          state.x=760;state.y=550;playerDirection='right';world.forest.mobs=['slime','sprout','warden'].map((kind,i)=>({id:'qa-'+kind,kind,x:830+i*100,y:550,homeX:830+i*100,homeY:550,hp:CombatData.enemies[kind].maxHp,phase:i,deadUntil:0}));
        }
      }
      if(scene==='camp'){state.x=790;state.y=720;}
      // Fixture mở từ ngoài cửa để browser QA vẫn đi qua tương tác thật, không gọi API debug.
      if(scene==='homes'||scene==='caves'){
        state=C.createState('QA Nhà & Hang',D);state.upgrades=D.upgrades.map(u=>u.id);state.visited=D.regions.map(r=>r.id);
        for(const q of D.quests.filter(q=>q.kind==='story').slice(0,5))state.quests[q.id]={status:'claimed',progress:q.objectives.map(o=>o.count)};
        state.coins=1200;state.inventory.copperblade=1;state.inventory.travelercoat=1;state.inventory.meal=5;state.inventory.tea=5;state.adventure.weapon='copperblade';state.exploration.outfit='travelercoat';
        const params=new URLSearchParams(location.search),room=D.exploration.rooms.find(r=>r.id===params.get('room'))||D.exploration.rooms.find(r=>r.id===(scene==='homes'?'home-mira':'cave-forest'));
        state.map=room.map;state.x=room.x;state.y=room.y+25;
        if(params.get('checkpoint')==='loot'&&room.kind==='cave'){Exploration.readClue(state,room.id,D);room.sequence.forEach(symbol=>Exploration.puzzleInput(state,room.id,symbol,D));Exploration.solve(state,room.id,D);Exploration.markVictory(state,room.id,D);}
      }
      if(scene==='npc'){state.x=800;state.y=900;}
      if(scene==='actors'){state.x=800;state.y=810;const pose=new URLSearchParams(location.search).get('look');if(['up','down','left','right'].includes(pose))playerDirection=pose;}
      // Fixture lễ hội đi qua chuỗi nhiệm vụ hợp lệ, chỉ thao tác trên save QA của localhost.
      if(scene==='finale'||scene==='after'){
        state.upgrades=D.upgrades.filter(u=>!['greenhouse','market','boots','bag','kitchen'].includes(u.id)).map(u=>u.id);state.visited=D.regions.map(r=>r.id);state.shrines=['forest','coast','ruins'];state.chests=['chest-forest','chest-coast'];state.minutes=1200;
        for(const q of D.quests.filter(q=>q.kind==='story'))state.quests[q.id]={status:q.id===D.journey.finalQuest&&scene==='finale'?'active':'claimed',progress:q.objectives.map(o=>o.count)};
        state.tracked=scene==='finale'?D.journey.finalQuest:null;state.festivalSeen=scene==='after';
      }
      if(scene==='roads'){
        const params=new URLSearchParams(location.search),map=params.get('map'),weather=params.get('weather'),spot=params.get('spot');
        state.upgrades=D.upgrades.map(u=>u.id);if(D.regions.some(r=>r.id===map))state.map=map;
        state.x=800;state.y=550;if(spot==='south')state.y=850;if(spot==='shore'){state.x=1050;state.y=715;}if(spot==='shrine')state.y=350;
        if(spot==='observatory'&&state.map==='village'){state.x=1350;state.y=1065;}
        state.day=weather?.startsWith('rain')?2:1;state.minutes=weather==='night'||weather==='rain-night'?1200:600;
        if(state.map!=='village')state.shrines=[state.map];
      }
      // Override chỉ thuộc fixture localhost để kiểm độ rõ của báo đòn trong đêm/mưa.
      const previewWeather=new URLSearchParams(location.search).get('weather');
      if(['day','night','rain-day','rain-night'].includes(previewWeather)){state.day=previewWeather.startsWith('rain')?2:1;state.minutes=previewWeather==='night'||previewWeather==='rain-night'?1200:600;}
      $('player-name').value=state.name;refreshHUD();
    }
    globalThis.StardropQA={getState:()=>structuredClone(state),getWorld:()=>world,getCombat:()=>structuredClone(combat),getNPCs:()=>npcs,npcMarker,getGuide:guideNPC,blockedAt,interact,attack,dodge,update,drawGame,lightSources,collides,resourceReady,
      water:waterPlot,waterPlot,getPet:()=>pet,petCompanion:()=>petThePet(),petForage:item=>petForageAssist(item),
      giveGift:(npcId,itemId)=>C.giveGift(state,npcId,itemId,D),
      getPaths:(map=state.map)=>layouts[map],pathContains:(map,x,y,margin=0)=>P.contains(layouts[map],x,y,margin),getAmbientScene:(map=state.map)=>world[map].ambient,
      getEffects:()=>({effects:structuredClone(effects),particles:structuredClone(particles)}),getAnimationTime:()=>animation,isReducedMotion:()=>reducedMotion,
      getLocomotion:()=>({direction:playerDirection,distance:walkDistance,running:playerRunning,speed:moveSpeed(),touchRun,joystick:{x:joystickX,y:joystickY},joystickPointer,...(actorMotions.get('player')||{phase:0,motionWeight:0,runWeight:0})}),
      getActorMotion:id=>structuredClone(actorMotions.get(id==='player'?'player':`npc:${id}`)||{phase:0,motionWeight:0,runWeight:0,distance:0}),
      getActorLabels:actorLabels,
      getAmbientSample:(map=state.map)=>E.sampleAmbient(world[map].ambient,animation,{night:C.isNight(state),rain:C.weather(state)==='rain',upgrades:state.upgrades,shrineActive:state.shrines.includes(map),reducedMotion}),
      getActiveMobs:()=>currentArea().mobs,getInterior:()=>interior?structuredClone({...interior,returnPoint}):null,setState:s=>{Combat.resetActions(combat);if(interior&&s.map!==state.map){resetEncounter();interior=null;returnPoint=null;}state=C.restoreState(s,D);if(pet){pet.name=state.pet?.name||'Cún Sao';pet.map=state.map;}refreshHUD();},core:C,data:D,storageKey,drawTitle};
  }
})();
