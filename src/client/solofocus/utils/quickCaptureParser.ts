import type { ProjectItem, TaskPriority } from "../../../shared/solofocus-models";

export interface ParsedQuickTask {
  raw: string;
  title: string;
  scheduledDate?: string;
  dateLabel?: string;
  priority: TaskPriority;
  priorityLabel?: string;
  estimatedMinutes: number;
  projectId?: string;
  projectName?: string;
}

export function parseQuickTaskInput(
  rawInput: string,
  projects: ProjectItem[] = [],
  baseDate: Date = new Date()
): ParsedQuickTask {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      raw: "",
      title: "",
      priority: "NORMAL",
      estimatedMinutes: 30
    };
  }

  let text = trimmed;
  let scheduledDate: string | undefined;
  let dateLabel: string | undefined;
  let priority: TaskPriority = "NORMAL";
  let priorityLabel: string | undefined;
  let estimatedMinutes = 30;
  let projectId: string | undefined;
  let projectName: string | undefined;

  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 1. Parse Date (@今天, @明天, @后天, @YYYY-MM-DD, @today, @tomorrow)
  const dateRegex = /@(\d{4}-\d{2}-\d{2}|今天|明天|后天|today|tomorrow)(?=\s|$)/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const rawVal = dateMatch[1].toLowerCase();
    if (rawVal === "今天" || rawVal === "today") {
      scheduledDate = formatDate(baseDate);
      dateLabel = "今天";
    } else if (rawVal === "明天" || rawVal === "tomorrow") {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + 1);
      scheduledDate = formatDate(d);
      dateLabel = "明天";
    } else if (rawVal === "后天") {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + 2);
      scheduledDate = formatDate(d);
      dateLabel = "后天";
    } else {
      scheduledDate = dateMatch[1];
      dateLabel = dateMatch[1];
    }
    text = text.replace(dateMatch[0], " ");
  }

  // 2. Parse Priority (!critical, !high, !low, !p0, !p1, !p3, !最高, !紧急, !高, !低)
  const priorityRegex = /!(critical|p0|最高|紧急|high|p1|高|low|p3|低)(?=\s|$)/i;
  const prioMatch = text.match(priorityRegex);
  if (prioMatch) {
    const pVal = prioMatch[1].toLowerCase();
    if (["critical", "p0", "最高", "紧急"].includes(pVal)) {
      priority = "CRITICAL";
      priorityLabel = "最高 (CRITICAL)";
    } else if (["high", "p1", "高"].includes(pVal)) {
      priority = "HIGH";
      priorityLabel = "高优先级 (HIGH)";
    } else if (["low", "p3", "低"].includes(pVal)) {
      priority = "LOW";
      priorityLabel = "低优先级 (LOW)";
    }
    text = text.replace(prioMatch[0], " ");
  }

  // 3. Parse Estimated Time (~30m, ~1h, ~45分, ~90)
  const timeRegex = /~(\d+)(h|m|min|小时|分|分钟)?(?=\s|$)/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    const num = parseInt(timeMatch[1], 10);
    const unit = (timeMatch[2] || "m").toLowerCase();
    if (unit.startsWith("h") || unit.includes("小时")) {
      estimatedMinutes = num * 60;
    } else {
      estimatedMinutes = num;
    }
    text = text.replace(timeMatch[0], " ");
  }

  // 4. Parse Project (#项目名称)
  const projectRegex = /#([^\s#]+)(?=\s|$)/;
  const projMatch = text.match(projectRegex);
  if (projMatch) {
    const projQuery = projMatch[1].toLowerCase();
    const matched = projects.find((p) =>
      p.name.toLowerCase().includes(projQuery)
    );
    if (matched) {
      projectId = matched.id;
      projectName = matched.name;
    } else {
      projectName = projMatch[1];
    }
    text = text.replace(projMatch[0], " ");
  }

  // 5. Clean Title
  const cleanTitle = text.replace(/\s+/g, " ").trim();
  const finalTitle = cleanTitle.length > 0 ? cleanTitle : trimmed;

  return {
    raw: trimmed,
    title: finalTitle,
    scheduledDate,
    dateLabel,
    priority,
    priorityLabel,
    estimatedMinutes,
    projectId,
    projectName
  };
}
