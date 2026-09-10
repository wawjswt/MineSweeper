import assert from "node:assert/strict";
import test from "node:test";
import { createRogueRunState } from "../src/rogue-state.js";
import {
  ROGUE_LEVELS,
  createRogueLevel,
  revealRogueFlood,
  placeRogueSpecialCells,
} from "../src/rogue-level.js";
import { getRewardOptions } from "../src/rogue-items.js";
import { createRogueGame } from "../src/rogue-game.js";
import {
  getContractDefinition,
  getContractOptions,
  getContractReward,
} from "../src/rogue-contracts.js";
import {
  buildRogueCellAriaLabel,
  getRogueToolButtonState,
  getRoguePrimaryAction,
  getRogueToolSelectionAfterAction,
  getRogueToolButtonAction,
} from "../src/rogue-ui.js";

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
  assert.deepEqual(state.contractOptions, []);
  assert.equal(state.selectedContract, null);
  assert.equal(state.contractProgress, 0);
  assert.equal(state.contractTarget, 1);
  assert.equal(state.contractCompleted, false);
  assert.equal(state.contractRewardGranted, false);
  assert.deepEqual(state.levelStats, {
    damageTaken: 0,
    safeReveals: 0,
    toolsUsed: {},
    trueMinesDefused: 0,
    shieldedHits: 0,
    specialCellsCollected: 0,
  });
});

