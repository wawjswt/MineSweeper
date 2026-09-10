import assert from "node:assert/strict";
import test from "node:test";
import { getRogueGuideCatalog } from "../src/rogue-guide.js";
import { getContractCatalog } from "../src/rogue-contracts.js";

const expectedContractIds = [
  "noDamage", "reconnaissance", "controlledDemolition", "reservePower",
  "intelRelay", "supplyRelay", "crossFire", "safeInsertion",
];
const expectedUpgradeIds = [
  "storage", "chain", "medical", "toolBoost:scoutPulse", "toolBoost:defusalKit",
  "toolBoost:reactionShield", "supply",
];

test("rogue guide exposes eight sections in stable order with unique ids", () => {
  const catalog = getRogueGuideCatalog();
  assert.deepEqual(catalog.sections.map(({ id }) => id), [
    "overview", "floors", "contracts", "special-cells", "tools", "upgrades", "illustrations", "tips",
  ]);
  assert.equal(new Set(catalog.sections.map(({ id }) => id)).size, 8);
  assert.equal(catalog.sections.length, 8);
});

test("rogue guide contains the complete canonical floor, contract, tool, special, and upgrade data", () => {
  const catalog = getRogueGuideCatalog();
  assert.deepEqual(catalog.floors.map(({ floor, rows, cols, mines, label }) => ({ floor, rows, cols, mines, label })), [
    { floor: 1, rows: 7, cols: 7, mines: 8, label: "教学层" },
    { floor: 2, rows: 8, cols: 9, mines: 13, label: "扩张层" },
    { floor: 3, rows: 9, cols: 10, mines: 19, label: "压力层" },
    { floor: 4, rows: 10, cols: 12, mines: 28, label: "高压层" },
    { floor: 5, rows: 11, cols: 14, mines: 40, label: "最终层" },
  ]);
  assert.deepEqual(catalog.contracts.map(({ id }) => id), expectedContractIds);
  assert.deepEqual(catalog.upgrades.map(({ id }) => id), expectedUpgradeIds);
  assert.deepEqual(catalog.tools.map(({ id, cost, description }) => ({ id, cost, description })), [
    { id: "scoutPulse", cost: 1, description: "扫描一个 3×3 区域的雷数" },
    { id: "defusalKit", cost: 2, description: "拆除真雷或拆穿假旗" },
    { id: "reactionShield", cost: 1, description: "抵挡本层下一次踩雷" },
  ]);
  assert.deepEqual(catalog.specialCells.map(({ id, effect }) => ({ id, effect })), [
    { id: "intel", effect: "怎么用：直接翻开它，或用侦察脉冲点中它。结果：显示它周围 3×3 范围的雷数。" },
    { id: "supply", effect: "怎么用：直接翻开它，或被拆雷装置触发。结果：能量最多恢复 1 点，并给当前剩余次数最少的工具补充 1 次。" },
  ]);
});

test("rogue guide illustration records map one-to-one to every tool, special cell, and upgrade", () => {
  const illustrations = getRogueGuideCatalog().illustrations;
  assert.equal(illustrations.length, 12);
  assert.equal(new Set(illustrations.map(({ id }) => id)).size, 12);
  assert.ok(illustrations.every(({ path, title, category, alt, caption }) => (
    path.startsWith("./assets/rogue-guide/") && path.endsWith(".svg") && title && category && alt && caption
  )));
  assert.deepEqual(illustrations.map(({ entityType, entityId }) => `${entityType}:${entityId}`), [
    "tool:scoutPulse", "tool:defusalKit", "tool:reactionShield", "special:intel", "special:supply",
    "upgrade:storage", "upgrade:chain", "upgrade:medical", "upgrade:toolBoost:scoutPulse",
    "upgrade:toolBoost:defusalKit", "upgrade:toolBoost:reactionShield", "upgrade:supply",
  ]);
});

test("contract catalog returns independent clones", () => {
  const first = getContractCatalog();
  first[0].label = "已修改";
  first[0].reward.amount = 99;
  const second = getContractCatalog();
  assert.equal(second.length, expectedContractIds.length);
  assert.equal(second[0].label, "零误触");
  assert.equal(second[0].reward.amount, 1);
  assert.deepEqual(second.map(({ id }) => id), expectedContractIds);
});

test("rogue guide explains tools in plain language without blueprint jargon", () => {
  const catalog = getRogueGuideCatalog();
  const illustrationSection = catalog.sections.find(({ id }) => id === "illustrations");

  assert.equal(illustrationSection.title, "道具效果图");
  assert.ok(catalog.tools.every(({ guidance }) => guidance.includes("怎么用") && guidance.includes("效果")));
  assert.doesNotMatch(JSON.stringify(catalog), /蓝图|作战手册/);
});
