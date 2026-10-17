(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropTitle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TITLE_BAYER_4X4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  const TITLE_SKY_BANDS = [
    { yEnd: 64,  color: '#df9b8e' }, // Dawn Mauve
    { yEnd: 136, color: '#f4b486' }, // Warm Peach
    { yEnd: 216, color: '#f8cf94' }, // Sunrise Apricot
    { yEnd: 304, color: '#fce2ab' }, // Dawn Amber
    { yEnd: 396, color: '#fff3c8' }  // Horizon Glow Cream
  ];

  const TITLE_FAR_MOUNTAINS = [
    { x: -60,  peakY: 220, w: 280 },
    { x: 160,  peakY: 195, w: 320 },
    { x: 420,  peakY: 230, w: 260 },
    { x: 620,  peakY: 180, w: 340 },
    { x: 900,  peakY: 210, w: 290 },
    { x: 1140, peakY: 175, w: 330 },
    { x: 1380, peakY: 225, w: 280 }
  ];

  const TITLE_NEAR_RIDGES = [
    { x: -40,  peakY: 290, w: 340 },
    { x: 240,  peakY: 275, w: 320 },
    { x: 500,  peakY: 310, w: 280 },
    { x: 740,  peakY: 265, w: 350 },
    { x: 1040, peakY: 280, w: 300 },
    { x: 1280, peakY: 270, w: 320 }
  ];

  const TITLE_CIRRUS_CLOUDS = [
    { initX: 80,   y: 45,  w: 160, h: 10 },
    { initX: 480,  y: 65,  w: 210, h: 12 },
    { initX: 890,  y: 40,  w: 180, h: 9 },
    { initX: 1260, y: 70,  w: 150, h: 11 }
  ];

  const TITLE_CUMULUS_CLOUDS = [
    { initX: 20,   y: 110, w: 140, h: 22 },
    { initX: 260,  y: 150, w: 180, h: 26 },
    { initX: 540,  y: 95,  w: 130, h: 20 },
    { initX: 790,  y: 160, w: 160, h: 24 },
    { initX: 1050, y: 120, w: 150, h: 22 },
    { initX: 1320, y: 140, w: 170, h: 25 }
  ];

  const TITLE_VALLEY_STRATUS = [
    { initX: 120,  y: 285, w: 220, h: 8 },
    { initX: 520,  y: 320, w: 180, h: 7 },
    { initX: 860,  y: 295, w: 240, h: 8 },
    { initX: 1220, y: 315, w: 190, h: 7 }
  ];

  const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.floor(x), Math.floor(y), w, h); };
  const pixelEllipse = (c, x, y, w, h, color) => {
    rect(c, x - w / 2 + 4, y - h / 2, w - 8, h, color);
    rect(c, x - w / 2, y - h / 2 + 3, w, h - 6, color);
  };

  function drawTitle(c, env = {}) {
    const animation = env.animation || 0;
    const reducedMotion = !!env.reducedMotion;
    const house = env.house || (() => {});
    const tree = env.tree || (() => {});
    const lamp = env.lamp || (() => {});
    const actor = env.actor || (() => {});

    // 1. DITHERED SUNRISE SKY
    let prevY = 0;
    for (let b = 0; b < TITLE_SKY_BANDS.length; b++) {
      const band = TITLE_SKY_BANDS[b];
      rect(c, 0, prevY, 1440, band.yEnd - prevY, band.color);

      // Bayer 4x4 dither transition into next band
      if (b < TITLE_SKY_BANDS.length - 1) {
        const nextColor = TITLE_SKY_BANDS[b + 1].color;
        const transY = band.yEnd - 8;
        for (let dy = 0; dy < 16; dy += 4) {
          const t = dy / 16;
          const py = transY + dy;
          const by = Math.floor(py / 4) % 4;
          for (let px = 0; px < 1440; px += 4) {
            const bx = Math.floor(px / 4) % 4;
            if (t > TITLE_BAYER_4X4[by][bx] / 16) {
              rect(c, px, py, 4, 4, nextColor);
            }
          }
        }
      }
      prevY = band.yEnd;
    }

    // 2. SUNRISE SUN & MULTI-TIER DAWN HALO
    pixelEllipse(c, 1120, 140, 140, 140, '#fde3b040');
    pixelEllipse(c, 1120, 140, 104, 104, '#fff0c2');
    pixelEllipse(c, 1120, 140, 72, 72, '#fffbe8');

    // 3. LAYER 1: HIGH CIRRUS CLOUDS (Speed: 1.8 px/s)
    for (let i = 0; i < TITLE_CIRRUS_CLOUDS.length; i++) {
      const cloud = TITLE_CIRRUS_CLOUDS[i];
      const cx = ((cloud.initX + animation * 1.8) % 1640) - 150;
      rect(c, cx, cloud.y, cloud.w, cloud.h, '#fff5de');
      rect(c, cx + 15, cloud.y - 3, cloud.w - 30, 3, '#fffbf2');
      rect(c, cx + 8, cloud.y + cloud.h, cloud.w - 16, 2, '#fbe0ca');
    }

    // 4. LAYER 2: FAR MOUNTAIN SILHOUETTES (Alpine Peaks with Snowcaps)
    for (let i = 0; i < TITLE_FAR_MOUNTAINS.length; i++) {
      const m = TITLE_FAR_MOUNTAINS[i];
      const peakX = m.x + m.w / 2;
      // Main mountain body
      c.fillStyle = '#9bb0ab';
      c.beginPath();
      c.moveTo(m.x, 396);
      c.lineTo(peakX, m.peakY);
      c.lineTo(m.x + m.w, 396);
      c.closePath();
      c.fill();

      // East-facing sunlit slope
      c.fillStyle = '#b4c7c1';
      c.beginPath();
      c.moveTo(peakX, m.peakY);
      c.lineTo(m.x + m.w, 396);
      c.lineTo(peakX + 15, 396);
      c.closePath();
      c.fill();

      // Snowcap
      const snowHeight = 32;
      const snowPeakY = m.peakY;
      const snowBaseY = snowPeakY + snowHeight;
      const snowLeft = peakX - (m.w / 2) * (snowHeight / (396 - m.peakY));
      const snowRight = peakX + (m.w / 2) * (snowHeight / (396 - m.peakY));
      c.fillStyle = '#fffbe8';
      c.beginPath();
      c.moveTo(snowLeft, snowBaseY);
      c.lineTo(peakX, snowPeakY);
      c.lineTo(snowRight, snowBaseY);
      c.closePath();
      c.fill();

      // Snow shadow facet (west slope)
      c.fillStyle = '#dce8e4';
      c.beginPath();
      c.moveTo(snowLeft, snowBaseY);
      c.lineTo(peakX, snowPeakY);
      c.lineTo(peakX - 4, snowBaseY);
      c.closePath();
      c.fill();
    }

    // Atmospheric valley mist at far mountain base
    for (let x = 0; x < 1440; x += 8) {
      if ((x % 16) === 0) rect(c, x, 380, 8, 8, '#fff3c860');
      rect(c, x, 388, 8, 8, '#fff3c890');
    }

    // 5. LAYER 3: MID CUMULUS CLOUDS (Speed: 5.2 px/s)
    for (let i = 0; i < TITLE_CUMULUS_CLOUDS.length; i++) {
      const cloud = TITLE_CUMULUS_CLOUDS[i];
      const cx = ((cloud.initX + animation * 5.2) % 1700) - 200;
      // Main cloud body
      rect(c, cx, cloud.y, cloud.w, cloud.h, '#fff6dc');
      // Sunlit upper puffs
      rect(c, cx + 18, cloud.y - 14, Math.floor(cloud.w * 0.45), 14, '#fffef0');
      rect(c, cx + Math.floor(cloud.w * 0.4), cloud.y - 10, Math.floor(cloud.w * 0.42), 10, '#fffef0');
      // Underbelly lavender-peach shade
      rect(c, cx + 12, cloud.y + cloud.h - 4, cloud.w - 24, 6, '#ebd6c5');
    }

    // 6. LAYER 4: NEAR MOUNTAIN RIDGES (Dual-tone Forest Slopes)
    for (let i = 0; i < TITLE_NEAR_RIDGES.length; i++) {
      const r = TITLE_NEAR_RIDGES[i];
      const peakX = r.x + r.w / 2;
      // Left slope (shaded)
      c.fillStyle = '#6c8976';
      c.beginPath();
      c.moveTo(r.x, 440);
      c.lineTo(peakX, r.peakY);
      c.lineTo(peakX, 440);
      c.closePath();
      c.fill();

      // Right slope (lit by morning sun)
      c.fillStyle = '#8aa88e';
      c.beginPath();
      c.moveTo(peakX, r.peakY);
      c.lineTo(r.x + r.w, 440);
      c.lineTo(peakX, 440);
      c.closePath();
      c.fill();

      // Sharp ridge highlight rim
      rect(c, peakX - 2, r.peakY, 4, 18, '#a8c5ab');
    }

    // 7. LAYER 5: LOW VALLEY STRATUS / DRIFTING MIST (Speed: 3.2 px/s)
    for (let i = 0; i < TITLE_VALLEY_STRATUS.length; i++) {
      const s = TITLE_VALLEY_STRATUS[i];
      const sx = ((s.initX + animation * 3.2) % 1640) - 150;
      rect(c, sx, s.y, s.w, s.h, '#fff1d088');
      rect(c, sx + 20, s.y + 1, s.w - 40, s.h - 2, '#fff1d0bb');
    }

    // 8. MEADOW GROUND & SOIL FOREGROUND
    rect(c, 0, 396, 1440, 504, '#a5bd82');
    // Meadow dithering transition
    for (let y = 396; y < 440; y += 8) {
      for (let x = 0; x < 1440; x += 16) {
        if ((x + y) % 32 === 0) rect(c, x, y, 8, 4, '#b4cc90');
      }
    }
    rect(c, 0, 550, 1440, 350, '#94b47a');
    for (let y = 550; y < 580; y += 6) {
      for (let x = 0; x < 1440; x += 12) {
        if ((x + y) % 24 === 0) rect(c, x, y, 6, 3, '#a2be88');
      }
    }
    for (let y = 415; y < 900; y += 30) {
      for (let x = 0; x < 1440; x += 30) {
        if ((x + y) % 90 === 0) rect(c, x + 7, y + 5, 4, 3, '#c4cd9360');
      }
    }

    // 9. VILLAGE ROADS & PROPS PREVIEW
    rect(c, 720, 595, 630, 68, '#6f925f');
    rect(c, 718, 587, 635, 65, '#decba0');
    rect(c, 967, 410, 70, 490, '#dece9e');

    // 10. MULTI-DEPTH POND, WATER REFLECTIONS & RIPPLE SHIMMER
    // Embankment
    rect(c, 1110, 700, 330, 170, '#e2d4a1');
    rect(c, 1116, 708, 324, 162, '#466963');
    // Shallow water
    rect(c, 1125, 715, 315, 145, '#5c9e97');
    // Deep water
    rect(c, 1140, 730, 300, 120, '#3a706b');
    rect(c, 1160, 755, 280, 85, '#2e5753');

    // Vertical sunrise sun reflection column in water
    rect(c, 1135, 718, 90, 140, '#f6e3ab38');
    rect(c, 1145, 725, 65, 125, '#fce8b150');
    rect(c, 1155, 735, 45, 105, '#fff4cc65');

    // Animated horizontal ripple shimmer lines (Frozen when reducedMotion is true)
    for (let k = 0; k < 9; k++) {
      const ripY = 724 + k * 13;
      const ripW = 24 + ((k * 17) % 35);
      const ripPhase = k * 1.1;
      const ripShift = Math.sin(animation * 1.6 + ripPhase) * 8;
      const ripPulse = Math.sin(animation * 2.2 + ripPhase) * 5;

      // Ripple in golden sun reflection column
      const goldX = 1145 + ((k * 13) % 40) + ripShift;
      rect(c, goldX, ripY, Math.max(12, ripW + ripPulse), 2, '#fffdf0');
      rect(c, goldX + 3, ripY + 2, Math.max(8, ripW - 6), 1, '#fdebb3');

      // Ambient ripples across water basin
      const ambX1 = 1240 + ((k * 29) % 90) + ripShift * 0.7;
      rect(c, ambX1, ripY + 4, Math.max(14, ripW * 0.8), 2, '#8ee0d3');
      const ambX2 = 1350 + ((k * 23) % 65) - ripShift * 0.6;
      rect(c, ambX2, ripY - 2, Math.max(10, ripW * 0.7), 1, '#b8f2e8');
    }

    // 11. VILLAGE PREVIEW BUILDINGS, TREES, ACTORS & PARTICLES
    const preview = [
      { x: 925,  y: 570, w: 146, h: 135, roof: '#bc775d', name: 'Nhà của những điều ước', kind: 'home' },
      { x: 1220, y: 520, w: 142, h: 126, roof: '#718fa3', name: 'Xưởng Gió', kind: 'home' },
      { x: 740,  y: 780, w: 140, h: 124, roof: '#ae91a2', name: 'Quán trà', kind: 'home' }
    ];
    preview.forEach(b => house(c, b));

    [[690, 500], [1070, 490], [1380, 585], [1060, 840], [600, 790], [1320, 680], [1420, 780], [1180, 405], [850, 405]]
      .forEach(([x, y], i) => tree(c, x, y, 1.6, i % 3));

    lamp(c, 875, 653);
    lamp(c, 1070, 675);

    actor(c, 972, 650, '#5f9895', '#55414b', true, true, 'right', animation * 55, false, 'player');
    actor(c, 1130, 630, '#d98870', '#614331', false, false, 'left', 0, false, 'mira');

    for (let i = 0; i < 12; i++) {
      const x = 700 + (i * 57) % 720, y = 420 + (i * 43) % 440;
      rect(c, x, y, 3, 8, '#6e985c');
      rect(c, x - 4, y, 10, 4, ['#f4dc8f', '#eebca5', '#fff1c3'][i % 3]);
    }
    for (let i = 0; i < 8; i++) {
      const x = 800 + i * 83 + Math.sin(animation + i) * 10;
      const y = 310 + i * 25 + Math.cos(animation * 0.7 + i) * 15;
      rect(c, x, y, 3, 3, '#fff2b9');
    }

    // Slow migrating star trails keep the sunrise title alive.
    const sx = 1120 + (animation * 22) % 500, sy = 40 + (animation * 9) % 190;
    rect(c, sx, sy, 5, 5, '#fff4ce');
    rect(c, sx - 12, sy - 6, 10, 2, '#fff4ce80');
  }

  return Object.freeze({
    TITLE_BAYER_4X4,
    TITLE_SKY_BANDS,
    TITLE_FAR_MOUNTAINS,
    TITLE_NEAR_RIDGES,
    TITLE_CIRRUS_CLOUDS,
    TITLE_CUMULUS_CLOUDS,
    TITLE_VALLEY_STRATUS,
    drawTitle
  });
});
