(function(root, factory) {
  'use strict';
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.StardropAwakeningData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const chapters = [
    { id:'deepwood', name:'Rừng Sâu', subtitle:'Tiếng gọi từ những rễ cây', color:'#264e40', floor:'#56734e', accent:'#f0cf7b', ability:'roots', abilityName:'Phá rễ chắn', building:'Nhà Ươm Sao', resident:'Sen', dialogue:'Hạt sao trong lòng rừng đang thức giấc. Mang ánh sáng về, ta sẽ gieo lại những khoảng đất đã khô.', boss:'forestBoss', rooms:['Đường rễ cổ','Hai bia cộng hưởng','Vòng vây mầm gai','Trạm người giữ rừng','Trái tim đại thụ'], clue:'Đứng bên bia lá ở góc trên trái rồi tương tác. Nếu đi cùng bạn, người còn lại chạm bia trăng ở góc dưới phải.' },
    { id:'tideisles', name:'Quần Đảo Thủy Triều', subtitle:'Ngọn hải đăng đã tắt', color:'#264d65', floor:'#577f86', accent:'#a9edf2', ability:'tides', abilityName:'Vượt dòng nước', building:'Bến Hải Đăng', resident:'Kiệt', dialogue:'Nhịp sóng dẫn tới người canh biển. Thắp lại hải đăng, những chiếc thuyền sẽ tìm được đường về làng.', boss:'tideBoss', rooms:['Bãi đá ánh ngọc','Chuông trăng nước','Đảo gai chìm','Lều giữ đèn','Điện sóng ngầm'], clue:'Chuông phía tây đáp lại chuông phía đông. Đi một mình chỉ cần một chuông; cả nhóm cần hai người ở hai chuông khác nhau.' },
    { id:'starcitadel', name:'Thành Sao Đổ Nát', subtitle:'Bầu trời còn nhớ tên làng', color:'#403854', floor:'#756887', accent:'#e6c4ff', ability:'stars', abilityName:'Kích hoạt cầu sao', building:'Đài Cầu Sao', resident:'Yến', dialogue:'Ba mảnh ký ức đã tìm về nhau. Đưa lõi thành về làng, cây cầu sao sẽ nối những người từng lạc mất.', boss:'skyBoss', rooms:['Bậc thềm tinh vân','Gương đôi ký ức','Hành lang thiên thạch','Thư viện còn sáng','Ngai người giữ sao'], clue:'Hai gương giữ hai nửa bầu trời. Mỗi người chạm một gương; đi một mình có thể đánh thức cả hai bằng gương đầu tiên.' }
  ];
  const weapons = {
    sword:{ name:'Kiếm Lá Sao', damage:12, range:86, arc:120, cooldown:.46, stamina:4, description:'Áp sát · phá giáp khi boss lộ lõi' },
    bow:{ name:'Cung Thủy Mộc', damage:9, range:430, arc:22, cooldown:.65, stamina:5, description:'Bắn theo hướng nhìn · giữ khoảng cách' },
    staff:{ name:'Trượng Ánh Mầm', damage:7, range:210, arc:110, cooldown:.85, stamina:8, description:'Đánh phép · hồi 5 máu cho đồng đội gần' }
  };
  // Vật cản dùng cùng tọa độ ở server và renderer để báo đòn/đường đi không lệch nhau.
  const obstacles = [
    [{x:300,y:130,w:100,h:100},{x:470,y:340,w:90,h:100}],
    [{x:350,y:210,w:90,h:140}],
    [{x:230,y:170,w:65,h:70},{x:510,y:330,w:65,h:70}],
    [{x:370,y:140,w:70,h:80}], []
  ];
  const secrets=[{x:280,y:150,name:'Rễ chắn lối cũ'},{x:470,y:390,name:'Dòng nước sau làng'},{x:630,y:170,name:'Cầu sao bị vỡ'}].map(s=>({...s,
    chest:{x:s.x,y:s.y-65},gate:{x:s.x-48,y:s.y-8,w:96,h:16},
    walls:[{x:s.x-62,y:s.y-100,w:14,h:126},{x:s.x+48,y:s.y-100,w:14,h:126},{x:s.x-62,y:s.y-100,w:124,h:12}]
  }));
  return { protocol:1, width:800, height:560, chapters, weapons, obstacles,
    switches:[{x:190,y:180},{x:610,y:380}],secrets };
});
