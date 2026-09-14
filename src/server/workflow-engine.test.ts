import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { WorkflowDefinition, WorkflowRun } from "../shared/domain.js";
import { VaultRepository } from "./repository.js";
import { WorkflowEngine } from "./workflow-engine.js";
import { WorkflowRuntimeStore } from "./workflow-runtime.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});

describe("WorkflowEngine", () => {
  it("waits for approval before replacing today's focus", async () => {
    const { repository, runtime, engine } = await setup();
    const task = await repository.create("task", {
      name: "完成工作流测试",
      properties: { status: "todo", priority: "p1", focus: false }
    });
    const workflow = await createWorkflow(repository, "今日计划生成", todaySteps());

    const started = await engine.start(workflow.id);
    const waiting = await waitForRun(runtime, started.id, "waiting_approval");
    expect(repository.get(task.id)?.properties.focus).toBe(false);
    expect(waiting.patchPlan?.operations.some((operation) => operation.entityId === task.id)).toBe(true);

    await engine.action(waiting.id, { action: "approve", expectedRunRevision: waiting.revision });
    const completed = await waitForRun(runtime, waiting.id, "completed");
    expect(repository.get(task.id)?.properties.focus).toBe(true);
    expect(repository.get(task.id)?.properties.scheduled).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(completed.patchPlan?.operations.every((operation) => operation.applied)).toBe(true);
    await waitForWorkflowRun(repository, waiting.id);
    expect(repository.list("workflow_run")).toHaveLength(1);
    await repository.close();
  });

  it("creates an entity and marks the inbox item only after approval", async () => {
    const { repository, runtime, engine } = await setup();
    const inbox = await repository.create("inbox", { name: "整理个人简历", body: "准备下一版简历" });
    const workflow = await createWorkflow(repository, "收集箱整理", inboxSteps());

    const started = await engine.start(workflow.id);
    const waiting = await waitForRun(runtime, started.id, "waiting_approval");
    expect(repository.list("task").find((entity) => entity.name === inbox.name)).toBeUndefined();

    await engine.action(waiting.id, { action: "approve", expectedRunRevision: waiting.revision });
    await waitForRun(runtime, waiting.id, "completed");
    expect(repository.list("task").find((entity) => entity.name === inbox.name)).toBeDefined();
    expect(repository.get(inbox.id)?.properties.status).toBe("processed");
    await repository.close();
  });

  it("detects a Vault revision conflict instead of overwriting an external change", async () => {
    const { repository, runtime, engine } = await setup();
    const task = await repository.create("task", { name: "保留外部修改", properties: { status: "todo" } });
    const workflow = await createWorkflow(repository, "今日计划生成", todaySteps());
    const started = await engine.start(workflow.id);
    const waiting = await waitForRun(runtime, started.id, "waiting_approval");
    const latestTask = repository.get(task.id)!;
    await repository.update(task.id, { expectedRevision: latestTask.revision, properties: { summary: "Obsidian 修改" } });
    await engine.action(waiting.id, { action: "approve", expectedRunRevision: waiting.revision });
    const failed = await waitForRun(runtime, waiting.id, "failed");
    expect(failed.reason).toBe("revision_conflict");
    expect(repository.get(task.id)?.properties.focus).not.toBe(true);
    expect(repository.get(task.id)?.properties.summary).toBe("Obsidian 修改");
    await repository.close();
  });

  it("turns an interrupted running snapshot into a resumable pause after restart", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "workbench-runs-"));
    temporaryDirectories.push(directory);
    const first = new WorkflowRuntimeStore(directory);
    await first.initialize();
    const now = new Date().toISOString();
    const created = await first.create({
      id: "restart-run",
      workflowId: "workflow",
      workflowName: "重启恢复",
      workflowVersion: 1,
      workflowRevision: "revision",
      status: "queued",
      input: {},
      steps: [],
      stepStates: [],
      currentStepIndex: 0,
      outputs: {},
      startedAt: now,
      updatedAt: now
    });
    created.status = "running";
    await first.save(created, created.revision);

    const restarted = new WorkflowRuntimeStore(directory);
    await restarted.initialize();
    expect(restarted.get(created.id)?.status).toBe("paused");
    expect(restarted.get(created.id)?.reason).toBe("service_restarted");
  });
});

class FakeAi implements WorkflowAiProvider {
  readonly configured = true;
  async generate(action: WorkflowAiAction, context: unknown): Promise<unknown> {
    const items = Array.isArray(context) ? context as Record<string, unknown>[] : [];
    if (action === "select_today_focus") {
      return { summary: "选择最重要的任务", items: items.slice(0, 3).map((item) => ({ entityId: item.entityId, reason: "优先处理" })) };
    }
    return {
      summary: "整理收集项",
      items: items.map((item) => ({ entityId: item.entityId, targetKind: "task", name: item.name, summary: "自动整理" }))
    };
  }
}

async function setup() {
  const vault = await mkdtemp(path.join(tmpdir(), "workbench-workflow-vault-"));
  const cache = await mkdtemp(path.join(tmpdir(), "workbench-workflow-cache-"));
  temporaryDirectories.push(vault, cache);
  const repository = new VaultRepository(vault);
  await repository.initialize();
  const runtime = new WorkflowRuntimeStore(cache);
  await runtime.initialize();
  return { repository, runtime, engine: new WorkflowEngine(repository, runtime) };
}

async function createWorkflow(repository: VaultRepository, name: string, steps: WorkflowDefinition["steps"]) {
  return repository.create("workflow", {
    name,
    properties: { status: "active", trigger: "manual", version: 1, approval: "before_write", steps }
  });
}

function todaySteps(): WorkflowDefinition["steps"] {
  return [
    { id: "query", type: "vault_query", title: "读取任务", config: { action: "today_candidates" } },
    { id: "rule", type: "rule", title: "排序", config: { action: "rank_today_candidates" } },
    { id: "rule-focus", type: "rule", title: "选择重点", config: { action: "rank_today_candidates" } },
    { id: "approval", type: "approval", title: "确认", config: { plan: "replace_today_focus" } },
    { id: "write", type: "vault_write", title: "写入", config: { mode: "replace" } }
  ];
}

function inboxSteps(): WorkflowDefinition["steps"] {
  return [
    { id: "query", type: "vault_query", title: "读取收集箱", config: { action: "inbox_unprocessed" } },
    { id: "rule-classify", type: "rule", title: "分类", config: { action: "keep_inbox" } },
    { id: "approval", type: "approval", title: "确认", config: { plan: "organize_inbox" } },
    { id: "write", type: "vault_write", title: "写入", config: {} }
  ];
}

async function waitForRun(runtime: WorkflowRuntimeStore, id: string, status: WorkflowRun["status"]): Promise<WorkflowRun> {
  for (let index = 0; index < 100; index += 1) {
    const run = runtime.get(id);
    // 终态先发布，摘要随后异步落盘；等待完整收尾后才能删除测试 Vault / cache。
    const needsSummary = status === "completed" || status === "failed" || status === "cancelled";
    if (run?.status === status && (!needsSummary || run.summaryEntityId)) return run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`运行没有进入 ${status}，当前状态：${runtime.get(id)?.status}`);
}

async function waitForWorkflowRun(repository: VaultRepository, runId: string): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (repository.list("workflow_run").some((entity) => entity.properties.run_id === runId)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`运行摘要实体未写入：${runId}`);
}
