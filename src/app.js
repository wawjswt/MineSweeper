import {
  CUSTOM_DIFFICULTY_CONFIG,
  DIFFICULTIES,
  HEX_DIFFICULTIES,
  MODES,
  RING_DIFFICULTIES,
  SUDOKU_DIFFICULTIES,
  THEMES,
} from "./config.js";
import { makeState } from "./state.js";
import { createGameLogic } from "./game.js";
import { createUI } from "./ui.js";
import { createRogueGame } from "./rogue-game.js";
import {
  createRogueGuide,
} from "./rogue-guide.js";
import { createRogueUI } from "./rogue-ui.js";
import { create2048UI } from "./2048-ui.js";
import { compressImageDataUrl, loadImageSource } from "./image.js";
import {
  loadSettings,
  saveBackgroundOpacity,
  saveBackgroundUrl,
  saveGenerationMode,
  saveModeKey,
  saveThemeKey,
} from "./storage.js";

const elements = {
  boardEl: document.getElementById("board"),
  classicHud: document.getElementById("classicHud"),
  classicControls: document.getElementById("classicControls"),
  classicHintCard: document.getElementById("classicHintCard"),
  classicBoardWrap: document.getElementById("classicBoardWrap"),
  sweepTitleEl: document.getElementById("sweepTitle"),
  sweepTaglineEl: document.getElementById("sweepTagline"),
  rogueView: document.getElementById("rogueView"),
  rogueFloor: document.getElementById("rogueFloor"),
  rogueLives: document.getElementById("rogueLives"),
  rogueEnergy: document.getElementById("rogueEnergy"),
  rogueScore: document.getElementById("rogueScore"),
  rogueUpgradeSummary: document.getElementById("rogueUpgradeSummary"),
  rogueSectorSummary: document.getElementById("rogueSectorSummary"),
  rogueContractPanel: document.getElementById("rogueContractPanel"),
  rogueContractTitle: document.getElementById("rogueContractTitle"),
  rogueContractOptions: document.getElementById("rogueContractOptions"),
  rogueContractProgress: document.getElementById("rogueContractProgress"),
  rogueTools: document.getElementById("rogueTools"),
  rogueFeedback: document.getElementById("rogueFeedback"),
  rogueBoard: document.getElementById("rogueBoard"),
  rogueReward: document.getElementById("rogueReward"),
  rogueRewardOptions: document.getElementById("rogueRewardOptions"),
  rogueResult: document.getElementById("rogueResult"),
  rogueResultTitle: document.getElementById("rogueResultTitle"),
  rogueResultText: document.getElementById("rogueResultText"),
  rogueResetButton: document.getElementById("rogueResetButton"),
  rogueGuideButton: document.getElementById("rogueGuideButton"),
  rogueGuideDialog: document.getElementById("rogueGuideDialog"),
  rogueGuideClose: document.getElementById("rogueGuideClose"),
  rogueGuideChapters: document.getElementById("rogueGuideChapters"),
  rogueGuideContent: document.getElementById("rogueGuideContent"),
  resetButton: document.getElementById("resetButton"),
  hintButton: document.getElementById("hintButton"),
  markModeButton: document.getElementById("markModeButton"),
  difficultySelect: document.getElementById("difficultySelect"),
  modeSelect: document.getElementById("modeSelect"),
  generationModeField: document.getElementById("generationModeField"),
  generationModeSelect: document.getElementById("generationModeSelect"),
  customDifficultyCard: document.getElementById("customDifficultyCard"),
  customRows: document.getElementById("customRows"),
  customCols: document.getElementById("customCols"),
  customMines: document.getElementById("customMines"),
  customRowsLabel: document.getElementById("customRowsLabel"),
  customColsLabel: document.getElementById("customColsLabel"),
  customMinesLabel: document.getElementById("customMinesLabel"),
  applyCustomDifficultyButton: document.getElementById("applyCustomDifficultyButton"),
  themeSelect: document.getElementById("themeSelect"),
  bgUpload: document.getElementById("bgUpload"),
  bgOpacity: document.getElementById("bgOpacity"),
  clearBgButton: document.getElementById("clearBgButton"),
  boardMineCounterEl: document.getElementById("boardMineCounter"),
  boardMineMetaEl: document.getElementById("boardMineMeta"),
  gameHintEl: document.getElementById("gameHint"),
  hintFeedbackEl: document.getElementById("hintFeedback"),
  timerEl: document.getElementById("timer"),
  statusTextEl: document.getElementById("statusText"),
  bestTimeEl: document.getElementById("bestTime"),
  pageBackdropEl: document.getElementById("pageBackdrop"),
  fireworksLayer: document.getElementById("fireworksLayer"),
  game2048Root: document.getElementById("game2048Shell"),
  game2048Board: document.getElementById("game2048Board"),
  game2048Score: document.getElementById("game2048Score"),
  game2048Best: document.getElementById("game2048Best"),
  game2048Status: document.getElementById("game2048Status"),
  game2048Overlay: document.getElementById("game2048Overlay"),
  game2048OverlayTitle: document.getElementById("game2048OverlayTitle"),
  game2048OverlayText: document.getElementById("game2048OverlayText"),
  game2048Continue: document.getElementById("game2048Continue"),
  game2048New: document.getElementById("game2048New"),
  game2048OverlayNew: document.getElementById("game2048OverlayNew"),
  game2048Up: document.getElementById("game2048Up"),
  game2048Down: document.getElementById("game2048Down"),
  game2048Left: document.getElementById("game2048Left"),
  game2048Right: document.getElementById("game2048Right"),
};

