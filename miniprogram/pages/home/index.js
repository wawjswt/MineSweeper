const { createMiniProgramRuntime } = require("../../generated/runtime.js");

Page({
  data: {
    ready: false,
    games: [],
    activeGame: null,
    game: null,
    sudokuDigits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  },

  onLoad() {
    this.runtime = createMiniProgramRuntime();
    this.unsubscribe = this.runtime.subscribe((update) => {
      if (update.game !== this.runtime.currentGame()) return;
      this.setData({ game: update.state });
    });
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
    this.unsubscribe?.();
    this.runtime = null;
    this.touchStart = null;
    this.unsubscribe = null;
    this.touchStart = null;
  },

  syncView() {
    if (!this.runtime) return;
    this.setData({
      ready: true,
      games: this.runtime.getTabViewModel?.().tabs || [],
      activeGame: this.runtime.currentGame(),
      game: this.runtime.getState(),
    });
  },

  dispatch(action, gameName = this.runtime?.currentGame()) {
    if (!this.runtime) return;
    const result = this.runtime.dispatch(action, gameName);
    if (result.handled) this.syncView();
  },

  onSelectGame(event) {
    const game = event.detail?.game || event.currentTarget.dataset.game;
    const result = this.runtime?.select(game);
    if (result?.ok) this.syncView();
  },

  onTapMove(event) {
    this.dispatch({ type: "move", direction: event.currentTarget.dataset.direction });
  },

  onContinue() {
    this.dispatch({ type: "continue" });
  },

  onSweepReveal(event) {
    this.dispatch({ type: "reveal", row: event.detail.row, col: event.detail.col }, "sweep");
  },

  onSweepMark(event) {
    this.dispatch({ type: "mark", row: event.detail.row, col: event.detail.col }, "sweep");
  },

  onSweepHint() {
    this.dispatch({ type: "hint" }, "sweep");
  },

  onSudokuSelect(event) {
    this.dispatch({ type: "select", index: Number(event.detail.index) }, "sudoku");
  },

  onSudokuInput(event) {
    this.dispatch({ type: "input", digit: Number(event.currentTarget.dataset.digit) }, "sudoku");
  },

  onSudokuAction(event) {
    this.dispatch({ type: event.currentTarget.dataset.action }, "sudoku");
  },

  onLianliankanSelect(event) {
    this.dispatch({ type: "select", index: Number(event.detail.index) }, "lianliankan");
  },

  onLianliankanHint() {
    this.dispatch({ type: "hint" }, "lianliankan");
  },

  onLianliankanReshuffle() {
    this.dispatch({ type: "reshuffle" }, "lianliankan");
  },

  onLianliankanNew() {
    this.dispatch({ type: "new" }, "lianliankan");
  },

  onRogueSelect(event) {
    const action = this.data.game?.selectedTool
      ? { type: "use-tool", row: event.detail.row, col: event.detail.col }
      : { type: "reveal", row: event.detail.row, col: event.detail.col };
    this.dispatch(action, "rogue");
  },

  onRogueMark(event) {
    this.dispatch({ type: "mark", row: event.detail.row, col: event.detail.col }, "rogue");
  },

  onRogueContract(event) {
    this.dispatch({ type: "select-contract", contractId: event.detail.contractId }, "rogue");
  },

  onRogueTool(event) {
    const selected = this.data.game?.selectedTool;
    this.dispatch({ type: selected === event.detail.toolKey ? "cancel-tool" : "select-tool", toolKey: event.detail.toolKey }, "rogue");
  },

  onRogueReward(event) {
    this.dispatch({ type: "choose-reward", upgradeId: event.detail.upgradeId }, "rogue");
  },

  onRogueNew() {
    this.dispatch({ type: "reset" }, "rogue");
  },

  onNewGame() {
    const game = this.runtime?.currentGame();
    this.dispatch({ type: game === "lianliankan" ? "new" : "reset" });
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
