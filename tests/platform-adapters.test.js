import assert from "node:assert/strict";
import test from "node:test";
import { createClock } from "../src/core/shared/clock.js";
import { createRandom } from "../src/core/shared/random.js";
import { createWebStorage } from "../src/platform/web/storage.js";

test("clock port delegates time and scheduling operations", () => {
  const calls = [];
  const clock = createClock({
    now: () => 42,
    setInterval: (callback, delay) => {
      calls.push(["setInterval", callback, delay]);
      return "interval";
    },
    clearInterval: (id) => calls.push(["clearInterval", id]),
    setTimeout: (callback, delay) => {
      calls.push(["setTimeout", callback, delay]);
      return "timeout";
    },
    clearTimeout: (id) => calls.push(["clearTimeout", id]),
  });

  const callback = () => {};
  assert.equal(clock.now(), 42);
  assert.equal(clock.setInterval(callback, 100), "interval");
  assert.equal(clock.setTimeout(callback, 200), "timeout");
  clock.clearInterval("interval");
  clock.clearTimeout("timeout");
  assert.deepEqual(calls.map(([name, ...args]) => [name, ...args.slice(1)]), [
    ["setInterval", 100],
    ["setTimeout", 200],
    ["clearInterval"],
    ["clearTimeout"],
  ]);
});

test("random port clamps invalid and out-of-range values", () => {
  const values = [-1, 0.25, 2, Number.NaN];
  const random = createRandom(() => values.shift());
  assert.equal(random(), 0);
  assert.equal(random(), 0.25);
  assert.equal(random(), 0.999999999);
  assert.equal(random(), 0);
});

test("Web storage adapter delegates to an injected storage", () => {
  const values = new Map();
  const backing = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const storage = createWebStorage(backing);

  assert.equal(storage.getItem("missing"), null);
  assert.equal(storage.setItem("score", 123), true);
  assert.equal(storage.getItem("score"), "123");
  assert.equal(storage.removeItem("score"), true);
  assert.equal(storage.getItem("score"), null);
});

test("Web storage adapter treats unavailable storage as best effort", () => {
  const storage = createWebStorage({
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  });

  assert.equal(storage.getItem("score"), null);
  assert.equal(storage.setItem("score", 1), false);
  assert.equal(storage.removeItem("score"), false);
});
