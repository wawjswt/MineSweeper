import { generateClassicBoard } from "../minesweeper/generator.js";
import { createRogueEmptyCell } from "./state.js";
import {
  assignRogueSectorIds,
  calculateRogueSectorStats,
  createRogueSectors,
} from "./sectors.js";

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

function normalizeRogueSectors(sectors, cols) {
  if (!Array.isArray(sectors) || sectors.length !== 3) {
    throw new TypeError("sectors 必须包含三个连续战区。");
  }

  let expectedStartCol = 0;
  const normalized = sectors.map((sector, index) => {
    const startCol = sector?.startCol;
    const endColExclusive = sector?.endColExclusive;
    if (
      !Number.isInteger(startCol)
      || !Number.isInteger(endColExclusive)
      || startCol !== expectedStartCol
      || endColExclusive - startCol < 2
    ) {
      throw new RangeError("sectors 必须是每区至少两列、连续覆盖棋盘的战区。");
    }
    expectedStartCol = endColExclusive;
    return {
      ...sector,
      id: sector.id ?? index,
      safeCells: 0,
      revealedSafeCells: 0,
      secured: false,
    };
  });
  return normalized;
}

function validateRogueSectorCoverage(sectors, cols) {
  if (sectors.at(-1)?.endColExclusive !== cols) {
    throw new RangeError("sectors 必须完整覆盖棋盘列。");
  }
  return sectors;
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
  const intelCoordinates = candidates.shift();
  if (intelCoordinates) {
    const [row, col] = intelCoordinates;
    board[row][col].special = "intel";
    board[row][col].specialCollected = false;
    result.intel = [row, col];
  }

  let supplyIndex = -1;
  if (intelCoordinates) {
    const intelSectorId = board[intelCoordinates[0]][intelCoordinates[1]].sectorId;
    if (intelSectorId !== null && intelSectorId !== undefined) {
      supplyIndex = candidates.findIndex(([row, col]) => {
        const sectorId = board[row][col].sectorId;
        return sectorId !== null && sectorId !== undefined && sectorId !== intelSectorId;
      });
    }
  }
  const supplyCoordinates = supplyIndex >= 0
    ? candidates.splice(supplyIndex, 1)[0]
    : candidates.shift();
  if (supplyCoordinates) {
    const [row, col] = supplyCoordinates;
    board[row][col].special = "supply";
    board[row][col].specialCollected = false;
    result.supply = [row, col];
  }
  return result;
}

export function createRogueLevel({
  floor,
  rng = Math.random,
  safeRow = null,
  safeCol = null,
  toolBonus = {},
  sectors = null,
}) {
  const spec = getRogueLevelSpec(floor);
  const started = safeRow !== null && safeCol !== null;
  const levelSectors = validateRogueSectorCoverage(
    normalizeRogueSectors(
      sectors || createRogueSectors({ cols: spec.cols, rng }),
      spec.cols,
    ),
    spec.cols,
  );
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
  const board = assignRogueSectorIds(normalizeGeneratedBoard(generation.board), levelSectors);
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

  const currentSectors = started
    ? calculateRogueSectorStats({ board, sectors: levelSectors })
    : levelSectors;

  return {
    ...spec,
    board,
    started,
    ended: false,
    generationMode: generation.generationMode,
    generationFallback: generation.fallback,
    sectors: currentSectors,
    safeCellsRemaining: board.flat().filter((cell) => !cell.mine && !cell.revealed).length,
    activeToolUses: {
      scoutPulse: 1 + Math.max(0, toolBonus.scoutPulse || 0),
      defusalKit: 1 + Math.max(0, toolBonus.defusalKit || 0),
      reactionShield: 1 + Math.max(0, toolBonus.reactionShield || 0),
    },
    shieldActive: false,
  };
}

export function refreshRogueSectorStats(level) {
  if (!level || !Array.isArray(level.board) || !Array.isArray(level.sectors)) {
    throw new TypeError("level 必须包含 board 和 sectors。");
  }
  level.sectors = calculateRogueSectorStats({
    board: level.board,
    sectors: level.sectors,
  });
  return level.sectors;
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

