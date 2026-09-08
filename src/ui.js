import { BOARD_METRICS } from "./config.js";

export function nextMarkMode(mode) {
  return mode === "mark" ? "reveal" : "mark";
}

export function buildCellAriaLabel(cell, row, col) {
  const position = `第 ${row + 1} 行第 ${col + 1} 列`;
  if (cell.flagged) return `${position}，已标记为雷`;
  if (cell.questioned) return `${position}，已标记为问号`;
  if (!cell.revealed) return `${position}，未揭开`;
  if (cell.mine) return `${position}，地雷`;
  if (!cell.count) return `${position}，已揭开，空白`;
  return `${position}，已揭开，数字 ${cell.count}`;
}

function isHexMode(state) {
  return state.modeKey === "hex";
}

function isRingMode(state) {
  return state.modeKey === "ring";
}

function cellText(cell, modeKey) {
  if (cell.givenMine) return "💣";
  if (modeKey === "sudoku") {
    if (cell.mine && cell.revealed) return "💣";
    if (cell.flagged) return "🚩";
    if (cell.crossed) return "✕";
    return "";
  }
  if (!cell.revealed) return cell.flagged ? "🚩" : cell.questioned ? "❓" : "";
  if (cell.mine) return "💣";
  return cell.count ? String(cell.count) : "";
}

function sectorClipPath(outerRatio, innerRatio, angleStart, angleEnd, steps = 4) {
  const points = [];
  const addArc = (radius, from, to) => {
    for (let index = 0; index <= steps; index++) {
      const angle = from + ((to - from) * index) / steps;
      points.push([50 + Math.cos(angle) * 50 * radius, 50 + Math.sin(angle) * 50 * radius]);
    }
  };
  addArc(outerRatio, angleStart, angleEnd);
  addArc(innerRatio, angleEnd, angleStart);
  return `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ")})`;
}

