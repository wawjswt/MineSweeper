const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadScript(file, sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"), sandbox, { filename: file });
}

const sandbox = { console, Math, Array, Set, Map, Number, String };
sandbox.window = sandbox;
loadScript("lianliankan-levels.js", sandbox);
const levels = sandbox.__LLK_LEVELS__;
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
  assert(levels.findAnyPair(level.layout, rows, cols), `level ${level.id} should start with a move`);
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
assert.strictEqual(levels.findPath(obstacleGrid, 5, 5, { r: 2, c: 1 }, { r: 2, c: 3 }), null);
assert.strictEqual(levels.findPath(obstacleGrid, 5, 5, { r: 2, c: 2 }, { r: 2, c: 2 }), null);
assert.strictEqual(levels.countRemaining(obstacleGrid), 24);

const shuffledInput = [1, 2, -1, 2, 1, 0, -1, 0];
const beforeTiles = shuffledInput.filter((v) => v > 0).sort((a, b) => a - b);
const shuffled = levels.reshuffle(shuffledInput, 2, 4, levels.findAnyPair);
assert(shuffled && shuffled.ok);
assert.deepStrictEqual(shuffled.grid.filter((v) => v === -1), [-1, -1]);
assert.deepStrictEqual(shuffled.grid.filter((v) => v > 0).sort((a, b) => a - b), beforeTiles);
assert(levels.findAnyPair(shuffled.grid, 2, 4));

console.log("ALL LIANLIANKAN LEVEL LOGIC CHECKS PASSED");
