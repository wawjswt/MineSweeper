/* 固定关卡与障碍相关的连连看纯逻辑。作为普通 script 加载。 */
(function () {
  "use strict";

  /*
   * 关卡图案不再按“同类整块填充”。每个关卡使用错位轮换和邻格约束，
   * 每种图案恰好出现四次(两对)，让玩家必须在障碍和下落变化中规划。
   */
  function makeLayout(rows, cols, obstacleIndexes, emptyIndexes, kinds, anchorIndexes) {
    const layout = new Array(rows * cols).fill(0);
    for (const index of obstacleIndexes) layout[index] = -1;
    for (const index of emptyIndexes) layout[index] = 0;

    // 每关保留一个需要一折连接的起手配对，避免开局死局，
    // 但不再提供相邻同类的无脑直连。
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
    if (remaining[1] < 0) {
      throw new Error("challenge layout has too many anchor tiles");
    }
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

  const levels = [
    {
      id: 1,
      name: "交错",
      rows: 6,
      cols: 6,
      kinds: 7,
      challenge: { timeLimitSeconds: 90, hintLimit: 1, shuffleLimit: 1 },
      layout: makeLayout(6, 6, [0, 5, 30, 35], [8, 15, 20, 27], 7, [7, 14]),
    },
    {
      id: 2,
      name: "断桥",
      rows: 6,
      cols: 8,
      kinds: 9,
      challenge: { timeLimitSeconds: 80, hintLimit: 1, shuffleLimit: 1 },
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
      challenge: { timeLimitSeconds: 60, hintLimit: 0, shuffleLimit: 1 },
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

  function cloneLayout(levelOrId) {
    const level = typeof levelOrId === "number" ? levels[levelOrId - 1] : levelOrId;
    if (!level) throw new Error("unknown level");
    return level.layout.slice();
  }

  function countRemaining(grid) { return grid.reduce((n, value) => n + (value > 0 ? 1 : 0), 0); }

  function collapseColumns(grid, rows, cols) {
    const result = grid.slice();
    const moves = [];
    for (let c = 0; c < cols; c++) {
      let start = 0;
      while (start < rows) {
        while (start < rows && grid[start * cols + c] === -1) start++;
        const end = start;
        while (start < rows && grid[start * cols + c] !== -1) start++;
        const values = [];
        for (let r = end; r < start; r++) if (grid[r * cols + c] > 0) values.push({ from: r * cols + c, value: grid[r * cols + c] });
        for (let r = end; r < start; r++) result[r * cols + c] = 0;
        for (let i = 0; i < values.length; i++) {
          const to = (start - values.length + i) * cols + c;
          result[to] = values[i].value;
          if (values[i].from !== to) moves.push({ from: values[i].from, to, value: values[i].value });
        }
      }
    }
    return { grid: result, moves, dropMoves: moves };
  }

  function reshuffle(input, rows, cols, findPair, random) {
    const source = input.slice();
    if (typeof findPair !== "function") throw new TypeError("reshuffle requires a pair finder");
    const finder = findPair;
    const rng = random || Math.random;
    const slots = source.map((v, i) => v === -1 ? -1 : i).filter((i) => i >= 0);
    const tiles = source.filter((v) => v > 0);
    const tileCounts = new Map();
    for (const tile of tiles) tileCounts.set(tile, (tileCounts.get(tile) || 0) + 1);
    for (let attempt = 0; attempt < 80; attempt++) {
      const next = source.slice();
      for (const i of slots) next[i] = 0;
      for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
      for (let i = 0; i < tiles.length; i++) next[slots[i]] = tiles[i];
      if (finder(next, rows, cols)) return { ok: true, grid: next };
    }
    for (const [kind, count] of tileCounts) if (count >= 2) {
      for (let first = 0; first < slots.length; first++) for (let second = first + 1; second < slots.length; second++) {
        const next = source.slice();
        for (const i of slots) next[i] = 0;
        next[slots[first]] = kind;
        next[slots[second]] = kind;
        let rest = tiles.slice();
        rest.splice(rest.indexOf(kind), 1);
        rest.splice(rest.indexOf(kind), 1);
        let cursor = 0;
        for (let i = 0; i < slots.length && cursor < rest.length; i++) if (i !== first && i !== second) next[slots[i]] = rest[cursor++];
        if (finder(next, rows, cols)) return { ok: true, grid: next };
      }
    }
    return { ok: false, grid: source };
  }

  if (typeof window !== "undefined") window.__LLK_LEVELS__ = Object.assign(levels, { levels, cloneLayout, collapseColumns, reshuffle, countRemaining });
})();
