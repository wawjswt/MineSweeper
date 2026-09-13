import { BOARD_METRICS } from "./config.js";
import { getRewardOptions, getToolDefinition, getUpgradeDefinition } from "./core/games/rogue/items.js";
import { getContractDefinition } from "./core/games/rogue/contracts.js";

function getSectorForCell(cell, col, sectors) {
  if (!Array.isArray(sectors)) return null;
  if (!Number.isInteger(cell?.sectorId)) return null;
  return sectors.find((sector) => sector?.id === cell.sectorId) || null;
}

function resolveSector(cell, col, sectorInfo) {
  if (typeof sectorInfo === "string") return { label: sectorInfo };
  if (sectorInfo && !Array.isArray(sectorInfo) && typeof sectorInfo === "object") {
    return sectorInfo;
  }
  return getSectorForCell(cell, col, sectorInfo);
}

export function buildRogueCellAriaLabel(cell, row, col, sectors = null) {
  const position = `第 ${row + 1} 行第 ${col + 1} 列`;
  const labels = [position];
  const sector = resolveSector(cell, col, sectors);
  if (sector?.label) labels.push(sector.label);
  if (cell.flagged) labels.push("旗帜");
  else if (cell.questioned) labels.push("问号");
  if (cell.special === "intel") labels.push(cell.specialCollected ? "情报点，已收集" : "情报点");
  if (cell.special === "supply") labels.push(cell.specialCollected ? "补给点，已收集" : "补给点");
  if (!cell.revealed) {
    labels.push("未揭开");
    return labels.join("，");
  }
  labels.push("已揭开");
  if (cell.mine && cell.neutralized) labels.push("已拆除的地雷");
  else if (cell.mine) labels.push("地雷");
  else if (!cell.count) labels.push("空白");
  else labels.push(`数字 ${cell.count}`);
  return labels.join("，");
}

export function getRogueToolButtonState({ selected, disabled, uses, cost }) {
  return {
    pressed: selected,
    ariaDisabled: disabled,
    text: `${uses}次 · ${cost}能量`,
  };
}

export function getRoguePrimaryAction({ markMode, selectedTool, revealed }) {
  if (selectedTool) return "tool";
  if (markMode === "mark") return "mark";
  return revealed ? "chord" : "reveal";
}

export function getRogueToolSelectionAfterAction(selectedTool, result) {
  return result === "invalid" ? selectedTool : null;
}

export function getRogueToolButtonAction(selectedTool, toolKey) {
  return selectedTool === toolKey ? "cancel" : "select";
}

export function getRogueContractButtonState({ selected, disabled }) {
  return {
    pressed: Boolean(selected),
    ariaDisabled: Boolean(disabled),
  };
}

export function getRogueSpecialCellClasses(cell) {
  const classes = [];
  if (cell?.special === "intel") classes.push("rogue-cell--intel");
  if (cell?.special === "supply") classes.push("rogue-cell--supply");
  if (classes.length && cell.specialCollected) classes.push("rogue-cell--collected");
  return classes;
}

export function getRogueSectorClassNames(cell, col, sectors = []) {
  const sector = resolveSector(cell, col, sectors);
  const sectorId = Number.isInteger(cell?.sectorId) ? cell.sectorId : sector?.id;
  if (!Number.isInteger(sectorId)) return [];
  const classes = [`rogue-cell--sector-${sectorId}`];
  if (sector && Number.isInteger(col) && col === sector.startCol && col > 0) {
    classes.push("rogue-cell--sector-boundary");
  }
  return classes;
}

function cellText(cell) {
  if (cell.flagged) return "🚩";
  if (cell.questioned) return "❓";
  if (!cell.revealed && cell.special === "intel") return "🔎";
  if (!cell.revealed && cell.special === "supply") return "📦";
  if (!cell.revealed) return "";
  if (cell.mine && cell.neutralized) return "🛠️";
  if (cell.mine) return "💣";
  return cell.count ? String(cell.count) : "";
}

function upgradeText(id) {
  if (id.startsWith("energy:")) return "+1 能量";
  return getUpgradeDefinition(id)?.label || id;
}

function contractRewardText(reward) {
  if (!reward) return "额外奖励";
  if (reward.type === "energy") return `能量 +${reward.amount}`;
  if (reward.type === "toolBonus") {
    const tool = getToolDefinition(reward.toolKey);
    return `${tool?.label || reward.toolKey}下层使用次数 +${reward.amount}`;
  }
  if (reward.type === "score") {
    const streak = reward.streakAmount ? `，安全连击 +${reward.streakAmount}` : "";
    return `分数 +${reward.amount}${streak}`;
  }
  return "额外奖励";
}

