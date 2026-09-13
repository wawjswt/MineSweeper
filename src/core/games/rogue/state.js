const TOOL_KEYS = ["scoutPulse", "defusalKit", "reactionShield"];

export function createRogueEmptyCell() {
  return {
    mine: false,
    revealed: false,
    flagged: false,
    questioned: false,
    exploded: false,
    neutralized: false,
    count: 0,
    sectorId: null,
    special: null,
    specialCollected: false,
  };
}

function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createRogueEmptyCell()),
  );
}

function createContractContext() {
  return {
    intelSectorId: null,
    supplySectorId: null,
    firstCrossFireEvent: null,
    insertionQualifiedSectors: [],
  };
}

export function createRogueRunState() {
  return {
    modeKey: "rogue",
    status: "ready",
    floor: 1,
    totalFloors: 5,
    lives: 3,
    maxLives: 3,
    energy: 2,
    maxEnergy: 3,
    safeRevealStreak: 0,
    score: 0,
    upgrades: [],
    nextLevelToolBonus: {
      scoutPulse: 0,
      defusalKit: 0,
      reactionShield: 0,
    },
    level: {
      floor: 1,
      rows: 7,
      cols: 7,
      mines: 8,
      board: createEmptyBoard(7, 7),
      started: false,
      ended: false,
      safeCellsRemaining: 7 * 7 - 8,
      activeToolUses: Object.fromEntries(TOOL_KEYS.map((key) => [key, 1])),
      shieldActive: false,
    },
    contractOptions: [],
    selectedContract: null,
    contractProgress: 0,
    contractTarget: 1,
    contractCompleted: false,
    contractRewardGranted: false,
    contractFailed: false,
    contractFailureReason: "",
    contractPenaltyApplied: false,
    contractContext: createContractContext(),
    levelStats: {
      damageTaken: 0,
      safeReveals: 0,
      toolsUsed: {},
      trueMinesDefused: 0,
      shieldedHits: 0,
      specialCellsCollected: 0,
    },
    rewardOptions: [],
    notice: "",
    focusedCell: [0, 0],
  };
}

