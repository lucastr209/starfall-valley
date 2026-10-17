'use strict';
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');const {Room}=require('./room.cjs');const {MemoryStore,SupabaseStore}=require('./store.cjs');
const {CLIENT_FILES,securityHeaders}=require('../../config/deployment.cjs');
const {parseOrigins,originAllowed,createRateLimiter,createIpResolver}=require('../policy.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QA_IDS=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
function createCoopServer(options={}){
  const qa=options.qa===true;
  const store=options.store||(qa?new MemoryStore():new SupabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,anonKey:process.env.SUPABASE_ANON_KEY}));
  const verify=options.verifyToken||(qa?async token=>{const n=Number(token.replace(/^qa:/,''));if(!/^qa:[1-4]$/.test(token))throw new Error('Sai tài khoản QA.');return{id:QA_IDS[n-1],name:'Lữ khách QA '+n};}:token=>store.verifyToken(token));
  const origins=parseOrigins(options.allowedOrigins||process.env.ALLOWED_ORIGINS||'');
  const resolveIp=createIpResolver(process.env.TRUSTED_PROXY_IPS||'');
  const rooms=new Map(),memberships=new Map(),connections=new Map();let stopping=false,joining=Promise.resolve();
  const connectLimit=createRateLimiter({limit:40,windowMs:60000}),httpLimit=createRateLimiter({limit:240,windowMs:60000});
  const send=(ws,m)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>262144)return ws.terminate();ws.send(JSON.stringify(m));}};
  const fail=(ws,message)=>send(ws,{v:1,type:'error',message});
  const broadcast=r=>{for(const p of r.players.values()){const ws=connections.get(p.id);if(ws)send(ws,r.snapshot(p.id));}};
  const persist=async r=>{if(r.dirty)r.saved(await store.commit(r.durable()));};
  async function stopRoom(r,message='Phòng đã đóng. Tiến trình đã lưu được giữ nguyên.'){
    if(r.stopped)return;r.stopped=true;r.closed=true;rooms.delete(r.code);
    for(const p of r.players.values()){
      memberships.delete(p.id);const ws=connections.get(p.id);if(ws){send(ws,{v:1,type:'closed',message});ws.close(1000);}
    }
    try{await store.session(r);}catch{console.error('Không ghi được trạng thái đóng phòng.');}
  }
  // Chuỗi riêng từng phòng giữ thứ tự lệnh, tick và transaction; không tạo hàng đợi tick khi DB chậm.
  function queue(r,task){
    r.pending=(r.pending||0)+1;
    const result=(r.tail||Promise.resolve()).then(task);
    r.tail=result.catch(()=>{}).finally(()=>{r.pending--;});return result;
  }
  const server=http.createServer((req,res)=>{
    const origin=req.headers.origin,allowed=origin&&originAllowed(req,origins,false);
    const headers={...securityHeaders(options.onlineUrl||'',options.coopUrl||''),'Cache-Control':'no-store'};
    if(allowed){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';}
    if(!httpLimit.allow(resolveIp(req))){res.writeHead(429,headers);res.end();return;}
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,headers);res.end();return;}
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health'||url.pathname==='/coop/config'){
      const data=url.pathname==='/health'?{ok:!stopping,mode:qa?'qa':'production',rooms:rooms.size}:{v:1,qa,supabaseUrl:qa?'':store.url,supabaseKey:qa?'':store.anonKey};
      res.writeHead(200,{...headers,'Content-Type':'application/json'});res.end(req.method==='HEAD'?'':JSON.stringify(data));return;
    }
    const asset=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!CLIENT_FILES.includes(asset)){res.writeHead(404,headers);res.end('Not found');return;}
    const type=asset.endsWith('.html')?'text/html; charset=utf-8':asset.endsWith('.js')?'text/javascript; charset=utf-8':asset.endsWith('.css')?'text/css; charset=utf-8':asset.endsWith('.png')?'image/png':'application/json';
    res.writeHead(200,{...headers,'Content-Type':type});
    if(req.method==='HEAD')res.end();else fs.createReadStream(path.join(__dirname,'../../public',asset)).on('error',()=>res.destroy()).pipe(res);
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:12288,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    const ip=resolveIp(req),local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const perIp=[...wss.clients].filter(ws=>ws.ip===ip).length;
    if(stopping||req.url!=='/coop'||!originAllowed(req,origins,false)||(qa&&!local)){
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
    }
    if(wss.clients.size>=60||perIp>=8||!connectLimit.allow(ip)){
      socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');return;
    }
    wss.handleUpgrade(req,socket,head,ws=>{ws.ip=ip;wss.emit('connection',ws,req);});
  });
  wss.on('connection',ws=>{
    let authenticated=false,authenticating=false,received=0,windowAt=Date.now();ws.alive=true;
    const deadline=setTimeout(()=>{if(!authenticated)ws.close(1008,'Authentication timeout');},10000);deadline.unref();
    ws.on('error',()=>{});ws.on('pong',()=>{ws.alive=true;});
    ws.on('message',async(raw,binary)=>{
      const now=Date.now();if(now-windowAt>=1000){windowAt=now;received=0;}if(++received>40){ws.close(1008,'Rate limit');return;}
      try{
        if(binary)throw new Error('Gói tin không hợp lệ.');const m=JSON.parse(raw.toString());
        if(m?.v!==1)throw new Error('Sai phiên bản giao thức. Hãy tải lại trang.');
        if(!authenticated){
          if(authenticating||m.type!=='hello')throw new Error('Cần đăng nhập.');authenticating=true;
          const token=m.token;if(typeof token!=='string'||token.length>8192)throw new Error('Sai đăng nhập.');
          const user=await verify(token);if(ws.readyState!==WebSocket.OPEN)return;
          // Khóa nhận diện xuyên các phòng để hai hello song song không tạo hai bản nhân vật.
          const join=async()=>{
            const previous=memberships.get(user.id);let r;
            if(m.code!==undefined&&m.code!==''){
              if(typeof m.code!=='string'||!/^[A-Z2-9]{6}$/.test(m.code))throw new Error('Mã phòng không hợp lệ.');
              r=rooms.get(m.code);if(!r||r.closed)throw new Error('Không tìm thấy phòng.');
              if(previous&&previous!==r.code)throw new Error('Bạn đang ở phòng khác.');
            }else{
              if(previous)throw new Error('Bạn đang ở một phòng. Hãy kết nối lại bằng mã phòng.');
              if(rooms.size>=15)throw new Error('Máy chủ đang đầy.');
            }
            const saved=await store.load(user.id);if(ws.readyState!==WebSocket.OPEN)return;
            if(!r){let code;do{code=Array.from(crypto.randomBytes(6),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');}while(rooms.has(code));
              r=new Room({host:user,character:saved.character,world:saved.world,code});r.sessionId=crypto.randomUUID();rooms.set(code,r);
            }else await queue(r,async()=>{if(r.closed)throw new Error('Phòng đã đóng.');r.join(user,saved.character);});
            try{await store.session(r);}catch{await stopRoom(r,'Không lưu được phiên. Hãy thử lại.');throw new Error('Không tạo được phiên chơi.');}
            if(r.closed||rooms.get(r.code)!==r)throw new Error('Phòng đã đóng trong lúc tham gia. Hãy tạo phòng mới.');
            if(ws.readyState!==WebSocket.OPEN){r.disconnect(user.id);return;}
            const old=connections.get(user.id);connections.set(user.id,ws);memberships.set(user.id,r.code);ws.userId=user.id;ws.roomCode=r.code;
            if(old&&old!==ws)old.close(4001,'Connected elsewhere');
            authenticated=true;clearTimeout(deadline);
            // getUser đã xác minh token; exp chỉ dùng để đóng socket đúng lúc hết phiên.
            let expiry=Date.now()+3600000;try{const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));if(Number.isFinite(claims.exp))expiry=claims.exp*1000;}catch{}
            ws.expiry=expiry;broadcast(r);
          };
          const job=joining.then(join);joining=job.catch(()=>{});await job;return;
        }
        if(connections.get(ws.userId)!==ws)throw new Error('Phiên đã chuyển sang thiết bị khác.');
        const r=rooms.get(ws.roomCode);if(!r||r.closed)throw new Error('Phòng đã đóng.');
        if(m.type!=='command')throw new Error('Gói tin không hợp lệ.');if((r.pending||0)>12)throw new Error('Đang xử lý, hãy chờ một chút.');
        await queue(r,async()=>{
          if(m.action==='leave'){
            if(ws.userId===r.host){await stopRoom(r);return;}
            r.players.delete(ws.userId);memberships.delete(ws.userId);connections.delete(ws.userId);send(ws,{v:1,type:'closed',message:'Bạn đã rời phòng.'});ws.close(1000);await store.session(r);broadcast(r);return;
          }
          r.command(ws.userId,m);
          try{await persist(r);}catch{await stopRoom(r,'Không lưu được tiến trình. Phòng đã đóng; kết nối lại để khôi phục checkpoint đã lưu.');return;}
          if(m.action!=='input')broadcast(r);
        });
      }catch(error){fail(ws,error instanceof SyntaxError?'Gói tin không hợp lệ.':error.message);if(!authenticated)ws.close(1008,'Authentication failed');}
    });
    ws.on('close',()=>{clearTimeout(deadline);if(ws.userId&&connections.get(ws.userId)===ws){connections.delete(ws.userId);const r=rooms.get(ws.roomCode);if(r&&!r.closed)queue(r,async()=>{r.disconnect(ws.userId);broadcast(r);}).catch(()=>{});}});
  });
  let tickCount=0;
  const timer=setInterval(()=>{
    tickCount++;
    for(const r of rooms.values())if(!r.pending&&!r.closed)queue(r,async()=>{
      r.tick(.05);
      if(r.closed){await stopRoom(r,'Chủ phòng đã vắng mặt quá 60 giây. Checkpoint được giữ nguyên.');return;}
      try{await persist(r);}catch{await stopRoom(r,'Không lưu được tiến trình. Hãy kết nối lại để khôi phục checkpoint.');return;}
      if(tickCount%2===0)broadcast(r);
    }).catch(()=>{stopRoom(r,'Phiên gặp lỗi. Checkpoint đã lưu được giữ nguyên.');});
  },50);timer.unref();
  const heartbeat=setInterval(()=>{
    connectLimit.prune();httpLimit.prune();
    for(const ws of wss.clients){if(!ws.alive||Date.now()>ws.expiry){ws.terminate();continue;}ws.alive=false;ws.ping();}
  },10000);heartbeat.unref();
  let shutdown;
  const close=()=>shutdown|| (shutdown=(async()=>{stopping=true;clearInterval(timer);clearInterval(heartbeat);await Promise.all([...rooms.values()].map(r=>queue(r,async()=>{await persist(r);await stopRoom(r,'Máy chủ đang khởi động lại. Checkpoint được giữ nguyên.');}).catch(()=>{})));for(const ws of wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));wss.close();})());
  return{server,rooms,store,close};
}
if(require.main===module){
  const qa=process.env.COOP_QA==='1';
  if(qa&&!['127.0.0.1','localhost','::1'].includes(process.env.HOST||''))throw new Error('COOP_QA chỉ được bind HOST loopback.');
  if(!qa&&!process.env.ALLOWED_ORIGINS)throw new Error('Production cần ALLOWED_ORIGINS chính xác.');
  const app=createCoopServer({qa,coopUrl:process.env.COOP_SERVER_URL||''});
  app.server.listen(Number(process.env.PORT)||4180,process.env.HOST||'0.0.0.0',()=>console.log('Thức Tỉnh: http://'+(process.env.HOST||'localhost')+':'+(Number(process.env.PORT)||4180)+'/awakening.html'+(qa?'?qa=1':'')));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>{process.exitCode=0;}));
}
module.exports={createCoopServer,QA_IDS,UUID};
