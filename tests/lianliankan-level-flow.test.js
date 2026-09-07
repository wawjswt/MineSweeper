/* 关卡模式的游戏流程、计分和存档校验。
 * 运行: node tests/lianliankan-level-flow.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function element() {
  return {
    textContent: "", value: "medium", dataset: {}, children: [], hidden: false,
    style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, removeAttribute() {},
  };
}

const elements = new Map();
const document = {
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  createElement() { return element(); },
  addEventListener() {},
};
const sandbox = {
  document, console, Math, Date, Number, String, Array, Set, Map, Infinity,
  location: { hash: "" }, performance: { now: () => Date.now() },
  requestAnimationFrame(callback) { callback(); }, addEventListener() {},
  setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ["lianliankan-levels.js", "lianliankan-game.js"]) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
  vm.runInContext(source, sandbox, { filename: file });
}

const LLK = sandbox.__LLK__;
assert(LLK.levelFlow, "level flow helpers should be exposed for integration tests");
const flow = LLK.levelFlow;
const plain = (value) => JSON.parse(JSON.stringify(value));

// 评分错误（基础分、层数或 3 秒窗口）应使本组断言失败。
let combo = flow.nextScore({ score: 0, combo: 0, maxCombo: 0, lastSuccessMs: null }, 100);
assert.deepStrictEqual(plain(combo), { score: 100, combo: 1, maxCombo: 1, lastSuccessMs: 100 });
combo = flow.nextScore(combo, 2_900);
assert.deepStrictEqual(plain(combo), { score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 });
combo = flow.nextScore(combo, 6_001);
assert.deepStrictEqual(plain(combo), { score: 325, combo: 1, maxCombo: 2, lastSuccessMs: 6_001 });
assert.deepStrictEqual(plain(flow.resetCombo(combo)), { score: 325, combo: 0, maxCombo: 2, lastSuccessMs: null });
assert.deepStrictEqual(
  plain(flow.scorePair({ score: 10, combo: 2, maxCombo: 2, lastSuccessMs: 100 }, 500, false)),
  { score: 10, combo: 2, maxCombo: 2, lastSuccessMs: 100 },
  "classic and 3D modes must not receive level scoring"
);
assert.deepStrictEqual(
  plain(flow.expireCombo({ score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 }, 5_901)),
  { score: 225, combo: 0, maxCombo: 2, lastSuccessMs: null },
  "combo must expire after three seconds of active time"
);
assert.deepStrictEqual(
  plain(flow.expireCombo({ score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 }, 5_900)),
  { score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 },
  "combo must remain active at the inclusive three-second boundary"
);
assert.strictEqual(flow.applyClearBonus(100, false), 100, "classic and 3D modes must not receive level clear bonus");
assert.strictEqual(flow.applyClearBonus(100, true), 600, "level mode must receive the clear bonus");

// 障碍不可选；提示只能报告一对可消除图案，不能修改棋盘。
assert.strictEqual(flow.isSelectable(-1), false, "obstacle clicks must be ignored");
assert.strictEqual(flow.isSelectable(0), false, "empty cells must be ignored");
assert.strictEqual(flow.isSelectable(2), true, "tiles must remain selectable");
const hintGrid = [1, 1, -1, 2, 2, 0];
const beforeHint = hintGrid.slice();
assert.deepStrictEqual(plain(flow.findHintPair(hintGrid, 2, 3, LLK.findAnyPair)), { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } });
assert.deepStrictEqual(hintGrid, beforeHint, "hint must not change the board");

// 损坏存档必须回退；通关解锁下一关，并分别保留每关的最佳分数、时间和 Combo。
const storage = {
  value: "{bad json",
  getItem() { return this.value; },
  setItem(key, value) { this.key = key; this.value = value; },
};
let progress = flow.readProgress(storage);
assert.deepStrictEqual(plain(progress), { version: 1, unlockedLevel: 1, completed: {} });
for (const corrupted of [
  { version: 1, unlockedLevel: 999, completed: {} },
  { version: 1, unlockedLevel: 2, completed: { "9": { score: 1, time: 1, combo: 1 } } },
  { version: 1, unlockedLevel: 2, completed: { "1": { score: -1, time: 1, combo: 1 } } },
  { version: 1, unlockedLevel: 4, completed: { "1": { score: 1, time: 1, combo: 1 } } },
]) {
  storage.value = JSON.stringify(corrupted);
  assert.deepStrictEqual(plain(flow.readProgress(storage)), { version: 1, unlockedLevel: 1, completed: {} });
}
progress = flow.recordCompletion(progress, 1, { score: 620, time: 38, combo: 4 });
assert.deepStrictEqual(plain(progress), {
  version: 1, unlockedLevel: 2, completed: { "1": { score: 620, time: 38, combo: 4 } },
});
progress = flow.recordCompletion(progress, 1, { score: 500, time: 31, combo: 2 });
assert.deepStrictEqual(plain(progress.completed["1"]), { score: 620, time: 31, combo: 4 });
assert.strictEqual(flow.writeProgress(progress, storage), true);
assert.strictEqual(storage.key, "lianliankan-level-progress-v1");
assert.deepStrictEqual(plain(flow.readProgress(storage)), plain(progress));

// 无解时自动洗牌：障碍、图案多重集合与分数不应改变，且结果必须有可用配对。
const deadGrid = [
  -1, -1, 1, -1, -1,
  -1, 1, -1, 2, -1,
  3, 4, -1, 5, 6,
  7, -1, -1, 8, -1,
  9, 0, 0, -1, 0,
];
assert.strictEqual(LLK.findAnyPair(deadGrid, 5, 5), null, "fixture must start as a dead board");
const resolved = flow.ensureSolvable(deadGrid, 5, 5, sandbox.__LLK_LEVELS__, LLK.findAnyPair, () => 0);
assert.strictEqual(resolved.autoReshuffled, true);
assert.deepStrictEqual(plain(resolved.grid.filter((value) => value === -1)), deadGrid.filter((value) => value === -1));
assert.deepStrictEqual(plain(resolved.grid.filter((value) => value > 0).sort()), deadGrid.filter((value) => value > 0).sort());
assert(LLK.findAnyPair(resolved.grid, 5, 5), "automatic reshuffle must restore a playable pair");

console.log("ALL LIANLIANKAN LEVEL FLOW CHECKS PASSED");
