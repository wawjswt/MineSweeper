import assert from "node:assert/strict";
import test from "node:test";
import { createWechatClock } from "../src/platform/wechat/clock.js";
import { createWechatRandom } from "../src/platform/wechat/random.js";
import { createWechatStorage } from "../src/platform/wechat/storage.js";

test("Wechat storage delegates to sync APIs", () => {
  const values = new Map();
  const wxApi = {
    getStorageSync: (key) => values.get(key) ?? "",
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: (key) => values.delete(key),
  };
  const storage = createWechatStorage(wxApi);

  assert.equal(storage.setItem("score", 12), true);
  assert.equal(storage.getItem("score"), "12");
  assert.equal(storage.removeItem("score"), true);
  assert.equal(storage.getItem("score"), null);
});

test("Wechat storage treats unavailable APIs as best effort", () => {
  const storage = createWechatStorage({
    getStorageSync: () => { throw new Error("blocked"); },
    setStorageSync: () => { throw new Error("blocked"); },
    removeStorageSync: () => { throw new Error("blocked"); },
  });

  assert.equal(storage.getItem("score"), null);
  assert.equal(storage.setItem("score", 1), false);
  assert.equal(storage.removeItem("score"), false);
});

test("Wechat clock delegates time and timer operations", () => {
  const calls = [];
  const callback = () => {};
  const timers = {
    setInterval(fn, delay) {
      calls.push(["setInterval", fn, delay]);
      return "interval";
    },
    clearInterval(id) {
      calls.push(["clearInterval", id]);
    },
    setTimeout(fn, delay) {
      calls.push(["setTimeout", fn, delay]);
      return "timeout";
    },
    clearTimeout(id) {
      calls.push(["clearTimeout", id]);
    },
  };
  const clock = createWechatClock({ now: () => 42, timers });

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

test("Wechat random uses the shared clamped random port", () => {
  const values = [-1, 0.25, 2, Number.NaN];
  const random = createWechatRandom(() => values.shift());

  assert.equal(random(), 0);
  assert.equal(random(), 0.25);
  assert.equal(random(), 0.999999999);
  assert.equal(random(), 0);
});
