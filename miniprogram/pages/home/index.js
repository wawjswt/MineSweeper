const { createMiniProgramRuntime } = require("../../generated/runtime.js");

Page({
  data: {
    ready: false,
    games: [],
    activeGame: null,
  },

  onLoad() {
    this.runtime = createMiniProgramRuntime();
    this.syncView();
  },

  onShow() {
    this.runtime?.resume();
  },

  onHide() {
    this.runtime?.pause();
  },

  syncView() {
    if (!this.runtime) return;
    this.setData({
      ready: true,
      games: this.runtime.listGames(),
      activeGame: this.runtime.currentGame(),
    });
  },
});
