import { z } from "zod";
import type { VaultEntity } from "../shared/domain.js";
import { asString, isOpenTask, linkName, projectTasks } from "../shared/domain.js";
import type { RoutineRecord } from "../shared/daily-routine.js";

export const pulseActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  project: z.string().min(1),
  projectId: z.string().optional(),
  priority: z.enum(["p0", "p1", "p2", "p3"]).default("p1"),
  estimatedMinutes: z.number().int().min(10).max(180).default(30),
  rationale: z.string().min(1).max(300),
  actionType: z.enum(["promote_existing", "create_new"]),
  existingTaskId: z.string().optional()
});

export const agentPulseOutputSchema = z.object({
  briefing: z.string().min(1).max(300),
  actions: z.array(pulseActionSchema).min(1).max(3)
});

export type PulseAction = z.infer<typeof pulseActionSchema>;
export type AgentPulseOutput = z.infer<typeof agentPulseOutputSchema>;

export const AGENT_PULSE_SYSTEM_PROMPT = `你是运行在本地优先工作台里的个人战略执行顾问（Outcome Guardian）。
你的受众是一位高专注度的建造者/知识工作者。你的职责不是制造更多待办，而是**捍卫用户的注意力，帮助用户从“假忙碌”（Build Trap）中脱身，把精力聚焦在产生现实结果的高杠杆行动上**。

## 核心决策准则（Heuristics）
1. **成效优于产出（Outcome over Output）**：
   - 警惕只消耗精力却不产生外部反馈的琐事。
   - 优先推荐能够产生现实交付、外部验证或关键里程碑闭环的行动（例如：完成求职投递、交付论文核心章节、跑通关键代码闭环）。
2. **聚焦极少数（Vital Few）**：
   - 每天推荐严格限制在 1 至 3 项。少即是多。
   - 若用户当前同时推进的项目超过 3 个，在 briefing 中明确提示其注意多线作战风险。
3. **最小可执行粒度（Actionable Next Step）**：
   - 动作名称必须是精准的动宾结构（例如：“梳理论文第3章实验对比数据表”，而非宽泛的“写论文”）。
   - 单个行动耗时建议在 15–60 分钟内，降低启动阻力。
4. **疏通阻碍（Unblock & Activate）**：
   - 若重要活跃项目没有任何下一步任务，优先提议为该项目创建启动步骤。
   - 若存在阻塞（blocked）或严重逾期任务，优先评估其去留或拆解。
5. **证据驱动的理由（Evidence-based Rationale）**：
   - 简明解释为什么这项任务在今天最重要，它连接着哪个核心目标。

## 输出格式契约
严格只返回 JSON 对象，不要包含 Markdown 标记或额外解释，格式如下：
{
  "briefing": "一至两句精炼的全局研判与聚焦建议",
  "actions": [
    {
      "id": "临时唯一标识符",
      "title": "具体动作名称（动宾结构）",
      "project": "关联的项目名称",
      "projectId": "关联的项目ID（如适用）",
      "priority": "p0 或 p1 或 p2",
      "estimatedMinutes": 30,
      "rationale": "为什么是这项行动？推动了什么现实证据？",
      "actionType": "promote_existing（提升已有任务为今日重点）或 create_new（为项目创建新的下一步）",
      "existingTaskId": "如果是 promote_existing，必须提供已有任务实体ID"
    }
  ]
}`;

export interface PulseContextInput {
  today: string;
  projects: VaultEntity[];
  openTasks: VaultEntity[];
  archivedTasks: VaultEntity[];
  dailyRoutine?: RoutineRecord;
  yesterdayFirstStep?: string;
}

export function buildPulseContext(input: PulseContextInput) {
  const activeProjects = input.projects
    .filter((p) => ["active", "waiting"].includes(asString(p.properties.status)))
    .map((p) => {
      const allTasks = projectTasks(p, [...input.openTasks, ...input.archivedTasks]);
      const completed = allTasks.filter((t) => ["done", "cancelled"].includes(asString(t.properties.status))).length;
      return {
        id: p.id,
        name: p.name,
        status: asString(p.properties.status),
        target: asString(p.properties.target),
        progress: `${completed}/${allTasks.length}`,
        hasNoOpenTasks: !input.openTasks.some((t) => linkName(t.properties.project) === p.name),
        summary: asString(p.properties.summary) || p.body.slice(0, 160)
      };
    });

  const overdueTasks = input.openTasks
    .filter((t) => asString(t.properties.due) && asString(t.properties.due) < input.today)
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.name, project: linkName(t.properties.project), due: asString(t.properties.due) }));

  const currentCandidates = input.openTasks
    .slice(0, 15)
    .map((t) => ({
      id: t.id,
      name: t.name,
      project: linkName(t.properties.project),
      priority: asString(t.properties.priority) || "p2",
      due: asString(t.properties.due),
      scheduled: asString(t.properties.scheduled),
      status: asString(t.properties.status),
      focus: Boolean(t.properties.focus)
    }));

  return {
    today: input.today,
    yesterdayFirstStep: input.yesterdayFirstStep || undefined,
    dailyRoutineGoals: input.dailyRoutine ? {
      job: input.dailyRoutine.job,
      thesis: input.dailyRoutine.thesis,
      health: input.dailyRoutine.health
    } : undefined,
    activeProjects,
    overdueTasks,
    taskCandidates: currentCandidates
  };
}

