import React, { useState, useMemo } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { ProjectItem, ProjectMilestone, TaskItem, SopExtractionDraft } from "../../../shared/solofocus-models";
import { SopExtractionModal } from "../components/SopExtractionModal";

export function AllProjectsPage() {
  const { data, refetch, openProjectModal, openDrawer, showToast } = useSoloFocus();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isDistilling, setIsDistilling] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [extractionDraft, setExtractionDraft] = useState<SopExtractionDraft | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractionModalOpen, setIsExtractionModalOpen] = useState(false);

  const handleExtractSop = async (projectId: string) => {
    try {
      setIsExtracting(true);
      const res = await soloApi.extractSop(projectId);
      if (res.draft) {
        setExtractionDraft(res.draft);
        setIsExtractionModalOpen(true);
      } else {
        showToast("该项目暂无可萃取的工序数据", "warning");
      }
    } catch (err: any) {
      showToast(`萃取失败: ${err.message}`, "error");
    } finally {
      setIsExtracting(false);
    }
  };


  const projects = data?.projects || [];
  const domains = data?.domains || [];
  const allTasks = data?.tasks || [];

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const selectedProjectTasks = useMemo(() => {
    if (!selectedProject) return [];
    return allTasks.filter((t) => t.projectId === selectedProject.id && t.status !== "archived");
  }, [allTasks, selectedProject]);

  const handleToggleTask = async (task: TaskItem) => {
    try {
      await soloApi.toggleTask(task.id);
      showToast(task.status === "done" ? "任务已恢复待办" : "任务已完成", "check_circle");
      await refetch();
    } catch (err: any) {
      showToast(`操作失败: ${err.message}`, "error");
    }
  };

  const handleDistillNotes = async (projectId: string) => {
    try {
      setIsDistilling(true);
      const res = await soloApi.distillProjectNotes(projectId);
      showToast("AI Agent 成功提炼最新每日工程手记", "auto_awesome");
      await refetch();
    } catch (err: any) {
      showToast(`提炼失败: ${err.message}`, "error");
    } finally {
      setIsDistilling(false);
    }
  };

  const handleAddMilestone = async (project: ProjectItem) => {
    if (!newMilestoneTitle.trim()) return;
    try {
      const currentMilestones = project.milestones || [];
      const updated: ProjectMilestone[] = [
        ...currentMilestones,
        {
          id: `m-${Date.now()}`,
          projectId: project.id,
          seq: currentMilestones.length + 1,
          name: newMilestoneTitle.trim(),
          status: "planning"
        }
      ];
      await soloApi.updateProject(project.id, { milestones: updated });
      showToast("里程碑节点已添加", "flag");
      setNewMilestoneTitle("");
      await refetch();
    } catch (err: any) {
      showToast(`添加失败: ${err.message}`, "error");
    }
  };

  const handleToggleMilestone = async (project: ProjectItem, milestoneId: string) => {
    try {
      const updated = (project.milestones || []).map((m) => {
        if (m.id === milestoneId) {
          return {
            ...m,
            status: (m.status === "completed" ? "planning" : "completed") as "planning" | "completed"
          };
        }
        return m;
      });
      await soloApi.updateProject(project.id, { milestones: updated });
      showToast("里程碑状态已更新", "check_circle");
      await refetch();
    } catch (err: any) {
      showToast(`更新失败: ${err.message}`, "error");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await soloApi.deleteTask(taskId);
      showToast("任务已移入回收站", "delete");
      await refetch();
    } catch (err: any) {
      showToast(`删除失败: ${err.message}`, "error");
    }
  };

  const handleArchiveProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`确定归档项目「${projectName}」吗？归档后可在设置-归档记录中查看。`)) return;
    try {
      await soloApi.archiveProject(projectId);
      showToast("项目已归档", "archive");
      setSelectedProjectId(null);
      await refetch();
    } catch (err: any) {
      showToast(`归档失败: ${err.message}`, "error");
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`确定将项目「${projectName}」移入回收站吗？可在设置中随时还原。`)) return;
    try {
      await soloApi.deleteProject(projectId);
      showToast("项目已移入回收站", "delete");
      setSelectedProjectId(null);
      await refetch();
    } catch (err: any) {
      showToast(`删除失败: ${err.message}`, "error");
    }
  };

  if (selectedProject) {
    const domain = domains.find((d) => d.id === selectedProject.domainId);
    const milestones = selectedProject.milestones || [];
    const completedMilestones = milestones.filter((m) => m.status === "completed");
    const activeTasks = selectedProjectTasks.filter((t) => t.status !== "done");

    return (
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Top Breadcrumb & Header */}
        <div className="bg-surface-container-lowest p-6 rounded-lg shadow-sm flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors font-label-lg text-label-lg"
                onClick={() => setSelectedProjectId(null)}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>全部项目</span>
              </button>
              <span className="text-outline-variant font-label-lg text-label-lg">/</span>
              <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                {selectedProject.name}
              </span>
              <div className="px-2.5 py-0.5 rounded-sm bg-secondary-container text-on-secondary-container flex items-center gap-1.5 font-label-sm text-label-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                <span>{selectedProject.status === "completed" ? "已完成" : "进行中"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="bg-primary text-on-primary rounded-sm px-4 py-2 font-label-md text-label-md font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-sm"
                onClick={() => {
                  const title = prompt("输入新任务名称:");
                  if (title) {
                    soloApi
                      .createTask({ title, projectId: selectedProject.id, priority: "NORMAL" })
                      .then(() => {
                        showToast("任务已加入项目", "add_task");
                        refetch();
                      });
                  }
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>添加任务</span>
              </button>
              <button
                className="bg-surface-container-low text-on-surface rounded-sm px-3.5 py-2 font-label-md text-label-md font-medium hover:bg-surface-container-high transition-colors"
                onClick={() => handleDistillNotes(selectedProject.id)}
                disabled={isDistilling}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px] mr-1">auto_awesome</span>
                <span>{isDistilling ? "Agent 提炼中..." : "Agent 提炼手记"}</span>
              </button>
              <button
                className="bg-primary/10 text-primary border border-primary/25 rounded-sm px-3 py-2 font-label-md text-xs font-semibold hover:bg-primary hover:text-on-primary transition-colors flex items-center gap-1 cursor-pointer"
                onClick={() => handleExtractSop(selectedProject.id)}
                disabled={isExtracting}
                type="button"
                title="分析该项目任务流与核对单，自动萃取专属个人 SOP 资产"
              >
                <span className="material-symbols-outlined text-[16px]">psychology_alt</span>
                <span>{isExtracting ? "正在萃取..." : "提炼专属 SOP"}</span>
              </button>
              <button
                className="bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/30 rounded-sm px-3 py-2 font-label-md text-xs font-medium hover:bg-surface-container transition-colors flex items-center gap-1 cursor-pointer"
                onClick={() => handleArchiveProject(selectedProject.id, selectedProject.name)}
                type="button"
                title="归档此项目"
              >
                <span className="material-symbols-outlined text-[16px]">archive</span>
                <span>归档项目</span>
              </button>
              <button
                className="bg-surface-container-low text-error hover:bg-error-container/30 border border-error/20 rounded-sm px-3 py-2 font-label-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                onClick={() => handleDeleteProject(selectedProject.id, selectedProject.name)}
                type="button"
                title="移入回收站"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>移入回收站</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6 items-start pt-1">
            <div className="col-span-12 lg:col-span-5 flex flex-col justify-between h-full gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
                  {selectedProject.name}
                </h1>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container-low border border-outline-variant/30 text-on-surface-variant w-fit">
                  <span className="material-symbols-outlined text-[16px] text-primary">folder_open</span>
                  <span className="font-title-sm text-title-sm text-on-surface font-medium">
                    {domain ? domain.name : "工作与交付"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-on-surface-variant font-label-sm text-label-sm pt-2">
                <span>交付目标: {selectedProject.targetDate || "未设定"}</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                <span>创建于 {selectedProject.createdAt.slice(0, 10)}</span>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-7 flex flex-col justify-between bg-surface border border-outline-variant/30 rounded p-4 h-full">
              <div className="flex flex-col justify-center h-full space-y-2.5">
                <p className="font-body-md text-body-md text-on-surface leading-relaxed font-medium">
                  {selectedProject.description || "暂无项目描述，点击可添加。"}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  基于单机离线优先架构（SQLite + Local First），毫秒级响应与数据自愈回滚。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Core KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-lg shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary"></div>
            <div className="flex justify-between items-start pl-2">
              <span className="font-title-sm text-title-sm text-on-surface-variant">待办任务数量</span>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-sm bg-secondary-container text-on-secondary-container font-semibold">
                共 {selectedProjectTasks.length} 项任务
              </span>
            </div>
            <div className="pl-2 mt-4">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-headline-lg text-headline-lg text-primary font-bold">
                  {activeTasks.length}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">项待推进</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-lg shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-surface-tint"></div>
            <div className="flex justify-between items-start pl-2">
              <span className="font-title-sm text-title-sm text-on-surface-variant">推进阶段</span>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-sm bg-surface-container-high text-on-surface font-semibold">
                完成度 {selectedProject.progress}%
              </span>
            </div>
            <div className="pl-2 mt-4">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-headline-lg text-headline-lg text-primary font-bold">
                  {completedMilestones.length} / {milestones.length}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">达成里程碑</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-lg shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="font-title-sm text-title-sm text-on-surface-variant">最新工程手记 (Agent)</span>
              <button
                className="text-primary text-xs hover:underline flex items-center"
                onClick={() => handleDistillNotes(selectedProject.id)}
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
              </button>
            </div>
            <div className="mt-4">
              <p className="font-body-md text-body-md text-on-surface line-clamp-2 leading-snug">
                {selectedProject.agentNotes || "点击右上角 Agent 提炼最新进展手记..."}
              </p>
            </div>
          </div>
        </div>

        {/* Milestones & Tasks Section */}
        <div className="grid grid-cols-12 gap-6 items-start">
          <div className="col-span-12 flex flex-col gap-6">
            <div className="bg-surface-container-lowest p-5 rounded-lg shadow-sm flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  推进节点 - 核心里程碑
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    className="h-8 px-2.5 bg-surface-container-low border border-outline-variant/30 rounded text-on-surface font-body-sm text-body-sm outline-none w-64"
                    placeholder="添加新里程碑..."
                    type="text"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMilestone(selectedProject);
                      }
                    }}
                  />
                  <button
                    className="flex items-center gap-1 px-3 py-1.5 rounded-sm bg-primary text-on-primary font-label-sm text-label-sm font-medium"
                    onClick={() => handleAddMilestone(selectedProject)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>添加节点</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {milestones.map((m, idx) => {
                  const isDone = m.status === "completed";
                  return (
                    <div
                      key={m.id}
                      className={`group relative rounded-sm p-3.5 flex flex-col justify-between gap-3 transition-all border ${isDone
                        ? "bg-surface-container-low/60 border-outline-variant/20 opacity-80"
                        : "bg-surface-container-lowest border-2 border-primary shadow-sm"
                        }`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold text-label-sm px-1.5 py-0.5 rounded-sm ${isDone
                                ? "bg-surface-container-high text-on-surface-variant"
                                : "bg-primary text-on-primary"
                                }`}
                            >
                              0{idx + 1}
                            </span>
                            <span
                              className={`font-label-sm text-label-sm px-2 py-0.5 rounded-sm flex items-center gap-1 font-semibold ${isDone
                                ? "bg-surface-container text-outline"
                                : "bg-secondary-container text-on-secondary-container"
                                }`}
                            >
                              {!isDone && <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>}
                              {isDone ? "已达成" : "推进中"}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isDone}
                            className="rounded-sm border-outline-variant text-primary focus:ring-0 cursor-pointer"
                            onChange={() => handleToggleMilestone(selectedProject, m.id)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3
                            className={`font-title-sm text-title-sm text-on-surface font-bold ${isDone ? "line-through text-outline" : ""
                              }`}
                          >
                            {m.name}
                          </h3>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Project Tasks Table */}
            <div className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-primary">项目任务清单</span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-sm bg-surface-container-low text-on-surface-variant">
                    {selectedProjectTasks.length} 项
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase">
                      <th className="py-2.5 px-4 font-semibold">任务名称</th>
                      <th className="py-2.5 px-4 font-semibold">状态</th>
                      <th className="py-2.5 px-4 font-semibold text-right">预估</th>
                      <th className="py-2.5 px-4 font-semibold text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-md text-body-md">
                    {selectedProjectTasks.map((task) => {
                      const isDone = task.status === "done";
                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                          onClick={() => openDrawer(task)}
                        >
                          <td className="py-3 px-4 text-on-surface font-medium">
                            <span className={isDone ? "line-through text-outline" : ""}>
                              {task.title}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-label-sm text-label-sm ${isDone
                                ? "bg-surface-container text-outline"
                                : "bg-secondary-container text-on-secondary-container"
                                }`}
                            >
                              {!isDone && <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>}
                              {isDone ? "已完成" : "进行中"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-label-md text-label-md text-on-surface">
                            {task.estimatedMinutes ? `${task.estimatedMinutes}m` : "45m"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                className="bg-primary text-on-primary rounded-sm px-2.5 py-1 font-label-sm text-label-sm hover:bg-neutral-800 transition-colors inline-block"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTask(task);
                                }}
                                type="button"
                              >
                                {isDone ? "重新打开" : "完成任务"}
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded text-outline hover:text-error hover:bg-error-container/30 transition-colors"
                                title="移入回收站"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <SopExtractionModal
          isOpen={isExtractionModalOpen}
          draft={extractionDraft}
          onClose={() => setIsExtractionModalOpen(false)}
          onSaved={() => refetch()}
        />
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.status !== "completed");

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 bg-surface-container-lowest px-4 h-10 rounded-lg shadow-sm border border-outline-variant/20 flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface-variant">活跃项目</span>
          <span className="font-headline-sm text-headline-sm font-bold text-primary">{activeProjects.length}</span>
        </div>

        <div className="flex-1 bg-surface-container-lowest px-4 h-10 rounded-lg shadow-sm border border-outline-variant/20 flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface-variant">任务数</span>
          <span className="font-headline-sm text-headline-sm font-bold text-primary">{allTasks.length}</span>
        </div>

        <div className="flex-1 bg-surface-container-lowest px-4 h-10 rounded-lg shadow-sm border border-outline-variant/20 flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface-variant">平均推进进度</span>
          <span className="font-headline-sm text-headline-sm font-bold text-primary">
            {projects.length > 0
              ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length)
              : 0}
            %
          </span>
        </div>

        <button
          className="h-10 px-4 bg-primary text-on-primary rounded-lg flex items-center gap-1.5 font-label-md text-label-md shadow-sm hover:bg-neutral-800 transition-colors shrink-0"
          onClick={openProjectModal}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>新建项目</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
        {projects.map((proj) => {
          const domain = domains.find((d) => d.id === proj.domainId);
          const milestones = proj.milestones || [];
          const completedM = milestones.filter((m) => m.status === "completed");
          const isDone = proj.status === "completed";

          return (
            <div
              key={proj.id}
              className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-outline-variant/20 flex flex-col gap-space-md hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => setSelectedProjectId(proj.id)}
            >
              <div className="flex items-center justify-between">
                <span className="px-space-xs py-0.5 rounded-DEFAULT bg-surface-container text-on-surface font-label-sm text-label-sm">
                  {domain ? domain.name : "工作与交付"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-label-sm text-label-sm ${isDone ? "text-outline" : "text-secondary"
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isDone ? "bg-outline" : "bg-secondary animate-pulse"}`}
                  ></span>
                  <span>{isDone ? "已交付" : "进行中"}</span>
                </span>
              </div>

              <div className="font-title-md text-title-md text-on-surface font-bold group-hover:text-primary transition-colors truncate">
                {proj.name}
              </div>

              <p className="font-body-sm text-on-surface-variant line-clamp-2 min-h-[32px]">
                {proj.description || "基于单机离线优先架构的高效任务推进工程。"}
              </p>

              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                <div
                  className={`bg-primary h-full transition-all duration-500 ${(proj.progress || 0) >= 80
                    ? "w-[80%]"
                    : (proj.progress || 0) >= 60
                      ? "w-[60%]"
                      : (proj.progress || 0) >= 40
                        ? "w-[40%]"
                        : (proj.progress || 0) >= 20
                          ? "w-[20%]"
                          : "w-[5%]"
                    }`}
                ></div>
              </div>

              <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant pt-space-xs border-t border-outline-variant/15">
                <span>交付期: {proj.targetDate || "2026-09-30"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-outline text-xs">
                    {completedM.length}/{milestones.length} 节点
                  </span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface transition-colors flex items-center gap-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtractSop(proj.id);
                    }}
                    title="分析该项目任务流，自动萃取专属个人 SOP"
                  >
                    <span className="material-symbols-outlined text-[13px]">psychology_alt</span>
                    <span>萃取 SOP</span>
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded text-outline hover:text-error hover:bg-error-container/30 transition-colors"
                    title="移入回收站"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(proj.id, proj.name);
                    }}
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SopExtractionModal
        isOpen={isExtractionModalOpen}
        draft={extractionDraft}
        onClose={() => setIsExtractionModalOpen(false)}
        onSaved={() => refetch()}
      />
    </div>
  );
}
