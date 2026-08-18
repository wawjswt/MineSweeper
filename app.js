import { THEMES } from "./config.js";
import { makeState } from "./state.js";
import { createGameLogic } from "./game.js";
import { createUI } from "./ui.js";
import { compressImageDataUrl, loadImageSource } from "./image.js";
import {
  loadSettings,
  saveBackgroundOpacity,
  saveBackgroundUrl,
  saveThemeKey,
} from "./storage.js";
import { createSettings } from "./settings.js";

const elements = {
  boardEl: document.getElementById("board"),
  resetButton: document.getElementById("resetButton"),
  difficultySelect: document.getElementById("difficultySelect"),
  modeSelect: document.getElementById("modeSelect"),
  themeSelect: document.getElementById("themeSelect"),
  bgUpload: document.getElementById("bgUpload"),
  bgOpacity: document.getElementById("bgOpacity"),
  clearBgButton: document.getElementById("clearBgButton"),
  boardMineCounterEl: document.getElementById("boardMineCounter"),
  timerEl: document.getElementById("timer"),
  statusTextEl: document.getElementById("statusText"),
  pageBackdropEl: document.getElementById("pageBackdrop"),
  boardMineMetaEl: document.getElementById("boardMineMeta"),
};

const storage = loadSettings();

let difficultyKey = elements.difficultySelect.value;
let modeKey = elements.modeSelect.value === "sudoku" ? "sudoku" : "classic";
let state = makeState(difficultyKey, modeKey);

const ui = createUI(elements);
const settings = createSettings({
  ui,
  storage,
  themes: THEMES,
  actions: {
    saveThemeKey,
    saveBackgroundUrl,
    saveBackgroundOpacity,
  },
  elements,
});
const game = createGameLogic(() => state, () => settings.getDifficultyKey());

function syncGame(status) {
  if (status === "win") {
    ui.setResetEmoji("😎");
    ui.setStatus("胜利");
  } else if (status === "lose") {
    ui.setResetEmoji("😵");
    ui.setStatus("失败");
  } else if (!state.started) {
    ui.setResetEmoji("😊");
    ui.setStatus("待开始");
  } else {
    ui.setResetEmoji("😊");
    ui.setStatus("进行中");
  }
  ui.render(state, {
    onReveal: handleReveal,
    onChord: handleChord,
    onCycleMark: handleCycleMark,
  });
}

function handleReveal(row, col) {
  const result = game.reveal(row, col, () => ui.renderHud(state));
  syncGame(result);
}

function handleChord(row, col) {
  const result = game.chord(row, col, () => ui.renderHud(state));
  syncGame(result);
}

function handleCycleMark(row, col) {
  game.cycleMark(row, col);
  syncGame("continue");
}

function resetGame() {
  game.resetTimer();
  ui.resetTransientInputState();
  state = makeState(difficultyKey, modeKey);
  ui.setResetEmoji("😊");
  ui.setStatus("待开始");
  ui.render(state, {
    onReveal: handleReveal,
    onChord: handleChord,
    onCycleMark: handleCycleMark,
  });
}

function applyTheme(key) {
  settings.applyTheme(key);
}

ui.bindHandlers({
  onReset: resetGame,
  onDifficultyChange: (value) => {
    settings.setDifficulty(value);
    difficultyKey = value;
    resetGame();
  },
  onModeChange: (value) => {
    modeKey = value;
    ui.setMode(value);
    resetGame();
  },
  onThemeChange: applyTheme,
  onBackgroundUpload: async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const raw = await loadImageSource(file);
    settings.applyBackground(await compressImageDataUrl(raw));
  },
  onClearBackground: () => {
    elements.bgUpload.value = "";
    settings.applyBackground("");
  },
  onBackgroundOpacityChange: (value) => settings.applyBackgroundOpacity(value),
});

function init() {
  settings.setDifficulty(difficultyKey);
  ui.setMode(modeKey);
  settings.init();
  if (modeKey !== "sudoku") {
    modeKey = "classic";
    ui.setMode(modeKey);
  }
  resetGame();
}

init();
