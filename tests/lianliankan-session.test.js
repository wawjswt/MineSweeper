import test from "node:test";
import assert from "node:assert/strict";
import { createLianliankanSession } from "../src/application/games/lianliankan-session.js";
import { toLianliankanViewModel } from "../src/adapters/miniprogram/view-models/lianliankan.js";
import { findAnyPair } from "../src/core/games/lianliankan/engine.js";

function makeClock() {
  let current = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    clock: {
      now: () => current,
      setInterval: (callback) => {
        const id = nextId++;
        timers.set(id, callback);
        return id;
      },
      clearInterval: (id) => timers.delete(id),
      setTimeout: (callback) => {
        callback();
        return nextId++;
      },
      clearTimeout: () => {},
    },
    advance(ms) {
      current += ms;
      for (const callback of timers.values()) callback();
    },
    timerCount() {
      return timers.size;
    },
  };
}

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

test("classic Link-Link removes a valid pair and exposes a serializable view", () => {
  const timer = makeClock();
  const session = createLianliankanSession({ mode: "classic", difficulty: "easy", rng: () => 0, clock: timer.clock });
  const before = session.getState();
  assert.equal(before.grid[0], 1);
  assert.equal(before.grid[1], 1);

  session.dispatch({ type: "select", index: 0 });
  session.dispatch({ type: "select", index: 1 });
  const after = session.getState();
  assert.equal(after.grid[0], 0);
  assert.equal(after.grid[1], 0);
  assert.equal(after.selectedIndex, null);
  assert.equal(after.remaining, before.remaining - 2);
  assert.equal(after.started, true);

  const view = toLianliankanViewModel(after);
  assert.equal(view.cells.length, before.rows * before.cols);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
});

test("Link-Link reports failed pairs and keeps a guaranteed move after reshuffle", () => {
  const timer = makeClock();
  const session = createLianliankanSession({ mode: "classic", difficulty: "easy", rng: () => 0.37, clock: timer.clock });
  const state = session.getState();
  const first = state.grid.findIndex((value) => value > 0);
  const second = state.grid.findIndex((value, index) => index > first && value > 0 && value !== state.grid[first]);
  session.dispatch({ type: "select", index: first });
  session.dispatch({ type: "select", index: second });
  assert.match(session.getState().notice, /图案不一致|无法连接/);

  session.dispatch({ type: "reshuffle" });
  const reshuffled = session.getState();
  assert.ok(findAnyPair(reshuffled.grid, reshuffled.rows, reshuffled.cols));
  assert.equal(reshuffled.remaining, state.remaining);
});

test("Link-Link challenge consumes a hint and level completion records progress", () => {
  const timer = makeClock();
  const storage = makeStorage();
  const challenge = createLianliankanSession({ mode: "challenge", levelId: 1, clock: timer.clock, storage, rng: () => 0 });
  const hint = challenge.dispatch({ type: "hint" });
  assert.equal(hint.handled, true);
  assert.equal(challenge.getState().challenge.hintsRemaining, 0);
  assert.ok(challenge.getState().hint);

  const classic = createLianliankanSession({ mode: "classic", difficulty: "easy", clock: timer.clock, rng: () => 0 });
  const state = classic.getState();
  for (let index = 0; index < state.grid.length; index++) {
    if (state.grid[index] > 0) {
      const pair = state.grid.findIndex((value, other) => other > index && value === state.grid[index]);
      if (pair >= 0) {
        classic.dispatch({ type: "select", index });
        classic.dispatch({ type: "select", index: pair });
      }
    }
  }
  assert.ok(classic.getState().remaining < state.remaining);
});

test("Link-Link session pauses and resumes its injected timer", () => {
  const timer = makeClock();
  const session = createLianliankanSession({ mode: "classic", difficulty: "easy", clock: timer.clock, rng: () => 0 });
  session.dispatch({ type: "select", index: 0 });
  assert.equal(timer.timerCount(), 1);
  timer.advance(1500);
  assert.equal(session.getState().elapsedMs, 1500);
  session.dispatch({ type: "pause" });
  assert.equal(session.getState().paused, true);
  assert.equal(timer.timerCount(), 0);
  session.dispatch({ type: "resume" });
  assert.equal(session.getState().paused, false);
  assert.equal(timer.timerCount(), 1);
});
