import {
  Archive,
  AlertTriangle,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleDollarSign,
  CircleUserRound,
  FileText,
  FolderKanban,
  HeartPulse,
  Home,
  Inbox,
  LayoutGrid,
  Lightbulb,
  Library,
  ListChecks,
  Loader2,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Plus,
  Repeat2,
  Search,
  Scale,
  Send,
  Settings,
  Sparkles,
  Sun,
  Target,
  Telescope,
  Trash2,
  X,
  Brain,
  type LucideIcon
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { useWorkbench } from "./context";
import type { EntityKind, EntityProperties } from "../shared/domain";
import { asNumber, asString, dueText, isOpenTask, kindLabel, linkName, PROJECT_ALERT_TEXT, projectAlert, projectTaskCompletion, projectTasks, relationMatches, statusMachineFor, taskStatusLabel, taskStatusForUi, type VaultEntity } from "../shared/domain";
import { StatusFlowField, StatusHistoryPanel } from "./components/StatusFlow";
import { getCurrentWindow } from "@tauri-apps/api/window";

// 拖动顶部区域移动窗口（Tauri 桌面端）。排除交互元素，避免点按钮也触发拖拽。
function startWindowDrag(event: React.MouseEvent<HTMLElement>) {
  if (event.buttons !== 1) return;
  const target = event.target as HTMLElement;
  if (target.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]')) return;
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    void getCurrentWindow().startDragging();
  }
}
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";

interface UiActions {
  openCreate: (kind: EntityKind) => void;
  openCapture: () => void;
  openDocument: (entity: VaultEntity) => void;
  openEntity: (entity: VaultEntity) => void;
  notify: (message: string, tone?: "success" | "danger") => void;
}

const UiActionsContext = createContext<UiActions | null>(null);

export function useUiActions(): UiActions {
  const actions = useContext(UiActionsContext);
  if (!actions) throw new Error("useUiActions must be used inside AppShell");
  return actions;
}

const navGroups: { label?: string; items: { to: string; label: string; icon: React.ComponentType<any> }[] }[] = [
  { items: [
    { to: "/", label: "首页", icon: Home },
    { to: "/today", label: "今日", icon: CalendarDays },
    { to: "/daily-routine", label: "日常安排", icon: ClipboardCheck },
    { to: "/inbox", label: "收集箱", icon: Inbox },
    { to: "/projects", label: "项目", icon: FolderKanban },
    { to: "/tasks", label: "任务", icon: ListChecks }
    ,{ to: "/habits", label: "习惯", icon: Repeat2 }
    ,{ to: "/daily-sop", label: "每日 SOP", icon: ClipboardCheck }
  ] },
];

const secondaryNavGroups: { label: string; items: { to: string; label: string; icon: React.ComponentType<any> }[] }[] = [
  { label: "内容", items: [
    { to: "/areas", label: "领域", icon: LayoutGrid },
    
  ] },
  { label: "回顾", items: [
    { to: "/archive", label: "归档", icon: Archive }
  ] },
  { label: "系统", items: [
    { to: "/settings", label: "设置", icon: Settings }
  ] }
];

const clockFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const calendarFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric"
});

function LiveDateTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 30_000);
    }, 1000 - (Date.now() % 1000));

    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  const [hours = "00", minutes = "00", seconds = "00"] = clockFormatter.format(now).split(":");
  const date = calendarFormatter.format(now);

  return <time className="live-datetime" dateTime={now.toISOString()} aria-label={`当前时间 ${hours}:${minutes}:${seconds}，${date}`}>
    <span className="live-date-copy">
      <span className="live-time">{hours}:{minutes}<small>:{seconds}</small></span>
      <span className="live-date">{date}</span>
    </span>
  </time>;
}

