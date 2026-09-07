/* 独立连连看(lianliankan-game.js)逻辑校验
 * 通过 VM 注入最小 DOM 桩加载脚本,再调用 window.__LLK__ 暴露的纯逻辑。
 * 运行:node tests/lianliankan.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lianliankan-game.js"), "utf8");

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
  "lianliankanShell", "llkBoard", "llkTimer", "llkStatus", "llkLeft",
  "llkDifficulty", "llkNew", "llkShuffle", "llkPathLayer",
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
  location: { hash: "" },
  performance: { now: () => Date.now() },
  requestAnimationFrame(cb) { cb(); },
  addEventListener() {},
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
vm.runInContext(source, sandbox, { filename: "lianliankan-game.js" });

const LLK = sandbox.__LLK__;
if (!LLK) throw new Error("window.__LLK__ not exposed (script early-returned?)");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(typeof LLK.computePathPoints === "function", "computePathPoints should be exposed for geometry regression coverage");

// 连线坐标必须以真实格子中心为准,不能只用理论 cell 尺寸推算。
// 这里模拟棋盘存在 gap、内边距且路径层位于外层容器内的情况。
{
  const rects = [
    { left: 14, top: 12, width: 40, height: 40 },
    { left: 59, top: 12, width: 40, height: 40 },
    { left: 104, top: 12, width: 40, height: 40 },
    { left: 14, top: 57, width: 40, height: 40 },
    { left: 59, top: 57, width: 40, height: 40 },
    { left: 104, top: 57, width: 40, height: 40 },
  ];
  const points = LLK.computePathPoints(
    [{ r: 0, c: 0 }, { r: 0, c: 2 }],
    2,
    3,
    rects,
    { left: 10, top: 8 },
  );
  assert(JSON.stringify(points) === JSON.stringify([[24, 24], [114, 24]]),
    "line endpoints should match target cell centers relative to the path layer, got " + JSON.stringify(points));
}

assert(typeof LLK.getLineStrokeWidth === "function", "getLineStrokeWidth should be exposed for draw regression coverage");
assert(LLK.getLineStrokeWidth([{ width: 40 }]) === 5,
  "line stroke width should be derived from the actual cell width");

function cloneBoard(board) {
  return board.grid.slice();
}

/* 棋盘合法性:格数、成对、每类数量一致 */
function assertBoardValid(board, label) {
  const { rows, cols, kinds, grid } = board;
  const total = rows * cols;
  assert(grid.length === total, `${label}: grid length mismatch`);
  assert(rows >= 2 && cols >= 2, `${label}: board too small`);
  const counts = new Array(kinds + 1).fill(0);
  for (let i = 0; i < total; i++) {
    const v = grid[i];
    assert(v >= 1 && v <= kinds, `${label}: value out of range at ${i}: ${v}`);
    counts[v] += 1;
  }
  for (let k = 1; k <= kinds; k++) {
    assert(counts[k] > 0 && counts[k] % 2 === 0, `${label}: kind ${k} count ${counts[k]} not positive-even`);
  }
  // 各类数量应一致(perKind = total / kinds)
  assert(counts[1] === total / kinds, `${label}: kind counts differ`);
  // 开局必须至少有一对可连(防死局)
  const pair = LLK.findAnyPair(grid, rows, cols);
  assert(pair !== null, `${label}: initial board has no movable pair`);
  return counts;
}

const started = Date.now();

// 三种难度棋盘合法性 + 开局有解
for (const key of ["easy", "medium", "hard"]) {
  const cfg = LLK.DIFFICULTIES[key];
  const board = LLK.makeBoard(cfg.rows, cfg.cols, cfg.kinds);
  assertBoardValid(board, key);
  console.log(`lianliankan: ${key} ${cfg.rows}x${cfg.cols} kinds=${cfg.kinds} valid, ${Date.now() - started}ms`);
}

// 连通判定单元测试:构造 3x3 手写局面
// 布局(r,c):
//   A B A
//   B 0 B
//   A B A
// 图案 1 = A 放 (0,0)(0,2)(2,0)(2,2);图案 2 = B 放 (0,1)(1,0)(1,2)(2,1);中心 (1,1) 空
function manualGrid() {
  const rows = 3, cols = 3;
  const grid = [
    1, 2, 1,
    2, 0, 2,
    1, 2, 1,
  ];
  return { rows, cols, grid };
}

// 0 折:同行/列直线连通
let g = manualGrid();
assert(LLK.findPath(g.grid, g.rows, g.cols, { r: 0, c: 0 }, { r: 0, c: 2 }) !== null, "straight row A-A should connect");
assert(LLK.findPath(g.grid, g.rows, g.cols, { r: 0, c: 1 }, { r: 2, c: 1 }) !== null, "straight col B-B should connect");
// 1 折:拐点必须为空。A(0,0) 到 B(2,1) 图案不同 -> null
assert(LLK.findPath(g.grid, g.rows, g.cols, { r: 0, c: 0 }, { r: 2, c: 1 }) === null, "different kinds must not connect");
// 不同图案但同值? 0 是空 -> 不可连
assert(LLK.findPath(g.grid, g.rows, g.cols, { r: 1, c: 1 }, { r: 1, c: 0 }) === null, "empty cell must not connect");
console.log("lianliankan: straight-line rules pass");

