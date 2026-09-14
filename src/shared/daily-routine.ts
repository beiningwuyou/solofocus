import { z } from "zod";
import { asString, todayIso, type VaultEntity } from "./domain.js";

export const routineStatusLabels = { pending: "未完成", minimum: "守住最低目标", done: "完成正常目标", rest: "休息 / 顺延" } as const;
const status = z.enum(["pending", "minimum", "done", "rest"]);
export const routineSchema = z.object({
  job: z.string().max(4000), thesis: z.string().max(4000), health: z.string().max(4000),
  tomorrow: z.string().max(4000), adjustment: z.string().max(4000),
  checks: z.object({ job: status, thesis: status, health: status })
});
export type RoutineRecord = z.infer<typeof routineSchema>;
export type RoutineKey = keyof RoutineRecord["checks"];
export const routineDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
  const parsed = new Date(`${date}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && todayIso(parsed) === date;
}, "日期无效");

export function emptyRoutine(): RoutineRecord {
  return { job: "", thesis: "", health: "", tomorrow: "", adjustment: "", checks: { job: "pending", thesis: "pending", health: "pending" } };
}
export function readRoutine(entity?: VaultEntity): RoutineRecord {
  const parsed = routineSchema.safeParse(entity?.properties.daily_routine);
  return parsed.success ? parsed.data : emptyRoutine();
}
export function dailyFor(entities: VaultEntity[], date: string) {
  return entities.find((entity) => entity.kind === "daily" && (asString(entity.properties.date) || entity.name) === date);
}
export function shiftRoutineDate(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + days);
  return todayIso(result);
}
export const routineGoals: { key: RoutineKey; title: string; normal: string; minimum: string }[] = [
  { key: "job", title: "求职", normal: "投递 1–2 个匹配岗位，或完成一次有明确内容的笔面试准备。", minimum: "提交一份合格申请、跟进一次进度，或录制并回看一道项目面试题。" },
  { key: "thesis", title: "论文", normal: "修改一个小节、解决一处论证问题，或核实一组关键证据。", minimum: "专注 25 分钟，留下实质改动，例如修好一个段落并核实引用。" },
  { key: "health", title: "健康与生活", normal: "按计划训练或恢复，正常吃饭，按时结束工作。", minimum: "保住吃饭、基本活动和睡眠；不因工作欠账压缩休息。" }
];
export const weeklyRoutine = [
  "周日原则上休息；晚上用 15 分钟确认下周固定事项。",
  "周一下午：推进同一个代表案例，不并行开新项目。",
  "周二下午：面试演练、找人评价材料、处理反馈；正式面试直接替换。",
  "周三下午：继续同一个代表案例，不并行开新项目。",
  "周四下午：面试演练、找人评价材料、处理反馈；正式面试直接替换。",
  "周五下午：简短复盘本周投递和论文进展，安排下周。",
  "周六最多安排半天补缺口，留半天处理生活和社交。"
];
export type RoutineSlot = { start: string; end?: string; title: string; detail: string; core?: boolean };
const weekdaySlots: RoutineSlot[] = [
  { start: "06:30", end: "07:00", title: "起床、洗漱", detail: "收拾自己和房间，不打开新闻、模型资讯和项目推荐。" },
  { start: "07:00", end: "07:40", title: "早餐、走动", detail: "吃饭，缓慢进入工作状态。" },
  { start: "07:40", end: "08:00", title: "确定当天交付", detail: "写下求职动作、论文成果各一项，确认面试等固定事项。" },
  { start: "08:00", end: "09:30", title: "秋招核心时段", detail: "定向投递、近期面试或笔试准备，选一项作为重点，避免一直浏览岗位。", core: true },
  { start: "09:30", end: "09:45", title: "休息", detail: "离开屏幕、走动。" },
  { start: "09:45", end: "11:15", title: "论文核心时段", detail: "写作、修改论证、核验证据；提前确定章节或问题。", core: true },
  { start: "11:15", end: "11:30", title: "保存与收尾", detail: "记录完成了什么、下次从哪里继续，不再开新任务。" },
  { start: "11:30", end: "12:15", title: "午饭、休息", detail: "正常吃饭。" },
  { start: "12:15", end: "12:45", title: "午间休息", detail: "闭目休息或短暂午睡。" },
  { start: "12:45", end: "13:00", title: "出门准备", detail: "留出前往健身的准备时间。" },
  { start: "13:00", end: "15:00", title: "健身或恢复", detail: "按现有训练安排运动；休息日散步、恢复，不要求每天高强度训练。" },
  { start: "15:00", end: "15:45", title: "恢复、整理", detail: "洗澡、补充饮食、返回工作地点，不急着进入高强度任务。" },
  { start: "15:45", end: "17:00", title: "下午工作时段", detail: "优先面试、联系与反馈；没有固定安排时推进代表案例或补上午缺口。", core: true },
  { start: "17:00", end: "17:30", title: "集中处理杂事", detail: "邮件、招聘消息、导师消息、投递记录；非紧急事项集中处理。" },
  { start: "17:30", end: "18:30", title: "晚饭、散步", detail: "晚饭区间可随实际作息调整。" },
  { start: "18:30", end: "19:15", title: "轻量准备", detail: "练一道面试题、熟悉目标公司，或解决当天一个知识缺口。" },
  { start: "19:15", end: "19:30", title: "每日收尾", detail: "记录实际成果，写好明天第一个动作，关闭工作。" },
  { start: "19:30", end: "21:30", title: "自由与放松", detail: "社交、阅读、娱乐、整理生活，不要求产出，不启动新项目。" },
  { start: "21:30", title: "洗漱、准备睡觉", detail: "不用晚间加班补偿白天没完成的全部计划。" }
];
export function routineSlots(date: string): RoutineSlot[] {
  const day = new Date(`${date}T12:00:00`).getDay();
  if (day !== 0 && day !== 6) return weekdaySlots;
  return [
    { start: "06:30", end: "08:00", title: "起床、早餐", detail: "按实际状态开始一天。" },
    { start: "08:00", end: "11:30", title: day === 6 ? "可选：半天补缺口" : "休息与生活", detail: day === 6 ? "只补一个关键缺口，也可以休息。" : "原则上休息，不安排常规求职和论文工作块。" },
    ...weekdaySlots.filter((slot) => slot.start >= "11:30" && slot.start < "15:45"),
    { start: "15:45", end: "17:30", title: "生活、社交与休息", detail: "周六留半天处理生活和社交；周日继续休息。" },
    weekdaySlots[14],
    { start: "18:30", end: "21:30", title: "自由与放松", detail: day === 0 ? "其中用 15 分钟确认下周固定事项，其余时间休息。" : "不要求额外产出。" },
    weekdaySlots[18]
  ];
}
