import { countRemaining as countGridRemaining, reshuffleLevel } from "./engine.js";

function makeLayout(rows, cols, obstacleIndexes, emptyIndexes, kinds, anchorIndexes) {
  const layout = new Array(rows * cols).fill(0);
  for (const index of obstacleIndexes) layout[index] = -1;
  for (const index of emptyIndexes) layout[index] = 0;

  for (const index of anchorIndexes) {
    if (layout[index] !== 0) throw new Error("anchor must be an empty board cell");
    layout[index] = 1;
  }

  const reserved = new Set([...obstacleIndexes, ...emptyIndexes, ...anchorIndexes]);
  const slots = [];
  for (let i = 0; i < layout.length; i++) {
    if (!reserved.has(i)) slots.push(i);
  }
  const remaining = new Array(kinds + 1).fill(4);
  remaining[1] -= anchorIndexes.length;
  if (remaining[1] < 0) throw new Error("challenge layout has too many anchor tiles");
  if (slots.length !== remaining.slice(1).reduce((sum, count) => sum + count, 0)) {
    throw new Error("challenge layout must contain four tiles per kind");
  }

  let cursor = 0;
  for (const index of slots) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    let chosen = 0;
    for (let step = 0; step < kinds; step++) {
      const candidate = ((cursor + step) % kinds) + 1;
      if (!remaining[candidate]) continue;
      const neighbors = [
        row > 0 ? layout[index - cols] : 0,
        col > 0 ? layout[index - 1] : 0,
        row + 1 < rows ? layout[index + cols] : 0,
        col + 1 < cols ? layout[index + 1] : 0,
      ];
      if (neighbors.includes(candidate)) continue;
      chosen = candidate;
      break;
    }
    if (!chosen) throw new Error("challenge layout cannot avoid adjacent pairs");
    layout[index] = chosen;
    remaining[chosen]--;
    cursor = chosen % kinds;
  }
  return layout;
}

export const LLK_LEVELS = [
  {
    id: 1,
    name: "交错",
    rows: 6,
    cols: 6,
    kinds: 7,
    challenge: { timeLimitSeconds: 90, hintLimit: 1, shuffleLimit: 0 },
    layout: makeLayout(6, 6, [0, 5, 30, 35], [8, 15, 20, 27], 7, [7, 14]),
  },
  {
    id: 2,
    name: "断桥",
    rows: 6,
    cols: 8,
    kinds: 9,
    challenge: { timeLimitSeconds: 80, hintLimit: 1, shuffleLimit: 0 },
    layout: makeLayout(6, 8, [0, 1, 6, 7, 40, 41, 46, 47], [10, 17, 30, 37], 9, [9, 18]),
  },
  {
    id: 3,
    name: "迷阵",
    rows: 8,
    cols: 8,
    kinds: 12,
    challenge: { timeLimitSeconds: 70, hintLimit: 1, shuffleLimit: 0 },
    layout: makeLayout(8, 8, [0, 1, 6, 7, 8, 15, 48, 55, 56, 57, 62, 63], [10, 17, 42, 49], 12, [9, 18]),
  },
  {
    id: 4,
    name: "回廊",
    rows: 8,
    cols: 10,
    kinds: 15,
    challenge: { timeLimitSeconds: 60, hintLimit: 0, shuffleLimit: 0 },
    layout: makeLayout(8, 10, [1, 2, 7, 8, 11, 12, 17, 18, 61, 62, 67, 68, 71, 72, 77, 78], [23, 34, 45, 56], 15, [22, 33]),
  },
  {
    id: 5,
    name: "终局",
    rows: 10,
    cols: 10,
    kinds: 19,
    challenge: { timeLimitSeconds: 50, hintLimit: 0, shuffleLimit: 0 },
    layout: makeLayout(10, 10, [0, 1, 8, 9, 10, 11, 18, 19, 44, 45, 54, 55, 80, 81, 88, 89, 90, 91, 98, 99], [23, 34, 65, 76], 19, [22, 33]),
  },
];

export function cloneLayout(levelOrId) {
  const level = typeof levelOrId === "number" ? LLK_LEVELS[levelOrId - 1] : levelOrId;
  if (!level) throw new Error("unknown level");
  return level.layout.slice();
}

export function countRemaining(grid) {
  return countGridRemaining(grid);
}

export function collapseColumns(grid, rows, cols) {
  const result = grid.slice();
  const moves = [];
  for (let col = 0; col < cols; col++) {
    let start = 0;
    while (start < rows) {
      while (start < rows && grid[start * cols + col] === -1) start++;
      const end = start;
      while (start < rows && grid[start * cols + col] !== -1) start++;
      const values = [];
      for (let row = end; row < start; row++) if (grid[row * cols + col] > 0) values.push({ from: row * cols + col, value: grid[row * cols + col] });
      for (let row = end; row < start; row++) result[row * cols + col] = 0;
      for (let index = 0; index < values.length; index++) {
        const to = (start - values.length + index) * cols + col;
        result[to] = values[index].value;
        if (values[index].from !== to) moves.push({ from: values[index].from, to, value: values[index].value });
      }
    }
  }
  return { grid: result, moves, dropMoves: moves };
}

export function reshuffle(input, rows, cols, findPair, random) {
  return reshuffleLevel(input, rows, cols, findPair, random);
}
