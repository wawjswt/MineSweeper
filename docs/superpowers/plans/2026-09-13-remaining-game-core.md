# Remaining Game Core and Application Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成第二阶段结构拆分，让数独、连连看和 Rogue 的规则代码进入平台无关核心，并让应用层拥有统一的游戏注册与动作分发接口。

**Architecture:** 保留现有 Web 视觉和交互行为，把数独与连连看的纯生成、规则、关卡流和 3D 几何逻辑迁移到 `src/core/games`；现有 DOM 控制器改为 Web ESM 适配器，只负责事件、计时和渲染。新增 `src/application/game-registry.js` 作为平台无关的会话注册/动作分发边界，Rogue 的纯模块正式归位到 `core`，旧 `src/` 文件只保留兼容 re-export。

**Tech Stack:** 原生 JavaScript ESM、Node `node:test`、现有无依赖文件 bundle 构建器；不引入 Taro、uni-app、React 或新的运行时依赖。

**Spec:** `docs/superpowers/specs/2026-09-13-platform-agnostic-core-design.md`

## Global Constraints

- 现有 Web 页面、HTTP ESM 入口和本地文件入口必须继续可用。
- 规则、棋盘字段、存档键名和用户操作语义保持不变。
- `src/core/**` 不读取 `document`、`window`、`localStorage`、Canvas、浏览器计时器或小程序 API。
- Web 控制器可以保留 DOM、Canvas、全局兼容入口和平台适配；小程序代码不得依赖这些控制器。
- 每次迁移必须先增加能失败的边界/行为测试，再实现，再运行完整回归套件。

---

### Task 1: Add the application game registry and action contract

**Files:**
- Create: `src/application/game-registry.js`
- Create: `tests/application-registry.test.js`
- Modify: `src/core/games/*/index.js` only where a status/registration descriptor is needed

**Interfaces:**
- `createGameRegistry({ initialGame = null } = {})` returns `{ register, unregister, has, list, select, current, dispatch }`.
- `register(name, handler)` requires a non-empty string name and stores a handler with optional `getState()` and `dispatch(action)` functions.
- `select(name)` returns `{ ok: true, game: name, previous }` or `{ ok: false, game: current, previous: current }` without invoking UI code.
- `dispatch(action, gameName = current)` returns `{ handled: false, game: gameName, result: null }` for missing handlers and otherwise returns `{ handled: true, game: gameName, result }`.

- [x] **Step 1: Write the failing registry tests**

  Cover registration/listing, replacement of a named handler, selection of an unknown name without changing current state, dispatch to the selected game, explicit dispatch to another game, and rejection of invalid action handlers.

- [x] **Step 2: Run the focused test and verify the expected missing-module failure**

  Run: `node --test tests/application-registry.test.js`
  Expected: FAIL because `src/application/game-registry.js` does not exist.

- [x] **Step 3: Implement the smallest pure registry**

  Use a private `Map`; clone only the public game-name list; do not import any platform or UI module. Validate `register` inputs and keep `dispatch` synchronous.

- [x] **Step 4: Run the focused test and verify it passes**

  Run: `node --test tests/application-registry.test.js`
  Expected: all registry tests PASS.

- [x] **Step 5: Commit the application boundary**

  Run: `git add src/application/game-registry.js tests/application-registry.test.js` and commit with `refactor: add application game registry`.

### Task 2: Extract the classic Sudoku core and connect the Web adapter

**Files:**
- Create: `src/core/games/sudoku/engine.js`
- Modify: `src/core/games/sudoku/index.js`
- Modify: `src/sudoku-game.js`
- Modify: `src/platform/web/clock.js`
- Modify: `src/platform/web/storage.js`
- Create: `tests/sudoku-core.test.js`
- Modify: `tests/core-boundaries.test.js`
- Modify: `tests/classic-sudoku.test.cjs` only if the compatibility test runner needs a pure-core import replacement

**Interfaces:**
- `engine.js` exports `SIZE`, `TOTAL`, `DIFFICULTIES`, `PEER_SETS`, `shuffle(list, rng)`, `solveOnce(board, rng)`, `countSolutions(board, limit)`, `getCandidates(board, index)`, `findHint(board)`, `findBasicHint(board)`, `ratePuzzle(puzzle)`, `countRemaining(solution, values, digit)`, `isValidSolution(board)`, `serializeSave(record)`, `deserializeSave(raw, difficulty)`, and `makePuzzle(blankTarget, { rng, now } = {})`.
- `makePuzzle` defaults to `Math.random` and `Date.now`; the defaults preserve current behavior while tests can inject deterministic sources.
- `sudoku-game.js` imports the pure exports, imports `createWebClock()`/`createWebStorage()`, and keeps DOM rendering, keyboard handling and lifecycle registration in the Web adapter. It no longer declares the pure solver/generator block or a second peer-set implementation.

- [x] **Step 1: Add failing pure-core and boundary tests**

  Import `makePuzzle`, `countSolutions`, `getCandidates`, `findBasicHint`, and `PEER_SETS` from `../src/core/games/sudoku/engine.js`; assert a valid unique puzzle, known candidates/hint output, deterministic generation with injected `rng`/`now`, and no browser-global names in the Sudoku core source.

