// DO NOT EDIT — 本文件由 scripts/tokens-build.mjs --all 自动生成
// 主题清单，供设置页 / 主题切换 UI 直接消费。新增主题只需加一个 themes/<brand>.json。
export type ThemeId = "pgt-default" | "apple" | "claude" | "dell-1996" | "elevenlabs" | "hp";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  note: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "pgt-default", name: "PGT 默认", note: "反向提取的极简克制基线，工作台原生主题" },
  { id: "apple", name: "Apple", note: "Action Blue #0066cc + SF Pro + parchment 浅底；圆角 11/18，CTA 胶囊" },
  { id: "claude", name: "Claude", note: "Coral #cc785c + Copernicus serif 标题 + 奶油底；圆角 8/12/16" },
  { id: "dell-1996", name: "Dell 1996", note: "红 #e91d2a + 黑框 + Times/Arial Black；全部圆角 0（90 年代产品目录）" },
  { id: "elevenlabs", name: "ElevenLabs", note: "近黑墨 #292524 + Waldenburg Light serif + 灰白底；克制、无饱和 CTA" },
  { id: "hp", name: "HP", note: "Electric Blue #024ad8 + Forma DJR 几何无衬线 + 白纸底；圆角 4/8/16" }
];
