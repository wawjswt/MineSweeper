# 战术扫雷：肉鸽模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 在不改变现有经典、偏移、Hex、环形和数独扫雷的前提下，新增五层、三选一强化、生命、能量和主动工具组成的“战术扫雷”肉鸽模式。

**Architecture:** 肉鸽模式使用独立的纯状态、关卡、道具和控制器模块；棋盘生成复用现有 generateClassicBoard，但由独立控制器实现受伤、拆雷、能量和奖励。应用层只负责模式切换和 DOM 连接，经典 createGameLogic 与 createUI 的既有路径保持不变。

**Tech Stack:** 原生 JavaScript ESM、浏览器 DOM/CSS、Node.js node:test、现有八邻域棋盘生成和洪水展开；不新增第三方运行时依赖。

**Spec:** docs/superpowers/specs/2026-09-08-tactical-minesweeper-design.md

## Global Constraints

- 肉鸽内部模式键固定为 rogue，界面名称固定为“战术扫雷”。
- 第一版固定五层，初始生命为 3/3，初始能量为 2/3。
- 每层三种主动工具各有 1 次基础额度，能量跨层保留，工具额度按层重置。
- 踩雷不立即结束关卡；生命归零才进入 lost，已处理雷不得重复伤害。
- 清空所有安全格才通过当前层；第五层通关进入 won。
- 肉鸽模式使用标准随机生成和首点安全，不使用经典模式的可推理生成选择。
- 经典模式现有行为、提示、计时、最佳成绩和其他玩法入口必须保持兼容。
- 不加入商店、金币、Boss、动态雷区、持久化肉鸽局、种子、回放或页面暂停。
- 所有新生产代码必须先有一个会失败的测试，再实现最小代码使其通过。

---

### Task 1: Add pure rogue state and level generation

**Files:**
- Create: src/rogue-state.js
- Create: src/rogue-level.js
- Test: tests/rogue-minesweeper.test.js
- Modify: package.json

**Interfaces:**
- rogue-state.js exports createRogueRunState() and createRogueEmptyCell().
- rogue-level.js exports ROGUE_LEVELS, getRogueLevelSpec(floor), createRogueLevel({ floor, rng, safeRow, safeCol, toolBonus }), getRogueNeighbors(row, col, rows, cols), and revealRogueFlood(board, row, col, rows, cols).
- A level created without safeRow/safeCol has an empty non-started board; a level created with both coordinates calls generateClassicBoard with generationMode: standard.
- revealRogueFlood returns the number of newly revealed safe cells and uses an index pointer rather than shift().

- [ ] **Step 1: Write failing state and level tests**

Create tests/rogue-minesweeper.test.js with node:test and node:assert/strict. First add these assertions:

~~~js
test("rogue run starts with the designed resources", () => {
  const state = createRogueRunState();
  assert.equal(state.status, "ready");
  assert.equal(state.floor, 1);
  assert.equal(state.lives, 3);
  assert.equal(state.maxLives, 3);
  assert.equal(state.energy, 2);
  assert.equal(state.maxEnergy, 3);
  assert.deepEqual(state.level.activeToolUses, {
    scoutPulse: 1,
    defusalKit: 1,
    reactionShield: 1,
  });
});

test("rogue level specs use the five planned board sizes", () => {
  assert.deepEqual(ROGUE_LEVELS.map(({ rows, cols, mines }) => ({ rows, cols, mines })), [
    { rows: 7, cols: 7, mines: 8 },
    { rows: 8, cols: 9, mines: 13 },
    { rows: 9, cols: 10, mines: 19 },
    { rows: 10, cols: 12, mines: 28 },
    { rows: 11, cols: 14, mines: 40 },
  ]);
});

test("starting a rogue level keeps the first click neighborhood safe", () => {
  const level = createRogueLevel({ floor: 1, safeRow: 0, safeCol: 0, rng: () => 0.25 });
  for (const [row, col] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    assert.equal(level.board[row][col].mine, false);
  }
  assert.equal(level.board.flat().filter((cell) => cell.mine).length, 8);
});

