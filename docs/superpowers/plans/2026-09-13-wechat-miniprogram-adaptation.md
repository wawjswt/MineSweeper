# 微信小程序适配与迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不复制游戏规则、不破坏现有 Web 版本的前提下，建立原生微信小程序运行壳，并完成 2048、经典扫雷、数独、2D 连连看和 Rogue 的可测试迁移路径。

**Architecture:** 微信小程序使用原生 `App`、`Page`、`Component`、WXML 和 WXSS；`src/core/` 继续只承载平台无关规则，`src/application/` 提供可序列化状态与动作分发，`src/platform/wechat/` 注入微信能力，`src/adapters/miniprogram/` 负责页面 view model 和组件适配。由于小程序页面不能直接复用现有 DOM 控制器，新增构建脚本把共享 ES Module 入口生成到 `miniprogram/generated/runtime.js`，页面只通过该运行包访问共享逻辑。

**Tech Stack:** 原生微信小程序、WXML、WXSS、JavaScript、Native ES Modules、Node 内置测试运行器、现有无依赖 bundle 构建工具；不引入 Taro、uni-app、React 或 Vue。

**Spec:** `docs/superpowers/specs/2026-09-13-platform-agnostic-core-design.md`

## Global Constraints

- 保留现有 Web 页面、`index.html`、`src/app.js` 和 `dist/file-bundle.js` 的行为。
- `src/core/` 和 `src/application/` 不得读取 `window`、`document`、`localStorage`、`wx`、WXML 节点或 `setData`。
- 小程序页面状态必须可序列化；`timerId`、动画 token、DOM/Canvas 节点和临时焦点不得进入核心状态或存档。
- 微信能力只能通过 `src/platform/wechat/` 注入；测试使用 fake API，不依赖微信开发者工具才能通过 Node 测试。
- 规则、存档 key 和现有 Web 操作语义保持不变；页面迁移优先复用核心函数和动作，不在 WXML 中重写规则。
- 每个垂直切片都必须先有失败测试，再实现最小代码，再运行 focused test 和完整 `npm test`。
- 本阶段不接入账号、云开发、排行榜、支付和正式发布配置；真实 AppID 由使用者在微信开发者工具中配置。
- 生成的小程序运行包必须可复现，并与源码一起进入版本控制，避免新环境无法直接打开小程序项目。

## 阶段交付与边界

第三阶段分为四个可验收里程碑，而不是一次性迁移所有页面：

1. **平台基础**：微信 storage、clock、random、媒体能力边界和小程序 bundle 构建完成。
2. **首个可运行切片**：2048 在微信开发者工具中可玩，验证页面生命周期、触摸输入、`setData` 和存档。
3. **常规游戏迁移**：经典扫雷、数独、2D 连连看和 Rogue 按顺序接入同一页面壳；3D 连连看、背景图片和动画作为增强验收项。
4. **发布前质量门槛**：核心/适配器测试、开发者工具冒烟、真机触摸、性能、包体和断点恢复检查完成。

推荐执行顺序：`2048 → 经典扫雷 → 数独 → 2D 连连看 → Rogue → 3D 连连看与媒体增强`。

---

### Task 1: 建立微信平台能力端口

**Files:**
- Create: `src/platform/wechat/storage.js`
- Create: `src/platform/wechat/clock.js`
- Create: `src/platform/wechat/random.js`
- Create: `tests/wechat-platform-adapters.test.js`
- Modify: `src/storage.js`

**Interfaces:**
- `createWechatStorage(wxApi = globalThis.wx)` returns `{ getItem, setItem, removeItem }`; failures return `null`/`false` and never interrupt gameplay.
- `createWechatClock({ now = () => Date.now(), timers = globalThis } = {})` returns `{ now, setInterval, clearInterval, setTimeout, clearTimeout }`.
- `createWechatRandom(rng = Math.random)` returns a clamped `[0, 1)` function by delegating to `createRandom`.
- `loadSettings`, `saveThemeKey`, `saveBackgroundUrl`, `saveBackgroundOpacity`, `saveModeKey`, and `saveGenerationMode` continue to accept the existing storage port without changing key names.

