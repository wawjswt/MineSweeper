import { getContractCatalog } from "./rogue-contracts.js";
import { ROGUE_LEVELS } from "./rogue-level.js";
import { TOOL_DEFINITIONS, UPGRADE_DEFINITIONS } from "./rogue-items.js";
import { createRogueRunState } from "./rogue-state.js";

const TOOL_GUIDANCE = {
  scoutPulse: "怎么用：先选中它，再点一个没有翻开的格子。效果：告诉你这个格子周围 3×3 范围里有几颗雷，但不会替你翻开格子，也不会告诉你每颗雷的具体位置。只有你点中的情报点会被收集。",
  defusalKit: "怎么用：先给一个格子插旗，再选中它并点击这面旗。效果：如果旗子插对了，雷会被拆掉；如果插错了，旗子会被清除，并翻开这片安全区域。没有插旗的格子不能使用它。",
  reactionShield: "怎么用：选中它后，再点一下棋盘就会开启。效果：本层下一次踩到雷时不会掉生命，但护盾会随即消失。同一时间只能开一个护盾，它不需要指定某个战区。",
};

const CONTRACT_GUIDANCE = {
  noDamage: "在本层清空全部安全格时结算。护盾抵挡爆炸不算损失生命；实际受伤后本层契约立即失败。",
  reconnaissance: "直接揭开情报点，或把侦察目标落在情报点上即可完成；只把情报点包含在扫描范围内不算收集。",
  controlledDemolition: "先给怀疑的雷格插旗，再用拆雷装置。拆穿假旗、直接踩雷或护盾抵挡都不算成功拆除真雷。",
  reservePower: "在本层清空全部安全格时检查剩余能量。收尾前留好预算，奖励还包含安全连击进度。",
  intelRelay: "必须先收集情报点，再在与该情报点不同的战区成功使用有落点的工具。先用工具后收集不算；护盾不计入这一步。",
  supplyRelay: "必须先收集补给点，再在其他战区揭开安全格；单纯扫描或插旗不算安全揭开。",
  crossFire: "第一次成功使用有落点的工具会记录工具种类与战区；之后须在另一个战区使用另一种工具。重复同种工具、同区操作或启动护盾都不能凑齐条件。",
  safeInsertion: "在首次实际受伤前满足描述中的战区与安全格数量；空白区域自动展开的安全格也会计入。未完成时首次受伤即失败，护盾抵挡不算受伤。",
};

const UPGRADE_GUIDANCE = {
  storage: "效果：能量上限加 1，并马上获得 1 点能量。",
  chain: "效果：连续成功翻开 3 次安全区域后获得 1 点能量；踩到雷会清空连击。",
  medical: "效果：生命上限加 1，并马上恢复 1 点生命。",
  "toolBoost:scoutPulse": "效果：下一层的侦察脉冲多 1 次使用机会。",
  "toolBoost:defusalKit": "效果：下一层的拆雷装置多 1 次使用机会。",
  "toolBoost:reactionShield": "效果：下一层的反应护盾多 1 次使用机会。",
  supply: "效果：下一层的三种工具各多 1 次使用机会。",
};

const SPECIAL_CELL_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "intel",
    label: "情报点",
    description: "找到它后，可以查看附近一小片区域有多少雷。",
    effect: "怎么用：直接翻开它，或用侦察脉冲点中它。结果：显示它周围 3×3 范围的雷数。",
  }),
  Object.freeze({
    id: "supply",
    label: "补给点",
    description: "找到它后，可以恢复能量并补充一种工具。",
    effect: "怎么用：直接翻开它，或被拆雷装置触发。结果：能量最多恢复 1 点，并给当前剩余次数最少的工具补充 1 次。",
  }),
]);

const SECTION_DEFINITIONS = Object.freeze([
  { id: "overview", title: "快速开始", dataKey: "overview" },
  { id: "floors", title: "五层流程", dataKey: "floors" },
  { id: "contracts", title: "任务契约", dataKey: "contracts" },
  { id: "special-cells", title: "特殊格", dataKey: "specialCells" },
  { id: "tools", title: "主动工具", dataKey: "tools" },
  { id: "upgrades", title: "战后强化", dataKey: "upgrades" },
  { id: "illustrations", title: "道具效果图", dataKey: "illustrations" },
  { id: "tips", title: "操作方法", dataKey: "tips" },
]);

