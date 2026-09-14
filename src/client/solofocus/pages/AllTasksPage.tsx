import React, { useState, useMemo } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { TaskItem } from "../../../shared/solofocus-models";

export function AllTasksPage() {
  const { data, refetch, openDrawer, showToast } = useSoloFocus();

  const [activeTab, setActiveTab] = useState<"ALL" | "IN_PROGRESS" | "PLANNED" | "UNSCHEDULED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const tasks = useMemo(() => {
    return (data?.tasks || []).filter((t) => t.status !== "archived");
  }, [data?.tasks]);

  const projects = data?.projects || [];
  const domains = data?.domains || [];

  const recommendations = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "done" && t.scheduledDate !== todayStr)
      .slice(0, 4);
  }, [tasks, todayStr]);

  const handleScheduleToToday = async (id: string, title: string) => {
    try {
      await soloApi.scheduleTaskToToday(id);
      showToast(`已安排至今日: ${title}`, "event_available");
      await refetch();
    } catch (err: any) {
      showToast(`排期失败: ${err.message}`, "error");
    }
  };

  const handleToggleTask = async (task: TaskItem) => {
    try {
      await soloApi.toggleTask(task.id);
      showToast(task.status === "done" ? "任务已恢复待办" : "任务已完成", "check_circle");
      await refetch();
    } catch (err: any) {
      showToast(`操作失败: ${err.message}`, "error");
    }
  };

  const handleDeleteTask = async (task: TaskItem) => {
    try {
      await soloApi.deleteTask(task.id);
      showToast(`工单「${task.title}」已移入回收站（30天保护期）`, "delete");
      await refetch();
    } catch (err: any) {
      showToast(`删除失败: ${err.message}`, "error");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await soloApi.createTask({
        title: newTitle.trim(),
        projectId: newProjectId || undefined,
        priority: "NORMAL"
      });
      showToast("任务创建成功", "add_task");
      setNewTitle("");
      setIsQuickCreateOpen(false);
      await refetch();
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, "error");
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeTab === "IN_PROGRESS" && t.status !== "in_progress" && t.status !== "todo") return false;
      if (activeTab === "PLANNED" && (!t.scheduledDate || t.status === "done")) return false;
      if (activeTab === "UNSCHEDULED" && (t.scheduledDate || t.status === "done")) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const proj = projects.find((p) => p.id === t.projectId);
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchProject = proj ? proj.name.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchProject) return false;
      }

      return true;
    });
  }, [tasks, activeTab, searchQuery, projects]);

  const tabCounts = useMemo(() => {
    return {
      ALL: tasks.length,
      IN_PROGRESS: tasks.filter((t) => t.status === "in_progress" || t.status === "todo").length,
      PLANNED: tasks.filter((t) => t.scheduledDate && t.status !== "done").length,
      UNSCHEDULED: tasks.filter((t) => !t.scheduledDate && t.status !== "done").length
    };
  }, [tasks]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-6">
      {/* 待安排任务推荐卡片区 */}
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">recommend</span>
            <h2 className="font-headline-sm text-[16px] font-semibold text-on-surface tracking-tight">
              推进建议
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendations.map((rec) => {
            const proj = projects.find((p) => p.id === rec.projectId);
            return (
              <div
                key={rec.id}
                className="bg-surface-container-lowest p-4 rounded border border-outline-variant/20 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all group"
              >
                <div className="flex flex-col space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-sm font-label-sm text-[11px] font-medium ${rec.priority === "CRITICAL" || rec.priority === "HIGH"
                        ? "bg-error-container text-error"
                        : "bg-surface-container-highest text-on-surface"
                        }`}
                    >
                      {rec.priority === "CRITICAL" ? "加急" : rec.scheduledDate ? "已规划" : "待排期"}
                    </span>
                  </div>
                  <p
                    className="font-title-sm text-[14px] text-on-surface font-semibold leading-snug line-clamp-2 min-h-[40px] group-hover:text-primary transition-colors cursor-pointer"
                    onClick={() => openDrawer(rec)}
                  >
                    {rec.title}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-body-sm">
                  <span className="text-on-surface-variant text-[12px] truncate max-w-[110px]">
                    {proj ? proj.name : "待办"}
                  </span>
                  <button
                    type="button"
                    className="text-primary hover:underline font-label-md text-[12px] font-medium flex items-center gap-0.5"
                    onClick={() => handleScheduleToToday(rec.id, rec.title)}
                  >
                    <span>安排至今日</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_outward</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 任务控制与筛选操作栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-1">
        <div className="inline-flex items-center rounded bg-surface-container-low p-1 border border-outline-variant/20">
          <button
            className={`px-3.5 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all ${activeTab === "ALL" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            onClick={() => setActiveTab("ALL")}
            type="button"
          >
            全部 ({tabCounts.ALL})
          </button>
          <button
            className={`px-3.5 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all ${activeTab === "IN_PROGRESS"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
              }`}
            onClick={() => setActiveTab("IN_PROGRESS")}
            type="button"
          >
            进行中 ({tabCounts.IN_PROGRESS})
          </button>
          <button
            className={`px-3.5 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all ${activeTab === "PLANNED" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            onClick={() => setActiveTab("PLANNED")}
            type="button"
          >
            已排期 ({tabCounts.PLANNED})
          </button>
          <button
            className={`px-3.5 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all ${activeTab === "UNSCHEDULED"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
              }`}
            onClick={() => setActiveTab("UNSCHEDULED")}
            type="button"
          >
            待安排 ({tabCounts.UNSCHEDULED})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              className="h-9 pl-8 pr-3 bg-surface-container-lowest border border-outline-variant/30 rounded text-on-surface font-body-sm text-[13px] placeholder:text-outline shadow-sm focus:outline-none focus:border-primary transition-colors w-52"
              placeholder="筛选任务或项目..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            className="h-9 px-4 bg-primary hover:bg-primary-container text-on-primary font-label-md text-[13px] rounded flex items-center gap-1.5 shadow-sm transition-colors"
            onClick={() => setIsQuickCreateOpen(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>新建任务</span>
          </button>
        </div>
      </div>

      {isQuickCreateOpen && (
        <form
          className="bg-surface-container-lowest p-4 rounded border border-outline-variant/30 shadow-sm flex flex-col gap-3 animate-in fade-in"
          onSubmit={handleCreateTask}
        >
          <div className="flex items-center justify-between">
            <span className="font-title-sm text-title-sm text-on-surface font-semibold">快速新建任务条目</span>
            <button
              type="button"
              className="text-outline hover:text-on-surface"
              onClick={() => setIsQuickCreateOpen(false)}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              autoFocus
              className="flex-1 h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-on-surface font-body-sm text-[13px] outline-none focus:border-primary"
              placeholder="输入任务标题..."
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <select
              className="h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-on-surface font-body-sm text-[13px] outline-none"
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
            >
              <option value="">无所属项目 (独立待办)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              className="h-9 px-4 bg-primary text-on-primary rounded font-label-md text-[13px] shadow-sm hover:bg-primary-container"
              type="submit"
            >
              确认创建
            </button>
          </div>
        </form>
      )}

      {/* 核心活跃任务高密度数据表 */}
      <div className="bg-surface-container-lowest rounded border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/60 border-b border-outline-variant/20 h-10">
                <th className="px-4 py-2 font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold w-[36%]">
                  任务名称
                </th>
                <th className="px-4 py-2 font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold w-[16%]">
                  状态
                </th>
                <th className="px-4 py-2 font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold w-[20%]">
                  计划与截止时间
                </th>
                <th className="px-4 py-2 font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold w-[16%]">
                  关联领域
                </th>
                <th className="px-4 py-2 font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold text-right w-[12%]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-outline-variant/10">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-outline font-body-md">
                    暂无匹配的任务条目
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const isDone = task.status === "done";
                  const isOverdue = !isDone && task.dueDate && task.dueDate < todayStr;
                  const proj = projects.find((p) => p.id === task.projectId);
                  const domain = domains.find((d) => d.id === proj?.domainId);

                  return (
                    <tr
                      key={task.id}
                      className="h-14 hover:bg-surface-container-low/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-2.5" onClick={() => openDrawer(task)}>
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-title-sm text-[14px] text-on-surface font-semibold truncate group-hover:text-primary transition-colors ${isDone ? "line-through text-outline" : ""
                              }`}
                          >
                            {task.title}
                          </span>
                          <span className="font-body-sm text-[12px] text-on-surface-variant">
                            {proj ? proj.name : "待办"}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-2.5" onClick={() => openDrawer(task)}>
                        {isDone ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-surface-container text-outline font-label-md text-[12px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            <span>已完成</span>
                          </div>
                        ) : isOverdue ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-error-container text-error font-label-md text-[12px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                            <span>逾期待办</span>
                          </div>
                        ) : task.scheduledDate === todayStr ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-secondary-container/30 text-secondary font-label-md text-[12px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            <span>今日推进</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-surface-container-highest text-on-surface font-label-md text-[12px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                            <span>{task.scheduledDate ? "已排期" : "待排期"}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-2.5" onClick={() => openDrawer(task)}>
                        <div className="flex flex-col">
                          <span
                            className={`font-body-md text-[13px] font-medium ${isOverdue ? "text-error font-semibold" : "text-on-surface"
                              }`}
                          >
                            {task.dueDate || task.scheduledDate || "未设定日期"}
                          </span>
                          {isOverdue && (
                            <span className="font-body-sm text-[11px] text-error font-medium">已逾期</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2.5" onClick={() => openDrawer(task)}>
                        <span className="px-2.5 py-0.5 rounded-sm bg-surface-container-high text-on-surface-variant font-label-md text-[12px]">
                          {domain ? domain.name : "日常综合"}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            className={`h-7 px-3 font-label-md text-[12px] rounded-sm tracking-wide shadow-sm transition-colors ${isDone
                              ? "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                              : "bg-primary hover:bg-primary-container text-on-primary"
                              }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTask(task);
                            }}
                            type="button"
                          >
                            {isDone ? "重新打开" : "完成任务"}
                          </button>
                          <button
                            className="p-1 rounded-sm text-outline hover:text-error hover:bg-error-container/30 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task);
                            }}
                            title="移入回收站"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="h-11 px-4 bg-surface-container-low/30 border-t border-outline-variant/20 flex items-center justify-between">
          <span className="font-label-sm text-[12px] tracking-wider text-on-surface-variant">
            显示 {filteredTasks.length} 条推进任务
          </span>
        </div>
      </div>
    </div>
  );
}
