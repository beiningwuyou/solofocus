---
id: 9e4c7b13-5f28-4a06-b2d9-3c81f6e04a72
kind: document
status: active
tags:
  - system/design
created: 2026-08-06
updated: 2026-08-06
summary: PGT 个人工作台的完整设计规范，AI 可读，token 部分与 harness/tokens.json 同源。
---

# PGT Workbench — Design System

> **单一事实源**：token 数值以 `harness/tokens.json` 为准。本文档的 token 表由其同步而来。
> **开始设计前必读**：`harness/context.md`（受众/场景/调性）+ `harness/antipatterns.md`（真实踩过的坑）。
> **完成后必须执行**：`pnpm design:lint`

视觉基准见 `baselines/v1/`。

---

## 1. Visual Theme & Atmosphere

**一件安静的专业工具。它不表达自己，它让内容表达。**

单人自用、长时间沉浸操作的目标管理工作台。设计上的所有取舍都服务于一个判断：
**优化"第一千次使用"，不是"第一次使用"。**

核心视觉特征：

- **克制** — 无渐变、无玻璃拟态、无发光、无装饰插画
- **真白** — 背景 `#ffffff`，不用灰白打底
- **边框优先** — 用 1px 边框建立层次，阴影仅留给真正的浮层
- **高密度** — 正文 14px，小于常规 Web，服务信息密度
- **语义色稀缺** — 强色只作小面积标识，绝不作大面积背景

参照系是 Linear、Notion 的克制侧。**不是**任何带紫蓝渐变与光晕的 AI 产品审美。

### The AI Slop Test

差异化不在视觉炫技，而在**信息密度与克制度的平衡**——高密度但不拥挤，安静但不寡淡。
这恰恰是 AI 默认审美最不擅长的方向。

---

## 2. Color Palette & Roles

所有色值定义于 `harness/tokens.json`，通过 `pnpm tokens` 生成 CSS 变量。

### 品牌色

| 角色 | CSS 变量 | Light | Dark | 用途 |
|------|---------|-------|------|------|
| 品牌锚点 | `--navy` | `#112c54` | `#93b4f5` | 侧栏选中态、主按钮 |
| 加深态 | `--navy-strong` | `#092650` | `#b8cff8` | navy 的 hover/active |

### 语义色

| 角色 | CSS 变量 | Light | Dark | 用途 |
|------|---------|-------|------|------|
| 信息 | `--blue` | `#2563eb` | `#60a5fa` | 链接、进行中、焦点环 |
| 成功 | `--green` | `#16a34a` | `#16a34a` | 已完成、正向指标 |
| 警告 | `--orange` | `#f97316` | `#f97316` | 临近截止、需关注 |
| AI | `--violet` | `#7c3aed` | `#a78bfa` | AI 功能专属标识 |
| 错误 | `--red` | `#ef4444` | `#ef4444` | 逾期、破坏性操作 |

**纪律**：语义色只用于文字、图标、小圆点、进度条、1px 边框。
**绝不作为面板或区块背景。**

### 文本层级

| CSS 变量 | Light | Dark | 用途 |
|---------|-------|------|------|
| `--text` | `#13213a` | `#e2e8f0` | 正文。刻意非纯黑 |
| `--text-secondary` | `#475569` | `#94a3b8` | 次级信息 |
| `--muted` | `#718096` | `#64748b` | 表头、时间戳 |
| `--muted-light` | `#94a3b8` | `#475569` | 占位符、禁用态 |

### 表面与边框

| CSS 变量 | Light | Dark | 用途 |
|---------|-------|------|------|
| `--app-bg` | `#ffffff` | `#0f172a` | 页面底色 |
| `--soft` | `#f7f9fc` | `#1e293b` | 面板/侧栏/表头 |
| `--soft-hover` | `#f0f3f8` | `#25344a` | 行 hover |
| `--border` | `#e3e8f0` | `#334155` | 主分隔线 |
| `--border-light` | `#edf0f4` | `#2d3a4d` | 弱分隔线 |

### AI 区块专属

`--violet-soft` / `--violet-border` / `--violet-deep` —— 仅用于 AI 相关模块，
让智能功能有一致的视觉身份，同时不侵占主界面的中性基调。

---

## 3. Typography Rules

**字体栈**：`Inter, "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif`（`--font-sans`）

> ⚠️ Inter 当前**未本地加载**，实际渲染回落到 PingFang SC。
> 这直接导致非标准字重无效——详见 antipatterns A4。

