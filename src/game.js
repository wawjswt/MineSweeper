import { generateClassicBoard } from "./core/games/minesweeper/generator.js";
import { analyzePosition } from "./core/games/minesweeper/solver.js";
import { generateSudokuMines } from "./core/games/sudoku/minesweeper.js";
import { createWebClock } from "./platform/web/clock.js";

function shuffle(list, rng) {
  for (let index = list.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(rng() * (index + 1));
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
  return list;
}

function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    questioned: false,
    exploded: false,
    crossed: false,
    givenMine: false,
    count: 0,
    region: 0,
  })));
}

export function createGameLogic({
  getState,
  getDifficultySpec,
  getGenerationMode = () => "standard",
  rng = Math.random,
  clock = createWebClock(),
}) {
  let timerId = null;
  let timerStartAt = null;

  function state() {
    return getState();
  }

  function inBounds(row, col) {
    const current = state();
    return row >= 0 && row < current.rows && col >= 0 && col < current.cols;
  }

  function isSudokuMode() {
    return state().modeKey === "sudoku";
  }

  function isHexMode() {
    return state().modeKey === "hex";
  }

  function isRingMode() {
    return state().modeKey === "ring";
  }

  function isOffsetMode() {
    return state().modeKey === "offset";
  }

  function neighbors(row, col) {
    const current = state();
    if (isHexMode()) {
      const q = col;
      const cubeRow = row - Math.floor((col - (col & 1)) / 2);
      const cubeCol = -q - cubeRow;
      const directions = [
        [1, -1, 0], [1, 0, -1], [0, 1, -1],
        [-1, 1, 0], [-1, 0, 1], [0, -1, 1],
      ];
      return directions.map(([dq, dr, ds]) => {
        const nextQ = q + dq;
        const nextR = cubeRow + dr;
        const nextS = cubeCol + ds;
        void nextS;
        return [nextR + Math.floor((nextQ - (nextQ & 1)) / 2), nextQ];
      }).filter(([nextRow, nextCol]) => inBounds(nextRow, nextCol));
    }

    const result = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        if (rowOffset === 0 && colOffset === 0) continue;
        const nextRow = row + rowOffset;
        let nextCol = col + colOffset;
        if (isRingMode()) {
          if (nextRow < 0 || nextRow >= current.rows) continue;
          nextCol = (nextCol + current.cols) % current.cols;
          if (nextRow === row && nextCol === col) continue;
          result.push([nextRow, nextCol]);
        } else if (inBounds(nextRow, nextCol)) {
          result.push([nextRow, nextCol]);
        }
      }
    }
    return result;
  }

  function offsetNeighbors(row, col) {
    const result = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        const nextRow = row - 1 + rowOffset;
        const nextCol = col + colOffset;
        if (inBounds(nextRow, nextCol)) result.push([nextRow, nextCol]);
      }
    }
    return result;
  }

  function countAround(board, row, col) {
    const adjacent = isOffsetMode() ? offsetNeighbors(row, col) : neighbors(row, col);
    return adjacent.reduce((total, [neighborRow, neighborCol]) => total + (board[neighborRow][neighborCol].mine ? 1 : 0), 0);
  }

  function resetCells(current) {
    for (const row of current.board) {
      for (const cell of row) {
        cell.mine = false;
        cell.revealed = false;
        cell.flagged = false;
        cell.questioned = false;
        cell.exploded = false;
        cell.crossed = false;
        cell.givenMine = false;
        cell.count = 0;
        cell.region = 0;
      }
    }
  }

  function prepareSudoku() {
    const current = state();
    if (!isSudokuMode()) return;
    const generated = generateSudokuMines(current.rows, { rng });
    current.regions = generated.regions;
    current.sudokuGeneration = generated;
    current.mines = generated.mines.length;
    resetCells(current);
    for (const [row, col] of generated.mines) {
      current.board[row][col].mine = true;
    }
    for (let row = 0; row < current.rows; row++) {
      for (let col = 0; col < current.cols; col++) current.board[row][col].region = current.regions[row][col];
    }
    const [givenRow, givenCol] = generated.mines[0];
    current.board[givenRow][givenCol].flagged = true;
    current.board[givenRow][givenCol].givenMine = true;
  }

  function layMines(safeRow, safeCol) {
    const current = state();
    if (isSudokuMode()) {
      prepareSudoku();
      return;
    }
    if (current.modeKey === "classic") {
      const generated = generateClassicBoard({
        rows: current.rows,
        cols: current.cols,
        mines: current.mines,
        safeRow,
        safeCol,
        rng,
        generationMode: getGenerationMode(),
      });
      current.board = generated.board;
      current.generationMode = generated.generationMode;
      current.generationFallback = generated.fallback;
      current.notice = generated.fallback ? "可推理棋盘生成失败，已使用标准随机棋盘。" : "";
      return;
    }

    resetCells(current);
    const forbidden = new Set([`${safeRow},${safeCol}`]);
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        const row = safeRow + rowOffset;
        const col = safeCol + colOffset;
        if (inBounds(row, col)) forbidden.add(`${row},${col}`);
      }
    }
    const spots = [];
    for (let row = 0; row < current.rows; row++) {
      for (let col = 0; col < current.cols; col++) {
        if (!forbidden.has(`${row},${col}`)) spots.push([row, col]);
      }
    }
    shuffle(spots, rng);
    for (let index = 0; index < current.mines && index < spots.length; index++) {
      const [row, col] = spots[index];
      current.board[row][col].mine = true;
    }
    for (let row = 0; row < current.rows; row++) {
      for (let col = 0; col < current.cols; col++) current.board[row][col].count = countAround(current.board, row, col);
    }
  }

  function floodReveal(row, col) {
    const current = state();
    const queue = [[row, col]];
    let index = 0;
    while (index < queue.length) {
      const [currentRow, currentCol] = queue[index++];
      const cell = current.board[currentRow][currentCol];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      if (cell.count !== 0) continue;
      for (const [neighborRow, neighborCol] of neighbors(currentRow, currentCol)) {
        const neighbor = current.board[neighborRow][neighborCol];
        if (!neighbor.revealed && !neighbor.flagged && !neighbor.mine) queue.push([neighborRow, neighborCol]);
      }
    }
  }

  function revealAllMines(exploded) {
    const current = state();
    for (let row = 0; row < current.rows; row++) {
      for (let col = 0; col < current.cols; col++) {
        const cell = current.board[row][col];
        if (cell.mine) cell.revealed = true;
        if (exploded && exploded[0] === row && exploded[1] === col) cell.exploded = true;
      }
    }
  }

  function markSudokuFailure() {
    const current = state();
    current.ended = true;
    current.win = false;
    stopTimer();
    for (const row of current.board) {
      for (const cell of row) {
        if (cell.mine) cell.revealed = true;
        if (cell.flagged && !cell.mine) cell.exploded = true;
      }
    }
  }

  function checkWin() {
    const current = state();
    if (isSudokuMode()) {
      if (current.board.flat().every((cell) => !cell.mine || cell.flagged)) {
        current.ended = true;
        current.win = true;
        stopTimer();
        return true;
      }
      return false;
    }
    if (current.board.flat().every((cell) => cell.mine || cell.revealed)) {
      current.ended = true;
      current.win = true;
      stopTimer();
      for (const row of current.board) for (const cell of row) if (cell.mine) cell.flagged = true;
      return true;
    }
    return false;
  }

  function startTimer(onTick = () => {}) {
    if (timerId !== null) return;
    const now = clock.now();
    timerStartAt = now - state().timer * 1000;
    timerId = clock.setInterval(() => {
      const current = state();
      if (current.started && !current.ended && timerStartAt !== null) {
        const timestamp = clock.now();
        current.timer = Math.min(999, (timestamp - timerStartAt) / 1000);
        onTick();
      }
    }, 100);
  }

  function stopTimer() {
    if (timerId !== null) clock.clearInterval(timerId);
    timerId = null;
    timerStartAt = null;
  }

  function reveal(row, col, onTick) {
    const current = state();
    if (current.ended) return;
    if (isSudokuMode()) {
      if (!current.started) {
        current.started = true;
        startTimer(onTick);
      }
      const cell = current.board[row][col];
      if (!cell.givenMine && !cell.revealed) cell.crossed = !cell.crossed;
      if (checkWin()) return "win";
      return "continue";
    }
    if (!current.started) {
      current.started = true;
      layMines(row, col);
      startTimer(onTick);
    }
    const cell = current.board[row][col];
    if (cell.revealed || cell.flagged) return;
    current.hint = null;
    current.notice = "";
    if (cell.mine) {
      cell.revealed = true;
      current.ended = true;
      stopTimer();
      revealAllMines([row, col]);
      return "lose";
    }
    floodReveal(row, col);
    if (checkWin()) return "win";
    return "continue";
  }

  function chord(row, col, onTick) {
    const current = state();
    if (current.ended || isSudokuMode()) return;
    const cell = current.board[row][col];
    if (!cell.revealed || !cell.count) return;
    const adjacent = isOffsetMode() ? offsetNeighbors(row, col) : neighbors(row, col);
    const flagged = adjacent.reduce((total, [neighborRow, neighborCol]) => total + (current.board[neighborRow][neighborCol].flagged ? 1 : 0), 0);
    if (flagged !== cell.count) return;
    current.hint = null;
    for (const [neighborRow, neighborCol] of adjacent) {
      const neighbor = current.board[neighborRow][neighborCol];
      if (!neighbor.revealed && !neighbor.flagged) {
        const result = reveal(neighborRow, neighborCol, onTick);
        if (result === "lose") return "lose";
      }
    }
    if (checkWin()) return "win";
    return "continue";
  }

  function cycleMark(row, col) {
    const current = state();
    if (current.ended) return "continue";
    const cell = current.board[row][col];
    current.hint = null;
    current.notice = "";
    if (isSudokuMode()) {
      if (cell.givenMine || cell.revealed) return "continue";
      if (cell.flagged) {
        cell.flagged = false;
        cell.crossed = false;
        return "continue";
      }
      if (!cell.mine) {
        cell.flagged = true;
        markSudokuFailure();
        return "lose";
      }
      cell.flagged = true;
      cell.crossed = false;
      return checkWin() ? "win" : "continue";
    }
    if (cell.revealed) return "continue";
    if (!cell.flagged && !cell.questioned) cell.flagged = true;
    else if (cell.flagged) {
      cell.flagged = false;
      cell.questioned = true;
    } else cell.questioned = false;
    return "continue";
  }

  function getHint() {
    const current = state();
    if (current.modeKey !== "classic") return { kind: "none", target: null, related: [], message: "提示仅适用于经典扫雷。" };
    return analyzePosition({ board: current.board, rows: current.rows, cols: current.cols, totalMines: current.mines });
  }

  return {
    reveal,
    chord,
    cycleMark,
    getHint,
    prepareSudoku,
    resetTimer: stopTimer,
  };
}
