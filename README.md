# 扫雷 · Puzzle Arcade

[中文](README.md) | [English](README.en.md)

一个以扫雷为核心、同时集合数独、连连看和 2048 的原生 Web 解谜游戏项目。

项目当前可以直接在浏览器中运行，也支持通过 HTTP 加载 ES Module，或通过文件协议加载自包含 bundle。游戏规则正在逐步拆分为平台无关的核心模块，为后续迁移到微信小程序做准备。

## 玩法

- **扫雷**：支持简单、普通、困难、极致和自定义棋盘；包含经典、偏移、数独扫雷、Hex、环形棋盘和战术扫雷等玩法。
- **可推理生成**：在支持的模式下，可以选择标准随机生成或尽量保证可通过逻辑推理完成的棋盘。
- **数独**：实时生成具有唯一解的题目，支持候选数、提示、历史操作、数字统计和本地存档。
- **连连看**：支持经典 2D、固定关卡、限时挑战和 3D 立体棋盘；包含路径判定、洗牌和下落流程。
- **2048**：支持键盘方向键、触控按钮、得分记录、最高分和胜利后继续游戏。
- **主题与背景**：提供深色、浅色、粉色和天蓝色主题，可上传背景图片并调节透明度。
- **键盘与辅助功能**：游戏页面包含键盘操作、焦点管理和棋盘辅助标签。

## 快速开始

### 直接打开

无需安装依赖，直接用浏览器打开项目根目录下的 [`index.html`](index.html) 即可开始游戏。

### 使用本地 HTTP 服务

HTTP 模式会使用 `src/app.js` ES Module 入口，更接近线上部署环境：

```bash
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

### 构建文件协议 bundle

如果需要重新生成可通过 `file:` 直接加载的 bundle：

```bash
npm run build:file
```

生成文件为 `dist/file-bundle.js`。

### 微信小程序开发构建

项目已经提供原生小程序开发壳，入口目录为 [`miniprogram/`](miniprogram/)。当前运行时已接入 2048、经典扫雷、标准数独、2D 连连看和 Rogue；它们通过 `src/application/` 会话复用 `src/core/` 规则，不在 WXML 中复制规则。

在微信开发者工具中导入项目根目录下的 `miniprogram/`，开发阶段可直接使用无 AppID 配置。修改共享源码后执行：

```bash
npm run build:miniprogram
```

该命令会生成并更新 `miniprogram/generated/runtime.js`。提交源码时请同时提交生成文件。发布前建议执行：

```bash
npm run check:miniprogram
```

质量命令会构建小程序运行包、检查平台边界和 bundle，再运行完整 `npm test`。真实 AppID、微信审核配置、真机性能和最终发布包仍需在微信开发者工具中完成。

## 开发与测试

项目使用原生 JavaScript、HTML 和 CSS，不依赖 React、Vue、Taro 或 uni-app。需要安装 Node.js 后执行：

```bash
npm test
```

测试命令会先生成文件协议 bundle，然后运行核心规则、平台边界、Web 适配器、游戏流程和兼容入口测试。

## 项目结构

```text
.
├── index.html                 # Web 页面入口
├── src/
│   ├── app.js                 # Web composition root
│   ├── application/           # 游戏注册与动作分发
│   ├── core/                  # 不依赖浏览器环境的游戏核心
│   │   ├── games/2048/
│   │   ├── games/lianliankan/
│   │   ├── games/minesweeper/
│   │   ├── games/rogue/
│   │   └── games/sudoku/
│   ├── platform/web/          # Web 存储、计时等平台能力
│   ├── platform/wechat/       # 微信 storage、clock、random、media 端口
│   ├── adapters/web/          # Web 适配说明与边界
│   └── adapters/miniprogram/  # 小程序 runtime 与 WXML view model
├── miniprogram/               # 原生微信小程序页面和组件
├── assets/                    # Rogue 指南插图等资源
├── tests/                     # Node 核心测试与兼容流程测试
├── tools/                     # 构建工具
└── dist/file-bundle.js        # 文件协议兼容 bundle
```

核心逻辑只处理可序列化状态、规则和动作结果，不直接访问 `window`、`document`、`localStorage` 或小程序 API。平台能力和 UI 通过适配层接入，旧的 `src/*.js` 路径在迁移期间保留为兼容入口。

## 当前进度

- [x] Web 多游戏页面与统一入口
- [x] 扫雷、2048、数独、连连看和 Rogue 核心模块拆分
- [x] 应用层游戏注册与动作分发边界
- [x] 文件协议 bundle 构建与测试
- [x] 微信小程序平台适配层、运行包和五个游戏会话
- [x] WXML/WXSS 页面与组件迁移的开发切片
- [ ] 小程序真机和性能验证

当前小程序交付仍是开发阶段切片：3D 连连看、背景图片媒体接入、账号/云开发/排行榜/支付、正式 AppID 和发布配置暂未纳入。缺少微信开发者工具时，自动化 Node 检查无法替代页面冒烟和真机触摸验收。

后续小程序工作会新增微信平台能力和 WXML/WXSS 适配器，复用 `src/core/` 与 `src/application/`，不会在页面中复制游戏规则。

## 贡献约定

提交新的游戏规则或核心逻辑时，请保持 `src/core/` 与浏览器环境无关，并为新边界补充测试。涉及 Web DOM、Canvas、浏览器存储或计时器的代码，应放在 Web 适配层或平台层。
