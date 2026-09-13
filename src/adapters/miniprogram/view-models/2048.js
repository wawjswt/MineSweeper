export function to2048ViewModel(state) {
  const board = Array.isArray(state?.board) ? state.board : [];
  return {
    cells: board.map((value, index) => ({
      index,
      row: Math.floor(index / 4),
      column: index % 4,
      value,
    })),
    score: Number(state?.score) || 0,
    bestScore: Number(state?.bestScore) || 0,
    status: state?.status || "playing",
    won: state?.won === true,
    continued: state?.continued === true,
    moves: Number(state?.moves) || 0,
    lastMove: state?.lastMove || null,
  };
}
