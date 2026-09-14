import { SoloFocusRepository } from "./repository.js";
import { SoloFocusAiService } from "./ai-service.js";
import type {
  AiDailyBriefingItem,
  ApplyDailyPlanPayload,
  SopRecommendationItem,
  SopExtractionDraft,
  TaskItem,
  ProjectItem,
  SopCategory
} from "../../shared/solofocus-models.js";

export class SoloFocusAgentEngine {
  private aiService: SoloFocusAiService;

  constructor(private repo: SoloFocusRepository) {
    this.aiService = new SoloFocusAiService();
  }

  /**
   * AI Daily Planner: 每日工作简报与高优决策推算
   */
  public async generateDailyBriefing(): Promise<AiDailyBriefingItem> {
    const bootstrap = this.repo.getBootstrap();
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    // 1. 过滤今日相关任务
    const activeTasks = bootstrap.tasks.filter((t) => t.status !== "archived");
    const todayTasks = activeTasks.filter((t) => {
      if (t.status === "done" && t.completedAt?.startsWith(today)) return true;
      if (t.status !== "done") {
        if (t.scheduledDate === today) return true;
        if (t.dueDate === today) return true;
        if (t.dueDate && t.dueDate < today) return true; // 逾期
        if (t.createdAt && t.createdAt.startsWith(today) && !t.scheduledDate) return true;
      }
      return false;
    });

    const pendingTodayTasks = todayTasks.filter((t) => t.status !== "done");

    // 2. 负荷测算 (总估计时长与健康基准)
    const totalEstimatedMinutes = pendingTodayTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 45), 0);
    const averageDailyMinutes = 240; // 4小时作为标准高专注产能基准
    const isOverloaded = totalEstimatedMinutes > averageDailyMinutes;
    const overloadRatio = Math.round((totalEstimatedMinutes / averageDailyMinutes) * 10) / 10;

    // 3. 智能权重评分筛选 Top 3
    const scoredTasks = pendingTodayTasks.map((task) => {
      let score = 0;
      // 逾期风险最高
      if (task.dueDate && task.dueDate < today) score += 120;
      else if (task.dueDate === today) score += 80;

      // 优先级权重
      if (task.priority === "CRITICAL") score += 100;
      else if (task.priority === "HIGH") score += 50;
      else if (task.priority === "NORMAL") score += 20;

      // 所属项目推进权重
      if (task.projectId) {
        const proj = bootstrap.projects.find((p) => p.id === task.projectId);
        if (proj && proj.status === "active") {
          score += 30;
          if (proj.targetDate && proj.targetDate <= today) score += 40;
        }
      }

      // Checklist 密集度 (大任务关键路径)
      if (task.checklist && task.checklist.length > 0) {
        score += Math.min(25, task.checklist.length * 5);
      }

      return { task, score };
    });

    scoredTasks.sort((a, b) => b.score - a.score);

    const topFocusTasks = scoredTasks.slice(0, 3).map(({ task }) => {
      let reason = "核心推进事项";
      if (task.dueDate && task.dueDate < today) {
        reason = "已逾期待闭环，需优先止血";
      } else if (task.priority === "CRITICAL" || task.priority === "HIGH") {
        reason = "高优先级交付，关联重要业务里程碑";
      } else if (task.checklist && task.checklist.length > 0) {
        reason = "结构化工序任务，推进可带动关键链条";
      }

      return {
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.projectName,
        priority: task.priority,
        reason
      };
    });

    const topFocusIds = new Set(topFocusTasks.map((t) => t.taskId));

    // 4. 建议顺延/削减负荷事项
    const candidatePostpone = scoredTasks
      .filter(({ task }) => !topFocusIds.has(task.id) && task.priority !== "CRITICAL")
      .map(({ task }) => ({
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.projectName,
        suggestedDate: tomorrowStr,
        reason: isOverloaded
          ? `今日规划时长(${totalEstimatedMinutes}m)超出健康产能(${averageDailyMinutes}m)，建议顺延至明日，集中精力攻坚核心交付。`
          : "次优待办事项，建议在核心任务闭环后视精力推进或顺延。"
      }));

    const postponeRecommendations = isOverloaded ? candidatePostpone.slice(0, 3) : candidatePostpone.slice(0, 1);

    // 5. Antigravity 原生智能简报生成器 (零延迟、深度认知推理)
    const fallbackGenerator = (): AiDailyBriefingItem => {
      const summary = isOverloaded
        ? `【Antigravity 原生智能体 · 晨间排期】今日规划待推进任务 ${pendingTodayTasks.length} 项，预估用时 ${totalEstimatedMinutes} 分钟，负荷率 ${overloadRatio}x（超出健康产能阈值）。建议主动顺延次优待办，集中精力打穿 Top 3 关键链路。`
        : `【Antigravity 原生智能体 · 晨间排期】今日规划待办共 ${pendingTodayTasks.length} 项，预估用时 ${totalEstimatedMinutes} 分钟，负荷处于健康平稳区间。建议优先闭环首要高优任务，保持心流与交付节奏。`;

      const actionAdvice = [
        `深度专注：晨间黄金精力时段全力攻坚「${topFocusTasks[0]?.taskTitle || "核心交付"}」，杜绝上下文频繁切换`,
        isOverloaded
          ? `负荷卸载：建议一键将 ${postponeRecommendations.length} 项次优待办顺延至明日，保障高优交付质量`
          : `节奏协同：按时完成核心习惯核对，保持日常节奏与长周期目标的持续咬合。`
      ];

      return {
        summary,
        workloadAnalysis: {
          totalEstimatedMinutes,
          averageDailyMinutes,
          isOverloaded,
          overloadRatio
        },
        topFocusTasks,
        postponeRecommendations,
        actionAdvice,
        generatedAt: new Date().toISOString()
      };
    };

    // 6. LLM 强化推演 (若已配置大模型则生成更具语境针对性的建议，否则瞬时返回确定性结果)
    const systemPrompt = `你是一位严谨、克制且深刻理解《俞军产品方法论》的高级生产力参谋。
你的任务是根据用户的今日待办任务、工时估算、项目状态与逾期情况，输出一段客观、精炼的今日工作简报。
要求：
1. 语言平实、克制、少形容词、直击核心，拒绝空洞鸡汤和泛 AI 审美。
2. 明确给出负荷判断与聚焦动作。
3. 请以 JSON 格式输出，格式：{ "summary": "简报文字", "actionAdvice": ["建议1", "建议2"] }`;

    const userPrompt = JSON.stringify({
      pendingTasksCount: pendingTodayTasks.length,
      totalEstimatedMinutes,
      averageDailyMinutes,
      isOverloaded,
      topFocusTasks: topFocusTasks.map((t) => `${t.taskTitle} (${t.reason})`),
      postponeTasks: postponeRecommendations.map((t) => t.taskTitle)
    });

    return await this.aiService.executeChatOrFallback<AiDailyBriefingItem>(
      systemPrompt,
      userPrompt,
      fallbackGenerator,
      (rawText) => {
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (!match) return fallbackGenerator();
          const parsed = JSON.parse(match[0]);
          const base = fallbackGenerator();
          return {
            ...base,
            summary: parsed.summary || base.summary,
            actionAdvice: Array.isArray(parsed.actionAdvice) && parsed.actionAdvice.length > 0
              ? parsed.actionAdvice
              : base.actionAdvice
          };
        } catch {
          return fallbackGenerator();
        }
      }
    );
  }

  /**
   * 应用 AI 规划决策：顺延指定任务并确立今日高优排期
   */
  public applyDailyPlan(payload: ApplyDailyPlanPayload): {
    success: boolean;
    postponedCount: number;
    focusedCount: number;
  } {
    const today = new Date().toISOString().slice(0, 10);
    const targetDate = payload.postponeTargetDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

    let postponedCount = 0;
    for (const taskId of payload.confirmedPostponeTaskIds || []) {
      this.repo.updateTask(taskId, { scheduledDate: targetDate });
      postponedCount++;
    }

    let focusedCount = 0;
    for (const taskId of payload.confirmedFocusTaskIds || []) {
      this.repo.updateTask(taskId, { scheduledDate: today, priority: "HIGH" });
      focusedCount++;
    }

    return {
      success: true,
      postponedCount,
      focusedCount
    };
  }

  /**
   * 向外借力：为新创建的项目推荐业界标准 SOP
   */
  public recommendSopsForProject(projectName: string, domainId?: string): SopRecommendationItem[] {
    const bootstrap = this.repo.getBootstrap();
    const existingSops = bootstrap.sops || [];

    const normName = (projectName || "").toLowerCase();

    // 提取 2~4 字的 n-gram 分词以良好支持中文语境下的语义关联
    const tokens = new Set<string>();
    const chunks = normName.split(/[\s_\-·,，、:：/／\\]+/g).filter(Boolean);
    for (const chunk of chunks) {
      if (chunk.length >= 2) tokens.add(chunk);
      for (let len = 2; len <= Math.min(4, chunk.length); len++) {
        for (let i = 0; i <= chunk.length - len; i++) {
          tokens.add(chunk.substring(i, i + len));
        }
      }
    }

    // 匹配打分机制
    const scored = existingSops.map((sop) => {
      let score = 0;
      const titleLower = sop.title.toLowerCase();
      const summaryLower = sop.summary.toLowerCase();

      // 关键词与 n-gram 重合度
      for (const token of tokens) {
        if (titleLower.includes(token)) score += Math.min(30, token.length * 8);
        if (summaryLower.includes(token)) score += Math.min(15, token.length * 4);
      }

      // 类别相关性
      if (normName.includes("发布") || normName.includes("上线") || normName.includes("delivery")) {
        if (sop.category === "delivery") score += 50;
      }
      if (normName.includes("规范") || normName.includes("流程") || normName.includes("日常")) {
        if (sop.category === "routine") score += 30;
      }
      if (normName.includes("重构") || normName.includes("质量") || normName.includes("架构")) {
        if (sop.category === "quality" || sop.category === "ops") score += 40;
      }

      let matchReason = "根据项目特征与交付类别匹配";
      if (score >= 40) matchReason = "高匹配度：涵盖此类项目的标准化关键执行与防错步骤";


      const resolvedSteps = (sop.steps && sop.steps.length > 0)
        ? sop.steps.map((s) => ({
          phaseTitle: s.phaseTitle,
          instruction: s.instruction,
          checklistItems: s.checklistItems || []
        }))
        : [
          { phaseTitle: "准备阶段", instruction: `${sop.title} - 前置检查与准备`, checklistItems: ["核对前置准入条件"] },
          { phaseTitle: "执行阶段", instruction: `${sop.title} - 标准作业执行`, checklistItems: ["按规程逐步推进", "验证执行结果"] },
          { phaseTitle: "归档阶段", instruction: `${sop.title} - 复盘与资产归档`, checklistItems: ["记录本次执行结论"] }
        ];

      return {
        sopId: sop.id,
        title: sop.title,
        category: sop.category,
        summary: sop.summary,
        matchReason,
        stepCount: resolvedSteps.length,
        steps: resolvedSteps,
        score
      };
    });


    // 过滤与排序
    const results = scored.sort((a, b) => b.score - a.score);

    // 如果库中没有匹配度高的，返回默认的兜底高质量 SOP 规范
    if (results.length === 0 || results[0].score === 0) {
      return [
        {
          sopId: "sop_preset_release",
          title: "商业化发布与交付验收 SOP",
          category: "delivery",
          summary: "适用于从功能验证、断网离线兼容到版本打包落地的标准闭环流程。",
          matchReason: "工业级发布通用模版，降低新项目冷启动拆解门槛",
          stepCount: 3,
          steps: [
            {
              phaseTitle: "准备阶段",
              instruction: "完成核心功能用例验证与静态类型检查",
              checklistItems: ["执行 test.sh 通过", "排查未完成依赖项"]
            },
            {
              phaseTitle: "执行阶段",
              instruction: "构建生产包并进行离线容灾测试",
              checklistItems: ["build.sh 构建产物无告警", "纯断网环境启动验证通过"]
            },
            {
              phaseTitle: "归档阶段",
              instruction: "生成交付快照与发布手记",
              checklistItems: ["数据库创建快照备份", "更新版本说明与操作日志"]
            }
          ]
        },
        ...results.slice(0, 2)
      ];
    }

    return results.slice(0, 3);
  }

  /**
   * 向内沉淀：当项目推进或完成时，分析任务轨迹并提炼专属 SOP 资产
   */
  public async extractSopFromProject(projectId: string): Promise<SopExtractionDraft | null> {
    const bootstrap = this.repo.getBootstrap();
    const project = bootstrap.projects.find((p) => p.id === projectId);
    if (!project) return null;

    const projTasks = bootstrap.tasks.filter((t) => t.projectId === projectId);
    if (projTasks.length === 0) return null;

    const completedTasks = projTasks.filter((t) => t.status === "done");

    // 收集所有子步骤和关键指令
    const rawSteps: { phaseTitle: string; instruction: string; checklistItems: string[] }[] = [];

    // 1. 准备阶段
    const prepTasks = projTasks.filter((t) =>
      t.title.includes("准备") || t.title.includes("设计") || t.title.includes("调研") || t.title.includes("规划")
    );
    if (prepTasks.length > 0) {
      rawSteps.push({
        phaseTitle: "准备阶段",
        instruction: prepTasks.map((t) => t.title).join("、"),
        checklistItems: prepTasks.flatMap((t) => (t.checklist || []).map((c) => c.title)).slice(0, 3)
      });
    } else {
      rawSteps.push({
        phaseTitle: "准备阶段",
        instruction: `梳理「${project.name}」前置依赖与核心范围界定`,
        checklistItems: ["核对核心输入要素", "确认边界与非目标清单"]
      });
    }

    // 2. 核心执行阶段
    const execTasks = projTasks.filter(
      (t) => !prepTasks.includes(t) && !t.title.includes("发布") && !t.title.includes("总结") && !t.title.includes("复盘")
    );
    if (execTasks.length > 0) {
      for (const t of execTasks.slice(0, 3)) {
        rawSteps.push({
          phaseTitle: "执行阶段",
          instruction: t.title,
          checklistItems: (t.checklist && t.checklist.length > 0)
            ? t.checklist.map((c) => c.title)
            : ["按既定工序推进并进行单元验证", "保持关键状态实时可追溯"]
        });
      }
    } else {
      rawSteps.push({
        phaseTitle: "执行阶段",
        instruction: "核心模块实现与系统集成验证",
        checklistItems: ["主流程闭环验证", "异常与边界条件防护"]
      });
    }

    // 3. 验收与交付阶段
    const closeTasks = projTasks.filter(
      (t) => t.title.includes("发布") || t.title.includes("验证") || t.title.includes("测试") || t.title.includes("复盘")
    );
    if (closeTasks.length > 0) {
      rawSteps.push({
        phaseTitle: "验收阶段",
        instruction: closeTasks.map((t) => t.title).join("、"),
        checklistItems: closeTasks.flatMap((t) => (t.checklist || []).map((c) => c.title)).slice(0, 3)
      });
    } else {
      rawSteps.push({
        phaseTitle: "验收阶段",
        instruction: "质量审查与成果归档",
        checklistItems: ["完成全链路走查", "沉淀演进纪要与经验文档"]
      });
    }

    const fallbackDraft: SopExtractionDraft = {
      title: `${project.name} 标准作业规程 (SOP)`,
      category: (project.domainId === "dom_work" ? "delivery" : "quality") as SopCategory,
      summary: `基于项目「${project.name}」已完成的 ${completedTasks.length} 项实体任务执行轨迹萃取生成，固化为可复用的工序资产。`,
      sourceProjectId: project.id,
      sourceProjectName: project.name,
      steps: rawSteps,
      rationale: `【AGY 经验萃取引擎】该项目共执行 ${projTasks.length} 项工单，已完成 ${completedTasks.length} 项。Agent 提炼出关键 3 阶段工序与核心核对项，沉淀为显性 SOP 资产。`
    };

    // 若配置大模型，则执行 LLM 润色提炼
    const systemPrompt = `你是一位专注于知识管理与个人生产力沉淀的首席架构师。
请根据用户在某个项目中的任务轨迹和检查清单，归纳提炼出一套严谨、可复用的结构化 SOP（标准作业程序）。
要求：
1. 步骤动宾清晰，具备实操指导性。
2. 提取出通用模式，去掉临时性杂音。
3. 请以 JSON 格式输出：{ "title": "SOP名称", "summary": "概述", "steps": [{ "phaseTitle": "阶段名", "instruction": "指导", "checklistItems": ["核对项1"] }] }`;

    const userPrompt = JSON.stringify({
      projectName: project.name,
      description: project.description,
      tasks: projTasks.map((t) => ({
        title: t.title,
        status: t.status,
        checklists: (t.checklist || []).map((c) => c.title)
      }))
    });

    return await this.aiService.executeChatOrFallback<SopExtractionDraft>(
      systemPrompt,
      userPrompt,
      () => fallbackDraft,
      (rawText) => {
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (!match) return fallbackDraft;
          const parsed = JSON.parse(match[0]);
          return {
            ...fallbackDraft,
            title: parsed.title || fallbackDraft.title,
            summary: parsed.summary || fallbackDraft.summary,
            steps: Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : fallbackDraft.steps
          };
        } catch {
          return fallbackDraft;
        }
      }
    );
  }

  /**
   * 真实项目进展与演进手记提炼 (替代原来的写死随机数)
   */
  public distillProjectNotes(projectId: string): string {
    const bootstrap = this.repo.getBootstrap();
    const proj = bootstrap.projects.find((p) => p.id === projectId);
    if (!proj) return "【Agent 调度日志】未找到对应项目。";

    const projTasks = bootstrap.tasks.filter((t) => t.projectId === projectId);
    const completedTasks = projTasks.filter((t) => t.status === "done");
    const activeTasks = projTasks.filter((t) => t.status !== "done");

    const recentCompleted = completedTasks.slice(0, 2).map((t) => `「${t.title}」`).join("、");
    const nextUp = activeTasks.slice(0, 2).map((t) => `「${t.title}」`).join("、");

    const parts: string[] = [];
    parts.push(`【Agent 智能分析 · AGY 原生引擎】项目当前推进完成率 ${proj.progress}%（已交付 ${completedTasks.length}/${projTasks.length} 项工单）。`);

    if (recentCompleted) {
      parts.push(`近期已闭环核心工序：${recentCompleted}。`);
    }

    if (nextUp) {
      parts.push(`下一步建议聚焦卡点：${nextUp}。`);
    } else if (projTasks.length > 0 && activeTasks.length === 0) {
      parts.push(`当前项目全部任务已闭环，建议触发经验萃取，收录入 SOP 知识库。`);
    } else {
      parts.push(`当前暂无活跃工单，建议排入下一阶段里程碑拆解。`);
    }

    return parts.join(" ");
  }
}
