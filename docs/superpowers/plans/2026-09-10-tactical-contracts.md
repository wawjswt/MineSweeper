# 战术扫雷任务契约 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有五层战术扫雷中加入每层二选一任务契约、契约奖励、情报点、补给点和现有道具联动，同时保持经典及其他玩法不变。

**Architecture:** 保留现有 `rogue` 控制器和五层流程，在状态中增加当前层契约与统计数据；用独立纯模块定义契约，用关卡模块放置特殊格，用控制器处理事件和奖励，用现有 `rogue-ui` 渲染契约和特殊格。顶层 `status` 继续使用 `ready`、`playing`、`reward`、`won`、`lost`，用 `selectedContract` 区分 `ready` 的待选择和可操作状态。

**Tech Stack:** 原生 JavaScript ESM、Node.js `node:test`、现有静态 HTML/CSS、现有 `rogue-game.js` / `rogue-level.js` / `rogue-ui.js` 模块。

**Spec:** `docs/superpowers/specs/2026-09-10-tactical-contracts-design.md`

## Global Constraints

- 只改 `rogue` 模式；经典扫雷、偏移、Hex、环形、数独、连连看和 3D 连连看行为保持不变。
- 保留五层、生命、能量、三个现有工具和关卡结束后三选一强化。
- 每层只能选择一个契约；契约奖励最多结算一次。
- 每层提供两个不同契约；使用注入 RNG 时顺序稳定。
- 特殊格永远不是雷，不参与数字线索计算，不移动雷。
- 特殊格默认不放在首点及八邻域；候选不足时允许该类特殊格缺席，关卡仍必须可玩。
- 无效操作不消耗能量、工具次数、生命或契约进度。
- 不加入动态重新布雷、商店、金币、地图分支、Boss、持久化、种子、回放或概率提示。
- 所有新增生产代码先有会失败的测试；每个任务完成后运行该任务测试和必要的回归测试。
- 每个任务完成后使用独立提交，提交前执行 `git diff --check`。

---

### Task 1: Add pure contract definitions and run-state fields

**Files:**
- Create: `src/rogue-contracts.js`
- Modify: `src/rogue-state.js:1-80`
- Test: `tests/rogue-minesweeper.test.js`

**Interfaces:**
- `getContractDefinition(contractId)` returns a cloned definition or `null`.
- `getContractOptions({ floor, rng })` returns two cloned definitions with `id`, `label`, `description`, `target`, `progressLabel`, and `reward`.
- `getContractReward(contractId)` returns a cloned `{ type, amount, toolKey?, streakAmount? }` reward.
- `createRogueRunState()` adds the contract fields and zeroed `levelStats` described in the approved spec.

- [ ] **Step 1: Write the failing tests**

Add tests that assert two deterministic distinct options, the four IDs `noDamage`, `reconnaissance`, `controlledDemolition`, `reservePower`, the `controlledDemolition` reward `{ type: "toolBonus", amount: 1, toolKey: "defusalKit" }`, and the exact zeroed `levelStats` object.

- [ ] **Step 2: Verify RED**

Run `node --test tests/rogue-minesweeper.test.js`. It must fail because `src/rogue-contracts.js` does not exist.

- [ ] **Step 3: Implement the pure definitions**

Create immutable definitions with `target: 1` and these exact progress labels and meanings: `noDamage` uses `保持无伤`, means clear the level without losing life, and rewards one energy; `reconnaissance` uses `回收情报点`, means trigger or scan an intel cell, and rewards one next-level scout use; `controlledDemolition` uses `拆除真雷`, means successfully defuse one true mine, and rewards one next-level defusal use; `reservePower` uses `保留能量`, means clear the level with at least one energy, and rewards 10 score plus one safe-reveal streak. Represent the latter as `{ type: "score", amount: 10, streakAmount: 1 }` so the controller can apply both effects while keeping the reward shape declarative. Use copied arrays and Fisher–Yates with the injected RNG.

- [ ] **Step 4: Add state defaults**

Add `contractOptions: []`, `selectedContract: null`, `contractProgress: 0`, `contractTarget: 1`, `contractCompleted: false`, `contractRewardGranted: false`, and `levelStats` containing `damageTaken`, `safeReveals`, `toolsUsed`, `trueMinesDefused`, `shieldedHits`, and `specialCellsCollected`.

- [ ] **Step 5: Verify and commit**

Run the focused rogue test; all new and existing rogue tests must pass. Then stage `src/rogue-contracts.js`, `src/rogue-state.js`, and `tests/rogue-minesweeper.test.js`, run `git diff --check`, and commit with `feat: add tactical contract definitions`.

