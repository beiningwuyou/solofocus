import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AGENT_PRESETS, ENTITY_KINDS, parseScheduleExpression, todayIso, type AgentActivity, type AgentEmployee, type EntityKind, type EntityProperties, type WorkflowRun, type WorkflowRunActionInput } from "../shared/domain.js";
import { RevisionConflictError, StatusTransitionError, VaultRepository } from "./repository.js";
import { WorkflowEngine } from "./workflow-engine.js";
import { AgentEmployeeScheduler } from "./agent-scheduler.js";
import { RunRevisionConflictError, WorkflowRuntimeStore } from "./workflow-runtime.js";
import { workflowEditSchema, workflowFromEntity, workflowProperties, workflowStepSchema } from "./workflow-model.js";
import { routineDateSchema, routineSchema } from "../shared/daily-routine.js";
import { AgentPulseService } from "./agent-pulse-service.js";
import { pulseActionSchema } from "./agent-pulse-prompt.js";
import { resolveAiConfig, saveAiConfig, type AiConfigData } from "./ai-config.js";
import { soloFocusRoutes } from "./solofocus/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vaultPath = process.env.WORKBENCH_VAULT_PATH ?? path.join(os.homedir(), "Library", "Application Support", "个人工作台", "vault");
const staticPath = process.env.WORKBENCH_STATIC_PATH ?? path.resolve(__dirname, "../../dist");
const port = Number(process.env.WORKBENCH_PORT ?? 4317);
const host = "127.0.0.1";

const repository = new VaultRepository(vaultPath);
await repository.initialize();
for (const entity of repository.list("workflow")) {
  const workflow = workflowFromEntity(entity);
  const hasSnapshot = repository.list("workflow_version").some((version) =>
    version.properties.workflow_id === workflow.id && Number(version.properties.version) === workflow.version
  );
  if (!hasSnapshot) await createWorkflowVersion(workflow);
}
const runtime = new WorkflowRuntimeStore();
await runtime.initialize();
const workflowEngine = new WorkflowEngine(repository, runtime);

// 智能体员工调度器：复用 workflowEngine 执行，agent_activity 写入 Vault。
const agentScheduler = new AgentEmployeeScheduler({
  repository,
  runEmployee: async (employee, trigger) => {
    if (!employee.workflowId) throw new Error("员工尚未绑定工作流");
    const projectIds = employee.scope?.projectIds ?? [];
    const run = await workflowEngine.start(employee.workflowId, {
      triggered_by: `agent:${employee.id}`,
      trigger_kind: trigger,
      employee_name: employee.name,
      scope_project_ids: projectIds,
      scope_project_names: resolveProjectNames(projectIds)
    });
    const reflection = await reflectOnRun(run.id);
    const verb = trigger === "manual" ? "手动执行" : "按排班自动执行";
    return {
      runId: run.id,
      summary: `${employee.name} ${verb}了「${run.workflowName}」，${reflection.summary}`,
      tone: reflection.tone
    };
  }
});
agentScheduler.start();

const agentPulseService = new AgentPulseService(
  repository,
  vaultPath,
  async (summary, tone) => {
    await agentScheduler.appendActivity({
      employeeId: "focus_butler",
      summary,
      tone: tone ?? "info",
      createdAt: new Date().toISOString()
    });
  }
);

/** 把 project id 解析为展示名，注入员工触发的 workflow input，供 {{inputs.scope_project_names}} 引用 */
function resolveProjectNames(ids: string[]): string[] {
  if (ids.length === 0) return [];
  const projects = repository.list("project");
  const byId = new Map(projects.map((p) => [p.id, String((p.properties as Record<string, unknown>)?.name ?? p.name ?? "")]));
  return ids.map((id) => byId.get(id) ?? id);
}

/**
 * 智能体自省：等运行进入稳定态（终态或等待人工），根据其真实结果推导「情绪」与「小结」。
 * 不做额外 LLM 调用——只读取运行的实际产出（已应用改动数、状态、原因），
 * 让近况面板反映真实信号而非千篇一律的「已执行」。轮询有上限，避免阻塞调度。
 */