/** 建议触发按钮 + 弹出面板（顶栏右侧）。点击切换，外部点击关闭。 */
export function SuggestionTrigger() {
  const { entities } = useWorkbench();
  const { openEntity, notify } = useUiActions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const today = asString((useWorkbench() as { today?: string }).today ?? "");
  const items = useMemo(() => {
    const attention = entities.filter(isOpenTask).filter((e) => {
      const due = asString(e.properties.due);
      return Boolean(due && due < today) || e.properties.status === "blocked";
    }).slice(0, 3);
    const projectAlerts = entities.filter((e) => e.kind === "project").map((e) => ({ project: e, alert: projectAlert(e, entities) })).filter((item): item is { project: VaultEntity; alert: "no_tasks" | "finished" } => item.alert !== null).slice(0, 3);
    return { attention, projectAlerts };
  }, [entities, today]);

  const count = items.attention.length + items.projectAlerts.length;
  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return <div className="suggestion-trigger" ref={rootRef}>
    <button className={`suggestion-trigger-button${open ? " is-open" : ""}${count > 0 ? " has-items" : ""}`} onClick={() => setOpen((v) => !v)} aria-label={`建议${count > 0 ? `（${count} 项）` : ""}`} title="建议" aria-expanded={open}>
      <Sparkles size={18} />
      {count > 0 && <span className="suggestion-badge-dot">{count}</span>}
    </button>
    {open && <div className="suggestion-backdrop" onClick={() => setOpen(false)} role="presentation">
      <div className="suggestion-modal" role="dialog" aria-label="建议" onClick={(event) => event.stopPropagation()}>
        <header className="suggestion-modal-head"><Sparkles size={20} className="suggestion-modal-icon" /><strong>建议</strong><button className="icon-button" onClick={() => setOpen(false)} aria-label="关闭" title="关闭">×</button></header>
        <div className="suggestion-modal-body" aria-live="polite">
          <div className="suggestion-block">
            <div className="suggestion-block-head"><Lightbulb size={13} /><strong>建议</strong></div>
            <div className="attention-list">
              {items.projectAlerts.map(({ project, alert }) => <button className="attention-row" onClick={() => { openEntity(project); setOpen(false); }} key={project.id}>
                <StatusDot tone={alert === "finished" ? "blue" : "orange"} />
                <div><small>{PROJECT_ALERT_TEXT[alert].label}</small><strong>{project.name}</strong></div>
                <span className={alert === "finished" ? "" : "orange-text"}>{PROJECT_ALERT_TEXT[alert].action}</span>
              </button>)}
              {!items.projectAlerts.length && <div className="calm-state" style={{ padding: 12, fontSize: 11 }}>暂无建议，项目都健康。</div>}
            </div>
          </div>
          <div className="suggestion-block">
            <div className="suggestion-block-head"><AlertTriangle size={13} /><strong>需要关注</strong></div>
            <div className="attention-list">
              {items.attention.map((entity) => <button className="attention-row" onClick={() => { openEntity(entity); setOpen(false); }} key={entity.id}>
                <StatusDot tone={asString(entity.properties.due) < today ? "red" : "orange"} />
                <div><small>{asString(entity.properties.due) < today ? "已逾期任务" : "任务阻塞"}</small><strong>{entity.name}</strong></div>
                <span className={asString(entity.properties.due) < today ? "red-text" : "orange-text"}>{dueText(entity.properties.due, today)}</span>
              </button>)}
              {!items.attention.length && <div className="calm-state" style={{ padding: 12, fontSize: 11 }}>无逾期或阻塞任务。</div>}
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const navRenderGroups = navGroups;
  const sidebarRef = useRef<HTMLElement>(null);
  // 滚动时立即保存到 sessionStorage，layout effect 在路由切换后同步恢复
  useLayoutEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem("workbench-sidebar-scroll") ?? "0");
    if (saved) el.scrollTop = saved;
    const onScroll = () => { sessionStorage.setItem("workbench-sidebar-scroll", String(el.scrollTop)); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });
  const [createKind, setCreateKind] = useState<EntityKind | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [document, setDocument] = useState<VaultEntity | null>(null);
  const [entity, setEntity] = useState<VaultEntity | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" } | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("workbench-theme") === "dark");

  useEffect(() => setMobileMenu(false), [location.pathname]);
  useEffect(() => {
    localStorage.setItem("workbench-theme", dark ? "dark" : "light");
    window.document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const actions = useMemo<UiActions>(() => ({
    openCreate: setCreateKind,
    openCapture: () => setCaptureOpen(true),
    openDocument: setDocument,
    openEntity: setEntity,
    notify: (message, tone = "success") => setToast({ message, tone }),
  }), [navigate]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  }

  return (
    <UiActionsContext.Provider value={actions}>
      <div className={`app-shell${typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? " tauri-window" : ""}`}>
        <div className="window-drag-region" onMouseDown={startWindowDrag}><span>个人工作台</span></div>
        <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`} ref={sidebarRef}>
          <form className="sidebar-search" onSubmit={submitSearch}>
            <button type="submit" aria-label="提交搜索" tabIndex={-1}><Search size={17} /></button>
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索…" aria-label="搜索" />
          </form>
          <nav aria-label="主导航">
            {navRenderGroups.map((group, groupIndex) => <div className="nav-group" key={group.label ?? groupIndex}>
              {group.label && <div className="nav-label">{group.label}</div>}
              {group.items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
              </NavLink>)}
            </div>)}
            <details className="sidebar-more-nav">
              <summary><MoreHorizontal size={18} /><span>更多</span><ChevronDown size={14} /></summary>
              <div className="sidebar-more-nav-list">
                {secondaryNavGroups.map((group) => <div className="sidebar-more-nav-group" key={group.label}>
                  <div className="nav-label">{group.label}</div>
                  {group.items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className="nav-item">
                    <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
                  </NavLink>)}
                </div>)}
              </div>
            </details>
          </nav>
        </aside>

        <div className="workspace">
          {isHome && <header className="topbar" onMouseDown={startWindowDrag}>
            <button className="mobile-menu-button" aria-label="打开导航" onClick={() => setMobileMenu((value) => !value)}><Menu size={22} /></button>
            <button className="button primary top-action" onClick={() => setCaptureOpen(true)}><Plus size={18} />快速收集</button>
            <button className="button secondary top-action" onClick={() => setCreateKind("task")}><Plus size={18} />新建任务</button>
            <SuggestionTrigger />
            <div className="topbar-spacer" />
            <LiveDateTime />
          </header>}
          <main className={`main-content ${isHome ? "" : "without-topbar"}`}>{children}</main>
        </div>

        <nav className="mobile-bottom-nav" aria-label="移动端导航">
          <NavLink to="/" end><Home /><span>首页</span></NavLink>
          <NavLink to="/today"><CalendarDays /><span>今日</span></NavLink>
          <button onClick={() => setCaptureOpen(true)}><Inbox /><span>收集</span></button>
          <NavLink to="/projects"><FolderKanban /><span>项目</span></NavLink>
          <button onClick={() => setMobileMenu(true)}><Menu /><span>更多</span></button>
        </nav>

        {mobileMenu && <button className="sidebar-scrim" aria-label="关闭导航" onClick={() => setMobileMenu(false)} />}
        {captureOpen && <CaptureModal onClose={() => setCaptureOpen(false)} />}
        {createKind && <CreateEntityModal kind={createKind} onClose={() => setCreateKind(null)} />}
        {document && <DocumentDrawer entity={document} onClose={() => setDocument(null)} />}
        {entity && <EntityEditorDrawer key={entity.id} entity={entity} onClose={() => setEntity(null)} />}
        {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite"><Check size={17} />{toast.message}</div>}
      </div>
    </UiActionsContext.Provider>
  );
}

export function renderMarkdown(text: string): string { return DOMPurify.sanitize(marked.parse(text, { gfm: true, breaks: true }) as string); }

export function Section({ title, icon: Icon, action, children, className = "" }: { title: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`section-panel ${className}`}>
    <div className="section-heading"><div>{Icon && <Icon size={21} strokeWidth={1.9} />}<h2>{title}</h2></div>{action}</div>
    <div className="section-body">{children}</div>
  </section>;
}

export function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "orange" | "violet" }) {
  return <div className="progress-track" aria-label={`进度 ${value}%`}><span className={tone} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

export function StatusDot({ tone = "blue" }: { tone?: "blue" | "green" | "orange" | "red" | "violet" | "gray" }) {
  return <span className={`status-dot ${tone}`} aria-hidden="true" />;
}

export function EmptyState({ title, description, action, icon: Icon = FileText, illustration, secondaryAction }: { title: string; description?: string; action?: ReactNode; icon?: typeof FileText; illustration?: ReactNode; secondaryAction?: ReactNode }) {
  return <div className="empty-state">
    <div className="empty-state-art">{illustration ?? <Icon size={28} strokeWidth={1.8} />}</div>
    <strong>{title}</strong>
    {description && <p>{description}</p>}
    <div className="empty-state-actions">{action}{secondaryAction}</div>
  </div>;
}

// ── 缩放控制 ──
function ZoomControl() {
  const [zoom, setZoomState] = useState(() => {
    try { return parseFloat(localStorage.getItem("app-zoom-v2") || "100"); } catch { return 100; }
  });
  useEffect(() => {
    document.body.style.zoom = `${zoom}%`;
    localStorage.setItem("app-zoom-v2", String(zoom));
  }, [zoom]);
  return <div className="zoom-control">
    <button className="zoom-button" aria-label="缩小" onClick={() => setZoomState((z) => Math.max(60, z - 10))}>−</button>
    <span className="zoom-value">{zoom}%</span>
    <button className="zoom-button" aria-label="放大" onClick={() => setZoomState((z) => Math.min(200, z + 10))}>+</button>
  </div>;
}

function CaptureModal({ onClose }: { onClose: () => void }) {
  const { refresh } = useWorkbench();
  const { notify } = useUiActions();
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.create("inbox", { name: text.trim().split("\n")[0] || "快速收集", body: text.trim() }),
    onSuccess: async () => { await refresh(); notify("已保存到收集箱"); onClose(); }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={(event) => { event.preventDefault(); if (text.trim()) mutation.mutate(); }}>
    <ModalHeader title="快速收集" onClose={onClose} />
    <label className="field"><span>先记录，不必现在分类</span><textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} rows={6} placeholder="输入想法、任务、项目或资料…" /></label>
    {mutation.isError && <ErrorNotice error={mutation.error} />}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!text.trim() || mutation.isPending}>保存到收集箱</button></div>
  </form></div>;
}

function CreateEntityModal({ kind, onClose }: { kind: EntityKind; onClose: () => void }) {
  const { byKind, refresh } = useWorkbench();
  const { notify } = useUiActions();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [date, setDate] = useState(() => kind === "task" ? new Date().toLocaleDateString("en-CA") : "");
  const [projectStart, setProjectStart] = useState("");
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState("p2");
  const [summary, setSummary] = useState("");
  const [resourceType, setResourceType] = useState("pdf");
  const [url, setUrl] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const properties: EntityProperties = {};
      if (area) properties.area = `[[${area}]]`;
      if (project) properties.project = `[[${project}]]`;
      if (kind === "task") { properties.scheduled = date || undefined; properties.due = date || undefined; properties.priority = priority; properties.status = "todo"; }
      if (kind === "project") { properties.start = projectStart || undefined; properties.target = date || undefined; properties.status = "active"; }
      if (kind === "principle") { properties.status = "draft"; properties.statement = name; }
      if (kind === "card") {
      properties.status = "draft";
    }
    if (kind === "vision") { properties.status = "active"; }
      if (kind === "inbox") { properties.status = "new"; }
      if (kind === "document") { properties.summary = summary || undefined; }
      if (kind === "resource") { properties.summary = summary || undefined; properties.resource_type = resourceType; if (url) properties.url = url; }
      return api.create(kind, { name, properties, body: kind === "principle" ? `# ${name}\n\n## 形成依据\n\n记录这条原则来自哪些经历、问题或复盘。\n\n## 实践记录\n\n- 情境：\n- 行动：\n- 结果：\n` : `# ${name}\n` });
    },
    onSuccess: async () => { await refresh(); notify(`已创建${kindLabel(kind)}`); onClose(); }
  });
  const areas = byKind("area").filter((entity) => entity.properties.visible !== false);
  const projects = byKind("project");
  const showArea = ["principle", "project", "task", "document", "resource"].includes(kind);
  const showDate = ["project", "task"].includes(kind);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={(event) => { event.preventDefault(); if (name.trim()) mutation.mutate(); }}>
    <ModalHeader title={`新建${kindLabel(kind)}`} onClose={onClose} />
    <label className="field"><span>名称</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={`输入${kindLabel(kind)}名称`} /></label>
    <div className="field-row">
      {showArea && <label className="field"><span>领域</span><select value={area} onChange={(event) => setArea(event.target.value)}><option value="">未指定</option>{areas.map((entity) => <option key={entity.id}>{entity.name}</option>)}</select></label>}
      {kind === "project" && <label className="field"><span>开始日期</span><input type="date" value={projectStart} onChange={(event) => setProjectStart(event.target.value)} /></label>}
      {showDate && <label className="field"><span>{kind === "task" ? "执行日期" : "目标日期"}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>}
      {kind === "task" && <label className="field"><span>优先级</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="p0">P0</option><option value="p1">P1</option><option value="p2">P2</option><option value="p3">P3</option></select></label>}
      {kind === "resource" && <label className="field"><span>资料类型</span><select value={resourceType} onChange={(event) => setResourceType(event.target.value)}><option value="pdf">PDF</option><option value="url">网页</option><option value="book">书籍</option><option value="image">图片</option></select></label>}
      {kind === "resource" && <label className="field"><span>链接</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…（可选）" /></label>}
    </div>
    {kind === "task" && <div className="field-row hierarchy-fields">
      <label className="field"><span>所属项目</span><select value={project} onChange={(event) => setProject(event.target.value)}><option value="">未关联</option>{projects.map((entity) => <option key={entity.id}>{entity.name}</option>)}</select></label>
    </div>}
    {["document", "resource"].includes(kind) && <label className="field"><span>一句话说明</span><textarea rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="这份资料讲什么、为什么重要…（可选）" /></label>}
    {["document", "resource"].includes(kind) && <div className="field-row"><label className="field"><span>关联项目</span><select value={project} onChange={(event) => setProject(event.target.value)}><option value="">未关联</option>{projects.map((entity) => <option key={entity.id}>{entity.name}</option>)}</select></label></div>}
    {mutation.isError && <ErrorNotice error={mutation.error} />}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!name.trim() || mutation.isPending}>创建</button></div>
  </form></div>;
}