const storage = loadSettings();
const validModes = Object.keys(MODES);
let modeKey = validModes.includes(storage.modeKey) ? storage.modeKey : "classic";
let difficultyKey = elements.difficultySelect.value;
let generationMode = storage.generationMode === "no-guess" ? "no-guess" : "standard";
let state = null;
let noticeText = "";
let victoryFireworksTimeout = null;

function isHexMode() {
  return modeKey === "hex";
}

function isRingMode() {
  return modeKey === "ring";
}

function isRogueMode() {
  return modeKey === "rogue";
}

function getCatalog() {
  if (modeKey === "sudoku") return SUDOKU_DIFFICULTIES;
  if (modeKey === "hex") return HEX_DIFFICULTIES;
  if (modeKey === "ring") return RING_DIFFICULTIES;
  return DIFFICULTIES;
}

function getCustomConfig() {
  return CUSTOM_DIFFICULTY_CONFIG[modeKey] || CUSTOM_DIFFICULTY_CONFIG.classic;
}

function clampInt(value, min, max, fallback) {
  const number = Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

function getCustomStorageKey(field) {
  return `minesweeper-custom-${modeKey}-${field}`;
}

function readCustomValue(field, fallback) {
  const modeValue = localStorage.getItem(getCustomStorageKey(field));
  const legacyValue = modeKey === "classic" ? localStorage.getItem(`minesweeper-custom-${field}`) : null;
  const value = modeValue ?? legacyValue;
  return value === null ? fallback : Number(value);
}

function getCustomFormValues() {
  const config = getCustomConfig();
  const [defaultRows, defaultCols, defaultMines] = config.defaults;
  const rows = clampInt(Number(elements.customRows.value), config.row[0], config.row[1], defaultRows);
  const cols = clampInt(Number(elements.customCols.value), config.col[0], config.col[1], defaultCols);
  const maxMines = Math.max(1, rows * cols - 9);
  const mines = clampInt(Number(elements.customMines.value), 1, maxMines, Math.min(defaultMines, maxMines));
  return { rows, cols, mines, maxMines };
}

function syncCustomDifficultyForm() {
  const config = getCustomConfig();
  const [defaultRows, defaultCols, defaultMines] = config.defaults;
  const rows = clampInt(readCustomValue("rows", defaultRows), config.row[0], config.row[1], defaultRows);
  const cols = clampInt(readCustomValue("cols", defaultCols), config.col[0], config.col[1], defaultCols);
  const maxMines = Math.max(1, rows * cols - 9);
  const mines = clampInt(readCustomValue("mines", defaultMines), 1, maxMines, Math.min(defaultMines, maxMines));
  elements.customRowsLabel.textContent = config.rowLabel;
  elements.customColsLabel.textContent = config.colLabel;
  elements.customMinesLabel.textContent = "雷";
  elements.customRows.min = String(config.row[0]);
  elements.customRows.max = String(config.row[1]);
  elements.customCols.min = String(config.col[0]);
  elements.customCols.max = String(config.col[1]);
  elements.customMines.max = String(maxMines);
  elements.customRows.setAttribute("aria-label", `自定义${config.rowLabel}`);
  elements.customCols.setAttribute("aria-label", `自定义${config.colLabel}`);
  elements.customRows.value = String(rows);
  elements.customCols.value = String(cols);
  elements.customMines.value = String(mines);
  elements.applyCustomDifficultyButton.textContent = `应用${MODES[modeKey].label}自定义`;
}

function getDifficultySpec() {
  if (modeKey === "sudoku") return SUDOKU_DIFFICULTIES[difficultyKey] || SUDOKU_DIFFICULTIES.easy;
  if (difficultyKey === "custom") {
    const { rows, cols, mines } = getCustomFormValues();
    return { name: "自定义", rows, cols, mines };
  }
  return getCatalog()[difficultyKey] || getCatalog().normal || getCatalog().easy;
}

function formatDifficultyLabel(spec) {
  if (isRingMode()) return `${spec.name} ${spec.rows}圈 × ${spec.cols}格 · ${spec.mines}雷`;
  return `${spec.name} ${spec.rows}×${spec.cols} · ${spec.mines}雷`;
}

function updateCustomDifficultyVisibility() {
  const visible = modeKey === "classic" && difficultyKey === "custom";
  elements.customDifficultyCard.hidden = !visible;
  elements.customDifficultyCard.setAttribute("aria-hidden", String(!visible));
}

function updateGenerationModeVisibility() {
  const visible = modeKey === "classic";
  ui.setGenerationModeVisible(visible);
  if (!visible) generationMode = "standard";
  ui.setGenerationMode(generationMode);
}

function normalizeDifficultySelection() {
  const catalog = getCatalog();
  if (!catalog[difficultyKey] && !(modeKey !== "sudoku" && difficultyKey === "custom")) difficultyKey = modeKey === "sudoku" ? "easy" : "normal";
  if (modeKey === "sudoku" && difficultyKey === "custom") difficultyKey = "easy";
  elements.difficultySelect.value = difficultyKey;
  updateCustomDifficultyVisibility();
  return difficultyKey;
}

function refreshDifficultyOptions() {
  const catalog = getCatalog();
  elements.difficultySelect.replaceChildren();
  const keys = modeKey === "sudoku" ? ["easy", "normal", "hard", "extreme", "expert"] : ["easy", "normal", "hard", "extreme"];
  for (const key of keys) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = formatDifficultyLabel(catalog[key]);
    elements.difficultySelect.appendChild(option);
  }
  if (modeKey !== "sudoku") {
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "自定义";
    elements.difficultySelect.appendChild(customOption);
  }
  normalizeDifficultySelection();
}