- [x] **Step 1: Write failing adapter tests**

  Add tests with injected fake APIs; do not assign to the real global `wx`:

  ```js
  test("Wechat storage delegates to sync APIs", () => {
    const values = new Map();
    const wxApi = {
      getStorageSync: (key) => values.get(key) ?? "",
      setStorageSync: (key, value) => values.set(key, value),
      removeStorageSync: (key) => values.delete(key),
    };
    const storage = createWechatStorage(wxApi);
    assert.equal(storage.setItem("score", 12), true);
    assert.equal(storage.getItem("score"), "12");
    assert.equal(storage.removeItem("score"), true);
  });
  ```

  Also assert throwing `wxApi` methods are converted to `null`/`false`, fake timers receive the right callback and delay, and `createWechatRandom(() => 2)()` returns `0.999999999`.

- [x] **Step 2: Run the focused tests and verify the expected failure**

  Run:

  ```bash
  node --test tests/wechat-platform-adapters.test.js
  ```

  Expected: FAIL because the three adapter modules do not exist yet.

- [x] **Step 3: Implement the smallest adapters**

  Call only the injected APIs inside the adapter. Do not reference `wx` from core or application code. Keep storage values string-compatible so the existing settings keys and 2048 best-score key can be reused unchanged.

- [x] **Step 4: Run focused and regression tests**

  Run:

  ```bash
  node --test tests/wechat-platform-adapters.test.js tests/platform-adapters.test.js tests/2048.test.js
  ```

  Expected: all tests pass and no existing Web storage behavior changes.

- [x] **Step 5: Commit the platform boundary**

  ```bash
  git add src/platform/wechat src/storage.js tests/wechat-platform-adapters.test.js
  git commit -m "feat: add WeChat platform adapters"
  ```

### Task 2: 建立小程序运行包与通用应用 runtime

**Files:**
- Create: `src/application/game-runtime.js`
- Create: `src/adapters/miniprogram/runtime.js`
- Create: `tools/build-miniprogram.mjs`
- Create: `tests/miniprogram-runtime.test.js`
- Create: `tests/miniprogram-bundle.test.js`
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/pages/home/index.js`
- Create: `miniprogram/pages/home/index.wxml`
- Create: `miniprogram/pages/home/index.wxss`
- Create: `miniprogram/generated/runtime.js`
- Modify: `package.json`

**Interfaces:**
- `createGameRuntime({ initialGame, games })` returns `{ listGames, currentGame, select, getState, dispatch, pause, resume }`.
- A registered game session implements `getState()` and `dispatch(action)`; optional `pause()`/`resume()` are called on page lifecycle changes.
- `createMiniProgramRuntime({ wxApi, rng, timers })` creates the WeChat storage/clock/random ports, registers available sessions, and returns the application runtime without importing `Page`, `wx` directly, WXML, or DOM code.
- `npm run build:miniprogram` writes the deterministic CommonJS-compatible `miniprogram/generated/runtime.js` from `src/adapters/miniprogram/runtime.js`.
- The native page calls only `runtime.select(name)`, `runtime.dispatch(action)`, `runtime.getState()`, `runtime.pause()`, and `runtime.resume()`.

- [x] **Step 1: Write failing runtime contract tests**

  Test a fake session through the runtime:

  ```js
  const runtime = createGameRuntime({
    initialGame: "2048",
    games: {
      "2048": {
        getState: () => ({ score: 0 }),
        dispatch: (action) => ({ action }),
      },
    },
  });
  assert.equal(runtime.currentGame(), "2048");
  assert.deepEqual(runtime.dispatch({ type: "reset" }).result, { action: { type: "reset" } });
  ```

  Assert unknown games do not replace the selected game, lifecycle methods are optional, and the returned view state contains only serializable data.

- [x] **Step 2: Run the focused tests and verify the expected failure**

  Run `node --test tests/miniprogram-runtime.test.js`; it must fail before `game-runtime.js` exists.

- [x] **Step 3: Implement the runtime and reuse the existing registry**

  Wrap `createGameRegistry` instead of creating a second registry implementation. `dispatch` must preserve the existing `{ handled, game, result }` shape and add a current serializable state only at the runtime boundary.

- [x] **Step 4: Add the native shell and generated bundle target**

  `miniprogram/app.json` declares one `pages/home/index` page. The home page starts with a static loading state and no game-specific rule code. The builder must expose the runtime through `module.exports` so the page can use `require("../../generated/runtime.js")`.

- [x] **Step 5: Test the generated artifact**

  `tests/miniprogram-bundle.test.js` must run `npm run build:miniprogram`, require the generated file in Node, assert it exports `createMiniProgramRuntime`, and assert the generated dependency graph contains no `document`, `window`, `localStorage`, or independent Web controller entry.

- [x] **Step 6: Run the Web and Mini Program checks**

  ```bash
  npm run build:miniprogram
  npm test
  node --test tests/miniprogram-runtime.test.js tests/miniprogram-bundle.test.js
  ```

- [x] **Step 7: Commit the runtime and project shell**

  ```bash
  git add src/application/game-runtime.js src/adapters/miniprogram tools/build-miniprogram.mjs tests/miniprogram-runtime.test.js tests/miniprogram-bundle.test.js miniprogram package.json
  git commit -m "feat: add native Mini Program runtime shell"
  ```

### Task 3: 迁移 2048，完成首个端到端垂直切片

**Files:**
- Create: `src/application/games/2048-session.js`
- Create: `src/adapters/miniprogram/view-models/2048.js`
- Create: `tests/2048-session.test.js`
- Modify: `src/adapters/miniprogram/runtime.js`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`