function DocumentDrawer({ entity, onClose }: { entity: VaultEntity; onClose: () => void }) {
  const { refresh } = useWorkbench();
  const { notify } = useUiActions();
  const [body, setBody] = useState(entity.body);
  const [editMode, setEditMode] = useState(false);
  const mutation = useMutation({
    mutationFn: () => {
      if (entity.path.startsWith("90-Archive/")) throw new Error("归档内容为只读：请在 Obsidian 中编辑，或从归档区恢复后再修改");
      return api.update(entity, { body });
    },
    onSuccess: async () => { await refresh(); notify("文档已保存"); onClose(); }
  });
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(body || "", { gfm: true, breaks: true }) as string), [body]);
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="document-drawer" role="dialog" aria-modal="true">
    <div className="drawer-header"><div><span>{kindLabel(entity.kind)}</span><h2>{entity.name}</h2></div><div style={{ display: "flex", gap: 8 }}><button className="button secondary small" onClick={() => setEditMode((v) => !v)}>{editMode ? "预览" : "编辑"}</button><button className="icon-button" onClick={onClose}><X size={20} /></button></div></div>
    {editMode ? <MarkdownEditor value={body} onChange={setBody} /> : <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />}
    {mutation.isError && <ErrorNotice error={mutation.error} />}
    <div className="drawer-actions entity-drawer-actions"><DrawerFileActions entity={entity} onClose={onClose} /><div className="drawer-primary-actions"><button className="button secondary" onClick={() => void api.openInObsidian(entity.path)}>在 Obsidian 打开</button><button className="button primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || body === entity.body}>保存修改</button></div></div>
  </aside></div>;
}

