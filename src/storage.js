import { createWebStorage } from "./platform/web/storage.js";

const DEFAULTS = {
  themeKey: "dark",
  backgroundUrl: "",
  backgroundOpacity: "0.45",
  modeKey: "classic",
  generationMode: "standard",
};

export function loadSettings(storage = createWebStorage()) {
  return {
    themeKey: storage.getItem("minesweeper-theme") || DEFAULTS.themeKey,
    backgroundUrl: storage.getItem("minesweeper-background") || DEFAULTS.backgroundUrl,
    backgroundOpacity:
      storage.getItem("minesweeper-background-opacity") || DEFAULTS.backgroundOpacity,
    modeKey: storage.getItem("minesweeper-mode") || DEFAULTS.modeKey,
    generationMode:
      storage.getItem("minesweeper-generation-mode") || DEFAULTS.generationMode,
  };
}

export function saveThemeKey(themeKey, storage = createWebStorage()) {
  storage.setItem("minesweeper-theme", themeKey);
}

export function saveBackgroundUrl(backgroundUrl, storage = createWebStorage()) {
  if (backgroundUrl) storage.setItem("minesweeper-background", backgroundUrl);
  else storage.removeItem("minesweeper-background");
}

export function saveBackgroundOpacity(backgroundOpacity, storage = createWebStorage()) {
  storage.setItem("minesweeper-background-opacity", backgroundOpacity);
}

export function saveModeKey(modeKey, storage = createWebStorage()) {
  storage.setItem("minesweeper-mode", modeKey);
}

export function saveGenerationMode(generationMode, storage = createWebStorage()) {
  storage.setItem("minesweeper-generation-mode", generationMode);
}