export function getRogueSectorProgressText(sector, started = true) {
  const label = sector?.label || "战区";
  if (started === false) return `${label} 待部署`;
  const safeCells = Number.isFinite(sector?.safeCells) ? Math.max(0, sector.safeCells) : 0;
  const revealedSafeCells = Number.isFinite(sector?.revealedSafeCells)
    ? Math.max(0, Math.min(safeCells, sector.revealedSafeCells))
    : 0;
  if (sector?.secured || (safeCells > 0 && revealedSafeCells >= safeCells)) {
    return `${label} 已完成`;
  }
  if (revealedSafeCells === 0) return `${label} 待推进`;
  return `${label} ${revealedSafeCells} / ${safeCells}`;
}

export function getRogueContractCardCopy(option) {
  const definition = option?.description && option?.reward
    ? option
    : getContractDefinition(option?.id);
  if (!definition) {
    return {
      description: "",
      progress: "进度：0 / 0",
      reward: "奖励：额外奖励",
      penalty: "未完成扣 1 点能量",
    };
  }
  return {
    description: definition.description,
    progress: `${definition.progressLabel}：0 / ${definition.target}`,
    reward: `奖励：${contractRewardText(definition.reward)}`,
    penalty: "未完成扣 1 点能量",
  };
}

function routeContractStatus(definition, progress, target, context) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(target, progress)) : 0;
  if (definition.id === "intelRelay") {
    return context?.intelSectorId !== null && context?.intelSectorId !== undefined
      ? `${definition.label}：已收集情报点，等待跨区工具操作`
      : `${definition.label}：等待收集情报点`;
  }
  if (definition.id === "supplyRelay") {
    return context?.supplySectorId !== null && context?.supplySectorId !== undefined
      ? `${definition.label}：已收集补给点，等待跨区安全揭开`
      : `${definition.label}：等待收集补给点`;
  }
  if (definition.id === "crossFire") return `${definition.label}：${safeProgress} / ${target}`;
  if (definition.id === "safeInsertion") return `${definition.label}：${safeProgress} / ${target}`;
  return `${definition.label}：${definition.progressLabel} ${safeProgress} / ${target}`;
}

export function getRogueContractProgressText({
  contractId,
  definition: providedDefinition,
  progress = 0,
  target: providedTarget,
  completed = false,
  failed = false,
  failureReason = "",
  context = {},
} = {}) {
  const definition = providedDefinition || getContractDefinition(contractId);
  if (!definition) return "";
  const target = Number.isFinite(providedTarget) ? Math.max(0, providedTarget) : definition.target;
  let status;
  if (completed) {
    status = `${definition.label}：契约完成`;
  } else if (failed) {
    const reason = failureReason ? `（${failureReason}）` : "";
    status = `${definition.label}：契约失败${reason}`;
  } else {
    status = routeContractStatus(definition, progress, target, context);
  }
  const details = [
    status,
    `任务：${definition.description}`,
    `奖励：${contractRewardText(definition.reward)}`,
  ];
  if (!completed) details.push("未完成扣 1 点能量");
  return details.join(" · ");
}