function DrawerFileActions({ entity, onClose }: { entity: VaultEntity; onClose: () => void }) {
  const { refresh } = useWorkbench();
  const { notify } = useUiActions();
  const [confirmation, setConfirmation] = useState<"archive" | "trash" | null>(null);
  // 已归档内容（90-Archive/）不在活动索引中，再次归档/删除会 404，直接不提供这些操作。
  if (entity.path.startsWith("90-Archive/")) return null;
  const archiveMutation = useMutation({
    mutationFn: () => api.archive(entity),
    onSuccess: async () => {
      await refresh();
      notify(`${kindLabel(entity.kind)}已移入归档，可从 Vault 恢复`);
      onClose();
    }
  });
  const trashMutation = useMutation({
    mutationFn: () => api.trash(entity),
    onSuccess: async () => {
      await refresh();
      notify(`${kindLabel(entity.kind)}已移入 macOS 废纸篓`);
      onClose();
    }
  });
  const pending = archiveMutation.isPending || trashMutation.isPending;

  return <div className="drawer-file-actions">
    <button type="button" className="archive-icon-action" aria-label="移入归档" title="移入归档" disabled={pending} onClick={() => setConfirmation("archive")}><Archive size={18} /></button>
    <button type="button" className="button danger small project-delete-button" aria-label={entity.kind === "project" ? "删除项目" : entity.kind === "task" ? "删除任务" : `删除${kindLabel(entity.kind)}`} title={entity.kind === "project" ? "删除项目" : entity.kind === "task" ? "删除任务" : `删除${kindLabel(entity.kind)}`} disabled={pending} onClick={() => setConfirmation("trash")}><Trash2 size={17} />{entity.kind === "project" ? "删除项目" : entity.kind === "task" ? "删除任务" : `删除${kindLabel(entity.kind)}`}</button>
    {confirmation && <div className="destructive-confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(null); }}><div className={`destructive-confirmation ${confirmation}`} role="alertdialog" aria-modal="true" aria-label={confirmation === "archive" ? `确认归档${entity.name}` : `确认删除${entity.name}`}>
      <strong>{confirmation === "archive" ? "确认移入归档？" : "确认移入废纸篓？"}</strong>
      <p>{confirmation === "archive" ? <>Markdown 文件将移动到 <code>90-Archive</code>，可继续在 Obsidian 中恢复和编辑。</> : <>Markdown 文件将从 Vault 移出并进入 macOS 废纸篓，不会永久擦除。</>}</p>
      {(archiveMutation.isError || trashMutation.isError) && <ErrorNotice error={(archiveMutation.error || trashMutation.error) as Error} />}
      <div><button type="button" className="button secondary small" onClick={() => setConfirmation(null)}>取消</button><button type="button" className="button danger small" disabled={pending} onClick={() => confirmation === "archive" ? archiveMutation.mutate() : trashMutation.mutate()}>{pending ? "处理中…" : confirmation === "archive" ? "确认归档" : "移入废纸篓"}</button></div>
    </div></div>}
  </div>;
}

