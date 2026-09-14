import { AlertTriangle, ArrowUp, Check, CheckCircle2, Clock3, Filter, Inbox, Plus, RefreshCw, Search, Target, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState, useEffect, type FormEvent } from "react";
import { api } from "../api";
import { EmptyState, ProgressBar, RowMenu, Section, StatusDot, useUiActions } from "../components";
import { useWorkbench } from "../context";
import {
  asString,
  dueText,
  isOpenTask,
  linkName,
  taskStatusForUi,
  taskStatusLabel,
  type VaultEntity
} from "../../shared/domain";

export function TodayPage() {
  const { entities, today, refresh } = useWorkbench();
  const { notify, openEntity, openCreate } = useUiActions();
  const tasks = entities.filter(isOpenTask).filter((entity) =>
    entity.properties.scheduled === today
    || entity.properties.due === today
    || (entity.properties.focus === true && !entity.properties.scheduled)
    || entity.properties.status === "doing"
  );
  const overdue = entities.filter(isOpenTask).filter((entity) => asString(entity.properties.due) && asString(entity.properties.due) < today);
  const timedTasks = useMemo(() => tasks
    .slice()
    .sort((a, b) => {
      const aTime = asString(a.properties.scheduled_time);
      const bTime = asString(b.properties.scheduled_time);
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;
      if (aTime && bTime) return aTime.localeCompare(bTime);
      return 0;
    }),
  [tasks]);
  const mutation = useMutation({
    mutationFn: async (entity: VaultEntity) => {
      const completed = await api.update(entity, { properties: { status: "done" }, actor: "ui" });
      return api.archive(completed);
    },
    onSuccess: async () => { await refresh(); notify("已完成并归档"); },
    onError: () => notify("操作失败：任务可能已归档或文件已被修改", "danger")
  });
  const timeMutation = useMutation({
    mutationFn: ({ entity, time }: { entity: VaultEntity; time: string }) => api.update(entity, { properties: { scheduled_time: time, scheduled: today } }),
    onSuccess: async () => { await refresh(); notify("时间已调整"); }
  });

  return <>
    <div className="two-column-page">
      <div>
        <Section title="需要先处理" icon={AlertTriangle}>
          {overdue.length ? <TaskRows tasks={overdue} today={today} onToggle={(task) => mutation.mutate(task)} /> : <div className="calm-state">没有逾期任务。</div>}
        </Section>
        <Section title="今日任务" icon={Target}>
          <TaskRows tasks={tasks} today={today} onToggle={(task) => mutation.mutate(task)} />
        </Section>
      </div>
      <div>
        <Section title="今天的时间安排" icon={Clock3}>
          {timedTasks.length > 0 ? <DraggableTimeline tasks={timedTasks} onUpdateTime={(entity, time) => timeMutation.mutate({ entity, time })} onOpen={openEntity} /> : <div className="calm-state" style={{ padding: 20 }}>今天还没有时间安排。<br /><button className="button primary small" style={{ marginTop: 10 }} onClick={() => openCreate("task")}><Plus size={14} />新建任务</button></div>}
        </Section>
      </div>
    </div>
  </>;
}

const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 23;
const TIMELINE_SLOT_PX = 22;

