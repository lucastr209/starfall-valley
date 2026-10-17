(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const finite = (n, fallback = 0, max = 1000000) => Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : fallback;
  const cleanName = name => (typeof name === 'string' ? name : '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 18) || 'Nhà thám hiểm';
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const exploration = () => typeof module === 'object' && module.exports ? require('./exploration-core.js') : globalThis.StardropExploration;
  const safeKey = (id, pattern) => typeof id === 'string' && pattern.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
  const unlockedMap = (s, map) => map !== 'coast' && map !== 'ruins' || s.upgrades.includes(map === 'coast' ? 'bridge' : 'archive');
  const prerequisitesMet = (s, q) => q.requires.every(id => s.quests[id]?.status === 'claimed') && (!q.upgrade || s.upgrades.includes(q.upgrade));
  function createState(name, data) {
    return { version: 1, name: cleanName(name), coins: 180, xp: 0, renown: 0, health: 100, stamina: 100,
      inventory: Object.fromEntries(Object.keys(data.items).map(id => [id, 0])), upgrades: [], quests: {},
      visited: ['village'], day: 1, minutes: 480, map: 'village', x: 800, y: 550,
      resources: {}, crops: [null, null, null, null], shrines: [], chests: [], stats: {}, tracked: null, exploration: exploration().create(),
      festivalSeen: false, personalGoal: null, adventure: { proofs: [], checkpoint: null, weapon: 'starter', milestones: [], puzzles: {relic:[], 'root-light':['moon','leaf','star']}, loadout: 'healer', supplies: 0 } };
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
    // Khôi phục chứng cứ theo tiền đề nhiều lượt; không nhận boss hoặc trang bị từ ID không hợp lệ.
    const rawAdventure=record(raw.adventure),savedProofs=new Set(Array.isArray(rawAdventure.proofs)?rawAdventure.proofs:[]);
    s.visited = [...new Set(['village', ...(Array.isArray(raw.visited) ? raw.visited : []).filter(id => data.regions.some(r => r.id === id) && unlockedMap(s, id))])];
    s.resources = Object.fromEntries(Object.entries(record(raw.resources)).filter(([id, t]) => safeKey(id, /^[a-z0-9_-]{1,80}$/) && Number.isFinite(t) && t >= 0 && t <= Number.MAX_SAFE_INTEGER).slice(0, 1000));
    s.crops = [0, 1, 2, 3].map(i => Number.isFinite(raw.crops?.[i]) && raw.crops[i] >= 0 && raw.crops[i] <= Number.MAX_SAFE_INTEGER ? raw.crops[i] : null);
    s.shrines = [...new Set((Array.isArray(raw.shrines) ? raw.shrines : []).filter(id => ['forest', 'coast', 'ruins'].includes(id) && unlockedMap(s, id)))];
    s.chests = [...new Set((Array.isArray(raw.chests) ? raw.chests : []).filter(id => safeKey(id, /^[a-z0-9_-]{1,80}$/)))].slice(0, 1000);
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
    if(s.quests.story05?.status==='claimed')for(let pass=0;pass<(data.adventure?.proofs.length||0);pass++)for(const proof of data.adventure.proofs){if(savedProofs.has(proof.id))recordProof(s,proof.id,data);}
    // Sau khi đọc chứng cứ mới kiểm lịch sử phiêu lưu, rồi loại các bước con mất tiền đề.
    for(let pass=0;pass<data.quests.length;pass++)for(const q of data.quests){
      const stored=s.quests[q.id];if(q.kind!=='adventure'||!stored)continue;
      if(!prerequisitesMet(s,q)||stored.status==='claimed'&&q.objectives.some(o=>o.type==='proof'&&!s.adventure.proofs.includes(o.target)))delete s.quests[q.id];
    }
    if(s.quests[s.tracked]?.status!=='active')s.tracked=null;
    s.adventure.checkpoint=rawAdventure.checkpoint==='forest-rest'&&s.adventure.proofs.includes('rescue')?'forest-rest':null;
    const weapon=rawAdventure.weapon;
    s.adventure.weapon=(weapon==='rootblade'||data.exploration?.equipment[weapon]?.slot==='weapon')&&s.inventory[weapon]>0?weapon:'starter';
    // Tiến trình khám phá chỉ nhận ID đã khai báo; mẫu câu đố sai dạng không được coi là lời giải.
    if(s.quests.story05?.status==='claimed')s.adventure.milestones=[...new Set((Array.isArray(rawAdventure.milestones)?rawAdventure.milestones:[]).filter(id=>data.adventure.milestones.includes(id)))];
    // Cột dây là chuỗi liên tiếp; bỏ đoạn bị nhảy cóc để file cũ/hỏng vẫn có thể tiếp tục cứu người.
    const route=['rescue-route','rescue-1','rescue-2','rescue-3'],storedMilestones=new Set(s.adventure.milestones);
    s.adventure.milestones=s.adventure.milestones.filter(id=>!route.includes(id)&&(!id.startsWith('light-')||s.adventure.proofs.includes('rescue')));
    if(s.adventure.proofs.includes('training'))for(const id of route){if(!storedMilestones.has(id)||id==='rescue-3'&&!s.adventure.proofs.includes('rescue'))break;s.adventure.milestones.push(id);}
    for(const id of ['relic','root-light']){
      const draft=record(rawAdventure.puzzles)[id];
      if(Array.isArray(draft)&&draft.length<=3&&draft.every(v=>['leaf','star','moon'].includes(v))&&(id==='relic'?new Set(draft).size===draft.length:draft.length===3))s.adventure.puzzles[id]=draft.slice();
    }
    s.adventure.loadout=rawAdventure.loadout==='runner'?'runner':'healer';
    s.adventure.supplies=s.adventure.proofs.includes('prepared')?finite(rawAdventure.supplies,0,s.adventure.loadout==='runner'?1:2):0;
    // Chỉ công nhận lễ hội/mục tiêu tự chọn khi chuỗi cốt truyện hợp lệ đã kết thúc.
    const finished = journeyProgress(s, data).finished;
    s.festivalSeen = finished && raw.festivalSeen === true;
    s.personalGoal = finished && data.journey.goals.some(g => g.id === raw.personalGoal) ? raw.personalGoal : null;
    s.exploration=exploration().restore(raw.exploration,s,data);
    // Việc hang/nhà chỉ giữ lịch sử nhận thưởng khi địa điểm tương ứng có chứng cứ bền.
    for(const q of data.quests)if(s.quests[q.id]?.status==='claimed'&&q.objectives.some(o=>o.type==='cave'&&!s.exploration.cleared.includes(o.target)||o.type==='explore'&&!s.exploration.visited.includes(o.target)))delete s.quests[q.id];
    return s;
  }
  // Suy ra tiến độ từ nhiệm vụ đã nhận thưởng; không lưu thêm bộ đếm có thể lệch với save.
  function journeyProgress(s, data) {
    const stages = data.journey.stages.map(stage => ({ ...stage, done: stage.quests.filter(id => s.quests[id]?.status === 'claimed').length, total: stage.quests.length }));
    const current = stages.findIndex(stage => stage.done < stage.total);
    const finished = s.quests[data.journey.finalQuest]?.status === 'claimed';
    return { stages, current: current < 0 ? stages.length - 1 : current, finished,
      done: stages.reduce((n, stage) => n + stage.done, 0), total: stages.reduce((n, stage) => n + stage.total, 0),
      next: data.quests.find(q => q.kind === 'story' && s.quests[q.id]?.status !== 'claimed') || null };
  }
  // Nối lại save cũ đang thiếu bước kế tiếp; không nhận lặp hoặc nhận thêm khi còn bước cốt truyện đang làm.
  function resumeStory(s, data) {
    if (data.quests.some(q => q.kind === 'story' && s.quests[q.id]?.status === 'active')) return false;
    const next = data.quests.find(q => q.kind === 'story' && !s.quests[q.id] && available(s, q, data));
    return next ? accept(s, next.id, data) : false;
  }
  // Tuyến phiêu lưu chỉ nhận một bước chính, các việc khám phá tự chọn phải nhận riêng.
  function resumeAdventure(s,data){
    const ids=data.adventure?.mainIds||[];
    if(ids.some(id=>s.quests[id]?.status==='active'))return false;
    const next=data.quests.find(q=>ids.includes(q.id)&&!s.quests[q.id]&&available(s,q,data));
    return next?accept(s,next.id,data):false;
  }
  // Mỗi chứng cứ là một sự kiện duy nhất có tiền đề; không tính ngược mục tiêu thu thập thông thường.
  function recordProof(s,id,data){
    const proof=data.adventure?.proofs.find(p=>p.id===id);
    if(!proof||s.quests.story05?.status!=='claimed'||s.adventure.proofs.includes(id)||proof.requires.some(p=>!s.adventure.proofs.includes(p)))return false;
    s.adventure.proofs.push(id);if(id==='rescue')s.adventure.checkpoint='forest-rest';return true;
  }
  // Mỗi mục tiêu tự chọn dùng dữ liệu tiến trình thật, chỉ đếm rương có trong bản đồ hiện tại.
  function personalGoals(s, data) {
    return data.journey.goals.map(goal => {
      const entries = goal.id === 'neighbors' ? data.quests.filter(q => q.kind === 'side') : goal.id === 'builder' ? data.upgrades : data.journey.treasureIds;
      const done = entries.filter(entry => goal.id === 'neighbors' ? s.quests[entry.id]?.status === 'claimed' : goal.id === 'builder' ? s.upgrades.includes(entry.id) : s.chests.includes(entry)).length;
      return { ...goal, done, total: entries.length, complete: done === entries.length };
    });
  }
  // Lựa chọn chỉ mở sau hành trình chính; có thể bỏ theo dõi mà không mất thành quả.
  function chooseGoal(s, id, data) {
    if (!journeyProgress(s, data).finished || id !== null && !data.journey.goals.some(g => g.id === id)) return false;
    s.personalGoal = id;
    return true;
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
  // Tách việc có thể hành động khỏi lịch sử; nhiệm vụ đủ mục tiêu vẫn chờ nhận thưởng.
  function journalEntries(s, data, kind = 'all') {
    if (!['all', ...new Set(data.quests.map(q => q.kind))].includes(kind)) kind = 'all';
    const entries = { active: [], available: [], history: [] };
    for (const q of data.quests) {
      if (kind !== 'all' && q.kind !== kind) continue;
      const status = s.quests[q.id]?.status;
      if (status === 'active') entries.active.push(q);
      else if (status === 'claimed') entries.history.push(q);
      else if (available(s, q, data)) entries.available.push(q);
    }
    entries.active.sort((a, b) => Number(complete(s, b)) - Number(complete(s, a)) || Number(b.id === s.tracked) - Number(a.id === s.tracked));
    return entries;
  }
  // Chỉ chọn thay thế khi nhiệm vụ cũ đã kết thúc; giữ lựa chọn theo dõi thủ công còn hợp lệ.
  function ensureTrackedQuest(s, data) {
    if (s.quests[s.tracked]?.status !== 'active') s.tracked = journalEntries(s, data).active[0]?.id || null;
    return s.tracked;
  }
  function accept(s, id, data) {
    const q = data.quests.find(q => q.id === id);
    if (!q || s.quests[id] || !available(s, q, data)) return false;
    s.quests[id] = { status: 'active', progress: q.objectives.map(() => 0) };
    if (s.quests[s.tracked]?.status !== 'active') s.tracked = id;
    return true;
  }
  function event(s, type, target, amount, data) {
    amount = finite(amount);
    const targets = { talk: data.npcs.map(n => n.id), gather: Object.keys(data.items), deliver: Object.keys(data.items), craft: data.recipes.map(r => r.id), visit: data.regions.map(r => r.id), build: data.upgrades.map(u => u.id), fish: ['fish'], fight: ['slime'], plant: ['berry'], harvest: ['berry'], shrine: ['forest', 'coast', 'ruins'], chest: ['treasure'], night: ['village'], rain: ['herb'] };
    if (!amount || !Object.hasOwn(targets, type) || !targets[type].includes(target)) return false;
    s.stats[`${type}:${target}`] = finite((s.stats[`${type}:${target}`] || 0) + amount);
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
      if (o.type === 'proof') return s.adventure.proofs.includes(o.target) ? o.count : 0;
      if (o.type === 'cave') return s.exploration.cleared.includes(o.target) ? o.count : 0;
      if (o.type === 'explore') return s.exploration.visited.includes(o.target) ? o.count : 0;
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
    resumeStory(s, data);
    resumeAdventure(s,data);
    ensureTrackedQuest(s, data);
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
    if (recipe.proof && !s.adventure.proofs.includes(recipe.proof)) return { ok:false,message:'Giải phóng lõi rừng để mở công thức này.' };
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
    const prices = { wood: 8, ore: 10, herb: 9, berry: 12, fish: 25, star: 32, crystal: 35, plank: 28, tea: 32, meal: 60, lantern: 90 };
    n = Math.min(finite(n), s.inventory[item] || 0);
    if (!n || !Object.hasOwn(prices, item) || !Object.hasOwn(data.items, item)) return { ok: false, message: 'Không có vật phẩm để bán.' };
    const coins = Math.floor(prices[item] * n * (s.upgrades.includes('market') ? 1.5 : 1));
    s.inventory[item] -= n; s.coins += coins;
    return { ok: true, message: `Đã bán ${n} ${data.items[item].name}: +${coins} xu.` };
  }
  function nextDay(s, data) {
    s.day++; s.minutes = 480; s.health = 100; s.stamina = 100;
    for (const q of data.quests.filter(q => q.kind === 'daily')) delete s.quests[q.id];
    if (data.quests.find(q => q.id === s.tracked)?.kind === 'daily') s.tracked = null;
    ensureTrackedQuest(s, data);
  }
  function visit(s, map, data) {
    if (!data.regions.some(r => r.id === map)) return false;
    if (map === 'coast' && !s.upgrades.includes('bridge')) return false;
    if (map === 'ruins' && !s.upgrades.includes('archive')) return false;
    s.map = map; if (!s.visited.includes(map)) s.visited.push(map);
    event(s, 'visit', map, 1, data); return true;
  }
  return { createState, restoreState, cleanName, capacity, level, weather, isNight, dailyQuests, available, accept, event, progress, complete, claim, addItem, craft, build, sell, nextDay, visit, journeyProgress, resumeStory, personalGoals, chooseGoal, journalEntries, ensureTrackedQuest, resumeAdventure, recordProof };
});
