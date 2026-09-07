/* 独立数独(sudoku-game.js)逻辑校验
 * 通过 VM 注入最小 DOM 桩加载脚本,再调用 window.__SUDOKU__ 暴露的纯逻辑。
 * 运行:node tests/classic-sudoku.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "sudoku-game.js"), "utf8");

function createElementStub() {
  const classes = new Set();
  const element = {
    textContent: "",
    hidden: false,
    value: "medium",
    dataset: {},
    style: {},
    children: [],
    classList: {
      add(...names) { names.forEach((n) => classes.add(n)); },
      remove(...names) { names.forEach((n) => classes.delete(n)); },
      toggle(name, force) {
        if (force === undefined) {
          if (classes.has(name)) { classes.delete(name); return false; }
          classes.add(name);
          return true;
        }
        if (force) classes.add(name); else classes.delete(name);
        return force;
      },
      contains(name) { return classes.has(name); },
    },
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {},
    removeAttribute() {},
  };
  return element;
}

const IDs = [
  "sudokuShell", "sudokuBoard", "sudokuPad", "sudokuTimer", "sudokuStatus",
  "sudokuErrors", "sudokuDifficulty", "sudokuNew", "sudokuCheck", "sudokuPause",
  "sudokuReset", "sweepShell", "fireworksLayer", "gameTabSweep", "gameTabSudoku",
];
const elements = new Map(IDs.map((id) => [id, createElementStub()]));

const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElementStub());
    return elements.get(id);
  },
  createElement(tag) {
    const el = createElementStub();
    el.tagName = String(tag).toUpperCase();
    return el;
  },
  addEventListener() {},
};

const sandbox = {
  document,
  console,
  performance: { now: () => Date.now() },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Math,
  Date,
  Number,
  String,
  Array,
  Set,
  Map,
  Infinity,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "sudoku-game.js" });

const SUDOKU = sandbox.__SUDOKU__;
if (!SUDOKU) throw new Error("window.__SUDOKU__ not exposed (script early-returned?)");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isValidSolved(solution) {
  assert(Array.isArray(solution) && solution.length === 81, "solution must be an 81-cell array");
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = solution[r * 9 + c];
      assert(v >= 1 && v <= 9, `cell(${r},${c}) out of range: ${v}`);
    }
  }
  const full = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rowOf = (i) => Math.floor(i / 9);
  const colOf = (i) => i % 9;
  for (let i = 0; i < 9; i++) {
    const row = new Set();
    const col = new Set();
    const box = new Set();
    for (let k = 0; k < 9; k++) {
      row.add(solution[i * 9 + k]);
      col.add(solution[k * 9 + i]);
      const br = Math.floor(i / 3) * 3 + Math.floor(k / 3);
      const bc = (i % 3) * 3 + (k % 3);
      box.add(solution[br * 9 + bc]);
    }
    assert(row.size === 9 && col.size === 9 && box.size === 9, `row/col/box ${i} not 1..9`);
  }
  return true;
}

function assertConsistentPuzzle(result, blanksTarget, label) {
  const { solution, puzzle, removed } = result;
  isValidSolved(solution);
  for (let i = 0; i < 81; i++) {
    const p = puzzle[i];
    assert(p === 0 || p === solution[i], `${label}: puzzle deviates from solution at ${i}`);
  }
  const emptyCount = puzzle.filter((v) => v === 0).length;
  assert(emptyCount === removed, `${label}: empty count mismatch`);
  assert(SUDOKU.countSolutions(puzzle.slice(), 2) === 1, `${label}: solution is not unique`);
  return removed;
}

const started = Date.now();

// 简单/中等:应精确挖到目标空格数
for (const key of ["easy", "medium"]) {
  const cfg = SUDOKU.DIFFICULTIES[key];
  const result = SUDOKU.makePuzzle(cfg.blanks);
  const removed = assertConsistentPuzzle(result, cfg.blanks, key);
  assert(removed === cfg.blanks, `${key}: expected ${cfg.blanks} blanks, got ${removed}`);
  console.log(`classic sudoku: ${key} => ${removed} blanks, unique, ${Date.now() - started}ms elapsed`);
}

// 困难:受时间预算约束,允许略少于目标,但仍须唯一解且足够空
const hardCfg = SUDOKU.DIFFICULTIES.hard;
const hardResult = SUDOKU.makePuzzle(hardCfg.blanks);
const hardRemoved = assertConsistentPuzzle(hardResult, hardCfg.blanks, "hard");
assert(hardRemoved >= hardCfg.blanks - 10, `hard: only removed ${hardRemoved} blanks`);
console.log(`classic sudoku: hard => ${hardRemoved} blanks, unique, ${Date.now() - started}ms elapsed`);

// 重复挖洞应得到不同题目(随机性)
const a = SUDOKU.makePuzzle(36);
const b = SUDOKU.makePuzzle(36);
let differs = false;
for (let i = 0; i < 81; i++) {
  if (a.puzzle[i] !== b.puzzle[i]) { differs = true; break; }
}
assert(differs, "two generated easy puzzles are identical");
console.log("classic sudoku: random generation varies across runs");

console.log("ALL CLASSIC SUDOKU CHECKS PASSED");
