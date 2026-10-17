'use strict';

/**
 * capture-scenes.cjs
 *
 * Standalone E2E visual test capture infrastructure using Chrome DevTools Protocol (CDP).
 * Captures all 16 QA scenes across desktop (1280x720) and mobile (844x390 landscape) viewports,
 * executes frame-time performance benchmarking on the heaviest scene,
 * and captures reduced-motion verification frames.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Default configurations
const DEFAULT_CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEFAULT_CHROME_PORT = 9333;
const DEFAULT_SERVER_PORT = 4173;
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'test-artifacts', 'baseline');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// All 16 QA scenes specified in ORIGINAL_REQUEST.md & DISPATCH.md
const SCENES = [
  {
    id: 'title',
    name: 'Màn hình mở đầu',
    query: '/?qa=1',
    isTitle: true
  },
  {
    id: 'day-village',
    alias: 'day',
    name: 'Ban ngày (Làng Ánh Sao)',
    query: '/?qa=1&scene=roads&map=village&weather=day'
  },
  {
    id: 'day-forest',
    name: 'Ban ngày (Rừng Rì Rào)',
    query: '/?qa=1&scene=roads&map=forest&weather=day'
  },
  {
    id: 'day-coast',
    name: 'Ban ngày (Bờ Vịnh Ngọc)',
    query: '/?qa=1&scene=roads&map=coast&weather=day'
  },
  {
    id: 'night-village',
    alias: 'night',
    name: 'Ban đêm (Làng Ánh Sao)',
    query: '/?qa=1&scene=roads&map=village&weather=night'
  },
  {
    id: 'night-forest',
    name: 'Ban đêm (Rừng Rì Rào)',
    query: '/?qa=1&scene=roads&map=forest&weather=night'
  },
  {
    id: 'night-coast',
    name: 'Ban đêm (Bờ Vịnh Ngọc)',
    query: '/?qa=1&scene=roads&map=coast&weather=night'
  },
  {
    id: 'rain',
    name: 'Mưa ban ngày (Làng Ánh Sao)',
    query: '/?qa=1&scene=roads&map=village&weather=rain'
  },
  {
    id: 'rain-night',
    name: 'Mưa ban đêm (Làng Ánh Sao)',
    query: '/?qa=1&scene=roads&map=village&weather=rain-night'
  },
  {
    id: 'farm',
    name: 'Nông trại',
    query: '/?qa=1&scene=farm'
  },
  {
    id: 'fish',
    name: 'Bờ câu cá',
    query: '/?qa=1&scene=fish'
  },
  {
    id: 'battle',
    name: 'Chiến đấu quái rừng',
    query: '/?qa=1&scene=battle'
  },
  {
    id: 'camp',
    name: 'Trại thám hiểm',
    query: '/?qa=1&scene=camp'
  },
  {
    id: 'npc',
    name: 'Cư dân di chuyển quanh làng',
    query: '/?qa=1&scene=npc'
  },
  {
    id: 'actors-down',
    alias: 'actors',
    name: 'Nhân vật hướng nhìn xuống',
    query: '/?qa=1&scene=actors&look=down'
  },
  {
    id: 'actors-up',
    name: 'Nhân vật hướng nhìn lên',
    query: '/?qa=1&scene=actors&look=up'
  },
  {
    id: 'actors-left',
    name: 'Nhân vật hướng nhìn trái',
    query: '/?qa=1&scene=actors&look=left'
  },
  {
    id: 'actors-right',
    name: 'Nhân vật hướng nhìn phải',
    query: '/?qa=1&scene=actors&look=right'
  },
  {
    id: 'roads-village',
    alias: 'roads',
    name: 'Đường sá làng & công trình',
    query: '/?qa=1&scene=roads&map=village'
  },
  {
    id: 'roads-coast',
    name: 'Đường sá bờ biển',
    query: '/?qa=1&scene=roads&map=coast'
  },
  {
    id: 'caves-forest',
    alias: 'caves',
    name: 'Hang Rêu Sao (Rừng)',
    query: '/?qa=1&scene=caves&room=cave-forest',
    isInterior: true
  },
  {
    id: 'caves-coast',
    name: 'Hang Thủy Triều (Bờ biển)',
    query: '/?qa=1&scene=caves&room=cave-coast',
    isInterior: true
  },
  {
    id: 'caves-ruins',
    name: 'Hang Tinh Vân (Tàn tích)',
    query: '/?qa=1&scene=caves&room=cave-ruins',
    isInterior: true
  },
  {
    id: 'homes',
    name: 'Nội thất nhà Mira',
    query: '/?qa=1&scene=homes&room=home-mira',
    isInterior: true
  },
  {
    id: 'boss',
    name: 'Khu vực đấu Boss Hộ Vệ Rễ Sao',
    query: '/?qa=1&scene=boss'
  },
  {
    id: 'finale',
    name: 'Cảnh Đêm Hội Sao (Finale)',
    query: '/?qa=1&scene=finale'
  }
];

const VIEWPORTS = [
  {
    id: 'desktop',
    name: 'Desktop (1280x720)',
    width: 1280,
    height: 720,
    mobile: false,
    touch: false
  },
  {
    id: 'mobile',
    name: 'Mobile Landscape (844x390)',
    width: 844,
    height: 390,
    mobile: true,
    touch: true,
    screenOrientation: {
      type: 'landscapePrimary',
      angle: 90
    }
  }
];

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  let outputDir = DEFAULT_OUTPUT_DIR;
  let isAfter = false;
  let isBaseline = false;
  let viewportFilter = 'all';
  let scenesFilter = null;
  let skipBench = false;
  let skipReducedMotion = false;
  let chromePort = DEFAULT_CHROME_PORT;
  let serverPort = DEFAULT_SERVER_PORT;
  let chromePath = DEFAULT_CHROME;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--baseline') {
      isBaseline = true;
      outputDir = path.join(__dirname, '..', 'test-artifacts', 'baseline');
    } else if (arg === '--after') {
      isAfter = true;
      outputDir = path.join(__dirname, '..', 'test-artifacts', 'after');
    } else if (arg === '--output-dir' && args[i + 1]) {
      outputDir = path.resolve(args[++i]);
    } else if (arg === '--viewport' && args[i + 1]) {
      viewportFilter = args[++i];
    } else if (arg === '--scenes' && args[i + 1]) {
      scenesFilter = args[++i].split(',').map((s) => s.trim());
    } else if (arg === '--skip-bench') {
      skipBench = true;
    } else if (arg === '--skip-reduced-motion') {
      skipReducedMotion = true;
    } else if (arg === '--chrome-port' && args[i + 1]) {
      chromePort = Number(args[++i]);
    } else if (arg === '--server-port' && args[i + 1]) {
      serverPort = Number(args[++i]);
    } else if (arg === '--chrome-path' && args[i + 1]) {
      chromePath = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/capture-scenes.cjs [options]

Options:
  --baseline              Save baseline artifacts to test-artifacts/baseline/ (default)
  --after                 Save after artifacts to test-artifacts/after/
  --output-dir <path>     Custom output directory
  --viewport <name>       Filter viewports: 'desktop', 'mobile', or 'all' (default: 'all')
  --scenes <list>         Comma-separated list of scene IDs to capture
  --skip-bench            Skip the 120-frame performance benchmark
  --skip-reduced-motion   Skip reduced-motion verification capture
  --chrome-port <port>    CDP remote debugging port (default: 9333)
  --server-port <port>    Game server port (default: 4173)
  --chrome-path <path>    Chrome binary path
      `);
      process.exit(0);
    }
  }

  return {
    outputDir,
    isAfter,
    isBaseline,
    viewportFilter,
    scenesFilter,
    skipBench,
    skipReducedMotion,
    chromePort,
    serverPort,
    chromePath
  };
}

// Server management: check if server is running, or spawn node server/index.js
async function ensureServer(serverPort) {
  const url = `http://localhost:${serverPort}/`;
  let running = false;
  try {
    const res = await fetch(url);
    if (res.ok) running = true;
  } catch {}

  if (running) {
    console.log(`[Server] Game server is already running at ${url}`);
    return null;
  }

  console.log(`[Server] Starting server on port ${serverPort}...`);
  const serverScript = path.join(__dirname, '..', 'server', 'index.js');
  const proc = spawn(process.execPath, [serverScript], {
    env: { ...process.env, PORT: String(serverPort), MAX_HTTP_PER_MINUTE: '10000' },
    stdio: 'ignore'
  });

  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const res = await fetch(url);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
  }

  if (!ready) {
    proc.kill();
    throw new Error(`Failed to start server at ${url} within 10s`);
  }

  console.log(`[Server] Server ready at ${url}`);
  return proc;
}

// Chrome DevTools Protocol Client wrapper
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method) {
          this.emit(msg.method, msg.params);
        }
      } catch (err) {
        console.error('[CDP] Message parse error:', err);
      }
    });
  }

  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(handler);
  }

  off(event, handler) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      for (const handler of this.eventListeners.get(event)) {
        try { handler(data); } catch (e) { console.error(e); }
      }
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const i = ++this.id;
      this.pending.set(i, { resolve, reject });
      this.ws.send(JSON.stringify({ id: i, method, params }));
    });
  }

  async evalJs(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    return res?.result?.value;
  }

  async close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

// Navigate and reliably wait for page load
async function navigateAndWait(cdp, url) {
  let loadFired = false;
  const onLoad = () => { loadFired = true; };
  cdp.on('Page.loadEventFired', onLoad);

  try {
    await cdp.send('Page.navigate', { url });
    for (let i = 0; i < 60; i++) {
      if (loadFired) break;
      await sleep(100);
    }
  } finally {
    cdp.off('Page.loadEventFired', onLoad);
  }

  // Double check document readyState
  for (let i = 0; i < 40; i++) {
    try {
      const ready = await cdp.evalJs('document.readyState === "complete"');
      if (ready) break;
    } catch {}
    await sleep(100);
  }
  await sleep(400);
}

// Start scene and wait for render
async function prepareScene(cdp, scene) {
  if (scene.isTitle) {
    // Wait for titleCanvas to render
    for (let i = 0; i < 40; i++) {
      try {
        const titleReady = await cdp.evalJs(`(() => {
          const c = document.getElementById('titleCanvas');
          return c && c.width > 0 && c.height > 0;
        })()`);
        if (titleReady) break;
      } catch {}
      await sleep(100);
    }
    await sleep(1200);
    return;
  }

  // Click start or continue button
  for (let i = 0; i < 30; i++) {
    try {
      const clicked = await cdp.evalJs(`(() => {
        const btn = [...document.querySelectorAll('button')].find(x => /Bắt đầu|Tiếp tục/.test(x.textContent));
        if (btn && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
        return false;
      })()`);
      if (clicked) break;
    } catch {}
    await sleep(150);
  }

  // Wait until start screen is hidden and game engine is active
  for (let i = 0; i < 40; i++) {
    try {
      const running = await cdp.evalJs(`(() => {
        const s = document.getElementById('start-screen');
        return (!s || s.hidden) && !!window.StardropQA;
      })()`);
      if (running) break;
    } catch {}
    await sleep(100);
  }

  // For interior scenes (homes & caves), enter the room
  if (scene.isInterior) {
    try {
      await cdp.evalJs(`(() => {
        if (window.StardropQA && !window.StardropQA.getInterior()) {
          window.StardropQA.interact();
          const landmarkBtn = document.querySelector('button[data-landmark]');
          if (landmarkBtn) landmarkBtn.click();
        }
      })()`);
    } catch {}

    for (let i = 0; i < 30; i++) {
      try {
        const inside = await cdp.evalJs('!!window.StardropQA?.getInterior()');
        if (inside) break;
      } catch {}
      await sleep(100);
    }
    await sleep(1000);
  } else {
    await sleep(1200);
  }
}

// Main execution routine
async function main() {
  const options = parseArgs();
  console.log('=== Thung Lũng Sao Rơi — E2E Visual Capture Infrastructure ===');
  console.log(`Output Directory: ${options.outputDir}`);
  console.log(`Target Viewports: ${options.viewportFilter}`);
  fs.mkdirSync(options.outputDir, { recursive: true });

  let serverProc = null;
  let chromeProc = null;
  let cdp = null;
  const tempUserDataDir = path.join(os.tmpdir(), `chrome-cdp-${Date.now()}`);

  const cleanup = () => {
    if (cdp) {
      try { cdp.close(); } catch {}
    }
    if (chromeProc && !chromeProc.killed) {
      try { chromeProc.kill(); } catch {}
    }
    if (serverProc && !serverProc.killed) {
      try { serverProc.kill(); } catch {}
    }
    try {
      if (fs.existsSync(tempUserDataDir)) {
        fs.rmSync(tempUserDataDir, { recursive: true, force: true });
      }
    } catch {}
  };

  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  try {
    // 1. Ensure local server is available
    serverProc = await ensureServer(options.serverPort);

    // 2. Launch headless Chrome with CDP
    console.log(`[Chrome] Launching Chrome: ${options.chromePath}`);
    chromeProc = spawn(
      options.chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1400,900',
        `--remote-debugging-port=${options.chromePort}`,
        `--user-data-dir=${tempUserDataDir}`,
        'about:blank'
      ],
      { stdio: 'ignore' }
    );

    // 3. Discover WebSocket debugger target
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${options.chromePort}/json`);
        const json = await res.json();
        target = json.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch {}
    }

    if (!target) {
      throw new Error(`Failed to find Chrome page target on port ${options.chromePort}`);
    }

    console.log(`[CDP] Connecting to ${target.webSocketDebuggerUrl}`);
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Filter scenes if specified
    const scenesToCapture = options.scenesFilter
      ? SCENES.filter((s) => options.scenesFilter.includes(s.id) || (s.alias && options.scenesFilter.includes(s.alias)))
      : SCENES;

    // Filter viewports
    const viewportsToRun = options.viewportFilter === 'all'
      ? VIEWPORTS
      : VIEWPORTS.filter((v) => v.id === options.viewportFilter);

    console.log(`\nCapturing ${scenesToCapture.length} scenes across ${viewportsToRun.length} viewport(s)...`);

    // 4. Capture scenes per viewport
    for (const vp of viewportsToRun) {
      console.log(`\n--- Viewport: ${vp.name} ---`);
      const vpDir = path.join(options.outputDir, vp.id);
      fs.mkdirSync(vpDir, { recursive: true });

      // Apply device metrics emulation
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
        screenOrientation: vp.screenOrientation
      });

      if (vp.touch) {
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      } else {
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      }

      for (let idx = 0; idx < scenesToCapture.length; idx++) {
        const scene = scenesToCapture[idx];
        const sceneUrl = `http://localhost:${options.serverPort}${scene.query}`;
        process.stdout.write(`  [${idx + 1}/${scenesToCapture.length}] ${scene.name} (${scene.id})... `);

        // Reliable navigation and scene preparation
        await navigateAndWait(cdp, sceneUrl);
        await prepareScene(cdp, scene);

        // Capture screenshot with minimum valid size check (guard against blank/transition frames)
        let imgBuffer = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const shotRes = await cdp.send('Page.captureScreenshot', { format: 'png' });
          imgBuffer = Buffer.from(shotRes.data, 'base64');
          if (imgBuffer.length > 20000 || scene.isTitle) break;
          // Suspiciously small (<20KB), wait and retry
          await sleep(1500);
        }

        // Save in viewport directory
        const vpFilePath = path.join(vpDir, `${scene.id}.png`);
        fs.writeFileSync(vpFilePath, imgBuffer);

        // Save alias in viewport dir if defined (e.g. day.png -> day-village.png)
        if (scene.alias) {
          fs.writeFileSync(path.join(vpDir, `${scene.alias}.png`), imgBuffer);
        }

        // If desktop viewport, also place in top-level outputDir for convenience and compatibility
        if (vp.id === 'desktop') {
          fs.writeFileSync(path.join(options.outputDir, `${scene.id}.png`), imgBuffer);
          if (scene.alias) {
            fs.writeFileSync(path.join(options.outputDir, `${scene.alias}.png`), imgBuffer);
          }
        }

        console.log(`OK (${(imgBuffer.length / 1024).toFixed(1)} KB)`);
      }
    }

    // 5. Reduced-Motion Verification
    if (!options.skipReducedMotion) {
      console.log('\n--- Reduced-Motion Verification ---');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });

      const reducedUrl = `http://localhost:${options.serverPort}/?qa=1&scene=roads&map=village&weather=rain-night&motion=reduced`;
      console.log(`Navigating to ${reducedUrl}...`);
      await navigateAndWait(cdp, reducedUrl);
      await prepareScene(cdp, { id: 'reduced-motion', isTitle: false });

      // Frame 1
      const f1Res = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const f1Buf = Buffer.from(f1Res.data, 'base64');
      const f1Path = path.join(options.outputDir, 'reduced-motion-1.png');
      fs.writeFileSync(f1Path, f1Buf);
      fs.writeFileSync(path.join(options.outputDir, 'desktop', 'reduced-motion-1.png'), f1Buf);
      console.log(`Frame 1 captured (reduced-motion-1.png, ${(f1Buf.length / 1024).toFixed(1)} KB). Waiting 1000ms...`);

      await sleep(1000);

      // Frame 2
      const f2Res = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const f2Buf = Buffer.from(f2Res.data, 'base64');
      const f2Path = path.join(options.outputDir, 'reduced-motion-2.png');
      fs.writeFileSync(f2Path, f2Buf);
      fs.writeFileSync(path.join(options.outputDir, 'desktop', 'reduced-motion-2.png'), f2Buf);
      console.log(`Frame 2 captured (reduced-motion-2.png, ${(f2Buf.length / 1024).toFixed(1)} KB).`);

      // Compare pixel buffers
      let diffBytes = 0;
      const minLen = Math.min(f1Buf.length, f2Buf.length);
      for (let b = 0; b < minLen; b++) {
        if (f1Buf[b] !== f2Buf[b]) diffBytes++;
      }
      diffBytes += Math.abs(f1Buf.length - f2Buf.length);
      console.log(`Reduced motion frame byte delta: ${diffBytes} / ${f1Buf.length} bytes`);
    }

    // 6. Frame Time Performance Benchmark
    if (!options.skipBench) {
      console.log('\n--- Frame Time Performance Benchmark ---');
      const benchUrl = `http://localhost:${options.serverPort}/?qa=1&scene=roads&map=village&weather=rain-night`;
      console.log(`Measuring heaviest scene: ${benchUrl}`);

      // Ensure desktop viewport
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });

      await navigateAndWait(cdp, benchUrl);
      await prepareScene(cdp, { id: 'bench', isTitle: false });
      await sleep(1200); // Allow entities and ambient effects to settle

      console.log('Collecting 130 frame intervals in browser via requestAnimationFrame...');
      const deltas = await cdp.evalJs(`new Promise((resolve) => {
        const times = [];
        let last = performance.now();
        let count = 0;
        function step(now) {
          const delta = now - last;
          last = now;
          if (count > 0) times.push(delta); // skip initial spike
          count++;
          if (count < 140) {
            requestAnimationFrame(step);
          } else {
            resolve(times);
          }
        }
        requestAnimationFrame(step);
      })`);

      if (!Array.isArray(deltas) || deltas.length < 100) {
        throw new Error(`Benchmark failed to collect enough frames: ${deltas?.length}`);
      }

      deltas.sort((a, b) => a - b);
      const count = deltas.length;
      const sum = deltas.reduce((acc, v) => acc + v, 0);
      const avgMs = Number((sum / count).toFixed(3));
      const medianMs = Number(
        (count % 2 === 0
          ? (deltas[count / 2 - 1] + deltas[count / 2]) / 2
          : deltas[Math.floor(count / 2)]
        ).toFixed(3)
      );
      const p95Index = Math.min(count - 1, Math.floor(count * 0.95));
      const p95Ms = Number(deltas[p95Index].toFixed(3));
      const minMs = Number(deltas[0].toFixed(3));
      const maxMs = Number(deltas[count - 1].toFixed(3));

      const perfResult = {
        scene: 'roads&map=village&weather=rain-night',
        frameCount: count,
        medianMs,
        p95Ms,
        avgMs,
        minMs,
        maxMs,
        timestamp: new Date().toISOString(),
        samples: deltas
      };

      const perfFileName = options.isAfter ? 'perf-after.json' : 'perf-baseline.json';
      const perfPath = path.join(options.outputDir, perfFileName);
      fs.writeFileSync(perfPath, JSON.stringify(perfResult, null, 2));

      console.log(`\nBenchmark Results (${count} frames):`);
      console.log(`  Median:  ${medianMs} ms`);
      console.log(`  95th %:  ${p95Ms} ms`);
      console.log(`  Average: ${avgMs} ms`);
      console.log(`  Min/Max: ${minMs} ms / ${maxMs} ms`);
      console.log(`Saved benchmark data to: ${perfPath}`);
    }

    console.log('\n=== Capture and Verification Completed Successfully ===\n');
  } catch (error) {
    console.error('\n[Error in capture execution]:', error);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, SCENES, VIEWPORTS };