test("tactical contract definitions provide stable distinct options and rewards", () => {
  const options = getContractOptions({ floor: 1, rng: () => 0.25 });
  assert.equal(options.length, 2);
  assert.equal(new Set(options.map(({ id }) => id)).size, 2);
  assert.deepEqual(
    ["noDamage", "reconnaissance", "controlledDemolition", "reservePower"].map(
      (id) => getContractDefinition(id)?.id,
    ),
    ["noDamage", "reconnaissance", "controlledDemolition", "reservePower"],
  );
  assert.deepEqual(getContractReward("controlledDemolition"), {
    type: "toolBonus",
    amount: 1,
    toolKey: "defusalKit",
  });
  assert.deepEqual(getContractReward("reservePower"), {
    type: "score",
    amount: 10,
    streakAmount: 1,
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

test("starting a rogue level places one intel and one supply outside the first-click neighborhood", () => {
  const level = createRogueLevel({ floor: 1, safeRow: 3, safeCol: 3, rng: () => 0.25 });
  const specials = level.board.flatMap((row, rowIndex) => row.map((cell, colIndex) => ({
    row: rowIndex,
    col: colIndex,
    cell,
  }))).filter(({ cell }) => cell.special);
  assert.deepEqual(specials.map(({ cell }) => cell.special).sort(), ["intel", "supply"]);
  for (const { row, col, cell } of specials) {
    assert.equal(cell.mine, false);
    assert.equal(Math.abs(row - 3) <= 1 && Math.abs(col - 3) <= 1, false);
    assert.equal(cell.specialCollected, false);
  }
});

test("rogue flood reveal visits each safe cell once", () => {
  const board = [
    [
      { mine: false, revealed: false, flagged: false, count: 0 },
      { mine: false, revealed: false, flagged: false, count: 0 },
      { mine: true, revealed: false, flagged: false, count: 0 },
    ],
    [
      { mine: false, revealed: false, flagged: false, count: 0 },
      { mine: false, revealed: false, flagged: false, count: 0 },
      { mine: false, revealed: false, flagged: false, count: 1 },
    ],
  ];
  assert.equal(revealRogueFlood(board, 0, 0, 2, 3), 5);
  assert.equal(board.flat().filter((cell) => cell.revealed).length, 5);
});

test("rogue flood reveal reports each newly revealed special cell once", () => {
  const board = [
    [
      { mine: false, revealed: false, flagged: false, count: 0, special: "intel" },
      { mine: false, revealed: false, flagged: false, count: 0 },
      { mine: true, revealed: false, flagged: false, count: 0 },
    ],
    [
      { mine: false, revealed: false, flagged: false, count: 0 },
      { mine: false, revealed: false, flagged: false, count: 0, special: "supply" },
      { mine: false, revealed: false, flagged: false, count: 1 },
    ],
  ];
  const revealed = [];
  assert.equal(revealRogueFlood(board, 0, 0, 2, 3, (cell, row, col) => {
    revealed.push({ special: cell.special ?? null, row, col });
  }), 5);
  assert.equal(revealed.length, 5);
  assert.deepEqual(revealed.filter(({ special }) => special).map(({ special }) => special).sort(), ["intel", "supply"]);
  assert.equal(new Set(revealed.map(({ row, col }) => `${row},${col}`)).size, revealed.length);
});

function makeKnownLevel(game) {
  const state = game.getState();
  state.level = {
    floor: 1,
    rows: 2,
    cols: 3,
    mines: 1,
    started: true,
    ended: false,
    board: [
      [
        { mine: false, revealed: true, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
        { mine: true, revealed: false, flagged: true, questioned: false, exploded: false, neutralized: false, count: 0 },
        { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
      ],
      [
        { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
        { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
        { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 0 },
      ],
    ],
    safeCellsRemaining: 4,
    activeToolUses: { scoutPulse: 1, defusalKit: 1, reactionShield: 1 },
    shieldActive: false,
  };
  state.contractOptions = [];
  state.selectedContract = "noDamage";
  state.contractProgress = 0;
  state.contractTarget = 1;
  state.contractCompleted = false;
  state.contractRewardGranted = false;
  state.levelStats = {
    damageTaken: 0,
    safeReveals: 0,
    toolsUsed: {},
    trueMinesDefused: 0,
    shieldedHits: 0,
    specialCellsCollected: 0,
  };
  state.status = "playing";
  return state;
}

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

test("reward choices are distinct with an injected rng", () => {
  const options = getRewardOptions({ ownedUpgrades: [], rng: () => 0.1 });
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map((option) => option.id)).size, 3);
});

test("stepping on a mine costs one life and neutralizes it", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.level.board[0][1].flagged = false;
  const livesBefore = state.lives;
  assert.equal(game.reveal(0, 1), "hit");
  assert.equal(state.lives, livesBefore - 1);
  assert.equal(state.level.board[0][1].neutralized, true);
  assert.equal(state.level.board[0][1].exploded, true);
  assert.equal(game.reveal(0, 1), "continue");
  assert.equal(state.lives, livesBefore - 1);
});

test("reaction shield absorbs the next mine hit without costing life", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.level.board[0][1].flagged = false;
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
  state.level.board[0][1].flagged = false;
  state.lives = 1;
  assert.equal(game.reveal(0, 1), "lose");
  assert.equal(state.status, "lost");
  assert.equal(game.cycleMark(1, 1), "invalid");
  assert.equal(game.selectTool("scoutPulse"), false);
  assert.equal(game.chooseReward("medical"), "invalid");
});

test("four separate safe reveals grant one energy without exceeding the cap", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = game.getState();
  state.status = "playing";
  state.level = {
    floor: 1,
    rows: 1,
    cols: 6,
    mines: 1,
    started: true,
    ended: false,
    board: [[
      { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
      { mine: true, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 0 },
      { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
      { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
      { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
      { mine: false, revealed: false, flagged: false, questioned: false, exploded: false, neutralized: false, count: 1 },
    ]],
    safeCellsRemaining: 5,
    activeToolUses: { scoutPulse: 1, defusalKit: 1, reactionShield: 1 },
    shieldActive: false,
  };
  state.contractOptions = [];
  state.selectedContract = "noDamage";
  state.contractProgress = 0;
  state.contractTarget = 1;
  state.contractCompleted = false;
  state.contractRewardGranted = false;
  state.levelStats = {
    damageTaken: 0,
    safeReveals: 0,
    toolsUsed: {},
    trueMinesDefused: 0,
    shieldedHits: 0,
    specialCellsCollected: 0,
  };

  for (const col of [0, 2, 3, 4]) assert.equal(game.reveal(0, col), "continue");
  assert.equal(state.energy, state.maxEnergy);
  assert.equal(state.safeRevealStreak, 0);
});

test("defusal kit removes a false flag and reveals its safe cell", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.level.board[0][2].flagged = true;
  assert.equal(game.selectTool("defusalKit"), true);
  assert.equal(game.useSelectedTool(0, 2), "continue");
  assert.equal(state.level.board[0][2].flagged, false);
  assert.equal(state.level.board[0][2].revealed, true);
  assert.equal(state.energy, 0);
});

test("invalid tool targets do not consume energy or uses", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  const before = JSON.stringify(state.level.board);
  assert.equal(game.selectTool("scoutPulse"), true);
  assert.equal(game.useSelectedTool(0, 0), "invalid");
  assert.equal(state.energy, 2);
  assert.equal(state.level.activeToolUses.scoutPulse, 1);
  assert.equal(JSON.stringify(state.level.board), before);
});

test("clearing a level opens rewards and choosing one starts the next floor", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.level.safeCellsRemaining = 1;
  state.level.board[0][2].count = 1;
  const result = game.reveal(0, 2);
  assert.equal(result, "reward");
  assert.equal(state.status, "reward");
  assert.equal(state.rewardOptions.length, 3);
  const selected = state.rewardOptions[0].id;
  assert.equal(game.chooseReward(selected), "continue");
  assert.equal(state.floor, 2);
  assert.equal(state.status, "ready");
  assert.equal(state.rewardOptions.length, 0);
  assert.equal(state.upgrades.includes(selected), true);
  assert.equal(state.contractOptions.length, 2);
  assert.equal(new Set(state.contractOptions.map(({ id }) => id)).size, 2);
  assert.equal(state.selectedContract, null);
  assert.equal(state.contractProgress, 0);
  assert.equal(state.contractCompleted, false);
  assert.equal(state.contractRewardGranted, false);
  assert.deepEqual(state.levelStats, {
    damageTaken: 0,
    safeReveals: 0,
    toolsUsed: {},
    trueMinesDefused: 0,
    shieldedHits: 0,
    specialCellsCollected: 0,
  });
});

test("a completed no-damage contract grants its energy reward once", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.energy = 1;
  state.level.safeCellsRemaining = 1;
  state.level.board[0][2].count = 1;
  const scoreBefore = state.score;
  assert.equal(game.reveal(0, 2), "reward");
  assert.equal(state.contractCompleted, true);
  assert.equal(state.contractRewardGranted, true);
  assert.equal(state.contractProgress, 1);
  assert.equal(state.energy, 2);
  assert.equal(state.score, scoreBefore + 11);
  assert.match(state.notice, /零误触/);
});

test("a completed reserve-power contract grants score and streak reward", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.selectedContract = "reservePower";
  state.energy = 1;
  state.level.safeCellsRemaining = 1;
  state.level.board[0][2].count = 1;
  const scoreBefore = state.score;
  assert.equal(game.reveal(0, 2), "reward");
  assert.equal(state.contractCompleted, true);
  assert.equal(state.contractRewardGranted, true);
  assert.equal(state.contractProgress, 1);
  assert.equal(state.score, scoreBefore + 21);
  assert.equal(state.safeRevealStreak, 2);
});

test("clearing the fifth level wins the run", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = makeKnownLevel(game);
  state.floor = 5;
  state.level.floor = 5;
  state.level.safeCellsRemaining = 1;
  state.level.board[0][2].count = 1;
  assert.equal(game.reveal(0, 2), "win");
  assert.equal(state.status, "won");
  assert.equal(state.level.ended, true);
});

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

test("rogue mark mode routes primary clicks to the mark action", () => {
  assert.equal(getRoguePrimaryAction({ markMode: "mark", selectedTool: null, revealed: false }), "mark");
  assert.equal(getRoguePrimaryAction({ markMode: "reveal", selectedTool: null, revealed: false }), "reveal");
  assert.equal(getRoguePrimaryAction({ markMode: "reveal", selectedTool: null, revealed: true }), "chord");
  assert.equal(getRoguePrimaryAction({ markMode: "reveal", selectedTool: "scoutPulse", revealed: false }), "tool");
});

test("successful tool use clears the UI tool selection", () => {
  assert.equal(getRogueToolSelectionAfterAction("scoutPulse", "continue"), null);
  assert.equal(getRogueToolSelectionAfterAction("scoutPulse", "invalid"), "scoutPulse");
});

test("clicking the selected rogue tool toggles it off", () => {
  assert.equal(getRogueToolButtonAction("scoutPulse", "scoutPulse"), "cancel");
  assert.equal(getRogueToolButtonAction("scoutPulse", "defusalKit"), "select");
  assert.equal(getRogueToolButtonAction(null, "scoutPulse"), "select");
});