async function reflectOnRun(runId: string): Promise<{ summary: string; tone: AgentActivity["tone"] }> {
  const settle = new Set(["completed", "failed", "cancelled", "waiting_approval", "paused"]);
  const deadline = Date.now() + 5000;
  let run: WorkflowRun | undefined = runtime.get(runId);
  while (run && !settle.has(run.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    run = runtime.get(runId);
  }
  if (!run) return { summary: "运行记录已丢失，无法自省", tone: "warning" };

  const ops = run.patchPlan?.operations ?? [];
  const applied = ops.filter((op) => op.applied).length;
  const total = ops.length;

  if (run.status === "waiting_approval") {
    return { summary: `产出 ${total} 项待确认改动，正等待你审批`, tone: "info" };
  }
  if (run.status === "paused") {
    const why = run.reason === "model_not_configured" ? "AI 模型未配置" : (run.reason ?? "未知原因");
    return { summary: `执行暂停：${why}`, tone: "warning" };
  }
  if (run.status === "failed") {
    return { summary: `执行失败：${run.error ?? run.reason ?? "未知错误"}`, tone: "warning" };
  }
  if (run.status === "cancelled") {
    return { summary: "本次运行已取消", tone: "neutral" };
  }
  if (run.status === "completed") {
    if (total > 0 && applied === total) {
      const detail = run.patchPlan?.summary ? `（${run.patchPlan.summary}）` : "";
      return { summary: `已应用 ${applied}/${total} 项改动${detail}`, tone: "success" };
    }
    if (total > 0) {
      return { summary: `仅 ${applied}/${total} 项改动成功应用，其余未生效`, tone: "warning" };
    }
    return { summary: "运行完成，没有需要落盘的改动", tone: "neutral" };
  }
  return { summary: "已启动，正在后台执行", tone: "neutral" };
}

const app = Fastify({ logger: { level: process.env.NODE_ENV === "production" ? "info" : "warn" } });

await app.register(import("@fastify/cors"), {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.removeContentTypeParser("application/json");
app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  if (!body || (typeof body === "string" && !body.trim())) {
    done(null, {});
    return;
  }
  try {
    const parsed = JSON.parse(body as string);
    done(null, parsed);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

app.get("/api/health", async () => ({ ok: true, vaultPath, now: new Date().toISOString() }));

app.get("/api/bootstrap", async () => ({
  ...(await repository.bootstrap()),
  workflowAttention: runtime.attention()
}));

app.get("/api/workflows", async () => repository.list("workflow").map(workflowFromEntity));

app.put("/api/daily-routine/:date", async (request, reply) => {
  const date = routineDateSchema.safeParse((request.params as { date: string }).date);
  const body = z.object({ record: routineSchema, expectedRevision: z.string().min(1).nullable() }).safeParse(request.body);
  if (!date.success || !body.success) return reply.code(400).send({ error: "日期或日常记录格式无效" });
  try {
    return await repository.saveDailyRoutine(date.data, body.data.record, body.data.expectedRevision);
  } catch (error) {
    if (error instanceof RevisionConflictError) return reply.code(409).send({ error: "当天笔记已变更。草稿仍保留，请复制需要保留的内容，再重新载入记录。" });
    throw error;
  }
});

app.post("/api/workflows", async (request, reply) => {
  const body = z.object({
    name: z.string().trim().min(1).max(100),
    status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
    summary: z.string().max(1_000).optional(),
    body: z.string().optional(),
    steps: z.array(workflowStepSchema).min(1).max(24)
  }).parse(request.body);
  const entity = await repository.create("workflow", {
    name: body.name,
    properties: {
      status: body.status,
      trigger: "manual",
      version: 1,
      approval: "before_write",
      summary: body.summary,
      steps: body.steps
    },
    body: body.body ?? `# ${body.name}\n`
  });
  const definition = workflowFromEntity(entity);
  await createWorkflowVersion(definition);
  return reply.code(201).send(definition);
});

app.get("/api/workflows/:id", async (request, reply) => {
  const entity = repository.get((request.params as { id: string }).id);
  if (!entity || entity.kind !== "workflow") return reply.code(404).send({ error: "未找到工作流" });
  return workflowFromEntity(entity);
});

app.patch("/api/workflows/:id", async (request, reply) => {
  const entity = repository.get((request.params as { id: string }).id);
  if (!entity || entity.kind !== "workflow") return reply.code(404).send({ error: "未找到工作流" });
  const body = workflowEditSchema.parse(request.body);
  const current = workflowFromEntity(entity);
  const updated = await repository.update(entity.id, {
    expectedRevision: body.expectedRevision,
    properties: workflowProperties({
      ...current,
      status: body.status,
      area: body.area,
      goal: body.goal,
      project: body.project,
      plan: body.plan,
      summary: body.summary,
      steps: body.steps
    }),
    body: body.body
  });
  return workflowFromEntity(updated);
});

app.post("/api/workflows/:id/versions", async (request, reply) => {
  const entity = repository.get((request.params as { id: string }).id);
  if (!entity || entity.kind !== "workflow") return reply.code(404).send({ error: "未找到工作流" });
  const body = workflowEditSchema.parse(request.body);
  const current = workflowFromEntity(entity);
  const version = current.version + 1;
  const updatedEntity = await repository.update(entity.id, {
    expectedRevision: body.expectedRevision,
    properties: workflowProperties({
      ...current,
      status: body.status,
      version,
      area: body.area,
      goal: body.goal,
      project: body.project,
      plan: body.plan,
      summary: body.summary,
      steps: body.steps
    }),
    body: body.body
  });
  const definition = workflowFromEntity(updatedEntity);
  const snapshot = await createWorkflowVersion(definition);
  return reply.code(201).send({ workflow: definition, version: snapshot });
});

app.post("/api/workflows/:id/runs", async (request, reply) => {
  const body = z.object({ input: z.record(z.string(), z.unknown()).default({}) }).parse(request.body ?? {});
  const run = await workflowEngine.start((request.params as { id: string }).id, body.input);
  return reply.code(202).send(run);
});

app.get("/api/workflow-runs", async (request) => {
  const query = z.object({ status: z.string().optional(), workflowId: z.string().optional() }).parse(request.query);
  return runtime.list().filter((run) =>
    (!query.status || run.status === query.status) && (!query.workflowId || run.workflowId === query.workflowId)
  );
});

app.get("/api/workflow-runs/:id", async (request, reply) => {
  const run = runtime.get((request.params as { id: string }).id);
  if (!run) return reply.code(404).send({ error: "未找到运行" });
  return run;
});

app.post("/api/workflow-runs/:id/actions", async (request) => {
  const body = z.object({
    action: z.enum(["approve", "edit_result", "pause", "resume", "retry_step", "cancel"]),
    expectedRunRevision: z.string().min(1),
    stepId: z.string().optional(),
    editedOutput: z.unknown().optional(),
    nextInstruction: z.string().max(4_000).optional()
  }).parse(request.body) as WorkflowRunActionInput;
  return workflowEngine.action((request.params as { id: string }).id, body);
});

app.post("/api/workflow-cache/cleanup", async (request) => {
  const body = z.object({ retentionDays: z.number().int().min(1).max(365).default(30) }).parse(request.body ?? {});
  return runtime.cleanup(body.retentionDays);
});

app.get("/api/entities/:kind", async (request, reply) => {
  const kind = parseKind((request.params as { kind: string }).kind);
  if (!kind) return reply.code(400).send({ error: "不支持的实体类型" });
  return repository.list(kind);
});

app.get("/api/entities/:kind/:id", async (request, reply) => {
  const { kind: rawKind, id } = request.params as { kind: string; id: string };
  const kind = parseKind(rawKind);
  const entity = repository.get(id);
  if (!kind || !entity || entity.kind !== kind) return reply.code(404).send({ error: "未找到内容" });
  return entity;
});

app.post("/api/entities/:kind", async (request, reply) => {
  const kind = parseKind((request.params as { kind: string }).kind);
  if (!kind) return reply.code(400).send({ error: "不支持的实体类型" });
  const body = z.object({
    name: z.string().trim().min(1).max(100),
    properties: z.record(z.string(), z.unknown()).optional(),
    body: z.string().optional()
  }).parse(request.body);
  const entity = await repository.create(kind, { ...body, properties: body.properties as EntityProperties | undefined });
  return reply.code(201).send(entity);
});

app.patch("/api/entities/:kind/:id", async (request, reply) => {
  const { kind: rawKind, id } = request.params as { kind: string; id: string };
  const kind = parseKind(rawKind);
  if (!kind) return reply.code(400).send({ error: "不支持的实体类型" });
  const current = repository.get(id);
  if (!current || current.kind !== kind) return reply.code(404).send({ error: "未找到内容" });
  const body = z.object({
    expectedRevision: z.string().min(1),
    name: z.string().trim().min(1).max(100).optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    body: z.string().optional(),
    merge: z.boolean().optional(),
    allowStatusOverride: z.boolean().optional(),
    actor: z.string().max(40).optional(),
    statusNote: z.string().max(200).optional()
  }).parse(request.body);
  return repository.update(id, { ...body, properties: body.properties as EntityProperties | undefined });
});

app.post("/api/entities/:kind/:id/archive", async (request, reply) => {
  const { kind: rawKind, id } = request.params as { kind: string; id: string };
  const kind = parseKind(rawKind);
  if (!kind) return reply.code(400).send({ error: "不支持的实体类型" });
  const current = repository.get(id);
  if (!current || current.kind !== kind) return reply.code(404).send({ error: "未找到内容" });
  const body = z.object({ expectedRevision: z.string().min(1) }).parse(request.body);
  return repository.archive(id, body.expectedRevision);
});

app.post("/api/archive/tasks/:id/restore", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = z.object({ expectedRevision: z.string().min(1) }).parse(request.body);
  return repository.restoreArchivedTask(id, body.expectedRevision);
});

app.post("/api/archive/projects/:id/restore", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = z.object({ expectedRevision: z.string().min(1) }).parse(request.body);
  return repository.restoreArchivedProject(id, body.expectedRevision);
});

app.post("/api/entities/:kind/:id/trash", async (request, reply) => {
  const { kind: rawKind, id } = request.params as { kind: string; id: string };
  const kind = parseKind(rawKind);
  if (!kind) return reply.code(400).send({ error: "不支持的实体类型" });
  const current = repository.get(id);
  if (!current || current.kind !== kind) return reply.code(404).send({ error: "未找到内容" });
  const body = z.object({ expectedRevision: z.string().min(1) }).parse(request.body);
  return repository.trash(id, body.expectedRevision);
});

app.get("/api/documents", async (request) => {
  const query = request.query as { mode?: string };
  const documents = [...repository.list("document"), ...repository.list("resource")];
  if (query.mode === "pinned") return documents.filter((entity) => entity.properties.pinned === true);
  if (query.mode === "favorite") return documents.filter((entity) => entity.properties.favorite === true);
  return documents;
});

app.get("/api/search", async (request) => {
  const query = z.object({ q: z.string().default("") }).parse(request.query);
  return { query: query.q, results: repository.search(query.q) };
});

app.get("/api/events", async (request, reply) => {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  reply.raw.write(`event: ready\ndata: ${JSON.stringify({ now: new Date().toISOString() })}\n\n`);
  const unsubscribe = repository.subscribe((event) => {
    reply.raw.write(`event: vault-change\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const unsubscribeRuntime = runtime.subscribe((event) => {
    reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.run)}\n\n`);
  });
  const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 20_000);
  request.raw.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    unsubscribeRuntime();
  });
});

