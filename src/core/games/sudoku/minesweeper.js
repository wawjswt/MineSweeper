function shuffle(list, rng = Math.random) {
  for (let index = list.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(rng() * (index + 1));
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
  return list;
}

function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}

function adjacent([rowA, colA], [rowB, colB]) {
  return Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1;
}

function generateMineLayout(size, rng) {
  const result = [];
  const usedColumns = new Set();
  const search = (row) => {
    if (row === size) return true;
    const columns = shuffle([...Array(size).keys()], rng);
    for (const col of columns) {
      const point = [row, col];
      if (usedColumns.has(col) || result.some((mine) => adjacent(mine, point))) continue;
      usedColumns.add(col);
      result.push(point);
      if (search(row + 1)) return true;
      result.pop();
      usedColumns.delete(col);
    }
    return false;
  };
  return search(0) ? result : null;
}

function countSolutions(regions, givenMine, rng = Math.random, nodeLimit = 100000) {
  const size = regions.length;
  const usedColumns = new Set();
  const usedRegions = new Set();
  const chosen = [];
  let count = 0;
  let nodes = 0;

  const search = (row) => {
    if (count > 1) return;
    if (++nodes > nodeLimit) {
      count = 2;
      return;
    }
    if (row === size) {
      count++;
      return;
    }
    for (const col of shuffle([...Array(size).keys()], rng)) {
      const point = [row, col];
      if (
        usedColumns.has(col) ||
        usedRegions.has(regions[row][col]) ||
        chosen.some((mine) => adjacent(mine, point)) ||
        (givenMine && row === givenMine[0] && col !== givenMine[1])
      ) continue;
      usedColumns.add(col);
      usedRegions.add(regions[row][col]);
      chosen.push(point);
      search(row + 1);
      chosen.pop();
      usedRegions.delete(regions[row][col]);
      usedColumns.delete(col);
      if (count > 1) return;
    }
  };

  search(0);
  return count;
}

function generateRegions(size, mines, rng = Math.random) {
  if (!mines) return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => col));
  for (let attempt = 0; attempt < 80; attempt++) {
    const regions = Array.from({ length: size }, () => Array(size).fill(-1));
    const frontiers = mines.map(([row, col], region) => {
      regions[row][col] = region;
      return [[row, col]];
    });
    let remaining = size * size - size;
    while (remaining) {
      const available = frontiers.flatMap((frontier, region) => frontier.map(([row, col]) => [region, row, col]));
      shuffle(available, rng);
      let assigned = false;
      for (const [region, row, col] of available) {
        const directions = shuffle([[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]], rng);
        const [nextRow, nextCol] = directions.find(([candidateRow, candidateCol]) =>
          candidateRow >= 0 && candidateRow < size && candidateCol >= 0 && candidateCol < size && regions[candidateRow][candidateCol] < 0,
        ) || [];
        if (nextRow === undefined) continue;
        regions[nextRow][nextCol] = region;
        frontiers[region].push([nextRow, nextCol]);
        remaining--;
        assigned = true;
        break;
      }
      if (!assigned) break;
    }
    if (!remaining && frontiers[0].length >= 3 && frontiers[0].length <= 4) return regions;
  }
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => Math.min(size - 1, Math.floor((row * size + col) / size))));
}

export function generateSudokuMines(size, { rng = Math.random, maxAttempts } = {}) {
  const attempts = maxAttempts ?? (size <= 9 ? 600 : size <= 11 ? 120 : size <= 13 ? 30 : size <= 15 ? 15 : 8);
  const fallbackSteps = [];
  for (let step = 2; step < size; step++) {
    if (gcd(step, size) === 1 && step !== size - 1) fallbackSteps.push(step);
  }

  for (let attempt = 0; attempt < attempts; attempt++) {
    const mines = generateMineLayout(size, rng);
    const regions = mines ? generateRegions(size, mines, rng) : null;
    if (mines && countSolutions(regions, mines[0], rng) === 1) {
      return { mines, regions, verified: true, strategy: "random", attempts: attempt + 1 };
    }
  }

  for (const step of shuffle([...fallbackSteps], rng)) {
    const mines = Array.from({ length: size }, (_, row) => [row, (row * step) % size]);
    const regions = generateRegions(size, mines, rng);
    if (countSolutions(regions, mines[0], rng) === 1) {
      return { mines, regions, verified: true, strategy: "fallback-verified", fallbackStep: step, attempts };
    }
  }

  const fallbackStep = fallbackSteps[Math.floor(rng() * fallbackSteps.length)] || 2;
  const fallbackOffset = Math.floor(rng() * size);
  const mines = Array.from({ length: size }, (_, row) => [row, (fallbackOffset + row * fallbackStep) % size]);
  return {
    mines,
    regions: generateRegions(size, mines, rng),
    verified: false,
    strategy: "fallback-unverified",
    fallbackStep,
    fallbackOffset,
    attempts,
  };
}
