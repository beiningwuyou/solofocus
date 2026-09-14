---
id: 7c1e5a09-4d62-4b83-91f7-2a8b6e3d0c45
kind: document
status: active
tags:
  - system/design
  - system/harness
created: 2026-08-06
updated: 2026-08-06
summary: PGT 工作台设计反例库——真实踩过的坑，比正向规范更有约束力。
---

# Antipatterns — 反例库

> 约束"不要做什么"比引导"要做什么"对 AI 更有效。
> 本文件记录的都是**本项目真实发生过的问题**，不是通用建议。
> 发现新的不合规模式时立即追加。**反例库比正例库增长快是健康信号。**

---

## 一、已发生的真实事故

### A1 · 变量自引用导致 20 处间距塌陷（2026-08-06 修复）

```css
/* ✗ 事故代码 */
--gap: var(--gap);
```

**后果**：按 CSS 规范，自引用的自定义属性是 *invalid at computed-value time*，
`gap: var(--gap)` 会 fallback 到 initial 值 `normal`（grid/flex 中等于 **0**）。

`.metric-strip`、`.table-head`、`.page-header`、`.database-toolbar`、`.review-stats` 等
**20 处布局的间距实际渲染为 0**，而代码看起来完全正常。

**连锁反应**：基准间距变量不可用 → 只能写死数字 → 这是 1732 处硬编码 px 的直接技术诱因。
**不是纪律问题，是工具坏了。**

**现已防御**：`design-lint` 检测所有自引用；`tokens-build` 在生成时抛错。

---

### A2 · 规范与代码 4 天就漂移（2026-08-06 修复）

`DESIGN-SPEC.md`（08-02 写）与 `styles.css`（08-05）的实际不一致：

| 项 | 文档写的 | 代码实际 |
|----|---------|---------|
| 控件圆角 | 8px | 9px |
| text-secondary | `#718096` | `#475569`（`#718096` 实为 `--muted`）|

**根因**：文档和代码是**两份手写副本**，必然分叉。
**现已防御**：`tokens.json` 成为唯一真源，CSS 由脚本生成，漂移在物理上不可能。

---

### A3 · 调性主张漂移：12 处渐变 + 15 处毛玻璃

项目明确主张"极简克制、禁止渐变和玻璃拟态"，但代码里已经积累：

```css
/* ✗ styles.css:412 —— 教科书级的泛 AI 审美 */
.floating-ai-trigger {
  background: linear-gradient(135deg, #5b8cff, #7c3aed);
  box-shadow: 0 12px 30px rgba(35, 76, 167, .35);
}
```

蓝紫渐变 + 大范围彩色投影，正是 impeccable 点名的 "AI 配色"典型。

**其余渐变位置**：`.vision-card-summary`、`.empty-state-art`、`.automation-card-icon`、
`.entity-field-grid .field > span::before`、`.home-agents-banner`

**教训**：美学主张不写进机器可校验的规则里，就会被慢慢侵蚀。
**现已防御**：lint 统计渐变/毛玻璃数量，只许降不许升。

---

### A4 · 字重失控：76 处非标准值

代码中出现过 **16 种字重**：400/500/**520/560/570/580/590**/600/**620/650/660/680**/700/**720/760**/800

更关键的是：**Inter 字体根本没有被加载**——
`styles.css` 无 `@font-face`，`index.html` 无 Google Fonts 引用。
`font-family: Inter, "PingFang SC", ...` 实际回落到 **PingFang SC**（非可变字体）。

**后果**：`font-weight: 650` 与 `620`、`680` 在渲染上**几乎没有区别**，
全部被舍入到最近的可用字重。这是**纯粹的无效复杂度**——
增加了维护负担，视觉上什么都没得到。

**规则**：只允许 `400 / 500 / 600 / 700` 四档。

---

## 二、生成 UI 时的禁止清单

### B1 · 视觉禁令（违反项目调性）

