(function(root,factory){'use strict';const api=factory(()=>typeof module==='object'&&module.exports?require('./game-core.js'):root.StardropCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.StardropExploration=api;})(typeof globalThis!=='undefined'?globalThis:this,function(core){
  'use strict';
  const fail=message=>({ok:false,message}),ok=message=>({ok:true,message});
  const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const create=()=>({visited:[],clues:[],solved:[],cleared:[],looted:[],puzzles:{},outfit:null});
  const room=(id,data)=>data.exploration?.rooms.find(r=>r.id===id);
  function unlocked(s,id,data){const r=room(id,data);return !!r&&(r.map!=='coast'||s.upgrades.includes('bridge'))&&(r.map!=='ruins'||s.upgrades.includes('archive'))&&(r.kind!=='cave'||s.quests.story05?.status==='claimed');}
  // Save chỉ nhận ID có thật; chuỗi clue → solved → cleared → looted không được nhảy bước.
  function restore(raw,s,data){
    const e=create(),v=record(raw),valid=(list,predicate)=>(Array.isArray(list)?[...new Set(list.filter(id=>typeof id==='string'&&predicate(id)))]:[]);
    e.visited=valid(v.visited,id=>unlocked(s,id,data));e.clues=valid(v.clues,id=>room(id,data)?.kind==='cave'&&unlocked(s,id,data));
    e.solved=valid(v.solved,id=>e.clues.includes(id));e.cleared=valid(v.cleared,id=>e.solved.includes(id));e.looted=valid(v.looted,id=>e.cleared.includes(id));
    for(const r of data.exploration?.rooms||[]){const sequence=record(v.puzzles)[r.id];if(r.kind==='cave'&&e.clues.includes(r.id)&&Array.isArray(sequence)&&sequence.length<=3&&sequence.every(symbol=>['leaf','moon','star'].includes(symbol)))e.puzzles[r.id]=sequence.slice();}
    const outfit=data.exploration?.equipment[v.outfit];if(outfit?.slot==='outfit'&&s.inventory[v.outfit]>0)e.outfit=v.outfit;
    return e;
  }
  // Tính toàn bộ tiền và dung lượng trước khi ghi để giao dịch thất bại không mất vật phẩm/xu.
  function buy(s,id,n,data){
    const entry=data.exploration?.shop.find(e=>e.item===id);
    if(!entry||!Number.isSafeInteger(n)||n<1||n>99)return fail('Số lượng hoặc vật phẩm không hợp lệ.');
    if(entry.unique&&(n!==1||s.inventory[id]>0))return fail('Trang bị này chỉ cần sở hữu một món.');
    const total=entry.price*n;if(s.coins<total)return fail('Bạn chưa đủ xu.');
    if(s.inventory[id]+n>core().capacity(s))return fail('Túi đầy. Hãy dọn chỗ trước khi mua.');
    s.coins-=total;s.inventory[id]+=n;return ok(`Đã mua ${n} ${data.items[id].name} · −${total} xu.`);
  }
  function equip(s,id,data){
    if(id==='starter'){s.adventure.weapon='starter';return ok('Đã dùng kiếm khởi đầu.');}
    if(id==='none'){s.exploration.outfit=null;return ok('Đã dùng trang phục ban đầu.');}
    const item=id==='rootblade'?{slot:'weapon'}:data.exploration?.equipment[id];
    if(!item||!(s.inventory[id]>0))return fail('Bạn chưa sở hữu trang bị này.');
    if(item.slot==='weapon')s.adventure.weapon=id;else s.exploration.outfit=id;
    return ok(`Đã trang bị ${data.items[id].name}.`);
  }
  function damage(s,data){const id=s.adventure?.weapon;return s.inventory[id]>0?(id==='rootblade'?3:data.exploration?.equipment[id]?.damage||1):1;}
  function armor(s,data){const id=s.exploration?.outfit;return s.inventory[id]>0?Math.min(3,data.exploration?.equipment[id]?.armor||0):0;}
  function enter(s,id,data){if(!unlocked(s,id,data))return fail('Lối này chưa mở. Hãy tiếp tục hành trình để mở miền và chuyến rừng đầu.');if(!s.exploration.visited.includes(id))s.exploration.visited.push(id);core().event(s,'explore',id,1,data);return ok(room(id,data).name);}
  function readClue(s,id,data){if(!unlocked(s,id,data)||room(id,data)?.kind!=='cave')return fail('Chưa thể đọc bia ở hang này.');if(!s.exploration.clues.includes(id))s.exploration.clues.push(id);return ok(room(id,data).clue);}
  function resetPuzzle(s,id,data){if(!unlocked(s,id,data)||!s.exploration.clues.includes(id)||s.exploration.solved.includes(id))return fail('Không thể xếp lại ấn này.');s.exploration.puzzles[id]=[];return ok('Đã xếp lại ấn.');}
  function puzzleInput(s,id,symbol,data){
    if(!unlocked(s,id,data)||!s.exploration.clues.includes(id))return fail('Hãy đọc bia manh mối trong hang trước.');
    if(!['leaf','moon','star'].includes(symbol)||s.exploration.solved.includes(id))return fail('Ấn không nhận ký hiệu này.');
    const sequence=s.exploration.puzzles[id]||[];if(sequence.length===3)return fail('Đã đủ ba ký hiệu. Hãy xác nhận hoặc xếp lại.');
    s.exploration.puzzles[id]=[...sequence,symbol];return ok('Đã đặt ký hiệu.');
  }
  function solve(s,id,data){const r=room(id,data),draft=s.exploration.puzzles[id];if(!unlocked(s,id,data)||!s.exploration.clues.includes(id)||!r?.sequence||!Array.isArray(draft)||draft.length!==3||!r.sequence.every((v,i)=>v===draft[i]))return fail('Ấn chưa khớp. Hãy xem lại thứ tự trên bia.');if(!s.exploration.solved.includes(id))s.exploration.solved.push(id);return ok('Ấn đã mở. Hộ Vệ đang chờ trong đấu trường.');}
  function markVictory(s,id,data){if(!unlocked(s,id,data)||!s.exploration.solved.includes(id)||s.exploration.cleared.includes(id))return fail('Hang này chưa thể ghi nhận chiến thắng.');s.exploration.cleared.push(id);core().event(s,'cave',id,1,data);return ok('Hộ Vệ đã gục. Mở rương để nhận báu vật.');}
  // Chỉ cấp cả gói sau khi kiểm đủ mọi ô túi; đầy túi vẫn giữ quyền mở rương về sau.
  function claimLoot(s,id,data){
    const r=room(id,data);if(!r?.loot||!s.exploration.cleared.includes(id)||s.exploration.looted.includes(id))return fail('Rương chưa mở hoặc đã nhận thưởng.');
    if(Object.entries(r.loot).some(([item,n])=>s.inventory[item]+n>core().capacity(s)))return fail('Túi đầy. Dọn chỗ rồi quay lại rương; phần thưởng vẫn được giữ.');
    for(const [item,n]of Object.entries(r.loot))s.inventory[item]+=n;
    s.coins+=r.coins;s.xp+=100;s.exploration.looted.push(id);return ok(`Nhận báu vật ${r.name} · +${r.coins} xu.`);
  }
  return Object.freeze({create,restore,unlocked,buy,equip,damage,armor,enter,readClue,puzzleInput,resetPuzzle,solve,markVictory,claimLoot});
});
