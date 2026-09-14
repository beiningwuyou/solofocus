#!/usr/bin/env node
/**
 * tokens-build — 从设计 harness 的单一事实源生成 CSS 变量与多主题皮肤。
 *
 *   assets/design/harness/tokens.json   ──>  src/client/tokens.generated.css   (L0 默认 token)
 *   assets/design/themes/*.json          ──>  src/client/themes.generated.css  ([data-theme=...] 作用域)
 *                                          ──>  src/client/themes.generated.ts   (THEMES 列表，供 UI 选择)
 *
 * 零依赖，原生 Node。用法：
 *   node scripts/tokens-build.mjs           生成默认 token（tokens.generated.css）
 *   node scripts/tokens-build.mjs --all     生成默认 token + 全部主题皮肤 + THEMES 列表
 *   node scripts/tokens-build.mjs --check   仅校验默认 token 生成物与真源一致（CI/lint 用）
 *   node scripts/tokens-build.mjs --all --check  校验默认 token + 主题皮肤均与真源一致
 *
 * 机制：主题 = 覆盖集。themes/<brand>.json 只写相对默认的增量（契约变量值），
 * 构建脚本以 tokens.json 为基叠加覆盖，输出完整作用域 CSS。组件零改动即可换肤。
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..');

const TOKENS_PATH = resolve(APP_ROOT, 'assets/design/harness/tokens.json');
const THEMES_DIR = resolve(APP_ROOT, 'assets/design/themes');
const TOKENS_OUT = resolve(APP_ROOT, 'src/client/tokens.generated.css');
const THEMES_CSS_OUT = resolve(APP_ROOT, 'src/client/themes.generated.css');
const THEMES_TS_OUT = resolve(APP_ROOT, 'src/client/themes.generated.ts');

const allFlag = process.argv.includes('--all');
const checkOnly = process.argv.includes('--check');

/** 递归收集所有带 cssVar 的 token 叶子节点 */
function collect(node, path = [], out = []) {
  if (node === null || typeof node !== 'object') return out;
  if (typeof node.cssVar === 'string') {
    out.push({ ...node, path: path.join('.') });
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    collect(value, [...path, key], out);
  }
  return out;
}

/** 将 tokens.json 解析为 cssVar -> {light, dark, usage} 的扁平映射 */
function resolveBase(tokens) {
  const map = new Map();
  for (const t of collect(tokens)) {
    let light, dark;
    if (t.value !== undefined) {
      light = dark = t.value;
    } else {
      light = t.light;
      dark = t.dark ?? t.light;
    }
    map.set(t.cssVar, { light, dark, usage: t.usage });
  }
  return map;
}

/** 把主题的增量 overrides 叠加到基线映射上，返回新的完整映射 */
function applyTheme(base, overrides = {}) {
  const map = new Map();
  for (const [k, v] of base) map.set(k, { ...v });
  for (const [cssVar, val] of Object.entries(overrides)) {
    if (!map.has(cssVar)) {
      console.warn(`[tokens-build] 主题覆盖引用了未知变量 ${cssVar}，已忽略`);
      continue;
    }
    if (typeof val === 'string') {
      map.set(cssVar, { ...map.get(cssVar), light: val, dark: val });
    } else if (val && typeof val === 'object') {
      const cur = map.get(cssVar);
      map.set(cssVar, {
        ...cur,
        light: val.light ?? cur.light,
        dark: val.dark ?? cur.dark,
      });
    }
  }
  return map;
}

/* ── 默认 token CSS（:root / .dark） ── */
function buildBaseCss(tokens) {
  const all = collect(tokens);

  const duplicates = all
    .map((t) => t.cssVar)
    .filter((v, i, arr) => arr.indexOf(v) !== i);
  if (duplicates.length) {
    throw new Error(`重复的 cssVar 定义: ${[...new Set(duplicates)].join(', ')}`);
  }

  // 自引用检测——正是 --gap: var(--gap) 那类 bug
  for (const t of all) {
    for (const v of [t.value, t.light, t.dark]) {
      if (typeof v === 'string' && v.includes(`var(${t.cssVar})`)) {
        throw new Error(`token 自引用: ${t.cssVar} 的值引用了自身`);
      }
    }
  }

  const lightLines = [];
  const darkLines = [];

  for (const t of all) {
    const comment = t.usage ? `  /* ${t.usage} */\n` : '';
    if (t.value !== undefined) {
      lightLines.push(`${comment}  ${t.cssVar}: ${t.value};`);
    } else {
      if (t.light !== undefined) lightLines.push(`${comment}  ${t.cssVar}: ${t.light};`);
      if (t.dark !== undefined && t.dark !== t.light) darkLines.push(`  ${t.cssVar}: ${t.dark};`);
    }
  }

  const meta = tokens.$meta ?? {};
  return `/* ============================================================
 * DO NOT EDIT — 本文件由 scripts/tokens-build.mjs 自动生成
 *
 * 唯一事实源: assets/design/harness/tokens.json
 * 修改流程:   编辑 tokens.json → node scripts/tokens-build.mjs
 *
 * 手动修改本文件会在下次生成时被覆盖，且 design-lint 会报错。
 *
 * source  ${meta.name ?? 'design tokens'} v${meta.version ?? '0.0.0'}
 * updated ${meta.updated ?? 'unknown'}
 * ============================================================ */

:root {
${lightLines.join('\n')}
}

.dark {
${darkLines.join('\n')}
}
`;
}

