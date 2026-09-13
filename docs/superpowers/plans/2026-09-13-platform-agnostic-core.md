# Platform-Agnostic Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a platform-independent core boundary while preserving the current Web page and all existing game behavior.

**Architecture:** Add explicit core and platform directories, move the already pure 2048 and Minesweeper modules behind new core paths, and keep the old `src/*.js` imports as compatibility wrappers. Introduce injectable storage, clock, and random-number ports for the Web application, while leaving the large legacy UI scripts intact until their core logic can be extracted safely in later plans.

**Tech Stack:** Native ES Modules, Node built-in test runner, PowerShell, existing no-dependency browser bundle script.

**Spec:** `docs/superpowers/specs/2026-09-13-platform-agnostic-core-design.md`

**Implementation status:** First phase implemented and verified on 2026-09-13. The checkboxes below describe the completed TDD checkpoints; the final full-suite result is recorded in the handoff.

## Global Constraints

- Current browser and local-file entry points must continue to work.
- Existing automated tests are the behavior baseline and must remain green.
- Algorithms, game rules, visual design, and save formats do not change in this phase.
- Do not introduce Taro, uni-app, React, or a new UI framework in this phase.
- `core/` must not read `document`, `window`, `localStorage`, browser Canvas, or browser timers.
- Existing `src/*.js` imports remain valid through thin compatibility wrappers.
- New modules use ES Module syntax.

---

### Task 1: Add platform ports and safe Web implementations

**Files:**
- Create: `src/core/shared/clock.js`
- Create: `src/core/shared/random.js`
- Create: `src/platform/web/clock.js`
- Create: `src/platform/web/storage.js`
- Create: `tests/platform-adapters.test.js`
- Modify: `src/storage.js`
- Modify: `src/app.js`
- Modify: `src/2048-ui.js`

**Interfaces:**
- `createClock({ now, setInterval, clearInterval, setTimeout, clearTimeout })` returns a clock with those five methods.
- `createWebClock()` returns a clock backed by `performance.now`/`Date.now` and global timer functions.
- `createRandom(rng = Math.random)` returns a clamped `next()` function.
- `createWebStorage(storage = globalThis.localStorage)` returns `{ getItem, setItem, removeItem }` with best-effort failure handling.
- `loadSettings(storage)` and all settings save functions accept the storage port; existing no-argument calls remain supported through the Web default.

- [x] **Step 1: Write failing adapter tests**

  Add tests that import the new modules and assert: a fake clock delegates calls, random values are clamped to `[0, 1)`, Web storage reads/writes/removes through an injected map, and a throwing storage does not escape from best-effort methods.

- [x] **Step 2: Run the focused tests and verify the expected missing-module failure**

  Run `node --test tests/platform-adapters.test.js`.
  Expected: the test fails because the new adapter modules do not exist yet.

- [x] **Step 3: Implement the smallest ports and Web adapters**

  Keep the port objects method-based and avoid importing DOM or `wx` from `core/shared`. The Web storage adapter must catch unavailable/private-mode storage errors and return `null`/`false` rather than interrupt gameplay.

- [x] **Step 4: Route existing settings and 2048 storage through the Web adapter**

  Preserve existing key names. `app.js` should create one `webStorage` instance and use it for custom difficulty and best-time records. `2048-ui.js` should receive the same storage instance through its existing `options.storage` seam.

- [x] **Step 5: Run focused and existing tests**

  Run `node --test tests/platform-adapters.test.js tests/2048.test.js tests/minesweeper.test.js`.
  Expected: all focused tests pass.

- [x] **Step 6: Commit the adapter boundary**

  Run `git add src/core/shared src/platform/web src/storage.js src/app.js src/2048-ui.js tests/platform-adapters.test.js` and commit with `refactor: add platform ports for web runtime`.

### Task 2: Move the 2048 engine into the core tree

**Files:**
- Create: `src/core/games/2048/engine.js`
- Modify: `src/2048-game.js`
- Modify: `src/2048-ui.js`
- Modify: `tests/2048.test.js`
- Create: `tests/core-boundaries.test.js`

**Interfaces:**
- `src/core/games/2048/engine.js` exports the existing `moveBoard2048`, `canMove2048`, `spawnTile2048`, `createInitialBoard2048`, `hasReachedTarget2048`, and `create2048Game` functions without browser globals.
- `src/2048-game.js` re-exports those functions from the new core path.
- `2048-ui.js` imports from the new core path and remains the only DOM renderer for 2048.

- [x] **Step 1: Add failing core import and boundary tests**

  Import `create2048Game` from `../src/core/games/2048/engine.js`, assert a deterministic move, and scan the core source for forbidden `document`, `window`, and `localStorage` references.

- [x] **Step 2: Run the focused tests and verify the expected missing-module failure**

  Run `node --test tests/core-boundaries.test.js`.
  Expected: the test fails because the new core engine file is missing.

- [x] **Step 3: Move the existing pure engine implementation without behavior changes**

  Put the current 2048 engine implementation in the new path, replace the old file with a compatibility re-export, and update the UI import. Do not change state shape, scoring, or random behavior.

- [x] **Step 4: Run 2048 and boundary tests**

  Run `node --test tests/core-boundaries.test.js tests/2048.test.js`.
  Expected: all tests pass and the core boundary test reports no browser globals.

- [x] **Step 5: Commit the 2048 core move**

  Run `git add src/core/games/2048 src/2048-game.js src/2048-ui.js tests/2048.test.js tests/core-boundaries.test.js` and commit with `refactor: move 2048 engine into core`.

### Task 3: Move shared Minesweeper rules into the core tree