test("rogue flood reveal visits each safe cell once", () => {
  const board = [
    [{ mine: false, revealed: false, flagged: false, count: 0 }, { mine: false, revealed: false, flagged: false, count: 0 }, { mine: true, revealed: false, flagged: false, count: 0 }],
    [{ mine: false, revealed: false, flagged: false, count: 0 }, { mine: false, revealed: false, flagged: false, count: 0 }, { mine: false, revealed: false, flagged: false, count: 1 }],
  ];
  assert.equal(revealRogueFlood(board, 0, 0, 2, 3), 5);
  assert.equal(board.flat().filter((cell) => cell.revealed).length, 5);
});
~~~

- [ ] **Step 2: Run the test and verify the expected RED state**

Run: node --test tests/rogue-minesweeper.test.js

Expected: FAIL because src/rogue-state.js and src/rogue-level.js do not exist.

- [ ] **Step 3: Implement the minimal state factory**

createRogueRunState must return modeKey rogue, status ready, floor 1, totalFloors 5, lives/maxLives 3, energy/maxEnergy 2/3, safeRevealStreak 0, score 0, upgrades [], nextLevelToolBonus with all three tool keys at 0, a level for 7×7 with 8 mines, empty board, safeCellsRemaining 41, activeToolUses all 1, shieldActive false, rewardOptions [], notice "", and focusedCell [0, 0]. createRogueEmptyCell must include mine, revealed, flagged, questioned, exploded, neutralized, and count.

- [ ] **Step 4: Implement level specs and pure board helpers**

Use the exact five specs in the test. Clamp getRogueLevelSpec to the first or last spec for out-of-range floors. createRogueLevel must copy the spec, initialize an empty board when no first-click coordinates are supplied, or call generateClassicBoard with the supplied RNG and standard generation when coordinates are supplied. Add the tool bonus to each level's activeToolUses. Keep safeCellsRemaining equal to the number of non-mine, non-revealed cells.

getRogueNeighbors must implement ordinary eight-neighbor bounds. revealRogueFlood must skip revealed, flagged, and mine cells, reveal each safe cell once, enqueue zero-count neighbors, and return the reveal count.

- [ ] **Step 5: Run focused and existing tests**

Run: node --test tests/rogue-minesweeper.test.js

Expected: PASS for state, specs, first-click safety, and flood-fill.

Run: npm test

Expected: PASS for all existing classic, Sudoku, Link-Link, and 3D Link-Link tests.

- [ ] **Step 6: Add the rogue test file to package.json**

Change only the test script so its first segment is node --test tests/minesweeper.test.js tests/rogue-minesweeper.test.js, followed by the existing CommonJS test commands unchanged.

- [ ] **Step 7: Commit the pure state and level slice**

Run:
~~~text
git add src/rogue-state.js src/rogue-level.js tests/rogue-minesweeper.test.js package.json
git commit -m "feat: add rogue minesweeper state and levels"
~~~

### Task 2: Implement tools, upgrades, and the rogue controller

**Files:**
- Create: src/rogue-items.js
- Create: src/rogue-game.js
- Modify: tests/rogue-minesweeper.test.js

**Interfaces:**
- rogue-items.js exports TOOL_DEFINITIONS, UPGRADE_DEFINITIONS, getRewardOptions({ ownedUpgrades, rng }), getToolDefinition(toolKey), and getUpgradeDefinition(upgradeId).
- rogue-game.js exports createRogueGame({ rng, levelFactory }).
- The controller exposes getState(), reset(), reveal(row, col), chord(row, col), cycleMark(row, col), selectTool(toolKey), cancelTool(), useSelectedTool(row, col), and chooseReward(upgradeId).
- Action methods return continue, hit, reward, win, lose, or invalid. Invalid actions leave game state unchanged.

- [ ] **Step 1: Write failing controller tests**

Append tests for these exact behaviors:

~~~js
test("reward choices are distinct and deterministic with an injected rng", () => {
  const options = getRewardOptions({ ownedUpgrades: [], rng: () => 0.1 });
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map((option) => option.id)).size, 3);
});

