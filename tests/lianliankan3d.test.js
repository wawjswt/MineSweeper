/* 3D 立体连连看(魔方表面连线)纯逻辑校验
 * 通过 VM 注入最小 DOM 桩加载 lianliankan-game.js,再调用 window.__LLK__.llk3d。
 * 运行:node tests/lianliankan3d.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lianliankan-game.js"), "utf8");

function createElementStub() {
  const classes = new Set();
  return {
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
}

const IDs = [
  "lianliankanShell", "llkBoard", "llkTimer", "llkStatus", "llkLeft",
  "llkDifficulty", "llkNew", "llkShuffle", "llkPathLayer",
  "llkMode", "llk3dStage", "llk3dCanvas", "llk3dToast", "llkTagline", "llkHint",
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
if (!LLK) throw new Error("window.__LLK__ not exposed");
const L3 = LLK.llk3d;
if (!L3) throw new Error("__LLK__.llk3d not exposed");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/* 棋盘合法性:内部格计数、每类恰好 2 个、全在表面、开局有解 */
function assertBoardValid(board, label) {
  const { d, kinds, occ } = board;
  const { nx, ny, nz } = d;
  const interior = Math.max(0, nx - 2) * Math.max(0, ny - 2) * Math.max(0, nz - 2);
  let interiorCount = 0;
  let tileCount = 0;
  const counts = new Array(kinds + 1).fill(0);
  for (let x = 0; x < nx; x++)
    for (let y = 0; y < ny; y++)
      for (let z = 0; z < nz; z++) {
        const v = occ[L3.idx(d, x, y, z)];
        if (v === -1) {
          interiorCount += 1;
          assert(!L3.isSurfaceCell(d, x, y, z), `${label}: interior marker on surface cell`);
        } else if (v > 0) {
          tileCount += 1;
          assert(L3.isSurfaceCell(d, x, y, z), `${label}: tile on non-surface cell (${x},${y},${z})`);
          assert(v <= kinds, `${label}: kind out of range`);
          counts[v] += 1;
        } else if (v === 0) {
          assert(L3.isSurfaceCell(d, x, y, z), `${label}: empty marker on interior cell`);
        }
      }
  assert(interiorCount === interior, `${label}: interior count ${interiorCount} != ${interior}`);
  assert(tileCount === kinds * 2, `${label}: tiles ${tileCount} != kinds*2`);
  for (let k = 1; k <= kinds; k++) {
    assert(counts[k] === 2, `${label}: kind ${k} has ${counts[k]} tiles (expect 2)`);
  }
  const pair = L3.findAnyPair(occ, d);
  assert(pair !== null, `${label}: initial board has no movable pair`);
}

const started = Date.now();
for (const key of ["easy", "medium", "hard"]) {
  const cfg = L3.DIFFICULTIES[key];
  const board = L3.makeBoard(cfg.size, cfg.kinds);
  assertBoardValid(board, key);
  console.log(`llk3d: ${key} ${cfg.size}^3 kinds=${cfg.kinds} valid, ${Date.now() - started}ms`);
}

/* 构造空 3x3x3 表面:默认全空(内部 -1) */
function emptyCube(n) {
  const d = L3.dimsCube(n);
  const occ = new Array(n * n * n).fill(-1);
  const surf = L3.surfaceCells(d);
  for (const c of surf) occ[L3.idx(d, c.x, c.y, c.z)] = 0;
  return { d, occ };
}

// 0 折直线:同一条表面直线上两图块,中间为空
{
  const { d, occ } = emptyCube(3);
  occ[L3.idx(d, 0, 0, 1)] = 1;
  occ[L3.idx(d, 2, 0, 1)] = 1;
  const p = L3.findPath(occ, d, { x: 0, y: 0, z: 1 }, { x: 2, y: 0, z: 1 });
  assert(p !== null && p.length === 2, "straight surface line should connect with 0 turns");
}

// 跨棱边的直线:顶面 (1,0,2) -> 底面 (1,0,0),途经侧面格 (1,0,1)
{
  const { d, occ } = emptyCube(3);
  occ[L3.idx(d, 1, 0, 2)] = 2;
  occ[L3.idx(d, 1, 0, 0)] = 2;
  const p = L3.findPath(occ, d, { x: 1, y: 0, z: 2 }, { x: 1, y: 0, z: 0 });
  assert(p !== null && p.length === 2, "straight geodesic crossing cube edges should connect");
}

