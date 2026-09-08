/* 独立标准数独小游戏(与传统扫雷、数独扫雷相互独立)
 *
 * 设计约束:
 * 1. 本文件为普通 <script>(非 ES module),与 src/app.js(扫雷)同页加载。
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

  function isBoardArray(board) {
    return Array.isArray(board) && board.length === TOTAL;
  }

  function getCandidates(board, index) {
    if (!isBoardArray(board) || index < 0 || index >= TOTAL || board[index] !== 0) return [];
    const candidates = [];
    for (let value = 1; value <= SIZE; value++) {
      if (canPlace(board, index, value)) candidates.push(value);
    }
    return candidates;
  }

  function makeHint(strategy, index, digit, unitType, unitIndex) {
    let explanation = "高亮格的候选数只剩一个，可以直接完成这一格。";
    if (strategy === "hidden-single") {
      const unitName = unitType === "row" ? "这一行" : unitType === "column" ? "这一列" : "这一宫";
      explanation = "在" + unitName + "中，高亮格是某个数字唯一可以放置的位置。";
    }
    return { strategy, index, digit, unitType, unitIndex, explanation };
  }

  function findBasicHint(board) {
    if (!isBoardArray(board)) return null;

    for (let index = 0; index < TOTAL; index++) {
      const candidates = getCandidates(board, index);
      if (candidates.length === 1) {
        return makeHint("naked-single", index, candidates[0], null, null);
      }
    }

    const units = [];
    for (let row = 0; row < SIZE; row++) {
      units.push({ type: "row", index: row, cells: Array.from({ length: SIZE }, (_, col) => row * SIZE + col) });
    }
    for (let col = 0; col < SIZE; col++) {
      units.push({ type: "column", index: col, cells: Array.from({ length: SIZE }, (_, row) => row * SIZE + col) });
    }
    for (let box = 0; box < SIZE; box++) {
      const br = Math.floor(box / 3) * 3;
      const bc = (box % 3) * 3;
      const cells = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) cells.push((br + dr) * SIZE + bc + dc);
      }
      units.push({ type: "box", index: box, cells });
    }

    for (const unit of units) {
      for (let digit = 1; digit <= SIZE; digit++) {
        const possibleCells = unit.cells.filter(
          (index) => board[index] === 0 && getCandidates(board, index).includes(digit),
        );
        if (possibleCells.length === 1) {
          return makeHint("hidden-single", possibleCells[0], digit, unit.type, unit.index);
        }
      }
    }
    return null;
  }

  function countRemaining(solution, values, digit) {
    if (!isBoardArray(solution) || !isBoardArray(values) || !Number.isInteger(digit)) return 0;
    let remaining = 0;
    for (let index = 0; index < TOTAL; index++) {
      if (solution[index] === digit && values[index] === 0) remaining += 1;
    }
    return remaining;
  }

  function isNumberArray(value, min, max) {
    return (
      Array.isArray(value) &&
      value.length === TOTAL &&
      value.every((item) => Number.isInteger(item) && item >= min && item <= max)
    );
  }

  function isValidSolution(board) {
    if (!isNumberArray(board, 1, SIZE)) return false;
    for (let row = 0; row < SIZE; row++) {
      const rowValues = new Set();
      const colValues = new Set();
      for (let offset = 0; offset < SIZE; offset++) {
        rowValues.add(board[row * SIZE + offset]);
        colValues.add(board[offset * SIZE + row]);
      }
      if (rowValues.size !== SIZE || colValues.size !== SIZE) return false;
    }
    for (let box = 0; box < SIZE; box++) {
      const br = Math.floor(box / 3) * 3;
      const bc = (box % 3) * 3;
      const values = new Set();
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) values.add(board[(br + dr) * SIZE + bc + dc]);
      }
      if (values.size !== SIZE) return false;
    }
    return true;
  }

  function serializeSave(record) {
    return JSON.stringify({ ...record, version: 1 });
  }

  function deserializeSave(raw, difficulty) {
    try {
      const record = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!DIFFICULTIES[difficulty] || !record || record.version !== 1 || record.difficulty !== difficulty) return null;
      if (!isNumberArray(record.puzzle, 0, SIZE)) return null;
      if (!isValidSolution(record.solution)) return null;
      if (!isNumberArray(record.values, 0, SIZE)) return null;
      if (!isNumberArray(record.notes, 0, 511)) return null;
      if (!Number.isFinite(record.elapsedMs) || record.elapsedMs < 0) return null;
      if (typeof record.started !== "boolean" || typeof record.ended !== "boolean") return null;
      for (let index = 0; index < TOTAL; index++) {
        if (record.puzzle[index] !== 0 && record.puzzle[index] !== record.solution[index]) return null;
        if (record.puzzle[index] !== 0 && record.values[index] !== record.puzzle[index]) return null;
      }
      const restored = {
        difficulty: record.difficulty,
        puzzle: record.puzzle.slice(),
        solution: record.solution.slice(),
        values: record.values.slice(),
        notes: record.notes.slice(),
        elapsedMs: record.elapsedMs,
        started: record.started,
        ended: record.ended,
      };
      if (typeof record.paused === "boolean") restored.paused = record.paused;
      return restored;
    } catch {
      return null;
    }
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
  const notesToggleBtn = document.getElementById("sudokuNotesToggle");
  const undoBtn = document.getElementById("sudokuUndo");
  const redoBtn = document.getElementById("sudokuRedo");
  const hintBtn = document.getElementById("sudokuHintButton");
  const digitInfoEl = document.getElementById("sudokuDigitInfo");
  const hintTextEl = document.getElementById("sudokuHintText");
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
    notes: new Array(TOTAL).fill(0), // 每格 9 位候选数位掩码
    noteMode: false,
    activeDigit: 0,
    hintTarget: null,
    past: [],
    future: [],
    started: false,
    ended: false,
    paused: false,
    sel: -1,
    baseMs: 0,
    startAt: null,
    timerId: null,
    generating: false,
    generationToken: 0,
  };

  const cells = []; // 81 个按钮
  const padKeys = [];
  let sudokuActive = false;
  let lastSavedSecond = -1;
  const SAVE_PREFIX = "sudoku-classic-";
  const SAVE_VERSION_SUFFIX = "-v1";
  const MAX_HISTORY = 200;

  /* ----------------------------- 计时 ----------------------------- */

  function nowMs() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function currentElapsedMs() {
    const extra = game.startAt === null ? 0 : Math.max(0, nowMs() - game.startAt);
    return Math.max(0, game.baseMs + extra);
  }

  function elapsedSeconds() {
    return Math.floor(currentElapsedMs() / 1000);
  }

  function renderTimer() {
    if (timerEl) timerEl.textContent = formatTime(elapsedSeconds());
  }

  function commitElapsed() {
    if (game.startAt !== null) {
      game.baseMs = currentElapsedMs();
      game.startAt = null;
    }
  }

  function startTimer() {
    if (game.timerId !== null || game.ended || game.paused) return;
    game.startAt = nowMs();
    game.timerId = setInterval(() => {
      if (!game.started || game.ended || game.paused) return;
      renderTimer();
      const second = elapsedSeconds();
      if (second !== lastSavedSecond) {
        persistProgress();
        lastSavedSecond = second;
      }
      if (second >= 5999) {
        commitElapsed();
        stopTimer();
        persistProgress();
      }
    }, 250);
  }

  function stopTimer() {
    if (game.timerId !== null) {
      clearInterval(game.timerId);
      game.timerId = null;
    }
  }

  /* ----------------------------- 存档与状态辅助 ----------------------------- */

  function saveKey(difficulty) {
    return SAVE_PREFIX + difficulty + SAVE_VERSION_SUFFIX;
  }

  function hasStorage() {
    try {
      return typeof localStorage !== "undefined" && localStorage && typeof localStorage.getItem === "function";
    } catch {
      return false;
    }
  }

  function makeSaveRecord() {
    if (!game.puzzle || !game.solution || !game.values) return null;
    return {
      difficulty: game.difficulty,
      puzzle: game.puzzle.slice(),
      solution: game.solution.slice(),
      values: game.values.slice(),
      notes: game.notes.slice(),
      elapsedMs: currentElapsedMs(),
      started: game.started,
      ended: game.ended,
      paused: game.paused,
    };
  }

  function persistProgress() {
    const record = makeSaveRecord();
    if (!record || !hasStorage()) return;
    try {
      localStorage.setItem(saveKey(game.difficulty), serializeSave(record));
    } catch {
      // 存储空间不足或隐私模式不可写时，不阻断数独本身。
    }
  }

  function readSaved(difficulty) {
    if (!hasStorage()) return null;
    try {
      return deserializeSave(localStorage.getItem(saveKey(difficulty)), difficulty);
    } catch {
      return null;
    }
  }

  function isFilled() {
    for (let i = 0; i < TOTAL; i++) {
      if (game.values[i] === 0) return false;
    }
    return true;
  }

  function countMistakes() {
    if (!game.values || !game.solution) return 0;
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
    if (!game.values) return 0;
    let empty = 0;
    for (let i = 0; i < TOTAL; i++) {
      if (game.values[i] === 0) empty += 1;
    }
    return empty;
  }

  function isProgressChanged() {
    if (!game.puzzle || !game.values) return false;
    if (game.started) return true;
    for (let i = 0; i < TOTAL; i++) {
      if (game.values[i] !== game.puzzle[i] || game.notes[i] !== 0) return true;
    }
    return false;
  }

  function snapshot() {
    return { values: game.values.slice(), notes: game.notes.slice() };
  }

  function snapshotsEqual(left, right) {
    for (let i = 0; i < TOTAL; i++) {
      if (left.values[i] !== right.values[i] || left.notes[i] !== right.notes[i]) return false;
    }
    return true;
  }

  function pushHistory(item) {
    game.past.push(item);
    if (game.past.length > MAX_HISTORY) game.past.shift();
    game.future.length = 0;
  }

  function clearHint() {
    game.hintTarget = null;
    if (hintTextEl) hintTextEl.textContent = "点击“提示”获取一个基础解题思路。";
  }

  function setDisabled(element, disabled) {
    if (!element) return;
    element.disabled = disabled;
    element.setAttribute("aria-disabled", String(disabled));
  }

  function renderDigitInfo() {
    if (!digitInfoEl) return;
    if (game.activeDigit < 1 || game.activeDigit > SIZE || !game.solution || !game.values) {
      digitInfoEl.textContent = "输入或选择数字后显示剩余位置";
      return;
    }
    digitInfoEl.textContent =
      "数字 " + game.activeDigit + "：还剩 " + countRemaining(game.solution, game.values, game.activeDigit) + " 个空位";
  }

  function updateControls() {
    const inputLocked = game.ended || game.paused || game.generating;
    setDisabled(notesToggleBtn, inputLocked);
    setDisabled(hintBtn, inputLocked);
    setDisabled(undoBtn, inputLocked || game.past.length === 0);
    setDisabled(redoBtn, inputLocked || game.future.length === 0);
    setDisabled(checkBtn, inputLocked || !game.started);
    setDisabled(pauseBtn, game.generating || !game.started || game.ended);
    setDisabled(resetBtn, game.generating || !game.puzzle);
    setDisabled(newBtn, game.generating);
    setDisabled(difficultyEl, game.generating);
    padKeys.forEach((key) => setDisabled(key, inputLocked));
    if (notesToggleBtn) {
      notesToggleBtn.setAttribute("aria-pressed", String(game.noteMode));
      notesToggleBtn.textContent = game.noteMode ? "笔记：开" : "笔记：关";
    }
    for (let value = 1; value <= SIZE; value++) {
      if (padKeys[value - 1]) padKeys[value - 1].classList.toggle("is-active", game.activeDigit === value);
    }
    if (pauseBtn) pauseBtn.textContent = game.paused ? "继续" : "暂停";
  }

  /* ----------------------------- 视图更新 ----------------------------- */

  function cellLabel(index) {
    if (!game.values || !game.given) return "数独格子";
    const value = game.values[index];
    const parts = [];
    if (game.given[index]) parts.push("题目格");
    parts.push("第 " + (rowOf(index) + 1) + " 行");
    parts.push("第 " + (colOf(index) + 1) + " 列");
    if (value !== 0) parts.push("数字 " + value);
    if (value === 0 && game.notes[index]) parts.push("有候选笔记");
    return parts.join(",");
  }

  function updateCell(index) {
    const btn = cells[index];
    if (!btn || !game.values || !game.given) return;
    const value = game.values[index];
    const isGiven = game.given[index];
    const hintIndex = game.hintTarget ? game.hintTarget.index : -1;
    const inHintUnit = hintIndex >= 0 && (index === hintIndex || PEER_SETS[hintIndex].has(index));

    btn.classList.toggle("is-given", isGiven);
    btn.classList.toggle("is-sel", index === game.sel);
    btn.classList.toggle("is-peer", game.sel >= 0 && PEER_SETS[game.sel].has(index));
    btn.classList.toggle(
      "is-same",
      value !== 0 && game.sel >= 0 && value === game.values[game.sel] && index !== game.sel,
    );
    btn.classList.toggle("is-err", !isGiven && value !== 0 && value !== game.solution[index]);
    btn.classList.toggle("is-dup", value !== 0 && hasDuplicate(index));
    btn.classList.toggle("is-hint-unit", inHintUnit);
    btn.classList.toggle("is-hint-target", index === hintIndex);

    if (btn.valueEl) {
      btn.valueEl.textContent = value === 0 ? "" : String(value);
      btn.valueEl.hidden = value === 0;
    }
    if (btn.notesEl) {
      btn.notesEl.hidden = value !== 0 || game.notes[index] === 0;
      for (let digit = 1; digit <= SIZE; digit++) {
        const note = btn.noteEls[digit - 1];
        if (note) note.classList.toggle("is-visible", value === 0 && (game.notes[index] & (1 << (digit - 1))) !== 0);
      }
    }
    btn.setAttribute("aria-label", cellLabel(index));
  }

  function updateAll() {
    for (let i = 0; i < TOTAL; i++) updateCell(i);
  }

  function renderHud() {
    renderTimer();
    setErrors(countMistakes());
    renderDigitInfo();
    updateControls();
  }

  function render() {
    updateAll();
    renderHud();
  }

  /* ----------------------------- 胜负与操作 ----------------------------- */

  function win() {
    if (game.ended) return;
    commitElapsed();
    game.ended = true;
    game.paused = false;
    stopTimer();
    renderTimer();
    setStatus("胜利 🎉");
    shell.classList.add("sd-won");
    persistProgress();
    renderHud();
  }

  function beginInput() {
    if (!game.started) {
      game.started = true;
      startTimer();
    }
  }

  function runMutation(mutator) {
    if (!game.values || game.ended || game.paused || game.generating) return false;
    const before = snapshot();
    mutator();
    if (snapshotsEqual(before, snapshot())) return false;
    beginInput();
    pushHistory(before);
    clearHint();
    setStatus("进行中");
    render();
    persistProgress();
    lastSavedSecond = elapsedSeconds();
    return true;
  }

  function setValueAt(index, value) {
    if (index < 0 || index >= TOTAL || !Number.isInteger(value) || value < 0 || value > SIZE) return;
    if (game.ended || game.paused || game.generating) return;
    if (game.given[index]) {
      setStatus("题目格不可修改");
      return;
    }
    const changed = runMutation(() => {
      game.values[index] = value;
      game.notes[index] = 0;
    });
    if (changed && value !== 0 && isFilled() && countMistakes() === 0) win();
  }

  function toggleNoteAt(index, digit) {
    if (index < 0 || index >= TOTAL || digit < 1 || digit > SIZE) return;
    if (game.ended || game.paused || game.generating || game.given[index] || game.values[index] !== 0) return;
    runMutation(() => {
      game.notes[index] ^= 1 << (digit - 1);
    });
  }

  function eraseAt(index) {
    if (index < 0 || index >= TOTAL || game.ended || game.paused || game.generating) return;
    if (game.given[index]) return;
    runMutation(() => {
      game.values[index] = 0;
      game.notes[index] = 0;
    });
  }

  function setActiveDigit(value) {
    if (Number.isInteger(value) && value >= 1 && value <= SIZE) {
      game.activeDigit = value;
      renderDigitInfo();
      updateControls();
    }
  }

  function select(index) {
    if (!game.values || index < 0 || index >= TOTAL) return;
    game.sel = index;
    if (game.values[index] !== 0) setActiveDigit(game.values[index]);
    updateAll();
  }

  function setNoteMode(enabled) {
    if (game.ended || game.paused || game.generating) return;
    game.noteMode = Boolean(enabled);
    updateControls();
  }

  function toggleNoteMode() {
    setNoteMode(!game.noteMode);
  }

  function typeValue(value) {
    if (game.ended || game.paused || game.generating) return;
    setActiveDigit(value);
    if (game.sel < 0) {
      setStatus("请先选中一个格子");
      return;
    }
    if (game.noteMode) toggleNoteAt(game.sel, value);
    else setValueAt(game.sel, value);
  }

  function eraseSelected() {
    if (game.sel >= 0) eraseAt(game.sel);
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

  function restoreSnapshot(item) {
    game.values = item.values.slice();
    game.notes = item.notes.slice();
  }

  function undo() {
    if (!game.values || game.ended || game.paused || game.generating || game.past.length === 0) return;
    const current = snapshot();
    const previous = game.past.pop();
    game.future.push(current);
    restoreSnapshot(previous);
    clearHint();
    setStatus("已撤销");
    render();
    persistProgress();
    lastSavedSecond = elapsedSeconds();
  }

  function redo() {
    if (!game.values || game.ended || game.paused || game.generating || game.future.length === 0) return;
    const current = snapshot();
    const next = game.future.pop();
    game.past.push(current);
    restoreSnapshot(next);
    clearHint();
    setStatus("已重做");
    render();
    persistProgress();
    lastSavedSecond = elapsedSeconds();
  }

  /* 一键校验:给出剩余格数 / 错误数,全对即胜利 */
  function checkBoard() {
    if (game.ended || game.paused || game.generating) return;
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

  function requestHint() {
    if (!game.values || game.ended || game.paused || game.generating) return;
    clearHint();
    if (countMistakes() > 0) {
      setStatus("请先修正错误");
      if (hintTextEl) hintTextEl.textContent = "请先修正错误";
      renderHud();
      return;
    }
    const hint = findBasicHint(game.values);
    if (!hint) {
      setStatus("当前局面暂无基础提示，可以尝试更高级推理");
      if (hintTextEl) hintTextEl.textContent = "当前局面暂无基础提示，可以尝试更高级推理";
      renderHud();
      return;
    }
    beginInput();
    game.hintTarget = {
      index: hint.index,
      strategy: hint.strategy,
      unitType: hint.unitType,
      unitIndex: hint.unitIndex,
    };
    game.baseMs += 30000;
    if (hintTextEl) hintTextEl.textContent = hint.explanation;
    setStatus("已显示一个基础提示");
    render();
    persistProgress();
    lastSavedSecond = elapsedSeconds();
  }

  /* ----------------------------- 开局、存档与重置 ----------------------------- */

  function loadPuzzle(puzzle, solution, options) {
    const opts = options || {};
    game.solution = solution.slice();
    game.puzzle = puzzle.slice();
    game.values = (opts.values || puzzle).slice();
    game.given = puzzle.map((v) => v !== 0);
    game.notes = (opts.notes || new Array(TOTAL).fill(0)).slice();
    game.started = opts.started === true;
    game.ended = opts.ended === true;
    game.paused = !game.ended && opts.paused === true;
    game.baseMs = Number.isFinite(opts.elapsedMs) && opts.elapsedMs >= 0 ? opts.elapsedMs : 0;
    game.startAt = null;
    game.sel = -1;
    game.activeDigit = 0;
    game.noteMode = false;
    game.hintTarget = null;
    game.past = [];
    game.future = [];
    lastSavedSecond = Math.floor(game.baseMs / 1000);
    stopTimer();
    shell.classList.remove("sd-won");
    if (game.ended) {
      shell.classList.add("sd-won");
      setStatus("胜利 🎉");
    } else if (game.paused) {
      setStatus("已恢复，当前暂停");
    } else if (game.started) {
      setStatus("进行中");
      startTimer();
    } else {
      setStatus("待开始");
    }
    clearHint();
    render();
  }

  function loadSaved(record) {
    if (!record) return false;
    loadPuzzle(record.puzzle, record.solution, {
      values: record.values,
      notes: record.notes,
      elapsedMs: record.elapsedMs,
      started: record.started,
      ended: record.ended,
      paused: record.started && !record.ended,
    });
    persistProgress();
    return true;
  }

  function askConfirm(message, fallback) {
    if (typeof window !== "undefined" && typeof window.confirm === "function") return window.confirm(message);
    return fallback;
  }

  function startNew(difficultyKey, options) {
    const opts = options || {};
    const key = DIFFICULTIES[difficultyKey] ? difficultyKey : "medium";
    if (!opts.skipConfirm && isProgressChanged()) {
      const confirmed = askConfirm("当前对局尚未完成，确定开始新题吗？", false);
      if (!confirmed) {
        if (difficultyEl) difficultyEl.value = game.difficulty;
        return;
      }
    }
    persistProgress();
    game.difficulty = key;
    if (difficultyEl) difficultyEl.value = key;
    game.generating = true;
    updateControls();
    setStatus("正在生成题目…");
    const token = ++game.generationToken;
    // 先让"生成中"状态绘制出来,再同步生成(难档可能需数百毫秒)
    setTimeout(() => {
      if (token !== game.generationToken) return;
      const config = DIFFICULTIES[key] || DIFFICULTIES.medium;
      const result = makePuzzle(config.blanks);
      game.generating = false;
      loadPuzzle(result.puzzle, result.solution);
      persistProgress();
      updateControls();
    }, 30);
  }

  function resetCurrent() {
    if (!game.puzzle) {
      startNew(game.difficulty, { skipConfirm: true });
      return;
    }
    loadPuzzle(game.puzzle, game.solution);
    persistProgress();
  }

  function togglePause() {
    if (!game.started || game.ended || game.generating) return;
    if (game.paused) {
      game.paused = false;
      startTimer();
      pauseBtn.textContent = "暂停";
      setStatus("进行中");
    } else {
      commitElapsed();
      game.paused = true;
      stopTimer();
      pauseBtn.textContent = "继续";
      setStatus("已暂停");
    }
    renderHud();
    persistProgress();
    lastSavedSecond = elapsedSeconds();
  }

  function handleDifficultyChange() {
    if (!sudokuActive || game.generating) return;
    const key = DIFFICULTIES[difficultyEl.value] ? difficultyEl.value : "medium";
    if (key === game.difficulty) return;
    persistProgress();
    const saved = readSaved(key);
    if (saved) {
      const restore = askConfirm("发现该难度有未完成存档，确定恢复吗？取消将开始新题。", true);
      if (restore) {
        game.difficulty = key;
        difficultyEl.value = key;
        loadSaved(saved);
        return;
      }
    }
    startNew(key, { skipConfirm: true });
  }

  /* ----------------------------- Tab 切换 -----------------------------
   * 三游戏共用的 Tab 高亮与壳显隐统一由 src/game-tabs.js 仲裁。
   * 本脚本只注册"被激活 / 被停用"的生命周期回调,不再自行维护 Tab UI。
   * 若协调器缺席(如 Node VM 测试环境),退回旧的二态直切逻辑,保证可独立运行。
   */

  function pauseIfRunning() {
    if (game.started && !game.ended && !game.paused) togglePause();
    else persistProgress();
  }

  function ensurePuzzle() {
    if (!game.puzzle) {
      const key = difficultyEl ? difficultyEl.value : "medium";
      const difficulty = DIFFICULTIES[key] ? key : "medium";
      const saved = readSaved(difficulty);
      if (!loadSaved(saved)) startNew(difficulty, { skipConfirm: true });
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

      const valueEl = document.createElement("span");
      valueEl.className = "sd-value";
      const notesEl = document.createElement("span");
      notesEl.className = "sd-notes";
      notesEl.setAttribute("aria-hidden", "true");
      const noteEls = [];
      for (let digit = 1; digit <= SIZE; digit++) {
        const note = document.createElement("span");
        note.className = "sd-note";
        note.textContent = String(digit);
        notesEl.appendChild(note);
        noteEls.push(note);
      }
      btn.valueEl = valueEl;
      btn.notesEl = notesEl;
      btn.noteEls = noteEls;
      btn.appendChild(valueEl);
      btn.appendChild(notesEl);
      btn.addEventListener("click", () => select(i));
      boardEl.appendChild(btn);
      cells.push(btn);
    }
  }

  function buildPad() {
    padEl.innerHTML = "";
    padKeys.length = 0;
    for (let value = 1; value <= SIZE; value++) {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "sd-key";
      key.textContent = String(value);
      key.dataset.digit = String(value);
      key.setAttribute("aria-label", "填入数字 " + value);
      key.addEventListener("click", () => typeValue(value));
      padEl.appendChild(key);
      padKeys.push(key);
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
      const key = e.key || "";
      const lowerKey = key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && lowerKey === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && lowerKey === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && lowerKey === "n") {
        e.preventDefault();
        toggleNoteMode();
        return;
      }
      if (lowerKey === "r") {
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
        if (map[key]) moveSelection(map[key][0], map[key][1]);
      }
    },
    true,
  );

  function bindControls() {
    if (newBtn) newBtn.addEventListener("click", () => startNew(difficultyEl.value));
    if (checkBtn) checkBtn.addEventListener("click", checkBoard);
    if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
    if (resetBtn) resetBtn.addEventListener("click", resetCurrent);
    if (notesToggleBtn) notesToggleBtn.addEventListener("click", toggleNoteMode);
    if (undoBtn) undoBtn.addEventListener("click", undo);
    if (redoBtn) redoBtn.addEventListener("click", redo);
    if (hintBtn) hintBtn.addEventListener("click", requestHint);
    if (difficultyEl) difficultyEl.addEventListener("change", handleDifficultyChange);
    document.addEventListener("visibilitychange", persistProgress);
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", persistProgress);
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

  function getState() {
    return {
      difficulty: game.difficulty,
      puzzle: game.puzzle ? game.puzzle.slice() : null,
      values: game.values ? game.values.slice() : null,
      notes: game.notes.slice(),
      started: game.started,
      ended: game.ended,
      paused: game.paused,
      sel: game.sel,
      activeDigit: game.activeDigit,
      noteMode: game.noteMode,
      baseMs: currentElapsedMs(),
      hintTarget: game.hintTarget
        ? {
            index: game.hintTarget.index,
            strategy: game.hintTarget.strategy,
            unitType: game.hintTarget.unitType,
            unitIndex: game.hintTarget.unitIndex,
          }
        : null,
      canUndo: game.past.length > 0 && !game.paused && !game.ended,
      canRedo: game.future.length > 0 && !game.paused && !game.ended,
    };
  }

  /* ----------------------------- 启动 ----------------------------- */

  function init() {
    buildBoard();
    buildPad();
    bindControls();
    renderHud();
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

  /* 暴露纯逻辑与只读状态,供 Node 测试与调试 */
  if (typeof window !== "undefined") {
    window.__SUDOKU__ = {
      DIFFICULTIES,
      makePuzzle,
      countSolutions,
      solveOnce,
      shuffle,
      getCandidates,
      findBasicHint,
      countRemaining,
      serializeSave,
      deserializeSave,
      getState,
    };
  }
})();