function getDifficultyRecordKey() {
  const prefix = modeKey === "hex" ? "hex" : isRingMode() ? "ring" : modeKey === "sudoku" ? "sudoku" : modeKey === "offset" ? "offset" : "classic";
  if (difficultyKey === "custom") {
    return `minesweeper-best-${prefix}-custom-${elements.customRows.value}x${elements.customCols.value}-${elements.customMines.value}`;
  }
  return `minesweeper-best-${prefix}-${difficultyKey}`;
}

function loadBestTime() {
  const value = Number(localStorage.getItem(getDifficultyRecordKey()));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function saveBestTime(seconds) {
  localStorage.setItem(getDifficultyRecordKey(), seconds.toFixed(3));
}

function renderBestTime() {
  const best = loadBestTime();
  elements.bestTimeEl.textContent = best === null ? "--" : best.toFixed(3);
}

function renderHintText() {
  if (modeKey === "sudoku") {
    elements.gameHintEl.innerHTML = "数独扫雷：左键打叉，右键标雷。目标是按行、列、同色块和不相邻规则找出全部雷。";
  } else if (modeKey === "offset") {
    elements.gameHintEl.innerHTML = "左键揭开，右键/长按标记，点数字可快速展开。数字表示上方一格为中心的九宫格雷数。";
  } else if (isHexMode()) {
    elements.gameHintEl.innerHTML = "Hex 扫雷使用六边形邻域；左键揭开，右键/长按标记，点数字可快速展开。";
  } else if (isRingMode()) {
    elements.gameHintEl.innerHTML = "环形棋盘的左右边缘相连；左键揭开，右键/长按标记，点数字可快速展开。";
  } else {
    elements.gameHintEl.innerHTML = "左键揭开，右键/长按标记，点数字可快速展开，按 <kbd>R</kbd> 重开。";
  }
}

function clearHint() {
  state.hint = null;
  noticeText = "";
  ui.setHintFeedback("");
}

function syncGame(status) {
  if (status === "win") {
    state.ended = true;
    state.win = true;
    const currentBest = loadBestTime();
    if (currentBest === null || state.timer < currentBest) saveBestTime(state.timer);
    ui.setResetEmoji("🎆");
    ui.setStatus("胜利");
    noticeText = "恭喜通关！";
    launchVictoryFireworks();
    renderBestTime();
  } else if (status === "lose") {
    state.ended = true;
    state.win = false;
    ui.setResetEmoji("😵");
    ui.setStatus("失败");
    noticeText = "本局已结束。";
    clearVictoryFireworks();
  } else if (!state.started) {
    ui.setResetEmoji("😊");
    ui.setStatus("待开始");
  } else {
    ui.setResetEmoji("😊");
    ui.setStatus("进行中");
  }
  ui.setHintFeedback(state.notice || noticeText);
  ui.render(state, {
    onReveal: handleReveal,
    onChord: handleChord,
    onCycleMark: handleCycleMark,
    onStatus: syncGame,
  });
}

function handleReveal(row, col) {
  clearHint();
  const result = game.reveal(row, col, () => ui.renderHud(state));
  if (state.notice) noticeText = state.notice;
  syncGame(result);
}

function handleChord(row, col) {
  clearHint();
  const result = game.chord(row, col, () => ui.renderHud(state));
  syncGame(result);
}

function handleCycleMark(row, col) {
  clearHint();
  const result = game.cycleMark(row, col);
  syncGame(result);
}

function handleHint() {
  if (isRogueMode()) return;
  const hint = game.getHint();
  state.hint = hint.kind === "safe" || hint.kind === "mine" ? hint : null;
  noticeText = hint.message;
  ui.setHintFeedback(hint.message);
  ui.render(state, {
    onReveal: handleReveal,
    onChord: handleChord,
    onCycleMark: handleCycleMark,
    onStatus: syncGame,
  });
}

function setRogueVisibility(visible) {
  if (!visible && rogueGuideController.close({ restoreFocus: false })) elements.modeSelect?.focus();
  if (elements.classicHud) elements.classicHud.hidden = visible;
  if (elements.classicHintCard) elements.classicHintCard.hidden = visible;
  if (elements.classicBoardWrap) elements.classicBoardWrap.hidden = visible;
  if (elements.rogueView) elements.rogueView.hidden = !visible;
  if (elements.sweepTitleEl) elements.sweepTitleEl.textContent = visible ? "战术扫雷" : "扫雷";
  if (elements.sweepTaglineEl) {
    elements.sweepTaglineEl.textContent = visible
      ? "管理生命与能量，使用工具穿越五层雷区。"
      : "首点安全，理性推理，严谨通关。";
  }
}

function renderRogue() {
  rogueUI.render(rogueGame.getState(), rogueHandlers);
}

function resetRogueGame() {
  game.resetTimer();
  ui.resetTransientInputState();
  rogueUI.resetTransientInputState();
  rogueGame.reset();
  clearVictoryFireworks();
  setRogueVisibility(true);
  ui.setMarkMode("reveal");
  rogueUI.setMarkMode("reveal");
  renderRogue();
}

function resetGame() {
  if (isRogueMode()) {
    resetRogueGame();
    return;
  }
  game.resetTimer();
  ui.resetTransientInputState();
  noticeText = "";
  const spec = getDifficultySpec();
  state = makeState(spec, modeKey);
  if (modeKey === "sudoku") game.prepareSudoku();
  ui.setResetEmoji("😊");
  ui.setStatus("待开始");
  ui.setHintFeedback("");
  ui.render(state, {
    onReveal: handleReveal,
    onChord: handleChord,
    onCycleMark: handleCycleMark,
    onStatus: syncGame,
  });
  renderHintText();
  renderBestTime();
}

function clearVictoryFireworks() {
  if (victoryFireworksTimeout) {
    clearTimeout(victoryFireworksTimeout);
    victoryFireworksTimeout = null;
  }
  if (elements.fireworksLayer) elements.fireworksLayer.innerHTML = "";
}

function launchVictoryFireworks() {
  if (!elements.fireworksLayer) return;
  clearVictoryFireworks();
  const layer = elements.fireworksLayer;
  const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1280);
  const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 720);
  const colors = ["#ff6b6b", "#ffd166", "#4dd0e1", "#7bed9f", "#a78bfa", "#ff8fab"];
  for (let index = 0; index < 8; index++) {
    const burst = document.createElement("span");
    burst.className = "firework-burst";
    const angle = (index / 8) * Math.PI * 2;
    const radius = Math.min(width, height) * (0.06 + Math.random() * 0.18);
    burst.style.left = `${Math.round(width * 0.5 + Math.cos(angle) * radius + (Math.random() - 0.5) * 140)}px`;
    burst.style.top = `${Math.round(height * 0.36 + Math.sin(angle) * radius * 0.7 + (Math.random() - 0.5) * 90)}px`;
    burst.style.setProperty("--burst-color", colors[index % colors.length]);
    burst.style.setProperty("--burst-delay", `${index * 130}ms`);
    const core = document.createElement("span");
    core.className = "firework-core";
    burst.appendChild(core);
    for (let sparkIndex = 0; sparkIndex < 18; sparkIndex++) {
      const spark = document.createElement("span");
      const sparkAngle = (Math.PI * 2 * sparkIndex) / 18;
      const distance = 42 + Math.random() * 78;
      spark.className = "firework-spark";
      spark.style.setProperty("--dx", `${Math.cos(sparkAngle) * distance}px`);
      spark.style.setProperty("--dy", `${Math.sin(sparkAngle) * distance}px`);
      spark.style.setProperty("--firework-color", colors[index % colors.length]);
      burst.appendChild(spark);
    }
    setTimeout(() => layer.appendChild(burst), index * 110);
  }
  victoryFireworksTimeout = setTimeout(clearVictoryFireworks, 3200);
}

