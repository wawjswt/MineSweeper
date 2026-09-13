import { EMOJI_POOL } from "../../../core/games/lianliankan/engine.js";

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function toLianliankanViewModel(state) {
  const rows = Number(state?.rows) || 0;
  const cols = Number(state?.cols) || 0;
  const grid = Array.isArray(state?.grid) ? state.grid : [];
  const selectedIndex = Number.isInteger(state?.selectedIndex) ? state.selectedIndex : null;
  const pathIndexes = new Set(Array.isArray(state?.path) ? state.path.map((point) => point.r * cols + point.c) : []);
  const hintIndexes = new Set(Array.isArray(state?.hint?.indexes) ? state.hint.indexes : []);

  return {
    mode: state?.mode || "classic",
    difficulty: state?.difficulty || "medium",
    levelId: state?.levelId ?? null,
    rows,
    cols,
    cells: grid.map((value, index) => ({
      index,
      row: Math.floor(index / cols),
      column: cols ? index % cols : 0,
      value,
      emoji: value > 0 ? EMOJI_POOL[value - 1] || "❔" : "",
      blocked: value === -1,
      empty: value === 0,
      selected: index === selectedIndex,
      path: pathIndexes.has(index),
      hinted: hintIndexes.has(index),
      ariaLabel: value === -1 ? "障碍格" : value > 0 ? `图案 ${value}` : "空格",
    })),
    selectedIndex,
    remaining: Number(state?.remaining) || 0,
    score: Number(state?.score) || 0,
    combo: Number(state?.combo) || 0,
    timer: formatTime(state?.challengeSeconds ?? Math.floor((Number(state?.elapsedMs) || 0) / 1000)),
    status: state?.status || "待开始",
    notice: state?.notice || "",
    challenge: state?.challenge
      ? {
          hintsRemaining: Number(state.challenge.hintsRemaining) || 0,
          shufflesRemaining: Number(state.challenge.shufflesRemaining) || 0,
          secondsRemaining: Number(state?.challengeSeconds) || 0,
        }
      : null,
    started: state?.started === true,
    ended: state?.ended === true,
    paused: state?.paused === true,
  };
}