export function createRogueUI(elements) {
  let focusedCell = [0, 0];
  let markMode = "reveal";
  let selectedTool = null;
  let longPressTimer = null;
  let activePointerId = null;
  let longPressTriggered = false;
  let boundHandlers = null;
  let restoreBoardFocus = false;

  function setFocus(row, col) {
    focusedCell = [row, col];
    const button = elements.rogueBoard?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (button) button.focus({ preventScroll: true });
  }

  function moveFocus(state, row, col, rowDelta, colDelta) {
    setFocus(
      Math.max(0, Math.min(state.level.rows - 1, row + rowDelta)),
      Math.max(0, Math.min(state.level.cols - 1, col + colDelta)),
    );
  }

  function finishAction(result, row = null, col = null) {
    if (Number.isInteger(row) && Number.isInteger(col)) focusedCell = [row, col];
    boundHandlers?.onAction?.(result, row, col);
  }

  function renderHud(state) {
    if (elements.rogueFloor) elements.rogueFloor.textContent = `${state.floor} / ${state.totalFloors}`;
    if (elements.rogueLives) elements.rogueLives.textContent = `❤️ ${state.lives} / ${state.maxLives}`;
    if (elements.rogueEnergy) elements.rogueEnergy.textContent = `⚡ ${state.energy} / ${state.maxEnergy}`;
    if (elements.rogueScore) elements.rogueScore.textContent = String(state.score);
    if (elements.rogueUpgradeSummary) {
      elements.rogueUpgradeSummary.textContent = state.upgrades.length
        ? `当前强化：${state.upgrades.map(upgradeText).join(" · ")}`
        : "当前强化：暂无";
    }
    if (elements.rogueFeedback) elements.rogueFeedback.textContent = state.notice || "";
  }

  function renderSectorSummary(state) {
    if (!elements.rogueSectorSummary) return;
    const sectors = state.level?.sectors;
    if (!Array.isArray(sectors) || sectors.length === 0) {
      elements.rogueSectorSummary.hidden = true;
      elements.rogueSectorSummary.replaceChildren();
      return;
    }
    elements.rogueSectorSummary.hidden = false;
    elements.rogueSectorSummary.replaceChildren();
    const title = document.createElement("h2");
    title.className = "rogue-sector-summary__title";
    title.textContent = "战区路线";
    const list = document.createElement("div");
    list.className = "rogue-sector-summary__list";
    list.setAttribute("role", "list");
    for (const sector of sectors) {
      const progressText = getRogueSectorProgressText(sector, state.level.started);
      const item = document.createElement("div");
      item.className = `rogue-sector-summary__item rogue-sector-summary__item--sector-${sector.id}`;
      item.dataset.sectorId = String(sector.id);
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-label", progressText);
      const label = document.createElement("strong");
      label.textContent = sector.label;
      const progress = document.createElement("span");
      progress.textContent = progressText.replace(`${sector.label} `, "");
      item.append(label, progress);
      list.appendChild(item);
    }
    elements.rogueSectorSummary.append(title, list);
  }

  function renderContracts(state) {
    if (!elements.rogueContractPanel) return;
    const pending = state.status === "ready" && !state.selectedContract;
    elements.rogueContractPanel.hidden = false;
    if (elements.rogueContractTitle) {
      elements.rogueContractTitle.textContent = pending ? "选择本层任务契约" : "当前任务契约";
    }
    if (elements.rogueContractOptions) elements.rogueContractOptions.replaceChildren();
    if (elements.rogueContractProgress) elements.rogueContractProgress.replaceChildren();
    elements.rogueContractProgress?.classList?.remove("is-completed", "is-failed");
    if (pending) {
      if (elements.rogueContractOptions) {
        elements.rogueContractOptions.hidden = false;
        for (const option of state.contractOptions) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "rogue-contract-card";
          button.dataset.contractId = option.id;
          button.title = option.description;
          const buttonState = getRogueContractButtonState({ selected: false, disabled: false });
          button.setAttribute("aria-pressed", String(buttonState.pressed));
          button.setAttribute("aria-disabled", String(buttonState.ariaDisabled));
          const copy = getRogueContractCardCopy(option);
          const title = document.createElement("strong");
          title.textContent = option.label;
          const description = document.createElement("span");
          description.textContent = copy.description;
          const progress = document.createElement("small");
          progress.textContent = copy.progress;
          const reward = document.createElement("small");
          reward.textContent = copy.reward;
          const penalty = document.createElement("small");
          penalty.className = "rogue-contract-penalty";
          penalty.textContent = copy.penalty;
          button.append(title, description, progress, reward, penalty);
          button.addEventListener("click", () => {
            selectedTool = null;
            restoreBoardFocus = true;
            finishAction(boundHandlers?.onSelectContract?.(option.id));
          });
          elements.rogueContractOptions.appendChild(button);
        }
      }
      if (elements.rogueContractProgress) elements.rogueContractProgress.hidden = true;
      return;
    }

    if (elements.rogueContractOptions) elements.rogueContractOptions.hidden = true;
    if (!elements.rogueContractProgress) return;
    elements.rogueContractProgress.hidden = !state.selectedContract;
    if (!state.selectedContract) return;
    const definition = getContractDefinition(state.selectedContract);
    if (!definition) return;
    elements.rogueContractProgress.textContent = getRogueContractProgressText({
      definition,
      progress: state.contractProgress,
      target: state.contractTarget,
      completed: state.contractCompleted,
      failed: state.contractFailed,
      failureReason: state.contractFailureReason,
      context: state.contractContext,
    });
    elements.rogueContractProgress.classList?.toggle("is-completed", Boolean(state.contractCompleted));
    elements.rogueContractProgress.classList?.toggle("is-failed", Boolean(state.contractFailed));
  }

  function renderTools(state) {
    if (!elements.rogueTools) return;
    elements.rogueTools.replaceChildren();
    for (const toolKey of ["scoutPulse", "defusalKit", "reactionShield"]) {
      const definition = getToolDefinition(toolKey);
      const uses = state.level.activeToolUses[toolKey] || 0;
      const disabled = state.selectedContract === null
        || state.status !== "playing"
        || uses <= 0
        || state.energy < definition.cost
        || (toolKey === "reactionShield" && state.level.shieldActive);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rogue-tool";
      button.dataset.toolKey = toolKey;
      button.setAttribute("aria-label", `${definition.label}：${definition.description}`);
      button.setAttribute("aria-pressed", String(selectedTool === toolKey));
      button.setAttribute("aria-disabled", String(disabled));
      button.disabled = disabled;
      if (selectedTool === toolKey) button.classList.add("is-selected");
      const title = document.createElement("strong");
      title.textContent = definition.label;
      const description = document.createElement("span");
      description.textContent = definition.description;
      const resources = document.createElement("small");
      resources.textContent = getRogueToolButtonState({
        selected: selectedTool === toolKey,
        disabled,
        uses,
        cost: definition.cost,
      }).text;
      button.append(title, description, resources);
      button.addEventListener("click", () => {
        const action = getRogueToolButtonAction(selectedTool, toolKey);
        const result = action === "cancel"
          ? boundHandlers?.onCancelTool?.()
          : boundHandlers?.onSelectTool?.(toolKey);
        if (action === "cancel") selectedTool = null;
        else if (result) selectedTool = toolKey;
        finishAction(result, null, null);
      });
      elements.rogueTools.appendChild(button);
    }
  }

  function renderRewards(state) {
    if (!elements.rogueReward || !elements.rogueRewardOptions) return;
    const visible = state.status === "reward";
    elements.rogueReward.hidden = !visible;
    elements.rogueRewardOptions.replaceChildren();
    if (!visible) return;
    for (const option of state.rewardOptions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rogue-reward-card";
      button.dataset.upgradeId = option.id;
      const title = document.createElement("strong");
      title.textContent = option.label;
      const description = document.createElement("span");
      description.textContent = option.description;
      button.append(title, description);
      button.addEventListener("click", () => {
        selectedTool = null;
        finishAction(boundHandlers?.onChooseReward?.(option.id));
      });
      elements.rogueRewardOptions.appendChild(button);
    }
  }

  function renderResult(state) {
    if (!elements.rogueResult) return;
    const visible = state.status === "won" || state.status === "lost";
    elements.rogueResult.hidden = !visible;
    if (!visible) return;
    if (elements.rogueResultTitle) elements.rogueResultTitle.textContent = state.status === "won" ? "战术通关" : "任务失败";
    if (elements.rogueResultText) elements.rogueResultText.textContent = `完成 ${Math.min(state.floor, state.totalFloors)} / ${state.totalFloors} 层，最终得分 ${state.score}。`;
  }

  function render(state, handlers = boundHandlers || {}) {
    boundHandlers = handlers;
    renderHud(state);
    renderSectorSummary(state);
    renderContracts(state);
    renderTools(state);
    renderRewards(state);
    renderResult(state);
    if (!elements.rogueBoard) return;
    const activeElement = document.activeElement;
    const activeRow = Number(activeElement?.dataset?.row);
    const activeCol = Number(activeElement?.dataset?.col);
    const hadBoardFocus = Number.isInteger(activeRow) && Number.isInteger(activeCol);
    if (hadBoardFocus) focusedCell = [activeRow, activeCol];
    elements.rogueBoard.replaceChildren();
    elements.rogueBoard.style.gridTemplateColumns = `repeat(${state.level.cols}, ${BOARD_METRICS.classic.cellSize}px)`;
    for (let row = 0; row < state.level.rows; row++) {
      for (let col = 0; col < state.level.cols; col++) {
        const cell = state.level.board[row][col];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell rogue-cell";
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", buildRogueCellAriaLabel(cell, row, col, state.level.sectors));
        const sector = getSectorForCell(cell, col, state.level.sectors);
        const sectorId = Number.isInteger(cell?.sectorId) ? cell.sectorId : sector?.id;
        if (Number.isInteger(sectorId)) button.dataset.sectorId = String(sectorId);
        button.tabIndex = focusedCell[0] === row && focusedCell[1] === col ? 0 : -1;
        const label = document.createElement("span");
        label.className = "cell-label";
        label.textContent = cellText(cell);
        button.appendChild(label);
        if (cell.revealed) button.classList.add("revealed");
        if (cell.flagged) button.classList.add("flagged");
        if (cell.questioned) button.classList.add("questioned");
        if (cell.mine && cell.revealed) button.classList.add("mine");
        if (cell.neutralized) button.classList.add("neutralized");
        if (cell.exploded) button.classList.add("exploded");
        if (cell.revealed && cell.count > 0) button.classList.add(`num-${cell.count}`);
        for (const className of getRogueSectorClassNames(cell, col, state.level.sectors)) button.classList.add(className);
        for (const className of getRogueSpecialCellClasses(cell)) button.classList.add(className);
        const boardDisabled = state.selectedContract === null
          || state.level.ended
          || ["reward", "won", "lost"].includes(state.status);
        button.disabled = boardDisabled;
        button.setAttribute("aria-disabled", String(boardDisabled));

        button.addEventListener("click", () => {
          if (longPressTriggered) {
            longPressTriggered = false;
            return;
          }
          const action = getRoguePrimaryAction({ markMode, selectedTool, revealed: cell.revealed });
          const result = action === "tool"
            ? boundHandlers?.onUseTool?.(row, col)
            : action === "mark"
              ? boundHandlers?.onCycleMark?.(row, col)
              : action === "chord"
                ? boundHandlers?.onChord?.(row, col)
                : boundHandlers?.onReveal?.(row, col);
          if (action === "tool") selectedTool = getRogueToolSelectionAfterAction(selectedTool, result);
          finishAction(result, row, col);
        });
        button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          finishAction(boundHandlers?.onCycleMark?.(row, col), row, col);
        });
        button.addEventListener("keydown", (event) => {
          if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            const deltas = {
              ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
            };
            moveFocus(state, row, col, ...deltas[event.key]);
          } else if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            finishAction(boundHandlers?.onCycleMark?.(row, col), row, col);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const action = getRoguePrimaryAction({ markMode, selectedTool, revealed: cell.revealed });
            const result = action === "tool"
              ? boundHandlers?.onUseTool?.(row, col)
              : action === "mark"
                ? boundHandlers?.onCycleMark?.(row, col)
                : action === "chord"
                  ? boundHandlers?.onChord?.(row, col)
                  : boundHandlers?.onReveal?.(row, col);
            if (action === "tool") selectedTool = getRogueToolSelectionAfterAction(selectedTool, result);
            finishAction(result, row, col);
          }
        });
        button.addEventListener("pointerdown", (event) => {
          if (boardDisabled || event.pointerType === "mouse") return;
          activePointerId = event.pointerId;
          longPressTriggered = false;
          longPressTimer = setTimeout(() => {
            finishAction(boundHandlers?.onCycleMark?.(row, col), row, col);
            longPressTriggered = true;
            longPressTimer = null;
          }, 450);
        });
        button.addEventListener("pointerup", (event) => {
          if (activePointerId !== event.pointerId) return;
          activePointerId = null;
          if (longPressTimer) clearTimeout(longPressTimer);
          longPressTimer = null;
        });
        button.addEventListener("pointerleave", () => {
          if (longPressTimer) clearTimeout(longPressTimer);
          longPressTimer = null;
        });
        button.addEventListener("pointercancel", () => {
          if (longPressTimer) clearTimeout(longPressTimer);
          longPressTimer = null;
        });
        elements.rogueBoard.appendChild(button);
      }
    }
    if (hadBoardFocus || restoreBoardFocus) {
      const focusButton = elements.rogueBoard.querySelector(`[data-row="${focusedCell[0]}"][data-col="${focusedCell[1]}"]`);
      if (focusButton) focusButton.focus({ preventScroll: true });
    }
    restoreBoardFocus = false;
  }

  function bindHandlers(handlers) {
    boundHandlers = handlers;
    elements.rogueResetButton?.addEventListener("click", () => finishAction(handlers.onReset?.()));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && selectedTool) {
        selectedTool = null;
        finishAction(handlers.onCancelTool?.());
      }
    });
  }

  return {
    render,
    bindHandlers,
    setVisible(visible) {
      if (elements.rogueView) elements.rogueView.hidden = !visible;
    },
    clearToolSelection() {
      selectedTool = null;
    },
    getSelectedTool() {
      return selectedTool;
    },
    setMarkMode(value) {
      markMode = value === "mark" ? "mark" : "reveal";
      if (elements.markModeButton) {
        elements.markModeButton.textContent = markMode === "mark" ? "标记模式：开" : "标记模式：关";
        elements.markModeButton.setAttribute("aria-pressed", String(markMode === "mark"));
      }
    },
    resetTransientInputState() {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
      activePointerId = null;
      longPressTriggered = false;
      selectedTool = null;
    },
  };
}
