import { createRogueGame } from "../../core/games/rogue/game.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createRogueSession({ rng = Math.random, clock, storage = null } = {}) {
  if (!clock || typeof clock.now !== "function") throw new TypeError("clock is required");
  void storage;
  const game = createRogueGame({ rng });
  const listeners = new Set();
  let paused = false;

  function getState() {
    return {
      ...clone(game.getState()),
      selectedTool: game.getSelectedTool(),
      paused,
    };
  }

  function notify() {
    const state = getState();
    for (const listener of listeners) listener(state);
  }

  function dispatch(action = {}) {
    if (paused && action.type !== "resume" && action.type !== "reset") {
      return { handled: true, result: "paused", state: getState() };
    }
    let result;
    switch (action.type) {
      case "reset":
        paused = false;
        result = game.reset();
        break;
      case "select-contract":
        result = game.selectContract(action.contractId);
        break;
      case "reveal":
        result = game.reveal(action.row, action.col);
        break;
      case "chord":
        result = game.chord(action.row, action.col);
        break;
      case "mark":
        result = game.cycleMark(action.row, action.col);
        break;
      case "select-tool":
        result = game.selectTool(action.toolKey);
        break;
      case "use-tool":
        result = game.useSelectedTool(action.row, action.col);
        break;
      case "cancel-tool":
        result = game.cancelTool();
        break;
      case "choose-reward":
        result = game.chooseReward(action.upgradeId);
        break;
      case "resume":
        paused = false;
        result = "continue";
        break;
      case "pause":
        paused = true;
        result = "continue";
        break;
      default:
        return { handled: false, state: getState() };
    }
    notify();
    return { handled: true, result, state: getState() };
  }

  function pause() {
    if (!paused) {
      paused = true;
      notify();
    }
  }

  function resume() {
    if (paused) {
      paused = false;
      notify();
    }
  }

  return Object.freeze({
    getState,
    dispatch,
    pause,
    resume,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
