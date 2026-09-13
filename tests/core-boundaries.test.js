import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { create2048Game } from "../src/core/games/2048/engine.js";
import { generateClassicBoard } from "../src/core/games/minesweeper/generator.js";
import { analyzePosition } from "../src/core/games/minesweeper/solver.js";
import { makeState } from "../src/core/games/minesweeper/state.js";
import { generateSudokuMines, getSudokuCoreStatus } from "../src/core/games/sudoku/index.js";
import { makePuzzle as makeSudokuPuzzle } from "../src/core/games/sudoku/engine.js";
import {
  LLK_LEVELS,
  cloneLayout,
  getLianliankanCoreStatus,
} from "../src/core/games/lianliankan/index.js";
import { getRogueCoreStatus } from "../src/core/games/rogue/index.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("2048 core engine is usable without browser globals", () => {
  const game = create2048Game({ rng: () => 0 });
  const before = game.getState();
  const after = game.move("left");

  assert.equal(before.board.length, 16);
  assert.equal(after.board.length, 16);
  assert.notEqual(after, before);
});

test("core source contains no direct browser-global dependencies", () => {
  const coreRoot = path.join(projectRoot, "src", "core");
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".js")) files.push(target);
    }
  };
  visit(coreRoot);

  const forbidden = /\b(?:document|window|localStorage)\b/;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, forbidden, `${path.relative(projectRoot, file)} imports a browser global`);
  }
});

test("Minesweeper core keeps the first-click neighborhood safe", () => {
  const generated = generateClassicBoard({
    rows: 9,
    cols: 9,
    mines: 10,
    safeRow: 4,
    safeCol: 4,
    rng: () => 0.25,
  });
  const state = makeState({ rows: 9, cols: 9, mines: 10 }, "classic");

  assert.equal(state.board.length, 9);
  assert.equal(generated.board[4][4].mine, false);
  for (let row = 3; row <= 5; row += 1) {
    for (let col = 3; col <= 5; col += 1) {
      assert.equal(generated.board[row][col].mine, false);
    }
  }
  assert.equal(analyzePosition({ board: state.board, rows: 9, cols: 9, totalMines: 10 }).kind, "none");
});

test("legacy game seams identify remaining UI adapters explicitly", () => {
  assert.deepEqual(getSudokuCoreStatus(), {
    game: "sudoku",
    status: "extracted",
    uiSource: "src/sudoku-game.js",
  });
  assert.deepEqual(getLianliankanCoreStatus(), {
    game: "lianliankan",
    status: "partial",
    uiSource: "src/lianliankan-game.js",
  });
  assert.deepEqual(getRogueCoreStatus(), {
    game: "rogue",
    status: "bridge",
    uiSource: "src/rogue-ui.js",
  });
});

test("partial game cores expose pure data and generators", () => {
  const sudoku = generateSudokuMines(9, { maxAttempts: 0, rng: () => 0.25 });
  assert.equal(sudoku.mines.length, 9);
  assert.equal(LLK_LEVELS.length, 5);
  assert.equal(cloneLayout(1).length, LLK_LEVELS[0].rows * LLK_LEVELS[0].cols);
});

test("Sudoku core source is independent from browser globals", () => {
  const source = fs.readFileSync(path.join(projectRoot, "src", "core", "games", "sudoku", "engine.js"), "utf8");
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|performance|setInterval|setTimeout|requestAnimationFrame)\b/);
  const result = makeSudokuPuzzle(0, { rng: () => 0.25, now: () => 0 });
  assert.equal(result.removed, 0);
});
