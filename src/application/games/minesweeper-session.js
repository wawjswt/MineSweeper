import { createGameLogic } from "../../core/games/minesweeper/game.js";
import { makeState } from "../../core/games/minesweeper/state.js";

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createMinesweeperSession({
  difficultySpec = "normal",
  modeKey = "classic",
  generationMode = "standard",
  rng = Math.random,
  clock,
} = {}) {
  let currentDifficulty = difficultySpec;
  let currentMode = modeKey;
  let currentGenerationMode = generationMode;
  let state = makeState(currentDifficulty, currentMode);
  let listeners = new Set();
  let logic;

  function getState() {
    return cloneState(state);
  }

  function notify() {
    const next = getState();
    for (const listener of listeners) listener(next);
  }

  function createLogic() {
    return createGameLogic({
      getState: () => state,
      getDifficultySpec: () => currentDifficulty,
      getGenerationMode: () => currentGenerationMode,
      rng,
      clock,
    });
  }

  function reset(next = {}) {
    logic?.resetTimer();
    if ("difficultySpec" in next) currentDifficulty = next.difficultySpec;
    if ("modeKey" in next) currentMode = next.modeKey;
    if ("generationMode" in next) currentGenerationMode = next.generationMode;
    state = makeState(currentDifficulty, currentMode);
    logic = createLogic();
    notify();
  }

  function dispatch(action = {}) {
    let result = "continue";
    if (action.type === "reset") reset();
    else if (action.type === "configure") {
      reset({
        difficultySpec: action.difficultySpec ?? currentDifficulty,
        modeKey: action.modeKey ?? currentMode,
        generationMode: action.generationMode ?? currentGenerationMode,
      });
    } else if (action.type === "reveal") {
      result = logic.reveal(action.row, action.col, notify);
      notify();
    } else if (action.type === "chord") {
      result = logic.chord(action.row, action.col, notify);
      notify();
    } else if (action.type === "mark") {
      result = logic.cycleMark(action.row, action.col);
      notify();
    } else if (action.type === "hint") {
      state.hint = logic.getHint();
      notify();
    } else return { handled: false, state: getState() };

    return { handled: true, result, state: getState() };
  }

  function subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function pause() {
    logic.pauseTimer(notify);
  }

  function resume() {
    logic.resumeTimer(notify);
  }

  logic = createLogic();
  return {
    getState: () => cloneState(state),
    dispatch,
    subscribe,
    pause,
    resume,
  };
}
