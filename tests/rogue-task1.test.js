import assert from "node:assert/strict";
import test from "node:test";
import {
  getContractDefinition,
  getContractOptions,
  getContractReward,
} from "../src/rogue-contracts.js";
import {
  assignRogueSectorIds,
  calculateRogueSectorStats,
  createRogueSectors,
  getRogueSectorId,
} from "../src/rogue-sectors.js";

function sequenceRng(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test("战区生成返回三个连续、完整覆盖且每区至少两列的区域", () => {
  const sectors = createRogueSectors({ cols: 14, rng: () => 0.25 });

  assert.equal(sectors.length, 3);
  assert.deepEqual(sectors.map(({ id }) => id), [0, 1, 2]);
  assert.deepEqual(sectors.map(({ label }) => label), ["A区", "B区", "C区"]);
  assert.equal(sectors[0].startCol, 0);
  assert.equal(sectors.at(-1).endColExclusive, 14);
  for (let index = 0; index < sectors.length; index += 1) {
    const sector = sectors[index];
    assert.ok(sector.endColExclusive - sector.startCol >= 2);
    if (index > 0) assert.equal(sector.startCol, sectors[index - 1].endColExclusive);
    assert.equal(sector.safeCells, 0);
    assert.equal(sector.revealedSafeCells, 0);
    assert.equal(sector.secured, false);
  }
});

test("战区生成使用注入 RNG 保持可复现，并能改变边界", () => {
  const values = [0.17, 0.89, 0.2, 0.73, 0.41, 0.05, 0.96, 0.33];
  const first = createRogueSectors({ cols: 14, rng: sequenceRng(values) });
  const second = createRogueSectors({ cols: 14, rng: sequenceRng(values) });
  const low = createRogueSectors({ cols: 14, rng: () => 0 });
  const high = createRogueSectors({ cols: 14, rng: () => 0.999999 });

  assert.deepEqual(first, second);
  assert.notDeepEqual(low, high);
});

test("战区生成拒绝无法容纳三个最小区域的列数", () => {
  assert.throws(
    () => createRogueSectors({ cols: 5, rng: () => 0.25 }),
    /cols.*6|至少 6 列/i,
  );
});

test("战区辅助函数能为棋盘分配区域并计算安全格进度", () => {
  const sectors = createRogueSectors({ cols: 6, rng: () => 0.25 });
  const board = [
    [
      { mine: false, revealed: true },
      { mine: true, revealed: false },
      { mine: false, revealed: false },
      { mine: false, revealed: true },
      { mine: false, revealed: true },
      { mine: true, revealed: false },
    ],
  ];
  const assigned = assignRogueSectorIds(board, sectors);
  const stats = calculateRogueSectorStats({ board: assigned, sectors });

  assert.deepEqual(assigned[0].map(({ sectorId }) => sectorId), [0, 0, 1, 1, 2, 2]);
  assert.deepEqual(
    stats.map(({ safeCells, revealedSafeCells, secured }) => ({
      safeCells,
      revealedSafeCells,
      secured,
    })),
    [
      { safeCells: 1, revealedSafeCells: 1, secured: true },
      { safeCells: 2, revealedSafeCells: 1, secured: false },
      { safeCells: 1, revealedSafeCells: 1, secured: true },
    ],
  );
  assert.equal(getRogueSectorId(sectors, 0), 0);
  assert.equal(getRogueSectorId(sectors, 5), 2);
  assert.equal(getRogueSectorId(sectors, 6), null);
});

test("八类战术契约保留旧契约并提供四类路线契约", () => {
  const ids = [
    "noDamage",
    "reconnaissance",
    "controlledDemolition",
    "reservePower",
    "intelRelay",
    "supplyRelay",
    "crossFire",
    "safeInsertion",
  ];
  assert.deepEqual(
    ids.map((id) => getContractDefinition(id)?.id),
    ids,
  );

  const routeContracts = [
    {
      id: "intelRelay",
      label: "情报接力",
      description: "先收集情报点，再在不同战区使用一次工具。",
      progressLabel: "完成接力步骤",
      reward: { type: "toolBonus", amount: 1, toolKey: "scoutPulse" },
    },
    {
      id: "supplyRelay",
      label: "补给转运",
      description: "先收集补给点，再在不同战区揭开一个安全格。",
      progressLabel: "完成转运步骤",
      reward: { type: "toolBonus", amount: 1, toolKey: "reactionShield" },
    },
    {
      id: "crossFire",
      label: "交叉火力",
      description: "使用两种不同工具，且分别作用于两个不同战区。",
      progressLabel: "完成工具协同",
      reward: { type: "toolBonus", amount: 1, toolKey: "defusalKit" },
    },
    {
      id: "safeInsertion",
      label: "分段突入",
      description: "第一次受伤前，在两个不同战区各揭开至少 3 个安全格。",
      progressLabel: "达标战区数",
      reward: { type: "score", amount: 15 },
    },
  ];

  for (const expected of routeContracts) {
    const definition = getContractDefinition(expected.id);
    assert.deepEqual(
      {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        progressLabel: definition.progressLabel,
        target: definition.target,
      },
      {
        id: expected.id,
        label: expected.label,
        description: expected.description,
        progressLabel: expected.progressLabel,
        target: 2,
      },
    );
    assert.deepEqual(getContractReward(expected.id), expected.reward);
  }
});

test("第一层契约候选从八类中随机返回两个不同选项", () => {
  const options = getContractOptions({ floor: 1, rng: () => 0.25 });
  const knownIds = new Set([
    "noDamage",
    "reconnaissance",
    "controlledDemolition",
    "reservePower",
    "intelRelay",
    "supplyRelay",
    "crossFire",
    "safeInsertion",
  ]);

  assert.equal(options.length, 2);
  assert.equal(new Set(options.map(({ id }) => id)).size, 2);
  assert.ok(options.every(({ id }) => knownIds.has(id)));
});
