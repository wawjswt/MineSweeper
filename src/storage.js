const DEFAULTS = {
  themeKey: "dark",
  backgroundUrl: "",
  backgroundOpacity: "0.45",
  modeKey: "classic",
  generationMode: "standard",
};

export function loadSettings() {
  return {
    themeKey: localStorage.getItem("minesweeper-theme") || DEFAULTS.themeKey,
    backgroundUrl: localStorage.getItem("minesweeper-background") || DEFAULTS.backgroundUrl,
    backgroundOpacity:
      localStorage.getItem("minesweeper-background-opacity") || DEFAULTS.backgroundOpacity,
    modeKey: localStorage.getItem("minesweeper-mode") || DEFAULTS.modeKey,
    generationMode:
      localStorage.getItem("minesweeper-generation-mode") || DEFAULTS.generationMode,
  };
}

export function saveThemeKey(themeKey) {
  localStorage.setItem("minesweeper-theme", themeKey);
}

export function saveBackgroundUrl(backgroundUrl) {
  try {
    if (backgroundUrl) localStorage.setItem("minesweeper-background", backgroundUrl);
    else localStorage.removeItem("minesweeper-background");
  } catch {}
}

export function saveBackgroundOpacity(backgroundOpacity) {
  localStorage.setItem("minesweeper-background-opacity", backgroundOpacity);
}

export function saveModeKey(modeKey) {
  localStorage.setItem("minesweeper-mode", modeKey);
}

export function saveGenerationMode(generationMode) {
  localStorage.setItem("minesweeper-generation-mode", generationMode);
}
