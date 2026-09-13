/* Platform-agnostic Link-Link rules, level flow, and 3D geometry. */
export const EMOJI_POOL = [
  "🍎", "🍌", "🍇", "🍊", "🍓", "🍉", "🍑", "🍒", "🥝", "🍍", "🥥", "🥭",
  "🍋", "🫐", "🍈", "🍐", "🍅", "🥑", "🌽", "🥕", "🍄", "🥦", "🍆", "🌶️",
];

/* 3D 立体玩法难度:size = 魔方边长(每边小格数),kinds = 图案种类数
 * (每类恰好 2 个,贴在外表面格上)。 */
export const LLK3D_DIFFICULTIES = {
  easy: { name: "简单", size: 3, kinds: 6 }, // 26 表面格,12 块
  medium: { name: "中等", size: 4, kinds: 12 }, // 56 表面格,24 块
  hard: { name: "困难", size: 5, kinds: 18 }, // 98 表面格,36 块
};

/* 难度:rows×cols 需可被 kinds 整除且每类数量为偶数。 */
export const DIFFICULTIES = {
  easy: { name: "简单", rows: 6, cols: 8, kinds: 8 }, // 48 格,每类 6 个(3 对)
  medium: { name: "中等", rows: 8, cols: 10, kinds: 10 }, // 80 格,每类 8 个(4 对)
  hard: { name: "困难", rows: 10, cols: 12, kinds: 12 }, // 120 格,每类 10 个(5 对)
};

/* 连线动画时长与消除延时(ms) */
const LINE_MS = 260;
const CLEAR_MS = 160;
const DROP_MS = 320;
const DROP_EASING = "cubic-bezier(0.22, 0.75, 0.28, 1)";
export const CHALLENGE_CONFIG = Object.freeze({
  timeLimitSeconds: 90,
  hintLimit: 1,
  shuffleLimit: 0,
});
export const CHALLENGE_MISTAKE_PENALTY_MS = 3000;
export const CHALLENGE_MISTAKE_PENALTY_SECONDS = CHALLENGE_MISTAKE_PENALTY_MS / 1000;

export function makeBoard(rows, cols, kinds, rng = Math.random) {
  const total = rows * cols;
  const perKind = total / kinds;
  if (total % 2 !== 0) throw new Error("board cells must be even");
  if (perKind % 2 !== 0) throw new Error("each kind needs an even count");
  if (kinds > EMOJI_POOL.length) throw new Error("too many kinds for emoji pool");
  if (!Number.isInteger(perKind)) throw new Error("kinds must divide total cells evenly");

  /* 图案清单:每类 perKind 个,按 id 编号(1..kinds) */
  const list = [];
  for (let k = 1; k <= kinds; k++) {
    for (let n = 0; n < perKind; n++) list.push(k);
  }
  shuffle(list, rng);

  /* 构造"必有一解"的开局:把第一类图案的两个放在首行 0、1 列
   * (同行相邻,直线必然可连),保证开局不是死局。 */
  const grid = new Array(total).fill(0);
  grid[0] = 1;
  grid[1] = 1;

  // list 中扣除已放入 grid[0]、grid[1] 的 2 个 1 号,其余全部进入 rest 随机填充
  let placedOnes = 2;
  const rest = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] === 1 && placedOnes > 0) {
      placedOnes--;
      continue;
    }
    rest.push(list[i]);
  }
  shuffle(rest, rng);
  for (let i = 2; i < total; i++) grid[i] = rest[i - 2];

  return { rows, cols, kinds, grid };
}

export function shuffle(list, rng = Math.random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

export function challengeConfig() {
  return { ...CHALLENGE_CONFIG };
}

export function createChallengeState(config) {
  const source = config && typeof config === "object" ? config : CHALLENGE_CONFIG;
  const integerAtLeastZero = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
  };
  return {
    timeLimitSeconds: integerAtLeastZero(source.timeLimitSeconds, CHALLENGE_CONFIG.timeLimitSeconds),
    hintsRemaining: integerAtLeastZero(source.hintLimit, CHALLENGE_CONFIG.hintLimit),
    shufflesRemaining: integerAtLeastZero(source.shuffleLimit, CHALLENGE_CONFIG.shuffleLimit),
  };
}

export function consumeChallengeResource(state, resource) {
  const current = state && typeof state === "object" ? state : createChallengeState();
  const field = resource === "hint"
    ? "hintsRemaining"
    : (resource === "shuffle" ? "shufflesRemaining" : null);
  if (!field || current[field] <= 0) return { ok: false, state: { ...current } };
  return { ok: true, state: { ...current, [field]: current[field] - 1 } };
}

