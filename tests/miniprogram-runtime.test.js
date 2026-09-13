import assert from "node:assert/strict";
import test from "node:test";
import { createMiniProgramRuntime } from "../src/adapters/miniprogram/runtime.js";
import { createGameRuntime } from "../src/application/game-runtime.js";

test("game runtime selects a session and dispatches actions", () => {
  const actions = [];
  const runtime = createGameRuntime({
    initialGame: "2048",
    games: {
      "2048": {
        getState: () => ({ score: 0 }),
        dispatch: (action) => {
          actions.push(action);
          return { score: 1 };
        },
      },
    },
  });

  assert.deepEqual(runtime.listGames(), ["2048"]);
  assert.equal(runtime.currentGame(), "2048");
  assert.deepEqual(runtime.getState(), { score: 0 });
  assert.deepEqual(runtime.dispatch({ type: "reset" }), {
    handled: true,
    game: "2048",
    result: { score: 1 },
    state: { score: 0 },
  });
  assert.deepEqual(actions, [{ type: "reset" }]);
});

test("game runtime keeps the current game for unknown selections", () => {
  const runtime = createGameRuntime({
    initialGame: "2048",
    games: { "2048": { getState: () => ({}) } },
  });

  assert.deepEqual(runtime.select("missing"), {
    ok: false,
    game: "2048",
    previous: "2048",
  });
  assert.equal(runtime.currentGame(), "2048");
});

test("game runtime invokes optional lifecycle hooks for all sessions", () => {
  const calls = [];
  const makeSession = (name) => ({
    getState: () => ({ name }),
    pause: () => calls.push(`${name}:pause`),
    resume: () => calls.push(`${name}:resume`),
  });
  const runtime = createGameRuntime({
    initialGame: "2048",
    games: {
      "2048": makeSession("2048"),
      sweep: makeSession("sweep"),
    },
  });

  runtime.pause();
  runtime.resume();
  assert.deepEqual(calls, ["2048:pause", "sweep:pause", "2048:resume", "sweep:resume"]);
});

test("Mini Program runtime registers view-model-backed game sessions", () => {
  const runtime = createMiniProgramRuntime({
    wxApi: {
      getStorageSync: () => "",
      setStorageSync: () => {},
      removeStorageSync: () => {},
    },
    rng: () => 0,
    timers: {
      setInterval: () => "interval",
      clearInterval: () => {},
      setTimeout: () => "timeout",
      clearTimeout: () => {},
    },
  });

  assert.deepEqual(runtime.listGames(), ["2048", "sweep", "sudoku", "lianliankan"]);
  assert.equal(runtime.currentGame(), "2048");
  assert.equal(runtime.getState().cells.length, 16);
  assert.equal(runtime.dispatch({ type: "reset" }).state.cells.length, 16);
  runtime.select("sudoku");
  assert.equal(runtime.getState().cells.length, 81);
  runtime.select("lianliankan");
  assert.equal(runtime.getState().cells.length, 80);
});

test("game runtime forwards session updates through view models", () => {
  const listeners = [];
  const runtime = createGameRuntime({
    initialGame: "sweep",
    games: {
      sweep: {
        getState: () => ({ timer: 0 }),
        subscribe: (listener) => {
          listeners.push(listener);
          return () => {};
        },
      },
    },
    viewModels: {
      sweep: (state) => ({ timer: state.timer + 1 }),
    },
  });
  const updates = [];

  runtime.subscribe((update) => updates.push(update));
  listeners[0]({ timer: 2 });

  assert.deepEqual(updates, [{ game: "sweep", state: { timer: 3 } }]);
});
