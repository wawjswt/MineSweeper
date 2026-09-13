import { createGameRuntime } from "../../application/game-runtime.js";
import { createWechatClock } from "../../platform/wechat/clock.js";
import { createWechatRandom } from "../../platform/wechat/random.js";
import { createWechatStorage } from "../../platform/wechat/storage.js";

export function createMiniProgramRuntime({ wxApi, rng = Math.random, timers } = {}) {
  const storage = createWechatStorage(wxApi);
  const clock = createWechatClock({ timers });
  const random = createWechatRandom(rng);
  void storage;
  void clock;
  void random;
  return createGameRuntime();
}
