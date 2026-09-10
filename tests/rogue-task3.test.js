import assert from "node:assert/strict";
import test from "node:test";
import { createRogueEmptyCell } from "../src/rogue-state.js";
import {
  assignRogueSectorIds,
  calculateRogueSectorStats,
  createRogueSectors,
} from "../src/rogue-sectors.js";
import { createRogueLevel } from "../src/rogue-level.js";
import { createRogueGame } from "../src/rogue-game.js";
import { getContractDefinition } from "../src/rogue-contracts.js";

function makeRouteLevel({ rows = 3, cols = 6, mines = [] } = {}) {
  const sectors = createRogueSectors({ cols, rng: () => 0.25 });
  const mineKeys = new Set(mines.map(([row, col]) => `${row},${col}`));
  const board = Array.from({ length: rows }, (_, row) => (
    Array.from({ length: cols }, (_, col) => ({
      ...createRogueEmptyCell(),
      count: 1,
      mine: mineKeys.has(`${row},${col}`),
    }))
  ));
  for (const [row, col] of mines) board[row][col].count = 0;
  const assignedBoard = assignRogueSectorIds(board, sectors);
  const currentSectors = calculateRogueSectorStats({ board: assignedBoard, sectors });
  return {
    floor: 1,
    rows,
    cols,
    mines: mines.length,
    board: assignedBoard,
    started: true,
    ended: false,
    generationMode: "standard",
    generationFallback: false,
    sectors: currentSectors,
    safeCellsRemaining: assignedBoard.flat().filter((cell) => !cell.mine).length,
    activeToolUses: { scoutPulse: 1, defusalKit: 1, reactionShield: 1 },
    shieldActive: false,
  };
}

function installRouteLevel(game, contractId, options = {}) {
  const state = game.getState();
  const definition = getContractDefinition(contractId);
  state.level = makeRouteLevel(options);
  state.status = "playing";
  state.contractOptions = [];
  state.selectedContract = contractId;
  state.contractProgress = 0;
  state.contractTarget = definition.target;
  state.contractCompleted = false;
  state.contractRewardGranted = false;
  state.contractFailed = false;
  state.contractFailureReason = "";
  state.contractPenaltyApplied = false;
  state.contractContext = {
    intelSectorId: null,
    supplySectorId: null,
    firstCrossFireEvent: null,
    insertionQualifiedSectors: [],
  };
  state.levelStats = {
    damageTaken: 0,
    safeReveals: 0,
    toolsUsed: {},
    trueMinesDefused: 0,
    shieldedHits: 0,
    specialCellsCollected: 0,
  };
  return state;
}

function revealCells(game, coordinates) {
  let result = "continue";
  for (const [row, col] of coordinates) result = game.reveal(row, col);
  return result;
}

test("first tactical click reuses the visible sectors and refreshes their reveal statistics", () => {
  const calls = [];
  const game = createRogueGame({
    rng: () => 0.25,
    levelFactory: (options) => {
      calls.push(options);
      return createRogueLevel(options);
    },
  });
  const state = game.getState();
  const before = state.level.sectors.map(({ startCol, endColExclusive }) => ({ startCol, endColExclusive }));
  const contractId = state.contractOptions[0].id;

  assert.equal(game.selectContract(contractId), "continue");
  assert.equal(game.reveal(0, 0), "continue");
  assert.deepEqual(
    calls[1].sectors.map(({ startCol, endColExclusive }) => ({ startCol, endColExclusive })),
    before,
  );
  assert.equal(
    state.level.sectors.reduce((total, sector) => total + sector.revealedSafeCells, 0),
    state.level.board.flat().filter((cell) => cell.revealed && !cell.mine).length,
  );
});

test("false-flag defusal refreshes the sector reveal statistics", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "noDamage");
  const target = state.level.board[0][2];
  target.flagged = true;
  assert.equal(game.selectTool("defusalKit"), true);
  assert.equal(game.useSelectedTool(0, 2), "continue");
  assert.equal(
    state.level.sectors.reduce((total, sector) => total + sector.revealedSafeCells, 0),
    1,
  );
});

test("intel relay requires collection before a tool in another sector", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "intelRelay", { rows: 2 });
  state.level.board[0][0].special = "intel";

  assert.equal(game.reveal(0, 0), "continue");
  assert.equal(state.contractProgress, 1);
  assert.equal(state.contractCompleted, false);
  assert.equal(state.contractContext.intelSectorId, 0);

  assert.equal(game.selectTool("scoutPulse"), true);
  assert.equal(game.useSelectedTool(0, 5), "continue");
  assert.equal(state.contractProgress, 2);
  assert.equal(state.contractCompleted, true);
  assert.equal(state.nextLevelToolBonus.scoutPulse, 1);
});