**Interfaces:**
- `create2048Session({ storage, rng })` implements `getState()` and `dispatch(action)` for `{ type: "move", direction }`, `{ type: "reset" }`, and `{ type: "continue" }`.
- The session exposes `board`, `score`, `bestScore`, `status`, `won`, `continued`, `moves`, and `lastMove`; best score uses the existing `2048-best-score` key.
- `to2048ViewModel(state)` returns a WXML-friendly object with a flat `cells` array; it does not create nodes or read platform globals.

- [x] **Step 1: Add failing session and view-model tests**

  Assert a deterministic fake RNG produces a stable initial state, a move changes score/board through the session, best score persists through the injected storage, and the view model contains only arrays, numbers, strings, booleans, and `null`.

- [x] **Step 2: Implement the session by wrapping the existing core engine**

  Do not copy `moveBoard2048` or tile rules. The session calls `create2048Game`, updates best score after each dispatch, and returns a copied state.

- [x] **Step 3: Implement WXML input and rendering**

  Add a 4×4 `wx:for` grid, new-game/continue buttons, direction buttons, and `touchstart`/`touchend` swipe detection. Map a swipe only when the absolute horizontal or vertical delta is at least 24 px; dispatch one direction and clear the touch origin after the action.

- [x] **Step 4: Wire page lifecycle and build output**

  `onLoad` creates one runtime and calls `syncView`; `onShow` resumes it; `onHide` pauses it; `onUnload` releases transient page references. `syncView` calls `setData({ activeGame, game })` with the view model and never stores timer IDs.

- [ ] **Step 5: Run tests and perform the first DevTools smoke test**

  ```bash
  node --test tests/2048-session.test.js tests/miniprogram-runtime.test.js
  npm run build:miniprogram
  npm test
  ```

  In WeChat DevTools verify: page opens, 4×4 board renders, swipe and direction buttons move once, reaching 2048 can continue, best score survives page reload, and switching away/back does not create duplicate listeners.

- [x] **Step 6: Commit the first vertical slice**

  ```bash
  git add src/application/games/2048-session.js src/adapters/miniprogram miniprogram tests/2048-session.test.js
  git commit -m "feat: add Mini Program 2048 vertical slice"
  ```

### Task 4: 迁移经典扫雷并固定触摸语义

