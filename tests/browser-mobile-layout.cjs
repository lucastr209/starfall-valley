'use strict';

// Chạy riêng với server localhost:4173; Chrome dùng hồ sơ tạm, chỉ vào save QA.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.resolve('test-artifacts/mobile-layout');
fs.mkdirSync(output, { recursive: true });
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9347',
  `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-mobile-'))}`, 'about:blank'
], { stdio: 'ignore' });
let ws, id = 0;
const pending = new Map(), errors = [], results = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const ticket = ++id; pending.set(ticket, { resolve, reject });
  ws.send(JSON.stringify({ id: ticket, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
async function until(expression) {
  for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error(`Timeout: ${expression}`);
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
  await delay(80);
  const r = await evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x + r.width / 2, y: r.y + r.height / 2, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x + r.width / 2, y: r.y + r.height / 2, button: 'left', clickCount: 1 });
}
const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
(async () => {
  try {
    let target;
    for (let i = 0; i < 60 && !target; i++) {
      try { target = (await (await fetch('http://127.0.0.1:9347/json')).json()).find(t => t.type === 'page'); } catch {}
      if (!target) await delay(100);
    }
    assert.ok(target, 'Chrome started');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    ws.addEventListener('message', ({ data }) => {
      const r = JSON.parse(data);
      if (r.id) { const p = pending.get(r.id); pending.delete(r.id); r.error ? p.reject(new Error(r.error.message)) : p.resolve(r.result); }
      if (r.method === 'Runtime.exceptionThrown') errors.push(r.params.exceptionDetails);
      if (r.method === 'Runtime.consoleAPICalled' && r.params.type === 'error') errors.push(r.params);
      if (r.method === 'Log.entryAdded' && r.params.entry.level === 'error') errors.push(r.params.entry);
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
    await send('DOM.enable'); await send('CSS.enable');
    for (const [width, height, safe = false] of [[844,390], [740,360], [667,375], [568,320], [568,280], [640,260], [1024,600], [1280,720], [844,390,true], [568,280,true]]) {
      if (process.argv.includes('--scenes-only')) break;
      const mobile = width <= 1100;
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 });
      await send('Page.navigate', { url: 'http://localhost:4173/?qa=1&scene=actors' });
      await until('document.readyState === "complete" && !!window.StardropQA');
      // Chrome này chưa hỗ trợ CDP safe-area: thay env bằng inset cố định chỉ trong trang QA.
      if (safe) {
        const { frameTree } = await send('Page.getFrameTree');
        const { styleSheetId } = await send('CSS.createStyleSheet', { frameId:frameTree.frame.id });
        const css = fs.readFileSync(path.resolve('public/css/styles.css'),'utf8').replace(/env\(safe-area-inset-(left|right|top|bottom)\)/g,(_,edge)=>({left:47,right:47,top:0,bottom:21}[edge])+'px');
        await send('CSS.setStyleSheetText',{styleSheetId,text:css});
      }
      await click('#btn-start');
      await until('!document.getElementById("play-screen").hidden');
      await until('!document.getElementById("toast").classList.contains("visible")');
      await delay(200);
      const layout = await evaluate(`(() => {
        const ids = ['gameCanvas','btn-mobile-menu','btn-journal','btn-build','btn-inventory','btn-help','btn-mobile-quests','btn-mobile-chat','btn-journey','touch-joystick','touch-run','touch-dodge','touch-attack','touch-interact','btn-minimap'];
        return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,rects:Object.fromEntries(ids.map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()]))};
      })()`);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, `${width}x${height}${safe ? '-safe' : ''}${process.argv.includes('--baseline') ? '-before' : ''}.png`), Buffer.from(data, 'base64'));
      results.push(layout);
      if (process.argv.includes('--baseline')) { console.log(JSON.stringify(layout)); continue; }
      assert.ok(layout.scroll <= width, `${width}x${height}: no horizontal overflow`);
      if (safe) assert.equal(layout.rects['btn-mobile-menu'].left,57,'Safe-area simulation is active');
      if (mobile) {
        const r = layout.rects, utilityIds = ['btn-journal','btn-build','btn-inventory','btn-help','btn-mobile-quests','btn-mobile-chat'];
        assert.ok(r.gameCanvas.top <= 1 && r.gameCanvas.bottom >= height-1,`${width}x${height}: canvas fills viewport`);
        assert.equal(await evaluate('document.getElementById("btn-mobile-menu").getAttribute("aria-expanded")'),'false','Utility menu starts closed');
        for (const key of utilityIds) assert.equal(r[key].width,0,`${width}x${height}: ${key} hidden until menu opens`);
        let buttons = Object.entries(r).filter(([key]) => key !== 'gameCanvas' && !utilityIds.includes(key));
        for (const [key, rect] of buttons) {
          assert.ok(rect.width >= 44 && rect.height >= 44, `${width}x${height}: ${key} touch target`);
          assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= width + 1 && rect.bottom <= height + 1, `${width}x${height}: ${key} inside viewport`);
          assert.equal(await evaluate(`document.elementFromPoint(${rect.x+rect.width/2},${rect.y+rect.height/2})?.closest('button')?.id`),key, `${width}x${height}: ${key} receives taps`);
        }
        for (let a = 0; a < buttons.length; a++) for (let b = a + 1; b < buttons.length; b++) assert.ok(!overlaps(buttons[a][1], buttons[b][1]), `${width}x${height}: ${buttons[a][0]} overlaps ${buttons[b][0]}`);
        assert.equal(await evaluate(`document.elementFromPoint(${width/2},${height/2})?.id`),'gameCanvas',`${width}x${height}: center remains playable`);
        assert.ok(r['touch-run'].left >= width - (safe ? 47 : 0) - 150, `${width}x${height}: action cluster stays in corner`);
        await click('#btn-mobile-menu');
        assert.equal(await evaluate('document.getElementById("btn-mobile-menu").getAttribute("aria-expanded")'),'true','Utility menu opens');
        const opened=await evaluate(`Object.fromEntries(${JSON.stringify(utilityIds)}.map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()]))`);
        for(const [key,rect] of Object.entries(opened)){
          assert.ok(rect.width>=44&&rect.height>=44&&rect.left>=0&&rect.right<=width&&rect.bottom<=height,`${width}x${height}: ${key} accessible in menu`);
          assert.equal(await evaluate(`document.elementFromPoint(${rect.x+rect.width/2},${rect.y+rect.height/2})?.closest('button')?.id`),key,`${width}x${height}: ${key} receives taps`);
        }
        buttons=Object.entries(opened);
        for(let a=0;a<buttons.length;a++)for(let b=a+1;b<buttons.length;b++)assert.ok(!overlaps(buttons[a][1],buttons[b][1]),`${width}x${height}: expanded utility buttons overlap`);
        await click('#btn-mobile-menu');
        assert.equal(await evaluate('document.getElementById("btn-mobile-menu").getAttribute("aria-expanded")'),'false','Utility menu closes');
        assert.equal(await evaluate('document.getElementById("btn-minimap").getAttribute("aria-expanded")'), 'false', 'Mobile minimap starts collapsed');
        await click('#btn-minimap');
        assert.equal(await evaluate('document.getElementById("btn-minimap").getAttribute("aria-expanded")'),'true','Minimap opens');
        const mapRect=await evaluate('document.getElementById("minimapCanvas").getBoundingClientRect().toJSON()');
        assert.ok(!overlaps(mapRect,await evaluate('document.querySelector(".mapbar").getBoundingClientRect().toJSON()')),'Expanded map clears region bar');
        for (const key of ['btn-mobile-menu','btn-journey','btn-minimap','touch-run','touch-dodge','touch-attack','touch-interact']) assert.ok(!overlaps(mapRect,r[key]),`${width}x${height}: expanded minimap overlaps ${key}`);
        assert.equal(await evaluate(`document.elementFromPoint(${mapRect.x+mapRect.width/2},${mapRect.y+2})?.id`),'minimapCanvas','Expanded map is not covered by HUD');
        await click('#btn-minimap');
        for (const selector of ['#btn-journal','#btn-build','#btn-inventory','#btn-help','#btn-journey']) {
          if(selector!=='#btn-journey')await click('#btn-mobile-menu');
          await click(selector); await until('document.getElementById("game-dialog").open');
          assert.equal(await evaluate('document.getElementById("btn-mobile-menu").getAttribute("aria-expanded")'),'false','Menu closes after utility action');
          await click('#dialog-close'); await until('!document.getElementById("game-dialog").open');
        }
        for (const panel of ['quests','chat']) {
          await click('#btn-mobile-menu');
          await click(`#btn-mobile-${panel}`);
          assert.equal(await evaluate('document.getElementById("play-screen").dataset.mobilePanelOpen'),panel);
          await click('#mobile-panel-close');
          assert.equal(await evaluate('document.getElementById("play-screen").dataset.mobilePanelOpen'),'');
        }
        await click('#touch-run');
        assert.equal(await evaluate('StardropQA.getLocomotion().touchRun'),true,'Run toggles on');
        const stick = r['touch-joystick'], start = await evaluate('StardropQA.getLocomotion().distance');
        const point = { x:stick.x+stick.width/2,y:stick.y+stick.height/2,id:1 };
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+28}]});
        await delay(220);
        assert.ok(await evaluate('StardropQA.getLocomotion().distance') > start,'Touch joystick moves player');
        const activePointer=await evaluate('StardropQA.getLocomotion().joystickPointer');
        await send('Emulation.setDeviceMetricsOverride',{width,height:height-30,deviceScaleFactor:1,mobile:true});
        await delay(100);
        assert.equal(await evaluate('StardropQA.getLocomotion().joystickPointer'),activePointer,'Height change preserves active gesture');
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await evaluate('StardropQA.getLocomotion().joystickPointer'),null,'Release clears joystick');
        await click('#btn-mobile-menu'); await click('#btn-inventory');
        assert.equal(await evaluate('StardropQA.getLocomotion().touchRun'),false,'Opening modal clears run');
        await click('#dialog-close');
        await click('#touch-attack');
        assert.ok(await evaluate('!!StardropQA.getCombat().attack'),'Attack starts from button');
        await until('!StardropQA.getCombat().attack');
        await click('#touch-dodge');
        assert.ok(await evaluate('!!StardropQA.getCombat().dodge'),'Dodge starts from button');
        await until('!StardropQA.getCombat().dodge');
        await click('#touch-interact');
        if (await evaluate('document.getElementById("game-dialog").open')) await click('#dialog-close');
        await click('#btn-fullscreen');
        await until('document.getElementById("btn-fullscreen").getAttribute("aria-pressed") === "true"');
        await click('#btn-fullscreen');
        await until('document.getElementById("btn-fullscreen").getAttribute("aria-pressed") === "false"');
        await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
        await until('!document.getElementById("rotate-notice").hidden');
        assert.equal(await evaluate('StardropQA.getLocomotion().touchRun'),false,'Portrait blocks movement');
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        await until('document.getElementById("rotate-notice").hidden');
        assert.equal(await evaluate('localStorage.getItem("starfall-valley-save-v1")'),null,'Player save untouched');
        assert.ok(await evaluate('localStorage.getItem("starfall-valley-qa-save")'),'QA save used');
      }
      console.log(`PASS layout ${width}x${height}`);
    }
    if (!process.argv.includes('--baseline')) for (const [width,height] of [[844,390],[568,280]]) for (const scene of ['fish','homes']) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
      await send('Page.navigate',{url:`http://localhost:4173/?qa=1&scene=${scene}`});
      await until(`document.readyState === 'complete' && !!window.StardropQA && location.search.includes('scene=${scene}')`);
      await click('#btn-start'); await until('!document.getElementById("play-screen").hidden');
      await until('!document.getElementById("toast").classList.contains("visible")');
      if (scene === 'fish') {
        await click('#touch-interact'); await until('!document.getElementById("fishing").hidden');
        const fish=await evaluate('document.getElementById("fishing").getBoundingClientRect().toJSON()');
        assert.ok(fish.top>=0 && fish.bottom<=height,'Fishing stays in playable viewport');
      } else {
        await click('#touch-interact');
        assert.ok(await evaluate('!!StardropQA.getInterior()'),'Interior fixture entered');
        const leave=await evaluate('document.getElementById("btn-leave-room").getBoundingClientRect().toJSON()');
        for (const id of ['touch-run','touch-dodge','touch-attack','touch-interact','btn-journey']) assert.ok(!overlaps(leave,await evaluate(`document.getElementById('${id}').getBoundingClientRect().toJSON()`)),`${width}x${height}: leave-room overlaps ${id}`);
      }
      const shot=await send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(output,`${width}x${height}-${scene}.png`),Buffer.from(shot.data,'base64'));
      if (scene === 'homes') { await click('#btn-leave-room'); assert.equal(await evaluate('StardropQA.getInterior()'),null,'Leave-room button exits'); }
      console.log(`PASS scene ${scene} ${width}x${height}`);
    }
    assert.equal(errors.length, 0, JSON.stringify(errors));
  } finally {
    fs.writeFileSync(path.join(output, process.argv.includes('--baseline') ? 'before.json' : 'results.json'), JSON.stringify({ results, errors }, null, 2));
    ws?.close(); chrome.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
