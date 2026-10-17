'use strict';
const {character,world}=require('./room.cjs');
const copy=value=>structuredClone(value);

// Chỉ dùng cho test/QA localhost; production thiếu database phải dừng, không tự rơi về RAM.
class MemoryStore {
  constructor(){this.characters=new Map();this.worlds=new Map();this.events=new Map();}
  async load(id){
    if(!this.characters.has(id))this.characters.set(id,character(id));
    if(!this.worlds.has(id))this.worlds.set(id,world(id));
    return copy({character:this.characters.get(id),world:this.worlds.get(id)});
  }
  async commit(payload){
    if(this.events.has(payload.eventId))return copy(this.events.get(payload.eventId));
    const {world:w,characters:cs}=copy(payload);
    if(this.worlds.get(w.id)?.revision!==w.revision||cs.some(c=>this.characters.get(c.id)?.revision!==c.revision))throw new Error('Tiến trình xung đột. Hãy kết nối lại.');
    w.revision++;for(const c of cs)c.revision++;
    this.worlds.set(w.id,w);for(const c of cs)this.characters.set(c.id,c);
    const result={world:w,characters:cs};this.events.set(payload.eventId,result);return copy(result);
  }
  async session(){}
}
class SupabaseStore {
  constructor({url,key,anonKey,fetch:request=globalThis.fetch}){
    const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('SUPABASE_URL phải là origin HTTPS.');
    if(!key||!anonKey)throw new Error('Thiếu cấu hình Supabase.');
    this.url=parsed.origin;this.key=key;this.anonKey=anonKey;this.fetch=request;
  }
  async call(path,body,token=this.key){
    const response=await this.fetch(this.url+path,{method:body===undefined?'GET':'POST',headers:{apikey:token===this.key?this.key:this.anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error(token===this.key?'Không lưu được tiến trình trên server.':'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    return response.status===204?null:response.json();
  }
  async verifyToken(token){
    if(typeof token!=='string'||token.length<20||token.length>8192)throw new Error('Phiên đăng nhập không hợp lệ.');
    const user=await this.call('/auth/v1/user',undefined,token);
    if(!/^[0-9a-f-]{36}$/i.test(user?.id))throw new Error('Phiên đăng nhập không hợp lệ.');
    return {id:user.id,name:user.user_metadata?.full_name||user.user_metadata?.name||'Lữ khách'};
  }
  async load(id){return this.call('/rest/v1/rpc/awakening_load',{p_user:id});}
  async commit({eventId,world,characters}){
    // Một RPC là một transaction Postgres, không tách thưởng khỏi checkpoint thế giới.
    return this.call('/rest/v1/rpc/awakening_commit',{p_event:eventId,p_world:world,p_characters:characters});
  }
  async session(room){
    await this.call('/rest/v1/rpc/awakening_session',{p_id:room.sessionId,p_host:room.host,p_code:room.code,p_members:[...room.players.keys()],p_closed:room.closed});
  }
}
module.exports={MemoryStore,SupabaseStore};
