# 连连看失败反馈与扫雷自定义面板显示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复两个独立的交互问题：连连配对失败时给出明确、可理解的原因；扫雷只有在选择“自定义”难度时显示自定义行列/雷数面板。

**Architecture:** 将连连看的失败原因判断放在现有路径规则旁边，继续复用当前最多两次转弯的合法性判断，不改变消除规则。扫雷页面由 `index.html` 直接加载 `dist/bundle.js`，因此自定义面板的显示逻辑必须修改实际运行入口，并用现有 VM 测试覆盖模式和难度切换。

**Tech Stack:** 原生 JavaScript、DOM/CSS、Node.js VM 测试、现有静态页面。

**Spec:**

- 连连看：两个图案不能消除时，明确提示“图案不一致”“无法连接：路径超过两次转弯”或“无法连接：中间有图案阻挡”；提示短暂显示，不破坏当前选中逻辑。
- 扫雷：经典模式的普通/简单/困难等预设难度隐藏自定义面板；只有经典模式选择“自定义”时显示；数独及其他非扫雷模式隐藏。

## Global Constraints

- 页面实际入口是 `index.html` -> `dist/bundle.js`、`src/game-tabs.js`、`src/sudoku-game.js`、`src/lianliankan-game.js`；不能只修改未被页面直接加载的源码文件后就宣称完成。
- 不改变连连看“最多两次转弯”的游戏规则，不回退此前已经修复的连线坐标计算。
- 不改变扫雷预设难度的棋盘参数，不清空用户已经输入的自定义行列/雷数；本次只控制面板显示。
- 不把 `.git.corrupt-1133/` 或其他 Git 临时目录加入提交。
- 每个任务都先补测试、确认测试能在旧代码上失败，再实现，再运行回归测试。

---

## Task 1: 为连连看配对失败增加原因反馈

**Files:**

- Modify: `src/lianliankan-game.js`
- Modify: `tests/lianliankan.test.js`
- Optional style-only change if the existing status element needs a state class: `src/style.css`

### 1.1 先写失败测试

- [ ] 在 `tests/lianliankan.test.js` 的 `window.__LLK__` 测试接口中加入对纯函数 `explainPairFailure` 的调用。
- [ ] 增加以下固定用例，断言信息和返回值稳定：

  ```js
  assert.strictEqual(
    LLK.explainPairFailure([[1, 1]], 1, 2, { r: 0, c: 0 }, { r: 0, c: 1 }),
    null
  );
  assert.strictEqual(
    LLK.explainPairFailure([[1, 2]], 1, 2, { r: 0, c: 0 }, { r: 0, c: 1 }),
    "图案不一致"
  );
  assert.strictEqual(
    LLK.explainPairFailure([[1, 2, 1]], 1, 3, { r: 0, c: 0 }, { r: 0, c: 2 }),
    "无法连接：中间有图案阻挡"
  );
  ```

- [ ] 增加“只能通过三次以上转弯到达”的棋盘用例，断言返回“无法连接：路径超过两次转弯”。如果当前算法没有可复用的无限转弯搜索，测试夹具应明确构造一条存在但超过两次转弯的通路，不能把它和完全无路区分开。
- [ ] 增加空格/同一格保护用例，确保失败提示不会把空格误报为可连接图案。
- [ ] 先运行 `node tests\lianliankan.test.js`，确认新增断言因接口尚不存在而失败。

### 1.2 实现最小的可测试反馈接口

- [ ] 在 `src/lianliankan-game.js` 的路径判断附近新增纯函数 `explainPairFailure(grid, rows, cols, a, b)`：
  - 任一坐标为空或不是有效图案时返回空格选择提示；
  - 两个图案值不同返回 `图案不一致`；
  - 复用现有最多两次转弯的 `findPath`，合法时返回 `null`；
  - 不合法时再用同一障碍规则做不限制转弯次数的可达性判断：完全不可达返回 `无法连接：中间有图案阻挡`，只有超过两次转弯才能到达则返回 `无法连接：路径超过两次转弯`。
- [ ] 不复制一套会绕过边界补空逻辑的路径算法；新的无限转弯搜索必须使用和现有 `findPath` 相同的边界、空格和障碍定义，并用方向状态防止循环。
- [ ] 将 `explainPairFailure` 挂到现有 `window.__LLK__` 测试对象，保持测试环境不需要启动浏览器。

### 1.3 接入点击流程且不破坏消除行为

