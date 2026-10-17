(function (root, factory) {
  'use strict';
  const data = typeof module === 'object' && module.exports ? require('./combat-data.js') : root.StardropCombatData;
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';
  const STEP = D.fixedStep, EPS = 1e-9;
  const directions = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
  const length = (x, y) => Math.hypot(x, y);
  const alive = actor => actor && Number.isFinite(actor.x) && Number.isFinite(actor.y) && Number.isFinite(actor.health) && actor.health > 0;
  const damageValue = value => Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 1;

  // Runtime chỉ giữ động tác trong phiên; tiến trình và chứng cứ thắng thuộc game-core.
  function createRuntime() {
    return { attack: null, dodge: null, projectiles: [], invulnerable: 0, cooldown: 0, dodgeCooldown: 0, accumulator: 0, staminaDelay: 0, serial: 0, epoch: 0 };
  }
  // Chỉ tiêu thể lực sau khi mọi điều kiện hợp lệ, tránh mất tài nguyên khi spam input.
  function requestAttack(runtime, actor, direction) {
    if (!alive(actor) || !Object.hasOwn(directions, direction) || !Number.isFinite(actor.stamina) || actor.stamina < D.attack.stamina || runtime.attack || runtime.dodge || runtime.cooldown > EPS) return false;
    actor.stamina -= D.attack.stamina;
    runtime.attack = { direction, elapsed: 0, hit: new Set() };
    runtime.cooldown = D.attack.windup + D.attack.active + D.attack.recovery;
    runtime.staminaDelay = D.regen.delay;
    return true;
  }
  // Né khóa hướng lúc bắt đầu; đoạn cuối được cắt đúng .22 giây để không phụ thuộc FPS.
  function requestDodge(runtime, actor, direction) {
    if (!alive(actor) || !Object.hasOwn(directions, direction) || !Number.isFinite(actor.stamina) || actor.stamina < D.dodge.stamina || runtime.attack || runtime.dodge || runtime.dodgeCooldown > EPS) return false;
    actor.stamina -= D.dodge.stamina;
    runtime.dodge = { direction, elapsed: 0 };
    runtime.dodgeCooldown = D.dodge.cooldown;
    runtime.invulnerable = Math.max(runtime.invulnerable, D.dodge.invulnerable);
    runtime.staminaDelay = D.regen.delay;
    return true;
  }
  // Mở UI chỉ hủy input/động tác dở; giữ hồi chiêu và đạn để không tạo lợi thế bằng menu.
  function cancelInputs(runtime) {
    runtime.attack = null; runtime.dodge = null; runtime.accumulator = 0; runtime.epoch++;
  }
  // Đổi vùng, chết hoặc nhập save mới xóa toàn bộ trận; không chạm actor hay chứng cứ.
  function resetActions(runtime) {
    cancelInputs(runtime); runtime.projectiles.length = 0;
    runtime.invulnerable = 0; runtime.cooldown = 0; runtime.dodgeCooldown = 0; runtime.accumulator = 0;
  }
  // Lấy mẫu từng pixel để kiếm, đạn và đòn lao không vượt tường mỏng giữa hai frame.
  function lineClear(ax, ay, bx, by, isBlocked) {
    const steps = Math.ceil(length(bx - ax, by - ay));
    for (let i = 1; i <= steps; i++) if (isBlocked(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps)) return false;
    return true;
  }
  // Dùng cùng hợp đồng va chạm cho người chơi, địch và projectile, dừng tại điểm cuối hợp lệ.
  function moveSegment(object, dx, dy, isBlocked, visit) {
    const steps = Math.ceil(length(dx, dy));
    for (let i = 0; i < steps; i++) {
      const x = object.x + dx / steps, y = object.y + dy / steps;
      if (isBlocked(x, y)) return false;
      object.x = x; object.y = y;
      if (visit && visit() === false) return false;
    }
    return true;
  }
  // Cung tròn xét cả góc, khoảng cách và đường nhìn; đứng trùng tọa độ vẫn trúng hợp lệ.
  function inCone(source, target, vx, vy, range, arc, isBlocked) {
    const dx = target.x - source.x, dy = target.y - source.y, distance = length(dx, dy);
    return distance <= range + EPS && (distance < EPS || (dx * vx + dy * vy) / distance >= Math.cos(arc * Math.PI / 360) - EPS) && lineClear(source.x, source.y, target.x, target.y, isBlocked);
  }
  // Callback có thể hồi sinh/đổi vùng ngay; epoch ngăn xử lý tiếp tập địch cũ trong frame đó.
  function unchanged(runtime, ctx, map, epoch) { return alive(ctx.actor) && ctx.actor.map === map && runtime.epoch === epoch; }
  // Callback mở UI đã tự hủy input; chỉ chết/đổi ngữ cảnh mới cần xóa đạn và hồi chiêu.
  function stopAdvance(runtime, ctx, map, epoch) {
    if (runtime.epoch === epoch || !alive(ctx.actor) || ctx.actor.map !== map) resetActions(runtime);
    else runtime.accumulator = 0;
  }
  function swordStep(runtime, ctx, isBlocked, map, epoch) {
    const attack = runtime.attack;
    if (!attack) return true;
    const previous = attack.elapsed; attack.elapsed += STEP;
    if (attack.elapsed + EPS >= D.attack.windup && previous < D.attack.windup + D.attack.active - EPS) {
      const [vx, vy] = directions[attack.direction];
      for (const mob of ctx.mobs) {
        if (!(mob.hp > 0) || attack.hit.has(mob.id) || !inCone(ctx.actor, mob, vx, vy, D.attack.range, D.attack.arc, isBlocked)) continue;
        attack.hit.add(mob.id);
        // Giáp chỉ mở ở nhịp lộ lõi sau đòn lao; một cú chạm giáp chỉ phát phản hồi một lần.
        if (D.enemies[mob.kind]?.boss === true && (mob.combat?.stage !== 'recovery' || mob.combat?.style !== 'vulnerable')) {
          ctx.onBlocked?.(mob);
          if (!unchanged(runtime, ctx, map, epoch)) return false;
          continue;
        }
        const damage = damageValue(ctx.damage);
        mob.hp = Math.max(0, mob.hp - damage); mob.hitTime = .2;
        const defeated = mob.hp <= 0;
        ctx.onHit?.(mob, damage);
        if (defeated) ctx.onDefeat?.(mob);
        if (!unchanged(runtime, ctx, map, epoch)) return false;
      }
    }
    if (attack.elapsed + EPS >= D.attack.windup + D.attack.active + D.attack.recovery) runtime.attack = null;
    return true;
  }
  // Mỗi đòn đánh trúng một lần; né chỉ báo chứng cứ khi thực sự nằm trong vùng nguy hiểm.
  function hurt(runtime, ctx, source, damage, map, epoch) {
    if (source.hitActor) return true;
    if (runtime.invulnerable > EPS) {
      if (runtime.dodge && runtime.dodge.elapsed <= D.dodge.invulnerable + EPS && !source.evaded) { source.evaded = true; ctx.onDodge?.(); }
      return unchanged(runtime, ctx, map, epoch);
    }
    // Giáp chỉ giảm tối đa ba điểm, luôn còn ít nhất một sát thương để không tạo bất tử.
    const armor=Number.isFinite(ctx.armor)?Math.max(0,Math.min(3,Math.floor(ctx.armor))):0;
    damage=Math.max(1,damage-armor);
    source.hitActor = true; ctx.actor.health = Math.max(0, ctx.actor.health - damage);
    const defeated = ctx.actor.health <= 0;
    runtime.invulnerable = .6;
    ctx.onHurt?.(damage);
    return !defeated && unchanged(runtime, ctx, map, epoch);
  }
  // Giữ điểm ngắm lúc lấy đà; đổi vị trí sau tín hiệu giúp người chơi tránh đòn được.
  function beginTell(mob, c, actor, def, repeat = false) {
    c.stage = 'windup'; c.style = def.boss ? def.pattern[c.cycle % def.pattern.length] : def.style;
    c.timer = D.enemies[mob.kind]?.boss === true && c.style === 'charge' ? .7 : def.windup;
    c.aimX = actor.x; c.aimY = actor.y;
    c.hitActor = false; c.evaded = false; c.emitted = false;
    if (!repeat) c.repeat = D.enemies[mob.kind]?.boss === true && c.phase === 2 ? 1 : 0;
  }
  // Stage và style công khai đủ để renderer vẽ báo trước, không cần biết timer riêng của engine.
  function enemyState(mob, actor, def) {
    let c = mob.combat;
    if (!c || !['idle', 'windup', 'active', 'recovery'].includes(c.stage)) c = mob.combat = { stage: 'idle', timer: 0, aimX: actor.x, aimY: actor.y, style: def.style };
    if (!Number.isFinite(c.timer)) c.timer = 0;
    if (!Number.isFinite(c.cycle)) c.cycle = 0;
    c.phase = D.enemies[mob.kind]?.boss === true && mob.hp < def.maxHp / 2 ? 2 : 1;
    return c;
  }
  // Tiến FSM theo bước cố định; địch không gây sát thương tiếp xúc lúc đang nghỉ/lấy đà.
  function enemyStep(runtime, ctx, mob, isBlocked, map, epoch) {
    const def = D.enemies[mob.kind] || D.enemies.slime, actor = ctx.actor, c = enemyState(mob, actor, def);
    mob.hitTime = Math.max(0, (mob.hitTime || 0) - STEP);
    if (c.stage === 'idle') {
      const dx = actor.x - mob.x, dy = actor.y - mob.y, dist = length(dx, dy), range = D.enemies[mob.kind]?.boss === true ? 180 : def.range;
      if (dist <= range) beginTell(mob, c, actor, def);
      else if (dist < def.detectRange) moveSegment(mob, dx / dist * def.speed * STEP, dy / dist * def.speed * STEP, isBlocked);
      return true;
    }
    c.timer = Math.max(0, c.timer - STEP);
    if (c.stage === 'windup') {
      if (c.timer <= EPS) {
        c.stage = 'active'; c.timer = D.enemies[mob.kind]?.boss === true && c.style === 'charge' ? .4 : def.active;
        const dx = c.aimX - mob.x, dy = c.aimY - mob.y, dist = length(dx, dy);
        c.vx = dist > EPS ? dx / dist : 1; c.vy = dist > EPS ? dy / dist : 0;
      }
      return true;
    }
    if (c.stage === 'recovery') {
      if (c.timer <= EPS) c.stage = 'idle';
      return true;
    }
    let safe = true;
    if (c.style === 'projectile') {
      if (!c.emitted && runtime.projectiles.length < 48) {
        // Chùm đạn chia góc quanh hướng đã khóa; giữ trần48 kể cả khi địch bắn cùng lúc.
        const count=def.projectileCount||1,heading=Math.atan2(c.vy,c.vx);
        for(let i=0;i<count&&runtime.projectiles.length<48;i++){const angle=heading+(i-(count-1)/2)*(def.projectileSpread||0);runtime.projectiles.push({ id: ++runtime.serial, owner: mob.id, x: mob.x, y: mob.y, vx: Math.cos(angle)*def.projectileSpeed, vy: Math.sin(angle)*def.projectileSpeed, life: 2.5, damage: def.damage });}
        c.emitted = true;
      }
    } else if (c.style === 'charge') {
      const hit = () => {
        if (length(mob.x - actor.x, mob.y - actor.y) < 25 && lineClear(mob.x, mob.y, actor.x, actor.y, isBlocked)) safe = hurt(runtime, ctx, c, def.damage, map, epoch);
        return safe;
      };
      hit();
      if (safe) moveSegment(mob, (c.vx ?? 1) * def.chargeSpeed * STEP, (c.vy ?? 0) * def.chargeSpeed * STEP, isBlocked, hit);
    } else if (inCone(mob, actor, c.vx ?? 1, c.vy ?? 0, def.range, def.arc || 140, isBlocked)) safe = hurt(runtime, ctx, c, def.damage, map, epoch);
    if (!safe) return false;
    if (c.timer <= EPS) {
      if (D.enemies[mob.kind]?.boss === true && c.repeat > 0) { c.repeat--; beginTell(mob, c, actor, def, true); }
      else {
        c.stage = 'recovery'; c.timer = def.recovery;
        if (def.boss) { if (c.style === 'charge') { c.style = 'vulnerable'; c.timer = def.vulnerableDuration||1.8; } c.cycle++; }
      }
    }
    return true;
  }
  // Projectile khóa hướng, hết hạn hoặc chạm tường/người thì biến mất, kể cả khi được né.
  function projectileStep(runtime, ctx, isBlocked, map, epoch) {
    for (let i = runtime.projectiles.length - 1; i >= 0; i--) {
      const p = runtime.projectiles[i]; p.life -= STEP;
      let touched = false, safe = true;
      const moved = moveSegment(p, p.vx * STEP, p.vy * STEP, isBlocked, () => {
        if (length(p.x - ctx.actor.x, p.y - ctx.actor.y) >= 20) return true;
        touched = true; safe = hurt(runtime, ctx, p, p.damage, map, epoch); return false;
      });
      if (!safe) return false;
      if (!moved || touched || p.life <= EPS) runtime.projectiles.splice(i, 1);
    }
    return true;
  }
  // Mỗi frame tối đa năm bước; phần dư quá hạn bị bỏ để ẩn tab không dồn đòn khi quay lại.
  function advance(runtime, dt, context) {
    if (!Number.isFinite(dt) || dt <= 0 || !alive(context?.actor)) return;
    const ctx = { ...context, mobs: Array.isArray(context.mobs) ? context.mobs : [] };
    const isBlocked = typeof ctx.isBlocked === 'function' ? ctx.isBlocked : () => false;
    const actor = ctx.actor, map = actor.map, epoch = runtime.epoch;
    runtime.accumulator += Math.min(dt, STEP * D.maxSteps);
    for (let step = 0; step < D.maxSteps && runtime.accumulator + EPS >= STEP; step++) {
      runtime.accumulator = Math.max(0, runtime.accumulator - STEP);
      runtime.cooldown = Math.max(0, runtime.cooldown - STEP); runtime.dodgeCooldown = Math.max(0, runtime.dodgeCooldown - STEP);
      const regen = Math.max(0, STEP - runtime.staminaDelay); runtime.staminaDelay = Math.max(0, runtime.staminaDelay - STEP);
      // Trong làng dùng nhịp hồi của giếng hiện có, nhưng đồng hồ động tác vẫn tiến bình thường.
      if (ctx.regen !== false && Number.isFinite(actor.stamina)) actor.stamina = Math.min(100, actor.stamina + regen * D.regen.rate);
      if (runtime.dodge) {
        const d = runtime.dodge, time = Math.min(STEP, D.dodge.duration - d.elapsed), [vx, vy] = directions[d.direction];
        moveSegment(actor, vx * D.dodge.speed * time, vy * D.dodge.speed * time, isBlocked);
        d.elapsed += time;
        if (d.elapsed + EPS >= D.dodge.duration) runtime.dodge = null;
      }
      if (!swordStep(runtime, ctx, isBlocked, map, epoch)) { stopAdvance(runtime, ctx, map, epoch); return; }
      for (const mob of ctx.mobs) {
        if (!(mob.hp > 0)) continue;
        if (!enemyStep(runtime, ctx, mob, isBlocked, map, epoch)) { stopAdvance(runtime, ctx, map, epoch); return; }
      }
      if (!projectileStep(runtime, ctx, isBlocked, map, epoch)) { stopAdvance(runtime, ctx, map, epoch); return; }
      runtime.invulnerable = Math.max(0, runtime.invulnerable - STEP);
      if (!unchanged(runtime, ctx, map, epoch)) { stopAdvance(runtime, ctx, map, epoch); return; }
    }
    if (runtime.accumulator + EPS >= STEP) runtime.accumulator %= STEP;
  }
  return Object.freeze({ createRuntime, requestAttack, requestDodge, cancelInputs, resetActions, advance });
});
