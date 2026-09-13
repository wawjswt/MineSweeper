import test from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  PEER_SETS,
  countRemaining,
  countSolutions,
  findBasicHint,
  getCandidates,
  isValidSolution,
  makePuzzle,
} from "../src/core/games/sudoku/engine.js";

const referenceSolution = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

const referencePuzzle = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
];

test("Sudoku core generates a valid unique puzzle with injected sources", () => {
  const result = makePuzzle(0, { rng: () => 0.25, now: () => 0 });

  assert.deepEqual(result.puzzle, result.solution);
  assert.equal(result.removed, 0);
  assert.equal(isValidSolution(result.solution), true);
  assert.equal(countSolutions(result.puzzle.slice(), 2), 1);
  assert.deepEqual(DIFFICULTIES.medium, { name: "中等", blanks: 48 });
});

test("Sudoku core keeps candidate, hint, peer, and remaining-count behavior", () => {
  assert.deepEqual(getCandidates(referencePuzzle, 2), [1, 2, 4]);
  assert.equal(countRemaining(referenceSolution, referencePuzzle, 5), 6);

  const hint = findBasicHint(referencePuzzle);
  assert.equal(hint.strategy, "naked-single");
  assert.equal(hint.index, 40);
  assert.equal(hint.digit, 5);
  assert.equal(PEER_SETS[40].has(4), true);
  assert.equal(PEER_SETS[40].has(39), true);
  assert.equal(PEER_SETS[40].has(0), false);
});
