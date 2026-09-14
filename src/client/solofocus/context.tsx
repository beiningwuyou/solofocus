import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { SoloFocusBootstrapPayload, TaskItem } from "../../shared/solofocus-models";
import { soloApi } from "./api";

interface SoloFocusContextType {
  data: SoloFocusBootstrapPayload | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // Drawer
  drawerTask: TaskItem | null;
  openDrawer: (task: TaskItem) => void;
  closeDrawer: () => void;
  // Modals
  isProjectModalOpen: boolean;
  openProjectModal: () => void;
  closeProjectModal: () => void;
  isDomainModalOpen: boolean;
  openDomainModal: () => void;
  closeDomainModal: () => void;
  isHabitModalOpen: boolean;
  openHabitModal: () => void;
  closeHabitModal: () => void;
  isSopModalOpen: boolean;
  openSopModal: () => void;
  closeSopModal: () => void;
  isRestoreModalOpen: boolean;
  targetSnapshotName: string;
  openRestoreModal: (filename?: string) => void;
  closeRestoreModal: () => void;
  // Quick Capture HUD
  isQuickCaptureOpen: boolean;
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
  // Evening Shutdown Ritual
  isEveningShutdownOpen: boolean;
  openEveningShutdown: () => void;
  closeEveningShutdown: () => void;
  // Toast
  toast: { message: string; icon: string } | null;
  showToast: (message: string, icon?: string) => void;
}

const SoloFocusContext = createContext<SoloFocusContextType | null>(null);

export function useSoloFocus(): SoloFocusContextType {
  const ctx = useContext(SoloFocusContext);
  if (!ctx) throw new Error("useSoloFocus must be used within SoloFocusProvider");
  return ctx;
}

export function SoloFocusProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SoloFocusBootstrapPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [drawerTask, setDrawerTask] = useState<TaskItem | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isSopModalOpen, setIsSopModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isEveningShutdownOpen, setIsEveningShutdownOpen] = useState(false);
  const [targetSnapshotName, setTargetSnapshotName] = useState("solofocus_backup_2026-09-05_full.db");
  const [toast, setToast] = useState<{ message: string; icon: string } | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await soloApi.getBootstrap();
      setData(res);
      setError(null);
      // Keep drawer task in sync
      if (drawerTask) {
        const fresh = res.tasks.find((t) => t.id === drawerTask.id);
        if (fresh) setDrawerTask(fresh);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [drawerTask]);

  useEffect(() => {
    refetch();
  }, []);

  // Global Shortcut for Quick Capture (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsQuickCaptureOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showToast = useCallback((message: string, icon = "check_circle") => {
    setToast({ message, icon });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 2500);
  }, []);

  const openDrawer = useCallback((task: TaskItem) => setDrawerTask(task), []);
  const closeDrawer = useCallback(() => setDrawerTask(null), []);

  const openProjectModal = useCallback(() => setIsProjectModalOpen(true), []);
  const closeProjectModal = useCallback(() => setIsProjectModalOpen(false), []);

  const openDomainModal = useCallback(() => setIsDomainModalOpen(true), []);
  const closeDomainModal = useCallback(() => setIsDomainModalOpen(false), []);

  const openHabitModal = useCallback(() => setIsHabitModalOpen(true), []);
  const closeHabitModal = useCallback(() => setIsHabitModalOpen(false), []);

  const openSopModal = useCallback(() => setIsSopModalOpen(true), []);
  const closeSopModal = useCallback(() => setIsSopModalOpen(false), []);

  const openRestoreModal = useCallback((filename?: string) => {
    if (filename) setTargetSnapshotName(filename);
    setIsRestoreModalOpen(true);
  }, []);
  const closeRestoreModal = useCallback(() => setIsRestoreModalOpen(false), []);

  const openQuickCapture = useCallback(() => setIsQuickCaptureOpen(true), []);
  const closeQuickCapture = useCallback(() => setIsQuickCaptureOpen(false), []);

  const openEveningShutdown = useCallback(() => setIsEveningShutdownOpen(true), []);
  const closeEveningShutdown = useCallback(() => setIsEveningShutdownOpen(false), []);

  return (
    <SoloFocusContext.Provider
      value={{
        data,
        isLoading,
        error,
        refetch,
        drawerTask,
        openDrawer,
        closeDrawer,
        isProjectModalOpen,
        openProjectModal,
        closeProjectModal,
        isDomainModalOpen,
        openDomainModal,
        closeDomainModal,
        isHabitModalOpen,
        openHabitModal,
        closeHabitModal,
        isSopModalOpen,
        openSopModal,
        closeSopModal,
        isRestoreModalOpen,
        targetSnapshotName,
        openRestoreModal,
        closeRestoreModal,
        isQuickCaptureOpen,
        openQuickCapture,
        closeQuickCapture,
        isEveningShutdownOpen,
        openEveningShutdown,
        closeEveningShutdown,
        toast,
        showToast
      }}
    >
      {children}
    </SoloFocusContext.Provider>
  );
}
