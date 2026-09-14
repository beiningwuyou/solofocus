#!/usr/bin/env node
/**
 * design-lint — 设计 harness 的出口校验。
 *
 * 职责：让"设计一致性"变成可量化、可回归的指标。
 * 核心原则：只卡增量。存量债务记录在基线里，允许存在，但不允许变多。
 *
 * 用法：
 *   node scripts/design-lint.mjs                检查（超基线则退出码 1）
 *   node scripts/design-lint.mjs --update-baseline   把当前值写为新基线（仅在确实降低后使用）
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..');
const CLIENT_DIR = resolve(APP_ROOT, 'src/client');
const STYLES = resolve(CLIENT_DIR, 'styles.css');
const GENERATED = resolve(CLIENT_DIR, 'tokens.generated.css');
const BASELINE_PATH = resolve(APP_ROOT, 'assets/design/harness/baseline.json');

const updateBaseline = process.argv.includes('--update-baseline');

const ALLOWED_WEIGHTS = new Set(['400', '500', '600', '700', 'normal', 'bold', 'inherit']);

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (ext.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const results = { errors: [], warnings: [], metrics: {} };
const err = (m) => results.errors.push(m);
const warn = (m) => results.warnings.push(m);

// ── 1. 生成物必须与真源一致 ─────────────────────────────
try {
  execFileSync(process.execPath, [resolve(__dirname, 'tokens-build.mjs'), '--check'], {
    stdio: 'pipe',
  });
} catch (e) {
  err('tokens.generated.css 与 tokens.json 不一致 —— 运行 node scripts/tokens-build.mjs');
}

// ── 2. token 定义不得散落在 styles.css ──────────────────
const css = readFileSync(STYLES, 'utf8');
const genCss = existsSync(GENERATED) ? readFileSync(GENERATED, 'utf8') : '';
const genVars = new Set([...genCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));

css.split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gi)) {
    if (genVars.has(m[1])) {
      err(`styles.css:${i + 1} 重复定义了已收归的 token ${m[1]} —— 请改 tokens.json`);
    }
  }
});

// ── 3. 自引用检测（--gap: var(--gap) 那类事故）───────────
for (const file of [STYLES, GENERATED]) {
  if (!existsSync(file)) continue;
  const txt = readFileSync(file, 'utf8');
  txt.split('\n').forEach((line, i) => {
    const m = line.match(/(--[a-z0-9-]+)\s*:\s*var\(\s*(--[a-z0-9-]+)\s*\)/i);
    if (m && m[1] === m[2]) {
      err(`${relative(APP_ROOT, file)}:${i + 1} 变量自引用 ${m[1]} —— 该变量会失效`);
    }
  });
}

// ── 4. 调性禁令：渐变、毛玻璃 ───────────────────────────
const gradients = (css.match(/(linear|radial|conic)-gradient/g) ?? []).length;
const backdrop = (css.match(/backdrop-filter/g) ?? []).length;

// ── 5. 字重白名单 ───────────────────────────────────────
const badWeights = [];
css.split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/font-weight:\s*([0-9]+|normal|bold)/gi)) {
    if (!ALLOWED_WEIGHTS.has(m[1])) badWeights.push({ line: i + 1, value: m[1] });
  }
});

// ── 6. 硬编码统计 ───────────────────────────────────────
const hexCount = (css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
const pxCount = (css.match(/:\s*[0-9]+px/g) ?? []).length;

const tsxFiles = walk(CLIENT_DIR, ['.tsx']);
let inlineStyle = 0;
let tsxHex = 0;
for (const f of tsxFiles) {
  const t = readFileSync(f, 'utf8');
  inlineStyle += (t.match(/style=\{\{/g) ?? []).length;
  tsxHex += (t.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length;
}

results.metrics = {
  cssHardcodedHex: hexCount,
  cssHardcodedPx: pxCount,
  gradients,
  backdropFilter: backdrop,
  nonStandardFontWeight: badWeights.length,
  tsxInlineStyle: inlineStyle,
  tsxHardcodedHex: tsxHex,
};

// ── 7. 与基线比对 ───────────────────────────────────────
const LABELS = {
  cssHardcodedHex: 'CSS 硬编码色值',
  cssHardcodedPx: 'CSS 硬编码 px',
  gradients: '渐变（调性禁令）',
  backdropFilter: '毛玻璃（调性禁令）',
  nonStandardFontWeight: '非标准字重',
  tsxInlineStyle: 'tsx 内联 style',
  tsxHardcodedHex: 'tsx 硬编码色值',
};

let baseline = null;
if (existsSync(BASELINE_PATH)) {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

if (updateBaseline) {
  const next = {
    $note: '设计债务基线。只许降不许升。降低后运行 --update-baseline 锁定新水位。',
    updated: new Date().toISOString().slice(0, 10),
    metrics: results.metrics,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log('[design-lint] 基线已更新:');
  for (const [k, v] of Object.entries(results.metrics)) {
    const old = baseline?.metrics?.[k];
    const delta = old === undefined ? '' : ` (${v - old >= 0 ? '+' : ''}${v - old})`;
    console.log(`  ${LABELS[k].padEnd(18)} ${v}${delta}`);
  }
  process.exit(0);
}

console.log('\n设计 harness 校验\n' + '─'.repeat(46));

if (baseline) {
  for (const [k, v] of Object.entries(results.metrics)) {
    const base = baseline.metrics[k];
    if (base === undefined) {
      warn(`基线中无 ${k} 项，请运行 --update-baseline`);
      continue;
    }
    const delta = v - base;
    const mark = delta > 0 ? '✗' : delta < 0 ? '↓' : '·';
    const tail = delta > 0 ? `  超出基线 +${delta}` : delta < 0 ? `  较基线 ${delta}` : '';
    console.log(`  ${mark} ${LABELS[k].padEnd(18)} ${String(v).padStart(5)}${tail}`);
    if (delta > 0) err(`${LABELS[k]} 从 ${base} 增至 ${v} —— 新代码必须使用 token`);
  }
} else {
  console.log('  未找到基线，当前值：');
  for (const [k, v] of Object.entries(results.metrics)) {
    console.log(`    ${LABELS[k].padEnd(18)} ${v}`);
  }
  warn('运行 node scripts/design-lint.mjs --update-baseline 建立基线');
}

if (badWeights.length && baseline) {
  const preview = badWeights.slice(0, 3).map((b) => `L${b.line}:${b.value}`).join(', ');
  console.log(`     非标准字重示例: ${preview}${badWeights.length > 3 ? ' …' : ''}`);
}

console.log('─'.repeat(46));

if (results.warnings.length) {
  console.log('\n提示:');
  results.warnings.forEach((w) => console.log(`  ! ${w}`));
}

if (results.errors.length) {
  console.log('\n未通过:');
  results.errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('\n参考 assets/design/harness/antipatterns.md\n');
  process.exit(1);
}

console.log('\n✓ 通过\n');
