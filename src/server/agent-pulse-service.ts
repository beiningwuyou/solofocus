import { todayIso, type VaultEntity, asString, isOpenTask } from "../shared/domain.js";
import { dailyFor, readRoutine, shiftRoutineDate } from "../shared/daily-routine.js";
import type { VaultRepository } from "./repository.js";
import { resolveAiConfig } from "./ai-config.js";
import {
  type AgentPulseOutput,
  type PulseAction,
  agentPulseOutputSchema,
  buildPulseContext,
  heuristicPulseGenerator,
  AGENT_PULSE_SYSTEM_PROMPT
} from "./agent-pulse-prompt.js";

export interface PulseResultWithMeta extends AgentPulseOutput {
  source: "llm" | "heuristic";
  date: string;
}

export class AgentPulseService {
  private cache: { date: string; result: PulseResultWithMeta } | null = null;

  constructor(
    private readonly repository: VaultRepository,
    private readonly vaultPath: string,
    private readonly onActivity?: (summary: string, tone?: "info" | "success" | "warning" | "neutral") => Promise<void>
  ) {}

  async getDailyPulse(options?: { refresh?: boolean }): Promise<PulseResultWithMeta> {
    const today = todayIso();
    if (!options?.refresh && this.cache && this.cache.date === today) {
      return this.cache.result;
    }

    const allEntities = this.repository.list();
    const projects = this.repository.list("project");
    const openTasks = this.repository.list("task").filter(isOpenTask);
    const archivedTasks = this.repository.list("task").filter((t) => !isOpenTask(t));

    const todayRoutineEntity = dailyFor(allEntities, today);
    const todayRoutine = todayRoutineEntity ? readRoutine(todayRoutineEntity) : undefined;

    const yesterdayDate = shiftRoutineDate(today, -1);
    const yesterdayEntity = dailyFor(allEntities, yesterdayDate);
    const yesterdayRoutine = yesterdayEntity ? readRoutine(yesterdayEntity) : undefined;
    const yesterdayFirstStep = yesterdayRoutine?.tomorrow?.trim();

    const contextInput = {
      today,
      projects,
      openTasks,
      archivedTasks,
      dailyRoutine: todayRoutine,
      yesterdayFirstStep
    };

    const aiConfig = resolveAiConfig(this.vaultPath);
    let output: AgentPulseOutput | null = null;
    let source: "llm" | "heuristic" = "heuristic";

    if (aiConfig.configured) {
      try {
        output = await this.callLlm(aiConfig, contextInput);
        source = "llm";
      } catch (err) {
        console.warn(`[AgentPulseService] LLM 推送生成异常，回退至本地启发式规则: ${(err as Error).message}`);
      }
    }

    if (!output) {
      output = heuristicPulseGenerator(contextInput);
      source = "heuristic";
    }

    const result: PulseResultWithMeta = {
      ...output,
      source,
      date: today
    };

    this.cache = { date: today, result };
    return result;
  }

  async applyAction(action: PulseAction): Promise<{ ok: boolean; entityId: string; message: string }> {
    const today = todayIso();
    let affectedEntityId = "";
    let actionDescription = "";

    if (action.actionType === "promote_existing" && action.existingTaskId) {
      const existing = this.repository.get(action.existingTaskId);
      if (!existing || existing.kind !== "task") {
        throw new Error("未找到要设为重点的现有任务");
      }
      const updated = await this.repository.update(existing.id, {
        expectedRevision: existing.revision,
        merge: true,
        properties: {
          focus: true,
          scheduled: today
        }
      });
      affectedEntityId = updated.id;
      actionDescription = `已将现有任务「${updated.name}」设为今日重点`;
    } else {
      // create_new
      const created = await this.repository.create("task", {
        name: action.title,
        properties: {
          status: "todo",
          priority: action.priority || "p1",
          focus: true,
          scheduled: today,
          project: action.project ? `[[${action.project}]]` : undefined,
          due: today
        },
        body: `> 由 Agent 今日智能建议生成\n\n**决策理由**：${action.rationale}\n`
      });
      affectedEntityId = created.id;
      actionDescription = `已为项目「${action.project}」创建并设为今日重点：${created.name}`;
    }

    if (this.onActivity) {
      try {
        await this.onActivity(actionDescription, "success");
      } catch {
        // ignore logging error
      }
    }

    return { ok: true, entityId: affectedEntityId, message: actionDescription };
  }

  private async callLlm(
    aiConfig: ReturnType<typeof resolveAiConfig>,
    contextInput: Parameters<typeof buildPulseContext>[0]
  ): Promise<AgentPulseOutput> {
    const context = buildPulseContext(contextInput);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);

    try {
      const res = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.model,
          temperature: aiConfig.temperature ?? 0.3,
          max_tokens: aiConfig.maxTokens ?? 2048,
          messages: [
            { role: "system", content: AGENT_PULSE_SYSTEM_PROMPT },
            {
              role: "user",
              content: `这是当前工作台的上下文数据，请做出精准的战略研判并给出 1-3 个高杠杆今日行动建议：\n${JSON.stringify(context, null, 2)}`
            }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`AI 服务响应错误 ${res.status}: ${res.statusText}`);
      }

      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("AI 服务未返回文本内容");
      }

      const parsedJson = this.extractJson(content);
      return agentPulseOutputSchema.parse(parsedJson);
    } finally {
      clearTimeout(timer);
    }
  }

  private extractJson(raw: string): unknown {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return JSON.parse(raw);
  }
}