- [ ] 在现有 `handleCellClick` 的配对失败分支中，先调用 `explainPairFailure`，再保留当前“清除旧选中并将新点击格设为选中”的行为。
- [ ] 增加短暂状态提示辅助函数：保存失败前的状态文本，显示原因约 1.2 秒后恢复；如果计时期间游戏状态已经更新，则不要用旧文本覆盖新状态。
- [ ] 成功连接分支仍必须执行原有的画线、延时清除、计数和胜利判断；失败反馈不能阻止合法配对再次点击。
- [ ] 若现有状态元素支持 CSS 状态类，可给失败提示增加短暂的视觉强调；这不是规则逻辑，不得依赖视觉类才能完成提示。

### 1.4 验证

- [ ] 运行 `node tests\lianliankan.test.js` 和 `node tests\lianliankan3d.test.js`。
- [ ] 在页面中进入连连看 2D：
  - 点两个不同图案，看到“图案不一致”；
  - 点相同但被阻挡的图案，看到“无法连接：中间有图案阻挡”；
  - 点相同但路径超过两次转弯的图案，看到“无法连接：路径超过两次转弯”；
  - 点一组合法图案，仍能画线、消除，剩余数量减少。
- [ ] 确认失败提示消失后不会覆盖“已消除/胜利/无路可走”等后续状态。
- [ ] 完成后提交一个只包含连连看反馈相关改动的提交，便于后续回滚和定位。

---

## Task 2: 只在选择自定义难度时显示扫雷自定义面板

**Files:**

- Modify: `dist/bundle.js`
- Modify: `tests/sudoku-generator.test.js`

### 2.1 先写失败测试

- [ ] 在现有自定义面板测试附近增加四个状态断言：
  - 经典模式 + `normal`：`customDifficultyCard.hidden === true`；
  - 经典模式 + `custom`：`customDifficultyCard.hidden === false`；
  - 从 `custom` 切换回任一预设：面板再次隐藏；
  - `sudoku` 模式无论难度值是什么：面板隐藏。
- [ ] 同时断言 `aria-hidden` 与 `hidden` 保持一致，确保面板隐藏后辅助技术不会把它当作可操作内容。
- [ ] 先运行 `node tests\sudoku-generator.test.js`，确认旧逻辑在“经典 + 预设”用例上失败，因为当前实现只在数独模式隐藏面板。

### 2.2 修改实际运行入口的显示逻辑

- [ ] 在 `dist/bundle.js` 的 `updateCustomDifficultyVisibility()` 中使用唯一显示条件：`modeKey !== "sudoku" && difficultyKey === "custom"`。
- [ ] 条件为真时设置 `hidden = false`、`aria-hidden = "false"`；否则设置 `hidden = true`、`aria-hidden = "true"`。
- [ ] 保留现有 `setDifficulty`、`setMode`、`normalizeDifficultySelection`、`refreshDifficultyOptions` 的调用链，确保以下入口都能即时刷新：下拉框 change、模式切换、重置、初次加载。
- [ ] 不删除自定义难度选项，也不修改自定义输入值；切回“自定义”时用户之前的输入仍可继续使用。

### 2.3 验证

- [ ] 运行 `node tests\sudoku-generator.test.js`，确认新增状态断言通过。
- [ ] 在页面中分别选择经典普通、经典自定义、数独，确认面板只在经典自定义下可见。
- [ ] 在窄屏宽度下重复切换，确认隐藏后没有残留的大块空白或仍可点击的输入框。
- [ ] 完成后提交一个只包含自定义面板显示相关改动的提交。

---

## Task 3: 全量回归与交付检查

**Files:**

- No new product files; inspect the two task commits and the working tree.

### 3.1 自动化回归

- [ ] 依次运行：

  ```text
  node tests\sudoku-generator.test.js
  node tests\classic-sudoku.test.js
  node tests\lianliankan.test.js
  node tests\lianliankan3d.test.js
  git diff --check
  git status --short
  ```

- [ ] 如果测试失败，先定位是新改动还是已有环境问题；不得用删除测试、放宽断言或跳过脚本的方式“修复”结果。
- [ ] 确认 `.git.corrupt-1133/` 等 Git 临时目录仍未被加入任何提交。

### 3.2 最终验收清单

- [ ] 连连看失败时用户能从状态文本知道失败原因，且合法配对仍然可以消除。
- [ ] 连连看 2D 与 3D 的既有旋转、提示、路径和计数行为没有回归。
- [ ] 扫雷预设难度不再展示自定义输入面板；选择自定义后面板立即出现；切到数独后立即隐藏。
- [ ] 桌面和移动布局都通过手动冒烟测试。
- [ ] 记录修改文件、测试命令和已知限制；如无限转弯搜索仍无法可靠区分两类失败，必须在交付说明中明确说明，而不是给出错误提示。

### 3.3 交付

- [ ] 确认工作区只包含本计划涉及的产品改动和已有用户文件。
- [ ] 若后续要求推送，先展示最终 Git 状态和提交摘要，再推送到当前远端分支。
