import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRogueCellAriaLabel,
  getRogueContractCardCopy,
  getRogueContractProgressText,
  getRogueSectorClassNames,
  getRogueSectorProgressText,
} from "../src/rogue-ui.js";

const sectors = [
  { id: 0, label: "A区", startCol: 0, endColExclusive: 3 },
  { id: 1, label: "B区", startCol: 3, endColExclusive: 5 },
  { id: 2, label: "C区", startCol: 5, endColExclusive: 7 },
];

test("战区进度文案覆盖待部署、待推进、进行中和已完成", () => {
  assert.equal(
    getRogueSectorProgressText({ ...sectors[0], safeCells: 0, revealedSafeCells: 0 }, false),
    "A区 待部署",
  );
  assert.equal(
    getRogueSectorProgressText({ ...sectors[0], safeCells: 14, revealedSafeCells: 0 }, true),
    "A区 待推进",
  );
  assert.equal(
    getRogueSectorProgressText({ ...sectors[0], safeCells: 14, revealedSafeCells: 8 }, true),
    "A区 8 / 14",
  );
  assert.equal(
    getRogueSectorProgressText({ ...sectors[0], safeCells: 14, revealedSafeCells: 14, secured: true }, true),
    "A区 已完成",
  );
});

test("战区格子 class 能表达区域和跨区边界，旧 cell 没有 sectorId 也能兼容", () => {
  assert.deepEqual(
    getRogueSectorClassNames({ sectorId: 1 }, 3, sectors),
    ["rogue-cell--sector-1", "rogue-cell--sector-boundary"],
  );
  assert.deepEqual(getRogueSectorClassNames({ sectorId: 0 }, 1, sectors), ["rogue-cell--sector-0"]);
  assert.deepEqual(getRogueSectorClassNames({}, 1, sectors), []);
});

test("战术格 aria-label 包含战区名称，同时保留旧 cell 的标签行为", () => {
  assert.match(
    buildRogueCellAriaLabel(
      { sectorId: 2, revealed: true, mine: false, count: 2 },
      1,
      5,
      sectors,
    ),
    /C区.*第 2 行第 6 列|第 2 行第 6 列.*C区/,
  );
  assert.match(
    buildRogueCellAriaLabel({ revealed: false, flagged: false, questioned: false }, 0, 0),
    /第 1 行第 1 列.*未揭开/,
  );
});

test("契约候选卡文案包含描述、初始进度、奖励和未完成代价", () => {
  const copy = getRogueContractCardCopy({
    id: "intelRelay",
    label: "情报接力",
    description: "先收集情报点，再在不同战区使用一次工具。",
    progressLabel: "完成接力步骤",
    target: 2,
    reward: { type: "toolBonus", amount: 1, toolKey: "scoutPulse" },
  });
  assert.equal(copy.description, "先收集情报点，再在不同战区使用一次工具。");
  assert.equal(copy.progress, "完成接力步骤：0 / 2");
  assert.match(copy.reward, /奖励：.*侦察脉冲.*使用次数 \+1/);
  assert.equal(copy.penalty, "未完成扣 1 点能量");
});

test("当前路线契约显示阶段、完成和失败状态", () => {
  assert.match(
    getRogueContractProgressText({
      contractId: "intelRelay",
      progress: 1,
      target: 2,
      context: { intelSectorId: 0 },
    }),
    /已收集情报点，等待跨区工具操作.*未完成扣 1 点能量/,
  );
  assert.match(
    getRogueContractProgressText({
      contractId: "supplyRelay",
      progress: 1,
      target: 2,
      context: { supplySectorId: 1 },
    }),
    /已收集补给点，等待跨区安全揭开/,
  );
  assert.match(
    getRogueContractProgressText({
      contractId: "crossFire",
      progress: 1,
      target: 2,
      context: {},
    }),
    /交叉火力：1 \/ 2/,
  );
  assert.match(
    getRogueContractProgressText({
      contractId: "crossFire",
      progress: 2,
      target: 2,
      completed: true,
    }),
    /契约完成.*奖励：/,
  );
  assert.match(
    getRogueContractProgressText({
      contractId: "safeInsertion",
      progress: 1,
      target: 2,
      failed: true,
      failureReason: "第一次受伤，分段突入已失败。",
    }),
    /契约失败.*第一次受伤，分段突入已失败/,
  );
});