const ui = createUI(elements);
const game = createGameLogic({
  getState: () => state,
  getDifficultySpec,
  getGenerationMode: () => generationMode,
});
const rogueUI = createRogueUI(elements);
const rogueGame = createRogueGame({ rng: Math.random });
const rogueGuideController = createRogueGuide(elements);
const game2048UI = create2048UI({
  root: elements.game2048Root,
  board: elements.game2048Board,
  score: elements.game2048Score,
  best: elements.game2048Best,
  status: elements.game2048Status,
  overlay: elements.game2048Overlay,
  overlayTitle: elements.game2048OverlayTitle,
  overlayText: elements.game2048OverlayText,
  continueButton: elements.game2048Continue,
  newButton: elements.game2048New,
  overlayNewButton: elements.game2048OverlayNew,
  upButton: elements.game2048Up,
  downButton: elements.game2048Down,
  leftButton: elements.game2048Left,
  rightButton: elements.game2048Right,
}, {
  isActive: () => window.__GAME_TABS__?.getCurrent() === "2048",
});
window.addEventListener("keydown", (event) => rogueGuideController.handleGlobalKeydown(event), true);
window.__GAME_TABS__?.register("sweep", {
  onDeactivate: () => {
    if (rogueGuideController.close({ restoreFocus: false })) {
      queueMicrotask(() => document.querySelector('.game-tab[aria-selected="true"]')?.focus());
    }
  },
});
window.__GAME_TABS__?.register("2048", {
  onActivate: () => game2048UI.render(),
});
const rogueHandlers = {
  onReset: () => {
    rogueGame.reset();
    rogueUI.resetTransientInputState();
    renderRogue();
    return "continue";
  },
  onReveal: (row, col) => rogueGame.reveal(row, col),
  onChord: (row, col) => rogueGame.chord(row, col),
  onCycleMark: (row, col) => rogueGame.cycleMark(row, col),
  onSelectContract: (contractId) => rogueGame.selectContract(contractId),
  onSelectTool: (toolKey) => rogueGame.selectTool(toolKey),
  onUseTool: (row, col) => rogueGame.useSelectedTool(row, col),
  onCancelTool: () => rogueGame.cancelTool(),
  onChooseReward: (upgradeId) => rogueGame.chooseReward(upgradeId),
  onAction: () => renderRogue(),
};

