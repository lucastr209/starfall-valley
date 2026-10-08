(function(root,factory){
  'use strict';
  const core=typeof module==='object'&&module.exports?require('./game-core.js'):root.StardropCore;
  const api=factory(core);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StardropSaveTransfer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(core){
  'use strict';
  const format='starfall-valley-progress',maxBytes=128*1024;
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
  function encode(state,data){
    return JSON.stringify({format,version:1,progress:core.restoreState(state,data)},null,2);
  }
  function decode(text,data){
    if(typeof text!=='string'||!text.length||text.length>maxBytes)throw new Error('File tiến trình quá lớn hoặc trống.');
    let envelope;try{envelope=JSON.parse(text);}catch(_){throw new Error('File không phải tiến trình JSON hợp lệ.');}
    const raw=envelope?.progress;
    if(!record(envelope)||envelope.format!==format||envelope.version!==1||!record(raw)||raw.version!==1||
      typeof raw.name!=='string'||!record(raw.inventory)||!record(raw.quests)||!Array.isArray(raw.upgrades)||
      !Number.isFinite(raw.day)||raw.day<1||!Number.isFinite(raw.coins)||!Number.isFinite(raw.xp)||
      !data.regions.some(region=>region.id===raw.map))throw new Error('File không đúng định dạng tiến trình Thung Lũng Sao Rơi.');
    return core.restoreState(raw,data);
  }
  return Object.freeze({encode,decode,maxBytes});
});
