# 主题机制设计文档（Theme Mechanism）

本文回答三件事：**主题变量怎么定义**、**设计文件与主题层怎么对应**、**换主题时的具体接入点在哪**。
配套文件：`CONTRACT.md`（语义变量契约 + 品牌映射表）、`themes/*.json`（覆盖集）、`variants/*.css`（L2 变体）。

---

## 0. 一句话机制

> **主题 = 一组契约 CSS 变量的覆盖值。** 组件永远只引用契约变量（`--navy` / `--font-display` / `--radius` …），
> 从不写死任何品牌色值。换主题 = 改 `<html data-theme="…">` 这一个属性，组件与布局零改动。

---

## 1. 主题变量怎么定义

### 1.1 唯一事实源是 `harness/tokens.json`
所有 CSS 变量（含默认值）的权威定义都在 `assets/design/harness/tokens.json`。
它声明变量名（`cssVar` 字段）、默认值、`usage`。构建脚本把它编译成 `src/client/tokens.generated.css`，
挂到 `:root`（亮色）与 `.dark`（暗色 diff）上——这就是 **默认主题（PGT 基线）**。

### 1.2 主题覆盖集是增量 JSON
每个品牌主题是一个 `themes/<brand>.json` 覆盖集，只写**相对默认主题的增量**：

```json
{
  "$meta": { "name": "Apple", "basedOn": "pgt-default",
             "note": "Action Blue + SF Pro，圆角 11/18，parchment 浅底" },
  "overrides": {
    "--navy":   { "light": "#0066cc", "dark": "#2997ff" },   // 双值 token：{light, dark}
    "--font-display": "SF Pro Display, …",                     // 单值 token：字符串
    "--radius": "11px"
  }
}
```

- **双值 token**（颜色 / 阴影）：用 `{ "light": …, "dark": … }`，分别覆盖亮/暗两套值。
- **单值 token**（圆角 / 间距 / 字族 / 字号…）：直接用字符串，亮暗同值。
- 没写的变量**继承默认主题**——所以 JSON 很薄，换肤只表达差异。

### 1.3 契约变量名（组件只引用这些）
完整清单见 `CONTRACT.md §2`。核心几组：

| 组 | 变量 |
|----|------|
| 颜色 | `--navy` `--navy-strong` `--blue` `--green` `--orange` `--red` `--violet*` `--text*` `--app-bg` `--soft*` `--border*` |
| 字族 ★ | `--font-sans` `--font-display` `--font-body` `--font-mono` |
| 圆角 | `--radius-sm` `--radius` `--radius-lg` `--radius-xl` `--radius-pill` `--radius-full` |
| 单值（继承默认） | `--gap*` `--shadow*` `--text-*` `--weight-*` `--leading*` `--transition-*` `--content-*` `--sidebar-width` `--topbar-height` |

> ★ 字族四档是为主题保真度新增的，**默认值安全**（默认 = sans），不破坏旧代码。

### 1.4 构建产物（自动生成，禁止手改）
`pnpm tokens:all` 跑 `scripts/tokens-build.mjs --all`，输出两个文件：

1. `src/client/themes.generated.css` —— 每个主题一段作用域：
   ```css
   [data-theme="apple"]      { --navy: #0066cc; --font-display: …; … }
   [data-theme="apple"].dark { --navy: #2997ff; … }   /* 仅暗色 diff */
   ```
2. `src/client/themes.generated.ts` —— 主题清单，供 UI 直接消费：
   ```ts
   export type ThemeId = "pgt-default" | "apple" | "claude" | "dell-1996" | "elevenlabs" | "hp";
   export const THEMES: ThemeMeta[] = [ … ];
   ```

`data-theme` 与现有 `.dark` 类共存于 `<html>`，靠 CSS 层叠（作用域特异性 + 导入顺序）叠加，互不冲突。

---

## 2. 设计文件 ↔ 主题层 对应关系

5 个品牌源文件（`sources/*.md`）使用**各自的词汇表**（如 `colors.primary`、`typography.hero-display`）。
它们与主题层的对应链路是：

```
sources/<brand>.md  (native 词汇表)
        │  人工阅读 + 提炼（见 CONTRACT.md §3 映射表）
        ▼
themes/<brand>.json  (契约变量覆盖集 = 落到 --navy / --font-display / --radius … 的值)
        │  pnpm tokens:all
        ▼
themes.generated.css  ([data-theme="<brand>"] { … })   ← 运行时真正被加载的皮肤
        │
        ▼
组件只引用契约变量 → 皮肤自动生效，组件零改动
```

- `sources/*.md` 是**参考素材**，不参与构建，仅供人和 AI 理解品牌意图。
- `themes/<brand>.json` 是**唯一需要维护的主题资产**（增量、可读、可 diff）。
- `themes.generated.*` 是**构建产物**，由 JSON 生成，禁止手改。
- `CONTRACT.md §3` 把每个品牌的 native token 显式映射到契约变量，是“源文件 → 覆盖集”的翻译表。

> 例：Apple 源的 `colors.primary #0066cc` → CONTRACT 映射 → `themes/apple.json` 的 `--navy`/`--blue` light=`#0066cc`。
> Dell-1996 源的 `rounded.none` → `--radius` 全部 `0px`；`colors.frame-ink #000` → `--border` light=`#000`。

