import assert from "node:assert/strict";
import test from "node:test";
import { createMinesweeperSession } from "../src/application/games/minesweeper-session.js";
import { toMinesweeperViewModel } from "../src/adapters/miniprogram/view-models/minesweeper.js";

function createFakeClock() {
  let now = 0;
  let callback = null;
  return {
    now: () => now,
    setInterval: (next) => {
      callback = next;
      return "timer";
    },
    clearInterval: () => {
      callback = null;
    },
    setTimeout: () => "timeout",
    clearTimeout: () => {},
    advance(milliseconds) {
      now += milliseconds;
      callback?.();
    },
  };
}

test("Minesweeper session keeps first reveal safe and exposes a board view", () => {
  const session = createMinesweeperSession({
    difficultySpec: { rows: 5, cols: 5, mines: 3 },
    modeKey: "classic",
    rng: () => 0.25,
    clock: createFakeClock(),
  });

  const result = session.dispatch({ type: "reveal", row: 2, col: 2 });
  const state = session.getState();
  const view = toMinesweeperViewModel(state);

  assert.equal(result.handled, true);
  assert.equal(state.started, true);
  assert.equal(state.board[2][2].mine, false);
  assert.equal(view.rows, 5);
  assert.equal(view.cols, 5);
  assert.equal(view.cells.length, 25);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
});

test("Minesweeper session cycles mark state and rejects invalid actions", () => {
  const session = createMinesweeperSession({
    difficultySpec: { rows: 5, cols: 5, mines: 3 },
    modeKey: "classic",
    rng: () => 0.25,
    clock: createFakeClock(),
  });

  session.dispatch({ type: "mark", row: 0, col: 0 });
  assert.equal(session.getState().board[0][0].flagged, true);
  session.dispatch({ type: "mark", row: 0, col: 0 });
  assert.equal(session.getState().board[0][0].questioned, true);
  session.dispatch({ type: "mark", row: 0, col: 0 });
  assert.equal(session.getState().board[0][0].questioned, false);
  assert.equal(session.dispatch({ type: "unknown" }).handled, false);
});

test("Minesweeper session updates timer through the injected clock", () => {
  const clock = createFakeClock();
  const session = createMinesweeperSession({
    difficultySpec: { rows: 5, cols: 5, mines: 3 },
    modeKey: "classic",
    rng: () => 0.25,
    clock,
  });

  session.dispatch({ type: "reveal", row: 2, col: 2 });
  clock.advance(1200);
  assert.equal(session.getState().timer, 1.2);
});
