import type {
  SoloFocusBootstrapPayload,
  TaskItem,
  ProjectItem,
  DomainItem,
  HabitItem,
  DatabaseSnapshotEntry,
  AiDailyBriefingItem,
  ApplyDailyPlanPayload,
  SopRecommendationItem,
  SopExtractionDraft,
  AiConfigData,
  EmailConfigData,
  EmailTaskCandidate,
  EmailSyncResult,
  AdoptEmailTasksPayload
} from "../../shared/solofocus-models";

const API_BASE: string = (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)
  ? "http://127.0.0.1:4317"
  : "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {})
  };
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    ...options,
    headers
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const soloApi = {
  getBootstrap: () => request<SoloFocusBootstrapPayload>("/api/solofocus/bootstrap"),

  createTask: (data: any) => request<TaskItem>("/api/solofocus/tasks", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  updateTask: (id: string, data: any) => request<{ success: boolean }>(`/api/solofocus/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),

  toggleTask: (id: string) => request<{ id: string; status: string; completedAt?: string }>(`/api/solofocus/tasks/${encodeURIComponent(id)}/toggle`, {
    method: "POST"
  }),

  scheduleTaskToToday: (id: string) => request<{ success: boolean }>(`/api/solofocus/tasks/${encodeURIComponent(id)}/schedule-today`, {
    method: "POST"
  }),

  applySopToTask: (id: string, sopId: string) => request<{ success: boolean }>(`/api/solofocus/tasks/${encodeURIComponent(id)}/apply-sop`, {
    method: "POST",
    body: JSON.stringify({ sopId })
  }),

  archiveTask: (id: string) => request<{ success: boolean }>(`/api/solofocus/tasks/${encodeURIComponent(id)}/archive`, {
    method: "POST"
  }),

  deleteTask: (id: string) => request<{ success: boolean }>(`/api/solofocus/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE"
  }),

  createProject: (data: any) => request<ProjectItem>("/api/solofocus/projects", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  updateProject: (id: string, data: any) => request<{ success: boolean }>(`/api/solofocus/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),

  deleteProject: (id: string) => request<{ success: boolean; id: string }>(`/api/solofocus/projects/${id}`, {
    method: "DELETE"
  }),

  archiveProject: (id: string) => request<{ success: boolean; id: string }>(`/api/solofocus/projects/${id}/archive`, {
    method: "POST"
  }),

  distillProjectNotes: (id: string) => request<{ success: boolean; notes: string }>(`/api/solofocus/projects/${id}/distill-notes`, {
    method: "POST"
  }),

  createDomain: (data: any) => request<DomainItem>("/api/solofocus/domains", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  updateDomain: (id: string, data: any) => request<{ success: boolean }>(`/api/solofocus/domains/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),

  createHabit: (data: any) => request<HabitItem>("/api/solofocus/habits", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  punchHabit: (id: string, punchDate?: string) => request<{ habitId: string; punchDate: string; isPunched: boolean; streakDays: number }>(`/api/solofocus/habits/${id}/punch`, {
    method: "POST",
    body: JSON.stringify({ punchDate })
  }),

  toggleHabitActive: (id: string) => request<{ success: boolean; isActive: boolean }>(`/api/solofocus/habits/${id}/toggle-active`, {
    method: "POST"
  }),

  deleteHabit: (id: string) => request<{ success: boolean; id: string }>(`/api/solofocus/habits/${id}`, {
    method: "DELETE"
  }),

  createSop: (data: {
    title: string;
    domainId?: string;
    category?: string;
    summary?: string;
    steps?: { phaseTitle: string; instruction: string; checklistItems?: string[] }[];
  }) => request<{ success: boolean; sop: any }>("/api/solofocus/sops", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  updateSopSteps: (id: string, steps: any[]) => request<{ success: boolean }>(`/api/solofocus/sops/${id}/steps`, {
    method: "PUT",
    body: JSON.stringify({ steps })
  }),

  deleteSop: (id: string) => request<{ success: boolean; id: string }>(`/api/solofocus/sops/${id}`, {
    method: "DELETE"
  }),

  restoreBackup: (targetSnapshotName: string, confirmInputName: string) => request<{ success: boolean; message: string }>("/api/solofocus/backup/restore", {
    method: "POST",
    body: JSON.stringify({ targetSnapshotName, confirmInputName })
  }),

  createSnapshot: () => request<DatabaseSnapshotEntry>("/api/solofocus/backup/snapshot", {
    method: "POST"
  }),

  restoreTrashItem: (id: string) => request<{ success: boolean; entityType: string; entityId: string }>(`/api/solofocus/trash/${encodeURIComponent(id)}/restore`, {
    method: "POST"
  }),

  purgeTrashItem: (id: string) => request<{ success: boolean; id: string }>(`/api/solofocus/trash/${encodeURIComponent(id)}`, {
    method: "DELETE"
  }),

  clearAllTrash: () => request<{ success: boolean }>("/api/solofocus/trash/clear", {
    method: "POST"
  }),

  // --- AI Agent APIs ---
  getDailyBriefing: () => request<AiDailyBriefingItem>("/api/solofocus/agent/daily-briefing"),

  applyDailyPlan: (payload: ApplyDailyPlanPayload) => request<{
    success: boolean;
    postponedCount: number;
    focusedCount: number;
  }>("/api/solofocus/agent/apply-daily-plan", {
    method: "POST",
    body: JSON.stringify(payload)
  }),

  recommendSops: (projectName: string, domainId?: string) => request<SopRecommendationItem[]>("/api/solofocus/agent/recommend-sops", {
    method: "POST",
    body: JSON.stringify({ projectName, domainId })
  }),

  extractSop: (projectId: string) => request<{ success: boolean; draft: SopExtractionDraft | null }>("/api/solofocus/agent/extract-sop", {
    method: "POST",
    body: JSON.stringify({ projectId })
  }),

  getAiConfig: () => request<AiConfigData & { hasRawKey: boolean }>("/api/solofocus/ai-config"),

  saveAiConfig: (data: Partial<AiConfigData>) => request<{ success: boolean; config: AiConfigData }>("/api/solofocus/ai-config", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  // --- Email Integration APIs ---
  getEmailConfig: () => request<EmailConfigData>("/api/solofocus/email/config"),

  saveEmailConfig: (data: Partial<EmailConfigData>) => request<{ success: boolean; config: EmailConfigData }>("/api/solofocus/email/config", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  testEmailConnection: () => request<{ success: boolean; message: string; unseenCount?: number; totalCount?: number }>("/api/solofocus/email/test-connection", {
    method: "POST"
  }),

  syncEmailTasks: () => request<EmailSyncResult>("/api/solofocus/email/sync", {
    method: "POST"
  }),

  getEmailCandidates: () => request<EmailTaskCandidate[]>("/api/solofocus/email/candidates"),

  adoptEmailTasks: (payload: AdoptEmailTasksPayload) => request<{ createdCount: number; taskIds: string[] }>("/api/solofocus/email/adopt", {
    method: "POST",
    body: JSON.stringify(payload)
  }),

  dismissEmailCandidates: (candidateIds: string[]) => request<{ dismissedCount: number }>("/api/solofocus/email/dismiss", {
    method: "POST",
    body: JSON.stringify({ candidateIds })
  })
};


