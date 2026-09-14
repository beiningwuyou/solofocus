import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { SoloFocusAiService } from "./ai-service.js";
import { SoloFocusRepository } from "./repository.js";
import type {
  EmailConfigData,
  EmailPresetKey,
  EmailTaskCandidate,
  EmailSyncResult,
  TaskPriority,
  ProjectItem
} from "../../shared/solofocus-models.js";

export const EMAIL_PRESETS: Record<
  EmailPresetKey,
  { host: string; port: number; secure: boolean; label: string }
> = {
  qq_enterprise: {
    host: "imap.exmail.qq.com",
    port: 993,
    secure: true,
    label: "腾讯企业邮 / 企业微信邮箱"
  },
  netease_enterprise: {
    host: "imap.qiye.163.com",
    port: 993,
    secure: true,
    label: "网易企业邮"
  },
  "163": {
    host: "imap.163.com",
    port: 993,
    secure: true,
    label: "网易 163 邮箱"
  },
  qq: {
    host: "imap.qq.com",
    port: 993,
    secure: true,
    label: "QQ 邮箱"
  },
  outlook: {
    host: "outlook.office365.com",
    port: 993,
    secure: true,
    label: "Outlook / Office 365"
  },
  gmail: {
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    label: "Gmail"
  },
  custom: {
    host: "",
    port: 993,
    secure: true,
    label: "自定义 IMAP 服务器"
  }
};

const DEFAULT_CONFIG: EmailConfigData = {
  enabled: false,
  imapHost: "imap.exmail.qq.com",
  imapPort: 993,
  secure: true,
  username: "",
  folder: "INBOX",
  autoSyncOnOpen: true,
  syncLimit: 15,
  lookbackDays: 3,
  preset: "qq_enterprise"
};

export function resolveStorageDir(): string {
  const appSupport = path.join(os.homedir(), "Library", "Application Support", "个人工作台");
  try {
    if (!fs.existsSync(appSupport)) {
      fs.mkdirSync(appSupport, { recursive: true });
    }
    return appSupport;
  } catch {
    const localData = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(localData)) {
      fs.mkdirSync(localData, { recursive: true });
    }
    return localData;
  }
}

export class SoloFocusEmailService {
  private configPath: string;
  private syncedIdsPath: string;
  private candidatesPath: string;
  private aiService: SoloFocusAiService;
  private cachedConfig: EmailConfigData | null = null;

  constructor(private repo?: SoloFocusRepository, customDir?: string) {
    const baseDir = customDir || resolveStorageDir();
    this.configPath = path.join(baseDir, "solofocus-email-config.json");
    this.syncedIdsPath = path.join(baseDir, "solofocus-synced-email-ids.json");
    this.candidatesPath = path.join(baseDir, "solofocus-email-candidates.json");
    this.aiService = new SoloFocusAiService();
  }

