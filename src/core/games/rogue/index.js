export { createRogueGame } from "./game.js";
export {
  createRogueEmptyCell,
  createRogueRunState,
} from "./state.js";
export {
  ROGUE_LEVELS,
  createRogueLevel,
  getRogueLevelSpec,
  getRogueNeighbors,
  placeRogueSpecialCells,
  refreshRogueSectorStats,
  revealRogueFlood,
} from "./level.js";
export {
  getContractDefinition,
  getContractCatalog,
  getContractOptions,
  getContractReward,
} from "./contracts.js";
export {
  TOOL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getRewardOptions,
  getToolDefinition,
  getUpgradeDefinition,
} from "./items.js";
export {
  assignRogueSectorIds,
  calculateRogueSectorStats,
  createRogueSectors,
  getRogueSectorForColumn,
  getRogueSectorId,
} from "./sectors.js";

export function getRogueCoreStatus() {
  return {
    game: "rogue",
    status: "extracted",
    uiSource: "src/rogue-ui.js",
  };
}
