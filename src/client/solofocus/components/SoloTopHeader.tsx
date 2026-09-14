import React from "react";
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

export function SoloTopHeader() {
  const { showToast, openQuickCapture } = useSoloFocus();

  return (
    <header
      className="fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest border-b border-outline-variant/20 z-40 px-gutter-desktop flex items-center select-none cursor-default"
      data-tauri-drag-region
      onMouseDown={startWindowDrag}
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between h-full">
        {/* Left: Omnibar Quick Entry */}
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={openQuickCapture}
            className="w-full h-9 px-3.5 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30 hover:border-outline/50 hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-between transition-colors cursor-pointer group shadow-2xs"
            title="搜索与快速捕获 (⌘K)"
            id="global-quick-entry"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary transition-colors shrink-0">
                search
              </span>
              <span className="text-body-sm font-normal text-outline group-hover:text-on-surface-variant transition-colors select-none truncate">
                搜索任务、项目或快速捕获...
              </span>
            </div>

            <kbd className="px-1.5 py-0.5 bg-surface-container border border-outline-variant/30 rounded-DEFAULT text-[10px] font-mono text-outline group-hover:text-on-surface transition-colors shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Quick system controls */}
        <div className="flex items-center gap-space-xs text-on-surface-variant shrink-0">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-DEFAULT hover:bg-surface-container-low hover:text-on-surface transition-colors active:scale-95 transition-transform"
            title="通知"
            type="button"
            onClick={() => showToast("系统运行正常，WAL 日志写入零阻塞", "notifications")}
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-DEFAULT hover:bg-surface-container-low hover:text-on-surface transition-colors active:scale-95 transition-transform"
            title="快捷设置"
            type="button"
            onClick={() => showToast("快捷设置：离线 SQLite WAL 模式已就绪", "tune")}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
        </div>
      </div>
    </header>
  );
}
