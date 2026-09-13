function getCellLabel(cell, row, column) {
  const coordinate = `第${row + 1}行第${column + 1}列`;
  if (cell.revealed && cell.mine) return `${coordinate}，地雷`;
  if (cell.revealed) return `${coordinate}，${cell.count ? `${cell.count} 个相邻地雷` : "空白"}`;
  if (cell.flagged) return `${coordinate}，标记为地雷`;
  if (cell.questioned) return `${coordinate}，待确认`;
  return `${coordinate}，未翻开`;
}

export function toMinesweeperViewModel(state) {
  const rows = Number(state?.rows) || 0;
  const cols = Number(state?.cols) || 0;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols; column += 1) {
      const cell = state.board?.[row]?.[column] || {};
      cells.push({
        row,
        column,
        revealed: cell.revealed === true,
        flagged: cell.flagged === true,
        questioned: cell.questioned === true,
        exploded: cell.exploded === true,
        crossed: cell.crossed === true,
        mine: cell.mine === true && cell.revealed === true,
        count: Number(cell.count) || 0,
        region: Number(cell.region) || 0,
        ariaLabel: getCellLabel(cell, row, column),
      });
    }
  }
  return {
    rows,
    cols,
    mines: Number(state?.mines) || 0,
    modeKey: state?.modeKey || "classic",
    started: state?.started === true,
    ended: state?.ended === true,
    win: state?.win === true,
    timer: Number(state?.timer) || 0,
    hint: state?.hint || null,
    notice: state?.notice || "",
    cells,
  };
}
