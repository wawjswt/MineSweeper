import {
  DIFFICULTIES,
  HEX_DIFFICULTIES,
  RING_DIFFICULTIES,
  SUDOKU_DIFFICULTIES,
} from "./config.js";

function getCatalog(modeKey) {
  if (modeKey === "sudoku") return SUDOKU_DIFFICULTIES;
  if (modeKey === "hex") return HEX_DIFFICULTIES;
  if (modeKey === "ring") return RING_DIFFICULTIES;
  return DIFFICULTIES;
}

function resolveSpec(difficultyOrSpec, modeKey) {
  if (typeof difficultyOrSpec === "object") return difficultyOrSpec;
  const catalog = getCatalog(modeKey);
  return catalog[difficultyOrSpec] || catalog.normal || catalog.easy;
}

export function makeState(difficultyOrSpec = "normal", modeKey = "classic") {
  const { rows, cols, mines } = resolveSpec(difficultyOrSpec, modeKey);
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
    generationMode: "standard",
    generationFallback: false,
    hint: null,
    notice: "",
    board: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        mine: false,
        revealed: false,
        flagged: false,
        questioned: false,
        exploded: false,
        crossed: false,
        givenMine: false,
        count: 0,
        region: 0,
      })),
    ),
  };
}