app.post("/api/habits/:id/check-in", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(todayIso()) }).parse(request.body ?? {});
  const daily = await repository.checkInHabit(id, body.date);
  return reply.send(daily);
});

app.post("/api/inbox/:id/convert", async (request, reply) => {
  const { id } = request.params as { id: string };
  const inbox = repository.get(id);
  if (!inbox || inbox.kind !== "inbox") return reply.code(404).send({ error: "未找到收集项" });
  const body = z.object({
    kind: z.enum(["vision", "project", "task", "document", "resource"]),
    name: z.string().trim().min(1).max(100).optional(),
    properties: z.record(z.string(), z.unknown()).optional()
  }).parse(request.body);
  const created = await repository.create(body.kind, {
    name: body.name ?? inbox.name,
    properties: body.properties as EntityProperties | undefined,
    body: inbox.body
  });
  const processed = await repository.update(inbox.id, {
    expectedRevision: inbox.revision,
    properties: { status: "processed", converted_to: `[[${created.name}]]` }
  });
  return reply.send({ created, processed });
});

app.post("/api/open", async (request, reply) => {
  const body = z.object({ path: z.string().min(1) }).parse(request.body);
  const entityPath = body.path.replace(/\.md$/i, "");
  // 只编码每个路径段、保留 / 分隔符：encodeURIComponent 会把 / 变成 %2F，
  // 而 Obsidian 的 obsidian://open?file= 无法解析被编码的斜杠，导致"找不到源文件"。
  const file = entityPath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const url = `obsidian://open?vault=${encodeURIComponent(path.basename(vaultPath))}&file=${file}`;
  const child = spawn("/usr/bin/open", [url], { detached: true, stdio: "ignore" });
  child.unref();
  return reply.send({ ok: true, url });
});