export function remainingChallengeSeconds(timeLimitSeconds, activeMs) {
  const limit = Number(timeLimitSeconds);
  const elapsed = Number(activeMs);
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  return Math.max(0, safeLimit - Math.floor(safeElapsed / 1000));
}

export function challengeRating(input) {
  const source = input && typeof input === "object" ? input : {};
  const limit = Number(source.timeLimitSeconds);
  const elapsed = Number(source.elapsedSeconds);
  const combo = Number(source.maxCombo);
  const safeLimit = Number.isFinite(limit) ? Math.max(0, limit) : CHALLENGE_CONFIG.timeLimitSeconds;
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : safeLimit;
  const safeCombo = Number.isFinite(combo) ? Math.max(0, combo) : 0;
  if (safeElapsed > safeLimit) return { stars: 0, label: "未完成" };

  let stars = 1;
  if (safeLimit > 0 && safeElapsed <= safeLimit * 0.75) stars = 2;
  if (safeLimit > 0 && safeElapsed <= safeLimit * 0.5 && safeCombo >= 3) stars = 3;
  return { stars, label: ["未完成", "一星", "二星", "三星"][stars] };
}

/* 坐标是否为棋盘外虚拟通道(恒视为空) */
function isOutside(rows, cols, r, c) {
  return r < 0 || r >= rows || c < 0 || c >= cols;
}

/* (r,c) 处是否为空:虚拟通道或 grid 值为 0 */
export function isEmptyCell(grid, rows, cols, r, c) {
  if (isOutside(rows, cols, r, c)) return true;
  return grid[r * cols + c] === 0;
}

/* 水平或垂直直线段 a→b(含两端)之间是否全空。
 * 要求 a、b 同行或同列;只检查二者之间的格(不含 a、b 自身)。 */
export function segmentClear(grid, rows, cols, a, b) {
  if (a.r === b.r) {
    const c1 = Math.min(a.c, b.c);
    const c2 = Math.max(a.c, b.c);
    for (let c = c1 + 1; c < c2; c++) {
      if (!isEmptyCell(grid, rows, cols, a.r, c)) return false;
    }
    return true;
  }
  if (a.c === b.c) {
    const r1 = Math.min(a.r, b.r);
    const r2 = Math.max(a.r, b.r);
    for (let r = r1 + 1; r < r2; r++) {
      if (!isEmptyCell(grid, rows, cols, r, a.c)) return false;
    }
    return true;
  }
  return false;
}

/* 求两点间 ≤2 折的连通路径。
 * 参数 a、b: { r, c }。返回拐点数组(含端点):
 *   [a, b]                直线(0 折)
 *   [a, corner, b]        1 折
 *   [a, p, q, b]          2 折
 * 不可连通返回 null。 */
export function findPath(grid, rows, cols, a, b) {
  if (a.r === b.r && a.c === b.c) return null;
  const va = grid[a.r * cols + a.c];
  const vb = grid[b.r * cols + b.c];
  if (va <= 0 || vb <= 0 || va !== vb) return null;

  // 0 折:同行或同列直线
  if ((a.r === b.r || a.c === b.c) && segmentClear(grid, rows, cols, a, b)) {
    return [a, b];
  }

  // 1 折:拐点在 (a.r, b.c) 或 (b.r, a.c),拐点须为空
  const corners1 = [
    { r: a.r, c: b.c },
    { r: b.r, c: a.c },
  ];
  for (let i = 0; i < corners1.length; i++) {
    const p = corners1[i];
    if (isEmptyCell(grid, rows, cols, p.r, p.c) && segmentClear(grid, rows, cols, a, p) && segmentClear(grid, rows, cols, p, b)) {
      return [a, p, b];
    }
  }

  // 2 折:两段直线 + 中间一段直线。
  // 形如"横-竖-横":a→(a.r,k) → (b.r,k)→b,枚举列 k(含两侧虚拟列);
  // 形如"竖-横-竖":a→(k,a.c) → (k,b.c)→b,枚举行 k(含两侧虚拟行)。
  for (let k = -1; k <= cols; k++) {
    const p = { r: a.r, c: k };
    const q = { r: b.r, c: k };
    if (isEmptyCell(grid, rows, cols, p.r, p.c) && isEmptyCell(grid, rows, cols, q.r, q.c) && segmentClear(grid, rows, cols, a, p) && segmentClear(grid, rows, cols, p, q) && segmentClear(grid, rows, cols, q, b)) {
      return [a, p, q, b];
    }
  }
  for (let k = -1; k <= rows; k++) {
    const p = { r: k, c: a.c };
    const q = { r: k, c: b.c };
    if (isEmptyCell(grid, rows, cols, p.r, p.c) && isEmptyCell(grid, rows, cols, q.r, q.c) && segmentClear(grid, rows, cols, a, p) && segmentClear(grid, rows, cols, p, q) && segmentClear(grid, rows, cols, q, b)) {
      return [a, p, q, b];
    }
  }
  return null;
}

