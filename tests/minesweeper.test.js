import assert from "node:assert/strict";
import test from "node:test";
import { generateClassicBoard } from "../src/minesweeper-generator.js";
import { analyzePosition } from "../src/minesweeper-solver.js";
import { createGameLogic } from "../src/game.js";
import { makeState } from "../src/state.js";
import { buildCellAriaLabel, nextMarkMode } from "../src/ui.js";

function cell({ revealed = false, flagged = false, questioned = false, count = 0, mine = false } = {}) {
  return { revealed, flagged, questioned, count, mine };
}

function countMines(board) {
  return board.flat().filter((item) => item.mine).length;
}

function constantRng(value = 0.25) {
  return () => value;
}

test("standard generation places the requested mines outside the safe first-click neighborhood", () => {
  const result = generateClassicBoard({
    rows: 9,
    cols: 9,
    mines: 10,
    safeRow: 4,
    safeCol: 4,
    rng: constantRng(),
    generationMode: "standard",
  });

  assert.equal(result.generationMode, "standard");
  assert.equal(result.fallback, false);
  assert.equal(countMines(result.board), 10);
  for (let row = 3; row <= 5; row++) {
    for (let col = 3; col <= 5; col++) {
      assert.equal(result.board[row][col].mine, false);
    }
  }
});

test("no-guess generation can produce a board solvable by deterministic deductions", () => {
  const result = generateClassicBoard({
    rows: 5,
    cols: 5,
    mines: 1,
    safeRow: 2,
    safeCol: 2,
    rng: constantRng(0.1),
    generationMode: "no-guess",
  });

  assert.equal(result.generationMode, "no-guess");
  assert.equal(result.fallback, false);
  assert.equal(countMines(result.board), 1);
});

test("no-guess generation falls back to a standard board after the attempt limit", () => {
  const result = generateClassicBoard({
    rows: 9,
    cols: 9,
    mines: 10,
    safeRow: 4,
    safeCol: 4,
    rng: constantRng(),
    generationMode: "no-guess",
    maxAttempts: 0,
  });

  assert.equal(result.generationMode, "standard");
  assert.equal(result.fallback, true);
  assert.equal(countMines(result.board), 10);
});

test("hint analysis identifies a safe cell when a clue's mine quota is already satisfied", () => {
  const board = [
    [cell({ revealed: true, count: 1 }), cell({ flagged: true }), cell()],
    [cell({ revealed: true, count: 1 }), cell(), cell()],
  ];

  const result = analyzePosition({ board, rows: 2, cols: 3, totalMines: 1 });

  assert.equal(result.kind, "safe");
  assert.deepEqual(result.target, [1, 1]);
  assert.match(result.message, /确定安全/);
});

test("hint analysis identifies a mine when all remaining unknown cells must contain mines", () => {
  const board = [
    [cell({ revealed: true, count: 1 }), cell()],
  ];

  const result = analyzePosition({ board, rows: 1, cols: 2, totalMines: 1 });

  assert.equal(result.kind, "mine");
  assert.deepEqual(result.target, [0, 1]);
  assert.match(result.message, /确定为雷/);
});

test("hint analysis uses subset deductions", () => {
  const board = [
    [cell({ revealed: true, count: 1 }), cell({ revealed: true, count: 1 }), cell()],
    [cell(), cell(), cell()],
  ];

  const result = analyzePosition({ board, rows: 2, cols: 3, totalMines: 1 });

  assert.equal(result.kind, "safe");
  assert.deepEqual(result.target, [0, 2]);
});

test("hint analysis reports no certain move instead of guessing", () => {
  const board = [[cell(), cell({ revealed: true, count: 1 }), cell()]];

  const result = analyzePosition({ board, rows: 1, cols: 3, totalMines: 1 });

  assert.equal(result.kind, "none");
  assert.equal(result.target, null);
  assert.match(result.message, /没有确定/);
});

