import { TOOL_DEFINITIONS } from "../../../core/games/rogue/items.js";

function cellLabel(cell, row, col) {
  const parts = [`第${row + 1}行第${col + 1}列`];
  if (cell.revealed) parts.push(cell.mine ? "地雷" : `数字${cell.count}`);
  if (cell.flagged) parts.push("旗标");
  if (cell.questioned) parts.push("问号");
  if (cell.neutralized) parts.push("已中和");
  if (cell.special) parts.push(cell.special === "intel" ? "情报点" : "补给点");
  return parts.join("，");
}

export function toRogueViewModel(state) {
  const level = state?.level || {};
  const board = Array.isArray(level.board) ? level.board : [];
  const rows = Number(level.rows) || board.length;
  const cols = Number(level.cols) || (board[0]?.length || 0);
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = board[row]?.[col] || {};
      cells.push({
        index: row * cols + col,
        row,
        column: col,
        mine: cell.revealed || cell.neutralized ? cell.mine === true : false,
        revealed: cell.revealed === true,
        flagged: cell.flagged === true,
        questioned: cell.questioned === true,
        exploded: cell.exploded === true,
        neutralized: cell.neutralized === true,
        count: Number(cell.count) || 0,
        sectorId: Number.isInteger(cell.sectorId) ? cell.sectorId : null,
        special: cell.special || null,
        specialCollected: cell.specialCollected === true,
        ariaLabel: cellLabel(cell, row, col),
      });
    }
  }

  return {
    status: state?.status || "ready",
    paused: state?.paused === true,
    floor: Number(state?.floor) || 1,
    totalFloors: Number(state?.totalFloors) || 5,
    lives: Number(state?.lives) || 0,
    maxLives: Number(state?.maxLives) || 0,
    energy: Number(state?.energy) || 0,
    maxEnergy: Number(state?.maxEnergy) || 0,
    score: Number(state?.score) || 0,
    rows,
    cols,
    cells,
    sectors: Array.isArray(level.sectors) ? level.sectors.map((sector) => ({ ...sector })) : [],
    contract: state?.selectedContract
      ? {
          id: state.selectedContract,
          progress: Number(state.contractProgress) || 0,
          target: Number(state.contractTarget) || 0,
          completed: state.contractCompleted === true,
          failed: state.contractFailed === true,
        }
      : null,
    contracts: Array.isArray(state?.contractOptions) ? state.contractOptions.map((option) => ({ ...option })) : [],
    selectedTool: state?.selectedTool || null,
    tools: Object.entries(TOOL_DEFINITIONS).map(([key, definition]) => ({
      ...definition,
      key,
      uses: Number(level.activeToolUses?.[key]) || 0,
      disabled: Number(level.activeToolUses?.[key]) <= 0 || Number(state?.energy) < definition.cost,
      selected: state?.selectedTool === key,
    })),
    rewards: Array.isArray(state?.rewardOptions) ? state.rewardOptions.map((option) => ({ ...option })) : [],
    notice: state?.notice || "",
  };
}