### 字号阶梯

| CSS 变量 | 值 | 用途 |
|---------|----|----|
| `--text-xs` | 11px | 元信息、时间戳、表头 |
| `--text-sm` | 13px | 次级文字、表格内容 |
| `--text-base` | 14px | **正文基准** |
| `--text-lg` | 16px | 小标题 |
| `--text-xl` | 20px | 区块标题 |
| `--text-2xl` | 26px | 页面标题 |
| `--text-3xl` | 32px | 关键数值展示 |

**同一屏内避免超过 3 级字号层次。**

### 字重

**只允许四档**：`--weight-regular` 400 / `--weight-medium` 500 / `--weight-semibold` 600 / `--weight-bold` 700

其他值在当前字体栈下会被舍入，是纯粹的无效复杂度。lint 会拦截。

### 行高

`--leading-heading` 1.2 · `--leading-tight` 1.3 · `--leading` 1.5

---

## 4. Component Stylings

完整可抄的实现见 `harness/exemplars/`。以下为关键参数。

### Buttons

| 变体 | 背景 | 文字 | 边框 | 使用场景 |
|------|------|------|------|---------|
| primary | `--navy` | `#ffffff` | 无 | **一屏最多一个** |
| secondary | `--app-bg` | `--text` | `--border` | 默认选择 |
| ghost | 透明 | `--text-secondary` | 无 | 工具栏、行内 |
| danger | 透明 | `--red` | `--border` | 仅不可逆操作 |

高度 40px（紧凑 30px）· 圆角 `--radius` · 字重 500 · 内边距 `0 16px`

**hover 只改颜色，不做位移或缩放。** 长时间使用中，鼠标划过导致的抖动是持续的干扰。

### Data Table

核心信息呈现方式。行高 54px、表头 39px、圆角 `--radius-lg`、
边框 `--border`、行分隔 `--border-light`、hover `--soft-hover`。
详见 `exemplars/data-table.css`。

**数据密集场景一律用表格，不用卡片墙。**

### Status Chip

圆角 999px、内边距 `4px 10px`、边框 `--border`、底色 `--app-bg`。
语义只改文字色，配 6px `currentColor` 圆点。详见 `exemplars/status-chip.css`。

### Inputs

高度 38–40px · 圆角 `--radius` · 边框 `--border` ·
focus 由全局 `:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px }` 统一处理。

### Panels

边框 `--border` + 圆角 `--radius-lg` + 背景 `--app-bg`。
**阴影仅用于浮层**（modal / dropdown），常驻面板靠边框建立层次。

---

## 5. Layout Principles

### 间距系统

| CSS 变量 | 值 | 用途 |
|---------|----|----|
| `--gap-xs` | 6px | 图标与文字 |
| `--gap` | 10px | **默认间距** |
| `--gap-md` | 16px | 组件间距 |
| `--gap-lg` | 22px | 区块间距 |
| `--gap-xl` | 28px | 大区块分隔 |

> `--gap` 曾因自引用 bug 失效，导致 20 处布局间距塌陷为 0。2026-08-06 已修复。

### 框架尺寸

`--sidebar-width` 230px · `--topbar-height` 78px · `--content-px` 24px · `--content-py` 22px

### 结构原则

- 开放列表和表格优先于卡片
- 目标页用表格 + 展开详情，**不改成卡片墙**
- 避免卡片套卡片的嵌套容器
- 不使用"大图标 + 圆角容器"的英雄指标模板

---

## 6. Depth & Elevation

### 阴影系统

| CSS 变量 | Light | Dark | 用途 |
|---------|-------|------|------|
| `--shadow-xs` | `0 1px 3px rgba(17,44,84,.04)` | `0 1px 3px rgba(0,0,0,.2)` | 极轻微抬升 |
| `--shadow` | `0 4px 16px rgba(17,44,84,.05)` | `0 4px 16px rgba(0,0,0,.25)` | 面板 |
| `--shadow-md` | `0 8px 28px rgba(17,44,84,.08)` | `0 8px 28px rgba(0,0,0,.35)` | 浮层 |

亮色阴影带品牌色偏向（navy 的 rgba），不用中性灰。

### 圆角

`--radius-sm` 6px（标签）· `--radius` 9px（控件）· `--radius-lg` 11px（面板）· `--radius-xl` 14px（浮层）

### 层次策略

