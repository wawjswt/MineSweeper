import { DIFFICULTIES } from "./config.js";

export function makeState(difficultyKey) {
  const { rows, cols, mines } = DIFFICULTIES[difficultyKey];
  return {
    rows,
    cols,
    mines,
    started: false,
    ended: false,
    win: false,
    timer: 0,
    board: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        mine: false,
        revealed: false,
        flagged: false,
        questioned: false,
        count: 0,
      })),
    ),
  };
}
