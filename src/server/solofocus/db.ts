import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveDatabasePath(): string {
  if (process.env.SOLOFOCUS_DB_PATH) {
    return process.env.SOLOFOCUS_DB_PATH;
  }
  const appSupport = path.join(os.homedir(), "Library", "Application Support", "个人工作台");
  try {
    if (!fs.existsSync(appSupport)) {
      fs.mkdirSync(appSupport, { recursive: true });
    }
    return path.join(appSupport, "solofocus.db");
  } catch {
    const localData = path.resolve(__dirname, "../../../data");
    if (!fs.existsSync(localData)) {
      fs.mkdirSync(localData, { recursive: true });
    }
    return path.join(localData, "solofocus.db");
  }
}

let dbInstance: DatabaseSync | null = null;

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}

const DEFAULT_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT,
  mission TEXT NOT NULL,
  principles TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  target_date TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  agent_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  target_date TEXT,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  milestone_id TEXT,
  domain_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL DEFAULT 'formal',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'todo',
  scheduled_date TEXT,
  due_date TEXT,
  estimated_minutes INTEGER,
  timer_seconds INTEGER DEFAULT 0,
  checklist TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  domain_id TEXT,
  name TEXT NOT NULL,
  template TEXT,
  window TEXT NOT NULL DEFAULT 'morning',
  mva TEXT NOT NULL,
  notes TEXT,
  streak_days INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  punch_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(habit_id, punch_date),
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sops (
  id TEXT PRIMARY KEY,
  domain_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'routine',
  summary TEXT NOT NULL,
  total_steps INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sop_steps (
  id TEXT PRIMARY KEY,
  sop_id TEXT NOT NULL,
  step_num INTEGER NOT NULL,
  phase_title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  checklist_items TEXT NOT NULL,
  FOREIGN KEY (sop_id) REFERENCES sops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS archives (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  archived_at TEXT NOT NULL,
  snapshot_data TEXT
);

CREATE TABLE IF NOT EXISTS trash (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  is_valid INTEGER NOT NULL DEFAULT 1
);
`;

export function getDatabase(customPath?: string): DatabaseSync {
  if (customPath) {
    const isNew = !fs.existsSync(customPath) || fs.statSync(customPath).size === 0;
    const db = new DatabaseSync(customPath);
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    const schemaPath = path.resolve(__dirname, "schema.sql");
    let ddl = DEFAULT_SCHEMA_DDL;
    if (fs.existsSync(schemaPath)) {
      try {
        ddl = fs.readFileSync(schemaPath, "utf-8");
      } catch {
        // use DEFAULT_SCHEMA_DDL
      }
    }
    db.exec(ddl);

    const checkStmt = db.prepare("SELECT COUNT(*) as count FROM domains");
    const res = checkStmt.get() as { count: number } | undefined;
    if (!res || res.count === 0) {
      seedDatabase(db);
    }
    return db;
  }

  if (!dbInstance) {
    const dbPath = resolveDatabasePath();
    const isNew = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0;
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec("PRAGMA busy_timeout = 5000;");
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");

    const schemaPath = path.resolve(__dirname, "schema.sql");
    let ddl = DEFAULT_SCHEMA_DDL;
    if (fs.existsSync(schemaPath)) {
      try {
        ddl = fs.readFileSync(schemaPath, "utf-8");
      } catch {
        // use DEFAULT_SCHEMA_DDL
      }
    }
    dbInstance.exec(ddl);

    // Seed if empty
    const checkStmt = dbInstance.prepare("SELECT COUNT(*) as count FROM domains");
    const res = checkStmt.get() as { count: number } | undefined;
    if (!res || res.count === 0) {
      seedDatabase(dbInstance);
    }
  }
  return dbInstance;
}

export function seedDatabase(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Helper for generating dates relative to today
  function offsetDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // 1. Domains
  const insertDomain = db.prepare(`
    INSERT INTO domains (id, name, code, icon, color, mission, principles, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDomain.run(
    "dom_work",
    "工作与交付",
    "work",
    "terminal",
    "#016d35",
    "专注打造能经受长期日用检验的个人数字化操作系统，以单机纯离线、极高响应速度和确定性为核心标准。",
    JSON.stringify([
      "架构原则：所有持久化模型均须保证单一真实源。",
      "SQLite Schema 迁移脚本必须向后兼容至少 2 个主版本。",
      "任何破坏性写入操作必须要求双重安全确认。"
    ]),
    "架构原则：所有持久化模型均须保证单一真实源。SQLite Schema 迁移脚本必须向后兼容至少 2 个主版本。",
    now,
    now
  );

  insertDomain.run(
    "dom_arch",
    "系统与架构",
    "infra",
    "hub",
    "#195bb0",
    "攻坚离线优先与分布式架构设计，保障长期基础设施自主可控与健壮演进。",
    JSON.stringify([
      "零外部网络强依赖，默认断网可完整运行。",
      "本地响应延迟严格压制在 2ms 以内。"
    ]),
    "核心关注单机多进程快照、WAL 日志持久化及容灾自愈链路。",
    now,
    now
  );

  insertDomain.run(
    "dom_cognition",
    "认知与输入",
    "cognition",
    "psychology",
    "#945300",
    "技术精读、深度研读与知识体系沉淀，保持敏锐判断力与长期心流体验。",
    JSON.stringify([
      "每周至少精读一篇核心系统论文或架构源码。",
      "阅读必须沉淀为可被 SOP 复用的标准工作流。"
    ]),
    "重点突破 Rust 调度内核与单机嵌入式状态机。",
    now,
    now
  );

  insertDomain.run(
    "dom_health",
    "身心健康",
    "wellness",
    "favorite",
    "#d9383a",
    "维持良好身心机能与能量供给，为长期持续创作提供坚实体魄支撑。",
    JSON.stringify([
      "每日保证 2000ml 饮水与适度拉伸。",
      "避免连续 3 小时以上僵坐。"
    ]),
    "晨间活力激活与作息规律保障。",
    now,
    now
  );

  insertDomain.run(
    "dom_finance",
    "财务与资产",
    "finance",
    "account_balance",
    "#2e7d32",
    "收支健康、风险可控、资产复利增长。",
    JSON.stringify([
      "每月首周核对全部财务流水与本地账目。",
      "非必要订阅每季度统一清理一次。"
    ]),
    "本地纯离线记账与资产快照。",
    now,
    now
  );

  // 2. Projects & Milestones
  const insertProject = db.prepare(`
    INSERT INTO projects (id, domain_id, name, description, status, target_date, progress, agent_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMilestone = db.prepare(`
    INSERT INTO milestones (id, project_id, seq, name, status, target_date, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertProject.run(
    "proj_solofocus",
    "dom_work",
    "打造个人数字化操作系统与专注工作台",
    "基于单机离线优先架构（SQLite + Local First），构建属于个人的高密度任务调度与长效心流工作台。彻底剥离网络噪音，实现毫秒级即刻响应与数据 100% 自主掌控。",
    "active",
    offsetDate(17),
    75,
    "【Agent 自动提炼 · 今日进展】已完成今日重点任务的梳理与时间预算对齐，核心链路进入高保真验证，建议保持专注、优先攻坚前三交付事项。",
    now,
    now
  );
  insertMilestone.run("ms_01", "proj_solofocus", 1, "第一阶段：建立今日心流桌面与抽屉操作台", "in_progress", offsetDate(3), null);
  insertMilestone.run("ms_02", "proj_solofocus", 2, "第二阶段：沉淀标准化 SOP 复用库与习惯节律", "ready", offsetDate(10), null);
  insertMilestone.run("ms_03", "proj_solofocus", 3, "第三阶段：全量离线容灾备份与本地交付打包", "planning", offsetDate(17), null);

  insertProject.run(
    "proj_sqlite",
    "dom_arch",
    "极简知识库与离线数据自愈系统",
    "基于纯本地单机存储打造个人专属数字资产库，支持高可靠 WAL 事务持久化、冷备份快照与零云端依赖私密保护。",
    "active",
    offsetDate(32),
    50,
    "WAL 事务日志机制与冷备份快照已就绪，当前数据读写延迟控制在 1ms 以内。",
    now,
    now
  );
  insertMilestone.run("ms_sql_01", "proj_sqlite", 1, "知识资产分类架构与离线自愈评测", "in_progress", offsetDate(15), null);

  insertProject.run(
    "proj_rust",
    "dom_health",
    "身心健康与高能精力管理系统",
    "通过规律作息、有氧体能、水分补给与睡眠节律，构建坚实的身心机能，为长期高效深度创作提供充沛能量支撑。",
    "active",
    offsetDate(68),
    40,
    "连续 14 天达成晨间饮水与肩颈拉伸，午后精力状态显著提升。",
    now,
    now
  );

  // 3. Tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, milestone_id, domain_id, title, description, mode, priority, status, scheduled_date, due_date, estimated_minutes, timer_seconds, checklist, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    "#T-0941",
    "proj_solofocus",
    "ms_01",
    "dom_work",
    "【核心攻坚】完成工作台今日重点任务梳理与工序分解",
    "面向今日深度心流工作，将核心目标拆解为可独立推进的原子检查项，预估专注番茄钟，排除外界噪音干扰，确保关键价值闭环。",
    "formal",
    "CRITICAL",
    "in_progress",
    today,
    `${today} 18:00`,
    45,
    1500,
    JSON.stringify([
      { id: "c1", title: "回顾本周关键里程碑并确认当前卡点", isCompleted: true },
      { id: "c2", title: "锁定今日前 3 项高优先级交付任务", isCompleted: true },
      { id: "c3", title: "为每个核心任务设定清晰的交付验收标准", isCompleted: false },
      { id: "c4", title: "开启桌面专注模式，进入首个 45 分钟沉浸心流块", isCompleted: false }
    ]),
    now,
    now,
    null
  );

  insertTask.run(
    "#T-0942",
    "proj_solofocus",
    "ms_02",
    "dom_work",
    "【方案制定】沉淀个人标准作业程序（SOP）实操手册",
    "将周度复盘、日常深度专注与版本发布的最佳实践沉淀为可复用的 SOP 模版，降低未来思考心智负担。",
    "formal",
    "HIGH",
    "todo",
    offsetDate(1),
    `${offsetDate(1)} 12:00`,
    60,
    0,
    JSON.stringify([
      { id: "c21", title: "梳理周复盘 6 步标准流程", isCompleted: false },
      { id: "c22", title: "编写心流激活与专注环境准备清单", isCompleted: false }
    ]),
    now,
    now,
    null
  );

  insertTask.run(
    "#T-0943",
    "proj_sqlite",
    "ms_sql_01",
    "dom_arch",
    "【安全自愈】演练本地物理数据库断电自愈与快照恢复",
    "测试 SQLite WAL 模式下的高并发读写稳定性，演练一键恢复与双重校验安全锁，防止误操作。",
    "formal",
    "NORMAL",
    "todo",
    offsetDate(3),
    `${offsetDate(3)} 18:00`,
    45,
    0,
    JSON.stringify([]),
    now,
    now,
    null
  );

  insertTask.run(
    "#T-0944",
    "proj_solofocus",
    "ms_01",
    "dom_work",
    "【日常管理】核对本月重要收支账目与离线数据备份",
    "核对近期财务流水支出，完成本地数据库快照留存，确保数据安全自愈与资产清晰。",
    "formal",
    "HIGH",
    "done",
    today,
    `${today} 14:00`,
    35,
    2100,
    JSON.stringify([
      { id: "c41", title: "核对当日支出账单并记录本地流水", isCompleted: true },
      { id: "c42", title: "执行本地数据库快照留存与完整性校验", isCompleted: true }
    ]),
    now,
    now,
    now
  );

  insertTask.run(
    "#T-0945",
    "proj_sqlite",
    null,
    "dom_work",
    "【技术方案】梳理纯本地离线优先架构设计规范",
    "明确零外部网络依赖、单机极速响应与本地持久化单一真实源原则。",
    "formal",
    "NORMAL",
    "done",
    offsetDate(-2),
    null,
    60,
    3600,
    JSON.stringify([]),
    now,
    now,
    offsetDate(-2)
  );

  insertTask.run(
    "#T-0946",
    "proj_solofocus",
    null,
    "dom_work",
    "重构个人周报与成就自动提炼 Markdown 模版",
    "根据一周完成任务与工单历史，一键生成结构化复盘手记。",
    "adhoc",
    "LOW",
    "todo",
    null,
    null,
    30,
    0,
    JSON.stringify([]),
    now,
    now,
    null
  );

  insertTask.run(
    "#T-0947",
    null,
    null,
    "dom_arch",
    "如何打造属于自己的低噪音数字化生活系统？",
    "随时随地捕捉的灵感：关注真正重要的长期目标，剥离多余通知和社交媒体干扰。待分配到具体领域或项目。",
    "inbox",
    "LOW",
    "todo",
    null,
    null,
    20,
    0,
    JSON.stringify([]),
    now,
    now,
    null
  );

  insertTask.run(
    "#T-0948",
    "proj_rust",
    null,
    "dom_health",
    "制定下周有氧体能训练计划与健康饮食食谱",
    "规划周一、三、五的体能训练时段，准备高营养轻食搭配方案。",
    "formal",
    "HIGH",
    "todo",
    null,
    null,
    40,
    0,
    JSON.stringify([]),
    now,
    now,
    null
  );

  insertTask.run(
    "#T-0949",
    null,
    null,
    "dom_cognition",
    "梳理下半年深度阅读书单与技术专题调研计划",
    "筛选 5 本在系统架构与心流认知领域的高评价专著，安排研读节奏。",
    "adhoc",
    "LOW",
    "todo",
    null,
    null,
    25,
    0,
    JSON.stringify([]),
    now,
    now,
    null
  );

  insertTask.run(
    "#T-0950",
    "proj_solofocus",
    "ms_01",
    "dom_work",
    "【晨间交付】检视个人工作台看板并校对交互细节",
    "晨间完成工作台各模块状态自检，确认今日待办分类清晰、倒计时时钟运行正常、抽屉侧滑顺畅。",
    "formal",
    "CRITICAL",
    "done",
    today,
    `${today} 11:30`,
    30,
    1800,
    JSON.stringify([
      { id: "c51", title: "检查今日桌面与待办排期顺畅度", isCompleted: true },
      { id: "c52", title: "验证任务侧滑抽屉与检查清单编辑", isCompleted: true }
    ]),
    now,
    now,
    now
  );

  // Overdue task (for deferred section testing)
  insertTask.run(
    "#T-0940",
    "proj_solofocus",
    "ms_01",
    "dom_work",
    "【待顺延】整理桌面临时草稿与清理过期下载素材",
    "清理桌面临时工作区，将有用素材分类沉淀至数字知识库，无用缓存集中清理。昨日未完成，可一键顺延至今日。",
    "formal",
    "NORMAL",
    "todo",
    offsetDate(-1),
    `${offsetDate(-1)} 18:00`,
    25,
    0,
    JSON.stringify([]),
    now,
    now,
    null
  );

  // 4. Habits & Habit Logs
  const insertHabit = db.prepare(`
    INSERT INTO habits (id, domain_id, name, template, window, mva, notes, streak_days, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHabitLog = db.prepare(`
    INSERT INTO habit_logs (id, habit_id, punch_date, created_at)
    VALUES (?, ?, ?, ?)
  `);

  insertHabit.run(
    "h_morning",
    "dom_work",
    "晨间唤醒：梳理今日前三要务与状态确认",
    "晨间重点梳理 (工作)",
    "morning",
    "开工前在工作台确认前三优先级，确认无阻塞后开始沉浸交付。",
    "开工前先排查上游依赖，在今日工作台确认前三优先级，确认无阻塞后开始沉浸交付。",
    19,
    1,
    now,
    now
  );

  insertHabit.run(
    "h_water",
    "dom_health",
    "健康律动：充足饮水 2000ml 与肩颈拉伸",
    "深蹲拉伸 (健康)",
    "intermission",
    "接满 500ml 温水，完成 10 次深蹲拉伸肩颈。",
    "分 4 次完成，保持精力充沛。",
    14,
    1,
    now,
    now
  );

  insertHabit.run(
    "h_reading",
    "dom_cognition",
    "认知成长：深度研读高价值专著 30 分钟",
    "技术精读 (系统)",
    "evening",
    "阅读经典专著核心章节并记录两句话启发与知识卡片。",
    "保持认知前沿深度与心流沉淀。",
    8,
    1,
    now,
    now
  );

  insertHabit.run(
    "h_finance",
    "dom_finance",
    "每日财务：收支记账与本地资产流水自核",
    "收支记账 (财务)",
    "evening",
    "核对当日消费与本地账目，保持收支健康透明。",
    "保持账目清晰与开销克制。",
    5,
    1,
    now,
    now
  );

  insertHabit.run(
    "h_code",
    "dom_work",
    "心流沉淀：编写 1 篇个人实操手记",
    "工程手记",
    "evening",
    "记录当天思考权衡或踩坑经验 100 字。",
    "沉淀为长期高价值个人数字资产。",
    12,
    1,
    now,
    now
  );

  insertHabit.run(
    "h_walk",
    "dom_health",
    "晚间放空：离线散步 20 分钟舒缓身心",
    "身心放空",
    "evening",
    "出门慢走 1000 步，不带手机或开启勿扰模式。",
    "恢复心理能量，准备高质量深度睡眠。",
    7,
    1,
    now,
    now
  );

  // Insert punch logs for past 7 days for h_morning and h_water
  for (let i = -6; i <= 0; i++) {
    const d = offsetDate(i);
    insertHabitLog.run(`hl_morning_${i}`, "h_morning", d, now);
    insertHabitLog.run(`hl_water_${i}`, "h_water", d, now);
  }
  for (let i = -4; i <= 0; i++) {
    const d = offsetDate(i);
    insertHabitLog.run(`hl_reading_${i}`, "h_reading", d, now);
    insertHabitLog.run(`hl_code_${i}`, "h_code", d, now);
  }

  // 5. SOPs & Steps
  const insertSop = db.prepare(`
    INSERT INTO sops (id, domain_id, title, category, summary, total_steps, execution_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSopStep = db.prepare(`
    INSERT INTO sop_steps (id, sop_id, step_num, phase_title, instruction, checklist_items)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertSop.run(
    "sop_retro",
    "dom_work",
    "周复盘与规划流程",
    "routine",
    "每周日晚间运行的标准系统整理与心流重置机制，保障目标对齐与单机数据归档。",
    6,
    28,
    now,
    now
  );
  insertSopStep.run(
    "step_r1",
    "sop_retro",
    1,
    "01 收集阶段",
    "清空所有收件箱与临时草稿，汇总至未完成任务池。处理桌面临时笔记、输入框残留想法及各类外部抓取项，统一分类或入库，确保外部存储器全面归零。",
    JSON.stringify(["处理桌面临时笔记", "输入框残留想法统一分类入库"])
  );
  insertSopStep.run(
    "step_r2",
    "sop_retro",
    2,
    "02 清理阶段",
    "检查本周逾期与遗留任务，评估是否保留、改期或归档。避免“僵尸任务”积压产生隐性心理负荷。果断剔除不再具备优先级的待办。",
    JSON.stringify(["果断剔除无优先级任务", "对顺延任务重定交期"])
  );
  insertSopStep.run(
    "step_r3",
    "sop_retro",
    3,
    "03 归档阶段",
    "将已交付成果归档入库，生成本地 SQLite 历史快照，封存完成记录。",
    JSON.stringify(["检查已完成任务关联", "执行手动备份快照"])
  );
  insertSopStep.run(
    "step_r4",
    "sop_retro",
    4,
    "04 审计阶段",
    "对比上周计划与实际交付，分析阻塞点与认知偏差，萃取 1-2 条准则。",
    JSON.stringify(["记录有效经验教训", "更新对应领域准则清单"])
  );
  insertSopStep.run(
    "step_r5",
    "sop_retro",
    5,
    "05 规划阶段",
    "确立下周前三核心战役，拆解为首批活跃里程碑任务。",
    JSON.stringify(["明确 P0 核心交期", "设定每日微习惯聚焦重点"])
  );
  insertSopStep.run(
    "step_r6",
    "sop_retro",
    6,
    "06 就绪阶段",
    "确认周一早晨第一项行动目标，保持工作台干净整洁。",
    JSON.stringify(["锁定首项工单", "关闭无关调试窗口"])
  );

  insertSop.run(
    "sop_visual",
    "dom_work",
    "界面排版与视觉自检",
    "quality",
    "交付前核对 Logistics Dispatch Core 设计 Token，排查字阶、间距与对比度偏差。",
    5,
    14,
    now,
    now
  );
  insertSopStep.run(
    "step_v1",
    "sop_visual",
    1,
    "01 字体排印核查",
    "检查数值列与 KPI 是否使用 Manrope 及 tabular-nums 等宽对齐。",
    JSON.stringify(["数值等宽对齐", "大标题 Manrope 权重"])
  );
  insertSopStep.run(
    "step_v2",
    "sop_visual",
    2,
    "02 颜色层级走查",
    "严禁高饱和非语义背景，确认 Tonal Surface 微阶梯清晰。",
    JSON.stringify(["容器背景正确分层", "语义色精准应用"])
  );
  insertSopStep.run(
    "step_v3",
    "sop_visual",
    3,
    "03 倒角网格规范",
    "确认 4px 律动基线与 2/4/8/12px 倒角阶梯严格执行。",
    JSON.stringify(["按钮 32-36px", "卡片 8px 圆角"])
  );
  insertSopStep.run(
    "step_v4",
    "sop_visual",
    4,
    "04 状态指示核验",
    "确保 SQLite WAL 指示灯与状态胶囊对比度合格。",
    JSON.stringify(["脉冲绿点正常", "高亮状态清晰"])
  );
  insertSopStep.run(
    "step_v5",
    "sop_visual",
    5,
    "05 响应式边界测试",
    "验证 12 列自适应网格在抽屉滑出时无布局坍塌。",
    JSON.stringify(["420px 抽屉平滑滑出", "主内容区无水平溢出"])
  );

  insertSop.run(
    "sop_migration",
    "dom_arch",
    "SQLite 本地迁移与备份校验",
    "ops",
    "数据库 Schema 变更与历史快照回滚演练标准流程。",
    4,
    8,
    now,
    now
  );
  insertSopStep.run("step_m1", "sop_migration", 1, "01 快照预备", "执行 schema 迁移前强制生成冷备份并校验 SHA256", JSON.stringify(["导出 .db 物理文件", "校验 SHA256 完整性"]));
  insertSopStep.run("step_m2", "sop_migration", 2, "02 事务执行", "在事务中执行 DDL 并验证字段向后兼容性", JSON.stringify(["验证向后兼容字段", "更新 schema 版本元信息"]));
  insertSopStep.run("step_m3", "sop_migration", 3, "03 完整性自检", "运行 PRAGMA integrity_check 与 foreign_key_check", JSON.stringify(["检查 0 错误输出", "WAL checkpoint 刷盘"]));
  insertSopStep.run("step_m4", "sop_migration", 4, "04 回滚预案验证", "演练防呆恢复流程，确保文件名校验有效拦截误操作", JSON.stringify(["测试输入错误文件名被拦截", "确认正确文件名可安全覆盖"]));

  insertSop.run(
    "sop_release",
    "dom_work",
    "敏捷版本自用发布准备",
    "delivery",
    "单机交付包构建、体积压缩、签名校验与端到端启动巡检。",
    3,
    16,
    now,
    now
  );
  insertSopStep.run("step_rel1", "sop_release", 1, "01 准入验证", "执行全套自动化测试与类型检查，确保基线无回归", JSON.stringify(["运行 test.sh 成功", "确认无未完成卡点工单"]));
  insertSopStep.run("step_rel2", "sop_release", 2, "02 构建打包", "运行 build.sh 构建生产包，验证离线纯单机运行稳定性", JSON.stringify(["产物生成无错误", "验证断网环境启动"]));
  insertSopStep.run("step_rel3", "sop_release", 3, "03 快照留存", "生成当前数据库版本快照，并在仓库记录发布日志", JSON.stringify(["创建物理快照备份", "更新版本手记"]));


  // 6. Archives & Trash
  const insertArchive = db.prepare(`
    INSERT INTO archives (id, entity_type, entity_id, original_name, domain_name, completed_at, archived_at, snapshot_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertArchive.run("arch_1", "task", "#T-0945", "梳理本地 SQLite 字段加密与迁移方案", "工作与交付", offsetDate(-3), offsetDate(-2), JSON.stringify({}));
  insertArchive.run("arch_2", "task", "#T-0938", "重构 Material Design 3 冷色微层级调色板", "工作与交付", offsetDate(-5), offsetDate(-4), JSON.stringify({}));
  insertArchive.run("arch_3", "project", "proj_legacy", "个人工作台 v1.0 原型探索", "系统与架构", offsetDate(-14), offsetDate(-10), JSON.stringify({}));

  const insertTrash = db.prepare(`
    INSERT INTO trash (id, entity_type, entity_id, entity_name, deleted_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertTrash.run("trash_1", "task", "#T-0920", "旧版番茄钟试验组件", offsetDate(-4), offsetDate(26));
  insertTrash.run("trash_2", "task", "#T-0921", "未分类网络抓取爬虫草稿", offsetDate(-2), offsetDate(28));
  insertTrash.run("trash_3", "project", "proj_old", "早期 Electron 打包实验工程", offsetDate(-1), offsetDate(29));

  // 7. Snapshots
  const insertSnapshot = db.prepare(`
    INSERT INTO snapshots (id, filename, size_bytes, checksum_sha256, record_count, created_at, is_valid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertSnapshot.run("snap_1", "solofocus_backup_2026-09-05_full.db", 7759462, "9a8f3b21c4e5d67890abcdef1234567890abcdef1234567890abcdef12345678", 1428, "2026-09-05 21:30:14", 1);
  insertSnapshot.run("snap_2", "solofocus_auto_weekly_2026-08-31.db", 6422118, "b4c5d6e7f8901234567890abcdef1234567890abcdef1234567890abcdef1234", 1210, "2026-08-31 23:00:00", 1);
}
