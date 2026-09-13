/* Platform-agnostic classic Sudoku rules, generation, hints, and save validation. */
export const SIZE = 9;
export const TOTAL = SIZE * SIZE;
const DANGER_LIMIT_MS = 1000; // 挖洞时间预算,防止困难档阻塞过久

export const DIFFICULTIES = {
  easy: { name: "简单", blanks: 36 },
  medium: { name: "中等", blanks: 48 },
  hard: { name: "困难", blanks: 53 },
};

/* ----------------------------- 纯逻辑:生成与求解 ----------------------------- */

export function shuffle(list, rng = Math.random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

export function rowOf(index) {
  return Math.floor(index / SIZE);
}

export function colOf(index) {
  return index % SIZE;
}

function canPlace(board, index, value) {
  const r = rowOf(index);
  const c = colOf(index);
  for (let k = 0; k < SIZE; k++) {
    if (board[r * SIZE + k] === value) return false;
    if (board[k * SIZE + c] === value) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (board[(br + dr) * SIZE + bc + dc] === value) return false;
    }
  }
  return true;
}

function firstEmpty(board) {
  for (let i = 0; i < TOTAL; i++) {
    if (board[i] === 0) return i;
  }
  return -1;
}

/* 生成一个完整的随机解(回溯 + 随机候选序)。返回是否成功。 */
export function solveOnce(board, rng = Math.random) {
  const index = firstEmpty(board);
  if (index === -1) return true;
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  for (let d = 0; d < digits.length; d++) {
    const value = digits[d];
    if (canPlace(board, index, value)) {
      board[index] = value;
      if (solveOnce(board, rng)) return true;
      board[index] = 0;
    }
  }
  return false;
}

/* 统计解的数量,最多数到 limit 即返回(剪枝)。用于唯一解校验。 */
export function countSolutions(board, limit) {
  let found = 0;
  const search = () => {
    if (found >= limit) return;
    const index = firstEmpty(board);
    if (index === -1) {
      found += 1;
      return;
    }
    for (let value = 1; value <= SIZE && found < limit; value++) {
      if (canPlace(board, index, value)) {
        board[index] = value;
        search();
        board[index] = 0;
      }
    }
  };
  search();
  return found;
}

function isBoardArray(board) {
  return Array.isArray(board) && board.length === TOTAL;
}

export function getCandidates(board, index) {
  if (!isBoardArray(board) || index < 0 || index >= TOTAL || board[index] !== 0) return [];
  const candidates = [];
  for (let value = 1; value <= SIZE; value++) {
    if (canPlace(board, index, value)) candidates.push(value);
  }
  return candidates;
}

const DIGIT_MASK = (digit) => 1 << (digit - 1);
const ALL_DIGITS_MASK = (1 << SIZE) - 1;
const STRATEGY_WEIGHTS = {
  "naked-single": 10,
  "hidden-single": 20,
  "locked-candidates": 40,
  "naked-pair": 80,
};
const STRATEGY_RANKS = {
  "naked-single": 1,
  "hidden-single": 2,
  "locked-candidates": 3,
  "naked-pair": 4,
};

function makeUnits() {
  const units = [];
  for (let row = 0; row < SIZE; row++) {
    units.push({
      type: "row",
      index: row,
      cells: Array.from({ length: SIZE }, (_, col) => row * SIZE + col),
    });
  }
  for (let col = 0; col < SIZE; col++) {
    units.push({
      type: "column",
      index: col,
      cells: Array.from({ length: SIZE }, (_, row) => row * SIZE + col),
    });
  }
  for (let box = 0; box < SIZE; box++) {
    const br = Math.floor(box / 3) * 3;
    const bc = (box % 3) * 3;
    const cells = [];
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) cells.push((br + dr) * SIZE + bc + dc);
    }
    units.push({ type: "box", index: box, cells });
  }
  return units;
}

const LOGIC_UNITS = makeUnits();

function makePeerSets() {
  const peers = new Array(TOTAL);
  for (let index = 0; index < TOTAL; index++) {
    const row = rowOf(index);
    const col = colOf(index);
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    const set = new Set();
    for (let offset = 0; offset < SIZE; offset++) {
      set.add(row * SIZE + offset);
      set.add(offset * SIZE + col);
    }
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) set.add((br + dr) * SIZE + bc + dc);
    }
    set.delete(index);
    peers[index] = set;
  }
  return peers;
}

export const PEER_SETS = makePeerSets();

function bitCount(mask) {
  let count = 0;
  for (let rest = mask; rest; rest &= rest - 1) count += 1;
  return count;
}

