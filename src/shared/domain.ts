export const ENTITY_KINDS = [
  "area",
  "card",
  "vision",
  "principle",
  "goal",
  "key_result",
  "project",
  "plan",
  "milestone",
  "task",
  "habit",
  "metric",
  "opportunity",
  "document",
  "resource",
  "inbox",
  "daily",
  "review",
  "workflow",
  "workflow_version",
  "workflow_run",
  "agent_employee",
  "agent_activity"
] as const;

/**
 * 极简模型（PARA + Linear 执行纪律）下保留的核心类型。
 * 其余类型进入 DEPRECATED_KINDS：UI 不再创建或主动展示，旧文件原样保留在 Vault，可随时在 Obsidian 恢复。
 */
export const CORE_KINDS: EntityKind[] = [
  "area",
  "card",
  "vision",
  "principle",
  "project",
  "task",
  "inbox",
  "document",
  "resource",
  "review",
  "workflow",
  "workflow_version",
  "workflow_run"
];

/**
 * 被新方法论废弃、仅保留兼容旧数据的类型。
 * 其中 cycle / knowledge / course / system 属于更早期的历史遗留写法，不在 ENTITY_KINDS 中，
 * 因此这里用 string[] 而不是 EntityKind[]。
 */
export const DEPRECATED_KINDS: string[] = [
  "goal",
  "key_result",
  "plan",
  "milestone",
  "habit",
  "metric",
  "opportunity",
  "cycle",
  "knowledge",
  "course",
  "system"
];

export function isDeprecatedKind(kind: string): boolean {
  return DEPRECATED_KINDS.includes(kind);
}

export type EntityKind = (typeof ENTITY_KINDS)[number];
export type Confidence = "on_track" | "at_risk" | "off_track";
/** 严格 4 态：Inbox → Todo → Doing → Done（极简任务流）。 */
export type TaskStatus = "inbox" | "todo" | "doing" | "done";
/** 项目状态（极简）：想法 / 进行中 / 等待 / 已完成 / 已归档。 */
export type ProjectStatus = "idea" | "active" | "waiting" | "completed" | "archived";
export type Priority = "p0" | "p1" | "p2" | "p3";
export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type WorkflowRunStatus = "queued" | "running" | "waiting_approval" | "paused" | "completed" | "failed" | "cancelled";
export type WorkflowStepType = "vault_query" | "rule" | "approval" | "vault_write";
export type WorkflowStepStatus = "pending" | "running" | "waiting_approval" | "completed" | "failed" | "skipped";

export type Scalar = string | number | boolean | null;
export type PropertyValue = Scalar | Scalar[] | Record<string, unknown>[] | Record<string, unknown>;
export type EntityProperties = Record<string, PropertyValue | undefined>;

export interface VaultEntity {
  id: string;
  path: string;
  name: string;
  kind: EntityKind;
  revision: string;
  body: string;
  properties: EntityProperties;
  modifiedAt: string;
}

export interface DashboardMetrics {
  todayTasks: number;
  dueSoon: number;
  activePlans: number;
  inbox: number;
  overdue: number;
  blocked: number;
}

export interface BootstrapPayload {
  today: string;
  entities: VaultEntity[];
  archivedTasks?: VaultEntity[];
  archivedProjects?: VaultEntity[];
  metrics: DashboardMetrics;
  vaultName: string;
  workflowAttention?: WorkflowAttention;
}

export interface EntityCreateInput {
  name: string;
  properties?: EntityProperties;
  body?: string;
}

export interface EntityPatchInput {
  expectedRevision: string;
  name?: string;
  properties?: EntityProperties;
  body?: string;
  merge?: boolean;
  /** 显式绕过状态机白名单（例如批量修数据），仍会写入审计历史。 */
  allowStatusOverride?: boolean;
  /** 审计历史里的操作来源，如 ui / workflow / ai / script。 */
  actor?: string;
  /** 审计历史里的备注。 */
  statusNote?: string;
}

export interface EntityArchiveResult {
  id: string;
  originalPath: string;
  archivedPath: string;
}

