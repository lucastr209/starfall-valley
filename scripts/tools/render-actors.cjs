'use strict';
// Reproducible visual fixture: uses the shipped renderer, with no external art or libraries.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '..', fs.existsSync(path.join(__dirname, '..', 'public')) ? '.' : '..');
const actors = require(path.join(ROOT, 'public/js/world/world-actors.js'));
const data = require(path.join(ROOT, 'public/js/data/game-data.js'));
const movementFrames=actors.artMetrics.gaitFrames||6,cellWidth=960/movementFrames;
const width = 960, height = 720, pixels = Buffer.alloc(width * height * 4), shapes = [], stack = [];
const ctx = {
  fillStyle: '#f5eedb', globalAlpha: 1, matrix: [1, 0, 0, 1, 0, 0],
  save() { stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,matrix:this.matrix.slice()}); },
  restore() { Object.assign(this, stack.pop()); },
  translate(x,y) { const m=this.matrix;m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y; },
  scale(x,y) { const m=this.matrix;m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y; },
  fillRect(x,y,w,h) {
    const m=this.matrix, ax=m[0]*x+m[4], ay=m[3]*y+m[5], bw=m[0]*w,bh=m[3]*h;
    const left=Math.floor(Math.min(ax,ax+bw)),top=Math.floor(Math.min(ay,ay+bh)),right=Math.ceil(Math.max(ax,ax+bw)),bottom=Math.ceil(Math.max(ay,ay+bh));
    const hex=this.fillStyle.slice(1), color=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)),alpha=(hex.length===8?parseInt(hex.slice(6,8),16)/255:1)*this.globalAlpha;
    shapes.push(`<rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`);
    for(let py=Math.max(0,top);py<Math.min(height,bottom);py++)for(let px=Math.max(0,left);px<Math.min(width,right);px++){
      const index=(py*width+px)*4;
      for(let channel=0;channel<3;channel++)pixels[index+channel]=Math.round(color[channel]*alpha+pixels[index+channel]*(1-alpha));
      pixels[index+3]=255;
    }
  }
};
ctx.fillRect(0,0,width,height);
const profiles=[{id:'player',name:'Lữ khách',shirt:'#5f9895',hair:'#55414b'},...data.npcs];
const text=[];
const caption=(label,x,y,size=12)=>text.push(`<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" text-anchor="middle" fill="#344449">${label}</text>`);
caption('Thung Lũng Sao Rơi — nhân vật bốn hướng',480,30,20);
profiles.forEach((profile,index)=>caption(profile.name,40+index*80,64));
actors.directions.forEach((direction,row)=>{
  profiles.forEach((profile,column)=>{
    const x=40+column*80,y=135+row*100;
    ctx.fillStyle=column%2?'#ede3cb':'#f9f3e5';ctx.fillRect(column*80,75+row*100,80,92);
    actors.draw(ctx,{...profile,x,y,isPlayer:profile.id==='player',direction,reducedMotion:true});
  });
  caption(['Trước','Sau','Trái','Phải'][row],480,165+row*100);
});
for(const [running,y,label] of [[false,565,'Đi bộ'],[true,675,'Chạy']]){
  caption(label,480,y-66,14);
  for(let frame=0;frame<movementFrames;frame++){
    const x=cellWidth*(frame+.5);ctx.fillStyle=frame%2?'#ede3cb':'#f9f3e5';ctx.fillRect(frame*cellWidth,y-60,cellWidth,80);
    actors.draw(ctx,{...profiles[0],x,y,isPlayer:true,direction:'right',moving:true,running,distance:frame*(running?actors.artMetrics.runFrameDistance:actors.artMetrics.walkFrameDistance)});
    caption(String(frame+1),x,y+18);
  }
}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,bytes){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([name,bytes])));return Buffer.concat([size,name,bytes,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
const scanlines=Buffer.alloc(height*(width*4+1));for(let row=0;row<height;row++)pixels.copy(scanlines,row*(width*4+1)+1,row*width*4,(row+1)*width*4);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]);
const output=path.join(ROOT,'test-artifacts');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'handheld-sprite-sheet.png'),png);
fs.writeFileSync(path.join(output,'handheld-sprite-sheet.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${shapes.join('')}${text.join('')}</svg>`);
console.log(`Rendered ${profiles.length} characters in four directions and ${movementFrames*2} movement poses (${width}×${height}).`);
