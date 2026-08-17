const DEFAULTS = {
  themeKey: "dark",
  backgroundUrl: "",
  backgroundOpacity: "0.45",
};

export function loadSettings() {
  return {
    themeKey: localStorage.getItem("minesweeper-theme") || DEFAULTS.themeKey,
    backgroundUrl: localStorage.getItem("minesweeper-background") || DEFAULTS.backgroundUrl,
    backgroundOpacity:
      localStorage.getItem("minesweeper-background-opacity") || DEFAULTS.backgroundOpacity,
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
