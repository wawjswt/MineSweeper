# Sudoku Minesweeper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new switchable 5x5 Sudoku Minesweeper mode with auto-generated colored regions, a unique solution, and full logical deducibility.

**Architecture:** Keep classic Minesweeper intact and route Sudoku mode through a separate generator/validator path. The board state will carry mode metadata and region IDs so rendering can show colored regions while the game logic validates uniqueness and win state independently from classic reveal/chord behavior.

**Tech Stack:** Plain JavaScript modules, DOM rendering, CSS.

---

### Task 1: Add the mode entry point and 5x5 defaults

**Files:**
- Modify: `index.html`
- Modify: `config.js`
- Modify: `state.js`

- [ ] **Step 1: Update the mode selector and default config**

```html
<option value="sudoku">数独扫雷</option>
```

```js
export const SUDOKU_DIFFICULTIES = {
  easy: { name: "基础", rows: 5, cols: 5, mines: 5 },
};
```

- [ ] **Step 2: Carry `modeKey` in board state**

```js
export function makeState(difficultyKey, modeKey = "classic") {
  const catalog = modeKey === "sudoku" ? SUDOKU_DIFFICULTIES : DIFFICULTIES;
  const { rows, cols, mines } = catalog[difficultyKey];
  return { rows, cols, mines, modeKey, regions: null, ... };
}
```

- [ ] **Step 3: Verify the app still boots in classic mode**

Run:
```bash
npm run dev
```
Expected: classic Minesweeper opens and behaves the same as before.

### Task 2: Implement Sudoku generation and uniqueness validation

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Add a Sudoku-specific generator path**

```js
function generateSudokuLayout(state) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rowOrder = shuffle([...Array(rows).keys()]);
    const colOrder = shuffle([...Array(cols).keys()]);
    const solutionMines = rowOrder.map((r, i) => [r, colOrder[i]]);
    const regions = makeSudokuRegions(state.board, solutionMines);
    if (!regions) continue;
    if (solveSudoku(state.board, regions, 2) !== 1) continue;
    state.regions = regions;
    ...
    return true;
  }
  return false;
}
```

- [ ] **Step 2: Keep classic reveal logic unchanged**

```js
if (isSudokuMode()) {
  cycleMark(row, col);
  if (!state.started) {
    state.started = true;
    startTimer(onTick);
  }
  if (checkWin()) return "win";
  return "continue";
}
```

- [ ] **Step 3: Run a quick manual generation check**

Open Sudoku mode, restart a few times, and confirm the game consistently produces a 5x5 board with five colored regions and no generation failure.

### Task 3: Render Sudoku mode as a logic puzzle

**Files:**
- Modify: `ui.js`
- Modify: `style.css`

- [ ] **Step 1: Give Sudoku cells region-based classes**

```js
if (state.modeKey === "sudoku") {
  btn.classList.add("sudoku");
  btn.classList.add(`region-${cell.region}`);
}
```

- [ ] **Step 2: Add region colors in CSS**

```css
.cell.sudoku { background: color-mix(in srgb, var(--cell-up) 60%, var(--region-color, rgba(255,255,255,0.08))); }
.cell.region-0 { --region-color: rgba(109, 211, 255, 0.22); }
.cell.region-1 { --region-color: rgba(139, 245, 201, 0.22); }
.cell.region-2 { --region-color: rgba(255, 191, 105, 0.22); }
.cell.region-3 { --region-color: rgba(205, 144, 255, 0.22); }
.cell.region-4 { --region-color: rgba(255, 123, 171, 0.22); }
```

- [ ] **Step 3: Check that Sudoku mode reads clearly on desktop and mobile**

Open the board at a narrow width and confirm the 5x5 regions remain legible.

### Task 4: Wire mode switching through app startup

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Track mode state alongside difficulty**

```js
let modeKey = elements.modeSelect.value;
let state = makeState(difficultyKey, modeKey);
```

- [ ] **Step 2: Reset into the selected mode**

```js
state = makeState(difficultyKey, modeKey);
```

- [ ] **Step 3: Verify switching between classic and Sudoku mode works**

Change modes, press reset, and confirm the board re-renders with the correct rule set.

