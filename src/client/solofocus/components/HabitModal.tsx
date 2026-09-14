import React, { useState, useEffect } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";

interface PresetItem {
  name: string;
  domainId: string;
  timeSlot: string;
  mva: string;
  cue: string;
}

const PRESETS: PresetItem[] = [
  {
    name: "晨间梳理今日重点与代码合流",
    domainId: "domain-delivery",
    timeSlot: "晨间开工 (08:00~09:00)",
    mva: "写下今日 3 项核心任务与关键阻碍",
    cue: "泡好第一杯咖啡坐到工位后"
  },
  {
    name: "技术文档精读与架构摘记 20分钟",
    domainId: "domain-growth",
    timeSlot: "晚间复盘 (21:00~22:00)",
    mva: "通读一篇高质量技术博文或源码片段",
    cue: "关停主力工作 IDE 切换至阅读器"
  },
  {
    name: "深蹲拉伸与视力调适",
    domainId: "domain-wellness",
    timeSlot: "工作间隙/午后",
    mva: "站立远眺 1 分钟并做 15 次深蹲",
    cue: "番茄钟结束或连续输入超 90 分钟"
  },
  {
    name: "整理个人收支与账务流水",
    domainId: "domain-finance",
    timeSlot: "任意时刻无限制",
    mva: "核对当日手机账单并记录至 Ledger",
    cue: "睡前熄灯准备就寝时"
  }
];