test("stepping on a mine costs one life and neutralizes it", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  const livesBefore = state.lives;
  assert.equal(game.reveal(0, 1), "hit");
  assert.equal(state.lives, livesBefore - 1);
  assert.equal(state.level.board[0][1].neutralized, true);
  assert.equal(game.reveal(0, 1), "continue");
  assert.equal(state.lives, livesBefore - 1);
});

test("reaction shield absorbs the next mine hit without costing life", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  assert.equal(game.selectTool("reactionShield"), true);
  assert.equal(game.useSelectedTool(), "continue");
  const livesBefore = state.lives;
  assert.equal(game.reveal(0, 1), "hit");
  assert.equal(state.lives, livesBefore);
  assert.equal(state.level.shieldActive, false);
});

test("defusal kit neutralizes a flagged mine without changing clue counts", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  const before = state.level.board[0][0].count;
  assert.equal(game.selectTool("defusalKit"), true);
  assert.equal(game.useSelectedTool(0, 1), "continue");
  assert.equal(state.level.board[0][1].neutralized, true);
  assert.equal(state.level.board[0][0].count, before);
  assert.equal(state.energy, 0);
});

test("scout pulse reports an area count without changing the board", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  const before = JSON.stringify(state.level.board);
  assert.equal(game.selectTool("scoutPulse"), true);
  assert.equal(game.useSelectedTool(0, 2), "continue");
  assert.match(state.notice, /侦察脉冲/);
  assert.equal(JSON.stringify(state.level.board), before);
});

test("life zero ends the run and blocks later actions", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.lives = 1;
  assert.equal(game.reveal(0, 1), "lose");
  assert.equal(state.status, "lost");
  assert.equal(game.cycleMark(1, 1), "invalid");
  assert.equal(game.selectTool("scoutPulse"), false);
  assert.equal(game.chooseReward("medical"), "invalid");
});
~~~

The helper makeKnownLevel must install a 2×3 board with one flagged mine, known counts, safeCellsRemaining 4, all three tool uses 1, and status playing. This keeps controller tests deterministic without relying on a random board layout.

- [ ] **Step 2: Run focused tests and verify RED**

Run: node --test tests/rogue-minesweeper.test.js

Expected: FAIL because the item and controller modules do not exist.

- [ ] **Step 3: Implement stable item definitions**

Use these tool IDs and costs:

~~~js
scoutPulse: { label: "侦察脉冲", cost: 1 }
defusalKit: { label: "拆雷装置", cost: 2 }
reactionShield: { label: "反应护盾", cost: 1 }
~~~

Use these reward IDs: storage, chain, medical, toolBoost:scoutPulse, toolBoost:defusalKit, toolBoost:reactionShield, and supply. getRewardOptions must filter owned IDs, shuffle a copy using the injected RNG, return three distinct options when possible, and fill missing options with distinct energy:0, energy:1, and energy:2 IDs. It must not mutate UPGRADE_DEFINITIONS or ownedUpgrades.

- [ ] **Step 4: Implement reset, first reveal, mark cycle, flood reveal, and chord**

reset creates a fresh run state and first empty level. On first reveal, create the level with the clicked coordinates and standard generation, flood reveal from the clicked cell, update safeCellsRemaining, set status playing, and award safe-reveal score/streak. Reject actions in won/lost/reward as appropriate. cycleMark follows flag → question → clear and clears notice. chord only acts on a revealed non-zero number when its flagged-neighbor count matches the number; stop after the first mine hit.

- [ ] **Step 5: Run focused tests and fix only controller integration failures**

Run: node --test tests/rogue-minesweeper.test.js

Expected: state and basic board tests pass; tool tests remain the only failures until the next step. Do not change tests to accommodate an implementation error.

- [ ] **Step 6: Implement damage, score, energy, and win/loss transitions**

Each safe reveal action increments safeRevealStreak once, adds the number of newly revealed cells to score, and grants one energy at streak 4, or streak 3 if chain is owned. Energy never exceeds maxEnergy. A mine hit sets neutralized and exploded, adds 3 score, clears the streak, consumes the shield if active or decrements lives otherwise, and returns hit unless lives reaches zero. At zero lives set status lost and level ended.

