import { createGameRuntime } from "../../application/game-runtime.js";
import { create2048Session } from "../../application/games/2048-session.js";
import { createMinesweeperSession } from "../../application/games/minesweeper-session.js";
import { to2048ViewModel } from "./view-models/2048.js";
import { toMinesweeperViewModel } from "./view-models/minesweeper.js";
import { createWechatClock } from "../../platform/wechat/clock.js";
import { createWechatRandom } from "../../platform/wechat/random.js";
import { createWechatStorage } from "../../platform/wechat/storage.js";

export function createMiniProgramRuntime({ wxApi, rng = Math.random, timers } = {}) {
  const storage = createWechatStorage(wxApi);
  const clock = createWechatClock({ timers });
  const random = createWechatRandom(rng);
  void clock;
  return createGameRuntime({
    initialGame: "2048",
    games: {
      "2048": create2048Session({ storage, rng: random }),
      sweep: createMinesweeperSession({ rng: random, clock }),
    },
    viewModels: {
      "2048": to2048ViewModel,
      sweep: toMinesweeperViewModel,
    },
  });
}