### Task 2: Add special-cell data and safe placement

**Files:**
- Modify: `src/rogue-state.js:1-80`
- Modify: `src/rogue-level.js:1-120`
- Test: `tests/rogue-minesweeper.test.js`

**Interfaces:**
- `placeRogueSpecialCells({ board, rows, cols, safeRow, safeCol, rng })` mutates only eligible safe cells and returns `{ intel, supply }` coordinates.
- `revealRogueFlood(board, row, col, rows, cols, onReveal)` accepts an optional callback called once after each newly revealed safe cell.
- Empty cells include `special: null` and `specialCollected: false`.

- [ ] **Step 1: Write the failing tests**

Test that a generated first-click level has one intel and one supply cell, both non-mine and outside the first-click neighborhood. Test that a flood callback receives each newly revealed cell exactly once and sees both special types when the fixture reveals them.

- [ ] **Step 2: Verify RED**

Run `node --test tests/rogue-minesweeper.test.js`. It must fail because the fields, placement helper, and callback are missing.

- [ ] **Step 3: Implement cell fields and placement**

Add both fields to `createRogueEmptyCell()` and preserve them when normalizing generated cells. Build candidates from non-mine cells, exclude rows and columns within one of the first click, shuffle using the injected RNG, and assign at most one of each type after board generation. If the exclusion leaves too few candidates, use all safe cells.

- [ ] **Step 4: Add the flood callback**

After a safe cell is marked revealed, invoke `onReveal?.(cell, currentRow, currentCol)`. Keep the existing index-pointer queue and skip rules; never invoke the callback for mines, flagged cells, or the same cell twice.

- [ ] **Step 5: Verify and commit**

Run `node --test tests/rogue-minesweeper.test.js`, execute `git diff --check`, and commit the three changed files with `feat: add tactical special cells`.

### Task 3: Add contract selection, progress, and rewards to the controller

**Files:**
- Modify: `src/rogue-game.js:1-320`
- Test: `tests/rogue-minesweeper.test.js`

**Interfaces:**
- Add `selectContract(contractId)` to the object returned by `createRogueGame`.
- `selectContract` returns `"continue"` only for a valid pending option and `"invalid"` otherwise.
- Reset and next-level creation each produce two pending options and zero the current-level contract fields and `levelStats`.
- Existing action return values remain `continue`, `hit`, `reward`, `win`, `lose`, or `invalid`.

- [ ] **Step 1: Make direct controller fixtures explicit**

Update `makeKnownLevel(game)` to set `selectedContract = "noDamage"`, clear `contractOptions`, set progress and target to `0` and `1`, set both contract booleans false, and install the zeroed `levelStats` object from Task 1. This keeps deterministic playing-state fixtures valid while real runs require a selection.

- [ ] **Step 2: Write the failing controller-flow tests**

Add tests asserting: a fresh run has two options and blocks reveal, mark, and tool selection; selecting one option returns `continue` and enables the first reveal; clearing a known level and choosing the ordinary reward creates a fresh pair of pending options.

Use this core fixture shape for the new assertions:

```js
test("rogue actions are blocked until a contract is selected", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = game.getState();
  const before = JSON.stringify(state);
  assert.equal(state.contractOptions.length, 2);
  assert.equal(game.reveal(0, 0), "invalid");
  assert.equal(game.cycleMark(0, 0), "invalid");
  assert.equal(game.selectTool("scoutPulse"), false);
  assert.equal(JSON.stringify(state), before);
});

test("selecting a pending contract enables the first reveal", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const id = game.getState().contractOptions[0].id;
  assert.equal(game.selectContract(id), "continue");
  assert.equal(game.getState().selectedContract, id);
  assert.equal(game.reveal(0, 0), "continue");
  assert.equal(game.getState().status, "playing");
});
```

- [ ] **Step 3: Verify RED**

Run `node --test tests/rogue-minesweeper.test.js`. It must fail because options and `selectContract` are not implemented and pre-selection actions are not guarded.

- [ ] **Step 4: Initialize options and implement selection**

Import `getContractOptions` and `getContractDefinition`. Create a helper that resets current-level contract fields, call it from `reset()` and `chooseReward()` after creating the level, and implement:

```js
function selectContract(contractId) {
  if (currentState.status !== "ready") return "invalid";
  if (!currentState.contractOptions.some(({ id }) => id === contractId)) return "invalid";
  currentState.selectedContract = contractId;
  currentState.contractOptions = [];
  currentState.contractProgress = 0;
  currentState.contractCompleted = false;
  currentState.contractRewardGranted = false;
  currentState.notice = `已选择契约「${getContractDefinition(contractId).label}」。`;
  return "continue";
}
```

