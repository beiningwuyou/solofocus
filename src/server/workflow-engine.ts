import { randomUUID } from "node:crypto";
import {
  asBoolean,
  asString,
  isOpenTask,
  todayIso,
  type EntityKind,
  type EntityProperties,
  type PatchOperation,
  type PatchPlan,
  type VaultEntity,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowRunActionInput,
  type WorkflowStepDefinition,
  resolveVariables
} from "../shared/domain.js";
import { RevisionConflictError, VaultRepository } from "./repository.js";
import { RunRevisionConflictError, WorkflowRuntimeStore } from "./workflow-runtime.js";
import { workflowFromEntity } from "./workflow-model.js";
import { z } from "zod";

const todayPlanOutputSchema = z.object({ summary: z.string().min(1), items: z.array(z.object({ entityId: z.string().min(1), reason: z.string().min(1) })).max(3) });
const inboxPlanOutputSchema = z.object({ summary: z.string().min(1), items: z.array(z.object({ entityId: z.string().min(1), targetKind: z.enum(["vision", "project", "task", "document", "resource"]), name: z.string().min(1).max(100), area: z.string().optional(), vision: z.string().optional(), project: z.string().optional(), summary: z.string().optional(), excluded: z.boolean().optional() })) });

type StepResult = { output: unknown; run?: WorkflowRun } | { waiting: true; run: WorkflowRun };

export class WorkflowEngine {
  private queue: string[] = [];
  private draining = false;

  constructor(
    private readonly repository: VaultRepository,
    public readonly runtime: WorkflowRuntimeStore,
  ) {}

