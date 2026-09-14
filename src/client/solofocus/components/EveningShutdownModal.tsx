import React, { useState, useMemo, useEffect } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { TaskItem } from "../../../shared/solofocus-models";

type UnloadAction = "tomorrow" | "backlog" | "keep";

export function EveningShutdownModal() {
  const { isEveningShutdownOpen, closeEveningShutdown, data, refetch, showToast } = useSoloFocus();
  const [taskDecisions, setTaskDecisions] = useState<Record<string, UnloadAction>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShutdownComplete, setIsShutdownComplete] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const todayTasks = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.filter((t) => {
      if (t.status === "archived") return false;
      if (t.scheduledDate === todayStr) return true;
      if (t.dueDate === todayStr) return true;
      if (t.status !== "done" && t.dueDate && t.dueDate < todayStr) return true;
      if (t.createdAt && t.createdAt.startsWith(todayStr) && !t.scheduledDate) return true;
      return false;
    });
  }, [data?.tasks, todayStr]);

  const completedTasks = useMemo(() => todayTasks.filter((t) => t.status === "done"), [todayTasks]);
  const pendingTasks = useMemo(() => todayTasks.filter((t) => t.status !== "done"), [todayTasks]);

  const habits = useMemo(() => data?.habits || [], [data?.habits]);
  const completedHabits = useMemo(
    () => habits.filter((h) => (h.historyLogs || []).includes(todayStr)),
    [habits, todayStr]
  );

  // Default decisions: if overdue/pending, default to 'tomorrow'
  useEffect(() => {
    if (isEveningShutdownOpen) {
      setIsShutdownComplete(false);
      const initial: Record<string, UnloadAction> = {};
      pendingTasks.forEach((t) => {
        initial[t.id] = "tomorrow";
      });
      setTaskDecisions(initial);
    }
  }, [isEveningShutdownOpen, pendingTasks]);

  if (!isEveningShutdownOpen) return null;

  const handleApplyAll = (action: UnloadAction) => {
    const updated: Record<string, UnloadAction> = {};
    pendingTasks.forEach((t) => {
      updated[t.id] = action;
    });
    setTaskDecisions(updated);
  };

  const handleCompleteShutdown = async () => {
    setIsSubmitting(true);
    try {
      const updates = pendingTasks.map((task) => {
        const decision = taskDecisions[task.id] || "tomorrow";
        if (decision === "tomorrow") {
          return soloApi.updateTask(task.id, { scheduledDate: tomorrowStr });
        } else if (decision === "backlog") {
          return soloApi.updateTask(task.id, { scheduledDate: null });
        }
        return Promise.resolve({ success: true });
      });

      await Promise.all(updates);
      await refetch();
      setIsShutdownComplete(true);
      showToast("日落仪式完成：未完成事项已妥善卸载重排", "wb_twilight");
    } catch (err: any) {
      showToast(`关机处理失败: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 select-none"
      onClick={closeEveningShutdown}
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-lg overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-space-md py-space-sm bg-surface-container-low/60 border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[18px] text-primary">wb_twilight</span>
            <h2 className="font-title-md text-title-md text-on-surface font-semibold">
              日落关机 (Evening Shutdown)
            </h2>
          </div>
          <button
            type="button"
            className="w-7 h-7 rounded-DEFAULT flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
            onClick={closeEveningShutdown}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-space-md overflow-y-auto flex flex-col gap-space-md flex-1">
          {isShutdownComplete ? (
            <div className="py-10 px-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary/15 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">nightlight</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  今日关机完成
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  未完成事项已妥善调整，今日工作台已清爽收口。
                </span>
              </div>
              <button
                type="button"
                className="mt-2 px-5 py-1.5 bg-primary text-on-primary rounded-DEFAULT font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors cursor-pointer"
                onClick={closeEveningShutdown}
              >
                返回工作台
              </button>
            </div>
          ) : (
            <>
              {/* Part 1: Brief Daily Progress Numbers */}
              <div className="px-space-md py-2.5 rounded-DEFAULT bg-surface-container-low/40 border border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-space-md">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    今日完成:
                  </span>
                  <span className="font-title-md text-title-md text-on-surface font-bold">
                    {completedTasks.length} 项任务
                  </span>
                  <span className="text-outline">·</span>
                  <span className="font-label-md text-label-md text-secondary font-medium">
                    {completedHabits.length} / {habits.length} 习惯打卡
                  </span>
                </div>
                <span className="material-symbols-outlined text-[20px] text-secondary">verified</span>
              </div>

              {/* Part 2: Active Unload Deck */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                      未完成待办处理
                    </span>
                    <span className="px-1.5 py-0.2 rounded-DEFAULT bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold">
                      {pendingTasks.length} 项
                    </span>
                  </div>

                  {pendingTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 text-label-sm">
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded-DEFAULT bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-medium cursor-pointer"
                        onClick={() => handleApplyAll("tomorrow")}
                      >
                        全延至明日
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded-DEFAULT bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-medium cursor-pointer"
                        onClick={() => handleApplyAll("backlog")}
                      >
                        全退回待办
                      </button>
                    </div>
                  )}
                </div>

                {pendingTasks.length === 0 ? (
                  <div className="p-6 text-center bg-surface-container-low/30 rounded-DEFAULT border border-outline-variant/15 text-outline font-body-sm flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-secondary">
                      task_alt
                    </span>
                    <span>今日待办已全部完成，无未完成项</span>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-DEFAULT overflow-hidden">
                    {pendingTasks.map((task) => {
                      const currentDecision = taskDecisions[task.id] || "tomorrow";
                      return (
                        <div
                          key={task.id}
                          className="px-space-md py-2 flex items-center justify-between gap-space-md bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                            <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                              {task.title}
                            </span>
                            {task.priority === "CRITICAL" && (
                              <span className="px-1 py-0.2 bg-error text-on-error font-label-sm text-[10px] font-bold rounded-DEFAULT shrink-0">
                                紧急
                              </span>
                            )}
                          </div>

                          {/* Decision Selector */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className={`px-2 py-0.5 rounded-DEFAULT font-label-sm text-label-sm transition-colors cursor-pointer ${
                                currentDecision === "tomorrow"
                                  ? "bg-primary text-on-primary font-semibold"
                                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                              }`}
                              onClick={() =>
                                setTaskDecisions((prev) => ({ ...prev, [task.id]: "tomorrow" }))
                              }
                            >
                              延至明日
                            </button>
                            <button
                              type="button"
                              className={`px-2 py-0.5 rounded-DEFAULT font-label-sm text-label-sm transition-colors cursor-pointer ${
                                currentDecision === "backlog"
                                  ? "bg-primary text-on-primary font-semibold"
                                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                              }`}
                              onClick={() =>
                                setTaskDecisions((prev) => ({ ...prev, [task.id]: "backlog" }))
                              }
                            >
                              退回待办
                            </button>
                            <button
                              type="button"
                              className={`px-2 py-0.5 rounded-DEFAULT font-label-sm text-label-sm transition-colors cursor-pointer ${
                                currentDecision === "keep"
                                  ? "bg-surface-container-high text-on-surface font-semibold"
                                  : "bg-transparent text-outline hover:text-on-surface"
                              }`}
                              onClick={() =>
                                setTaskDecisions((prev) => ({ ...prev, [task.id]: "keep" }))
                              }
                            >
                              留今日
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!isShutdownComplete && (
          <div className="px-space-md py-space-sm bg-surface-container-low/60 border-t border-outline-variant/20 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-space-md py-1.5 rounded-DEFAULT text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
              onClick={closeEveningShutdown}
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="button"
              className="px-space-md py-1.5 rounded-DEFAULT bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              onClick={handleCompleteShutdown}
              disabled={isSubmitting}
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{isSubmitting ? "处理中..." : "确认关机"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
