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
  return board.map((row) => row.map((cell) => ({ neutralized: false, ...cell })));
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
  const board = started
    ? normalizeGeneratedBoard(generateClassicBoard({
      rows: spec.rows,
      cols: spec.cols,
      mines: spec.mines,
      safeRow,
      safeCol,
      rng,
      generationMode: "standard",
    }).board)
    : createEmptyBoard(spec.rows, spec.cols);

  return {
    ...spec,
    board,
    started,
    ended: false,
    safeCellsRemaining: board.flat().filter((cell) => !cell.mine && !cell.revealed).length,
    activeToolUses: {
      scoutPulse: 1 + Math.max(0, toolBonus.scoutPulse || 0),
      defusalKit: 1 + Math.max(0, toolBonus.defusalKit || 0),
      reactionShield: 1 + Math.max(0, toolBonus.reactionShield || 0),
    },
    shieldActive: false,
  };
}

export function revealRogueFlood(board, row, col, rows, cols) {
  const queue = [[row, col]];
  let index = 0;
  let revealed = 0;

  while (index < queue.length) {
    const [currentRow, currentCol] = queue[index++];
    const cell = board[currentRow][currentCol];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    revealed += 1;
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
