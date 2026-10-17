/* The minimap renders only positions already visible to this game client. */
(function (root) {
  'use strict';
  const BACKGROUNDS = { village:'#6c9e47', forest:'#46724e', coast:'#8ba66c', ruins:'#728378' };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
  function geometry(options) {
    const width = options.width ?? 160, height = options.height ?? 110;
    const worldWidth = options.worldWidth ?? 1600, worldHeight = options.worldHeight ?? 1100;
    if (![width,height,worldWidth,worldHeight].every(n => Number.isFinite(n) && n > 0)) return null;
    const padding = Math.min(5, width / 4, height / 4);
    const scale = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight);
    return { width, height, worldWidth, worldHeight, scale,
      x:(width - worldWidth * scale) / 2, y:(height - worldHeight * scale) / 2 };
  }
  function project(x, y, options = {}) {
    const layout = geometry(options || {});
    if (!layout || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x:layout.x + clamp(x,0,layout.worldWidth) * layout.scale,
      y:layout.y + clamp(y,0,layout.worldHeight) * layout.scale };
  }
  function draw(ctx, options = {}) {
    if (!ctx) return false;
    options = options || {};
    const layout = geometry({ ...options, width:options.width ?? ctx.canvas?.width ?? 160,
      height:options.height ?? ctx.canvas?.height ?? 110 });
    if (!layout) return false;
    const map = options.map, sx = x => layout.x + clamp(x,0,layout.worldWidth) * layout.scale,
      sy = y => layout.y + clamp(y,0,layout.worldHeight) * layout.scale;
    const visible = point => finitePoint(point) && (point.map == null || point.map === map);
    const radius = Math.min(1,layout.width / 80,layout.height / 55);
    function dot(point, size, color) {
      ctx.beginPath();ctx.arc(sx(point.x),sy(point.y),size * radius,0,Math.PI * 2);
      ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#203b3d';ctx.lineWidth=1;ctx.stroke();
    }
    ctx.save();
    try {
      ctx.setTransform?.(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
      ctx.setLineDash?.([]);ctx.clearRect(0,0,layout.width,layout.height);
      ctx.fillStyle='#203b3d';ctx.fillRect(0,0,layout.width,layout.height);
      ctx.fillStyle=BACKGROUNDS[map] || '#718277';
      ctx.fillRect(layout.x,layout.y,layout.worldWidth * layout.scale,layout.worldHeight * layout.scale);
      if (options.terrain) {
        // A missing or not-yet-ready optional terrain image must not stop gameplay.
        try {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(options.terrain,layout.x,layout.y,layout.worldWidth * layout.scale,layout.worldHeight * layout.scale);
          ctx.imageSmoothingEnabled = false;
        } catch (_) {
          ctx.imageSmoothingEnabled = false;
        }
      }
      ctx.strokeStyle = '#182d30';
      ctx.lineWidth = 1;
      ctx.strokeRect(layout.x - 0.5, layout.y - 0.5, layout.worldWidth * layout.scale + 1, layout.worldHeight * layout.scale + 1);
      const camera=options.camera;
      if (finitePoint(camera) && Number.isFinite(camera.width) && camera.width > 0 && Number.isFinite(camera.height) && camera.height > 0) {
        const left=sx(camera.x),top=sy(camera.y),right=sx(camera.x + camera.width),bottom=sy(camera.y + camera.height);
        if (right > left && bottom > top) {
          ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(left,top,right-left,bottom-top);
          ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1;ctx.strokeRect(left,top,right-left,bottom-top);
        }
      }
      if (Array.isArray(options.objects)) for (const object of options.objects) {
        if (!visible(object) || !['gate','portal','door'].includes(object.kind)) continue;
        const x=sx(object.x),y=sy(object.y),size=3 * radius;
        ctx.fillStyle='#64d8eb';ctx.strokeStyle='#203b3d';ctx.lineWidth=1;
        ctx.fillRect(x-size,y-size,size*2,size*2);ctx.strokeRect(x-size,y-size,size*2,size*2);
      }
      if (Array.isArray(options.npcs)) for (const npc of options.npcs) {
        if (visible(npc)) dot(npc,2.1,npc.marker ? '#eacd72' : '#80e0b8');
      }
      if (Array.isArray(options.peers)) for (const peer of options.peers) {
        if (visible(peer)) dot(peer,2.3,'#89baff');
      }
      const target=options.target;
      if (visible(target)) {
        const x=sx(target.x),y=sy(target.y),size=4.5 * radius;
        ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size,y);ctx.lineTo(x,y+size);ctx.lineTo(x-size,y);ctx.closePath();
        ctx.fillStyle='#ffe08a';ctx.fill();ctx.strokeStyle='#6c501a';ctx.lineWidth=1.5;ctx.stroke();
      }
      if (visible(options.player)) {
        const x=sx(options.player.x),y=sy(options.player.y);
        ctx.beginPath();ctx.arc(x,y,5 * radius,0,Math.PI * 2);
        ctx.strokeStyle='#203b3d';ctx.lineWidth=3;ctx.stroke();
        ctx.strokeStyle='#51efda';ctx.lineWidth=1.5;ctx.stroke();
        dot(options.player,2.8,'#ffffff');
      }
      ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;
      ctx.strokeRect(.5,.5,Math.max(0,layout.width-1),Math.max(0,layout.height-1));
    } finally { ctx.restore(); }
    return true;
  }
  const api = { draw, project };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StardropMinimap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
