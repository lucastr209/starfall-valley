/* Phòng giữ hệ tọa độ Canvas hiện tại; host quyết định save/online và chuyển cảnh. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StardropExplorationScene=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.floor(x),Math.floor(y),w,h);};
  const label=(c,text,x,y,color='#f8ecd1')=>{c.font="14px 'Segoe UI',sans-serif";c.textAlign='center';c.fillStyle='#263d3e';c.fillText(text,x+1,y+1);c.fillStyle=color;c.fillText(text,x,y);};
  function create(room,data){
    const cave=room.kind==='cave',objects=[{id:room.id+'-exit',kind:'indoor',action:'exit',x:800,y:865,name:'Ra ngoài · '+room.name}];
    const specialty=room.kind==='shop'?'rack':({huy:'anvil',yen:'books',son:'stove',thao:'planter',nam:'telescope'})[room.npc]||'bed';
    const furniture=cave?[]:[{x:1090,y:390,w:130,h:90,type:specialty},{x:380,y:280,w:160,h:65,type:'shelf'},{x:1060,y:280,w:160,h:65,type:'shelf'},{x:690,y:420,w:220,h:60,type:'table'}];
    if(cave)objects.push({id:room.id+'-clue',kind:'indoor',action:'clue',x:560,y:760,name:'Bia manh mối'},{id:room.id+'-puzzle',kind:'indoor',action:'puzzle',x:1040,y:760,name:'Ấn ba biểu tượng'},{id:room.id+'-boss',kind:'indoor',action:'boss',x:800,y:500,name:room.bossName},{id:room.id+'-loot',kind:'indoor',action:'loot',x:800,y:330,name:'Rương báu của Hộ Vệ'});
    else objects.push({id:room.id+'-note',kind:'indoor',action:'note',x:550,y:650,name:'Sổ ghi chép'},...(room.kind==='shop'?[{id:room.id+'-shop',kind:'indoor',action:'shop',x:800,y:650,name:'Quầy vật phẩm & trang bị'}]:[]));
    const residents=cave?[]:[room.npc,...(room.guests||[])].map((id,i)=>({...data.npcs.find(n=>n.id===id),x:800-i*160,y:560+i*30,moving:false,direction:'down',walkDistance:0,running:false}));
    return {id:room.id,room,spawn:{x:800,y:815},objects,residents,furniture,mobs:[],trees:[]};
  }
  // Cùng mặt nạ cho người chơi, kiếm và đạn; bỏ thanh ấn sau khi đã giải đúng.
  function blocked(scene,x,y,solved=false){
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<330||x>1270||y<270||y>900)return true;
    if(scene.room.kind==='cave'&&!solved&&y>=432&&y<=448)return true;
    return scene.furniture.some(b=>x>b.x-8&&x<b.x+b.w+8&&y>b.y-8&&y<b.y+b.h+8);
  }
  function draw(c,scene,state){
    const room=scene.room,cave=room.kind==='cave',solved=state.exploration.solved.includes(room.id),cleared=state.exploration.cleared.includes(room.id);
    rect(c,0,0,1600,1100,cave?'#1b2628':'#2b3d37');
    rect(c,306,230,988,704,'#121e2040');
    rect(c,316,236,968,688,cave?'#2e3d3f':'#3d2b1c');

    if(cave){
      const isForest=room.id==='cave-forest',isCoast=room.id==='cave-coast';
      const bgBedrock=isForest?'#24342a':isCoast?'#1a2730':'#1c1626';
      rect(c,320,240,960,670,bgBedrock);

      for(let y=270;y<910;y+=32){
        for(let x=330;x<1270;x+=40){
          const hash=((Math.imul(x+13,374761393)^Math.imul(y+17,668265263))>>>0);
          let tileColor;
          if(isForest){
            tileColor=(hash%3===0)?'#354a3e':(hash%3===1)?'#2c3e34':'#415a4c';
          }else if(isCoast){
            tileColor=(hash%3===0)?'#273b47':(hash%3===1)?'#1f2f39':'#314957';
          }else{
            tileColor=(hash%3===0)?'#2a2238':(hash%3===1)?'#221b2d':'#352b47';
          }
          rect(c,x,y,38,30,tileColor);

          if(isForest){
            if(hash%7===0){
              rect(c,x+4,y+6,8,4,'#4ade80');
              rect(c,x+6,y+4,4,8,'#22c55e');
            }else if(hash%11===0){
              rect(c,x+10,y+8,6,5,'#6ee7b7');
              rect(c,x+12,y+13,2,4,'#e2f7f4');
            }
          }else if(isCoast){
            if(hash%8===0){
              rect(c,x+4,y+6,18,10,'#2a5d7580');
              rect(c,x+6,y+8,12,4,'#3b7a99');
              rect(c,x+5,y+6,16,1,'#e2f7f4');
            }else if(hash%13===0){
              rect(c,x+12,y+10,4,6,'#f472b6');
              rect(c,x+16,y+12,3,4,'#fb7185');
            }
          }else{
            if(hash%7===0){
              rect(c,x+8,y+6,4,8,'#c084fc');
              rect(c,x+12,y+10,4,6,'#e879f9');
              rect(c,x+10,y+4,2,3,'#f0abfc');
            }else if(hash%11===0){
              rect(c,x+6,y+12,16,2,'#82748e');
              rect(c,x+10,y+10,2,6,'#a855f7');
            }
          }
        }
      }

      rect(c,320,220,960,50,isForest?'#1f2e25':isCoast?'#17222a':'#181321');
      rect(c,320,255,960,12,isForest?'#2c3e34':isCoast?'#23323c':'#251e33');
      for(let i=0;i<16;i++){
        const sx=340+i*58,sh=10+(i%5)*4;
        const sColor=isForest?'#354a3e':isCoast?'#273b47':'#352b47';
        rect(c,sx,267,8,sh,sColor);
        rect(c,sx+2,267+sh,4,4,sColor);
        rect(c,sx+3,267+sh+4,2,2,'#ded5b8');
      }

      rect(c,320,270,10,650,isForest?'#19261f':isCoast?'#131c23':'#140f1c');
      rect(c,1270,270,10,650,isForest?'#19261f':isCoast?'#131c23':'#140f1c');
      rect(c,320,910,960,10,isForest?'#19261f':isCoast?'#131c23':'#140f1c');

      label(c,room.name,800,250);

      for(const x of [370,1230]){
        for(const y of [320,550,780]){
          rect(c,x-18,y-38,36,60,'#1a2426');
          rect(c,x-14,y-35,28,42,room.palette);
          if(isForest){
            rect(c,x-8,y-30,16,18,'#34d399');
            rect(c,x-4,y-26,8,10,'#a7f3d0');
          }else if(isCoast){
            rect(c,x-8,y-30,16,18,'#22d3ee');
            rect(c,x-4,y-26,8,10,'#cffafe');
          }else{
            rect(c,x-8,y-30,16,18,'#c084fc');
            rect(c,x-4,y-26,8,10,'#f5d0fe');
          }
          rect(c,x-6,y+4,12,10,'#423d33');
        }
      }

      if(!solved){
        rect(c,330,428,940,24,'#382f24');
        rect(c,330,432,940,16,'#9f9d7c');
        for(let x=346;x<1270;x+=32){
          rect(c,x,416,8,44,'#5c5445');
          rect(c,x+2,414,4,48,'#b6c8ac');
          rect(c,x+1,434,6,10,'#e8d89e');
        }
        label(c,'Lối phong ấn · đọc bia và giải ấn',800,407);
      }else{
        rect(c,330,436,940,6,'#4ade8040');
        for(let x=360;x<1260;x+=48)rect(c,x,434,12,10,'#a7f3d0');
        label(c,cleared?'Đấu trường đã bình yên':'Đấu trường của '+room.bossName,800,390);
      }
    }else{
      const isKitchen=room.id==='home-son';
      const isGreenhouse=room.id==='home-thao';
      const isObservatory=room.id==='home-nam';

      rect(c,320,240,960,670,isKitchen?'#8c4834':isGreenhouse?'#546b5a':isObservatory?'#3a271c':'#8c6b45');

      if(isKitchen){
        for(let y=270;y<910;y+=24){
          for(let x=330;x<1270;x+=24){
            const tColor=((x+y)/24)%2===0?'#bf6246':'#d17b5e';
            rect(c,x,y,22,22,tColor);
            rect(c,x+2,y+2,18,3,'#e09177');
          }
        }
      }else if(isGreenhouse){
        for(let y=270;y<910;y+=24){
          for(let x=330;x<1270;x+=32){
            const tColor=(Math.floor(x/32)+Math.floor(y/24))%2===0?'#7c8c7c':'#8c9c8c';
            rect(c,x,y,30,22,tColor);
            rect(c,x+30,y,2,24,'#4a684a');
            rect(c,x,y+22,32,2,'#4a684a');
          }
        }
      }else if(isObservatory){
        for(let y=270;y<910;y+=20){
          for(let x=330;x<1270;x+=20){
            const tColor=((x+y)/20)%2===0?'#5a3d28':'#7a5338';
            rect(c,x,y,19,19,tColor);
            if((x%80===0)&&(y%80===0))rect(c,x+8,y+8,3,3,'#d4b870');
          }
        }
      }else{
        for(let y=270;y<910;y+=20){
          const rowShift=(Math.floor((y-270)/20)%3)*32;
          for(let x=330;x<1270;x+=96){
            const tColor=(Math.floor(x/96)+Math.floor(y/20))%2===0?'#c89f6b':'#b98e5b';
            rect(c,x,y,94,18,tColor);
            rect(c,x+2,y+2,90,2,'#dfbc8c');
            rect(c,x+94,y,2,18,'#684d2f');
            rect(c,x+3,y+8,2,2,'#4a3520');
            rect(c,x+91,y+8,2,2,'#4a3520');
          }
          rect(c,330,y+18,940,2,'#684d2f');
        }
      }

      rect(c,320,220,960,36,room.palette);
      for(let wx=330;wx<1270;wx+=16)rect(c,wx,220,2,36,'#ffffff20');
      rect(c,320,256,960,14,'#5c4028');
      rect(c,320,254,960,2,'#8c6642');
      rect(c,320,268,960,2,'#3d2817');

      rect(c,320,270,10,650,'#3d2817');
      rect(c,1270,270,10,650,'#3d2817');
      rect(c,320,910,960,10,'#3d2817');

      label(c,room.name,800,245);

      for(const sx of [460,720,980]){
        rect(c,sx-4,236,8,14,'#5a4225');
        rect(c,sx-6,230,12,10,'#ffb74d');
        rect(c,sx-3,232,6,6,'#fff8e1');
      }

      rect(c,630,640,340,140,'#263d3e30');
      rect(c,636,644,328,132,'#8c3832');
      for(let ty=644;ty<776;ty+=6){
        rect(c,632,ty,4,3,'#f5ede0');
        rect(c,960,ty,4,3,'#f5ede0');
      }
      rect(c,646,652,308,116,'#e9d1a1');
      rect(c,656,660,288,100,room.palette);
      rect(c,760,690,80,40,'#e9d1a1');
      rect(c,770,696,60,28,'#8c3832');

      for(const f of scene.furniture){
        rect(c,f.x+8,f.y+8,f.w,f.h,'#263d3e35');
        rect(c,f.x,f.y,f.w,f.h,'#684d2f');
        rect(c,f.x+2,f.y+2,f.w-4,3,'#8c6b45');

        if(f.type==='bed'){
          rect(c,f.x+6,f.y+6,f.w-12,f.h-12,'#eee0bb');
          rect(c,f.x+12,f.y+10,32,24,'#fff9eb');
          rect(c,f.x+12,f.y+40,32,24,'#fff9eb');
          rect(c,f.x+52,f.y+8,f.w-58,f.h-16,room.palette);
          rect(c,f.x+56,f.y+12,f.w-66,6,'#ffffff35');
        }else if(f.type==='rack'){
          rect(c,f.x+10,f.y+8,f.w-20,6,'#d7c5a0');
          for(let i=0;i<3;i++){
            rect(c,f.x+18+i*32,f.y+18,24,42,['#ae8159','#638cac','#658e68'][i]);
            rect(c,f.x+22+i*32,f.y+12,16,8,'#e7d5a4');
            rect(c,f.x+28+i*32,f.y+24,4,30,'#ffffff40');
          }
          rect(c,f.x+12,f.y+70,f.w-24,6,'#a88a61');
        }else if(f.type==='planter'){
          rect(c,f.x+6,f.y+6,f.w-12,f.h-12,'#836b4d');
          for(let i=0;i<4;i++){
            const px=f.x+18+i*29;
            rect(c,px,f.y+42,14,24,'#bd8561');
            rect(c,px+5,f.y+16,4,30,'#5c8060');
            rect(c,px-2,f.y+22,18,12,'#80ac6d');
            rect(c,px+2,f.y+14,10,10,'#dfbb6f');
          }
        }else if(f.type==='stove'){
          rect(c,f.x+6,f.y+6,f.w-12,f.h-12,'#5a4d41');
          rect(c,f.x+10,f.y+44,f.w-20,32,'#a84838');
          rect(c,f.x+24,f.y+54,66,12,'#db965b');
          rect(c,f.x+30,f.y+56,54,8,'#ffcc80');
          rect(c,f.x+24,f.y+12,66,28,'#333835');
          rect(c,f.x+36,f.y+8,42,8,'#8a948c');
        }else if(f.type==='anvil'){
          rect(c,f.x+14,f.y+48,96,26,'#be966a');
          rect(c,f.x+36,f.y+26,60,34,'#485554');
          rect(c,f.x+12,f.y+18,108,18,'#89998e');
          rect(c,f.x+94,f.y+10,24,14,'#b8a67d');
        }else if(f.type==='telescope'){
          rect(c,f.x+55,f.y+36,10,44,'#d0ba8d');
          rect(c,f.x+18,f.y+24,88,20,'#5a7f84');
          rect(c,f.x+10,f.y+18,20,32,'#d8d3ac');
          rect(c,f.x+46,f.y+70,34,10,'#e4d1a1');
          rect(c,f.x+24,f.y+8,58,8,'#9bb8b2');
        }else if(f.type==='books'){
          for(let row=0;row<3;row++){
            for(let col=0;col<5;col++){
              rect(c,f.x+10+col*22,f.y+10+row*23,18,18,[room.palette,'#d6b677','#8da08b','#9b5b5b'][col%4]);
              rect(c,f.x+12+col*22,f.y+14+row*23,3,10,'#eee0b6');
              rect(c,f.x+10+col*22,f.y+26+row*23,18,2,'#4a3825');
            }
          }
        }else if(f.type==='shelf'){
          for(let row=0;row<2;row++){
            rect(c,f.x+6,f.y+6+row*28,f.w-12,24,'#4f584d');
            for(let i=0;i<8;i++){
              rect(c,f.x+12+i*17,f.y+9+row*28,12,19,['#b77c60','#d9be78',room.palette,'#607d8b'][i%4]);
              rect(c,f.x+14+i*17,f.y+11+row*28,2,14,'#f5ecd5');
            }
          }
        }else{
          rect(c,f.x+4,f.y+4,f.w-8,f.h-8,'#8c6842');
          rect(c,f.x+24,f.y+8,f.w-48,f.h-16,'#e7dbb6');
          rect(c,f.x+50,f.y+12,24,20,room.palette);
          rect(c,f.x+130,f.y+14,20,20,'#66907c');
          rect(c,f.x+154,f.y+18,10,12,'#ffffff');
        }
      }

      for(const wx of [550,1050]){
        rect(c,wx,286,76,88,'#5c4028');
        rect(c,wx+6,292,64,74,'#b8d8e8');
        rect(c,wx+35,292,6,74,'#5c4028');
        rect(c,wx+6,326,64,6,'#5c4028');
        rect(c,wx-4,286,14,80,room.palette);
        rect(c,wx+66,286,14,80,room.palette);
        rect(c,wx-4,326,14,4,'#e9d1a1');
        rect(c,wx+66,326,14,4,'#e9d1a1');
        rect(c,wx+18,350,14,16,'#c46d50');
        rect(c,wx+20,342,10,8,'#f48fb1');
      }
    }

    scene.objects.forEach(o=>{
      if(o.action==='exit'){
        rect(c,o.x-32,o.y-18,64,36,'#ddc395');
        rect(c,o.x-18,o.y-12,36,18,'#725b48');
        label(c,'↓ Ra ngoài',o.x,o.y+27);
      }else if(o.action==='loot'){
        rect(c,o.x-26,o.y-25,52,30,state.exploration.looted.includes(room.id)?'#767b69':'#ba8b54');
        rect(c,o.x-28,o.y-28,56,10,'#dec47d');
        rect(c,o.x-4,o.y-18,8,13,'#fff0ae');
        label(c,state.exploration.looted.includes(room.id)?'Đã nhận báu vật':cleared?'Rương đã mở khóa':'Rương · thắng Hộ Vệ để mở',o.x,o.y+26);
      }else if(o.action==='boss'){
        label(c,cleared?'✓ Hộ Vệ đã được thanh tẩy':'⚔ '+room.bossName,o.x,o.y+25);
      }else{
        rect(c,o.x-24,o.y-32,48,36,cave?'#99a496':'#e6d3a3');
        rect(c,o.x-18,o.y-26,36,4,room.palette);
        rect(c,o.x-18,o.y-15,24,3,room.palette);
        label(c,o.name,o.x,o.y+25);
      }
    });
  }
  return Object.freeze({create,blocked,draw});
});
