import { createRandom } from "../../core/shared/random.js";

export function createWechatRandom(rng = Math.random) {
  return createRandom(rng);
}
