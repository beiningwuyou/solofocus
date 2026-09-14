import { appendFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { WorkflowAttention, WorkflowRun } from "../shared/domain.js";

export interface WorkflowRuntimeEvent {
  type: "workflow-run-change" | "workflow-run-attention";
  run: Pick<WorkflowRun, "id" | "workflowId" | "workflowName" | "status" | "currentStepIndex" | "updatedAt" | "reason">;
}

export class RunRevisionConflictError extends Error {
  constructor(public readonly latest: WorkflowRun) {
    super("运行状态已在其他操作中更新");
    this.name = "RunRevisionConflictError";
  }
}

export class WorkflowRuntimeStore {
  private runs = new Map<string, WorkflowRun>();
  private listeners = new Set<(event: WorkflowRuntimeEvent) => void>();

  constructor(
    public readonly cachePath = process.env.WORKBENCH_CACHE_PATH
      ?? path.join(os.homedir(), "Library", "Caches", "personal-workbench", "runs")
  ) {}

  async initialize(): Promise<void> {
    await mkdir(this.cachePath, { recursive: true });
    const files = await readdir(this.cachePath).catch(() => []);
    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      try {
        const raw = await readFile(path.join(this.cachePath, file), "utf8");
        const run = JSON.parse(raw) as WorkflowRun;
        this.runs.set(run.id, run);
      } catch (error) {
        console.error(`无法读取工作流运行快照 ${file}`, error);
      }
    }
    for (const run of this.list()) {
      if (run.status !== "running" && run.status !== "queued") continue;
      run.status = "paused";
      run.reason = "service_restarted";
      run.updatedAt = new Date().toISOString();
      await this.save(run, run.revision);
      await this.log(run.id, "service_restarted", { status: "paused" });
    }
    await this.cleanup(30);
  }

  subscribe(listener: (event: WorkflowRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): WorkflowRun[] {
    return [...this.runs.values()]
      .map((run) => structuredClone(run))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): WorkflowRun | undefined {
    const run = this.runs.get(id);
    return run ? structuredClone(run) : undefined;
  }

  async create(run: Omit<WorkflowRun, "revision">): Promise<WorkflowRun> {
    const stored: WorkflowRun = { ...structuredClone(run), revision: "1" };
    await this.writeSnapshot(stored);
    this.runs.set(stored.id, stored);
    await this.log(stored.id, "run_created", { workflowId: stored.workflowId, status: stored.status });
    this.emit(stored);
    return structuredClone(stored);
  }

  async save(run: WorkflowRun, expectedRevision: string): Promise<WorkflowRun> {
    const current = this.runs.get(run.id);
    if (!current) throw new Error("未找到运行");
    if (current.revision !== expectedRevision) throw new RunRevisionConflictError(structuredClone(current));
    const next: WorkflowRun = {
      ...structuredClone(run),
      revision: String(Number(current.revision) + 1),
      updatedAt: new Date().toISOString()
    };
    await this.writeSnapshot(next);
    this.runs.set(next.id, next);
    this.emit(next);
    return structuredClone(next);
  }

  async log(runId: string, event: string, details: Record<string, unknown> = {}): Promise<void> {
    await mkdir(this.cachePath, { recursive: true });
    const record = JSON.stringify({ at: new Date().toISOString(), runId, event, ...details });
    await appendFile(path.join(this.cachePath, `${runId}.jsonl`), `${record}\n`, "utf8");
  }

  attention(): WorkflowAttention {
    const runs = this.list();
    const attention = runs.filter((run) => ["waiting_approval", "failed", "paused"].includes(run.status));
    return {
      waitingApproval: attention.filter((run) => run.status === "waiting_approval").length,
      failed: attention.filter((run) => run.status === "failed").length,
      paused: attention.filter((run) => run.status === "paused").length,
      latest: attention.slice(0, 5).map(({ id, workflowName, status, reason, updatedAt }) => ({
        id,
        workflowName,
        status,
        reason,
        updatedAt
      }))
    };
  }

  async cleanup(retentionDays = 30): Promise<{ removed: number }> {
    const threshold = Date.now() - retentionDays * 86_400_000;
    let removed = 0;
    const files = await readdir(this.cachePath).catch(() => []);
    for (const file of files) {
      const absolute = path.join(this.cachePath, file);
      const info = await stat(absolute).catch(() => undefined);
      if (!info || info.mtimeMs >= threshold) continue;
      const id = file.replace(/\.(?:json|jsonl)$/, "");
      const run = this.runs.get(id);
      if (run && !["completed", "failed", "cancelled"].includes(run.status)) continue;
      await unlink(absolute).catch(() => undefined);
      if (file.endsWith(".json")) this.runs.delete(id);
      removed += 1;
    }
    return { removed };
  }

  private async writeSnapshot(run: WorkflowRun): Promise<void> {
    await mkdir(this.cachePath, { recursive: true });
    const destination = path.join(this.cachePath, `${run.id}.json`);
    const temporary = path.join(this.cachePath, `.${run.id}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(run, null, 2)}\n`, "utf8");
      await rename(temporary, destination);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private emit(run: WorkflowRun): void {
    const summary = {
      id: run.id,
      workflowId: run.workflowId,
      workflowName: run.workflowName,
      status: run.status,
      currentStepIndex: run.currentStepIndex,
      updatedAt: run.updatedAt,
      reason: run.reason
    };
    for (const listener of this.listeners) {
      listener({ type: "workflow-run-change", run: summary });
      if (["waiting_approval", "failed"].includes(run.status)) {
        listener({ type: "workflow-run-attention", run: summary });
      }
    }
  }
}
