import assert from "node:assert/strict";
import test from "node:test";
import { create2048Session } from "../src/application/games/2048-session.js";
import { to2048ViewModel } from "../src/adapters/miniprogram/view-models/2048.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("2048 session dispatches moves and persists the best score", () => {
  const session = create2048Session({
    storage: createStorage(),
    initialBoard: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    rng: () => 0,
  });

  const result = session.dispatch({ type: "move", direction: "left" });
  const state = session.getState();

  assert.equal(result.state.score, 4);
  assert.equal(state.score, 4);
  assert.equal(state.bestScore, 4);
  assert.equal(state.board[0], 4);
  assert.equal(state.moves, 1);
});

test("2048 session handles reset and continue actions", () => {
  const session = create2048Session({
    storage: createStorage(),
    initialBoard: [2048, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    rng: () => 0,
  });

  assert.equal(session.getState().status, "won");
  assert.equal(session.dispatch({ type: "continue" }).state.status, "playing");
  assert.equal(session.dispatch({ type: "reset" }).state.status, "won");
});

test("2048 view model exposes a serializable 4x4 cell list", () => {
  const view = to2048ViewModel({
    board: [2, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    score: 6,
    bestScore: 8,
    status: "playing",
    won: false,
    continued: false,
    moves: 2,
    lastMove: null,
  });

  assert.equal(view.cells.length, 16);
  assert.deepEqual(view.cells[0], { index: 0, row: 0, column: 0, value: 2 });
  assert.deepEqual(view.cells[2], { index: 2, row: 0, column: 2, value: 4 });
  assert.deepEqual(view.score, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
});
