import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api } from "./api";
import type { BootstrapPayload, EntityKind, VaultEntity } from "../shared/domain";

interface WorkbenchContextValue extends BootstrapPayload {
  byKind: (kind: EntityKind) => VaultEntity[];
  refresh: () => Promise<void>;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

/** Detect Tauri runtime. In Tauri v2 the global `__TAURI_INTERNALS__` is present. */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap, staleTime: 20_000 });

  useEffect(() => {
    const unlistens: UnlistenFn[] = [];

    if (isTauri()) {
      // ---- Tauri IPC events (works inside the secure tauri:// context) ----
      void (async () => {
        const vaultChange = await listen("vault-change", () => {
          void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
        });
        const runChange = await listen("workflow-run-change", () => {
          void queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
          void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
        });
        const runAttention = await listen("workflow-run-attention", () => {
          void queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
          void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
        });
        unlistens.push(vaultChange, runChange, runAttention);
      })();
    } else {
      // ---- Dev server: fall back to HTTP EventSource ----
      const events = new EventSource("/api/events");
      const onVaultChange = () => void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      const onRunChange = () => {
        void queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
        void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      };
      events.addEventListener("vault-change", onVaultChange);
      events.addEventListener("workflow-run-change", onRunChange);
      events.addEventListener("workflow-run-attention", onRunChange);
      unlistens.push(() => events.close());
    }

    return () => {
      for (const u of unlistens) u();
    };
  }, [queryClient]);

  const value = useMemo<WorkbenchContextValue | null>(() => {
    if (query.isLoading || query.isError || !query.data) return null;
    return {
      ...query.data,
      byKind: (kind) => query.data.entities.filter((entity) => entity.kind === kind),
      refresh: async () => { await queryClient.invalidateQueries({ queryKey: ["bootstrap"] }); }
    };
  }, [query.data, query.isLoading, query.isError]);

  if (query.isLoading) return <LoadingScreen />;
  if (query.isError || !query.data) return <ErrorScreen message={query.error instanceof Error ? query.error.message : "无法连接本地服务"} />;

  return <WorkbenchContext.Provider value={value as WorkbenchContextValue}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchContextValue {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("useWorkbench must be used inside WorkbenchProvider");
  return value;
}

function LoadingScreen() {
  return <div className="startup-state"><div className="brand-cube" aria-hidden="true" /><h1>个人工作台</h1><p>正在读取本地 Vault…</p></div>;
}

function ErrorScreen({ message }: { message: string }) {
  return <div className="startup-state error"><h1>无法打开工作台</h1><p>{message}</p><button onClick={() => location.reload()}>重新连接</button></div>;
}