export function HabitModal() {
  const { isHabitModalOpen, closeHabitModal, data, refetch, showToast } = useSoloFocus();

  const [name, setName] = useState("");
  const [domainId, setDomainId] = useState("");
  const [targetFrequency, setTargetFrequency] = useState("每日执行 (7天/周)");
  const [preferredTimeSlot, setPreferredTimeSlot] = useState("晨间开工 (08:00~09:00)");
  const [mva, setMva] = useState("");
  const [triggerCue, setTriggerCue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (data?.domains?.length && !domainId) {
      setDomainId(data.domains[0].id);
    }
  }, [data, domainId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isHabitModalOpen) return;
      if (e.key === "Escape") {
        closeHabitModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHabitModalOpen, closeHabitModal]);

  if (!isHabitModalOpen) return null;

  const handleApplyPreset = (p: PresetItem) => {
    setName(p.name);
    if (data?.domains.some(d => d.id === p.domainId)) {
      setDomainId(p.domainId);
    }
    setPreferredTimeSlot(p.timeSlot);
    setMva(p.mva);
    setTriggerCue(p.cue);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await soloApi.createHabit({
        name: name.trim(),
        domainId: domainId || (data?.domains[0]?.id ?? "domain-delivery"),
        targetFrequency,
        preferredTimeSlot,
        mva: mva.trim(),
        triggerCue: triggerCue.trim()
      });
      showToast("习惯建立成功", "repeat");
      await refetch();
      setName("");
      setMva("");
      setTriggerCue("");
      closeHabitModal();
    } catch (err: any) {
      showToast(`建立失败: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-gutter bg-on-background/45 backdrop-blur-[3px] transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeHabitModal();
      }}
    >
      <div
        className="w-full max-w-[680px] bg-surface-container-lowest rounded-xl shadow-[0_16px_40px_rgba(11,28,48,0.18)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="h-13 px-space-xl py-space-md bg-surface-container-lowest flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[20px] text-primary">repeat</span>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">新建日常习惯</span>
          </div>
          <button
            aria-label="关闭"
            className="w-7 h-7 rounded-DEFAULT flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-colors"
            onClick={closeHabitModal}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form
          className="flex flex-col p-space-xl gap-space-lg max-h-[calc(88vh-120px)] overflow-y-auto"
          onSubmit={handleSubmit}
        >
          {/* Habit Name */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-lg text-label-lg text-on-surface flex items-center gap-1">
                <span>习惯名称</span>
                <span className="text-error">*</span>
              </label>
              <span className="font-label-sm text-label-sm text-outline">{name.length} / 80 字</span>
            </div>
            <input
              autoFocus
              className="w-full h-10 px-space-md bg-surface-container-low text-on-surface font-body-lg text-body-lg rounded-DEFAULT outline-none focus:bg-surface-container-lowest transition-all"
              maxLength={80}
              placeholder="例如：晨间梳理今日重点与代码合流、补充 2000ml 饮水"
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Presets */}
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">常用模版快捷置入</span>
            <div className="flex flex-wrap gap-space-xs">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  className="px-space-sm py-1 rounded-DEFAULT bg-surface-container font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors"
                  onClick={() => handleApplyPreset(p)}
                  type="button"
                >
                  + {p.name.slice(0, 8)}...
                </button>
              ))}
            </div>
          </div>

          {/* Domain and Frequency Grid */}
          <div className="grid grid-cols-2 gap-space-lg">
            {/* Domain */}
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">flag</span>
                <span>所属领域</span>
              </label>
              <div className="relative w-full">
                <select
                  className="w-full h-9 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg appearance-none cursor-pointer outline-none focus:bg-surface-container-lowest transition-all pr-8"
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

            {/* Time slot */}
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-outline">schedule</span>
                <span>执行时段</span>
              </label>
              <div className="relative w-full">
                <select
                  className="w-full h-9 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg appearance-none cursor-pointer outline-none focus:bg-surface-container-lowest transition-all pr-8"
                  value={preferredTimeSlot}
                  onChange={(e) => setPreferredTimeSlot(e.target.value)}
                >
                  <option value="晨间开工 (08:00~09:00)">晨间开工 (08:00~09:00)</option>
                  <option value="工作间隙/午后">工作间隙 / 午后</option>
                  <option value="晚间复盘 (21:00~22:00)">晚间复盘 (21:00~22:00)</option>
                  <option value="任意时刻无限制">全天任意时刻无限制</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-2 text-outline pointer-events-none text-[18px]">expand_more</span>
              </div>
            </div>
          </div>

          {/* Minimum Viable Action (MVA) */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-outline">verified</span>
              <span>最低有效执行量 (MVA - 极端忙碌时的保底防断卡动作)</span>
            </label>
            <input
              className="w-full h-9 px-space-sm bg-surface-container-low font-body-md text-body-md text-on-surface rounded-DEFAULT outline-none focus:bg-surface-container-lowest transition-all"
              placeholder="例如：写下 3 条核心要点，或远眺深蹲 1 分钟"
              type="text"
              value={mva}
              onChange={(e) => setMva(e.target.value)}
            />
          </div>

          {/* Trigger Cue */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-outline">bolt</span>
              <span>触发情境与前置暗示</span>
            </label>
            <input
              className="w-full h-9 px-space-sm bg-surface-container-low font-body-md text-body-md text-on-surface rounded-DEFAULT outline-none focus:bg-surface-container-lowest transition-all"
              placeholder="例如：泡好咖啡坐到工位后、工作IDE关闭前"
              type="text"
              value={triggerCue}
              onChange={(e) => setTriggerCue(e.target.value)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="h-14 px-space-xl bg-surface-container-lowest flex items-center justify-between border-t border-surface-container">
          <div className="flex items-center gap-space-sm text-outline font-body-sm text-body-sm">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-label-sm font-label-sm bg-surface-container text-on-surface-variant rounded-DEFAULT">Esc</kbd>
              <span>取消</span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              className="h-9 px-space-md rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
              onClick={closeHabitModal}
              type="button"
            >
              取消
            </button>
            <button
              className="h-9 px-space-lg rounded-lg bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-on-primary-fixed transition-all flex items-center gap-1.5 disabled:opacity-50"
              disabled={isSubmitting || !name.trim()}
              onClick={() => handleSubmit()}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>{isSubmitting ? "保存中..." : "立即建立习惯"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