At the start of `reveal`, `cycleMark`, and `chord`, return `"invalid"` while `selectedContract === null`. Keep tools blocked until `status === "playing"`, so the first reveal after selection retains the existing first-click generation.

- [ ] **Step 5: Add event accounting and completion checks**

Record safe reveals, life-losing damage, shielded hits, successful tool uses, true-mine defusals, and special collections in `levelStats`. Complete `controlledDemolition` after true-mine defusal and `reconnaissance` after intel collection. At level clear, complete `noDamage` when `damageTaken === 0` and `reservePower` when energy is at least 1. Apply each reward once before entering the ordinary `reward` or `won` state, including `streakAmount` on the reserve-power reward.

- [ ] **Step 6: Verify and commit**

Run `node --test tests/rogue-minesweeper.test.js` and `npm test`. Stage `src/rogue-game.js` and `tests/rogue-minesweeper.test.js`, run `git diff --check`, and commit with `feat: add tactical contract flow`.

### Task 4: Implement special effects and tool-contract linkage

**Files:**
- Modify: `src/rogue-game.js:1-350`
- Test: `tests/rogue-minesweeper.test.js`

**Interfaces:**
- Special effects are observable through `state.notice`, `specialCollected`, energy, tool uses, and contract fields.
- Direct reveal, flood reveal, and the relevant tool path collect a special cell at most once.
- Invalid tool targets preserve all existing resource guarantees.

- [ ] **Step 1: Write the failing linkage tests**

Add deterministic tests with explicit special cells for these behaviors: revealing an intel cell reports a clipped 3×3 scan and completes reconnaissance; revealing a supply cell adds one energy and recharges the least-used tool; scouting an intel cell consumes normal scout resources and completes reconnaissance without revealing it; defusing a true mine completes controlled demolition.

Use this assertion pattern for the supply priority:

```js
state.energy = 0;
state.level.activeToolUses = { scoutPulse: 0, defusalKit: 1, reactionShield: 1 };
state.level.board[1][2].special = "supply";
assert.equal(game.reveal(1, 2), "continue");
assert.equal(state.energy, 1);
assert.deepEqual(state.level.activeToolUses, {
  scoutPulse: 1,
  defusalKit: 1,
  reactionShield: 1,
});
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/rogue-minesweeper.test.js`. It must fail because special collection and tool linkage are missing.

- [ ] **Step 3: Implement one-time collection and effects**

Add `collectSpecialCell(cell, row, col)` in the controller. Ignore null or already-collected cells; otherwise mark the cell collected and increment `specialCellsCollected`. Intel reports the clipped 3×3 mine count and may complete reconnaissance. Supply adds one energy up to the cap and recharges the tool with the fewest remaining uses, using fixed tie order scout, defusal, shield.

- [ ] **Step 4: Connect all reveal paths**

Pass an `onReveal` callback to `revealRogueFlood` from `reveal()` and the safe branch of `chord()`. The callback calls `collectSpecialCell`; a flood crossing both special types must trigger each exactly once.

- [ ] **Step 5: Connect scout and defusal events**

When scout targets an intel cell, retain normal scout cost and use consumption, mark the intel cell collected without revealing it, and complete reconnaissance. When defusal neutralizes a true mine, increment `trueMinesDefused` and complete controlled demolition. Invalid targets consume no resources.

- [ ] **Step 6: Verify and commit**

Run the focused rogue tests and `npm test`, then stage `src/rogue-game.js` and `tests/rogue-minesweeper.test.js`, run `git diff --check`, and commit with `feat: link tactical contracts to special cells and tools`.

### Task 5: Add contract and special-cell UI without changing classic routing

**Files:**
- Modify: `index.html:170-260`
- Modify: `src/app.js:1-470`
- Modify: `src/rogue-ui.js:1-350`
- Test: `tests/rogue-minesweeper.test.js`

**Interfaces:**
- `buildRogueCellAriaLabel(cell, row, col)` includes special and collected states.
- `getRogueContractButtonState({ selected, disabled })` returns `{ pressed, ariaDisabled }`.
- `createRogueUI` renders pending cards, active progress, special-cell classes/icons, and disabled cells before contract selection.
- `rogueHandlers` gains `onSelectContract(contractId)`; classic handlers remain unchanged.

- [ ] **Step 1: Write the failing UI helper tests**

Add tests that require an unrevealed intel label to contain coordinates, `情报点`, and `未揭开`; require a collected supply label to contain `补给点` and `已收集`; and require `getRogueContractButtonState({ selected: true, disabled: false })` to return `{ pressed: true, ariaDisabled: false }`.

