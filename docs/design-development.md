# Workbench App — 前端开发约定

本目录是 PGT 个人工作台的前端应用（React 19 + Vite + Fastify）。

---

## 设计任务硬性流程（不可跳过）

**触发条件**：任何涉及 `src/client/**` 视觉呈现的任务——
新建页面、新增组件、调整样式、修改布局、改配色、动效、响应式适配。

### 动手前必须读

1. `../assets/design/harness/context.md` — 目标用户、使用场景、品牌调性
2. `../assets/design/harness/tokens.json` — 可用的设计 token 清单
3. `../assets/design/harness/antipatterns.md` — 本项目真实踩过的坑

**不要跳过 context.md。** 设计上下文无法从代码推断——
代码只说明造了什么，不说明为谁造、该是什么感觉。

### 动手时的铁律

| 规则 | 说明 |
|------|------|
| 只用 token，不写死值 | 色值、间距、圆角、字号、动效时长一律用 `var(--*)` |
| 不在 CSS 里定义 token | 新增 token 改 `tokens.json` 后运行 `pnpm tokens` |
| 不改生成物 | `src/client/tokens.generated.css` 是自动生成的 |
| 字重只用 400/500/600/700 | 其他值在当前字体栈下无效 |
| 禁止渐变、毛玻璃、发光 | 违反项目"极简克制"的调性主张 |
| 强色不作大面积背景 | 仅用于小面积语义标识 |
| 暗色模式同步验证 | 新组件必须亮暗两套都对 |

### 完成后必须执行

```bash
pnpm design:lint
```

**未通过不算完成。** lint 只卡增量：存量债务允许存在，新增违规一律拦截。

---

## 设计 harness 结构

```
assets/design/
├── DESIGN.md                主规范（9 章节）
├── harness/
│   ├── context.md           ★ 受众/场景/调性
│   ├── tokens.json          ★ 单一事实源
│   ├── antipatterns.md      ★ 反例库
│   ├── baseline.json        债务基线（机器维护）
│   └── exemplars/           可直接参照的组件样例
└── baselines/v1/            视觉基准截图
```

数据流是**单向**的：

```
tokens.json ──[pnpm tokens]──> src/client/tokens.generated.css ──> styles.css @import
```

反向手改生成物会被下次生成覆盖，且 lint 报错。

主题层另有一套单向数据流（详见下方「主题层」节）：`themes/*.json` 经 `pnpm tokens:all` 生成 `src/client/themes.generated.css`（作用域为 `[data-theme=…]`）与 `themes.generated.ts`（THEMES 清单），再经 `styles.css` 的 `@import` 加载。

---

## 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 开发（API + Web） |
| `pnpm tokens` | 重新生成默认 token CSS（tokens.json → tokens.generated.css） |
| `pnpm tokens:all` | 重新生成默认 token + 全部主题皮肤 + THEMES 清单（themes/*.json → themes.generated.*） |
| `pnpm design:lint` | 设计规范校验 |
| `pnpm design:baseline` | 更新债务基线（**仅在债务确实降低后**） |
| `pnpm check` | 全量：typecheck + design:lint + test + build |

---

## 存量债务说明

代码库存在历史债务（675 处硬编码色值、1732 处硬编码 px、12 处渐变等），
详见 `antipatterns.md` 第四节。

**处理策略：绝不一次性重构。** 一次改动数百处必然引发无法逐一验证的视觉回归。
新代码严格执行规范，旧代码在功能迭代时顺手偿还。
债务降低后运行 `pnpm design:baseline` 锁定新水位，防止反弹。

---

## 与 impeccable skill 的分工

- **harness 管一致性**：token、间距、组件参数、暗色适配 → 强约束，不可协商
- **impeccable 管品质**：布局手法、层次处理、微交互质感 → 在 harness 边界内自由发挥
- 美学方向已锁定为"极简克制"，impeccable 的 `bolder.md` **不适用于本项目**

---

## 与 ui-skills（项目级 craft 层）的分工

项目级 `ui-skills` 已安装到 `.workbuddy/skills/`，只保留与"极简克制"调性一致的子集（来源：`npx ui-skills get <owner/slug>`，拉取 `https://www.ui-skills.com/skills/<slug>/llms.txt`）：

- `ibelick/create-design-md` — 生成/修订 DESIGN.md，与 `assets/design/DESIGN.md` 互补
- `ibelick/baseline-ui` — 快速 deslop/打磨（其规则本身禁止渐变/glow，与本项目一致）
- `jakubkrehel/better-typography` — 字体执行细节（在锁定字重 400/500/600/700 内发挥）
- `jakubkrehel/better-layout` — 布局结构、留白、阅读顺序

**优先级**：harness 铁律 > ui-skills 建议。ui-skills 只作品质参考，不得引入渐变/毛玻璃/发光或新增色值。
**已显式排除**（与调性冲突，未安装）：`pbakaus/bolder`、`pbakaus/overdrive`、`pbakaus/delight`、`emilkowalski/apple-design`（translucent materials）、`leonxlnx/brutalist-skill`、`jakubkrehel/oklch-skill` / `better-colors`（冲击 hex-locked token）。
**暂不可用**：`mengto/minimalist-ui`、`mengto/design-taste-frontend`（注册表对该 slug 返回 404）。

---

## 主题层（多品牌皮肤切换）

工作台支持运行时切换主题（Apple / Claude / Dell-1996 / ElevenLabs / HP）。机制与接入点见 `assets/design/themes/THEME.md`，语义变量契约与品牌映射见同目录 `CONTRACT.md`。**做 UI 任务前若涉及主题，先读这两份。**

### 核心规则

- **组件只引用契约变量**（`--navy` / `--font-display` / `--radius` …），禁止写死任何品牌色值——与 harness 铁律一致。
- **铁律同样约束主题**：L2 变体禁用渐变 / 毛玻璃 / 发光，只允许实色边框与 inset 浮雕阴影。
- 换肤经 `<html data-theme="…">` 属性（`src/client/theme.ts` 的 `setTheme`），与既有 `.dark` 类共存于同一元素，互不冲突。

### 动手前 / 后

| 动作 | 命令 / 文件 |
|------|------|
| 新增或修改主题 | 只改 `themes/<brand>.json` 覆盖集（增量），再跑 `pnpm tokens:all` |
| 不手改生成物 | `src/client/themes.generated.css` / `themes.generated.ts` 由构建生成，手改会被覆盖且 lint 报错 |
| 让用户切换 | 渲染 `<ThemePicker />`（`src/client/components/ThemePicker.tsx`，选项来自自动生成的 THEMES 清单） |
| 接入点总览 | `THEME.md` §3（构建期 / 运行时 / UI 控件 / L2 变体 四类接入点） |

### 主题文件布局

```
assets/design/themes/
├── CONTRACT.md        语义变量契约 + 品牌 native→契约 映射表（先读）
├── THEME.md           主题机制 + 接入点（先读）
├── apple.json … hp.json  L1 主题覆盖集（增量，需维护的资产）
├── sources/           5 个品牌 DESIGN.md（参考素材，不参与构建）
└── variants/          L2 可选变体（如 dell-1996.css 的 90 年代 bevel 签名）
```
