import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { soloFocusRoutes } from "./routes.js";
import { SoloFocusRepository } from "./repository.js";
import { closeDatabase } from "./db.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

describe("SoloFocus Full Lifecycle End-to-End Operational Verification", () => {
  let app: FastifyInstance;
  let repo: SoloFocusRepository;
  let testDbPath: string;

  beforeAll(async () => {
    testDbPath = path.join(os.tmpdir(), `solofocus-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    process.env.SOLOFOCUS_DB_PATH = testDbPath;
    closeDatabase();

    repo = new SoloFocusRepository();
    app = Fastify();
    await app.register(soloFocusRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    delete process.env.SOLOFOCUS_DB_PATH;
  });

  it("completes the full continuous discovery lifecycle: project -> standard SOP -> daily briefing -> task execution -> experience extraction -> SOP reuse", async () => {
    // 1. 验证基础状态
    const initBootRes = await app.inject({ method: "GET", url: "/api/solofocus/bootstrap" });
    expect(initBootRes.statusCode).toBe(200);
    const initBoot = JSON.parse(initBootRes.payload);
    expect(initBoot.domains.length).toBeGreaterThan(0);
    const domainId = initBoot.domains[0].id;

    // 2. 向外借力：新建项目前获取标准 SOP 推荐
    const projectName = "商业化发布与交付跨平台验收";
    const sopRecRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/agent/recommend-sops",
      payload: { projectName, domainId }
    });
    expect(sopRecRes.statusCode).toBe(200);
    const recSops = JSON.parse(sopRecRes.payload);
    expect(recSops.length).toBeGreaterThan(0);
    const chosenSop = recSops[0];
    expect(chosenSop.steps.length).toBeGreaterThan(0);

    // 3. 一键采用 SOP 步骤生成项目里程碑并创建项目
    const milestones = chosenSop.steps.map((s: any, idx: number) => ({
      title: `阶段 0${idx + 1}: [${s.phaseTitle}] ${s.instruction}`,
      orderIndex: idx
    }));

    const createProjRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/projects",
      payload: {
        name: projectName,
        domainId,
        description: "面向商业化市场的端到端发布与跨平台容灾闭环验证工程。",
        targetDate: new Date().toISOString().slice(0, 10),
        milestones
      }
    });
    expect(createProjRes.statusCode).toBe(201);
    const project = JSON.parse(createProjRes.payload);
    expect(project.id).toBeDefined();

    // 4. 创建 3 项工单并添加核对清单
    const task1Res = await app.inject({
      method: "POST",
      url: "/api/solofocus/tasks",
      payload: {
        projectId: project.id,
        title: "实施 Tauri 2 离线崩溃自动恢复链路",
        priority: "CRITICAL",
        estimatedMinutes: 60,
        scheduledDate: new Date().toISOString().slice(0, 10)
      }
    });
    const task1 = JSON.parse(task1Res.payload);

    const task2Res = await app.inject({
      method: "POST",
      url: "/api/solofocus/tasks",
      payload: {
        projectId: project.id,
        title: "执行 SQLite WAL 冷备份快照与 SHA256 校验",
        priority: "HIGH",
        estimatedMinutes: 45,
        scheduledDate: new Date().toISOString().slice(0, 10)
      }
    });
    const task2 = JSON.parse(task2Res.payload);

    const task3Res = await app.inject({
      method: "POST",
      url: "/api/solofocus/tasks",
      payload: {
        projectId: project.id,
        title: "执行无网络环境冷启动回归验证",
        priority: "NORMAL",
        estimatedMinutes: 30,
        scheduledDate: new Date().toISOString().slice(0, 10)
      }
    });
    const task3 = JSON.parse(task3Res.payload);

    // 5. 晨间指挥舱：触发 AI Daily Briefing 与决策建议
    const briefingRes = await app.inject({
      method: "GET",
      url: "/api/solofocus/agent/daily-briefing"
    });
    expect(briefingRes.statusCode).toBe(200);
    const briefing = JSON.parse(briefingRes.payload);
    expect(briefing.summary).toBeDefined();
    expect(briefing.topFocusTasks.length).toBeGreaterThan(0);
    // 验证高优先级工单被智能识别入 Top 聚焦
    const topTaskIds = briefing.topFocusTasks.map((t: any) => t.taskId);
    expect(topTaskIds).toContain(task1.id);

    // 6. 用户确认应用排期
    const applyRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/agent/apply-daily-plan",
      payload: {
        confirmedFocusTaskIds: [task1.id, task2.id],
        confirmedPostponeTaskIds: []
      }
    });
    expect(applyRes.statusCode).toBe(200);

    // 7. 任务执行与闭环
    await app.inject({ method: "POST", url: `/api/solofocus/tasks/${encodeURIComponent(task1.id)}/toggle` });
    await app.inject({ method: "POST", url: `/api/solofocus/tasks/${encodeURIComponent(task2.id)}/toggle` });
    await app.inject({ method: "POST", url: `/api/solofocus/tasks/${encodeURIComponent(task3.id)}/toggle` });

    // 更新项目进度为完成
    await app.inject({
      method: "PATCH",
      url: `/api/solofocus/projects/${project.id}`,
      payload: { progress: 100, status: "completed" }
    });

    // 8. 向内沉淀：触发专属个人 SOP 经验萃取
    const extractRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/agent/extract-sop",
      payload: { projectId: project.id }
    });
    expect(extractRes.statusCode).toBe(200);
    const extractData = JSON.parse(extractRes.payload);
    expect(extractData.success).toBe(true);
    expect(extractData.draft).toBeDefined();
    expect(extractData.draft.steps.length).toBeGreaterThanOrEqual(2);

    // 9. 将萃取的专属 SOP 确认入库
    const saveSopRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/sops",
      payload: {
        title: "专属：商业化版本端到端验收规程",
        category: extractData.draft.category,
        summary: extractData.draft.summary,
        steps: extractData.draft.steps
      }
    });
    expect(saveSopRes.statusCode).toBe(200);

    // 10. 资产复用验证：新建第二期项目时，专属 SOP 是否能被智能匹配推荐
    const secondProjectName = "第二期商业化交付验收与版本迭代";
    const secondRecRes = await app.inject({
      method: "POST",
      url: "/api/solofocus/agent/recommend-sops",
      payload: { projectName: secondProjectName, domainId }
    });
    expect(secondRecRes.statusCode).toBe(200);
    const secondRecs = JSON.parse(secondRecRes.payload);
    const matchedCustom = secondRecs.find((r: any) => r.title.includes("专属：商业化版本端到端验收规程"));
    expect(matchedCustom).toBeDefined();
    expect(matchedCustom.stepCount).toBeGreaterThanOrEqual(2);
  });

  it("verifies Quick Capture NLP parsing + insertion AND Evening Shutdown ritual unloading", async () => {
    const formatLocalDate = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const todayStr = formatLocalDate(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    // 1. 模拟用户通过全局闪念 HUD 输入快速指令
    const rawInput1 = "实施支付收银台安全风控 @今天 !critical ~45m";
    const parsed1 = (await import("../../client/solofocus/utils/quickCaptureParser.js")).parseQuickTaskInput(
      rawInput1,
      [],
      new Date()
    );
    expect(parsed1.title).toBe("实施支付收银台安全风控");
    expect(parsed1.priority).toBe("CRITICAL");
    expect(parsed1.scheduledDate).toBe(todayStr);
    expect(parsed1.estimatedMinutes).toBe(45);

    // 写入数据库
    const task1Res = await app.inject({
      method: "POST",
      url: "/api/solofocus/tasks",
      payload: {
        title: parsed1.title,
        priority: parsed1.priority,
        scheduledDate: parsed1.scheduledDate,
        estimatedMinutes: parsed1.estimatedMinutes
      }
    });
    expect(task1Res.statusCode).toBe(201);
    const task1 = JSON.parse(task1Res.payload);

    // 第二个闪念待办
    const rawInput2 = "分析前沿竞品定价体系与功能矩阵 @今天 !high ~60m";
    const parsed2 = (await import("../../client/solofocus/utils/quickCaptureParser.js")).parseQuickTaskInput(
      rawInput2,
      [],
      new Date()
    );
    const task2Res = await app.inject({
      method: "POST",
      url: "/api/solofocus/tasks",
      payload: {
        title: parsed2.title,
        priority: parsed2.priority,
        scheduledDate: parsed2.scheduledDate,
        estimatedMinutes: parsed2.estimatedMinutes
      }
    });
    expect(task2Res.statusCode).toBe(201);
    const task2 = JSON.parse(task2Res.payload);

    // 2. 验证两项待办出现在今日清单中
    const bootBefore = JSON.parse((await app.inject({ method: "GET", url: "/api/solofocus/bootstrap" })).payload);
    const todayTasksBefore = bootBefore.tasks.filter((t: any) => t.scheduledDate === todayStr && t.status !== "done");
    expect(todayTasksBefore.some((t: any) => t.id === task1.id)).toBe(true);
    expect(todayTasksBefore.some((t: any) => t.id === task2.id)).toBe(true);

    // 3. 模拟日落仪式（Evening Shutdown）：
    // 用户完成 task1，而 task2 未完成；未完成的 task2 选择顺延到明天
    // 同时创建一个 task3 选择退回待办池
    await app.inject({ method: "POST", url: `/api/solofocus/tasks/${encodeURIComponent(task1.id)}/toggle` }); // 完成

    const task3Res = await app.inject({
      method: "POST",
      url: "/api/solofocus/tasks",
      payload: {
        title: "非紧急事务：整理桌面工作区",
        scheduledDate: todayStr,
        priority: "LOW"
      }
    });
    const task3 = JSON.parse(task3Res.payload);

    // 执行关机卸载操作：
    // task2 -> 顺延至明天
    const unloadTask2Res = await app.inject({
      method: "PATCH",
      url: `/api/solofocus/tasks/${encodeURIComponent(task2.id)}`,
      payload: { scheduledDate: tomorrowStr }
    });
    expect(unloadTask2Res.statusCode).toBe(200);

    // task3 -> 退回待办池（清除 scheduledDate）
    const unloadTask3Res = await app.inject({
      method: "PATCH",
      url: `/api/solofocus/tasks/${encodeURIComponent(task3.id)}`,
      payload: { scheduledDate: null }
    });
    expect(unloadTask3Res.statusCode).toBe(200);

    // 4. 验证关机卸载后状态：测试待办在今日未完成清单中彻底清零！
    const bootAfter = JSON.parse((await app.inject({ method: "GET", url: "/api/solofocus/bootstrap" })).payload);
    const testPendingTodayAfter = bootAfter.tasks.filter(
      (t: any) => [task1.id, task2.id, task3.id].includes(t.id) && t.scheduledDate === todayStr && t.status !== "done"
    );
    expect(testPendingTodayAfter.length).toBe(0);

    // task2 成功进入明天
    const freshTask2 = bootAfter.tasks.find((t: any) => t.id === task2.id);
    expect(freshTask2.scheduledDate).toBe(tomorrowStr);

    // task3 成功退回收件待办池（scheduledDate 为 null/空）
    const freshTask3 = bootAfter.tasks.find((t: any) => t.id === task3.id);
    expect(freshTask3.scheduledDate).toBeFalsy();
  });
});
