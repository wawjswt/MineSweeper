import { DIFFICULTIES, SUDOKU_DIFFICULTIES } from "./config.js";

export function makeState(difficultyKey, modeKey = "classic") {
  const catalog = modeKey === "sudoku" ? SUDOKU_DIFFICULTIES : DIFFICULTIES;
  const { rows, cols, mines } = catalog[difficultyKey];
  return {
    rows,
    cols,
    mines,
    modeKey,
    started: false,
    ended: false,
    win: false,
    timer: 0,
    regions: null,
    board: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        mine: false,
        revealed: false,
        flagged: false,
        questioned: false,
        count: 0,
        region: 0,
      })),
    ),
  };
}