function DraggableTimeline({ tasks, onUpdateTime, onOpen }: { tasks: VaultEntity[]; onUpdateTime: (entity: VaultEntity, time: string) => void; onOpen: (entity: VaultEntity) => void }) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const pointerDragRef = useRef<string | null>(null);
  const pointerStartYRef = useRef(0);
  const pointerMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [pointerDragId, setPointerDragId] = useState<string | null>(null);
  const [pointerSlot, setPointerSlot] = useState<string | null>(null);
  const slots = useMemo(() => {
    const out: string[] = [];
    for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
      out.push(`${String(h).padStart(2, "0")}:00`);
      if (h < TIMELINE_END_HOUR) out.push(`${String(h).padStart(2, "0")}:30`);
    }
    return out;
  }, []);
  const offsetFor = (time: string): number => {
    if (!time) return -1;
    const [hStr, mStr] = time.split(":");
    const h = Number(hStr); const m = Number(mStr);
    if (isNaN(h) || h < TIMELINE_START_HOUR || h > TIMELINE_END_HOUR) return -1;
    return ((h - TIMELINE_START_HOUR) * 60 + m) / 30 * TIMELINE_SLOT_PX;
  };
  function slotAt(clientY: number): string | null {
    const track = timelineRef.current?.querySelector<HTMLElement>(".timeline-track");
    if (!track) return null;
    const index = Math.round((clientY - track.getBoundingClientRect().top - 4) / TIMELINE_SLOT_PX);
    return slots[Math.max(0, Math.min(slots.length - 1, index))] ?? null;
  }
  function startPointerDrag(event: React.PointerEvent<HTMLDivElement>, task: VaultEntity) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDragRef.current = task.id;
    pointerStartYRef.current = event.clientY;
    pointerMovedRef.current = false;
    setPointerDragId(task.id);
    setPointerSlot(slotAt(event.clientY));
  }
  function movePointerDrag(event: React.PointerEvent<HTMLDivElement>, task: VaultEntity) {
    if (pointerDragRef.current !== task.id) return;
    event.preventDefault();
    if (Math.abs(event.clientY - pointerStartYRef.current) > 6) pointerMovedRef.current = true;
    setPointerSlot(slotAt(event.clientY));
  }
  function endPointerDrag(event: React.PointerEvent<HTMLDivElement>, task: VaultEntity) {
    if (pointerDragRef.current !== task.id) return;
    event.preventDefault();
    const slot = slotAt(event.clientY) || pointerSlot;
    pointerDragRef.current = null;
    setPointerDragId(null);
    setPointerSlot(null);
    if (pointerMovedRef.current && slot) { suppressClickRef.current = true; onUpdateTime(task, slot); window.setTimeout(() => { suppressClickRef.current = false; }, 250); }
  }

  return (
    <div className={`draggable-timeline${pointerDragId ? " is-pointer-dragging" : ""}`} ref={timelineRef}>
      <div className="timeline-track">
        {slots.map((slot, i) => {
          const isHour = slot.endsWith(":00");
          return (
            <div
              className={`timeline-slot${isHour ? " is-hour" : ""}${pointerSlot === slot ? " is-drop-target" : ""}`}
              data-time={slot}
              key={slot}
              style={{ height: TIMELINE_SLOT_PX }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; event.currentTarget.classList.add("is-drop-target"); }}
              onDragLeave={(event) => event.currentTarget.classList.remove("is-drop-target")}
              onDrop={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove("is-drop-target");
                const id = event.dataTransfer.getData("text/plain");
                if (id) {
                  const task = tasks.find((t) => t.id === id);
                  if (task) onUpdateTime(task, slot);
                }
              }}
            >
              {isHour && <span className="timeline-hour-label">{slot}</span>}
            </div>
          );
        })}
      </div>
      <div className="timeline-tasks-layer">
        {tasks.map((task) => {
          const time = asString(task.properties.scheduled_time);
          const top = offsetFor(time);
          const taskProps = {
            className: `timeline-task${top < 0 ? " timeline-task-unscheduled" : ""}`,
            draggable: true,
            role: "button",
            tabIndex: 0,
            "aria-grabbed": "true",
            title: top < 0 ? `${task.name} · 拖到时间槽上排期` : `${task.name} · 拖到其他时间槽调整`,
            onDragStart: (event: React.DragEvent<HTMLDivElement>) => {
              event.dataTransfer.setData("text/plain", task.id);
              event.dataTransfer.effectAllowed = "move";
              // Required for WKWebView: setting dragImage helps some versions
              // recognize the drag; fallback to default if not supported.
              try {
                if (event.dataTransfer.setDragImage && event.currentTarget) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  event.dataTransfer.setDragImage(event.currentTarget, rect.width / 2, 10);
                }
              } catch { /* ignore */ }
            },
            onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => startPointerDrag(event, task),
            onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => movePointerDrag(event, task),
            onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => endPointerDrag(event, task),
            onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => endPointerDrag(event, task),
            onClick: (event: React.MouseEvent<HTMLDivElement>) => { if (suppressClickRef.current) { event.preventDefault(); return; } onOpen(task); },
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(task);
              }
            },
            style: top < 0 ? undefined : { top: `${top}px` },
          } as const;
          return (
            <div key={task.id} {...taskProps}>
              <strong>{task.name}</strong>
              <small>{linkName(task.properties.project) || linkName(task.properties.area) || "未分类"}</small>
              {top < 0 && <em>拖到这里排期</em>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InboxPage() {
  const { byKind, refresh } = useWorkbench();
  const { openCapture, openCreate, openEntity, notify } = useUiActions();
  const [converting, setConverting] = useState<VaultEntity | null>(null);
  const inbox = byKind("inbox").filter((entity) => entity.properties.status !== "processed");
  return <>
    <div className="page-header">
      <h1>收集箱</h1>
      <button className="button primary" onClick={openCapture}><Plus size={17} />收集</button>
    </div>
    {inbox.length ? <div className="inbox-feed">
      {inbox.map((entity) => {
        const created = asString(entity.properties.created);
        const body = entity.body || asString(entity.properties.summary);
        return <article className="inbox-card" key={entity.id}>
          <div className="inbox-card-row">
            <button className="inbox-card-title" onClick={() => openEntity(entity)}>{entity.name}</button>
            <div className="inbox-card-meta">{created && <time>{created}</time>}<button className="button secondary small" onClick={() => setConverting(entity)}>整理</button></div>
          </div>
          {body && <p className="inbox-card-body">{body}</p>}
        </article>;
      })}
    </div> : <EmptyState title="收集箱为空" description="把突发的想法或待处理的事项快速记下来，再慢慢整理。" action={<><button className="button primary" onClick={openCapture}>记录一条</button><button className="button secondary" style={{ marginLeft: 8 }} onClick={() => openCreate?.("task")}>直接新建任务</button></>} />}
    {converting && <ConvertModal entity={converting} onClose={() => setConverting(null)} onDone={async () => { await refresh(); notify("收集项已转换"); setConverting(null); }} />}
  </>;
}

export function TasksPage() {
  const { entities, today, refresh } = useWorkbench();
  const { openCreate, openEntity, notify } = useUiActions();
  const [view, setView] = useState<"all" | "todo" | "doing">("all");
  const [source, setSource] = useState<"" | "manual" | "automation" | "ai">("");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [source, today, view]);
  const mutation = useMutation({
    mutationFn: async (task: VaultEntity) => {
      const completed = await api.update(task, { properties: { status: "done" }, actor: "ui" });
      return api.archive(completed);
    },
    onSuccess: async () => { await refresh(); notify("已完成并归档"); },
    onError: () => notify("操作失败：任务可能已归档或文件已被修改", "danger")
  });
  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const targets = ids.map((id) => entities.find((entity) => entity.id === id)).filter((entity): entity is VaultEntity => Boolean(entity));
      for (const entity of targets) {
        try { await api.trash(entity); } catch { /* 逐个失败不中断整体 */ }
      }
      return targets.length;
    },
    onSuccess: async (count) => { setSelected(new Set()); await refresh(); notify(`已删除 ${count} 个任务`); },
    onError: () => notify("部分任务删除失败，请重试", "danger")
  });

  const allOpenTasks = useMemo(() => entities.filter(isOpenTask), [entities]);
  // 任务中心只展示未完成任务；已完成/已归档任务直接归入归档区，不在任务中心出现。
  const allTasks = useMemo(() => entities.filter((entity) =>
    entity.kind === "task" && !["done", "cancelled", "archived"].includes(asString(entity.properties.status))
  ), [entities]);
  const counts = useMemo(() => {
    let todo = 0, doing = 0, exception = 0, pending = 0;
    for (const entity of allOpenTasks) {
      const status = asString(entity.properties.status);
      const due = asString(entity.properties.due);
      const overdue = Boolean(due && due < today);
      if (status === "todo" || status === "inbox" || status === "backlog") todo++;
      else if (status === "doing") doing++;
      else if (status === "blocked" || overdue) exception++;
      if (status === "blocked") pending++;
    }
    return { todo, doing, exception, pending };
  }, [allOpenTasks, today]);

  const tasks = useMemo(() => allTasks.filter((entity) => {
    const status = asString(entity.properties.status);
    if (view === "todo" && !["todo", "inbox", "backlog"].includes(status)) return false;
    if (view === "doing" && status !== "doing") return false;
    if (!source) return true;
    if (source === "automation") return Boolean(entity.properties.automation_operation);
    if (source === "ai") return entity.properties.source === "ai";
    return !entity.properties.automation_operation && entity.properties.source !== "ai";
  }).filter((entity) => {
    if (!query.trim()) return true;
    const haystack = [entity.name, linkName(entity.properties.area), linkName(entity.properties.project), asString(entity.properties.assignee)].join(" ").toLocaleLowerCase("zh-CN");
    return haystack.includes(query.trim().toLocaleLowerCase("zh-CN"));
  }).sort((a, b) => {
    const aDue = asString(a.properties.due) || "9999-99-99";
    const bDue = asString(b.properties.due) || "9999-99-99";
    return aDue.localeCompare(bDue);
  }), [allTasks, query, source, view]);

  const selectedTasks = useMemo(() => tasks.filter((task) => selected.has(task.id)), [selected, tasks]);
  const totalAttention = counts.todo + counts.doing + counts.exception;
  const summaryHeading = totalAttention === 0 ? "今天暂不需要关注的任务" : "今天的任务";

  return <>
    <header className="tasks-hero">
      <div className="tasks-hero-text">
        <h1>任务中心</h1>
        <p>按协作根单聚合，展开可看下游。待闭环实验后才算已完成。</p>
      </div>
      <div className="tasks-hero-actions">
        <button type="button" className="button secondary" disabled={batchDeleteMutation.isPending} onClick={() => {
          if (!selectedTasks.length) { notify("请先勾选要删除的任务"); return; }
          if (window.confirm(`确定删除选中的 ${selectedTasks.length} 个任务？文件将移入系统废纸篓。`)) batchDeleteMutation.mutate(selectedTasks.map((task) => task.id));
        }}>
          {batchDeleteMutation.isPending ? "删除中…" : selectedTasks.length ? `批量删除 (${selectedTasks.length})` : "批量删除"}
        </button>
        <button type="button" className="button primary" onClick={() => openCreate("task")}>
          <Plus size={16} />新建任务
        </button>
      </div>
    </header>

    <section className="tasks-summary">
      <div className="tasks-summary-head">
        <CheckCircle2 size={16} className={totalAttention === 0 ? "" : "orange"} />
        <strong>{summaryHeading}</strong>
        <small>按状态聚合</small>
      </div>
      <ul className="tasks-summary-stats">
        <li><span>待处理</span><strong>{counts.todo}</strong></li>
        <li><span>执行中</span><strong>{counts.doing}</strong></li>
        <li><span>异常</span><strong>{counts.exception}</strong></li>
        <li><span>待审批</span><strong>{counts.pending}</strong></li>
      </ul>
    </section>

    <div className="tasks-toolbar">
      <nav className="tasks-tabs" aria-label="任务状态视图">
        {([['all', '全部'], ['todo', '待处理'], ['doing', '运行中']] as const).map(([key, label]) => <button type="button" key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}
      </nav>
      <div className="tasks-toolbar-actions">
        <label className="tasks-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务 / 岗位 / 智能体" aria-label="搜索任务" /></label>
        <button type="button" className={`tasks-filter-button${showFilters ? " active" : ""}`} aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)}><Filter size={15} />筛选</button>
      </div>
    </div>
    {showFilters && <div className="tasks-filter-row">
      <label className="tasks-source">
        <span>来源</span>
        <select value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
          <option value="">全部</option>
          <option value="manual">手动创建</option>
          <option value="automation">自动化生成</option>
          <option value="ai">AI 提炼</option>
        </select>
      </label>
    </div>}

    <section className="tasks-list-section">
      <header className="tasks-list-head">
        <strong>{view === "all" ? "全部" : TASK_VIEW_LABEL[view]}任务</strong>
        <small>{tasks.length} 项</small>
      </header>
      {tasks.length === 0 ? <TasksEmptyState onCreate={() => openCreate("task")} /> : <TaskDatabaseTable tasks={tasks} today={today} onToggle={(task) => mutation.mutate(task)} selected={selected} onToggleSelect={(id) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onToggleAll={() => setSelected((current) => {
        const ids = tasks.map((task) => task.id);
        const allSelected = ids.length > 0 && ids.every((id) => current.has(id));
        if (allSelected) { const next = new Set(current); ids.forEach((id) => next.delete(id)); return next; }
        const next = new Set(current); ids.forEach((id) => next.add(id)); return next;
      })} />}
    </section>

    <footer className="tasks-footer">
      <button type="button" onClick={() => { void refresh(); notify("已刷新"); }}>
        <RefreshCw size={14} />刷新
      </button>
    </footer>
  </>;
}