**Files:**
- Create: `src/core/games/minesweeper/state.js`
- Create: `src/core/games/minesweeper/generator.js`
- Create: `src/core/games/minesweeper/solver.js`
- Modify: `src/state.js`
- Modify: `src/minesweeper-generator.js`
- Modify: `src/minesweeper-solver.js`
- Modify: `src/game.js`
- Modify: `tests/minesweeper.test.js`
- Modify: `tests/core-boundaries.test.js`

**Interfaces:**
- Core modules export the existing `makeState`, `generateClassicBoard`, and `analyzePosition` behavior under the new paths.
- Legacy files re-export the new core modules so current consumers keep working.
- `game.js` imports generator/solver/state dependencies from `src/core/games/minesweeper` and receives its clock through `createGameLogic({ clock })`.

- [x] **Step 1: Extend failing boundary tests**

  Import the new Minesweeper modules, assert that a generated first-click board keeps the safe neighborhood empty, and assert that the core source tree contains no browser global names.

- [x] **Step 2: Run the focused test and verify it fails for the missing core modules**

  Run `node --test tests/core-boundaries.test.js tests/minesweeper.test.js`.
  Expected: the new core import fails before implementation.

- [x] **Step 3: Move the pure modules and preserve compatibility exports**

  Copy the current implementations into the core tree, convert the old files to re-export wrappers, and update `game.js` imports. Keep board cell fields and generator fallback behavior unchanged.

- [x] **Step 4: Inject the clock into Minesweeper runtime timing**

  Add a `clock` option with a safe system-clock default to `createGameLogic`; replace direct timer calls inside that module with `clock.now()`, `clock.setInterval()`, and `clock.clearInterval()`. The Web app passes `createWebClock()` while Node tests can continue using the default.

- [x] **Step 5: Run the focused regression suite**

  Run `node --test tests/core-boundaries.test.js tests/minesweeper.test.js`.
  Expected: all tests pass with no browser references in core modules.

- [x] **Step 6: Commit the Minesweeper core move**

  Run `git add src/core/games/minesweeper src/state.js src/minesweeper-generator.js src/minesweeper-solver.js src/game.js tests/minesweeper.test.js tests/core-boundaries.test.js` and commit with `refactor: move minesweeper rules into core`.

### Task 4: Create explicit extraction seams for legacy games

**Files:**
- Create: `src/core/games/sudoku/index.js`
- Create: `src/core/games/lianliankan/index.js`
- Create: `src/core/games/rogue/index.js`
- Create: `src/adapters/web/README.md`
- Modify: `tests/core-boundaries.test.js`

**Interfaces:**
- Each game index exports the pure modules already safe to reuse plus a documented `get*CoreStatus()` seam marker describing the remaining UI boundary.
- The seams do not import DOM modules and do not expose `window.__XXX__` from the core tree.
- The Web README records the remaining legacy adapter files and the required future extraction order.

- [x] **Step 1: Add failing seam tests**

  Assert that each new index can be imported in Node, exports a named factory, and contains no browser-global references.

- [x] **Step 2: Run the seam tests and verify the expected missing-export failure**

  Run `node --test tests/core-boundaries.test.js`.
  Expected: the imports or named exports are missing.

- [x] **Step 3: Implement minimal explicit extraction seams**

  The Sudoku index exposes the extracted Sudoku minesweeper generator, the Link-Link index exposes level data and pure column-flow helpers, and the Rogue index exposes the already DOM-free engine through a temporary bridge. Each index also returns a status record from `get*CoreStatus()`; none of these modules instantiate DOM or timers. Document that the remaining Sudoku, Link-Link, and Rogue UI controllers stay under `src/` until their pure logic is extracted in separate tasks.

- [x] **Step 4: Run all focused tests**

  Run `node --test tests/core-boundaries.test.js tests/2048.test.js tests/minesweeper.test.js`.
  Expected: all tests pass.

- [x] **Step 5: Commit the extraction seams**

  Run `git add src/core/games/sudoku src/core/games/lianliankan src/core/games/rogue src/adapters/web/README.md tests/core-boundaries.test.js` and commit with `refactor: define legacy game extraction seams`.

### Task 5: Normalize the build entry and verify the complete repository

**Files:**
- Modify: `tools/build-file-bundle.mjs`
- Modify: `package.json`
- Modify: `tests/file-entry.test.js`
- Modify: `docs/superpowers/specs/2026-09-13-platform-agnostic-core-design.md`

**Interfaces:**
- The current `index.html` file entry remains `dist/file-bundle.js`.
- The bundle builder continues to include the app dependency graph and does not include unsupported external imports.
- The test command verifies the focused core boundary tests and the existing full suite.

- [x] **Step 1: Add a failing build assertion for the canonical entry**

  Extend the file-entry test to assert that the generated bundle contains the new 2048 and Minesweeper core module ids and no duplicate legacy implementation module ids.

- [x] **Step 2: Run the file-entry test and verify the expected failure**

  Run `node --test tests/file-entry.test.js`.
  Expected: the new bundle-content assertions fail before the canonical dependency graph is updated.

- [x] **Step 3: Update the builder and test script minimally**

  Ensure the app import graph reaches the new core modules, add the focused test file to `npm test`, and keep the generated artifact synchronized through `npm run build:file`.

- [x] **Step 4: Run the complete verification command**

  Run `npm test` and confirm exit code 0, zero failed tests, and successful bundle generation.

- [x] **Step 5: Restore or stage only intentional generated output**

  Inspect `git diff --stat` and `git diff --check`. Keep only intentional source, test, documentation, and required generated bundle changes; remove whitespace-only build churn.

- [x] **Step 6: Commit the completed first phase**

  Run `git add package.json tools/build-file-bundle.mjs tests/file-entry.test.js docs/superpowers/specs/2026-09-13-platform-agnostic-core-design.md dist/file-bundle.js` and commit with `refactor: establish platform-agnostic game core`.
