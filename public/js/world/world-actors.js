/* Original handheld-style chibi actors with a cyclic, distance-driven pixel gait. */
(function (root) {
  'use strict';
  const DIRECTIONS = Object.freeze(['down', 'up', 'left', 'right']);
  const artMetrics = Object.freeze({ pixelSize: 2, logicalPixel: 2, bodyWidth: 48, bodyHeight: 60, nameOffset: 66, headHeight: 32, baseHeight: 54, gaitFrames: 8, walkFrameDistance: 10.5, runFrameDistance: 12, walkCycleDistance: 84, runCycleDistance: 96 });
  const PROFILES = Object.freeze({
    player: { hair: 'short', gear: 'traveller' }, mira: { hair: 'bob', gear: 'cartographer' },
    huy: { hair: 'short', gear: 'carpenter' }, linh: { hair: 'bun', gear: 'tea' },
    thao: { hair: 'braid', gear: 'gardener' }, bao: { hair: 'swept', gear: 'merchant' },
    nam: { hair: 'short', gear: 'lamplighter' }, yen: { hair: 'long', gear: 'scholar' },
    son: { hair: 'short', gear: 'cook' }, sen: { hair: 'short', gear: 'ranger' },
    kiet: { hair: 'swept', gear: 'sailor' }, ly: { hair: 'bob', gear: 'explorer' }
  });
  Object.values(PROFILES).forEach(Object.freeze);
  const VILLAGER = Object.freeze({ hair: 'short', gear: 'villager' });
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  const wrap = (value, size) => ((value % size) + size) % size;
  const clamp = (value, fallback) => Math.max(0, Math.min(1, finite(value, fallback)));
  function tint(hex, amount) {
    const n = parseInt(hex.slice(1), 16), target = amount > 0 ? 255 : 0, blend = Math.abs(amount);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (target - v) * blend).toString(16).padStart(2, '0')).join('');
  }
  function profileFor(id = 'player', isPlayer = false) {
    const key = isPlayer ? 'player' : typeof id === 'string' ? id : '';
    return Object.prototype.hasOwnProperty.call(PROFILES, key) ? PROFILES[key] : VILLAGER;
  }
  function frameFor(input = {}) {
    const options = input && typeof input === 'object' ? input : {};
    const direction = DIRECTIONS.includes(options.direction) ? options.direction : 'down';
    const moving = options.moving === true, running = moving && options.running === true, reducedMotion = options.reducedMotion === true;
    const time = wrap(finite(options.time), 3600), distance = Math.abs(finite(options.distance));
    const motionWeight = reducedMotion ? 0 : clamp(options.motionWeight, moving ? 1 : 0);
    const runWeight = reducedMotion ? 0 : clamp(options.runWeight, running ? 1 : 0);
    const cycle = artMetrics.walkCycleDistance + (artMetrics.runCycleDistance - artMetrics.walkCycleDistance) * runWeight;
    const phase = Number.isFinite(options.phase) ? wrap(options.phase, 1) : wrap(distance, cycle) / cycle;
    // Eight recognizable passing/contact poses are sampled continuously between
    // their keys. A foot stays on the ground throughout its stance half-cycle;
    // its other half bends the knee and rolls the toe into the next contact.
    const angle = phase * Math.PI * 2, wave = Math.sin(angle), swing = Math.cos(angle);
    const foot = (sign) => {
      const airborne = Math.max(0, swing * sign);
      return { offset: wave * sign * (4 + 2 * runWeight) * motionWeight, lift: airborne * airborne * (2 + runWeight) * motionWeight, bend: airborne * (1.5 + runWeight) * motionWeight };
    };
    const nearFoot = foot(1), farFoot = foot(-1), active = motionWeight > 0;
    const index = active ? Math.floor(phase * artMetrics.gaitFrames) : 0;
    const bob = reducedMotion ? 0 : active ? (-Math.round(swing * swing * motionWeight) || 0) : (Math.sin(time * 2.3) > .7 ? -1 : 0);
    const blink = !active && !moving && !reducedMotion && wrap(time + (typeof options.id === 'string' ? options.id.length * .23 : 0), 4.8) > 4.64;
    return { direction, moving, running, phase, motionWeight, runWeight, index, step: nearFoot.offset, nearFoot, farFoot, bob, bodySway: wave * motionWeight, armSwing: -wave * (2 + 2 * runWeight) * motionWeight, gearLag: Math.sin(angle - Math.PI / 4) * motionWeight, blink, lift: Math.max(nearFoot.lift, farFoot.lift), lean: 2 * runWeight * motionWeight, reducedMotion };
  }
  // Original Stardrop silhouettes. Each cell is 2 world pixels. An uneven crown,
  // stepped cheeks and a diagonal fringe give the face a soft, compact outline.
  const FRONT_HAIR = Object.freeze([
    '       OOOO         ',
    '     OOhhhHOOO      ',
    '   OOhhHHHHHhHOO    ',
    '  OhhHHHHHHHHHhHO   ',
    ' OHhHHHHHHHHHHHhHO  ',
    ' OHHHHHsHHHHHHHhHOO ',
    ' OhHHHsHHsHHHHHHhHO ',
    ' OHHHsHHHOOHHHHHsHO ',
    '  OHhHHO  OHHsHO    ',
    '  OHsO      OHsO    ',
    '  OO        OO      '
  ]);
  const FRONT_BOB = Object.freeze([
    '       OOOO         ',
    '    OOOhhhHOOO      ',
    '   OOhhHHHHhHhHO    ',
    '  OhhHHHHHHHHHhHO   ',
    ' OHhHHHHHHHHHHHhHO  ',
    ' OHHHHHsHHHHHHHhHO  ',
    ' OHHHHsHHsHHHHHhHO  ',
    ' OHHHHHHHOOHHHHhHO  ',
    ' OHHHhHHO  OHHHhO   ',
    ' OHHhO      OHhO    ',
    ' OHHhO       OhO    ',
    '  OHsO        OO    ',
    '  OO                '
  ]);
  const BACK_HAIR = Object.freeze([
    '       OOOO         ',
    '     OOhhhHOOO      ',
    '   OOhhHHHHHhHOO    ',
    '  OhhHHHHHHHHHhHO   ',
    ' OHhHHHHHHHHHHHhHO  ',
    ' OHHHHHsHHHHHHHhHOO ',
    ' OhHHHsHHsHHHHHHhHO ',
    ' OHHHsHHHHsHHHHHsHO ',
    ' OHHHsHHHHHsHHHHsHO ',
    '  OHHsHHHHHsHHHsHO  ',
    '  OHHsHHHHHsHHssHO  ',
    '   OHHshHHHhHssHO   ',
    '    OHHshssHssHO    ',
    '     OOhssOOO       ',
    '       OOOO         '
  ]);
  const SIDE_HAIR = Object.freeze([
    '      OOOO         ',
    '    OOhhhHOOO      ',
    '  OOhhHHHHHhHOO    ',
    ' OhhHHHHHHHHHhHO   ',
    'OHhHHHHHHHHHHHhHO  ',
    'OHHHHHsHHHHHHHhHOO ',
    'OhHHHsHHsHHHHHhHO  ',
    'OHHHsHHHHHOOHHhHO  ',
    'OHHHsHHHHO  OHsO   ',
    ' OHhHHHHO    OO    ',
    '  OHhHHO           ',
    '   OOOO            '
  ]);
  function draw(ctx, input = {}) {
    if (!ctx || ['save', 'restore', 'translate', 'scale', 'fillRect'].some(method => typeof ctx[method] !== 'function')) return null;
    const options = input && typeof input === 'object' ? input : {}, frame = frameFor(options);
    const x = Math.round(finite(options.x)), y = Math.round(finite(options.y)), isPlayer = options.isPlayer === true || options.id === 'player';
    const profile = profileFor(options.id || (isPlayer ? 'player' : ''), isPlayer);
    const shirt = color(options.shirt, '#579b9c'), hair = color(options.hair, '#564247');
    const p = { outline: '#293b43', shirt, clothLight: tint(shirt, .26), clothShade: tint(shirt, -.26), hair, hairLight: tint(hair, .26), hairShade: tint(hair, -.22), hairOutline: tint(hair, -.48), skin: '#efc5a2', skinLight: '#f9d8b5', skinShade: '#c88f78', boot: '#66554b', bootLight: '#95816a', bootCuff: '#a8947d', bootSole: '#3a2c20', trouser: '#536778', trouserShade: '#3f5266', leather: '#9f734d', leatherLight: '#c19a68', cream: '#fff0ca', gold: '#e9bb61' };
    const r = (rx, ry, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(rx * 2), Math.round(ry * 2), Math.round(w * 2), Math.round(h * 2)); };
    const box = (rx, ry, w, h, c, edge = p.outline) => { r(rx, ry, w, h, edge); if (w > 2 && h > 2) r(rx + 1, ry + 1, w - 2, h - 2, c); };
    const bitmap = (rows, bx, by, colors) => rows.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (colors[row[rx]]) r(bx + rx, by + ry, 1, 1, colors[row[rx]]); });
    const side = frame.direction === 'left' || frame.direction === 'right', back = frame.direction === 'up';
    const gait = frame.motionWeight > 0, gear = profile.gear;
    ctx.save();
    try {
      ctx.translate(x, y);
      r(-6, 0, 12, 2, '#213c4038'); r(-8, .5, 16, 1, '#213c4024');
      if (options.hidden === true) return frame;
      if (frame.direction === 'left') ctx.scale(-1, 1);
      drawFeet();
      ctx.save();
      try {
        // Translations land on world pixels: the head and torso move together,
        // while the stance boot remains anchored instead of sliding with them.
        ctx.translate(Math.round(side ? frame.lean : frame.bodySway), frame.bob);
        drawBody();
        if (options.lantern === true) drawLantern();
        drawHead();
      } finally { ctx.restore(); }
      return frame;
    } finally { ctx.restore(); }

    function drawFeet() {
      const leg = (base, foot, far) => {
        const offset = foot.offset / 2, lift = foot.lift / 2, bend = foot.bend / 2;
        const depth = side ? 0 : -foot.lift * .12;
        const ankleX = base + (side ? offset : offset * .08), ankleY = -1 - lift + Math.min(0, depth);
        const kneeX = base + (side ? offset * .38 + bend * .35 : offset * .06), kneeY = -3 - bend * .3;
        const trouser = far ? p.trouserShade : p.trouser;
        // Stepped thigh and shin meet at a knee, rather than translating a
        // straight rectangle. One-world-pixel scan rows keep diagonal joints crisp.
        limb(base + 1.5, -5 + frame.bob / 2, kneeX + 1.5, kneeY, 2.5, p.outline);
        limb(base + 1.5, -4.5 + frame.bob / 2, kneeX + 1.5, kneeY, 1.5, trouser);
        limb(kneeX + 1.5, kneeY, ankleX + 1.5, ankleY, 2.5, p.outline);
        limb(kneeX + 1.5, kneeY, ankleX + 1.5, ankleY, 1.5, trouser);
        r(ankleX - 1, ankleY, 5, 2, p.outline);
        // A raised foot shows its toe/sole; a planted foot keeps a flat boot.
        r(ankleX, ankleY, 3, 1, far ? p.boot : p.bootLight);
        r(ankleX + (side ? 2 : 0), ankleY + .5, side ? 2 : 3, .5, p.boot);
        // Articulated turn-down cuff fold (upper collar of boot)
        r(ankleX, ankleY, side ? 2.5 : 3, .5, far ? p.bootLight : p.bootCuff);
        // Rugged dark sole layer resting above grounded outline
        r(ankleX, ankleY + 1, 3, .5, p.bootSole);
        r(kneeX + .5, kneeY - .5, 1.5, .5, far ? p.trouserShade : p.trouser);
      };
      leg(side ? -3 : -4, frame.farFoot, back ? false : true);
      leg(side ? 0 : 1, frame.nearFoot, back ? true : false);
    }
    function limb(x1, y1, x2, y2, width, c) {
      const first = Math.round(Math.min(y1, y2) * 2), last = Math.round(Math.max(y1, y2) * 2);
      for (let py = first; py <= last; py++) {
        const progress = y2 === y1 ? 0 : Math.max(0, Math.min(1, (py / 2 - y1) / (y2 - y1)));
        r(x1 + (x2 - x1) * progress - width / 2, py / 2, width, .5, c);
      }
    }
    function drawBody() {
      const swing = frame.armSwing / 2, tuck = frame.runWeight * frame.motionWeight;
      if (side) {
        // Far arm, compact tunic, near arm; the large head covers the shoulders.
        arm(-3.5, true);
        r(-5, -13, 10, 8, p.outline); r(-4, -12, 8, 7, p.shirt); r(2, -11, 2, 5, p.clothLight); r(-4, -10, 2, 5, p.clothShade);
        r(-4, -6, 9, 2, p.outline); r(-3, -6, 7, 1, p.leather); r(3, -6, 1, 1, p.gold);
        drawSideGear();
        arm(2.5, false);
        if (gear === 'carpenter') { r(4 + swing, -6, 1, 4, '#ad8356'); r(3 + swing, -7, 3, 2, '#829193'); }
      } else {
        arm(-6, true); arm(6.5, false);
        r(-5, -13, 11, 8, p.outline); r(-4, -12, 9, 7, p.shirt);
        r(-4, -11, 2, 5, p.clothLight); r(3, -11, 2, 5, p.clothShade);
        r(-4, -6, 9, 2, p.outline); r(-3, -6, 7, 1, p.leather); r(0, -6, 2, 1, p.gold);
        // Trouser-fabric belt loops anchored over leather belt
        r(-2, -6, 1, 1, p.trouser); r(2, -6, 1, 1, p.trouser);
        if (back) drawBackGear(); else drawFrontGear();
      }
      function arm(shoulder, far) {
        const handX = shoulder + (side ? swing * (far ? -1 : 1) : Math.abs(swing) * (far ? -.12 : .12));
        const handY = -6 + (side ? tuck * (far ? 1 : -1) : swing * (far ? -1 : 1) + tuck);
        const elbowX = shoulder + (handX - shoulder) * .55;
        const elbowY = -8 + (handY + 6) * .35 - tuck * .3;
        limb(shoulder, -11, elbowX, elbowY, 3, p.outline);
        limb(shoulder, -10.5, elbowX, elbowY, 2, far ? p.clothShade : p.shirt);
        limb(elbowX, elbowY, handX, handY, 2.5, p.outline);
        limb(elbowX, elbowY, handX, handY, 1.5, far ? p.clothShade : p.clothLight);
        r(handX - 1, handY, 2, 2, far ? p.skinShade : p.skin);
      }
    }
    function drawHead() {
      if (side) {
        r(-5, -25, 11, 1, p.outline); r(-7, -24, 15, 10, p.outline); r(-5, -14, 12, 2, p.outline); r(-3, -12, 8, 1, p.outline);
        r(-4, -24, 10, 1, p.skin); r(-6, -23, 13, 9, p.skin); r(-4, -14, 10, 1, p.skinShade); r(-2, -13, 7, 1, p.skinShade);
        r(2, -21, 5, 7, p.skinLight); r(8, -18, 1, 1, p.outline); r(8, -17, 1, 1, p.skinLight);
        drawHair(SIDE_HAIR, -9, -27);
        r(-1, -17, 2, 3, p.skinShade); r(0, -17, 1, 2, p.skin);
        eye(5, -17); r(6, -13, 2, 1, '#b77b71');
      } else if (back) {
        drawHair(BACK_HAIR, -10, -27);
        r(-3, -13, 6, 1, p.hairShade);
      } else {
        r(-5, -25, 10, 1, p.outline); r(-7, -24, 14, 2, p.outline); r(-8, -22, 16, 8, p.outline); r(-7, -14, 14, 2, p.outline); r(-5, -12, 10, 1, p.outline);
        r(-5, -24, 10, 1, p.skin); r(-6, -23, 12, 2, p.skin); r(-7, -21, 14, 7, p.skin); r(-6, -14, 12, 1, p.skinShade); r(-4, -13, 8, 1, p.skinShade);
        r(-6, -21, 10, 7, p.skinLight); r(5, -20, 2, 6, p.skinShade);
        r(-9, -18, 2, 3, p.outline); r(-8, -18, 1, 2, p.skinShade); r(7, -18, 2, 3, p.outline); r(7, -18, 1, 2, p.skin);
        drawHair(profile.hair === 'bob' || profile.hair === 'long' ? FRONT_BOB : FRONT_HAIR, -10, -27);
        eye(-4, -17); eye(3, -17); r(0, -15, 1, 1, p.skinShade); r(-1, -13, 3, 1, '#b77b71');
        r(-6, -14, 2, 1, '#e7ac95'); r(5, -14, 2, 1, '#d89a83');
      }
      drawHairExtras(); drawHeadgear();
    }
    function eye(ex, ey) {
      if (frame.blink) { r(ex, ey + 1, 2, .5, p.outline); return; }
      r(ex, ey, 2, 2, p.cream);
      r(ex + 1, ey, 1, 2, p.outline); r(ex, ey + 1, 1, 1, p.outline);
      // Genuine anime pupil catchlight: bright glint on the pupil
      r(ex + 1, ey, .5, .5, '#ffffff');
    }
    function drawHair(rows, hx, hy) {
      bitmap(rows, hx, hy, { O: p.hairOutline, H: p.hair, h: p.hairLight, s: p.hairShade });
      if (profile.hair === 'swept') { r(side ? 1 : 3, -22, 4, 1, p.hairShade); r(side ? 4 : 5, -21, 2, 2, p.hair); }
      if (back) { r(4, -20, 2, 5, p.hairShade); r(-4, -16, 2, 2, p.hairShade); }
    }
    function drawHairExtras() {
      if (profile.hair === 'bun') {
        r(side ? -8 : 1, -28, 4, 1, p.hairOutline); r(side ? -9 : 0, -27, 6, 3, p.hairOutline);
        r(side ? -8 : 1, -27, 4, 2, p.hair); r(side ? -8 : 1, -27, 2, 1, p.hairLight);
        r(side ? -7 : 1, -24, 4, 1, '#b9d8c8');
      }
      if (profile.hair === 'long' || profile.hair === 'braid') {
        const tx = side ? -8 : 6;
        r(tx, -17, 3, 6, p.hairOutline); r(tx + 1, -17, 1, 5, p.hair); r(tx + 1, -15, 1, 1, p.hairLight); r(tx + 1, -12, 1, 1, p.gold);
        if (back && profile.hair === 'long') { r(-5, -14, 11, 3, p.hairOutline); r(-4, -14, 9, 2, p.hairShade); r(-2, -14, 2, 2, p.hair); }
      }
      if (profile.hair === 'bob' && side) { r(-6, -17, 3, 4, p.hairOutline); r(-5, -17, 1, 3, p.hairShade); }
    }
    function drawHeadgear() {
      if (gear === 'gardener') {
        r(-6, -27, 12, 1, p.outline); r(-8, -26, 16, 3, p.outline); r(-7, -26, 14, 3, '#d9b875'); r(-5, -26, 7, 1, '#f1d496');
        r(-11, -23, 22, 2, p.outline); r(-10, -23, 20, 1, '#f1d496'); r(-7, -24, 14, 1, '#638b55');
        if (!back) { r(side ? 6 : -8, -24, 2, 2, '#ffffff'); r(side ? 6.5 : -7.5, -23.5, 1, 1, '#ffd166'); }
        if (back) r(-1, -23, 2, 4, '#638b55');
      }
      if (gear === 'cook') {
        r(-5, -28.5, 4, 1, p.outline); r(1, -28.5, 4, 1, p.outline); r(-7, -27.5, 14, 3, p.outline); r(-6, -27.5, 12, 2, '#fff8e9');
        r(-8, -25.5, 16, 3, p.outline); r(-7, -25.5, 14, 2, '#fcf2d9'); r(-7, -23.5, 14, 1, '#ede4d1');
      }
      if (gear === 'sailor') {
        r(-7, -27, 14, 1, p.outline); r(-8, -26, 16, 3, p.outline); r(-7, -26, 14, 2, '#f3eed7');
        r(-7, -24, 15, 1.5, '#2c4159');
        if (!back) r(side ? 6 : -1, -24.5, 2, 1, '#dca542');
      }
      if (gear === 'lamplighter') {
        r(-7, -23, 14, 1, '#a4874b');
        if (!back) { lens(side ? 3 : -5, -24, '#83d4cb'); if (!side) lens(1, -24, '#83d4cb'); }
        if (back) r(-7, -23, 14, 1, '#5a4635');
      }
      if (gear === 'scholar') {
        if (!back) {
          lens(side ? 4 : -5, -18, '#dcebf0', true);
          if (!side) { lens(2, -18, '#dcebf0', true); r(-1, -17, 3, .5, p.outline); }
          r(side ? -3 : 6, -23, 1, 5, '#ffffff'); r(side ? -3 : 6, -18, 1, 1, '#d4af37');
        }
      }
      if (gear === 'ranger') {
        r(-6, -27, 12, 2, '#38593e'); r(-8, -25, 3, 8, '#28402c'); r(6, -24, 2, 6, '#28402c');
        r(side ? -5 : 5, -28, 1, 3, '#a4d468'); r(side ? -5 : 5, -26, 1, 1, '#2c2c2c');
      }
      if (gear === 'cartographer') {
        if (!back) {
          r(side ? 4 : 5, -24, 3, 2, '#e8c868');
          r(side ? 5 : 6, -25, 1, 4, '#d4af37');
          r(side ? 5 : 6, -23, 1, 1, '#fff3e0');
        } else {
          r(3, -24, 2, 2, '#a68334');
        }
      }
      if (gear === 'carpenter') {
        r(-7, -24, 14, 1.5, '#354a5f'); r(-6, -23.5, 12, .5, '#223342');
        if (side) { r(-2, -22, 1, 4, '#d94343'); r(-2, -18, 1, 1, '#2c2c2c'); }
        else if (!back) { r(7, -22, 1.5, 3, '#d94343'); r(7, -19, 1.5, 1, '#2c2c2c'); }
        else { r(-1, -24, 2, 2, '#223342'); r(0, -22, 1, 2, '#354a5f'); }
      }
      if (gear === 'tea') {
        r(side ? -8 : -1, -27.5, 5, 1, '#34785b');
        r(side ? -9 : -2, -28, 2, 2, '#5db38c');
        r(side ? -3 : 4, -27, 1, 1, '#fff0ca');
      }
      if (gear === 'merchant') {
        r(side ? -7 : -6, -27.5, 13, 2, '#4d3761');
        r(side ? -8 : -7, -26, 15, 2.5, '#654a7d');
        r(side ? -7 : -6, -24, 13, 1, '#3b2a4c');
        if (!back) { r(side ? 4 : 5, -25.5, 2, 2, '#f0c742'); r(side ? 4.5 : 5.5, -25, 1, 1, '#ffd700'); }
      }
      if (gear === 'explorer') {
        r(-7, -24, 14, 1.5, '#6b492b');
        if (!back) { lens(side ? 3 : -5, -24.5, '#7ec7d6'); if (!side) lens(1, -24.5, '#7ec7d6'); }
        if (back) r(-7, -24, 14, 1.5, '#4a321d');
      }
    }
    function lens(lx, ly, c, showEye = false) { box(lx, ly, 4, 3, c, gear === 'lamplighter' ? '#a4874b' : gear === 'explorer' ? '#6b492b' : p.outline); if (showEye && !frame.blink) r(lx + 2, ly + 1, .5, 1, p.outline); }
    function apron(c) { r(-3, -11, 7, 5, c); r(-2, -9, 5, 2, tint(c, -.14)); r(-2, -11, 5, 1, tint(c, .12)); }
    function drawFrontGear() {
      if (gear === 'traveller') {
        const lag = Math.round(frame.gearLag) / 2;
        r(-5, -12, 10, 2, p.cream);
        r(-4, -11, 8, 1, '#ede2be');
        r(3, -10 + lag, 2, 5, p.gold);
        r(4, -6 + lag, 1, 1, p.cream);
        r(-4, -10, 1, 5, p.leather);
        r(-3, -10, 1, 1, p.gold);
        box(-6, -8, 4, 4, p.leatherLight);
        r(-5, -7, 2, 1, '#e4c492');
      }
      if (gear === 'carpenter') {
        apron('#6e4a2c');
        r(-3, -13, 1, 5, '#8a603c'); r(3, -13, 1, 5, '#8a603c');
        r(-1, -8, 1, 3, '#eddcb4'); r(0, -8, 1, 3, '#2c2c2c');
        r(8, -7, 1, 4, '#ad8356'); r(7, -8, 3, 2, '#829193');
      }
      if (gear === 'tea') {
        apron('#f7f3e8');
        r(-3, -13, 1, 4, '#f7f3e8'); r(3, -13, 1, 4, '#f7f3e8');
        r(-4, -12, 8, 1, '#5db38c');
        r(0, -10, 2, 2, '#48a07c');
        box(-6, -8, 3, 3, '#5db38c');
      }
      if (gear === 'cook') {
        apron('#f7f2e4');
        r(-3, -13, 1, 4, '#f7f2e4'); r(3, -13, 1, 4, '#f7f2e4');
        r(-3, -12, 6, 2, '#c0392b'); r(-1, -10, 2, 2, '#c0392b');
        r(-2, -11, 1, 1, '#6c7a80'); r(-2, -9, 1, 1, '#6c7a80');
        r(2, -11, 1, 1, '#6c7a80'); r(2, -9, 1, 1, '#6c7a80');
        r(7, -8, 1, 4, '#b58455'); r(6.5, -9, 2, 2, '#b58455');
      }
      if (gear === 'merchant') {
        r(-4, -12, 2, 6, '#3b2a4c'); r(3, -12, 2, 6, '#3b2a4c');
        r(-1, -12, 2, 3, '#942e3b');
        r(-2, -11, 1, 1, '#f5d050'); r(-2, -9, 1, 1, '#f5d050');
        r(2, -11, 1, 1, '#f5d050'); r(2, -9, 1, 1, '#f5d050');
        box(5, -7, 4, 4, '#875b36'); r(6, -6, 2, 1, '#f0c742');
        box(-7, -7, 3, 4, '#875b36');
      }
      if (gear === 'gardener') {
        apron('#739863');
        box(-4, -9, 8, 4, '#557a54');
        r(2, -10, 1, 2, '#9cb1b5');
        r(-2, -9, 2, 2, '#f5e5b8');
      }
      if (gear === 'cartographer') {
        for (let i = 0; i < 4; i++) r(-4 + i * 2, -12 + i, 2, 2, '#63412a');
        r(-4, -13, 8, 1, '#fff3e0');
        box(5, -9, 4, 5, p.leatherLight); r(6, -8, 2, 1, p.cream);
        box(-8, -9, 3, 5, p.cream); r(-7, -8, 1, 2, '#b9a886');
      }
      if (gear === 'scholar') {
        for (let i = 0; i < 4; i++) r(-4 + i * 2, -12 + i, 2, 2, p.leather);
        r(2, -12, 1, 3, '#ffffff'); r(2, -9, 1, 1, '#d4af37');
        box(5, -9, 4, 6, '#5e3948'); r(6, -8, 2, 1, '#d9b45b'); r(5, -4, 2, 1, '#5bc8ed');
      }
      if (gear === 'explorer') {
        for (let i = 0; i < 4; i++) r(-4 + i * 2, -12 + i, 2, 2, p.leather);
        r(-5, -13, 10, 2, '#e5d7ba'); r(-3, -11, 6, 1, '#d5c4a1');
        r(-1, -10, 2, 2, '#5bc8ed'); r(-.5, -9.5, 1, 1, '#ffffff');
        box(-7, -8, 4, 5, p.leatherLight);
        r(4, -8, 1, 4, '#c49a50'); r(3, -9, 3, 2, '#7a898f');
      }
      if (gear === 'lamplighter') {
        r(-4, -7, 9, 1, p.leather);
        box(-7, -8, 4, 5, '#7a898f'); r(-6, -7, 2, 1, '#a4874b');
        r(4, -10, 1, 5, '#d4af37'); r(3, -10, 3, 1, '#a4874b');
      }
      if (gear === 'ranger') {
        r(-6, -13, 12, 2, '#38593e');
        r(-3, -11, 6, 5, '#5c4028'); r(-1, -9, 2, 2, '#d4af37');
        r(5, -7, 2, 2, '#48321e');
      }
      if (gear === 'sailor') {
        r(-4, -12, 8, 1, '#f1edd5'); r(-4, -11, 8, 1, '#284a63');
        r(-4, -10, 8, 1, '#f1edd5'); r(-4, -9, 8, 1, '#284a63');
        r(-4, -8, 8, 1, '#f1edd5'); r(-4, -7, 8, 1, '#284a63');
        r(-2, -12, 4, 3, '#d78b6f');
        box(5, -7, 4, 4, '#c2aa80'); r(6, -6, 2, 2, '#a58c63');
      }
    }
    function drawBackGear() {
      if (gear === 'traveller') {
        r(-4, -13, 1, 7, p.leather); r(4, -13, 1, 7, p.leather);
        box(-4, -12, 9, 8, p.leather);
        r(-3, -11, 7, 2, p.leatherLight);
        box(-2, -8, 5, 3, '#aa8257');
        r(0, -10, 1, 2, p.gold);
        r(0, -10, 1, 1, '#fff0ca'); // metallic buckle gleam
        r(-5, -13, 10, 2, p.cream);
        r(-3, -13, 1, 2, p.leather); r(3, -13, 1, 2, p.leather); // bedroll retaining straps
        r(4, -11, 2, 4, p.gold);
      }
      if (gear === 'cartographer') {
        r(-4, -13, 1, 7, p.leather); r(4, -13, 1, 7, p.leather);
        box(-4, -12, 9, 8, p.leather);
        box(-7, -12, 3, 7, p.cream); r(-6, -11, 1, 2, '#c6b994');
      }
      if (gear === 'explorer') {
        r(-4, -13, 1, 7, p.leather); r(4, -13, 1, 7, p.leather);
        box(-4, -12, 9, 8, '#63756a');
        r(-3, -11, 7, 2, '#e5d7ba');
        box(-2, -8, 5, 3, p.leather);
        r(0, -10, 1, 2, '#5bc8ed');
        r(-6, -13, 12, 2, '#e5d7ba');
      }
      if (gear === 'carpenter') {
        r(-3, -13, 1, 7, '#8a603c'); r(3, -13, 1, 7, '#8a603c');
        r(-2, -10, 5, 2, '#8a603c');
        r(6, -8, 2, 2, '#829193');
      }
      if (gear === 'tea') {
        r(-3, -13, 1, 7, '#f7f3e8'); r(3, -13, 1, 7, '#f7f3e8');
        r(-3, -8, 6, 3, '#34785b'); r(-4, -7, 8, 2, '#5db38c'); r(-2, -6, 4, 3, '#5db38c');
      }
      if (gear === 'cook') {
        r(-3, -13, 1, 7, '#f7f2e4'); r(3, -13, 1, 7, '#f7f2e4');
        r(-3, -8, 6, 3, '#f7f2e4');
      }
      if (gear === 'gardener') {
        r(-3, -13, 1, 7, '#557a54'); r(3, -13, 1, 7, '#557a54');
        r(-4, -7, 9, 1, '#739863');
      }
      if (gear === 'merchant') {
        r(-4, -12, 9, 6, '#3b2a4c');
        r(-2, -8, 4, 1, '#f0c742');
      }
      if (gear === 'lamplighter') {
        r(-4, -7, 9, 1, p.leather);
        r(-3, -10, 1, 6, '#7a898f');
        r(3, -9, 1, 5, '#d4af37');
      }
      if (gear === 'scholar') {
        r(-4, -13, 1, 6, p.leather);
        box(-6, -9, 5, 6, '#5e3948'); r(-5, -8, 3, 1, '#d9b45b');
      }
      if (gear === 'ranger') {
        r(-6, -13, 12, 8, '#38593e');
        box(3, -14, 4, 8, '#593e27');
        r(4, -18, 1, 5, '#f0ece1'); r(5, -19, 1, 6, '#f0ece1'); r(6, -17, 1, 4, '#f0ece1');
      }
      if (gear === 'sailor') {
        r(-4, -12, 9, 1, '#f1edd5'); r(-4, -11, 9, 1, '#284a63');
        r(-4, -10, 9, 1, '#f1edd5'); r(-4, -9, 9, 1, '#284a63');
        r(-4, -8, 9, 1, '#f1edd5'); r(-4, -7, 9, 1, '#284a63');
      }
    }
    function drawSideGear() {
      if (gear === 'traveller') {
        box(-8, -13, 4, 9, p.leather); r(-7, -12, 2, 2, p.leatherLight); r(-6, -8, 1, 2, p.gold);
        r(-6, -8, 1, 1, '#fff0ca'); // satchel clasp highlight
        r(-4, -13, 9, 2, p.cream);
        r(-2, -13, 1, 2, p.leather); // bedroll strap
        r(-3, -11, 2, 4, p.gold);
      }
      if (gear === 'cartographer') {
        box(-8, -13, 4, 9, p.leather); box(-10, -11, 3, 6, p.cream);
      }
      if (gear === 'explorer') {
        box(-8, -13, 4, 9, '#63756a'); r(-6, -13, 10, 2, '#e5d7ba');
        r(4, -8, 1, 4, '#c49a50'); r(3, -9, 3, 2, '#7a898f');
      }
      if (gear === 'carpenter') {
        r(3, -11, 2, 6, '#6e4a2c'); r(3, -13, 1, 4, '#8a603c');
      }
      if (gear === 'tea') {
        r(3, -11, 2, 6, '#f7f3e8'); r(3, -13, 1, 4, '#f7f3e8');
        box(3, -8, 3, 3, '#5db38c');
      }
      if (gear === 'cook') {
        r(3, -11, 2, 6, '#f7f2e4'); r(3, -13, 1, 4, '#f7f2e4');
        r(4, -8, 1, 4, '#b58455');
      }
      if (gear === 'gardener') {
        r(3, -11, 2, 6, '#739863'); r(3, -13, 1, 4, '#557a54');
        box(-6, -8, 4, 4, '#557a54'); r(-5, -7, 2, 1, '#b8cf92');
      }
      if (gear === 'merchant') {
        r(3, -12, 2, 6, '#3b2a4c'); r(3, -11, 1, 2, '#f5d050');
        box(4, -7, 3, 4, '#875b36');
      }
      if (gear === 'lamplighter') {
        box(-6, -8, 4, 5, '#7a898f'); r(4, -9, 1, 4, '#d4af37');
      }
      if (gear === 'scholar') {
        box(-7, -9, 4, 6, '#5e3948'); r(-6, -8, 2, 1, '#d9b45b');
      }
      if (gear === 'ranger') {
        r(-6, -13, 3, 9, '#38593e'); box(-8, -14, 4, 8, '#593e27');
        r(-7, -18, 1, 5, '#f0ece1'); r(-5, -17, 1, 4, '#f0ece1');
      }
      if (gear === 'sailor') {
        r(2, -12, 3, 1, '#f1edd5'); r(2, -10, 3, 1, '#284a63'); r(2, -8, 3, 1, '#f1edd5');
        box(3, -7, 3, 3, '#c2aa80');
      }
    }
    function drawLantern() {
      // Carried lamp fits the same 48px visual width as the character.
      const lx = side ? 8 : 8.5, ly = -7 + frame.armSwing / 2;
      r(lx + 1, ly - 1, 1, 1, p.outline); box(lx, ly, 3, 5, '#e8b55c'); r(lx + 1, ly + 1, 1, 2, '#fff0ad'); r(lx + 1, ly + 2, .5, 1, '#fff9d8'); r(lx, ly + 4, 3, 1, p.leather);
    }
  }
  const api = Object.freeze({ draw, frameFor, profileFor, directions: DIRECTIONS, artMetrics });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.StardropActors = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