export interface EntityTrashResult {
  id: string;
  originalPath: string;
  trashedName: string;
}

export interface SearchHit {
  id: string;
  path: string;
  kind: EntityKind;
  name: string;
  summary: string;
  score: number;
}

export interface WorkflowStepDefinition extends Record<string, unknown> {
  id: string;
  type: WorkflowStepType;
  title: string;
  config: Record<string, unknown>;
  /** 下游步骤 id 列表，构成 DAG 边。省略时运行时按数组顺序执行。 */
  next?: string[];
  /** 画布上的节点坐标（仅前端编排使用）。 */
  ui?: { x: number; y: number };
}

/**
 * 递归解析步骤配置中的变量引用：
 * - {{stepId}} 替换为该步骤的输出（对象会 JSON 序列化）
 * - {{stepId.field}} 替换为输出对象的某个字段
 * 未匹配的引用保持原样，便于排查。
 */
export function resolveVariables<T>(value: T, run: WorkflowRun): T {
  if (typeof value === "string") return replaceTokens(value, run) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => resolveVariables(item, run)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = resolveVariables(item, run);
    }
    return out as unknown as T;
  }
  return value;
}

function replaceTokens(text: string, run: WorkflowRun): string {
  const TOKEN = /\{\{\s*([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_.\-]+))?\s*\}\}/g;
  return text.replace(TOKEN, (_match, id: string, field?: string) => {
    // 命名空间 `inputs`：引用本次运行注入的输入（含智能体员工的 scope 等上下文）
    if (id === "inputs") {
      const value = field ? getByPath(run.input, field) : run.input;
      if (value !== undefined) return typeof value === "string" ? value : JSON.stringify(value);
      return _match;
    }
    const output = run.outputs[id];
    if (output === undefined) return _match;
    if (field) {
      const fieldValue = (output as Record<string, unknown>)?.[field];
      if (fieldValue === undefined) return _match;
      return typeof fieldValue === "string" ? fieldValue : JSON.stringify(fieldValue);
    }
    return typeof output === "string" ? output : JSON.stringify(output);
  });
}

