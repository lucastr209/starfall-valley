# E2E Visual Test Infrastructure & Baseline Readiness (Milestone M-TEST)

**Project:** Thung Lũng Sao Rơi  
**Date:** 2026-10-15  
**Milestone:** M-TEST (E2E Visual Test Infrastructure & Baseline Capture)  
**Status:** READY / VERIFIED

---

## 1. Executive Summary

The automated visual testing infrastructure using Chrome DevTools Protocol (CDP) has been fully implemented and verified. All unit tests pass, actor sprite sheets are generated from the genuine renderer, all 26 QA scenes have been captured across both desktop (1280×720) and mobile landscape (844×390) viewports, the frame-time performance baseline has been benchmarked, and reduced-motion reference frames have been recorded.

The baseline artifacts are saved in `test-artifacts/baseline/` and serve as the golden reference for Milestone M1 (World), M2 (Lighting & Weather), M3 (Actors & Monsters), M4 (UI/HUD), and M5 (Verification & Final Signoff).

---

## 2. Test Runner Commands

### Automated Visual Capture (CDP)
- **Capture Baseline:**
  ```powershell
  node scripts/capture-scenes.cjs --baseline
  ```
- **Capture Post-Upgrade (After):**
  ```powershell
  node scripts/capture-scenes.cjs --after
  ```
- **Custom Options:**
  ```powershell
  # Filter by viewport (desktop | mobile | all)
  node scripts/capture-scenes.cjs --viewport desktop

  # Filter specific scenes
  node scripts/capture-scenes.cjs --scenes day-village,night-village,rain-night

  # Custom output directory
  node scripts/capture-scenes.cjs --output-dir test-artifacts/custom/
  ```

### Actor Sprite Sheet Generation
```powershell
node tests/render-actors.cjs
```
- Outputs:
  - `test-artifacts/handheld-sprite-sheet.png`
  - `test-artifacts/handheld-sprite-sheet.svg`
- Renders: 12 characters (Lữ khách / Player + 11 NPCs: Mira, Huy, Linh, Thảo, Bảo, Nam, Yến, Sơn, Sen, Kiệt, Lý) in 4 directions (down, up, left, right) and 16 gait movement poses (8 walk, 8 run).

### Unit & Gameplay Tests
```powershell
node --test tests/*.test.js
```
- Result: **471 PASS / 0 FAIL / 2 SKIP** (473 total tests).

### Syntax Validation
```powershell
node -e "const fs = require('fs'), path = require('path'), cp = require('child_process'); function checkDir(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.name === 'node_modules' || f.name === 'archive' || f.name === '.git') continue; const p = path.join(d, f.name); if (f.isDirectory()) checkDir(p); else if (p.endsWith('.js') || p.endsWith('.cjs') || p.endsWith('.mjs')) { cp.execFileSync(process.execPath, ['--check', p]); } } } checkDir('.'); console.log('All JS/CJS/MJS files syntax OK');"
```

---

## 3. Inventory of Captured Baseline Scenes

Each scene is captured at two resolutions:
- **Desktop:** 1280×720 (deviceScaleFactor: 1, touch: false)
- **Mobile Landscape:** 844×390 (deviceScaleFactor: 1, mobile: true, touch: true, landscape orientation)