/* 将测试传入的二维棋盘转换为游戏内部使用的一维棋盘。 */
export function normalizeGrid(grid, rows, cols) {
  if (!Array.isArray(grid)) return null;
  if (!Array.isArray(grid[0])) return grid;
  const flat = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      flat.push(grid[r] && grid[r][c]);
    }
  }
  return flat;
}

export function isBoardCell(rows, cols, cell) {
  return !!cell && Number.isInteger(cell.r) && Number.isInteger(cell.c) &&
    cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols;
}

/* 忽略转弯次数限制的可达性检查。访问状态包含方向，避免在空通道中绕圈。 */
function hasUnrestrictedPath(grid, rows, cols, a, b) {
  const directions = [
    { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 },
  ];
  const queue = [{ r: a.r, c: a.c, dir: -1 }];
  const visited = new Set([a.r + "," + a.c + ",-1"]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (let dir = 0; dir < directions.length; dir++) {
      const nextR = current.r + directions[dir].r;
      const nextC = current.c + directions[dir].c;
      if (nextR < -1 || nextR > rows || nextC < -1 || nextC > cols) continue;
      if (nextR === b.r && nextC === b.c) return true;
      if (!isEmptyCell(grid, rows, cols, nextR, nextC)) continue;
      const key = nextR + "," + nextC + "," + dir;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ r: nextR, c: nextC, dir });
    }
  }
  return false;
}

/* 返回配对失败原因；合法路径返回 null。 */
export function explainPairFailure(grid, rows, cols, a, b) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 ||
      !isBoardCell(rows, cols, a) || !isBoardCell(rows, cols, b)) {
    return "请选择两个有效图案";
  }
  const board = normalizeGrid(grid, rows, cols);
  if (!board) return "请选择两个有效图案";
  const va = board[a.r * cols + a.c];
  const vb = board[b.r * cols + b.c];
  if (va <= 0 || vb <= 0) return "请选择两个有效图案";
  if (a.r === b.r && a.c === b.c) return "不能选择同一图案";
  if (va !== vb) return "图案不一致";
  if (findPath(board, rows, cols, a, b)) return null;
  return hasUnrestrictedPath(board, rows, cols, a, b)
    ? "无法连接：路径超过两次转弯"
    : "无法连接：中间有图案阻挡";
}

/* 全盘扫描:返回任意一对可连的格子坐标,无则 null(用于死局检测)。 */
export function findAnyPair(grid, rows, cols) {
  const total = rows * cols;
  for (let i = 0; i < total; i++) {
    if (grid[i] <= 0) continue;
    const a = { r: Math.floor(i / cols), c: i % cols };
    for (let j = i + 1; j < total; j++) {
      if (grid[j] !== grid[i]) continue;
      const b = { r: Math.floor(j / cols), c: j % cols };
      if (findPath(grid, rows, cols, a, b)) return { a, b };
    }
  }
  return null;
}

/* 统计剩余非空格数 */
export function countRemaining(grid) {
  let n = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > 0) n += 1;
  return n;
}

/* 将逻辑下落记录转换为 DOM 动画所需的行列位移。 */
export function makeDropPlan(moves, cols) {
  if (!Array.isArray(moves) || !Number.isInteger(cols) || cols <= 0) return [];
  return moves
    .filter((move) => move && Number.isInteger(move.from) && Number.isInteger(move.to) && move.from !== move.to)
    .map((move) => ({
      from: move.from,
      to: move.to,
      value: move.value,
      deltaRows: Math.floor(move.to / cols) - Math.floor(move.from / cols),
      deltaCols: (move.to % cols) - (move.from % cols),
    }));
}

/* 将剩余图案重新随机铺满所有空位,并保证重排后至少存在一对可连。
 * 失败保护:尝试若干次随机排布;仍无解时把某个仍有 ≥2 个的图案
 * 强制放到一对相邻空位(此时其它格全空,相邻对必然可连)。 */