  async start(workflowId: string, input: Record<string, unknown> = {}): Promise<WorkflowRun> {
    const entity = this.repository.get(workflowId);
    if (!entity || entity.kind !== "workflow") throw new Error("未找到工作流");
    const workflow = workflowFromEntity(entity);
    if (workflow.status !== "active") throw new Error("只有启用中的工作流可以运行");
    const now = new Date().toISOString();
    const run = await this.runtime.create({
      id: randomUUID(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowVersion: workflow.version,
      workflowRevision: workflow.revision,
      status: "queued",
      input,
      steps: structuredClone(workflow.steps),
      stepStates: workflow.steps.map((step) => ({
        id: step.id,
        title: step.title,
        type: step.type,
        status: "pending"
      })),
      currentStepIndex: 0,
      outputs: {},
      startedAt: now,
      updatedAt: now
    });
    this.enqueue(run.id);
    return run;
  }

  async action(runId: string, input: WorkflowRunActionInput): Promise<WorkflowRun> {
    let run = this.requireRun(runId);
    if (run.revision !== input.expectedRunRevision) throw new RunRevisionConflictError(run);
    if (["completed", "cancelled"].includes(run.status)) throw new Error("该运行已经结束");
    if (input.nextInstruction !== undefined) run.nextInstruction = input.nextInstruction.trim() || undefined;

    switch (input.action) {
      case "edit_result": {
        if (run.status !== "waiting_approval") throw new Error("只有等待确认时可以修改结果");
        run.editedOutput = input.editedOutput;
        run.patchPlan = undefined;
        run = await this.runtime.save(run, input.expectedRunRevision);
        await this.runtime.log(run.id, "result_edited", { stepId: input.stepId });
        return run;
      }
      case "approve": {
        if (run.status !== "waiting_approval") throw new Error("当前运行不在等待确认");
        const approvalStep = run.steps[run.currentStepIndex];
        if (!approvalStep || approvalStep.type !== "approval") throw new Error("当前步骤不是人工确认");
        run.patchPlan = run.editedOutput !== undefined || !run.patchPlan
          ? this.buildPatchPlan(run, approvalStep)
          : run.patchPlan;
        run.outputs.__approved = true;
        run.stepStates[run.currentStepIndex] = {
          ...run.stepStates[run.currentStepIndex],
          status: "completed",
          completedAt: new Date().toISOString()
        };
        run.currentStepIndex += 1;
        run.status = "queued";
        run.reason = undefined;
        run = await this.runtime.save(run, input.expectedRunRevision);
        await this.runtime.log(run.id, "approval_granted", { operations: run.patchPlan?.operations.length ?? 0 });
        this.enqueue(run.id);
        return run;
      }
      case "pause": {
        if (!["queued", "running"].includes(run.status)) throw new Error("当前运行不能暂停");
        run.status = "paused";
        run.reason = "user_paused";
        run = await this.runtime.save(run, input.expectedRunRevision);
        await this.runtime.log(run.id, "run_paused");
        return run;
      }
      case "resume": {
        if (run.status !== "paused") throw new Error("只有暂停的运行可以继续");
        run.status = "queued";
        run.reason = undefined;
        run.error = undefined;
        run = await this.runtime.save(run, input.expectedRunRevision);
        await this.runtime.log(run.id, "run_resumed");
        this.enqueue(run.id);
        return run;
      }
      case "retry_step": {
        if (!input.stepId) throw new Error("请选择要重试的步骤");
        if (!['failed', 'paused'].includes(run.status)) throw new Error("只有失败或暂停的运行可以重试");
        const index = run.steps.findIndex((step) => step.id === input.stepId);
        if (index < 0) throw new Error("未找到步骤");
        run.currentStepIndex = index;
        run.stepStates = run.stepStates.map((state, stateIndex) => stateIndex < index
          ? state
          : { id: state.id, title: state.title, type: state.type, status: "pending" });
        run.status = "queued";
        run.reason = undefined;
        run.error = undefined;
        run.endedAt = undefined;
        run = await this.runtime.save(run, input.expectedRunRevision);
        await this.runtime.log(run.id, "step_retry", { stepId: input.stepId });
        this.enqueue(run.id);
        return run;
      }
      case "cancel": {
        if (["completed", "failed", "cancelled"].includes(run.status)) throw new Error("该运行已经结束");
        run.status = "cancelled";
        run.reason = "user_cancelled";
        run.endedAt = new Date().toISOString();
        run = await this.runtime.save(run, input.expectedRunRevision);
        await this.runtime.log(run.id, "run_cancelled");
        return this.createTerminalSummary(run);
      }
    }
  }

  private enqueue(runId: string): void {
    if (!this.queue.includes(runId)) this.queue.push(runId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const runId = this.queue.shift();
        if (runId) await this.processRun(runId);
      }
    } finally {
      this.draining = false;
      if (this.queue.length) void this.drain();
    }
  }

  private async processRun(runId: string): Promise<void> {
    let run = this.requireRun(runId);
    if (run.status !== "queued") return;
    while (run.currentStepIndex < run.steps.length) {
      run = this.requireRun(runId);
      if (!['queued', 'running'].includes(run.status)) return;
      const index = run.currentStepIndex;
      const step = run.steps[index];
      run.status = "running";
      run.stepStates[index] = {
        ...run.stepStates[index],
        status: "running",
        startedAt: run.stepStates[index]?.startedAt ?? new Date().toISOString(),
        error: undefined
      };
      try {
        run = await this.runtime.save(run, run.revision);
        await this.runtime.log(run.id, "step_started", { stepId: step.id, type: step.type });
        const result = await this.executeStep(run, step);
        if ("waiting" in result) return;
        run = result.run ?? this.requireRun(run.id);
        run.outputs[step.id] = result.output;
        run.outputs.__last = result.output;
        run.stepStates[index] = {
          ...run.stepStates[index],
          status: "completed",
          completedAt: new Date().toISOString()
        };
        run.currentStepIndex = index + 1;
        run.status = "queued";
        run = await this.runtime.save(run, run.revision);
        await this.runtime.log(run.id, "step_completed", { stepId: step.id });
      } catch (error) {
        if (error instanceof RunRevisionConflictError) return;
        run = this.requireRun(runId);
        if (run.status === "paused" || run.status === "cancelled") return;
        run.status = "failed";
        run.reason = error instanceof RevisionConflictError ? "revision_conflict" : "step_failed";
        run.error = error instanceof Error ? error.message : "步骤执行失败";
        run.endedAt = new Date().toISOString();
        run.stepStates[index] = { ...run.stepStates[index], status: "failed", error: run.error };
        run = await this.runtime.save(run, run.revision);
        await this.runtime.log(run.id, "step_failed", { stepId: step.id, reason: run.reason, error: run.error });
        await this.createTerminalSummary(run);
        return;
      }
    }
    run = this.requireRun(runId);
    run.status = "completed";
    run.endedAt = new Date().toISOString();
    run = await this.runtime.save(run, run.revision);
    await this.runtime.log(run.id, "run_completed");
    await this.createTerminalSummary(run);
  }

