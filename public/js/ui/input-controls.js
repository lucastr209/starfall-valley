(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropControls = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function directionFor(dx, dy, current = 'down') {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return current;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  function syncRunControl(options = {}) {
    const { runButton, moveModeElement, touchRun, playerRunning, wantsRun } = options;
    const pressed = String(touchRun);
    const buttonText = touchRun ? 'Đang chạy' : 'Chạy';
    const modeText = playerRunning ? 'Chạy' : (wantsRun ? 'Sẵn sàng chạy' : 'Đi bộ');
    if (runButton) {
      if (runButton.getAttribute?.('aria-pressed') !== pressed) runButton.setAttribute('aria-pressed', pressed);
      if (runButton.textContent !== buttonText) runButton.textContent = buttonText;
    }
    if (moveModeElement && moveModeElement.textContent !== modeText) {
      moveModeElement.textContent = modeText;
    }
  }

  function createInputManager() {
    const keys = new Set();
    const touchKeys = new Set();
    const touchPointers = new Map();
    let touchRun = false;
    let joystickPointer = null;
    let joystickX = 0;
    let joystickY = 0;

    const wantsRun = () => keys.has('shift') || touchRun;

    function syncTouchKeys() {
      touchKeys.clear();
      touchPointers.forEach(p => {
        if (p.button?.dataset?.move) touchKeys.add(p.button.dataset.move);
      });
    }

    function releaseTouch(e, button) {
      const id = e?.pointerId ?? button;
      const held = touchPointers.get(id);
      if (!held || (button && held.button !== button)) return;
      touchPointers.delete(id);
      syncTouchKeys();
      try {
        if (held.button?.hasPointerCapture?.(id)) held.button.releasePointerCapture(id);
      } catch (_) {}
    }

    return {
      keys,
      touchKeys,
      touchPointers,
      get touchRun() { return touchRun; },
      set touchRun(v) { touchRun = !!v; },
      get joystickPointer() { return joystickPointer; },
      set joystickPointer(v) { joystickPointer = v; },
      get joystickX() { return joystickX; },
      set joystickX(v) { joystickX = v; },
      get joystickY() { return joystickY; },
      set joystickY(v) { joystickY = v; },
      wantsRun,
      syncTouchKeys,
      releaseTouch
    };
  }

  return {
    directionFor,
    syncRunControl,
    createInputManager
  };
});
