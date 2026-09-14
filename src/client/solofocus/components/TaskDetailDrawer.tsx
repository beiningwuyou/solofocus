import React, { useState } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { TaskMode, TaskPriority } from "../../../shared/solofocus-models";

export function TaskDetailDrawer() {
  const { drawerTask, closeDrawer, refetch, showToast, data } = useSoloFocus();
  const [newStepTitle, setNewStepTitle] = useState("");
  const [isApplyingSop, setIsApplyingSop] = useState(false);

  if (!drawerTask) return null;

  const isDone = drawerTask.status === "done";

  const handleToggleComplete = async () => {
    try {
      const res = await soloApi.toggleTask(drawerTask.id);
      showToast(res.status === "done" ? `工单 ${drawerTask.id} 已完成` : `工单 ${drawerTask.id} 已重开`);
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleModeChange = async (mode: TaskMode) => {
    try {
      await soloApi.updateTask(drawerTask.id, { mode });
      showToast(`已切换至「${mode === "formal" ? "流程型正式任务" : mode === "adhoc" ? "快速待办" : "收集箱"}」模式`);
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    try {
      await soloApi.updateTask(drawerTask.id, { priority });
      showToast(`优先级已更新为 ${priority}`);
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleToggleCheckItem = async (itemId: string) => {
    const list = drawerTask.checklist || [];
    const updated = list.map((item) =>
      item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
    );
    try {
      await soloApi.updateTask(drawerTask.id, { checklist: updated });
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAddCheckItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim()) return;
    const list = drawerTask.checklist || [];
    const updated = [...list, { id: `c_${Date.now()}`, title: newStepTitle.trim(), isCompleted: false }];
    setNewStepTitle("");
    try {
      await soloApi.updateTask(drawerTask.id, { checklist: updated });
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleApplySop = async (sopId: string) => {
    try {
      await soloApi.applySopToTask(drawerTask.id, sopId);
      showToast("已成功克隆 SOP 标准步骤至当前任务");
      setIsApplyingSop(false);
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleArchive = async () => {
    try {
      await soloApi.archiveTask(drawerTask.id);
      showToast(`工单 ${drawerTask.id} 已移入归档库`);
      closeDrawer();
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = async () => {
    try {
      await soloApi.deleteTask(drawerTask.id);
      showToast(`工单 ${drawerTask.id} 已移入回收站（30天安全保护期）`);
      closeDrawer();
      await refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-on-surface/20 backdrop-blur-xs transition-opacity"
        onClick={closeDrawer}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-xl bg-surface-container-lowest h-full shadow-2xl z-10 flex flex-col border-l border-outline-variant/30 animate-in slide-in-from-right duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-space-lg py-space-md border-b border-outline-variant/20 bg-surface-container-low">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md">
            <span>全部任务</span>
            <span>/</span>
            <span className="font-semibold text-on-surface">{drawerTask.projectName || "未归属项目"}</span>
            <span>/</span>
            <span className="font-mono">{drawerTask.id}</span>
          </div>

          <div className="flex items-center gap-space-xs">
            <button
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
              onClick={closeDrawer}
              title="关闭抽屉"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-space-lg flex flex-col gap-space-lg">
          {/* Top Actions & Status */}
          <div className="flex items-center justify-between flex-wrap gap-space-sm pb-space-sm border-b border-outline-variant/20">
            <div className="flex items-center gap-space-xs">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-label-sm uppercase font-bold text-[11px] ${
                isDone
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-surface-container-high text-on-surface"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isDone ? "bg-secondary" : "bg-primary animate-pulse"}`}></span>
                {isDone ? "已完成" : "进行中"}
              </span>

              {drawerTask.dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-[11px] font-semibold tabular-nums">
                  <span className="material-symbols-outlined text-[13px]">alarm</span>
                  {drawerTask.dueDate} (临期)
                </span>
              )}
            </div>

            <div className="flex items-center gap-space-xs">
              <button
                className="px-space-sm py-1 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface text-body-sm flex items-center gap-1 border border-outline-variant/30"
                onClick={() => setIsApplyingSop(!isApplyingSop)}
              >
                <span className="material-symbols-outlined text-[16px]">rule</span>
                应用 SOP
              </button>
              <button
                className="px-space-sm py-1 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface text-body-sm flex items-center gap-1 border border-outline-variant/30"
                onClick={handleArchive}
              >
                <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                归档
              </button>
              <button
                className={`px-3 py-1 rounded font-medium text-body-sm flex items-center gap-1 transition-colors ${
                  isDone
                    ? "bg-surface-container-low text-on-surface border border-outline-variant"
                    : "bg-primary text-on-primary hover:bg-neutral-800"
                }`}
                onClick={handleToggleComplete}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isDone ? "restart_alt" : "done_all"}
                </span>
                {isDone ? "重开任务" : "标记完成"}
              </button>
            </div>
          </div>

          {/* SOP Selection Dropdown */}
          {isApplyingSop && (
            <div className="p-space-md bg-surface-container-low rounded-lg border border-outline-variant/30 flex flex-col gap-space-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="font-title-sm text-title-sm text-on-surface font-semibold">选择要应用的标准化 SOP 模板：</span>
                <button onClick={() => setIsApplyingSop(false)} className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {(data?.sops || []).map((sop) => (
                  <button
                    key={sop.id}
                    className="flex items-center justify-between p-2 rounded bg-surface-container-lowest hover:bg-surface-container-highest border border-outline-variant/20 text-left transition-colors"
                    onClick={() => handleApplySop(sop.id)}
                  >
                    <div>
                      <div className="font-body-md text-on-surface font-medium">{sop.title}</div>
                      <div className="text-body-sm text-on-surface-variant text-[11px]">{sop.summary}</div>
                    </div>
                    <span className="font-label-sm text-on-surface-variant px-1.5 py-0.5 bg-surface-container rounded">{sop.totalSteps} 步</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center gap-space-xs p-1 bg-surface-container-low rounded-lg border border-outline-variant/20">
            {(["formal", "adhoc", "inbox"] as TaskMode[]).map((m) => (
              <button
                key={m}
                className={`flex-1 py-1 px-2 rounded font-label-md text-label-md text-center transition-colors ${
                  drawerTask.mode === m
                    ? "bg-surface-container-lowest text-on-surface font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                onClick={() => handleModeChange(m)}
              >
                {m === "formal" && "正式任务 · 流程型"}
                {m === "adhoc" && "待办 · 快速"}
                {m === "inbox" && "收集箱 / 临时任务"}
              </button>
            ))}
          </div>

          {/* Title & Description */}
          <div className="flex flex-col gap-space-xs">
            <input
              className="font-headline-sm text-headline-sm text-on-surface font-bold bg-transparent outline-none border-b border-transparent focus:border-primary pb-1"
              value={drawerTask.title}
              onChange={(e) => soloApi.updateTask(drawerTask.id, { title: e.target.value })}
              onBlur={refetch}
            />
            {drawerTask.description && (
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mt-1">
                {drawerTask.description}
              </p>
            )}
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-space-md p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold text-[10px]">所属项目</span>
              <span className="font-body-md text-on-surface font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">folder</span>
                {drawerTask.projectName || "未归属项目（独立待办）"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold text-[10px]">优先级</span>
              <div className="flex items-center gap-1">
                {(["CRITICAL", "HIGH", "NORMAL", "LOW"] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                      drawerTask.priority === p
                        ? p === "CRITICAL"
                          ? "bg-error-container text-on-error-container border border-error"
                          : p === "HIGH"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-surface-container-highest text-on-surface border border-outline"
                        : "text-on-surface-variant/70 hover:bg-surface-container"
                    }`}
                    onClick={() => handlePriorityChange(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold text-[10px]">预估耗时</span>
              <span className="font-body-md text-on-surface tabular-nums">
                {drawerTask.estimatedMinutes || 30} 分钟
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold text-[10px]">累计工时</span>
              <span className="font-body-md text-on-surface tabular-nums font-mono">
                {Math.floor((drawerTask.timerSeconds || 0) / 60)} 分钟
              </span>
            </div>
          </div>

          {/* Checklist / Subtasks */}
          <div className="flex flex-col gap-space-sm pt-space-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-primary rounded-xs"></span>
                <span className="font-title-sm text-title-sm text-on-surface font-semibold">执行步骤与检查清单</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">
                {(drawerTask.checklist || []).filter((c) => c.isCompleted).length} / {(drawerTask.checklist || []).length} 完成
              </span>
            </div>

            {/* Checklist items */}
            <div className="flex flex-col gap-1.5">
              {(drawerTask.checklist || []).map((step) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-space-sm p-space-sm rounded-lg border transition-colors ${
                    step.isCompleted
                      ? "bg-surface-container-low/50 border-outline-variant/10 text-on-surface-variant"
                      : "bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant"
                  }`}
                >
                  <button
                    className={`w-4 h-4 mt-0.5 rounded-xs flex items-center justify-center border transition-colors ${
                      step.isCompleted
                        ? "bg-secondary border-secondary text-white"
                        : "border-outline text-transparent hover:border-primary"
                    }`}
                    onClick={() => handleToggleCheckItem(step.id)}
                  >
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </button>
                  <span className={`text-body-md flex-1 ${step.isCompleted ? "line-through text-on-surface-variant" : "text-on-surface"}`}>
                    {step.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Add Step Input */}
            <form onSubmit={handleAddCheckItem} className="flex items-center gap-space-xs mt-1">
              <input
                className="flex-1 h-8 px-space-sm bg-surface-container-low rounded-lg text-body-md text-on-surface outline-none border border-outline-variant/30 focus:border-primary"
                placeholder="+ 添加检查步骤，按 Enter 确定..."
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
              />
              <button
                type="submit"
                className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
              >
                添加
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Drawer Footer */}
        <div className="p-space-md bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg text-error hover:bg-error-container/30 text-body-sm font-medium transition-colors cursor-pointer flex items-center gap-1"
              onClick={handleDelete}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>移入回收站</span>
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high text-body-sm font-medium transition-colors cursor-pointer flex items-center gap-1"
              onClick={handleArchive}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">archive</span>
              <span>归档</span>
            </button>
          </div>
          <button
            className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary hover:bg-neutral-800 text-body-sm font-medium transition-colors cursor-pointer"
            onClick={closeDrawer}
            type="button"
          >
            完成并收起
          </button>
        </div>
      </div>
    </div>
  );
}