  private async executeStep(run: WorkflowRun, step: WorkflowStepDefinition): Promise<StepResult> {
    const config = resolveVariables(step.config, run) as Record<string, unknown>;
    switch (step.type) {
      case "vault_query":
        return { output: this.queryVault(String(config.action ?? "")) };
      case "rule":
        return { output: this.applyRule(String(config.action ?? ""), run.outputs.__last) };
      case "approval": {
        run.proposedOutput = run.outputs.__last;
        run.patchPlan = this.buildPatchPlan(run, step);
        run.status = "waiting_approval";
        run.stepStates[run.currentStepIndex] = {
          ...run.stepStates[run.currentStepIndex],
          status: "waiting_approval"
        };
        run = await this.runtime.save(run, run.revision);
        await this.runtime.log(run.id, "approval_requested", { operations: run.patchPlan?.operations.length ?? 0 });
        return { waiting: true, run };
      }
      case "vault_write": {
        if (run.outputs.__approved !== true || !run.patchPlan) throw new Error("写入前必须再次人工确认");
        const appliedRun = await this.applyPatchPlan(run);
        return {
          run: appliedRun,
          output: {
            applied: appliedRun.patchPlan?.operations.filter((operation) => operation.applied).length ?? 0,
            total: appliedRun.patchPlan?.operations.length ?? 0
          }
        };
      }
    }
  }

  private queryVault(action: string): unknown {
    if (action === "today_candidates") {
      return this.repository.list("task").filter(isOpenTask).map((entity) => ({
        entityId: entity.id,
        name: entity.name,
        status: asString(entity.properties.status),
        priority: asString(entity.properties.priority),
        due: asString(entity.properties.due),
        scheduled: asString(entity.properties.scheduled),
        area: asString(entity.properties.area),
        project: asString(entity.properties.project),
        plan: asString(entity.properties.plan),
        focus: asBoolean(entity.properties.focus),
        revision: entity.revision
      }));
    }
    if (action === "inbox_unprocessed") {
      return this.repository.list("inbox")
        .filter((entity) => asString(entity.properties.status) !== "processed")
        .map((entity) => ({
          entityId: entity.id,
          name: entity.name,
          summary: asString(entity.properties.summary) || entity.body.slice(0, 1200),
          revision: entity.revision
        }));
    }
    throw new Error(`不支持的 Vault 查询：${action}`);
  }

  private applyRule(action: string, input: unknown): unknown {
    if (action !== "rank_today_candidates" && action !== "keep_inbox") throw new Error(`不支持的规则：${action}`);
    const items = Array.isArray(input) ? [...input] as Record<string, unknown>[] : [];
    if (action === "keep_inbox") return { summary: "保留收集项，等待人工整理", items: items.map((item) => ({ entityId: String(item.entityId ?? ""), targetKind: "task", name: String(item.name ?? ""), summary: "待人工整理" })) };
    const today = todayIso();
    const priority = { p0: 4, p1: 3, p2: 2, p3: 1 } as Record<string, number>;
    const ranked = items.sort((left, right) => {
      const score = (item: Record<string, unknown>) => {
        const due = String(item.due ?? "");
        return (item.focus ? 100 : 0)
          + (due && due < today ? 80 : 0)
          + (due === today ? 60 : 0)
          + (item.scheduled === today ? 40 : 0)
          + (priority[String(item.priority ?? "")] ?? 0) * 5;
      };
      return score(right) - score(left);
    }).slice(0, 12);
    return { summary: "按紧急性和优先级排序", items: ranked.map((item) => ({ entityId: String(item.entityId ?? ""), reason: "按规则排序" })) };
  }