**Files:**
- Create: `src/core/games/minesweeper/game.js`
- Create: `src/application/games/minesweeper-session.js`
- Create: `src/adapters/miniprogram/view-models/minesweeper.js`
- Create: `tests/minesweeper-session.test.js`
- Create: `miniprogram/components/minesweeper-board/index.js`
- Create: `miniprogram/components/minesweeper-board/index.wxml`
- Create: `miniprogram/components/minesweeper-board/index.wxss`
- Modify: `src/game.js`
- Modify: `src/adapters/miniprogram/runtime.js`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`

**Interfaces:**
- `src/core/games/minesweeper/game.js` exports `createGameLogic` without importing `src/platform/web/clock.js`; the caller must inject a clock.
- `src/game.js` remains a Web compatibility wrapper that supplies `createWebClock()` when the old caller omits `clock`.
- `createMinesweeperSession({ modeKey, difficultyKey, generationMode, rng, clock, storage })` implements actions `{ type: "reset" }`, `{ type: "reveal", row, col }`, `{ type: "chord", row, col }`, `{ type: "mark", row, col }`, `{ type: "hint" }`, and `{ type: "configure", ... }`.
- `toMinesweeperViewModel(state)` returns rows/cells with only render fields: `revealed`, `flagged`, `questioned`, `crossed`, `mine`, `count`, `region`, `ariaLabel`, and stable row/column indexes.

- [x] **Step 1: Add the core-boundary and session regression tests**

  Import `createGameLogic` from the core path with an injected fake clock, assert first-click safety, mark-cycle behavior, deterministic hints, and assert the core file has no Web or Mini Program globals.

- [x] **Step 2: Move the rule controller behind the core path**

  Move only the state/action logic from `src/game.js` into the core file. Keep the Web wrapper and existing UI callbacks working. The core must receive `clock`, `rng`, `getState`, `getDifficultySpec`, and `getGenerationMode` explicitly.

- [x] **Step 3: Build the Mini Program session and board view model**

  The session owns the mutable state and configuration; the board component only emits `reveal`, `chord`, and `mark` events. A normal tap reveals; a long press enters mark mode for the tapped cell; the explicit mark button remains available for devices where long press is inconvenient.

- [x] **Step 4: Run focused and full tests**

  ```bash
  node --test tests/minesweeper-session.test.js tests/minesweeper.test.js tests/core-boundaries.test.js
  npm test
  ```

- [ ] **Step 5: Verify DevTools behavior and commit**

  Check first-click neighborhood safety, flag/question/clear cycle, hint feedback, timer pause on `onHide`, and no duplicate intervals after repeated `onShow`. Commit with `feat: add Mini Program Minesweeper session`.

### Task 5: 迁移标准数独

**Files:**
- Create: `src/application/games/sudoku-session.js`
- Create: `src/adapters/miniprogram/view-models/sudoku.js`
- Create: `tests/sudoku-session.test.js`
- Create: `miniprogram/components/sudoku-board/index.js`
- Create: `miniprogram/components/sudoku-board/index.wxml`
- Create: `miniprogram/components/sudoku-board/index.wxss`
- Modify: `src/sudoku-game.js`
- Modify: `src/adapters/miniprogram/runtime.js`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`

**Interfaces:**
- `createSudokuSession({ difficulty, rng, clock, storage })` implements `{ type: "new" }`, `{ type: "select", index }`, `{ type: "input", digit }`, `{ type: "toggle-note" }`, `{ type: "erase" }`, `{ type: "hint" }`, `{ type: "undo" }`, `{ type: "redo" }`, `{ type: "pause" }`, and `{ type: "resume" }`.
- Session state contains the existing `values`, `given`, `notes`, `solution`-derived progress, `selectedIndex`, `activeDigit`, `noteMode`, `past`, `future`, `paused`, `ended`, and `generating` semantics; serialization continues through `serializeSave`/`deserializeSave`.
- `toSudokuViewModel(state)` produces 81 WXML cells with candidates, peer/highlight flags, given/user values, and remaining-count text.

- [x] **Step 1: Add failing session tests**

  Cover unique generated puzzles, given-cell protection, note toggling, undo/redo, hint application, wrong input feedback, save/load round-trip, and pause/resume behavior with fake RNG, clock, and storage.

- [ ] **Step 2: Extract state/actions from the Web IIFE**

  Move puzzle state transitions into the session while leaving DOM rendering, keyboard listeners, and tab switching in `src/sudoku-game.js`. Update the Web controller to consume the same session so Web and Mini Program do not develop different rules.

- [x] **Step 3: Implement the WXML board and keypad**

  The board emits `select`; a numeric keypad emits `input`; notes/erase/hint/undo/redo buttons dispatch explicit actions. Given cells are disabled by view state, not by duplicated Sudoku validation in WXML.

- [ ] **Step 4: Run focused tests, full tests, and DevTools checks**

  ```bash
  node --test tests/sudoku-session.test.js tests/sudoku-core.test.js
  node tests/classic-sudoku.test.cjs
  npm test
  ```

  Verify reload restores a saved puzzle, page hide pauses timing, and a page restart does not mutate the stored puzzle unexpectedly.

- [ ] **Step 5: Commit the Sudoku slice**

  ```bash
  git add src/application/games/sudoku-session.js src/adapters/miniprogram miniprogram src/sudoku-game.js tests/sudoku-session.test.js
  git commit -m "feat: add Mini Program Sudoku session"
  ```

### Task 6: 迁移 2D 连连看并保留 3D 为增强项