const SOURCE_LABEL: Record<"manual" | "automation" | "ai", string> = {
  manual: "手动创建",
  automation: "自动化生成",
  ai: "AI 提炼"
};

const TASK_VIEW_LABEL: Record<Exclude<TasksPageView, "all">, string> = {
  todo: "待处理",
  doing: "运行中"
};

type TasksPageView = "all" | "todo" | "doing";

function TasksEmptyState({ onCreate }: { onCreate: () => void }) {
  return <div className="tasks-empty">
    <div className="tasks-empty-text">
      <strong>还没有任务，从创建一个开始吧</strong>
      <small>或点击右上角「新建任务」</small>
    </div>
    <div className="tasks-quick-cta">
      <button type="button" className="button primary small" onClick={onCreate}><Plus size={14} />新建任务</button>
    </div>
  </div>;
}

function TaskRows({ tasks, today, onToggle, detailed = false }: { tasks: VaultEntity[]; today: string; onToggle: (task: VaultEntity) => void; detailed?: boolean }) {
  const { openEntity } = useUiActions();
  if (!tasks.length) return <div className="calm-state">当前没有任务。</div>;
  return <div className={`task-list ${detailed ? "detailed" : ""}`}>{tasks.map((task) => {
    const isArchived = task.path.startsWith("90-Archive/task/");
    return <div className="task-row" key={task.id}>
    <button className={`check-button ${task.properties.status === "done" ? "done" : ""}`} onClick={() => { if (!isArchived) onToggle(task); }} disabled={isArchived} title={isArchived ? "已归档，可在归档区管理" : undefined}>{task.properties.status === "done" ? <Check size={15} /> : <span />}</button>
    <button className="row-title" onClick={() => openEntity(task)}>{task.name}</button>
    {detailed && <><span className="priority-cell">{asString(task.properties.priority).toUpperCase()}</span><span className="task-hierarchy"><small>{linkName(task.properties.area) || "未分类"}</small><strong>{linkName(task.properties.project) || "无项目"}</strong></span></>}
    {detailed && <span className="row-meta"><StatusDot tone={task.properties.status === "blocked" ? "red" : "blue"} />{linkName(task.properties.area) || asString(task.properties.status)}</span>}
    {detailed && <time className={asString(task.properties.due) < today && task.properties.status !== "done" ? "red-text" : ""}>{dueText(task.properties.due, today)}</time>}
    {detailed && <RowMenu />}
  </div>;
  })}</div>;
}

