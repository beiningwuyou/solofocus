import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SoloFocusEmailService, EMAIL_PRESETS } from "./email-service.js";
import { SoloFocusRepository } from "./repository.js";

describe("SoloFocusEmailService", () => {
  let tempDir: string;
  let repo: SoloFocusRepository;
  let emailService: SoloFocusEmailService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "solofocus-email-test-"));
    const dbPath = path.join(tempDir, "test.db");
    repo = new SoloFocusRepository(dbPath);
    emailService = new SoloFocusEmailService(repo, tempDir);
  });

  afterEach(() => {
    try {
      repo.close();
    } catch {
      // ignore
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should have correct default config and support saving with masking", () => {
    const defaultCfg = emailService.getConfig();
    expect(defaultCfg.enabled).toBe(false);
    expect(defaultCfg.imapHost).toBe("imap.exmail.qq.com");
    expect(defaultCfg.hasPassword).toBe(false);

    // Save configuration
    const saved = emailService.saveConfig({
      enabled: true,
      username: "alex@company.com",
      password: "secret_auth_code",
      preset: "qq_enterprise"
    });
    expect(saved.enabled).toBe(true);
    expect(saved.username).toBe("alex@company.com");
    expect(saved.hasPassword).toBe(true);

    // Masked config check
    const masked = emailService.getMaskedConfig();
    expect(masked.password).toBe("••••••••");
    expect(masked.hasPassword).toBe(true);
  });

  it("should filter out notifications and ads in heuristic distiller", () => {
    const dummyProjects = [
      { id: "p-1", name: "工作台2.0", domainId: "d-1", description: "", status: "active" as const, progress: 0, createdAt: "", updatedAt: "" }
    ];

    const spamEmail = {
      subject: "【系统自动发送】您有一笔账单流水待核对",
      from: "noreply@bank.com",
      date: new Date(),
      messageId: "msg-spam-1",
      bodyText: "这是系统自动发送的邮件流水，请勿回复，unsubscribe"
    };

    const candidate = emailService.heuristicDistill(spamEmail, dummyProjects);
    expect(candidate).toBeNull();
  });

  it("should extract actionable items and match project", () => {
    const dummyProjects = [
      { id: "p-workbench", name: "工作台2.0", domainId: "d-1", description: "", status: "active" as const, progress: 0, createdAt: "", updatedAt: "" }
    ];

    const actionEmail = {
      subject: "Re: 工作台2.0 架构方案请在今日确认并反馈",
      from: "architect@company.com",
      date: new Date(),
      messageId: "msg-action-1",
      bodyText: "张工，请尽快 review 并审批工作台2.0 的接口改造方案，这非常紧急，谢谢！"
    };

    const candidate = emailService.heuristicDistill(actionEmail, dummyProjects);
    expect(candidate).not.toBeNull();
    expect(candidate?.extractedTitle).toContain("架构方案请在今日确认并反馈");
    expect(candidate?.suggestedPriority).toBe("CRITICAL"); // 包含“尽快”与“紧急”
    expect(candidate?.suggestedProjectId).toBe("p-workbench");
    expect(candidate?.suggestedProjectName).toBe("工作台2.0");
  });

  it("should adopt candidates and write into repository as today tasks", () => {
    const dummyCandidate = {
      id: "cand-test-1",
      messageId: "msg-12345",
      subject: "请审批预算申请",
      from: "finance@company.com",
      date: new Date().toISOString(),
      extractedTitle: "【审批】核对并确认Q3部门预算申请",
      suggestedPriority: "HIGH" as const,
      suggestedMinutes: 30,
      actionSummary: "审批Q3预算",
      fullBodySnippet: "请尽快核对"
    };

    emailService.saveCachedCandidates([dummyCandidate]);
    expect(emailService.getCachedCandidates().length).toBe(1);

    const todayStr = new Date().toISOString().slice(0, 10);
    const result = emailService.adoptTasks([
      {
        candidateId: "cand-test-1",
        title: "【审批】核对并确认Q3部门预算申请",
        priority: "HIGH",
        estimatedMinutes: 30,
        scheduledDate: todayStr,
        notes: "已与财务核对过"
      }
    ]);

    expect(result.createdCount).toBe(1);
    expect(result.taskIds.length).toBe(1);

    // Verify task in repo
    const bootstrap = repo.getBootstrap();
    const createdTask = bootstrap.tasks.find((t) => t.id === result.taskIds[0]);
    expect(createdTask).toBeDefined();
    expect(createdTask?.title).toBe("【审批】核对并确认Q3部门预算申请");
    expect(createdTask?.scheduledDate).toBe(todayStr);
    expect(createdTask?.priority).toBe("HIGH");
    expect(createdTask?.description).toContain("finance@company.com");

    // Candidate should be cleared from cache
    expect(emailService.getCachedCandidates().length).toBe(0);

    // MessageId should be recorded as synced
    expect(emailService.getSyncedEmailIds().has("msg-12345")).toBe(true);
  });

  it("should dismiss candidate and record into synced IDs", () => {
    const dummyCandidate = {
      id: "cand-dismiss-1",
      messageId: "msg-dismiss-1",
      subject: "某某活动邀请",
      from: "event@company.com",
      date: new Date().toISOString(),
      extractedTitle: "参加行业沙龙",
      suggestedPriority: "NORMAL" as const,
      suggestedMinutes: 60,
      actionSummary: "参加活动"
    };

    emailService.saveCachedCandidates([dummyCandidate]);
    const res = emailService.dismissCandidates(["cand-dismiss-1"]);
    expect(res.dismissedCount).toBe(1);
    expect(emailService.getCachedCandidates().length).toBe(0);
    expect(emailService.getSyncedEmailIds().has("msg-dismiss-1")).toBe(true);
  });
});
