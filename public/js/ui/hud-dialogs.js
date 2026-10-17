(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropDialogs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderJournalContent(env) {
    const { state, D, C, tab, view, npcById, objectiveText, encounter, interior } = env;
    const entries = C.journalEntries(state, D, tab), list = entries[view];
    const cards = list.map(q => {
      const entry = state.quests[q.id], can = C.available(state, q, D), p = C.progress(state, q), ready = entry?.status === 'active' && C.complete(state, q);
      const action = entry?.status === 'claimed'
        ? '<button disabled>✓ Đã nhận thưởng</button>'
        : entry?.status === 'active'
          ? `<div class="card-actions"><button data-track="${q.id}">${state.tracked === q.id ? 'Đang theo dõi' : 'Theo dõi'}</button>${ready ? `<button data-claim="${q.id}">Nhận thưởng${q.objectives.some(o => o.type === 'deliver') ? ' / giao đồ' : ''}</button>` : '<button disabled>Đang thực hiện</button>'}</div>`
          : `<button data-accept="${q.id}" ${can ? '' : 'disabled'}>${can ? 'Nhận nhiệm vụ' : 'Chưa mở khóa'}</button>`;
      const locked = q.requires.filter(id => state.quests[id]?.status !== 'claimed').map(id => D.quests.find(x => x.id === id)?.title).filter(Boolean);
      if (q.upgrade && !state.upgrades.includes(q.upgrade)) locked.push(D.upgrades.find(u => u.id === q.upgrade)?.name);
      const chapter = q.kind === 'story' ? `CHẶNG ${D.journey.stages.findIndex(s => s.quests.includes(q.id)) + 1} · ` : '';
      return `<article data-quest-id="${q.id}" class="card ${!can && !entry ? 'locked' : ''}"><span class="badge">${chapter}${esc(npcById(q.giver)?.name || 'BẢNG TIN LÀNG')} ${entry?.status === 'claimed' ? '· HOÀN TẤT' : ready ? '· Sẵn sàng nhận thưởng' : ''}</span><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><ul>${q.objectives.map((o, i) => `<li class="${p[i] >= o.count ? 'good' : ''}">${p[i] >= o.count ? '✓' : '◇'} ${esc(objectiveText(o))} · ${p[i]}/${o.count}</li>`).join('')}</ul>${locked.length ? `<p class="quest-direction">Mở sau: ${esc(locked.join(' · '))}</p>` : ''}${q.objectives.some(o => o.type === 'deliver') ? `<p class="quest-direction">Giao tận tay ${esc(npcById(q.giver)?.name)} · ${esc(D.regions.find(r => r.id === npcById(q.giver)?.map)?.name || '')}</p>` : ''}<div class="reward">◈ ${q.reward.coins} xu · ✦ ${q.reward.xp} XP · ♧ ${q.reward.renown} uy tín</div>${action}</article>`;
    }).join('');
    const views = [['active', 'Đang làm'], ['available', 'Có thể nhận'], ['history', 'Lịch sử']], status = views.find(([id]) => id === view)[1];
    const empty = { active: 'Chưa có nhiệm vụ đang làm.', available: 'Chưa có nhiệm vụ có thể nhận trong mục này.', history: 'Chưa có nhiệm vụ đã nhận thưởng trong mục này.' };
    const adventure = encounter?.cave
      ? `<section class="adventure-overview"><h3>${esc(interior.room.name)}</h3><p>${esc(interior.room.tactics)}</p><p>Đợt ${encounter.wave + 1}/${interior.room.waves.length} · Tiếp tế còn ${state.adventure.supplies} phần</p><button data-field-heal ${state.adventure.supplies ? '' : 'disabled'}>Dùng tiếp tế</button><button data-retreat>Rút lui về điểm nghỉ · giữ tiến trình</button></section>`
      : tab === 'adventure' || encounter
        ? `<section class="adventure-overview"><h3>${D.adventure.title}</h3><p>Đọc dấu rễ → học né → cứu cư dân → ba mạch rễ → chuẩn bị → Hộ Vệ. Kiếm khởi đầu đủ sức thắng; V hoặc nút Né để tránh vùng vàng.</p>${encounter ? `<p>Đợt ${encounter.wave + 1}/${D.adventure.encounters[encounter.id].length} · Tiếp tế còn ${state.adventure.supplies} phần</p><button data-field-heal ${state.adventure.supplies ? '' : 'disabled'}>Dùng tiếp tế</button><button data-retreat>Rút lui về điểm nghỉ · giữ tiến trình</button>` : ''}${state.quests.adv06?.status === 'claimed' ? '<p class="good">Lõi rừng đã hồi sinh. Kiếm Rễ Sao ở trong túi; xưởng có thêm công thức.</p><button data-open-build>Xây xưởng từ nguyên liệu được thưởng</button>' : ''}</section>`
        : '';
    return {
      title: 'Sổ hành trình',
      eyebrow: `NGÀY ${state.day} · CÂU CHUYỆN CỦA ${state.name}`,
      html: `<div class="tab-strip journal-views" aria-label="Trạng thái nhiệm vụ">${views.map(([id, name]) => `<button data-journal-view="${id}" aria-pressed="${view === id}" class="${view === id ? 'selected' : ''}">${name} (${entries[id].length})</button>`).join('')}</div>${renderJournalTabs(env, tab, view)}${tab === 'story' ? renderJourneyOverview(env) : ''}${adventure}<p id="journal-status" tabindex="-1" role="status">${status}: ${list.length} nhiệm vụ${tab === 'daily' && view === 'history' ? ' · Đã hoàn tất hôm nay' : ''}.</p><p class="dialog-intro">Đủ mục tiêu → nhận thưởng → tự chuyển vào lịch sử. Nhiệm vụ giao đồ cần gặp đúng cư dân; hợp đồng làm mới mỗi ngày.</p><div class="cards">${cards || `<section class="quest-empty"><p>${empty[view]}</p><button data-journal-view="available">Tìm nhiệm vụ mới</button><button data-open-story>Xem bước tiếp theo</button></section>`}</div>`
    };
  }

  function renderJournalTabs(env, currentTab, currentView) {
    const { state, D, C } = env;
    const tabs = [['all', 'Tất cả'], ['adventure', 'Phiêu lưu'], ['story', 'Hồi sinh làng'], ['side', 'Việc của cư dân'], ['daily', 'Hợp đồng hôm nay']];
    if (C.journeyProgress(state, D).finished) tabs.push(['goals', 'Sau lễ hội']);
    return `<div class="tab-strip journal-kinds" aria-label="Loại nhiệm vụ">${tabs.map(([id, name]) => `<button data-tab="${id}" class="${currentTab === id ? 'selected' : ''}" aria-pressed="${currentTab === id}">${name}${id === 'goals' ? '' : ` (${C.journalEntries(state, D, id)[currentView].length})`}</button>`).join('')}</div>`;
  }

  function renderJourneyOverview(env) {
    const { state, D, C } = env;
    const j = C.journeyProgress(state, D), q = j.next;
    const nextBuild = q?.objectives.find(o => o.type === 'build' && !state.upgrades.includes(o.target));
    return `<section class="journey-overview"><span class="tiny-label">${j.finished ? 'HÀNH TRÌNH ĐÃ HOÀN THÀNH' : 'ĐÍCH ĐẾN CỦA BẠN'}</span><h3>${esc(j.finished ? 'Đêm Hội Sao đã trở lại' : D.journey.goal)}</h3><p>${esc(D.journey.description)}</p><progress value="${j.done}" max="${j.total}" aria-label="${j.done}/${j.total} bước cốt truyện"></progress><p>${j.done}/${j.total} bước đã hoàn thành · Nhiệm vụ phụ không bắt buộc để kết thúc hành trình.</p><ol class="journey-stages">${j.stages.map((s, i) => `<li class="${s.done === s.total ? 'completed' : i === j.current ? 'current' : 'future'}"><span class="badge">CHẶNG ${i + 1} · ${s.done === s.total ? '✓ HOÀN THÀNH' : i === j.current ? 'ĐANG THỰC HIỆN' : 'PHÍA TRƯỚC'}</span><h4>${esc(s.title)}</h4><p>${esc(s.description)}</p><small>${s.done}/${s.total} bước · ${esc(s.milestone)}</small></li>`).join('')}</ol>${q ? `<p class="journey-next"><strong>Việc tiếp theo: ${esc(q.title)}</strong><br>${esc(q.description)}</p>${nextBuild ? '<button data-open-build>Xem công trình cần xây</button>' : ''}` : '<div class="npc-actions"><button data-open-festival>Xem lại Đêm Hội Sao</button><button data-open-goals>Chọn mục tiêu tiếp theo</button></div>'}</section>`;
  }

  function renderGoalsContent(env) {
    const { state, D, C } = env;
    const cards = C.personalGoals(state, D).map(g => `<article class="card"><span class="badge">${g.complete ? '✓ HOÀN THÀNH' : state.personalGoal === g.id ? 'ĐANG THEO DÕI' : 'TỰ CHỌN'}</span><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><progress value="${g.done}" max="${g.total}" aria-label="${esc(g.title)}"></progress><p>${g.done}/${g.total}</p><button data-goal="${state.personalGoal === g.id ? 'none' : g.id}">${state.personalGoal === g.id ? 'Ngừng theo dõi' : 'Chọn mục tiêu này'}</button><button data-goal-action="${g.action}">${g.actionLabel}</button></article>`).join('');
    return {
      title: 'Chuyến đi sau lễ hội',
      eyebrow: 'ĐÊM HỘI SAO ĐÃ TRỞ LẠI',
      html: `${renderJournalTabs(env, 'goals', 'active')}<p class="dialog-intro">Bạn đã hoàn thành hành trình hồi sinh. Những mục tiêu dưới đây là tùy chọn; chọn một mục tiêu để theo dõi, đổi hoặc dừng bất cứ lúc nào.</p><div class="cards">${cards}</div><div class="npc-actions"><button data-open-festival>Xem lại Đêm Hội Sao</button></div>`
    };
  }

  function renderTreasureContent(env) {
    const { state, D } = env;
    const cards = D.journey.treasureIds.map(id => {
      const region = D.regions.find(r => id === `chest-${r.id}`), opened = state.chests.includes(id);
      return `<article class="card"><span class="badge">${opened ? '✓ ĐÃ MỞ' : 'CÒN CHỜ BẠN'}</span><h3>${esc(region.name)}</h3><p>Rương ở góc đông nam, trên bãi đất phía dưới hồ. Đi vòng phía nam hồ rồi theo bờ xuống dưới.</p></article>`;
    }).join('');
    return {
      title: 'Rương thất lạc',
      eyebrow: 'BA CHUYẾN KHÁM PHÁ',
      html: `<p class="dialog-intro">Mỗi vùng ngoài làng có một rương. Rương chỉ trao thưởng một lần; mở rương sẽ tự cập nhật mục tiêu của bạn.</p><div class="cards">${cards}</div><div class="npc-actions"><button data-open-goals>Trở lại mục tiêu</button></div>`
    };
  }

  function renderInventoryContent(env) {
    const { state, D } = env;
    const items = Object.entries(state.inventory).map(([id, count]) => `<article class="card"><h3>${esc(D.items[id].name)}</h3><p>${esc(D.items[id].desc)}</p><p class="inventory-count">Số lượng: <strong>${count}</strong></p><p class="price-pill">Bán: ${D.items[id].price} xu</p><button data-sell="${id}" ${count ? '' : 'disabled'}>Bán 1 cái</button></article>`).join('');
    const weapons = (D.exploration?.weapons || []).filter(w => state.inventory[w.id] > 0 || state.adventure.weapon === w.id);
    const armors = (D.exploration?.armors || []).filter(a => state.inventory[a.id] > 0 || state.adventure.armor === a.id);
    const gearSection = weapons.length || armors.length ? `<section class="gear-overview"><h3>Trang bị cá nhân</h3><div class="cards">${weapons.map(w => `<article class="card"><h3>${esc(w.name)}</h3><p>${esc(w.desc)} · Sát thương: ${w.damage}</p><button data-equip-weapon="${w.id}" ${state.adventure.weapon === w.id ? 'disabled' : ''}>${state.adventure.weapon === w.id ? '✓ Đang trang bị' : 'Trang bị kiếm này'}</button></article>`).join('')}${armors.map(a => `<article class="card"><h3>${esc(a.name)}</h3><p>${esc(a.desc)} · Giảm sát thương: ${Math.round(a.reduction * 100)}%</p><button data-equip-armor="${a.id}" ${state.adventure.armor === a.id ? 'disabled' : ''}>${state.adventure.armor === a.id ? '✓ Đang mặc' : 'Mặc áo này'}</button></article>`).join('')}</div></section>` : '';
    const recipes = D.recipes.map(r => {
      const missing = r.proof && !state.adventure.proofs.includes(r.proof)
        ? 'Cần giải phóng lõi rừng'
        : r.requires && !state.upgrades.includes(r.requires)
          ? `Cần ${D.upgrades.find(u => u.id === r.requires).name}`
          : '';
      return `<article class="card"><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><div class="materials">${Object.entries(r.input).map(([id, n]) => `${esc(D.items[id].name)} ${state.inventory[id]}/${n}`).join(' · ')} → ${Object.entries(r.output).map(([id, n]) => `${n} ${esc(D.items[id].name)}`).join(', ')}</div><button data-craft="${r.id}" ${missing ? 'disabled' : ''}>${esc(missing || 'Chế tạo')}</button></article>`;
    }).join('');
    return {
      title: 'Túi đồ & Chế tạo',
      eyebrow: `${state.coins} XU · VŨ KHÍ: ${esc(D.adventure?.weapons?.find(w => w.id === state.adventure.weapon)?.name || 'Kiếm khởi đầu')}`,
      html: `${gearSection}<h3>Vật phẩm thu thập</h3><div class="cards">${items}</div><h3 style="margin-top:1.2rem">Công thức làng</h3><div class="cards">${recipes}</div>`
    };
  }

  function renderBuildContent(env) {
    const { state, D, C } = env;
    const cards = D.upgrades.map(u => {
      const owned = state.upgrades.includes(u.id), can = C.canBuild(state, u);
      const req = Object.entries(u.cost).map(([k, v]) => `${esc(D.items[k].name)} ${state.inventory[k]}/${v}`).join(' · ');
      return `<article class="card ${owned ? 'built' : ''}"><span class="badge">${owned ? '✓ ĐÃ HOÀN THÀNH' : can ? 'SẴN SÀNG XÂY DỰNG' : 'CHƯA ĐỦ VẬT LIỆU'}</span><h3>${esc(u.name)}</h3><p>${esc(u.desc)}</p><div class="materials">${req}</div><button data-build="${u.id}" ${owned || !can ? 'disabled' : ''}>${owned ? 'Đã xây dựng' : 'Bắt đầu dựng'}</button></article>`;
    }).join('');
    return {
      title: 'Xây dựng Thung Lũng',
      eyebrow: 'CÔNG TRÌNH VÀ CỘNG ĐỒNG',
      html: `<p class="dialog-intro">Mỗi công trình mang lại sức sống mới cho làng, mở khu vực mới hoặc tăng hiệu quả sinh hoạt.</p><div class="cards">${cards}</div>`
    };
  }

  return {
    esc,
    renderJournalContent,
    renderJournalTabs,
    renderJourneyOverview,
    renderGoalsContent,
    renderTreasureContent,
    renderInventoryContent,
    renderBuildContent
  };
});
