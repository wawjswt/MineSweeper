/* 独立标准数独小游戏(与传统扫雷、数独扫雷相互独立)
 *
 * 设计约束:
 * 1. 本文件为普通 <script>(非 ES module),与 dist/bundle.js(扫雷)同页加载。
 *    bundle.js 在顶层声明了大量 const/function,共享同一全局词法环境,
 *    因此本文件必须整体包裹在 IIFE 中,任何顶层变量都不外泄。
 * 2. 题目由程序实时生成:随机完整解 + 按难度挖洞,并用解数计数保证唯一解。
 * 3. 与扫雷通过页面顶部「游戏类型」Tab 同页切换;数独激活时在捕获阶段
 *    拦截 R 键,避免误触扫雷的"重开"快捷键。
 */
(function () {
  "use strict";

  const SIZE = 9;
  const TOTAL = SIZE * SIZE;
  const DANGER_LIMIT_MS = 1000; // 挖洞时间预算,防止困难档阻塞过久

  const DIFFICULTIES = {
    easy: { name: "简单", blanks: 36 },
    medium: { name: "中等", blanks: 48 },
    hard: { name: "困难", blanks: 53 },
  };

  /* ----------------------------- 纯逻辑:生成与求解 ----------------------------- */

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function rowOf(index) {
    return Math.floor(index / SIZE);
  }

  function colOf(index) {
    return index % SIZE;
  }

  function canPlace(board, index, value) {
    const r = rowOf(index);
    const c = colOf(index);
    for (let k = 0; k < SIZE; k++) {
      if (board[r * SIZE + k] === value) return false;
      if (board[k * SIZE + c] === value) return false;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        if (board[(br + dr) * SIZE + bc + dc] === value) return false;
      }
    }
    return true;
  }

  function firstEmpty(board) {
    for (let i = 0; i < TOTAL; i++) {
      if (board[i] === 0) return i;
    }
    return -1;
  }

  /* 生成一个完整的随机解(回溯 + 随机候选序)。返回是否成功。 */
  function solveOnce(board) {
    const index = firstEmpty(board);
    if (index === -1) return true;
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let d = 0; d < digits.length; d++) {
      const value = digits[d];
      if (canPlace(board, index, value)) {
        board[index] = value;
        if (solveOnce(board)) return true;
        board[index] = 0;
      }
    }
    return false;
  }

  /* 统计解的数量,最多数到 limit 即返回(剪枝)。用于唯一解校验。 */
  function countSolutions(board, limit) {
    let found = 0;
    const search = () => {
      if (found >= limit) return;
      const index = firstEmpty(board);
      if (index === -1) {
        found += 1;
        return;
      }
      for (let value = 1; value <= SIZE && found < limit; value++) {
        if (canPlace(board, index, value)) {
          board[index] = value;
          search();
          board[index] = 0;
        }
      }
    };
    search();
    return found;
  }

  /*
   * 生成一道唯一解题目。
   * 返回值: { solution, puzzle, removed }
   *  - solution: 完整解(81)
   *  - puzzle:   题目(81,0 表示空格)
   *  - removed:  实际挖掉的数量(困难档可能受时间预算限制而略少)
   */
  function makePuzzle(blankTarget) {
    const solution = new Array(TOTAL).fill(0);
    if (!solveOnce(solution)) {
      // 理论不可达;兜底重试一次
      solution.fill(0);
      solveOnce(solution);
    }

    const puzzle = solution.slice();
    const order = shuffle(Array.from({ length: TOTAL }, (_, i) => i));
    const deadline = typeof performance !== "undefined" ? performance.now() + DANGER_LIMIT_MS : Infinity;
    let removed = 0;

    for (let i = 0; i < order.length; i++) {
      if (removed >= blankTarget) break;
      if (typeof performance !== "undefined" && performance.now() > deadline) break;
      const index = order[i];
      const backup = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle.slice(), 2) !== 1) {
        puzzle[index] = backup;
      } else {
        removed += 1;
      }
    }
    return { solution, puzzle, removed };
  }

  /* ----------------------------- 渲染与游戏状态 ----------------------------- */

  const shell = document.getElementById("sudokuShell");
  const boardEl = document.getElementById("sudokuBoard");
  const padEl = document.getElementById("sudokuPad");
  const timerEl = document.getElementById("sudokuTimer");
  const statusEl = document.getElementById("sudokuStatus");
  const errorsEl = document.getElementById("sudokuErrors");
  const difficultyEl = document.getElementById("sudokuDifficulty");
  const newBtn = document.getElementById("sudokuNew");
  const checkBtn = document.getElementById("sudokuCheck");
  const pauseBtn = document.getElementById("sudokuPause");
  const resetBtn = document.getElementById("sudokuReset");
  const sweepShell = document.getElementById("sweepShell");
  const fireworksLayer = document.getElementById("fireworksLayer");
  const tabSweep = document.getElementById("gameTabSweep");
  const tabSudoku = document.getElementById("gameTabSudoku");

  if (!shell || !boardEl || !padEl || !timerEl || !statusEl || !errorsEl) return;

  /* 目标行/列/宫集合(供高亮与冲突判定复用) */
  const PEER_SETS = (function () {
    const peerSets = new Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) {
      const r = rowOf(i);
      const c = colOf(i);
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      const set = new Set();
      for (let k = 0; k < SIZE; k++) {
        set.add(r * SIZE + k);
        set.add(k * SIZE + c);
      }
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) set.add((br + dr) * SIZE + bc + dc);
      }
      set.delete(i);
      peerSets[i] = set;
    }
    return peerSets;
  })();

  const game = {
    difficulty: "medium",
    solution: null, // 81 完整解
    puzzle: null, // 81 题目(0=空)
    values: null, // 81 用户当前值(0=空)
    given: null, // 81 是否题目格
    started: false,
    ended: false,
    paused: false,
    sel: -1,
    baseMs: 0,
    startAt: null,
    timerId: null,
  };

  const cells = []; // 81 个按钮
  let sudokuActive = false;

  /* ----------------------------- 计时 ----------------------------- */

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
        if (elapsedSeconds() >= 5999) stopTimer();
      }
    }, 250);
  }

  function stopTimer() {
    if (game.timerId !== null) {
      clearInterval(game.timerId);
      game.timerId = null;
    }
  }

  /* ----------------------------- 状态辅助 ----------------------------- */

  function isFilled() {
    for (let i = 0; i < TOTAL; i++) {
      if (game.values[i] === 0) return false;
    }
    return true;
  }

  function countMistakes() {
    let mistakes = 0;
    for (let i = 0; i < TOTAL; i++) {
      if (game.values[i] !== 0 && game.values[i] !== game.solution[i]) mistakes += 1;
    }
    return mistakes;
  }

  function hasDuplicate(index) {
    const value = game.values[index];
    if (value === 0) return false;
    for (const peer of PEER_SETS[index]) {
      if (game.values[peer] === value) return true;
    }
    return false;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setErrors(count) {
    if (errorsEl) errorsEl.textContent = String(count);
  }

  function countEmpty() {
    let empty = 0;
    for (let i = 0; i < TOTAL; i++) {
      if (game.values[i] === 0) empty += 1;
    }
    return empty;
  }

  /* ----------------------------- 视图更新 ----------------------------- */

  function cellLabel(index) {
    const value = game.values[index];
    const parts = [];
    if (game.given[index]) parts.push("题目格");
    parts.push("第 " + (rowOf(index) + 1) + " 行");
    parts.push("第 " + (colOf(index) + 1) + " 列");
    if (value !== 0) parts.push("数字 " + value);
    return parts.join(",");
  }

  function updateCell(index) {
    const btn = cells[index];
    if (!btn) return;
    const value = game.values[index];
    const isGiven = game.given[index];

    btn.classList.toggle("is-given", isGiven);
    btn.classList.toggle("is-sel", index === game.sel);
    btn.classList.toggle(
      "is-peer",
      game.sel >= 0 && PEER_SETS[game.sel].has(index),
    );
    btn.classList.toggle(
      "is-same",
      value !== 0 && game.sel >= 0 && value === game.values[game.sel] && index !== game.sel,
    );
    btn.classList.toggle("is-err", !isGiven && value !== 0 && value !== game.solution[index]);
    btn.classList.toggle("is-dup", value !== 0 && hasDuplicate(index));
    btn.textContent = value === 0 ? "" : String(value);
    btn.setAttribute("aria-label", cellLabel(index));
  }

  function updateAll() {
    for (let i = 0; i < TOTAL; i++) updateCell(i);
  }

  function renderHud() {
    renderTimer();
    setErrors(countMistakes());
  }

  /* ----------------------------- 胜负与操作 ----------------------------- */

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
    setStatus("胜利 🎉");
    pauseBtn.textContent = "暂停";
    shell.classList.add("sd-won");
  }

  function lockInput() {
    return game.ended || game.paused || !game.started;
  }

  function setValueAt(index, value) {
    if (game.ended || game.paused) return;
    if (game.given[index]) {
      setStatus("题目格不可修改");
      return;
    }
    if (!game.started) {
      game.started = true;
      setStatus("进行中");
      startTimer();
    }
    game.values[index] = value;
    updateCell(index);
    setErrors(countMistakes());
    if (value !== 0 && isFilled() && countMistakes() === 0) win();
    else if (value !== 0) setStatus("进行中");
  }

  function eraseAt(index) {
    if (lockInput() || game.given[index]) return;
    game.values[index] = 0;
    updateCell(index);
    setErrors(countMistakes());
  }

  function select(index) {
    game.sel = index;
    updateAll();
  }

  function typeValue(value) {
    if (game.ended || game.paused) return;
    if (game.sel < 0) {
      setStatus("请先选中一个格子");
      return;
    }
    setValueAt(game.sel, value);
  }

  function eraseSelected() {
    if (game.sel < 0) return;
    eraseAt(game.sel);
  }

  function moveSelection(dr, dc) {
    let r;
    let c;
    if (game.sel < 0) {
      r = 4;
      c = 4;
    } else {
      r = rowOf(game.sel) + dr;
      c = colOf(game.sel) + dc;
      r = Math.max(0, Math.min(SIZE - 1, r));
      c = Math.max(0, Math.min(SIZE - 1, c));
    }
    select(r * SIZE + c);
  }

  /* 一键校验:给出剩余格数 / 错误数,全对即胜利 */
  function checkBoard() {
    if (game.ended || game.paused) return;
    if (!game.started) {
      setStatus("先开始填数吧");
      return;
    }
    const empty = countEmpty();
    const mistakes = countMistakes();
    if (empty === 0 && mistakes === 0) {
      win();
      return;
    }
    if (empty > 0 && mistakes === 0) {
      setStatus("还差 " + empty + " 格未填");
    } else if (empty > 0) {
      setStatus("有 " + mistakes + " 处与答案不符,还差 " + empty + " 格");
    } else {
      setStatus("有 " + mistakes + " 处与答案不符");
    }
    updateAll();
  }

  /* ----------------------------- 开局与重置 ----------------------------- */

  function loadPuzzle(puzzle, solution) {
    game.solution = solution.slice();
    game.puzzle = puzzle.slice();
    game.values = puzzle.slice();
    game.given = puzzle.map((v) => v !== 0);
    game.started = false;
    game.ended = false;
    game.paused = false;
    game.baseMs = 0;
    game.startAt = null;
    game.sel = -1;
    stopTimer();
    shell.classList.remove("sd-won");
    pauseBtn.textContent = "暂停";
    setErrors(0);
    setStatus("待开始");
    renderTimer();
    updateAll();
  }

  function startNew(difficultyKey) {
    game.difficulty = difficultyKey;
    if (difficultyEl) difficultyEl.value = difficultyKey;
    setStatus("正在生成题目…");
    // 先让"生成中"状态绘制出来,再同步生成(难档可能需数百毫秒)
    setTimeout(() => {
      const config = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medium;
      const result = makePuzzle(config.blanks);
      loadPuzzle(result.puzzle, result.solution);
    }, 30);
  }

  function resetCurrent() {
    if (!game.puzzle) {
      startNew(game.difficulty);
      return;
    }
    loadPuzzle(game.puzzle, game.solution);
  }

  function togglePause() {
    if (!game.started || game.ended) return;
    if (game.paused) {
      game.paused = false;
      startTimer();
      pauseBtn.textContent = "暂停";
      setStatus("进行中");
    } else {
      if (game.startAt !== null) {
        game.baseMs += nowMs() - game.startAt;
        game.startAt = null;
      }
      game.paused = true;
      stopTimer();
      pauseBtn.textContent = "继续";
      setStatus("已暂停");
    }
    renderTimer();
  }

  /* ----------------------------- Tab 切换 -----------------------------
   * 三游戏共用的 Tab 高亮与壳显隐统一由 src/game-tabs.js 仲裁。
   * 本脚本只注册"被激活 / 被停用"的生命周期回调,不再自行维护 Tab UI。
   * 若协调器缺席(如 Node VM 测试环境),退回旧的二态直切逻辑,保证可独立运行。
   */

  function pauseIfRunning() {
    if (game.started && !game.ended && !game.paused) togglePause();
  }

  function ensurePuzzle() {
    if (!game.puzzle) {
      const key = difficultyEl ? difficultyEl.value : "medium";
      startNew(DIFFICULTIES[key] ? key : "medium");
    }
  }

  function onSudokuActivate() {
    // 切到数独:清理扫雷胜利烟花残留层,避免悬浮
    if (fireworksLayer) fireworksLayer.innerHTML = "";
    sudokuActive = true;
    ensurePuzzle();
  }

  function onSudokuDeactivate() {
    // 切走数独:若对局进行中则自动暂停,防止后台静默计时
    pauseIfRunning();
    sudokuActive = false;
  }

  /* 兼容旧版:无协调器时,本脚本自行完成 扫雷↔数独 的切换(仅双态)。 */
  function activateGameLegacy(gameName) {
    const isSudoku = gameName === "sudoku";
    if (isSudoku) {
      onSudokuActivate();
      shell.hidden = false;
      sweepShell.hidden = true;
    } else {
      pauseIfRunning();
      sudokuActive = false;
      shell.hidden = true;
      sweepShell.hidden = false;
    }
    const active = isSudoku;
    tabSweep.classList.toggle("is-active", !active);
    tabSudoku.classList.toggle("is-active", active);
    tabSweep.setAttribute("aria-selected", String(!active));
    tabSudoku.setAttribute("aria-selected", String(active));
    tabSweep.tabIndex = active ? -1 : 0;
    tabSudoku.tabIndex = active ? 0 : -1;
  }

  /* ----------------------------- 构建界面 ----------------------------- */

  function buildBoard() {
    boardEl.innerHTML = "";
    cells.length = 0;
    for (let i = 0; i < TOTAL; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sd-cell";
      btn.dataset.index = String(i);
      btn.setAttribute("role", "gridcell");
      if (colOf(i) % 3 === 2) btn.classList.add("sd-br");
      if (rowOf(i) % 3 === 2) btn.classList.add("sd-bb");
      btn.addEventListener("click", () => select(i));
      boardEl.appendChild(btn);
      cells.push(btn);
    }
  }

  function buildPad() {
    padEl.innerHTML = "";
    for (let value = 1; value <= SIZE; value++) {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "sd-key";
      key.textContent = String(value);
      key.setAttribute("aria-label", "填入数字 " + value);
      key.addEventListener("click", () => typeValue(value));
      padEl.appendChild(key);
    }
    const erase = document.createElement("button");
    erase.type = "button";
    erase.className = "sd-key sd-key--erase";
    erase.textContent = "⌫";
    erase.setAttribute("aria-label", "清除当前格子");
    erase.addEventListener("click", eraseSelected);
    padEl.appendChild(erase);
  }

  /* 数独激活期间在捕获阶段接管键盘;拦截 R 以免误触扫雷重开 */
  document.addEventListener(
    "keydown",
    (e) => {
      if (!sudokuActive) return;
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const key = e.key;

      if (key.toLowerCase() === "r") {
        e.stopPropagation();
        return;
      }
      if (/^[1-9]$/.test(key)) {
        e.preventDefault();
        typeValue(Number(key));
        return;
      }
      if (key === "0" || key === "Backspace" || key === "Delete") {
        e.preventDefault();
        eraseSelected();
        return;
      }
      if (key.indexOf("Arrow") === 0) {
        e.preventDefault();
        const map = {
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
        };
        moveSelection(map[key][0], map[key][1]);
      }
    },
    true,
  );

  function bindControls() {
    if (newBtn) newBtn.addEventListener("click", () => startNew(difficultyEl.value));
    if (checkBtn) checkBtn.addEventListener("click", checkBoard);
    if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
    if (resetBtn) resetBtn.addEventListener("click", resetCurrent);
    if (difficultyEl) {
      difficultyEl.addEventListener("change", () => {
        if (sudokuActive) startNew(difficultyEl.value);
      });
    }
    // Tab 切换:优先注册到全局协调器(三游戏);缺失时退回自管双态
    const coordinator = typeof window !== "undefined" ? window.__GAME_TABS__ : null;
    if (coordinator && typeof coordinator.register === "function") {
      coordinator.register("sudoku", {
        onActivate: onSudokuActivate,
        onDeactivate: onSudokuDeactivate,
      });
    } else {
      if (tabSweep) tabSweep.addEventListener("click", () => activateGameLegacy("sweep"));
      if (tabSudoku) tabSudoku.addEventListener("click", () => activateGameLegacy("sudoku"));
    }
  }

  /* ----------------------------- 启动 ----------------------------- */

  function init() {
    buildBoard();
    buildPad();
    bindControls();
    // 支持 #sudoku 锚点直达数独(默认仍打开扫雷,与改造前一致)。
    // 有协调器时由协调器统一路由;无协调器时自行处理。
    const coordinator = typeof window !== "undefined" ? window.__GAME_TABS__ : null;
    if (coordinator && typeof coordinator.register === "function") {
      // 协调器已在 DOMContentLoaded 时激活初始游戏;若当前已是数独则补齐初始化
      if (coordinator.getCurrent() === "sudoku") onSudokuActivate();
    } else {
      const initial = window.location.hash.indexOf("sudoku") !== -1 ? "sudoku" : "sweep";
      activateGameLegacy(initial);
    }
  }

  init();

  /* 暴露纯逻辑,供 Node 测试与调试 */
  if (typeof window !== "undefined") {
    window.__SUDOKU__ = {
      DIFFICULTIES,
      makePuzzle,
      countSolutions,
      solveOnce,
      shuffle,
    };
  }
})();
