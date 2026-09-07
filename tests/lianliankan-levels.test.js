const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadScript(file, sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"), sandbox, { filename: file });
}

function createGameSandbox(random) {
  function element() {
    const classes = new Set();
    return {
      textContent: "",
      hidden: false,
      value: "medium",
      dataset: {},
      style: { setProperty() {} },
      children: [],
      classList: {
        add(...names) { names.forEach((name) => classes.add(name)); },
        remove(...names) { names.forEach((name) => classes.delete(name)); },
        toggle(name, force) { if (force === undefined) force = !classes.has(name); if (force) classes.add(name); else classes.delete(name); return force; },
        contains(name) { return classes.has(name); },
      },
      addEventListener() {},
      appendChild(child) { this.children.push(child); return child; },
      setAttribute() {},
      removeAttribute() {},
    };
  }
  const ids = [
    "lianliankanShell", "llkBoard", "llkTimer", "llkStatus", "llkLeft",
    "llkDifficulty", "llkNew", "llkShuffle", "llkPathLayer", "llkMode",
    "llk3dStage", "llk3dCanvas", "llk3dToast", "llkTagline", "llkHint",
  ];
  const elements = new Map(ids.map((id) => [id, element()]));
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement() { return element(); },
    addEventListener() {},
  };
  const fixedMath = Object.create(Math);
  fixedMath.random = random;
  const sandbox = {
    document,
    console,
    location: { hash: "" },
    performance: { now: () => Date.now() },
    requestAnimationFrame(callback) { callback(); },
    addEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Math: fixedMath,
    Date,
    Number,
    String,
    Array,
    Set,
    Map,
    Infinity,
  };
  sandbox.window = sandbox;
  return sandbox;
}

const sharedSandbox = createGameSandbox(() => 0);
loadScript("lianliankan-game.js", sharedSandbox);
const LLK = sharedSandbox.__LLK__;
const levelSandbox = { console, Math, Array, Set, Map, Number, String };
levelSandbox.window = levelSandbox;
loadScript("lianliankan-levels.js", levelSandbox);
const levels = levelSandbox.__LLK_LEVELS__;
assert(levels, "level script should expose window.__LLK_LEVELS__");

const expected = [[6, 6, 4], [6, 8, 4], [8, 8, 8], [8, 10, 8], [10, 10, 10]];
assert.strictEqual(levels.length, 5);
for (let i = 0; i < levels.length; i++) {
  const level = levels[i];
  const [rows, cols, obstacles] = expected[i];
  assert.strictEqual(level.id, i + 1);
  assert.strictEqual(level.rows, rows);
  assert.strictEqual(level.cols, cols);
  assert(Number.isInteger(level.kinds) && level.kinds > 0);
  assert.strictEqual(level.layout.length, rows * cols);
  assert.strictEqual(level.layout.filter((v) => v === -1).length, obstacles);
  const counts = new Map();
  for (const value of level.layout) if (value > 0) counts.set(value, (counts.get(value) || 0) + 1);
  for (const count of counts.values()) assert(count > 0 && count % 2 === 0);
  assert(LLK.findAnyPair(level.layout, rows, cols), `level ${level.id} should start with a move`);
}

const copy = levels.cloneLayout(1);
assert.deepStrictEqual(copy, levels[0].layout);
assert.notStrictEqual(copy, levels[0].layout);
copy[0] = 99;
assert.notStrictEqual(copy[0], levels[0].layout[0]);

const falling = [1, 0, -1, 2, 0, 3, 0, -1, 4, 0, 0, 5];
const collapsed = levels.collapseColumns(falling, 4, 3);
assert.deepStrictEqual(collapsed.grid, [0, 0, -1, 0, 0, 3, 1, -1, 4, 2, 0, 5]);
assert(collapsed.moves.some((move) => move.from === 0 && move.to === 6 && move.value === 1));
assert(collapsed.moves.some((move) => move.from === 3 && move.to === 9 && move.value === 2));
assert.deepStrictEqual(collapsed.grid.filter((v, i) => falling[i] === -1), [-1, -1]);
assert.notStrictEqual(collapsed.grid, falling);

const obstacleGrid = new Array(25).fill(2);
obstacleGrid[2 * 5 + 1] = 1;
obstacleGrid[2 * 5 + 2] = -1;
obstacleGrid[2 * 5 + 3] = 1;
assert.strictEqual(LLK.findPath(obstacleGrid, 5, 5, { r: 2, c: 1 }, { r: 2, c: 3 }), null);
assert.strictEqual(LLK.findPath(obstacleGrid, 5, 5, { r: 2, c: 2 }, { r: 2, c: 2 }), null);
assert.strictEqual(levels.countRemaining(obstacleGrid), 24);

const shuffledInput = [1, 2, -1, 2, 1, 0, -1, 0];
const beforeTiles = shuffledInput.filter((v) => v > 0).sort((a, b) => a - b);
const shuffled = levels.reshuffle(shuffledInput, 2, 4, LLK.findAnyPair, () => 0);
assert(shuffled && shuffled.ok);
assert.deepStrictEqual(shuffled.grid.filter((v) => v === -1), [-1, -1]);
assert.deepStrictEqual(shuffled.grid.filter((v) => v > 0).sort((a, b) => a - b), beforeTiles);
assert(LLK.findAnyPair(shuffled.grid, 2, 4));

// 共享 2D 洗牌：固定随机源让随机阶段 80 次都无解；只有后续槽位配对可连。
const fallbackFixture = [
  -1, -1, 1, -1, -1,
  -1, 1, -1, 2, -1,
  3, 4, -1, 5, 6,
  7, -1, -1, 8, -1,
  9, 0, 0, -1, 0,
];
const randomPhase = [
  -1, -1, 1, -1, -1,
  -1, 2, -1, 3, -1,
  4, 5, -1, 6, 7,
  8, -1, -1, 9, -1,
  1, 0, 0, -1, 0,
];
const firstSlotsOnly = [
  -1, -1, 1, -1, -1,
  -1, 1, -1, 2, -1,
  3, 4, -1, 5, 6,
  7, -1, -1, 8, -1,
  9, 0, 0, -1, 0,
];
const laterSlots = [
  -1, -1, 2, -1, -1,
  -1, 3, -1, 1, -1,
  4, 5, -1, 1, 6,
  7, -1, -1, 8, -1,
  9, 0, 0, -1, 0,
];
assert.strictEqual(LLK.findAnyPair(randomPhase, 5, 5), null);
assert.strictEqual(LLK.findAnyPair(firstSlotsOnly, 5, 5), null);
assert(LLK.findAnyPair(laterSlots, 5, 5), "a later slot pair should be the deterministic fallback witness");
const fallbackResult = fallbackFixture.slice();
assert.strictEqual(LLK.reshuffle(fallbackResult, 5, 5), true);
assert(LLK.findAnyPair(fallbackResult, 5, 5));
assert.deepStrictEqual(fallbackResult.filter((value) => value === -1), fallbackFixture.filter((value) => value === -1));

assert.strictEqual(typeof levels.findPath, "undefined", "level data must use shared path logic");
assert.strictEqual(typeof levels.findAnyPair, "undefined", "level data must use injected shared pair finder");

console.log("ALL LIANLIANKAN LEVEL LOGIC CHECKS PASSED");
