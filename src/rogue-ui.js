import { BOARD_METRICS } from "./config.js";
import { getRewardOptions, getToolDefinition, getUpgradeDefinition } from "./rogue-items.js";

export function buildRogueCellAriaLabel(cell, row, col) {
  const position = `第 ${row + 1} 行第 ${col + 1} 列`;
  if (cell.flagged) return `${position}，旗帜`;
  if (cell.questioned) return `${position}，问号`;
  if (!cell.revealed) return `${position}，未揭开`;
  if (cell.mine && cell.neutralized) return `${position}，已拆除的地雷`;
  if (cell.mine) return `${position}，地雷`;
  if (!cell.count) return `${position}，已揭开，空白`;
  return `${position}，已揭开，数字 ${cell.count}`;
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

function cellText(cell) {
  if (cell.flagged) return "🚩";
  if (cell.questioned) return "❓";
  if (!cell.revealed) return "";
  if (cell.mine && cell.neutralized) return "🛠️";
  if (cell.mine) return "💣";
  return cell.count ? String(cell.count) : "";
}

function upgradeText(id) {
  if (id.startsWith("energy:")) return "+1 能量";
  return getUpgradeDefinition(id)?.label || id;
}

export function createRogueUI(elements) {
  let focusedCell = [0, 0];
  let markMode = "reveal";
  let selectedTool = null;
  let longPressTimer = null;
  let activePointerId = null;
  let longPressTriggered = false;
  let boundHandlers = null;

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

  function renderTools(state) {
    if (!elements.rogueTools) return;
    elements.rogueTools.replaceChildren();
    for (const toolKey of ["scoutPulse", "defusalKit", "reactionShield"]) {
      const definition = getToolDefinition(toolKey);
      const uses = state.level.activeToolUses[toolKey] || 0;
      const disabled = state.status !== "playing"
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
        const result = boundHandlers?.onSelectTool?.(toolKey);
        if (result) selectedTool = toolKey;
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
        button.setAttribute("aria-label", buildRogueCellAriaLabel(cell, row, col));
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
            finishAction(result, row, col);
          }
        });
        button.addEventListener("pointerdown", (event) => {
          if (state.status !== "playing" || event.pointerType === "mouse") return;
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
    if (hadBoardFocus) {
      const focusButton = elements.rogueBoard.querySelector(`[data-row="${focusedCell[0]}"][data-col="${focusedCell[1]}"]`);
      if (focusButton) focusButton.focus({ preventScroll: true });
    }
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
