import React, { useState, useEffect } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { SopCategory } from "../../../shared/solofocus-models";

interface SopStepDraft {
  phaseTitle: string;
  instruction: string;
  checklistItems: string[];
}

const CATEGORY_OPTIONS: { value: SopCategory; label: string; desc: string }[] = [
  { value: "routine", label: "常态规范", desc: "日常周期性高频流程" },
  { value: "quality", label: "质量保障", desc: "审查、验收与防缺陷核对" },
  { value: "ops", label: "运维容灾", desc: "迁移、备份与故障处置" },
  { value: "delivery", label: "交付发布", desc: "上线交付与合流确认" }
];

export function SopModal() {
  const { isSopModalOpen, closeSopModal, data, refetch, showToast } = useSoloFocus();

  const [title, setTitle] = useState("");
  const [domainId, setDomainId] = useState("");
  const [category, setCategory] = useState<SopCategory>("routine");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState<SopStepDraft[]>([
    {
      phaseTitle: "01 准备阶段",
      instruction: "梳理上下文与前置依赖，确认执行环境就绪",
      checklistItems: ["依赖前置项确认无误", "明确验收标准与负责人"]
    },
    {
      phaseTitle: "02 执行阶段",
      instruction: "按工程标准开展规范化操作与关键节点留痕",
      checklistItems: ["执行核心动作并记录变更", "运行自检指令验证结果"]
    }
  ]);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [newInstruction, setNewInstruction] = useState("");
  const [newChecklistText, setNewChecklistText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (data?.domains?.length && !domainId) {
      setDomainId(data.domains[0].id);
    }
  }, [data, domainId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSopModalOpen) return;
      if (e.key === "Escape") {
        closeSopModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSopModalOpen, closeSopModal]);

  if (!isSopModalOpen) return null;

  const handleAddStep = () => {
    if (!newInstruction.trim()) return;
    const items = newChecklistText
      .split(/[\n,，]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const stepNum = steps.length + 1;
    const defaultPhase = stepNum < 10 ? `0${stepNum} 执行阶段` : `${stepNum} 执行阶段`;

    setSteps((prev) => [
      ...prev,
      {
        phaseTitle: newPhaseTitle.trim() || defaultPhase,
        instruction: newInstruction.trim(),
        checklistItems: items.length > 0 ? items : ["按标准规范严格执行并记录结果。"]
      }
    ]);
    setNewPhaseTitle("");
    setNewInstruction("");
    setNewChecklistText("");
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      showToast("请输入 SOP 标题", "warning");
      return;
    }

    try {
      setIsSubmitting(true);
      await soloApi.createSop({
        title: title.trim(),
        domainId: domainId || undefined,
        category,
        summary: summary.trim() || "沉淀个人长效标准作业流程 · 规范化执行保障。",
        steps: steps.map((s) => ({
          phaseTitle: s.phaseTitle,
          instruction: s.instruction,
          checklistItems: s.checklistItems
        }))
      });

      showToast("SOP 模板创建成功", "task_alt");
      await refetch();

      // Reset
      setTitle("");
      setSummary("");
      setCategory("routine");
      setSteps([
        {
          phaseTitle: "01 准备阶段",
          instruction: "梳理上下文与前置依赖，确认执行环境就绪",
          checklistItems: ["依赖前置项确认无误", "明确验收标准与负责人"]
        },
        {
          phaseTitle: "02 执行阶段",
          instruction: "按工程标准开展规范化操作与关键节点留痕",
          checklistItems: ["执行核心动作并记录变更", "运行自检指令验证结果"]
        }
      ]);
      closeSopModal();
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-background/45 backdrop-blur-[3px] transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSopModal();
      }}
    >
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              checklist_rtl
            </span>
            <h2 className="font-title-md text-title-md font-bold text-on-surface">
              新建 SOP 标准工序
            </h2>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            onClick={closeSopModal}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant font-medium mb-1.5">
              SOP 名称 / 流程标题 <span className="text-error">*</span>
            </label>
            <input
              className="w-full h-10 px-3.5 bg-surface-container-low border border-outline-variant/30 rounded text-on-surface font-body-md text-body-md outline-none focus:border-primary transition-colors"
              placeholder="例如：数据库冷备份与容灾恢复演练规范"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant font-medium mb-1.5">
                所属工序分类
              </label>
              <select
                className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-on-surface font-body-sm text-body-sm outline-none focus:border-primary cursor-pointer transition-colors"
                value={category}
                onChange={(e) => setCategory(e.target.value as SopCategory)}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.desc})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant font-medium mb-1.5">
                关联领域
              </label>
              <select
                className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-on-surface font-body-sm text-body-sm outline-none focus:border-primary cursor-pointer transition-colors"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
              >
                <option value="">通用公共规范 (无指定领域)</option>
                {data?.domains?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant font-medium mb-1.5">
              工序核心概述 / 目标说明
            </label>
            <textarea
              className="w-full p-3 bg-surface-container-low border border-outline-variant/30 rounded text-on-surface font-body-sm text-body-sm outline-none focus:border-primary transition-colors resize-none"
              placeholder="明确该 SOP 的目标、准入条件、核心保障及复现要点..."
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* Steps list */}
          <div className="border-t border-outline-variant/20 pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                工序步骤分解 ({steps.length} 步)
              </span>
              <span className="font-body-sm text-xs text-outline">
                可先建立骨架，后续随时可在知识库中补充
              </span>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-surface-container-low/70 border border-outline-variant/20 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-semibold text-[11px]">
                        {step.phaseTitle}
                      </span>
                      <span className="text-on-surface font-medium truncate">
                        {step.instruction}
                      </span>
                    </div>
                    {step.checklistItems.length > 0 && (
                      <div className="flex items-center gap-2 mt-1 text-on-surface-variant text-[11px]">
                        <span className="text-outline">核对清单:</span>
                        <span className="truncate">
                          {step.checklistItems.join(" · ")}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-outline hover:text-error transition-colors p-1 cursor-pointer"
                    onClick={() => handleRemoveStep(idx)}
                    title="删除此步骤"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Quick add step */}
            <div className="bg-surface-container-low/50 p-3 rounded border border-outline-variant/20 flex flex-col gap-2">
              <span className="font-label-sm text-xs font-semibold text-on-surface-variant">
                追加新工序步骤
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  className="h-8 px-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded text-on-surface font-body-sm text-xs outline-none"
                  placeholder="阶段名 (如: 03 复盘总结)"
                  type="text"
                  value={newPhaseTitle}
                  onChange={(e) => setNewPhaseTitle(e.target.value)}
                />
                <input
                  className="sm:col-span-2 h-8 px-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded text-on-surface font-body-sm text-xs outline-none"
                  placeholder="工序动作指导说明 *"
                  type="text"
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 h-8 px-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded text-on-surface font-body-sm text-xs outline-none"
                  placeholder="核对条目（逗号或换行分隔）"
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddStep();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="h-8 px-3 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                >
                  + 添加步骤
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20 mt-2">
            <button
              className="h-9 px-4 rounded font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              onClick={closeSopModal}
              type="button"
            >
              取消
            </button>
            <button
              className="h-9 px-5 bg-primary hover:bg-neutral-800 text-on-primary font-label-md text-label-md font-semibold rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              disabled={isSubmitting || !title.trim()}
              type="submit"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>{isSubmitting ? "正在保存..." : "确认创建 SOP"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