export function createUI(elements) {
  let longPressTimer = null;
  let activePointerId = null;
  let longPressTriggered = false;
  let focusedCell = [0, 0];
  let markMode = "reveal";
  let sudokuCrossDrag = null;
  let sudokuCrossClickSuppressed = false;

  function renderHud(state) {
    const flagged = state.board.flat().filter((cell) => cell.flagged).length;
    if (elements.boardMineCounterEl) elements.boardMineCounterEl.textContent = `剩余 ${Math.max(0, state.mines - flagged)}`;
    if (elements.boardMineMetaEl) elements.boardMineMetaEl.textContent = `已标记 ${flagged} / 总雷数 ${state.mines}`;
    if (elements.timerEl) elements.timerEl.textContent = state.started ? state.timer.toFixed(3) : "0.000";
  }

  function setFocus(row, col) {
    focusedCell = [row, col];
    const button = elements.boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (button) button.focus({ preventScroll: true });
  }

  function moveFocus(state, row, col, rowDelta, colDelta) {
    const nextRow = Math.max(0, Math.min(state.rows - 1, row + rowDelta));
    const nextCol = Math.max(0, Math.min(state.cols - 1, col + colDelta));
    setFocus(nextRow, nextCol);
  }

  function handlePrimary(row, col, state, handlers) {
    if (markMode === "mark" && state.modeKey !== "sudoku") return handlers.onCycleMark(row, col);
    if (state.modeKey === "sudoku") return handlers.onReveal(row, col);
    const cell = state.board[row][col];
    return cell.revealed ? handlers.onChord(row, col) : handlers.onReveal(row, col);
  }

  function render(state, handlers) {
    if (!elements.boardEl) return;
    const activeElement = document.activeElement;
    const activeRow = Number(activeElement?.dataset?.row);
    const activeCol = Number(activeElement?.dataset?.col);
    if (Number.isInteger(activeRow) && Number.isInteger(activeCol)) focusedCell = [activeRow, activeCol];

    elements.boardEl.innerHTML = "";
    elements.boardEl.classList.remove("hex-mode", "ring-mode");
    elements.boardEl.style.display = "grid";
    if (isRingMode(state)) {
      elements.boardEl.classList.add("ring-mode");
      const { innerRadius, radialStep, ringGap } = BOARD_METRICS.ring;
      const outerRadius = innerRadius + (state.rows - 1) * radialStep;
      const size = outerRadius * 2 + radialStep * 2 + ringGap * 2 + 18;
      elements.boardEl.style.gridTemplateColumns = "none";
      elements.boardEl.style.width = `${size}px`;
      elements.boardEl.style.height = `${size}px`;
      elements.boardEl.style.position = "relative";
    } else if (isHexMode(state)) {
      elements.boardEl.classList.add("hex-mode");
      const { cellW, cellH, xStep, yStep } = BOARD_METRICS.hex;
      elements.boardEl.style.gridTemplateColumns = "none";
      elements.boardEl.style.width = `${(state.cols - 1) * xStep + cellW}px`;
      elements.boardEl.style.height = `${(state.rows - 1) * yStep + cellH + yStep / 2}px`;
      elements.boardEl.style.position = "relative";
    } else {
      elements.boardEl.style.gridTemplateColumns = `repeat(${state.cols}, ${BOARD_METRICS.classic.cellSize}px)`;
      elements.boardEl.style.width = "";
      elements.boardEl.style.height = "";
      elements.boardEl.style.position = "";
    }

    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) {
        const cell = state.board[row][col];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", buildCellAriaLabel(cell, row, col));
        button.tabIndex = focusedCell[0] === row && focusedCell[1] === col ? 0 : -1;

        const label = document.createElement("span");
        label.className = "cell-label";
        label.textContent = cellText(cell, state.modeKey);
        button.append(label);

        if (state.modeKey === "sudoku") {
          button.classList.add("sudoku", `region-${cell.region}`);
          if (cell.givenMine) button.classList.add("given-mine");
          if (cell.crossed) button.classList.add("crossed");
        }
        if (cell.revealed) button.classList.add("revealed");
        if (cell.flagged) button.classList.add("flagged");
        if (cell.questioned) button.classList.add("questioned");
        if (cell.mine && cell.revealed) button.classList.add("mine");
        if (cell.exploded) button.classList.add("exploded");
        if (state.hint?.target?.[0] === row && state.hint.target[1] === col) button.classList.add("hint-target");
        if (state.hint?.related?.some(([hintRow, hintCol]) => hintRow === row && hintCol === col)) button.classList.add("hint-related");
        if (cell.revealed && cell.count > 0) button.classList.add(`num-${cell.count}`);

        if (isHexMode(state)) {
          button.classList.add("hex-cell");
          const { cellW, cellH, xStep, yStep } = BOARD_METRICS.hex;
          button.style.position = "absolute";
          button.style.left = `${col * xStep}px`;
          button.style.top = `${row * yStep + (col % 2 ? yStep / 2 : 0)}px`;
          button.style.width = `${cellW}px`;
          button.style.height = `${cellH}px`;
        } else if (isRingMode(state)) {
          button.classList.add("ring-cell");
          const { innerRadius, radialStep, ringGap } = BOARD_METRICS.ring;
          const boardRadius = innerRadius + state.rows * radialStep + ringGap;
          const boardCenter = boardRadius + 9;
          const bandStart = innerRadius + row * radialStep;
          const bandEnd = bandStart + radialStep;
          const radialPad = Math.min(4, radialStep * 0.14);
          const angleStep = (Math.PI * 2) / state.cols;
          const anglePad = angleStep * 0.14;
          const angleStart = (col / state.cols) * Math.PI * 2 - Math.PI / 2 + anglePad;
          const angleEnd = ((col + 1) / state.cols) * Math.PI * 2 - Math.PI / 2 - anglePad;
          const angleMiddle = (angleStart + angleEnd) / 2;
          const labelRadius = (bandStart + bandEnd) / 2;
          const boxSize = bandEnd * 2;
          button.style.position = "absolute";
          button.style.left = `${boardCenter - bandEnd}px`;
          button.style.top = `${boardCenter - bandEnd}px`;
          button.style.width = `${boxSize}px`;
          button.style.height = `${boxSize}px`;
          button.style.borderRadius = "0";
          button.style.clipPath = sectorClipPath((bandEnd - radialPad) / bandEnd, Math.max(0.12, (bandStart + radialPad) / bandEnd), angleStart, angleEnd);
          label.style.left = `${boxSize / 2 + Math.cos(angleMiddle) * labelRadius}px`;
          label.style.top = `${boxSize / 2 + Math.sin(angleMiddle) * labelRadius}px`;
        }

        button.addEventListener("click", (event) => {
          if (longPressTriggered) {
            longPressTriggered = false;
            event.preventDefault();
            return;
          }
          focusedCell = [row, col];
          const result = handlePrimary(row, col, state, handlers);
          handlers.onStatus(result);
        });
        button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          focusedCell = [row, col];
          const result = handlers.onCycleMark(row, col);
          handlers.onStatus(result);
        });
        button.addEventListener("keydown", (event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const deltas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
            moveFocus(state, row, col, ...deltas[event.key]);
            return;
          }
          if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            focusedCell = [row, col];
            const result = handlers.onCycleMark(row, col);
            handlers.onStatus(result);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            focusedCell = [row, col];
            const result = handlePrimary(row, col, state, handlers);
            handlers.onStatus(result);
          }
        });
        button.addEventListener("pointerdown", (event) => {
          if (state.ended || event.pointerType === "mouse") return;
          activePointerId = event.pointerId;
          longPressTriggered = false;
          longPressTimer = setTimeout(() => {
            handlers.onStatus(handlers.onCycleMark(row, col));
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
        elements.boardEl.appendChild(button);
      }
    }
    renderHud(state);
    const [focusRow, focusCol] = focusedCell;
    if (state.board[focusRow]?.[focusCol]) {
      const focusButton = elements.boardEl.querySelector(`[data-row="${focusRow}"][data-col="${focusCol}"]`);
      if (focusButton && activeElement?.dataset?.row !== undefined) focusButton.focus({ preventScroll: true });
    }
  }

  function setStatus(text) {
    if (elements.statusTextEl) elements.statusTextEl.textContent = text;
  }

  function setResetEmoji(text) {
    if (elements.resetButton) elements.resetButton.textContent = text;
  }

  function setHintFeedback(text) {
    if (elements.hintFeedbackEl) elements.hintFeedbackEl.textContent = text;
  }

  function setMarkMode(value) {
    markMode = value === "mark" ? "mark" : "reveal";
    if (elements.markModeButton) {
      elements.markModeButton.textContent = markMode === "mark" ? "标记模式：开" : "标记模式：关";
      elements.markModeButton.setAttribute("aria-pressed", String(markMode === "mark"));
    }
  }

  function applyTheme(themeKey, theme) {
    document.documentElement.dataset.theme = themeKey;
    document.documentElement.style.setProperty("--bg0", theme.page[1]);
    document.documentElement.style.setProperty("--bg1", theme.page[0]);
    document.documentElement.style.setProperty("--panel", theme.panel);
    document.documentElement.style.setProperty("--panel-border", theme.panelBorder);
    document.documentElement.style.setProperty("--text", theme.text);
    document.documentElement.style.setProperty("--muted", theme.muted);
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--accent2", theme.accent2);
    document.documentElement.style.setProperty("--danger", theme.danger);
    document.documentElement.style.setProperty("--win", theme.win);
    document.documentElement.style.setProperty("--cell-up", theme.cellUp);
    document.documentElement.style.setProperty("--cell-down", theme.cellDown);
    document.documentElement.style.setProperty("--cell-border", theme.cellBorder);
    document.documentElement.style.setProperty("--cell-inset", theme.cellInset);
    document.documentElement.style.setProperty("--control-bg", theme.controlBg);
    document.documentElement.style.setProperty("--control-text", theme.controlText);
    document.documentElement.style.setProperty("--control-border", theme.controlBorder);
  }

  function applyBackground(url) {
    if (!elements.pageBackdropEl) return;
    elements.pageBackdropEl.style.backgroundImage = url ? `url("${url}")` : "none";
    elements.pageBackdropEl.style.backgroundSize = "cover";
    elements.pageBackdropEl.style.backgroundPosition = "center";
    elements.pageBackdropEl.style.backgroundRepeat = "no-repeat";
  }

  function applyBackgroundOpacity(value) {
    document.documentElement.style.setProperty("--bg-opacity", value);
  }

  function bindHandlers(handlers) {
    elements.resetButton?.addEventListener("click", handlers.onReset);
    elements.hintButton?.addEventListener("click", handlers.onHint);
    elements.markModeButton?.addEventListener("click", () => setMarkMode(nextMarkMode(markMode)));
    elements.difficultySelect?.addEventListener("change", (event) => handlers.onDifficultyChange(event.target.value));
    elements.modeSelect?.addEventListener("change", (event) => handlers.onModeChange(event.target.value));
    elements.generationModeSelect?.addEventListener("change", (event) => handlers.onGenerationModeChange(event.target.value));
    elements.applyCustomDifficultyButton?.addEventListener("click", handlers.onApplyCustomDifficulty);
    elements.themeSelect?.addEventListener("change", (event) => handlers.onThemeChange(event.target.value));
    elements.bgUpload?.addEventListener("change", (event) => handlers.onBackgroundUpload(event.target.files?.[0]));
    elements.clearBgButton?.addEventListener("click", handlers.onClearBackground);
    elements.bgOpacity?.addEventListener("input", (event) => handlers.onBackgroundOpacityChange(event.target.value));
    window.addEventListener("keydown", (event) => {
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase();
      if (event.key.toLowerCase() === "r" && !["input", "select", "textarea"].includes(tagName)) handlers.onReset();
    });
  }

  function resetTransientInputState() {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
    activePointerId = null;
    longPressTriggered = false;
    sudokuCrossDrag = null;
    sudokuCrossClickSuppressed = false;
  }

  return {
    render,
    renderHud,
    setStatus,
    setResetEmoji,
    applyTheme,
    applyBackground,
    applyBackgroundOpacity,
    setHintFeedback,
    setMarkMode,
    setGenerationModeVisible(visible) {
      if (elements.generationModeField) elements.generationModeField.hidden = !visible;
    },
    setDifficulty(value) { if (elements.difficultySelect) elements.difficultySelect.value = value; },
    setMode(value) { if (elements.modeSelect) elements.modeSelect.value = value; },
    setTheme(value) { if (elements.themeSelect) elements.themeSelect.value = value; },
    setGenerationMode(value) { if (elements.generationModeSelect) elements.generationModeSelect.value = value; },
    setBackgroundOpacityValue(value) { if (elements.bgOpacity) elements.bgOpacity.value = value; },
    bindHandlers,
    resetTransientInputState,
  };
}
