(function (root, factory) {
  'use strict';
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.StardropCombatData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Thông số dùng chung cho mô phỏng Node và bản Canvas; không chứa trạng thái trận đấu.
  const enemies = {
    slime: { name: 'Tinh linh Rì Rào', color: '#8fbd8c', maxHp: 3, speed: 38, detectRange: 300, range: 155, windup: .6, active: .3, recovery: .9, damage: 8, chargeSpeed: 230, style: 'charge' },
    sprout: { name: 'Mầm gai Sao', color: '#b88cbd', maxHp: 5, speed: 24, detectRange: 440, range: 360, windup: .6, active: .1, recovery: 1.3, damage: 10, projectileSpeed: 220, style: 'projectile' },
    warden: { name: 'Hộ vệ rễ cây', color: '#a68c65', maxHp: 8, speed: 28, detectRange: 300, range: 90, windup: .8, active: .18, recovery: 1.2, damage: 14, arc: 140, style: 'heavy' },
    rootBoss: { name: 'Hộ Vệ Rễ Sao', boss:true, pattern:['sweep','charge'], color: '#c79068', maxHp: 90, speed: 30, detectRange: 500, range: 120, windup: .75, active: .22, recovery: .65, damage: 16, arc: 200, chargeSpeed: 285, style: 'sweep' },
    forestBoss:{name:'Hộ Vệ Rêu Cổ',boss:true,pattern:['heavy','charge'],color:'#79946c',maxHp:48,speed:46,detectRange:900,range:100,windup:.8,active:.2,recovery:.9,damage:13,arc:150,chargeSpeed:260,style:'heavy',vulnerableDuration:2},
    tideBoss:{name:'Hộ Vệ Sóng Ngầm',boss:true,pattern:['projectile','charge','sweep'],color:'#6e9ca4',maxHp:72,speed:42,detectRange:900,range:135,windup:.8,active:.22,recovery:.8,damage:15,arc:180,chargeSpeed:290,style:'projectile',projectileSpeed:220,projectileCount:3,projectileSpread:.28,vulnerableDuration:2.1},
    skyBoss:{name:'Hộ Vệ Thiên Thạch',boss:true,pattern:['sweep','projectile','charge'],color:'#a38cb6',maxHp:100,speed:46,detectRange:900,range:140,windup:.85,active:.24,recovery:.7,damage:18,arc:220,chargeSpeed:315,style:'sweep',projectileSpeed:250,projectileCount:5,projectileSpread:.25,vulnerableDuration:2.2}
  };
  Object.values(enemies).forEach(Object.freeze);
  return Object.freeze({
    fixedStep: 1 / 60, maxSteps: 5,
    attack: Object.freeze({ range: 78, arc: 100, windup: .1, active: .12, recovery: .18, stamina: 2 }),
    dodge: Object.freeze({ duration: .22, speed: 360, invulnerable: .16, cooldown: .8, stamina: 10 }),
    regen: Object.freeze({ delay: .8, rate: 6 }), enemies: Object.freeze(enemies)
  });
});
