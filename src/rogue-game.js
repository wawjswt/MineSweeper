import { createRogueRunState } from "./rogue-state.js";
import {
  createRogueLevel,
  getRogueNeighbors,
  refreshRogueSectorStats,
  revealRogueFlood,
} from "./rogue-level.js";
import {
  getRewardOptions,
  getToolDefinition,
  getUpgradeDefinition,
} from "./rogue-items.js";
import {
  getContractDefinition,
  getContractOptions,
  getContractReward,
} from "./rogue-contracts.js";

const TOOL_KEYS = ["scoutPulse", "defusalKit", "reactionShield"];

function createLevelStats() {
  return {
    damageTaken: 0,
    safeReveals: 0,
    toolsUsed: {},
    trueMinesDefused: 0,
    shieldedHits: 0,
    specialCellsCollected: 0,
  };
}

function createContractContext() {
  return {
    intelSectorId: null,
    supplySectorId: null,
    firstCrossFireEvent: null,
    insertionQualifiedSectors: [],
  };
}

function getContractLabel(contractId) {
  return getContractDefinition(contractId)?.label || contractId;
}

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

  function resetCurrentLevelContract() {
    currentState.contractOptions = getContractOptions({
      floor: currentState.floor,
      rng,
    });
    currentState.selectedContract = null;
    currentState.contractProgress = 0;
    currentState.contractTarget = 1;
    currentState.contractCompleted = false;
    currentState.contractRewardGranted = false;
    currentState.contractFailed = false;
    currentState.contractFailureReason = "";
    currentState.contractPenaltyApplied = false;
    currentState.contractContext = createContractContext();
    currentState.levelStats = createLevelStats();
  }

  function refreshSectorStats() {
    if (Array.isArray(currentState.level?.sectors)) {
      refreshRogueSectorStats(currentState.level);
    }
  }

  function getCellSectorId(row, col) {
    const sectorId = currentState.level?.board?.[row]?.[col]?.sectorId;
    return Number.isInteger(sectorId) ? sectorId : null;
  }

  function failContract(reason) {
    if (!currentState.selectedContract || currentState.contractCompleted || currentState.contractFailed) {
      return "";
    }
    currentState.contractFailed = true;
    currentState.contractFailureReason = reason;
    return reason;
  }

  function contractRewardText(reward) {
    if (reward.type === "energy") return `能量 +${reward.amount}`;
    if (reward.type === "toolBonus") {
      const tool = getToolDefinition(reward.toolKey);
      return `${tool?.label || reward.toolKey}下层使用次数 +${reward.amount}`;
    }
    if (reward.type === "score") {
      const streak = reward.streakAmount ? `，安全连击 +${reward.streakAmount}` : "";
      return `分数 +${reward.amount}${streak}`;
    }
    return "已获得额外奖励";
  }

  function completedContractNotice() {
    if (!currentState.selectedContract || !currentState.contractCompleted) return "";
    const definition = getContractDefinition(currentState.selectedContract);
    const reward = getContractReward(currentState.selectedContract);
    return definition && reward
      ? `契约「${definition.label}」完成，${contractRewardText(reward)}。`
      : "";
  }

  function applyContractReward() {
    if (currentState.contractRewardGranted || !currentState.selectedContract) return "";
    const reward = getContractReward(currentState.selectedContract);
    if (!reward) return "";
    if (reward.type === "energy") {
      currentState.energy = Math.min(currentState.maxEnergy, currentState.energy + reward.amount);
    } else if (reward.type === "toolBonus" && TOOL_KEYS.includes(reward.toolKey)) {
      currentState.nextLevelToolBonus[reward.toolKey] += reward.amount;
    } else if (reward.type === "score") {
      currentState.score += reward.amount;
      currentState.safeRevealStreak += reward.streakAmount || 0;
    }
    currentState.contractRewardGranted = true;
    return completedContractNotice();
  }

  function completeCurrentContract() {
    if (!currentState.selectedContract || currentState.contractCompleted || currentState.contractFailed) {
      return completedContractNotice();
    }
    const definition = getContractDefinition(currentState.selectedContract);
    if (!definition) return "";
    currentState.contractProgress = definition.target;
    currentState.contractTarget = definition.target;
    currentState.contractCompleted = true;
    const notice = applyContractReward();
    currentState.notice = notice;
    return notice;
  }

  function applyContractPenalty() {
    if (!currentState.selectedContract || currentState.contractCompleted || currentState.contractPenaltyApplied) {
      return "";
    }
    currentState.contractPenaltyApplied = true;
    const energyBefore = currentState.energy;
    currentState.energy = Math.max(0, currentState.energy - 1);
    return energyBefore > currentState.energy
      ? "未完成契约，扣除 1 点能量。"
      : "未完成契约，能量已为 0。";
  }

  function resolveLevelContract() {
    const stats = currentState.levelStats;
    if (currentState.selectedContract === "noDamage" && stats.damageTaken === 0) {
      completeCurrentContract();
    } else if (currentState.selectedContract === "reservePower" && currentState.energy >= 1) {
      completeCurrentContract();
    }
    if (currentState.contractCompleted) return completedContractNotice();
    if (!currentState.selectedContract) return "";
    failContract(currentState.contractFailureReason || "本层结束时未完成契约。");
    const penaltyNotice = applyContractPenalty();
    const reason = currentState.contractFailureReason
      ? `（${currentState.contractFailureReason}）`
      : "";
    return `本层契约「${getContractLabel(currentState.selectedContract)}」未完成${reason} ${penaltyNotice}`.trim();
  }

  function recordToolUse(toolKey, row = null, col = null) {
    const toolsUsed = currentState.levelStats.toolsUsed;
    toolsUsed[toolKey] = (toolsUsed[toolKey] || 0) + 1;
    const sectorId = Number.isInteger(row) && Number.isInteger(col)
      ? getCellSectorId(row, col)
      : null;
    if (currentState.contractFailed || currentState.contractCompleted || sectorId === null) return "";

    if (currentState.selectedContract === "intelRelay"
      && currentState.contractContext.intelSectorId !== null
      && currentState.contractContext.intelSectorId !== sectorId) {
      currentState.contractProgress = 2;
      return completeCurrentContract();
    }

    if (currentState.selectedContract !== "crossFire") return "";
    if (!currentState.contractContext.firstCrossFireEvent) {
      currentState.contractContext.firstCrossFireEvent = { toolKey, sectorId };
      currentState.contractProgress = Math.max(1, currentState.contractProgress);
      return "";
    }
    const firstEvent = currentState.contractContext.firstCrossFireEvent;
    if (firstEvent.toolKey === toolKey || firstEvent.sectorId === sectorId) {
      currentState.contractProgress = Math.max(1, currentState.contractProgress);
      return "";
    }
    currentState.contractProgress = 2;
    return completeCurrentContract();
  }

  function collectSpecialCell(cell, row, col) {
    if (!cell?.special || cell.specialCollected) return "";
    cell.specialCollected = true;
    currentState.levelStats.specialCellsCollected += 1;
    const notices = [];
    const sectorId = Number.isInteger(cell.sectorId) ? cell.sectorId : getCellSectorId(row, col);
    if (cell.special === "intel") {
      if (currentState.selectedContract === "intelRelay" && !currentState.contractFailed) {
        currentState.contractContext.intelSectorId = sectorId;
        currentState.contractProgress = Math.max(1, currentState.contractProgress);
      }
      const level = currentState.level;
      const startRow = Math.max(0, row - 1);
      const endRow = Math.min(level.rows - 1, row + 1);
      const startCol = Math.max(0, col - 1);
      const endCol = Math.min(level.cols - 1, col + 1);
      let mines = 0;
      for (let currentRow = startRow; currentRow <= endRow; currentRow += 1) {
        for (let currentCol = startCol; currentCol <= endCol; currentCol += 1) {
          if (level.board[currentRow][currentCol].mine) mines += 1;
        }
      }
      notices.push(`情报点：该区域包含 ${mines} 个雷（行 ${startRow + 1}–${endRow + 1}，列 ${startCol + 1}–${endCol + 1}）。`);
      if (currentState.selectedContract === "reconnaissance") {
        const contractNotice = completeCurrentContract();
        if (contractNotice) notices.push(contractNotice);
      }
    } else if (cell.special === "supply") {
      if (currentState.selectedContract === "supplyRelay" && !currentState.contractFailed) {
        currentState.contractContext.supplySectorId = sectorId;
        currentState.contractProgress = Math.max(1, currentState.contractProgress);
      }
      currentState.energy = Math.min(currentState.maxEnergy, currentState.energy + 1);
      const rechargeKey = TOOL_KEYS.reduce((leastKey, toolKey) => (
        currentState.level.activeToolUses[toolKey] < currentState.level.activeToolUses[leastKey]
          ? toolKey
          : leastKey
      ), TOOL_KEYS[0]);
      currentState.level.activeToolUses[rechargeKey] += 1;
      const tool = getToolDefinition(rechargeKey);
      notices.push(`补给点：能量 +1，${tool?.label || rechargeKey}使用次数 +1。`);
    }
    currentState.notice = notices.join(" ");
    return currentState.notice;
  }

  function selectContract(contractId) {
    if (currentState.status !== "ready") return "invalid";
    if (!currentState.contractOptions.some(({ id }) => id === contractId)) return "invalid";
    const definition = getContractDefinition(contractId);
    currentState.selectedContract = contractId;
    currentState.contractOptions = [];
    currentState.contractProgress = 0;
    currentState.contractTarget = definition.target;
    currentState.contractCompleted = false;
    currentState.contractRewardGranted = false;
    currentState.contractFailed = false;
    currentState.contractFailureReason = "";
    currentState.contractPenaltyApplied = false;
    currentState.contractContext = createContractContext();
    currentState.notice = `已选择契约「${definition.label}」。`;
    return "continue";
  }

  function createLevel(floor, sectors = null) {
    const options = {
      floor,
      rng,
      toolBonus: currentState.nextLevelToolBonus,
    };
    if (sectors) options.sectors = sectors;
    return levelFactory(options);
  }

  function reset() {
    currentState = createRogueRunState();
    currentState.level = createLevel(1);
    resetCurrentLevelContract();
    selectedTool = null;
    return "continue";
  }

  function energyThreshold() {
    return currentState.upgrades.includes("chain") ? 3 : 4;
  }

  function recordSafeRevealForContracts(row, col) {
    if (currentState.contractFailed || currentState.contractCompleted) return "";
    const sectorId = getCellSectorId(row, col);
    if (sectorId === null) return "";

    if (currentState.selectedContract === "supplyRelay"
      && currentState.contractContext.supplySectorId !== null
      && currentState.contractContext.supplySectorId !== sectorId) {
      currentState.contractProgress = 2;
      return completeCurrentContract();
    }

    if (currentState.selectedContract !== "safeInsertion") return "";
    const insertionSectors = currentState.contractContext.insertionQualifiedSectors;
    if (!insertionSectors.includes(sectorId)) {
      const revealedInSector = currentState.level.board.flat().filter((cell) => (
        !cell.mine && cell.revealed && cell.sectorId === sectorId
      )).length;
      if (revealedInSector >= 3) {
        insertionSectors.push(sectorId);
        insertionSectors.sort((first, second) => first - second);
      }
    }
    currentState.contractProgress = Math.min(
      currentState.contractTarget,
      insertionSectors.length,
    );
    return insertionSectors.length >= 2 ? completeCurrentContract() : "";
  }

  function awardSafeReveal(count) {
    if (count <= 0) return "";
    currentState.levelStats.safeReveals += count;
    currentState.level.safeCellsRemaining = Math.max(0, currentState.level.safeCellsRemaining - count);
    currentState.score += count;
    currentState.safeRevealStreak += 1;
    let notice = "";
    if (currentState.safeRevealStreak >= energyThreshold()) {
      currentState.energy = Math.min(currentState.maxEnergy, currentState.energy + 1);
      currentState.safeRevealStreak = 0;
      notice = "连续安全揭开，获得 1 点能量。";
      currentState.notice = notice;
    }
    return notice;
  }

  function revealSafeArea(row, col) {
    const specialNotices = [];
    const revealed = revealRogueFlood(
      currentState.level.board,
      row,
      col,
      currentState.level.rows,
      currentState.level.cols,
      (cell, currentRow, currentCol) => {
        const notice = collectSpecialCell(cell, currentRow, currentCol);
        if (notice) specialNotices.push(notice);
        const contractNotice = recordSafeRevealForContracts(currentRow, currentCol);
        if (contractNotice) specialNotices.push(contractNotice);
      },
    );
    const safeNotice = awardSafeReveal(revealed);
    refreshSectorStats();
    if (specialNotices.length || safeNotice) {
      currentState.notice = [...specialNotices, safeNotice].filter(Boolean).join(" ");
    }
    return revealed;
  }

  function completeLevelIfReady() {
    if (currentState.level.safeCellsRemaining > 0) return "continue";
    currentState.level.ended = true;
    currentState.score += 10;
    const contractNotice = resolveLevelContract();
    selectedTool = null;
    if (currentState.floor >= currentState.totalFloors) {
      currentState.status = "won";
      currentState.notice = [contractNotice, "战术扫雷通关！"].filter(Boolean).join(" ");
      return "win";
    }
    currentState.status = "reward";
    currentState.rewardOptions = getRewardOptions({
      ownedUpgrades: currentState.upgrades,
      rng,
    });
    currentState.notice = [contractNotice, "关卡完成，请选择一项强化。"].filter(Boolean).join(" ");
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
      currentState.levelStats.shieldedHits += 1;
      currentState.notice = "反应护盾已抵挡这次爆炸。";
    } else {
      currentState.lives -= 1;
      currentState.levelStats.damageTaken += 1;
      if (currentState.selectedContract === "safeInsertion") {
        failContract("第一次受伤，分段突入已失败。");
      } else if (currentState.selectedContract === "noDamage") {
        failContract("发生受伤，零误触已失败。");
      }
      currentState.notice = `触发地雷，损失 1 点生命。还剩 ${currentState.lives} 点。`;
    }
    refreshSectorStats();
    if (currentState.lives <= 0) {
      currentState.status = "lost";
      currentState.level.ended = true;
      currentState.notice = "生命耗尽，本局结束。";
      return "lose";
    }
    return "hit";
  }

  function reveal(row, col) {
    if (isBlocked() || currentState.selectedContract === null || !inBounds(row, col)) return "invalid";
    const level = currentState.level;
    if (!level.started) {
      currentState.level = levelFactory({
        floor: currentState.floor,
        safeRow: row,
        safeCol: col,
        rng,
        toolBonus: currentState.nextLevelToolBonus,
        sectors: level.sectors,
      });
      currentState.status = "playing";
      refreshSectorStats();
    }
    const cell = currentState.level.board[row][col];
    if (cell.neutralized) return "continue";
    if (cell.flagged) return "continue";
    if (cell.revealed) return chord(row, col);
    clearNotice();
    if (cell.mine) return hitMine(cell);
    revealSafeArea(row, col);
    return completeLevelIfReady();
  }

  function chord(row, col) {
    if (isBlocked() || currentState.selectedContract === null || !inBounds(row, col)) return "invalid";
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
      revealSafeArea(neighborRow, neighborCol);
    }
    return completeLevelIfReady();
  }

  function cycleMark(row, col) {
    if (isBlocked() || currentState.selectedContract === null || !inBounds(row, col)) return "invalid";
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
      const contractNotice = recordToolUse(toolKey);
      level.shieldActive = true;
      selectedTool = null;
      currentState.notice = [
        "反应护盾已启动，本层下一次踩雷不会损失生命。",
        contractNotice,
      ].filter(Boolean).join(" ");
      return "continue";
    }
    if (!inBounds(row, col)) return "invalid";
    const cell = level.board[row][col];
    if (toolKey === "scoutPulse") {
      if (cell.revealed) return "invalid";
      consumeTool(toolKey);
      const contractNotice = recordToolUse(toolKey, row, col);
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
      const specialNotice = cell.special
        ? collectSpecialCell(cell, row, col)
        : "";
      selectedTool = null;
      const scanNotice = `侦察脉冲：该区域包含 ${mines} 个雷（行 ${startRow + 1}–${endRow + 1}，列 ${startCol + 1}–${endCol + 1}）。`;
      currentState.notice = [scanNotice, specialNotice, contractNotice].filter(Boolean).join(" ");
      return "continue";
    }
    if (!cell.flagged) return "invalid";
    consumeTool(toolKey);
    const contractNotice = recordToolUse(toolKey, row, col);
    selectedTool = null;
    if (cell.mine) {
      cell.neutralized = true;
      cell.exploded = false;
      currentState.score += 3;
      currentState.levelStats.trueMinesDefused += 1;
      const demolitionNotice = currentState.selectedContract === "controlledDemolition"
        ? completeCurrentContract()
        : "";
      currentState.notice = ["拆雷装置已解除这颗地雷。", contractNotice, demolitionNotice].filter(Boolean).join(" ");
      return completeLevelIfReady();
    }
    cell.flagged = false;
    cell.questioned = false;
    const safeNotice = revealSafeArea(row, col);
    currentState.notice = ["拆雷装置拆穿了假旗，并揭开了安全区域。", safeNotice, contractNotice].filter(Boolean).join(" ");
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
    resetCurrentLevelContract();
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
    selectContract,
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