export function reshuffle(grid, rows, cols, random = Math.random) {
  const total = rows * cols;
  const remaining = [];
  const slots = [];
  for (let i = 0; i < total; i++) {
    if (grid[i] !== -1) slots.push(i);
    if (grid[i] > 0) remaining.push(grid[i]);
  }
  if (remaining.length === 0 || slots.length < remaining.length) return false;

  const place = (arr) => {
    for (const index of slots) grid[index] = 0;
    for (let i = 0; i < arr.length; i++) grid[slots[i]] = arr[i];
  };

  // 尝试随机排布直至有解(上限 80 次)
  for (let attempt = 0; attempt < 80; attempt++) {
    place(shuffle(remaining.slice(), random));
    if (findAnyPair(grid, rows, cols)) return true;
  }

  // 保底:找仍有 ≥2 个的图案,放入一对"同行相邻空位"
  const kinds = new Set(remaining);
  for (const pairKind of kinds) {
    if (remaining.filter((v) => v === pairKind).length < 2) continue;
    for (let a = 0; a < slots.length; a++) for (let b = a + 1; b < slots.length; b++) {
      const next = grid.slice();
      for (const index of slots) next[index] = 0;
      next[slots[a]] = pairKind;
      next[slots[b]] = pairKind;
      const candidate = remaining.slice();
      let removed = 0;
      for (let i = candidate.length - 1; i >= 0; i--) if (candidate[i] === pairKind && removed < 2) { candidate.splice(i, 1); removed++; }
      let cursor = 0;
      for (let i = 0; i < slots.length && cursor < candidate.length; i++) {
        if (i === a || i === b) continue;
        next[slots[i]] = candidate[cursor++];
      }
      for (const index of slots) grid[index] = next[index];
      if (findAnyPair(grid, rows, cols)) return true;
    }
  }
  return false;
}

export function reshuffleLevel(input, rows, cols, findPair, random = Math.random) {
  const source = input.slice();
  if (typeof findPair !== "function") throw new TypeError("reshuffle requires a pair finder");
  const slots = source.map((value, index) => value === -1 ? -1 : index).filter((index) => index >= 0);
  const tiles = source.filter((value) => value > 0);
  const tileCounts = new Map();
  for (const tile of tiles) tileCounts.set(tile, (tileCounts.get(tile) || 0) + 1);

  for (let attempt = 0; attempt < 80; attempt++) {
    const next = source.slice();
    for (const index of slots) next[index] = 0;
    const shuffled = tiles.slice();
    shuffle(shuffled, random);
    for (let index = 0; index < shuffled.length; index++) next[slots[index]] = shuffled[index];
    if (findPair(next, rows, cols)) return { ok: true, grid: next };
  }

  for (const [kind, count] of tileCounts) if (count >= 2) {
    for (let first = 0; first < slots.length; first++) for (let second = first + 1; second < slots.length; second++) {
      const next = source.slice();
      for (const index of slots) next[index] = 0;
      next[slots[first]] = kind;
      next[slots[second]] = kind;
      const rest = tiles.slice();
      rest.splice(rest.indexOf(kind), 1);
      rest.splice(rest.indexOf(kind), 1);
      let cursor = 0;
      for (let index = 0; index < slots.length && cursor < rest.length; index++) {
        if (index !== first && index !== second) next[slots[index]] = rest[cursor++];
      }
      if (findPair(next, rows, cols)) return { ok: true, grid: next };
    }
  }
  return { ok: false, grid: source };
}

/* ------------------------- 关卡流程纯逻辑 ------------------------- */

const LEVEL_PROGRESS_KEY = "lianliankan-level-progress-v1";
const LEVEL_PROGRESS_VERSION = 1;
const MAX_LEVEL_ID = 5;
const COMBO_WINDOW_MS = 3000;
const PAIR_SCORE = 100;
const COMBO_BONUS = 25;
const LEVEL_CLEAR_BONUS = 500;

export function defaultLevelProgress() {
  return { version: LEVEL_PROGRESS_VERSION, unlockedLevel: 1, completed: {} };
}