// 同行被挡 -> 绕顶面边缘(2 折,跨两侧棱):A(0,2,2) B(2,2,2),挡格 B1(1,2,2)
{
  const { d, occ } = emptyCube(3);
  occ[L3.idx(d, 0, 2, 2)] = 3;
  occ[L3.idx(d, 2, 2, 2)] = 3;
  occ[L3.idx(d, 1, 2, 2)] = 4; // 挡在中间
  const p = L3.findPath(occ, d, { x: 0, y: 2, z: 2 }, { x: 2, y: 2, z: 2 });
  assert(p !== null && p.length === 4, "blocked row pair should route around face edge (2 turns): " + JSON.stringify(p));
  const cells = L3.expandPath(d, p);
  assert(cells !== null, "expanded path should exist");
  assert(cells.length >= 5 && cells.length <= 9, "expanded path length in plausible range, got " + cells.length);
  const first = cells[0];
  const last = cells[cells.length - 1];
  assert(first.x === 0 && first.y === 2 && first.z === 2 && last.x === 2 && last.y === 2 && last.z === 2,
    "expanded path endpoints should be the pair cells");
  const seen = new Set();
  let dup = false;
  for (const c of cells) {
    const k = c.x + "," + c.y + "," + c.z;
    if (seen.has(k)) dup = true;
    seen.add(k);
  }
  assert(!dup, "expanded path must not revisit cells");
  for (const c of cells) {
    const isEnd = (c.x === 0 && c.y === 2 && c.z === 2) || (c.x === 2 && c.y === 2 && c.z === 2);
    if (isEnd) continue;
    assert(L3.isSurfaceCell(d, c.x, c.y, c.z) && occ[L3.idx(d, c.x, c.y, c.z)] === 0,
      "intermediate cells of path must be empty surface cells");
  }
}

// 真实不可连:除 a、b 外表面全被占满 -> 无空拐点/通道
{
  const { d, occ } = emptyCube(3);
  occ[L3.idx(d, 0, 0, 0)] = 7;
  occ[L3.idx(d, 0, 2, 0)] = 7;
  const surf = L3.surfaceCells(d);
  for (const c of surf) {
    const i = L3.idx(d, c.x, c.y, c.z);
    if (occ[i] === 0) occ[i] = 9; // 其它表面格全部占满(异类)
  }
  const p = L3.findPath(occ, d, { x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 });
  assert(p === null, "pair fully surrounded by other tiles must NOT connect");
}

// 不同种类不可连
{
  const { d, occ } = emptyCube(3);
  occ[L3.idx(d, 0, 0, 0)] = 1;
  occ[L3.idx(d, 2, 0, 0)] = 2;
  const p = L3.findPath(occ, d, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
  assert(p === null, "different kinds must not connect");
}

// countRemaining / tiles / emptyCells
{
  const board = L3.makeBoard(3, 5); // 10 块
  assert(L3.countRemaining(board.occ) === 10, "countRemaining on fresh board");
  assert(L3.tiles(board.occ, board.d).length === 10, "tiles list length");
  const surfTotal = board.d.nx * 3 * 3 - 1; // 26
  void surfTotal;
  const empties = L3.emptyCells(board.occ, board.d).length;
  assert(empties === 26 - 10, "empty surface cell count");
}

// reshuffle:残留若干对后重排,应保持成对、有解且不溢出表面
{
  const cfg = L3.DIFFICULTIES.medium;
  const board = L3.makeBoard(cfg.size, cfg.kinds);
  const occ = board.occ.slice();
  // 只保留前 3 类(每类 2 格),其余清空
  const d = board.d;
  const keep = new Set();
  const tiles = L3.tiles(occ, d);
  const perKind = new Map();
  for (const t of tiles) {
    if (!perKind.has(t.kind)) perKind.set(t.kind, []);
    if (perKind.get(t.kind).length < 2 && t.kind <= 3) perKind.get(t.kind).push(t);
  }
  for (const list of perKind.values()) for (const c of list) keep.add(c.x + "," + c.y + "," + c.z);
  for (let x = 0; x < d.nx; x++)
    for (let y = 0; y < d.ny; y++)
      for (let z = 0; z < d.nz; z++) {
        const i = L3.idx(d, x, y, z);
        if (occ[i] > 0 && !keep.has(x + "," + y + "," + z)) occ[i] = 0;
      }
  assert(L3.countRemaining(occ) === 6, "fixture should leave exactly 6 tiles");
  const ok = L3.reshuffle({ d, occ });
  assert(ok === true, "reshuffle should succeed");
  const counts = {};
  const after = L3.tiles(occ, d);
  for (const t of after) counts[t.kind] = (counts[t.kind] || 0) + 1;
  for (const k of Object.keys(counts)) assert(counts[k] % 2 === 0, "after reshuffle counts stay even");
  assert(L3.findAnyPair(occ, d) !== null, "after reshuffle a move must exist");
  console.log("llk3d: reshuffle keeps pairs and guarantees a move");
}

console.log("ALL LLK3D LOGIC CHECKS PASSED");
