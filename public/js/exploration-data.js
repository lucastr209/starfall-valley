(function(root,factory){'use strict';const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;else root.StardropExplorationData=data;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const equipment={
    copperblade:{name:'Kiếm Đồng Lá',icon:'⚔',slot:'weapon',damage:2},
    tideblade:{name:'Kiếm Thủy Triều',icon:'⚔',slot:'weapon',damage:4},
    skyblade:{name:'Kiếm Tinh Vân',icon:'⚔',slot:'weapon',damage:5},
    travelercoat:{name:'Áo Lữ Hành',icon:'🧥',slot:'outfit',armor:1,color:'#ae8159'},
    sailorcoat:{name:'Áo Hải Hành',icon:'🧥',slot:'outfit',armor:2,color:'#638cac'},
    mosscloak:{name:'Áo Choàng Rêu Sao',icon:'🧥',slot:'outfit',armor:2,color:'#658e68'},
    cloudcoat:{name:'Áo Giáp Mây',icon:'🧥',slot:'outfit',armor:3,color:'#9983b5'}
  };
  const rooms=[
    {id:'home-mira',map:'village',building:'home',name:'Nhà Bản Đồ',npc:'mira',x:270,y:355,palette:'#b87963',note:'Mira trải bản đồ trên bàn. Những mái nhà đều có câu chuyện chờ bạn ghé thăm.'},
    {id:'home-huy',map:'village',building:'workshop',name:'Xưởng Mộc Lá Phong',npc:'huy',x:610,y:360,palette:'#789596',note:'Mùi gỗ mới và bản vẽ cây cầu phủ kín góc bàn.'},
    {id:'home-yen',map:'village',building:'archive',name:'Kho Chuyện Mây',npc:'yen',x:1060,y:355,palette:'#a080a3',note:'Yến đang tìm dấu vết liên kết ba hang động dưới thung lũng.'},
    {id:'home-son',map:'village',building:'kitchen',name:'Bếp Nắng',npc:'son',x:1340,y:375,palette:'#c98d5c',note:'Nồi súp nóng dành cho những người vừa trở về từ hang sâu.'},
    {id:'home-thao',map:'village',building:'greenhouse',name:'Vườn Kính Ban Mai',npc:'thao',x:280,y:875,palette:'#76a18b',note:'Ánh sáng đi qua mái kính, soi những chậu cây đang hồi sinh.'},
    {id:'shop-leaf',map:'village',building:'market',name:'Cửa hàng Chợ Lá',npc:'bao',guests:['linh'],kind:'shop',x:1015,y:900,palette:'#c5a064',note:'Vật liệu, áo khoác và kiếm mới cho chuyến đi. Mua vật liệu không thay thế mục tiêu tự thu thập.'},
    {id:'home-nam',map:'village',building:'observatory',name:'Nhà Thợ Đèn',npc:'nam',x:1350,y:1060,palette:'#7d86a5',note:'Nam kiểm từng ngọn đèn trước khi đưa chúng đến những đường mòn tối.'},
    {id:'hut-sen',map:'forest',name:'Chòi Lá Của Sen',npc:'sen',x:260,y:270,palette:'#73916a',note:'Sen ghi lại tiếng động từ Hang Rêu Sao, ngay sau những vách đá phía bắc.'},
    {id:'hut-kiet',map:'coast',name:'Nhà Thủy Triều',npc:'kiet',x:260,y:270,palette:'#6f9ea8',note:'Kiệt giữ bản chép những ký hiệu trên vách Hang Thủy Triều.'},
    {id:'hut-ly',map:'ruins',name:'Trạm Thám Hiểm Mây',npc:'ly',x:260,y:270,palette:'#a18aad',note:'Ly đang chuẩn bị bản đồ cho chuyến xuống Hang Tinh Vân.'},
    {id:'cave-forest',kind:'cave',map:'forest',name:'Hang Rêu Sao',x:1280,y:290,palette:'#647b67',sequence:['leaf','moon','star'],clue:'Rễ mọc trước, trăng soi sau, sao đánh thức người canh. Chạm lá → trăng → sao.',bossName:'Hộ Vệ Rêu Cổ',loot:{mosscloak:1,forestamber:1},coins:140},
    {id:'cave-coast',kind:'cave',map:'coast',name:'Hang Thủy Triều',x:1280,y:290,palette:'#607e8b',sequence:['moon','star','leaf'],clue:'Trăng nâng thủy triều, sao chỉ lối về, lá dạt vào bờ. Chạm trăng → sao → lá.',bossName:'Hộ Vệ Sóng Ngầm',loot:{tideblade:1,coastpearl:1},coins:210},
    {id:'cave-ruins',kind:'cave',map:'ruins',name:'Hang Tinh Vân',x:1280,y:290,palette:'#82748e',sequence:['star','leaf','moon'],clue:'Sao gieo hạt, lá che đá, trăng khép bầu trời. Chạm sao → lá → trăng.',bossName:'Hộ Vệ Thiên Thạch',loot:{skyblade:1,cloudcoat:1,cloudcore:1},coins:300}
  ];
  const caveBattles={
    'cave-forest':{waves:[['slime','slime'],['forestBoss']],tactics:'Vượt hai tinh linh canh cửa. Hộ Vệ vung nặng rồi lao tới; né sang bên và phản công lúc lõi lộ sau đòn lao.'},
    'cave-coast':{waves:[['sprout','warden'],['tideBoss']],tactics:'Ưu tiên mầm bắn gai. Hộ Vệ bắn ba luồng nước, lao rồi quét ngang; đứng giữa các luồng và chờ lõi lộ sau đòn lao.'},
    'cave-ruins':{waves:[['slime','warden'],['sprout','warden'],['skyBoss']],tactics:'Giữ thể lực qua hai lớp canh gác. Hộ Vệ quét rộng, bắn năm tia rồi lao nhanh; dưới nửa máu mỗi đòn được lặp lại.'}
  };
  for(const r of rooms)if(caveBattles[r.id]){Object.assign(r,caveBattles[r.id]);r.clue=r.clue.split(' Chạm ')[0];}
  const shop=Object.entries({wood:14,ore:18,herb:16,berry:20,fish:40,star:60,crystal:70,plank:50,tea:60,meal:110,lantern:180,copperblade:230,travelercoat:190,sailorcoat:360}).map(([item,price])=>({item,price,unique:!!equipment[item]}));
  const quest=(id,title,giver,requires,objectives,description)=>({id,title,giver,kind:'side',requires,upgrade:null,objectives,description,reward:{coins:120,xp:90,renown:2}});
  const quests=[
    quest('indoor01','Những cánh cửa mở','mira',['story01'],[{type:'explore',target:'home-huy',count:1},{type:'explore',target:'shop-leaf',count:1}],'Ghé bên trong Xưởng Mộc và Cửa hàng Chợ Lá. Trò chuyện cùng những người giữ làng ấm áp.'),
    quest('indoor02','Kho dự trữ cho người đi xa','bao',['story04'],[{type:'deliver',target:'plank',count:4},{type:'deliver',target:'tea',count:3}],'Mang bốn ván gỗ và ba ấm trà cho Bảo tại Cửa hàng Chợ Lá.'),
    quest('cave01','Tiếng gầm dưới rêu','sen',['story05'],[{type:'cave',target:'cave-forest',count:1},{type:'deliver',target:'forestamber',count:1}],'Ghé chòi Sen, đọc bia trong Hang Rêu Sao, giải ấn, thắng Hộ Vệ và mang hổ phách về.'),
    quest('cave02','Viên ngọc dưới thủy triều','kiet',['story15'],[{type:'cave',target:'cave-coast',count:1},{type:'deliver',target:'coastpearl',count:1}],'Giải ấn Hang Thủy Triều, đánh bại Hộ Vệ và mang ngọc về Nhà Thủy Triều.'),
    quest('cave03','Lõi sao trong lòng núi','ly',['story20'],[{type:'cave',target:'cave-ruins',count:1},{type:'deliver',target:'cloudcore',count:1}],'Khám phá Hang Tinh Vân, thắng Hộ Vệ và đưa lõi sao đến trạm của Ly.'),
    quest('cave04','Bản đồ ba người canh','yen',['story05'],rooms.filter(r=>r.kind==='cave').map(r=>({type:'cave',target:r.id,count:1})),'Vượt qua cả ba hang rồi trở lại Kho Chuyện Mây để Yến hoàn thiện bản đồ.')
  ];
  function register(data){data.exploration={rooms,shop,equipment};Object.assign(data.items,equipment,{forestamber:{name:'Hổ Phách Rêu Sao',icon:'🔶'},coastpearl:{name:'Ngọc Thủy Triều',icon:'🔮'},cloudcore:{name:'Lõi Tinh Vân',icon:'💠'}});data.quests.push(...quests);}
  return Object.freeze({rooms,shop,equipment,quests,register});
});