When safeCellsRemaining reaches zero, add 10 score. Set won after floor 5; otherwise set reward and generate three rewardOptions. No action may mutate a won or lost run.

- [ ] **Step 7: Implement all three tools with atomic resource checks**

selectTool validates status, tool key, remaining uses, and enough energy. Targeted tools remain selected until a valid target succeeds or cancelTool is called. The shield has no target and activates immediately.

Scout pulse accepts a non-revealed center and reports the clipped 3×3 region mine count without changing board fields. Defusal kit accepts only flagged cells: true mine gets neutralized while retaining its flag; false flag clears the flag and flood-reveals the safe cell. Reaction shield makes the next mine hit cost no life and expires on that hit or level transition. Every successful use consumes energy and one use; invalid targets consume nothing.

- [ ] **Step 8: Implement reward application and next-level carry-over**

chooseReward works only in reward and only for an option in rewardOptions. Apply one selected effect, append its ID, then increment floor and create the next level with nextLevelToolBonus. storage increases maxEnergy and immediately adds one energy; chain changes the safe streak threshold to 3; medical increases maxLives and lives; toolBoost:<tool> adds one next-level use for that tool; supply adds one next-level use for all tools; energy:<n> adds one energy. Clear pending bonuses and selected tool when creating the next level.

- [ ] **Step 9: Run all controller and regression tests**

Run: node --test tests/rogue-minesweeper.test.js

Expected: PASS for tools, damage, energy, rewards, win/loss blocking, and scout board immutability.

Run: npm test

Expected: PASS with all pre-existing tests unchanged.

- [ ] **Step 10: Commit the controller slice**

Run:
~~~text
git add src/rogue-items.js src/rogue-game.js tests/rogue-minesweeper.test.js
git commit -m "feat: add tactical minesweeper tools and run loop"
~~~

### Task 3: Add the tactical DOM view and mode routing

**Files:**
- Create: src/rogue-ui.js
- Modify: index.html
- Modify: src/app.js
- Modify: src/config.js
- Modify: tests/rogue-minesweeper.test.js

**Interfaces:**
- rogue-ui.js exports buildRogueCellAriaLabel(cell, row, col), getRogueToolButtonState({ selected, disabled, uses, cost }), and createRogueUI(elements).
- createRogueUI returns render(state, handlers), bindHandlers(handlers), setVisible(visible), clearToolSelection(), and getSelectedTool().
- app.js routes rogue actions to rogueGame and all other modes to the existing game/ui pair.

- [ ] **Step 1: Write failing label and tool-state tests**

~~~js
test("rogue labels include coordinates and neutralized state", () => {
  assert.match(
    buildRogueCellAriaLabel({ revealed: true, mine: true, neutralized: true, count: 0 }, 1, 2),
    /第 2 行第 3 列.*已拆除/,
  );
});

test("rogue tool state exposes accessible selection and resource text", () => {
  assert.deepEqual(getRogueToolButtonState({ selected: true, disabled: false, uses: 1, cost: 2 }), {
    pressed: true,
    ariaDisabled: false,
    text: "1次 · 2能量",
  });
});
~~~

- [ ] **Step 2: Run the test and verify RED**

Run: node --test tests/rogue-minesweeper.test.js

Expected: FAIL on the missing rogue-ui.js import.

- [ ] **Step 3: Add mode configuration and DOM containers**

Add rogue: { label: "战术扫雷" } to MODES. Add the option value rogue to modeSelect. Add IDs classicHud, classicControls, and classicBoardWrap to the classic-only sections.

Add a hidden rogueView containing rogueFloor, rogueLives, rogueEnergy, rogueScore, rogueUpgradeSummary, rogueTools, rogueFeedback with role status and aria-live polite, rogueBoard with role grid, rogueReward with rogueRewardOptions, and rogueResult with rogueResultTitle, rogueResultText, and rogueResetButton. Keep the shared theme/background controls and mode selector available.

- [ ] **Step 4: Implement the pure label helper and DOM renderer**

