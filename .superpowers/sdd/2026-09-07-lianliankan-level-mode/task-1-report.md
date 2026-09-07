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

## 第 1 轮审查修复

### 根因与改动

- 共享 `src/lianliankan-game.js` 的确定性兜底循环原先枚举 `first/second`，但总是把配对放到槽位开头；现在实际写入 `slots[first]` 和 `slots[second]`，再填充其余图案。
- `src/lianliankan-levels.js` 删除了 `isEmpty`、`segmentClear`、`findPath`、`findAnyPair` 这套平行路径算法；关卡洗牌现在要求调用方注入 `findPair`，测试与调用均使用共享 `LLK.findAnyPair`。
- 新增的回归覆盖直接加载共享 `lianliankan-game.js`，验证障碍棋盘上的确定性兜底，而不是只验证关卡脚本洗牌。

### 修复 TDD 证据

先补测试后运行：

```text
node tests\\lianliankan-levels.test.js
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
false !== true
    at ...\\tests\\lianliankan-levels.test.js:159:8
exit=1
```

该失败前的固定夹具断言已通过：固定随机阶段无可连配对、只放在 `slots[0]/slots[1]` 无可连配对，而后续槽位存在可连配对；因此失败定位为共享兜底未使用枚举槽位，而不是随机源或夹具失效。

修复后聚焦测试：

```text
node tests\\lianliankan-levels.test.js
ALL LIANLIANKAN LEVEL LOGIC CHECKS PASSED
exit=0
```

回归测试：

```text
node tests\\lianliankan.test.js
ALL LIANLIANKAN CHECKS PASSED

node tests\\lianliankan3d.test.js
ALL LLK3D LOGIC CHECKS PASSED

git diff --check
无输出（通过）
```

### 第 1 轮修复自审与担忧

- 新测试固定注入 `Math.random = () => 0`，覆盖随机阶段必然失败、首槽位失败、后续槽位成功，并断言共享 `reshuffle` 最终成功且障碍集合不变。
- 新测试断言关卡脚本不再暴露 `findPath`/`findAnyPair`，并将关卡初始有解、障碍阻挡和洗牌有解判断统一交给共享 `LLK.findAnyPair`/`findPath`。
- 2D、3D 和关卡聚焦测试均通过；未修改 UI、关卡选择、Combo、评分、localStorage 或 3D 玩法。
- 工作树仍保留既有未跟踪的 `docs/superpowers/plans/2026-09-07-lianliankan-level-mode.md`，未读取、未修改、未纳入本次提交。
