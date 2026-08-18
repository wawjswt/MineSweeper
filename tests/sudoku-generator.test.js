const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(require.resolve("../bundle.js"), "utf8").replace(/\binit\(\);\s*$/, "");
const document = {
  getElementById: () => ({ addEventListener() {}, classList: { toggle() {} }, style: {}, appendChild() {}, replaceChildren() {}, setAttribute() {}, removeAttribute() {}, value: "", textContent: "", innerHTML: "" }),
  createElement: () => ({ addEventListener() {}, classList: { add() {}, toggle() {} }, style: {}, append() {}, appendChild() {}, setAttribute() {} }),
};
const context = { document, localStorage: { getItem() { return null; }, setItem() {} }, window: { addEventListener() {} }, console, Math, setTimeout, clearTimeout };
vm.runInNewContext(`${source}\nthis.generateSudokuMines = generateSudokuMines;`, context);

function assertSudoku(result, size) {
  const { mines, regions } = result;
  if (mines.length !== size) throw new Error(`expected ${size} mines`);
  if (new Set(mines.map(([r]) => r)).size !== size) throw new Error("duplicate mine row");
  if (new Set(mines.map(([, c]) => c)).size !== size) throw new Error("duplicate mine column");
  if (new Set(mines.map(([r, c]) => regions[r][c])).size !== size) throw new Error("duplicate mine region");
  for (let region = 0; region < size; region++) {
    const cells = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (regions[r][c] === region) cells.push([r, c]);
    const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
    const queue = [cells[0]];
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === region && !seen.has(key)) { seen.add(key); queue.push([nr, nc]); }
      }
    }
    if (seen.size !== cells.length) throw new Error(`region ${region} is disconnected`);
  }
  for (let i = 0; i < mines.length; i++) for (let j = i + 1; j < mines.length; j++) {
    if (Math.abs(mines[i][0] - mines[j][0]) <= 1 && Math.abs(mines[i][1] - mines[j][1]) <= 1) throw new Error("adjacent mines");
  }
  if (size !== 7) return;
  const usedCols = new Set();
  const usedRegions = new Set();
  const chosen = [];
  let solutions = 0;
  const search = (row) => {
    if (solutions > 1) return;
    if (row === size) { solutions++; return; }
    for (let col = 0; col < size; col++) {
      const point = [row, col];
      if ((row === mines[0][0] && col !== mines[0][1]) || usedCols.has(col) || usedRegions.has(regions[row][col])) continue;
      if (chosen.some(([r, c]) => Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1)) continue;
      usedCols.add(col); usedRegions.add(regions[row][col]); chosen.push(point);
      search(row + 1);
      chosen.pop(); usedRegions.delete(regions[row][col]); usedCols.delete(col);
    }
  };
  search(0);
  if (solutions !== 1) throw new Error(`expected one solution after the given mine, got ${solutions}`);
}

for (const size of [7, 9, 11]) {
  assertSudoku(context.generateSudokuMines(size), size);
  console.log(`sudoku generator: ${size}x${size} valid and connected board`);
}