test("supply relay accepts tool-triggered collection but requires a later safe reveal in another sector", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "supplyRelay", { rows: 2 });
  state.level.board[0][0].special = "supply";

  assert.equal(game.selectTool("scoutPulse"), true);
  assert.equal(game.useSelectedTool(0, 0), "continue");
  assert.equal(state.level.board[0][0].specialCollected, true);
  assert.equal(state.contractProgress, 1);

  assert.equal(game.reveal(1, 1), "continue");
  assert.equal(state.contractProgress, 1);
  assert.equal(game.reveal(0, 5), "continue");
  assert.equal(state.contractProgress, 2);
  assert.equal(state.contractCompleted, true);
  assert.equal(state.nextLevelToolBonus.reactionShield, 1);
});

test("cross fire requires two tools acting in two distinct sectors", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "crossFire", { rows: 2, mines: [[0, 5]] });
  state.energy = 5;
  state.maxEnergy = 5;
  state.level.board[0][5].flagged = true;

  assert.equal(game.selectTool("scoutPulse"), true);
  assert.equal(game.useSelectedTool(0, 0), "continue");
  assert.equal(state.contractProgress, 1);
  assert.equal(game.selectTool("defusalKit"), true);
  assert.equal(game.useSelectedTool(0, 5), "continue");
  assert.equal(state.contractProgress, 2);
  assert.equal(state.contractCompleted, true);
  assert.equal(state.nextLevelToolBonus.defusalKit, 1);
});

test("global reaction shield does not pretend to act in the clicked sector", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "crossFire", { rows: 2 });

  assert.equal(game.selectTool("reactionShield"), true);
  assert.equal(game.useSelectedTool(0, 5), "continue");
  assert.equal(state.contractProgress, 0);
  assert.equal(state.contractContext.firstCrossFireEvent, null);
});

test("safe insertion qualifies two sectors before actual damage and grants score", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "safeInsertion");
  const firstSector = [[0, 0], [1, 0], [2, 0]];
  const secondSector = [[0, 2], [1, 2], [2, 2]];

  assert.equal(revealCells(game, firstSector), "continue");
  assert.equal(state.contractProgress, 1);
  assert.deepEqual(state.contractContext.insertionQualifiedSectors, [0]);
  assert.equal(revealCells(game, secondSector), "continue");
  assert.equal(state.contractProgress, 2);
  assert.equal(state.contractCompleted, true);
  assert.equal(state.contractFailed, false);
  assert.equal(state.score, 21);
});

test("a shielded mine hit does not fail safe insertion, but actual damage does", () => {
  const shieldedGame = createRogueGame({ rng: () => 0.25 });
  const shieldedState = installRouteLevel(shieldedGame, "safeInsertion", { rows: 2, mines: [[0, 5]] });
  assert.equal(shieldedGame.selectTool("reactionShield"), true);
  assert.equal(shieldedGame.useSelectedTool(), "continue");
  assert.equal(shieldedGame.reveal(0, 5), "hit");
  assert.equal(shieldedState.levelStats.damageTaken, 0);
  assert.equal(shieldedState.contractFailed, false);

  const damagedGame = createRogueGame({ rng: () => 0.25 });
  const damagedState = installRouteLevel(damagedGame, "safeInsertion", { rows: 2, mines: [[0, 5]] });
  assert.equal(damagedGame.reveal(0, 5), "hit");
  assert.equal(damagedState.levelStats.damageTaken, 1);
  assert.equal(damagedState.contractFailed, true);
  assert.match(damagedState.contractFailureReason, /受伤|生命/);
});

test("an incomplete contract costs at most one energy while the level still advances", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "intelRelay", { rows: 1 });
  state.energy = 0;
  const result = revealCells(game, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]);

  assert.equal(result, "reward");
  assert.equal(state.status, "reward");
  assert.equal(state.energy, 0);
  assert.equal(state.contractFailed, true);
  assert.equal(state.contractPenaltyApplied, true);
  assert.match(state.notice, /未完成|能量/);
});

test("reset and a lost run do not apply the level-clear contract penalty", () => {
  const game = createRogueGame({ rng: () => 0.25 });
  const state = installRouteLevel(game, "intelRelay", { rows: 1, mines: [[0, 5]] });
  state.energy = 2;
  state.lives = 1;
  assert.equal(game.reveal(0, 5), "lose");
  assert.equal(state.energy, 2);
  assert.equal(state.contractPenaltyApplied, false);

  game.reset();
  assert.equal(game.getState().energy, 2);
  assert.equal(game.getState().contractPenaltyApplied, false);
});
