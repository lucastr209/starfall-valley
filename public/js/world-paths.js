/* A single connected road surface per region; intersections share the same outer edge. */
(function (root) {
  'use strict';
  const WIDTH = 1600, HEIGHT = 1100, CELL_SIZE = 8;
  const PALETTES = {
    village: { base:'#decb9a', variation:'#ead8ad', grain:'#c4ae7e', edge:'#ac976f', shade:'#bca579', highlight:'#eee0b7' },
    forest: { base:'#b2aa7d', variation:'#c2b98a', grain:'#9b9d72', edge:'#7c8965', shade:'#929a6d', highlight:'#cfca99' },
    coast: { base:'#e8d9a6', variation:'#f2e5bd', grain:'#d3bf8c', edge:'#baac7f', shade:'#d0bf8e', highlight:'#faf0ce' },
    ruins: { base:'#a8afa8', variation:'#bfc4b6', grain:'#909b96', edge:'#798b86', shade:'#8c9b94', highlight:'#d2d4c4' }
  };
  const BUILDINGS = [
    {x:270,y:330,w:146}, {x:610,y:335,w:154}, {x:1060,y:330,w:160},
    {x:1340,y:350,w:122}, {x:280,y:850,w:136}, {x:1015,y:875,w:145}, {x:1350,y:1035,w:125}
  ];
  const DEFINITIONS = {
    village: {
      segments: [
        ['Đại lộ Ánh Sao',88,[[100,550],[1500,550]]],
        ['Lối lên rừng',72,[[800,100],[800,550]]],
        ['Lối trại và đồi sao',64,[[800,550],[800,980]]],
        ['Cửa nhà Mira',48,[[270,550],[270,370]]],
        ['Cửa Xưởng Gió',48,[[610,550],[610,375]]],
        ['Cửa Thư viện Mây',48,[[1060,550],[1060,375]]],
        ['Cửa Bếp Nắng',48,[[1340,550],[1340,390]]],
        ['Lối vườn kính',48,[[400,550],[400,895],[280,895],[280,885]]],
        ['Lối tới Chợ Lá',40,[[900,740],[900,950],[1015,950],[1015,910]]],
        ['Lối đài sao',48,[[800,980],[1180,980],[1180,1065],[1350,1065]]],
        ['Bờ câu',40,[[1040,550],[1040,660],[1080,660]]]
      ],
      plazas: [
        ['Quảng trường',736,502,128,112],
        ['Sân trại và giếng',696,688,280,104]
      ],
      landmarks: [['forest-gate',800,100],['coast-gate',1500,550],['ruins-gate',100,550],
        ['mira-front',270,370],['workshop-front',610,375],['archive-front',1060,375],['kitchen-front',1340,390],
        ['greenhouse-front',280,885],['market-front',1015,910],['observatory-front',1350,1065],
        ['camp',790,735],['well',920,725],['bench',730,735],['fish',1080,660]]
    },
    forest: {
      segments: [
        ['Đường bìa rừng',56,[[350,550],[550,550],[550,470],[800,470],[800,550]]],
        ['Lối bia ký ức',48,[[800,550],[800,280]]],
        ['Đường trở về',56,[[800,550],[800,1000]]],
        ['Lối hái dược',32,[[550,470],[550,420],[180,420]]],
        ['Lối thám hiểm',40,[[800,470],[1010,470],[1010,580]]],
        ['Lối rương ven hồ',40,[[800,1000],[1400,1000],[1400,940]]]
      ],
      plazas: [['Bãi nghỉ',744,504,112,96],['Sân bia',760,248,80,80]],
      landmarks: [['sen',350,550],['shrine',800,280],['return',800,1000],['chest',1400,940],['herbs',180,420]]
    },
    coast: {
      segments: [
        ['Đường cát ven vịnh',64,[[350,550],[800,550],[1050,550]]],
        ['Lối bia ký ức',48,[[800,550],[800,280]]],
        ['Đường trở về',56,[[800,550],[800,1000]]],
        ['Lối bờ câu',56,[[1050,550],[1050,840]]],
        ['Cầu câu thứ nhất',24,[[1050,655],[1080,655]]],
        ['Cầu câu thứ hai',24,[[1050,720],[1080,720]]],
        ['Cầu câu thứ ba',24,[[1050,785],[1080,785]]],
        ['Đường quanh vịnh',40,[[800,1000],[1050,1000],[1050,940],[1400,940]]]
      ],
      plazas: [['Bãi hẹn',744,510,112,80],['Sân bia',760,248,80,80]],
      landmarks: [['kiet',350,550],['shrine',800,280],['return',800,1000],['chest',1400,940],
        ['fish-0',1080,655],['fish-1',1080,720],['fish-2',1080,785]]
    },
    ruins: {
      segments: [
        ['Đường đá cổ',64,[[350,550],[800,550],[1030,550]]],
        ['Lối điện ký ức',64,[[800,550],[800,280]]],
        ['Đường trở về',64,[[800,550],[800,1000]]],
        ['Lối thám hiểm phía đông',40,[[1030,550],[1030,460],[920,460]]],
        ['Lối thám hiểm phía tây',40,[[350,550],[350,430],[180,430]]],
        ['Lối rương dưới hồ',48,[[800,1000],[1400,1000],[1400,940]]]
      ],
      plazas: [['Sân điện',704,240,192,96],['Giao lộ đá',720,502,160,96]],
      landmarks: [['ly',350,550],['shrine',800,280],['return',800,1000],['chest',1400,940]]
    }
  };

  function intersects(left,top,right,bottom,box) {
    return left < box.right && right > box.left && top < box.bottom && bottom > box.top;
  }
  function createLayout(requestedMap) {
    const map = Object.prototype.hasOwnProperty.call(DEFINITIONS, requestedMap) ? requestedMap : 'village';
    const definition = DEFINITIONS[map], cols = Math.ceil(WIDTH/CELL_SIZE), rows = Math.ceil(HEIGHT/CELL_SIZE);
    const layout = {map,cellSize:CELL_SIZE,cols,rows,width:WIDTH,height:HEIGHT,cells:new Uint8Array(cols*rows),
      palette:{...PALETTES[map]},
      segments:definition.segments.map(([name,width,points]) => ({name,width,points:points.map(([x,y]) => ({x,y}))})),
      plazas:definition.plazas.map(([name,x,y,w,h]) => ({name,x,y,w,h})),
      landmarks:definition.landmarks.map(([id,x,y]) => ({id,x,y}))};
    const fill = (x,y,w,h) => {
      const firstX = Math.max(0,Math.floor(x/CELL_SIZE)), lastX = Math.min(cols-1,Math.ceil((x+w)/CELL_SIZE)-1);
      const firstY = Math.max(0,Math.floor(y/CELL_SIZE)), lastY = Math.min(rows-1,Math.ceil((y+h)/CELL_SIZE)-1);
      for(let row=firstY;row<=lastY;row++)for(let col=firstX;col<=lastX;col++)layout.cells[row*cols+col]=1;
    };
    for(const segment of layout.segments)for(let i=1;i<segment.points.length;i++) {
      const from=segment.points[i-1],to=segment.points[i],half=segment.width/2;
      fill(Math.min(from.x,to.x)-half,Math.min(from.y,to.y)-half,
        Math.abs(from.x-to.x)+segment.width,Math.abs(from.y-to.y)+segment.width);
    }
    for(const plaza of layout.plazas)fill(plaza.x,plaza.y,plaza.w,plaza.h);
    // Entire cells stay on walkable ground, including the last strip near the world edge.
    const obstacles = [{left:1110,top:625,right:1490,bottom:905}];
    if(map==='village')for(const b of BUILDINGS)obstacles.push({left:b.x-b.w/2-8,top:b.y-62,right:b.x+b.w/2+8,bottom:b.y+9});
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
      const id=row*cols+col;
      if(!layout.cells[id])continue;
      const x=col*CELL_SIZE,y=row*CELL_SIZE;
      const bottom=Math.min(y+CELL_SIZE,HEIGHT);
      if(x<25||x+CELL_SIZE>1575||y<40||bottom>1075||
        obstacles.some(box=>intersects(x,y,x+CELL_SIZE,bottom,box)))layout.cells[id]=0;
    }
    return layout;
  }

  function contains(layout,x,y,margin=0) {
    if(!layout||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=layout.width||y>=layout.height)return false;
    const {cellSize,cols,rows,cells}=layout, radius=Number.isFinite(margin)?Math.max(0,margin):0;
    if(!radius)return !!cells[Math.floor(y/cellSize)*cols+Math.floor(x/cellSize)];
    const firstX=Math.max(0,Math.floor((x-radius)/cellSize)),lastX=Math.min(cols-1,Math.floor((x+radius)/cellSize));
    const firstY=Math.max(0,Math.floor((y-radius)/cellSize)),lastY=Math.min(rows-1,Math.floor((y+radius)/cellSize));
    for(let row=firstY;row<=lastY;row++)for(let col=firstX;col<=lastX;col++) {
      if(!cells[row*cols+col])continue;
      const left=col*cellSize,top=row*cellSize;
      const dx=Math.max(left-x,0,x-(left+cellSize)),dy=Math.max(top-y,0,y-Math.min(top+cellSize,layout.height));
      if(dx*dx+dy*dy<=radius*radius)return true;
    }
    return false;
  }

  function draw(ctx,layout) {
    if(!ctx||!layout)return;
    const {cells,cols,rows,cellSize:s,palette:p,width,height}=layout;
    const fill=(color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    const occupied=(col,row)=>col>=0&&col<cols&&row>=0&&row<rows&&!!cells[row*cols+col];
    // All strokes are already united; a row run has no separate cap or shadow.
    for(let row=0;row<rows;row++) {
      let start=-1;
      for(let col=0;col<=cols;col++) {
        if(col<cols&&occupied(col,row)){if(start<0)start=col;}
        else if(start>=0){fill(p.base,start*s,row*s,Math.min(col*s,width)-start*s,Math.min(s,height-row*s));start=-1;}
      }
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
      if(!occupied(col,row))continue;
      const x=col*s,y=row*s,w=Math.min(s,width-x),h=Math.min(s,height-y);
      const hash=(Math.imul(col+11,374761393)^Math.imul(row+7,668265263))>>>0;
      if(hash%11===0)fill(p.variation,x+2,y+2,Math.min(4,w-2),Math.min(3,h-2));
      if(hash%17===0&&h>=5)fill(p.grain,x+3,y+4,2,1);
      if(layout.map==='ruins'&&col%3===0&&row%2===0)fill(p.grain,x+2,y+3,4,1);
    }
    // Paint only exposed sides. Internal intersection cells never receive an outline.
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
      if(!occupied(col,row))continue;
      const x=col*s,y=row*s,w=Math.min(s,width-x),h=Math.min(s,height-y);
      if(!occupied(col,row-1))fill(p.highlight,x,y,w,2);
      if(!occupied(col-1,row))fill(p.edge,x,y,2,h);
      if(!occupied(col+1,row))fill(p.shade,x+w-2,y,2,h);
      if(!occupied(col,row+1))fill(p.shade,x,y+h-2,w,2);
    }
  }
  const api={WIDTH,HEIGHT,CELL_SIZE,createLayout,contains,draw};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.StardropPaths=api;
})(typeof globalThis==='object'?globalThis:this);