buildRogueCellAriaLabel must describe coordinates, flag, question, unrevealed, safe number, live mine, and neutralized mine. getRogueToolButtonState returns pressed, ariaDisabled, and text in the form “N次 · M能量”.

createRogueUI renders a rectangular grid with one focusable role gridcell button per cell. Use the same primary/reveal, quick-chord, right-click, long-press, F, Enter/Space, arrow-key, and focus-restore behavior as the existing UI. Render classes for revealed, flagged, questioned, mine, neutralized, and exploded; a neutralized mine displays a distinct repair icon. Tool buttons show costs, remaining uses, aria-pressed, and aria-disabled. Reward options are keyboard-accessible buttons with data-upgrade-id.

- [ ] **Step 5: Run focused tests and existing tests**

Run: node --test tests/rogue-minesweeper.test.js

Expected: PASS for labels, tool-state helper, and all prior controller tests.

Run: npm test

Expected: PASS with existing gameplay tests intact.

- [ ] **Step 6: Route app.js without changing classic behavior**

Import createRogueGame and createRogueUI. Add rogue elements and instantiate one rogue controller. Add isRogueMode. Branch resetGame, syncGame, handleReveal, handleChord, handleCycleMark, and mode-change handling before classic-only work.

In rogue mode hide classicHud, classicControls, and classicBoardWrap; show rogueView; render rogueGame state with rogueUI; do not call classic timer, hint, best-time, or classic render functions. When leaving rogue, cancel selected tools, restore classic sections, and call the existing reset path. Hide generation and custom-difficulty controls while rogue is selected.

Wire reset, reveal, chord, cycleMark, tool selection, targeted tool use, Escape cancellation, reward selection, and result reset. Use aria-live feedback for status, damage, energy, tools, rewards, and final result.

- [ ] **Step 7: Manually verify mode routing**

Run: python -m http.server 8080

Open http://localhost:8080/ and verify that tactical mode shows its HUD, first-click safety, mark cycle, quick expansion, keyboard navigation, tools, reward cards, and loss lockout. Switch back through classic, offset, Hex, ring, and Sudoku and verify the existing controls, board, timer, hint, and completion behavior remain available.

- [ ] **Step 8: Commit the DOM and routing slice**

Run:
~~~text
git add index.html src/app.js src/config.js src/rogue-ui.js tests/rogue-minesweeper.test.js
git commit -m "feat: add tactical minesweeper mode UI"
~~~

### Task 4: Add scoped styling and final verification

**Files:**
- Modify: src/style.css
- Modify: src/rogue-ui.js
- Test: tests/rogue-minesweeper.test.js

- [ ] **Step 1: Add scoped responsive styling**

Scope new rules under rogue-view, rogue-board, rogue-tools, rogue-reward, and rogue-result. Reuse existing theme variables and cell dimensions. Style active/disabled tools, neutralized mines, exploded mines, reward cards, result state, focus rings, and mobile one-column layouts. Add reduced-motion handling for tool/reward pulses. Do not change global classic selectors unless the selector is scoped to rogue-view.

- [ ] **Step 2: Run all verification commands**

Run:
~~~text
npm test
node --check src/app.js
node --check src/game.js
node --check src/rogue-game.js
git diff --check
~~~

Expected: all commands exit successfully without warnings or whitespace errors.

- [ ] **Step 3: Repeat manual acceptance**

Verify all existing modes still start and finish. Verify rogue first-click safety, mine damage, shield, defusal kit, scout pulse, energy thresholds, reward selection, five-floor win, zero-life loss, responsive layout, keyboard actions, focus restoration, and accessible labels.

- [ ] **Step 4: Review and commit the final diff**

Run:
~~~text
git status --short
git diff --stat
git diff --check
~~~

Then commit:
~~~text
git add src/style.css src/rogue-ui.js tests/rogue-minesweeper.test.js
git commit -m "style: polish tactical minesweeper feedback"
~~~

- [ ] **Step 5: Report verified completion**

Report exact npm test, syntax-check, and diff-check results; list new rogue modules; state that classic, offset, Hex, ring, Sudoku, Link-Link, and 3D Link-Link behavior was regression-tested.
