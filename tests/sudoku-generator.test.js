const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../dist/bundle.js"), "utf8").replace(/\binit\(\);\s*$/, "");

function createMockElement(id, initialValue = "") {
  const element = {
    id,
    value: initialValue,
    textContent: "",
    style: {},
    hidden: false,
    children: [],
    classList: { add() {}, toggle() {} },
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute() {},
    removeAttribute() {},
  };
  Object.defineProperty(element, "innerHTML", {
    get() { return this._innerHTML || ""; },
    set(value) { this._innerHTML = String(value); this.children = []; },
    enumerable: true,
    configurable: true,
  });
  return element;
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
    ["customDifficultyCard", ""],
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
      const element = {
        tagName: tag.toUpperCase(),
        value: "",
        textContent: "",
        style: {},
        hidden: false,
        children: [],
        classList: { add() {}, toggle() {} },
        addEventListener() {},
        appendChild(child) { this.children.push(child); return child; },
        append(...children) { this.children.push(...children); },
        setAttribute() {},
      };
      Object.defineProperty(element, "innerHTML", {
        get() { return this._innerHTML || ""; },
        set(value) { this._innerHTML = String(value); this.children = []; },
        enumerable: true,
        configurable: true,
      });
      return element;
    },
  };

  const context = {
    document,
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    window: { addEventListener() {}, clearInterval, clearTimeout, setInterval, setTimeout, performance: { now: () => 0 } },
    console,
    Math,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => 0 },
  };

  vm.runInNewContext(
    `${source}
` +
      `this.__getDifficultyKey = () => difficultyKey;
` +
      `this.__getModeKey = () => modeKey;
` +
      `this.__getDifficultyRecordKey = () => getDifficultyRecordKey();
` +
      `this.__setDifficulty = setDifficulty;
` +
      `this.__setMode = setMode;
` +
      `this.__refreshDifficultyOptions = refreshDifficultyOptions;
` +
      `this.__normalizeDifficultySelection = normalizeDifficultySelection;
` +
      `this.__generateSudokuMines = generateSudokuMines;
` +
      `this.__resetGame = resetGame;
` +
      `this.__cycleMark = cycleMark;
` +
      `this.__syncGame = syncGame;
` +
      `this.__getState = () => state;
`,
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
for (const size of [9, 11, 13, 15, 19]) {
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

// Forced fallback should not collapse to the same mine layout every time.
const fallbackLayouts = new Set();
for (let i = 0; i < 6; i++) {
  const result = context.__generateSudokuMines(11, { maxAttempts: 0 });
  fallbackLayouts.add(JSON.stringify(result.mines));
}
if (fallbackLayouts.size < 2) {
  throw new Error("forced fallback should vary mine layouts across runs");
}
console.log("sudoku generator: fallback layouts vary across runs");

// Mode switch should normalize away stale custom difficulty when entering sudoku.
context.__setDifficulty("custom");
context.__setMode("classic");
context.__refreshDifficultyOptions();
context.__setMode("sudoku");
context.__refreshDifficultyOptions();
const difficultyKey = context.__getDifficultyKey();
if (!["easy", "normal", "hard", "extreme", "expert"].includes(difficultyKey)) {
  throw new Error(`difficultyKey should normalize inside sudoku mode, got ${difficultyKey}`);
}
if (context.document.getElementById("difficultySelect").value !== difficultyKey) {
  throw new Error("difficulty select and state should stay in sync");
}
if (context.__getDifficultyRecordKey().includes("custom")) {
  throw new Error("sudoku best-time storage key should not keep custom suffix");
}
const optionValues = context.document.getElementById("difficultySelect").children.map((child) => child.value);
if (optionValues.length !== 5) {
  throw new Error(`expected 5 sudoku difficulty options, got ${optionValues.length}`);
}
if (optionValues.includes("custom")) {
  throw new Error("sudoku difficulty options should not include custom");
}
const customCard = context.document.getElementById("customDifficultyCard");
if (!customCard.hidden) {
  throw new Error("custom difficulty card should be hidden in sudoku mode");
}
context.__setMode("classic");
context.__refreshDifficultyOptions();
if (customCard.hidden) {
  throw new Error("custom difficulty card should be visible outside sudoku mode");
}
console.log("sudoku mode: stale custom difficulty is normalized and options are bounded");




// Sudoku mistake should reveal the full board with mine icons instead of leaving a silent hidden failure.
context.__setDifficulty("easy");
context.__setMode("sudoku");
context.__resetGame();
let state = context.__getState();
const hiddenMine = state.board.flat().find((cell) => cell.mine && !cell.givenMine);
if (!hiddenMine) {
  throw new Error("expected a non-given mine to test failure reveal");
}
const hiddenMineRow = state.board.findIndex((row) => row.includes(hiddenMine));
const hiddenMineCol = state.board[hiddenMineRow].indexOf(hiddenMine);
const hiddenMineButton = context.document.getElementById("board").children[hiddenMineRow * state.cols + hiddenMineCol];
if ((hiddenMineButton.children[0] && hiddenMineButton.children[0].textContent) !== "") {
  throw new Error("non-given mine should stay hidden before failure");
}
const safeCell = state.board.flat().find((cell) => !cell.mine && !cell.givenMine);
const safeRow = state.board.findIndex((row) => row.includes(safeCell));
const safeCol = state.board[safeRow].indexOf(safeCell);
context.__cycleMark(safeRow, safeCol);
context.__syncGame("lose");
state = context.__getState();
if (!state.ended || state.win) {
  throw new Error("wrong sudoku mark should end the game as a loss");
}
const revealedHiddenMineButton = context.document.getElementById("board").children[hiddenMineRow * state.cols + hiddenMineCol];
if ((revealedHiddenMineButton.children[0] && revealedHiddenMineButton.children[0].textContent) !== "💣") {
  throw new Error("hidden sudoku mine should be revealed as a mine icon after failure");
}
if (!hiddenMine.revealed) {
  throw new Error("hidden sudoku mine should be marked revealed after failure");
}
console.log("sudoku failure: wrong mark reveals the full mine board");
