/* 固定关卡的 Web 兼容入口；实际数据与关卡规则位于 core/games/lianliankan/levels.js。 */
import {
  LLK_LEVELS,
  cloneLayout,
  collapseColumns,
  countRemaining,
  reshuffle,
} from "./core/games/lianliankan/levels.js";

export { LLK_LEVELS, cloneLayout, collapseColumns, countRemaining, reshuffle };

if (typeof window !== "undefined") {
  window.__LLK_LEVELS__ = Object.assign(LLK_LEVELS, {
    levels: LLK_LEVELS,
    cloneLayout,
    collapseColumns,
    countRemaining,
    reshuffle,
  });
}
