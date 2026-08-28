const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../bundle.js"), "utf8").replace(/\binit\(\);\s*$/, "");

function createMockElement(id, initialValue = "") {
  return {
    id,
    value: initialValue,
    textContent: "",
    innerHTML: "",
    style: {},
    children: [],
    classList: { add() {}, toggle() {} },
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute() {},
    removeAttribute() {},
  };
}

function createContext() {
  const elements = new Map();
  const ids = [
    ["board", ""],
    ["resetButton", ""],
    ["difficultySelect", "custom"],
    ["modeSelect", "classic"],
    ["customRows", ""],
    ["customCols", ""],
    ["customMines", ""],
    ["customRowsLabel", ""],
    ["customColsLabel", ""],
    ["customMinesLabel", ""],
    ["applyCustomDifficultyButton", ""],
    ["themeSelect", "dark"],
    ["bgUpload", ""],
    ["bgOpacity", "0.45"],
    ["clearBgButton", ""],
    ["boardMineCounter", ""],
    ["boardMineMeta", ""],
    ["gameHint", ""],
    ["timer", ""],
    ["statusText", ""],
    ["bestTime", ""],
    ["pageBackdrop", ""],
  ];
  for (const [id, value] of ids) elements.set(id, createMockElement(id, value));

  const document = {
    documentElement: { style: { setProperty() {} } },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createMockElement(id));
      return elements.get(id);
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        value: "",
        textContent: "",
        style: {},
        classList: { add() {}, toggle() {} },
        addEventListener() {},
        appendChild() {},
        append() {},
        setAttribute() {},
      };
    },
  };

  const context = {
    document,
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    window: { addEventListener() {} },
    console,
    Math,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(
    `${source}\n` +
      `this.__getDifficultyKey = () => difficultyKey;\n` +
      `this.__getModeKey = () => modeKey;\n` +
      `this.__getDifficultyRecordKey = () => getDifficultyRecordKey();\n` +
      `this.__setDifficulty = setDifficulty;\n` +
      `this.__setMode = setMode;\n` +
      `this.__refreshDifficultyOptions = refreshDifficultyOptions;\n` +
      `this.__normalizeDifficultySelection = normalizeDifficultySelection;\n` +
      `this.__generateSudokuMines = generateSudokuMines;\n`,
    context,
  );
  return context;
}

function assertSudokuBoard(result, size) {
  const { mines, regions } = result;
  if (!Array.isArray(mines) || mines.length !== size) throw new Error(`expected ${size} mines`);
  if (!Array.isArray(regions) || regions.length !== size) throw new Error(`expected ${size} regions rows`);

  const rows = new Set(mines.map(([r]) => r));
  const cols = new Set(mines.map(([, c]) => c));
  if (rows.size !== size) throw new Error("duplicate mine row");
  if (cols.size !== size) throw new Error("duplicate mine column");
  if (new Set(mines.map(([r, c]) => regions[r][c])).size !== size) throw new Error("duplicate mine region");

  for (let region = 0; region < size; region++) {
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === region) cells.push([r, c]);
      }
    }
    if (cells.length === 0) throw new Error(`region ${region} is empty`);
    const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
    const queue = [cells[0]];
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === region && !seen.has(key)) {
          seen.add(key);
          queue.push([nr, nc]);
        }
      }
    }
    if (seen.size !== cells.length) throw new Error(`region ${region} is disconnected`);
  }

  for (let i = 0; i < mines.length; i++) {
    for (let j = i + 1; j < mines.length; j++) {
      if (Math.abs(mines[i][0] - mines[j][0]) <= 1 && Math.abs(mines[i][1] - mines[j][1]) <= 1) {
        throw new Error("adjacent mines");
      }
    }
  }
}

function assertUniqueSolution(result, size) {
  const { mines, regions } = result;
  const usedCols = new Set();
  const usedRegions = new Set();
  const chosen = [];
  let solutions = 0;

  const search = (row) => {
    if (solutions > 1) return;
    if (row === size) {
      solutions++;
      return;
    }
    for (let col = 0; col < size; col++) {
      const point = [row, col];
      if (
        (row === mines[0][0] && col !== mines[0][1]) ||
        usedCols.has(col) ||
        usedRegions.has(regions[row][col]) ||
        chosen.some(([r, c]) => Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1)
      ) continue;
      usedCols.add(col);
      usedRegions.add(regions[row][col]);
      chosen.push(point);
      search(row + 1);
      chosen.pop();
      usedRegions.delete(regions[row][col]);
      usedCols.delete(col);
    }
  };

  search(0);
  if (solutions !== 1) throw new Error(`expected one solution after given mine, got ${solutions}`);
}

const context = createContext();

// Existing coverage: structural legality and connectivity.
for (const size of [7, 9, 11]) {
  const result = context.__generateSudokuMines(size);
  assertSudokuBoard(result, size);
  if (result.verified) {
    assertUniqueSolution(result, size);
  } else if (result.strategy !== "fallback-unverified") {
    throw new Error(`unexpected generation strategy for ${size}x${size}: ${result.strategy}`);
  }
  console.log(`sudoku generator: ${size}x${size} valid and explicit`);
}

// Explicit downgrade must be observable instead of silently treated as verified.
const fallback = context.__generateSudokuMines(11, { maxAttempts: 0 });
assertSudokuBoard(fallback, 11);
if (fallback.verified !== false || fallback.strategy !== "fallback-unverified") {
  throw new Error("expected an explicit fallback result for forced downgrade");
}
if (fallback.fallbackStep === undefined) {
  throw new Error("fallback result should expose a fallbackStep marker");
}
console.log("sudoku generator: forced fallback is explicit");

// Mode switch should normalize away stale custom difficulty when entering sudoku.
context.__setDifficulty("custom");
context.__setMode("classic");
context.__refreshDifficultyOptions();
context.__setMode("sudoku");
context.__refreshDifficultyOptions();
const difficultyKey = context.__getDifficultyKey();
if (!["easy", "normal", "hard"].includes(difficultyKey)) {
  throw new Error(`difficultyKey should normalize inside sudoku mode, got ${difficultyKey}`);
}
if (context.document.getElementById("difficultySelect").value !== difficultyKey) {
  throw new Error("difficulty select and state should stay in sync");
}
if (context.__getDifficultyRecordKey().includes("custom")) {
  throw new Error("sudoku best-time storage key should not keep custom suffix");
}
console.log("sudoku mode: stale custom difficulty is normalized");