**Files:**
- Create: `src/application/games/lianliankan-session.js`
- Create: `src/adapters/miniprogram/view-models/lianliankan.js`
- Create: `tests/lianliankan-session.test.js`
- Create: `miniprogram/components/lianliankan-board/index.js`
- Create: `miniprogram/components/lianliankan-board/index.wxml`
- Create: `miniprogram/components/lianliankan-board/index.wxss`
- Modify: `src/lianliankan-game.js`
- Modify: `src/adapters/miniprogram/runtime.js`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`

**Interfaces:**
- `createLianliankanSession({ mode, difficulty, rng, clock, storage })` implements `{ type: "new" }`, `{ type: "select", index }`, `{ type: "reshuffle" }`, `{ type: "tick" }`, `{ type: "set-mode", mode }`, and `{ type: "set-difficulty", difficulty }`.
- The first delivery supports `classic`, `levels`, and `challenge` 2D modes using existing `findPath`, `makeBoard`, `makeDropPlan`, `reshuffle`, and level-progress helpers.
- `toLianliankanViewModel(state)` returns a flat tile array, selected indexes, path segments, score/time/status text, and level/challenge resources without Canvas or DOM nodes.

- [x] **Step 1: Add session tests against existing pure rules**

  Assert valid pair removal, two-turn path selection, failed-pair feedback, reshuffle preserving pairs and guaranteeing a move, level completion, challenge resource consumption, and injected-clock countdown behavior.

- [x] **Step 2: Extract the 2D flow controller**

  Move mode state, selection state, scoring, timer transitions, and level progress into the session. Keep Canvas/DOM animation in the Web controller until the session view model is stable.

- [x] **Step 3: Implement the WXML board**

  Render tiles with `wx:for`; selection and path are CSS classes driven by view state. Cell taps dispatch one `select` action. Do not implement path search or pair validation in the component.

- [ ] **Step 4: Run focused/full tests and verify the 2D slice**

  ```bash
  node --test tests/lianliankan-session.test.js tests/lianliankan-core.test.js
  node tests/lianliankan.test.cjs
  node tests/lianliankan-level-flow.test.cjs
  npm test
  ```

  3D remains a separate enhancement: reuse `src/core/games/lianliankan` geometry in a Canvas component only after 2D package size and touch performance are acceptable.

- [x] **Step 5: Commit the 2D Link-Link slice**

  ```bash
  git add src/application/games/lianliankan-session.js src/adapters/miniprogram miniprogram src/lianliankan-game.js tests/lianliankan-session.test.js
  git commit -m "feat: add Mini Program Link-Link session"
  ```

### Task 7: 迁移 Rogue 战术扫雷

**Files:**
- Create: `src/application/games/rogue-session.js`
- Create: `src/adapters/miniprogram/view-models/rogue.js`
- Create: `tests/rogue-session.test.js`
- Create: `miniprogram/components/rogue-board/index.js`
- Create: `miniprogram/components/rogue-board/index.wxml`
- Create: `miniprogram/components/rogue-board/index.wxss`
- Create: `miniprogram/components/rogue-hud/index.js`
- Create: `miniprogram/components/rogue-hud/index.wxml`
- Create: `miniprogram/components/rogue-hud/index.wxss`
- Modify: `src/adapters/miniprogram/runtime.js`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`

**Interfaces:**
- `createRogueSession({ rng, clock, storage })` wraps `createRogueGame` and maps actions `{ type: "reset" }`, `{ type: "reveal", row, col }`, `{ type: "chord", row, col }`, `{ type: "mark", row, col }`, `{ type: "select-contract", contractId }`, `{ type: "select-tool", toolKey }`, `{ type: "use-tool", row, col }`, `{ type: "cancel-tool" }`, and `{ type: "choose-reward", upgradeId }`.
- `toRogueViewModel(state)` exposes board cells, sectors, contract cards, tool availability, resources, rewards, feedback, and result state as serializable view data.

- [x] **Step 1: Add session and view-model tests**

  Cover contract selection before reveal, sector progress, mine damage/shield behavior, tool resource consumption, reward selection, level progression, accessibility labels, and lost/won run transitions.

- [x] **Step 2: Implement the session wrapper without copying Rogue rules**

  Reuse `createRogueGame` and the canonical `src/core/games/rogue` exports. The adapter maps button/tile events to actions; it must not calculate contracts, sectors, damage, or rewards.

- [x] **Step 3: Implement the board/HUD/components**

  Use separate WXML components for the board, contracts, tools, reward choices, and result panel. Keep the tactical HUD distinct from the shared conventional-game board component.

