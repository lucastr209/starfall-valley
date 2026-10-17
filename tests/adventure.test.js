'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../public/js/data/game-data.js');
const C = require('../public/js/core/game-core.js');
const A = require('../public/js/core/adventure-core.js');

// Tạo save cũ đã mở rừng qua đúng chuỗi nhiệm vụ, không can thiệp dữ liệu người chơi.
function unlocked() {
  const s = C.createState('Lữ khách', D);
  for (const q of D.quests.filter(q => q.kind === 'story').slice(0, 5)) {
    if (q.id === 'story04') s.upgrades.push('well');
    s.quests[q.id] = { status: 'claimed', progress: q.objectives.map(o => o.count) };
  }
  s.visited.push('forest'); return C.restoreState(s, D);
}

test('Forest campaign unlocks on legacy story05 and resumes one quest without replaying old work', () => {
  const fresh = C.createState('Mới', D); assert.equal(C.resumeAdventure(fresh, D), false);
  const s = unlocked(), before = JSON.stringify(s.quests); assert.equal(C.resumeAdventure(s, D), true);
  assert.equal(s.quests.adv01.status, 'active'); assert.equal(C.resumeAdventure(s, D), false);
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(s.quests).filter(([id]) => id.startsWith('story')))), before);
});

test('Adventure interactions enforce location and dependencies, and proofs survive export/import restoration', () => {
  const s = unlocked(); C.resumeAdventure(s, D); s.map = 'forest';
  const trail = D.adventure.objects.find(o => o.id === 'trail');
  assert.equal(A.interact(s, trail.id, D).ok, false, 'Distant UI calls cannot activate a landmark');
  s.x = trail.x; s.y = trail.y; assert.equal(A.interact(s, 'root-boss', D).ok, false);
  assert.equal(A.interact(s, trail.id, D).ok, true);
  for(const id of ['trail-2','trail-3']){const o=D.adventure.objects.find(o=>o.id===id);s.x=o.x;s.y=o.y;A.interact(s,id,D);}
  assert.equal(C.complete(s, D.quests.find(q => q.id === 'adv01')), true);
  assert.equal(C.claim(s, 'adv01', D).ok, true); assert.equal(s.quests.adv02.status, 'active');
  assert.ok(C.restoreState(JSON.parse(JSON.stringify(s)), D).adventure.proofs.includes('trail'));
  assert.equal(C.recordProof(s, '__proto__', D), false); assert.equal(C.recordProof(s, 'rootBoss', D), false);
});

test('Unique boss reward waits for capacity, supports earlier victory and does not duplicate on replay', () => {
  const s = unlocked(); C.resumeAdventure(s, D);
  for (const q of D.quests.filter(q => D.adventure.mainIds.includes(q.id))) {
    for (const o of q.objectives) assert.equal(C.recordProof(s, o.target, D) || s.adventure.proofs.includes(o.target), true);
    if (q.id === 'adv06') {
      s.inventory.rootblade = C.capacity(s); const before = JSON.stringify(s);
      assert.equal(C.claim(s, q.id, D).ok, false); assert.equal(JSON.stringify(s), before);
      s.inventory.rootblade = 0;
    }
    assert.equal(C.claim(s, q.id, D).ok, true, q.id);
  }
  assert.equal(s.inventory.rootblade, 1); assert.ok(s.inventory.wood >= 8 && s.inventory.ore >= 5 && s.coins >= 140);
  const before = JSON.stringify(s); assert.equal(C.claim(s, 'adv06', D).ok, false); assert.equal(JSON.stringify(s), before);
  const transfer = require('../public/js/ui/save-transfer.js'); assert.deepEqual(transfer.decode(transfer.encode(s, D), D), C.restoreState(s, D));
});

test('Malformed adventure save defaults safely and equipment only equips an owned known weapon', () => {
  const s = unlocked(); s.adventure = { proofs: ['rootBoss', '__proto__', 'missing', 'trail', 'trail'], checkpoint: 'missing', weapon: 'rootblade' };
  const restored = C.restoreState(s, D); assert.deepEqual(restored.adventure.proofs, ['trail']);
  assert.equal(restored.adventure.weapon, 'starter'); assert.equal(restored.adventure.checkpoint, null);
  assert.equal(A.equip(restored, 'rootblade', D), false); restored.inventory.rootblade = 1;
  assert.equal(A.equip(restored, 'rootblade', D), true); assert.equal(A.damage(restored), 3);
});

