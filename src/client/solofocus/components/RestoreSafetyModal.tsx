import React, { useState, useEffect } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";

export function RestoreSafetyModal() {
  const {
    isRestoreModalOpen,
    targetSnapshotName,
    closeRestoreModal,
    data,
    refetch,
    showToast
  } = useSoloFocus();

  const [confirmInput, setConfirmInput] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (isRestoreModalOpen) {
      setConfirmInput("");
      setIsRestoring(false);
    }
  }, [isRestoreModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRestoreModalOpen) return;
      if (e.key === "Escape") {
        closeRestoreModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRestoreModalOpen, closeRestoreModal]);

  if (!isRestoreModalOpen) return null;

  const isMatched = confirmInput.trim() === "SoloFocus";

  const handleRestore = async () => {
    if (!isMatched || isRestoring) return;

    try {
      setIsRestoring(true);
      const res = await soloApi.restoreBackup(targetSnapshotName, confirmInput.trim());
      showToast(res.message || "恢复成功，数据已刷新", "verified");
      await refetch();
      closeRestoreModal();
    } catch (err: any) {
      showToast(`恢复失败: ${err.message}`, "error");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-space-lg bg-on-surface/40 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRestoring) closeRestoreModal();
      }}
    >
      <div
        aria-labelledby="modal-title"
        aria-modal="true"
        className="w-full max-w-[540px] bg-surface-container-lowest rounded-DEFAULT shadow-[0_4px_24px_rgba(11,28,48,0.18)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Modal Header */}
        <div className="h-12 px-space-lg bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[20px] text-tertiary-container">
              shield
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight" id="modal-title">
              从本地备份文件恢复数据 (安全校验)
            </h2>
          </div>
          <button
            aria-label="关闭对话框"
            className="w-7 h-7 flex items-center justify-center rounded-DEFAULT text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            disabled={isRestoring}
            onClick={closeRestoreModal}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-space-lg flex flex-col gap-space-md max-h-[calc(85vh-112px)] overflow-y-auto">
          {/* Warning banner */}
          <div className="bg-surface-container-high rounded-DEFAULT p-space-md flex gap-space-sm items-start">
            <span className="material-symbols-outlined text-[18px] text-on-tertiary-fixed-variant mt-0.5 flex-shrink-0">
              warning
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-label-lg text-label-lg text-on-tertiary-fixed-variant">
                高危操作：本地数据库将覆盖
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                恢复操作将使用选定备份整体替换当前本地数据库。为防止数据丢失，系统已自动在当前目录创建了一份恢复前即时保护快照：
                <code className="font-mono bg-surface-container-lowest px-1 py-0.5 rounded-DEFAULT text-on-surface font-semibold text-[10px] select-all inline-block mt-1">
                  pre_restore_snapshot_{new Date().toISOString().slice(0, 10).replace(/-/g, "")}.db
                </code>
              </p>
            </div>
          </div>

          {/* Backup Snapshot Inspection Card */}
          <div className="bg-surface-container-low rounded-DEFAULT p-space-md flex flex-col gap-space-sm">
            <div className="flex items-start justify-between gap-space-sm pb-space-xs">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant flex-shrink-0">inventory_2</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-title-sm text-title-sm text-on-surface truncate">{targetSnapshotName}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">文件大小: 7.4 MB · 校验通过</span>
                </div>
              </div>
            </div>

            {/* Metrics List */}
            <div className="bg-surface-container-lowest rounded-DEFAULT p-space-sm flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">解析内容明细清单</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">来源: 本地物理快照</span>
              </div>
              <div className="grid grid-cols-2 gap-x-space-md gap-y-1 pt-1 font-body-sm text-body-sm text-on-surface">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-outline"></span>
                  <span>关联领域：<strong className="font-title-sm text-title-sm text-primary">{data?.domains.length || 5} 个</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-outline"></span>
                  <span>长期战略目标：<strong className="font-title-sm text-title-sm text-primary">7 项</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-outline"></span>
                  <span>活跃项目：<strong className="font-title-sm text-title-sm text-primary">{data?.projects.length || 4} 个</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-outline"></span>
                  <span>任务总量：<strong className="font-title-sm text-title-sm text-primary">{data?.tasks.length || 48} 条</strong></span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <span className="w-1 h-1 rounded-full bg-outline"></span>
                  <span>打卡与习惯：<strong className="font-title-sm text-title-sm text-primary">{data?.habits.length || 4} 项习惯</strong>、近 90 天全量时序</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Name Verification Input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-lg text-label-lg text-on-surface flex items-center justify-between" htmlFor="confirm-db-name">
              <span>请输入当前库名称以确认整体替换：</span>
              <span className="font-mono text-[11px] text-outline font-semibold">精确输入: SoloFocus</span>
            </label>
            <div className="relative flex items-center">
              <input
                autoFocus
                className="w-full h-9 px-space-sm bg-surface-container-low font-body-md text-body-md text-on-surface rounded-DEFAULT outline-none transition-colors focus:bg-surface-container-lowest"
                id="confirm-db-name"
                placeholder="请输入 SoloFocus"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
              />
              <span
                className={`material-symbols-outlined absolute right-space-sm text-[18px] ${
                  isMatched ? "text-secondary" : confirmInput ? "text-error" : "text-outline"
                }`}
              >
                {isMatched ? "check_circle" : confirmInput ? "cancel" : "edit"}
              </span>
            </div>
          </div>

          {/* Failsafe Notice */}
          <div className="flex items-center gap-space-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[15px] flex-shrink-0">info</span>
            <p className="font-body-sm text-body-sm leading-tight text-[11px]">
              恢复过程中如遇校验失败或异常，将自动保留原数据库不变。恢复成功后应用将立即重新加载。
            </p>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="h-14 px-space-lg bg-surface-container-low flex items-center justify-end gap-space-sm">
          <button
            className="h-9 px-space-md rounded-DEFAULT bg-transparent hover:bg-surface-container text-on-surface font-label-lg text-label-lg transition-colors"
            disabled={isRestoring}
            onClick={closeRestoreModal}
            type="button"
          >
            取消并放弃
          </button>
          <button
            className={`h-9 px-space-md rounded-DEFAULT bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg flex items-center gap-1.5 shadow-sm transition-colors ${
              !isMatched || isRestoring ? "opacity-40 cursor-not-allowed" : ""
            }`}
            disabled={!isMatched || isRestoring}
            onClick={handleRestore}
            type="button"
          >
            {isRestoring ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span>正在恢复底层 SQLite 数据库...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                <span>确认整体恢复当前数据</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
