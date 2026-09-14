import { describe, it, expect } from "vitest";
import { parseQuickTaskInput } from "../../client/solofocus/utils/quickCaptureParser";
import type { ProjectItem } from "../../shared/solofocus-models";

describe("parseQuickTaskInput", () => {
  const mockProjects: ProjectItem[] = [
    {
      id: "proj-1",
      name: "个人工作台重构",
      domainId: "dom-1",
      description: "个人工作台重构项目",
      status: "active",
      targetDate: "2026-10-01",
      progress: 60,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      milestones: []
    },
    {
      id: "proj-2",
      name: "AI 商业化交付",
      domainId: "dom-2",
      description: "AI 商业化交付项目",
      status: "planning" as any,
      targetDate: "2026-11-01",
      progress: 20,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      milestones: []
    }
  ];

  const baseDate = new Date("2026-09-13T10:00:00Z");

  it("should parse normal text with defaults", () => {
    const result = parseQuickTaskInput("修复登录按钮无响应的缺陷", mockProjects, baseDate);
    expect(result.title).toBe("修复登录按钮无响应的缺陷");
    expect(result.priority).toBe("NORMAL");
    expect(result.estimatedMinutes).toBe(30);
    expect(result.scheduledDate).toBeUndefined();
    expect(result.projectId).toBeUndefined();
  });

  it("should parse @今天 and !high tags", () => {
    const result = parseQuickTaskInput("紧急修复支付回调接口 @今天 !high", mockProjects, baseDate);
    expect(result.title).toBe("紧急修复支付回调接口");
    expect(result.priority).toBe("HIGH");
    expect(result.scheduledDate).toBe("2026-09-13");
    expect(result.dateLabel).toBe("今天");
  });

  it("should parse @明天, !critical, ~1h, and #项目 tags", () => {
    const result = parseQuickTaskInput(
      "准备商业化上线评审PPT @明天 !critical #商业化 ~1h",
      mockProjects,
      baseDate
    );
    expect(result.title).toBe("准备商业化上线评审PPT");
    expect(result.priority).toBe("CRITICAL");
    expect(result.scheduledDate).toBe("2026-09-14");
    expect(result.dateLabel).toBe("明天");
    expect(result.estimatedMinutes).toBe(60);
    expect(result.projectId).toBe("proj-2");
    expect(result.projectName).toBe("AI 商业化交付");
  });

  it("should handle custom minutes ~45m and low priority !low", () => {
    const result = parseQuickTaskInput("梳理用户反馈文档 !low ~45m", mockProjects, baseDate);
    expect(result.title).toBe("梳理用户反馈文档");
    expect(result.priority).toBe("LOW");
    expect(result.estimatedMinutes).toBe(45);
    expect(result.scheduledDate).toBeUndefined();
  });

  it("should handle empty or whitespace input gracefully", () => {
    const result = parseQuickTaskInput("   ", mockProjects, baseDate);
    expect(result.title).toBe("");
    expect(result.priority).toBe("NORMAL");
  });
});
