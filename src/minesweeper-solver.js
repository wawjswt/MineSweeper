function key(row, col) {
  return `${row},${col}`;
}

function pointFromKey(value) {
  return value.split(",").map(Number);
}

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

function comparePoints([rowA, colA], [rowB, colB]) {
  return rowA - rowB || colA - colB;
}

function sortedUnknowns(values) {
  return [...values].map(pointFromKey).sort(comparePoints);
}

function result(kind, target, related, message) {
  return { kind, target, related, message };
}

function candidateResult(kind, candidates, relatedByKey, messageFor) {
  const target = sortedUnknowns(candidates)[0];
  if (!target) return null;
  const targetKey = key(...target);
  const related = [...(relatedByKey.get(targetKey) || [])].sort(comparePoints);
  return result(kind, target, related, messageFor(target, related));
}

export function analyzePosition({ board, rows = board.length, cols = board[0]?.length || 0, totalMines = 0 }) {
  const constraints = [];
  const safeCandidates = new Set();
  const mineCandidates = new Set();
  const safeRelated = new Map();
  const mineRelated = new Map();

  const addRelated = (map, cellKey, related) => {
    if (!map.has(cellKey)) map.set(cellKey, []);
    const values = map.get(cellKey);
    if (!values.some(([row, col]) => row === related[0] && col === related[1])) values.push(related);
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const current = board[row]?.[col];
      if (!current?.revealed || current.mine) continue;

      const unknown = [];
      let flagged = 0;
      for (const [neighborRow, neighborCol] of neighbors(row, col, rows, cols)) {
        const neighbor = board[neighborRow][neighborCol];
        if (neighbor.flagged) flagged++;
        else if (!neighbor.revealed) unknown.push(key(neighborRow, neighborCol));
      }

      const remaining = Number(current.count) - flagged;
      if (remaining < 0 || remaining > unknown.length) {
        return result(
          "inconsistent",
          null,
          [[row, col]],
          "当前标记与数字线索矛盾，请检查旗帜。",
        );
      }
      if (!unknown.length) continue;

      const constraint = {
        cells: new Set(unknown),
        remaining,
        source: [row, col],
      };
      constraints.push(constraint);

      if (remaining === 0) {
        for (const cellKey of unknown) {
          safeCandidates.add(cellKey);
          addRelated(safeRelated, cellKey, [row, col]);
        }
      } else if (remaining === unknown.length) {
        for (const cellKey of unknown) {
          mineCandidates.add(cellKey);
          addRelated(mineRelated, cellKey, [row, col]);
        }
      }
    }
  }

  if (safeCandidates.size && mineCandidates.size) {
    const conflict = [...safeCandidates].find((cellKey) => mineCandidates.has(cellKey));
    if (conflict) {
      return result("inconsistent", null, [...(safeRelated.get(conflict) || []), ...(mineRelated.get(conflict) || [])], "当前标记与数字线索矛盾，请检查旗帜。");
    }
  }

  for (const first of constraints) {
    for (const second of constraints) {
      if (first === second || first.cells.size >= second.cells.size) continue;
      const isSubset = [...first.cells].every((cellKey) => second.cells.has(cellKey));
      if (!isSubset) continue;

      const difference = [...second.cells].filter((cellKey) => !first.cells.has(cellKey));
      const remainingDifference = second.remaining - first.remaining;
      if (remainingDifference < 0 || remainingDifference > difference.length) {
        return result("inconsistent", null, [first.source, second.source], "当前标记与数字线索矛盾，请检查旗帜。");
      }
      if (remainingDifference === 0) {
        for (const cellKey of difference) {
          safeCandidates.add(cellKey);
          addRelated(safeRelated, cellKey, first.source);
          addRelated(safeRelated, cellKey, second.source);
        }
      } else if (remainingDifference === difference.length) {
        for (const cellKey of difference) {
          mineCandidates.add(cellKey);
          addRelated(mineRelated, cellKey, first.source);
          addRelated(mineRelated, cellKey, second.source);
        }
      }
    }
  }

  const safe = candidateResult(
    "safe",
    safeCandidates,
    safeRelated,
    ([row, col], related) => `确定安全：可根据 ${related.map(([sourceRow, sourceCol]) => `(${sourceRow + 1},${sourceCol + 1})`).join("、")} 的数字排除该格 (${row + 1},${col + 1})。`,
  );
  if (safe) return safe;

  const mine = candidateResult(
    "mine",
    mineCandidates,
    mineRelated,
    ([row, col], related) => `确定为雷：可根据 ${related.map(([sourceRow, sourceCol]) => `(${sourceRow + 1},${sourceCol + 1})`).join("、")} 的数字确认该格 (${row + 1},${col + 1})。`,
  );
  if (mine) return mine;

  void totalMines;
  return result("none", null, [], "当前没有确定安全格或雷位，请继续自行推理。");
}
