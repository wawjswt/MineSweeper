export function createUI({
  boardEl,
  resetButton,
  difficultySelect,
  modeSelect,
  themeSelect,
  bgUpload,
  bgOpacity,
  clearBgButton,
  boardMineCounterEl,
  boardMineMetaEl,
  timerEl,
  statusTextEl,
  pageBackdropEl,
}) {
  let longPressTimer = null;
  let activePointerId = null;

  function renderHud(state) {
    const flagged = state.board.flat().filter((c) => c.flagged).length;
    boardMineCounterEl.textContent = `剩余 ${Math.max(0, state.mines - flagged)}`;
    boardMineMetaEl.textContent = `已标记 ${flagged} / 总雷数 ${state.mines}`;
    timerEl.textContent = String(state.timer).padStart(1, "0");
  }

  function cellText(cell) {
    if (cell.givenMine) return "💣";
    if (cell.region !== undefined && cell.region !== null && cell.revealed && cell.count === 0 && !cell.mine) {
      return "";
    }
    if (!cell.revealed) return cell.flagged ? "🚩" : cell.questioned ? "❓" : "";
    if (cell.mine) return "💣";
    return cell.count ? String(cell.count) : "";
  }

  function render(state, handlers) {
    boardEl.innerHTML = "";
    boardEl.classList.remove("hex-mode", "ring-mode");
    boardEl.style.display = "grid";
    boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 34px)`;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.board[r][c];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.row = String(r);
        btn.dataset.col = String(c);
        if (state.modeKey === "sudoku") {
          btn.classList.add("sudoku");
          btn.classList.add(`region-${cell.region}`);
          if (cell.givenMine) btn.classList.add("given-mine");
        }
        btn.textContent = cellText(cell);
        if (cell.revealed) btn.classList.add("revealed");
        if (cell.flagged) btn.classList.add("flagged");
        if (cell.questioned) btn.classList.add("questioned");
        if (cell.mine && cell.revealed) btn.classList.add("mine");
        if (cell.exploded) btn.classList.add("exploded");
        if (cell.revealed && cell.count > 0) btn.classList.add(`num-${cell.count}`);
        btn.addEventListener("click", () => {
          if (state.modeKey === "sudoku") return handlers.onReveal(r, c);
          return cell.revealed ? handlers.onChord(r, c) : handlers.onReveal(r, c);
        });
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          handlers.onCycleMark(r, c);
        });
        btn.addEventListener("pointerdown", (e) => {
          if (state.ended || e.pointerType === "mouse") return;
          activePointerId = e.pointerId;
          longPressTimer = setTimeout(() => {
            handlers.onCycleMark(r, c);
            longPressTimer = null;
          }, 450);
        });
        btn.addEventListener("pointerup", (e) => {
          if (activePointerId !== e.pointerId) return;
          activePointerId = null;
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        });
        btn.addEventListener("pointerleave", () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        });
        btn.addEventListener("pointercancel", () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        });
        boardEl.appendChild(btn);
      }
    }
    renderHud(state);
  }

  function setStatus(text) {
    statusTextEl.textContent = text;
  }

  function setResetEmoji(text) {
    resetButton.textContent = text;
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
    pageBackdropEl.style.backgroundImage = url ? `url("${url}")` : "none";
    pageBackdropEl.style.backgroundSize = "cover";
    pageBackdropEl.style.backgroundPosition = "center";
    pageBackdropEl.style.backgroundRepeat = "no-repeat";
  }

  function applyBackgroundOpacity(value) {
    document.documentElement.style.setProperty("--bg-opacity", value);
  }

  function setDifficulty(value) {
    difficultySelect.value = value;
  }

  function setTheme(value) {
    themeSelect.value = value;
  }

  function setBackgroundOpacityValue(value) {
    bgOpacity.value = value;
  }

  function bindHandlers(handlers) {
    resetButton.addEventListener("click", handlers.onReset);
    difficultySelect.addEventListener("change", (e) => handlers.onDifficultyChange(e.target.value));
    if (modeSelect) modeSelect.addEventListener("change", (e) => handlers.onModeChange(e.target.value));
    themeSelect.addEventListener("change", (e) => handlers.onThemeChange(e.target.value));
    bgUpload.addEventListener("change", (e) => handlers.onBackgroundUpload(e.target.files && e.target.files[0]));
    clearBgButton.addEventListener("click", handlers.onClearBackground);
    bgOpacity.addEventListener("input", (e) => handlers.onBackgroundOpacityChange(e.target.value));
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "r") handlers.onReset();
    });
  }

  function resetTransientInputState() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    activePointerId = null;
  }

  return {
    render,
    renderHud,
    setStatus,
    setResetEmoji,
    applyTheme,
    applyBackground,
    applyBackgroundOpacity,
    setDifficulty,
    setMode(value) {
      if (modeSelect) modeSelect.value = value;
    },
    setTheme,
    setBackgroundOpacityValue,
    bindHandlers,
    resetTransientInputState,
  };
}