**边框 > 阴影。** 常驻界面全部用 1px 边框分层，阴影是稀缺资源，
只给真正浮在内容之上的元素。这是"安静"感的主要来源。

**禁止** `backdrop-filter` 毛玻璃与任何发光效果。

---

## 7. Do's and Don'ts

### Do

1. 所有色值、间距、圆角、字号、动效时长走 `var(--*)`
2. 用边框建立层次，把阴影留给浮层
3. 语义色只作小面积标识
4. 新组件同时验证亮色与暗色
5. 数据密集场景用表格
6. hover 只改颜色
7. 新增 token 改 `tokens.json` 后运行 `pnpm tokens`
8. 完成后跑 `pnpm design:lint`

### Don't

1. ✗ 渐变（任何形式）
2. ✗ 毛玻璃 `backdrop-filter`、发光 `box-shadow`
3. ✗ 强色作大面积背景
4. ✗ 非 400/500/600/700 的字重
5. ✗ 在 `styles.css` 里定义 token
6. ✗ 手改 `tokens.generated.css`
7. ✗ 会改变布局的 hover（`transform: scale/translate`）
8. ✗ 装饰性动效、循环动画、回弹缓动
9. ✗ 万物皆卡片、卡片套卡片
10. ✗ 面向新手的引导设计（单人自用工具不需要）

---

## 8. Responsive Behavior

### 断点

| 名称 | 值 | 行为 |
|------|----|----|
| mobile | 520px | 网格降为单列，进一步压缩间距 |
| tablet | 800px | **固定侧栏隐藏，改用底部五项导航** |

### 折叠策略

- 表格窄屏隐藏次要列（时间、元信息），**绝不隐藏核心操作**
- 指标条 4 列 → 2 列
- 内容区内边距 24px → 12px

### 触摸目标

移动端可点击元素最小 44×44px。表格行 54px 已满足。

### 动效降级

已实现 `@media (prefers-reduced-motion: reduce)`，新增动效必须纳入该分支。

---

## 9. Agent Prompt Guide

### 快速参考

```
项目    PGT 个人工作台 · 单人自用 · 长时间沉浸操作
调性    极简克制 · 安静的专业工具
禁令    渐变 / 毛玻璃 / 发光 / 强色大面积背景 / 装饰动效
基调    真白 #ffffff + 海军蓝 #112c54 + 1px 边框分层
正文    14px / 字重仅 400·500·600·700
必读    harness/context.md · harness/antipatterns.md
必跑    pnpm design:lint
```

### 组件生成 Prompt 示例

**新建数据表格页**
> 参照 `harness/exemplars/data-table.css` 实现项目列表页。全部使用 token，
> 行高 54px，hover 仅改 `--soft-hover`。窄屏隐藏时间列但保留操作。同步验证暗色。

**新增状态标签**
> 参照 `harness/exemplars/status-chip.css`。语义色只改文字色 + `currentColor` 圆点，
> 底色保持 `--app-bg`。不要用填充色块。

**新建面板区块**
> 边框 `--border` + 圆角 `--radius-lg` + 背景 `--app-bg`，不加阴影。
> 标题 `--text-lg` 字重 600，内边距 `--content-py var(--content-px)`。

**添加交互反馈**
> 只用 `transition: background var(--transition-fast)`。
> 不要 transform、不要回弹缓动、不要超过 0.28s。

**改造现有组件**
> 先读 `antipatterns.md`。现有代码有历史债务（硬编码色值、非标准字重、hover 位移），
> 不要照抄。以 `exemplars/` 为准。改完跑 `pnpm design:lint` 确认未新增违规。

### 迭代建议

1. 拿不准某个值用哪个 token → 查 `tokens.json` 的 `usage` 字段
2. 需要新色值 → 先确认现有语义色能否复用，不能才加 token
3. 想加视觉亮点 → 先问是否违反"安静"原则；本项目的亮点在密度与克制，不在装饰
4. 生成后自检：全部走 token 了吗？暗色对吗？hover 有位移吗？
5. 有渐变冲动时 → 用 `--soft` 平色替代
6. 觉得界面太素 → 那可能就对了。参照 `baselines/v1/` 确认
7. 不确定该用表格还是卡片 → 用表格
8. 新组件写完 → 考虑是否值得提炼进 `exemplars/`
9. 发现规范说不清的地方 → 更新本文档或 `antipatterns.md`，别绕过
10. `pnpm design:lint` 报错 → 修代码，不要改基线。基线只在债务**降低**后更新
