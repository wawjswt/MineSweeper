const { createMiniProgramRuntime } = require("../../generated/runtime.js");

Page({
  data: {
    ready: false,
    games: [],
    activeGame: null,
    game: null,
  },

  onLoad() {
    this.runtime = createMiniProgramRuntime();
    this.syncView();
  },

  onShow() {
    this.runtime?.resume();
    this.syncView();
  },

  onHide() {
    this.runtime?.pause();
  },

  onUnload() {
    this.runtime?.pause();
    this.runtime = null;
    this.touchStart = null;
  },

  syncView() {
    if (!this.runtime) return;
    this.setData({
      ready: true,
      games: this.runtime.listGames(),
      activeGame: this.runtime.currentGame(),
      game: this.runtime.getState(),
    });
  },

  dispatch(action) {
    if (!this.runtime) return;
    const result = this.runtime.dispatch(action);
    if (result.handled) this.syncView();
  },

  onSelectGame(event) {
    const result = this.runtime?.select(event.currentTarget.dataset.game);
    if (result?.ok) this.syncView();
  },

  onTapMove(event) {
    this.dispatch({ type: "move", direction: event.currentTarget.dataset.direction });
  },

  onContinue() {
    this.dispatch({ type: "continue" });
  },

  onNewGame() {
    this.dispatch({ type: "reset" });
  },

  onTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    this.touchStart = { x: touch.clientX, y: touch.clientY };
  },

  onTouchEnd(event) {
    const touch = event.changedTouches?.[0];
    const start = this.touchStart;
    this.touchStart = null;
    if (!touch || !start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
    this.dispatch({ type: "move", direction });
  },
});