ui.bindHandlers({
  onReset: resetGame,
  onHint: handleHint,
  onDifficultyChange: (value) => {
    difficultyKey = value;
    updateCustomDifficultyVisibility();
    resetGame();
  },
  onModeChange: (value) => {
    modeKey = validModes.includes(value) ? value : "classic";
    saveModeKey(modeKey);
    refreshDifficultyOptions();
    syncCustomDifficultyForm();
    updateGenerationModeVisibility();
    setRogueVisibility(isRogueMode());
    resetGame();
  },
  onGenerationModeChange: (value) => {
    generationMode = value === "no-guess" && modeKey === "classic" ? "no-guess" : "standard";
    saveGenerationMode(generationMode);
    ui.setGenerationMode(generationMode);
    resetGame();
  },
  onMarkModeChange: (value) => rogueUI.setMarkMode(value),
  onApplyCustomDifficulty: () => {
    if (modeKey === "sudoku") return;
    const { rows, cols, mines } = getCustomFormValues();
    localStorage.setItem(getCustomStorageKey("rows"), String(rows));
    localStorage.setItem(getCustomStorageKey("cols"), String(cols));
    localStorage.setItem(getCustomStorageKey("mines"), String(mines));
    elements.customRows.value = String(rows);
    elements.customCols.value = String(cols);
    elements.customMines.value = String(mines);
    difficultyKey = "custom";
    elements.difficultySelect.value = difficultyKey;
    updateCustomDifficultyVisibility();
    resetGame();
  },
  onThemeChange: (value) => {
    saveThemeKey(value);
    applyTheme(value);
  },
  onBackgroundUpload: async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const raw = await loadImageSource(file);
    const compressed = await compressImageDataUrl(raw);
    saveBackgroundUrl(compressed);
    ui.applyBackground(compressed);
  },
  onClearBackground: () => {
    elements.bgUpload.value = "";
    saveBackgroundUrl("");
    ui.applyBackground("");
  },
  onBackgroundOpacityChange: (value) => {
    saveBackgroundOpacity(value);
    ui.applyBackgroundOpacity(value);
  },
});

rogueUI.bindHandlers(rogueHandlers);

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.dark;
  ui.setTheme(themeKey in THEMES ? themeKey : "dark");
  ui.applyTheme(themeKey, theme);
}

function init() {
  applyTheme(storage.themeKey);
  ui.applyBackground(storage.backgroundUrl);
  ui.applyBackgroundOpacity(storage.backgroundOpacity);
  ui.setBackgroundOpacityValue(storage.backgroundOpacity);
  ui.setGenerationMode(generationMode);
  elements.modeSelect.value = modeKey;
  refreshDifficultyOptions();
  syncCustomDifficultyForm();
  updateGenerationModeVisibility();
  setRogueVisibility(isRogueMode());
  ui.setMarkMode("reveal");
  rogueUI.setMarkMode("reveal");
  resetGame();
}

init();
