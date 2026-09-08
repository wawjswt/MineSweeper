/* 独立连连看小游戏(与扫雷、数独相互独立,同页第三个 Tab)
 *
 * 设计约束:
 * 1. 本文件为普通 <script>(非 ES module),与 dist/bundle.js(扫雷)、
 *    sudoku-game.js 同页加载,共享全局词法环境,故整体包裹在 IIFE 中,
 *    所有顶层变量不外泄(仅暴露 window.__LLK__ 纯逻辑供测试)。
 * 2. 规则:棋盘上每类图案成对出现;依次点选两个相同图案,若两者可用
 *    "不超过两次转弯"的路径连通(路径不得穿过其它图案,允许绕棋盘
 *    外侧的虚拟通道),则消除;全部消除即通关。
 * 3. Tab 高亮与壳显隐由 src/game-tabs.js 统一仲裁,本脚本只注册
 *    onActivate / onDeactivate 生命周期回调(切走自动暂停、切回自动恢复)。
 * 4. 连连看激活时在捕获阶段拦截 R 键,避免误触扫雷"重开"。
 */
(function () {
  "use strict";

  /* ----------------------------- 配置 ----------------------------- */

  /* 图案集:全部使用单字符 emoji,同一图案用 id 编号表示。
   * 前 12 个为经典 2D 用;追加至 24 个供 3D 立体模式高难度使用。 */
  const EMOJI_POOL = [
    "🍎", "🍌", "🍇", "🍊", "🍓", "🍉", "🍑", "🍒", "🥝", "🍍", "🥥", "🥭",
    "🍋", "🫐", "🍈", "🍐", "🍅", "🥑", "🌽", "🥕", "🍄", "🥦", "🍆", "🌶️",
  ];

  /* 3D 立体玩法难度:size = 魔方边长(每边小格数),kinds = 图案种类数
   * (每类恰好 2 个,贴在外表面格上)。 */
  const LLK3D_DIFFICULTIES = {
    easy: { name: "简单", size: 3, kinds: 6 }, // 26 表面格,12 块
    medium: { name: "中等", size: 4, kinds: 12 }, // 56 表面格,24 块
    hard: { name: "困难", size: 5, kinds: 18 }, // 98 表面格,36 块
  };

  /* 难度:rows×cols 需可被 kinds 整除且每类数量为偶数。 */
  const DIFFICULTIES = {
    easy: { name: "简单", rows: 6, cols: 8, kinds: 8 }, // 48 格,每类 6 个(3 对)
    medium: { name: "中等", rows: 8, cols: 10, kinds: 10 }, // 80 格,每类 8 个(4 对)
    hard: { name: "困难", rows: 10, cols: 12, kinds: 12 }, // 120 格,每类 10 个(5 对)
  };

  /* 连线动画时长与消除延时(ms) */
  const LINE_MS = 260;
  const CLEAR_MS = 160;
  const DROP_MS = 320;
  const DROP_EASING = "cubic-bezier(0.22, 0.75, 0.28, 1)";

  /* ----------------------------- 纯逻辑 -----------------------------
   * 棋盘以二维索引 grid[r * cols + c] 存储,-1 = 障碍,0 = 空位,>0 = 图案 id(1..kinds)。
   * 连通判定允许路径经由"棋盘外侧一圈虚拟通道"(即越界的行列视为空),
   * 这也是经典连连看"绕外圈"的规则来源。
   */

  function makeBoard(rows, cols, kinds) {
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
    shuffle(list);

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
    shuffle(rest);
    for (let i = 2; i < total; i++) grid[i] = rest[i - 2];

    return { rows, cols, kinds, grid };
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /* 坐标是否为棋盘外虚拟通道(恒视为空) */
  function isOutside(rows, cols, r, c) {
    return r < 0 || r >= rows || c < 0 || c >= cols;
  }

  /* (r,c) 处是否为空:虚拟通道或 grid 值为 0 */
  function isEmptyCell(grid, rows, cols, r, c) {
    if (isOutside(rows, cols, r, c)) return true;
    return grid[r * cols + c] === 0;
  }

  /* 水平或垂直直线段 a→b(含两端)之间是否全空。
   * 要求 a、b 同行或同列;只检查二者之间的格(不含 a、b 自身)。 */
  function segmentClear(grid, rows, cols, a, b) {
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
  function findPath(grid, rows, cols, a, b) {
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
  function normalizeGrid(grid, rows, cols) {
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

  function isBoardCell(rows, cols, cell) {
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
  function explainPairFailure(grid, rows, cols, a, b) {
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
  function findAnyPair(grid, rows, cols) {
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
  function countRemaining(grid) {
    let n = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] > 0) n += 1;
    return n;
  }

  /* 将逻辑下落记录转换为 DOM 动画所需的行列位移。 */
  function makeDropPlan(moves, cols) {
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
  function reshuffle(grid, rows, cols) {
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
      place(shuffle(remaining.slice()));
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

  /* ------------------------- 关卡流程纯逻辑 ------------------------- */

  const LEVEL_PROGRESS_KEY = "lianliankan-level-progress-v1";
  const LEVEL_PROGRESS_VERSION = 1;
  const MAX_LEVEL_ID = 5;
  const COMBO_WINDOW_MS = 3000;
  const PAIR_SCORE = 100;
  const COMBO_BONUS = 25;
  const LEVEL_CLEAR_BONUS = 500;

  function defaultLevelProgress() {
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
          !Number.isFinite(result.combo) || result.combo < 0) {
        return defaultLevelProgress();
      }
      completed[key] = {
        score: Math.floor(result.score),
        time: Math.floor(result.time),
        combo: Math.floor(result.combo),
      };
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

  function readLevelProgress(storage) {
    try {
      if (!storage || typeof storage.getItem !== "function") return defaultLevelProgress();
      return normalizeLevelProgress(JSON.parse(storage.getItem(LEVEL_PROGRESS_KEY)));
    } catch (err) {
      return defaultLevelProgress();
    }
  }

  function writeLevelProgress(progress, storage) {
    try {
      if (!storage || typeof storage.setItem !== "function") return false;
      storage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify(normalizeLevelProgress(progress)));
      return true;
    } catch (err) {
      return false;
    }
  }

  function recordLevelCompletion(progress, levelId, result) {
    const current = normalizeLevelProgress(progress);
    const numericLevelId = Number(levelId);
    if (!Number.isInteger(numericLevelId) || numericLevelId < 1 || numericLevelId > MAX_LEVEL_ID) return current;
    const key = String(numericLevelId);
    const previous = current.completed[key];
    const source = result && typeof result === "object" ? result : {};
    const score = Number.isFinite(source.score) && source.score >= 0 ? Math.floor(source.score) : 0;
    const time = Number.isFinite(source.time) && source.time >= 0 ? Math.floor(source.time) : 0;
    const combo = Number.isFinite(source.combo) && source.combo >= 0 ? Math.floor(source.combo) : 0;
    current.completed[key] = {
      score: previous ? Math.max(previous.score, score) : score,
      time: previous ? Math.min(previous.time, time) : time,
      combo: previous ? Math.max(previous.combo, combo) : combo,
    };
    current.unlockedLevel = Math.max(current.unlockedLevel, numericLevelId + 1);
    return current;
  }

  function nextPairScore(state, activeMs) {
    const inWindow = state.lastSuccessMs !== null && activeMs - state.lastSuccessMs <= COMBO_WINDOW_MS;
    const combo = inWindow ? state.combo + 1 : 1;
    return {
      score: state.score + PAIR_SCORE + Math.max(0, combo - 1) * COMBO_BONUS,
      combo,
      maxCombo: Math.max(state.maxCombo, combo),
      lastSuccessMs: activeMs,
    };
  }

  function resetLevelCombo(state) {
    return { score: state.score, combo: 0, maxCombo: state.maxCombo, lastSuccessMs: null };
  }

  function expireLevelCombo(state, activeMs) {
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

  function scorePairForMode(state, activeMs, levelMode) {
    return levelMode ? nextPairScore(state, activeMs) : {
      score: state.score,
      combo: state.combo,
      maxCombo: state.maxCombo,
      lastSuccessMs: state.lastSuccessMs,
    };
  }

  function applyLevelClearBonus(score, levelMode) {
    return levelMode ? score + LEVEL_CLEAR_BONUS : score;
  }

  function isSelectableTile(value) {
    return value > 0;
  }

  function findHintPair(grid, rows, cols, finder) {
    return typeof finder === "function" ? finder(grid.slice(), rows, cols) : null;
  }

  function ensureLevelSolvable(grid, rows, cols, levelApi, finder, random) {
    const board = grid.slice();
    if (finder(board, rows, cols)) return { grid: board, autoReshuffled: false };
    if (!levelApi || typeof levelApi.reshuffle !== "function") return { grid: board, autoReshuffled: false };
    const result = levelApi.reshuffle(board, rows, cols, finder, random);
    return { grid: result.grid, autoReshuffled: !!result.ok };
  }

  /* ----------------------------- DOM 与游戏状态 ----------------------------- */

  const shell = document.getElementById("lianliankanShell");
  const boardEl = document.getElementById("llkBoard");
  const timerEl = document.getElementById("llkTimer");
  const statusEl = document.getElementById("llkStatus");
  const leftEl = document.getElementById("llkLeft");
  const difficultyEl = document.getElementById("llkDifficulty");
  const newBtn = document.getElementById("llkNew");
  const shuffleBtn = document.getElementById("llkShuffle");
  const pathLayer = document.getElementById("llkPathLayer");
  const modeEl = document.getElementById("llkMode");
  const stageEl = document.getElementById("llk3dStage");
  const toastEl = document.getElementById("llk3dToast");
  const taglineEl = document.getElementById("llkTagline");
  const hintEl = document.getElementById("llkHint");
  const hintBtn = document.getElementById("llkHintBtn");
  const scoreEl = document.getElementById("llkScore");
  const comboEl = document.getElementById("llkCombo");
  const levelPickerEl = document.getElementById("llkLevelPicker");
  let statusRevision = 0;
  let transientStatus = null;

  if (!shell || !boardEl || !timerEl || !statusEl || !leftEl) return;

  const game = {
    difficulty: "medium",
    rows: 0,
    cols: 0,
    kinds: 0,
    grid: null,
    sel: null, // 当前选中的第一格 { r, c } 或 null
    busy: false, // 正在播放连线/消除动画,锁定输入
    started: false,
    ended: false,
    paused: false,
    autoPaused: false, // 因切走 Tab 自动暂停(区别于手动)
    baseMs: 0,
    startAt: null,
    timerId: null,
    levelId: null,
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastSuccessMs: null,
    progress: null,
    animationToken: 0,
  };

  const cellEls = []; // 与 grid 索引一一对应的 button
  let llkActive = false;
  const pendingAnimationTimers = new Set();

  /* 当前玩法:classic(经典 2D)/ 3d(魔方表面 3D) */
  let llkModeKey = "classic";
  if (modeEl && modeEl.value === "3d") llkModeKey = "3d";

  /* 3D 模式状态容器:属性由下方「3D 立体模式」节填充(先声明避免 TDZ)。 */
  const llk3d = {};

  function activeMode3D() {
    return llkModeKey === "3d" && !!llk3d.occ;
  }

  function nowMs() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function elapsedSeconds() {
    const extra = game.startAt === null ? 0 : nowMs() - game.startAt;
    return Math.floor((game.baseMs + extra) / 1000);
  }

  function elapsedActiveMs() {
    return game.baseMs + (game.startAt === null ? 0 : nowMs() - game.startAt);
  }

  function getLevelApi() {
    return typeof window !== "undefined" ? window.__LLK_LEVELS__ : null;
  }

  function getLocalStorage() {
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch (err) {
      return null;
    }
  }

  function isLevelMode() {
    return llkModeKey === "levels" && game.levelId !== null;
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(game.score);
    if (comboEl) comboEl.textContent = "×" + game.combo;
  }

  function resetRunStats() {
    game.score = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.lastSuccessMs = null;
    renderScore();
  }

  function awardPair() {
    const next = scorePairForMode({
      score: game.score,
      combo: game.combo,
      maxCombo: game.maxCombo,
      lastSuccessMs: game.lastSuccessMs,
    }, elapsedActiveMs(), isLevelMode());
    game.score = next.score;
    game.combo = next.combo;
    game.maxCombo = next.maxCombo;
    game.lastSuccessMs = next.lastSuccessMs;
    renderScore();
  }

  function resetCurrentCombo() {
    const next = resetLevelCombo({
      score: game.score,
      combo: game.combo,
      maxCombo: game.maxCombo,
      lastSuccessMs: game.lastSuccessMs,
    });
    game.score = next.score;
    game.combo = next.combo;
    game.maxCombo = next.maxCombo;
    game.lastSuccessMs = next.lastSuccessMs;
    renderScore();
  }

  function expireComboIfNeeded() {
    if (!isLevelMode() || game.combo <= 0) return;
    const next = expireLevelCombo({
      score: game.score,
      combo: game.combo,
      maxCombo: game.maxCombo,
      lastSuccessMs: game.lastSuccessMs,
    }, elapsedActiveMs());
    if (next.combo === game.combo && next.lastSuccessMs === game.lastSuccessMs) return;
    game.combo = next.combo;
    game.lastSuccessMs = next.lastSuccessMs;
    renderScore();
  }

  function renderTimer() {
    if (timerEl) timerEl.textContent = formatTime(elapsedSeconds());
  }

  function startTimer() {
    if (game.timerId !== null) return;
    game.startAt = nowMs();
    game.timerId = setInterval(() => {
      if (game.started && !game.ended && !game.paused) {
        renderTimer();
        expireComboIfNeeded();
        if (elapsedSeconds() >= 359999) stopTimer();
      }
    }, 250);
  }

  function stopTimer() {
    if (game.timerId !== null) {
      clearInterval(game.timerId);
      game.timerId = null;
    }
  }

  function pauseTimer() {
    if (!game.started || game.ended || game.paused) return;
    if (game.startAt !== null) {
      game.baseMs += nowMs() - game.startAt;
      game.startAt = null;
    }
    game.paused = true;
    stopTimer();
  }

  function resumeTimer() {
    if (!game.started || game.ended || !game.paused) return;
    game.paused = false;
    startTimer();
  }

  function setStatus(text) {
    statusRevision++;
    if (transientStatus && !transientStatus.setting) {
      clearTimeout(transientStatus.timer);
      transientStatus = null;
    }
    if (statusEl) statusEl.textContent = text;
  }

  function showTransientStatus(text) {
    const previousStatus = transientStatus ? transientStatus.previousStatus : (statusEl ? statusEl.textContent : "");
    if (transientStatus) clearTimeout(transientStatus.timer);
    const notice = { previousStatus, setting: true, timer: null, revision: 0 };
    transientStatus = notice;
    setStatus(text);
    notice.setting = false;
    notice.revision = statusRevision;
    notice.timer = setTimeout(() => {
      if (transientStatus === notice && statusRevision === notice.revision) {
        transientStatus = null;
        setStatus(notice.previousStatus);
      }
    }, 1200);
  }

  function prefersReducedMotion() {
    try {
      return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (err) {
      return false;
    }
  }

  function setBoardBusy(busy) {
    if (!boardEl) return;
    if (busy) boardEl.setAttribute("aria-busy", "true");
    else boardEl.removeAttribute("aria-busy");
  }

  function clearAnimationStyles() {
    for (const cell of cellEls) {
      cell.classList.remove("is-clearing", "is-dropping");
      if (!cell.style) continue;
      cell.style.transform = "";
      cell.style.transition = "";
      cell.style.willChange = "";
    }
    setBoardBusy(false);
  }

  function scheduleAnimation(callback, delay, token) {
    const timer = setTimeout(() => {
      pendingAnimationTimers.delete(timer);
      if (token !== game.animationToken) return;
      callback();
    }, Math.max(0, delay));
    pendingAnimationTimers.add(timer);
    return timer;
  }

  function cancelAnimations() {
    game.animationToken += 1;
    for (const timer of pendingAnimationTimers) clearTimeout(timer);
    pendingAnimationTimers.clear();
    clearAnimationStyles();
    clearLine();
    game.busy = false;
  }

  function setLeft() {
    if (!leftEl) return;
    let pairs = 0;
    if (activeMode3D()) {
      pairs = Math.floor(count3DRemaining(llk3d.occ) / 2);
    } else if (game.grid) {
      pairs = Math.floor(countRemaining(game.grid) / 2);
    }
    leftEl.textContent = pairs + " 对";
  }

  /* ----------------------------- 视图 ----------------------------- */

  /* 根据当前难度与窗口宽度计算格子尺寸(px),写入 CSS 变量 */
  function computeCellSize() {
    const wrap = boardEl.parentElement;
    const avail = wrap ? wrap.clientWidth : Math.min(window.innerWidth * 0.92, 720);
    const raw = Math.floor((avail - 12) / game.cols);
    return Math.max(24, Math.min(raw, 46));
  }

  function applyCellSize() {
    const cell = computeCellSize();
    if (boardEl.style) {
      boardEl.style.setProperty("--llk-cell", cell + "px");
      boardEl.style.setProperty("--llk-cols", String(game.cols));
    }
    return cell;
  }

  function cellLabel(r, c) {
    const v = game.grid[r * game.cols + c];
    if (v === -1) return "第 " + (r + 1) + " 行第 " + (c + 1) + " 列障碍物，不可选择";
    return "第 " + (r + 1) + " 行第 " + (c + 1) + " 列" + (v ? " " + EMOJI_POOL[v - 1] : " 空");
  }

  function updateCell(index) {
    const btn = cellEls[index];
    if (!btn) return;
    const r = Math.floor(index / game.cols);
    const c = index % game.cols;
    const value = game.grid[index];
    btn.textContent = value > 0 ? EMOJI_POOL[value - 1] : "";
    btn.setAttribute("aria-label", cellLabel(r, c));
    btn.disabled = value === -1;
    const isSel = game.sel !== null && game.sel.r === r && game.sel.c === c;
    btn.classList.toggle("is-sel", isSel && value !== 0);
    btn.classList.toggle("is-obstacle", value === -1);
    if (value === 0) btn.classList.add("is-empty");
    else btn.classList.remove("is-empty");
  }

  function renderAll() {
    for (let i = 0; i < cellEls.length; i++) updateCell(i);
  }

  function setCellValue(r, c, value) {
    game.grid[r * game.cols + c] = value;
    updateCell(r * game.cols + c);
  }

  function clearSelection() {
    game.sel = null;
    for (let i = 0; i < cellEls.length; i++) cellEls[i].classList.remove("is-sel");
  }

  /* ----------------------------- 连线动画 ----------------------------- */

  /*
   * 将逻辑棋盘坐标转换为连线层坐标。
   *
   * 不能用 --llk-cell 直接推算:棋盘还有 gap、padding,并且连线层位于
   * board-wrap 上,不一定和 llkBoard 左上角重合。使用真实格子矩形可以
   * 保证连线端点始终落在目标格中心。
   */
  function computePathPoints(path, rows, cols, cellRects, layerRect) {
    if (!Array.isArray(path) || !Array.isArray(cellRects) || cellRects.length < rows * cols) {
      return [];
    }

    const xCenters = [];
    const yCenters = [];
    for (let c = 0; c < cols; c++) {
      const rect = cellRects[c];
      xCenters.push(rect.left + rect.width / 2);
    }
    for (let r = 0; r < rows; r++) {
      const rect = cellRects[r * cols];
      yCenters.push(rect.top + rect.height / 2);
    }

    const xStep = cols > 1 ? xCenters[1] - xCenters[0] : cellRects[0].width;
    const yStep = rows > 1 ? yCenters[1] - yCenters[0] : cellRects[0].height;
    const xAt = (c) => {
      if (c < 0) return xCenters[0] + c * xStep;
      if (c >= cols) return xCenters[cols - 1] + (c - cols + 1) * xStep;
      return xCenters[c];
    };
    const yAt = (r) => {
      if (r < 0) return yCenters[0] + r * yStep;
      if (r >= rows) return yCenters[rows - 1] + (r - rows + 1) * yStep;
      return yCenters[r];
    };

    return path.map((p) => [xAt(p.c) - layerRect.left, yAt(p.r) - layerRect.top]);
  }

  function getLineStrokeWidth(cellRects) {
    const cellWidth = cellRects && cellRects[0] && Number(cellRects[0].width);
    return Math.max(3, (Number.isFinite(cellWidth) && cellWidth > 0 ? cellWidth : 24) / 8);
  }

  /* path: [{r,c}...] 拐点序列,含可能的虚拟外圈点(r 或 c 为 -1 / rows / cols)。
   * 通过 SVG 折线 + stroke-dasharray 过渡实现"画线"动效。 */
  function drawLine(path) {
    if (!pathLayer) return;
    pathLayer.innerHTML = "";
    const layerRect = pathLayer.getBoundingClientRect();
    const cellRects = cellEls.map((el) => el.getBoundingClientRect());
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    const W = layerRect.width || pathLayer.clientWidth || 1;
    const H = layerRect.height || pathLayer.clientHeight || 1;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.position = "absolute";
    svg.style.left = "0px";
    svg.style.top = "0px";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";

    const poly = document.createElementNS(NS, "polyline");
    const coords = computePathPoints(path, game.rows, game.cols, cellRects, layerRect);
    const pts = coords.map((point) => point[0] + "," + point[1]).join(" ");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "var(--accent, #6dd3ff)");
    poly.setAttribute("stroke-width", getLineStrokeWidth(cellRects));
    poly.setAttribute("stroke-linecap", "round");
    poly.setAttribute("stroke-linejoin", "round");

    // 计算折线总长用于描边动画
    let len = 0;
    for (let i = 1; i < coords.length; i++) {
      len += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
    }
    poly.style.strokeDasharray = len + " " + len;
    poly.style.strokeDashoffset = String(len);

    svg.appendChild(poly);
    pathLayer.appendChild(svg);

    // 触发过渡:下一帧将 dashoffset 置 0
    requestAnimationFrame(() => {
      poly.style.transition = "stroke-dashoffset " + LINE_MS + "ms ease-out";
      poly.style.strokeDashoffset = "0";
    });
    return poly;
  }

  function clearLine() {
    if (pathLayer) pathLayer.innerHTML = "";
  }

  function animateLevelDrop(nextGrid, dropMoves, token, onComplete) {
    if (token !== game.animationToken) return;

    game.grid = nextGrid;
    renderAll();

    const plan = makeDropPlan(dropMoves, game.cols);
    if (!plan.length || prefersReducedMotion()) {
      clearAnimationStyles();
      onComplete();
      return;
    }

    const rects = cellEls.map((cell) => (
      cell && typeof cell.getBoundingClientRect === "function"
        ? cell.getBoundingClientRect()
        : null
    ));
    const animatedCells = [];
    for (const move of plan) {
      const source = cellEls[move.from];
      const target = cellEls[move.to];
      const sourceRect = rects[move.from];
      const targetRect = rects[move.to];
      if (!source || !target || !sourceRect || !targetRect) continue;

      const dx = sourceRect.left - targetRect.left;
      const dy = sourceRect.top - targetRect.top;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;

      target.classList.add("is-dropping");
      target.style.willChange = "transform";
      target.style.transition = "none";
      target.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      animatedCells.push(target);
    }

    if (!animatedCells.length) {
      clearAnimationStyles();
      onComplete();
      return;
    }

    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    raf(() => raf(() => {
      if (token !== game.animationToken) return;
      for (const cell of animatedCells) {
        // 读取一次布局，确保初始 transform 已提交后再开启过渡。
        cell.getBoundingClientRect();
        cell.style.transition = `transform ${DROP_MS}ms ${DROP_EASING}`;
        cell.style.transform = "translate3d(0, 0, 0)";
      }
      scheduleAnimation(() => {
        clearAnimationStyles();
        onComplete();
      }, DROP_MS, token);
    }));
  }

  /* ----------------------------- 游戏流程 ----------------------------- */

  function finishPairResolution(token) {
    if (token !== game.animationToken) return;
    clearLine();
    clearAnimationStyles();
    game.busy = false;

    if (countRemaining(game.grid) === 0) {
      win();
      return;
    }

    setLeft();
    // 关卡模式自动洗牌；经典模式保留原来的手动重排提示。
    if (!findAnyPair(game.grid, game.rows, game.cols)) {
      if (isLevelMode()) {
        const levels = getLevelApi();
        const result = ensureLevelSolvable(game.grid, game.rows, game.cols, levels, findAnyPair);
        if (result.autoReshuffled) {
          game.grid = result.grid;
          renderAll();
          setStatus("无可用配对，已自动洗牌");
        } else {
          setStatus("无可用配对，自动洗牌失败");
        }
      } else {
        setStatus("无可用配对,点「重排」");
        if (shuffleBtn) shuffleBtn.classList.add("is-highlight");
      }
    } else if (shuffleBtn) {
      shuffleBtn.classList.remove("is-highlight");
    }
  }

  function beginLevelPairResolution(a, b, poly, token) {
    setBoardBusy(true);
    const reducedMotion = prefersReducedMotion();
    if (poly && poly.style) {
      poly.style.transition = `opacity ${reducedMotion ? 0 : CLEAR_MS}ms ease`;
      poly.style.opacity = "0";
    }
    if (!reducedMotion) {
      if (cellEls[a.r * game.cols + a.c]) cellEls[a.r * game.cols + a.c].classList.add("is-clearing");
      if (cellEls[b.r * game.cols + b.c]) cellEls[b.r * game.cols + b.c].classList.add("is-clearing");
    }

    scheduleAnimation(() => {
      setCellValue(a.r, a.c, 0);
      setCellValue(b.r, b.c, 0);

      const levels = getLevelApi();
      const result = levels && typeof levels.collapseColumns === "function"
        ? levels.collapseColumns(game.grid, game.rows, game.cols)
        : { grid: game.grid.slice(), dropMoves: [] };
      animateLevelDrop(result.grid, result.dropMoves || result.moves, token, () => finishPairResolution(token));
    }, reducedMotion ? 0 : CLEAR_MS, token);
  }

  function win() {
    if (game.ended) return;
    game.ended = true;
    game.paused = false;
    stopTimer();
    if (game.startAt !== null) {
      game.baseMs += nowMs() - game.startAt;
      game.startAt = null;
    }
    renderTimer();
    if (isLevelMode()) {
      game.score = applyLevelClearBonus(game.score, true);
      renderScore();
      game.progress = recordLevelCompletion(game.progress, game.levelId, {
        score: game.score,
        time: elapsedSeconds(),
        combo: game.maxCombo,
      });
      writeLevelProgress(game.progress, getLocalStorage());
      renderLevelPicker();
      setStatus("第 " + game.levelId + " 关通关 🎉");
    } else {
      setStatus("通关 🎉");
    }
    clearSelection();
    shell.classList.add("llk-won");
  }

  function handleCellClick(r, c) {
    if (game.ended || game.busy || game.paused) return;
    const value = game.grid[r * game.cols + c];
    if (!isSelectableTile(value)) return;

    // 首次有效点击视为开始
    if (!game.started) {
      game.started = true;
      game.paused = false;
      startTimer();
      setStatus("进行中");
    }

    // 点击已选中的格子:取消选中
    if (game.sel !== null && game.sel.r === r && game.sel.c === c) {
      clearSelection();
      return;
    }

    if (game.sel === null) {
      game.sel = { r, c };
      updateCell(r * game.cols + c);
      return;
    }

    // 已有选中格:尝试配对
    const a = game.sel;
    const b = { r, c };
    const reason = explainPairFailure(game.grid, game.rows, game.cols, a, b);
    const path = reason === null ? findPath(game.grid, game.rows, game.cols, a, b) : null;

    if (path && path.length >= 2) {
      // 配对成功:锁输入、画线,线画完后再让两格消失
      game.sel = null;
      game.busy = true;
      if (isLevelMode()) setBoardBusy(true);
      awardPair();
      clearSelection();
      const poly = drawLine(path);
      const animationToken = game.animationToken;
      scheduleAnimation(() => {
        if (isLevelMode()) {
          beginLevelPairResolution(a, b, poly, animationToken);
          return;
        }

        // 经典模式保持原有即时消除节奏,仅复用新的取消/完成保护。
        setCellValue(a.r, a.c, 0);
        setCellValue(b.r, b.c, 0);
        if (poly && poly.style) poly.style.transition = "opacity " + CLEAR_MS + "ms ease";
        if (poly && poly.style) poly.style.opacity = "0";
        scheduleAnimation(() => finishPairResolution(animationToken), CLEAR_MS, animationToken);
      }, LINE_MS, animationToken);
    } else {
      // 配对失败:新点击的格成为选中格
      resetCurrentCombo();
      showTransientStatus(reason);
      clearSelection();
      game.sel = b;
      updateCell(b.r * game.cols + b.c);
    }
  }

  function loadBoard(rows, cols, kinds) {
    cancelAnimations();
    const result = makeBoard(rows, cols, kinds);
    game.rows = result.rows;
    game.cols = result.cols;
    game.kinds = result.kinds;
    game.grid = result.grid;
    game.sel = null;
    game.started = false;
    game.ended = false;
    game.paused = false;
    game.baseMs = 0;
    game.startAt = null;
    game.busy = false;
    game.levelId = null;
    stopTimer();
    resetRunStats();
    shell.classList.remove("llk-won");
    if (shuffleBtn) shuffleBtn.classList.remove("is-highlight");
    setStatus("待开始");
    renderTimer();
    setLeft();
    buildCells();
    applyCellSize();
  }

  function startNew(difficultyKey) {
    const config = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medium;
    game.difficulty = difficultyKey;
    if (difficultyEl) difficultyEl.value = difficultyKey;
    loadBoard(config.rows, config.cols, config.kinds);
  }

  function renderLevelPicker() {
    if (!levelPickerEl) return;
    const levels = getLevelApi();
    const entries = levels && Array.isArray(levels.levels) ? levels.levels : (Array.isArray(levels) ? levels : []);
    levelPickerEl.hidden = llkModeKey !== "levels";
    levelPickerEl.innerHTML = "";
    for (let i = 0; i < entries.length; i++) {
      const level = entries[i];
      const locked = level.id > game.progress.unlockedLevel;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "llk-level-btn";
      button.disabled = locked;
      button.textContent = "第 " + level.id + " 关 · " + level.name + (locked ? "（未解锁）" : "");
      button.setAttribute("aria-label", "第 " + level.id + " 关 " + level.name + (locked ? "，未解锁" : "，可开始"));
      button.classList.toggle("is-current", game.levelId === level.id);
      button.addEventListener("click", () => {
        if (!locked) startLevel(level.id);
      });
      levelPickerEl.appendChild(button);
    }
  }

  function startLevel(levelId) {
    cancelAnimations();
    const levels = getLevelApi();
    const entries = levels && Array.isArray(levels.levels) ? levels.levels : (Array.isArray(levels) ? levels : []);
    const level = entries.find((entry) => entry.id === levelId);
    if (!level || level.id > game.progress.unlockedLevel || !levels || typeof levels.cloneLayout !== "function") return;
    game.difficulty = "level-" + level.id;
    game.rows = level.rows;
    game.cols = level.cols;
    game.kinds = level.kinds;
    game.grid = levels.cloneLayout(level);
    game.sel = null;
    game.started = false;
    game.ended = false;
    game.paused = false;
    game.autoPaused = false;
    game.baseMs = 0;
    game.startAt = null;
    game.busy = false;
    game.levelId = level.id;
    stopTimer();
    resetRunStats();
    shell.classList.remove("llk-won");
    if (shuffleBtn) shuffleBtn.classList.remove("is-highlight");
    setStatus("第 " + level.id + " 关，待开始");
    renderTimer();
    setLeft();
    buildCells();
    applyCellSize();
    renderLevelPicker();
  }

  function handleShuffle() {
    if (game.ended || game.busy) return;
    if (!game.grid) return;
    if (countRemaining(game.grid) === 0) return;
    resetCurrentCombo();
    const levels = getLevelApi();
    const levelResult = isLevelMode() && levels && typeof levels.reshuffle === "function"
      ? levels.reshuffle(game.grid, game.rows, game.cols, findAnyPair)
      : null;
    const ok = levelResult ? levelResult.ok : reshuffle(game.grid, game.rows, game.cols);
    if (levelResult) game.grid = levelResult.grid;
    if (!game.started) {
      game.started = true;
      startTimer();
    }
    setStatus(ok ? "已重排,继续配对" : "重排后仍无解,可再试一次");
    if (shuffleBtn) shuffleBtn.classList.remove("is-highlight");
    renderAll();
    setLeft();
    clearLine();
  }

  /* ----------------------------- 构建界面 ----------------------------- */

  function buildCells() {
    boardEl.innerHTML = "";
    cellEls.length = 0;
    const total = game.rows * game.cols;
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / game.cols);
      const c = i % game.cols;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "llk-cell";
      btn.dataset.index = String(i);
      btn.setAttribute("role", "gridcell");
      btn.addEventListener("click", () => handleCellClick(r, c));
      boardEl.appendChild(btn);
      cellEls.push(btn);
    }
    renderAll();
  }

  function showHint2D() {
    if (activeMode3D() || game.busy || game.ended || !game.grid) return;
    const pair = findHintPair(game.grid, game.rows, game.cols, findAnyPair);
    if (!pair) {
      setStatus(isLevelMode() ? "暂无可用配对，将自动洗牌" : "暂无可用配对,点「重排」试试");
      return;
    }
    const first = pair.a.r * game.cols + pair.a.c;
    const second = pair.b.r * game.cols + pair.b.c;
    if (cellEls[first]) cellEls[first].classList.add("is-hint");
    if (cellEls[second]) cellEls[second].classList.add("is-hint");
    showTransientStatus("已高亮一对可用图案");
    setTimeout(() => {
      if (cellEls[first]) cellEls[first].classList.remove("is-hint");
      if (cellEls[second]) cellEls[second].classList.remove("is-hint");
    }, 1400);
  }

  function bindControls() {
    const currentDiffKey = () => (difficultyEl ? difficultyEl.value : "medium");
    if (newBtn) newBtn.addEventListener("click", () => startGameForMode(currentDiffKey()));
    if (shuffleBtn) shuffleBtn.addEventListener("click", onShufflePressed);
    if (hintBtn) hintBtn.addEventListener("click", () => activeMode3D() ? showHint3D() : showHint2D());
    if (difficultyEl) {
      difficultyEl.addEventListener("change", () => {
        if (llkActive && llkModeKey !== "levels") startGameForMode(difficultyEl.value);
      });
    }
    if (modeEl) {
      modeEl.addEventListener("change", () => switchLlkMode(modeEl.value));
    }
    window.addEventListener("resize", () => {
      if (activeMode3D()) {
        llk3dNeedsResize = true;
      } else if (game.grid) {
        applyCellSize();
      }
    });

    const coordinator = typeof window !== "undefined" ? window.__GAME_TABS__ : null;
    if (coordinator && typeof coordinator.register === "function") {
      coordinator.register("lianliankan", {
        onActivate: onLinkActivate,
        onDeactivate: onLinkDeactivate,
      });
    }
  }

  /* 连连看激活期间在捕获阶段接管键盘:
   *  - 拦截 R 防止误触扫雷重开;
   *  - 3D 玩法支持方向键旋转、+/- 缩放、H 提示。 */
  document.addEventListener(
    "keydown",
    (e) => {
      if (!llkActive) return;
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const key = e.key;
      if (llkModeKey === "3d" && llk3d.onKey && activeMode3D()) {
        const handled = llk3d.onKey(key);
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (key && key.toLowerCase() === "h" && !activeMode3D()) {
        showHint2D();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (key && key.toLowerCase() === "r") {
        e.stopPropagation();
      }
    },
    true,
  );

  /* ----------------------------- 生命周期回调(由协调器调用) ----------------------------- */

  function onLinkActivate() {
    llkActive = true;
    // 清理扫雷胜利烟花残留层,避免悬浮在连连看上方
    const fireworksLayer = document.getElementById("fireworksLayer");
    if (fireworksLayer) fireworksLayer.innerHTML = "";

    if (llkModeKey === "3d") {
      if (!llk3d.built) {
        const key = difficultyEl ? difficultyEl.value : "medium";
        start3DGame(LLK3D_DIFFICULTIES[key] ? key : "medium");
      } else {
        llk3dStartLoop();
      }
    } else if (!game.grid) {
      if (llkModeKey === "levels") startLevel(1);
      else {
        const key = difficultyEl ? difficultyEl.value : "medium";
        startNew(DIFFICULTIES[key] ? key : "medium");
      }
    }

    // 切回时若因切走自动暂停则恢复(经典/3D 共用计时字段)
    if (game.autoPaused) {
      game.autoPaused = false;
      if (game.started && !game.ended) {
        resumeTimer();
        setStatus("进行中");
        renderTimer();
      }
    }

    if (llkModeKey === "3d") {
      setLeft();
    } else {
      renderAll();
      setLeft();
    }
  }

  function onLinkDeactivate() {
    llkActive = false;
    // 切走:若进行中则自动暂停,防止后台静默计时;同时停止 3D 渲染循环
    if (game.started && !game.ended && !game.paused) {
      game.autoPaused = true;
      pauseTimer();
    }
    llk3dStopLoop();
  }

  /* ============================================================
     3D 立体玩法(魔方表面连线)
     ------------------------------------------------------------
     模型:边长 size 的实心魔方,图块贴在外表面格上,每类恰好 2 个。
     占用数组 occ 索引 idx=(x*ny+y)*nz+z:
       -1 = 内部格(连线不得进入) 0 = 表面空格 >0 = 图块种类
     连通规则:连线只能沿表面行走(相邻格曼哈顿距离 1,跨棱边时自然
     接续到相邻面),整条路径 ≤2 次转弯,中间不得经过其它图块。
     视图:Canvas 手绘透视投影,拖拽旋转 / 滚轮缩放 / 方向键微调。
     ============================================================ */

  const LLK3D_TEXT = {
    classicHint: "依次点选两个相同图案,若可用不超过两次转弯的路径连通即消除;无可用配对时点「重排」",
    classicTag: "找到相同图案,用不超过两次转弯的路径相连,即可消除。",
    hint:
      "拖动或按方向键旋转魔方、滚轮缩放。依次点选两个相同图案:若它们之间在立体表面上存在不超过两次转弯的通道即可消除;" +
      "被挡住时会提示,按 H 键显示可用配对,无解时点「重排」",
    tag: "旋转魔方,在立体表面上寻找能够连通的相同图案。",
  };
  const LEVEL_TEXT = {
    hint: "选择已解锁关卡；障碍不可选择，消除后图案会按障碍分段下落。按 H 或「提示」高亮可用配对。",
    tag: "逐关挑战固定布局，连续消除可累积 Combo 和得分。",
  };

  /* 渲染/交互可调参数 */
  const TILE_HALF = 0.42; // 图块小立方体半边长(世界单位,格距 1)

  /* ---- 状态(在经典 2D 上独立,但共用 game 的计时/流程字段) ---- */
  llk3d.d = null; // { nx, ny, nz }
  llk3d.kinds = 0;
  llk3d.occ = null;
  llk3d.built = false;
  llk3d.sel = null; // 当前选中格 {x,y,z}
  llk3d.stage = null;
  llk3d.canvas = null;
  llk3d.ctx = null;
  llk3d.toastEl = null;
  llk3d.theme = { accent: [109, 211, 255], bg: [15, 23, 37] };
  llk3d.yaw = 0.85;
  llk3d.pitch = 0.42;
  llk3d.zoom = 1;
  llk3d.dragging = false;
  llk3d.lastX = 0;
  llk3d.lastY = 0;
  llk3d.lastInput = 0;
  llk3d.frame = 0;
  llk3d.running = false;
  llk3d.anim = { line: null, fading: null }; // 连线/淡出动画
  llk3d.hintPair = null;
  llk3d.hintUntil = 0;
  llk3d.toastTimer = 0;
  let llk3dNeedsResize = true;

  /* --------------------------- 3D 纯逻辑 --------------------------- */

  function isSurfaceCell3D(d, x, y, z) {
    return x === 0 || x === d.nx - 1 || y === 0 || y === d.ny - 1 || z === 0 || z === d.nz - 1;
  }

  function idx3D(d, x, y, z) {
    return (x * d.ny + y) * d.nz + z;
  }

  function dimsCube3D(n) {
    return { nx: n, ny: n, nz: n };
  }

  function axisDiff3D(p, q) {
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const dz = p.z - q.z;
    const diffs = (dx !== 0 ? 1 : 0) + (dy !== 0 ? 1 : 0) + (dz !== 0 ? 1 : 0);
    if (diffs !== 1) return -1;
    if (dx !== 0) return 0;
    if (dy !== 0) return 1;
    return 2;
  }

  function surfaceCellList3D(d) {
    const out = [];
    for (let x = 0; x < d.nx; x++)
      for (let y = 0; y < d.ny; y++)
        for (let z = 0; z < d.nz; z++)
          if (isSurfaceCell3D(d, x, y, z)) out.push({ x, y, z });
    return out;
  }

  function emptySurfaceList3D(occ, d) {
    const out = [];
    for (let x = 0; x < d.nx; x++)
      for (let y = 0; y < d.ny; y++)
        for (let z = 0; z < d.nz; z++)
          if (isSurfaceCell3D(d, x, y, z) && occ[idx3D(d, x, y, z)] === 0) out.push({ x, y, z });
    return out;
  }

  function tileList3D(occ, d) {
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
  function expandPath3D(d, corners) {
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
  function find3DPath(occ, d, a, b) {
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
  function find3DAnyPair(occ, d) {
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

  function count3DRemaining(occ) {
    let n = 0;
    for (let i = 0; i < occ.length; i++) if (occ[i] > 0) n += 1;
    return n;
  }

  function sameCell3D(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }

  function occValue3D(cell) {
    return llk3d.occ[idx3D(llk3d.d, cell.x, cell.y, cell.z)];
  }

  function setOccValue3D(cell, v) {
    llk3d.occ[idx3D(llk3d.d, cell.x, cell.y, cell.z)] = v;
  }

  /* 生成魔方表面棋盘:每类恰好 2 个,且第 1 类必放在相邻格(开局有解) */
  function make3DBoard(size, kinds) {
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
      const c = surf[Math.floor(Math.random() * surf.length)];
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
      const nb = nbrs[Math.floor(Math.random() * nbrs.length)];
      claim(c, 1);
      claim(nb, 1);
      placed = true;
    }
    if (!placed) throw new Error("failed to place guaranteed pair");

    for (let k = 2; k <= kinds; k++) {
      for (let n = 0; n < 2; n++) {
        let cell = null;
        for (let attempt = 0; attempt < 800 && !cell; attempt++) {
          const c = surf[Math.floor(Math.random() * surf.length)];
          if (!usedKeys.has(keyOf(c))) cell = c;
        }
        if (!cell) throw new Error("surface full while placing board");
        claim(cell, k);
      }
    }
    return { d, kinds, occ };
  }

  /* 重排剩余图块,保证重排后至少存在一对可连(就地修改 occ) */
  function reshuffle3D(board) {
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
      shuffle(pool);
      if (pool.length < kindsLeft.length * 2) break;
      const order = shuffle(kindsLeft.slice());
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
      shuffle(pool);
      if (pool.length < kindsLeft.length * 2) break;
      const pickKind = kindsLeft[Math.floor(Math.random() * kindsLeft.length)];
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
      shuffle(restKinds);
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

  /* --------------------------- 3D 视图 --------------------------- */

  function cssColorToRgb(str) {
    if (!str) return null;
    str = String(str).trim();
    if (str.charAt(0) === "#") {
      const m = /^#([0-9a-f]{6})$/i.exec(str);
      if (!m) return null;
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    }
    const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(str);
    if (m) return [Math.round(parseFloat(m[1])), Math.round(parseFloat(m[2])), Math.round(parseFloat(m[3]))];
    return null;
  }

  function readThemeColors3D() {
    try {
      const cs = window.getComputedStyle ? getComputedStyle(document.documentElement) : null;
      if (!cs) return;
      const a = cssColorToRgb(cs.getPropertyValue("--accent"));
      const b = cssColorToRgb(cs.getPropertyValue("--control-bg"));
      if (a) llk3d.theme.accent = a;
      if (b) llk3d.theme.bg = b;
    } catch (err) {
      /* 保留默认配色 */
    }
  }

  /* 构造相机(渲染与拾取共用,保证一致) */
  function llkCam(cssW, cssH) {
    const d = llk3d.d;
    const R = Math.sqrt(d.nx * d.nx + d.ny * d.ny + d.nz * d.nz) / 2 + 0.7;
    const fov = Math.min(cssW, cssH) * 0.92 * llk3d.zoom;
    const dist = R * 3.05;
    const cY = Math.cos(llk3d.yaw);
    const sY = Math.sin(llk3d.yaw);
    const cP = Math.cos(llk3d.pitch);
    const sP = Math.sin(llk3d.pitch);
    const toEye = (x, y, z) => {
      const rx = x * cY + z * sY;
      const rz = -x * sY + z * cY;
      const ry2 = y * cP - rz * sP;
      const rz2 = y * sP + rz * cP;
      return { x: rx, y: ry2, z: rz2 };
    };
    const project = (e) => {
      const denom = dist - e.z;
      if (denom <= 1e-4) return null;
      const s = fov / denom;
      return { x: cssW / 2 + e.x * s, y: cssH / 2 - e.y * s, z: e.z, s };
    };
    return { toEye, project };
  }

  function cellWorld3D(cell) {
    return {
      x: cell.x - (llk3d.d.nx - 1) / 2,
      y: cell.y - (llk3d.d.ny - 1) / 2,
      z: cell.z - (llk3d.d.nz - 1) / 2,
    };
  }

  function rgbaStr(rgb, a) {
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
  }

  function shadeRgb(rgb, m) {
    return [Math.min(255, Math.round(rgb[0] * m)), Math.min(255, Math.round(rgb[1] * m)), Math.min(255, Math.round(rgb[2] * m))];
  }

  /* 主渲染:一次 rAF 一帧 */
  function renderLlk3D() {
    if (!llk3d.canvas || !llk3d.ctx || !llk3d.occ) return;
    const stage = llk3d.stage;
    const cssW = stage.clientWidth || 0;
    const cssH = stage.clientHeight || 0;
    if (cssW < 40 || cssH < 40) return;
    const canvas = llk3d.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw || canvas.height !== ph || llk3dNeedsResize) {
      canvas.width = pw;
      canvas.height = ph;
      llk3dNeedsResize = false;
    }
    const ctx = llk3d.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    llk3d.frame += 1;

    // 闲置自动旋转(便于观察各面)
    if (!llk3d.dragging && nowMs() - llk3d.lastInput > 2600) {
      llk3d.yaw += 0.0024;
    }

    readThemeColors3D();
    const d = llk3d.d;
    const cam = llkCam(cssW, cssH);
    const HA = [d.nx / 2, d.ny / 2, d.nz / 2];
    const ac = llk3d.theme.accent;
    const bg = llk3d.theme.bg;
    const base = [Math.round(ac[0] * 0.32 + bg[0] * 0.68), Math.round(ac[1] * 0.32 + bg[1] * 0.68), Math.round(ac[2] * 0.32 + bg[2] * 0.68)];
    const labelFont = '"Noto Sans SC","Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui';

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.lineJoin = "round";

    const items = []; // { z, draw } 按 z 升序(远→近)绘制

    /* 1) 大魔方六面:半透明填充 + 网格线 */
    for (let a = 0; a < 3; a++) {
      const u = (a + 1) % 3;
      const v = (a + 2) % 3;
      for (let s = 0; s < 2; s++) {
        const sign = s === 0 ? -1 : 1;
        const center = [0, 0, 0];
        center[a] = sign * HA[a];
        const e = cam.toEye(center[0], center[1], center[2]);
        const pr = cam.project(e);
        if (!pr) continue;
        const corners = [];
        const cs = [-1, 1];
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            const pt = [center[0], center[1], center[2]];
            pt[u] = cs[i] * HA[u];
            pt[v] = cs[j] * HA[v];
            corners.push(pt);
          }
        items.push({
          z: e.z,
          draw() {
            const pts = corners.map((pt) => cam.project(cam.toEye(pt[0], pt[1], pt[2]))).filter(Boolean);
            if (pts.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fillStyle = rgbaStr(ac, 0.055);
            ctx.fill();
            // 网格线(沿两轴)
            ctx.strokeStyle = rgbaStr(ac, 0.22);
            ctx.lineWidth = 1;
            const nU = u === 0 ? d.nx : u === 1 ? d.ny : d.nz;
            const nV = v === 0 ? d.nx : v === 1 ? d.ny : d.nz;
            const hU = HA[u];
            const hV = HA[v];
            ctx.beginPath();
            for (let k = 0; k <= nV; k++) {
              const pt1 = [center[0], center[1], center[2]];
              const pt2 = [center[0], center[1], center[2]];
              pt1[u] = -hU;
              pt2[u] = hU;
              pt1[v] = -hV + k;
              pt2[v] = -hV + k;
              const a1 = cam.project(cam.toEye(pt1[0], pt1[1], pt1[2]));
              const a2 = cam.project(cam.toEye(pt2[0], pt2[1], pt2[2]));
              if (a1 && a2) {
                ctx.moveTo(a1.x, a1.y);
                ctx.lineTo(a2.x, a2.y);
              }
            }
            for (let k = 0; k <= nU; k++) {
              const pt1 = [center[0], center[1], center[2]];
              const pt2 = [center[0], center[1], center[2]];
              pt1[u] = -hU + k;
              pt2[u] = -hU + k;
              pt1[v] = -hV;
              pt2[v] = hV;
              const a1 = cam.project(cam.toEye(pt1[0], pt1[1], pt1[2]));
              const a2 = cam.project(cam.toEye(pt2[0], pt2[1], pt2[2]));
              if (a1 && a2) {
                ctx.moveTo(a1.x, a1.y);
                ctx.lineTo(a2.x, a2.y);
              }
            }
            ctx.stroke();
          },
        });
      }
    }

    /* 2) 图块:小立方体(面向相机的面)+ 屏幕直立 emoji 标签 */
    const tiles = tileList3D(llk3d.occ, d);
    const now = nowMs();
    const fading = llk3d.anim && llk3d.anim.fading ? llk3d.anim.fading : [];

    const pushTile = (cell, kind, scale, alpha, zBoost) => {
      const cw = cellWorld3D(cell);
      const e = cam.toEye(cw.x, cw.y, cw.z);
      const pr = cam.project(e);
      if (!pr) return;
      const h = TILE_HALF * scale;
      const faces = [];
      for (let a = 0; a < 3; a++) {
        for (const sg of [-1, 1]) {
          const nrm = [0, 0, 0];
          nrm[a] = sg;
          const ne = cam.toEye(nrm[0], nrm[1], nrm[2]);
          if (ne.z <= 0.001) continue;
          faces.push({ ne, nrm });
        }
      }
      items.push({
        z: e.z,
        draw() {
          ctx.globalAlpha = alpha;
          // 可见面
          for (let i = 0; i < faces.length; i++) {
            const f = faces[i];
            const m = 0.46 + 0.54 * Math.min(1, Math.max(0, f.ne.z));
            const col = shadeRgb(base, m);
            const nAxis = f.nrm[0] !== 0 ? 0 : f.nrm[1] !== 0 ? 1 : 2;
            const uAxis = (nAxis + 1) % 3;
            const vAxis = (nAxis + 2) % 3;
            // 面的四个角:法向偏移 + 两个切向单位轴(依序绕行,避免自交)
            const nv = [f.nrm[0] * h, f.nrm[1] * h, f.nrm[2] * h];
            const uv = [0, 0, 0];
            const vv = [0, 0, 0];
            uv[uAxis] = h;
            vv[vAxis] = h;
            const cornerOffsets = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
            ctx.beginPath();
            let started = false;
            for (let c2 = 0; c2 < cornerOffsets.length; c2++) {
              const su = cornerOffsets[c2][0];
              const sv = cornerOffsets[c2][1];
              const p2 = cam.project(
                cam.toEye(
                  cw.x + nv[0] + uv[0] * su + vv[0] * sv,
                  cw.y + nv[1] + uv[1] * su + vv[1] * sv,
                  cw.z + nv[2] + uv[2] * su + vv[2] * sv,
                ),
              );
              if (!p2) {
                started = false;
                continue;
              }
              if (!started) {
                ctx.moveTo(p2.x, p2.y);
                started = true;
              } else {
                ctx.lineTo(p2.x, p2.y);
              }
            }
            ctx.closePath();
            ctx.fillStyle = rgbaStr(col, 1);
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.16)";
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
          // 屏幕直立 emoji(加深度偏置,避免被自己的正面盖住)
          const glyph = EMOJI_POOL[kind - 1];
          const fontPx = Math.max(11, Math.min(34, pr.s * TILE_HALF * 2.1 * scale));
          ctx.font = "700 " + fontPx + "px " + labelFont;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = Math.max(2, fontPx / 7);
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.strokeText(glyph, pr.x, pr.y);
          ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
          ctx.fillText(glyph, pr.x, pr.y);
          ctx.globalAlpha = 1;
        },
      });
    };

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      pushTile(t, t.kind, 1, 1, 0);
    }
    for (let i = 0; i < fading.length; i++) {
      const f = fading[i];
      const p = (now - f.start) / f.dur;
      if (p >= 1) continue;
      const k = 1 - p;
      pushTile(f, f.kind, 0.6 + 0.6 * k, k, 0);
    }

    items.sort((x, y) => x.z - y.z);
    for (let i = 0; i < items.length; i++) items[i].draw();

    /* 3) 覆盖层:选中环 / 同类脉冲 / 提示环 / 连线动画 */
    drawLlk3DOverlay(ctx, cam, cssW, cssH);
  }

  function drawLlk3DOverlay(ctx, cam, cssW, cssH) {
    if (!llk3d.occ) return;
    const d = llk3d.d;
    const now = nowMs();
    const ring = (cell, color, alpha, lw, dash) => {
      const cw = cellWorld3D(cell);
      const e = cam.toEye(cw.x, cw.y, cw.z);
      const pr = cam.project(e);
      if (!pr) return;
      const r = Math.min(34, Math.max(10, pr.s * TILE_HALF * 1.45));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const ac = llk3d.theme.accent;
    const accentStr = rgbaStr(ac, 1);
    const win = [246, 211, 101];
    const winStr = rgbaStr(win, 1);

    // 已选中:仅实心环标注当前格,不提示其它同类位置(提示只由 H 键触发)
    if (llk3d.sel && occValue3D(llk3d.sel) > 0) {
      ring(llk3d.sel, accentStr, 1, 3, null);
    }

    // H 键提示
    if (llk3d.hintPair && now < llk3d.hintUntil) {
      ring(llk3d.hintPair.a, winStr, 0.95, 3, null);
      ring(llk3d.hintPair.b, winStr, 0.95, 3, null);
    }

    // 连线动画
    const anim = llk3d.anim;
    if (anim && anim.line && anim.line.cells && anim.line.cells.length > 1) {
      const t = Math.min(1, (now - anim.line.start) / anim.line.dur);
      const pts = [];
      for (let i = 0; i < anim.line.cells.length; i++) {
        const cw = cellWorld3D(anim.line.cells[i]);
        const e = cam.toEye(cw.x, cw.y, cw.z);
        const pr = cam.project(e);
        if (!pr) {
          pts.push(null);
        } else {
          pts.push(pr);
        }
      }
      // 按折线累计长度求当前进度端点
      const segs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        if (!pts[i - 1] || !pts[i]) {
          segs.push(null);
          continue;
        }
        const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        segs.push(L);
        total += L;
      }
      if (total > 0) {
        let left = total * t;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        let drawn = false;
        let head = null;
        for (let i = 1; i < pts.length; i++) {
          if (!pts[i - 1] || !pts[i] || !segs[i - 1]) continue;
          const L = segs[i - 1];
          if (left <= 0) break;
          const take = Math.min(L, left);
          const ratio = take / L;
          const ex = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * ratio;
          const ey = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * ratio;
          if (!drawn) {
            ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
            drawn = true;
          }
          ctx.lineTo(ex, ey);
          head = { x: ex, y: ey };
          left -= take;
        }
        if (drawn) {
          ctx.strokeStyle = accentStr;
          ctx.lineWidth = 4;
          ctx.shadowColor = rgbaStr(ac, 0.9);
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
          if (head) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  }

  /* --------------------------- 3D 交互 --------------------------- */

  function ensureLlk3DStage() {
    if (llk3d.ctx) return true;
    if (!stageEl) return false;
    let canvas = document.getElementById("llk3dCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "llk3d-canvas";
      canvas.id = "llk3dCanvas";
      stageEl.appendChild(canvas);
    }
    const ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return false;
    llk3d.stage = stageEl;
    llk3d.canvas = canvas;
    llk3d.ctx = ctx;
    llk3d.toastEl = toastEl;
    bindLlk3DInput(canvas);
    llk3dNeedsResize = true;
    return true;
  }

  function bindLlk3DInput(canvas) {
    let down = false;
    let moved = 0;
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!activeMode3D() || game.ended || game.busy) return;
      down = true;
      moved = 0;
      const p = local(e);
      llk3d.lastX = p.x;
      llk3d.lastY = p.y;
      llk3d.dragging = true;
      llk3d.lastInput = nowMs();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!down) return;
      const p = local(e);
      const dx = p.x - llk3d.lastX;
      const dy = p.y - llk3d.lastY;
      llk3d.lastX = p.x;
      llk3d.lastY = p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      llk3d.yaw += dx * 0.008;
      llk3d.pitch = Math.max(-1.25, Math.min(1.25, llk3d.pitch + dy * 0.007));
      llk3d.lastInput = nowMs();
    });
    const endDrag = (e) => {
      if (!down) return;
      down = false;
      llk3d.dragging = false;
      if (moved < 6 && activeMode3D()) {
        const p = local(e);
        handleLlk3DPick(p.x, p.y);
      }
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", () => {
      down = false;
      llk3d.dragging = false;
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!activeMode3D()) return;
        e.preventDefault();
        const f = e.deltaY > 0 ? 1 / 1.12 : 1.12;
        llk3d.zoom = Math.max(0.45, Math.min(3.2, llk3d.zoom * f));
        llk3d.lastInput = nowMs();
      },
      { passive: false },
    );
  }

  function pickTile3D(px, py) {
    const d = llk3d.d;
    const stage = llk3d.stage;
    const cam = llkCam(stage.clientWidth || 1, stage.clientHeight || 1);
    const tiles = tileList3D(llk3d.occ, d);
    let best = null;
    let bestZ = -Infinity;
    for (let i = 0; i < tiles.length; i++) {
      const cw = cellWorld3D(tiles[i]);
      const e = cam.toEye(cw.x, cw.y, cw.z);
      const pr = cam.project(e);
      if (!pr) continue;
      const dx = pr.x - px;
      const dy = pr.y - py;
      const r = Math.min(32, Math.max(13, pr.s * TILE_HALF * 1.6));
      if (dx * dx + dy * dy <= r * r && e.z > bestZ) {
        bestZ = e.z;
        best = { x: tiles[i].x, y: tiles[i].y, z: tiles[i].z };
      }
    }
    return best;
  }

  function llk3dToast(text, isError) {
    const el = llk3d.toastEl;
    if (!el) {
      if (text) setStatus(text);
      return;
    }
    if (llk3d.toastTimer) {
      clearTimeout(llk3d.toastTimer);
      llk3d.toastTimer = 0;
    }
    if (!text) {
      el.classList.remove("is-show", "is-error");
      el.hidden = true;
      return;
    }
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
    el.hidden = false;
    requestAnimationFrame(() => {
      el.classList.add("is-show");
    });
    llk3d.toastTimer = setTimeout(() => {
      el.classList.remove("is-show");
      setTimeout(() => {
        if (!el.classList.contains("is-show")) el.hidden = true;
      }, 220);
      llk3d.toastTimer = 0;
    }, 1500);
  }

  function showHint3D() {
    if (!activeMode3D() || game.busy || game.ended) return;
    const pair = find3DAnyPair(llk3d.occ, llk3d.d);
    if (!pair) {
      llk3dToast("暂无可用配对,点「重排」试试", true);
      if (shuffleBtn) shuffleBtn.classList.add("is-highlight");
      return;
    }
    llk3d.hintPair = pair;
    llk3d.hintUntil = nowMs() + 2400;
    llk3dToast("已高亮一对可用图案");
  }

  /* 点击拾取:选中/配对/消除流程(与经典共用计时字段) */
  function handleLlk3DPick(px, py) {
    if (!activeMode3D() || game.busy || game.ended || game.paused) return;
    const hit = pickTile3D(px, py);
    if (!hit) {
      llk3d.sel = null; // 点到空白:取消选中
      return;
    }
    if (!game.started) {
      game.started = true;
      game.paused = false;
      startTimer();
      setStatus("进行中");
    }
    if (llk3d.sel && sameCell3D(llk3d.sel, hit)) {
      llk3d.sel = null; // 再点一次取消
      return;
    }
    if (!llk3d.sel) {
      llk3d.sel = hit;
      return;
    }
    const a = llk3d.sel;
    const b = hit;
    const va = occValue3D(a);
    const vb = occValue3D(b);
    if (va !== vb) {
      llk3d.sel = hit;
      llk3dToast("图案不同", true);
      return;
    }
    const path = find3DPath(llk3d.occ, llk3d.d, a, b);
    if (!path) {
      llk3d.sel = hit;
      llk3dToast("被其它方块挡住了,换一对试试", true);
      return;
    }

    // 配对成功
    llk3d.sel = null;
    game.busy = true;
    const cells = expandPath3D(llk3d.d, path) || path;
    llk3d.anim.line = { cells, start: nowMs(), dur: 380 };
    llk3d.anim.fading = [];
    setTimeout(() => {
      // 画线完成:消除两格并播放缩小淡出
      setOccValue3D(a, 0);
      setOccValue3D(b, 0);
      llk3d.anim.line = null;
      llk3d.anim.fading = [
        { x: a.x, y: a.y, z: a.z, kind: va, start: nowMs(), dur: 300 },
        { x: b.x, y: b.y, z: b.z, kind: vb, start: nowMs(), dur: 300 },
      ];
      setTimeout(() => {
        llk3d.anim.fading = [];
        game.busy = false;
        if (count3DRemaining(llk3d.occ) === 0) {
          win();
          return;
        }
        setLeft();
        if (!find3DAnyPair(llk3d.occ, llk3d.d)) {
          setStatus("无可用配对,点「重排」");
          if (shuffleBtn) shuffleBtn.classList.add("is-highlight");
        } else if (shuffleBtn) {
          shuffleBtn.classList.remove("is-highlight");
        }
      }, 320);
    }, 400);
  }

  function handleShuffle3D() {
    if (game.ended || game.busy) return;
    if (!activeMode3D()) return;
    if (count3DRemaining(llk3d.occ) === 0) return;
    const ok = reshuffle3D({ d: llk3d.d, kinds: llk3d.kinds, occ: llk3d.occ });
    if (!game.started) {
      game.started = true;
      startTimer();
    }
    setStatus(ok ? "已重排,继续配对" : "重排后仍无解,可再试一次");
    if (shuffleBtn) shuffleBtn.classList.remove("is-highlight");
    llk3d.sel = null;
    llk3d.anim.line = null;
    llk3d.anim.fading = [];
    llk3d.hintPair = null;
    setLeft();
  }

  /* --------------------------- 3D 编排与模式切换 --------------------------- */

  function llk3dStartLoop() {
    if (llk3d.running) return;
    llk3d.running = true;
    const tick = () => {
      if (!llk3d.running) return;
      if (llkActive && activeMode3D()) {
        try {
          renderLlk3D();
        } catch (err) {
          if (typeof console !== "undefined") console.error("[llk3d]", err);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function llk3dStopLoop() {
    llk3d.running = false;
  }

  function start3DGame(key) {
    cancelAnimations();
    const cfg = LLK3D_DIFFICULTIES[key] || LLK3D_DIFFICULTIES.medium;
    if (!ensureLlk3DStage()) {
      setStatus("3D 画布不可用,请更换浏览器");
      return;
    }
    if (difficultyEl) difficultyEl.value = cfg === LLK3D_DIFFICULTIES[key] ? key : "medium";
    const board = make3DBoard(cfg.size, cfg.kinds);
    llk3d.d = board.d;
    llk3d.kinds = board.kinds;
    llk3d.occ = board.occ;
    llk3d.built = true;
    llk3d.sel = null;
    llk3d.anim.line = null;
    llk3d.anim.fading = [];
    llk3d.hintPair = null;
    llk3d.frame = 0;
    llk3dToast("");
    game.difficulty = key;
    game.sel = null;
    game.started = false;
    game.ended = false;
    game.paused = false;
    game.busy = false;
    game.autoPaused = false;
    game.baseMs = 0;
    game.startAt = null;
    stopTimer();
    resetRunStats();
    shell.classList.remove("llk-won");
    if (shuffleBtn) shuffleBtn.classList.remove("is-highlight");
    setStatus("待开始");
    renderTimer();
    setLeft();
    llk3dStartLoop();
  }

  /* 新局(按当前玩法) */
  function startGameForMode(key) {
    if (llkModeKey === "3d") {
      const cfg = LLK3D_DIFFICULTIES[key];
      start3DGame(cfg ? key : "medium");
    } else if (llkModeKey === "levels") {
      startLevel(game.levelId || 1);
    } else {
      const cfg = DIFFICULTIES[key];
      startNew(cfg ? key : "medium");
    }
  }

  function onShufflePressed() {
    if (llkModeKey === "3d") handleShuffle3D();
    else handleShuffle();
  }

  /* 玩法切换(经典 <-> 3D) */
  function switchLlkMode(next) {
    const target = next === "3d" ? "3d" : (next === "levels" ? "levels" : "classic");
    if (target === llkModeKey) return;
    if (target === "3d" && !ensureLlk3DStage()) {
      setStatus("当前浏览器不支持 3D 画布");
      if (modeEl) modeEl.value = "classic";
      return;
    }
    llkModeKey = target;
    if (modeEl) modeEl.value = target;
    shell.classList.toggle("llk-mode-3d", target === "3d");
    shell.classList.toggle("llk-mode-levels", target === "levels");
    llk3d.sel = null;
    llk3dToast("");
    llk3dStopLoop();
    applyLlkModeTexts();
    clearLine();
    const key = difficultyEl ? difficultyEl.value : "medium";
    if (target === "3d") {
      const cfg = LLK3D_DIFFICULTIES[key];
      start3DGame(cfg ? key : "medium");
    } else if (target === "levels") {
      startLevel(1);
    } else {
      const cfg = DIFFICULTIES[key];
      startNew(cfg ? key : "medium");
    }
  }

  /* 键盘:方向键旋转、+/- 缩放、H 提示 */
  llk3d.onKey = (key) => {
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
      const step = 0.3;
      if (key === "ArrowLeft") llk3d.yaw -= step;
      else if (key === "ArrowRight") llk3d.yaw += step;
      else if (key === "ArrowUp") llk3d.pitch = Math.max(-1.25, Math.min(1.25, llk3d.pitch + step));
      else llk3d.pitch = Math.max(-1.25, Math.min(1.25, llk3d.pitch - step));
      llk3d.lastInput = nowMs();
      return true;
    }
    if (key === "+" || key === "=") {
      llk3d.zoom = Math.min(3.2, llk3d.zoom * 1.15);
      llk3d.lastInput = nowMs();
      return true;
    }
    if (key === "-" || key === "_") {
      llk3d.zoom = Math.max(0.45, llk3d.zoom / 1.15);
      llk3d.lastInput = nowMs();
      return true;
    }
    if (key && key.toLowerCase() === "h") {
      showHint3D();
      return true;
    }
    return false;
  };

  /* 难度/提示/副标题等界面文案与当前玩法同步 */
  function applyLlkDifficultyLabels() {
    if (!difficultyEl || !difficultyEl.options) return;
    const opts = difficultyEl.options;
    for (let i = 0; i < opts.length; i++) {
      const opt = opts[i];
      const key = opt.value;
      if (llkModeKey === "3d") {
        const cfg = LLK3D_DIFFICULTIES[key];
        if (cfg) opt.textContent = cfg.name + " " + cfg.size + "³";
      } else {
        const cfg = DIFFICULTIES[key];
        if (cfg) opt.textContent = cfg.name + " " + cfg.rows + "×" + cfg.cols;
      }
    }
  }

  function applyLlkModeTexts() {
    applyLlkDifficultyLabels();
    const is3d = llkModeKey === "3d";
    const isLevels = llkModeKey === "levels";
    if (hintEl) hintEl.textContent = is3d ? LLK3D_TEXT.hint : (isLevels ? LEVEL_TEXT.hint : LLK3D_TEXT.classicHint);
    if (taglineEl) taglineEl.textContent = is3d ? LLK3D_TEXT.tag : (isLevels ? LEVEL_TEXT.tag : LLK3D_TEXT.classicTag);
    if (hintBtn) hintBtn.hidden = is3d;
    if (difficultyEl && difficultyEl.parentElement) difficultyEl.parentElement.hidden = isLevels;
    renderLevelPicker();
  }

  /* ----------------------------- 启动 ----------------------------- */

  function init() {
    game.progress = readLevelProgress(getLocalStorage());
    buildCells();
    bindControls();
    applyLlkModeTexts(); // 难度选项/提示文案与当前玩法保持一致
    // 有协调器时由协调器统一路由;首次进入 lianliankan 前先建好初始棋盘
    const coordinator = typeof window !== "undefined" ? window.__GAME_TABS__ : null;
    if (coordinator && typeof coordinator.getCurrent === "function") {
      // 预生成当前玩法棋盘(切换 Tab 后首帧即有内容)
      const key = difficultyEl ? difficultyEl.value : "medium";
      if (llkModeKey === "3d") {
        start3DGame(LLK3D_DIFFICULTIES[key] ? key : "medium");
      } else if (llkModeKey === "levels") {
        startLevel(1);
      } else {
        startNew(DIFFICULTIES[key] ? key : "medium");
      }
      if (coordinator.getCurrent() === "lianliankan") onLinkActivate();
    }
  }

  init();

  /* 暴露纯逻辑,供 Node 测试与调试 */
  if (typeof window !== "undefined") {
    window.addEventListener("error", (e) => {
      try {
        window.__llk3dError = (e && e.error && (e.error.stack || e.error.message)) || (e && e.message) || String(e);
      } catch (err) {
        /* ignore */
      }
    });
  }
  if (typeof window !== "undefined") {
    window.__LLK__ = {
      DIFFICULTIES,
      LLK3D_DIFFICULTIES,
      EMOJI_POOL,
      makeBoard,
      findPath,
      explainPairFailure, // 配对失败原因纯逻辑
      findAnyPair,
      countRemaining,
      reshuffle,
      isEmptyCell,
      segmentClear,
      computePathPoints,
      getLineStrokeWidth,
      levelFlow: {
        nextScore: nextPairScore,
        resetCombo: resetLevelCombo,
        expireCombo: expireLevelCombo,
        scorePair: scorePairForMode,
        applyClearBonus: applyLevelClearBonus,
        dropPlan: makeDropPlan,
        isSelectable: isSelectableTile,
        findHintPair,
        defaultProgress: defaultLevelProgress,
        readProgress: readLevelProgress,
        writeProgress: writeLevelProgress,
        recordCompletion: recordLevelCompletion,
        ensureSolvable: ensureLevelSolvable,
      },
      llk3d: {
        DIFFICULTIES: LLK3D_DIFFICULTIES,
        isSurfaceCell: isSurfaceCell3D,
        idx: idx3D,
        dimsCube: dimsCube3D,
        axisDiff: axisDiff3D,
        makeBoard: make3DBoard,
        findPath: find3DPath,
        findAnyPair: find3DAnyPair,
        countRemaining: count3DRemaining,
        reshuffle: reshuffle3D,
        expandPath: expandPath3D,
        surfaceCells: surfaceCellList3D,
        emptyCells: emptySurfaceList3D,
        tiles: tileList3D,
      },
    };
  }
})();
