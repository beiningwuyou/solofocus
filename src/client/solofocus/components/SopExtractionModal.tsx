import React, { useState } from "react";
import { soloApi } from "../api";
import { useSoloFocus } from "../context";
import type { SopExtractionDraft, SopCategory } from "../../../shared/solofocus-models";

interface SopExtractionModalProps {
  isOpen: boolean;
  draft: SopExtractionDraft | null;
  onClose: () => void;
  onSaved?: () => void;
}

const CATEGORY_OPTIONS: { value: SopCategory; label: string }[] = [
  { value: "delivery", label: "交付发布" },
  { value: "quality", label: "质量保障" },
  { value: "routine", label: "常态规范" },
  { value: "ops", label: "运维容灾" }
];

export function SopExtractionModal({ isOpen, draft, onClose, onSaved }: SopExtractionModalProps) {
  const { refetch, showToast } = useSoloFocus();

  const [title, setTitle] = useState(draft?.title || "");
  const [category, setCategory] = useState<SopCategory>(draft?.category || "delivery");
  const [summary, setSummary] = useState(draft?.summary || "");
  const [steps, setSteps] = useState(draft?.steps || []);
  const [saving, setSaving] = useState(false);

  // Sync when draft changes
  React.useEffect(() => {
    if (draft) {
      setTitle(draft.title);
      setCategory(draft.category);
      setSummary(draft.summary);
      setSteps(draft.steps || []);
    }
  }, [draft]);

  if (!isOpen || !draft) return null;

  const handleStepInstructionChange = (index: number, val: string) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], instruction: val };
      return next;
    });
  };

  const handleSaveSop = async () => {
    if (!title.trim()) {
      showToast("SOP 标题不能为空", "warning");
      return;
    }

    try {
      setSaving(true);
      await soloApi.createSop({
        title: title.trim(),
        category,
        summary: summary.trim(),
        steps: steps.map((s) => ({
          phaseTitle: s.phaseTitle,
          instruction: s.instruction,
          checklistItems: s.checklistItems
        }))
      });

      showToast("经验资产萃取成功：已沉淀至 SOP 知识库", "inventory_2");
      await refetch();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-gutter bg-on-background/45 backdrop-blur-[3px] transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[760px] max-h-[85vh] bg-surface-container-lowest rounded-xl shadow-[0_16px_40px_rgba(11,28,48,0.18)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Title Bar */}
        <div className="h-12 px-space-xl py-space-sm bg-surface-container-lowest flex items-center justify-between border-b border-outline-variant/20">
          <div className="flex items-center gap-space-sm min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">psychology_alt</span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-sm text-title-md text-on-surface font-semibold">
                萃取为 SOP 模版
              </span>
              <span className="font-label-sm text-xs text-outline">
                (来源: {draft.sourceProjectName})
              </span>
            </div>
          </div>
          <button
            aria-label="关闭"
            className="w-7 h-7 rounded-DEFAULT flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-colors"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-space-xl overflow-y-auto flex flex-col gap-space-md">
          {/* Title and Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="font-label-sm text-xs text-on-surface-variant font-medium">SOP 标题</label>
              <input
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded-DEFAULT text-on-surface font-body-sm text-xs outline-none focus:border-primary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-xs text-on-surface-variant font-medium">类别</label>
              <select
                className="w-full h-9 px-2.5 bg-surface-container-low border border-outline-variant/30 rounded-DEFAULT text-on-surface font-body-sm text-xs outline-none cursor-pointer"
                value={category}
                onChange={(e) => setCategory(e.target.value as SopCategory)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-xs text-on-surface-variant font-medium">概述与适用场景</label>
            <textarea
              className="w-full p-2.5 bg-surface-container-low border border-outline-variant/30 rounded-DEFAULT text-on-surface font-body-sm text-xs outline-none focus:border-primary resize-none leading-relaxed"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* Steps List */}
          <div className="flex flex-col gap-2">
            <span className="font-label-md text-xs font-semibold text-on-surface">
              标准步骤 ({steps.length} 步)
            </span>

            <div className="flex flex-col gap-2">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-surface-container-low/40 rounded-DEFAULT border border-outline-variant/20 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-outline w-6">
                      0{idx + 1}
                    </span>
                    <span className="px-2 py-0.5 bg-surface-container-high rounded text-[11px] font-semibold text-primary">
                      {step.phaseTitle}
                    </span>
                    <input
                      className="flex-1 h-7 px-2 bg-surface-container-lowest border border-outline-variant/20 rounded text-xs text-on-surface font-medium outline-none focus:border-primary"
                      value={step.instruction}
                      onChange={(e) => handleStepInstructionChange(idx, e.target.value)}
                    />
                  </div>

                  {step.checklistItems && step.checklistItems.length > 0 && (
                    <div className="pl-8 flex flex-wrap gap-1.5">
                      {step.checklistItems.map((item, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[11px] rounded-DEFAULT flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px] text-secondary">
                            check_small
                          </span>
                          <span>{item}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-space-xl py-space-sm bg-surface-container-low/30 border-t border-outline-variant/20 flex items-center justify-end gap-2">
          <button
            type="button"
            className="h-8 px-3 rounded-DEFAULT hover:bg-surface-container font-label-md text-xs text-on-surface-variant transition-colors cursor-pointer"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveSop}
            className="h-8 px-4 bg-primary text-on-primary hover:bg-neutral-800 font-label-md text-xs font-semibold rounded-DEFAULT flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {saving ? "hourglass_top" : "inventory_2"}
            </span>
            <span>{saving ? "正在保存..." : "保存到 SOP 库"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