// 2 折(绕行):在 2x3 满盘上,两角同类图案需经外圈虚拟通道连接
// 布局:
//   A B A
//   B A B
// (0,0)=A,(0,2)=A 同行但中间 (0,1)=B 挡住 -> 0 折不行;
// 1 折拐点 (0,2) 自身/或 (0,0)... 需走外圈 -> 2 折
{
  const rows = 2, cols = 3;
  const grid = [
    1, 2, 1,
    2, 1, 2,
  ];
  const p = LLK.findPath(grid, rows, cols, { r: 0, c: 0 }, { r: 0, c: 2 });
  assert(p !== null, "two A separated by B should connect around outside (2 turns)");
  assert(p.length === 4, "expected 2-turn path with 4 points, got " + JSON.stringify(p));
  console.log("lianliankan: 2-turn outside wrap pass, path=" + JSON.stringify(p));
}

// 边界绕行:1x4 单行盘,(0,0) 与 (0,3) 同类、中间挡 -> 可绕上方虚拟通道(2 折)
{
  const rows = 1, cols = 4;
  const grid = [1, 2, 2, 1];
  const p = LLK.findPath(grid, rows, cols, { r: 0, c: 0 }, { r: 0, c: 3 });
  assert(p !== null, "single-row board corners should connect via outer lane");
  console.log("lianliankan: single-row outer wrap pass, path=" + JSON.stringify(p));
}

// 真实不可连:2x2 四格全是同图案 -> 两两相邻必可连(直线),所以不会不可连;
// 用同图案但被"空转实"隔断的场景:3x1 [1, 2, 1] 中间非空且只有 1 行 -> 需外圈,应可连。
// 真正不可连:两块不同图案 2x1 [1,2] -> null
{
  const rows = 2, cols = 1;
  const grid = [1, 2];
  const p = LLK.findPath(grid, rows, cols, { r: 0, c: 0 }, { r: 1, c: 0 });
  assert(p === null, "different kinds vertically adjacent must NOT connect");
  console.log("lianliankan: negative case pass");
}

// 死局检测 findAnyPair:全盘仅剩 2 格同图案但不连通?
// 1x3 盘 [1, 0, 1]:(0,0) 与 (0,2) 中间空且同行 -> 0 折可连,应找得到。
{
  const rows = 1, cols = 3;
  const grid = [1, 0, 1];
  const pair = LLK.findAnyPair(grid, rows, cols);
  assert(pair !== null, "findAnyPair should find straight pair");
}

// reshuffle:构造只剩 3 对(6 格)的残留局面后重排,应保持成对且有解
{
  const cfg = LLK.DIFFICULTIES.medium;
  const board = LLK.makeBoard(cfg.rows, cfg.cols, cfg.kinds);
  const grid = board.grid.slice();
  // 保留 kind 1/2/3 各 2 格,其余全部清空(成对消除的真实残留形态)
  const keep = new Set();
  const perKind = (cfg.rows * cfg.cols) / cfg.kinds;
  for (let k = 1; k <= 3; k++) {
    let kept = 0;
    for (let i = 0; i < grid.length && kept < 2; i++) {
      if (grid[i] === k) { keep.add(i); kept++; }
    }
  }
  for (let i = 0; i < grid.length; i++) {
    if (!keep.has(i)) grid[i] = 0;
  }
  assert(grid.filter((v) => v !== 0).length === 6, "fixture should leave exactly 6 cells");
  const ok = LLK.reshuffle(grid, cfg.rows, cfg.cols);
  assert(ok === true, "reshuffle should succeed");
  const left = grid.filter((v) => v !== 0).length;
  assert(left % 2 === 0 && left > 0, "after reshuffle remaining should stay even-positive");
  // 成对校验
  const counts = {};
  for (const v of grid) if (v !== 0) counts[v] = (counts[v] || 0) + 1;
  for (const k of Object.keys(counts)) {
    assert(counts[k] % 2 === 0, `after reshuffle kind ${k} count ${counts[k]} should be even`);
  }
  assert(LLK.findAnyPair(grid, cfg.rows, cfg.cols) !== null, "after reshuffle there must be a movable pair");
  console.log("lianliankan: reshuffle keeps pairs and guarantees a move");
}

// countRemaining
{
  const board = LLK.makeBoard(4, 4, 4); // 16 格,4 类,每类 4 个
  assert(LLK.countRemaining(board.grid) === 16, "countRemaining on fresh board");
  board.grid[0] = 0;
  assert(LLK.countRemaining(board.grid) === 15, "countRemaining after clearing one cell");
}

// 难度配置:rows*cols 可被 kinds 整除且每类个数为偶数
for (const key of Object.keys(LLK.DIFFICULTIES)) {
  const c = LLK.DIFFICULTIES[key];
  assert((c.rows * c.cols) % c.kinds === 0, `${key}: total not divisible by kinds`);
  assert((c.rows * c.cols) / c.kinds % 2 === 0, `${key}: per-kind count not even`);
}

console.log("ALL LIANLIANKAN CHECKS PASSED");