/**
 * 本地智能启发式生成器（Deterministic Heuristic Fallback）
 * 当未配置外部 LLM Key 或离线时，100% 保证产出高质量、结构严格一致的建议。
 */
export function heuristicPulseGenerator(input: PulseContextInput): AgentPulseOutput {
  const actions: PulseAction[] = [];
  const activeProjects = input.projects.filter((p) => ["active", "waiting"].includes(asString(p.properties.status)));

  // 1. 优先检查昨日规划的“明天第一步”
  if (input.yesterdayFirstStep && input.yesterdayFirstStep.trim()) {
    const stepText = input.yesterdayFirstStep.trim();
    // 检查是否已有同名或匹配的任务
    const matched = input.openTasks.find((t) => t.name.includes(stepText) || stepText.includes(t.name));
    if (matched) {
      actions.push({
        id: `pulse-first-step-${matched.id}`,
        title: matched.name,
        project: linkName(matched.properties.project) || "日常",
        priority: "p0",
        estimatedMinutes: 30,
        rationale: "昨日复盘确定的第一步，保持启动势头，直接落地为今日首要任务。",
        actionType: "promote_existing",
        existingTaskId: matched.id
      });
    } else {
      const targetProject = activeProjects[0]?.name || "核心推进";
      actions.push({
        id: "pulse-first-step-new",
        title: stepText,
        project: targetProject,
        projectId: activeProjects[0]?.id,
        priority: "p0",
        estimatedMinutes: 30,
        rationale: "昨日复盘确定的首要启动步骤，优先创建并安排在上午执行。",
        actionType: "create_new"
      });
    }
  }

  // 2. 检查是否有活跃项目没有关联待办（阻塞 / 缺乏下一步）
  for (const project of activeProjects) {
    if (actions.length >= 3) break;
    const hasOpen = input.openTasks.some((t) => linkName(t.properties.project) === project.name);
    if (!hasOpen) {
      actions.push({
        id: `pulse-project-${project.id}`,
        title: `确定「${project.name}」的下一步行动`,
        project: project.name,
        projectId: project.id,
        priority: "p1",
        estimatedMinutes: 20,
        rationale: `进行中项目「${project.name}」目前没有开放待办，需明确可验证的下一步动作。`,
        actionType: "create_new"
      });
    }
  }

  // 3. 检查逾期任务或重点待办
  const overdue = input.openTasks.filter((t) => asString(t.properties.due) && asString(t.properties.due) < input.today);
  for (const task of overdue) {
    if (actions.length >= 3) break;
    if (actions.some((a) => a.existingTaskId === task.id)) continue;
    actions.push({
      id: `pulse-overdue-${task.id}`,
      title: task.name,
      project: linkName(task.properties.project) || "待办",
      priority: "p0",
      estimatedMinutes: 45,
      rationale: `该任务已逾期，避免负债堆积，建议安排为今日集中突破或重新评估。`,
      actionType: "promote_existing",
      existingTaskId: task.id
    });
  }

  // 4. 如果仍不足，从现有开放任务中按优先级挑选
  if (actions.length < 3) {
    const priorityWeight: Record<string, number> = { p0: 4, p1: 3, p2: 2, p3: 1 };
    const candidates = input.openTasks
      .filter((t) => !actions.some((a) => a.existingTaskId === t.id))
      .sort((a, b) => {
        const scoreA = (priorityWeight[asString(a.properties.priority)] || 0) + (a.properties.status === "doing" ? 5 : 0);
        const scoreB = (priorityWeight[asString(b.properties.priority)] || 0) + (b.properties.status === "doing" ? 5 : 0);
        return scoreB - scoreA;
      });

    for (const task of candidates) {
      if (actions.length >= 3) break;
      actions.push({
        id: `pulse-candidate-${task.id}`,
        title: task.name,
        project: linkName(task.properties.project) || "任务",
        priority: (asString(task.properties.priority) as PulseAction["priority"]) || "p1",
        estimatedMinutes: 30,
        rationale: "基于当前优先级推荐，作为今日推进关键结果的有效补充。",
        actionType: "promote_existing",
        existingTaskId: task.id
      });
    }
  }

  // 兜底方案（如果用户完全没有任务或项目）
  if (actions.length === 0) {
    actions.push({
      id: "pulse-default-kickoff",
      title: "梳理并创建本周最想达成的 1 个结果项目",
      project: "个人工作台",
      priority: "p0",
      estimatedMinutes: 20,
      rationale: "目前没有开放中的任务，先明确一个产生现实反馈的结果，再展开行动。",
      actionType: "create_new"
    });
  }

  let briefing = `今日共甄选 ${actions.length} 项高杠杆行动，专注于交付关键结果而非堆砌琐碎待办。`;
  if (activeProjects.length > 3) {
    briefing = `当前同时推进 ${activeProjects.length} 个项目，注意防范分散精力。建议聚焦于以下行动：`;
  } else if (overdue.length > 0) {
    briefing = `发现 ${overdue.length} 项任务逾期，今日优先清理关键阻碍并保持节奏。`;
  }

  return { briefing, actions: actions.slice(0, 3) };
}
