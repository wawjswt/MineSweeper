import {
  DIFFICULTIES,
  PEER_SETS,
  SIZE,
  TOTAL,
  countRemaining,
  deserializeSave,
  findHint,
  makePuzzle,
  ratePuzzle,
  serializeSave,
} from "../../core/games/sudoku/engine.js";

const SAVE_PREFIX = "sudoku-classic-";
const SAVE_VERSION_SUFFIX = "-v1";
const MAX_HISTORY = 200;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveKey(difficulty) {
  return SAVE_PREFIX + difficulty + SAVE_VERSION_SUFFIX;
}

function makeBlankState(difficulty) {
  return {
    difficulty,
    solution: [],
    puzzle: [],
    values: [],
    given: [],
    notes: [],
    rating: null,
    selectedIndex: -1,
    activeDigit: 0,
    noteMode: false,
    hint: null,
    past: [],
    future: [],
    started: false,
    ended: false,
    paused: false,
    generating: false,
    elapsedMs: 0,
    errors: 0,
    remaining: 0,
    status: "待开始",
    notice: "",
  };
}

function isValidIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < TOTAL;
}

function isValidDigit(digit) {
  return Number.isInteger(digit) && digit >= 1 && digit <= SIZE;
}

export function createSudokuSession({
  difficulty = "medium",
  rng = Math.random,
  clock,
  storage = null,
} = {}) {
  if (!clock || typeof clock.now !== "function") throw new TypeError("clock is required");
  const selectedDifficulty = DIFFICULTIES[difficulty] ? difficulty : "medium";
  const state = makeBlankState(selectedDifficulty);
  const listeners = new Set();
  const hintedStates = new Set();
  let timerId = null;
  let startAt = null;

  function currentElapsedMs() {
    const extra = startAt === null ? 0 : Math.max(0, clock.now() - startAt);
    return Math.max(0, state.elapsedMs + extra);
  }

  function updateDerived() {
    state.errors = state.values.reduce(
      (count, value, index) => count + (value !== 0 && value !== state.solution[index] ? 1 : 0),
      0,
    );
    state.remaining = state.values.reduce((count, value) => count + (value === 0 ? 1 : 0), 0);
  }

  function getState() {
    updateDerived();
    return clone({ ...state, elapsedMs: currentElapsedMs() });
  }

  function notify() {
    const snapshot = getState();
    for (const listener of listeners) listener(snapshot);
  }

  function stopTimer() {
    if (timerId !== null) clock.clearInterval(timerId);
    timerId = null;
    startAt = null;
  }

  function commitElapsed() {
    state.elapsedMs = currentElapsedMs();
    startAt = null;
  }

  function startTimer() {
    if (timerId !== null || !state.started || state.ended || state.paused) return;
    startAt = clock.now();
    timerId = clock.setInterval(() => {
      notify();
      if (currentElapsedMs() >= 5999000) {
        commitElapsed();
        stopTimer();
        persistProgress();
      }
    }, 250);
  }

  function persistProgress() {
    if (!state.puzzle.length || !state.solution.length) return;
    const record = {
      difficulty: state.difficulty,
      puzzle: state.puzzle.slice(),
      solution: state.solution.slice(),
      values: state.values.slice(),
      notes: state.notes.slice(),
      elapsedMs: currentElapsedMs(),
      started: state.started,
      ended: state.ended,
      paused: state.paused,
    };
    try {
      storage?.setItem?.(saveKey(state.difficulty), serializeSave(record));
    } catch {
      // 存储失败不应阻断当前对局。
    }
  }

  function updateStatus() {
    if (state.ended) state.status = "胜利 🎉";
    else if (state.paused) state.status = "已暂停";
    else if (state.started) state.status = "进行中";
    else state.status = "待开始";
  }

  function resetTransientState() {
    state.selectedIndex = -1;
    state.activeDigit = 0;
    state.noteMode = false;
    state.hint = null;
    state.past = [];
    state.future = [];
    hintedStates.clear();
  }

  function loadPuzzle(puzzle, solution, options = {}) {
    stopTimer();
    state.solution = solution.slice();
    state.puzzle = puzzle.slice();
    state.values = (options.values || puzzle).slice();
    state.given = puzzle.map((value) => value !== 0);
    state.notes = (options.notes || new Array(TOTAL).fill(0)).slice();
    state.rating = options.rating || ratePuzzle(state.puzzle);
    state.started = options.started === true;
    state.ended = options.ended === true;
    state.paused = !state.ended && options.paused === true;
    state.elapsedMs = Number.isFinite(options.elapsedMs) && options.elapsedMs >= 0 ? options.elapsedMs : 0;
    state.notice = options.notice || "";
    resetTransientState();
    updateDerived();
    updateStatus();
    if (state.started && !state.ended && !state.paused) startTimer();
  }

  function loadSaved(raw) {
    const record = deserializeSave(raw, state.difficulty);
    if (!record) return false;
    loadPuzzle(record.puzzle, record.solution, record);
    state.notice = "已恢复存档";
    persistProgress();
    return true;
  }

  function generatePuzzle() {
    const config = DIFFICULTIES[state.difficulty] || DIFFICULTIES.medium;
    state.generating = true;
    state.notice = "正在生成题目…";
    notify();
    const result = makePuzzle(config.blanks, { rng, now: () => clock.now() });
    state.generating = false;
    loadPuzzle(result.puzzle, result.solution, { rating: result.rating, notice: "新题已生成" });
    persistProgress();
    notify();
  }

  function resetCurrent() {
    if (!state.puzzle.length) return generatePuzzle();
    loadPuzzle(state.puzzle, state.solution, { rating: state.rating, notice: "已重置当前题目" });
    persistProgress();
    notify();
  }

  function snapshot() {
    return { values: state.values.slice(), notes: state.notes.slice() };
  }

  function sameSnapshot(left, right) {
    return left.values.every((value, index) => value === right.values[index] && left.notes[index] === right.notes[index]);
  }

  function pushHistory(before) {
    state.past.push(before);
    if (state.past.length > MAX_HISTORY) state.past.shift();
    state.future = [];
  }

  function beginInput() {
    if (!state.started) state.started = true;
    startTimer();
  }

  function finishIfSolved() {
    updateDerived();
    if (state.remaining === 0 && state.errors === 0) {
      commitElapsed();
      state.ended = true;
      state.paused = false;
      state.notice = "完成本局";
      stopTimer();
      updateStatus();
    }
  }

  function mutate(mutator) {
    if (!state.values.length || state.ended || state.paused || state.generating) return false;
    const before = snapshot();
    mutator();
    const after = snapshot();
    if (sameSnapshot(before, after)) return false;
    beginInput();
    pushHistory(before);
    state.hint = null;
    state.notice = "进行中";
    updateStatus();
    finishIfSolved();
    persistProgress();
    notify();
    return true;
  }

  function select(index) {
    if (!isValidIndex(index) || !state.values.length) return false;
    state.selectedIndex = index;
    if (state.values[index] !== 0) state.activeDigit = state.values[index];
    notify();
    return true;
  }

  function input(digit) {
    if (!isValidDigit(digit)) return false;
    if (!isValidIndex(state.selectedIndex)) {
      state.notice = "请先选中一个格子";
      notify();
      return false;
    }
    const index = state.selectedIndex;
    state.activeDigit = digit;
    if (state.given[index]) {
      state.notice = "题目格不可修改";
      notify();
      return false;
    }
    const changed = mutate(() => {
      if (state.noteMode) state.notes[index] ^= 1 << (digit - 1);
      else {
        state.values[index] = digit;
        state.notes[index] = 0;
      }
    });
    if (changed && !state.noteMode && state.values[index] !== state.solution[index]) {
      state.notice = "当前输入与答案不符";
      notify();
    }
    return changed;
  }

  function erase() {
    if (!isValidIndex(state.selectedIndex) || state.given[state.selectedIndex]) return false;
    return mutate(() => {
      state.values[state.selectedIndex] = 0;
      state.notes[state.selectedIndex] = 0;
    });
  }

  function toggleNote() {
    if (state.ended || state.paused || state.generating) return false;
    state.noteMode = !state.noteMode;
    state.notice = state.noteMode ? "笔记模式已开启" : "笔记模式已关闭";
    notify();
    return true;
  }

  function hint() {
    if (state.ended || state.paused || state.generating) return null;
    updateDerived();
    if (state.errors > 0) {
      state.hint = null;
      state.notice = "请先修正错误";
      notify();
      return null;
    }
    const result = findHint(state.values);
    if (!result) {
      state.hint = null;
      state.notice = "当前局面暂无基础提示，可以尝试更高级推理";
      notify();
      return null;
    }
    const signature = state.values.join("");
    if (!hintedStates.has(signature)) {
      hintedStates.add(signature);
      beginInput();
      state.elapsedMs += 30000;
    }
    state.hint = clone(result);
    state.notice = "已显示一步提示";
    persistProgress();
    notify();
    return state.hint;
  }

  function undo() {
    if (state.ended || state.paused || state.generating || state.past.length === 0) return false;
    state.future.push(snapshot());
    const previous = state.past.pop();
    state.values = previous.values.slice();
    state.notes = previous.notes.slice();
    state.hint = null;
    state.notice = "已撤销";
    updateDerived();
    persistProgress();
    notify();
    return true;
  }

  function redo() {
    if (state.ended || state.paused || state.generating || state.future.length === 0) return false;
    state.past.push(snapshot());
    const next = state.future.pop();
    state.values = next.values.slice();
    state.notes = next.notes.slice();
    state.hint = null;
    state.notice = "已重做";
    updateDerived();
    persistProgress();
    notify();
    return true;
  }

  function pause() {
    if (!state.started || state.ended || state.generating) return false;
    commitElapsed();
    state.paused = true;
    updateStatus();
    state.notice = "已暂停";
    stopTimer();
    persistProgress();
    notify();
    return true;
  }

  function resume() {
    if (!state.started || state.ended || state.generating) return false;
    state.paused = false;
    state.notice = "继续进行";
    updateStatus();
    startTimer();
    persistProgress();
    notify();
    return true;
  }

  function dispatch(action = {}) {
    let result = null;
    switch (action.type) {
      case "new":
        generatePuzzle();
        break;
      case "reset":
        resetCurrent();
        break;
      case "select":
        result = select(action.index);
        break;
      case "input":
        result = input(action.digit);
        break;
      case "toggle-note":
        result = toggleNote();
        break;
      case "erase":
        result = erase();
        break;
      case "hint":
        result = hint();
        break;
      case "undo":
        result = undo();
        break;
      case "redo":
        result = redo();
        break;
      case "pause":
        result = pause();
        break;
      case "resume":
        result = resume();
        break;
      default:
        return { handled: false, state: getState() };
    }
    return { handled: true, result, state: getState() };
  }

  const saved = storage?.getItem?.(saveKey(selectedDifficulty));
  if (!loadSaved(saved)) generatePuzzle();

  return Object.freeze({
    getState,
    dispatch,
    pause,
    resume,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    save: persistProgress,
  });
}