/** 按点路径从对象取值，例如 getByPath({a:{b:[{c:1}]}}, "a.b.0.c") → 1 */
function getByPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  path: string;
  revision: string;
  status: WorkflowStatus;
  trigger: "manual";
  version: number;
  area?: string;
  goal?: string;
  project?: string;
  plan?: string;
  approval: "before_write";
  summary?: string;
  body: string;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepState {
  id: string;
  title: string;
  type: WorkflowStepType;
  status: WorkflowStepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface PatchOperation {
  id: string;
  type: "patch" | "create";
  label: string;
  entityId?: string;
  entityKind: EntityKind;
  expectedRevision?: string;
  name?: string;
  properties?: EntityProperties;
  body?: string;
  applied?: boolean;
  error?: string;
}

export interface PatchPlan {
  summary: string;
  operations: PatchOperation[];
}

export interface WorkflowRun {
  id: string;
  revision: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  workflowRevision: string;
  status: WorkflowRunStatus;
  reason?: string;
  input: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
  stepStates: WorkflowStepState[];
  currentStepIndex: number;
  outputs: Record<string, unknown>;
  proposedOutput?: unknown;
  editedOutput?: unknown;
  nextInstruction?: string;
  patchPlan?: PatchPlan;
  error?: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  summaryEntityId?: string;
}

export interface WorkflowRunActionInput {
  action: "approve" | "edit_result" | "pause" | "resume" | "retry_step" | "cancel";
  expectedRunRevision: string;
  stepId?: string;
  editedOutput?: unknown;
  nextInstruction?: string;
}

export interface WorkflowAttention {
  waitingApproval: number;
  failed: number;
  paused: number;
  latest: Pick<WorkflowRun, "id" | "workflowName" | "status" | "reason" | "updatedAt">[];
}

/* ---------------------------------------------------------------------------
 * 状态机 + 可审计历史
 *
 * 设计取舍：
 * - Vault 里的 Markdown 仍是唯一事实源，历史直接写在 frontmatter 的 status_history。
 * - 对历史遗留状态值（backlog / cancelled / in_progress …）保持宽容：
 *   先用 aliases 归一，归一不了就放行并记账，绝不因为旧数据把用户卡死。
 * - 只有「起点和终点都是规范状态、且不在白名单里」时才真正拦截。
 * ------------------------------------------------------------------------- */

/** 一次状态流转的审计记录，序列化后直接写进 frontmatter。 */
export interface StatusHistoryEntry {
  from: string;
  to: string;
  at: string;
  by?: string;
  note?: string;
}

export interface StatusMachine<S extends string = string> {
  /** 规范状态集合，顺序即 UI 展示顺序。 */
  states: readonly S[];
  labels: Record<S, string>;
  /** 白名单：从某状态出发允许到达的状态。 */
  transitions: Record<S, readonly S[]>;
  /** 历史遗留状态值 → 规范状态。 */
  aliases?: Record<string, S>;
}

export type AnyStatusMachine = {
  states: readonly string[];
  labels: Record<string, string>;
  transitions: Record<string, readonly string[]>;
  aliases?: Record<string, string>;
};

function defineMachine<S extends string>(machine: StatusMachine<S>): AnyStatusMachine {
  return machine as unknown as AnyStatusMachine;
}

export const TASK_STATUS_MACHINE = defineMachine<TaskStatus>({
  states: ["inbox", "todo", "doing", "done"],
  labels: { inbox: "收集", todo: "待办", doing: "进行中", done: "完成" },
  transitions: {
    inbox: ["todo", "doing", "done"],
    todo: ["doing", "done", "inbox"],
    doing: ["done", "todo"],
    done: ["todo", "doing"]
  },
  aliases: {
    new: "inbox",
    captured: "inbox",
    backlog: "todo",
    planned: "todo",
    next: "todo",
    open: "todo",
    waiting: "todo",
    active: "doing",
    blocked: "doing",
    in_progress: "doing",
    "in-progress": "doing",
    completed: "done",
    cancelled: "done",
    canceled: "done"
  }
});

export const PROJECT_STATUS_MACHINE = defineMachine<ProjectStatus>({
  states: ["idea", "active", "waiting", "completed", "archived"],
  labels: { idea: "想法", active: "进行中", waiting: "等待", completed: "已完成", archived: "已归档" },
  transitions: {
    idea: ["active", "archived"],
    active: ["waiting", "completed", "archived"],
    waiting: ["active", "completed", "archived"],
    completed: ["active", "archived"],
    archived: ["idea", "active"]
  },
  aliases: {
    planned: "idea",
    draft: "idea",
    doing: "active",
    in_progress: "active",
    paused: "waiting",
    blocked: "waiting",
    on_hold: "waiting",
    done: "completed",
    finished: "completed"
  }
});

export const STATUS_MACHINES: Partial<Record<EntityKind, AnyStatusMachine>> = {
  task: TASK_STATUS_MACHINE,
  project: PROJECT_STATUS_MACHINE
};

/** 单个实体保留的最近流转条数，避免 frontmatter 无限膨胀。 */
export const STATUS_HISTORY_LIMIT = 40;

export function statusMachineFor(kind: EntityKind): AnyStatusMachine | undefined {
  return STATUS_MACHINES[kind];
}

/** 把任意历史状态值归一成规范状态；无法归一时返回原值。 */
export function canonicalStatus(kind: EntityKind, value: PropertyValue | undefined): string {
  const raw = asString(value).trim();
  const machine = statusMachineFor(kind);
  if (!machine || !raw) return raw;
  if (machine.states.includes(raw)) return raw;
  return machine.aliases?.[raw] ?? raw;
}

export function statusLabel(kind: EntityKind, status: string): string {
  const machine = statusMachineFor(kind);
  if (!machine) return status;
  return machine.labels[canonicalStatus(kind, status)] ?? status;
}

/** 把任务任意历史状态归一成 UI 展示用的三态（todo/doing/done），供勾选与状态列使用。 */
export function taskStatusForUi(value: PropertyValue | undefined): string {
  const raw = asString(value);
  if (["inbox", "backlog", "blocked"].includes(raw)) return "todo";
  if (raw === "cancelled") return "done";
  return ["todo", "doing", "done"].includes(raw) ? raw : "todo";
}

/** 任务状态的中文标签：优先保留原值语义（阻塞/已取消），其余归一后取规范标签。 */
export function taskStatusLabel(value: PropertyValue | undefined): string {
  const raw = asString(value);
  const explicit: Record<string, string> = { inbox: "收集", todo: "待办", doing: "进行中", done: "已完成", blocked: "阻塞", cancelled: "已取消" };
  if (explicit[raw]) return explicit[raw];
  return statusLabel("task", taskStatusForUi(value));
}

/** 从当前状态出发允许到达的状态列表（已归一）。 */
export function allowedNextStatuses(kind: EntityKind, from: PropertyValue | undefined): string[] {
  const machine = statusMachineFor(kind);
  if (!machine) return [];
  const current = canonicalStatus(kind, from);
  if (!machine.states.includes(current)) return [...machine.states];
  return [...(machine.transitions[current] ?? [])];
}

export type StatusTransitionCheck = {
  ok: boolean;
  from: string;
  to: string;
  /** 起点与终点是否都是规范状态；false 表示是遗留值，只记账不拦截。 */
  strict: boolean;
  allowed: string[];
  reason?: string;
};

export function checkStatusTransition(
  kind: EntityKind,
  from: PropertyValue | undefined,
  to: PropertyValue | undefined
): StatusTransitionCheck {
  const machine = statusMachineFor(kind);
  const fromValue = canonicalStatus(kind, from);
  const toValue = canonicalStatus(kind, to);
  if (!machine) return { ok: true, from: fromValue, to: toValue, strict: false, allowed: [] };
  const allowed = allowedNextStatuses(kind, from);
  if (fromValue === toValue) return { ok: true, from: fromValue, to: toValue, strict: true, allowed };
  const known = machine.states.includes(fromValue) && machine.states.includes(toValue);
  if (!known) {
    // 遗留状态：放行，交给历史记录留痕
    return { ok: true, from: fromValue, to: toValue, strict: false, allowed };
  }
  if (allowed.includes(toValue)) return { ok: true, from: fromValue, to: toValue, strict: true, allowed };
  return {
    ok: false,
    from: fromValue,
    to: toValue,
    strict: true,
    allowed,
    reason: `${machine.labels[fromValue] ?? fromValue} 不能直接变更为 ${machine.labels[toValue] ?? toValue}`
  };
}

export function readStatusHistory(value: PropertyValue | undefined): StatusHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: StatusHistoryEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const to = typeof record.to === "string" ? record.to : "";
    if (!to) continue;
    entries.push({
      from: typeof record.from === "string" ? record.from : "",
      to,
      at: typeof record.at === "string" ? record.at : "",
      by: typeof record.by === "string" ? record.by : undefined,
      note: typeof record.note === "string" ? record.note : undefined
    });
  }
  return entries;
}

