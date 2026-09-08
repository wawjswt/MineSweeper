import { analyzePosition } from "./minesweeper-solver.js";

function inBounds(row, col, rows, cols) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function neighbors(row, col, rows, cols) {
  const result = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (inBounds(nextRow, nextCol, rows, cols)) result.push([nextRow, nextCol]);
    }
  }
  return result;
}

function createBoard(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    questioned: false,
    exploded: false,
    count: 0,
  })));
}

function shuffle(list, rng) {
  for (let index = list.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(rng() * (index + 1));
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
  return list;
}

function populateCounts(board, rows, cols) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      board[row][col].count = neighbors(row, col, rows, cols)
        .reduce((total, [neighborRow, neighborCol]) => total + (board[neighborRow][neighborCol].mine ? 1 : 0), 0);
    }
  }
}

function createStandardBoard({ rows, cols, mines, safeRow, safeCol, rng }) {
  const board = createBoard(rows, cols);
  const forbidden = new Set([`${safeRow},${safeCol}`]);
  for (const [neighborRow, neighborCol] of neighbors(safeRow, safeCol, rows, cols)) {
    forbidden.add(`${neighborRow},${neighborCol}`);
  }

  const spots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!forbidden.has(`${row},${col}`)) spots.push([row, col]);
    }
  }
  shuffle(spots, rng);
  for (let index = 0; index < mines && index < spots.length; index++) {
    const [row, col] = spots[index];
    board[row][col].mine = true;
  }
  populateCounts(board, rows, cols);
  return board;
}

function revealFlood(board, row, col, rows, cols) {
  const queue = [[row, col]];
  let index = 0;
  while (index < queue.length) {
    const [currentRow, currentCol] = queue[index++];
    const current = board[currentRow][currentCol];
    if (current.revealed || current.flagged || current.mine) continue;
    current.revealed = true;
    if (current.count !== 0) continue;
    for (const [neighborRow, neighborCol] of neighbors(currentRow, currentCol, rows, cols)) {
      const neighbor = board[neighborRow][neighborCol];
      if (!neighbor.revealed && !neighbor.flagged && !neighbor.mine) queue.push([neighborRow, neighborCol]);
    }
  }
}

function isSolved(board) {
  return board.flat().every((current) => current.mine || current.revealed);
}

function canBeSolvedWithoutGuessing(board, rows, cols, mines, safeRow, safeCol) {
  revealFlood(board, safeRow, safeCol, rows, cols);
  let steps = 0;
  const maxSteps = rows * cols * 4;
  while (!isSolved(board) && steps++ < maxSteps) {
    const hint = analyzePosition({ board, rows, cols, totalMines: mines });
    if (hint.kind === "mine") {
      const [mineRow, mineCol] = hint.target;
      board[mineRow][mineCol].flagged = true;
      continue;
    }
    if (hint.kind === "safe") {
      const [safeTargetRow, safeTargetCol] = hint.target;
      revealFlood(board, safeTargetRow, safeTargetCol, rows, cols);
      continue;
    }
    return false;
  }
  return isSolved(board);
}

export function generateClassicBoard({
  rows,
  cols,
  mines,
  safeRow,
  safeCol,
  rng = Math.random,
  generationMode = "standard",
  maxAttempts = 40,
}) {
  const normalizedRows = Math.max(1, Math.floor(rows));
  const normalizedCols = Math.max(1, Math.floor(cols));
  const normalizedMines = Math.max(0, Math.min(Math.floor(mines), normalizedRows * normalizedCols));
  const options = {
    rows: normalizedRows,
    cols: normalizedCols,
    mines: normalizedMines,
    safeRow: Math.max(0, Math.min(normalizedRows - 1, Math.floor(safeRow))),
    safeCol: Math.max(0, Math.min(normalizedCols - 1, Math.floor(safeCol))),
    rng,
  };

  if (generationMode === "no-guess") {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = createStandardBoard(options);
      const simulation = candidate.map((row) => row.map((current) => ({ ...current })));
      if (canBeSolvedWithoutGuessing(simulation, normalizedRows, normalizedCols, normalizedMines, options.safeRow, options.safeCol)) {
        return { board: candidate, generationMode: "no-guess", fallback: false };
      }
    }
    return {
      board: createStandardBoard(options),
      generationMode: "standard",
      fallback: true,
    };
  }

  return {
    board: createStandardBoard(options),
    generationMode: "standard",
    fallback: false,
  };
}
