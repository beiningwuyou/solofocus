import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Clock3, FolderKanban, RefreshCw, Sparkles, Target } from "lucide-react";
import { api, type PulseAction } from "../api";
import { useUiActions } from "../components";
import { useWorkbench } from "../context";
import { isOpenTask } from "../../shared/domain";

export function AgentPulseCard() {
  const { entities, today, refresh: refreshWorkbench } = useWorkbench();
  const { notify } = useUiActions();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const pulseQuery = useQuery({
    queryKey: ["agent-pulse", today],
    queryFn: () => api.agentPulse(false),
    staleTime: 5 * 60 * 1000 // 5 分钟内不重复请求
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.agentPulse(true),
    onSuccess: (data) => {
      pulseQuery.refetch();
      notify("已基于最新工作台状态重新诊断");
    },
    onError: (err) => {
      notify(`重新诊断失败：${(err as Error).message}`, "danger");
    }
  });

  const applyMutation = useMutation({
    mutationFn: async (action: PulseAction) => {
      setApplyingId(action.id);
      return api.applyAgentPulse(action);
    },
    onSuccess: async (data) => {
      await refreshWorkbench();
      await pulseQuery.refetch();
      notify(data.message || "已采纳为今日重点");
    },
    onError: (err) => {
      notify(`采纳失败：${(err as Error).message}`, "danger");
    },
    onSettled: () => {
      setApplyingId(null);
    }
  });

  // 检查今日已有重点任务
  const todayFocusTasks = entities
    .filter(isOpenTask)
    .filter((entity) =>
      entity.properties.scheduled === today ||
      entity.properties.due === today ||
      (entity.properties.focus === true && !entity.properties.scheduled) ||
      entity.properties.status === "doing"
    );

  const isTodayFull = todayFocusTasks.length >= 3;

  const data = pulseQuery.data;

  return (
    <article className="agent-pulse-card" aria-label="Agent 今日智能建议">
      <header className="agent-pulse-header">
        <div className="agent-pulse-title-wrap">
          <div className="agent-pulse-badge">
            <Sparkles size={15} />
            <span>Agent 今日建议</span>
          </div>
          <span className="agent-pulse-mode-tag">
            {data?.source === "llm" ? "AI 战略研判" : "智能规则研判"}
          </span>
        </div>
        <button
          type="button"
          className="agent-pulse-refresh-btn"
          onClick={() => refreshMutation.mutate()}
          disabled={pulseQuery.isFetching || refreshMutation.isPending}
          title="重新诊断并刷新建议"
          aria-label="刷新建议"
        >
          <RefreshCw
            size={13}
            className={pulseQuery.isFetching || refreshMutation.isPending ? "spin" : ""}
          />
          <span>重新诊断</span>
        </button>
      </header>

      {pulseQuery.isPending && (
        <div className="agent-pulse-loading" role="status">
          <RefreshCw size={15} className="spin" />
          <span>正在结合进行中项目与近期事实推演今日关键行动…</span>
        </div>
      )}

      {pulseQuery.isError && (
        <div className="agent-pulse-error" role="alert">
          <span>暂无法获取建议：{(pulseQuery.error as Error).message}</span>
          <button
            type="button"
            className="button secondary small"
            onClick={() => pulseQuery.refetch()}
          >
            重试
          </button>
        </div>
      )}

      {data && (
        <>
          <p className="agent-pulse-briefing">{data.briefing}</p>

          {isTodayFull && (
            <div className="agent-pulse-notice">
              <Check size={14} />
              <span>
                今日重点已锁定 <strong>{todayFocusTasks.length}</strong> 项，请全力攻克现实结果。以下为备选行动建议：
              </span>
            </div>
          )}

          <div className="agent-pulse-actions-list">
            {data.actions.map((action) => {
              // 检查该任务是否已在今日任务中
              const alreadyInToday = action.existingTaskId
                ? todayFocusTasks.some((t) => t.id === action.existingTaskId)
                : todayFocusTasks.some((t) => t.name === action.title);

              const isApplying = applyingId === action.id;

              return (
                <div
                  key={action.id}
                  className={`agent-pulse-action-row${alreadyInToday ? " is-applied" : ""}`}
                >
                  <div className="agent-pulse-action-main">
                    <div className="agent-pulse-action-top">
                      <strong className="agent-pulse-action-title">{action.title}</strong>
                      <div className="agent-pulse-tags">
                        <span className="agent-pulse-project-tag">
                          <FolderKanban size={12} />
                          {action.project}
                        </span>
                        <span className="agent-pulse-meta-tag">
                          <Clock3 size={12} />
                          {action.estimatedMinutes}m
                        </span>
                        <span className={`agent-pulse-priority-tag ${action.priority}`}>
                          {action.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="agent-pulse-rationale">{action.rationale}</p>
                  </div>

                  <div className="agent-pulse-action-ctrl">
                    {alreadyInToday ? (
                      <span className="agent-pulse-applied-badge">
                        <Check size={13} />
                        <span>已在今日</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="button primary small agent-pulse-accept-btn"
                        onClick={() => applyMutation.mutate(action)}
                        disabled={isApplying || applyMutation.isPending}
                      >
                        <Target size={13} />
                        <span>{isApplying ? "采纳中…" : "设为重点"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
