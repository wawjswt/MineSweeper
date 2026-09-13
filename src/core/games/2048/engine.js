const BOARD_SIZE_2048 = 4;
const CELL_COUNT_2048 = BOARD_SIZE_2048 * BOARD_SIZE_2048;
const DIRECTIONS_2048 = new Set(["up", "down", "left", "right"]);

function assertBoard2048(board) {
  if (!Array.isArray(board) || board.length !== CELL_COUNT_2048) {
    throw new TypeError("A 2048 board must contain exactly 16 cells.");
  }
}

function assertDirection2048(direction) {
  if (!DIRECTIONS_2048.has(direction)) {
    throw new RangeError(`Unknown 2048 direction: ${direction}`);
  }
}

function randomUnit2048(rng) {
  const value = Number(rng());
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999999, Math.max(0, value));
}

function slideLine2048(line) {
  const compact = line.filter((entry) => entry.value !== 0);
  const result = [];
  let scoreDelta = 0;

  for (let index = 0; index < compact.length; index += 1) {
    const current = compact[index];
    const next = compact[index + 1];
    if (next && current.value === next.value) {
      const mergedValue = current.value * 2;
      result.push({
        value: mergedValue,
        sources: [current, next],
        merged: true,
      });
      scoreDelta += mergedValue;
      index += 1;
    } else {
      result.push({
        value: current.value,
        sources: [current],
        merged: false,
      });
    }
  }

  while (result.length < BOARD_SIZE_2048) result.push(null);
  return { line: result, scoreDelta };
}

function lineIndexes2048(lineIndex, direction) {
  if (direction === "left" || direction === "right") {
    return Array.from({ length: BOARD_SIZE_2048 }, (_, offset) => lineIndex * BOARD_SIZE_2048 + offset);
  }
  return Array.from({ length: BOARD_SIZE_2048 }, (_, offset) => offset * BOARD_SIZE_2048 + lineIndex);
}

function sameBoard2048(first, second) {
  return first.every((value, index) => value === second[index]);
}

export function moveBoard2048(board, direction) {
  assertBoard2048(board);
  assertDirection2048(direction);

  const nextBoard = board.slice();
  let scoreDelta = 0;
  const transitions = [];
  const reverseLine = direction === "right" || direction === "down";

  for (let lineIndex = 0; lineIndex < BOARD_SIZE_2048; lineIndex += 1) {
    const indexes = lineIndexes2048(lineIndex, direction);
    const values = indexes.map((index) => board[index]);
    const orientedValues = (reverseLine ? values.slice().reverse() : values).map((value, offset) => ({
      value,
      index: indexes[reverseLine ? BOARD_SIZE_2048 - 1 - offset : offset],
    }));
    const slid = slideLine2048(orientedValues);
    scoreDelta += slid.scoreDelta;
    slid.line.forEach((token, orientedOffset) => {
      const physicalOffset = reverseLine
        ? BOARD_SIZE_2048 - 1 - orientedOffset
        : orientedOffset;
      const destinationIndex = indexes[physicalOffset];
      nextBoard[destinationIndex] = token?.value || 0;
      token?.sources.forEach((source) => {
        transitions.push({
          from: source.index,
          to: destinationIndex,
          value: source.value,
          merged: token.merged,
        });
      });
    });
  }

  return {
    board: nextBoard,
    moved: !sameBoard2048(board, nextBoard),
    scoreDelta,
    transitions,
  };
}

export function canMove2048(board) {
  assertBoard2048(board);

  for (let index = 0; index < board.length; index += 1) {
    if (board[index] === 0) return true;
    const row = Math.floor(index / BOARD_SIZE_2048);
    const col = index % BOARD_SIZE_2048;
    if (col < BOARD_SIZE_2048 - 1 && board[index] === board[index + 1]) return true;
    if (row < BOARD_SIZE_2048 - 1 && board[index] === board[index + BOARD_SIZE_2048]) return true;
  }
  return false;
}

export function spawnTile2048(board, rng = Math.random) {
  assertBoard2048(board);
  const emptyIndexes = board.reduce((indexes, value, index) => {
    if (value === 0) indexes.push(index);
    return indexes;
  }, []);

  const nextBoard = board.slice();
  if (emptyIndexes.length === 0) {
    return { board: nextBoard, index: -1, value: 0, spawned: false };
  }

  const index = emptyIndexes[Math.floor(randomUnit2048(rng) * emptyIndexes.length)];
  const value = randomUnit2048(rng) < 0.9 ? 2 : 4;
  nextBoard[index] = value;
  return { board: nextBoard, index, value, spawned: true };
}

export function createInitialBoard2048(rng = Math.random) {
  let board = Array(CELL_COUNT_2048).fill(0);
  board = spawnTile2048(board, rng).board;
  board = spawnTile2048(board, rng).board;
  return board;
}

export function hasReachedTarget2048(board, target = 2048) {
  assertBoard2048(board);
  return board.some((value) => value >= target);
}

function copyState2048(state) {
  return {
    ...state,
    board: state.board.slice(),
    lastMove: state.lastMove
      ? {
        ...state.lastMove,
        transitions: state.lastMove.transitions.map((transition) => ({ ...transition })),
        spawned: state.lastMove.spawned ? { ...state.lastMove.spawned } : null,
      }
      : null,
  };
}

export function create2048Game(options = {}) {
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const target = Number.isFinite(options.target) && options.target > 0 ? options.target : 2048;
  const suppliedInitialBoard = options.initialBoard ? options.initialBoard.slice() : null;
  if (suppliedInitialBoard) assertBoard2048(suppliedInitialBoard);
  let state;

  function makeInitialState() {
    const board = suppliedInitialBoard ? suppliedInitialBoard.slice() : createInitialBoard2048(rng);
    const won = hasReachedTarget2048(board, target);
    return {
      board,
      score: 0,
      status: won ? "won" : (canMove2048(board) ? "playing" : "over"),
      won,
      continued: false,
      moves: 0,
      lastMove: null,
    };
  }

  function reset() {
    state = makeInitialState();
    return copyState2048(state);
  }

  function move(direction) {
    assertDirection2048(direction);
    if (state.status !== "playing") {
      state = { ...state, lastMove: null };
      return copyState2048(state);
    }

    const result = moveBoard2048(state.board, direction);
    if (!result.moved) {
      state = { ...state, lastMove: null };
      return copyState2048(state);
    }

    const spawned = spawnTile2048(result.board, rng);
    const board = spawned.board;
    const won = state.won || hasReachedTarget2048(board, target);
    const status = won && !state.continued
      ? "won"
      : (canMove2048(board) ? "playing" : "over");

    state = {
      ...state,
      board,
      score: state.score + result.scoreDelta,
      status,
      won,
      moves: state.moves + 1,
      lastMove: {
        direction,
        transitions: result.transitions,
        spawned: spawned.spawned ? { index: spawned.index, value: spawned.value } : null,
      },
    };
    return copyState2048(state);
  }

  function continueAfterWin() {
    if (state.status === "won") {
      state = { ...state, status: "playing", continued: true, lastMove: null };
    }
    return copyState2048(state);
  }

  reset();
  return {
    getState: () => copyState2048(state),
    move,
    reset,
    continueAfterWin,
  };
}
