import React from "react";
import { useSoloFocus } from "../context";

export function Toast() {
  const { toast } = useSoloFocus();
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-on-surface text-surface px-4 py-2.5 rounded-lg shadow-lg border border-outline/30 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="material-symbols-outlined text-[18px] text-secondary-container">
        {toast.icon || "check_circle"}
      </span>
      <span className="text-body-md font-medium text-[13px]">{toast.message}</span>
    </div>
  );
}
