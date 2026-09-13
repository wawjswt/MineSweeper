export function clampRandom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(0.999999999, Math.max(0, number));
}

export function createRandom(rng = Math.random) {
  if (typeof rng !== "function") throw new TypeError("rng must be a function");
  return () => clampRandom(rng());
}
