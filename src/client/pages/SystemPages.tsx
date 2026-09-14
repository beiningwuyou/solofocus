import { Activity, Archive, ArrowDown, ArrowUp, BarChart3, CalendarDays, CheckCircle2, FileText, FolderKanban, GripVertical, Layers, ListChecks, Plus, RefreshCw, Save, Search, Settings, Sparkles, Target, TrendingUp, AlertTriangle, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { api } from "../api";
import { EmptyState, ProgressBar, RowMenu, StatusDot, useUiActions } from "../components";
import { useWorkbench } from "../context";
import { asNumber, asString, dueText, isOpenTask, kindLabel, linkName, projectTasks, type EntityProperties, type VaultEntity } from "../../shared/domain";

export function ReviewsPage() {
  const [tab, setTab] = useState<"weekly" | "project">("weekly");
  return <div className="reviews-hub">
    <nav className="reviews-hub-tabs" aria-label="复盘类型">
      <button type="button" className={tab === "weekly" ? "active" : ""} onClick={() => setTab("weekly")}>每周复盘</button>
      <button type="button" className={tab === "project" ? "active" : ""} onClick={() => setTab("project")}>项目复盘</button>
    </nav>
    {tab === "weekly" ? <WeeklyReview /> : <ProjectReviewTab />}
  </div>;
}

function WeeklyReview() {
  const { entities, archivedTasks = [], byKind, refresh, today } = useWorkbench();
  const { notify, openEntity } = useUiActions();
  const reviews = byKind("review").sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  // 本周区间（周一到周日）
  const week = useMemo(() => weekRange(today), [today]);

  // 数据
  const completedThisWeek = archivedTasks.filter((entity) =>
    (asString(entity.properties.updated) || entity.modifiedAt.slice(0, 10)) >= week.start
  );
  const overdueTasks = entities.filter((entity) =>
    entity.kind === "task" && isOpenTask(entity) && asString(entity.properties.due) && asString(entity.properties.due) < today
  );
  const activeProjects = byKind("project").filter((entity) => entity.properties.status === "active");
  const unlinkedOpenTasks = entities.filter((entity) => isOpenTask(entity) && !linkName(entity.properties.project));
  const unlinkedCompleted = completedThisWeek.filter((entity) => !linkName(entity.properties.project));
  // 当前复盘（最新一条），或准备新建
  const currentReview = reviews.find((review) => asString(review.properties.period_start) === week.start && asString(review.properties.period_end) === week.end);
  const [body, setBody] = useState(currentReview?.body ?? buildTemplate(week));
  const focusSignals = [
    activeProjects.length > 3 ? `当前同时推进 ${activeProjects.length} 个项目。新增重点前，先明确暂时停止或等待什么。` : "",
    unlinkedOpenTasks.length ? `${unlinkedOpenTasks.length} 个开放任务没有项目归属，检查它们是在服务结果，还是只是活动。` : ""
  ].filter(Boolean);

  const createMutation = useMutation({
    mutationFn: () => api.create("review", {
      name: `${today} 每周复盘`,
      properties: { review_type: "weekly", period_start: week.start, period_end: week.end },
      body: body || buildTemplate(week)
    }),
    onSuccess: async () => { await refresh(); notify("已创建本周复盘"); }
  });
  const saveMutation = useMutation({
    mutationFn: () => currentReview ? api.update(currentReview, { body }) : Promise.reject(new Error("没有可保存的复盘")),
    onSuccess: async () => { await refresh(); notify("复盘已保存"); }
  });

  return <>
    <div className="review-page-header">
      <div>
        <h1>每周复盘</h1>
        <p>{week.label}</p>
      </div>
      <div className="review-page-actions">
        {currentReview && <button className="button secondary" onClick={() => openEntity(currentReview)}>打开历史笔记</button>}
        <button className="button primary" onClick={() => currentReview ? saveMutation.mutate() : createMutation.mutate()}>
          {currentReview ? <><Save size={17} />保存复盘</> : <><Plus size={17} />新建本周复盘</>}
        </button>
      </div>
    </div>

    <div className="review-stats">
      <div className="review-stat"><div className="review-stat-icon"><CheckCircle2 /></div><div><small>本周完成任务</small><strong>{completedThisWeek.length}</strong></div></div>
      <div className="review-stat"><div className="review-stat-icon"><FolderKanban /></div><div><small>进行中项目</small><strong>{activeProjects.length}</strong></div></div>
      <div className="review-stat"><div className="review-stat-icon"><ListChecks /></div><div><small>未归属开放任务</small><strong className={unlinkedOpenTasks.length ? "is-warning" : ""}>{unlinkedOpenTasks.length}</strong></div></div>
      <div className="review-stat"><div className="review-stat-icon"><AlertTriangle /></div><div><small>本周完成但未归属</small><strong className={unlinkedCompleted.length ? "is-warning" : ""}>{unlinkedCompleted.length}</strong></div></div>
    </div>
    {focusSignals.length > 0 && <div className="review-focus-signals" role="status">{focusSignals.map((signal) => <span key={signal}><AlertTriangle size={14} />{signal}</span>)}</div>}

    <div className="review-content">
      <div className="wide-panel review-editor">
        <div className="section-heading"><div><BarChart3 /><h2>每周复盘六问</h2></div><span className="muted">回答填在这里，自动写入 Markdown</span></div>
        <textarea
          className="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="review-side">
        <div className="wide-panel">
          <div className="section-heading"><div><CheckCircle2 /><h2>本周已完成</h2></div></div>
          {completedThisWeek.length ? <div className="review-mini-list">{completedThisWeek.slice(0, 5).map((task) => <div key={task.id}><CheckCircle2 size={17} /><strong>{task.name}</strong><small>{linkName(task.properties.project) || "未分类"}</small></div>)}</div> : <div className="calm-state">本周还没有完成的任务。</div>}
        </div>

        <div className="wide-panel">
          <div className="section-heading"><div><AlertTriangle /><h2>需要补救</h2></div></div>
          {overdueTasks.length
            ? <div className="review-mini-list">{overdueTasks.slice(0, 5).map((task) => <div key={task.id} className="is-overdue"><AlertTriangle size={17} /><strong>{task.name}</strong><small>{dueText(task.properties.due, today)}</small></div>)}</div>
            : <div className="calm-state">没有逾期任务。</div>}
        </div>

        <div className="wide-panel">
          <div className="section-heading"><div><TrendingUp /><h2>项目推进</h2></div></div>
          <div className="review-mini-list">{activeProjects.slice(0, 4).map((project) => {
            const tasks = projectTasks(project, [...entities, ...archivedTasks]);
            const completed = tasks.filter((task) => ["done", "cancelled"].includes(asString(task.properties.status))).length;
            return <div key={project.id}><FolderKanban size={17} /><div><strong>{project.name}</strong><small>{tasks.length ? `${completed}/${tasks.length} 项任务完成` : "暂无关联任务"}</small></div><span className="review-mini-pct">{tasks.length ? `${completed}/${tasks.length}` : "—"}</span></div>;
          })}</div>
        </div>

        <div className="wide-panel">
          <div className="section-heading"><div><CalendarDays /><h2>复盘历史</h2></div></div>
          {reviews.length ? <div className="review-history">{reviews.map((review) => <button key={review.id} className="review-history-row" onClick={() => openEntity(review)}>
            <strong>{review.name}</strong>
            <small>{asString(review.properties.review_type) === "weekly" ? "每周复盘" : "其他"}</small>
            <span>{asString(review.properties.period_start) || "—"}</span>
          </button>)}</div> : <div className="calm-state">还没有历史复盘。</div>}
        </div>
      </div>
    </div>
  </>;
}

function ProjectReviewTab() {
  const { entities, archivedTasks = [], byKind, refresh } = useWorkbench();
  const { notify, openEntity } = useUiActions();
  const projects = byKind("project").filter((project) => project.properties.status !== "archived").sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  const executionEntities = [...entities, ...archivedTasks];
  const tasks = project ? projectTasks(project, executionEntities) : [];
  const completed = tasks.filter((task) => ["done", "cancelled"].includes(asString(task.properties.status))).length;
  const taskCompletion = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  function generateReview() {
    if (!project) return;
    setReview(`# ${project.name} 项目复盘\n\n## 目标与结果证据\n\n- 项目目标：\n- 已观察到的结果：\n- 结果证据：\n\n## 问题与阻力\n\n- 当前差距：\n- 最大阻力：\n\n## 下一步\n\n- 下一步最小行动：\n`);
  }
  async function saveReview() {
    if (!project || !review.trim() || saving) return;
    setSaving(true);
    try {
      await api.create("review", { name: `${project.name} 项目复盘`, properties: { review_type: "project", project: `[[${project.name}]]` }, body: `# ${project.name} 项目复盘\n\n${review.trim()}` });
      await refresh(); notify("项目复盘已保存");
    } catch (error) { notify(error instanceof Error ? error.message : "保存项目复盘失败", "danger"); }
    finally { setSaving(false); }
  }
  return <>
    <div className="review-page-header"><div><h1>项目复盘</h1><p>审查已做过或正在推进的项目，记录事实并明确下一步。</p></div><div className="review-page-actions"><select className="project-review-select" aria-label="选择项目" value={project?.id ?? ""} onChange={(event) => { setProjectId(event.target.value); setReview(""); }}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button primary" disabled={!project || busy} onClick={generateReview}>新建复盘草稿</button></div></div>
    {!project ? <EmptyState title="还没有可复盘的项目" description="先创建一个项目并关联任务，再回来进行项目复盘。" /> : <>
      <div className="review-stats"><div className="review-stat"><div className="review-stat-icon"><FolderKanban /></div><div><small>项目状态</small><strong>{asString(project.properties.status) || "未设置"}</strong></div></div><div className="review-stat"><div className="review-stat-icon"><CheckCircle2 /></div><div><small>任务完成</small><strong>{completed}/{tasks.length}</strong></div></div><div className="review-stat"><div className="review-stat-icon"><TrendingUp /></div><div><small>任务完成率</small><strong>{taskCompletion}%</strong></div></div><div className="review-stat"><div className="review-stat-icon"><CalendarDays /></div><div><small>目标日期</small><strong>{asString(project.properties.target) || "未设置"}</strong></div></div></div>
      <div className="review-content"><div className="wide-panel review-editor"><div className="section-heading"><div><Activity /><h2>项目复盘记录</h2></div><span className="muted">记录事实、阻力与下一步</span></div><textarea className="review-body" value={review} onChange={(event) => setReview(event.target.value)} placeholder="填写项目复盘…" />{review && <div className="project-review-actions"><button className="button secondary" onClick={() => openEntity(project)}>打开项目</button><button className="button primary" disabled={saving} onClick={() => void saveReview()}>{saving ? "保存中…" : "保存项目复盘"}</button></div>}</div><div className="review-side"><div className="wide-panel"><div className="section-heading"><div><ListChecks /><h2>关联任务</h2></div></div>{tasks.length ? <div className="review-mini-list">{tasks.map((task) => <div key={task.id}><CheckCircle2 size={17} /><strong>{task.name}</strong><small>{asString(task.properties.status) || "未设置"}</small></div>)}</div> : <div className="calm-state">这个项目还没有关联任务。</div>}</div><div className="wide-panel"><div className="section-heading"><div><FileText /><h2>项目笔记</h2></div></div><div className="project-review-note">{project.body ? project.body.slice(0, 800) : "暂无项目笔记"}</div></div></div></div>
    </>}
  </>;
}

function buildTemplate(week: { start: string; end: string; label: string }) {
  return `# 每周复盘 · ${week.label}

## 1. 本周最重要的结果是什么
写下现实中真正发生的变化，并注明证据；不要只罗列完成的任务。它是否留下了可复用成果、专长或关系资产？

## 2. 哪些工作让我投入或消耗能量
投入：
消耗：

## 3. 哪个假设或小型原型获得了真实反馈
假设：
反馈：
判断从什么更新成了什么：
下一轮如何调整：

## 4. 哪些项目或任务应该停止、重构或延后
新增重点前，明确暂时不做什么；忽略沉没成本，区分不可改变的限制、可以重构的问题，以及没有转化为输出的信息输入。

## 5. 下周只保留哪 1–3 个重点结果
1.
2.
3.

## 6. 当前选择是否仍服务于未来愿景
从未来回看：这些重点是否值得？为未来投入的同时，是否保留了必要的当下生活与恢复？
`;
}

function weekRange(today: string): { start: string; end: string; label: string } {
  const d = new Date(today);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow; // 周一为起点
  const start = new Date(d);
  start.setDate(d.getDate() + offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const label = `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
  return { start: fmt(start), end: fmt(end), label };
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get("q") ?? "");
  const query = params.get("q") ?? "";
  const results = useQuery({ queryKey: ["search", query], queryFn: () => api.search(query), enabled: Boolean(query) });
  const { entities } = useWorkbench();
  const { openDocument } = useUiActions();
  return <>
    <form className="search-page-form" onSubmit={(event) => { event.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}); }}><Search size={22} /><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入关键词" /><button className="button primary">搜索</button></form>
    <div className="search-results">
      {query && <div className="result-summary">“{query}” 的搜索结果 · {results.data?.results.length ?? 0} 项</div>}
      {results.isPending && <div className="calm-state" role="status"><RefreshCw size={15} className="spin" />正在检索本地 Vault…</div>}
      {results.isError && <div className="error-notice" role="alert">搜索失败：{results.error instanceof Error ? results.error.message : "未知错误"}</div>}
      {results.data?.results.map((result) => {
        const entity = entities.find((item) => item.id === result.id);
        return <button key={result.id} onClick={() => entity && (entity.kind === "document" ? openDocument(entity) : void api.openInObsidian(entity.path))}><span className="result-icon">{result.kind === "project" ? <FolderKanban /> : result.kind === "plan" ? <CalendarDays /> : <FileText />}</span><div><strong>{result.name}</strong><p>{result.summary || entity?.body.slice(0, 160)}</p><small>{kindLabel(result.kind)} · {result.path}</small></div></button>;
      })}
      {query && results.data && !results.data.results.length && <EmptyState title="没有找到匹配内容" description="尝试使用更短的关键词，或者检查内容是否已经保存到 Vault。" />}
    </div>
  </>;
}

/** 归档内容的领域归属：项目按自身 area，任务按「所属项目 → 项目的领域」，兜底任务自身 area。 */
function resolveArchivedArea(entity: VaultEntity, projects: VaultEntity[]): string {
  if (entity.kind === "project") return linkName(entity.properties.area) || "未分类";
  const projectName = linkName(entity.properties.project);
  if (projectName) {
    const project = projects.find((candidate) => candidate.name === projectName);
    const projectArea = linkName(project?.properties.area);
    if (projectArea) return projectArea;
  }
  return linkName(entity.properties.area) || "未分类";
}

export function ArchivePage() {
  const { entities, archivedTasks = [], archivedProjects = [], byKind, refresh } = useWorkbench();
  const { notify, openEntity } = useUiActions();
  const [area, setArea] = useState<string>("all");
  const areas = useMemo(() => byKind("area")
    .filter((entity) => entity.properties.visible !== false)
    .sort((a, b) => asNumber(a.properties.order) - asNumber(b.properties.order)), [byKind]);
  const projects = useMemo(() => [...byKind("project"), ...archivedProjects], [archivedProjects, byKind]);

  const archived = useMemo(() => {
    const items = [
      ...entities.filter((entity) => ["done", "cancelled", "completed", "archived", "processed", "accepted", "rejected", "withdrawn"].includes(asString(entity.properties.status))),
      ...archivedTasks,
      ...archivedProjects
    ];
    return [...new Map(items.map((entity) => [entity.id, entity])).values()]
      .map((entity) => ({ entity, area: resolveArchivedArea(entity, projects) }))
      .sort((a, b) => b.entity.modifiedAt.localeCompare(a.entity.modifiedAt));
  }, [archivedProjects, archivedTasks, entities, projects]);

  const visibleAreas = useMemo(() => {
    const present = new Set(archived.map((item) => item.area));
    const list = areas.filter((item) => present.has(item.name)).map((item) => item.name);
    if (present.has("未分类")) list.push("未分类");
    return list;
  }, [archived, areas]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof archived>();
    for (const item of archived) {
      const key = area === "all" ? item.area : area;
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [archived, area]);

  const restoreMutation = useMutation({
    mutationFn: (entity: VaultEntity) => entity.kind === "task" && entity.path.startsWith("90-Archive/task/")
      ? api.restoreArchivedTask(entity)
      : entity.kind === "project" && entity.path.startsWith("90-Archive/project/")
        ? api.restoreArchivedProject(entity)
        : api.update(entity, { properties: { status: entity.kind === "task" ? "todo" : "active" }, actor: "restore", statusNote: "从归档区恢复", allowStatusOverride: true }),
    onSuccess: async (_result, entity) => {
      await refresh();
      notify(entity.kind === "task" ? "任务已恢复为待办" : entity.kind === "project" ? "项目已恢复为进行中" : "内容已恢复为进行中");
    }
  });
  const removeMutation = useMutation({
    mutationFn: (entity: VaultEntity) => api.archive(entity),
    onSuccess: async () => { await refresh(); notify("已移入归档区"); }
  });

  return <>
    <div className="goals-page">
      <div className="page-primary">
        <nav className="area-tabs" aria-label="归档领域筛选">
          <strong>归档</strong>
          <div className="area-tab-list">
            <button type="button" className={`area-tab${area === "all" ? " active" : ""}`} onClick={() => setArea("all")}>全部</button>
            {visibleAreas.map((name) => <button type="button" key={name} className={`area-tab${area === name ? " active" : ""}`} onClick={() => setArea(name)}>{name}</button>)}
          </div>
        </nav>

        {archived.length === 0 ? <EmptyState title="归档为空" description="完成的项目和任务会出现在这里。" /> :
          <div className="archive-groups">
            {groups.map(([groupName, items]) => (
              <section className="archive-area-group" key={groupName}>
                <header className="archive-area-head"><span>{groupName}</span><small>{items.length} 项</small></header>
                <div className="archive-area-list">
                  {items.map(({ entity }) => {
                    const isArchivedTask = entity.kind === "task" && entity.path.startsWith("90-Archive/task/");
                    const isArchivedProject = entity.kind === "project" && entity.path.startsWith("90-Archive/project/");
                    return <div className="archive-area-row" key={entity.id}>
                      <Archive size={15} className="archive-area-icon" />
                      <div className="archive-area-copy">
                        <strong>{entity.name}</strong>
                        <small>{kindLabel(entity.kind)} · {asString(entity.properties.updated) || entity.modifiedAt.slice(0, 10)}</small>
                      </div>
                      <RowMenu actions={isArchivedTask ? [
                        { key: "open", label: "在 Obsidian 打开", icon: FileText, onClick: () => void api.openInObsidian(entity.path) },
                        { key: "restore", label: "恢复为待办", icon: ArrowUp, onClick: () => restoreMutation.mutate(entity) }
                      ] : isArchivedProject ? [
                        { key: "open", label: "在 Obsidian 打开", icon: FileText, onClick: () => void api.openInObsidian(entity.path) },
                        { key: "restore", label: "恢复为进行中", icon: ArrowUp, onClick: () => restoreMutation.mutate(entity) }
                      ] : [
                        { key: "edit", label: "编辑", icon: FileText, onClick: () => openEntity(entity) },
                        { key: "restore", label: "恢复", icon: ArrowUp, onClick: () => restoreMutation.mutate(entity) },
                        { key: "remove", label: "移入归档区", icon: Archive, tone: "danger", onClick: () => removeMutation.mutate(entity) }
                      ]} />
                    </div>;
                  })}
                </div>
              </section>
            ))}
          </div>}
        <div className="database-count">{archived.length} 项归档内容</div>
      </div>
    </div>
  </>;
}

export function SettingsPage() {
  const { byKind, refresh, vaultName } = useWorkbench();
  const { notify } = useUiActions();
  const [areas, setAreas] = useState<VaultEntity[]>(() => byKind("area").sort((a, b) => asNumber(a.properties.order) - asNumber(b.properties.order)));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const refreshAreas = useCallback(() => {
    setAreas(byKind("area").sort((a, b) => asNumber(a.properties.order) - asNumber(b.properties.order)));
  }, [byKind]);
  const mutation = useMutation({
    mutationFn: ({ entity, properties }: { entity: VaultEntity; properties: EntityProperties }) => api.update(entity, { properties }),
    onSuccess: async () => { await refresh(); refreshAreas(); notify("领域已更新"); }
  });
  const cleanupMutation = useMutation({
    mutationFn: () => api.cleanupWorkflowCache(30),
    onSuccess: ({ removed }) => notify(`已清理 ${removed} 个过期运行缓存文件`)
  });

  function reorder(srcId: string, dstId: string | null) {
    if (srcId === dstId) return;
    const items = [...areas];
    const fromIdx = items.findIndex((a) => a.id === srcId);
    if (fromIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);
    if (dstId === null) {
      items.push(moved);
    } else {
      const toIdx = items.findIndex((a) => a.id === dstId);
      items.splice(toIdx < 0 ? items.length : toIdx, 0, moved);
    }
    setAreas(items);
    items.forEach((area, i) => {
      if (asNumber(area.properties.order) !== i) {
        mutation.mutate({ entity: area, properties: { order: i } });
      }
    });
  }

  return <>
    <div className="settings-layout">
      <section className="settings-section"><div className="settings-title"><Settings size={21} /><div><h2>领域导航</h2><p>调整侧边栏领域的顺序与可见性；名称、介绍与新增在「领域」页管理。</p></div></div>
        <div className="area-settings">
          <div className="area-settings-head">
            <Link className="button secondary small" to="/areas"><Layers size={16} />去领域页管理</Link>
            <small>共 {areas.length} 个</small>
          </div>
          {areas.map((area) => (
            <div
              key={area.id}
              className={`area-row${draggingId === area.id ? " is-dragging" : ""}${hoverId === area.id ? " is-drop-target" : ""}`}
              draggable
              onDragStart={(event) => { event.dataTransfer.setData("text/plain", area.id); setDraggingId(area.id); }}
              onDragEnd={() => { setDraggingId(null); setHoverId(null); }}
              onDragOver={(event) => { event.preventDefault(); setHoverId(area.id); }}
              onDragLeave={() => setHoverId(null)}
              onDrop={(event) => {
                event.preventDefault();
                const srcId = event.dataTransfer.getData("text/plain");
                reorder(srcId, area.id);
                setDraggingId(null);
                setHoverId(null);
              }}
            >
              <GripVertical size={15} className="area-grip" />
              <span className="area-color" style={{ background: asString(area.properties.color) || "#2563eb" }} />
              <strong>{area.name}</strong>
              <label className="switch"><input type="checkbox" checked={area.properties.visible !== false} onChange={() => mutation.mutate({ entity: area, properties: { visible: area.properties.visible === false } })} /><span /></label>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-section"><div className="settings-title"><FileText size={21} /><div><h2>本地数据</h2><p>当前 Vault：{vaultName}</p></div></div><div className="setting-row"><div><strong>唯一事实源</strong><span>Markdown、YAML 与 Wikilink</span></div><CheckCircle2 className="green-text" /></div><div className="setting-row"><div><strong>工作流运行缓存</strong><span>高频日志默认保留 30 天</span></div><button className="button secondary small" disabled={cleanupMutation.isPending} onClick={() => cleanupMutation.mutate()}>立即清理</button></div><div className="setting-row"><div><strong>外部同步</strong><span>未连接日历、邮件或招聘平台</span></div><StatusDot tone="gray" /></div></section>
      <AiConfigSection />
    </div>
  </>;
}

function AiConfigSection() {
  const { notify } = useUiActions();
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ["ai-config"], queryFn: () => api.getAiConfig() });
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (configQuery.data && !initialized) {
      setBaseUrl(configQuery.data.baseUrl || "");
      setModel(configQuery.data.model || "");
      setInitialized(true);
    }
  }, [configQuery.data, initialized]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveAiConfig({
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      apiKey: apiKey.trim() || undefined
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      setApiKey("");
      notify("AI 配置已保存至本地 Vault");
    },
    onError: (err) => notify(`保存失败：${(err as Error).message}`, "danger")
  });

  const configured = configQuery.data?.configured ?? false;

  return (
    <section className="settings-section">
      <div className="settings-title">
        <Sparkles size={21} />
        <div>
          <h2>AI 战略顾问配置</h2>
          <p>支持接入 DeepSeek、OpenAI 或本地 Ollama；未配置时自动使用本地智能规则。</p>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <strong>当前状态</strong>
          <span>{configured ? "已连接大模型，主界面启用 AI 深度研判" : "未连接模型，当前使用本地智能启发式规则"}</span>
        </div>
        <StatusDot tone={configured ? "green" : "gray"} />
      </div>
      <form
        className="ai-settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="form-field">
          <label htmlFor="ai-base-url">API 接口地址 (Base URL)</label>
          <input
            id="ai-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
        </div>
        <div className="form-field">
          <label htmlFor="ai-model">模型名称 (Model)</label>
          <input
            id="ai-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat"
          />
        </div>
        <div className="form-field">
          <label htmlFor="ai-api-key">API 密钥 (API Key)</label>
          <input
            id="ai-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={configQuery.data?.hasApiKey ? "已配置密钥（输入可覆盖更新）" : "输入 API Key (如 sk-...)"}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="button primary small" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "正在保存…" : "保存 AI 配置"}
          </button>
        </div>
      </form>
    </section>
  );
}
