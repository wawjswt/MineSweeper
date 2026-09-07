# Task 1：关卡数据与纯逻辑报告

## 改动

- 新增 `src/lianliankan-levels.js`：普通脚本暴露 `window.__LLK_LEVELS__`，提供 5 个固定关卡、布局复制、可注入查找函数的洗牌、按障碍分段的列下落，以及关卡纯逻辑路径/配对/剩余计数。
- 修改 `src/lianliankan-game.js`：共享 2D 纯逻辑把 `-1` 视为障碍；障碍不是端点、不参与路径、不计入剩余数，也不会进入普通洗牌；普通点击逻辑忽略障碍。
- 新增 `tests/lianliankan-levels.test.js`：覆盖关卡配置、固定布局复制、障碍数量、分段下落、障碍不移动、图案多重集合、障碍阻挡路径、洗牌有解和障碍端点拒绝。

## TDD RED/GREEN 证据

RED：先创建测试并运行：

```text
node tests\\lianliankan-levels.test.js
Error: ENOENT: no such file or directory, open '...\\src\\lianliankan-levels.js'
exit=1
```

GREEN：实现后运行：

```text
node tests\\lianliankan-levels.test.js
ALL LIANLIANKAN LEVEL LOGIC CHECKS PASSED
exit=0
```

## 测试输出

```text
node tests\\lianliankan-levels.test.js
ALL LIANLIANKAN LEVEL LOGIC CHECKS PASSED

node tests\\lianliankan.test.js
ALL LIANLIANKAN CHECKS PASSED

node tests\\lianliankan3d.test.js
ALL LLK3D LOGIC CHECKS PASSED

git diff --check
无输出（通过）
```

## 自审

- 仅修改关卡纯逻辑、共享 2D 障碍语义和对应测试；未修改 UI、关卡选择、Combo、评分、localStorage 或 3D 玩法。
- 固定布局的障碍数量分别为 4、4、8、8、10；正数图案均为正偶数计数，且每关初始存在可连接配对。
- 下落只在同一列的非障碍区段内压实，障碍和值保持原位，并返回 `moves`/`dropMoves`。
- 洗牌复制输入，不移动障碍，保留正数图案多重集合；随机尝试失败时使用确定性配对兜底，并接受调用方注入的配对查找函数。
- 既有 2D 与 3D 测试均通过；未发现 diff 格式问题。

## 担忧 / 遗留问题

- 关卡名称和 `kinds` 未在简报中指定具体文本/数值；本实现选择了固定、可复现且满足偶数配对约束的值。
- 报告生成前工作树中已有未跟踪的 `docs/superpowers/plans/2026-09-07-lianliankan-level-mode.md`，未读取、未修改、未纳入本次提交。
