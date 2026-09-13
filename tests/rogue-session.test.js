import test from "node:test";
import assert from "node:assert/strict";
import { createRogueSession } from "../src/application/games/rogue-session.js";
import { toRogueViewModel } from "../src/adapters/miniprogram/view-models/rogue.js";

function makeClock() {
  return {
    now: () => 0,
    setInterval: () => "timer",
    clearInterval: () => {},
    setTimeout: (callback) => {
      callback();
      return "timeout";
    },
    clearTimeout: () => {},
  };
}

test("Rogue session requires a contract before revealing and exposes serializable tactical view data", () => {
  const session = createRogueSession({ rng: () => 0, clock: makeClock() });
  const before = session.getState();
  assert.equal(before.status, "ready");
  assert.ok(before.contractOptions.length >= 2);
  assert.equal(session.dispatch({ type: "reveal", row: 0, col: 0 }).result, "invalid");

  session.dispatch({ type: "select-contract", contractId: before.contractOptions[0].id });
  const started = session.dispatch({ type: "reveal", row: 0, col: 0 }).state;
  assert.equal(started.status, "playing");
  assert.equal(started.level.started, true);

  const view = toRogueViewModel(started);
  assert.equal(view.cells.length, started.level.rows * started.level.cols);
  assert.ok(view.contract);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
});

test("Rogue session maps mark, tool, and cancel actions without implementing rules in the adapter", () => {
  const session = createRogueSession({ rng: () => 0.25, clock: makeClock() });
  const initial = session.getState();
  session.dispatch({ type: "select-contract", contractId: initial.contractOptions[0].id });
  session.dispatch({ type: "reveal", row: 0, col: 0 });
  const state = session.getState();
  const hidden = state.level.board.flat().findIndex((cell) => !cell.revealed && !cell.mine);
  const hiddenRow = Math.floor(hidden / state.level.cols);
  const hiddenCol = hidden % state.level.cols;
  session.dispatch({ type: "mark", row: hiddenRow, col: hiddenCol });
  assert.equal(session.getState().level.board[hiddenRow][hiddenCol].flagged, true);

  const tool = session.dispatch({ type: "select-tool", toolKey: "scoutPulse" });
  assert.equal(tool.handled, true);
  assert.equal(session.getState().selectedTool, "scoutPulse");
  session.dispatch({ type: "cancel-tool" });
  assert.equal(session.getState().selectedTool, null);
});

test("Rogue session pauses and resumes page lifecycle without changing the core run state", () => {
  const session = createRogueSession({ rng: () => 0, clock: makeClock() });
  const initial = session.getState();
  session.dispatch({ type: "select-contract", contractId: initial.contractOptions[0].id });
  session.dispatch({ type: "reveal", row: 0, col: 0 });
  session.pause();
  assert.equal(session.getState().paused, true);
  session.dispatch({ type: "reveal", row: 1, col: 1 });
  assert.equal(session.getState().paused, true);
  session.resume();
  assert.equal(session.getState().paused, false);
});