- [x] **Step 2: Run the focused test and verify the expected missing-module failure**

  Run: `node --test tests/sudoku-core.test.js tests/core-boundaries.test.js`
  Expected: FAIL at the new Sudoku engine import.

- [x] **Step 3: Move the pure Sudoku implementation without changing rules**

  Move the existing generator, solver, hint/rating, save validation and peer-set logic into `engine.js`; replace the old pure block in `sudoku-game.js` with named imports. Keep `window.__SUDOKU__` out of the core; if an old Web test needs it, expose only a compatibility object assembled from imported functions in the adapter.

- [x] **Step 4: Inject Web storage and clock into the Sudoku adapter**

  Replace direct `localStorage`, `performance`, `setInterval`, `clearInterval` and generation `setTimeout` uses in `sudoku-game.js` with one Web storage port and one Web clock port. Preserve the `sudoku-classic-*-v1` keys and the existing timer/persistence behavior.

- [x] **Step 5: Run the focused Sudoku and legacy checks**

  Run: `node --test tests/sudoku-core.test.js tests/core-boundaries.test.js` and `node tests/classic-sudoku.test.cjs`.
  Expected: core tests PASS, legacy Sudoku behavior checks PASS, and the core scan reports no browser-global references.

- [x] **Step 6: Commit the Sudoku extraction**

  Run: `git add src/core/games/sudoku src/sudoku-game.js src/platform/web/clock.js src/platform/web/storage.js tests/sudoku-core.test.js tests/core-boundaries.test.js tests/classic-sudoku.test.cjs` and commit with `refactor: extract sudoku core and web adapter`.

### Task 3: Extract Link-Link 2D/3D rules and level flow

**Files:**
- Create: `src/core/games/lianliankan/engine.js`
- Modify: `src/core/games/lianliankan/index.js`
- Modify: `src/core/games/lianliankan/levels.js`
- Modify: `src/lianliankan-game.js`
- Modify: `src/lianliankan-levels.js`
- Create: `tests/lianliankan-core.test.js`
- Modify: `tests/core-boundaries.test.js`
- Modify: `tests/lianliankan.test.cjs`, `tests/lianliankan3d.test.cjs`, `tests/lianliankan-levels.test.cjs`, and `tests/lianliankan-level-flow.test.cjs` only as needed to consume the ESM core and Web adapter compatibility surface

**Interfaces:**
- `engine.js` exports the current 2D configuration/constants, `makeBoard`, `findPath`, `explainPairFailure`, `findAnyPair`, `countRemaining`, `reshuffle`, `isEmptyCell`, `segmentClear`, all challenge/level-flow helpers, all 3D geometry/path/board helpers, and `computePathPoints`/`getLineStrokeWidth` as view-neutral geometry helpers.
- All random-dependent functions accept an optional RNG and default to `Math.random`; no function reads `window` or a browser timer.
- `lianliankan-game.js` imports the core and `LLK_LEVELS`; DOM/SVG/Canvas rendering, event listeners, animation scheduling and tab lifecycle remain in the Web adapter.
- `lianliankan-levels.js` becomes a compatibility wrapper or is removed from the HTML entry; the canonical level data lives in `src/core/games/lianliankan/levels.js`.

- [x] **Step 1: Add failing core import and behavior tests**

  Cover 2D board validity/path rules, challenge resource immutability, level flow scoring/drop plans, 3D board validity/path expansion, and the no-browser-global scan for every file under `src/core/games/lianliankan`.

- [x] **Step 2: Run the focused test and verify the expected missing-module failure**

  Run: `node --test tests/lianliankan-core.test.js tests/core-boundaries.test.js`
  Expected: FAIL because the canonical Link-Link engine module is missing.

- [x] **Step 3: Move 2D, level-flow and 3D pure functions into the core engine**

  Copy the existing behavior into the new module, parameterize randomness where the current code uses `Math.random`, and export only functions/data that do not need DOM state. Do not move any render or event function.

- [x] **Step 4: Connect the Web controller to the canonical engine**

  Replace the duplicated pure declarations in `lianliankan-game.js` with imports, replace the level global lookup with imported `LLK_LEVELS`/helpers, and route timer/animation calls through Web clock methods. Keep a thin adapter-only compatibility surface for current Web integration checks while ensuring the rules come from `core`.

- [x] **Step 5: Update the level compatibility entry and test runners**

  Make `src/lianliankan-levels.js` re-export or proxy the canonical data for old consumers, update the ESM-aware test entry points, and keep the existing 2D, 3D, level, and level-flow assertions.

- [x] **Step 6: Run the focused Link-Link regression suite**

  Run: `node --test tests/lianliankan-core.test.js tests/core-boundaries.test.js` plus the existing Link-Link test commands from `package.json`.
  Expected: all path, level, 3D, animation-flow and compatibility checks PASS.