function digitsFromMask(mask) {
  const digits = [];
  for (let digit = 1; digit <= SIZE; digit++) {
    if (mask & DIGIT_MASK(digit)) digits.push(digit);
  }
  return digits;
}

function makeCandidateState(board) {
  if (!isNumberArray(board, 0, SIZE)) return null;
  for (let index = 0; index < TOTAL; index++) {
    const value = board[index];
    if (value === 0) continue;
    for (const peer of PEER_SETS[index]) {
      if (board[peer] === value) return null;
    }
  }
  const masks = new Array(TOTAL).fill(0);
  for (let index = 0; index < TOTAL; index++) {
    if (board[index] !== 0) continue;
    let mask = ALL_DIGITS_MASK;
    for (const peer of PEER_SETS[index]) {
      if (board[peer] !== 0) mask &= ~DIGIT_MASK(board[peer]);
    }
    if (mask === 0) return null;
    masks[index] = mask;
  }
  return { values: board.slice(), masks };
}

function makeHint(strategy, index, digit, unitType, unitIndex, targetCells, affectedCells, eliminations) {
  let explanation = "高亮格的候选数只剩一个，可以直接完成这一格。";
  if (strategy === "hidden-single") {
    const unitName = unitType === "row" ? "这一行" : unitType === "column" ? "这一列" : "这一宫";
    explanation = "在" + unitName + "中，高亮格是某个数字唯一可以放置的位置。";
  } else if (strategy === "locked-candidates") {
    explanation = "高亮区域中的候选被限制在同一行或同一列,其余高亮位置可以排除该候选。";
  } else if (strategy === "naked-pair") {
    explanation = "高亮的两个格子共享同一组候选,同一单元中的其他格子可以排除这组候选。";
  }
  return {
    strategy,
    index,
    digit,
    unitType,
    unitIndex,
    targetCells: targetCells.slice().sort((left, right) => left - right),
    affectedCells: affectedCells.slice().sort((left, right) => left - right),
    eliminations: eliminations
      .map((item) => ({ index: item.index, digits: item.digits.slice().sort((left, right) => left - right) }))
      .sort((left, right) => left.index - right.index),
    explanation,
  };
}

function findNakedSingle(state) {
  for (let index = 0; index < TOTAL; index++) {
    if (bitCount(state.masks[index]) === 1) {
      return makeHint("naked-single", index, digitsFromMask(state.masks[index])[0], null, null, [index], [], []);
    }
  }
  return null;
}

function findHiddenSingle(state) {
  for (const unit of LOGIC_UNITS) {
    for (let digit = 1; digit <= SIZE; digit++) {
      const mask = DIGIT_MASK(digit);
      const possibleCells = unit.cells.filter(
        (index) => state.values[index] === 0 && (state.masks[index] & mask) !== 0,
      );
      if (possibleCells.length === 1) {
        return makeHint("hidden-single", possibleCells[0], digit, unit.type, unit.index, [possibleCells[0]], [], []);
      }
    }
  }
  return null;
}

function makeEliminationHint(strategy, unit, targetCells, eliminations, digit) {
  const affectedCells = eliminations.map((item) => item.index);
  return makeHint(
    strategy,
    targetCells[0],
    digit,
    unit.type,
    unit.index,
    targetCells,
    affectedCells,
    eliminations,
  );
}

function findLockedCandidates(state) {
  // 宫指向行/列
  for (let box = 0; box < SIZE; box++) {
    const unit = LOGIC_UNITS[18 + box];
    for (let digit = 1; digit <= SIZE; digit++) {
      const mask = DIGIT_MASK(digit);
      const sourceCells = unit.cells.filter(
        (index) => state.values[index] === 0 && (state.masks[index] & mask) !== 0,
      );
      if (sourceCells.length < 2) continue;
      const rows = new Set(sourceCells.map(rowOf));
      const cols = new Set(sourceCells.map(colOf));
      if (rows.size === 1) {
        const rowUnit = LOGIC_UNITS[sourceCells[0] >= 0 ? rowOf(sourceCells[0]) : 0];
        const eliminations = rowUnit.cells
          .filter(
            (index) =>
              state.values[index] === 0 &&
              !unit.cells.includes(index) &&
              (state.masks[index] & mask) !== 0,
          )
          .map((index) => ({ index, digits: [digit] }));
        if (eliminations.length > 0) return makeEliminationHint("locked-candidates", unit, sourceCells, eliminations, digit);
      }
      if (cols.size === 1) {
        const colUnit = LOGIC_UNITS[9 + colOf(sourceCells[0])];
        const eliminations = colUnit.cells
          .filter(
            (index) =>
              state.values[index] === 0 &&
              !unit.cells.includes(index) &&
              (state.masks[index] & mask) !== 0,
          )
          .map((index) => ({ index, digits: [digit] }));
        if (eliminations.length > 0) return makeEliminationHint("locked-candidates", unit, sourceCells, eliminations, digit);
      }
    }
  }

  // 行/列归属宫
  for (let line = 0; line < 18; line++) {
    const unit = LOGIC_UNITS[line];
    for (let digit = 1; digit <= SIZE; digit++) {
      const mask = DIGIT_MASK(digit);
      const sourceCells = unit.cells.filter(
        (index) => state.values[index] === 0 && (state.masks[index] & mask) !== 0,
      );
      if (sourceCells.length < 2) continue;
      const boxes = new Set(sourceCells.map((index) => Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3)));
      if (boxes.size !== 1) continue;
      const box = Array.from(boxes)[0];
      const boxUnit = LOGIC_UNITS[18 + box];
      const eliminations = boxUnit.cells
        .filter(
          (index) =>
            state.values[index] === 0 &&
            !unit.cells.includes(index) &&
            (state.masks[index] & mask) !== 0,
        )
        .map((index) => ({ index, digits: [digit] }));
      if (eliminations.length > 0) return makeEliminationHint("locked-candidates", unit, sourceCells, eliminations, digit);
    }
  }
  return null;
}

