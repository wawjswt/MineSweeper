const CONTRACT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "noDamage",
    label: "零误触",
    description: "本层清空安全格时不损失生命。",
    target: 1,
    progressLabel: "保持无伤",
    reward: Object.freeze({ type: "energy", amount: 1 }),
  }),
  Object.freeze({
    id: "reconnaissance",
    label: "情报回收",
    description: "触发或扫描一个情报点。",
    target: 1,
    progressLabel: "回收情报点",
    reward: Object.freeze({
      type: "toolBonus",
      amount: 1,
      toolKey: "scoutPulse",
    }),
  }),
  Object.freeze({
    id: "controlledDemolition",
    label: "精准爆破",
    description: "使用拆雷装置成功拆除一颗真雷。",
    target: 1,
    progressLabel: "拆除真雷",
    reward: Object.freeze({
      type: "toolBonus",
      amount: 1,
      toolKey: "defusalKit",
    }),
  }),
  Object.freeze({
    id: "reservePower",
    label: "节能推进",
    description: "本层清空安全格时至少保留 1 点能量。",
    target: 1,
    progressLabel: "保留能量",
    reward: Object.freeze({
      type: "score",
      amount: 10,
      streakAmount: 1,
    }),
  }),
  Object.freeze({
    id: "intelRelay",
    label: "情报接力",
    description: "先收集情报点，再在不同战区使用一次工具。",
    target: 2,
    progressLabel: "完成接力步骤",
    reward: Object.freeze({
      type: "toolBonus",
      amount: 1,
      toolKey: "scoutPulse",
    }),
  }),
  Object.freeze({
    id: "supplyRelay",
    label: "补给转运",
    description: "先收集补给点，再在不同战区揭开一个安全格。",
    target: 2,
    progressLabel: "完成转运步骤",
    reward: Object.freeze({
      type: "toolBonus",
      amount: 1,
      toolKey: "reactionShield",
    }),
  }),
  Object.freeze({
    id: "crossFire",
    label: "交叉火力",
    description: "使用两种不同工具，且分别作用于两个不同战区。",
    target: 2,
    progressLabel: "完成工具协同",
    reward: Object.freeze({
      type: "toolBonus",
      amount: 1,
      toolKey: "defusalKit",
    }),
  }),
  Object.freeze({
    id: "safeInsertion",
    label: "分段突入",
    description: "第一次受伤前，在两个不同战区各揭开至少 3 个安全格。",
    target: 2,
    progressLabel: "达标战区数",
    reward: Object.freeze({
      type: "score",
      amount: 15,
    }),
  }),
]);

function cloneDefinition(definition) {
  return definition
    ? { ...definition, reward: { ...definition.reward } }
    : null;
}

function randomIndex(rng, length) {
  const value = Number(rng?.());
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999) : 0;
  return Math.floor(normalized * length);
}

export function getContractDefinition(contractId) {
  return cloneDefinition(
    CONTRACT_DEFINITIONS.find(({ id }) => id === contractId),
  );
}

export function getContractOptions({ floor: _floor, rng = Math.random } = {}) {
  const pool = [...CONTRACT_DEFINITIONS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(rng, index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, 2).map(cloneDefinition);
}

export function getContractReward(contractId) {
  return getContractDefinition(contractId)?.reward ?? null;
}