function parseKind(raw: string): EntityKind | undefined {
  return ENTITY_KINDS.includes(raw as EntityKind) ? raw as EntityKind : undefined;
}

async function createWorkflowVersion(definition: ReturnType<typeof workflowFromEntity>) {
  return repository.create("workflow_version", {
    name: `${definition.name} v${definition.version}`,
    properties: {
      status: "frozen",
      workflow: `[[${definition.name}]]`,
      workflow_id: definition.id,
      version: definition.version,
      source_revision: definition.revision,
      trigger: definition.trigger,
      approval: definition.approval,
      steps: definition.steps,
      summary: definition.summary,
      snapshot_id: randomUUID()
    },
    body: definition.body
  });
}

/* ============================================================================
 * 智能体员工 API
 * ========================================================================== */

const agentShiftQuerySchema = z.object({ on: z.enum(["true", "false"]) });
const agentHireSchema = z.object({
  preset: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  avatar: z.string().trim().max(8).default("🛠️"),
  group: z.string().trim().max(20).default("默认"),
  description: z.string().max(280).default(""),
  schedule: z.string().trim().min(1).max(60),
  scheduleLabel: z.string().max(40).optional(),
  pacing: z.enum(["auto", "hourly", "global"]).default("global"),
  workflowId: z.string().trim().optional(),
  scope: z.object({ projectIds: z.array(z.string()).optional() }).optional(),
  handsOffTo: z.array(z.string()).optional()
});
const agentPatchSchema = z.object({
  revision: z.string().min(1),
  name: z.string().trim().min(1).max(60).optional(),
  status: z.enum(["on", "off"]).optional(),
  pacing: z.enum(["auto", "hourly", "global"]).optional(),
  workflowId: z.string().trim().optional(),
  schedule: z.string().trim().optional(),
  scheduleLabel: z.string().trim().optional(),
  description: z.string().max(280).optional(),
  group: z.string().trim().max(20).optional(),
  scope: z.object({ projectIds: z.array(z.string()).optional() }).optional(),
  handsOffTo: z.array(z.string()).optional()
});

