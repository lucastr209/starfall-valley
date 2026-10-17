'use strict';
const Combat=require('../../public/js/core/combat-core.js');
// Tìm đường cho bot QA bằng chính hợp đồng va chạm công khai, không can thiệp state server.
function route(room,p,target){
  if(Combat.lineClear(p.x,p.y,target.x,target.y,(x,y)=>room.blocked(x,y)))return target;
  const size=20,cols=38,rows=25,pos=n=>({x:24+(n%cols)*size,y:40+Math.floor(n/cols)*size});
  const candidates=Array.from({length:cols*rows},(_,i)=>i).filter(n=>{const v=pos(n);return !room.blocked(v.x,v.y);});
  const nearest=target=>candidates.reduce((a,b)=>Math.hypot(pos(a).x-target.x,pos(a).y-target.y)<Math.hypot(pos(b).x-target.x,pos(b).y-target.y)?a:b);
  const start=nearest(p),end=nearest(target),queue=[start],parents=new Map([[start,-1]]);
  if(Math.hypot(p.x-pos(start).x,p.y-pos(start).y)>15)return pos(start);
  for(let i=0;i<queue.length&&!parents.has(end);i++){const n=queue[i],x=n%cols,y=Math.floor(n/cols);for(const next of [x>0?n-1:-1,x<cols-1?n+1:-1,y>0?n-cols:-1,y<rows-1?n+cols:-1])if(next>=0&&!parents.has(next)){const point=pos(next);if(!room.blocked(point.x,point.y)){parents.set(next,n);queue.push(next);}}}
  if(!parents.has(end))return target;let next=end;while(parents.get(next)!==start&&parents.get(next)!==-1)next=parents.get(next);return pos(next);
}
module.exports={route};
