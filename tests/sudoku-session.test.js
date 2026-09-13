import test from "node:test";
import assert from "node:assert/strict";
import { createSudokuSession } from "../src/application/games/sudoku-session.js";
import { toSudokuViewModel } from "../src/adapters/miniprogram/view-models/sudoku.js";
import { DIFFICULTIES, serializeSave } from "../src/core/games/sudoku/engine.js";

function makeClock() {
  let current = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    clock: {
      now: () => current,
      setInterval: (callback, delay) => {
        const id = nextId++;
        timers.set(id, { callback, delay });
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
      for (const timer of timers.values()) timer.callback();
    },
    timerCount() {
      return timers.size;
    },
  };
}

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, String(value));
      return true;
    },
    removeItem: (key) => values.delete(key),
    values,
  };
}

function seededRng() {
  let seed = 17;
  return () => {
    seed = (seed * 73 + 41) % 997;
    return seed / 997;
  };
}

const SOLUTION = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

function makeSavedPuzzle() {
  const puzzle = SOLUTION.slice();
  puzzle[0] = 0;
  puzzle[10] = 0;
  return serializeSave({
    difficulty: "easy",
    puzzle,
    solution: SOLUTION,
    values: puzzle,
    notes: new Array(81).fill(0),
    elapsedMs: 0,
    started: false,
    ended: false,
    paused: false,
  });
}

test("Sudoku session generates a serializable board and protects given cells", () => {
  const { clock } = makeClock();
  const session = createSudokuSession({ difficulty: "easy", rng: seededRng(), clock, storage: makeStorage() });
  const state = session.getState();
  assert.equal(state.values.length, 81);
  assert.equal(state.given.length, 81);
  assert.equal(state.solution.length, 81);
  assert.equal(state.generating, false);
  assert.equal(JSON.parse(JSON.stringify(state)).values.length, 81);

  const givenIndex = state.given.findIndex(Boolean);
  session.dispatch({ type: "select", index: givenIndex });
  const before = session.getState().values.slice();
  session.dispatch({ type: "input", digit: 9 });
  assert.deepEqual(session.getState().values, before);
  assert.match(session.getState().notice, /不可修改/);
});

test("Sudoku session supports notes, undo, redo, wrong-input feedback, and hints", () => {
  const clock = makeClock();
  const storage = makeStorage({ "sudoku-classic-easy-v1": makeSavedPuzzle() });
  const session = createSudokuSession({ difficulty: "easy", rng: seededRng(), clock: clock.clock, storage });

  session.dispatch({ type: "select", index: 0 });
  session.dispatch({ type: "toggle-note" });
  session.dispatch({ type: "input", digit: 5 });
  assert.equal(session.getState().notes[0] & (1 << 4), 1 << 4);
  session.dispatch({ type: "toggle-note" });
  session.dispatch({ type: "input", digit: 9 });
  assert.equal(session.getState().values[0], 9);
  assert.equal(session.getState().errors, 1);
  assert.equal(session.getState().notice, "当前输入与答案不符");

  session.dispatch({ type: "undo" });
  assert.equal(session.getState().values[0], 0);
  session.dispatch({ type: "redo" });
  assert.equal(session.getState().values[0], 9);
  session.dispatch({ type: "undo" });

  session.dispatch({ type: "select", index: 0 });
  const hintResult = session.dispatch({ type: "hint" });
  assert.equal(hintResult.handled, true);
  assert.equal(session.getState().hint.index, 0);
  assert.equal(session.getState().values[0], 0);

  const view = toSudokuViewModel(session.getState());
  assert.equal(view.cells.length, 81);
  assert.equal(view.cells[0].hintTarget, true);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
});

test("Sudoku session persists progress and pauses/resumes its injected timer", () => {
  const timer = makeClock();
  const storage = makeStorage({ "sudoku-classic-easy-v1": makeSavedPuzzle() });
  const session = createSudokuSession({ difficulty: "easy", rng: seededRng(), clock: timer.clock, storage });
  session.dispatch({ type: "select", index: 0 });
  session.dispatch({ type: "input", digit: 5 });
  assert.equal(timer.timerCount(), 1);
  timer.advance(2500);
  assert.equal(session.getState().elapsedMs, 2500);

  session.dispatch({ type: "pause" });
  assert.equal(session.getState().paused, true);
  assert.equal(timer.timerCount(), 0);
  const saved = storage.values.get("sudoku-classic-easy-v1");
  assert.equal(typeof saved, "string");

  const restored = createSudokuSession({ difficulty: "easy", rng: seededRng(), clock: timer.clock, storage });
  assert.equal(restored.getState().values[0], 5);
  restored.dispatch({ type: "resume" });
  assert.equal(restored.getState().paused, false);
  assert.equal(timer.timerCount(), 1);
  assert.equal(DIFFICULTIES.easy.blanks, 36);
});