test('Restore rejects claimed adventure steps without their proofs and prunes dependent completion', () => {
  const s=unlocked();for(const id of D.adventure.mainIds){const q=D.quests.find(q=>q.id===id);s.quests[id]={status:'claimed',progress:q.objectives.map(o=>o.count)};}
  s.tracked='adv06';const restored=C.restoreState(s,D);
  assert.equal(restored.quests.adv01,undefined);assert.equal(restored.quests.adv06,undefined);assert.equal(restored.tracked,null);
});

test('Trail and rescue require exploration steps in order and retain partial progress on reload', () => {
  let s=unlocked();s.map='forest';
  const visit=id=>{const o=D.adventure.objects.find(o=>o.id===id);s.x=o.x;s.y=o.y;return A.interact(s,id,D);};
  visit('trail');assert.ok(!s.adventure.proofs.includes('trail'));
  visit('trail-2');s=C.restoreState(JSON.parse(JSON.stringify(s)),D);visit('trail-3');assert.ok(s.adventure.proofs.includes('trail'));
  C.recordProof(s,'training',D);assert.equal(A.beginRescue(s,D).ok,false,'Must approach survivor');
  visit('rescue');assert.equal(A.beginRescue(s,D).ok,true);
  assert.equal(visit('rescue-3').ok,false,'Cannot skip rope posts');
  visit('rescue-1');visit('rescue-2');assert.ok(!s.adventure.proofs.includes('rescue'));visit('rescue-3');assert.ok(s.adventure.proofs.includes('rescue'));
});

test('Puzzle drafts persist, validate exact arrangement and cannot grant a proof remotely', () => {
  let s=unlocked();for(const p of ['trail','training','rescue'])C.recordProof(s,p,D);s.map='forest';s.x=1080;s.y=520;
  for(const symbol of ['moon','leaf','star'])assert.equal(A.puzzleInput(s,'relic',symbol,D).ok,true);
  s=C.restoreState(JSON.parse(JSON.stringify(s)),D);assert.deepEqual(s.adventure.puzzles.relic,['moon','leaf','star']);
  s.x=200;assert.equal(A.solvePuzzle(s,'relic',D).ok,false);s.x=1080;
  assert.equal(A.solvePuzzle(s,'relic',D).ok,true);assert.equal(A.solvePuzzle(s,'relic',D).ok,false);
  s.x=800;s.y=350;for(let i=0;i<3;i++)A.puzzleInput(s,'root-light',String(i),D);
  assert.equal(A.solvePuzzle(s,'root-light',D).ok,false,'Two inscriptions must be investigated');
  s.adventure.milestones=['light-1','light-2'];s.adventure.puzzles['root-light']=['leaf','star','moon'];
  assert.equal(A.solvePuzzle(s,'root-light',D).ok,true);
});

test('Save sanitizes new adventure progress and field supplies never duplicate healing', () => {
  let s=unlocked();s.adventure.milestones=['trail-2','unknown','trail-2'];s.adventure.puzzles={relic:['moon','moon','bogus'],'root-light':['bogus']};s.adventure.loadout='unknown';s.adventure.supplies=999;
  s=C.restoreState(s,D);assert.deepEqual(s.adventure.milestones,['trail-2']);assert.deepEqual(s.adventure.puzzles.relic,[]);assert.equal(s.adventure.supplies,0);
  for(const p of ['trail','training','rescue','root-combat','root-light','shortcut'])C.recordProof(s,p,D);
  s.map='village';s.x=850;s.y=650;assert.equal(A.prepare(s,'healer',D).ok,true);s.health=10;
  assert.equal(A.useSupply(s).ok,true);assert.equal(s.health,55);assert.equal(s.adventure.supplies,1);
  A.useSupply(s);const before=JSON.stringify(s);assert.equal(A.useSupply(s).ok,false);assert.equal(JSON.stringify(s),before);
});

test('Malformed rope progress restores a playable prefix instead of stranding the survivor', () => {
  for(const milestones of [['rescue-route','rescue-3'],['rescue-route','rescue-1','rescue-2','rescue-3']]){
    let s=unlocked();for(const id of ['trail','training'])C.recordProof(s,id,D);s.adventure.milestones=milestones;s=C.restoreState(s,D);
    assert.ok(!s.adventure.milestones.includes('rescue-3'));
    for(const id of ['rescue-1','rescue-2','rescue-3'])if(!s.adventure.milestones.includes(id)){const o=D.adventure.objects.find(o=>o.id===id);s.map=o.map;s.x=o.x;s.y=o.y;assert.equal(A.interact(s,id,D).ok,true);}
    assert.ok(s.adventure.proofs.includes('rescue'));
  }
});
