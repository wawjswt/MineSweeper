import { createClock } from "../../core/shared/clock.js";

function readNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function createWebClock() {
  return createClock({
    now: readNow,
    setInterval: (...args) => globalThis.setInterval(...args),
    clearInterval: (...args) => globalThis.clearInterval(...args),
    setTimeout: (...args) => globalThis.setTimeout(...args),
    clearTimeout: (...args) => globalThis.clearTimeout(...args),
  });
}
