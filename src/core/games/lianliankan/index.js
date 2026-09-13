export {
  LLK_LEVELS,
  cloneLayout,
  collapseColumns,
  countRemaining,
  reshuffle,
} from "./levels.js";

export function getLianliankanCoreStatus() {
  return {
    game: "lianliankan",
    status: "partial",
    uiSource: "src/lianliankan-game.js",
  };
}
