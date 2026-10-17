'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Tutorial = require('../public/js/onboarding.js');

test('tutorial opens explicitly, advances four pages and only completes on the final action', () => {
  const tutorial = Tutorial.create();
  assert.deepEqual(tutorial.state(), {open:false,index:0,completed:false,mobile:false});
  assert.equal(tutorial.next().completed, false);
  tutorial.start();
  assert.equal(tutorial.previous().index, 0);
  for (let index = 0; index < Tutorial.count; index++) {
    assert.equal(tutorial.current().index, index);
    assert.equal(tutorial.state().open, true);
    assert.equal(tutorial.state().completed, false);
    tutorial.next();
  }
  assert.deepEqual(tutorial.state(), {open:false,index:3,completed:true,mobile:false});
  assert.equal(tutorial.previous().index, 3);
});

test('explicit skip completes, and completed players can replay without changing progress', () => {
  const tutorial = Tutorial.create({mobile:true});
  assert.equal(tutorial.finish().completed, false);
  tutorial.start(); tutorial.next();
  assert.equal(tutorial.finish().completed, true);
  assert.equal(tutorial.state().open, false);
  assert.equal(tutorial.start().index, 0);
  assert.equal(tutorial.state().completed, true);
  tutorial.next(); tutorial.next();
  assert.equal(tutorial.previous().index, 1);
  const snapshot = tutorial.state(); snapshot.index = 99; snapshot.completed = false;
  assert.equal(tutorial.state().index, 1);
  assert.equal(tutorial.state().completed, true);
});

test('mobile and desktop give the actual controls and all pages stay concise', () => {
  assert.match(Tutorial.step(0, true).body, /Xoay ngang.*joystick/s);
  assert.match(Tutorial.step(0, true).body, /Nhả tay để dừng/);
  assert.doesNotMatch(Tutorial.step(0, true).body, /phím mũi tên/);
  assert.match(Tutorial.step(0).body, /WASD.*Shift.*E.*Space/s);
  assert.match(Tutorial.step(1).body, /Đêm Hội Sao.*ba chặng.*Mira.*Cốt truyện tự nối.*Nhận việc cư dân.*trước.*Theo dõi.*Nhận thưởng/s);
  assert.match(Tutorial.step(2).body, /thể lực.*ghế.*giếng.*Túi &amp; chế tạo.*Xây làng/s);
  assert.match(Tutorial.step(3).body, /Minimap.*thông tin riêng tư.*tự lưu.*trình duyệt này/s);
  assert.match(Tutorial.step(3).body, /Chấm trắng là bạn; hình thoi vàng là mục tiêu/);
  for (const mobile of [false,true]) for (let index = 0; index < Tutorial.count; index++) {
    const page = Tutorial.step(index, mobile);
    const text = `${page.title} ${page.subtitle} ${page.body.replace(/<[^>]*>/g, ' ')}`;
    assert.ok(text.trim().split(/\s+/).length <= 120, `${index} exceeds 120 words`);
  }
});

test('dialog navigation is accessible and has one finish action with bounded indexes', () => {
  for (let index = 0; index < Tutorial.count; index++) {
    const html = Tutorial.render(index);
    assert.match(html, new RegExp(`aria-label="Bước ${index+1} trên 4"`));
    assert.equal((html.match(/data-tutorial-next/g) || []).length, 1);
    assert.equal((html.match(/data-tutorial-skip/g) || []).length, 1);
    assert.equal(html.includes('data-tutorial-prev'), index > 0);
    assert.equal(html.includes('Bắt đầu chơi'), index === 3);
    assert.doesNotMatch(html, /<(?:script|iframe)|onclick=|javascript:/i);
  }
  for (const index of [undefined,null,NaN,Infinity,-Infinity,'<img src=x onerror=alert(1)>',Symbol('index'),{},-10]) {
    assert.equal(Tutorial.step(index).index, 0);
    assert.equal(Tutorial.render(index), Tutorial.render(0));
  }
  assert.equal(Tutorial.step(1.8).index, 1);
  assert.equal(Tutorial.step(99).index, 3);
});

test('browser module has no DOM, storage, network or save side effects', () => {
  const sandbox = {};
  for (const key of ['document','localStorage','sessionStorage','fetch','WebSocket']) {
    Object.defineProperty(sandbox, key, {get(){throw new Error(`Unexpected ${key} access`);}});
  }
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/onboarding.js'), 'utf8'), sandbox);
  const tutorial = sandbox.StardropOnboarding.create({completed:true,mobile:true});
  tutorial.start(); tutorial.next(); tutorial.previous(); tutorial.render(); tutorial.finish();
  assert.equal(tutorial.state().completed, true);
  assert.equal(sandbox.StardropOnboarding.count, 4);
});
