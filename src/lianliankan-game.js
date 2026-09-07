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

  /* 图案集:全部使用单字符 emoji,同一图案用 id 编号表示。 */
  const EMOJI_POOL = ["🍎", "🍌", "🍇", "🍊", "🍓", "🍉", "🍑", "🍒", "🥝", "🍍", "🥥", "🥭"];

  /* 难度:rows×cols 需可被 kinds 整除且每类数量为偶数。 */
  const DIFFICULTIES = {
    easy: { name: "简单", rows: 6, cols: 8, kinds: 8 }, // 48 格,每类 6 个(3 对)
    medium: { name: "中等", rows: 8, cols: 10, kinds: 10 }, // 80 格,每类 8 个(4 对)
    hard: { name: "困难", rows: 10, cols: 12, kinds: 12 }, // 120 格,每类 10 个(5 对)
  };

  /* 连线动画时长与消除延时(ms) */
  const LINE_MS = 260;
  const CLEAR_MS = 160;

  /* ----------------------------- 纯逻辑 -----------------------------
   * 棋盘以二维索引 grid[r * cols + c] 存储,0 = 空位,>0 = 图案 id(1..kinds)。
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
    if (va === 0 || va !== vb) return null;

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
    if (!va || !vb) return "请选择两个有效图案";
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
      if (grid[i] === 0) continue;
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
    for (let i = 0; i < grid.length; i++) if (grid[i] !== 0) n += 1;
    return n;
  }

  /* 将剩余图案重新随机铺满所有空位,并保证重排后至少存在一对可连。
   * 失败保护:尝试若干次随机排布;仍无解时把某个仍有 ≥2 个的图案
   * 强制放到一对相邻空位(此时其它格全空,相邻对必然可连)。 */
  function reshuffle(grid, rows, cols) {
    const total = rows * cols;
    const remaining = [];
    const emptyIdx = [];
    for (let i = 0; i < total; i++) {
      if (grid[i] === 0) emptyIdx.push(i);
      else remaining.push(grid[i]);
    }
    if (remaining.length === 0) return false;

    const place = (arr) => {
      for (let i = 0; i < emptyIdx.length; i++) grid[emptyIdx[i]] = arr[i];
    };

    // 尝试随机排布直至有解(上限 80 次)
    for (let attempt = 0; attempt < 80; attempt++) {
      place(shuffle(remaining.slice()));
      if (findAnyPair(grid, rows, cols)) return true;
    }

    // 保底:找仍有 ≥2 个的图案,放入一对"同行相邻空位"
    const kinds = new Set(remaining);
    const r0 = Math.floor(emptyIdx[0] / cols);
    const c0 = emptyIdx[0] % cols;
    const first = grid[r0 * cols + c0] === 0 ? grid[r0 * cols + c0] : null;
    void first;
    // 更稳妥:直接随机挑两个相邻空位(同行相邻),填入同一种图案
    for (let attempt = 0; attempt < 200; attempt++) {
      const ri = Math.floor(Math.random() * emptyIdx.length);
      const anchor = emptyIdx[ri];
      const ar = Math.floor(anchor / cols);
      const ac = anchor % cols;
      const candidates = [];
      if (ac + 1 < cols && grid[anchor + 1] === 0) candidates.push(anchor + 1);
      if (ac - 1 >= 0 && grid[anchor - 1] === 0) candidates.push(anchor - 1);
      if (candidates.length === 0) continue;
      const pairKind = remaining[Math.floor(Math.random() * remaining.length)];
      // 确保该图案还剩 ≥2 个可放
      const kindCount = remaining.filter((v) => v === pairKind).length;
      if (kindCount < 2) continue;
      // 填这对
      const bIdx = candidates[0];
      grid[anchor] = pairKind;
      grid[bIdx] = pairKind;
      // 剩余图案填入剩余空位(去掉已用的 2 个该图案)
      const rest = remaining.slice();
      let removed = 0;
      const cleaned = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === pairKind && removed < 2) {
          removed++;
          continue;
        }
        cleaned.push(rest[i]);
      }
      const leftEmpty = emptyIdx.filter((idx) => idx !== anchor && idx !== bIdx);
      for (let i = 0; i < leftEmpty.length; i++) grid[leftEmpty[i]] = cleaned[i];
      return true;
    }
    return false;
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
  };

  const cellEls = []; // 与 grid 索引一一对应的 button
  let llkActive = false;

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

  function renderTimer() {
    if (timerEl) timerEl.textContent = formatTime(elapsedSeconds());
  }

  function startTimer() {
    if (game.timerId !== null) return;
    game.startAt = nowMs();
    game.timerId = setInterval(() => {
      if (game.started && !game.ended && !game.paused) {
        renderTimer();
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

  function setLeft() {
    if (!leftEl) return;
    const pairs = Math.floor(countRemaining(game.grid) / 2);
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
    return "第 " + (r + 1) + " 行第 " + (c + 1) + " 列" + (v ? " " + EMOJI_POOL[v - 1] : " 空");
  }

  function updateCell(index) {
    const btn = cellEls[index];
    if (!btn) return;
    const r = Math.floor(index / game.cols);
    const c = index % game.cols;
    const value = game.grid[index];
    btn.textContent = value === 0 ? "" : EMOJI_POOL[value - 1];
    btn.setAttribute("aria-label", cellLabel(r, c));
    const isSel = game.sel !== null && game.sel.r === r && game.sel.c === c;
    btn.classList.toggle("is-sel", isSel && value !== 0);
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

  /* ----------------------------- 游戏流程 ----------------------------- */

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
    setStatus("通关 🎉");
    clearSelection();
    shell.classList.add("llk-won");
  }

  function handleCellClick(r, c) {
    if (game.ended || game.busy || game.paused) return;
    const value = game.grid[r * game.cols + c];
    if (value === 0) return;

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
      clearSelection();
      const poly = drawLine(path);
      setTimeout(() => {
        // 消除两格并淡出连线
        setCellValue(a.r, a.c, 0);
        setCellValue(b.r, b.c, 0);
        if (poly && poly.style) poly.style.transition = "opacity " + CLEAR_MS + "ms ease";
        if (poly && poly.style) poly.style.opacity = "0";
        setTimeout(() => {
          clearLine();
          game.busy = false;
          if (countRemaining(game.grid) === 0) {
            win();
          } else {
            setLeft();
            // 死局检测:无可用配对则提示重排
            if (!findAnyPair(game.grid, game.rows, game.cols)) {
              setStatus("无可用配对,点「重排」");
              if (shuffleBtn) shuffleBtn.classList.add("is-highlight");
            } else if (shuffleBtn) {
              shuffleBtn.classList.remove("is-highlight");
            }
          }
        }, CLEAR_MS);
      }, LINE_MS);
    } else {
      // 配对失败:新点击的格成为选中格
      showTransientStatus(reason);
      clearSelection();
      game.sel = b;
      updateCell(b.r * game.cols + b.c);
    }
  }

  function loadBoard(rows, cols, kinds) {
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
    stopTimer();
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

  function handleShuffle() {
    if (game.ended || game.busy) return;
    if (!game.grid) return;
    if (countRemaining(game.grid) === 0) return;
    const ok = reshuffle(game.grid, game.rows, game.cols);
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

  function bindControls() {
    if (newBtn) newBtn.addEventListener("click", () => startNew(difficultyEl.value));
    if (shuffleBtn) shuffleBtn.addEventListener("click", handleShuffle);
    if (difficultyEl) {
      difficultyEl.addEventListener("change", () => {
        if (llkActive) startNew(difficultyEl.value);
      });
    }
    window.addEventListener("resize", () => {
      if (game.grid) applyCellSize();
    });

    const coordinator = typeof window !== "undefined" ? window.__GAME_TABS__ : null;
    if (coordinator && typeof coordinator.register === "function") {
      coordinator.register("lianliankan", {
        onActivate: onLinkActivate,
        onDeactivate: onLinkDeactivate,
      });
    }
  }

  /* 连连看激活期间在捕获阶段接管键盘:拦截 R 防止误触扫雷重开 */
  document.addEventListener(
    "keydown",
    (e) => {
      if (!llkActive) return;
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const key = e.key;
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
    if (!game.grid) {
      const key = difficultyEl ? difficultyEl.value : "medium";
      startNew(DIFFICULTIES[key] ? key : "medium");
      return;
    }
    // 首次进入且未开始:保持待开始。切回时若因切走自动暂停则恢复
    if (game.autoPaused) {
      game.autoPaused = false;
      if (game.started && !game.ended) {
        resumeTimer();
        setStatus("进行中");
        renderTimer();
      }
    }
    renderAll();
    setLeft();
  }

  function onLinkDeactivate() {
    llkActive = false;
    // 切走:若进行中则自动暂停,防止后台静默计时
    if (game.started && !game.ended && !game.paused) {
      game.autoPaused = true;
      pauseTimer();
    }
  }

  /* ----------------------------- 启动 ----------------------------- */

  function init() {
    buildCells();
    bindControls();
    // 有协调器时由协调器统一路由;首次进入 lianliankan 前先建好初始棋盘
    const coordinator = typeof window !== "undefined" ? window.__GAME_TABS__ : null;
    if (coordinator && typeof coordinator.getCurrent === "function") {
      // 预生成当前难度棋盘(切换 Tab 后首帧即有内容)
      const key = difficultyEl ? difficultyEl.value : "medium";
      startNew(DIFFICULTIES[key] ? key : "medium");
      if (coordinator.getCurrent() === "lianliankan") onLinkActivate();
    }
  }

  init();

  /* 暴露纯逻辑,供 Node 测试与调试 */
  if (typeof window !== "undefined") {
    window.__LLK__ = {
      DIFFICULTIES,
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
    };
  }
})();