function TaskDatabaseTable({ tasks, today, onToggle, selected, onToggleSelect, onToggleAll }: { tasks: VaultEntity[]; today: string; onToggle: (task: VaultEntity) => void; selected: Set<string>; onToggleSelect: (id: string) => void; onToggleAll: () => void }) {
  const { openEntity } = useUiActions();
  const { refresh } = useWorkbench();
  const { notify } = useUiActions();
  const restoreMutation = useMutation({
    mutationFn: (task: VaultEntity) => api.restoreArchivedTask(task),
    onSuccess: async () => { await refresh(); notify("任务已恢复为待办"); },
    onError: () => notify("恢复失败，文件可能已在其他窗口修改", "danger")
  });
  if (!tasks.length) return <EmptyState title="当前视图没有任务" description="调整视图或筛选条件，也可以直接新建一项行动。" />;
  const allSelected = tasks.length > 0 && tasks.every((task) => selected.has(task.id));
  return <div className="data-table task-database-table">
    <div className="task-database-head"><span><input type="checkbox" className="task-select-all" aria-label="全选当前任务" checked={allSelected} onChange={onToggleAll} /></span><span>任务</span><span>状态</span><span>优先级</span><span>领域</span><span>项目</span><span>执行日期</span><span>截止日期</span><span /></div>
    {tasks.map((task) => {
      const projectName = linkName(task.properties.project);
      const areaName = linkName(task.properties.area);
      const isArchived = task.path.startsWith("90-Archive/task/");
      return <div className="task-database-row" key={task.id}>
        <div className="task-select-cell"><input type="checkbox" aria-label={`选择 ${task.name}`} checked={selected.has(task.id)} onChange={() => onToggleSelect(task.id)} /></div>
        <div className="task-title-cell"><button type="button" className={`task-complete-button${taskStatusForUi(task.properties.status) === "done" ? " is-done" : ""}`} aria-label={taskStatusForUi(task.properties.status) === "done" ? "任务已完成" : "完成任务"} title={taskStatusForUi(task.properties.status) === "done" ? "任务已完成" : "完成任务"} onClick={() => { if (taskStatusForUi(task.properties.status) !== "done") onToggle(task); }} disabled={taskStatusForUi(task.properties.status) === "done"}>{taskStatusForUi(task.properties.status) === "done" ? <Check size={14} /> : null}</button><button className="database-title-cell" onClick={() => openEntity(task)}>{task.name}</button></div>
        <button className="database-property-cell" onClick={() => openEntity(task)}><StatusDot tone={taskStatusTone(task)} />{taskStatusLabel(task.properties.status)}</button>
        <button className="database-property-cell priority" onClick={() => openEntity(task)}>{asString(task.properties.priority).toUpperCase() || "P2"}</button>
        <button className="database-property-cell relation" onClick={() => openEntity(task)}>{areaName || <span className="muted">—</span>}</button>
        <button className="database-property-cell relation" onClick={() => openEntity(task)} title={projectName}>{projectName || <span className="muted">—</span>}</button>
        <button className="database-property-cell date" onClick={() => openEntity(task)}>{asString(task.properties.scheduled) || <span className="muted">—</span>}{asString(task.properties.scheduled_time) ? ` ${asString(task.properties.scheduled_time)}` : ""}</button>
        <button className={`database-property-cell date ${asString(task.properties.due) < today && task.properties.status !== "done" ? "red-text" : ""}`} onClick={() => openEntity(task)}>{asString(task.properties.due) || <span className="muted">—</span>}</button>
        <RowMenu actions={isArchived ? [
          { key: "restore", label: "恢复为待办", icon: ArrowUp, onClick: () => restoreMutation.mutate(task) }
        ] : undefined} />
      </div>;
    })}
  </div>;
}