const ILLUSTRATION_ENTRIES = [
  ["tool", "scoutPulse", "侦察脉冲", "主动道具", "游戏内画面：选中道具后，棋盘上会圈出被扫描的 3×3 格子。"],
  ["tool", "defusalKit", "拆雷装置", "主动道具", "游戏内画面：先插旗，再对着旗子使用；真雷会被拆掉，假旗会变成安全区域。"],
  ["tool", "reactionShield", "反应护盾", "主动道具", "游戏内画面：雷格被护盾挡住时，生命不减少，但护盾会消失。"],
  ["special", "intel", "情报点", "特殊格", "游戏内画面：棋盘中带放大镜标记的特殊格，翻开或扫描它才能收集情报。"],
  ["special", "supply", "补给点", "特殊格", "游戏内画面：棋盘中带箱子标记的特殊格，触发后恢复能量并补工具次数。"],
  ["upgrade", "storage", "储能核心", "强化道具", "游戏内画面：能量条上限增加，并立即多出 1 点能量。"],
  ["upgrade", "chain", "连锁能源", "强化道具", "游戏内画面：连续翻开安全区域后，连击会把能量送回能量条。"],
  ["upgrade", "medical", "医疗组件", "强化道具", "游戏内画面：生命上限增加，并立即恢复 1 点生命。"],
  ["upgrade", "toolBoost:scoutPulse", "工具增幅·侦察脉冲", "强化道具", "游戏内画面：下一层侦察脉冲的可用次数增加 1 次。"],
  ["upgrade", "toolBoost:defusalKit", "工具增幅·拆雷装置", "强化道具", "游戏内画面：下一层拆雷装置的可用次数增加 1 次。"],
  ["upgrade", "toolBoost:reactionShield", "工具增幅·反应护盾", "强化道具", "游戏内画面：下一层反应护盾的可用次数增加 1 次。"],
  ["upgrade", "supply", "补给箱", "强化道具", "游戏内画面：下一层侦察、拆雷、护盾三种工具各增加 1 次。"],
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
  const tools = Object.values(TOOL_DEFINITIONS).map((tool) => ({ ...clone(tool), guidance: TOOL_GUIDANCE[tool.id] }));
  const specialCells = SPECIAL_CELL_DEFINITIONS.map(clone);
  const contracts = getContractCatalog().map((contract) => ({ ...contract, guidance: CONTRACT_GUIDANCE[contract.id] }));
  const upgrades = UPGRADE_DEFINITIONS.map((upgrade) => ({ ...clone(upgrade), guidance: UPGRADE_GUIDANCE[upgrade.id] }));
  const illustrations = getIllustrations();
  const initial = createRogueRunState();
  const overview = {
    title: "战术扫雷",
    description: "在五层战区中揭开全部安全格，管理能量、生命、工具和战术契约。",
    notes: [
      "行动循环：每层先从两份契约中选一份，选择后本层不能更换，随后首次揭开生成首点安全的棋盘。清空全部安全格后，前四层进入战后强化三选一，再选下一层契约；第五层清空后直接通关。生命耗尽则本局结束。",
      `资源起点：生命 ${initial.lives}/${initial.maxLives}，能量 ${initial.energy}/${initial.maxEnergy}；侦察脉冲、拆雷装置、反应护盾初始各 ${initial.level.activeToolUses.scoutPulse} 次。生命用于承受失误；能量与工具剩余次数是两个独立限制，必须同时满足才能使用。`,
      "行动得分：每揭开一个安全格得 1 分；触雷或用拆雷装置解除一颗真雷得 3 分；清空一层得 10 分，契约奖励另计。护盾只能避免生命损失，不能取消这次地雷处理得分。",
      "资源恢复：普通情况下连续成功安全揭开 4 次获得 1 点能量；一次空白展开多个格子只算一次操作。踩雷会清空连击，护盾抵挡时也一样。补给、契约或强化可补充资源，能量不会超过上限。",
      "层间结算：生命与能量延续到下一层，不会自动补满；工具次数按基础次数与已获得加成重新配置，护盾状态和安全连击重新开始。分数包括每个安全格、处理地雷、过层与契约奖励。",
      "战区路线：棋盘按列划分为 A、B、C 三个连续战区，每局宽度可能不同。战区摘要显示已揭开安全格与总数；全部揭开后显示已控制。跨区契约看实际目标所在战区，不是视觉距离或扫描覆盖范围。",
      "阅读指南：可在选契约前、行动中、强化选择或结算时打开。本指南不暂停、不重置游戏，也不改变已选契约、工具、标记模式或计时；关闭后继续原来的操作。",
    ],
  };
  const tips = [
    "鼠标与触屏：左键或轻触执行当前动作；右键或长按依次循环「旗子 → 问号 → 未标记」。开启顶部标记模式后，点击未揭开格子会改为标记。",
    "键盘：棋盘获得焦点后，方向键移动，F 循环标记，Enter 或空格执行当前动作；R 重开整局。工具选中时优先使用工具，即使标记模式开启也一样。",
    "工具与取消：第一次安全揭开后工具才可用。点击工具只选择，不立即扣费；再点击棋盘执行。有效使用后自动取消选择；无效目标不扣费并保留选择。再次点击同一工具或在指南关闭时按 Escape 可取消。",
    "连开与误旗：点击已揭开的数字格，在周围旗子数等于数字时会尝试揭开其他邻格。旗子数相等不代表旗子位置正确，误旗仍可能导致踩雷。",
    "指南键盘：Tab / Shift+Tab 在弹窗内移动，Enter 打开章节，方向键或翻页键滚动阅读；关闭按钮、Escape 或点击外侧遮罩均可关闭，焦点回到指南入口。指南打开时 R 不会重开，Escape 只关闭指南，保留已选工具。",
    "常见失误：扫描雷数不是逐格安全证明；特殊点须直接揭开或作为扫描目标才能收集，且每个点只生效一次。能量已满时补给不会突破上限。",
    "契约排错：注意先后顺序、不同战区与不同工具这三个条件。护盾没有战区落点，不能用于跨区工具步骤；未完成契约仍可过层，但会扣除能量。",
    "收尾检查：每层目标是揭开全部安全格，不必标完或拆完所有雷；标错旗的安全格仍会阻止过层。先核对战区进度、工具次数和能量，再决定最后几步。",
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

function formatContractReward(reward, tools) {
  if (!reward) return "完成后获得行动奖励";
  if (reward.type === "energy") return `获得 ${reward.amount} 点能量`;
  if (reward.type === "score") return `获得 ${reward.amount} 分${reward.streakAmount ? `，安全连击 +${reward.streakAmount}` : ""}`;
  if (reward.type === "toolBonus") {
    const tool = tools.find(({ id }) => id === reward.toolKey);
    return `${tool?.label || "对应工具"}下层额外使用 ${reward.amount} 次`;
  }
  return "完成后获得行动奖励";
}

function makeCards(items, makeCard) {
  return items.map((item) => makeCard(item));
}

export function getRogueGuideRenderSections(catalog = getRogueGuideCatalog()) {
  const data = {
    overview: {
      intro: catalog.overview.description,
      notes: catalog.overview.notes,
    },
    floors: {
      intro: "五层战区按顺序推进；每一层都必须清空全部安全格。",
      notes: [
        "路线情报：每层棋盘按列划分为 A、B、C 三个连续战区，边界在开局公开，宽度可能变化。",
        "战区只影响契约和路线统计，不锁格、不改数字；按战区进度决定下一步推进方向。",
      ],
      sectorMap: {
        title: "棋盘上的 A/B/C 区怎么认？",
        sectors: [
          { id: "a", label: "A区", detail: "左侧区域" },
          { id: "b", label: "B区", detail: "中间区域" },
          { id: "c", label: "C区", detail: "右侧区域" },
        ],
        caption: "每个小格都属于其中一个区域；彩色边界只是分区提示，不会改变这个格子的数字或普通扫雷操作。",
      },
      cards: makeCards(catalog.floors, ({ floor, label, rows, cols, mines }) => ({
        title: `第 ${floor} 层 · ${label}`,
        body: `${rows} × ${cols} 棋盘，部署 ${mines} 枚雷。`,
      })),
    },
    tools: {
      intro: "选择工具后再点选棋盘目标；工具会消耗能量，并在有效使用后自动取消选择。",
      cards: makeCards(catalog.tools, ({ label, description, cost, guidance }) => ({
        title: label,
        body: description,
        meta: `消耗 ${cost} 点能量`,
        guidance,
      })),
    },
    specialCells: {
      intro: "特殊格会在开局安全区外生成；直接揭开或作为侦察扫描的目标格时触发，每个点只收集一次。处于扫描覆盖范围内不等于被收集。",
      cards: makeCards(catalog.specialCells, ({ id, label, description, effect }) => ({
        title: label,
        body: description,
        meta: effect,
        illustration: catalog.illustrations.find((illustration) => (
          illustration.entityType === "special" && illustration.entityId === id
        )),
      })),
    },
    contracts: {
      intro: "每层从两份契约中选择一份。行动型条件达成后立即发奖，无伤与保留能量在清空安全格时结算。未完成仍可过层，结算扣 1 点能量，最低为 0；每层奖励和惩罚各最多结算一次。",
      cards: makeCards(catalog.contracts, ({ label, description, progressLabel, reward, guidance }) => ({
        title: label,
        body: description,
        meta: `目标：${progressLabel}。奖励：${formatContractReward(reward, catalog.tools)}。未完成扣 1 点能量。`,
        guidance,
      })),
    },
    upgrades: {
      intro: "前四层清空后，从随机给出的三项强化中选择一项才会进入下一层；已获得的强化不再进入候选。候选不足时以能量补充项补齐。最后一层直接结算胜利。",
      cards: makeCards(catalog.upgrades, ({ label, description, guidance }) => ({ title: label, body: description, guidance })),
    },
    illustrations: {
      intro: "下面看到的是游戏里实际会遇到的格子和效果：棋盘格、数字、旗子、特殊点和道具作用都画在场景里，旁边文字说明对应图片中的变化。",
      illustrations: catalog.illustrations.map(({ path, title, category, alt, caption }) => ({
        path,
        title,
        category,
        alt,
        caption,
      })),
    },
    tips: {
      intro: "把每一步都当作可验证的行动：先读信息，再决定风险。",
      notes: catalog.tips,
    },
  };

  return catalog.sections.map((section) => ({
    ...section,
    ...(data[section.dataKey] || {}),
  }));
}

function appendGuideText(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

export function renderRogueGuideCatalog({ chapterNav, contentRoot, catalog = getRogueGuideCatalog() }) {
  if (!chapterNav || !contentRoot) return;
  const sections = getRogueGuideRenderSections(catalog);
  chapterNav.replaceChildren();
  contentRoot.replaceChildren();

  for (const sectionData of sections) {
    const sectionId = `rogueGuideSection-${sectionData.id}`;
    const chapter = document.createElement("a");
    chapter.className = "rogue-guide__chapter";
    chapter.href = `#${sectionId}`;
    chapter.textContent = sectionData.title;
    chapterNav.appendChild(chapter);

    const section = document.createElement("section");
    section.className = "rogue-guide__section";
    section.id = sectionId;
    section.tabIndex = -1;
    const headingId = `${sectionId}-title`;
    section.setAttribute("aria-labelledby", headingId);
    const heading = appendGuideText(section, "h3", sectionData.title, "rogue-guide__section-title");
    heading.id = headingId;
    if (sectionData.intro) appendGuideText(section, "p", sectionData.intro, "rogue-guide__intro");

    if (sectionData.notes) {
      const list = document.createElement("ul");
      list.className = "rogue-guide__notes";
      for (const note of sectionData.notes) appendGuideText(list, "li", note);
      section.appendChild(list);
    }

    if (sectionData.sectorMap) {
      const figure = document.createElement("figure");
      figure.className = "rogue-guide__sector-figure";
      const map = document.createElement("div");
      map.className = "rogue-guide__sector-map";
      map.setAttribute("aria-label", "A区、B区、C区连续分布示意图");
      for (const sector of sectionData.sectorMap.sectors) {
        const column = document.createElement("div");
        column.className = `rogue-guide__sector-column rogue-guide__sector-column--${sector.id}`;
        column.setAttribute("aria-label", `${sector.label}，${sector.detail}`);
        for (let row = 0; row < 4; row += 1) {
          const cell = document.createElement("span");
          cell.className = "rogue-guide__sector-cell";
          cell.setAttribute("aria-hidden", "true");
          column.appendChild(cell);
        }
        const label = appendGuideText(column, "strong", sector.label, "rogue-guide__sector-label");
        label.setAttribute("aria-hidden", "true");
        map.appendChild(column);
      }
      figure.appendChild(map);
      appendGuideText(figure, "figcaption", sectionData.sectorMap.caption);
      section.appendChild(figure);
    }

    if (sectionData.cards) {
      const cards = document.createElement("div");
      cards.className = "rogue-guide__cards";
      for (const card of sectionData.cards) {
        const article = document.createElement("article");
        article.className = "rogue-guide__card";
        if (card.illustration) {
          const image = document.createElement("img");
          image.className = "rogue-guide__card-illustration";
          image.src = card.illustration.path;
          image.alt = card.illustration.alt;
          image.loading = "lazy";
          article.appendChild(image);
        }
        appendGuideText(article, "h4", card.title);
        appendGuideText(article, "p", card.body);
        if (card.meta) appendGuideText(article, "p", card.meta, "rogue-guide__meta");
        if (card.guidance) appendGuideText(article, "p", card.guidance);
        cards.appendChild(article);
      }
      section.appendChild(cards);
    }

    if (sectionData.illustrations) {
      const gallery = document.createElement("div");
      gallery.className = "rogue-guide__gallery";
      for (const illustration of sectionData.illustrations) {
        const figure = document.createElement("figure");
        figure.className = "rogue-guide__figure";
        const image = document.createElement("img");
        image.src = illustration.path;
        image.alt = illustration.alt;
        image.loading = "lazy";
        const title = appendGuideText(figure, "strong", illustration.title);
        title.className = "rogue-guide__figure-title";
        appendGuideText(figure, "figcaption", `${illustration.category} · ${illustration.caption}`);
        figure.prepend(image);
        gallery.appendChild(figure);
      }
      section.appendChild(gallery);
    }

    contentRoot.appendChild(section);
  }
}

export function createRogueGuideDialogController({ dialog, trigger, closeButton }) {
  let restoreFocus = false;

  function restoreTriggerFocus() {
    if (!restoreFocus) return;
    restoreFocus = false;
    trigger?.focus?.({ preventScroll: true });
  }

  function close({ restoreFocus: restore = true } = {}) {
    if (!dialog?.open) return false;
    restoreFocus = restore;
    dialog.close();
    restoreTriggerFocus();
    return true;
  }

  function open() {
    if (!dialog || dialog.open) return false;
    restoreFocus = true;
    dialog.showModal();
    return true;
  }

  function handleGlobalKeydown(event) {
    if (!dialog?.open) return false;
    // Only global gameplay shortcuts are intercepted in capture phase.
    // Navigation and native activation must reach dialog links and controls.
    if (event.key !== "Escape" && event.key.toLowerCase() !== "r") return false;
    if (!event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Escape") close();
    return true;
  }

  trigger?.addEventListener("click", open);
  closeButton?.addEventListener("click", () => close());
  dialog?.addEventListener("close", () => {
    // A queued close event from an earlier opening must not steal modal focus.
    if (!dialog.open) restoreTriggerFocus();
  });
  dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog?.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });

  return Object.freeze({ open, close, isOpen: () => Boolean(dialog?.open), handleGlobalKeydown });
}

export function createRogueGuide(elements = {}) {
  renderRogueGuideCatalog({
    chapterNav: elements.rogueGuideChapters,
    contentRoot: elements.rogueGuideContent,
  });
  return createRogueGuideDialogController({
    dialog: elements.rogueGuideDialog,
    trigger: elements.rogueGuideButton,
    closeButton: elements.rogueGuideClose,
  });
}