app.get("/api/agents", async () => agentScheduler.rosterSummary());

app.get("/api/agents/presets", async () => AGENT_PRESETS);

app.post("/api/agents/shift", async (request, reply) => {
  const parsed = agentShiftQuerySchema.safeParse(request.body ?? {});
  if (!parsed.success) return reply.code(400).send({ message: "参数错误", issues: parsed.error.issues });
  agentScheduler.setShift(parsed.data.on === "true");
  return { shiftOn: agentScheduler.isShiftOn() };
});

app.post("/api/agents/:id/run", async (request, reply) => {
  const { id } = request.params as { id: string };
  const employees = agentScheduler.rosterSummary().hired;
  const employee = employees.find((emp) => emp.id === id);
  if (!employee) return reply.code(404).send({ message: "未找到该员工" });
  if (!employee.workflowId) return reply.code(409).send({ message: "员工尚未绑定工作流" });
  try {
    const projectIds = employee.scope?.projectIds ?? [];
    const run = await workflowEngine.start(employee.workflowId, {
      triggered_by: `agent:${employee.id}`,
      trigger_kind: "manual",
      employee_name: employee.name,
      scope_project_ids: projectIds,
      scope_project_names: resolveProjectNames(projectIds)
    });
    const reflection = await reflectOnRun(run.id);
    await agentScheduler.appendActivity({
      employeeId: employee.id,
      runId: run.id,
      summary: `${employee.name} 手动执行「${run.workflowName}」，${reflection.summary}`,
      tone: reflection.tone,
      createdAt: new Date().toISOString()
    });
    await agentScheduler.tick();
    return { runId: run.id, workflowName: run.workflowName };
  } catch (error) {
    return reply.code(500).send({ message: (error as Error).message });
  }
});