function findNakedPair(state) {
  for (const unit of LOGIC_UNITS) {
    for (let left = 0; left < unit.cells.length; left++) {
      const first = unit.cells[left];
      if (state.values[first] !== 0 || bitCount(state.masks[first]) !== 2) continue;
      for (let right = left + 1; right < unit.cells.length; right++) {
        const second = unit.cells[right];
        if (
          state.values[second] !== 0 ||
          state.masks[second] !== state.masks[first] ||
          bitCount(state.masks[second]) !== 2
        ) continue;
        const matchingCells = unit.cells.filter(
          (index) => state.values[index] === 0 && state.masks[index] === state.masks[first],
        );
        if (matchingCells.length !== 2) continue;
        const eliminations = unit.cells
          .filter(
            (index) =>
              index !== first &&
              index !== second &&
              state.values[index] === 0 &&
              (state.masks[index] & state.masks[first]) !== 0,
          )
          .map((index) => ({ index, digits: digitsFromMask(state.masks[index] & state.masks[first]) }));
        if (eliminations.length > 0) {
          const pairDigits = digitsFromMask(state.masks[first]);
          return makeEliminationHint("naked-pair", unit, [first, second], eliminations, pairDigits[0]);
        }
      }
    }
  }
  return null;
}

function findHintFromState(state) {
  return findNakedSingle(state) || findHiddenSingle(state) || findLockedCandidates(state) || findNakedPair(state);
}

export function findHint(board) {
  const state = makeCandidateState(board);
  return state ? findHintFromState(state) : null;
}

export function findBasicHint(board) {
  return findHint(board);
}

function applyHintToState(state, hint) {
  if (hint.strategy === "naked-single" || hint.strategy === "hidden-single") {
    const index = hint.index;
    const bit = DIGIT_MASK(hint.digit);
    if (state.values[index] !== 0 || (state.masks[index] & bit) === 0) return false;
    state.values[index] = hint.digit;
    state.masks[index] = 0;
    for (const peer of PEER_SETS[index]) {
      if (state.values[peer] !== 0) continue;
      state.masks[peer] &= ~bit;
      if (state.masks[peer] === 0) return false;
    }
    return true;
  }
  for (const elimination of hint.eliminations) {
    let removeMask = 0;
    for (const digit of elimination.digits) removeMask |= DIGIT_MASK(digit);
    state.masks[elimination.index] &= ~removeMask;
    if (state.masks[elimination.index] === 0) return false;
  }
  return true;
}

export function ratePuzzle(puzzle) {
  const state = makeCandidateState(puzzle);
  if (!state) return null;
  const counts = {
    "naked-single": 0,
    "hidden-single": 0,
    "locked-candidates": 0,
    "naked-pair": 0,
  };
  let steps = 0;
  let maxRank = 0;
  let stoppedReason = null;
  while (state.values.some((value) => value === 0)) {
    if (steps >= 500) {
      stoppedReason = "step-limit";
      break;
    }
    const hint = findHintFromState(state);
    if (!hint) {
      stoppedReason = "no-logical-step";
      break;
    }
    if (!applyHintToState(state, hint)) {
      stoppedReason = "no-logical-step";
      break;
    }
    counts[hint.strategy] += 1;
    steps += 1;
    maxRank = Math.max(maxRank, STRATEGY_RANKS[hint.strategy]);
  }
  const solvedByLogic = !state.values.some((value) => value === 0);
  const requiresGuess = !solvedByLogic;
  if (!stoppedReason && !solvedByLogic) stoppedReason = "no-logical-step";
  const score = Object.keys(counts).reduce((sum, strategy) => sum + counts[strategy] * STRATEGY_WEIGHTS[strategy], 0) + (requiresGuess ? 1000 : 0);
  const maxStrategy = maxRank === 0 ? "none" : Object.keys(STRATEGY_RANKS).find((strategy) => STRATEGY_RANKS[strategy] === maxRank);
  const level = requiresGuess
    ? "expert"
    : maxRank === 4
      ? "hard"
      : maxRank === 3
        ? "medium"
        : maxRank === 2
          ? "easy"
          : "basic";
  return { score, level, maxStrategy, steps, counts, solvedByLogic, requiresGuess, stoppedReason };
}

