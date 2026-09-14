import React, { useState, useEffect } from "react";
import { soloApi } from "../api";
import { useSoloFocus } from "../context";
import type { AiDailyBriefingItem } from "../../../shared/solofocus-models";

export function AiDailyBriefingCard() {
  const { refetch, showToast } = useSoloFocus();

  const [briefing, setBriefing] = useState<AiDailyBriefingItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [applying, setApplying] = useState<boolean>(false);
  const [selectedFocusIds, setSelectedFocusIds] = useState<string[]>([]);
  const [selectedPostponeIds, setSelectedPostponeIds] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const fetchBriefing = async () => {
    try {
      setLoading(true);
      const res = await soloApi.getDailyBriefing();
      setBriefing(res);
      setSelectedFocusIds(res.topFocusTasks.map((t) => t.taskId));
      setSelectedPostponeIds(res.postponeRecommendations.map((t) => t.taskId));
    } catch (err: any) {
      console.error("Failed to fetch daily briefing", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const handleToggleFocus = (taskId: string) => {
    setSelectedFocusIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleTogglePostpone = (taskId: string) => {
    setSelectedPostponeIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleApplyPlan = async () => {
    if (!briefing) return;
    try {
      setApplying(true);
      const res = await soloApi.applyDailyPlan({
        confirmedFocusTaskIds: selectedFocusIds,
        confirmedPostponeTaskIds: selectedPostponeIds
      });
      showToast(
        `排期调整已生效：已锁定 ${res.focusedCount} 项核心聚焦，顺延 ${res.postponedCount} 项次优待办`,
        "task_alt"
      );
      await refetch();
      await fetchBriefing();
    } catch (err: any) {
      showToast(`排期应用失败: ${err.message}`, "error");
    } finally {
      setApplying(false);
    }
  };

  if (loading && !briefing) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT p-space-md shadow-sm animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-40 bg-surface-container rounded-DEFAULT"></div>
          <div className="h-4 w-24 bg-surface-container rounded-DEFAULT"></div>
        </div>
        <div className="h-12 bg-surface-container-low rounded-DEFAULT mb-3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <div className="h-20 bg-surface-container rounded-DEFAULT"></div>
          <div className="h-20 bg-surface-container rounded-DEFAULT"></div>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-space-md py-2.5 bg-surface-container-low/30 border-b border-outline-variant/20 flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
          <span className="font-title-sm text-title-sm text-on-surface font-semibold">
            今日建议
          </span>
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-[11px] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
            <span>AGY 原生引擎</span>
          </span>
        </div>

        <div className="flex items-center gap-1 text-on-surface-variant">
          <button
            type="button"
            className="p-1 rounded-DEFAULT hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
            onClick={fetchBriefing}
            title="重新评估今日排期"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>
              sync
            </span>
          </button>
          <button
            type="button"
            className="p-1 rounded-DEFAULT hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "收起简报" : "展开简报"}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isExpanded ? "expand_less" : "expand_more"}
            </span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-space-md flex flex-col gap-space-md">
          {/* Executive Summary */}
          <div className="p-2.5 bg-surface-container-low/50 rounded-DEFAULT border border-outline-variant/15 flex flex-col gap-1.5">
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              {briefing.summary}
            </p>
            {briefing.actionAdvice && briefing.actionAdvice.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-outline-variant/10">
                {briefing.actionAdvice.map((advice, i) => (
                  <span
                    key={i}
                    className="font-label-sm text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-DEFAULT"
                  >
                    • {advice}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Decision Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
            {/* Left: Top Focus Tasks */}
            <div className="flex flex-col gap-2 p-2.5 bg-surface-container-low/20 rounded-DEFAULT border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs text-on-surface font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-primary">star</span>
                  核心聚焦 (Top {briefing.topFocusTasks.length})
                </span>
                <span className="font-label-sm text-[11px] text-outline">
                  {selectedFocusIds.length} 项已选
                </span>
              </div>

              {briefing.topFocusTasks.length === 0 ? (
                <div className="text-xs text-outline py-2">暂无高优待办推荐</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {briefing.topFocusTasks.map((item) => {
                    const isChecked = selectedFocusIds.includes(item.taskId);
                    return (
                      <label
                        key={item.taskId}
                        className={`flex items-start gap-2 p-2 rounded-DEFAULT border transition-colors cursor-pointer ${isChecked
                          ? "bg-surface-container-lowest border-primary/40 shadow-xs"
                          : "bg-surface-container-low/40 border-outline-variant/15 opacity-70"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFocus(item.taskId)}
                          className="w-3.5 h-3.5 mt-0.5 rounded-DEFAULT accent-primary cursor-pointer shrink-0"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                              {item.taskTitle}
                            </span>
                            {item.priority === "CRITICAL" && (
                              <span className="px-1 py-0.2 bg-error text-on-error text-[10px] font-bold rounded-DEFAULT">
                                最高
                              </span>
                            )}
                          </div>
                          <span className="font-label-sm text-[11px] text-on-surface-variant mt-0.5">
                            {item.reason}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Postpone / De-load Tasks */}
            <div className="flex flex-col gap-2 p-2.5 bg-surface-container-low/20 rounded-DEFAULT border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs text-on-surface font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-secondary">next_plan</span>
                  建议顺延 ({briefing.postponeRecommendations.length})
                </span>
                <span className="font-label-sm text-[11px] text-outline">
                  {selectedPostponeIds.length} 项已选
                </span>
              </div>

              {briefing.postponeRecommendations.length === 0 ? (
                <div className="text-xs text-outline py-2">
                  负荷适中，无需顺延
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {briefing.postponeRecommendations.map((item) => {
                    const isChecked = selectedPostponeIds.includes(item.taskId);
                    return (
                      <label
                        key={item.taskId}
                        className={`flex items-start gap-2 p-2 rounded-DEFAULT border transition-colors cursor-pointer ${isChecked
                          ? "bg-surface-container-lowest border-secondary/40 shadow-xs"
                          : "bg-surface-container-low/40 border-outline-variant/15 opacity-70"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePostpone(item.taskId)}
                          className="w-3.5 h-3.5 mt-0.5 rounded-DEFAULT accent-secondary cursor-pointer shrink-0"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                            {item.taskTitle}
                          </span>
                          <span className="font-label-sm text-[11px] text-on-surface-variant mt-0.5">
                            {item.reason}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end pt-2 border-t border-outline-variant/15">
            <button
              type="button"
              disabled={applying || (selectedFocusIds.length === 0 && selectedPostponeIds.length === 0)}
              onClick={handleApplyPlan}
              className="h-8 px-4 bg-primary text-on-primary hover:bg-neutral-800 font-label-md text-xs font-semibold rounded-DEFAULT flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">
                {applying ? "hourglass_top" : "check"}
              </span>
              <span>{applying ? "正在应用..." : "采纳排期"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
