'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../world-paths.js');
const D=require('../game-data.js');
const maps=['village','forest','coast','ruins'];
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function roadCells(layout) {
  const result=[];
  for(let row=0;row<layout.rows;row++)for(let col=0;col<layout.cols;col++)if(layout.cells[row*layout.cols+col])result.push({
    x:col*layout.cellSize,y:row*layout.cellSize,w:layout.cellSize,h:Math.min(layout.cellSize,layout.height-row*layout.cellSize),id:row*layout.cols+col});
  return result;
}
function recording() {
  return {fillStyle:null,fills:[],fillRect(x,y,w,h){this.fills.push({color:this.fillStyle,x,y,w,h});}};
}
test('all regions have independent, bounded pixel grids with distinct palettes',()=>{
  const palettes=new Set(),counts=new Set();
  for(const map of maps){
    const layout=P.createLayout(map);
    assert.equal(layout.map,map);assert.equal(layout.width,1600);assert.equal(layout.height,1100);
    assert.equal(layout.cellSize,8);assert.equal(layout.cols,200);assert.equal(layout.rows,138);
    assert.ok(layout.cells instanceof Uint8Array);assert.equal(layout.cells.length,27600);
    assert.ok(layout.cells.every(cell=>cell===0||cell===1));
    palettes.add(layout.palette.base);counts.add(roadCells(layout).length);
    const fresh=P.createLayout(map);assert.notEqual(layout.cells,fresh.cells);assert.notEqual(layout.palette,fresh.palette);
    assert.deepEqual(layout,fresh);layout.cells.fill(0);assert.ok(fresh.cells.some(Boolean));
  }
  assert.equal(palettes.size,4);assert.equal(counts.size,4);
});
test('unknown map names safely use the village layout',()=>{
  for(const value of [undefined,null,'','unknown','__proto__','constructor'])assert.equal(P.createLayout(value).map,'village');
});
for(const map of maps){
  test(`${map}: every road cell belongs to one connected network`,()=>{
    const layout=P.createLayout(map),occupied=roadCells(layout),visited=new Set(),queue=[occupied[0].id];
    visited.add(queue[0]);
    for(let i=0;i<queue.length;i++){
      const id=queue[i],col=id%layout.cols,row=Math.floor(id/layout.cols);
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nextCol=col+dc,nextRow=row+dr,next=nextRow*layout.cols+nextCol;
        if(nextCol<0||nextCol>=layout.cols||nextRow<0||nextRow>=layout.rows||!layout.cells[next]||visited.has(next))continue;
        visited.add(next);queue.push(next);
      }
    }
    assert.equal(visited.size,occupied.length);
  });
  test(`${map}: gates, residents, fronts and interaction spots have connected paths`,()=>{
    const layout=P.createLayout(map);
    for(const landmark of layout.landmarks)assert.ok(P.contains(layout,landmark.x,landmark.y),landmark.id);
    for(const segment of layout.segments){
      assert.ok(segment.name.length>0);assert.ok(segment.width>=24&&segment.width<=88);
      for(let i=0;i<segment.points.length;i++){
        const point=segment.points[i];assert.ok(point.x>=0&&point.x<1600&&point.y>=0&&point.y<1100);
        assert.ok(P.contains(layout,point.x,point.y),`${segment.name}: ${point.x}, ${point.y}`);
        if(i){const prior=segment.points[i-1];assert.ok(prior.x===point.x||prior.y===point.y,segment.name);}
      }
    }
  });
  test(`${map}: no road surface or boundary lies inside the pond`,()=>{
    const pond={x:1110,y:625,w:380,h:280};
    for(const cell of roadCells(P.createLayout(map)))assert.equal(overlaps(cell,pond),false,JSON.stringify(cell));
  });
  test(`${map}: outlines are drawn only along the network's exposed sides`,()=>{
    const layout=P.createLayout(map),ctx=recording();P.draw(ctx,layout);
    assert.ok(ctx.fills.length>100);const p=layout.palette,s=layout.cellSize;
    const occupied=(col,row)=>col>=0&&col<layout.cols&&row>=0&&row<layout.rows&&!!layout.cells[row*layout.cols+col];
    let firstDecoration=ctx.fills.findIndex(fill=>fill.color!==p.base);
    assert.ok(firstDecoration>0);assert.ok(ctx.fills.slice(firstDecoration).every(fill=>fill.color!==p.base));
    for(const fill of ctx.fills){
      assert.ok(fill.x>=0&&fill.y>=0&&fill.w>0&&fill.h>0&&fill.x+fill.w<=1600&&fill.y+fill.h<=1100,JSON.stringify(fill));
      if(![p.highlight,p.edge,p.shade].includes(fill.color))continue;
      const col=Math.floor(fill.x/s),row=Math.floor(fill.y/s);
      assert.ok(occupied(col,row));
      if(fill.color===p.highlight){assert.equal(fill.y%8,0);assert.equal(occupied(col,row-1),false);}
      else if(fill.color===p.edge){assert.equal(fill.x%8,0);assert.equal(occupied(col-1,row),false);}
      else if(fill.w===2){assert.equal(occupied(col+1,row),false);}
      else {assert.equal(fill.h,2);assert.equal(occupied(col,row+1),false);}
    }
    const centerX=Math.floor(800/s),centerY=Math.floor(550/s);
    assert.ok([[-1,0],[1,0],[0,-1],[0,1]].every(([dx,dy])=>occupied(centerX+dx,centerY+dy)));
    assert.equal(ctx.fills.filter(fill=>[p.highlight,p.edge,p.shade].includes(fill.color)&&
      overlaps(fill,{x:centerX*s,y:centerY*s,w:s,h:s})).length,0);
    const again=recording();P.draw(again,P.createLayout(map));assert.deepEqual(again.fills,ctx.fills);
  });
}
test('village paths skirt every physical building footprint and all four crop beds',()=>{
  const buildings=[{x:270,y:330,w:146},{x:610,y:335,w:154},{x:1060,y:330,w:160},{x:1340,y:350,w:122},
    {x:280,y:850,w:136},{x:1015,y:875,w:145},{x:1350,y:1035,w:125}];
  const boxes=buildings.map(b=>({x:b.x-b.w/2-8,y:b.y-62,w:b.w+16,h:71}));
  for(let i=0;i<4;i++)boxes.push({x:490+(i%2)*65-25,y:770+Math.floor(i/2)*65-26,w:52,h:47});
  for(const cell of roadCells(P.createLayout('village')))for(const box of boxes)assert.equal(overlaps(cell,box),false,JSON.stringify({cell,box}));
});
test('contains includes road margins for tree clearance while rejecting invalid positions',()=>{
  const layout=P.createLayout('village');
  assert.ok(P.contains(layout,800,550));assert.equal(P.contains(layout,800,550,-10),true);
  assert.equal(P.contains(layout,200,450),false);assert.ok(P.contains(layout,200,490,26));
  assert.equal(P.contains(layout,200,450,26),false);
  for(const [x,y] of [[-1,550],[1600,550],[800,-1],[800,1100],[NaN,550],[800,Infinity]])assert.equal(P.contains(layout,x,y,26),false);
  assert.equal(P.contains(null,800,550),false);assert.equal(P.contains(layout,200,450,NaN),false);
});
test('all painted roads stay inside the player movement bounds',()=>{
  for(const map of maps)for(const cell of roadCells(P.createLayout(map)))assert.ok(
    cell.x>=25&&cell.y>=40&&cell.x+cell.w<=1575&&cell.y+cell.h<=1075,`${map}: ${JSON.stringify(cell)}`);
});
test('all eleven residents start within interaction reach of the connected network',()=>{
  for(const npc of D.npcs)assert.ok(P.contains(P.createLayout(npc.map),npc.x,npc.y,54),npc.id);
});
test('draw tolerates absent targets and leaves non-road ground untouched',()=>{
  assert.doesNotThrow(()=>P.draw(null,P.createLayout('village')));assert.doesNotThrow(()=>P.draw(recording(),null));
  const layout=P.createLayout('village'),ctx=recording();P.draw(ctx,layout);
  for(const fill of ctx.fills){
    assert.ok(P.contains(layout,fill.x+.1,fill.y+.1),JSON.stringify(fill));
    assert.ok(P.contains(layout,fill.x+fill.w-.1,fill.y+fill.h-.1),JSON.stringify(fill));
  }
});
