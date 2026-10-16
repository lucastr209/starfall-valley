(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const finite = (n, fallback = 0, max = 1000000) => Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : fallback;
  const cleanName = name => (typeof name === 'string' ? name : '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 18) || 'Nhà thám hiểm';
  const cleanPetName = name => (typeof name === 'string' ? name : '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 18) || 'Cún Sao';
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const safeKey = (id, pattern) => typeof id === 'string' && pattern.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
  const unlockedMap = (s, map) => map !== 'coast' && map !== 'ruins' || s.upgrades.includes(map === 'coast' ? 'bridge' : 'archive');
  const prerequisitesMet = (s, q) => q.requires.every(id => s.quests[id]?.status === 'claimed') && (!q.upgrade || s.upgrades.includes(q.upgrade));
  function createState(name, data) {
    return { version: 1, name: cleanName(name), coins: 180, xp: 0, renown: 0, health: 100, stamina: 100,
      inventory: Object.fromEntries(Object.keys(data.items).map(id => [id, 0])), upgrades: [], quests: {},
      visited: ['village'], day: 1, minutes: 480, map: 'village', x: 800, y: 550,
      resources: {}, crops: [null, null, null, null],
      cropTypes: ['berry', 'berry', 'berry', 'berry'],
      watered: [false, false, false, false],
      selectedSeed: 'berry',
      pet: { name: 'Cún Sao', type: 'dog' },
      friendship: Object.fromEntries(data.npcs.map(n => [n.id, { points: 0, talkedToday: false, giftedToday: false, unlockedRewards: [] }])),
      shrines: [], chests: [], puzzles: [], stats: {}, tracked: null };
  }
  function restoreState(raw, data) {
    const s = createState(raw && raw.name, data);
    if (!raw || raw.version !== 1) return s;
    for (const key of ['coins', 'xp', 'renown']) s[key] = finite(raw[key], s[key]);
    s.health = finite(raw.health, 100, 100); s.stamina = finite(raw.stamina, 100, 100);
    s.day = Math.max(1, finite(raw.day, 1, 99999)); s.minutes = finite(raw.minutes, 480, 1439);
    s.map = data.regions.some(r => r.id === raw.map) ? raw.map : 'village';
    s.x = Math.max(32, finite(raw.x, 800, 1568)); s.y = Math.max(32, finite(raw.y, 550, 1068));
    const savedUpgrades = new Set(Array.isArray(raw.upgrades) ? raw.upgrades : []);
    // Resolve prerequisites in passes so a valid save is independent of array order.
    for (let pass = 0; pass < data.upgrades.length; pass++) {
      for (const u of data.upgrades) if (savedUpgrades.has(u.id) && !s.upgrades.includes(u.id) && u.prerequisites.every(id => s.upgrades.includes(id))) s.upgrades.push(u.id);
    }
    if (!unlockedMap(s, s.map)) { s.map = 'village'; s.x = 800; s.y = 550; }
    for (const id of Object.keys(data.items)) s.inventory[id] = finite(record(raw.inventory)[id], 0, capacity(s));
    s.visited = [...new Set(['village', ...(Array.isArray(raw.visited) ? raw.visited : []).filter(id => data.regions.some(r => r.id === id) && unlockedMap(s, id))])];
    s.resources = Object.fromEntries(Object.entries(record(raw.resources)).filter(([id, t]) => safeKey(id, /^[a-z0-9_-]{1,80}$/) && Number.isFinite(t) && t >= 0 && t <= Number.MAX_SAFE_INTEGER).slice(0, 1000));
    s.crops = [0, 1, 2, 3].map(i => Number.isFinite(raw.crops?.[i]) && raw.crops[i] >= 0 && raw.crops[i] <= Number.MAX_SAFE_INTEGER ? raw.crops[i] : null);
    const validCrops = ['berry', 'carrot', 'wheat'];
    s.cropTypes = [0, 1, 2, 3].map(i => typeof raw.cropTypes?.[i] === 'string' && (validCrops.includes(raw.cropTypes[i]) || Object.hasOwn(data.items, raw.cropTypes[i])) ? raw.cropTypes[i] : 'berry');
    s.watered = [0, 1, 2, 3].map(i => Boolean(raw.watered?.[i]));
    s.selectedSeed = typeof raw.selectedSeed === 'string' && (validCrops.includes(raw.selectedSeed) || Object.hasOwn(data.items, raw.selectedSeed)) ? raw.selectedSeed : 'berry';
    const rawPet = record(raw.pet);
    s.pet = {
      name: cleanPetName(rawPet.name),
      type: typeof rawPet.type === 'string' && /^[a-z0-9_-]{1,20}$/.test(rawPet.type) ? rawPet.type : 'dog'
    };
    const savedFriendship = record(raw.friendship);
    s.friendship = Object.fromEntries(data.npcs.map(n => {
      const stored = record(savedFriendship[n.id]);
      return [n.id, {
        points: finite(stored.points, 0, 500),
        talkedToday: Boolean(stored.talkedToday),
        giftedToday: Boolean(stored.giftedToday),
        unlockedRewards: Array.isArray(stored.unlockedRewards)
          ? [...new Set(stored.unlockedRewards.filter(lvl => Number.isInteger(lvl) && [2, 4, 5].includes(lvl)).sort((a, b) => a - b))]
          : []
      }];
    }));
    s.shrines = [...new Set((Array.isArray(raw.shrines) ? raw.shrines : []).filter(id => ['forest', 'coast', 'ruins'].includes(id) && unlockedMap(s, id)))];
    s.chests = [...new Set((Array.isArray(raw.chests) ? raw.chests : []).filter(id => safeKey(id, /^[a-z0-9_-]{1,80}$/)))].slice(0, 1000);
    s.puzzles = [...new Set((Array.isArray(raw.puzzles) ? raw.puzzles : []).filter(id => safeKey(id, /^[a-z0-9_-]{1,80}$/)))].slice(0, 100);
    s.stats = Object.fromEntries(Object.entries(record(raw.stats)).filter(([id]) => safeKey(id, /^[a-z0-9_:-]{1,80}$/)).slice(0, 1000).map(([id, n]) => [id, finite(n)]));
    const savedQuests = record(raw.quests);
    for (let pass = 0; pass < data.quests.length; pass++) {
      for (const q of data.quests) {
        const stored = record(savedQuests[q.id]);
        if (s.quests[q.id] || !['active', 'claimed'].includes(stored.status) || !prerequisitesMet(s, q)) continue;
        if (stored.status === 'claimed' && q.objectives.some(o => o.type === 'build' && !s.upgrades.includes(o.target) || o.type === 'visit' && !s.visited.includes(o.target) || o.type === 'shrine' && !s.shrines.includes(o.target))) continue;
        s.quests[q.id] = { status: stored.status, progress: q.objectives.map((o, i) => finite(stored.progress?.[i], 0, o.count)) };
      }
    }
    s.tracked = s.quests[raw.tracked]?.status === 'active' ? raw.tracked : null;
    return s;
  }
  const capacity = s => s.upgrades.includes('bag') ? 250 : 100;
  const level = s => 1 + Math.floor(s.xp / 160);
  const weather = s => s.day % 3 === 2 ? 'rain' : 'clear';
  const isNight = s => s.minutes >= 1140 || s.minutes < 360;
  const dailyQuests = (s, data) => {
    const pool = data.quests.filter(q => q.kind === 'daily' && prerequisitesMet(s, q));
    if (!pool.length) return [];
    // Keep accepted tasks on the board when a new prerequisite unlocks mid-day.
    const selected = pool.filter(q => s.quests[q.id]).slice(0, 6);
    for (let i = 0; selected.length < Math.min(6, pool.length) && i < pool.length; i++) {
      const q = pool[((Math.max(1, finite(s.day, 1)) - 1) * 5 + i) % pool.length];
      if (!selected.some(entry => entry.id === q.id)) selected.push(q);
    }
    return selected;
  };
  function available(s, q, data) {
    if (!q || !prerequisitesMet(s, q)) return false;
    return q.kind !== 'daily' || dailyQuests(s, data).some(d => d.id === q.id);
  }
  function accept(s, id, data) {
    const q = data.quests.find(q => q.id === id);
    if (!q || s.quests[id] || !available(s, q, data)) return false;
    s.quests[id] = { status: 'active', progress: q.objectives.map(() => 0) };
    if (!s.tracked || q.kind === 'story') s.tracked = id;
    return true;
  }
  function event(s, type, target, amount, data) {
    amount = finite(amount);
    const targets = { talk: data.npcs.map(n => n.id), gift: data.npcs.map(n => n.id), gather: Object.keys(data.items), deliver: Object.keys(data.items), craft: data.recipes.map(r => r.id), visit: data.regions.map(r => r.id), build: data.upgrades.map(u => u.id), fish: ['fish'], fight: ['slime'], plant: ['berry', 'carrot', 'wheat'], harvest: ['berry', 'carrot', 'wheat'], shrine: ['forest', 'coast', 'ruins'], chest: ['treasure'], night: ['village'], rain: ['herb'] };
    if (!amount || !Object.hasOwn(targets, type) || !targets[type].includes(target)) return false;
    s.stats[`${type}:${target}`] = finite((s.stats[`${type}:${target}`] || 0) + amount);
    if (type === 'talk' && s.friendship?.[target] && !s.friendship[target].talkedToday) {
      s.friendship[target].talkedToday = true;
      s.friendship[target].points = Math.min(500, s.friendship[target].points + 10);
      checkMilestones(s, target, data);
    }
    for (const q of data.quests) {
      const entry = s.quests[q.id];
      if (entry?.status !== 'active') continue;
      q.objectives.forEach((o, i) => {
        if (o.type === type && (o.target === target || o.target === '*')) entry.progress[i] = Math.min(o.count, entry.progress[i] + amount);
      });
    }
    return true;
  }
  function progress(s, q) {
    const deliveryLeft = {};
    return q.objectives.map((o, i) => {
      if (o.type === 'deliver') {
        if (!Object.hasOwn(deliveryLeft, o.target)) deliveryLeft[o.target] = s.inventory[o.target] || 0;
        const amount = Math.min(o.count, deliveryLeft[o.target]); deliveryLeft[o.target] -= amount; return amount;
      }
      if (o.type === 'build') return s.upgrades.includes(o.target) ? o.count : 0;
      if (o.type === 'visit') return s.visited.includes(o.target) ? o.count : 0;
      if (o.type === 'shrine') return s.shrines.includes(o.target) ? o.count : 0;
      if (o.type === 'chest') return Math.min(o.count, s.chests.length);
      return s.quests[q.id]?.progress[i] || 0;
    });
  }
  const complete = (s, q) => !!s.quests[q.id] && progress(s, q).every((p, i) => p >= q.objectives[i].count);
  function claim(s, id, data, npc) {
    const q = data.quests.find(q => q.id === id);
    if (!q || s.quests[id]?.status !== 'active' || !complete(s, q)) return { ok: false, message: 'Mục tiêu chưa hoàn tất.' };
    const deliveries = q.objectives.filter(o => o.type === 'deliver');
    if (deliveries.length && npc !== q.giver) return { ok: false, message: 'Hãy tới gặp người giao nhiệm vụ để giao vật phẩm.' };
    const total = {};
    deliveries.forEach(o => { total[o.target] = (total[o.target] || 0) + o.count; });
    if (Object.entries(total).some(([id, n]) => (s.inventory[id] || 0) < n)) return { ok: false, message: 'Bạn chưa đủ vật phẩm để giao.' };
    if (Object.entries(q.reward.items || {}).some(([item, n]) => s.inventory[item] - (total[item] || 0) + n > capacity(s))) return { ok: false, message: 'Túi vật phẩm đã đầy. Hãy dọn chỗ trước khi nhận thưởng.' };
    for (const [item, n] of Object.entries(total)) s.inventory[item] -= n;
    s.quests[id].status = 'claimed'; s.coins += q.reward.coins; s.xp += q.reward.xp; s.renown += q.reward.renown;
    for (const [item, n] of Object.entries(q.reward.items || {})) s.inventory[item] = Math.min(capacity(s), s.inventory[item] + n);
    if (s.tracked === id) s.tracked = null;
    const next = data.quests.find(q => q.kind === 'story' && !s.quests[q.id] && available(s, q, data));
    if (next) accept(s, next.id, data);
    return { ok: true, message: `Hoàn thành: ${q.title} · +${q.reward.coins} xu · +${q.reward.xp} XP` };
  }
  function addItem(s, item, n, data) {
    if (!Object.hasOwn(data.items, item)) return 0;
    n = finite(n);
    const gained = Math.min(n, capacity(s) - s.inventory[item]);
    if (gained <= 0) return 0;
    s.inventory[item] += gained; return gained;
  }
  function craft(s, id, data) {
    const recipe = data.recipes.find(r => r.id === id);
    if (!recipe) return { ok: false, message: 'Không có công thức này.' };
    if (recipe.requires && !s.upgrades.includes(recipe.requires)) return { ok: false, message: 'Cần xây công trình để mở công thức.' };
    if (Object.entries(recipe.input).some(([item, n]) => s.inventory[item] < n)) return { ok: false, message: 'Chưa đủ nguyên liệu.' };
    if (Object.entries(recipe.output).some(([item, n]) => s.inventory[item] - (recipe.input[item] || 0) + n > capacity(s))) return { ok: false, message: 'Túi vật phẩm đã đầy.' };
    for (const [item, n] of Object.entries(recipe.input)) s.inventory[item] -= n;
    for (const [item, n] of Object.entries(recipe.output)) addItem(s, item, n, data);
    event(s, 'craft', id, 1, data); s.xp += 6;
    return { ok: true, message: `Đã chế tạo ${recipe.name}.` };
  }
  function build(s, id, data) {
    const u = data.upgrades.find(u => u.id === id);
    if (!u) return { ok: false, message: 'Không có công trình này.' };
    if (s.upgrades.includes(id)) return { ok: false, message: 'Công trình đã hoàn thành.' };
    if (u.prerequisites.some(p => !s.upgrades.includes(p))) return { ok: false, message: 'Cần xây công trình tiền đề trước.' };
    if (s.coins < u.cost || Object.entries(u.materials).some(([item, n]) => s.inventory[item] < n)) return { ok: false, message: 'Chưa đủ xu hoặc nguyên liệu.' };
    s.coins -= u.cost;
    for (const [item, n] of Object.entries(u.materials)) s.inventory[item] -= n;
    s.upgrades.push(id); s.xp += 25; event(s, 'build', id, 1, data);
    return { ok: true, message: `Đã xây ${u.name}! ${u.effect}` };
  }
  function sell(s, item, n, data) {
    const prices = { wood: 8, ore: 10, herb: 9, berry: 12, carrot: 16, wheat: 14, seed_carrot: 6, seed_wheat: 5, fish: 25, star: 32, crystal: 35, plank: 28, tea: 32, meal: 60, lantern: 90 };
    n = Math.min(finite(n), s.inventory[item] || 0);
    if (!n || !Object.hasOwn(prices, item) || !Object.hasOwn(data.items, item)) return { ok: false, message: 'Không có vật phẩm để bán.' };
    const coins = Math.floor(prices[item] * n * (s.upgrades.includes('market') ? 1.5 : 1));
    s.inventory[item] -= n; s.coins += coins;
    return { ok: true, message: `Đã bán ${n} ${data.items[item].name}: +${coins} xu.` };
  }
  function nextDay(s, data) {
    s.day++; s.minutes = 480; s.health = 100; s.stamina = 100;
    s.watered = [0, 1, 2, 3].map(() => weather(s) === 'rain');
    if (s.friendship) {
      for (const n of data.npcs) {
        if (s.friendship[n.id]) {
          s.friendship[n.id].talkedToday = false;
          s.friendship[n.id].giftedToday = false;
        }
      }
    }
    for (const q of data.quests.filter(q => q.kind === 'daily')) delete s.quests[q.id];
    if (data.quests.find(q => q.id === s.tracked)?.kind === 'daily') s.tracked = null;
  }
  function visit(s, map, data) {
    if (!data.regions.some(r => r.id === map)) return false;
    if (map === 'coast' && !s.upgrades.includes('bridge')) return false;
    if (map === 'ruins' && !s.upgrades.includes('archive')) return false;
    s.map = map; if (!s.visited.includes(map)) s.visited.push(map);
    event(s, 'visit', map, 1, data); return true;
  }
  function checkMilestones(s, npcId, data) {
    const f = s.friendship?.[npcId];
    if (!f) return [];
    const npc = data.npcs.find(n => n.id === npcId);
    if (!npc) return [];
    const hearts = Math.floor(f.points / 100);
    const unlocked = [];
    for (const m of [2, 4, 5]) {
      if (hearts >= m && !f.unlockedRewards.includes(m)) {
        f.unlockedRewards.push(m);
        f.unlockedRewards.sort((a, b) => a - b);
        const r = npc.milestoneRewards?.[m];
        if (r) {
          if (r.coins) s.coins = finite(s.coins + r.coins);
          if (r.renown) s.renown = finite(s.renown + r.renown);
          if (r.xp) s.xp = finite(s.xp + r.xp);
          if (r.items) {
            for (const [item, count] of Object.entries(r.items)) {
              addItem(s, item, count, data);
            }
          }
          unlocked.push({ milestone: m, reward: r });
        }
      }
    }
    return unlocked;
  }
  function giveGift(s, npcId, itemId, data) {
    const npc = data.npcs.find(n => n.id === npcId);
    if (!npc || !s.friendship?.[npcId]) return { ok: false, success: false, message: 'Cư dân không tồn tại.' };
    if (!Object.hasOwn(data.items, itemId) || (s.inventory[itemId] || 0) <= 0) return { ok: false, success: false, message: 'Bạn không có vật phẩm này trong túi.' };
    const f = s.friendship[npcId];
    if (f.giftedToday) return { ok: false, success: false, message: 'Hôm nay bạn đã tặng quà cho người này rồi.' };

    const prefs = npc.giftPreferences || {};
    let tier = 'neutral';
    let pointsDelta = 20;
    if (prefs.loved?.includes(itemId)) {
      tier = 'loved';
      pointsDelta = 80;
    } else if (prefs.liked?.includes(itemId)) {
      tier = 'liked';
      pointsDelta = 45;
    } else if (prefs.disliked?.includes(itemId)) {
      tier = 'disliked';
      pointsDelta = -15;
    }

    f.points = Math.max(0, Math.min(500, f.points + pointsDelta));
    s.inventory[itemId] -= 1;
    f.giftedToday = true;
    event(s, 'gift', npcId, 1, data);
    const rewards = checkMilestones(s, npcId, data);
    const hearts = Math.floor(f.points / 100);
    const reaction = npc.giftReactions?.[tier] || '';
    return {
      ok: true,
      success: true,
      tier,
      pointsDelta,
      points: f.points,
      hearts,
      reaction,
      rewards,
      message: reaction
    };
  }
  return { createState, restoreState, cleanName, capacity, level, weather, isNight, dailyQuests, available, accept, event, progress, complete, claim, addItem, craft, build, sell, nextDay, visit, giveGift, checkMilestones };
});
