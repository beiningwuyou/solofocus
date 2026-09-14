import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VaultRepository } from "./repository.js";
import { AgentPulseService } from "./agent-pulse-service.js";
import {
  agentPulseOutputSchema,
  heuristicPulseGenerator,
  type PulseAction
} from "./agent-pulse-prompt.js";
import type { VaultEntity } from "../shared/domain.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function setupTestRepo() {
  const directory = await mkdtemp(path.join(tmpdir(), "agent-pulse-test-"));
  temporaryDirectories.push(directory);
  const repository = new VaultRepository(directory);
  await repository.initialize();
  return { repository, directory };
}

describe("agent-pulse", () => {
  it("heuristic generator strictly conforms to agentPulseOutputSchema", () => {
    const mockProjects: VaultEntity[] = [
      {
        id: "proj-1",
        name: "秋招求职准备",
        kind: "project",
        path: "20-Actions/Projects/秋招求职准备.md",
        revision: "rev-1",
        modifiedAt: "2026-09-12T10:00:00Z",
        body: "",
        properties: { status: "active", target: "2026-10-01" }
      }
    ];

    const mockTasks: VaultEntity[] = [
      {
        id: "task-1",
        name: "定向优化简历与作品集",
        kind: "task",
        path: "20-Actions/Tasks/定向优化简历与作品集.md",
        revision: "rev-t1",
        modifiedAt: "2026-09-12T10:00:00Z",
        body: "",
        properties: { status: "todo", priority: "p0", project: "[[秋招求职准备]]", due: "2026-09-10" }
      }
    ];

    const result = heuristicPulseGenerator({
      today: "2026-09-12",
      projects: mockProjects,
      openTasks: mockTasks,
      archivedTasks: [],
      yesterdayFirstStep: "定向优化简历与作品集"
    });

    const parsed = agentPulseOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.actions.length).toBeGreaterThanOrEqual(1);
    expect(result.actions.length).toBeLessThanOrEqual(3);
    expect(result.actions[0].actionType).toBe("promote_existing");
    expect(result.actions[0].existingTaskId).toBe("task-1");
  });

  it("AgentPulseService retrieves daily pulse with fallback when offline/unconfigured", async () => {
    const { repository, directory } = await setupTestRepo();
    await repository.create("project", {
      name: "毕业论文定稿",
      properties: { status: "active", target: "2026-10-15" }
    });

    const service = new AgentPulseService(repository, directory);
    const pulse = await service.getDailyPulse({ refresh: true });

    expect(pulse.source).toBe("heuristic");
    expect(pulse.actions.length).toBeGreaterThan(0);
    expect(pulse.briefing).toBeDefined();

    await repository.close();
  });

  it("AgentPulseService applies action and updates/creates task as today focus", async () => {
    const { repository, directory } = await setupTestRepo();
    const service = new AgentPulseService(repository, directory);

    // 1. 测试 promote_existing
    const existing = await repository.create("task", {
      name: "测试已有任务",
      properties: { status: "todo", priority: "p1", focus: false }
    });

    const promoteAction: PulseAction = {
      id: "act-1",
      title: existing.name,
      project: "测试项目",
      priority: "p0",
      estimatedMinutes: 30,
      rationale: "关键路径任务",
      actionType: "promote_existing",
      existingTaskId: existing.id
    };

    const promoteRes = await service.applyAction(promoteAction);
    expect(promoteRes.ok).toBe(true);
    const updated = repository.get(existing.id);
    expect(updated?.properties.focus).toBe(true);
    expect(updated?.properties.scheduled).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // 2. 测试 create_new
    const newAction: PulseAction = {
      id: "act-2",
      title: "新创建的推进任务",
      project: "测试项目",
      priority: "p1",
      estimatedMinutes: 45,
      rationale: "项目缺乏下一步待办",
      actionType: "create_new"
    };

    const createRes = await service.applyAction(newAction);
    expect(createRes.ok).toBe(true);
    const created = repository.get(createRes.entityId);
    expect(created).toBeDefined();
    expect(created?.name).toBe("新创建的推进任务");
    expect(created?.properties.focus).toBe(true);
    expect(created?.properties.project).toBe("[[测试项目]]");

    await repository.close();
  });
});
