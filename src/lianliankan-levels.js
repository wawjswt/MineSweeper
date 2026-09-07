/* 固定关卡与障碍相关的连连看纯逻辑。作为普通 script 加载。 */
(function () {
  "use strict";

  function makeLayout(rows, cols, obstacleIndexes, kinds) {
    const layout = new Array(rows * cols).fill(0);
    for (const index of obstacleIndexes) layout[index] = -1;
    const perKind = (rows * cols - obstacleIndexes.length) / kinds;
    let kind = 1;
    let placed = 0;
    for (let i = 0; i < layout.length; i++) {
      if (layout[i] !== 0) continue;
      layout[i] = kind;
      placed++;
      if (placed === perKind) { kind++; placed = 0; }
    }
    return layout;
  }

  const levels = [
    { id: 1, name: "初探", rows: 6, cols: 6, kinds: 4, layout: makeLayout(6, 6, [5, 6, 29, 35], 4) },
    { id: 2, name: "分流", rows: 6, cols: 8, kinds: 2, layout: makeLayout(6, 8, [7, 8, 39, 47], 2) },
    { id: 3, name: "交错", rows: 8, cols: 8, kinds: 4, layout: makeLayout(8, 8, [7, 8, 15, 16, 47, 55, 56, 63], 4) },
    { id: 4, name: "长廊", rows: 8, cols: 10, kinds: 4, layout: makeLayout(8, 10, [9, 10, 19, 20, 69, 79, 70, 78], 4) },
    { id: 5, name: "终局", rows: 10, cols: 10, kinds: 5, layout: makeLayout(10, 10, [9, 10, 19, 20, 89, 90, 91, 98, 99, 79], 5) },
  ];

  function cloneLayout(levelOrId) {
    const level = typeof levelOrId === "number" ? levels[levelOrId - 1] : levelOrId;
    if (!level) throw new Error("unknown level");
    return level.layout.slice();
  }

  function isEmpty(grid, rows, cols, r, c) {
    return r < 0 || r >= rows || c < 0 || c >= cols || grid[r * cols + c] === 0;
  }

  function segmentClear(grid, rows, cols, a, b) {
    if (a.r === b.r) {
      for (let c = Math.min(a.c, b.c) + 1; c < Math.max(a.c, b.c); c++) if (!isEmpty(grid, rows, cols, a.r, c)) return false;
    } else if (a.c === b.c) {
      for (let r = Math.min(a.r, b.r) + 1; r < Math.max(a.r, b.r); r++) if (!isEmpty(grid, rows, cols, r, a.c)) return false;
    } else return false;
    return true;
  }

  function findPath(grid, rows, cols, a, b) {
    if (!a || !b || a.r === b.r && a.c === b.c) return null;
    const va = grid[a.r * cols + a.c];
    if (va <= 0 || va !== grid[b.r * cols + b.c]) return null;
    if ((a.r === b.r || a.c === b.c) && segmentClear(grid, rows, cols, a, b)) return [a, b];
    const corners = [{ r: a.r, c: b.c }, { r: b.r, c: a.c }];
    for (const p of corners) if (isEmpty(grid, rows, cols, p.r, p.c) && segmentClear(grid, rows, cols, a, p) && segmentClear(grid, rows, cols, p, b)) return [a, p, b];
    for (let c = -1; c <= cols; c++) {
      const p = { r: a.r, c }, q = { r: b.r, c };
      if (isEmpty(grid, rows, cols, p.r, p.c) && isEmpty(grid, rows, cols, q.r, q.c) && segmentClear(grid, rows, cols, a, p) && segmentClear(grid, rows, cols, p, q) && segmentClear(grid, rows, cols, q, b)) return [a, p, q, b];
    }
    for (let r = -1; r <= rows; r++) {
      const p = { r, c: a.c }, q = { r, c: b.c };
      if (isEmpty(grid, rows, cols, p.r, p.c) && isEmpty(grid, rows, cols, q.r, q.c) && segmentClear(grid, rows, cols, a, p) && segmentClear(grid, rows, cols, p, q) && segmentClear(grid, rows, cols, q, b)) return [a, p, q, b];
    }
    return null;
  }

  function findAnyPair(grid, rows, cols) {
    for (let i = 0; i < grid.length; i++) if (grid[i] > 0) for (let j = i + 1; j < grid.length; j++) if (grid[j] === grid[i] && findPath(grid, rows, cols, { r: Math.floor(i / cols), c: i % cols }, { r: Math.floor(j / cols), c: j % cols })) return { a: { r: Math.floor(i / cols), c: i % cols }, b: { r: Math.floor(j / cols), c: j % cols } };
    return null;
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
    const finder = findPair || findAnyPair;
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

  if (typeof window !== "undefined") window.__LLK_LEVELS__ = Object.assign(levels, { levels, cloneLayout, collapseColumns, reshuffle, findPath, findAnyPair, countRemaining });
})();
