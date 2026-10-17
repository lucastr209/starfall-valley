(function(root){
  'use strict';
  // Chứng cứ có tiền đề rõ ràng để save cũ và nhập file không mở boss bằng một ID rời rạc.
  const proofs=[
    {id:'trail',name:'Kiểm tra dấu rễ ở lối vào rừng',requires:[]},
    {id:'training',name:'Vượt cuộc đấu tập né đòn',requires:['trail']},
    {id:'rescue',name:'Giải cứu người giữ đường mòn',requires:['training']},
    {id:'root-combat',name:'Thanh tẩy mạch rễ phía tây',requires:['rescue']},
    {id:'root-light',name:'Giải cơ chế ánh sáng ở bia rừng',requires:['rescue']},
    {id:'shortcut',name:'Mở đường tắt tới đấu trường',requires:['rescue']},
    {id:'prepared',name:'Chuẩn bị tại bàn tiếp tế trong làng',requires:['root-combat','root-light','shortcut']},
    {id:'rootBoss',name:'Đánh bại Hộ Vệ Rễ Sao',requires:['prepared']},
    {id:'missing-notes',name:'Tìm thư của người giữ rừng',requires:['trail']},
    {id:'trail-repair',name:'Sửa lối đi ven rừng',requires:['rescue']},
    {id:'relic',name:'Giải mật mã di vật',requires:['rescue']}
  ];
  const objects=[
    {id:'trail',map:'forest',x:800,y:850,name:'Dấu rễ thức giấc',mode:'survey',group:'trail'},
    {id:'trail-2',map:'forest',x:680,y:680,name:'Dấu chân dưới tán cây',mode:'survey',group:'trail',requires:[]},
    {id:'trail-3',map:'forest',x:520,y:650,name:'Đèn sao bị rễ quấn',mode:'survey',group:'trail',requires:[]},
    {id:'training',map:'forest',x:600,y:780,name:'Bãi tập né đòn',mode:'encounter'},
    {id:'rescue',map:'forest',x:350,y:560,name:'Người mắc kẹt',mode:'rescue'},
    {id:'rescue-1',map:'forest',x:450,y:600,name:'Cột dây đầu đường',mode:'route',requires:['training']},
    {id:'rescue-2',map:'forest',x:620,y:520,name:'Cột dây qua khe rễ',mode:'route',requires:['training']},
    {id:'rescue-3',map:'forest',x:760,y:470,name:'Cột dây về trạm nghỉ',mode:'route',requires:['training']},
    {id:'root-combat',map:'forest',x:450,y:350,name:'Mạch rễ phía tây',mode:'encounter'},
    {id:'root-light',map:'forest',x:800,y:350,name:'Mạch ánh sáng',mode:'puzzle'},
    {id:'light-1',map:'forest',x:650,y:280,name:'Bia khắc về chiếc lá',mode:'survey',group:'inscriptions',requires:['rescue']},
    {id:'light-2',map:'forest',x:950,y:300,name:'Bia khắc về bầu trời',mode:'survey',group:'inscriptions',requires:['rescue']},
    {id:'shortcut',map:'forest',x:1000,y:500,name:'Lối tắt dưới tán lá',mode:'shortcut'},
    {id:'prepared',map:'village',x:850,y:650,name:'Bàn tiếp tế thám hiểm',mode:'prepare'},
    {id:'rootBoss',map:'forest',x:800,y:180,name:'Đấu trường Hộ Vệ Rễ Sao',mode:'boss'},
    {id:'missing-notes',map:'forest',x:240,y:300,name:'Lá thư dưới gốc cổ thụ',mode:'inspect'},
    {id:'trail-repair',map:'forest',x:1000,y:880,name:'Lối đi sạt lở',mode:'repair'},
    {id:'relic',map:'forest',x:1080,y:520,name:'Hộp di vật ba ánh sao',mode:'puzzle'}
  ];
  const mainIds=['adv01','adv02','adv03','adv04','adv05','adv06'];
  const titles=['Dấu rễ thức giấc','Khoảng trống giữa hai đòn','Người mắc kẹt bên đường mòn','Ba mạch rễ','Chuẩn bị cho Hộ Vệ','Hộ Vệ Rễ Sao'];
  const descriptions=[
    'Sen phát hiện rễ cây hút ánh sao. Khảo sát dấu rễ, dấu chân và chiếc đèn bị rễ quấn. Chỉ dẫn sẽ chuyển tới dấu vết còn thiếu.',
    'Tới bãi tập phía tây nam rừng. Vượt hai đợt tinh linh: đọc vùng báo đòn, dùng V hoặc nút Né, rồi phản công sau cú lao.',
    'Người giữ đường mòn đang mắc kẹt phía tây rừng. Chọn đánh địch hoặc tìm lối vòng để đưa họ về trạm nghỉ.',
    'Vượt ba đợt địch ở mạch phía tây, khảo sát hai bia khắc để xoay mạch ánh sáng và mở lối tắt phía đông.',
    'Trở về bàn tiếp tế ở làng, chuẩn bị hồi phục rồi dùng đường tắt để đối mặt Hộ Vệ. Kiếm khởi đầu đủ sức chiến thắng.',
    'Hộ Vệ Rễ Sao canh lõi rừng phía bắc. Né vùng quét, tránh đường lao, tấn công lúc lõi lộ ra; dưới nửa máu đòn đổi nhịp.'
  ];
  const objectives=[['trail'],['training'],['rescue'],['root-combat','root-light','shortcut'],['prepared'],['rootBoss']];
  const milestones=['trail','trail-2','trail-3','rescue-route','rescue-1','rescue-2','rescue-3','light-1','light-2'];
  // Đội hình đổi qua từng đợt để người chơi phải đọc đòn và chọn mục tiêu, không tăng máu để kéo dài trận.
  const encounters={training:[['slime'],['slime','slime']],rescue:[['slime','sprout'],['warden','sprout']], 'root-combat':[['sprout','slime'],['warden','sprout'],['warden','slime','sprout']],rootBoss:[['rootBoss']]};
  // Đăng ký trước restore ở cả Node và trình duyệt, không đổi các ID nhiệm vụ đã phát hành.
  function register(data){
    if(data.adventure)return;
    data.adventure={title:'Vết Nứt Sao · Chương I: Rễ Sao',mainIds,proofs,objects,milestones,encounters};
    data.items.rootblade={name:'Kiếm Rễ Sao',icon:'⚔',description:'Lưỡi kiếm từ lõi đã thanh tẩy. Gây 3 sát thương mỗi đòn.'};
    mainIds.forEach((id,i)=>data.quests.push({id,title:titles[i],description:descriptions[i],kind:'adventure',giver:i===0?'sen':'mira',requires:[i?mainIds[i-1]:'story05'],upgrade:null,objectives:objectives[i].map(target=>({type:'proof',target,count:1})),reward:{coins:i===5?180:50+i*15,xp:i===5?150:35+i*10,renown:i===5?5:2,...(i===5?{items:{rootblade:1,wood:8,ore:5}}:{})}}));
    for(const [id,title,description,target] of [
      ['advside01','Thư gửi người giữ rừng','Tìm lá thư dưới gốc cổ thụ phía tây bắc để hiểu lý do người giữ rừng ở lại.','missing-notes'],
      ['advside02','Một lối về an toàn','Dùng 3 gỗ sửa lối sạt lở phía đông nam. Người giữ đường mòn mở lại trạm nghỉ.','trail-repair'],
      ['advside03','Di vật của ba ánh sao','Giải mật mã trên hộp di vật phía đông. Đọc các dấu trăng, lá và sao thay vì thử ngẫu nhiên.','relic'],
      ['advside04','Lời khắc bị lãng quên','Khảo sát hai bia khắc phía bắc rừng. Ghi lại quy tắc để nối ba phiến ánh sáng.','inscriptions']
    ])data.quests.push({id,title,description,kind:'adventure',optional:true,giver:'sen',requires:['adv01'],upgrade:null,objectives:[{type:'proof',target,count:1}],reward:{coins:80,xp:55,renown:2}});
    proofs.push({id:'inscriptions',name:'Đọc hai bia khắc ánh sáng',requires:['rescue']});
    data.recipes.push({id:'rootblade',name:'Rèn Kiếm Rễ Sao',description:'Rèn lại kiếm bằng gỗ, quặng và mảnh sao sau khi giải phóng lõi rừng.',requires:'workshop',proof:'rootBoss',input:{wood:6,ore:4,star:2},output:{rootblade:1}});
  }
  const api={register};if(typeof module==='object'&&module.exports)module.exports=api;else root.StardropAdventureData=api;
})(typeof globalThis!=='undefined'?globalThis:this);
