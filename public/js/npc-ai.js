/* Walking residents for Thung Lũng Sao Rơi. Pure logic, shared by Canvas and Node tests. */
(function (root) {
  'use strict';

  const WIDTH = 1600, HEIGHT = 1100, GRID = 20, COLS = WIDTH / GRID, ROWS = HEIGHT / GRID;
  const TALK_DISTANCE = 96, CLEARANCE = 4;
  const ROUTES = {
    mira: { name: 'Quảng trường · trại sao · lối lên đồi', points: [[800,550],[800,430],[790,690],[800,810]] },
    huy: { name: 'Xưởng mộc · lối tây · quảng trường', points: [[400,520],[610,410],[480,550],[350,630]] },
    linh: { name: 'Lối quán trà · quảng trường · ghế nghỉ', points: [[650,520],[730,650],[800,735],[800,550],[610,430]] },
    thao: { name: 'Giếng làng · vườn mâm xôi · trại sao', points: [[900,620],[940,700],[640,770],[490,720],[800,620]] },
    bao: { name: 'Đường chợ · sạp hàng · quảng trường', points: [[1150,520],[1290,550],[1060,960],[1000,600]] },
    nam: { name: 'Các ngọn đèn dọc đường làng', points: [[400,620],[440,730],[780,860],[1010,570],[430,430]] },
    yen: { name: 'Quảng trường · thư viện · đường ngắm sao', points: [[650,620],[920,540],[1060,410],[800,430]] },
    son: { name: 'Lối bếp chung · chợ · trại sao', points: [[1150,620],[1320,550],[1340,435],[1000,590],[1150,580]] },
    sen: { name: 'Đường rừng · bia ký ức · bìa rừng', points: [[350,550],[800,550],[800,330],[550,430]] },
    kiet: { name: 'Đường ven vịnh · bờ câu cá', points: [[350,550],[850,550],[1050,600],[1050,820],[900,550]] },
    ly: { name: 'Lối đá · bia ký ức · đường thám hiểm', points: [[350,550],[800,550],[800,310],[1030,460],[600,550]] }
  };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function seedOf(id) {
    let seed = 2166136261;
    for (const char of String(id)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    return seed || 1;
  }
  function random(npc) {
    npc._seed = (Math.imul(npc._seed, 1664525) + 1013904223) >>> 0;
    return npc._seed / 4294967296;
  }
  function createNPCs(catalog) {
    return catalog.map((entry, index) => {
      const x = clamp(Number.isFinite(entry.x) ? entry.x : 800, 25, 1575);
      const y = clamp(Number.isFinite(entry.y) ? entry.y : 550, 40, 1075);
      const route = ROUTES[entry.id] || { name: 'Đường dạo quanh nhà', points: [[x,y],[x+160,y],[x+160,y+140],[x,y+140]] };
      const npc = { ...entry, dialogue: entry.dialogue ? [...entry.dialogue] : [], x, y, homeX: x, homeY: y,
        patrolName: route.name, patrol: route.points.map(([px,py]) => ({ x: clamp(px,35,1565), y: clamp(py,50,1065) })),
        moving: false, running: false, facing: 1, direction: 'down', walkDistance: 0,
        speed: 76 + (index * 2 % 21), _seed: seedOf(entry.id),
        _routeIndex: 0, _path: [], _wait: 0, _checkedStart: false };
      npc._wait = .4 + random(npc) * .8;
      return npc;
    });
  }
  function blockedAt(map, x, y, isBlocked) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 25 + CLEARANCE || x > 1575 - CLEARANCE || y < 40 + CLEARANCE || y > 1075 - CLEARANCE) return true;
    return [[0,0],[-CLEARANCE,-CLEARANCE],[CLEARANCE,-CLEARANCE],[-CLEARANCE,CLEARANCE],[CLEARANCE,CLEARANCE]]
      .some(([dx,dy]) => isBlocked(map, x + dx, y + dy));
  }
  // Sample every four pixels so a large frame cannot hop over a trunk or narrow wall.
  function clearSegment(map, from, to, isBlocked) {
    const count = Math.max(1, Math.ceil(distance(from,to) / 4));
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      if (blockedAt(map, from.x + (to.x-from.x)*t, from.y + (to.y-from.y)*t, isBlocked)) return false;
    }
    return true;
  }
  const center = id => ({ x: (id % COLS) * GRID + GRID / 2, y: Math.floor(id / COLS) * GRID + GRID / 2 });
  function nearbyCells(point, radius, isOpen, predicate) {
    const cells = [], cx = Math.floor(point.x/GRID), cy = Math.floor(point.y/GRID), range = Math.ceil(radius/GRID);
    for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) {
      const x = cx+dx, y = cy+dy;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      const id = y*COLS+x, p = center(id), dist = distance(point,p);
      if (dist <= radius && isOpen(id) && (!predicate || predicate(p))) cells.push({ id, dist });
    }
    cells.sort((a,b) => a.dist-b.dist || a.id-b.id);
    return cells;
  }
  // Binary heap keeps path searches small even when a patrol crosses the village.
  function push(heap, item) {
    heap.push(item); let i=heap.length-1;
    while(i>0){const parent=(i-1)>>1;if(heap[parent].score<=item.score)break;heap[i]=heap[parent];i=parent;}heap[i]=item;
  }
  function pop(heap) {
    const first=heap[0],last=heap.pop();if(!heap.length)return first;
    let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;if(heap[child].score>=last.score)break;heap[i]=heap[child];i=child;}heap[i]=last;return first;
  }
  function findPath(npc, target, isBlocked) {
    const openCache = new Map();
    const isOpen = id => {
      if(!openCache.has(id)){const p=center(id);openCache.set(id,!blockedAt(npc.map,p.x,p.y,isBlocked));}
      return openCache.get(id);
    };
    const starts=nearbyCells(npc,70,isOpen,p=>clearSegment(npc.map,npc,p,isBlocked));
    const goals=nearbyCells(target,100,isOpen);
    if(!starts.length||!goals.length)return [];
    const start=starts[0].id, goal=goals[0].id, goalPoint=center(goal);
    const cost=new Map([[start,0]]), previous=new Map(), closed=new Set(), heap=[];
    const heuristic=id=>{const p=center(id);return Math.abs(p.x-goalPoint.x)+Math.abs(p.y-goalPoint.y);};
    push(heap,{id:start,score:heuristic(start)});
    while(heap.length){
      const current=pop(heap).id;if(closed.has(current))continue;
      if(current===goal){
        const path=[];let id=goal;while(id!==start){path.push(center(id));id=previous.get(id);}path.push(center(start));path.reverse();
        // Retain the grid corners: an obstacle between two open cells still blocks walking.
        return path;
      }
      closed.add(current);const col=current%COLS,row=Math.floor(current/COLS);
      const neighbors=[];if(col>0)neighbors.push(current-1);if(col<COLS-1)neighbors.push(current+1);if(row>0)neighbors.push(current-COLS);if(row<ROWS-1)neighbors.push(current+COLS);
      for(const next of neighbors){
        if(closed.has(next)||!isOpen(next)||!clearSegment(npc.map,center(current),center(next),isBlocked))continue;
        const tentative=cost.get(current)+GRID;
        if(!cost.has(next)||tentative<cost.get(next)){cost.set(next,tentative);previous.set(next,current);push(heap,{id:next,score:tentative+heuristic(next)});}
      }
    }
    return [];
  }
  function recoverStart(npc, isBlocked) {
    if (!blockedAt(npc.map,npc.x,npc.y,isBlocked)) return true;
    const cells=nearbyCells(npc,120,id=>{const p=center(id);return !blockedAt(npc.map,p.x,p.y,isBlocked);});
    if(!cells.length)return false;
    Object.assign(npc,center(cells[0].id));npc._path=[];return true;
  }
  function beginWalk(npc,isBlocked) {
    for(let i=0;i<npc.patrol.length;i++){
      npc._routeIndex=(npc._routeIndex+1)%npc.patrol.length;
      const target=npc.patrol[npc._routeIndex];
      if(distance(npc,target)<30)continue;
      const path=findPath(npc,target,isBlocked);
      if(path.length){npc._path=path;return;}
    }
    // Disconnected terrain is retried later, so one unreachable stop never freezes an NPC forever.
    npc._wait=1;
  }
  function faceDirection(npc,dx,dy,threshold=1e-9) {
    if(Math.abs(dx)<=threshold&&Math.abs(dy)<=threshold)return;
    if(Math.abs(dx)>threshold)npc.facing=dx>0?1:-1;
    npc.direction=Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
  }
  function updateNPCs(npcs,dt,options) {
    if(!Number.isFinite(dt)||dt<=0)return;
    const elapsed=Math.min(dt,.5), map=options.map, player=options.player;
    const isBlocked=typeof options.isBlocked==='function'?options.isBlocked:()=>false;
    npcs.forEach(npc=>{
      npc.moving=false;
      if(npc.map!==map)return;
      if(!npc._checkedStart){if(!recoverStart(npc,isBlocked))return;npc._checkedStart=true;}
      const playerHere=player&&Number.isFinite(player.x)&&Number.isFinite(player.y)&&(!player.map||player.map===map);
      if(playerHere&&distance(npc,player)<=TALK_DISTANCE){faceDirection(npc,player.x-npc.x,player.y-npc.y,3);return;}
      if(npc._wait>0){npc._wait=Math.max(0,npc._wait-elapsed);return;}
      if(!npc._path.length)beginWalk(npc,isBlocked);
      let remaining=npc.speed*elapsed;
      while(remaining>0&&npc._path.length){
        const waypoint=npc._path[0], dist=distance(npc,waypoint);
        if(dist<.01){npc._path.shift();continue;}
        const step=Math.min(remaining,dist,4), dx=(waypoint.x-npc.x)/dist*step,dy=(waypoint.y-npc.y)/dist*step;
        const next={x:npc.x+dx,y:npc.y+dy};
        if(playerHere&&distance(next,player)<=TALK_DISTANCE)break;
        if(blockedAt(npc.map,next.x,next.y,isBlocked)){
          npc._path=[];npc._wait=.3;break;
        }
        faceDirection(npc,dx,dy);
        npc.x=next.x;npc.y=next.y;npc.moving=true;npc.walkDistance+=Math.hypot(dx,dy);remaining-=step;
        if(step>=dist-.01)npc._path.shift();
      }
      if(npc.moving&&!npc._path.length)npc._wait=.8+random(npc);
    });
  }

  const api={createNPCs,updateNPCs,TALK_DISTANCE,GRID};
  root.StardropNPC=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
