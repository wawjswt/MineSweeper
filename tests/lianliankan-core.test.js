import test from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  LLK3D_DIFFICULTIES,
  count3DRemaining,
  countRemaining,
  createChallengeState,
  find3DAnyPair,
  find3DPath,
  findAnyPair,
  findPath,
  make3DBoard,
  makeBoard,
  reshuffle3D,
  consumeChallengeResource,
} from "../src/core/games/lianliankan/engine.js";

test("Link-Link core creates a valid 2D board with an available pair", () => {
  const config = DIFFICULTIES.easy;
  const board = makeBoard(config.rows, config.cols, config.kinds, () => 0.25);

  assert.equal(board.grid.length, config.rows * config.cols);
  assert.equal(countRemaining(board.grid), board.grid.length);
  assert.notEqual(findAnyPair(board.grid, board.rows, board.cols), null);
  assert.equal(findPath(board.grid, board.rows, board.cols, { r: 0, c: 0 }, { r: 0, c: 1 })?.length >= 2, true);
});

test("Link-Link challenge resources update immutably", () => {
  const initial = createChallengeState({ timeLimitSeconds: 90, hintLimit: 1, shuffleLimit: 0 });
  const consumed = consumeChallengeResource(initial, "hint");

  assert.deepEqual(initial, { timeLimitSeconds: 90, hintsRemaining: 1, shufflesRemaining: 0 });
  assert.deepEqual(consumed, {
    ok: true,
    state: { timeLimitSeconds: 90, hintsRemaining: 0, shufflesRemaining: 0 },
  });
});

test("Link-Link core creates a valid 3D surface board with a movable pair", () => {
  const config = LLK3D_DIFFICULTIES.easy;
  let seed = 0x12345678;
  const rng = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const board = make3DBoard(config.size, config.kinds, rng);

  assert.equal(count3DRemaining(board.occ), config.kinds * 2);
  const pair = find3DAnyPair(board.occ, board.d);
  assert.notEqual(pair, null);
  assert.notEqual(find3DPath(board.occ, board.d, pair.a, pair.b), null);
  assert.equal(reshuffle3D(board, rng), true);
});