/** 任务看板：按待办、进行中、完成展示任务。 */
function TaskBoard({ tasks, today, onOpen, onToggle }: { tasks: VaultEntity[]; today: string; onOpen: (entity: VaultEntity) => void; onToggle: (task: VaultEntity) => void }) {
  const groups: [string, string, string][] = [["todo", "待办", "blue"], ["doing", "进行中", "orange"], ["done", "完成", "green"]];
  const sorted = useMemo(() => tasks.map((t) => ({ task: t, priority: priorityRank(t), due: asString(t.properties.due) })).sort((a, b) => a.priority - b.priority || (a.due || "9999").localeCompare(b.due || "9999")), [tasks]);
  return <div className="task-board">
    {groups.map(([status, label, tone]) => {
      const items = sorted.filter((entry) => taskStatusForUi(entry.task.properties.status) === status);
      return <section className={`task-board-column tone-${tone}`} key={status}>
        <header className="task-board-head"><span className={`task-board-dot tone-${tone}`} />{label}<strong>{items.length}</strong></header>
        <div className="task-board-cards">
          {items.map(({ task }) => {
            const priority = asString(task.properties.priority).toUpperCase() || "P2";
            const project = linkName(task.properties.project);
            const due = asString(task.properties.due);
            const overdue = Boolean(due && due < today && task.properties.status !== "done" && task.properties.status !== "cancelled");
            return <article className="task-board-card" key={task.id}>
              <header className="task-board-card-head">
                <button className={`check-button ${task.properties.status === "done" ? "done" : ""}`} aria-label="完成" onClick={() => { if (!task.path.startsWith("90-Archive/task/")) onToggle(task); }} disabled={task.path.startsWith("90-Archive/task/")} title={task.path.startsWith("90-Archive/task/") ? "已归档，可在归档区管理" : undefined}>{task.properties.status === "done" ? <Check size={14} /> : <span />}</button>
                <button className="task-board-card-title" onClick={() => onOpen(task)}>{task.name}</button>
              </header>
              <footer className="task-board-card-foot">
                <span className={`task-board-priority priority-${priority.toLowerCase()}`}>{priority}</span>
                {project ? <span className="task-board-project" title={project}>{project}</span> : <span className="task-board-project muted">—</span>}
                {due ? <time className={overdue ? "red-text" : ""}>{due}</time> : <time className="muted">—</time>}
              </footer>
            </article>;
          })}
        </div>
        <button className="task-board-add" onClick={() => onOpen({ id: "__new__", kind: "task", name: "", properties: { status }, body: "", path: "", revision: "0", modifiedAt: "", createdAt: "", links: [] } as VaultEntity)}><Plus size={12} />新页面</button>
      </section>;
    })}
  </div>;
}