function normalizeLevelProgress(value) {
  if (!value || value.version !== LEVEL_PROGRESS_VERSION || !Number.isInteger(value.unlockedLevel) ||
      value.unlockedLevel < 1 || value.unlockedLevel > MAX_LEVEL_ID + 1 ||
      !value.completed || typeof value.completed !== "object" || Array.isArray(value.completed)) {
    return defaultLevelProgress();
  }
  const completed = {};
  let highestCompleted = 0;
  for (const key of Object.keys(value.completed)) {
    if (!/^[1-5]$/.test(key)) return defaultLevelProgress();
    const result = value.completed[key];
    if (!result || typeof result !== "object" || Array.isArray(result) ||
        !Number.isFinite(result.score) || result.score < 0 ||
        !Number.isFinite(result.time) || result.time < 0 ||
        !Number.isFinite(result.combo) || result.combo < 0 ||
        (Object.prototype.hasOwnProperty.call(result, "stars") &&
          (!Number.isFinite(result.stars) || result.stars < 1 || result.stars > 3))) {
      return defaultLevelProgress();
    }
    const normalizedResult = {
      score: Math.floor(result.score),
      time: Math.floor(result.time),
      combo: Math.floor(result.combo),
    };
    if (Object.prototype.hasOwnProperty.call(result, "stars")) {
      normalizedResult.stars = Math.floor(result.stars);
    }
    completed[key] = normalizedResult;
    highestCompleted = Math.max(highestCompleted, Number(key));
  }
  for (let id = 1; id <= highestCompleted; id += 1) {
    if (!completed[String(id)]) return defaultLevelProgress();
  }
  if (value.unlockedLevel !== Math.min(MAX_LEVEL_ID + 1, highestCompleted + 1)) {
    return defaultLevelProgress();
  }
  return { version: LEVEL_PROGRESS_VERSION, unlockedLevel: value.unlockedLevel, completed };
}

export function readLevelProgress(storage) {
  try {
    if (!storage || typeof storage.getItem !== "function") return defaultLevelProgress();
    return normalizeLevelProgress(JSON.parse(storage.getItem(LEVEL_PROGRESS_KEY)));
  } catch (err) {
    return defaultLevelProgress();
  }
}

export function writeLevelProgress(progress, storage) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify(normalizeLevelProgress(progress)));
    return true;
  } catch (err) {
    return false;
  }
}

export function recordLevelCompletion(progress, levelId, result) {
  const current = normalizeLevelProgress(progress);
  const numericLevelId = Number(levelId);
  if (!Number.isInteger(numericLevelId) || numericLevelId < 1 || numericLevelId > MAX_LEVEL_ID) return current;
  const key = String(numericLevelId);
  const previous = current.completed[key];
  const source = result && typeof result === "object" ? result : {};
  const score = Number.isFinite(source.score) && source.score >= 0 ? Math.floor(source.score) : 0;
  const time = Number.isFinite(source.time) && source.time >= 0 ? Math.floor(source.time) : 0;
  const combo = Number.isFinite(source.combo) && source.combo >= 0 ? Math.floor(source.combo) : 0;
  const stars = Number.isFinite(source.stars) && source.stars >= 1 && source.stars <= 3
    ? Math.floor(source.stars)
    : null;
  const completion = {
    score: previous ? Math.max(previous.score, score) : score,
    time: previous ? Math.min(previous.time, time) : time,
    combo: previous ? Math.max(previous.combo, combo) : combo,
  };
  if (stars !== null || (previous && Number.isInteger(previous.stars))) {
    completion.stars = previous && Number.isInteger(previous.stars)
      ? Math.max(previous.stars, stars || 0)
      : stars;
  }
  current.completed[key] = completion;
  current.unlockedLevel = Math.max(current.unlockedLevel, numericLevelId + 1);
  return current;
}

export function nextPairScore(state, activeMs) {
  const inWindow = state.lastSuccessMs !== null && activeMs - state.lastSuccessMs <= COMBO_WINDOW_MS;
  const combo = inWindow ? state.combo + 1 : 1;
  return {
    score: state.score + PAIR_SCORE + Math.max(0, combo - 1) * COMBO_BONUS,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    lastSuccessMs: activeMs,
  };
}

export function resetLevelCombo(state) {
  return { score: state.score, combo: 0, maxCombo: state.maxCombo, lastSuccessMs: null };
}

export function expireLevelCombo(state, activeMs) {
  if (state.combo > 0 && state.lastSuccessMs !== null && activeMs - state.lastSuccessMs > COMBO_WINDOW_MS) {
    return resetLevelCombo(state);
  }
  return {
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    lastSuccessMs: state.lastSuccessMs,
  };
}

