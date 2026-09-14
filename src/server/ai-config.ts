import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface AiConfigData {
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ResolvedAiConfig extends AiConfigData {
  configured: boolean;
}

const DEFAULT_CONFIG: AiConfigData = {
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  temperature: 0.3,
  maxTokens: 2048,
};

let cachedConfig: AiConfigData | null = null;

export function loadAiConfig(vaultPath: string): AiConfigData {
  try {
    const file = path.join(vaultPath, "_System", "ai-config.json");
    if (!existsSync(file)) return DEFAULT_CONFIG;
    const raw = JSON.parse(readFileSync(file, "utf-8")) as Partial<AiConfigData>;
    return {
      baseUrl: raw.baseUrl || DEFAULT_CONFIG.baseUrl,
      model: raw.model || DEFAULT_CONFIG.model,
      apiKey: typeof raw.apiKey === "string" && raw.apiKey.trim() ? raw.apiKey.trim() : undefined,
      temperature: typeof raw.temperature === "number" ? raw.temperature : DEFAULT_CONFIG.temperature,
      maxTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : DEFAULT_CONFIG.maxTokens,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAiConfig(vaultPath: string, partial: Partial<AiConfigData>): AiConfigData {
  const current = loadAiConfig(vaultPath);
  const next: AiConfigData = { ...current, ...partial };
  const systemDir = path.join(vaultPath, "_System");
  if (!existsSync(systemDir)) {
    mkdirSync(systemDir, { recursive: true });
  }
  writeFileSync(path.join(systemDir, "ai-config.json"), JSON.stringify(next, null, 2), "utf-8");
  cachedConfig = next;
  return next;
}

export function resolveAiConfig(vaultPath: string): ResolvedAiConfig {
  const file = cachedConfig ?? loadAiConfig(vaultPath);
  const apiKey = process.env.WORKBENCH_AI_API_KEY || file.apiKey || "";
  const baseUrl = (process.env.WORKBENCH_AI_BASE_URL || file.baseUrl).replace(/\/$/, "");
  const model = process.env.WORKBENCH_AI_MODEL || file.model;
  return {
    baseUrl,
    apiKey,
    model,
    temperature: file.temperature,
    maxTokens: file.maxTokens,
    configured: Boolean(baseUrl && apiKey),
  };
}
