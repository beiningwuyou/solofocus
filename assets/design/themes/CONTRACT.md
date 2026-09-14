# 主题层语义契约（Canonical Contract）

本文件定义 PGT 工作台的**唯一语义变量契约**。所有主题（含默认 PGT 主题）都只向这一组固定变量名赋值；
组件与布局**永远只引用这些变量**，从不写死某个品牌的色值。切换主题 = 换这组变量的值，组件零改动。

> 契约的权威来源是 `../harness/tokens.json`（变量名 `cssVar` 字段 + 默认值）。本文件是它的“主题视图”说明，
> 并给出 5 个品牌源文件（`sources/`）的 native token → 契约变量映射表。

---

## 1. 双层主题模型

| 层 | 作用 | 改结构？ | 来源 |
|----|------|----------|------|
| **L1 强制 token 层** | 颜色 / 字族 / 圆角 / 间距 / 语义色 / 阴影尺度，全部走契约变量 | 否 | `themes/<brand>.json`（覆盖集） |
| **L2 可选主题变体层** | _period-specific_ 组件外观（如 Dell-1996 的硬黑边/斜角、ElevenLabs 的渐变光晕） | 否（只加作用域样式，不改组件 markup） | `themes/variants/<brand>.css` |

- L1 覆盖全部 5 个品牌，纯值替换，足以让工作台整体换肤。
- L2 是“锦上添花”：当某品牌签名效果无法用 token 表达（需要特定边框/装饰）时，挂在其自身
  `[data-theme="..."]` 作用域下，组件结构不变。受 harness 铁律（禁渐变/毛玻璃/发光）约束，L2 默认不被强制启用。

---

## 2. 契约变量清单（组件只引用这些）

变量名取自 `tokens.json`。新增的 5 个（标 ★）为支持主题保真度而加，均为**增量、默认值安全**，不影响旧代码。

### 颜色
| 契约变量 | 角色 | 默认（PGT） |
|----------|------|-------------|
| `--navy` | 品牌锚点 / 主按钮底色 / 侧栏选中 | `#112c54` |
| `--navy-strong` | navy 加深（hover/active） | `#092650` |
| `--blue` | 链接 / 信息 / 进行中 / 焦点环 | `#2563eb` |
| `--green` `--orange` `--red` | 语义：成功 / 警告 / 错误 | 各自默认 |
| `--violet` `--violet-soft` `--violet-border` `--violet-deep` | AI 功能专属标识 | 各自默认 |
| `--text` `--text-secondary` `--muted` `--muted-light` | 文本四级 | 各自默认 |
| `--app-bg` `--soft` `--soft-hover` `--border` `--border-light` | 表面与分隔线 | 各自默认 |

### 字族 ★
| 契约变量 | 角色 | 默认 |
|----------|------|------|
| `--font-sans` | 全局正文/UI | Inter 栈 |
| `--font-display` ★ | 标题/展示字族（可被主题覆盖为 SF Pro Display / Copernicus / Waldenburg / Forma） | = sans |
| `--font-body` ★ | 正文字族（可被覆盖为 SF Pro Text / StyreneB / Times） | = sans |
| `--font-mono` ★ | 代码/等宽（Claude/ElevenLabs 可覆盖为 JetBrains Mono） | ui-monospace 栈 |

### 圆角
| 契约变量 | 默认 | ★ |
|----------|------|---|
| `--radius-sm` | 6px | |
| `--radius` | 9px | |
| `--radius-lg` | 11px | |
| `--radius-xl` | 14px | |
| `--radius-pill` ★ | 9999px | 胶囊 CTA |
| `--radius-full` ★ | 9999px | 正圆/头像 |

### 单值（间距 / 阴影 / 字号 / 字重 / 行高 / 动效 / 布局）
沿用 `tokens.json` 现有变量：`--gap*`、`--shadow*`、`--text-*`、`--weight-*`、`--leading*`、
`--transition-*`、`--content-px/py`、`--sidebar-width`、`--topbar-height`。
这些在主题间大多**继承默认**（工作台是高密度工具 UI，间距/字号尺度不随品牌营销页放大），
仅圆角与字族/配色是主题切换的主要载体。

---

## 3. 品牌 native token → 契约变量 映射表

每个品牌源文件用**自己的词汇表**（如 `colors.primary`、`typography.hero-display`）。下面给出关键映射。
主题 JSON（`themes/<brand>.json`）就是把这些映射**落到契约变量上的覆盖值**。

