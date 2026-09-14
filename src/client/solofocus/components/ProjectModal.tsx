import React, { useState, useEffect } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { SopRecommendationItem } from "../../../shared/solofocus-models";

export function ProjectModal() {
  const { isProjectModalOpen, closeProjectModal, data, refetch, showToast } = useSoloFocus();

  const [name, setName] = useState("");
  const [domainId, setDomainId] = useState("");
  const [targetDate, setTargetDate] = useState("2026-09-30");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState<string[]>([
    "阶段 01: 核心功能日常验证与脚本基准落地",
    "阶段 02: 本地 SQLite 故障断点自动重试机制"
  ]);
  const [newMilestone, setNewMilestone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recommendedSops, setRecommendedSops] = useState<SopRecommendationItem[]>([]);
  const [isFetchingSops, setIsFetchingSops] = useState(false);

  useEffect(() => {
    if (!isProjectModalOpen) return;
    const timer = setTimeout(async () => {
      if (name.trim().length >= 2) {
        try {
          setIsFetchingSops(true);
          const recs = await soloApi.recommendSops(name.trim(), domainId);
          setRecommendedSops(recs || []);
        } catch {
          // ignore
        } finally {
          setIsFetchingSops(false);
        }
      } else {
        setRecommendedSops([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [name, domainId, isProjectModalOpen]);

  useEffect(() => {
    if (data?.domains?.length && !domainId) {
      setDomainId(data.domains[0].id);
    }
  }, [data, domainId]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isProjectModalOpen) return;
      if (e.key === "Escape") {
        closeProjectModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProjectModalOpen, closeProjectModal]);

  if (!isProjectModalOpen) return null;

  const handleAddMilestone = () => {
    if (!newMilestone.trim()) return;
    setMilestones((prev) => [...prev, newMilestone.trim()]);
    setNewMilestone("");
  };

  const handleRemoveMilestone = (idx: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApplySopToMilestones = (sop: SopRecommendationItem) => {
    if (!sop.steps || sop.steps.length === 0) return;
    const generated = sop.steps.map(
      (step, idx) => `阶段 0${idx + 1}: [${step.phaseTitle}] ${step.instruction}`
    );
    setMilestones(generated);
    showToast(`已成功载入《${sop.title}》作为项目标准里程碑序列`, "playlist_add_check");
  };

  const handleSubmit = async (e?: React.FormEvent) => {

    if (e) e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await soloApi.createProject({
        name: name.trim(),
        domainId: domainId || (data?.domains[0]?.id ?? "domain-delivery"),
        targetDate,
        description: description.trim(),
        milestones: milestones.map((title, i) => ({ title, orderIndex: i }))
      });
      showToast("项目创建成功", "folder_special");
      await refetch();
      setName("");
      setDescription("");
      closeProjectModal();
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-gutter bg-on-background/45 backdrop-blur-[3px] transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeProjectModal();
      }}
    >
      <div
        className="w-full max-w-[720px] bg-surface-container-lowest rounded-xl shadow-[0_16px_40px_rgba(11,28,48,0.18)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Title Bar */}
        <div className="h-13 px-space-xl py-space-md bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-space-sm min-w-0">
            <span className="material-symbols-outlined text-[20px] text-on-surface">create_new_folder</span>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">新建项目</span>
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant">
            <button
              aria-label="关闭"
              className="w-7 h-7 rounded-DEFAULT flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-colors"
              onClick={closeProjectModal}
              title="关闭 (Esc)"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="w-full h-px bg-surface-container"></div>

        {/* Form Body */}
        <form
          className="flex flex-col p-space-xl gap-space-lg max-h-[calc(88vh-120px)] overflow-y-auto"
          onSubmit={handleSubmit}
        >
          {/* Project Title */}
          <div className="flex flex-col gap-space-xs">
            <input
              autoFocus
              className="w-full font-headline-md text-headline-md text-on-surface placeholder:text-outline bg-transparent py-space-xs focus:outline-none focus:ring-0 leading-tight"
              placeholder="输入项目名称..."
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="w-full h-0.5 bg-surface-container-high focus-within:bg-primary transition-colors"></div>
          </div>

          {/* 2-column Grid: Domain + Target Date */}
          <div className="grid grid-cols-2 gap-space-lg pt-space-xs">
            {/* Domain Select */}
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">flag</span>
                <span>关联领域</span>
              </label>
              <div className="relative w-full">
                <select
                  className="w-full h-9 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg appearance-none cursor-pointer outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all pr-8"
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                >
                  {data?.domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-2 text-outline pointer-events-none text-[18px]">expand_more</span>
              </div>
            </div>

            {/* Target Delivery Date */}
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">calendar_today</span>
                <span>预期完成日期</span>
              </label>
              <div className="relative w-full flex items-center">
                <input
                  className="w-full h-9 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all cursor-pointer"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-outline">notes</span>
              <span>项目简介</span>
            </label>
            <div className="relative w-full rounded-lg bg-surface-container-low p-space-sm focus-within:bg-surface-container-lowest focus-within:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all">
              <textarea
                className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none resize-none leading-relaxed"
                placeholder="该项目的预期交付目标、核心产出或质量检验基准..."
                rows={3}
                value={description}
                maxLength={300}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex items-center justify-end pt-space-xs font-body-sm text-body-sm text-outline">
                <span>{description.length} / 300</span>
              </div>
            </div>
          </div>

          {/* Standard SOP Recommendation Strip */}
          {recommendedSops.length > 0 && (
            <div className="p-2.5 bg-surface-container-low/60 rounded-lg border border-outline-variant/30 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">auto_fix_high</span>
                  <span>推荐 SOP 模版</span>
                </span>
                <span className="font-label-sm text-[11px] text-outline">
                  {isFetchingSops ? "匹配中..." : `${recommendedSops.length} 个模版`}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {recommendedSops.slice(0, 2).map((rec) => (
                  <div
                    key={rec.sopId}
                    className="p-2 bg-surface-container-lowest rounded-DEFAULT border border-outline-variant/20 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-body-sm text-xs font-semibold text-on-surface truncate">
                          {rec.title}
                        </span>
                        <span className="px-1.5 py-0.2 bg-surface-container text-on-surface-variant font-label-sm text-[10px] rounded">
                          {rec.stepCount} 步
                        </span>
                      </div>
                      <span className="font-label-sm text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">
                        {rec.summary}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplySopToMilestones(rec)}
                      className="shrink-0 h-7 px-2.5 bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface text-xs font-medium rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">playlist_add_check</span>
                      <span>导入里程碑</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">checklist</span>
                <span>节点与关键成果</span>
              </label>
              <span className="font-body-sm text-body-sm text-outline">选填</span>
            </div>

            <div className="flex flex-col gap-space-xs">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className="group flex items-center justify-between px-space-sm py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-space-sm min-w-0 flex-1">
                    <span className="w-4 h-4 rounded-DEFAULT bg-surface-container-high text-on-surface-variant flex items-center justify-center font-label-sm text-label-sm">
                      {idx + 1}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface truncate">{m}</span>
                  </div>
                  <button
                    aria-label="移除里程碑"
                    className="text-outline hover:text-error transition-colors p-0.5 opacity-60 hover:opacity-100"
                    onClick={() => handleRemoveMilestone(idx)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-space-xs mt-1">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-space-sm top-2 text-outline text-[16px]">add_circle</span>
                <input
                  className="w-full h-8 pl-8 pr-space-sm bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded-lg outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all"
                  placeholder="增加新里程碑..."
                  type="text"
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddMilestone();
                    }
                  }}
                />
              </div>
              <button
                className="h-8 px-space-sm bg-surface-container hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm rounded-lg transition-colors flex items-center gap-1"
                onClick={handleAddMilestone}
                type="button"
              >
                <span>添加</span>
              </button>
            </div>
          </div>
        </form>

        <div className="w-full h-px bg-surface-container"></div>

        {/* Footer */}
        <div className="h-14 px-space-xl bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-space-sm text-outline font-body-sm text-body-sm">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-label-sm font-label-sm bg-surface-container text-on-surface-variant rounded-DEFAULT">↵</kbd>
              <span>创建项目</span>
            </div>
            <span className="text-surface-container-highest">·</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-label-sm font-label-sm bg-surface-container text-on-surface-variant rounded-DEFAULT">Esc</kbd>
              <span>取消</span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              className="h-9 px-space-md rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
              onClick={closeProjectModal}
              type="button"
            >
              取消
            </button>
            <button
              className="h-9 px-space-lg rounded-lg bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-on-primary-fixed transition-all flex items-center gap-1.5 group disabled:opacity-50"
              disabled={isSubmitting || !name.trim()}
              onClick={() => handleSubmit()}
              type="button"
            >
              <span>{isSubmitting ? "创建中..." : "创建并进入详情"}</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
