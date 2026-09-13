import { createGameRuntime } from "../../application/game-runtime.js";
import { create2048Session } from "../../application/games/2048-session.js";
import { createMinesweeperSession } from "../../application/games/minesweeper-session.js";
import { createSudokuSession } from "../../application/games/sudoku-session.js";
import { createLianliankanSession } from "../../application/games/lianliankan-session.js";
import { to2048ViewModel } from "./view-models/2048.js";
import { toMinesweeperViewModel } from "./view-models/minesweeper.js";
import { toSudokuViewModel } from "./view-models/sudoku.js";
import { toLianliankanViewModel } from "./view-models/lianliankan.js";
import { createWechatClock } from "../../platform/wechat/clock.js";
import { createWechatRandom } from "../../platform/wechat/random.js";
import { createWechatStorage } from "../../platform/wechat/storage.js";

export function createMiniProgramRuntime({ wxApi, rng = Math.random, timers } = {}) {
  const storage = createWechatStorage(wxApi);
  const clock = createWechatClock({ timers });
  const random = createWechatRandom(rng);
  return createGameRuntime({
    initialGame: "2048",
    games: {
      "2048": create2048Session({ storage, rng: random }),
      sweep: createMinesweeperSession({ rng: random, clock }),
      sudoku: createSudokuSession({ rng: random, clock, storage }),
      lianliankan: createLianliankanSession({ rng: random, clock, storage }),
    },
    viewModels: {
      "2048": to2048ViewModel,
      sweep: toMinesweeperViewModel,
      sudoku: toSudokuViewModel,
      lianliankan: toLianliankanViewModel,
    },
  });
}