---

## 3. 换主题时的具体接入点

### 接入点 A — 构建期（加/改主题皮肤）
1. 改 `themes/<brand>.json` 的 `overrides`（或新建一个 JSON）。
2. 跑 `pnpm tokens:all` → 重新生成 `themes.generated.css` / `.ts`。
3. （可选）若新增了 L2 变体，确认 `variants/<brand>.css` 已就位（见接入点 D）。
> 校验：`pnpm tokens:all --check` 比对生成物与真源是否一致（CI / lint 用）。

### 接入点 B — 运行时切换（核心）
`src/client/theme.ts` 提供纯函数，全部作用在 `<html>` 上：
- `setTheme(id)` —— 写 `document.documentElement.dataset.theme`（默认主题则移除属性）。
- `getTheme()` —— 读 `localStorage('pgt-ui-theme')`，非法值退回 `pgt-default`。
- `initTheme()` —— 首帧前调用，避免主题闪烁。**已在 `main.tsx` 入口处调用。**
- `useTheme()` —— React 钩子，返回 `{ theme, setTheme, themes }`。

切换即 `setTheme('apple')`，组件无感。深色模式走既有 `.dark` 类（`components.tsx` 的 toggle），与 `data-theme` 互不干扰。

### 接入点 C — UI 控件（让用户切换）
`src/client/components/ThemePicker.tsx` 是开箱即用的接入点：
```tsx
import { ThemePicker } from './components/ThemePicker';
<ThemePicker />   // 渲染一个 <select>，选项来自生成的 THEMES 清单
```
把它放进设置页 / 侧栏底部 / 命令面板任意位置即可。新增主题后无需改此组件——`THEMES` 会自动包含新项。

### 接入点 D — L2 可选变体（签名级装饰）
当某品牌的签名效果无法用 token 表达（如 Dell-1996 的 90 年代浮雕 bevel），放进
`themes/variants/<brand>.css`，全部作用域在 `[data-theme="<brand>"]` 下，**不改组件 markup**。
启用（可选，默认不加载以保持极简）：在 `src/client/styles.css` 末尾加
```css
@import './themes-variants.generated.css';   /* 聚合所有变体 */
/* 或单独引入：@import '../../assets/design/themes/variants/dell-1996.css'; */
```
受 harness 铁律约束：变体里禁用渐变 / 毛玻璃 / 发光，只允许实色边框与 inset 浮雕阴影。

---

## 4. 新增一个主题（5 分钟流程）

1. 在 `sources/` 放入该品牌的 DESIGN.md（可选，作参考）。
2. 复制 `themes/apple.json` 为 `themes/<new>.json`，改 `$meta` 与 `overrides`。
3. （可选）写 `themes/variants/<new>.css` 表达签名装饰。
4. `pnpm tokens:all` —— 自动把新主题编译进 `themes.generated.css` / `.ts`。
5. 在 UI 任意位置放 `<ThemePicker />`（或已有），新主题即出现在下拉里。
**全程不改任何组件、布局、或 `tokens.json`。**

---

## 5. 与 harness 铁律的关系

| harness 铁律 | 主题机制如何遵守 |
|--------------|------------------|
| token-only，禁止散落 CSS 色值 | 主题只改契约变量；组件引用变量，不写死品牌色 |
| 单一事实源 | `tokens.json` 是唯一真源；`themes/*.json` 是其增量覆盖，非第二真相 |
| 禁渐变 / 毛玻璃 / 发光 | L1 纯值替换天然无 banned 效果；L2 变体显式禁用，只允许实色/inset 阴影 |
| 暗色同步 | 每个主题 JSON 都给 `{light, dark}` 双值，`[data-theme].dark` 作用域同步切换 |
| 字重仅 400/500/600/700 | 主题不改字重档位，只换字族 |
| 改完跑 `design:lint` | 主题经 `tokens:all` 生成，`--check` 模式可纳入 CI 校验一致性 |

---

## 6. 文件地图

```
assets/design/
├─ harness/tokens.json            ← 唯一事实源（默认 token + 契约变量名）
└─ themes/
   ├─ CONTRACT.md                 ← 语义变量契约 + 品牌 native→契约 映射表
   ├─ THEME.md                    ← 本文（机制 / 接入点）
   ├─ apple.json / claude.json / dell-1996.json / elevenlabs.json / hp.json  ← L1 覆盖集
   ├─ sources/                    ← 5 个品牌 DESIGN.md（参考素材，不参与构建）
   └─ variants/
      └─ dell-1996.css            ← L2 可选变体（90 年代 bevel 签名）

src/client/
├─ tokens.generated.css           ← 默认主题（由 tokens.json 生成）
├─ themes.generated.css           ← 5 个品牌皮肤（由 themes/*.json 生成，[data-theme] 作用域）
├─ themes.generated.ts            ← THEMES 清单（由 themes/*.json 生成）
├─ theme.ts                       ← 运行时切换：setTheme / getTheme / initTheme / useTheme
├─ components/ThemePicker.tsx     ← 接入点 C：开箱即用的主题选择控件
├─ main.tsx                       ← 入口调用 initTheme()
└─ styles.css                     ← @import 两个 generated.css + .theme-picker 样式
```
