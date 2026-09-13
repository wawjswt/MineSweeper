import { PEER_SETS, SIZE, TOTAL, countRemaining, rowOf, colOf } from "../../../core/games/sudoku/engine.js";

function formatTime(elapsedMs) {
  const totalSeconds = Math.floor(Math.max(0, Number(elapsedMs) || 0) / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function notesFromMask(mask) {
  const notes = [];
  for (let digit = 1; digit <= SIZE; digit++) {
    if (mask & (1 << (digit - 1))) notes.push(digit);
  }
  return notes;
}

export function toSudokuViewModel(state) {
  const values = Array.isArray(state?.values) ? state.values : new Array(TOTAL).fill(0);
  const given = Array.isArray(state?.given) ? state.given : new Array(TOTAL).fill(false);
  const notes = Array.isArray(state?.notes) ? state.notes : new Array(TOTAL).fill(0);
  const solution = Array.isArray(state?.solution) ? state.solution : new Array(TOTAL).fill(0);
  const selectedIndex = Number.isInteger(state?.selectedIndex) ? state.selectedIndex : -1;
  const hint = state?.hint || null;
  const hintTargets = new Set(Array.isArray(hint?.targetCells) ? hint.targetCells : []);
  const hintAffected = new Set(Array.isArray(hint?.affectedCells) ? hint.affectedCells : []);
  const selectedPeers = selectedIndex >= 0 && selectedIndex < TOTAL ? PEER_SETS[selectedIndex] : new Set();
  const selectedValue = selectedIndex >= 0 ? values[selectedIndex] : 0;

  return {
    difficulty: state?.difficulty || "medium",
    cells: Array.from({ length: TOTAL }, (_, index) => ({
      index,
      row: rowOf(index),
      column: colOf(index),
      value: values[index] || 0,
      given: given[index] === true,
      notes: values[index] === 0 ? notesFromMask(notes[index] || 0) : [],
      selected: index === selectedIndex,
      peer: selectedPeers.has(index),
      same: selectedValue !== 0 && values[index] === selectedValue && index !== selectedIndex,
      error: values[index] !== 0 && values[index] !== solution[index],
      hintTarget: hintTargets.has(index),
      hintAffected: hintAffected.has(index),
      ariaLabel: `第${rowOf(index) + 1}行第${colOf(index) + 1}列${given[index] ? "题目格" : ""}`,
    })),
    selectedIndex,
    activeDigit: Number(state?.activeDigit) || 0,
    noteMode: state?.noteMode === true,
    errors: Number(state?.errors) || 0,
    remaining: Number(state?.remaining) || 0,
    timer: formatTime(state?.elapsedMs),
    status: state?.status || "待开始",
    notice: state?.notice || "",
    started: state?.started === true,
    ended: state?.ended === true,
    paused: state?.paused === true,
    generating: state?.generating === true,
    rating: state?.rating?.level || null,
    digitRemaining: Array.from({ length: SIZE }, (_, offset) =>
      countRemaining(solution, values, offset + 1),
    ),
  };
}
