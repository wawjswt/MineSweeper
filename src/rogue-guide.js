import { getContractCatalog } from "./rogue-contracts.js";
import { ROGUE_LEVELS } from "./rogue-level.js";
import { TOOL_DEFINITIONS, UPGRADE_DEFINITIONS } from "./rogue-items.js";

const SPECIAL_CELL_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "intel",
    label: "情报点",
    description: "收集后揭示附近区域的雷情报。",
    effect: "触发或扫描该格时，扫描一个 3×3 区域并报告其中的雷数。",
  }),
  Object.freeze({
    id: "supply",
    label: "补给点",
    description: "收集后恢复能量并补充工具。",
    effect: "触发或扫描该格时，能量 +1，并为当前使用次数最少的工具补充 1 次使用。",
  }),
]);

const SECTION_DEFINITIONS = Object.freeze([
  { id: "overview", title: "行动概览", dataKey: "overview" },
  { id: "floors", title: "楼层情报", dataKey: "floors" },
  { id: "tools", title: "主动工具", dataKey: "tools" },
  { id: "special-cells", title: "特殊格", dataKey: "specialCells" },
  { id: "contracts", title: "战术契约", dataKey: "contracts" },
  { id: "upgrades", title: "战后强化", dataKey: "upgrades" },
  { id: "illustrations", title: "战术图鉴", dataKey: "illustrations" },
  { id: "tips", title: "行动提示", dataKey: "tips" },
]);

const ILLUSTRATION_ENTRIES = [
  ["tool", "scoutPulse", "侦察脉冲", "主动工具", "显示 3×3 区域雷情报的侦察脉冲工具蓝图。"],
  ["tool", "defusalKit", "拆雷装置", "主动工具", "拆除真雷或拆穿假旗的拆雷装置蓝图。"],
  ["tool", "reactionShield", "反应护盾", "主动工具", "抵挡本层下一次踩雷的反应护盾蓝图。"],
  ["special", "intel", "情报点", "特殊格", "标记附近雷情报的情报点蓝图。"],
  ["special", "supply", "补给点", "特殊格", "恢复能量并补充工具使用次数的补给点蓝图。"],
  ["upgrade", "storage", "储能核心", "战后强化", "提升最大能量并立即补充能量的储能核心蓝图。"],
  ["upgrade", "chain", "连锁能源", "战后强化", "连续安全揭开后提供能量的连锁能源蓝图。"],
  ["upgrade", "medical", "医疗组件", "战后强化", "提升最大生命并立即恢复生命的医疗组件蓝图。"],
  ["upgrade", "toolBoost:scoutPulse", "工具增幅·侦察脉冲", "战后强化", "让下一层侦察脉冲增加一次使用次数的强化蓝图。"],
  ["upgrade", "toolBoost:defusalKit", "工具增幅·拆雷装置", "战后强化", "让下一层拆雷装置增加一次使用次数的强化蓝图。"],
  ["upgrade", "toolBoost:reactionShield", "工具增幅·反应护盾", "战后强化", "让下一层反应护盾增加一次使用次数的强化蓝图。"],
  ["upgrade", "supply", "补给箱", "战后强化", "让下一层三种工具各增加一次使用次数的补给箱蓝图。"],
];

function clone(value) {
  return structuredClone(value);
}

function getIllustrations() {
  return ILLUSTRATION_ENTRIES.map(([entityType, entityId, title, category, alt]) => ({
    id: `${entityType}-${entityId}`,
    entityType,
    entityId,
    path: `./assets/rogue-guide/${entityType}-${entityId.replaceAll(":", "-")}.svg`,
    title,
    category,
    alt,
    caption: alt,
  }));
}

export function getRogueGuideCatalog() {
  const floors = ROGUE_LEVELS.map(clone);
  const tools = Object.values(TOOL_DEFINITIONS).map(clone);
  const specialCells = SPECIAL_CELL_DEFINITIONS.map(clone);
  const contracts = getContractCatalog();
  const upgrades = UPGRADE_DEFINITIONS.map(clone);
  const illustrations = getIllustrations();
  const overview = {
    title: "战术扫雷",
    description: "在五层战区中揭开全部安全格，管理能量、生命、工具和战术契约。",
  };
  const tips = [
    "先观察战区进度，再决定工具落点。",
    "工具会消耗能量，特殊格可以带来额外补给。",
  ];

  return clone({
    sections: SECTION_DEFINITIONS,
    overview,
    floors,
    tools,
    specialCells,
    contracts,
    upgrades,
    illustrations,
    tips,
  });
}
