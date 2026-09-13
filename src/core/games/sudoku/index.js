export {
  DIFFICULTIES,
  PEER_SETS,
  SIZE,
  TOTAL,
  colOf,
  countRemaining,
  countSolutions,
  deserializeSave,
  findBasicHint,
  findHint,
  getCandidates,
  isValidSolution,
  makePuzzle,
  ratePuzzle,
  rowOf,
  serializeSave,
  shuffle,
  solveOnce,
} from "./engine.js";
export { generateSudokuMines } from "./minesweeper.js";

export function getSudokuCoreStatus() {
  return {
    game: "sudoku",
    status: "extracted",
    uiSource: "src/sudoku-game.js",
  };
}
