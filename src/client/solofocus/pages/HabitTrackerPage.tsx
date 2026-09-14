import React, { useState, useMemo } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";

export function HabitTrackerPage() {
  const { data, refetch, openHabitModal, showToast } = useSoloFocus();

  const [selectedDomainId, setSelectedDomainId] = useState<string>("ALL");

  const habits = data?.habits || [];
  const domains = data?.domains || [];

  const past7Days = useMemo(() => {
    const list = [];
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const weekday = weekdays[d.getDay()];
      list.push({
        dateStr,
        weekday: i === 0 ? "今" : weekday,
        isToday: i === 0
      });
    }
    return list;
  }, []);

  const todayStr = past7Days[6].dateStr;

  const handlePunchDate = async (habitId: string, dateStr: string) => {
    try {
      const res = await soloApi.punchHabit(habitId, dateStr);
      showToast(
        res.isPunched ? `已打卡: ${dateStr}` : `已取消打卡: ${dateStr}`,
        "sync"
      );
      await refetch();
    } catch (err: any) {
      showToast(`打卡失败: ${err.message}`, "error");
    }
  };

  const handleDeleteHabit = async (habitId: string, name: string) => {
    if (!window.confirm(`确定将习惯「${name}」移入回收站吗？可在设置中随时还原。`)) return;
    try {
      await soloApi.deleteHabit(habitId);
      showToast("习惯已移入回收站", "delete");
      await refetch();
    } catch (err: any) {
      showToast(`删除失败: ${err.message}`, "error");
    }
  };

  const activeHabits = useMemo(() => {
    return habits.filter((h) => h.isActive !== false);
  }, [habits]);

  const domainHabitCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of activeHabits) {
      if (h.domainId) {
        map[h.domainId] = (map[h.domainId] || 0) + 1;
      }
    }
    return map;
  }, [activeHabits]);

  const filteredHabits = useMemo(() => {
    return activeHabits.filter((h) => {
      if (selectedDomainId !== "ALL" && h.domainId !== selectedDomainId) return false;
      return true;
    });
  }, [activeHabits, selectedDomainId]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Compact Tag-Style Filter Bar */}
      <div className="flex items-center justify-between gap-space-sm bg-surface-container-lowest px-space-md py-2 rounded-DEFAULT border border-outline-variant/20 shadow-xs flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1 py-0.5">
          <button
            className={`h-7 px-2.5 rounded-DEFAULT font-label-sm text-label-sm whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              selectedDomainId === "ALL"
                ? "bg-primary text-on-primary font-semibold shadow-2xs border border-primary"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30"
            }`}
            onClick={() => setSelectedDomainId("ALL")}
            type="button"
          >
            <span>全部领域</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-none ${
                selectedDomainId === "ALL"
                  ? "bg-white/20 text-white font-bold"
                  : "bg-surface-container-high text-outline"
              }`}
            >
              {activeHabits.length}
            </span>
          </button>
          {domains.map((d) => {
            const count = domainHabitCounts[d.id] ?? 0;
            const isSelected = selectedDomainId === d.id;
            return (
              <button
                key={d.id}
                className={`h-7 px-2.5 rounded-DEFAULT font-label-sm text-label-sm whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  isSelected
                    ? "bg-primary text-on-primary font-semibold shadow-2xs border border-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30"
                }`}
                onClick={() => setSelectedDomainId(d.id)}
                type="button"
              >
                <span>{d.name}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-none ${
                      isSelected
                        ? "bg-white/20 text-white font-bold"
                        : "bg-surface-container-high text-outline"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          className="h-7 px-3 bg-primary text-on-primary hover:bg-primary-container font-label-sm text-label-sm font-semibold rounded-DEFAULT flex items-center gap-1 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
          onClick={openHabitModal}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">add</span>
          <span>新建习惯</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-space-md">
        {filteredHabits.length === 0 ? (
          <div className="bg-surface-container-lowest p-12 text-center text-outline font-body-md rounded-lg">
            暂无匹配的日常习惯，请点击新建习惯。
          </div>
        ) : (
          filteredHabits.map((habit) => {
            const domain = domains.find((d) => d.id === habit.domainId);
            const isDoneToday = (habit.historyLogs || []).includes(todayStr);

            return (
              <div
                key={habit.id}
                className="p-4 rounded-lg bg-surface-container-lowest shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all border border-outline-variant/15 hover:border-primary/30"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-title-md text-title-md font-bold text-on-surface">
                      {habit.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium">
                      {domain ? domain.name : "日常综合"}
                    </span>
                    <span className="text-[11px] text-outline font-mono">
                      {habit.window}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 mt-2 font-body-sm text-body-sm text-on-surface-variant flex-wrap">
                    <span
                      className={`flex items-center gap-1.5 font-medium ${
                        isDoneToday ? "text-secondary" : "text-outline"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isDoneToday ? "bg-secondary" : "bg-outline-variant"
                        }`}
                      ></span>
                      {isDoneToday ? "今日已完成" : "今日待打卡"}
                    </span>
                    <span className="text-outline text-[10px]">•</span>
                    <span className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded text-on-surface">
                      <span className="material-symbols-outlined text-secondary text-[14px]">
                        local_fire_department
                      </span>
                      <span>
                        连续 <strong className="font-bold">{habit.streakDays}</strong> 天
                      </span>
                    </span>
                    {habit.mva && (
                      <>
                        <span className="text-outline text-[10px]">•</span>
                        <span className="text-on-surface-variant text-xs">
                          MVA 保底: <i>{habit.mva}</i>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 pt-2 lg:pt-0">
                  <div className="flex flex-col gap-1.5 items-center">
                    <div className="flex items-center gap-1.5">
                      {past7Days.map((day) => {
                        const isPunched = (habit.historyLogs || []).includes(day.dateStr);

                        return (
                          <button
                            key={day.dateStr}
                            type="button"
                            className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-bold cursor-pointer transition-all ${
                              isPunched
                                ? "bg-secondary text-on-secondary"
                                : "bg-surface-container text-outline hover:border hover:border-outline"
                            } ${day.isToday ? "ring-2 ring-primary" : ""}`}
                            title={`${day.dateStr} (${day.weekday}): 点击切换打卡`}
                            onClick={() => handlePunchDate(habit.id, day.dateStr)}
                          >
                            {isPunched ? "✓" : "·"}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-outline select-none font-medium">
                      {past7Days.map((day) => (
                        <span
                          key={day.dateStr}
                          className={`w-7 text-center ${day.isToday ? "font-bold text-on-surface" : ""}`}
                        >
                          {day.weekday}
                        </span>
                      ))}
                    </div>
                  </div>

                    <div className="flex items-center gap-2 min-w-[120px] justify-end">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded font-label-md text-label-md font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-sm ${
                        isDoneToday
                          ? "bg-surface-container text-on-surface hover:bg-surface-container-high"
                          : "bg-primary text-on-primary hover:bg-neutral-800"
                      }`}
                      onClick={() => handlePunchDate(habit.id, todayStr)}
                    >
                      {isDoneToday ? "取消今日打卡" : "完成今日打卡"}
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded text-outline hover:text-error hover:bg-error-container/30 transition-colors"
                      title="移入回收站"
                      onClick={() => handleDeleteHabit(habit.id, habit.name)}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