export function countRemaining(solution, values, digit) {
  if (!isBoardArray(solution) || !isBoardArray(values) || !Number.isInteger(digit)) return 0;
  let remaining = 0;
  for (let index = 0; index < TOTAL; index++) {
    if (solution[index] === digit && values[index] === 0) remaining += 1;
  }
  return remaining;
}

function isNumberArray(value, min, max) {
  return (
    Array.isArray(value) &&
    value.length === TOTAL &&
    value.every((item) => Number.isInteger(item) && item >= min && item <= max)
  );
}

export function isValidSolution(board) {
  if (!isNumberArray(board, 1, SIZE)) return false;
  for (let row = 0; row < SIZE; row++) {
    const rowValues = new Set();
    const colValues = new Set();
    for (let offset = 0; offset < SIZE; offset++) {
      rowValues.add(board[row * SIZE + offset]);
      colValues.add(board[offset * SIZE + row]);
    }
    if (rowValues.size !== SIZE || colValues.size !== SIZE) return false;
  }
  for (let box = 0; box < SIZE; box++) {
    const br = Math.floor(box / 3) * 3;
    const bc = (box % 3) * 3;
    const values = new Set();
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) values.add(board[(br + dr) * SIZE + bc + dc]);
    }
    if (values.size !== SIZE) return false;
  }
  return true;
}

export function serializeSave(record) {
  return JSON.stringify({ ...record, version: 1 });
}

export function deserializeSave(raw, difficulty) {
  try {
    const record = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!DIFFICULTIES[difficulty] || !record || record.version !== 1 || record.difficulty !== difficulty) return null;
    if (!isNumberArray(record.puzzle, 0, SIZE)) return null;
    if (!isValidSolution(record.solution)) return null;
    if (!isNumberArray(record.values, 0, SIZE)) return null;
    if (!isNumberArray(record.notes, 0, 511)) return null;
    if (!Number.isFinite(record.elapsedMs) || record.elapsedMs < 0) return null;
    if (typeof record.started !== "boolean" || typeof record.ended !== "boolean") return null;
    for (let index = 0; index < TOTAL; index++) {
      if (record.puzzle[index] !== 0 && record.puzzle[index] !== record.solution[index]) return null;
      if (record.puzzle[index] !== 0 && record.values[index] !== record.puzzle[index]) return null;
    }
    const restored = {
      difficulty: record.difficulty,
      puzzle: record.puzzle.slice(),
      solution: record.solution.slice(),
      values: record.values.slice(),
      notes: record.notes.slice(),
      elapsedMs: record.elapsedMs,
      started: record.started,
      ended: record.ended,
    };
    if (typeof record.paused === "boolean") restored.paused = record.paused;
    return restored;
  } catch {
    return null;
  }
}

/*
 * 生成一道唯一解题目。
 * 返回值: { solution, puzzle, removed, rating }
 *  - solution: 完整解(81)
 *  - puzzle:   题目(81,0 表示空格)
 *  - removed:  实际挖掉的数量(困难档可能受时间预算限制而略少)
 */
export function makePuzzle(blankTarget, options = {}) {
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const solution = new Array(TOTAL).fill(0);
  if (!solveOnce(solution, rng)) {
    // 理论不可达;兜底重试一次
    solution.fill(0);
    solveOnce(solution, rng);
  }

  const puzzle = solution.slice();
  const order = shuffle(Array.from({ length: TOTAL }, (_, i) => i), rng);
  const deadline = now() + DANGER_LIMIT_MS;
  let removed = 0;

  for (let i = 0; i < order.length; i++) {
    if (removed >= blankTarget) break;
    if (now() > deadline) break;
    const index = order[i];
    const backup = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle.slice(), 2) !== 1) {
      puzzle[index] = backup;
    } else {
      removed += 1;
    }
  }
  return { solution, puzzle, removed, rating: ratePuzzle(puzzle) };
}