- [x] **Step 7: Commit the Link-Link extraction**

  Run: `git add src/core/games/lianliankan src/lianliankan-game.js src/lianliankan-levels.js tests/lianliankan-core.test.js tests/core-boundaries.test.js tests/lianliankan.test.cjs tests/lianliankan3d.test.cjs tests/lianliankan-levels.test.cjs tests/lianliankan-level-flow.test.cjs` and commit with `refactor: extract lianliankan core and web adapter`.

### Task 4: Move Rogue pure modules under the core and register domains

**Files:**
- Create: `src/core/games/rogue/contracts.js`, `items.js`, `level.js`, `sectors.js`, `state.js`, `game.js`
- Modify: `src/core/games/rogue/index.js`
- Modify: `src/rogue-contracts.js`, `src/rogue-items.js`, `src/rogue-level.js`, `src/rogue-sectors.js`, `src/rogue-state.js`, `src/rogue-game.js`
- Modify: `src/app.js`
- Create: `tests/rogue-core-boundaries.test.js`

**Interfaces:**
- The new core Rogue files export exactly the existing public functions and constants, with imports resolved inside `src/core/games/rogue`.
- The old `src/rogue-*.js` files re-export the canonical core files for current tests and Web adapters.
- `src/app.js` creates an application registry and registers `sweep`, `rogue`, and `2048` descriptors without moving DOM rendering into the registry.

- [x] **Step 1: Add failing canonical-path and registry integration tests**

  Import Rogue functions from `src/core/games/rogue`, assert the first-click safety and one representative action result, assert all core Rogue files have no browser globals, and assert `app.js` can register descriptors through the pure registry contract without importing UI modules into `src/application`.

- [x] **Step 2: Run the focused test and verify the expected missing canonical-file failure**

  Run: `node --test tests/rogue-core-boundaries.test.js tests/application-registry.test.js`
  Expected: FAIL because the canonical Rogue implementation files are not present under `src/core/games/rogue`.

- [x] **Step 3: Move Rogue implementations and preserve old imports**

  Copy each pure module to the core directory, update relative imports to local core paths, change the core index from a bridge to local exports, and turn the old files into one-line compatibility re-exports.

- [x] **Step 4: Register application domains in the Web composition root**

  Instantiate `createGameRegistry({ initialGame: "sweep" })`, register the existing game handlers with `getState`/`dispatch` closures, and leave the current `game-tabs` DOM coordinator and UI render functions responsible for presentation.

- [x] **Step 5: Run Rogue and application regression tests**

  Run: `node --test tests/rogue-core-boundaries.test.js tests/application-registry.test.js tests/rogue-minesweeper.test.js tests/rogue-task1.test.js tests/rogue-task3.test.js tests/rogue-task4.test.js`.
  Expected: all tests PASS and the canonical core scan reports no browser globals.

- [x] **Step 6: Commit the Rogue and registry integration**

  Run: `git add src/core/games/rogue src/rogue-contracts.js src/rogue-items.js src/rogue-level.js src/rogue-sectors.js src/rogue-state.js src/rogue-game.js src/application/game-registry.js src/app.js tests/rogue-core-boundaries.test.js tests/application-registry.test.js` and commit with `refactor: move rogue domain into core`.

### Task 5: Make the unified ESM entry and file bundle canonical

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `tools/build-file-bundle.mjs`
- Modify: `tests/file-entry.test.js`
- Modify: `package.json`
- Modify: `src/adapters/web/README.md`
- Modify: `docs/superpowers/specs/2026-09-13-platform-agnostic-core-design.md`

**Interfaces:**
- HTTP loads one ESM application entry; that entry imports the Web game controllers as side-effect adapters.
- `file:` loads the generated `dist/file-bundle.js`, which contains the same app dependency graph, including all canonical core modules and Web controllers.
- The bundle builder supports named imports, side-effect imports and named re-exports, while rejecting unsupported external imports.

- [ ] **Step 1: Add failing entry/bundle assertions**

  Assert that `index.html` no longer loads the legacy game scripts as independent business entries, that `src/app.js` reaches the Web controllers through imports, and that the generated bundle contains canonical Sudoku/Link-Link/Rogue modules without duplicate legacy implementations.

- [ ] **Step 2: Run the file-entry test and verify the expected failure**

  Run: `node --test tests/file-entry.test.js`.
  Expected: FAIL before the unified imports and builder support are added.

- [ ] **Step 3: Update the entry and builder minimally**

  Add side-effect import parsing, keep the bundle self-contained, remove the duplicate script tags from `index.html`, and add the focused tests to `npm test`.

- [ ] **Step 4: Update documentation and core status records**

  Record that Sudoku and Link-Link are now extracted Web adapters, Rogue is canonical under `core`, and the next phase is `platform/wechat` plus WXML/WXSS adapters. Keep future UI work explicitly out of this phase.

- [ ] **Step 5: Run the complete verification command**

  Run: `npm test` and confirm bundle generation succeeds, all Node tests pass, and all legacy generator/flow checks pass.

- [ ] **Step 6: Inspect the diff and commit the second phase**

  Run: `git diff --stat`, `git diff --check`, and `git status --short --untracked-files=all`; keep only intentional source, test, documentation, and generated bundle changes. Commit with `refactor: complete remaining game core extraction`.