- [ ] **Step 2: Verify RED**

Run `node --test tests/rogue-minesweeper.test.js`. It must fail because special-cell labels and the contract helper are not implemented.

- [ ] **Step 3: Add contract containers**

Inside `rogueView`, before the tools, add a section with IDs `rogueContractPanel`, `rogueContractTitle`, `rogueContractOptions`, and `rogueContractProgress`; the progress container uses `aria-live="polite"`. Keep the existing HUD, tools, board, reward, and result containers intact.

- [ ] **Step 4: Implement labels, cards, and special classes**

Build labels in this order: coordinates, flag/question, special and collected state, revealed/unrevealed state, then number/mine state. Render two pending options as keyboard-accessible buttons with `data-contract-id`, title, description, progress, and reward. Add `rogue-cell--intel`, `rogue-cell--supply`, and `rogue-cell--collected` classes.

- [ ] **Step 5: Disable only the correct controls**

Disable rogue cells when no contract is selected, the level ended, or status is `reward`, `won`, or `lost`. Leave cells enabled in `ready` after selection so the first reveal works. Keep tools disabled until `playing`. Bind contract-card clicks to `onSelectContract`, clear transient tool selection, and restore board focus after rendering.

- [ ] **Step 6: Wire `app.js` without changing classic behavior**

Add the three contract element references and the handler `onSelectContract: (contractId) => rogueGame.selectContract(contractId)`. Pass updated state and handlers through `renderRogue()`. Do not route classic actions through `rogueGame` or change classic timer, hint, best-score, or mode-switch functions.

- [ ] **Step 7: Verify and commit**

Run `node --test tests/rogue-minesweeper.test.js`, `npm test`, and a local `python -m http.server 8080`. In the browser verify pending cards, selection, disabled pre-selection board, first reveal, special labels/effects, progress updates, and all existing game-mode controls. Stage `index.html`, `src/app.js`, `src/rogue-ui.js`, and the rogue test, run `git diff --check`, and commit with `feat: add tactical contract and special-cell UI`.

### Task 6: Add scoped responsive styling and final regression coverage

**Files:**
- Modify: `src/style.css:1-950`
- Modify: `src/rogue-ui.js:1-350`
- Test: `tests/rogue-minesweeper.test.js`

**Interfaces:**
- Produces responsive contract cards, special-cell visual states, completion feedback, focus rings, and reduced-motion behavior.
- New selectors are scoped to `#rogueView`, `.rogue-view`, `.rogue-board`, `.rogue-tools`, `.rogue-reward`, or `.rogue-result`.

- [ ] **Step 1: Write the failing presentation-state test**

Add an exported pure `getRogueSpecialCellClasses(cell)` helper and test that an uncollected intel cell returns `["rogue-cell--intel"]`, a collected supply cell returns `["rogue-cell--supply", "rogue-cell--collected"]`, and a cell with no special returns `[]`.

- [ ] **Step 2: Verify RED**

Run `node --test tests/rogue-minesweeper.test.js`. It must fail because `getRogueSpecialCellClasses` is missing.

- [ ] **Step 3: Implement the helper and use it in the renderer**

Return the special type class for `intel` or `supply`, append `rogue-cell--collected` only when collected, and use the helper result in the cell renderer rather than duplicating the conditions.

- [ ] **Step 4: Add scoped responsive styles**

Style desktop two-column and mobile one-column contract cards, selected/disabled states, progress text, blue intel cells, gold supply cells, subdued collected cells, focus rings, disabled pre-selection cells, and `@media (prefers-reduced-motion: reduce)` behavior. Do not alter global classic selectors.

- [ ] **Step 5: Run final verification and manual acceptance**

Run `npm test`, `node --check src/app.js`, `node --check src/game.js`, `node --check src/rogue-game.js`, `node --check src/rogue-level.js`, `node --check src/rogue-ui.js`, and `git diff --check`. Manually verify both contract choices, all four completion conditions, one-time rewards, intel scan, supply recharge, scout/defusal linkage, win/loss/reset, mode switching, and every existing non-rogue mode.

- [ ] **Step 6: Review and commit the final slice**

Run `git status --short`, `git diff --stat`, and `git diff --check`; then stage `src/style.css`, `src/rogue-ui.js`, and the rogue test and commit with `style: polish tactical contract feedback`.

## Final delivery checklist

- [ ] Implementation matches the approved spec and does not add dynamic re-mining, stores, map branches, persistence, seeds, replay, or probability hints.
- [ ] `npm test`, all syntax checks, and `git diff --check` pass.
- [ ] Final branch status and commit list are reported before any optional push or PR action.
