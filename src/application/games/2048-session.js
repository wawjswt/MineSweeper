import { create2048Game } from "../../core/games/2048/engine.js";

const BEST_SCORE_KEY = "2048-best-score";

function readBestScore(storage) {
  const score = Number(storage?.getItem?.(BEST_SCORE_KEY));
  return Number.isFinite(score) && score > 0 ? score : 0;
}

function saveBestScore(storage, score) {
  storage?.setItem?.(BEST_SCORE_KEY, String(score));
}

export function create2048Session({ storage = null, rng = Math.random, initialBoard = null } = {}) {
  const game = create2048Game({ rng, initialBoard });
  let bestScore = readBestScore(storage);

  function snapshot() {
    const state = game.getState();
    return { ...state, bestScore };
  }

  function record(state) {
    if (state.score > bestScore) {
      bestScore = state.score;
      saveBestScore(storage, bestScore);
    }
    return snapshot();
  }

  function dispatch(action = {}) {
    let state;
    if (action.type === "move") state = game.move(action.direction);
    else if (action.type === "reset") state = game.reset();
    else if (action.type === "continue") state = game.continueAfterWin();
    else return { handled: false, state: snapshot() };
    return { handled: true, state: record(state) };
  }

  record(game.getState());
  return Object.freeze({
    getState: snapshot,
    dispatch,
  });
}
