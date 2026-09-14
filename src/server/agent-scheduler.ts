import type { AgentEmployee, AgentActivity, AgentScope } from "../shared/domain.js";
import { describeSchedule, nextScheduleOccurrence } from "../shared/domain.js";
import type { VaultRepository } from "./repository.js";

/**
 * AgentEmployeeScheduler — 智能体员工排班器
 *
 * 设计取舍：
 *   - 不引入 cron-parser 等额外依赖；用 shared/domain.ts 自带的极简 cron 解析器。
 *   - 每 30 秒轮询一次，扫描所有 hired 员工，按 schedule 与当前时间决定是否触发。
 *   - 触发时调用 workflowEngine.start(employee.workflowId, { triggered_by: "agent" })，
 *     并写一条 agent_activity 实体，作为「近况」面板的数据源。
 *   - shift 全局开关（env: WORKBENCH_AGENT_SHIFT，默认 on）可一键关停所有员工。
 *   - 调度器本身是无状态的；状态从 Vault 读，触发后立即回写 updated / lastRunAt。
 *
 * 外部 API：
 *   - start() / stop()
 *   - tick(now?)  测试 / 手动触发一次（home refresh）
 *   - rosterSummary()  给前端 dashboard 用
 */
export interface SchedulerDeps {
  repository: VaultRepository;
  runEmployee: (employee: AgentEmployee, trigger: "schedule" | "manual") => Promise<{ runId?: string; summary?: string; tone?: AgentActivity["tone"] }>;
  now?: () => Date;
}

export class AgentEmployeeScheduler {
  private timer: NodeJS.Timeout | null = null;
  private shiftOn: boolean;
  private readonly nowFn: () => Date;

  constructor(private readonly deps: SchedulerDeps) {
    this.shiftOn = (process.env.WORKBENCH_AGENT_SHIFT ?? "on") !== "off";
    this.nowFn = deps.now ?? (() => new Date());
  }

  start(): void {
    if (this.timer) return;
    // 30 秒轮询足够满足分钟级 schedule 触发；启动时立刻跑一次 tick 以刷新「下次」面板。
    void this.tick();
    this.timer = setInterval(() => { void this.tick(); }, 30_000);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  setShift(on: boolean): void {
    this.shiftOn = on;
  }

  isShiftOn(): boolean {
    return this.shiftOn;
  }

  async tick(now: Date = this.nowFn()): Promise<void> {
    const employees = this.deps.repository
      .list("agent_employee")
      .map(this.toEmployee)
      .filter((emp): emp is AgentEmployee => Boolean(emp));

    for (const emp of employees) {
      const next = nextScheduleOccurrence(emp.schedule, now);
      const updated: AgentEmployee = { ...emp, nextRunAt: next, updatedAt: now.toISOString() };
      await this.persist(updated);

      if (!this.shiftOn || emp.status === "off" || !emp.workflowId) continue;
      const lastRunAt = emp.lastRunAt ? new Date(emp.lastRunAt) : undefined;
      const dueAt = next ? new Date(next) : undefined;
      // 已触发过的不重复跑；只在「上一次跑之前 + 下次时间已到」之间才触发一次
      if (dueAt && now >= dueAt && (!lastRunAt || lastRunAt < dueAt)) {
        try {
          const result = await this.deps.runEmployee(emp, "schedule");
          await this.appendActivity({
            employeeId: emp.id,
            runId: result.runId,
            summary: result.summary ?? `${emp.name} 已按排班 (${describeSchedule(emp.schedule)}) 自动执行一次`,
            tone: result.tone ?? "info",
            createdAt: now.toISOString()
          });
          await this.persist({ ...updated, lastRunAt: now.toISOString(), lastRunId: result.runId, updatedAt: now.toISOString() });
        } catch (error) {
          await this.appendActivity({
            employeeId: emp.id,
            summary: `${emp.name} 排班执行失败：${(error as Error).message}`,
            tone: "warning",
            createdAt: now.toISOString()
          });
        }
      }
    }
  }

  rosterSummary(): {
    shiftOn: boolean;
    hired: AgentEmployee[];
    activities: AgentActivity[];
    pendingApprovals: number;
    totalRuns24h: number;
  } {
    const hired = this.deps.repository
      .list("agent_employee")
      .map(this.toEmployee)
      .filter((emp): emp is AgentEmployee => Boolean(emp));
    const activities = this.deps.repository
      .list("agent_activity")
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 12)
      .map((entity) => this.toActivity(entity))
      .filter((act): act is AgentActivity => Boolean(act));
    const runs24h = this.deps.repository.list("workflow_run").filter((entity) => {
      const updated = entity.modifiedAt;
      return updated && Date.now() - new Date(updated).getTime() < 24 * 3600 * 1000;
    });
    const pendingApprovals = this.deps.repository
      .list("workflow_run")
      .filter((entity) => String(entity.properties.status ?? "") === "waiting_approval").length;
    return {
      shiftOn: this.shiftOn,
      hired,
      activities,
      pendingApprovals,
      totalRuns24h: runs24h.length
    };
  }

