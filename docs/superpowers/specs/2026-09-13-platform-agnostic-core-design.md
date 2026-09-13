# Platform-Agnostic Game Core Design

**日期：** 2026-09-13  
**状态：** 待用户确认  
**目标平台：** 现有 Web + 后续微信小程序

## 目标

在不改变现有扫雷、数独、连连看、2048 和战术扫雷规则的前提下，把项目拆成平台无关的游戏核心、应用编排、平台能力和 Web 适配层，为后续微信小程序 UI 迁移降低成本。

## 现状与约束

- 当前页面必须继续支持浏览器运行，以及项目已有的本地文件入口。
- 现有自动化测试是行为基线，重构后必须保持通过。
- 算法和规则优先复用，不在本阶段调整玩法数值、棋盘规则和存档格式。
- 不在本阶段选择或引入 Taro、uni-app、React 等 UI 框架。
- 不让 `document`、`window`、`localStorage`、浏览器 Canvas 和浏览器计时器进入 `core/`。
- 不要求一次性拆完所有大型 UI 文件；每次迁移都要有兼容入口和独立测试。

## 方案

采用“核心逻辑 + 应用层 + 平台适配 + UI 适配”的分层结构：

```text
core  ->  application  ->  adapters/web
  \            \------->  adapters/miniprogram（后续）
   \->  platform contracts
```

### 1. `core/`

只包含可序列化状态、规则、随机数输入和动作结果。核心函数不读取或写入浏览器/小程序环境，也不创建 DOM 节点。

游戏按领域拆分：

- `minesweeper`：经典、偏移、Hex、环形及生成器/求解器共享的扫雷规则。
- `sudoku`：数独题目生成、候选数、提示和数独扫雷规则。
- `lianliankan`：2D 路径、关卡、挑战流程；3D 几何规则与渲染分开。
- `2048`：棋盘移动、合并、得分、胜负判断。
- `rogue`：战术扫雷的楼层、契约、道具和奖励。
- `shared`：随机数、时间抽象、不可变拷贝等跨游戏工具。

核心动作的目标接口为：

```js
const result = engine.dispatch(action);
// result.state: 下一份可序列化状态
// result.effects: 需要平台或 UI 执行的副作用描述
```

第一阶段允许保留现有闭包式 engine，但必须让平台依赖通过参数注入；后续再按游戏逐步改成 `dispatch` 风格，不进行大爆炸式重写。

### 2. `application/`

负责当前游戏会话、游戏注册、动作分发、暂停/恢复和进度服务。它不渲染 DOM，也不直接调用 `wx`。

应用层只向 UI 暴露：

- 当前游戏状态；
- 可执行动作；
- 可渲染的状态变更通知；
- 存档和排行榜所需的领域数据。

### 3. `platform/`

定义并实现平台能力：

- `storage`：键值存储；Web 使用 `localStorage`，小程序使用 `wx.getStorageSync` / `wx.setStorageSync`。
- `clock`：当前时间、延时和可取消计时；核心状态中不保存 `timerId`。
- `random`：默认随机数和测试用确定性随机数。
- `media`：背景图选择、压缩和上传；核心逻辑不处理 `FileReader` 或 Canvas。

Web 实现先落在 `platform/web/`；小程序实现后续落在 `platform/wechat/`。所有调用方通过接口依赖注入，避免在业务文件中散落平台判断。

### 4. `adapters/`

适配具体 UI：

- `adapters/web/` 保留现有 HTML/CSS，逐步把 DOM 查询和事件绑定从游戏逻辑中移出。
- `adapters/miniprogram/` 后续对应 WXML/WXSS/小程序 Page 和 Component。
- 四种常规游戏共享棋盘展示组件；战术扫雷使用独立 HUD/工具/契约视图。

## 状态边界

可持久化状态必须只包含规则和进度数据，例如棋盘、难度、分数、关卡和用户输入。以下数据归入运行时控制器，不进入核心状态或存档：

- DOM 节点和事件监听器；
- `timerId`、`setInterval` 返回值；
- `startAt` 等平台时间句柄；
- requestAnimationFrame/动画 token；
- 临时焦点、弹窗节点和 CSS 状态。

提示文本和 aria 文案由适配层根据状态生成；领域状态只保留稳定枚举和数值。

## 模块与兼容策略

- 新增和迁移的源码统一采用 ES Module。
- 现有 `src/*.js` 入口在迁移期间保留为薄兼容层，避免一次性修改全部测试和页面入口。
- 移除 `window.__SUDOKU__`、`window.__LLK__`、`window.__LLK_LEVELS__`、`window.__GAME_TABS__` 之前，先将测试和 Web 适配器改为显式 import。
- 页面最终只保留一个正式构建入口；文件协议兼容 bundle 仍可作为构建产物，不再作为业务模块来源。

## 第一阶段交付范围

1. 建立 `core/`、`application/`、`platform/web/`、`adapters/web/` 目录和模块约定。
2. 先迁移已最容易复用的 2048 核心，保留旧 import 兼容层。
3. 抽出统一的 Web storage、clock 和 random 能力，并让 2048、扫雷主应用优先使用注入能力。
4. 将连连看纯规则和关卡数据与 DOM/Canvas 控制器分离，至少完成显式模块入口。
5. 为新边界补充测试，继续运行现有全量测试。
6. 输出后续数独、战术扫雷和小程序页面迁移的明确接缝，但不在第一阶段重写所有 UI。

## 非目标

- 本阶段不发布微信小程序。
- 本阶段不改变视觉设计和用户操作规则。
- 本阶段不把现有页面包进 WebView 作为最终小程序方案。
- 本阶段不引入后端账号、云存档或排行榜服务。

## 验收标准

- 现有 `npm test` 全部通过。
- 核心模块可在 Node 环境中独立 import，不依赖 `window` 或 `document`。
- Web 入口行为与重构前一致。
- 存储、计时、随机数和媒体能力均可通过替换适配器测试。
- 后续小程序页面只需实现 UI/平台适配，不需要复制游戏规则。