export function scorePairForMode(state, activeMs, levelMode) {
  return levelMode ? nextPairScore(state, activeMs) : {
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    lastSuccessMs: state.lastSuccessMs,
  };
}

export function applyLevelClearBonus(score, levelMode) {
  return levelMode ? score + LEVEL_CLEAR_BONUS : score;
}

export function isSelectableTile(value) {
  return value > 0;
}

export function findHintPair(grid, rows, cols, finder) {
  return typeof finder === "function" ? finder(grid.slice(), rows, cols) : null;
}

export function ensureLevelSolvable(grid, rows, cols, levelApi, finder, random) {
  const board = grid.slice();
  if (finder(board, rows, cols)) return { grid: board, autoReshuffled: false };
  if (!levelApi || typeof levelApi.reshuffle !== "function") return { grid: board, autoReshuffled: false };
  const result = levelApi.reshuffle(board, rows, cols, finder, random);
  return { grid: result.grid, autoReshuffled: !!result.ok };
}

/* --------------------------- 3D 纯逻辑 --------------------------- */

export function isSurfaceCell3D(d, x, y, z) {
  return x === 0 || x === d.nx - 1 || y === 0 || y === d.ny - 1 || z === 0 || z === d.nz - 1;
}

export function idx3D(d, x, y, z) {
  return (x * d.ny + y) * d.nz + z;
}

export function dimsCube3D(n) {
  return { nx: n, ny: n, nz: n };
}

export function axisDiff3D(p, q) {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  const dz = p.z - q.z;
  const diffs = (dx !== 0 ? 1 : 0) + (dy !== 0 ? 1 : 0) + (dz !== 0 ? 1 : 0);
  if (diffs !== 1) return -1;
  if (dx !== 0) return 0;
  if (dy !== 0) return 1;
  return 2;
}

export function surfaceCellList3D(d) {
  const out = [];
  for (let x = 0; x < d.nx; x++)
    for (let y = 0; y < d.ny; y++)
      for (let z = 0; z < d.nz; z++)
        if (isSurfaceCell3D(d, x, y, z)) out.push({ x, y, z });
  return out;
}

export function emptySurfaceList3D(occ, d) {
  const out = [];
  for (let x = 0; x < d.nx; x++)
    for (let y = 0; y < d.ny; y++)
      for (let z = 0; z < d.nz; z++)
        if (isSurfaceCell3D(d, x, y, z) && occ[idx3D(d, x, y, z)] === 0) out.push({ x, y, z });
  return out;
}

export function tileList3D(occ, d) {
  const out = [];
  for (let x = 0; x < d.nx; x++)
    for (let y = 0; y < d.ny; y++)
      for (let z = 0; z < d.nz; z++) {
        const v = occ[idx3D(d, x, y, z)];
        if (v > 0) out.push({ x, y, z, kind: v });
      }
  return out;
}

/* 沿 axis 从 p 到 q 的中间格(不含端点)是否全为表面空格 */
function legClear3D(occ, d, p, q, axis) {
  const pv = [p.x, p.y, p.z];
  const qv = [q.x, q.y, q.z];
  const lo = Math.min(pv[axis], qv[axis]) + 1;
  const hi = Math.max(pv[axis], qv[axis]);
  for (let v = lo; v < hi; v++) {
    const x = axis === 0 ? v : pv[0];
    const y = axis === 1 ? v : pv[1];
    const z = axis === 2 ? v : pv[2];
    if (!isSurfaceCell3D(d, x, y, z)) return false;
    if (occ[idx3D(d, x, y, z)] !== 0) return false;
  }
  return true;
}

/* 把拐点序列展开为逐格路径(含端点);非法返回 null */
export function expandPath3D(d, corners) {
  const out = [];
  const pushCell = (c) => {
    const last = out[out.length - 1];
    if (!last || last.x !== c.x || last.y !== c.y || last.z !== c.z) out.push({ x: c.x, y: c.y, z: c.z });
  };
  for (let i = 0; i + 1 < corners.length; i++) {
    const p = corners[i];
    const q = corners[i + 1];
    const ax = axisDiff3D(p, q);
    if (ax < 0) return null;
    const pv = [p.x, p.y, p.z];
    const qv = [q.x, q.y, q.z];
    const step = qv[ax] > pv[ax] ? 1 : -1;
    const cu = [pv[0], pv[1], pv[2]];
    pushCell(p);
    while (cu[ax] !== qv[ax]) {
      cu[ax] += step;
      pushCell({ x: cu[0], y: cu[1], z: cu[2] });
    }
  }
  return out;
}

