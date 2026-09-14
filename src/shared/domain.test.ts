import { describe, expect, it } from "vitest";
import { goalProgress, keyResultProgress, parseScheduleExpression, planProgress, projectProgress, projectTaskCompletion, visionProgress, type VaultEntity } from "./domain.js";

function entity(name: string, kind: VaultEntity["kind"], properties: VaultEntity["properties"]): VaultEntity {
  return { id: name, path: `${name}.md`, name, kind, revision: "r", body: "", properties, modifiedAt: "" };
}

describe("progress calculations", () => {
  it("calculates a normalized key result", () => {
    expect(keyResultProgress(entity("KR", "key_result", { start_value: 10, current_value: 30, target_value: 50 }))).toBe(50);
  });

  it("weights key results instead of counting tasks", () => {
    const goal = entity("年度储蓄", "goal", {});
    const entities = [
      goal,
      entity("收入", "key_result", { goal: "[[年度储蓄]]", start_value: 0, current_value: 50, target_value: 100, weight: 80 }),
      entity("支出", "key_result", { goal: "[[年度储蓄]]", start_value: 0, current_value: 100, target_value: 100, weight: 20 })
    ];
    expect(goalProgress(goal, entities)).toBe(60);
  });

  it("reports task completion separately from project outcome progress", () => {
    const project = entity("工作台", "project", {});
    const entities = [
      project,
      entity("设计稿", "task", { project: "[[工作台]]", status: "done" }),
      entity("前端开发", "task", { project: "[[工作台]]", status: "done" }),
      entity("上线部署", "task", { project: "[[工作台]]", status: "todo" })
    ];
    expect(projectTaskCompletion(project, entities)).toBe(67);
    expect(projectProgress(project, entities)).toBe(0);
  });

  it("calculates a short plan from its task checklist", () => {
    const plan = entity("本周推进", "plan", { project: "[[工作台]]" });
    const entities = [
      plan,
      entity("任务一", "task", { plan: "[[本周推进]]", status: "done" }),
      entity("任务二", "task", { plan: "[[本周推进]]", status: "todo" }),
      entity("任务三", "task", { plan: "[[本周推进]]", status: "cancelled" })
    ];
    expect(planProgress(plan, entities)).toBe(67);
  });

  it("calculates project progress from weighted milestones", () => {
    const project = entity("工作台", "project", {});
    const first = entity("可用版本", "milestone", { project: "[[工作台]]", progress: 75, weight: 2 });
    const second = entity("稳定版本", "milestone", { project: "[[工作台]]", progress: 0, weight: 1 });
    const entities = [
      project, first, second,
      entity("已完成活动", "task", { project: "[[工作台]]", status: "done" })
    ];
    expect(projectProgress(project, entities)).toBe(50);
  });

  it("derives a vision from its weighted long-term projects", () => {
    const vision = entity("长期独立生活", "vision", {});
    const first = entity("职业项目", "project", { vision: "[[长期独立生活]]", weight: 2 });
    const second = entity("财务项目", "project", { vision: "[[长期独立生活]]", weight: 1 });
    const firstMilestone = entity("职业结果", "milestone", { project: "[[职业项目]]", progress: 100 });
    const secondMilestone = entity("财务结果", "milestone", { project: "[[财务项目]]", progress: 0 });
    const entities = [
      vision, first, second, firstMilestone, secondMilestone
    ];
    expect(visionProgress(vision, entities)).toBe(67);
  });
});

import { nextScheduleOccurrence } from "./domain.js";

describe("agent employee schedule", () => {
  it("parses simple cron expressions", () => {
    expect(parseScheduleExpression("0 9 * * 1-5").label).toBe("工作日 09:00");
  });

  it("computes next occurrence using UTC components (no local-tz drift)", () => {
    const expr = parseScheduleExpression("*/30 8-18 * * *");
    // 输入是 UTC 07:15，下一个匹配点应该是 08:00 UTC（小时必须落在 8-18 区间）
    expect(nextScheduleOccurrence(expr, new Date("2026-08-06T07:15:00Z"))).toBe("2026-08-06T08:00:00.000Z");
    // 已经落在 8-18 区间内，匹配下一个半点的边界
    expect(nextScheduleOccurrence(expr, new Date("2026-08-06T08:25:00Z"))).toBe("2026-08-06T08:30:00.000Z");
  });

  it("rolls over to next valid weekday for daily work-hour schedules", () => {
    // Thu 10:00 UTC 之后，下一个工作日 09:00 UTC = Fri 09:00 UTC
    expect(nextScheduleOccurrence(parseScheduleExpression("0 9 * * 1-5"), new Date("2026-08-06T10:00:00Z"))).toBe("2026-08-07T09:00:00.000Z");
  });
});