app.post("/api/agents", async (request, reply) => {
  const parsed = agentHireSchema.safeParse(request.body ?? {});
  if (!parsed.success) return reply.code(400).send({ message: "参数错误", issues: parsed.error.issues });
  const input = parsed.data;
  const preset = input.preset ? AGENT_PRESETS.find((p) => p.key === input.preset) : undefined;
  const schedule = parseScheduleExpression(input.schedule, input.scheduleLabel ?? preset?.schedule.label);
  const created = await repository.create("agent_employee", {
    name: input.name,
    properties: {
      name: input.name,
      avatar: input.avatar || preset?.avatar || "🛠️",
      group: input.group || preset?.group || "默认",
      description: input.description || preset?.description || "",
      status: "on",
      pacing: input.pacing || preset?.pacing || "global",
      workflow_id: input.workflowId ?? "",
      schedule: schedule as unknown as Record<string, unknown>,
      scope: (input.scope ? { projectIds: input.scope.projectIds ?? [] } : { projectIds: [] }) as unknown as Record<string, unknown>,
      hands_off_to: (input.handsOffTo ?? []) as unknown as Record<string, unknown>
    },
    body: input.description || preset?.description || ""
  });
  await agentScheduler.tick();
  return reply.code(201).send({ id: created.id });
});

app.patch("/api/agents/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = agentPatchSchema.safeParse(request.body ?? {});
  if (!parsed.success) return reply.code(400).send({ message: "参数错误", issues: parsed.error.issues });
  const entity = repository.get(id);
  if (!entity || entity.kind !== "agent_employee") return reply.code(404).send({ message: "员工不存在" });
  const patch: EntityProperties = {};
  if (parsed.data.status) patch.status = parsed.data.status;
  if (parsed.data.pacing) patch.pacing = parsed.data.pacing;
  if (parsed.data.workflowId !== undefined) patch.workflow_id = parsed.data.workflowId;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.group !== undefined) patch.group = parsed.data.group;
  if (parsed.data.schedule) {
    patch.schedule = parseScheduleExpression(parsed.data.schedule, parsed.data.scheduleLabel) as unknown as Record<string, unknown>;
  }
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.scope) patch.scope = parsed.data.scope as unknown as Record<string, unknown>;
  if (parsed.data.handsOffTo) patch.hands_off_to = parsed.data.handsOffTo as unknown as Record<string, unknown>;
  try {
    await repository.update(id, { expectedRevision: parsed.data.revision, merge: true, properties: patch });
    await agentScheduler.tick();
    return { ok: true };
  } catch (error) {
    if (error instanceof RevisionConflictError) return reply.code(409).send({ message: "版本冲突，请刷新后重试" });
    return reply.code(500).send({ message: (error as Error).message });
  }
});

app.delete("/api/agents/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const entity = repository.get(id);
  if (!entity || entity.kind !== "agent_employee") return reply.code(404).send({ message: "员工不存在" });
  await repository.update(id, { expectedRevision: entity.revision, merge: true, properties: { status: "archived", archived_at: new Date().toISOString() } });
  return { ok: true };
});

app.get("/api/agent/pulse", async (request) => {
  const query = (request.query as { refresh?: string }) ?? {};
  const refresh = query.refresh === "true" || query.refresh === "1";
  return agentPulseService.getDailyPulse({ refresh });
});

app.post("/api/agent/pulse/apply", async (request, reply) => {
  const parsed = pulseActionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ message: "参数错误", issues: parsed.error.issues });
  }
  try {
    const result = await agentPulseService.applyAction(parsed.data);
    return result;
  } catch (error) {
    return reply.code(500).send({ message: (error as Error).message });
  }
});

app.get("/api/ai-config", async () => {
  const config = resolveAiConfig(vaultPath);
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    configured: config.configured,
    hasApiKey: Boolean(config.apiKey)
  };
});

app.post("/api/ai-config", async (request, reply) => {
  const body = (request.body as Partial<AiConfigData>) ?? {};
  const saved = saveAiConfig(vaultPath, body);
  return {
    baseUrl: saved.baseUrl,
    model: saved.model,
    configured: Boolean(saved.apiKey && saved.baseUrl),
    hasApiKey: Boolean(saved.apiKey)
  };
});

await app.register(soloFocusRoutes);

// 所有路由注册完成后，最后再启动监听（顶层 await 会挂起求值，故必须放在文件末尾）。
const address = await app.listen({ port, host });
console.log(`个人工作台运行于 ${address}`);
console.log(`Vault: ${vaultPath}`);

async function shutdown(): Promise<void> {
  await repository.close();
  await app.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
