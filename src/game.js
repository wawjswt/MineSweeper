import { createGameLogic as createCoreGameLogic } from "./core/games/minesweeper/game.js";
import { createWebClock } from "./platform/web/clock.js";

export function createGameLogic(options = {}) {
  const { clock = createWebClock(), ...coreOptions } = options;
  return createCoreGameLogic({ ...coreOptions, clock });
}
