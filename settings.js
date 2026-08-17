export function createSettings({ ui, storage, themes, actions, elements }) {
  let difficultyKey = elements.difficultySelect.value;

  function applyTheme(themeKey) {
    storage.themeKey = themeKey;
    actions.saveThemeKey(themeKey);
    ui.applyTheme(themeKey, themes[themeKey]);
  }

  function applyBackground(url) {
    storage.backgroundUrl = url;
    actions.saveBackgroundUrl(url);
    ui.applyBackground(url);
  }

  function applyBackgroundOpacity(value) {
    storage.backgroundOpacity = value;
    actions.saveBackgroundOpacity(value);
    ui.applyBackgroundOpacity(value);
  }

  function setDifficulty(value) {
    difficultyKey = value;
    ui.setDifficulty(value);
  }

  function getDifficultyKey() {
    return difficultyKey;
  }

  function init() {
    ui.setTheme(storage.themeKey);
    ui.setBackgroundOpacityValue(storage.backgroundOpacity);
    applyTheme(storage.themeKey);
    applyBackground(storage.backgroundUrl);
    applyBackgroundOpacity(storage.backgroundOpacity);
  }

  return {
    applyTheme,
    applyBackground,
    applyBackgroundOpacity,
    setDifficulty,
    getDifficultyKey,
    init,
  };
}
