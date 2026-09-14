import React, { useState, useEffect } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";

const PRESET_ICONS = [
  { icon: "explore", label: "探索" },
  { icon: "terminal", label: "研发" },
  { icon: "hub", label: "架构" },
  { icon: "psychology", label: "认知" },
  { icon: "favorite", label: "健康" },
  { icon: "account_balance", label: "资产" },
  { icon: "menu_book", label: "研习" },
  { icon: "rocket_launch", label: "突破" },
  { icon: "palette", label: "设计" },
  { icon: "fitness_center", label: "体能" },
  { icon: "shield", label: "底线" },
  { icon: "lightbulb", label: "思考" }
];

export function DomainModal() {
  const { isDomainModalOpen, closeDomainModal, refetch, showToast } = useSoloFocus();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [icon, setIcon] = useState("explore");
  const [customIcon, setCustomIcon] = useState("");
  const [mission, setMission] = useState("");
  const [principles, setPrinciples] = useState<string[]>([]);
  const [newPrinciple, setNewPrinciple] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDomainModalOpen) return;
      if (e.key === "Escape") {
        closeDomainModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDomainModalOpen, closeDomainModal]);

  if (!isDomainModalOpen) return null;

  const handleAddPrinciple = () => {
    if (!newPrinciple.trim()) return;
    setPrinciples((prev) => [...prev, newPrinciple.trim()]);
    setNewPrinciple("");
  };

  const handleRemovePrinciple = (idx: number) => {
    setPrinciples((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      const activeIcon = customIcon.trim() || icon || "explore";
      const finalCode = code.trim().toLowerCase() || `dom_${Date.now().toString(36)}`;

      await soloApi.createDomain({
        name: name.trim(),
        code: finalCode,
        icon: activeIcon,
        mission: mission.trim(),
        principles,
        notes: notes.trim()
      });

      showToast("领域卡片创建成功", "explore");
      await refetch();

      // Reset form
      setName("");
      setCode("");
      setIcon("explore");
      setCustomIcon("");
      setMission("");
      setPrinciples([]);
      setNewPrinciple("");
      setNotes("");
      closeDomainModal();
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentIcon = customIcon.trim() || icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-gutter bg-on-background/45 backdrop-blur-[3px] transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDomainModal();
      }}
    >
      <div
        className="w-full max-w-[640px] bg-surface-container-lowest rounded-xl shadow-[0_16px_40px_rgba(11,28,48,0.18)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-outline-variant/20"
        role="dialog"
      >
        {/* Title Bar */}
        <div className="h-13 px-space-xl py-space-md bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-space-sm min-w-0">
            <span className="material-symbols-outlined text-[20px] text-on-surface">explore</span>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">
              新建领域卡片
            </span>
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant">
            <button
              aria-label="关闭"
              className="w-7 h-7 rounded-DEFAULT flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-colors cursor-pointer"
              onClick={closeDomainModal}
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
          {/* Domain Name */}
          <div className="flex flex-col gap-space-xs">
            <input
              autoFocus
              className="w-full font-headline-md text-headline-md text-on-surface placeholder:text-outline bg-transparent py-space-xs focus:outline-none focus:ring-0 leading-tight"
              placeholder="输入领域名称，如：品牌与影响力、技术精进..."
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="w-full h-0.5 bg-surface-container-high focus-within:bg-primary transition-colors"></div>
          </div>

          {/* 2-column Grid: Code Identifier + Icon Preview */}
          <div className="grid grid-cols-2 gap-space-lg pt-space-xs">
            {/* Code */}
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">tag</span>
                <span>领域标识 (Code)</span>
              </label>
              <input
                className="w-full h-9 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all placeholder:text-outline"
                placeholder="如：brand、growth（选填）"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            {/* Icon Select & Preview */}
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">category</span>
                <span>当前图标预览</span>
              </label>
              <div className="flex items-center gap-2 h-9 px-space-sm bg-surface-container-low rounded-lg">
                <div className="w-6 h-6 rounded bg-surface-container-high text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">{currentIcon}</span>
                </div>
                <input
                  className="w-full bg-transparent text-on-surface font-body-sm text-body-sm placeholder:text-outline outline-none"
                  placeholder="自定义图标名或从下方选择"
                  type="text"
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Icon Presets */}
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">候选预设图标</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ICONS.map((p) => {
                const isSelected = !customIcon && icon === p.icon;
                return (
                  <button
                    key={p.icon}
                    type="button"
                    onClick={() => {
                      setIcon(p.icon);
                      setCustomIcon("");
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary text-on-primary font-medium"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mission */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-outline">verified</span>
              <span>核心愿景与长期基准</span>
            </label>
            <div className="relative w-full rounded-lg bg-surface-container-low p-space-sm focus-within:bg-surface-container-lowest focus-within:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all">
              <textarea
                className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none resize-none leading-relaxed"
                placeholder="定义该领域的核心价值产出标准与长效基准，如：专注打造纯离线高质量系统..."
                rows={3}
                value={mission}
                maxLength={300}
                onChange={(e) => setMission(e.target.value)}
              />
              <div className="flex items-center justify-end pt-space-xs font-body-sm text-body-sm text-outline">
                <span>{mission.length} / 300</span>
              </div>
            </div>
          </div>

          {/* Principles / Boundary Rules */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">gavel</span>
                <span>准则与边界设定</span>
              </label>
              <span className="font-body-sm text-body-sm text-outline">选填</span>
            </div>

            <div className="flex flex-col gap-space-xs">
              {principles.map((rule, idx) => (
                <div
                  key={idx}
                  className="group flex items-center justify-between px-space-sm py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="w-5 h-5 rounded-sm bg-surface-container-high flex items-center justify-center font-label-sm text-label-sm font-bold text-on-surface shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface truncate">{rule}</span>
                  </div>
                  <button
                    aria-label={`删除准则 ${idx + 1}`}
                    className="opacity-0 group-hover:opacity-100 text-outline hover:text-error transition-all p-0.5 rounded cursor-pointer"
                    onClick={() => handleRemovePrinciple(idx)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-space-xs mt-1">
                <input
                  className="flex-1 h-9 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all placeholder:text-outline"
                  placeholder="添加一条领域执行准则..."
                  type="text"
                  value={newPrinciple}
                  onChange={(e) => setNewPrinciple(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPrinciple();
                    }
                  }}
                />
                <button
                  className="h-9 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-md text-label-md flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                  onClick={handleAddPrinciple}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>添加准则</span>
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-outline">sticky_note_2</span>
              <span>领域备忘录</span>
            </label>
            <textarea
              className="w-full p-space-sm bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,0,0,0.85)] transition-all resize-none"
              placeholder="记录该领域的长期注意事项、参考资料或系统约束（选填）..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>

        <div className="w-full h-px bg-surface-container"></div>

        {/* Footer */}
        <div className="h-14 px-space-xl bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-space-sm text-outline font-body-sm text-body-sm">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-label-sm font-label-sm bg-surface-container text-on-surface-variant rounded-DEFAULT">
                ↵
              </kbd>
              <span>创建领域</span>
            </div>
            <span className="text-surface-container-highest">·</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-label-sm font-label-sm bg-surface-container text-on-surface-variant rounded-DEFAULT">
                Esc
              </kbd>
              <span>取消</span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              className="h-9 px-space-md rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
              onClick={closeDomainModal}
              type="button"
            >
              取消
            </button>
            <button
              className="h-9 px-space-lg rounded-lg bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-neutral-800 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              disabled={isSubmitting || !name.trim()}
              onClick={() => handleSubmit()}
              type="button"
            >
              <span>{isSubmitting ? "创建中..." : "创建领域卡片"}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