  private buildPatchPlan(run: WorkflowRun, step: WorkflowStepDefinition): PatchPlan {
    const config = resolveVariables(step.config, run) as Record<string, unknown>;
    const plan = String(config.plan ?? "");
    const output = run.editedOutput ?? run.proposedOutput ?? run.outputs.__last;
    if (plan === "replace_today_focus") return this.todayPatchPlan(run, output);
    if (plan === "organize_inbox") return this.inboxPatchPlan(run, output);
    throw new Error(`不支持的写入计划：${plan}`);
  }

  private todayPatchPlan(run: WorkflowRun, output: unknown): PatchPlan {
    const parsed = todayPlanOutputSchema.parse(output);
    const selected = new Set(parsed.items.map((item) => item.entityId));
    if (selected.size === 0) for (const task of this.repository.list("task").filter(isOpenTask)) selected.add(task.id);
    const operations: PatchOperation[] = [];
    for (const task of this.repository.list("task").filter(isOpenTask)) {
      const shouldFocus = selected.has(task.id);
      if (!shouldFocus && !asBoolean(task.properties.focus)) continue;
      if (shouldFocus || asBoolean(task.properties.focus)) {
        operations.push({
          id: randomUUID(),
          type: "patch",
          label: shouldFocus ? `设为今日重点：${task.name}` : `移出今日重点：${task.name}`,
          entityId: task.id,
          entityKind: "task",
          expectedRevision: task.revision,
          properties: shouldFocus ? { focus: true, scheduled: todayIso() } : { focus: false }
        });
      }
    }
    return { summary: parsed.summary, operations };
  }

  private inboxPatchPlan(run: WorkflowRun, output: unknown): PatchPlan {
    const parsed = inboxPlanOutputSchema.parse(output);
    const operations: PatchOperation[] = [];
    for (const item of parsed.items.filter((candidate) => !candidate.excluded)) {
      const inbox = this.repository.get(item.entityId);
      if (!inbox || inbox.kind !== "inbox") throw new Error(`收集项已不存在：${item.entityId}`);
      const createId = randomUUID();
      const properties: EntityProperties = {
        summary: item.summary,
        area: item.area ? asWikiLink(item.area) : undefined,
        vision: item.vision ? asWikiLink(item.vision) : undefined,
        project: item.project ? asWikiLink(item.project) : undefined,
        automation_operation: createId,
        automation_run: run.id
      };
      operations.push({
        id: createId,
        type: "create",
        label: `创建${kindName(item.targetKind)}：${item.name}`,
        entityKind: item.targetKind,
        name: item.name,
        properties,
        body: inbox.body
      });
      operations.push({
        id: randomUUID(),
        type: "patch",
        label: `标记已处理：${inbox.name}`,
        entityId: inbox.id,
        entityKind: "inbox",
        expectedRevision: inbox.revision,
        properties: { status: "processed", automation_run: run.id, converted_to: `[[${item.name}]]` }
      });
    }
    return { summary: parsed.summary, operations };
  }