| 契约变量 | Apple | Claude | Dell-1996 | ElevenLabs | HP |
|----------|-------|--------|-----------|------------|-----|
| `--navy` | `colors.primary` #0066cc | `colors.primary` #cc785c | `colors.primary` #e91d2a | `colors.primary` #292524 | `colors.primary` #024ad8 |
| `--blue` | `colors.primary` #0066cc | `colors.primary` #cc785c | `colors.link` #0000ee | `colors.primary` #292524 | `colors.link` #024ad8 |
| `--green` | （继承默认） | `colors.success` #5db872 | （继承默认） | `colors.semantic-success` #16a34a | （继承默认） |
| `--orange` | （继承默认） | `colors.warning` #d4a017 | （继承默认） | （继承默认） | （继承默认） |
| `--red` | （继承默认） | `colors.error` #c64545 | `colors.primary` #e91d2a | `colors.semantic-error` #dc2626 | `colors.error` #b3262b |
| `--violet*` | 蓝色淡染 | 珊瑚淡染 | 红淡染 | 墨淡染 | 蓝淡染 |
| `--text` | `colors.ink` #1d1d1f | `colors.ink` #141413 | `colors.ink` #000000 | `colors.ink` #0c0a09 | `colors.ink` #1a1a1a |
| `--text-secondary` | #333333 | `colors.body` #3d3d3a | #000000 | `colors.body` #4e4e4e | `colors.ink-soft` #292929 |
| `--muted` | #7a7a7a | #6c6a64 | #000000 | #777169 | #636363 |
| `--muted-light` | #86868b | #8e8b82 | #999999 | #a8a29e | #c2c2c2 |
| `--app-bg` | `colors.canvas` #fff | `colors.canvas` #faf9f5 | `colors.canvas` #fff | `colors.canvas` #f5f5f5 | `colors.canvas` #fff |
| `--soft` | `colors.canvas-parchment` #f5f5f7 | `colors.surface-card` #efe9de | `colors.surface` #fff | `colors.surface-card` #fff | `colors.cloud` #f7f7f7 |
| `--border` | `colors.hairline` #d2d2d7 | `colors.hairline` #e6dfd8 | `colors.frame-ink` #000000 | `colors.hairline` #e7e5e4 | `colors.hairline` #e8e8e8 |
| `--border-light` | #e8e8ed | #ebe6df | #000000 | #f0efed | #f7f7f7 |
| `--radius` | `rounded.md` 11px | `rounded.md` 8px | `rounded.none` **0px** | `rounded.md` 8px | `rounded.md` 4px |
| `--radius-sm` | 5px | 6px | 0px | 6px | 3px |
| `--radius-lg` | 18px | 12px | 0px | 12px | 8px |
| `--radius-xl` | 18px | 16px | 0px | 16px | 16px |
| `--font-display` ★ | SF Pro Display | Copernicus serif | Arial Black | Waldenburg serif | Forma DJR |
| `--font-body` ★ | SF Pro Text | StyreneB / Inter | Times New Roman | Inter | Forma DJR |
| `--font-mono` ★ | ui-monospace | JetBrains Mono | Courier New | ui-monospace | ui-monospace |

> 注：Dell-1996 把全部圆角置 0、边框置纯黑——这是它“90 年代产品目录”签名的 token 级表达。
> 它的斜角/立体贴纸等更极端的装饰走 L2 变体层（`variants/dell-1996.css`），不影响组件结构。

---

## 4. 主题 JSON 覆盖集格式

主题文件**只写相对默认主题的增量**，不重复 50+ 个变量。双值 token（color/shadow）用 `{light,dark}`，
单值 token（radius/space/font…）用字符串。构建脚本以 `tokens.json` 为基，叠加覆盖后生成 CSS。

```json
{
  "$meta": { "name": "Apple", "basedOn": "pgt-default", "note": "Action Blue + SF Pro，圆角 11/18，parchment 浅底" },
  "overrides": {
    "--navy":   { "light": "#0066cc", "dark": "#2997ff" },
    "--blue":   { "light": "#0066cc", "dark": "#2997ff" },
    "--font-display": "SF Pro Display, system-ui, -apple-system, sans-serif",
    "--radius": "11px",
    "--radius-lg": "18px"
  }
}
```

**契约即事实源**：新增主题只需再写一个 `<brand>.json` 覆盖集 +（可选）`variants/<brand>.css`，
无需改动任何组件、布局或 `tokens.json`。
