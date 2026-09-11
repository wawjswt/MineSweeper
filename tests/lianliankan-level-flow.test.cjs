/* 关卡模式的游戏流程、计分和存档校验。
 * 运行: node tests/lianliankan-level-flow.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function element() {
  const classes = new Set();
  const listeners = new Map();
  const attributes = new Map();
  const elementValue = {
    textContent: "", value: "medium", dataset: {}, children: [], hidden: false,
    disabled: false, style: { setProperty(name, value) { this[name] = value; } },
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      toggle(name, force) {
        if (force === undefined) {
          if (classes.has(name)) { classes.delete(name); return false; }
          classes.add(name);
          return true;
        }
        if (force) classes.add(name); else classes.delete(name);
        return force;
      },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, callback) { listeners.set(type, callback); },
    fire(type) {
      const callback = listeners.get(type);
      if (callback) callback({ target: elementValue });
    },
    appendChild(child) {
      child.parentElement = elementValue;
      child._index = elementValue.children.length;
      elementValue.children.push(child);
      return child;
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    getBoundingClientRect() {
      const index = Number.isInteger(elementValue._index) ? elementValue._index : 0;
      return { left: (index % 10) * 45, top: Math.floor(index / 10) * 45, width: 40, height: 40 };
    },
    parentElement: { clientWidth: 720, getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 720 }; } },
  };
  Object.defineProperty(elementValue, "className", {
    get() { return Array.from(classes).join(" "); },
    set(value) { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach((name) => classes.add(name)); },
  });
  Object.defineProperty(elementValue, "innerHTML", {
    get() { return elementValue._innerHTML || ""; },
    set(value) {
      elementValue._innerHTML = String(value);
      if (value === "") elementValue.children.length = 0;
    },
  });
  return elementValue;
}

const elements = new Map();
for (const id of [
  "lianliankanShell", "llkBoard", "llkTimer", "llkStatus", "llkLeft", "llkDifficulty",
  "llkNew", "llkShuffle", "llkHint", "llkPathLayer", "llkMode", "llkLevelPicker",
  "llk3dStage", "llk3dToast", "llkTagline", "llkHintBtn", "llkChallengeResourceCard", "llkChallengeResources",
  "llkChallengeResult", "llkChallengeStars", "llkChallengeResultText",
]) elements.set(id, element());
const document = {
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  createElement() { return element(); },
  createElementNS() { return element(); },
  addEventListener() {},
};
elements.get("llkBoard").parentElement = { clientWidth: 720, getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 720 }; } };
elements.get("llkPathLayer").parentElement = elements.get("llkBoard").parentElement;
const intervalCallbacks = [];
let virtualNow = 0;
const sandbox = {
  document, console, Math, Date, Number, String, Array, Set, Map, Infinity,
  location: { hash: "" }, performance: { now: () => virtualNow },
  requestAnimationFrame(callback) { animationFrames.push(callback); }, addEventListener() {},
  setTimeout(callback, delay) {
    const timer = { callback, delay };
    animationTimers.push(timer);
    return timer;
  },
  clearTimeout(timer) {
    const index = animationTimers.indexOf(timer);
    if (index >= 0) animationTimers.splice(index, 1);
  },
  setInterval(callback, delay) {
    const timer = { callback, delay };
    intervalCallbacks.push(timer);
    return timer;
  },
  clearInterval(timer) {
    const index = intervalCallbacks.indexOf(timer);
    if (index >= 0) intervalCallbacks.splice(index, 1);
  },
};
const animationFrames = [];
const animationTimers = [];
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ["lianliankan-levels.js", "lianliankan-game.js"]) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
  vm.runInContext(source, sandbox, { filename: file });
}

const LLK = sandbox.__LLK__;
assert(LLK.levelFlow, "level flow helpers should be exposed for integration tests");
const flow = LLK.levelFlow;
const plain = (value) => JSON.parse(JSON.stringify(value));
const flushAnimationFrames = () => {
  while (animationFrames.length) animationFrames.shift()();
};
const runTimer = (delay) => {
  const index = animationTimers.findIndex((timer) => timer.delay === delay);
  assert(index >= 0, "expected animation timer with delay " + delay + "ms");
  const timer = animationTimers.splice(index, 1)[0];
  timer.callback();
};

// 下落动画计划必须只描述真实移动，并保留图案值及垂直/水平位移。
assert.strictEqual(typeof flow.dropPlan, "function", "drop plan helper should be exposed");
assert.deepStrictEqual(
  plain(flow.dropPlan([
    { from: 0, to: 6, value: 3 },
    { from: 8, to: 8, value: 4 },
    { from: 5, to: 11, value: 2 },
  ], 3)),
  [
    { from: 0, to: 6, value: 3, deltaRows: 2, deltaCols: 0 },
    { from: 5, to: 11, value: 2, deltaRows: 2, deltaCols: 0 },
  ],
  "drop plan should omit stationary cells and preserve source/target positions",
);

// 挑战模式配置与有限资源必须是纯逻辑、不可变地更新。
assert.strictEqual(typeof flow.challengeConfig, "function", "challenge config helper should be exposed");
assert.deepStrictEqual(plain(flow.challengeConfig()), {
  timeLimitSeconds: 90,
  hintLimit: 1,
  shuffleLimit: 0,
});
assert.strictEqual(typeof flow.createChallengeState, "function", "challenge state helper should be exposed");
let challengeState = flow.createChallengeState(flow.challengeConfig());
assert.deepStrictEqual(plain(challengeState), {
  timeLimitSeconds: 90,
  hintsRemaining: 1,
  shufflesRemaining: 0,
});
let challengeUse = flow.consumeChallengeResource(challengeState, "hint");
assert.deepStrictEqual(plain(challengeUse), {
  ok: true,
  state: { timeLimitSeconds: 90, hintsRemaining: 0, shufflesRemaining: 0 },
});
assert.deepStrictEqual(plain(challengeState), {
  timeLimitSeconds: 90,
  hintsRemaining: 1,
  shufflesRemaining: 0,
}, "resource consumption must not mutate the previous challenge state");
challengeUse = flow.consumeChallengeResource(challengeUse.state, "hint");
assert.deepStrictEqual(plain(challengeUse), {
  ok: false,
  state: { timeLimitSeconds: 90, hintsRemaining: 0, shufflesRemaining: 0 },
});
assert.strictEqual(flow.remainingChallengeSeconds(90, 0), 90);
assert.strictEqual(flow.remainingChallengeSeconds(90, 89_999), 1);
assert.strictEqual(flow.remainingChallengeSeconds(90, 90_000), 0);
assert.strictEqual(flow.remainingChallengeSeconds(90, 120_000), 0);
assert.strictEqual(typeof flow.challengeRating, "function", "challenge rating helper should be exposed");
assert.deepStrictEqual(plain(flow.challengeRating({ timeLimitSeconds: 90, elapsedSeconds: 40, maxCombo: 3 })), {
  stars: 3,
  label: "三星",
});
assert.deepStrictEqual(plain(flow.challengeRating({ timeLimitSeconds: 90, elapsedSeconds: 60, maxCombo: 0 })), {
  stars: 2,
  label: "二星",
});
assert.deepStrictEqual(plain(flow.challengeRating({ timeLimitSeconds: 90, elapsedSeconds: 90, maxCombo: 0 })), {
  stars: 1,
  label: "一星",
});
assert.deepStrictEqual(plain(flow.challengeRating({ timeLimitSeconds: 90, elapsedSeconds: 91, maxCombo: 8 })), {
  stars: 0,
  label: "未完成",
});
assert.deepStrictEqual(
  plain(sandbox.__LLK_LEVELS__.levels.map((level) => level.challenge)),
  [
    { timeLimitSeconds: 90, hintLimit: 1, shuffleLimit: 0 },
    { timeLimitSeconds: 80, hintLimit: 1, shuffleLimit: 0 },
    { timeLimitSeconds: 70, hintLimit: 1, shuffleLimit: 0 },
    { timeLimitSeconds: 60, hintLimit: 0, shuffleLimit: 0 },
    { timeLimitSeconds: 50, hintLimit: 0, shuffleLimit: 0 },
  ],
  "challenge profiles should use automatic reshuffling on every level",
);

// 真实关卡流程：连线完成后先锁定并淡出，再进入 FLIP 下落，完成后才解除锁定。
{
  const mode = elements.get("llkMode");
  const board = elements.get("llkBoard");
  const newButton = elements.get("llkNew");
  mode.value = "levels";
  mode.fire("change");
  const startPair = () => {
    // 第 1 关的固定起手对：索引 7 与 14，需要一折连接。
    board.children[7].fire("click");
    board.children[14].fire("click");
  };
  const movingCells = () => board.children.filter((cell) => cell.classList.contains("is-dropping"));

  startPair();
  assert.strictEqual(board.getAttribute("aria-busy"), "true", "successful pair should lock the level board");
  flushAnimationFrames();
  runTimer(260);
  assert(board.children[7].classList.contains("is-clearing"), "matched tiles should enter the clear phase");
  runTimer(160);
  assert(movingCells().length > 0, "collapse moves should create dropping tiles");
  const initialTransforms = movingCells().map((cell) => cell.style.transform);
  assert(initialTransforms.some((value) => value && value !== "translate3d(0, 0, 0)"),
    "dropping tiles should start from their source positions");
  assert.strictEqual(animationFrames.length, 1, "drop should wait for the second animation frame");
  animationFrames.shift()();
  assert.strictEqual(animationFrames.length, 1, "drop should use two animation frames before transitioning");
  animationFrames.shift()();
  assert(movingCells().every((cell) => cell.style.transform === "translate3d(0, 0, 0)"),
    "dropping tiles should transition to their target positions");
  runTimer(320);
  assert.strictEqual(board.getAttribute("aria-busy"), null, "completed drop should unlock the level board");
  assert.strictEqual(movingCells().length, 0, "completed drop should clean temporary classes");

  // 在下落 RAF 尚未执行前开新局，旧回调不得污染新棋盘。
  newButton.fire("click");
  startPair();
  flushAnimationFrames();
  runTimer(260);
  runTimer(160);
  assert(movingCells().length > 0, "second pair should schedule a drop");
  newButton.fire("click");
  flushAnimationFrames();
  assert.strictEqual(board.getAttribute("aria-busy"), null, "new game should cancel the old busy state");
  assert.strictEqual(elements.get("llkStatus").textContent, "第 1 关，待开始", "old animation must not update new-game status");
  assert.strictEqual(board.children.filter((cell) => cell.classList.contains("is-dropping")).length, 0,
    "old animation must not leave drop classes on the new board");
}

// 挑战模式限制提示次数、禁止手动重排，并以 90 秒倒计时结束本局。
{
  const mode = elements.get("llkMode");
  const board = elements.get("llkBoard");
  const newButton = elements.get("llkNew");
  const shuffleButton = elements.get("llkShuffle");
  const hintButton = elements.get("llkHintBtn");
  const resourceCard = elements.get("llkChallengeResourceCard");
  const resources = elements.get("llkChallengeResources");
  const resultCard = elements.get("llkChallengeResult");
  const stars = elements.get("llkChallengeStars");
  const resultText = elements.get("llkChallengeResultText");
  const timer = elements.get("llkTimer");
  const picker = elements.get("llkLevelPicker");
  mode.value = "challenge";
  mode.fire("change");
  assert.strictEqual(resourceCard.hidden, false, "challenge resources should be visible in challenge mode");
  assert.strictEqual(resultCard.hidden, true, "challenge result should be hidden before the run ends");
  assert(picker.children[0].textContent.includes("1:30"), "level picker should show level 1 challenge time");
  assert(picker.children[1].textContent.includes("1:20"), "level picker should show level 2 challenge time");
  assert.strictEqual(shuffleButton.disabled, true, "challenge mode should disable manual shuffle");
  assert.strictEqual(resources.textContent, "提示 1 · 自动重排");
  assert.strictEqual(timer.textContent, "1:30", "challenge mode should show its time limit before starting");

  hintButton.fire("click");
  assert.strictEqual(resources.textContent, "提示 0 · 自动重排", "challenge hint should be consumable once");
  hintButton.fire("click");
  assert.strictEqual(resources.textContent, "提示 0 · 自动重排", "an exhausted hint must not be consumed again");

  const beforeChallengeShuffle = board.children.map((cell) => cell.textContent);
  shuffleButton.fire("click");
  assert.deepStrictEqual(board.children.map((cell) => cell.textContent), beforeChallengeShuffle,
    "challenge shuffle should not change the board");
  assert.strictEqual(resources.textContent, "提示 0 · 自动重排");
  assert.strictEqual(elements.get("llkStatus").textContent, "挑战模式不支持手动重排，无解时会自动重排");

  newButton.fire("click");
  board.children[7].fire("click");
  assert.strictEqual(intervalCallbacks.length, 1, "starting a challenge should start one countdown timer");
  virtualNow = 89_999;
  intervalCallbacks[0].callback();
  assert.strictEqual(timer.textContent, "0:01");
  virtualNow = 90_000;
  intervalCallbacks[0].callback();
  assert.strictEqual(timer.textContent, "0:00");
  assert.strictEqual(elements.get("llkStatus").textContent, "时间到，挑战失败");
  assert.strictEqual(intervalCallbacks.length, 0, "expired challenge should stop its timer");
  assert.strictEqual(resources.textContent, "提示 1 · 自动重排", "new challenge should reset limited resources");
  assert.strictEqual(resultCard.hidden, false, "challenge result should be visible after timeout");
  assert.strictEqual(stars.textContent, "☆☆☆");
  assert.strictEqual(resultText.textContent, "未完成 · 时间到");
  mode.value = "levels";
  mode.fire("change");
  assert.strictEqual(shuffleButton.disabled, false, "manual shuffle should return outside challenge mode");
}

// 评分错误（基础分、层数或 3 秒窗口）应使本组断言失败。
let combo = flow.nextScore({ score: 0, combo: 0, maxCombo: 0, lastSuccessMs: null }, 100);
assert.deepStrictEqual(plain(combo), { score: 100, combo: 1, maxCombo: 1, lastSuccessMs: 100 });
combo = flow.nextScore(combo, 2_900);
assert.deepStrictEqual(plain(combo), { score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 });
combo = flow.nextScore(combo, 6_001);
assert.deepStrictEqual(plain(combo), { score: 325, combo: 1, maxCombo: 2, lastSuccessMs: 6_001 });
assert.deepStrictEqual(plain(flow.resetCombo(combo)), { score: 325, combo: 0, maxCombo: 2, lastSuccessMs: null });
assert.deepStrictEqual(
  plain(flow.scorePair({ score: 10, combo: 2, maxCombo: 2, lastSuccessMs: 100 }, 500, false)),
  { score: 10, combo: 2, maxCombo: 2, lastSuccessMs: 100 },
  "classic and 3D modes must not receive level scoring"
);
assert.deepStrictEqual(
  plain(flow.expireCombo({ score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 }, 5_901)),
  { score: 225, combo: 0, maxCombo: 2, lastSuccessMs: null },
  "combo must expire after three seconds of active time"
);
assert.deepStrictEqual(
  plain(flow.expireCombo({ score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 }, 5_900)),
  { score: 225, combo: 2, maxCombo: 2, lastSuccessMs: 2_900 },
  "combo must remain active at the inclusive three-second boundary"
);
assert.strictEqual(flow.applyClearBonus(100, false), 100, "classic and 3D modes must not receive level clear bonus");
assert.strictEqual(flow.applyClearBonus(100, true), 600, "level mode must receive the clear bonus");

// 障碍不可选；提示只能报告一对可消除图案，不能修改棋盘。
assert.strictEqual(flow.isSelectable(-1), false, "obstacle clicks must be ignored");
assert.strictEqual(flow.isSelectable(0), false, "empty cells must be ignored");
assert.strictEqual(flow.isSelectable(2), true, "tiles must remain selectable");
const hintGrid = [1, 1, -1, 2, 2, 0];
const beforeHint = hintGrid.slice();
assert.deepStrictEqual(plain(flow.findHintPair(hintGrid, 2, 3, LLK.findAnyPair)), { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } });
assert.deepStrictEqual(hintGrid, beforeHint, "hint must not change the board");

// 损坏存档必须回退；通关解锁下一关，并分别保留每关的最佳分数、时间和 Combo。
const storage = {
  value: "{bad json",
  getItem() { return this.value; },
  setItem(key, value) { this.key = key; this.value = value; },
};
let progress = flow.readProgress(storage);
assert.deepStrictEqual(plain(progress), { version: 1, unlockedLevel: 1, completed: {} });
for (const corrupted of [
  { version: 1, unlockedLevel: 999, completed: {} },
  { version: 1, unlockedLevel: 2, completed: { "9": { score: 1, time: 1, combo: 1 } } },
  { version: 1, unlockedLevel: 2, completed: { "1": { score: -1, time: 1, combo: 1 } } },
  { version: 1, unlockedLevel: 4, completed: { "1": { score: 1, time: 1, combo: 1 } } },
]) {
  storage.value = JSON.stringify(corrupted);
  assert.deepStrictEqual(plain(flow.readProgress(storage)), { version: 1, unlockedLevel: 1, completed: {} });
}
progress = flow.recordCompletion(progress, 1, { score: 620, time: 38, combo: 4 });
assert.deepStrictEqual(plain(progress), {
  version: 1, unlockedLevel: 2, completed: { "1": { score: 620, time: 38, combo: 4 } },
});
progress = flow.recordCompletion(progress, 1, { score: 500, time: 31, combo: 2 });
assert.deepStrictEqual(plain(progress.completed["1"]), { score: 620, time: 31, combo: 4 });
assert.strictEqual(flow.writeProgress(progress, storage), true);
assert.strictEqual(storage.key, "lianliankan-level-progress-v1");
assert.deepStrictEqual(plain(flow.readProgress(storage)), plain(progress));
let ratedProgress = flow.recordCompletion(flow.defaultProgress(), 1, { score: 620, time: 38, combo: 4, stars: 2 });
assert.strictEqual(ratedProgress.completed["1"].stars, 2);
ratedProgress = flow.recordCompletion(ratedProgress, 1, { score: 500, time: 31, combo: 2, stars: 1 });
assert.strictEqual(ratedProgress.completed["1"].stars, 2, "best challenge rating should be retained");

// 无解时自动洗牌：障碍、图案多重集合与分数不应改变，且结果必须有可用配对。
const deadGrid = [
  -1, -1, 1, -1, -1,
  -1, 1, -1, 2, -1,
  3, 4, -1, 5, 6,
  7, -1, -1, 8, -1,
  9, 0, 0, -1, 0,
];
assert.strictEqual(LLK.findAnyPair(deadGrid, 5, 5), null, "fixture must start as a dead board");
const resolved = flow.ensureSolvable(deadGrid, 5, 5, sandbox.__LLK_LEVELS__, LLK.findAnyPair, () => 0);
assert.strictEqual(resolved.autoReshuffled, true);
assert.deepStrictEqual(plain(resolved.grid.filter((value) => value === -1)), deadGrid.filter((value) => value === -1));
assert.deepStrictEqual(plain(resolved.grid.filter((value) => value > 0).sort()), deadGrid.filter((value) => value > 0).sort());
assert(LLK.findAnyPair(resolved.grid, 5, 5), "automatic reshuffle must restore a playable pair");

console.log("ALL LIANLIANKAN LEVEL FLOW CHECKS PASSED");
