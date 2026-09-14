import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { SoloFocusRepository } from "./repository.js";
import { SoloFocusAgentEngine } from "./agent-engine.js";
import { closeDatabase } from "./db.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

let testDbPath: string;

beforeAll(() => {
  testDbPath = path.join(os.tmpdir(), `solofocus-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  process.env.SOLOFOCUS_DB_PATH = testDbPath;
  closeDatabase();
});

afterAll(() => {
  closeDatabase();
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
  }
  delete process.env.SOLOFOCUS_DB_PATH;
});

describe("SoloFocus SQLite Core Engine", () => {
  let repo: SoloFocusRepository;
  let agent: SoloFocusAgentEngine;

  beforeEach(() => {
    repo = new SoloFocusRepository();
    agent = new SoloFocusAgentEngine(repo);
  });

  it("bootstraps with full authentic seed data", () => {
    const data = repo.getBootstrap();
    expect(data.domains.length).toBeGreaterThanOrEqual(5);
    expect(data.projects.length).toBeGreaterThanOrEqual(3);
    expect(data.tasks.length).toBeGreaterThanOrEqual(10);
    expect(data.habits.length).toBeGreaterThanOrEqual(4);
    expect(data.sops.length).toBeGreaterThanOrEqual(4);
    expect(data.systemStatus.walModeActive).toBe(true);
    expect(data.systemStatus.sqliteVersion).toContain("WAL");
  });

  it("creates, toggles, schedules and archives a task", () => {
    const task = repo.createTask({
      title: "测试自动化任务流转",
      priority: "CRITICAL",
      estimatedMinutes: 45
    });
    expect(task.id).toMatch(/^#T-\d+/);
    expect(task.status).toBe("todo");

    // Toggle complete
    const toggled = repo.toggleTask(task.id);
    expect(toggled.status).toBe("done");
    expect(toggled.completedAt).toBeDefined();

    // Toggle back
    const toggledBack = repo.toggleTask(task.id);
    expect(toggledBack.status).toBe("todo");

    // Schedule to today
    repo.scheduleTaskToToday(task.id);
    const bootstrap = repo.getBootstrap();
    const updated = bootstrap.tasks.find((t) => t.id === task.id);
    expect(updated?.scheduledDate).toBe(new Date().toISOString().slice(0, 10));

    // Archive task
    repo.archiveTask(task.id);
    const bootstrapAfterArchive = repo.getBootstrap();
    expect(bootstrapAfterArchive.tasks.some((t) => t.id === task.id)).toBe(false);
    expect(bootstrapAfterArchive.archives.some((a) => a.entityId === task.id)).toBe(true);
  });

  it("applies SOP steps to task as checklist", () => {
    const task = repo.createTask({ title: "执行周复盘任务" });
    repo.applySopToTask(task.id, "sop_retro");

    const bootstrap = repo.getBootstrap();
    const updated = bootstrap.tasks.find((t) => t.id === task.id);
    expect(updated?.checklist?.length).toBe(6);
    expect(updated?.checklist?.[0]?.title).toContain("01 收集阶段");
  });

  it("handles habit punching and streak calculation", () => {
    const habit = repo.createHabit({
      name: "每日代码提交自检",
      mva: "运行 git diff 检查关键改动"
    });
    const today = new Date().toISOString().slice(0, 10);

    const punch1 = repo.punchHabit(habit.id, today);
    expect(punch1.isPunched).toBe(true);
    expect(punch1.streakDays).toBe(1);

    // Un-punch
    const punch2 = repo.punchHabit(habit.id, today);
    expect(punch2.isPunched).toBe(false);
  });

  it("updates domain mission with blur-to-save support", () => {
    repo.updateDomain("dom_work", {
      mission: "更新后的工作与交付核心使命定位"
    });
    const bootstrap = repo.getBootstrap();
    const dom = bootstrap.domains.find((d) => d.id === "dom_work");
    expect(dom?.mission).toBe("更新后的工作与交付核心使命定位");
  });

  it("creates a new domain card and persists to database", () => {
    const newDomain = repo.createDomain({
      name: "品牌与影响力",
      code: "brand",
      icon: "rocket_launch",
      mission: "建立高辨识度的开源与技术品牌",
      principles: ["原则1: 保持真实与透明", "原则2: 质量第一"]
    });
    expect(newDomain.id).toMatch(/^dom_\d+/);
    expect(newDomain.name).toBe("品牌与影响力");
    expect(newDomain.code).toBe("brand");
    expect(newDomain.icon).toBe("rocket_launch");
    expect(newDomain.principles.length).toBe(2);

    const bootstrap = repo.getBootstrap();
    const found = bootstrap.domains.find((d) => d.id === newDomain.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("品牌与影响力");
  });

  it("enforces fail-safe lock on database restore", () => {
    expect(() => {
      repo.verifyAndRestore("solofocus_backup_2026-09-05_full.db", "wrong_filename.db");
    }).toThrow(/安全校验失败/);

    const result = repo.verifyAndRestore(
      "solofocus_backup_2026-09-05_full.db",
      "solofocus_backup_2026-09-05_full.db"
    );
    expect(result.success).toBe(true);
  });

  it("distills project notes with AI Agent engine", () => {
    const notes = agent.distillProjectNotes("proj_solofocus");
    expect(notes).toContain("【Agent");
  });
});

describe("SoloFocus Fastify REST API Endpoints", () => {
  let app: any;
  let repo: SoloFocusRepository;

  beforeEach(async () => {
    repo = new SoloFocusRepository();
    const Fastify = (await import("fastify")).default;
    const { soloFocusRoutes } = await import("./routes.js");
    app = Fastify();
    await app.register(soloFocusRoutes);
    await app.ready();
  });


  it("serves bootstrap data via GET /api/solofocus/bootstrap", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/solofocus/bootstrap"
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.systemStatus.walModeActive).toBe(true);
    expect(Array.isArray(json.tasks)).toBe(true);
    expect(json.tasks.length).toBeGreaterThanOrEqual(10);
  });

  it("handles full task creation and toggle lifecycle via HTTP", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/tasks",
      payload: {
        title: "HTTP 自动化测试任务",
        priority: "HIGH",
        estimatedMinutes: 30
      }
    });
    expect(createRes.statusCode).toBe(201);
    const task = JSON.parse(createRes.payload);
    expect(task.id).toMatch(/^#T-\d+/);

    const toggleRes = await app.inject({
      method: "POST",
      url: `/api/solofocus/tasks/${encodeURIComponent(task.id)}/toggle`
    });
    expect(toggleRes.statusCode).toBe(200);
    const toggled = JSON.parse(toggleRes.payload);
    expect(toggled.status).toBe("done");
  });

  it("handles habit punching and safety restore verification via HTTP", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const punchRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/habits/h_morning/punch",
      payload: { date: today }
    });
    expect(punchRes.statusCode).toBe(200);

    // Fail safety restore
    const failRestore = await app.inject({
      method: "POST",
      url: "/api/solofocus/backup/restore",
      payload: { targetSnapshotName: "solofocus_backup_2026-09-05_full.db", confirmInputName: "wrong" }
    });
    expect(failRestore.statusCode).toBe(400);

    // Pass safety restore
    const passRestore = await app.inject({
      method: "POST",
      url: "/api/solofocus/backup/restore",
      payload: { targetSnapshotName: "solofocus_backup_2026-09-05_full.db", confirmInputName: "solofocus_backup_2026-09-05_full.db" }
    });
    expect(passRestore.statusCode).toBe(200);
  });

  it("generates AI daily briefing with workload analysis and top 3 recommendations", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/solofocus/agent/daily-briefing"
    });
    expect(res.statusCode).toBe(200);
    const briefing = JSON.parse(res.payload);
    expect(briefing.summary).toBeDefined();
    expect(briefing.workloadAnalysis).toBeDefined();
    expect(typeof briefing.workloadAnalysis.totalEstimatedMinutes).toBe("number");
    expect(Array.isArray(briefing.topFocusTasks)).toBe(true);
    expect(Array.isArray(briefing.postponeRecommendations)).toBe(true);
  });

  it("applies daily plan via HTTP endpoint", async () => {
    const task = repo.createTask({ title: "待顺延任务测试", priority: "LOW" });
    const res = await app.inject({
      method: "POST",
      url: "/api/solofocus/agent/apply-daily-plan",
      payload: {
        confirmedFocusTaskIds: [],
        confirmedPostponeTaskIds: [task.id]
      }
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.success).toBe(true);
    expect(data.postponedCount).toBe(1);
  });

  it("recommends standard SOPs based on project name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/solofocus/agent/recommend-sops",
      payload: { projectName: "商业化发布与多维验收" }
    });
    expect(res.statusCode).toBe(200);
    const recs = JSON.parse(res.payload);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].title).toBeDefined();
    expect(recs[0].stepCount).toBeGreaterThan(0);
  });

  it("extracts SOP from project execution history", async () => {
    const bootstrap = repo.getBootstrap();
    const proj = bootstrap.projects[0];
    const res = await app.inject({
      method: "POST",
      url: "/api/solofocus/agent/extract-sop",
      payload: { projectId: proj.id }
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.success).toBe(true);
    expect(data.draft).toBeDefined();
    expect(data.draft.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("manages AI config retrieval and persistence", async () => {
    const getRes = await app.inject({
      method: "GET",
      url: "/api/solofocus/ai-config"
    });
    expect(getRes.statusCode).toBe(200);
    const cfg = JSON.parse(getRes.payload);
    expect(cfg.baseUrl).toBeDefined();
    expect(cfg.model).toBeDefined();

    const saveRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/ai-config",
      payload: {
        model: "deepseek-chat-v2",
        temperature: 0.2
      }
    });
    expect(saveRes.statusCode).toBe(200);
    const saved = JSON.parse(saveRes.payload);
    expect(saved.config.model).toBe("deepseek-chat-v2");
    expect(saved.config.temperature).toBe(0.2);
  });

  it("handles empty json bodies without HTTP 400 bad case error", async () => {
    // Test that empty JSON body or body-less requests with application/json succeed
    const task = repo.createTask({ title: "测试空 Body 容错任务" });
    const toggleRes = await app.inject({
      method: "POST",
      url: `/api/solofocus/tasks/${encodeURIComponent(task.id)}/toggle`,
      headers: { "content-type": "application/json" }
    });
    expect(toggleRes.statusCode).toBe(200);

    const scheduleRes = await app.inject({
      method: "POST",
      url: `/api/solofocus/tasks/${encodeURIComponent(task.id)}/schedule-today`,
      headers: { "content-type": "application/json" }
    });
    expect(scheduleRes.statusCode).toBe(200);
  });

  it("supports deleting, archiving, and recovering projects, habits, sops through trash", async () => {
    // 1. Project deletion and trash recovery
    const bootstrap = repo.getBootstrap();
    const testProject = bootstrap.projects[0];
    const delProjRes = await app.inject({
      method: "DELETE",
      url: `/api/solofocus/projects/${encodeURIComponent(testProject.id)}`
    });
    expect(delProjRes.statusCode).toBe(200);

    let bootAfterDel = repo.getBootstrap();
    expect(bootAfterDel.projects.some((p) => p.id === testProject.id)).toBe(false);
    const trashItem = bootAfterDel.trash.find((t) => t.entityId === testProject.id);
    expect(trashItem).toBeDefined();

    // Restore project
    const restoreProjRes = await app.inject({
      method: "POST",
      url: `/api/solofocus/trash/${encodeURIComponent(trashItem!.id)}/restore`
    });
    expect(restoreProjRes.statusCode).toBe(200);
    expect(repo.getBootstrap().projects.some((p) => p.id === testProject.id)).toBe(true);

    // 2. Habit deletion and purge
    const habit = bootstrap.habits[0];
    const delHabitRes = await app.inject({
      method: "DELETE",
      url: `/api/solofocus/habits/${encodeURIComponent(habit.id)}`
    });
    expect(delHabitRes.statusCode).toBe(200);
    const habitTrashItem = repo.getBootstrap().trash.find((t) => t.entityId === habit.id);
    expect(habitTrashItem).toBeDefined();

    // Purge item
    const purgeRes = await app.inject({
      method: "DELETE",
      url: `/api/solofocus/trash/${encodeURIComponent(habitTrashItem!.id)}`
    });
    expect(purgeRes.statusCode).toBe(200);
    expect(repo.getBootstrap().trash.some((t) => t.id === habitTrashItem!.id)).toBe(false);

    // 3. Clear all trash
    await app.inject({
      method: "DELETE",
      url: `/api/solofocus/sops/${encodeURIComponent(bootstrap.sops[0].id)}`
    });
    expect(repo.getBootstrap().trash.length).toBeGreaterThan(0);
    const clearRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/trash/clear"
    });
    expect(clearRes.statusCode).toBe(200);
    expect(repo.getBootstrap().trash.length).toBe(0);
  });
});


