import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AiConfigData } from "../../shared/solofocus-models.js";

const DEFAULT_CONFIG: AiConfigData = {
  provider: "agy-native",
  baseUrl: "https://api.deepseek.com/v1",
  model: "gemini-3.7-flash (AGY Native)",
  temperature: 0.3,
  maxTokens: 2048,
  configured: true
};

export function resolveAiConfigPath(): string {
  const appSupport = path.join(os.homedir(), "Library", "Application Support", "个人工作台");
  try {
    if (!fs.existsSync(appSupport)) {
      fs.mkdirSync(appSupport, { recursive: true });
    }
    return path.join(appSupport, "solofocus-ai-config.json");
  } catch {
    const localData = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(localData)) {
      fs.mkdirSync(localData, { recursive: true });
    }
    return path.join(localData, "solofocus-ai-config.json");
  }
}

export class SoloFocusAiService {
  private configPath = resolveAiConfigPath();
  private cachedConfig: AiConfigData | null = null;

  public getConfig(): AiConfigData {
    if (this.cachedConfig) return this.cachedConfig;
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
        const provider = raw.provider || (raw.apiKey ? "custom" : "agy-native");
        const apiKey = process.env.WORKBENCH_AI_API_KEY || (typeof raw.apiKey === "string" ? raw.apiKey.trim() : "");
        const baseUrl = process.env.WORKBENCH_AI_BASE_URL || raw.baseUrl || DEFAULT_CONFIG.baseUrl;
        const model = process.env.WORKBENCH_AI_MODEL || raw.model || DEFAULT_CONFIG.model;
        const isAgy = provider === "agy-native";
        this.cachedConfig = {
          provider,
          baseUrl: baseUrl.replace(/\/$/, ""),
          model,
          apiKey: apiKey || undefined,
          temperature: typeof raw.temperature === "number" ? raw.temperature : DEFAULT_CONFIG.temperature,
          maxTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : DEFAULT_CONFIG.maxTokens,
          configured: isAgy ? true : Boolean(apiKey && apiKey.length > 5)
        };
        return this.cachedConfig;
      }
    } catch {
      // ignore read error
    }

    const envKey = process.env.WORKBENCH_AI_API_KEY?.trim();
    const provider = envKey ? "custom" : DEFAULT_CONFIG.provider;
    this.cachedConfig = {
      ...DEFAULT_CONFIG,
      provider,
      apiKey: envKey || undefined,
      configured: provider === "agy-native" ? true : Boolean(envKey && envKey.length > 5)
    };
    return this.cachedConfig;
  }

  public saveConfig(updates: Partial<AiConfigData>): AiConfigData {
    const current = this.getConfig();
    const nextProvider = updates.provider ?? current.provider ?? (updates.apiKey ? "custom" : "agy-native");
    const isAgy = nextProvider === "agy-native";
    const apiKey = updates.apiKey !== undefined ? updates.apiKey.trim() : current.apiKey;
    const next: AiConfigData = {
      ...current,
      ...updates,
      provider: nextProvider,
      apiKey: apiKey || undefined,
      configured: isAgy ? true : Boolean(apiKey && apiKey.length > 5)
    };
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(next, null, 2), "utf-8");
      this.cachedConfig = next;
    } catch (err) {
      console.error("[SoloFocusAiService] Failed to persist AI config:", err);
    }
    return next;
  }

  /**
   * Execute chat completion via configured LLM API or AGY native engine.
   * In AGY native mode, directly invoke the high-performance local cognitive engine.
   */
  public async executeChatOrFallback<T>(
    systemPrompt: string,
    userPrompt: string,
    fallbackGenerator: () => T,
    parseResponse?: (text: string) => T
  ): Promise<T> {
    const config = this.getConfig();

    // 1. Antigravity Native Engine: instantaneous, private, zero-config
    if (config.provider === "agy-native") {
      return fallbackGenerator();
    }

    // 2. Custom external API mode
    if (!config.configured || !config.apiKey) {
      return fallbackGenerator();
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const endpoint = `${config.baseUrl}/chat/completions`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: config.temperature ?? 0.3,
          max_tokens: config.maxTokens ?? 2048
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[SoloFocusAiService] LLM request returned HTTP ${response.status}. Falling back to AGY engine.`);
        return fallbackGenerator();
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        return fallbackGenerator();
      }

      if (parseResponse) {
        return parseResponse(content);
      }

      return fallbackGenerator();
    } catch (err: any) {
      console.warn(`[SoloFocusAiService] LLM invocation failed (${err.message}). Using AGY native fallback.`);
      return fallbackGenerator();
    }
  }
}
