/* 独立数独(sudoku-game.js)逻辑校验
 * 通过 VM 注入最小 DOM 桩加载脚本,再调用 window.__SUDOKU__ 暴露的纯逻辑。
 * 运行:node tests/classic-sudoku.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const nodeAssert = require("assert");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "sudoku-game.js"), "utf8");

function createElementStub() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  const element = {
    textContent: "",
    hidden: false,
    disabled: false,
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
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event.type) || [];
      handlers.forEach((handler) => handler.call(this, event));
      return true;
    },
    click() {
      this.dispatchEvent({
        type: "click",
        target: this,
        preventDefault() {},
        stopPropagation() {},
      });
    },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === "disabled") this.disabled = true;
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "disabled") this.disabled = false;
    },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
  };
  return element;
}

const IDs = [
  "sudokuShell", "sudokuBoard", "sudokuPad", "sudokuTimer", "sudokuStatus",
  "sudokuErrors", "sudokuDifficulty", "sudokuNew", "sudokuCheck", "sudokuPause",
  "sudokuReset", "sudokuNotesToggle", "sudokuUndo", "sudokuRedo", "sudokuHintButton",
  "sudokuDigitInfo", "sudokuHintText", "sweepShell", "fireworksLayer", "gameTabSweep", "gameTabSudoku",
];
const elements = new Map(IDs.map((id) => [id, createElementStub()]));

const documentListeners = new Map();
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
  addEventListener(type, handler) {
    if (!documentListeners.has(type)) documentListeners.set(type, []);
    documentListeners.get(type).push(handler);
  },
  dispatchEvent(event) {
    (documentListeners.get(event.type) || []).forEach((handler) => handler.call(document, event));
  },
};

const localStore = new Map();
const localStorage = {
  getItem(key) { return localStore.has(String(key)) ? localStore.get(String(key)) : null; },
  setItem(key, value) { localStore.set(String(key), String(value)); },
  removeItem(key) { localStore.delete(String(key)); },
  clear() { localStore.clear(); },
};

function testSetTimeout(callback) {
  callback();
  return 1;
}

function testSetInterval() {
  return 1;
}

const sandbox = {
  document,
  localStorage,
  console,
  performance: { now: () => Date.now() },
  location: { hash: "" }, // 无锚点时默认打开扫雷
  setTimeout: testSetTimeout,
  clearTimeout() {},
  setInterval: testSetInterval,
  clearInterval() {},
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
sandbox.confirm = () => true;
sandbox.addEventListener = (type, handler) => {
  if (!documentListeners.has(`window:${type}`)) documentListeners.set(`window:${type}`, []);
  documentListeners.get(`window:${type}`).push(handler);
};
sandbox.dispatchEvent = (event) => {
  (documentListeners.get(`window:${event.type}`) || []).forEach((handler) => handler.call(sandbox, event));
};

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

const referenceSolution = [
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
const referencePuzzle = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
];

nodeAssert.deepStrictEqual(
  Array.from(SUDOKU.getCandidates(referencePuzzle, 2)),
  [1, 2, 4],
  "candidate calculation should respect row, column, and box constraints",
);
nodeAssert.strictEqual(
  SUDOKU.countRemaining(referenceSolution, referencePuzzle, 5),
  6,
  "remaining count should count unanswered solution positions",
);

const nakedHint = SUDOKU.findBasicHint(referencePuzzle);
assert(nakedHint, "basic hint should find a naked single");
nodeAssert.strictEqual(nakedHint.strategy, "naked-single");
nodeAssert.strictEqual(nakedHint.index, 40);
nodeAssert.strictEqual(nakedHint.digit, 5);
assert(!/[1-9]/.test(nakedHint.explanation), "hint explanation should not expose an answer digit");

const hiddenReference = [
  0, 0, 4, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 8,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];
const hiddenHint = SUDOKU.findBasicHint(hiddenReference);
assert(hiddenHint, "basic hint should find a hidden single");
nodeAssert.strictEqual(hiddenHint.strategy, "hidden-single");
nodeAssert.strictEqual(hiddenHint.index, 36);
nodeAssert.strictEqual(hiddenHint.digit, 4);
assert(!/[1-9]/.test(hiddenHint.explanation), "hidden hint explanation should not expose an answer digit");

const saveRecord = {
  difficulty: "medium",
  puzzle: referencePuzzle,
  solution: referenceSolution,
  values: referencePuzzle.slice(),
  notes: new Array(81).fill(0),
  elapsedMs: 12345,
  started: true,
  ended: false,
};
const serialized = SUDOKU.serializeSave(saveRecord);
const restored = SUDOKU.deserializeSave(serialized, "medium");
nodeAssert.deepStrictEqual(JSON.parse(JSON.stringify(restored)), saveRecord, "valid save data should round-trip");
nodeAssert.strictEqual(SUDOKU.deserializeSave("{bad json", "medium"), null, "invalid save data should be ignored");
nodeAssert.strictEqual(SUDOKU.deserializeSave(serialized, "easy"), null, "save data for another difficulty should be ignored");
nodeAssert.strictEqual(SUDOKU.findBasicHint(referenceSolution), null, "a completed board should have no basic hint");
nodeAssert.strictEqual(
  SUDOKU.deserializeSave(SUDOKU.serializeSave({ ...saveRecord, solution: referenceSolution.slice(1) }), "medium"),
  null,
  "malformed solution data should be ignored",
);

// 交互回归:恢复存档后，笔记、历史、提示和数字统计应协同工作。
localStorage.clear();
localStorage.setItem(
  "sudoku-classic-medium-v1",
  SUDOKU.serializeSave({ ...saveRecord, paused: true }),
);
elements.get("gameTabSudoku").click();

const sudokuBoard = elements.get("sudokuBoard");
const sudokuPad = elements.get("sudokuPad");
const notesToggle = elements.get("sudokuNotesToggle");
let state = SUDOKU.getState();
nodeAssert.strictEqual(state.difficulty, "medium");
nodeAssert.strictEqual(state.paused, true, "restored in-progress games should start paused");
nodeAssert.strictEqual(sudokuPad.children[0].disabled, true, "input controls should be disabled while paused");
elements.get("sudokuPause").click();
state = SUDOKU.getState();
nodeAssert.strictEqual(state.paused, false);
const noteCell = sudokuBoard.children[2];
const peerNoteCell = sudokuBoard.children[3];
noteCell.click();
notesToggle.click();
sudokuPad.children[0].click(); // 笔记 1
peerNoteCell.click();
sudokuPad.children[1].click(); // 同行另一格的笔记 2
state = SUDOKU.getState();
nodeAssert.strictEqual(state.notes[2], 1, "note mode should toggle one candidate on");
nodeAssert.strictEqual(state.notes[3], 2, "notes should be independently editable");

notesToggle.click();
noteCell.click();
sudokuPad.children[3].click(); // 普通填数 4,只清除当前格笔记
state = SUDOKU.getState();
nodeAssert.strictEqual(state.values[2], 4);
nodeAssert.strictEqual(state.notes[2], 0, "normal entry should clear notes in the edited cell");
nodeAssert.strictEqual(state.notes[3], 2, "normal entry should not auto-delete peer notes");

elements.get("sudokuUndo").click();
state = SUDOKU.getState();
nodeAssert.strictEqual(state.values[2], 0, "fill should be one undoable history item");
nodeAssert.strictEqual(state.notes[2], 1);
elements.get("sudokuUndo").click();
state = SUDOKU.getState();
nodeAssert.strictEqual(state.notes[3], 0, "a second undo should remove the previous note only");
elements.get("sudokuRedo").click();
state = SUDOKU.getState();
nodeAssert.strictEqual(state.notes[3], 2, "redo should restore one atomic note operation");

sudokuBoard.children[40].click();
const beforeHint = SUDOKU.getState();
elements.get("sudokuHintButton").click();
state = SUDOKU.getState();
nodeAssert.deepStrictEqual(state.values, beforeHint.values, "hint should not modify the board");
nodeAssert.strictEqual(state.hintTarget.index, 40);
assert(!/[1-9]/.test(elements.get("sudokuHintText").textContent), "UI hint should not expose the answer digit");
nodeAssert.ok(state.baseMs >= beforeHint.baseMs + 30000, "successful hint should add 30 seconds");
nodeAssert.match(elements.get("sudokuDigitInfo").textContent, /数字 [1-9]：还剩 \d+ 个空位/);

// 错误局面不应扣提示时间,切换难度会保留各自存档。
const beforeErrorHint = SUDOKU.getState().baseMs;
sudokuBoard.children[2].click();
sudokuPad.children[0].click(); // 参考解为 4,故意填错 1
nodeAssert.strictEqual(SUDOKU.getState().values[2], 1);
elements.get("sudokuHintButton").click();
state = SUDOKU.getState();
nodeAssert.strictEqual(elements.get("sudokuStatus").textContent, "请先修正错误");
nodeAssert.ok(state.baseMs < beforeErrorHint + 1000, "error hint should not add the time penalty");
nodeAssert.strictEqual(state.hintTarget, null);
sudokuPad.children[9].click();

const previousMediumPuzzle = state.puzzle;
elements.get("sudokuDifficulty").value = "easy";
elements.get("sudokuDifficulty").dispatchEvent({ type: "change", target: elements.get("sudokuDifficulty") });
state = SUDOKU.getState();
nodeAssert.strictEqual(state.difficulty, "easy");
const easyBlank = state.puzzle.findIndex((value) => value === 0);
sudokuBoard.children[easyBlank].click();
sudokuPad.children[0].click();
nodeAssert.ok(localStorage.getItem("sudoku-classic-easy-v1"), "easy progress should be saved separately");

elements.get("sudokuDifficulty").value = "medium";
elements.get("sudokuDifficulty").dispatchEvent({ type: "change", target: elements.get("sudokuDifficulty") });
state = SUDOKU.getState();
nodeAssert.strictEqual(state.difficulty, "medium");
nodeAssert.deepStrictEqual(state.puzzle, previousMediumPuzzle, "switching back should restore the medium puzzle");
nodeAssert.strictEqual(state.paused, true, "restored difficulty saves should start paused");

elements.get("sudokuPause").click();
const resetBlank = SUDOKU.getState().puzzle.findIndex((value) => value === 0);
sudokuBoard.children[resetBlank].click();
sudokuPad.children[1].click();
elements.get("sudokuReset").click();
state = SUDOKU.getState();
nodeAssert.deepStrictEqual(state.values, state.puzzle, "reset should retain the puzzle and clear entered values");
nodeAssert.ok(state.notes.every((mask) => mask === 0), "reset should clear all notes");
nodeAssert.strictEqual(state.started, false);
nodeAssert.strictEqual(state.baseMs, 0);

// N 键和组合撤销/重做快捷键应与按钮走同一套历史。
function dispatchKey(key, options) {
  const opts = options || {};
  document.dispatchEvent({
    type: "keydown",
    key,
    ctrlKey: Boolean(opts.ctrlKey),
    metaKey: Boolean(opts.metaKey),
    shiftKey: Boolean(opts.shiftKey),
    target: {},
    preventDefault() {},
    stopPropagation() {},
  });
}
const keyboardBlank = state.puzzle.findIndex((value) => value === 0);
sudokuBoard.children[keyboardBlank].click();
dispatchKey("n");
nodeAssert.strictEqual(SUDOKU.getState().noteMode, true);
dispatchKey("3");
nodeAssert.strictEqual(SUDOKU.getState().notes[keyboardBlank], 4);
dispatchKey("n");
dispatchKey("z", { ctrlKey: true });
nodeAssert.strictEqual(SUDOKU.getState().notes[keyboardBlank], 0);
dispatchKey("z", { ctrlKey: true, shiftKey: true });
nodeAssert.strictEqual(SUDOKU.getState().notes[keyboardBlank], 4);
dispatchKey("z", { ctrlKey: true });
const anotherKeyboardBlank = state.puzzle.findIndex((value, index) => value === 0 && index !== keyboardBlank);
sudokuBoard.children[anotherKeyboardBlank].click();
dispatchKey("n");
dispatchKey("4");
nodeAssert.strictEqual(SUDOKU.getState().canRedo, false, "a new operation should clear the redo stack");

console.log("classic sudoku: notes, history, hints, persistence, and digit count passed");

console.log("ALL CLASSIC SUDOKU CHECKS PASSED");