/* 求两点间 ≤2 次转弯、全程沿表面的路径;返回拐点序列或 null */
export function find3DPath(occ, d, a, b) {
  const va = occ[idx3D(d, a.x, a.y, a.z)];
  const vb = occ[idx3D(d, b.x, b.y, b.z)];
  if (va === 0 || va !== vb) return null;
  if (a.x === b.x && a.y === b.y && a.z === b.z) return null;

  // 0 折:同一直线
  const dab = axisDiff3D(a, b);
  if (dab >= 0 && legClear3D(occ, d, a, b, dab)) return [a, b];

  const empties = emptySurfaceList3D(occ, d);

  // 1 折:一个拐点(须为表面空格)
  for (let i = 0; i < empties.length; i++) {
    const t = empties[i];
    const ax = axisDiff3D(a, t);
    if (ax < 0) continue;
    const bx = axisDiff3D(t, b);
    if (bx < 0 || bx === ax) continue;
    if (legClear3D(occ, d, a, t, ax) && legClear3D(occ, d, t, b, bx)) return [a, t, b];
  }

  // 2 折:两个拐点(三段各自沿一条坐标轴,且路径不自交)
  for (let i = 0; i < empties.length; i++) {
    const t1 = empties[i];
    const ax = axisDiff3D(a, t1);
    if (ax < 0) continue;
    for (let j = 0; j < empties.length; j++) {
      if (j === i) continue;
      const t2 = empties[j];
      const mx = axisDiff3D(t1, t2);
      if (mx < 0 || mx === ax) continue;
      const bx = axisDiff3D(t2, b);
      if (bx < 0 || bx === mx) continue;
      if (!legClear3D(occ, d, a, t1, ax)) continue;
      if (!legClear3D(occ, d, t1, t2, mx)) continue;
      if (!legClear3D(occ, d, t2, b, bx)) continue;
      const cells = expandPath3D(d, [a, t1, t2, b]);
      if (!cells) continue;
      const seen = new Set();
      let dup = false;
      for (let k = 0; k < cells.length; k++) {
        const key = cells[k].x + "," + cells[k].y + "," + cells[k].z;
        if (seen.has(key)) {
          dup = true;
          break;
        }
        seen.add(key);
      }
      if (!dup) return [a, t1, t2, b];
    }
  }
  return null;
}

/* 扫描是否存在可消除配对 */
export function find3DAnyPair(occ, d) {
  const byKind = new Map();
  const tiles = tileList3D(occ, d);
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!byKind.has(t.kind)) byKind.set(t.kind, []);
    byKind.get(t.kind).push(t);
  }
  for (const group of byKind.values()) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        if (find3DPath(occ, d, group[i], group[j])) return { a: group[i], b: group[j] };
      }
  }
  return null;
}

export function count3DRemaining(occ) {
  let n = 0;
  for (let i = 0; i < occ.length; i++) if (occ[i] > 0) n += 1;
  return n;
}

export function sameCell3D(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function make3DBoard(size, kinds, rng = Math.random) {
  const d = dimsCube3D(size);
  const surf = surfaceCellList3D(d);
  const total = d.nx * d.ny * d.nz;
  if (kinds * 2 > surf.length) throw new Error("too many tiles for surface cells");
  if (kinds > EMOJI_POOL.length) throw new Error("too many kinds for emoji pool");
  const occ = new Array(total).fill(-1);
  for (let i = 0; i < surf.length; i++) occ[idx3D(d, surf[i].x, surf[i].y, surf[i].z)] = 0;

  const usedKeys = new Set();
  const keyOf = (c) => c.x + "," + c.y + "," + c.z;
  const claim = (c, kind) => {
    usedKeys.add(keyOf(c));
    occ[idx3D(d, c.x, c.y, c.z)] = kind;
  };
  const DIRS = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];

  // 第 1 类:两个相邻表面格(直线必连,保证开局非死局)
  let placed = false;
  for (let attempt = 0; attempt < 500 && !placed; attempt++) {
    const c = surf[Math.floor(rng() * surf.length)];
    if (usedKeys.has(keyOf(c))) continue;
    const nbrs = [];
    for (let i = 0; i < DIRS.length; i++) {
      const nx = c.x + DIRS[i][0];
      const ny = c.y + DIRS[i][1];
      const nz = c.z + DIRS[i][2];
      if (nx < 0 || nx >= d.nx || ny < 0 || ny >= d.ny || nz < 0 || nz >= d.nz) continue;
      if (!isSurfaceCell3D(d, nx, ny, nz)) continue;
      if (!usedKeys.has(nx + "," + ny + "," + nz)) nbrs.push({ x: nx, y: ny, z: nz });
    }
    if (nbrs.length === 0) continue;
    const nb = nbrs[Math.floor(rng() * nbrs.length)];
    claim(c, 1);
    claim(nb, 1);
    placed = true;
  }
  if (!placed) throw new Error("failed to place guaranteed pair");

  for (let k = 2; k <= kinds; k++) {
    for (let n = 0; n < 2; n++) {
      let cell = null;
      for (let attempt = 0; attempt < 800 && !cell; attempt++) {
        const c = surf[Math.floor(rng() * surf.length)];
        if (!usedKeys.has(keyOf(c))) cell = c;
      }
      if (!cell) throw new Error("surface full while placing board");
      claim(cell, k);
    }
  }
  return { d, kinds, occ };
}

