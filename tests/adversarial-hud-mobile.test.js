'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

describe('Adversarial HUD, Mobile Controls & WCAG Contrast Test Suite', () => {
  it('executes tests/adversarial-hud-mobile.cjs with 100% pass verdict', () => {
    const scriptPath = path.join(__dirname, 'adversarial-hud-mobile.cjs');
    const output = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });

    assert.ok(
      output.includes('VERDICT: APPROVE — ALL ADVERSARIAL EMPIRICAL TESTS PASSED'),
      'Adversarial script must produce an APPROVE verdict'
    );
    assert.ok(
      output.includes('All 33 interactive selectors possess explicit min dimensions >= 44px'),
      'Touch target invariant must be verified'
    );
    assert.ok(
      output.includes('Left Side Clearance (Actionbar bottom -> Joystick top)'),
      'Mobile landscape clearance must be verified'
    );
    assert.ok(
      output.includes('Static listener verifies clearMovement() and ticket guard'),
      'Fullscreen hygiene must be verified'
    );
  });
});
