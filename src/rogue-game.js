import { createRogueRunState } from "./rogue-state.js";
import {
  createRogueLevel,
  getRogueNeighbors,
  revealRogueFlood,
} from "./rogue-level.js";
import {
  getRewardOptions,
  getToolDefinition,
  getUpgradeDefinition,
} from "./rogue-items.js";

const TOOL_KEYS = ["scoutPulse", "defusalKit", "reactionShield"];

export function createRogueGame({ rng = Math.random, levelFactory = createRogueLevel } = {}) {
  let currentState = createRogueRunState();
  let selectedTool = null;

  function getState() {
    return currentState;
  }

  function inBounds(row, col) {
    return Number.isInteger(row)
      && Number.isInteger(col)
      && row >= 0
      && row < currentState.level.rows
      && col >= 0
      && col < currentState.level.cols;
  }

  function isBlocked() {
    return currentState.status === "won"
      || currentState.status === "lost"
      || currentState.status === "reward";
  }

  function clearNotice() {
    currentState.notice = "";
  }

  function createLevel(floor) {
    return levelFactory({
      floor,
      rng,
      toolBonus: currentState.nextLevelToolBonus,
    });
  }

  function reset() {
    currentState = createRogueRunState();
    currentState.level = createLevel(1);
    selectedTool = null;
    return "continue";
  }

  function energyThreshold() {
    return currentState.upgrades.includes("chain") ? 3 : 4;
  }

  function awardSafeReveal(count) {
    if (count <= 0) return;
    currentState.level.safeCellsRemaining = Math.max(0, currentState.level.safeCellsRemaining - count);
    currentState.score += count;
    currentState.safeRevealStreak += 1;
    if (currentState.safeRevealStreak >= energyThreshold()) {
      currentState.energy = Math.min(currentState.maxEnergy, currentState.energy + 1);
      currentState.safeRevealStreak = 0;
      currentState.notice = "连续安全揭开，获得 1 点能量。";
    }
  }

  function completeLevelIfReady() {
    if (currentState.level.safeCellsRemaining > 0) return "continue";
    currentState.level.ended = true;
    currentState.score += 10;
    selectedTool = null;
    if (currentState.floor >= currentState.totalFloors) {
      currentState.status = "won";
      currentState.notice = "战术扫雷通关！";
      return "win";
    }
    currentState.status = "reward";
    currentState.rewardOptions = getRewardOptions({
      ownedUpgrades: currentState.upgrades,
      rng,
    });
    currentState.notice = "关卡完成，请选择一项强化。";
    return "reward";
  }

  function hitMine(cell) {
    if (cell.neutralized) return "continue";
    cell.neutralized = true;
    cell.exploded = true;
    cell.revealed = true;
    currentState.score += 3;
    currentState.safeRevealStreak = 0;
    if (currentState.level.shieldActive) {
      currentState.level.shieldActive = false;
      currentState.notice = "反应护盾已抵挡这次爆炸。";
    } else {
      currentState.lives -= 1;
      currentState.notice = `触发地雷，损失 1 点生命。还剩 ${currentState.lives} 点。`;
    }
    if (currentState.lives <= 0) {
      currentState.status = "lost";
      currentState.level.ended = true;
      currentState.notice = "生命耗尽，本局结束。";
      return "lose";
    }
    return "hit";
  }

  function reveal(row, col) {
    if (isBlocked() || !inBounds(row, col)) return "invalid";
    const level = currentState.level;
    if (!level.started) {
      currentState.level = levelFactory({
        floor: currentState.floor,
        safeRow: row,
        safeCol: col,
        rng,
        toolBonus: currentState.nextLevelToolBonus,
      });
      currentState.status = "playing";
    }
    const cell = currentState.level.board[row][col];
    if (cell.neutralized) return "continue";
    if (cell.flagged) return "continue";
    if (cell.revealed) return chord(row, col);
    clearNotice();
    if (cell.mine) return hitMine(cell);
    const count = revealRogueFlood(
      currentState.level.board,
      row,
      col,
      currentState.level.rows,
      currentState.level.cols,
    );
    awardSafeReveal(count);
    return completeLevelIfReady();
  }

  function chord(row, col) {
    if (isBlocked() || !inBounds(row, col)) return "invalid";
    const level = currentState.level;
    const cell = level.board[row][col];
    if (!cell.revealed || cell.mine || cell.count === 0) return "invalid";
    const adjacent = getRogueNeighbors(row, col, level.rows, level.cols);
    const flagged = adjacent.reduce(
      (total, [neighborRow, neighborCol]) => total + (level.board[neighborRow][neighborCol].flagged ? 1 : 0),
      0,
    );
    if (flagged !== cell.count) return "invalid";
    clearNotice();
    for (const [neighborRow, neighborCol] of adjacent) {
      const neighbor = level.board[neighborRow][neighborCol];
      if (neighbor.revealed || neighbor.flagged) continue;
      if (neighbor.mine) return hitMine(neighbor);
      const count = revealRogueFlood(level.board, neighborRow, neighborCol, level.rows, level.cols);
      awardSafeReveal(count);
    }
    return completeLevelIfReady();
  }

  function cycleMark(row, col) {
    if (isBlocked() || !inBounds(row, col)) return "invalid";
    const cell = currentState.level.board[row][col];
    if (cell.revealed) return "invalid";
    clearNotice();
    if (!cell.flagged && !cell.questioned) cell.flagged = true;
    else if (cell.flagged) {
      cell.flagged = false;
      cell.questioned = true;
    } else {
      cell.questioned = false;
    }
    return "continue";
  }

  function canSelectTool(toolKey) {
    const definition = getToolDefinition(toolKey);
    return currentState.status === "playing"
      && Boolean(definition)
      && currentState.level.activeToolUses[toolKey] > 0
      && currentState.energy >= definition.cost
      && !(toolKey === "reactionShield" && currentState.level.shieldActive);
  }

  function selectTool(toolKey) {
    if (!canSelectTool(toolKey)) return false;
    selectedTool = toolKey;
    currentState.notice = `${getToolDefinition(toolKey).label}已就绪。`;
    return true;
  }

  function cancelTool() {
    selectedTool = null;
    return "continue";
  }

  function consumeTool(toolKey) {
    const definition = getToolDefinition(toolKey);
    currentState.energy -= definition.cost;
    currentState.level.activeToolUses[toolKey] -= 1;
  }

  function useSelectedTool(row, col) {
    if (!selectedTool || !canSelectTool(selectedTool)) return "invalid";
    const toolKey = selectedTool;
    const level = currentState.level;
    if (toolKey === "reactionShield") {
      consumeTool(toolKey);
      level.shieldActive = true;
      selectedTool = null;
      currentState.notice = "反应护盾已启动，本层下一次踩雷不会损失生命。";
      return "continue";
    }
    if (!inBounds(row, col)) return "invalid";
    const cell = level.board[row][col];
    if (toolKey === "scoutPulse") {
      if (cell.revealed) return "invalid";
      consumeTool(toolKey);
      const startRow = Math.max(0, row - 1);
      const endRow = Math.min(level.rows - 1, row + 1);
      const startCol = Math.max(0, col - 1);
      const endCol = Math.min(level.cols - 1, col + 1);
      let mines = 0;
      for (let currentRow = startRow; currentRow <= endRow; currentRow++) {
        for (let currentCol = startCol; currentCol <= endCol; currentCol++) {
          if (level.board[currentRow][currentCol].mine) mines += 1;
        }
      }
      selectedTool = null;
      currentState.notice = `侦察脉冲：该区域包含 ${mines} 个雷（行 ${startRow + 1}–${endRow + 1}，列 ${startCol + 1}–${endCol + 1}）。`;
      return "continue";
    }
    if (!cell.flagged) return "invalid";
    consumeTool(toolKey);
    selectedTool = null;
    if (cell.mine) {
      cell.neutralized = true;
      cell.exploded = false;
      currentState.score += 3;
      currentState.notice = "拆雷装置已解除这颗地雷。";
      return completeLevelIfReady();
    }
    cell.flagged = false;
    cell.questioned = false;
    const revealed = revealRogueFlood(level.board, row, col, level.rows, level.cols);
    awardSafeReveal(revealed);
    currentState.notice = "拆雷装置拆穿了假旗，并揭开了安全区域。";
    return completeLevelIfReady();
  }

  function applyUpgrade(upgradeId) {
    if (upgradeId === "storage") {
      currentState.maxEnergy += 1;
      currentState.energy = Math.min(currentState.maxEnergy, currentState.energy + 1);
    } else if (upgradeId === "medical") {
      currentState.maxLives += 1;
      currentState.lives += 1;
    } else if (upgradeId.startsWith("toolBoost:")) {
      const toolKey = upgradeId.slice("toolBoost:".length);
      if (TOOL_KEYS.includes(toolKey)) currentState.nextLevelToolBonus[toolKey] += 1;
    } else if (upgradeId === "supply") {
      for (const toolKey of TOOL_KEYS) currentState.nextLevelToolBonus[toolKey] += 1;
    } else if (upgradeId.startsWith("energy:")) {
      currentState.energy = Math.min(currentState.maxEnergy, currentState.energy + 1);
    }
  }

  function chooseReward(upgradeId) {
    if (currentState.status !== "reward") return "invalid";
    const option = currentState.rewardOptions.find(({ id }) => id === upgradeId);
    if (!option || !getUpgradeDefinition(option.id) && !option.id.startsWith("energy:")) return "invalid";
    applyUpgrade(option.id);
    currentState.upgrades.push(option.id);
    currentState.rewardOptions = [];
    currentState.floor += 1;
    currentState.level = createLevel(currentState.floor);
    currentState.status = "ready";
    currentState.safeRevealStreak = 0;
    currentState.notice = `已获得「${option.label}」，准备进入第 ${currentState.floor} 层。`;
    selectedTool = null;
    return "continue";
  }

  reset();
  return {
    getState,
    reset,
    reveal,
    chord,
    cycleMark,
    selectTool,
    cancelTool,
    useSelectedTool,
    chooseReward,
    getSelectedTool: () => selectedTool,
  };
}
