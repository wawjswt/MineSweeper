import { createClock } from "../../core/shared/clock.js";

function getDefaultTimers() {
  return {
    setInterval: (...args) => globalThis.setInterval(...args),
    clearInterval: (...args) => globalThis.clearInterval(...args),
    setTimeout: (...args) => globalThis.setTimeout(...args),
    clearTimeout: (...args) => globalThis.clearTimeout(...args),
  };
}

export function createWechatClock({ now = () => Date.now(), timers = getDefaultTimers() } = {}) {
  return createClock({
    now,
    setInterval: (...args) => timers.setInterval(...args),
    clearInterval: (...args) => timers.clearInterval(...args),
    setTimeout: (...args) => timers.setTimeout(...args),
    clearTimeout: (...args) => timers.clearTimeout(...args),
  });
}
