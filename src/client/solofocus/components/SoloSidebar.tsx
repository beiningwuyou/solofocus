import React from "react";
import { NavLink } from "react-router-dom";
import { useSoloFocus } from "../context";
import { getCurrentWindow } from "@tauri-apps/api/window";

function startWindowDrag(event: React.MouseEvent<HTMLElement>) {
  if (event.buttons !== 1) return;
  const target = event.target as HTMLElement;
  if (target.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]')) return;
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    void getCurrentWindow().startDragging();
  }
}

interface SoloSidebarProps {
  basePath?: string;
}

export function SoloSidebar({ basePath = "" }: SoloSidebarProps) {
  const { openEveningShutdown } = useSoloFocus();

  const navItems = [
    { to: basePath || "/", end: true, icon: "dashboard", label: "今日工作台" },
    { to: `${basePath}/all-tasks`, end: false, icon: "check_circle", label: "全部任务" },
    { to: `${basePath}/all-projects`, end: false, icon: "folder", label: "全部项目" },
    { to: `${basePath}/domains-and-goals`, end: false, icon: "explore", label: "领域与目标" },
    { to: `${basePath}/habit-tracker`, end: false, icon: "sync", label: "习惯打卡" },
    { to: `${basePath}/sop-knowledge-base`, end: false, icon: "fact_check", label: "SOP 知识库" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-low border-r border-outline-variant/20 z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col">
        {/* macOS Traffic Lights Safe Drag Region */}
        <div
          className="h-10 w-full shrink-0 select-none cursor-default"
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
        />

        {/* Brand Header */}
        <div className="px-space-lg pb-space-md flex flex-col gap-space-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-DEFAULT bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
              <svg width="20" height="20" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="4" strokeWidth="2.5"></circle>
                <line x1="12" x2="12" y1="2" y2="5"></line>
                <line x1="12" x2="12" y1="19" y2="22"></line>
                <line x1="2" x2="5" y1="12" y2="12"></line>
                <line x1="19" x2="22" y1="12" y2="12"></line>
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center font-headline-md tracking-tight leading-none text-[20px]">
                <span className="font-bold text-on-surface">Solo</span>
                <span className="font-semibold text-secondary ml-0.5">Focus</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-space-sm space-y-1 flex flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-space-sm px-space-md py-space-sm transition-colors active:scale-95 transition-transform ${
                  isActive
                    ? "bg-primary text-on-primary rounded font-label-lg"
                    : "rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-lg text-label-lg"
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom Settings, Evening Shutdown & SQLite Status */}
      <div className="p-space-sm border-t border-outline-variant/20 flex flex-col gap-space-xs">
        <button
          type="button"
          onClick={openEveningShutdown}
          className="flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[18px] text-primary">wb_twilight</span>
            <span>日落关机</span>
          </div>
        </button>

        <NavLink
          to={`${basePath}/settings`}
          className={({ isActive }) =>
            `flex items-center justify-between px-space-md py-space-sm rounded transition-colors active:scale-95 transition-transform ${
              isActive
                ? "bg-primary text-on-primary font-label-md"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md"
            }`
          }
        >
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span>设置 (备份与模型)</span>
          </div>
        </NavLink>
        <div className="flex items-center gap-space-xs px-space-md py-space-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">SQLite 本地存储</span>
        </div>
      </div>
    </aside>
  );
}
