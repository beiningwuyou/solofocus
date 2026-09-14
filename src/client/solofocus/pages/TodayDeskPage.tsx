import React, { useState, useMemo } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { TaskItem } from "../../../shared/solofocus-models";
import { AiDailyBriefingCard } from "../components/AiDailyBriefingCard";
import { EmailTasksBriefingCard } from "../components/EmailTasksBriefingCard";


interface TodayDeskPageProps {
  onNavigateToAllTasks: () => void;
}

export function TodayDeskPage({ onNavigateToAllTasks }: TodayDeskPageProps) {
  const { data, refetch, openDrawer, showToast, openEveningShutdown } = useSoloFocus();

  const [quickTitle, setQuickTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "uncompleted">("all");

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayTasks = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.filter((t) => {
      if (t.status === "archived") return false;
      if (t.scheduledDate === todayStr) return true;
      if (t.dueDate && t.dueDate.startsWith(todayStr)) return true;
      if (t.status !== "done" && t.dueDate && t.dueDate < todayStr) return true;
      if (t.createdAt && t.createdAt.startsWith(todayStr) && !t.scheduledDate) return true;
      return false;
    });
  }, [data?.tasks, todayStr]);

  const unassignedTasksCount = useMemo(() => {
    if (!data?.tasks) return 0;
    return data.tasks.filter((t) => t.status !== "archived" && t.status !== "done" && !t.scheduledDate).length;
  }, [data?.tasks]);

  const completedTodayTasks = todayTasks.filter((t) => t.status === "done");
  const overdueTodayTasks = todayTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < todayStr);

  const progressPercent = todayTasks.length === 0 ? 0 : Math.round((completedTodayTasks.length / todayTasks.length) * 100);

  const displayedTasks = useMemo(() => {
    if (filterMode === "uncompleted") {
      return todayTasks.filter((t) => t.status !== "done");
    }
    return todayTasks;
  }, [todayTasks, filterMode]);

  const projects = data?.projects || [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      await soloApi.createTask({
        title: quickTitle.trim(),
        projectId: selectedProjectId || undefined,
        scheduledDate: todayStr,
        priority: "NORMAL",
        estimatedMinutes: 45
      });
      showToast("新任务已添加到今日清单", "add_task");
      setQuickTitle("");
      await refetch();
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, "error");
    }
  };

  const handleToggleTask = async (task: TaskItem) => {
    try {
      await soloApi.toggleTask(task.id);
      showToast(task.status === "done" ? "任务已恢复待办" : "任务已标记完成", "check_circle");
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

  const handlePunchHabit = async (habitId: string) => {
    try {
      const res = await soloApi.punchHabit(habitId, todayStr);
      showToast(res.isPunched ? "已完成习惯打卡并沉底" : "已撤销习惯打卡", "sync");
      await refetch();
    } catch (err: any) {
      showToast(`打卡失败: ${err.message}`, "error");
    }
  };

  const habits = data?.habits || [];
  const habitsPending = habits.filter((h) => !(h.historyLogs || []).includes(todayStr));
  const habitsDone = habits.filter((h) => (h.historyLogs || []).includes(todayStr));

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-7xl mx-auto">
      {/* Top KPI row */}
      <div className="grid grid-cols-12 gap-space-md items-stretch">
        <div className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT p-space-md flex flex-col justify-between relative shadow-sm border-l-4 border-l-secondary">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block">
                今日进度
              </span>
              <div className="flex items-baseline gap-space-xs mt-0.5">
                <span className="font-headline-lg text-headline-lg text-on-surface">
                  {completedTodayTasks.length} / {todayTasks.length}
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">task_alt</span>
            </div>
          </div>

          <div className="pt-space-md flex items-end justify-between gap-1.5 h-11">
            <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full bg-surface-container rounded-DEFAULT transition-all h-[38%]"></div>
              <span className="font-label-sm text-label-sm text-outline">周二</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full bg-surface-container rounded-DEFAULT transition-all h-[55%]"></div>
              <span className="font-label-sm text-label-sm text-outline">周三</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full bg-surface-container rounded-DEFAULT transition-all h-[70%]"></div>
              <span className="font-label-sm text-label-sm text-outline">周四</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full bg-surface-container rounded-DEFAULT transition-all h-[45%]"></div>
              <span className="font-label-sm text-label-sm text-outline">周五</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full bg-surface-container rounded-DEFAULT transition-all h-[30%]"></div>
              <span className="font-label-sm text-label-sm text-outline">周六</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full bg-surface-container rounded-DEFAULT transition-all h-[60%]"></div>
              <span className="font-label-sm text-label-sm text-outline">周日</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className={`w-full bg-secondary rounded-DEFAULT transition-all duration-300 ${progressPercent >= 80
                  ? "h-[80%]"
                  : progressPercent >= 60
                    ? "h-[60%]"
                    : progressPercent >= 40
                      ? "h-[40%]"
                      : "h-[20%]"
                  }`}
              ></div>
              <span className="font-label-sm text-label-sm text-on-surface font-bold">今日</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT p-space-md flex flex-col justify-between relative shadow-sm border-l-4 border-l-error">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block">
                待推进
              </span>
              <div className="flex items-baseline gap-space-xs mt-0.5">
                <span className="font-headline-lg text-headline-lg text-on-surface">
                  {overdueTodayTasks.length}
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  &nbsp; 项延期任务
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-error-container/40 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-5 bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT p-space-md flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">add_task</span>
              <span className="font-title-sm text-title-sm text-on-surface font-semibold">新建待办</span>
            </div>
          </div>

          <form className="flex flex-col gap-2 mt-2" onSubmit={handleQuickAddTask}>
            <div className="relative flex items-center">
              <input
                className="w-full h-9 pl-space-sm pr-20 bg-surface-container-low border border-outline-variant/30 rounded-DEFAULT text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                placeholder="输入今日待办事项..."
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
              />
              <div className="absolute right-1 flex items-center gap-1">
                <button
                  className="h-7 px-2.5 bg-primary text-on-primary rounded-DEFAULT hover:bg-primary-container transition-colors flex items-center justify-center font-label-sm text-label-sm active:scale-95 transition-transform"
                  type="submit"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 text-on-surface-variant font-label-sm text-label-sm hover:border-outline hover:text-on-surface transition-colors cursor-pointer"
                  onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                >
                  <span className="material-symbols-outlined text-[13px] text-outline">folder</span>
                  <span>{selectedProject ? selectedProject.name : "选择所属项目 (可选)"}</span>
                  <span className="material-symbols-outlined text-[14px] text-outline ml-0.5">expand_more</span>
                </button>

                {isProjectDropdownOpen && (
                  <div className="absolute left-0 bottom-full mb-1 w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-md py-1 z-50 flex flex-col divide-y divide-outline-variant/15 text-left">
                    <button
                      type="button"
                      className="flex items-center justify-between px-2.5 py-1.5 text-left text-on-surface hover:bg-surface-container-low font-body-sm text-body-sm transition-colors"
                      onClick={() => {
                        setSelectedProjectId("");
                        setIsProjectDropdownOpen(false);
                      }}
                    >
                      <span className="truncate">无所属项目（独立待办）</span>
                      {!selectedProjectId && <span className="material-symbols-outlined text-[14px] text-secondary">check</span>}
                    </button>
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex items-center justify-between px-2.5 py-1.5 text-left text-on-surface hover:bg-surface-container-low font-body-sm text-body-sm transition-colors"
                        onClick={() => {
                          setSelectedProjectId(p.id);
                          setIsProjectDropdownOpen(false);
                        }}
                      >
                        <span className="truncate">{p.name}</span>
                        {selectedProjectId === p.id && <span className="material-symbols-outlined text-[14px] text-secondary">check</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Work Email Tasks Distillation Card */}
      <EmailTasksBriefingCard />

      {/* AI Daily Planner Briefing Card */}
      <AiDailyBriefingCard />

      {/* Main Grid (8:4 layout) */}
      <div className="grid grid-cols-12 gap-space-md items-start">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-sm overflow-hidden">
            <div className="px-space-md py-space-sm bg-surface-container-lowest flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-space-sm">
                <span className="font-title-md text-title-md text-on-surface">今日清单</span>
                <span className="px-1.5 py-0.2 rounded-DEFAULT bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold">
                  {todayTasks.length} 项
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openEveningShutdown}
                  className="px-2 py-1 rounded-DEFAULT bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 font-label-md text-label-md font-semibold transition-colors flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                  title="日落关机"
                >
                  <span className="material-symbols-outlined text-[15px]">wb_twilight</span>
                  <span>日落关机</span>
                </button>

                <div className="h-3.5 w-px bg-outline-variant/30"></div>

                <div className="flex items-center gap-1">
                  <button
                    className={`px-2.5 py-1 rounded-DEFAULT font-label-md text-label-md transition-colors ${filterMode === "all"
                      ? "bg-surface-container text-on-surface font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container"
                      }`}
                    onClick={() => setFilterMode("all")}
                  >
                    全部任务
                  </button>
                  <button
                    className={`px-2.5 py-1 rounded-DEFAULT font-label-md text-label-md transition-colors ${filterMode === "uncompleted"
                      ? "bg-surface-container text-on-surface font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container"
                      }`}
                    onClick={() => setFilterMode("uncompleted")}
                  >
                    仅未完成
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col divide-y divide-outline-variant/15">
              {displayedTasks.length === 0 ? (
                <div className="p-8 text-center text-outline font-body-md flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[32px] text-outline">done_all</span>
                  <span>今日任务已全部搞定，或暂无安排</span>
                </div>
              ) : (
                displayedTasks.map((task) => {
                  const isDone = task.status === "done";
                  const isOverdue = !isDone && task.dueDate && task.dueDate < todayStr;
                  const proj = projects.find((p) => p.id === task.projectId);

                  return (
                    <div
                      key={task.id}
                      className={`px-space-md py-2.5 flex items-center justify-between transition-colors cursor-pointer group ${isDone
                        ? "bg-surface-container-low/20 opacity-75 hover:bg-surface-container-low"
                        : isOverdue
                          ? "bg-surface-container-low/50 hover:bg-surface-container-low"
                          : "hover:bg-surface-container-low"
                        }`}
                    >
                      <div className="flex items-center gap-space-sm min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isDone}
                          className="w-4 h-4 rounded-DEFAULT accent-primary cursor-pointer shrink-0"
                          onChange={() => handleToggleTask(task)}
                        />

                        <div className="flex flex-col min-w-0 flex-1 pr-2" onClick={() => openDrawer(task)}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-secondary" : isOverdue ? "bg-error" : "bg-primary"
                                }`}
                            ></span>
                            <span
                              className={`font-body-md text-body-md text-on-surface font-medium truncate group-hover:text-primary transition-colors ${isDone ? "line-through text-outline" : ""
                                }`}
                            >
                              {task.title}
                            </span>
                            {task.priority === "CRITICAL" && (
                              <span className="px-1.5 py-0.2 bg-error text-on-error font-label-sm text-label-sm font-bold rounded-DEFAULT shrink-0">
                                最高 (CRITICAL)
                              </span>
                            )}
                            {task.priority === "HIGH" && (
                              <span className="px-1.5 py-0.2 bg-error-container text-error font-label-sm text-label-sm font-semibold rounded-DEFAULT shrink-0">
                                高优先级
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-on-surface-variant font-label-sm text-label-sm">
                            {proj ? (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] text-outline">folder</span>
                                {proj.name}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-outline">
                                <span className="material-symbols-outlined text-[13px]">radio_button_unchecked</span>
                                待办
                              </span>
                            )}

                            {isOverdue && (
                              <span className="text-error font-medium flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">alarm</span>
                                逾期待处理
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          className={`h-7 px-2.5 rounded-DEFAULT transition-colors font-label-sm text-label-sm flex items-center gap-1 font-bold ${isDone
                            ? "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                            : "bg-primary text-on-primary hover:bg-primary-container"
                            }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTask(task);
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isDone ? "restart_alt" : "check"}
                          </span>
                          <span>{isDone ? "重开" : "完成"}</span>
                        </button>
                        <button
                          className="p-1 rounded-DEFAULT text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(task);
                          }}
                          title="查看详情"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        </button>
                        <button
                          className="p-1 rounded-DEFAULT text-outline hover:text-error hover:bg-error-container/30 transition-colors"
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
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-space-md py-2 bg-surface-container-low/40 flex items-center justify-between border-t border-outline-variant/20">
              <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px] text-outline">inbox</span>
                <span>
                  有 <b>{unassignedTasksCount}</b> 项未安排日期任务
                </span>
              </div>
              <button
                className="text-primary hover:underline font-label-sm text-label-sm font-semibold flex items-center gap-0.5"
                onClick={onNavigateToAllTasks}
              >
                <span>收件箱整理</span>
                <span className="material-symbols-outlined text-[13px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 4-col */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-sm p-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">sync</span>
                <span className="font-title-md text-title-md text-on-surface">习惯打卡</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                {habitsPending.length} 待完成 · {habitsDone.length} 已达成
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-1 max-h-[360px] overflow-y-auto pr-0.5">
              <div className="flex flex-col gap-2">
                {habitsPending.map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-2 rounded-DEFAULT bg-surface-container-low/60 hover:bg-surface-container-low transition-all duration-300 cursor-pointer"
                    onClick={() => handlePunchHabit(habit.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <button
                        className="w-5 h-5 rounded-DEFAULT border border-outline-variant bg-surface-container-lowest flex items-center justify-center hover:border-primary transition-colors shrink-0"
                        type="button"
                      ></button>
                      <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                        {habit.name}
                      </span>
                    </div>
                    <span
                      className="font-label-sm text-label-sm px-2 py-0.5 rounded-DEFAULT bg-surface-container text-on-surface-variant font-mono font-semibold shrink-0"
                      title={`连续达成 ${habit.streakDays} 天`}
                    >
                      {habit.streakDays}
                    </span>
                  </div>
                ))}
              </div>

              {habitsDone.length > 0 && (
                <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between px-0.5 text-outline font-label-sm text-label-sm">
                    <span className="flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-[13px] text-secondary">check_circle</span>
                      今日已打卡
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {habitsDone.map((habit) => (
                      <div
                        key={habit.id}
                        className="flex items-center justify-between p-2 rounded-DEFAULT bg-surface-container-low/30 opacity-70 transition-all duration-300 cursor-pointer"
                        onClick={() => handlePunchHabit(habit.id)}
                        title="点击可撤销今日打卡"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          <div className="w-5 h-5 rounded-DEFAULT bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          </div>
                          <span className="font-body-sm text-body-sm text-on-surface line-through truncate">
                            {habit.name}
                          </span>
                        </div>
                        <span
                          className="font-label-sm text-label-sm px-2 py-0.5 rounded-DEFAULT bg-secondary/15 text-secondary font-mono font-semibold shrink-0"
                          title={`连续达成 ${habit.streakDays} 天`}
                        >
                          {habit.streakDays}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-sm p-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">calendar_view_week</span>
                <span className="font-title-md text-title-md text-on-surface">活动天数</span>
              </div>
              <div className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                <span className="w-2 h-2 rounded-[1px] bg-surface-container"></span>
                <span className="w-2 h-2 rounded-[1px] bg-secondary/40"></span>
                <span className="w-2 h-2 rounded-[1px] bg-secondary"></span>
              </div>
            </div>

            <div className="pt-1 flex flex-col gap-1.5">
              <div className="grid grid-cols-7 gap-1.5 text-center font-label-sm text-label-sm text-outline">
                <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                <div className="h-6 rounded-DEFAULT bg-secondary/70 flex items-center justify-center text-[9px] text-white font-mono">3</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">4</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/40 flex items-center justify-center text-[9px] text-on-surface font-mono">2</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">5</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/70 flex items-center justify-center text-[9px] text-white font-mono">3</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/30 flex items-center justify-center text-[9px] text-on-surface font-mono">1</div>
                <div className="h-6 rounded-DEFAULT bg-surface-container flex items-center justify-center text-[9px] text-outline font-mono">0</div>

                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">4</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/70 flex items-center justify-center text-[9px] text-white font-mono">3</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">4</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/40 flex items-center justify-center text-[9px] text-on-surface font-mono">2</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">4</div>
                <div className="h-6 rounded-DEFAULT bg-surface-container flex items-center justify-center text-[9px] text-outline font-mono">0</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/40 flex items-center justify-center text-[9px] text-on-surface font-mono">2</div>

                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">5</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">4</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/70 flex items-center justify-center text-[9px] text-white font-mono">3</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/70 flex items-center justify-center text-[9px] text-white font-mono">3</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">5</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/30 flex items-center justify-center text-[9px] text-on-surface font-mono">1</div>
                <div className="h-6 rounded-DEFAULT bg-surface-container flex items-center justify-center text-[9px] text-outline font-mono">0</div>

                <div className="h-6 rounded-DEFAULT bg-secondary/70 flex items-center justify-center text-[9px] text-white font-mono">3</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">4</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono">4</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/40 flex items-center justify-center text-[9px] text-on-surface font-mono">2</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/70 flex items-center justify-center text-[9px] text-white font-mono">3</div>
                <div className="h-6 rounded-DEFAULT bg-secondary/40 flex items-center justify-center text-[9px] text-on-surface font-mono">2</div>
                <div className="h-6 rounded-DEFAULT bg-secondary flex items-center justify-center text-[9px] text-white font-mono font-bold ring-2 ring-primary">
                  {completedTodayTasks.length}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
              <span className="font-medium text-on-surface">活跃天数 23 / 28 天</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