```css
/* ✗ 禁止 */
background: linear-gradient(...);      /* 任何渐变 */
backdrop-filter: blur(...);            /* 毛玻璃 */
box-shadow: 0 0 20px rgba(59,130,246,.5);  /* 发光 */
```

```css
/* ✓ 正确：用边框建立层次，阴影仅用于真正的浮层 */
border: 1px solid var(--border);
box-shadow: var(--shadow-md);  /* 仅 modal / dropdown */
```

### B2 · 强色不得作为大面积背景

```css
/* ✗ 长时间使用会造成视觉疲劳 */
.panel { background: var(--blue); }

/* ✓ 强色只用于小面积语义标识 */
.status-dot { background: var(--blue); width: 6px; height: 6px; }
.badge { color: var(--blue); background: var(--soft); }
```

### B3 · 不要新建 token 定义

```css
/* ✗ 在 styles.css 里定义变量 */
:root { --my-new-color: #abc123; }
```

**正确做法**：编辑 `assets/design/harness/tokens.json` → 运行 `node scripts/tokens-build.mjs`。
lint 会拦截散落的 token 定义。

### B4 · 不要手改生成物

`src/client/tokens.generated.css` 顶部标注 DO NOT EDIT。
手改会在下次生成时丢失，且 `tokens-build --check` 会报错。

### B5 · 装饰性动效

```css
/* ✗ 一天出现 50 次就是骚扰 */
animation: bounce 1s infinite;
transition: transform .4s cubic-bezier(.68,-.55,.27,1.55);  /* 回弹缓动 */

/* ✓ 只为状态变化服务 */
transition: background var(--transition-fast);
```

`pulseGlow` 仅限启动屏，**不得扩散到常驻界面**。

### B6 · 万物皆卡片

数据密集场景下，**表格永远比卡片墙高效**。
本项目用户熟悉全部信息结构，不需要卡片提供的"视觉分组辅助"。

```
✗ 目标列表 → Bento 卡片阵列
✓ 目标列表 → 表格 + 展开详情
```

### B7 · 面向新手的设计

单人自用工具，**不需要**：新手引导、教学型空状态、功能发现性设计、过度的防御性确认。
空状态只说"这里还没有数据"，不解释概念。

### B8 · 会改变布局的 hover

```css
/* ✗ 长时间使用中，鼠标划过导致的位移非常烦人 */
.card:hover { transform: scale(1.02); }

/* ✓ 只改变颜色 */
.card:hover { background: var(--soft-hover); }
```

---

## 三、暗色模式专项

暗色是一等公民，不是附属。常见错误：

```css
/* ✗ 硬编码暗色值——现有代码里大量存在，属于存量债务 */
.dark .panel { background: #1e293b; border-color: #334155; }

/* ✓ 用 token，亮暗自动适配 */
.panel { background: var(--soft); border-color: var(--border); }
```

`#1e293b` 就是 `--soft` 的暗色值，`#334155` 就是 `--border` 的暗色值。
**写死等于放弃了主题切换能力。**

新组件必须同时验证亮/暗两套，不允许"暗色能看就行"。

---

## 四、存量债务基线（2026-08-06）

| 项 | 数量 | 处理策略 |
|----|------|---------|
| CSS 硬编码色值 | 675 | 增量偿还，遇到即改 |
| CSS 硬编码 px | 1732 | 同上。`--gap` 修复后新代码应显著减少 |
| 渐变 | 12 | 计划清零 |
| 毛玻璃 | 15 | 计划清零 |
| 非标准字重 | 76 | 收敛到 400/500/600/700 |
| tsx 内联 style | 23 | 迁移到 CSS 类 |
| tsx 硬编码色值 | 13 | 同上 |

**绝不一次性重构。** 一次性改动 675 处色值必然引发大面积视觉回归，
且无法逐一验证。lint 只卡增量，存量随功能迭代自然消化。
