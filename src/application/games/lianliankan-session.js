import {
  CHALLENGE_CONFIG,
  CHALLENGE_MISTAKE_PENALTY_MS,
  DIFFICULTIES,
  applyLevelClearBonus,
  challengeRating,
  consumeChallengeResource,
  countRemaining,
  createChallengeState,
  explainPairFailure,
  findAnyPair,
  findHintPair,
  findPath,
  makeBoard,
  nextPairScore,
  readLevelProgress,
  recordLevelCompletion,
  remainingChallengeSeconds,
  reshuffle,
  resetLevelCombo,
  scorePairForMode,
  writeLevelProgress,
} from "../../core/games/lianliankan/engine.js";
import { LLK_LEVELS, cloneLayout, collapseColumns, reshuffle as reshuffleLevel } from "../../core/games/lianliankan/levels.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isValidIndex(state, index) {
  return Number.isInteger(index) && index >= 0 && index < state.rows * state.cols;
}

function levelById(levelId) {
  return LLK_LEVELS.find((level) => level.id === Number(levelId)) || null;
}

export function createLianliankanSession({
  mode = "classic",
  difficulty = "medium",
  levelId = 1,
  rng = Math.random,
  clock,
  storage = null,
  initialGrid = null,
} = {}) {
  if (!clock || typeof clock.now !== "function") throw new TypeError("clock is required");
  const listeners = new Set();
  let timerId = null;
  let startAt = null;
  const state = {
    mode: mode === "levels" || mode === "challenge" ? mode : "classic",
    difficulty,
    levelId: null,
    rows: 0,
    cols: 0,
    kinds: 0,
    grid: [],
    selectedIndex: null,
    path: null,
    hint: null,
    started: false,
    ended: false,
    paused: false,
    elapsedMs: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastSuccessMs: null,
    challenge: null,
    progress: null,
    remaining: 0,
    status: "待开始",
    notice: "",
  };

  function currentElapsedMs() {
    return Math.max(0, state.elapsedMs + (startAt === null ? 0 : clock.now() - startAt));
  }

  function isLevelMode() {
    return (state.mode === "levels" || state.mode === "challenge") && state.levelId !== null;
  }

  function isChallengeMode() {
    return state.mode === "challenge" && state.challenge !== null;
  }

  function updateDerived() {
    state.remaining = countRemaining(state.grid);
  }

  function getState() {
    updateDerived();
    const snapshot = clone({ ...state, elapsedMs: currentElapsedMs() });
    snapshot.challengeSeconds = isChallengeMode()
      ? remainingChallengeSeconds(state.challenge.timeLimitSeconds, snapshot.elapsedMs)
      : null;
    return snapshot;
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

  function failChallenge() {
    if (!isChallengeMode() || state.ended) return;
    commitElapsed();
    state.ended = true;
    state.paused = false;
    state.status = "挑战失败";
    state.notice = "时间到，挑战失败";
    stopTimer();
    state.selectedIndex = null;
  }

  function startTimer() {
    if (timerId !== null || !state.started || state.ended || state.paused) return;
    startAt = clock.now();
    timerId = clock.setInterval(() => {
      if (isChallengeMode() && remainingChallengeSeconds(state.challenge.timeLimitSeconds, currentElapsedMs()) <= 0) {
        failChallenge();
      }
      notify();
    }, 250);
  }

  function updateStatus() {
    if (state.ended) return;
    if (state.paused) state.status = "已暂停";
    else if (state.started) state.status = "进行中";
    else state.status = "待开始";
  }

  function beginInput() {
    if (!state.started) state.started = true;
    startTimer();
    updateStatus();
  }

  function resetStats() {
    state.selectedIndex = null;
    state.path = null;
    state.hint = null;
    state.started = false;
    state.ended = false;
    state.paused = false;
    state.elapsedMs = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.lastSuccessMs = null;
    state.notice = "";
    stopTimer();
  }

  function initialize(nextMode = state.mode, nextDifficulty = state.difficulty, nextLevelId = state.levelId || levelId) {
    state.mode = nextMode === "levels" || nextMode === "challenge" ? nextMode : "classic";
    resetStats();
    if (state.mode === "classic") {
      const config = DIFFICULTIES[nextDifficulty] || DIFFICULTIES.medium;
      const board = Array.isArray(initialGrid) ? initialGrid.slice() : makeBoard(config.rows, config.cols, config.kinds, rng).grid;
      state.difficulty = DIFFICULTIES[nextDifficulty] ? nextDifficulty : "medium";
      state.levelId = null;
      state.rows = config.rows;
      state.cols = config.cols;
      state.kinds = config.kinds;
      state.grid = board;
      state.challenge = null;
      state.progress = null;
    } else {
      const level = levelById(nextLevelId) || LLK_LEVELS[0];
      state.difficulty = `${state.mode}-${level.id}`;
      state.levelId = level.id;
      state.rows = level.rows;
      state.cols = level.cols;
      state.kinds = level.kinds;
      state.grid = cloneLayout(level);
      state.challenge = state.mode === "challenge"
        ? createChallengeState(level.challenge || CHALLENGE_CONFIG)
        : null;
      state.progress = readLevelProgress(storage);
    }
    updateDerived();
    updateStatus();
    state.notice = state.mode === "challenge"
      ? `第${state.levelId}关挑战，待开始`
      : state.mode === "levels"
        ? `第${state.levelId}关，待开始`
        : "待开始";
  }

  function win() {
    if (state.ended) return;
    commitElapsed();
    state.ended = true;
    state.paused = false;
    stopTimer();
    if (isLevelMode()) {
      state.score = applyLevelClearBonus(state.score, true);
      const result = {
        score: state.score,
        time: Math.floor(state.elapsedMs / 1000),
        combo: state.maxCombo,
      };
      if (isChallengeMode()) {
        result.stars = challengeRating({
          timeLimitSeconds: state.challenge.timeLimitSeconds,
          elapsedSeconds: result.time,
          maxCombo: result.combo,
        }).stars;
      }
      state.progress = recordLevelCompletion(state.progress, state.levelId, result);
      writeLevelProgress(state.progress, storage);
    }
    state.status = isChallengeMode() ? "挑战成功 🎉" : "通关 🎉";
    state.notice = state.status;
    state.selectedIndex = null;
  }

  function ensurePlayable() {
    if (state.remaining === 0) return;
    if (findAnyPair(state.grid, state.rows, state.cols)) return;
    if (isLevelMode()) {
      const result = reshuffleLevel(state.grid, state.rows, state.cols, findAnyPair, rng);
      if (result.ok) {
        state.grid = result.grid;
        state.notice = "无可用配对，已自动洗牌";
      } else state.notice = "无可用配对，自动洗牌失败";
    } else state.notice = "无可用配对，请重排";
  }

  function scorePair() {
    const next = scorePairForMode({
      score: state.score,
      combo: state.combo,
      maxCombo: state.maxCombo,
      lastSuccessMs: state.lastSuccessMs,
    }, currentElapsedMs(), isLevelMode());
    state.score = next.score;
    state.combo = next.combo;
    state.maxCombo = next.maxCombo;
    state.lastSuccessMs = next.lastSuccessMs;
  }

  function resolvePair(first, second, path) {
    state.grid[first] = 0;
    state.grid[second] = 0;
    state.path = path;
    scorePair();
    if (isLevelMode()) {
      const dropped = collapseColumns(state.grid, state.rows, state.cols);
      state.grid = dropped.grid;
    }
    updateDerived();
    if (state.remaining === 0) win();
    else ensurePlayable();
  }

  function applyChallengePenalty() {
    if (!isChallengeMode()) return;
    state.elapsedMs += CHALLENGE_MISTAKE_PENALTY_MS;
    const reset = resetLevelCombo({
      score: state.score,
      combo: state.combo,
      maxCombo: state.maxCombo,
      lastSuccessMs: state.lastSuccessMs,
    });
    state.score = reset.score;
    state.combo = reset.combo;
    state.lastSuccessMs = reset.lastSuccessMs;
  }

  function select(index) {
    if (state.ended || state.paused || !isValidIndex(state, index) || state.grid[index] <= 0) return false;
    beginInput();
    state.hint = null;
    if (state.selectedIndex === null) {
      state.selectedIndex = index;
      state.notice = "已选中一个图案";
      notify();
      return true;
    }
    if (state.selectedIndex === index) {
      state.selectedIndex = null;
      state.notice = "已取消选择";
      notify();
      return true;
    }
    const first = state.selectedIndex;
    const second = index;
    const a = { r: Math.floor(first / state.cols), c: first % state.cols };
    const b = { r: Math.floor(second / state.cols), c: second % state.cols };
    const reason = explainPairFailure(state.grid, state.rows, state.cols, a, b);
    const path = reason === null ? findPath(state.grid, state.rows, state.cols, a, b) : null;
    if (path) {
      state.selectedIndex = null;
      state.notice = "配对成功";
      resolvePair(first, second, path);
    } else {
      applyChallengePenalty();
      state.selectedIndex = second;
      state.notice = isChallengeMode()
        ? `${reason} · 扣${CHALLENGE_MISTAKE_PENALTY_MS / 1000}秒，Combo已重置`
        : reason;
    }
    notify();
    return true;
  }

  function handleHint() {
    if (state.ended || state.paused) return null;
    const pair = findHintPair(state.grid, state.rows, state.cols, findAnyPair);
    if (!pair) {
      state.notice = "暂无可用配对";
      notify();
      return null;
    }
    if (isChallengeMode()) {
      const consumed = consumeChallengeResource(state.challenge, "hint");
      if (!consumed.ok) {
        state.notice = "提示次数已用完";
        notify();
        return null;
      }
      state.challenge = consumed.state;
    }
    state.hint = {
      indexes: [pair.a.r * state.cols + pair.a.c, pair.b.r * state.cols + pair.b.c],
      path: findPath(state.grid, state.rows, state.cols, pair.a, pair.b),
    };
    state.notice = "已标出一组可连接图案";
    notify();
    return state.hint;
  }

  function handleReshuffle() {
    if (state.ended || state.paused || state.remaining === 0) return false;
    if (isChallengeMode()) {
      state.notice = "挑战模式不支持手动重排，无解时会自动重排";
      notify();
      return false;
    }
    let ok = false;
    if (isLevelMode()) {
      const result = reshuffleLevel(state.grid, state.rows, state.cols, findAnyPair, rng);
      state.grid = result.grid;
      ok = result.ok;
    } else {
      state.grid = state.grid.slice();
      ok = reshuffle(state.grid, state.rows, state.cols, rng);
    }
    beginInput();
    state.selectedIndex = null;
    state.path = null;
    state.notice = ok ? "已重排，继续配对" : "重排后仍无解，可再试一次";
    notify();
    return ok;
  }

  function pause() {
    if (!state.started || state.ended || state.paused) return false;
    commitElapsed();
    state.paused = true;
    state.status = "已暂停";
    stopTimer();
    notify();
    return true;
  }

  function resume() {
    if (!state.started || state.ended || !state.paused) return false;
    state.paused = false;
    updateStatus();
    startTimer();
    notify();
    return true;
  }

  function dispatch(action = {}) {
    let result = null;
    switch (action.type) {
      case "new":
        initialize(state.mode, state.difficulty, state.levelId || levelId);
        break;
      case "select":
        result = select(action.index);
        break;
      case "reshuffle":
        result = handleReshuffle();
        break;
      case "tick":
        if (!state.paused && !state.ended) notify();
        break;
      case "set-mode":
        initialize(action.mode, state.difficulty, action.levelId || state.levelId || levelId);
        break;
      case "set-difficulty":
        initialize(state.mode, action.difficulty, state.levelId || levelId);
        break;
      case "hint":
        result = handleHint();
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

  initialize(state.mode, difficulty, levelId);

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
  });
}