  public getConfig(): EmailConfigData {
    if (this.cachedConfig) return this.cachedConfig;
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
        const password = typeof raw.password === "string" ? raw.password : "";
        this.cachedConfig = {
          enabled: Boolean(raw.enabled),
          imapHost: raw.imapHost || DEFAULT_CONFIG.imapHost,
          imapPort: typeof raw.imapPort === "number" ? raw.imapPort : DEFAULT_CONFIG.imapPort,
          secure: raw.secure !== undefined ? Boolean(raw.secure) : DEFAULT_CONFIG.secure,
          username: raw.username || "",
          password: password || undefined,
          hasPassword: Boolean(password && password.length > 0),
          folder: raw.folder || DEFAULT_CONFIG.folder,
          autoSyncOnOpen: raw.autoSyncOnOpen !== undefined ? Boolean(raw.autoSyncOnOpen) : DEFAULT_CONFIG.autoSyncOnOpen,
          syncLimit: typeof raw.syncLimit === "number" ? raw.syncLimit : DEFAULT_CONFIG.syncLimit,
          lookbackDays: typeof raw.lookbackDays === "number" ? raw.lookbackDays : DEFAULT_CONFIG.lookbackDays,
          preset: (raw.preset as EmailPresetKey) || DEFAULT_CONFIG.preset
        };
        return this.cachedConfig;
      }
    } catch {
      // ignore
    }

    this.cachedConfig = { ...DEFAULT_CONFIG, hasPassword: false };
    return this.cachedConfig;
  }

  public saveConfig(updates: Partial<EmailConfigData>): EmailConfigData {
    const current = this.getConfig();
    let newPassword = current.password;
    if (updates.password !== undefined) {
      if (updates.password.trim().length > 0) {
        newPassword = updates.password.trim();
      } else if (updates.password === "") {
        newPassword = undefined;
      }
    }

    const next: EmailConfigData = {
      ...current,
      ...updates,
      password: newPassword,
      hasPassword: Boolean(newPassword && newPassword.length > 0)
    };

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(next, null, 2), "utf-8");
      this.cachedConfig = next;
    } catch (err) {
      console.error("[SoloFocusEmailService] Failed to save email config:", err);
    }
    return next;
  }

  public getMaskedConfig(): EmailConfigData {
    const config = this.getConfig();
    return {
      ...config,
      password: config.hasPassword ? "••••••••" : ""
    };
  }

  public getSyncedEmailIds(): Set<string> {
    try {
      if (fs.existsSync(this.syncedIdsPath)) {
        const list = JSON.parse(fs.readFileSync(this.syncedIdsPath, "utf-8"));
        if (Array.isArray(list)) return new Set(list);
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  }

  public recordSyncedEmailIds(ids: string[]): void {
    if (!ids.length) return;
    const existing = this.getSyncedEmailIds();
    for (const id of ids) {
      existing.add(id);
    }
    try {
      fs.writeFileSync(this.syncedIdsPath, JSON.stringify(Array.from(existing), null, 2), "utf-8");
    } catch (err) {
      console.error("[SoloFocusEmailService] Failed to save synced email IDs:", err);
    }
  }

  public getCachedCandidates(): EmailTaskCandidate[] {
    try {
      if (fs.existsSync(this.candidatesPath)) {
        const list = JSON.parse(fs.readFileSync(this.candidatesPath, "utf-8"));
        if (Array.isArray(list)) return list;
      }
    } catch {
      // ignore
    }
    return [];
  }

  public saveCachedCandidates(candidates: EmailTaskCandidate[]): void {
    try {
      fs.writeFileSync(this.candidatesPath, JSON.stringify(candidates, null, 2), "utf-8");
    } catch (err) {
      console.error("[SoloFocusEmailService] Failed to cache email candidates:", err);
    }
  }

  /**
   * 测试 IMAP 连接与凭证可用性
   */
  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    unseenCount?: number;
    totalCount?: number;
  }> {
    const config = this.getConfig();
    if (!config.imapHost || !config.username || !config.password) {
      return {
        success: false,
        message: "邮箱配置不完整：请确保主机、账号及授权码/密码均已填写。"
      };
    }

    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password
      },
      logger: false
    });

    try {
      await client.connect();
      const folderName = config.folder || "INBOX";
      const status = await client.status(folderName, { messages: true, unseen: true });
      await client.logout();
      return {
        success: true,
        message: `连接成功！当前收件箱共有 ${status.messages ?? 0} 封邮件，其中未读 ${status.unseen ?? 0} 封。`,
        totalCount: status.messages,
        unseenCount: status.unseen
      };
    } catch (err: any) {
      try {
        await client.logout();
      } catch {
        // ignore
      }
      return {
        success: false,
        message: `连接失败: ${err.message || "无法连接到邮件服务器，请检查网络或授权码"}`
      };
    }
  }

  /**
   * 同步最近工作邮件，并运用 AI 或本地规则提炼待办任务候选
   */
  public async syncAndExtractTasks(): Promise<EmailSyncResult> {
    const config = this.getConfig();
    if (!config.enabled) {
      return {
        success: false,
        totalFetched: 0,
        newCandidates: this.getCachedCandidates(),
        ignoredCount: 0,
        error: "工作邮箱同步功能当前处于未开启状态",
        lastSyncedAt: new Date().toISOString()
      };
    }

    if (!config.imapHost || !config.username || !config.password) {
      return {
        success: false,
        totalFetched: 0,
        newCandidates: this.getCachedCandidates(),
        ignoredCount: 0,
        error: "邮箱账号或授权码未配置",
        lastSyncedAt: new Date().toISOString()
      };
    }

    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password
      },
      logger: false
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(config.folder || "INBOX", { readOnly: true });

      const lookbackDays = config.lookbackDays || 3;
      const sinceDate = new Date(Date.now() - lookbackDays * 86400 * 1000);

      // 获取近期的邮件序列号/UID
      const searchCriteria: any = {
        since: sinceDate
      };

      const messages: {
        uid: number;
        subject: string;
        from: string;
        date: Date;
        messageId: string;
        bodyText: string;
      }[] = [];

      const syncedIds = this.getSyncedEmailIds();
      const existingCandidates = this.getCachedCandidates();
      const existingCandidateIds = new Set(existingCandidates.map((c) => c.messageId));

      const limit = config.syncLimit || 15;

      // 检索符合条件的邮件 UID（倒序最新的在前）
      const uids = await client.search(searchCriteria, { uid: true });
      const recentUids = Array.isArray(uids) ? uids.slice(-limit).reverse() : [];

      for (const uid of recentUids) {
        try {
          const download = await client.download(String(uid), undefined, { uid: true });
          if (download && download.content) {
            const parsed = await simpleParser(download.content);
            const messageId = parsed.messageId || `uid-${uid}-${parsed.date?.getTime() || Date.now()}`;
            const fromText = parsed.from?.text || parsed.from?.value?.[0]?.address || "未知发件人";
            const subject = parsed.subject || "（无主题）";
            const bodyText = (parsed.text || "").trim().slice(0, 1500);

            // 如果已经同步过或已在候选池中，则跳过
            if (!syncedIds.has(messageId) && !existingCandidateIds.has(messageId)) {
              messages.push({
                uid,
                subject,
                from: fromText,
                date: parsed.date || new Date(),
                messageId,
                bodyText
              });
            }
          }
        } catch (fetchErr) {
          console.warn(`[SoloFocusEmailService] Failed to parse email uid ${uid}:`, fetchErr);
        }
      }

      lock.release();
      await client.logout();

      // 获取当前 active 项目列表，以支持智能项目关联
      let activeProjects: ProjectItem[] = [];
      if (this.repo) {
        const bootstrap = this.repo.getBootstrap();
        activeProjects = (bootstrap.projects || []).filter((p) => p.status === "active");
      }

      // 进行 AI / 规则提炼
      const newlyDistilled: EmailTaskCandidate[] = [];
      let ignoredCount = 0;

      for (const msg of messages) {
        const candidate = await this.distillSingleEmail(msg, activeProjects);
        if (candidate) {
          newlyDistilled.push(candidate);
        } else {
          ignoredCount++;
          // 标记无行动项的邮件为已处理，防止每次重复拉取分析
          syncedIds.add(msg.messageId);
        }
      }

      if (ignoredCount > 0) {
        this.recordSyncedEmailIds(Array.from(syncedIds));
      }

      // 合并到未处理候选池
      const mergedCandidates = [...newlyDistilled, ...existingCandidates];
      this.saveCachedCandidates(mergedCandidates);

      return {
        success: true,
        totalFetched: messages.length,
        newCandidates: mergedCandidates,
        ignoredCount,
        lastSyncedAt: new Date().toISOString()
      };
    } catch (err: any) {
      try {
        await client.logout();
      } catch {
        // ignore
      }
      return {
        success: false,
        totalFetched: 0,
        newCandidates: this.getCachedCandidates(),
        ignoredCount: 0,
        error: err.message || "邮件同步失败",
        lastSyncedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 提炼单封邮件为待办候选事项
   */
  public async distillSingleEmail(
    msg: {
      subject: string;
      from: string;
      date: Date;
      messageId: string;
      bodyText: string;
    },
    activeProjects: ProjectItem[]
  ): Promise<EmailTaskCandidate | null> {
    const projectNames = activeProjects.map((p) => `ID: "${p.id}", 名称: "${p.name}"`).join("\n");

    const systemPrompt = `你是一名专业的工作台敏捷任务助手。
你的目标是分析工作邮件，判断这封邮件是否需要用户本人采取行动、跟进、答复、审批或完成某个待办（Actionable Work）。
如果是纯系统通知、广告营销、群发周刊资讯、或者仅仅是无需本人响应的被动抄送邮件，请判定为非行动项。

若包含行动项，请提取并输出以下 JSON 格式：
{
  "isActionable": true,
  "taskTitle": "动宾短语待办标题（15字以内，清晰精练，如：【审批】确认架构升级采购单）",
  "priority": "CRITICAL" | "HIGH" | "NORMAL" | "LOW",
  "estimatedMinutes": 预计分钟数（如 15, 30, 45, 60, 90）,
  "actionSummary": "简述具体需要完成的动作或截止要求（40字以内）",
  "matchedProjectId": "匹配到的活跃项目ID（若无合适项目关联则为 null）"
}

若判定无行动项：
{
  "isActionable": false
}
注意：仅输出有效 JSON，禁止添加多余的 Markdown 代码块或文字说明。`;

    const userPrompt = `邮件发件人: ${msg.from}
邮件主题: ${msg.subject}
发送时间: ${msg.date.toISOString()}
正文摘要:
${msg.bodyText || "（无正文文字）"}

当前用户进行中的项目列表：
${projectNames || "（暂无活跃项目）"}`;

    const fallbackGenerator = (): EmailTaskCandidate | null => {
      return this.heuristicDistill(msg, activeProjects);
    };

    return this.aiService.executeChatOrFallback<EmailTaskCandidate | null>(
      systemPrompt,
      userPrompt,
      fallbackGenerator,
      (rawText) => {
        try {
          const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (!parsed.isActionable) {
            return null;
          }

          let matchedProject: ProjectItem | undefined;
          if (parsed.matchedProjectId) {
            matchedProject = activeProjects.find((p) => p.id === parsed.matchedProjectId);
          }

          const validPriority: TaskPriority = ["CRITICAL", "HIGH", "NORMAL", "LOW"].includes(parsed.priority)
            ? parsed.priority
            : "NORMAL";

          return {
            id: `email-cand-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            messageId: msg.messageId,
            subject: msg.subject,
            from: msg.from,
            date: msg.date.toISOString(),
            extractedTitle: parsed.taskTitle || msg.subject.slice(0, 30),
            suggestedPriority: validPriority,
            suggestedMinutes: typeof parsed.estimatedMinutes === "number" ? parsed.estimatedMinutes : 45,
            actionSummary: parsed.actionSummary || `来自发件人 ${msg.from} 的邮件待办`,
            suggestedProjectId: matchedProject?.id,
            suggestedProjectName: matchedProject?.name,
            fullBodySnippet: msg.bodyText.slice(0, 300)
          };
        } catch {
          return fallbackGenerator();
        }
      }
    );
  }

  /**
   * 本地确定性启发式规则（AI 离线或异常时的无缝 fallback）
   */
  public heuristicDistill(
    msg: {
      subject: string;
      from: string;
      date: Date;
      messageId: string;
      bodyText: string;
    },
    activeProjects: ProjectItem[]
  ): EmailTaskCandidate | null {
    const combined = `${msg.subject} ${msg.bodyText}`.toLowerCase();

    // 1. 过滤垃圾/自动提醒/纯通知
    const ignoreKeywords = [
      "验证码",
      "订阅周刊",
      "newsletter",
      "unsubscribe",
      "系统自动发送",
      "donotreply",
      "no-reply",
      "noreply",
      "推广",
      "广告",
      "恭喜您获得",
      "账单流水",
      "成功开通",
      "欢迎注册"
    ];
    if (ignoreKeywords.some((k) => combined.includes(k))) {
      return null;
    }

    // 2. 判断是否具备行动意图关键词
    const actionKeywords = [
      "请",
      "审批",
      "确认",
      "反馈",
      "答复",
      "跟进",
      "处理",
      "修改",
      "提交",
      "review",
      "评审",
      "安排",
      "排期",
      "截止",
      "截至",
      "尽快",
      "urgent",
      "action",
      "todo",
      "汇报"
    ];

    const hasAction = actionKeywords.some((k) => combined.includes(k));
    if (!hasAction) {
      return null;
    }

    // 3. 优先级判定
    let priority: TaskPriority = "NORMAL";
    if (
      combined.includes("紧急") ||
      combined.includes("尽快") ||
      combined.includes("urgent") ||
      combined.includes("asap") ||
      combined.includes("p0")
    ) {
      priority = "CRITICAL";
    } else if (
      combined.includes("高优") ||
      combined.includes("重要") ||
      combined.includes("截止今天") ||
      combined.includes("今日完成")
    ) {
      priority = "HIGH";
    }

    // 4. 清理标题前缀
    let cleanTitle = msg.subject
      .replace(/^(re|fwd|fw|回复|转发)[:：]\s*/i, "")
      .replace(/^(re|fwd|fw|回复|转发)[:：]\s*/i, "")
      .trim();

    if (!cleanTitle) cleanTitle = "处理工作邮件行动项";
    if (cleanTitle.length > 25) {
      cleanTitle = cleanTitle.slice(0, 25) + "...";
    }

    // 5. 匹配所属项目
    let matchedProject: ProjectItem | undefined;
    for (const p of activeProjects) {
      if (p.name && (combined.includes(p.name.toLowerCase()) || msg.subject.includes(p.name))) {
        matchedProject = p;
        break;
      }
    }

    return {
      id: `email-cand-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      messageId: msg.messageId,
      subject: msg.subject,
      from: msg.from,
      date: msg.date.toISOString(),
      extractedTitle: cleanTitle,
      suggestedPriority: priority,
      suggestedMinutes: 45,
      actionSummary: `来自 ${msg.from} 的工作邮件，建议今日跟进处理`,
      suggestedProjectId: matchedProject?.id,
      suggestedProjectName: matchedProject?.name,
      fullBodySnippet: msg.bodyText.slice(0, 300)
    };
  }

  /**
   * 采纳选中的邮件候选事项并写入今日任务
   */
  public adoptTasks(tasks: {
    candidateId: string;
    title: string;
    priority: TaskPriority;
    estimatedMinutes: number;
    projectId?: string;
    scheduledDate: string;
    notes?: string;
  }[]): { createdCount: number; taskIds: string[] } {
    if (!this.repo) {
      throw new Error("Repository instance not provided");
    }

    const cachedCandidates = this.getCachedCandidates();
    const candidateMap = new Map(cachedCandidates.map((c) => [c.id, c]));

    const createdIds: string[] = [];
    const adoptedMessageIds: string[] = [];
    const adoptedCandidateIds = new Set<string>();

    for (const item of tasks) {
      const cand = candidateMap.get(item.candidateId);
      const emailContext = cand
        ? `\n\n> 来源邮件：${cand.subject}\n> 发件人：${cand.from}\n> 发送时间：${cand.date.slice(0, 16).replace("T", " ")}\n> 摘要：${cand.actionSummary}`
        : "";

      const task = this.repo.createTask({
        title: item.title,
        priority: item.priority,
        estimatedMinutes: item.estimatedMinutes || 45,
        projectId: item.projectId || undefined,
        scheduledDate: item.scheduledDate || new Date().toISOString().slice(0, 10),
        description: (item.notes || "") + emailContext
      });

      createdIds.push(task.id);
      adoptedCandidateIds.add(item.candidateId);
      if (cand) {
        adoptedMessageIds.push(cand.messageId);
      }
    }

    // 记录已同步邮件 ID
    this.recordSyncedEmailIds(adoptedMessageIds);

    // 从候选池中剔除已采纳项
    const remainingCandidates = cachedCandidates.filter((c) => !adoptedCandidateIds.has(c.id));
    this.saveCachedCandidates(remainingCandidates);

    return {
      createdCount: createdIds.length,
      taskIds: createdIds
    };
  }

  /**
   * 忽略特定的候选事项
   */
  public dismissCandidates(candidateIds: string[]): { dismissedCount: number } {
    const cachedCandidates = this.getCachedCandidates();
    const dismissedIdsSet = new Set(candidateIds);

    const messageIdsToRecord: string[] = [];
    const remaining: EmailTaskCandidate[] = [];

    for (const cand of cachedCandidates) {
      if (dismissedIdsSet.has(cand.id)) {
        messageIdsToRecord.push(cand.messageId);
      } else {
        remaining.push(cand);
      }
    }

    this.recordSyncedEmailIds(messageIdsToRecord);
    this.saveCachedCandidates(remaining);

    return {
      dismissedCount: messageIdsToRecord.length
    };
  }
}