  private async persist(emp: AgentEmployee): Promise<void> {
    const entity = this.deps.repository.get(emp.id);
    if (!entity || entity.kind !== "agent_employee") return;
    await this.deps.repository.update(emp.id, {
      expectedRevision: entity.revision,
      merge: true,
      properties: {
        name: emp.name,
        avatar: emp.avatar,
        group: emp.group,
        description: emp.description,
        status: emp.status,
        pacing: emp.pacing,
        workflow_id: emp.workflowId,
        schedule: emp.schedule as unknown as Record<string, unknown>,
        scope: (emp.scope?.projectIds?.length ? emp.scope : { projectIds: [] }) as unknown as Record<string, unknown>,
        hands_off_to: (emp.handsOffTo && emp.handsOffTo.length ? emp.handsOffTo : []) as unknown as Record<string, unknown>,
        last_run_id: emp.lastRunId,
        last_run_at: emp.lastRunAt,
        next_run_at: emp.nextRunAt
      }
    });
  }

  async appendActivity(activity: Omit<AgentActivity, "id">): Promise<void> {
    await this.deps.repository.create("agent_activity", {
      name: activity.summary.slice(0, 80),
      properties: {
        employee_id: activity.employeeId,
        run_id: activity.runId,
        summary: activity.summary,
        tone: activity.tone,
        created_at: activity.createdAt
      },
      body: activity.summary
    });
  }

  private toEmployee = (entity: ReturnType<VaultRepository["list"]>[number]): AgentEmployee | null => {
    if (entity.kind !== "agent_employee") return null;
    const props = entity.properties;
    const schedule = (props.schedule as unknown as AgentEmployee["schedule"]) ?? {
      minute: "*", hour: "*", day: "*", month: "*", weekday: "*", label: "未配置"
    };
    const scopeRaw = props.scope as unknown as AgentScope | undefined;
    const projectIds = scopeRaw?.projectIds ?? [];
    const handsOffTo = Array.isArray(props.hands_off_to) ? (props.hands_off_to as string[]).filter((id) => typeof id === "string") : [];
    return {
      id: entity.id,
      name: String(props.name ?? entity.name),
      avatar: String(props.avatar ?? "🛠️"),
      group: String(props.group ?? "默认"),
      description: String(props.description ?? ""),
      status: (props.status as AgentEmployee["status"]) ?? "on",
      pacing: (props.pacing as AgentEmployee["pacing"]) ?? "global",
      workflowId: String(props.workflow_id ?? props.workflowId ?? ""),
      schedule,
      scope: projectIds.length ? { projectIds } : undefined,
      scopeProjectNames: projectIds.length ? this.projectNamesFor(projectIds) : [],
      handsOffTo: handsOffTo.length ? handsOffTo : undefined,
      handsOffToNames: handsOffTo.length ? this.employeeNamesFor(handsOffTo) : [],
      lastRunId: props.last_run_id as string | undefined ?? props.lastRunId as string | undefined,
      lastRunAt: props.last_run_at as string | undefined ?? props.lastRunAt as string | undefined,
      nextRunAt: props.next_run_at as string | undefined ?? props.nextRunAt as string | undefined,
      createdAt: entity.modifiedAt,
      updatedAt: entity.modifiedAt
    };
  };

  /** 把 project id 列表解析为展示名（查 Vault 的 project 实体；找不到则回退 id） */
  private projectNamesFor(ids: string[]): string[] {
    const projects = this.deps.repository.list("project");
    const byId = new Map(projects.map((p) => [p.id, String((p.properties as Record<string, unknown>)?.name ?? p.name ?? "")]));
    return ids.map((id) => byId.get(id) ?? id);
  }

  /** 把 employee id 列表解析为展示名（查 Vault 的 agent_employee 实体；找不到则回退 id） */
  private employeeNamesFor(ids: string[]): string[] {
    const employees = this.deps.repository.list("agent_employee");
    const byId = new Map(employees.map((e) => [e.id, String((e.properties as Record<string, unknown>)?.name ?? e.name ?? "")]));
    return ids.map((id) => byId.get(id) ?? id);
  }

  private toActivity = (entity: ReturnType<VaultRepository["list"]>[number]): AgentActivity | null => {
    if (entity.kind !== "agent_activity") return null;
    return {
      id: entity.id,
      employeeId: String(entity.properties.employee_id ?? ""),
      runId: entity.properties.run_id as string | undefined,
      summary: String(entity.properties.summary ?? entity.name),
      tone: (entity.properties.tone as AgentActivity["tone"]) ?? "neutral",
      createdAt: String(entity.properties.created_at ?? entity.modifiedAt)
    };
  };
}