  private async applyPatchPlan(initialRun: WorkflowRun): Promise<WorkflowRun> {
    let run = initialRun;
    const pending = run.patchPlan?.operations.filter((operation) => !operation.applied) ?? [];
    for (const operation of pending.filter((candidate) => candidate.type === "patch")) {
      const current = operation.entityId ? this.repository.get(operation.entityId) : undefined;
      if (!current || current.kind !== operation.entityKind) throw new Error(`写入目标已不存在：${operation.label}`);
      if (current.revision !== operation.expectedRevision) throw new RevisionConflictError(current);
    }
    for (const pendingOperation of pending) {
      const operation = run.patchPlan?.operations.find((candidate) => candidate.id === pendingOperation.id);
      if (!operation) throw new Error("写入计划已发生变化");
      try {
        if (operation.type === "create") {
          const existing = this.repository.list(operation.entityKind)
            .find((entity) => entity.properties.automation_operation === operation.id);
          if (!existing) {
            await this.repository.create(operation.entityKind, {
              name: operation.name ?? operation.label,
              properties: operation.properties,
              body: operation.body
            });
          }
        } else {
          const current = operation.entityId ? this.repository.get(operation.entityId) : undefined;
          if (!current) throw new Error("写入目标已不存在");
          await this.repository.update(current.id, {
            expectedRevision: current.revision,
            properties: operation.properties,
            body: operation.body
          });
        }
        operation.applied = true;
        operation.error = undefined;
        run = await this.runtime.save(run, run.revision);
        await this.runtime.log(run.id, "patch_applied", { operationId: operation.id, type: operation.type });
      } catch (error) {
        const latestOperation = run.patchPlan?.operations.find((candidate) => candidate.id === pendingOperation.id);
        if (latestOperation) latestOperation.error = error instanceof Error ? error.message : "写入失败";
        run = await this.runtime.save(run, run.revision);
        throw error;
      }
    }
    return run;
  }

  private frozenWorkflow(run: WorkflowRun): WorkflowDefinition {
    return {
      id: run.workflowId,
      name: run.workflowName,
      path: "",
      revision: run.workflowRevision,
      status: "active",
      trigger: "manual",
      version: run.workflowVersion,
      approval: "before_write",
      body: "",
      steps: run.steps
    };
  }

  private async createTerminalSummary(run: WorkflowRun): Promise<WorkflowRun> {
    if (run.summaryEntityId) return run;
    const applied = run.patchPlan?.operations.filter((operation) => operation.applied).length ?? 0;
    const total = run.patchPlan?.operations.length ?? 0;
    const entity = await this.repository.create("workflow_run", {
      name: `${run.workflowName} · ${localRunTimestamp(run.startedAt)}`,
      properties: {
        status: run.status,
        workflow_id: run.workflowId,
        workflow: `[[${run.workflowName}]]`,
        workflow_version: run.workflowVersion,
        run_id: run.id,
        started_at: run.startedAt,
        ended_at: run.endedAt,
        reason: run.reason,
        applied_operations: applied,
        total_operations: total,
        summary: run.patchPlan?.summary || run.error || `${run.workflowName} ${run.status}`
      },
      body: `# ${run.workflowName} 运行摘要\n\n- 状态：${run.status}\n- 版本：v${run.workflowVersion}\n- 已应用：${applied}/${total}\n${run.error ? `- 错误：${run.error}\n` : ""}`
    });
    const latest = this.requireRun(run.id);
    latest.summaryEntityId = entity.id;
    return this.runtime.save(latest, latest.revision);
  }

  private requireRun(id: string): WorkflowRun {
    const run = this.runtime.get(id);
    if (!run) throw new Error("未找到运行");
    return run;
  }
}

function asWikiLink(value: string): string {
  return value.startsWith("[[") ? value : `[[${value}]]`;
}

function kindName(kind: EntityKind): string {
  const labels: Partial<Record<EntityKind, string>> = {
    vision: "愿景",
    goal: "目标",
    project: "项目",
    plan: "计划",
    task: "任务",
    document: "文档",
    resource: "资料"
  };
  return labels[kind] ?? kind;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function localRunTimestamp(value: string): string {
  const date = new Date(value);
  const localDate = todayIso(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${localDate} ${hours} ${minutes}`;
}