function priorityRank(entity: VaultEntity): number {
  return { p0: 0, p1: 1, p2: 2, p3: 3 }[asString(entity.properties.priority)] ?? 4;
}

function taskStatusTone(task: VaultEntity): "blue" | "green" | "orange" | "red" | "gray" {
  return statusTone(asString(task.properties.status));
}

function statusTone(status: string): "blue" | "green" | "orange" | "red" | "gray" {
  if (["done"].includes(status)) return "green";
  if (["doing"].includes(status)) return "orange";
  if (["inbox", "backlog", "todo", "blocked"].includes(status)) return "blue";
  return "gray";
}

function ConvertModal({ entity, onClose, onDone }: { entity: VaultEntity; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<"vision" | "project" | "task" | "document" | "resource">("task");
  const [name, setName] = useState(entity.name);
  const mutation = useMutation({ mutationFn: () => api.convertInbox(entity.id, { kind, name }), onSuccess: onDone });
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(); }
  return <div className="modal-backdrop"><form className="modal compact" onSubmit={submit}>
    <div className="modal-header"><h2>整理收集项</h2><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></div>
    <label className="field"><span>名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className="field"><span>转换为</span><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="task">任务</option><option value="project">项目</option><option value="document">文档</option><option value="resource">资料</option></select></label>
    {mutation.isError && <div className="error-notice">{mutation.error.message}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary">完成转换</button></div>
  </form></div>;
}
