export { createRogueGame } from "../../../rogue-game.js";
export { createRogueRunState } from "../../../rogue-state.js";
export {
  createRogueLevel,
  getRogueLevelSpec,
  getRogueNeighbors,
  refreshRogueSectorStats,
  revealRogueFlood,
} from "../../../rogue-level.js";
export {
  getContractDefinition,
  getContractOptions,
  getContractReward,
} from "../../../rogue-contracts.js";
export {
  getRewardOptions,
  getToolDefinition,
  getUpgradeDefinition,
} from "../../../rogue-items.js";
export {
  assignRogueSectorIds,
  calculateRogueSectorStats,
  createRogueSectors,
  getRogueSectorForColumn,
  getRogueSectorId,
} from "../../../rogue-sectors.js";

export function getRogueCoreStatus() {
  return {
    game: "rogue",
    status: "bridge",
    uiSource: "src/rogue-ui.js",
  };
}