- [ ] **Step 4: Run Rogue regressions and DevTools checks**

  ```bash
  node --test tests/rogue-session.test.js tests/rogue-core-boundaries.test.js
  npm test
  ```

  Verify contract selection, tools, sector labels, reward selection, page hide/resume, and the guide/result panels on a narrow device viewport.

- [x] **Step 5: Commit the Rogue slice**

  ```bash
  git add src/application/games/rogue-session.js src/adapters/miniprogram miniprogram tests/rogue-session.test.js
  git commit -m "feat: add Mini Program Rogue session"
  ```

### Task 8: 完成共享页面、媒体能力和发布前质量门槛

**Files:**
- Create: `src/platform/wechat/media.js`
- Create: `tests/wechat-media.test.js`
- Create: `src/adapters/miniprogram/view-models/game-tabs.js`
- Create: `miniprogram/components/game-tabs/index.js`
- Create: `miniprogram/components/game-tabs/index.wxml`
- Create: `miniprogram/components/game-tabs/index.wxss`
- Modify: `src/adapters/miniprogram/runtime.js`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.en.md`

**Interfaces:**
- `createWechatMedia(wxApi = globalThis.wx)` exposes an injected `chooseImage()` operation returning a normalized `{ path, width, height }` result or `null`; image compression/upload is kept out of core state.
- `toGameTabViewModel(runtime)` returns game names, active state, and disabled/loading state for WXML.
- `npm run check:miniprogram` runs the build, core boundary scan, generated-bundle test, and all Node tests.

- [x] **Step 1: Add failing media, tab, and package checks**

  Test that media API failures return a non-throwing result, tab selection delegates to `runtime.select`, and the generated bundle does not contain Web controller imports or forbidden browser globals.

- [x] **Step 2: Implement media and shared navigation**

  Keep custom background image support optional and best-effort. A failed image pick must not prevent gameplay. Navigation must select a registered game and refresh only the active view model.

- [x] **Step 3: Add the package-quality command**

  The command must run in this order:

  ```json
  {
    "build:miniprogram": "node tools/build-miniprogram.mjs",
    "check:miniprogram": "npm run build:miniprogram && node --test tests/miniprogram-runtime.test.js tests/miniprogram-bundle.test.js tests/wechat-platform-adapters.test.js tests/wechat-media.test.js && npm test"
  }
  ```

- [ ] **Step 4: Run the full pre-release checklist**

  Run `npm run check:miniprogram`, import `miniprogram/` into WeChat DevTools, and verify:

  - cold start and reload restore the correct active game;
  - all five games can be selected without duplicate page listeners;
  - tap, long press, swipe, keypad, tool and reward actions dispatch once;
  - `onHide` pauses timers and `onShow` resumes them without drift;
  - saved state is JSON-serializable and survives a restart;
  - narrow-screen layout, touch targets, loading/error states and reduced animation are usable;
  - generated package size and board rendering remain acceptable on a real device;
  - Web `index.html` still passes the same full suite.

- [ ] **Step 5: Update bilingual documentation and commit the release gate**

  Document the Mini Program import path, `npm run build:miniprogram`, DevTools setup, supported modes, and the features intentionally deferred. Commit with `docs: document WeChat Mini Program workflow`.

## Acceptance Criteria

- `npm test` remains green after every vertical slice and at the final gate.
- `npm run check:miniprogram` builds the generated runtime and passes all Mini Program boundary tests.
- The generated runtime can be loaded in Node with fake platform APIs and contains no DOM/browser-global dependency.
- The native page can play 2048, classic Minesweeper, Sudoku, 2D Link-Link, and Rogue through WXML events and `setData`.
- Web and Mini Program use the same core/application rules; no game rule is implemented in WXML, WXSS, or page event handlers.
- Page lifecycle does not leak timers or duplicate event listeners.
- The README files accurately distinguish shipped Web behavior, the Mini Program development build, and deferred release features.

## Rollback and Risk Controls

- Keep each game session behind a separate commit so a broken migration can be reverted without reverting platform adapters.
- Keep existing Web controllers and compatibility wrappers until their replacement has focused tests and a DevTools smoke check.
- If generated bundle loading fails in DevTools, fix the build output or switch to generated per-module CommonJS files before migrating another game; do not copy the core implementation into `miniprogram/`.
- If board rendering becomes slow, reduce the view model to changed cells and separate game state from animation state; never move DOM-like objects into the core.