type EditorFieldType = "text" | "textarea" | "date" | "time" | "number" | "select" | "relation" | "checkbox";

interface EditorField {
  key: string;
  label: string;
  type: EditorFieldType;
  options?: [string, string][];
  relationKind?: EntityKind;
  placeholder?: string;
}

function EntityEditorDrawer({ entity, onClose }: { entity: VaultEntity; onClose: () => void }) {
  const { entities, archivedTasks = [], refresh } = useWorkbench();
  const { notify, openEntity } = useUiActions();
  const [baseEntity, setBaseEntity] = useState(entity);
  const baseEntityRef = useRef(entity);
  const [name, setName] = useState(entity.name);
  const [properties, setProperties] = useState<EntityProperties>({ ...entity.properties });
  const [body, setBody] = useState(entity.body);
  const [editBody, setEditBody] = useState(false);
  const fields = editorFields(entity.kind);
  const projectEntities = entity.kind === "project" ? [...entities, ...archivedTasks] : entities;
  const linkedTasks = entity.kind === "project" ? projectTasks(entity, projectEntities) : [];
  const dirty = name.trim() !== baseEntity.name || body !== baseEntity.body || JSON.stringify(properties) !== JSON.stringify(baseEntity.properties);
  const closingRef = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const current = baseEntityRef.current;
      // 归档内容不在活动索引中，update/archive 会 404；给出明确提示而非静默失败。
      if (current.path.startsWith("90-Archive/")) throw new Error("归档内容为只读：请在 Obsidian 中编辑，或从归档区恢复后再修改");
      const changes = changedProperties(current.properties, properties);
      const bodyChanged = body !== current.body;
      const shouldArchiveTask = current.kind === "task" && asString(properties.status) === "done" && asString(current.properties.status) !== "done";
      const nameChanged = name.trim() !== current.name;
      if (!Object.keys(changes).length && !bodyChanged && !nameChanged) return { entity: current, archived: false };
      const updated = await api.update(current, { name: nameChanged ? name.trim() : undefined, properties: changes, ...(bodyChanged ? { body } : {}), actor: "ui" });
      if (shouldArchiveTask) {
        await api.archive(updated);
        return { entity: updated, archived: true };
      }
      baseEntityRef.current = updated;
      setBaseEntity(updated);
      return { entity: updated, archived: false };
    },
    onSuccess: async (result) => {
      await refresh();
      if (result.archived || closingRef.current) {
        onClose();
      } else {
        notify(`${kindLabel(entity.kind)}已自动保存`, "success");
      }
    },
    onError: (error) => {
      closingRef.current = false;
      notify(`保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  });

  function triggerAutoSave(immediate = false) {
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      autoSaveTimer.current = null;
      if (!mutation.isPending) mutation.mutate();
    }, immediate ? 0 : 600);
  }

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const bodyHtml = useMemo(() => DOMPurify.sanitize(marked.parse(body || "", { gfm: true, breaks: true }) as string), [body]);
  function setValue(field: EditorField, rawValue: string | boolean) {
    let value: EntityProperties[string];
    if (field.type === "checkbox") value = Boolean(rawValue);
    else if (field.type === "number") value = rawValue === "" ? undefined : Number(rawValue);
    else if (field.type === "relation") value = rawValue ? `[[${rawValue}]]` : undefined;
    else value = rawValue || undefined;
    setProperties((current) => ({ ...current, [field.key]: value }));
    triggerAutoSave();
  }
  function handleNameChange(next: string) {
    setName(next);
  }
  function handleBodyChange(next: string) {
    setBody(next);
    triggerAutoSave();
  }
  function handleClose() {
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    closingRef.current = true;
    if (dirty && !mutation.isPending) {
      mutation.mutate();
    } else {
      onClose();
    }
  }
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}>
    <aside className="document-drawer entity-editor-drawer" role="dialog" aria-modal="true" aria-label={`编辑${kindLabel(entity.kind)}：${entity.name}`}>
      <div className="drawer-header"><div className="entity-drawer-title"><h2>{entity.name}</h2>{mutation.isPending && <small className="drawer-saving">保存中…</small>}</div><button className="icon-button" aria-label="关闭详情" onClick={handleClose}><X size={20} /></button></div>
      <form className="entity-editor-form" onSubmit={(event) => { event.preventDefault(); triggerAutoSave(true); }}>
        <div className="entity-editor-scroll">
          <div className="entity-visible-file-actions"><DrawerFileActions entity={baseEntity} onClose={handleClose} /></div>
          {["project", "principle", "habit"].includes(entity.kind) && <label className="project-name-editor"><span>{entity.kind === "project" ? "项目名称" : entity.kind === "principle" ? "原则名称" : "习惯名称"}</span><input aria-label={entity.kind === "project" ? "项目名称" : entity.kind === "principle" ? "原则名称" : "习惯名称"} value={name} onChange={(event) => handleNameChange(event.target.value)} onBlur={() => triggerAutoSave(true)} /></label>}
          <div className="entity-field-grid">
            {fields.map((field) => {
              const value = field.key === "status" && entity.kind === "task" ? taskStatusForUi(properties[field.key]) : properties[field.key];
              // 有状态机的实体（task / project）用流转芯片替代普通下拉，非法流转在前端就点不动。
              if (field.key === "status" && statusMachineFor(entity.kind)) {
                return <StatusFlowField
                  key={field.key}
                  kind={entity.kind}
                  label={field.label}
                  value={properties.status}
                  onChange={(next) => setValue(field, next)}
                  disabled={mutation.isPending}
                />;
              }
              if (field.type === "checkbox") return <label className="field checkbox-field" key={field.key}><span>{field.label}</span><input type="checkbox" checked={value === true} onChange={(event) => setValue(field, event.target.checked)} /></label>;
              if (field.type === "textarea") return <label className="field full-span" key={field.key}><span>{field.label}</span><textarea rows={3} value={asString(value)} placeholder={field.placeholder} onChange={(event) => setValue(field, event.target.value)} /></label>;
              if (field.type === "select") return <label className="field" key={field.key}><span>{field.label}</span><select value={asString(value)} onChange={(event) => setValue(field, event.target.value)}>{!(entity.kind === "task" && field.key === "status") && <option value="">未设置</option>}{field.options?.map(([optionValue, label]) => <option value={optionValue} key={optionValue}>{label}</option>)}</select></label>;
              if (field.type === "relation") {
                const choices = entities.filter((candidate) => candidate.kind === field.relationKind && candidate.id !== entity.id);
                return <label className="field" key={field.key}><span>{field.label}</span><select value={linkName(value)} onChange={(event) => setValue(field, event.target.value)}><option value="">未关联</option>{choices.map((choice) => <option value={choice.name} key={choice.id}>{choice.name}</option>)}</select></label>;
              }
              return <label className="field" key={field.key}><span>{field.label}</span><input type={field.type} value={field.type === "number" ? String(asNumber(value, 0)) : asString(value)} placeholder={field.placeholder} onChange={(event) => setValue(field, event.target.value)} /></label>;
            })}
          </div>
          <StatusHistoryPanel kind={entity.kind} history={baseEntity.properties.status_history} />
          {entity.kind === "project" && <section className="project-task-relations" aria-label="关联任务">
            <div className="project-task-relations-head">
              <div><ListChecks size={15} /><strong>关联任务</strong></div>
              <span>{linkedTasks.length ? `已关联 ${linkedTasks.length} · ${linkedTasks.filter((task) => ["done", "cancelled"].includes(asString(task.properties.status))).length}/${linkedTasks.length} 完成 · ${projectTaskCompletion(entity, projectEntities)}% 任务完成` : "暂无已关联任务"}</span>
            </div>
            {linkedTasks.length
              ? <div className="project-task-relations-list">{linkedTasks.map((task) => <button type="button" key={task.id} onClick={() => openEntity(task)}><span className={`project-task-status is-${asString(task.properties.status) || "todo"}`} /> <strong>{task.name}</strong><small>{taskStatusLabel(task.properties.status)}</small></button>)}</div>
              : <p className="project-task-relations-empty">暂无已关联任务</p>}
          </section>}
          {entity.kind === "project" && <div className="project-note-toolbar"><strong>项目笔记</strong><button type="button" className="button secondary small" onClick={() => setEditBody((value) => !value)}>{editBody ? "预览笔记" : "编辑笔记"}</button></div>}
          <div className="entity-body-editor">
            {editBody
              ? <MarkdownEditor value={body} onChange={handleBodyChange} />
              : <div className="entity-body-preview markdown-preview" dangerouslySetInnerHTML={{ __html: bodyHtml }} onClick={() => setEditBody(true)} title="点击进入编辑" />
            }
          </div>
          {mutation.isError && <ErrorNotice error={mutation.error} />}
        </div>
        <div className="drawer-actions entity-drawer-actions">
          <div className="drawer-primary-actions"><button type="button" className="button secondary" onClick={() => void api.openInObsidian(entity.path)}>在 Obsidian 打开</button><button type="submit" className="button primary" disabled={mutation.isPending}>{mutation.isPending ? "保存中…" : entity.kind === "project" ? "保存项目修改" : "立即保存"}</button></div>
        </div>
      </form>
    </aside>
  </div>;
}

function changedProperties(original: EntityProperties, next: EntityProperties): EntityProperties {
  const changes: EntityProperties = {};
  for (const key of new Set([...Object.keys(original), ...Object.keys(next)])) {
    if (JSON.stringify(original[key]) !== JSON.stringify(next[key])) changes[key] = next[key];
  }
  return changes;
}

function editorFields(kind: EntityKind): EditorField[] {
  const status = (options: [string, string][]): EditorField => ({ key: "status", label: "状态", type: "select", options });
  const area: EditorField = { key: "area", label: "领域", type: "relation", relationKind: "area" };
  if (kind === "task") return [
    { key: "status", label: "状态", type: "select", options: [["todo", "待办"], ["doing", "进行中"], ["done", "完成"]] },
    { key: "priority", label: "优先级", type: "select", options: [["p0", "P0"], ["p1", "P1"], ["p2", "P2"], ["p3", "P3"]] },
    { key: "project", label: "关联项目", type: "relation", relationKind: "project" },
    { key: "scheduled", label: "执行日期", type: "date" },
    { key: "scheduled_time", label: "时间点", type: "time" },
    { key: "due", label: "截止日期", type: "date" },
    { key: "focus", label: "加入重要任务", type: "checkbox" }
  ];
  if (kind === "project") return [
    { key: "status", label: "状态", type: "select", options: [["idea", "想法"], ["active", "进行中"], ["waiting", "等待中"], ["completed", "已完成"], ["archived", "已归档"]] },
    { key: "area", label: "所属领域", type: "relation", relationKind: "area" },
    { key: "start", label: "开始日期", type: "date" },
    { key: "target", label: "目标日期", type: "date" },
  ];
  if (kind === "principle") return [
    { key: "status", label: "状态", type: "select", options: [["draft", "草稿"], ["active", "启用"], ["retired", "停用"]] },
    { key: "area", label: "适用领域", type: "relation", relationKind: "area" },
    { key: "statement", label: "原则陈述", type: "textarea", placeholder: "一句可以重复指导行动的话" },
    { key: "context", label: "适用情境", type: "textarea", placeholder: "这条原则在什么情况下适用" },
    { key: "trigger", label: "触发信号", type: "textarea", placeholder: "出现什么事实时需要调用它" },
    { key: "action", label: "建议行动", type: "textarea", placeholder: "触发后具体怎么做" },
    { key: "exception", label: "例外情况", type: "textarea", placeholder: "什么时候不适用" }
  ];
  if (kind === "habit") return [
    { key: "status", label: "状态", type: "select", options: [["active", "启用"], ["paused", "暂停"], ["archived", "已归档"]] },
    { key: "area", label: "所属领域", type: "relation", relationKind: "area" },
    { key: "weekly_target", label: "每周目标次数", type: "number" },
    { key: "unit", label: "计量单位", type: "text", placeholder: "次、分钟、页…" },
    { key: "summary", label: "习惯说明", type: "textarea", placeholder: "触发条件、最小行动或完成标准" }
  ];
  if (kind === "card") return [
    { key: "card_type", label: "卡片类型", type: "select", options: [["concept", "概念"], ["method", "方法"], ["model", "思维模型"], ["checklist", "清单"], ["decision", "决策"], ["quote", "引用"]] },
    area
  ];
  if (kind === "vision") return [
    { key: "status", label: "状态", type: "select", options: [["planned", "构思中"], ["active", "践行中"], ["paused", "暂缓"], ["fulfilled", "已实现"], ["archived", "已归档"]] },
    { key: "horizon", label: "时间尺度", type: "select", options: [["three_year", "三年"], ["five_year", "五年"], ["lifetime", "人生方向"], ["custom", "自定义"]] },
    { key: "area", label: "所属领域", type: "relation", relationKind: "area" }
  ];
  if (kind === "inbox") return [];
  if (kind === "document" || kind === "resource") return [
    { key: "project", label: "关联项目", type: "relation", relationKind: "project" }
  ];
  return [];
}

export function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => {
    if (!root.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        markdown(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => { if (update.docChanged) changeRef.current(update.state.doc.toString()); })
      ]
    });
    const view = new EditorView({ state, parent: root.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 外部 value 改变时同步（注意跳过通过 updateListener 触发的回传）
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !value) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);
  return <div className="markdown-editor" ref={root} />;
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></div>;
}

function ErrorNotice({ error }: { error: Error }) {
  const conflict = error instanceof ApiError && error.status === 409;
  return <div className="error-notice">{conflict ? "文件已在 Obsidian 中变化，请关闭窗口后重新打开再保存。" : error.message}</div>;
}

export function RowMenu({ actions, label = "更多操作" }: { actions?: Array<{ key: string; label: string; icon?: LucideIcon; tone?: "default" | "danger"; onClick: () => void }>; label?: string }) {
  if (!actions?.length) return <span className="row-menu-spacer" />;
  return <RowMenuTrigger actions={actions} label={label} />;
}

function RowMenuTrigger({ actions, label }: { actions: Array<{ key: string; label: string; icon?: LucideIcon; tone?: "default" | "danger"; onClick: () => void }>; label: string }) {
  const [open, setOpen] = useState(false);
  return <span className="row-menu-trigger">
    <button className="icon-button row-menu" aria-label={label} onClick={() => setOpen(true)}><MoreHorizontal size={18} /></button>
    {open && createPortal(
      <div className="row-menu-backdrop" onClick={() => setOpen(false)} role="presentation">
        <div className="row-menu-modal" role="menu" onClick={(event) => event.stopPropagation()}>
          {actions?.map((action) => {
            const Icon = action.icon;
            return <button key={action.key} className={`row-menu-item${action.tone === "danger" ? " is-danger" : ""}`} role="menuitem" onClick={() => { action.onClick(); setOpen(false); }}>
              {Icon ? <Icon size={15} /> : null}<span>{action.label}</span>
            </button>;
          })}
        </div>
      </div>,
      document.body
    )}
  </span>;
}

export function LinkArrow({ label = "查看全部" }: { label?: string }) {
  return <span className="section-link">{label}<ChevronRight size={16} /></span>;
}

export const Icons = { Target, CalendarDays, FolderKanban, Telescope, ListChecks, FileText, BarChart3, Inbox, CheckCircle2, BriefcaseBusiness, Search, Library, HeartPulse, CircleDollarSign, CircleUserRound };