/* 重排剩余图块,保证重排后至少存在一对可连(就地修改 occ) */
export function reshuffle3D(board, rng = Math.random) {
  const d = board.d;
  const occ = board.occ;
  const cells = emptySurfaceList3D(occ, d);
  if (cells.length < 4) return false;

  // 剩余图块按“每类恰好 2 个”收集(本玩法设计如此;异常时按偶数收集)
  const counts = new Map();
  const tiles = tileList3D(occ, d);
  for (let i = 0; i < tiles.length; i++) {
    const k = tiles[i].kind;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const kindsLeft = [];
  for (const entry of counts) if (entry[1] % 2 === 0) kindsLeft.push(entry[0]);
  if (kindsLeft.length === 0) return false;

  const DIRS = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  const clear = () => {
    for (let i = 0; i < occ.length; i++) if (occ[i] > 0) occ[i] = 0;
  };

  // 随机铺放若干次,直到有解
  for (let attempt = 0; attempt < 80; attempt++) {
    clear();
    const pool = emptySurfaceList3D(occ, d);
    shuffle(pool, rng);
    if (pool.length < kindsLeft.length * 2) break;
    const order = shuffle(kindsLeft.slice(), rng);
    let pi = 0;
    for (let i = 0; i < order.length; i++) {
      const c1 = pool[pi++];
      const c2 = pool[pi++];
      occ[idx3D(d, c1.x, c1.y, c1.z)] = order[i];
      occ[idx3D(d, c2.x, c2.y, c2.z)] = order[i];
    }
    if (find3DAnyPair(occ, d)) return true;
  }

  // 保底:任选一类放到一对相邻空格(相邻必可直线消除)
  for (let attempt = 0; attempt < 300; attempt++) {
    clear();
    const pool = emptySurfaceList3D(occ, d);
    shuffle(pool, rng);
    if (pool.length < kindsLeft.length * 2) break;
    const pickKind = kindsLeft[Math.floor(rng() * kindsLeft.length)];
    // 找一对相邻空格
    let anchor = null;
    let mate = null;
    for (let i = 0; i < pool.length && !anchor; i++) {
      const c = pool[i];
      for (let j = 0; j < DIRS.length; j++) {
        const nx = c.x + DIRS[j][0];
        const ny = c.y + DIRS[j][1];
        const nz = c.z + DIRS[j][2];
        if (nx < 0 || nx >= d.nx || ny < 0 || ny >= d.ny || nz < 0 || nz >= d.nz) continue;
        if (!isSurfaceCell3D(d, nx, ny, nz)) continue;
        if (occ[idx3D(d, nx, ny, nz)] !== 0) continue;
        anchor = c;
        mate = { x: nx, y: ny, z: nz };
        break;
      }
    }
    if (!anchor || !mate) continue;
    occ[idx3D(d, anchor.x, anchor.y, anchor.z)] = pickKind;
    occ[idx3D(d, mate.x, mate.y, mate.z)] = pickKind;
    // 其余类铺到剩余空格
    const restKinds = kindsLeft.filter((k) => k !== pickKind);
    shuffle(restKinds, rng);
    let pi = 0;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      if (sameCell3D(c, anchor) || sameCell3D(c, mate)) continue;
      if (pi < restKinds.length * 2) {
        const kind = restKinds[Math.floor(pi / 2)];
        occ[idx3D(d, c.x, c.y, c.z)] = kind;
        pi++;
      }
    }
    return true;
  }
  return false;
}
