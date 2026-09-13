export const TOOL_DEFINITIONS = Object.freeze({
  scoutPulse: Object.freeze({
    id: "scoutPulse",
    label: "侦察脉冲",
    cost: 1,
    description: "扫描一个 3×3 区域的雷数",
  }),
  defusalKit: Object.freeze({
    id: "defusalKit",
    label: "拆雷装置",
    cost: 2,
    description: "拆除真雷或拆穿假旗",
  }),
  reactionShield: Object.freeze({
    id: "reactionShield",
    label: "反应护盾",
    cost: 1,
    description: "抵挡本层下一次踩雷",
  }),
});

export const UPGRADE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "storage", label: "储能核心", description: "最大能量 +1，并立即获得 1 点能量" }),
  Object.freeze({ id: "chain", label: "连锁能源", description: "连续安全揭开 3 次获得 1 点能量" }),
  Object.freeze({ id: "medical", label: "医疗组件", description: "最大生命 +1，并立即恢复 1 点生命" }),
  Object.freeze({ id: "toolBoost:scoutPulse", label: "工具增幅·侦察脉冲", description: "下一层侦察脉冲额外使用 1 次" }),
  Object.freeze({ id: "toolBoost:defusalKit", label: "工具增幅·拆雷装置", description: "下一层拆雷装置额外使用 1 次" }),
  Object.freeze({ id: "toolBoost:reactionShield", label: "工具增幅·反应护盾", description: "下一层反应护盾额外使用 1 次" }),
  Object.freeze({ id: "supply", label: "补给箱", description: "下一层三种工具各额外使用 1 次" }),
]);

export function getToolDefinition(toolKey) {
  return TOOL_DEFINITIONS[toolKey] || null;
}

export function getUpgradeDefinition(upgradeId) {
  return UPGRADE_DEFINITIONS.find(({ id }) => id === upgradeId) || null;
}

export function getRewardOptions({ ownedUpgrades = [], rng = Math.random } = {}) {
  const owned = new Set(ownedUpgrades);
  const pool = UPGRADE_DEFINITIONS.filter(({ id }) => !owned.has(id)).map((option) => ({ ...option }));
  for (let index = pool.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(rng() * (index + 1));
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }
  const options = pool.slice(0, 3);
  let fallbackIndex = 0;
  while (options.length < 3) {
    options.push({
      id: `energy:${fallbackIndex++}`,
      label: "+1 能量",
      description: "立即获得 1 点能量",
    });
  }
  return options;
}

