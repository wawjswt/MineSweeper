export { generateSudokuMines } from "./minesweeper.js";

export function getSudokuCoreStatus() {
  return {
    game: "sudoku",
    status: "partial",
    uiSource: "src/sudoku-game.js",
  };
}
