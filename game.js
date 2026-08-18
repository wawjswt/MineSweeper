export function createGameLogic(getState, getDifficultyKey) {
  let timerId = null;

  function inBounds(r, c) {
    const state = getState();
    return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
  }

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) out.push([nr, nc]);
      }
    }
    return out;
  }

  function offsetNeighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r - 1 + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) out.push([nr, nc]);
      }
    }
    return out;
  }

  function countOffsetMines(r, c) {
    const state = getState();
    return offsetNeighbors(r, c).reduce(
      (sum, [nr, nc]) => sum + (state.board[nr][nc].mine ? 1 : 0),
      0,
    );
  }

  function layMines(safeRow, safeCol) {
    const state = getState();
    const forbidden = new Set([`${safeRow},${safeCol}`]);
    for (const [r, c] of neighbors(safeRow, safeCol)) forbidden.add(`${r},${c}`);
    const spots = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (!forbidden.has(`${r},${c}`)) spots.push([r, c]);
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (let i = 0; i < state.mines; i++) {
      const [r, c] = spots[i];
      state.board[r][c].mine = true;
    }
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        state.board[r][c].count = countOffsetMines(r, c);
      }
    }
  }

  function floodReveal(row, col) {
    const state = getState();
    const q = [[row, col]];
    while (q.length) {
      const [r, c] = q.shift();
      const cell = state.board[r][c];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.count !== 0 || cell.mine) continue;
      for (const [nr, nc] of neighbors(r, c)) {
        const next = state.board[nr][nc];
        if (!next.revealed && !next.flagged && !next.mine) q.push([nr, nc]);
      }
    }
  }

  function revealAllMines(exploded) {
    const state = getState();
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.board[r][c];
        if (cell.mine) cell.revealed = true;
        if (exploded && exploded[0] === r && exploded[1] === c) cell.exploded = true;
      }
    }
  }

  function checkWin() {
    const state = getState();
    if (state.board.flat().every((cell) => cell.mine || cell.revealed)) {
      state.ended = true;
      state.win = true;
      stopTimer();
      for (const row of state.board) {
        for (const cell of row) {
          if (cell.mine) cell.flagged = true;
        }
      }
      return true;
    }
    return false;
  }

  function startTimer(onTick) {
    if (timerId) return;
    timerId = setInterval(() => {
      const state = getState();
      if (state.started && !state.ended) {
        state.timer = Math.min(999, state.timer + 1);
        onTick();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function reveal(row, col, onTick) {
    const state = getState();
    if (state.ended) return;
    if (!state.started) {
      state.started = true;
      layMines(row, col);
      startTimer(onTick);
    }
    const cell = state.board[row][col];
    if (cell.revealed || cell.flagged) return;
    if (cell.mine) {
      cell.revealed = true;
      state.ended = true;
      stopTimer();
      revealAllMines([row, col]);
      return "lose";
    }
    floodReveal(row, col);
    if (checkWin()) return "win";
    return "continue";
  }

  function chord(row, col, onTick) {
    const state = getState();
    if (state.ended) return;
    const cell = state.board[row][col];
    if (!cell.revealed || !cell.count) return;
    const around = offsetNeighbors(row, col);
    const flagged = around.reduce(
      (sum, [nr, nc]) => sum + (state.board[nr][nc].flagged ? 1 : 0),
      0,
    );
    if (flagged !== cell.count) return;
    for (const [nr, nc] of around) {
      const next = state.board[nr][nc];
      if (!next.revealed && !next.flagged) {
        const result = reveal(nr, nc, onTick);
        if (result === "lose") return "lose";
      }
    }
    if (checkWin()) return "win";
    return "continue";
  }

  function cycleMark(row, col) {
    const state = getState();
    if (state.ended) return;
    const cell = state.board[row][col];
    if (cell.revealed) return;
    if (!cell.flagged && !cell.questioned) cell.flagged = true;
    else if (cell.flagged) {
      cell.flagged = false;
      cell.questioned = true;
    } else {
      cell.questioned = false;
    }
  }

  function resetTimer() {
    stopTimer();
  }

  return {
    reveal,
    chord,
    cycleMark,
    resetTimer,
  };
}
