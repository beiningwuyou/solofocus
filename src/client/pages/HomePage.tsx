import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, FolderKanban } from "lucide-react";
import { LinkArrow, ProgressBar, useUiActions } from "../components";
import { AgentPulseCard } from "../components/AgentPulseCard";
import { useWorkbench } from "../context";
import { asString, isOpenTask, projectTaskCompletion, projectTasks, type VaultEntity } from "../../shared/domain";

export function HomePage() {
  const { entities, archivedTasks = [], metrics, today, byKind } = useWorkbench();
  const { openEntity } = useUiActions();
  const openTasks = useMemo(() => entities.filter(isOpenTask), [entities]);
  const focusTasks = useMemo(() => openTasks.filter((entity) =>
    entity.properties.scheduled === today
    || entity.properties.due === today
    || (entity.properties.focus === true && !entity.properties.scheduled)
    || entity.properties.status === "doing"
  ).slice(0, 3), [openTasks, today]);
  const attentionItems = useMemo(() => openTasks.filter((entity) => {
    const due = asString(entity.properties.due);
    return Boolean(due && due < today) || entity.properties.status === "blocked";
  }).slice(0, 3), [openTasks, today]);
  const executionEntities = useMemo(() => [...entities, ...archivedTasks], [archivedTasks, entities]);
  const activeProjects = useMemo(() => byKind("project")
    .filter((project) => ["active", "waiting"].includes(asString(project.properties.status)))
    .sort((a, b) => asString(a.properties.target).localeCompare(asString(b.properties.target)))
    .slice(0, 4), [byKind]);
  return <div className="home-dashboard home-minimal-dashboard">
    <section className="home-today-summary" aria-label="本周摘要">
      <div className="home-today-summary-title"><CalendarDays size={17} /><div><strong>本周重点</strong><small>只保留真正推动事情前进的结果</small></div></div>
      <div className="home-today-summary-stats">
        <Link to="/today"><strong>{focusTasks.length}</strong><span>今日重点</span></Link>
        <Link to="/projects"><strong>{activeProjects.length}</strong><span>进行中项目</span></Link>
        <Link to="/tasks?attention=1"><strong>{metrics.blocked + metrics.overdue}</strong><span>需要处理</span></Link>
      </div>
    </section>

    <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center justify-between my-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
          🎯
        </div>
        <div>
          <strong className="block text-on-surface font-title-sm">SoloFocus 个人极简高保真工作台</strong>
          <small className="text-on-surface-variant font-body-sm">基于 Stitch 16 界面高保真原型的单机离线优先 SQLite WAL MVP 系统</small>
        </div>
      </div>
      <Link to="/solofocus" className="px-3.5 py-1.5 rounded bg-primary text-on-primary font-label-md font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1 shadow-sm">
        <span>立即启动</span>
        <ArrowUpRight size={14} />
      </Link>
    </div>

    <AgentPulseCard />

    <section className="home-grid home-grid-2 home-minimal-grid">
      <article className="home-card">
        <header className="home-card-head"><div><strong>今日三件事</strong><small>一次只推进少数结果</small></div><Link to="/today" className="home-card-link">打开今日<LinkArrow label="" /></Link></header>
        <div className="home-focus-list">
          {focusTasks.length ? focusTasks.map((task, index) => <button className={`home-focus-row${task.properties.status === "doing" ? " is-doing" : ""}`} key={task.id} onClick={() => openEntity(task)}><span className="home-focus-index">{index + 1}</span><span className="home-focus-copy"><strong>{task.name}</strong><small>{task.properties.status === "doing" ? "进行中" : asString(task.properties.due) || asString(task.properties.scheduled) || "下一步行动"}</small></span><ArrowUpRight size={14} /></button>) : <div className="home-card-empty"><span>今天还没有重点任务</span><Link to="/today">选择三件真正重要的事 →</Link></div>}
        </div>
        {attentionItems.length > 0 && <div className="home-attention-inline"><AlertTriangle size={14} /><span>{attentionItems.length} 项逾期或阻塞，需要先处理</span><Link to="/tasks?attention=1">查看</Link></div>}
      </article>

      <article className="home-card home-project-health-card">
        <header className="home-card-head"><div><strong>项目健康</strong><small>结果不等于任务数量</small></div><Link to="/projects" className="home-card-link">全部项目<LinkArrow label="" /></Link></header>
        {activeProjects.length ? <div className="home-project-health-list">{activeProjects.map((project) => {
          const tasks = projectTasks(project, executionEntities);
          const progress = projectTaskCompletion(project, executionEntities);
          const completed = tasks.filter((task) => ["done", "cancelled"].includes(asString(task.properties.status))).length;
          const health = tasks.length === 0 ? "补一个下一步" : completed === tasks.length ? "检查结果证据" : asString(project.properties.status) === "waiting" ? "等待中" : "推进中";
          return <button className="home-project-health-row" key={project.id} onClick={() => openEntity(project)}><div className="home-project-health-title"><FolderKanban size={14} /><strong>{project.name}</strong><span>{health}</span></div><div className="home-project-health-progress"><ProgressBar value={progress} tone={progress >= 80 ? "green" : "blue"} /><small>{tasks.length ? `${completed}/${tasks.length}` : "—"}</small></div></button>;
        })}</div> : <div className="home-card-empty"><span>还没有进行中的项目</span><Link to="/projects">创建一个结果型项目 →</Link></div>}
      </article>

    </section>
  </div>;
}
