import React, { useState, useEffect } from "react";
import { soloApi } from "../api";
import { useSoloFocus } from "../context";
import type { EmailTaskCandidate, EmailConfigData, TaskPriority } from "../../../shared/solofocus-models";

interface EmailTasksBriefingCardProps {
  onNavigateToSettings?: () => void;
}

export function EmailTasksBriefingCard({ onNavigateToSettings }: EmailTasksBriefingCardProps) {
  const { data, refetch, showToast } = useSoloFocus();

  const [candidates, setCandidates] = useState<EmailTaskCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [selectedProjects, setSelectedProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [adopting, setAdopting] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [emailConfig, setEmailConfig] = useState<EmailConfigData | null>(null);
  const [expandedSnippets, setExpandedSnippets] = useState<Record<string, boolean>>({});

  const projects = data?.projects || [];
  const activeProjects = projects.filter((p) => p.status === "active");

  // 初始化加载配置与候选池
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);
        const cfg = await soloApi.getEmailConfig().catch(() => null);
        if (!isMounted) return;
        setEmailConfig(cfg);

        // 获取缓存的待办候选
        const cached = await soloApi.getEmailCandidates().catch(() => []);
        if (!isMounted) return;

        if (cached && cached.length > 0) {
          setCandidates(cached);
          setSelectedCandidateIds(cached.map((c) => c.id));
          const titles: Record<string, string> = {};
          const projs: Record<string, string> = {};
          for (const c of cached) {
            titles[c.id] = c.extractedTitle;
            if (c.suggestedProjectId) {
              projs[c.id] = c.suggestedProjectId;
            }
          }
          setEditedTitles(titles);
          setSelectedProjects(projs);
        } else if (cfg && cfg.enabled && cfg.autoSyncOnOpen) {
          // 开启了自动同步且缓存为空，自动在后台静默发起一次同步
          handleSync(false);
        }
      } catch (err) {
        console.error("Failed to initialize email tasks briefing", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSync = async (notify = true) => {
    try {
      setSyncing(true);
      const res = await soloApi.syncEmailTasks();
      if (res.success) {
        setCandidates(res.newCandidates);
        setSelectedCandidateIds(res.newCandidates.map((c) => c.id));

        const titles: Record<string, string> = {};
        const projs: Record<string, string> = {};
        for (const c of res.newCandidates) {
          titles[c.id] = c.extractedTitle;
          if (c.suggestedProjectId) {
            projs[c.id] = c.suggestedProjectId;
          }
        }
        setEditedTitles(titles);
        setSelectedProjects(projs);

        if (notify) {
          if (res.newCandidates.length > 0) {
            showToast(`邮件同步完成：已提炼 ${res.newCandidates.length} 项今日工作待办`, "mark_email_read");
          } else {
            showToast("工作邮件已全部同步，暂无新增待办项", "check_circle");
          }
        }
      } else if (notify && res.error) {
        showToast(`邮件同步未成功: ${res.error}`, "error");
      }
    } catch (err: any) {
      if (notify) {
        showToast(`同步失败: ${err.message}`, "error");
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedCandidateIds.length === candidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(candidates.map((c) => c.id));
    }
  };

  const handleToggleSnippet = (id: string) => {
    setExpandedSnippets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDismissSingle = async (candidateId: string) => {
    try {
      await soloApi.dismissEmailCandidates([candidateId]);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidateId));
      showToast("已忽略该条邮件待办", "archive");
    } catch (err: any) {
      showToast(`操作失败: ${err.message}`, "error");
    }
  };

  const handleDismissSelected = async () => {
    if (!selectedCandidateIds.length) return;
    try {
      await soloApi.dismissEmailCandidates(selectedCandidateIds);
      setCandidates((prev) => prev.filter((c) => !selectedCandidateIds.includes(c.id)));
      setSelectedCandidateIds([]);
      showToast(`已忽略 ${selectedCandidateIds.length} 项待办建议`, "archive");
    } catch (err: any) {
      showToast(`操作失败: ${err.message}`, "error");
    }
  };

  const handleAdoptSelected = async () => {
    if (!selectedCandidateIds.length) return;
    try {
      setAdopting(true);
      const todayStr = new Date().toISOString().slice(0, 10);

      const toAdopt = candidates
        .filter((c) => selectedCandidateIds.includes(c.id))
        .map((c) => ({
          candidateId: c.id,
          title: editedTitles[c.id]?.trim() || c.extractedTitle,
          priority: c.suggestedPriority || ("NORMAL" as TaskPriority),
          estimatedMinutes: c.suggestedMinutes || 45,
          projectId: selectedProjects[c.id] || undefined,
          scheduledDate: todayStr
        }));

      const res = await soloApi.adoptEmailTasks({ tasks: toAdopt });
      showToast(`已成功将 ${res.createdCount} 项邮件待办排入今日清单！`, "task_alt");

      // 从候选列表中移除
      setCandidates((prev) => prev.filter((c) => !selectedCandidateIds.includes(c.id)));
      setSelectedCandidateIds([]);

      // 刷新今日工作台数据
      await refetch();
    } catch (err: any) {
      showToast(`采纳失败: ${err.message}`, "error");
    } finally {
      setAdopting(false);
    }
  };

  // 若尚未配置工作邮箱，展示极简引导栏
  if (!emailConfig?.enabled || !emailConfig?.hasPassword) {
    return null;
  }

  // 若没有待办候选且不在加载中，展示轻量收起状态，提供手动同步按钮
  if (candidates.length === 0 && !loading && !syncing) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT px-space-md py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-secondary">mark_email_read</span>
          <span className="font-body-sm text-body-sm text-on-surface">
            工作邮箱已就绪，当前暂无需要跟进的邮件行动项
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleSync(true)}
          className="h-7 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm rounded-DEFAULT flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">sync</span>
          <span>检查最新邮件</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-sm overflow-hidden flex flex-col">
      {/* Card Header */}
      <div className="px-space-md py-2.5 bg-surface-container-low/40 border-b border-outline-variant/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">mail</span>
          <span className="font-title-sm text-title-sm text-on-surface font-semibold">
            工作邮件行动项提炼
          </span>
          <span className="px-1.5 py-0.2 rounded-DEFAULT bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
            {candidates.length} 项待办建议
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <button
            type="button"
            disabled={syncing}
            className="p-1 rounded-DEFAULT hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
            onClick={() => handleSync(true)}
            title="拉取并重新分析最新邮件"
          >
            <span className={`material-symbols-outlined text-[16px] ${syncing ? "animate-spin" : ""}`}>
              sync
            </span>
          </button>
          <button
            type="button"
            className="p-1 rounded-DEFAULT hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "收起邮件待办" : "展开邮件待办"}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isExpanded ? "expand_less" : "expand_more"}
            </span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-space-md flex flex-col gap-space-md">
          {/* Subheader hint */}
          <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
            <span>
              已由 AI 过滤无关订阅与通知，以下为提炼出的工作事项，勾选确认后将直接排入今日清单：
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-primary hover:underline font-label-sm cursor-pointer"
              >
                {selectedCandidateIds.length === candidates.length ? "取消全选" : "全选全部"}
              </button>
            </div>
          </div>

          {/* Candidate List */}
          <div className="flex flex-col divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-DEFAULT overflow-hidden">
            {candidates.map((cand) => {
              const isChecked = selectedCandidateIds.includes(cand.id);
              const isSnippetOpen = Boolean(expandedSnippets[cand.id]);

              return (
                <div
                  key={cand.id}
                  className={`p-3 flex flex-col gap-2 transition-colors ${
                    isChecked
                      ? "bg-surface-container-lowest"
                      : "bg-surface-container-low/30 opacity-75"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelect(cand.id)}
                      className="w-4 h-4 mt-1 rounded-DEFAULT accent-primary cursor-pointer shrink-0"
                    />

                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      {/* Title & Priority Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <input
                            type="text"
                            value={editedTitles[cand.id] ?? cand.extractedTitle}
                            onChange={(e) =>
                              setEditedTitles((prev) => ({ ...prev, [cand.id]: e.target.value }))
                            }
                            className="w-full font-body-sm text-body-sm font-semibold text-on-surface bg-transparent border-b border-transparent hover:border-outline-variant/40 focus:border-primary focus:bg-surface-container-low px-1 py-0.5 rounded-xs outline-none transition-colors"
                            placeholder="待办标题..."
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Priority Badge */}
                          <span
                            className={`px-1.5 py-0.2 rounded-DEFAULT text-[10px] font-bold ${
                              cand.suggestedPriority === "CRITICAL"
                                ? "bg-error text-on-error"
                                : cand.suggestedPriority === "HIGH"
                                ? "bg-primary text-on-primary"
                                : "bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {cand.suggestedPriority === "CRITICAL"
                              ? "最高优"
                              : cand.suggestedPriority === "HIGH"
                              ? "高优"
                              : "普通"}
                          </span>

                          <span className="font-mono text-[11px] text-outline">
                            ~{cand.suggestedMinutes || 45}m
                          </span>

                          {/* Project Matcher Dropdown */}
                          <select
                            value={selectedProjects[cand.id] || ""}
                            onChange={(e) =>
                              setSelectedProjects((prev) => ({ ...prev, [cand.id]: e.target.value }))
                            }
                            className="h-6 px-1.5 text-[11px] bg-surface-container-low border border-outline-variant/30 rounded-DEFAULT text-on-surface outline-none cursor-pointer"
                          >
                            <option value="">独立待办 (无项目)</option>
                            {activeProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>

                          {/* Dismiss single */}
                          <button
                            type="button"
                            onClick={() => handleDismissSingle(cand.id)}
                            className="p-1 text-outline hover:text-error rounded-DEFAULT hover:bg-surface-container transition-colors cursor-pointer"
                            title="忽略此事项"
                          >
                            <span className="material-symbols-outlined text-[15px]">close</span>
                          </button>
                        </div>
                      </div>

                      {/* Origin Mail Meta */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
                        <span className="flex items-center gap-1 truncate max-w-xs font-medium text-on-surface">
                          <span className="material-symbols-outlined text-[13px] text-outline">person</span>
                          {cand.from}
                        </span>
                        <span className="text-outline truncate max-w-sm">
                          主题: {cand.subject}
                        </span>
                        <span className="text-outline">
                          {cand.date.slice(0, 10)}
                        </span>
                        {cand.fullBodySnippet && (
                          <button
                            type="button"
                            onClick={() => handleToggleSnippet(cand.id)}
                            className="text-primary hover:underline cursor-pointer flex items-center gap-0.5 ml-auto text-[11px]"
                          >
                            <span>{isSnippetOpen ? "收起邮件正文" : "查看邮件摘要"}</span>
                            <span className="material-symbols-outlined text-[13px]">
                              {isSnippetOpen ? "expand_less" : "expand_more"}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Expandable Snippet */}
                      {isSnippetOpen && cand.fullBodySnippet && (
                        <div className="mt-1 p-2 bg-surface-container-low/70 rounded-DEFAULT border border-outline-variant/20 text-xs text-on-surface-variant font-mono whitespace-pre-wrap leading-relaxed">
                          {cand.fullBodySnippet}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={selectedCandidateIds.length === 0}
              onClick={handleDismissSelected}
              className="px-3 py-1.5 text-xs text-outline hover:text-error hover:bg-surface-container rounded-DEFAULT transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              <span>忽略所选项 ({selectedCandidateIds.length})</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="font-label-sm text-[11px] text-outline">
                已选中 {selectedCandidateIds.length} / {candidates.length} 项
              </span>
              <button
                type="button"
                disabled={adopting || selectedCandidateIds.length === 0}
                onClick={handleAdoptSelected}
                className="h-8 px-4 bg-primary text-on-primary hover:bg-neutral-800 font-label-md text-xs font-semibold rounded-DEFAULT flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {adopting ? "hourglass_top" : "add_task"}
                </span>
                <span>{adopting ? "排入清单中..." : `采纳并排入今日清单 (${selectedCandidateIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
