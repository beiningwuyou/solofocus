/**
 * theme.ts — 运行时主题切换（L1 强制 token 层）。
 *
 * 设计约束（见 assets/design/themes/CONTRACT.md）：
 *  - 主题 = 一组契约变量的覆盖值，承载在 <html data-theme="<id>"> 上。
 *  - 组件只引用契约变量（--navy / --font-display / --radius …），从不写死品牌色值。
 *  - 切换主题 = 改 data-theme 属性 + 持久化到 localStorage，组件零改动。
 *  - 'pgt-default' 表示不挂 data-theme，退回 :root / tokens.generated.css 的默认主题。
 *
 * 主题清单（THEMES）由 scripts/tokens-build.mjs --all 从 themes/*.json 生成，
 * 新增主题只需加一个 themes/<brand>.json，无需改动本文件或任何组件。
 */
import { useCallback, useEffect, useState } from 'react';
import type { ThemeId } from './themes.generated';
import { THEMES } from './themes.generated';

export type { ThemeId };

const STORAGE_KEY = 'pgt-ui-theme';

/** 读取当前主题（含 localStorage 校验，非法值退回默认） */
export function getTheme(): ThemeId {
  if (typeof document === 'undefined') return 'pgt-default';
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  if (stored && (THEMES as readonly { id: string }[]).some((t) => t.id === stored)) {
    return stored;
  }
  return 'pgt-default';
}

/** 应用主题：写 data-theme 并持久化。'pgt-default' 移除属性退回默认。 */
export function setTheme(id: ThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (id === 'pgt-default') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', id);
  }
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* localStorage 不可用时静默忽略，仅本次会话生效 */
  }
}

/** 在首帧前调用，避免主题闪烁。main.tsx 入口处执行。 */
export function initTheme(): void {
  setTheme(getTheme());
}

/** React 钩子：返回当前主题、切换函数、主题清单。 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => getTheme());

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  const changeTheme = useCallback((id: ThemeId) => {
    setTheme(id);
    setThemeState(id);
  }, []);

  return {
    theme,
    setTheme: changeTheme,
    themes: THEMES as readonly { id: ThemeId; name: string; note: string }[],
  } as const;
}