/** 追加一条流转记录，返回可直接写回 frontmatter 的数组（旧记录超限时丢弃最早的）。 */
export function appendStatusHistory(
  existing: PropertyValue | undefined,
  entry: StatusHistoryEntry,
  limit = STATUS_HISTORY_LIMIT
): Record<string, unknown>[] {
  const history = readStatusHistory(existing).map((item) => ({ ...item }) as Record<string, unknown>);
  const next: Record<string, unknown> = { from: entry.from, to: entry.to, at: entry.at };
  if (entry.by) next.by = entry.by;
  if (entry.note) next.note = entry.note;
  history.push(next);
  for (const item of history) {
    if (!item.by) delete item.by;
    if (!item.note) delete item.note;
  }
  return history.slice(-limit);
}

const CLOSED_TASKS = new Set(["done", "cancelled"]);

export function todayIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

export function asString(value: PropertyValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function asNumber(value: PropertyValue | undefined, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

export function asBoolean(value: PropertyValue | undefined): boolean {
  return value === true || value === "true";
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function linkName(value: PropertyValue | undefined): string {
  const raw = asString(value);
  const match = raw.match(/\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/);
  const resolved = match?.[1] ?? raw;
  return resolved.split("/").pop() ?? resolved;
}

export function relationMatches(value: PropertyValue | undefined, entity: VaultEntity): boolean {
  return linkName(value) === entity.name;
}

export function keyResultProgress(entity: VaultEntity): number {
  const start = asNumber(entity.properties.start_value);
  const current = asNumber(entity.properties.current_value);
  const target = asNumber(entity.properties.target_value);
  if (target === start) return current >= target ? 100 : 0;
  return Math.round(clamp(((current - start) / (target - start)) * 100));
}

export function goalProgress(goal: VaultEntity, entities: VaultEntity[]): number {
  const results = entities.filter(
    (entity) => entity.kind === "key_result" && relationMatches(entity.properties.goal, goal)
  );
  if (!results.length) return 0;
  const totalWeight = results.reduce((sum, result) => sum + asNumber(result.properties.weight, 1), 0);
  if (!totalWeight) return 0;
  const weighted = results.reduce(
    (sum, result) => sum + keyResultProgress(result) * asNumber(result.properties.weight, 1),
    0
  );
  return Math.round(weighted / totalWeight);
}

/**
 * 收集一个项目下的全部任务（按 id 去重）。
 *
 * 兼容旧数据：任务既可直接写 `project`，也可通过已废弃的 `plan` 间接归属。
 * 旧 Vault 里同一个任务经常两个字段都写了，必须按 id 去重，否则会被重复计入，
 * 导致任务数翻倍、进度权重失真。
 */
export function projectTasks(project: VaultEntity, entities: VaultEntity[]): VaultEntity[] {
  const collected = new Map<string, VaultEntity>();
  const keyOf = (task: VaultEntity) => task.id || task.path || task.name;

  for (const entity of entities) {
    if (entity.kind === "task" && relationMatches(entity.properties.project, project)) {
      collected.set(keyOf(entity), entity);
    }
  }

  const legacyPlans = entities.filter(
    (entity) => entity.kind === "plan" && relationMatches(entity.properties.project, project)
  );
  for (const plan of legacyPlans) {
    for (const entity of entities) {
      if (entity.kind === "task" && relationMatches(entity.properties.plan, plan)) {
        collected.set(keyOf(entity), entity);
      }
    }
  }

  return [...collected.values()];
}

/** 任务完成率只是执行证据，不等同于项目取得了结果。 */
export function projectTaskCompletion(project: VaultEntity, entities: VaultEntity[]): number {
  const tasks = projectTasks(project, entities);
  if (!tasks.length) return 0;
  const completed = tasks.filter((task) => CLOSED_TASKS.has(asString(task.properties.status))).length;
  return Math.round((completed / tasks.length) * 100);
}

/** 项目成果进度只从加权里程碑计算；没有里程碑时不从任务数量推断。 */
export function projectProgress(project: VaultEntity, entities: VaultEntity[]): number {
  const milestones = entities.filter(
    (entity) => entity.kind === "milestone" && relationMatches(entity.properties.project, project)
  );
  if (!milestones.length) return 0;
  const totalWeight = milestones.reduce((sum, milestone) => sum + asNumber(milestone.properties.weight, 1), 0);
  if (!totalWeight) return 0;
  const weighted = milestones.reduce((sum, milestone) => {
    const status = asString(milestone.properties.status);
    const progress = ["done", "completed"].includes(status) ? 100 : Math.max(0, Math.min(100, asNumber(milestone.properties.progress)));
    return sum + progress * asNumber(milestone.properties.weight, 1);
  }, 0);
  return Math.round(weighted / totalWeight);
}

/** 项目健康信号只观察关联任务，不再读取项目上的下一步行动字段。 */
export type ProjectAlert = "no_tasks" | "finished" | null;

export function projectAlert(project: VaultEntity, entities: VaultEntity[]): ProjectAlert {
  if (asString(project.properties.status) !== "active") return null;
  const tasks = projectTasks(project, entities);
  if (!tasks.length) return "no_tasks";
  const open = tasks.filter((task) => !CLOSED_TASKS.has(asString(task.properties.status)));
  if (!open.length) return "finished";
  return null;
}

export const PROJECT_ALERT_TEXT: Record<Exclude<ProjectAlert, null>, { label: string; action: string }> = {
  no_tasks: { label: "项目还没有关联任务", action: "去添加" },
  finished: { label: "关联任务已全部完成", action: "检查结果" }
};

export function planProgress(plan: VaultEntity, entities: VaultEntity[]): number {
  const tasks = entities.filter(
    (entity) => entity.kind === "task" && relationMatches(entity.properties.plan, plan)
  );
  if (!tasks.length) return 0;
  const completed = tasks.filter((task) => CLOSED_TASKS.has(asString(task.properties.status))).length;
  return Math.round((completed / tasks.length) * 100);
}

export function visionProgress(vision: VaultEntity, entities: VaultEntity[]): number {
  const projects = entities.filter(
    (entity) => entity.kind === "project" && relationMatches(entity.properties.vision, vision)
  );
  if (!projects.length) return 0;
  const totalWeight = projects.reduce((sum, project) => sum + asNumber(project.properties.weight, 1), 0);
  if (!totalWeight) return 0;
  return Math.round(projects.reduce(
    (sum, project) => sum + projectProgress(project, entities) * asNumber(project.properties.weight, 1),
    0
  ) / totalWeight);
}

export function isOpenTask(entity: VaultEntity): boolean {
  return entity.kind === "task" && !CLOSED_TASKS.has(asString(entity.properties.status));
}

export function dashboardMetrics(entities: VaultEntity[], today: string): DashboardMetrics {
  const openTasks = entities.filter(isOpenTask);
  const weekEnd = addDays(today, 7);
  const focus = openTasks.filter((entity) => {
    const scheduled = asString(entity.properties.scheduled);
    const due = asString(entity.properties.due);
    return asBoolean(entity.properties.focus) || scheduled === today || due === today || entity.properties.status === "doing";
  });
  return {
    todayTasks: focus.length,
    dueSoon: openTasks.filter((entity) => {
      const due = asString(entity.properties.due);
      return due >= today && due <= weekEnd;
    }).length,
    activePlans: entities.filter((entity) => entity.kind === "plan" && entity.properties.status === "active").length,
    inbox: entities.filter((entity) => entity.kind === "inbox" && entity.properties.status !== "processed").length,
    overdue: openTasks.filter((entity) => {
      const due = asString(entity.properties.due);
      return Boolean(due && due < today);
    }).length,
    blocked: openTasks.filter((entity) => entity.properties.status === "blocked").length
  };
}

export function dueText(value: PropertyValue | undefined, today: string): string {
  const due = asString(value);
  if (!due) return "未设日期";
  const diff = Math.round((new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  return `${diff} 天后`;
}

export function habitWeekCount(habit: VaultEntity, entities: VaultEntity[], referenceDate = todayIso()): number {
  const reference = new Date(`${referenceDate}T00:00:00`);
  const day = reference.getDay() || 7;
  reference.setDate(reference.getDate() - day + 1);
  const weekStart = todayIso(reference);
  const weekEnd = addDays(weekStart, 6);
  const entries: Record<string, unknown>[] = [];
  for (const daily of entities.filter((entity) => {
    const date = asString(entity.properties.date) || entity.name;
    return entity.kind === "daily" && date >= weekStart && date <= weekEnd;
  })) {
    const value = daily.properties.habit_entries;
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (entry && typeof entry === "object") entries.push(entry as Record<string, unknown>);
    }
  }
  return entries.filter((record) =>
    linkName(record.habit as PropertyValue) === habit.name && Number(record.value ?? 0) > 0
  ).length;
}

export function kindLabel(kind: EntityKind): string {
  return {
    area: "领域",
    card: "知识卡",
    vision: "愿景",
    principle: "原则",
    goal: "目标",
    key_result: "关键结果",
    project: "项目",
    plan: "计划",
    milestone: "里程碑",
    task: "任务",
    habit: "习惯",
    metric: "指标",
    opportunity: "岗位",
    document: "文档",
    resource: "资料",
    inbox: "收集",
    daily: "每日记录",
    review: "项目复盘",
    workflow: "工作流",
    workflow_version: "工作流版本",
    workflow_run: "工作流运行",
    agent_employee: "智能体员工",
    agent_activity: "员工近况"
  }[kind];
}

/* ============================================================================
 * 智能体员工（Agent Employee）
 * ----------------------------------------------------------------------------
 * 不是 LLM / SaaS 员工，而是「绑定到 Workflow 的常驻角色卡」：
 *   人格面（名字/头像/作息/分组）→ kind: agent_employee 实体，写入 Vault
 *   执行体                        → 通过 workflowId 复用 WorkflowEngine
 *   行为流                        → run + 通过 agent_activity 聚合的近况
 * 触发模型：全局 shift 开关 + 个人 schedule 表达式 + 手动 run-now。
 * ========================================================================== */

export type AgentPacing = "auto" | "hourly" | "global";
export type AgentShiftStatus = "on" | "off";

/**
 * 极简 cron 表达式（5 字段）：分 时 日 月 周
 *   星号            → 每分钟
 *   "0 9 星 星 1-5" → 周一至周五 09:00
 *   "星号/30 8-18 星 星 星" → 8-18 点每 30 分钟
 * 支持：通配、范围、列表、步长；不支持 L/W/# 扩展（保持零依赖）。
 */
export interface AgentScheduleExpression {
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
  /** 人类可读，例如「工作日 09:00」「全天每 30 分钟」 */
  label: string;
}

/**
 * 智能体员工的「作用域」：限定它执行工作流时能感知的上下文。
 * 目前支持关联若干 project；后续可扩展 task / area / 标签等维度。
 */
export interface AgentScope {
  projectIds?: string[];
}

export interface AgentEmployee {
  id: string;
  name: string;
  avatar: string; // emoji 或首字
  group: string;
  description: string;
  status: AgentShiftStatus; // hired/paused 简化为全局状态字段
  pacing: AgentPacing;
  schedule: AgentScheduleExpression;
  workflowId: string; // 必绑工作流（无则不能 run）
  /** 作用域：员工执行时能感知的上下文（如关联项目） */
  scope?: AgentScope;
  /** 由后端从 scope.projectIds 解析出的项目名称，仅前端展示用，不入 Vault */
  scopeProjectNames?: string[];
  /** 协作交接：本员工工作流产出后，交给哪些员工继续处理（存对方 employee id） */
  handsOffTo?: string[];
  /** 由后端从 handsOffTo 解析出的名字，仅前端展示用，不入 Vault */
  handsOffToNames?: string[];
  model?: string;
  /** 本次排班最近一次执行的 run id，用于「上次/下次」面板 */
  lastRunId?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentActivity {
  id: string;
  employeeId: string;
  runId?: string;
  summary: string;
  tone: "neutral" | "success" | "warning" | "info";
  createdAt: string;
}

/**
 * 雇佣时可选的角色预设，省去用户从零配置。
 * 工作流需用户自行选择（或先用空 workflowId 占位）。
 */
export interface AgentEmployeePreset {
  key: string;
  name: string;
  avatar: string;
  group: string;
  description: string;
  pacing: AgentPacing;
  schedule: AgentScheduleExpression;
}

export const AGENT_PRESETS: AgentEmployeePreset[] = [
  {
    key: "focus_butler",
    name: "小 V",
    avatar: "🤖",
    group: "日常",
    description: "作为你的常驻助手与平台管家：汇总周末来 Task、督办卡住的反馈、整理今日重点。",
    pacing: "hourly",
    schedule: { minute: "0", hour: "8-22", day: "*", month: "*", weekday: "*", label: "8-22 点整点" }
  },
  {
    key: "writer_helper",
    name: "写作搭子",
    avatar: "✍️",
    group: "内容",
    description: "在公众号发文前自动汇总本周候选选题、跑一遍风格校对、产出大纲候选。",
    pacing: "auto",
    schedule: { minute: "30", hour: "9", day: "*", month: "*", weekday: "1-5", label: "工作日 09:30" }
  },
  {
    key: "data_janitor",
    name: "数据管家",
    avatar: "📊",
    group: "运营",
    description: "每日抓取关键指标异常，发现数字下滑时主动在「待审批」提议处理。",
    pacing: "global",
    schedule: { minute: "0", hour: "21", day: "*", month: "*", weekday: "*", label: "每日 21:00" }
  }
];

/** 简易 cron 字段 → 下一触发时间计算（零依赖；5 字段；分钟精度） */
export function parseScheduleExpression(raw: string, labelHint?: string): AgentScheduleExpression {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const parts = trimmed === "" ? ["*"] : trimmed.split(" ");
  const safe = (idx: number, fallback: string): string => parts[idx] ?? fallback;
  const [minute, hour, day, month, weekday] = [safe(0, "*"), safe(1, "*"), safe(2, "*"), safe(3, "*"), safe(4, "*")];
  const partial: AgentScheduleExpression = { minute, hour, day, month, weekday, label: "" };
  return { ...partial, label: labelHint ?? describeSchedule(partial) };
}

export function describeSchedule(expr: AgentScheduleExpression): string {
  const fields = [expr.minute, expr.hour, expr.day, expr.month, expr.weekday];
  if (fields.every((f) => f === "*")) return "每分钟";
  if (expr.weekday === "1-5" && expr.day === "*" && expr.month === "*" && expr.hour.match(/^\d+$/) && expr.minute.match(/^\d+$/)) return `工作日 ${expr.hour.padStart(2, "0")}:${expr.minute.padStart(2, "0")}`;
  if (expr.hour.includes("-")) return `${expr.hour} 点每 ${expr.minute.startsWith("*/") ? expr.minute.slice(2) + " 分钟" : expr.minute + " 分"}`;
  return `${expr.weekday !== "*" ? "周" + expr.weekday + " " : ""}${expr.hour}:${expr.minute}`;
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const segment of field.split(",")) {
    const stepMatch = segment.match(/^(.+)\/(\d+)$/);
    const [base, stepStr] = stepMatch ? [stepMatch[1], Number(stepMatch[2])] : [segment, 1];
    let lo: number;
    let hi: number;
    if (base === "*") {
      lo = min; hi = max;
    } else if (base.includes("-")) {
      const [a, b] = base.split("-").map(Number);
      lo = a; hi = b;
    } else {
      lo = hi = Number(base);
    }
    if (Number.isFinite(lo) && Number.isFinite(hi) && value >= lo && value <= hi && (value - lo) % stepStr === 0) return true;
  }
  return false;
}

/** 给定一个时间，返回下一次 schedule 触发的 ISO；找不到返回 undefined。 */
export function nextScheduleOccurrence(expr: AgentScheduleExpression, after: Date = new Date()): string | undefined {
  const cursor = new Date(after.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  for (let i = 0; i < 60 * 24 * 7; i++) {
    const m = cursor.getUTCMinutes();
    const h = cursor.getUTCHours();
    const d = cursor.getUTCDate();
    const mo = cursor.getUTCMonth() + 1;
    const w = cursor.getUTCDay();
    if (
      matchField(expr.minute, m, 0, 59) &&
      matchField(expr.hour, h, 0, 23) &&
      matchField(expr.day, d, 1, 31) &&
      matchField(expr.month, mo, 1, 12) &&
      matchField(expr.weekday, w, 0, 6)
    ) return cursor.toISOString();
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return undefined;
}

/** 聚合视图：员工 + 它最近 N 条 run + 当前待审批 */
export interface AgentRosterSummary {
  shiftOn: boolean;
  hired: AgentEmployee[];
  activities: AgentActivity[];
  pendingApprovals: number;
  totalRuns24h: number;
}
