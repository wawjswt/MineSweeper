import { generateClassicBoard } from "./minesweeper-generator.js";
import { createRogueEmptyCell } from "./rogue-state.js";

export const ROGUE_LEVELS = Object.freeze([
  { floor: 1, rows: 7, cols: 7, mines: 8, label: "教学层" },
  { floor: 2, rows: 8, cols: 9, mines: 13, label: "扩张层" },
  { floor: 3, rows: 9, cols: 10, mines: 19, label: "压力层" },
  { floor: 4, rows: 10, cols: 12, mines: 28, label: "高压层" },
  { floor: 5, rows: 11, cols: 14, mines: 40, label: "最终层" },
]);

export function getRogueLevelSpec(floor) {
  const index = Math.max(0, Math.min(ROGUE_LEVELS.length - 1, Math.floor(floor) - 1));
  return ROGUE_LEVELS[index];
}

export function getRogueNeighbors(row, col, rows, cols) {
  const result = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
        result.push([nextRow, nextCol]);
      }
    }
  }
  return result;
}

function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createRogueEmptyCell()),
  );
}

function normalizeGeneratedBoard(board) {
  return board.map((row) => row.map((cell) => ({
    neutralized: false,
    special: null,
    specialCollected: false,
    ...cell,
  })));
}

function shuffle(list, rng) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const value = Number(rng?.());
    const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999) : 0;
    const swapIndex = Math.floor(normalized * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
}

export function placeRogueSpecialCells({
  board,
  rows,
  cols,
  safeRow = null,
  safeCol = null,
  rng = Math.random,
}) {
  const safeCells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = board[row][col];
      if (!cell.mine) safeCells.push([row, col]);
    }
  }

  const preferredCells = safeCells.filter(([row, col]) => (
    safeRow === null
      || safeCol === null
      || !(Math.abs(row - safeRow) <= 1 && Math.abs(col - safeCol) <= 1)
  ));
  const candidates = preferredCells.length >= 2 ? preferredCells : safeCells;
  shuffle(candidates, rng);

  const result = { intel: null, supply: null };
  for (const special of ["intel", "supply"]) {
    const coordinates = candidates.shift();
    if (!coordinates) break;
    const [row, col] = coordinates;
    board[row][col].special = special;
    board[row][col].specialCollected = false;
    result[special] = [row, col];
  }
  return result;
}

export function createRogueLevel({
  floor,
  rng = Math.random,
  safeRow = null,
  safeCol = null,
  toolBonus = {},
}) {
  const spec = getRogueLevelSpec(floor);
  const started = safeRow !== null && safeCol !== null;
  const generation = started
    ? generateClassicBoard({
      rows: spec.rows,
      cols: spec.cols,
      mines: spec.mines,
      safeRow,
      safeCol,
      rng,
      generationMode: "standard",
    })
    : { board: createEmptyBoard(spec.rows, spec.cols), generationMode: "standard", fallback: false };
  const board = normalizeGeneratedBoard(generation.board);
  if (started) {
    placeRogueSpecialCells({
      board,
      rows: spec.rows,
      cols: spec.cols,
      safeRow,
      safeCol,
      rng,
    });
  }

  return {
    ...spec,
    board,
    started,
    ended: false,
    generationMode: generation.generationMode,
    generationFallback: generation.fallback,
    safeCellsRemaining: board.flat().filter((cell) => !cell.mine && !cell.revealed).length,
    activeToolUses: {
      scoutPulse: 1 + Math.max(0, toolBonus.scoutPulse || 0),
      defusalKit: 1 + Math.max(0, toolBonus.defusalKit || 0),
      reactionShield: 1 + Math.max(0, toolBonus.reactionShield || 0),
    },
    shieldActive: false,
  };
}

export function revealRogueFlood(board, row, col, rows, cols, onReveal) {
  const queue = [[row, col]];
  let index = 0;
  let revealed = 0;

  while (index < queue.length) {
    const [currentRow, currentCol] = queue[index++];
    const cell = board[currentRow][currentCol];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    revealed += 1;
    onReveal?.(cell, currentRow, currentCol);
    if (cell.count !== 0) continue;
    for (const [neighborRow, neighborCol] of getRogueNeighbors(currentRow, currentCol, rows, cols)) {
      const neighbor = board[neighborRow][neighborCol];
      if (!neighbor.revealed && !neighbor.flagged && !neighbor.mine) {
        queue.push([neighborRow, neighborCol]);
      }
    }
  }

  return revealed;
}
