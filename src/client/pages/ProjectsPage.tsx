import { CheckCircle2, FolderKanban, Plus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState, ProgressBar, StatusDot, useUiActions } from "../components";
import { useWorkbench } from "../context";
import {
  asString,
  linkName,
  projectTaskCompletion,
  projectTasks,
  type VaultEntity
} from "../../shared/domain";

const PROJECT_STATUS_OPTIONS: [string, string][] = [
  ["idea", "想法"],
  ["active", "进行中"],
  ["waiting", "等待中"],
  ["completed", "已完成"],
  ["archived", "已归档"]
];

const AREA_TONE: Record<string, string> = {
  "健康": "green",
  "生活": "violet",
  "职业": "blue",
  "财富": "orange",
  "学习": "indigo",
  "心智": "indigo",
  "关系": "violet"
};

export function ProjectsPage() {
  const { entities, archivedTasks = [], byKind, refresh } = useWorkbench();
  const { notify, openCreate, openEntity } = useUiActions();
  const [area, setArea] = useState("");
  const projects = byKind("project");
  const projectEntities = useMemo(() => [...entities, ...archivedTasks], [archivedTasks, entities]);
  const completeMutation = useMutation({
    mutationFn: async (project: VaultEntity) => {
      const completed = await api.update(project, { properties: { status: "completed" }, actor: "complete", statusNote: "完成项目" });
      return api.archive(completed);
    },
    onSuccess: async () => { await refresh(); notify("项目已完成并移入归档"); },
    onError: () => notify("操作失败，文件可能已在其他窗口修改")
  });
  const visible = useMemo(() => projects.filter((project) => {
    if (project.properties.status === "archived") return false;
    if (area && linkName(project.properties.area) !== area) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN")), [area, projects]);
  const areas = byKind("area").filter((entity) => entity.properties.visible !== false).sort((a, b) => asString(a.properties.order).localeCompare(asString(b.properties.order)));

  return <>
    <div className="goals-page">
      <div className="page-primary">
        <div className="project-toolbar">
          <div className="project-area-tabs" role="tablist" aria-label="按领域筛选项目">
            {areas.map((entity) => {
              const tone = AREA_TONE[entity.name] || "blue";
              const active = area === entity.name;
              return <button key={entity.id} className={`area-tab tone-${tone}${active ? " active" : ""}`} onClick={() => setArea(active ? "" : entity.name)} aria-pressed={active}>
                <span className="area-tab-dot" />
                {entity.name}
              </button>;
            })}
          </div>
          <div className="project-toolbar-right">
            <button className="button primary small" onClick={() => openCreate("project")}><Plus size={16} />新建项目</button>
          </div>
        </div>

        {visible.length === 0 ? <EmptyState title={area ? `${area} 下还没有项目` : "还没有项目"} description="创建一个具有明确成果和时间范围的项目。" action={<button className="button primary" onClick={() => openCreate("project")}>新建项目</button>} /> :
          <ProjectGallery projects={visible} entities={projectEntities} onOpen={openEntity} onComplete={(project) => completeMutation.mutate(project)} />}
        <div className="database-count">{visible.length} 个项目</div>
      </div>
    </div>
  </>;
}

/** 旧数据里的历史状态值 → 新 5 态，避免老项目显示成"未设置"。 */
const LEGACY_PROJECT_STATUS: Record<string, string> = {
  planned: "idea", paused: "waiting", blocked: "waiting", done: "completed", cancelled: "archived"
};

function projectStatusLabel(project: VaultEntity): string {
  const raw = asString(project.properties.status);
  const normalized = LEGACY_PROJECT_STATUS[raw] ?? raw;
  return Object.fromEntries(PROJECT_STATUS_OPTIONS)[normalized] ?? "未设置";
}

function ProjectGallery({ projects, entities, onOpen, onComplete }: { projects: VaultEntity[]; entities: VaultEntity[]; onOpen: (project: VaultEntity) => void; onComplete: (project: VaultEntity) => void }) {
  const [view, setView] = useState<"grid" | "timeline">("grid");
  const sorted = useMemo(() => [...projects].sort((a, b) => asString(a.properties.target).localeCompare(asString(b.properties.target))), [projects]);
  if (view === "timeline") return <ProjectTimeline projects={sorted} entities={entities} onOpen={onOpen} onComplete={onComplete} onViewChange={setView} />;
  return <div>
    <div className="project-gallery-toggle"><button className="active" onClick={() => setView("grid")}>网格</button><button onClick={() => setView("timeline")}>时间线</button></div>
    <div className="project-gallery">
      {projects.map((project) => {
      const progress = projectTaskCompletion(project, entities);
      const tasks = projectTasks(project, entities);
      const area = linkName(project.properties.area);
      const status = asString(project.properties.status);
      const canComplete = ["active", "waiting"].includes(status);
      return <div className="project-gallery-card" key={project.id} role="button" tabIndex={0} onClick={() => onOpen(project)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(project); } }}>
        <header className="project-gallery-head">
          <FolderKanban size={17} className="project-gallery-icon" />
          <span className="project-gallery-name">{project.name}</span>
          <span className="project-gallery-status"><StatusDot tone={status === "active" ? "green" : status === "completed" ? "blue" : status === "waiting" ? "orange" : "gray"} />{projectStatusLabel(project)}</span>
        </header>
        <div className="project-gallery-progress">
          <ProgressBar value={progress} tone={progress === 100 ? "green" : progress >= 60 ? "blue" : "orange"} />
          <span><strong>{tasks.length ? `${completedTaskCount(tasks)}/${tasks.length}` : "0/0"}</strong><small>任务完成度</small></span>
        </div>
        <footer className="project-gallery-foot">
          {area && <span className="project-gallery-tag">{area}</span>}
          <time>{projectDateLabel(project)}</time>
          {canComplete && <button className="project-gallery-complete" onClick={(e) => { e.stopPropagation(); onComplete(project); }}><CheckCircle2 size={13} />完成项目</button>}
        </footer>
      </div>;
    })}
    </div>
  </div>;
}

function ProjectTimeline({ projects, entities, onOpen, onComplete, onViewChange }: { projects: VaultEntity[]; entities: VaultEntity[]; onOpen: (project: VaultEntity) => void; onComplete: (project: VaultEntity) => void; onViewChange: (v: "grid" | "timeline") => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const map = new Map<string, VaultEntity[]>();
    for (const project of projects) {
      const target = asString(project.properties.target);
      let key = "未设日期";
      if (target) {
        const ym = target.slice(0, 7); // 2026-09
        key = ym;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(project);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [projects]);
  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  return <div>
    <div className="project-gallery-toggle"><button onClick={() => onViewChange("grid")}>网格</button><button className="active" onClick={() => onViewChange("timeline")}>时间线</button></div>
    <div className="project-timeline">
      {groups.map(([key, items]) => {
        const isCollapsed = collapsed.has(key);
        const label = key === "未设日期" ? "未设日期" : `${key.slice(0, 4)}年${Number(key.slice(5, 7))}月`;
        return <div className="project-timeline-group" key={key}>
          <button className="project-timeline-head" onClick={() => toggle(key)}>
            <span className="project-timeline-caret">{isCollapsed ? "▸" : "▾"}</span>
            <strong>{label}</strong>
            <small>{items.length} 个项目</small>
          </button>
          {!isCollapsed && <div className="project-timeline-items">{items.map((project) => {
            const progress = projectTaskCompletion(project, entities);
            const area = linkName(project.properties.area);
            const status = asString(project.properties.status);
            const canComplete = ["active", "waiting"].includes(status);
            return <div className="project-timeline-row" key={project.id} role="button" tabIndex={0} onClick={() => onOpen(project)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(project); } }}>
              <FolderKanban size={16} className="project-timeline-icon" />
              <div className="project-timeline-meta">
                <strong>{project.name}</strong>
                {area && <span className="project-timeline-area">{area}</span>}
              </div>
              <StatusDot tone={status === "active" ? "green" : status === "completed" ? "blue" : "gray"} />
              <time>{projectDateLabel(project)}</time>
              <div className="project-timeline-progress"><ProgressBar value={progress} /><span>{progress}%</span></div>
              {canComplete && <button className="project-timeline-complete" title="完成项目" onClick={(e) => { e.stopPropagation(); onComplete(project); }}><CheckCircle2 size={14} /></button>}
            </div>;
          })}</div>}
        </div>;
      })}
    </div>
  </div>;
}

function completedTaskCount(tasks: VaultEntity[]): number {
  return tasks.filter((task) => ["done", "cancelled"].includes(asString(task.properties.status))).length;
}

function projectDateLabel(project: VaultEntity): string {
  const start = asString(project.properties.start);
  const target = asString(project.properties.target);
  if (start && target) return `${start} → ${target}`;
  return start || target || "未设日期";
}
