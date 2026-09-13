function requireFunction(name, value) {
  if (typeof value !== "function") {
    throw new TypeError(`clock.${name} must be a function`);
  }
  return value;
}

export function createClock({ now, setInterval, clearInterval, setTimeout, clearTimeout } = {}) {
  return Object.freeze({
    now: requireFunction("now", now),
    setInterval: requireFunction("setInterval", setInterval),
    clearInterval: requireFunction("clearInterval", clearInterval),
    setTimeout: requireFunction("setTimeout", setTimeout),
    clearTimeout: requireFunction("clearTimeout", clearTimeout),
  });
}
