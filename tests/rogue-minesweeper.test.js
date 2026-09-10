import assert from "node:assert/strict";
import test from "node:test";
import { createRogueRunState } from "../src/rogue-state.js";
import {
  ROGUE_LEVELS,
  createRogueLevel,
  revealRogueFlood,
} from "../src/rogue-level.js";
import { getRewardOptions } from "../src/rogue-items.js";
import { createRogueGame } from "../src/rogue-game.js";
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
  state.status = "playing";
  return state;
}

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
