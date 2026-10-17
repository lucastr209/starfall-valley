(function(root,factory){
  'use strict';const core=typeof module==='object'&&module.exports?require('./game-core.js'):root.StardropCore;
  const api=factory(core);if(typeof module==='object'&&module.exports)module.exports=api;else root.StardropAdventure=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  // Chỉ mở tuyến mới sau chương giới thiệu đã có; save hoàn thành cũ đi thẳng vào nội dung mới.
  function unlocked(s){return s.quests.story05?.status==='claimed';}
  // Chọn vũ khí bằng quyền sở hữu thật, không tin chỉ số sát thương nhập từ save.
  function equip(s,id,data){if(data?.exploration){const X=typeof module==='object'&&module.exports?require('./exploration-core.js'):globalThis.StardropExploration;return X.equip(s,id,data).ok;}if(!['starter','rootblade'].includes(id)||id==='rootblade'&&!s.inventory.rootblade)return false;s.adventure.weapon=id;return true;}
  function damage(s,data){if(data?.exploration){const X=typeof module==='object'&&module.exports?require('./exploration-core.js'):globalThis.StardropExploration;return X.damage(s,data);}return s.adventure?.weapon==='rootblade'&&s.inventory.rootblade>0?3:1;}
  // Kiểm vùng, khoảng cách, tiền đề và chi phí trước mọi thay đổi; giao tranh do client nối sau kết quả.
  function interact(s,id,data){
    const o=data.adventure.objects.find(o=>o.id===id),proof=data.adventure.proofs.find(p=>p.id===id);
    if(!unlocked(s)||!o||o.map!==s.map||Math.hypot(o.x-s.x,o.y-s.y)>85)return{ok:false,message:'Hãy tới gần điểm thám hiểm.'};
    if(s.adventure.proofs.includes(id)&&o.mode!=='prepare')return{ok:false,message:id==='shortcut'?'Lối tắt đã mở. Dùng biển trạm nghỉ để đi nhanh.':'Bạn đã hoàn thành địa điểm này.'};
    const missing=(proof?.requires||o.requires||[]).filter(p=>!s.adventure.proofs.includes(p));
    if(missing.length)return{ok:false,message:'Cần hoàn thành: '+missing.map(id=>data.adventure.proofs.find(p=>p.id===id).name).join(' · ')};
    if(['encounter','boss','rescue','puzzle','prepare'].includes(o.mode))return{ok:true,mode:o.mode,id,message:o.name};
    if(o.mode==='survey'){
      if(!s.adventure.milestones.includes(id))s.adventure.milestones.push(id);
      const members=data.adventure.objects.filter(p=>p.group===o.group);
      if(members.every(p=>s.adventure.milestones.includes(p.id)))C.recordProof(s,o.group==='trail'?'trail':'inscriptions',data);
      return{ok:true,message:id==='light-1'?'Lời khắc: Lá đứng trước sao, không đứng cạnh trăng.':id==='light-2'?'Lời khắc: Trăng giữ đầu cuối bên phải.':`Đã khảo sát ${members.filter(p=>s.adventure.milestones.includes(p.id)).length}/${members.length}: ${o.name}`};
    }
    if(o.mode==='route'){
      const order=['rescue-1','rescue-2','rescue-3'],next=order.find(p=>!s.adventure.milestones.includes(p));
      if(!s.adventure.milestones.includes('rescue-route')||id!==next)return{ok:false,message:'Theo dây từ người mắc kẹt: cột đầu → khe rễ → trạm nghỉ.'};
      s.adventure.milestones.push(id);if(id==='rescue-3')C.recordProof(s,'rescue',data);
      return{ok:true,message:id==='rescue-3'?'Bạn mở trọn lối vòng. Người giữ đường đã về trạm an toàn.':`Đã buộc chắc cột dây ${order.indexOf(id)+1}/3. Đi tiếp theo chỉ dẫn.`};
    }
    if(o.mode==='repair'&&s.inventory.wood<3)return{ok:false,message:'Cần 3 gỗ để sửa đường. Không mất vật liệu khi chưa đủ.'};
    if(!C.recordProof(s,id,data))return{ok:false,message:'Chưa thể hoàn thành địa điểm này.'};
    if(o.mode==='repair')s.inventory.wood-=3;
    if(o.mode==='prepare'){s.health=100;s.stamina=100;s.adventure.checkpoint='forest-rest';}
    return{ok:true,message:o.mode==='prepare'?'Đã hồi đầy sức và mở điểm nghỉ gần đấu trường.':`Hoàn tất: ${o.name}`};
  }
  // Chọn đường vòng chỉ mở hành trình, chưa nhận chứng cứ cứu người cho tới cột cuối.
  function beginRescue(s,data){const check=interact(s,'rescue',data);if(!check.ok)return check;if(!s.adventure.milestones.includes('rescue-route'))s.adventure.milestones.push('rescue-route');return{ok:true,message:'Lần theo ba cột dây. Cột đầu ở phía đông nam người mắc kẹt.'};}
  function puzzleInput(s,id,value,data){
    const check=interact(s,id,data);if(!check.ok||check.mode!=='puzzle')return{ok:false,message:check.message};
    if(value==='reset'){s.adventure.puzzles[id]=id==='relic'?[]:['moon','leaf','star'];return{ok:true};}
    const draft=s.adventure.puzzles[id];
    if(id==='relic'&&['leaf','star','moon'].includes(value)&&draft.length<3&&!draft.includes(value))draft.push(value);
    else if(id==='root-light'&&/^[0-2]$/.test(value)){const symbols=['leaf','star','moon'],i=Number(value);draft[i]=symbols[(symbols.indexOf(draft[i])+1)%3];}
    else return{ok:false,message:'Biểu tượng đã được chọn. Xóa để xếp lại.'};
    return{ok:true};
  }
  // Xác nhận nguyên tử: đúng vị trí, tiền đề, manh mối và cả ba ô mới cấp chứng cứ một lần.
  function solvePuzzle(s,id,data){
    const check=interact(s,id,data);if(!check.ok||check.mode!=='puzzle')return{ok:false,message:check.message};
    if(id==='root-light'&&!['light-1','light-2'].every(p=>s.adventure.milestones.includes(p)))return{ok:false,message:'Khảo sát hai bia khắc ở tây bắc và đông bắc trước khi nối mạch.'};
    const answer=id==='relic'?['moon','leaf','star']:['leaf','star','moon'];
    if(answer.some((v,i)=>s.adventure.puzzles[id][i]!==v))return{ok:false,message:'Các phiến chưa hòa nhịp. Đọc lời khắc, xếp lại rồi xác nhận.'};
    return{ok:C.recordProof(s,id,data),message:id==='relic'?'Di vật đã mở! Ba ánh sao trở về đúng vị trí.':'Mạch ánh sáng đã được nối. Lõi rừng yếu đi.'};
  }
  function prepare(s,loadout,data){
    const check=interact(s,'prepared',data);if(!check.ok||!['healer','runner'].includes(loadout))return{ok:false,message:check.message||'Chọn bộ tiếp tế hợp lệ.'};
    C.recordProof(s,'prepared',data);s.adventure.loadout=loadout;refill(s);s.health=100;s.stamina=100;
    return{ok:true,message:'Đã chuẩn bị bộ tiếp tế. Dùng từ Sổ phiêu lưu khi cần, bổ sung ở trạm nghỉ.'};
  }
  function refill(s){s.adventure.supplies=s.adventure.proofs.includes('prepared')?(s.adventure.loadout==='runner'?1:2):0;}
  function useSupply(s){
    if(!(s.adventure.supplies>0))return{ok:false,message:'Hết tiếp tế. Bổ sung tại trạm nghỉ sau giao tranh.'};
    if(s.health>=100&&s.stamina>=100)return{ok:false,message:'Bạn đang đầy sức. Chưa cần dùng tiếp tế.'};
    s.adventure.supplies--;s.health=Math.min(100,s.health+(s.adventure.loadout==='runner'?25:45));s.stamina=Math.min(100,s.stamina+(s.adventure.loadout==='runner'?100:25));
    return{ok:true,message:'Đã dùng một phần tiếp tế.'};
  }
  // Hướng dẫn dựa trên bước còn thiếu thay vì tiếp tục chỉ tới điểm đã khảo sát.
  function target(s,id,data){
    let next=id;
    if(id==='trail')next=['trail','trail-2','trail-3'].find(p=>!s.adventure.milestones.includes(p))||id;
    if(id==='rescue'&&s.adventure.milestones.includes('rescue-route'))next=['rescue-1','rescue-2','rescue-3'].find(p=>!s.adventure.milestones.includes(p))||id;
    if(['root-light','inscriptions'].includes(id))next=['light-1','light-2'].find(p=>!s.adventure.milestones.includes(p))||'root-light';
    return data.adventure.objects.find(o=>o.id===next);
  }
  return{unlocked,equip,damage,interact,beginRescue,puzzleInput,solvePuzzle,prepare,refill,useSupply,target};
});