test("hint analysis reports contradictory flags", () => {
  const board = [[cell({ revealed: true, count: 0 }), cell({ flagged: true })]];

  const result = analyzePosition({ board, rows: 1, cols: 2, totalMines: 1 });

  assert.equal(result.kind, "inconsistent");
  assert.equal(result.target, null);
  assert.match(result.message, /矛盾/);
});

test("game logic keeps the first click and its neighborhood safe", () => {
  const state = makeState("easy", "classic");
  const game = createGameLogic({
    getState: () => state,
    getDifficultySpec: () => ({ rows: state.rows, cols: state.cols, mines: state.mines }),
    getGenerationMode: () => "standard",
    rng: constantRng(0.2),
  });

  game.reveal(0, 0, () => {});

  assert.equal(state.started, true);
  for (let row = 0; row <= 1; row++) {
    for (let col = 0; col <= 1; col++) assert.equal(state.board[row][col].mine, false);
  }
  assert.equal(countMines(state.board), state.mines);
  game.resetTimer();
});

test("game logic uses the injected clock for its timer", () => {
  const state = makeState("easy", "classic");
  const calls = [];
  const clock = {
    now: () => 1000,
    setInterval: (callback, delay) => {
      calls.push(["setInterval", callback, delay]);
      return "fake-interval";
    },
    clearInterval: (id) => calls.push(["clearInterval", id]),
    setTimeout: () => "fake-timeout",
    clearTimeout: () => {},
  };
  const game = createGameLogic({
    getState: () => state,
    getDifficultySpec: () => ({ rows: state.rows, cols: state.cols, mines: state.mines }),
    getGenerationMode: () => "standard",
    clock,
    rng: constantRng(0.2),
  });

  game.reveal(0, 0, () => {});
  game.resetTimer();

  assert.equal(calls[0][0], "setInterval");
  assert.equal(calls[0][2], 100);
  assert.deepEqual(calls[1], ["clearInterval", "fake-interval"]);
});

test("game logic cycles a hidden cell through flag, question, and clear", () => {
  const state = makeState("easy", "classic");
  const game = createGameLogic({
    getState: () => state,
    getDifficultySpec: () => ({ rows: state.rows, cols: state.cols, mines: state.mines }),
    getGenerationMode: () => "standard",
  });

  game.cycleMark(2, 2);
  assert.equal(state.board[2][2].flagged, true);
  game.cycleMark(2, 2);
  assert.equal(state.board[2][2].questioned, true);
  game.cycleMark(2, 2);
  assert.equal(state.board[2][2].flagged, false);
  assert.equal(state.board[2][2].questioned, false);
});

test("game logic exposes a read-only deterministic hint", () => {
  const state = makeState("easy", "classic");
  state.board = [
    [cell({ revealed: true, count: 1 }), cell()],
  ];
  state.rows = 1;
  state.cols = 2;
  state.mines = 1;
  const before = JSON.stringify(state.board);
  const game = createGameLogic({
    getState: () => state,
    getDifficultySpec: () => ({ rows: state.rows, cols: state.cols, mines: state.mines }),
    getGenerationMode: () => "standard",
  });

  const hint = game.getHint();

  assert.equal(hint.kind, "mine");
  assert.deepEqual(hint.target, [0, 1]);
  assert.equal(JSON.stringify(state.board), before);
});

test("cell labels describe coordinates and visible state for assistive technology", () => {
  assert.match(buildCellAriaLabel(cell({ revealed: true, count: 3 }), 1, 2), /第 2 行第 3 列/);
  assert.match(buildCellAriaLabel(cell({ flagged: true }), 1, 2), /已标记/);
  assert.match(buildCellAriaLabel(cell(), 1, 2), /未揭开/);
});

test("mobile mark mode toggles between reveal and mark", () => {
  assert.equal(nextMarkMode("reveal"), "mark");
  assert.equal(nextMarkMode("mark"), "reveal");
});
