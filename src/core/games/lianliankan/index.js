export {
  CHALLENGE_CONFIG,
  CHALLENGE_MISTAKE_PENALTY_MS,
  CHALLENGE_MISTAKE_PENALTY_SECONDS,
  DIFFICULTIES,
  EMOJI_POOL,
  LLK3D_DIFFICULTIES,
  applyLevelClearBonus,
  axisDiff3D,
  challengeConfig,
  challengeRating,
  consumeChallengeResource,
  count3DRemaining,
  countRemaining,
  createChallengeState,
  defaultLevelProgress,
  dimsCube3D,
  emptySurfaceList3D,
  ensureLevelSolvable,
  explainPairFailure,
  expireLevelCombo,
  expandPath3D,
  find3DAnyPair,
  find3DPath,
  findAnyPair,
  findHintPair,
  findPath,
  isEmptyCell,
  isSelectableTile,
  isSurfaceCell3D,
  make3DBoard,
  makeBoard,
  makeDropPlan,
  nextPairScore,
  readLevelProgress,
  recordLevelCompletion,
  remainingChallengeSeconds,
  reshuffle,
  reshuffleLevel,
  reshuffle3D,
  resetLevelCombo,
  sameCell3D,
  scorePairForMode,
  segmentClear,
  shuffle,
  surfaceCellList3D,
  tileList3D,
  idx3D,
  writeLevelProgress,
} from "./engine.js";
export {
  LLK_LEVELS,
  cloneLayout,
  collapseColumns,
} from "./levels.js";

export function getLianliankanCoreStatus() {
  return {
    game: "lianliankan",
    status: "extracted",
    uiSource: "src/lianliankan-game.js",
  };
}

export function getLianliankanEngineStatus() {
  return { game: "lianliankan", status: "extracted" };
}