/* ── 主题皮肤 ── */
function loadThemes() {
  if (!existsSync(THEMES_DIR)) return [];
  return readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = resolve(THEMES_DIR, f);
      let json;
      try {
        json = JSON.parse(readFileSync(path, 'utf8'));
      } catch (err) {
        console.warn(`[tokens-build] 跳过无法解析的主题文件 ${f}: ${err.message}`);
        return null;
      }
      const id = f.replace(/\.json$/, '');
      return {
        id,
        path,
        name: json.$meta?.name ?? id,
        note: json.$meta?.note ?? '',
        overrides: json.overrides ?? {},
      };
    })
    .filter(Boolean);
}

function buildThemeCss(name, resolved) {
  const lightLines = [];
  const darkLines = [];
  for (const [cssVar, v] of resolved) {
    const comment = v.usage ? `  /* ${v.usage} */\n` : '';
    lightLines.push(`${comment}  ${cssVar}: ${v.light};`);
    if (v.dark !== v.light) darkLines.push(`  ${cssVar}: ${v.dark};`);
  }
  return (
    `[data-theme="${name}"] {\n${lightLines.join('\n')}\n}\n\n` +
    `[data-theme="${name}"].dark {\n${darkLines.join('\n')}\n}\n`
  );
}

function buildThemesCss(baseTokens) {
  const base = resolveBase(baseTokens);
  const themes = loadThemes();
  const header = `/* ============================================================
 * DO NOT EDIT — 本文件由 scripts/tokens-build.mjs --all 自动生成
 *
 * 唯一事实源: assets/design/harness/tokens.json + assets/design/themes/*.json
 * 修改流程:   编辑 themes/<brand>.json → node scripts/tokens-build.mjs --all
 *
 * 每个主题是一个 [data-theme="<id>"] 作用域，纯值覆盖契约变量；
 * 组件只引用契约变量，故换肤无需改动任何组件或布局。
 *
 * 本文件含 ${themes.length} 个品牌主题 + 默认（:root）主题。
 * ============================================================ */

`;
  const blocks = themes
    .map((t) => buildThemeCss(t.id, applyTheme(base, t.overrides)))
    .join('\n');
  return header + blocks;
}

function buildThemesTs(baseTokens) {
  const themes = loadThemes();
  const metas = [
    { id: 'pgt-default', name: 'PGT 默认', note: '反向提取的极简克制基线，工作台原生主题' },
    ...themes.map((t) => ({ id: t.id, name: t.name, note: t.note })),
  ];
  const ids = metas.map((m) => `"${m.id}"`).join(' | ');
  const rows = metas
    .map((m) => `  { id: ${JSON.stringify(m.id)}, name: ${JSON.stringify(m.name)}, note: ${JSON.stringify(m.note)} }`)
    .join(',\n');
  return `// DO NOT EDIT — 本文件由 scripts/tokens-build.mjs --all 自动生成
// 主题清单，供设置页 / 主题切换 UI 直接消费。新增主题只需加一个 themes/<brand>.json。
export type ThemeId = ${ids};

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  note: string;
}

export const THEMES: ThemeMeta[] = [
${rows}
];
`;
}

/* ── 校验 ── */
function checkFile(path, expected, label) {
  if (!existsSync(path)) {
    console.error(`[tokens-build] ✗ ${label} 生成物缺失，请运行 node scripts/tokens-build.mjs${allFlag ? ' --all' : ''}`);
    process.exit(1);
  }
  const current = readFileSync(path, 'utf8');
  if (current !== expected) {
    console.error(`[tokens-build] ✗ ${label} 与真源不一致`);
    console.error('  可能原因: 手动编辑了生成物，或改了真源但没重新生成');
    console.error(`  修复: node scripts/tokens-build.mjs${allFlag ? ' --all' : ''}`);
    process.exit(1);
  }
  console.log(`[tokens-build] ✓ ${label} 与真源一致`);
}

/* ── 入口 ── */
function main() {
  if (!existsSync(TOKENS_PATH)) {
    console.error(`[tokens-build] 找不到真源文件: ${TOKENS_PATH}`);
    process.exit(1);
  }

  let tokens;
  try {
    tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  } catch (err) {
    console.error(`[tokens-build] tokens.json 解析失败: ${err.message}`);
    process.exit(1);
  }

  const baseCss = buildBaseCss(tokens);

  if (checkOnly) {
    checkFile(TOKENS_OUT, baseCss, '默认 token');
    if (allFlag) {
      checkFile(THEMES_CSS_OUT, buildThemesCss(tokens), '主题皮肤 CSS');
      checkFile(THEMES_TS_OUT, buildThemesTs(tokens), 'THEMES 列表');
    }
    return;
  }

  writeFileSync(TOKENS_OUT, baseCss, 'utf8');
  const baseCount = collect(tokens).length;
  console.log(`[tokens-build] ✓ 已生成 ${baseCount} 个默认 token → src/client/tokens.generated.css`);

  if (allFlag) {
    const themesCss = buildThemesCss(tokens);
    const themesTs = buildThemesTs(tokens);
    writeFileSync(THEMES_CSS_OUT, themesCss, 'utf8');
    writeFileSync(THEMES_TS_OUT, themesTs, 'utf8');
    const themeCount = loadThemes().length;
    console.log(`[tokens-build] ✓ 已生成 ${themeCount} 个主题皮肤 → src/client/themes.generated.css`);
    console.log(`[tokens-build] ✓ 已生成 THEMES 列表 → src/client/themes.generated.ts`);
  }
}

main();