| # | Scene ID | Alias | Description | QA Query String | Desktop Artifact | Mobile Artifact |
|---|----------|-------|-------------|-----------------|------------------|-----------------|
| 1 | `title` | — | Màn hình mở đầu (Title Canvas) | `/?qa=1` | `baseline/desktop/title.png` | `baseline/mobile/title.png` |
| 2 | `day-village` | `day` | Ban ngày (Làng Ánh Sao) | `/?qa=1&scene=roads&map=village&weather=day` | `baseline/desktop/day-village.png` | `baseline/mobile/day-village.png` |
| 3 | `day-forest` | — | Ban ngày (Rừng Rì Rào) | `/?qa=1&scene=roads&map=forest&weather=day` | `baseline/desktop/day-forest.png` | `baseline/mobile/day-forest.png` |
| 4 | `day-coast` | — | Ban ngày (Bờ Vịnh Ngọc) | `/?qa=1&scene=roads&map=coast&weather=day` | `baseline/desktop/day-coast.png` | `baseline/mobile/day-coast.png` |
| 5 | `night-village` | `night` | Ban đêm (Làng Ánh Sao) | `/?qa=1&scene=roads&map=village&weather=night` | `baseline/desktop/night-village.png` | `baseline/mobile/night-village.png` |
| 6 | `night-forest` | — | Ban đêm (Rừng Rì Rào) | `/?qa=1&scene=roads&map=forest&weather=night` | `baseline/desktop/night-forest.png` | `baseline/mobile/night-forest.png` |
| 7 | `night-coast` | — | Ban đêm (Bờ Vịnh Ngọc) | `/?qa=1&scene=roads&map=coast&weather=night` | `baseline/desktop/night-coast.png` | `baseline/mobile/night-coast.png` |
| 8 | `rain` | — | Mưa ban ngày (Làng Ánh Sao) | `/?qa=1&scene=roads&map=village&weather=rain` | `baseline/desktop/rain.png` | `baseline/mobile/rain.png` |
| 9 | `rain-night` | — | Mưa ban đêm (Làng Ánh Sao) | `/?qa=1&scene=roads&map=village&weather=rain-night` | `baseline/desktop/rain-night.png` | `baseline/mobile/rain-night.png` |
| 10 | `farm` | — | Nông trại 4 luống cây | `/?qa=1&scene=farm` | `baseline/desktop/farm.png` | `baseline/mobile/farm.png` |
| 11 | `fish` | — | Bờ câu cá phía đông làng | `/?qa=1&scene=fish` | `baseline/desktop/fish.png` | `baseline/mobile/fish.png` |
| 12 | `battle` | — | Chiến đấu quái rừng | `/?qa=1&scene=battle` | `baseline/desktop/battle.png` | `baseline/mobile/battle.png` |
| 13 | `camp` | — | Trại thám hiểm | `/?qa=1&scene=camp` | `baseline/desktop/camp.png` | `baseline/mobile/camp.png` |
| 14 | `npc` | — | Cư dân di chuyển quanh làng | `/?qa=1&scene=npc` | `baseline/desktop/npc.png` | `baseline/mobile/npc.png` |
| 15 | `actors-down` | `actors` | Nhân vật hướng nhìn xuống | `/?qa=1&scene=actors&look=down` | `baseline/desktop/actors-down.png` | `baseline/mobile/actors-down.png` |
| 16 | `actors-up` | — | Nhân vật hướng nhìn lên | `/?qa=1&scene=actors&look=up` | `baseline/desktop/actors-up.png` | `baseline/mobile/actors-up.png` |
| 17 | `actors-left` | — | Nhân vật hướng nhìn trái | `/?qa=1&scene=actors&look=left` | `baseline/desktop/actors-left.png` | `baseline/mobile/actors-left.png` |
| 18 | `actors-right` | — | Nhân vật hướng nhìn phải | `/?qa=1&scene=actors&look=right` | `baseline/desktop/actors-right.png` | `baseline/mobile/actors-right.png` |
| 19 | `roads-village` | `roads` | Đường sá làng & công trình | `/?qa=1&scene=roads&map=village` | `baseline/desktop/roads-village.png` | `baseline/mobile/roads-village.png` |
| 20 | `roads-coast` | — | Đường sá bờ biển | `/?qa=1&scene=roads&map=coast` | `baseline/desktop/roads-coast.png` | `baseline/mobile/roads-coast.png` |
| 21 | `caves-forest` | `caves` | Hang Rêu Sao (Nội thất) | `/?qa=1&scene=caves&room=cave-forest` | `baseline/desktop/caves-forest.png` | `baseline/mobile/caves-forest.png` |
| 22 | `caves-coast` | — | Hang Thủy Triều (Nội thất) | `/?qa=1&scene=caves&room=cave-coast` | `baseline/desktop/caves-coast.png` | `baseline/mobile/caves-coast.png` |
| 23 | `caves-ruins` | — | Hang Tinh Vân (Nội thất) | `/?qa=1&scene=caves&room=cave-ruins` | `baseline/desktop/caves-ruins.png` | `baseline/mobile/caves-ruins.png` |
| 24 | `homes` | — | Nội thất nhà Mira | `/?qa=1&scene=homes&room=home-mira` | `baseline/desktop/homes.png` | `baseline/mobile/homes.png` |
| 25 | `boss` | — | Khu vực Boss Hộ Vệ Rễ Sao | `/?qa=1&scene=boss` | `baseline/desktop/boss.png` | `baseline/mobile/boss.png` |
| 26 | `finale` | — | Cảnh Đêm Hội Sao | `/?qa=1&scene=finale` | `baseline/desktop/finale.png` | `baseline/mobile/finale.png` |

*Note: For convenience and backwards compatibility, top-level aliases (`baseline/day.png`, `baseline/night.png`, `baseline/roads.png`, `baseline/actors.png`, `baseline/caves.png`) are also written directly into `test-artifacts/baseline/`.*

---

## 4. Reduced-Motion Verification

- **Scene:** `/?qa=1&scene=roads&map=village&weather=rain-night&motion=reduced`
- **Method:** Two full-frame screenshots taken 1000 ms apart while stationary.
- **Artifacts:**
  - `test-artifacts/baseline/reduced-motion-1.png` (352.1 KB)
  - `test-artifacts/baseline/reduced-motion-2.png` (350.7 KB)
  - Copies co-located in `test-artifacts/baseline/desktop/`

---

## 5. Performance Benchmark Baseline

Measured in-browser via `requestAnimationFrame` on the heaviest scene (`/?qa=1&scene=roads&map=village&weather=rain-night`):

- **Target Threshold:** Median frame time $\le 16.7$ ms (60.0 FPS)
- **Measured Median:** **16.7 ms**
- **95th Percentile:** **33.4 ms**
- **Average Frame Time:** **18.944 ms**
- **Min / Max:** **16.5 ms / 33.4 ms**
- **Sample Count:** 139 consecutive animation frames
- **Data File:** `test-artifacts/baseline/perf-baseline.json`

---

## 6. Ponytail Principle & Risk Disclosure

1. **Untested Boundaries:** Automated testing was executed on Windows using Chromium Headless via Chrome DevTools Protocol. While viewport metrics (844×390 landscape with touch emulation) faithfully exercise CSS responsive breakpoints and mobile canvas rendering, actual hardware touch latency and iOS Safari WebKit rendering quirks were not tested on physical iPhone hardware in this step.
2. **Rate Limiting Configuration:** `server/policy.cjs` was enhanced to support `MAX_HTTP_PER_MINUTE` environment variable (default 240, set to 10000 for local test automation) to prevent HTTP 429 errors when rapidly requesting assets across 26 back-to-back scene navigations. Existing security tests and rate-limiting behavior remain completely intact.
3. **Save Isolation:** All testing strictly uses local QA search parameters (`?qa=1`) and dedicated memory states. The actual player save slot (`starfall-valley-save-v1`) was never read, modified, or cleared.
