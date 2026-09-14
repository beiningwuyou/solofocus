import type {
  AgentActivity,
  AgentEmployee,
  AgentEmployeePreset,
  AgentRosterSummary,
  BootstrapPayload,
  EntityCreateInput,
  EntityArchiveResult,
  EntityKind,
  EntityPatchInput,
  EntityTrashResult,
  SearchHit,
  VaultEntity,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunActionInput
} from "../shared/domain";
import { AGENT_PRESETS } from "../shared/domain";
import type { RoutineRecord } from "../shared/daily-routine";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly payload?: unknown) {
    super(message);
  }
}

/** Backend origin: in Tauri production the frontend runs from `tauri://` and can't
 *  resolve relative URLs, so we hit the loopback Fastify server directly.
 *  In the dev server Vite proxies `/api/*` so relative URLs still work. */
const API_BASE: string = (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)
  ? "http://127.0.0.1:4317"
  : "";

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `请求失败：${response.status}`;
    throw new ApiError(response.status, message, payload);
  }
  return payload as T;
}

export const api = {
  saveDailyRoutine: (date: string, record: RoutineRecord, expectedRevision: string | null) => request<VaultEntity>(`/api/daily-routine/${date}`, {
    method: "PUT", body: JSON.stringify({ record, expectedRevision })
  }),
  bootstrap: () => request<BootstrapPayload>("/api/bootstrap"),
  list: (kind: EntityKind) => request<VaultEntity[]>(`/api/entities/${kind}`),
  create: (kind: EntityKind, input: EntityCreateInput) => request<VaultEntity>(`/api/entities/${kind}`, {
    method: "POST",
    body: JSON.stringify(input)
  }),
  update: (entity: VaultEntity, input: Omit<EntityPatchInput, "expectedRevision">, options?: { merge?: boolean }) => request<VaultEntity>(`/api/entities/${entity.kind}/${entity.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, expectedRevision: entity.revision, merge: options?.merge ?? false })
  }),
  archive: (entity: VaultEntity) => request<EntityArchiveResult>(`/api/entities/${entity.kind}/${entity.id}/archive`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision: entity.revision })
  }),
  restoreArchivedTask: (entity: VaultEntity) => request<VaultEntity>(`/api/archive/tasks/${entity.id}/restore`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision: entity.revision })
  }),
  restoreArchivedProject: (entity: VaultEntity) => request<VaultEntity>(`/api/archive/projects/${entity.id}/restore`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision: entity.revision })
  }),
  trash: (entity: VaultEntity) => request<EntityTrashResult>(`/api/entities/${entity.kind}/${entity.id}/trash`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision: entity.revision })
  }),
  checkInHabit: (id: string, date: string) => request<VaultEntity>(`/api/habits/${id}/check-in`, {
    method: "POST",
    body: JSON.stringify({ date })
  }),
  convertInbox: (id: string, input: { kind: "vision" | "project" | "task" | "document" | "resource"; name?: string }) => request<{ created: VaultEntity }>(`/api/inbox/${id}/convert`, {
    method: "POST",
    body: JSON.stringify(input)
  }),
  search: (query: string) => request<{ query: string; results: SearchHit[] }>(`/api/search?q=${encodeURIComponent(query)}`),
  openInObsidian: (path: string) => request<{ ok: boolean }>("/api/open", {
    method: "POST",
    body: JSON.stringify({ path })
  }),
  workflows: () => request<WorkflowDefinition[]>("/api/workflows"),
  workflow: (id: string) => request<WorkflowDefinition>(`/api/workflows/${id}`),
  createWorkflow: (input: Omit<WorkflowDefinition, "id" | "path" | "revision" | "version" | "trigger" | "approval">) => request<WorkflowDefinition>("/api/workflows", {
    method: "POST",
    body: JSON.stringify(input)
  }),
  saveWorkflowVersion: (workflow: WorkflowDefinition) => request<{ workflow: WorkflowDefinition; version: VaultEntity }>(`/api/workflows/${workflow.id}/versions`, {
    method: "POST",
    body: JSON.stringify({
      expectedRevision: workflow.revision,
      status: workflow.status,
      area: workflow.area,
      goal: workflow.goal,
      project: workflow.project,
      plan: workflow.plan,
      summary: workflow.summary,
      body: workflow.body,
      steps: workflow.steps
    })
  }),
  startWorkflow: (id: string) => request<WorkflowRun>(`/api/workflows/${id}/runs`, {
    method: "POST",
    body: JSON.stringify({ input: {} })
  }),
  workflowRuns: () => request<WorkflowRun[]>("/api/workflow-runs"),
  workflowRun: (id: string) => request<WorkflowRun>(`/api/workflow-runs/${id}`),
  workflowRunAction: (id: string, input: WorkflowRunActionInput) => request<WorkflowRun>(`/api/workflow-runs/${id}/actions`, {
    method: "POST",
    body: JSON.stringify(input)
  }),
  cleanupWorkflowCache: (retentionDays = 30) => request<{ removed: number }>("/api/workflow-cache/cleanup", {
    method: "POST",
    body: JSON.stringify({ retentionDays })
  }),
  agents: () => request<AgentRosterSummary>("/api/agents"),
  agentPresets: () => Promise.resolve(AGENT_PRESETS),
  toggleAgentShift: (on: boolean) => request<{ shiftOn: boolean }>("/api/agents/shift", {
    method: "POST",
    body: JSON.stringify({ on: on ? "true" : "false" })
  }),
  hireAgent: (input: { preset?: string; name: string; avatar?: string; group?: string; description?: string; schedule: string; scheduleLabel?: string; pacing?: "auto" | "hourly" | "global"; workflowId?: string; scope?: { projectIds?: string[] }; handsOffTo?: string[] }) => request<{ id: string }>("/api/agents", {
    method: "POST",
    body: JSON.stringify(input)
  }),
  runAgentNow: (id: string) => request<{ runId: string; workflowName: string }>(`/api/agents/${id}/run`, { method: "POST" }),
  patchAgent: (id: string, input: { revision: string; name?: string; status?: "on" | "off"; pacing?: "auto" | "hourly" | "global"; workflowId?: string; schedule?: string; scheduleLabel?: string; description?: string; group?: string; scope?: { projectIds?: string[] }; handsOffTo?: string[] }) => request<{ ok: true }>(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  }),
  archiveAgent: (id: string, revision: string) => request<{ ok: true }>(`/api/agents/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ revision })
  }),
  agentPulse: (refresh?: boolean) => request<AgentPulseResponse>(`/api/agent/pulse${refresh ? "?refresh=true" : ""}`),
  applyAgentPulse: (action: PulseAction) => request<{ ok: boolean; entityId: string; message: string }>("/api/agent/pulse/apply", {
    method: "POST",
    body: JSON.stringify(action)
  }),
  getAiConfig: () => request<AiConfigDto>("/api/ai-config"),
  saveAiConfig: (input: { baseUrl?: string; model?: string; apiKey?: string }) => request<AiConfigDto>("/api/ai-config", {
    method: "POST",
    body: JSON.stringify(input)
  })
};

export interface PulseAction {
  id: string;
  title: string;
  project: string;
  projectId?: string;
  priority: "p0" | "p1" | "p2" | "p3";
  estimatedMinutes: number;
  rationale: string;
  actionType: "promote_existing" | "create_new";
  existingTaskId?: string;
}

export interface AgentPulseResponse {
  briefing: string;
  actions: PulseAction[];
  source: "llm" | "heuristic";
  date: string;
}

export interface AiConfigDto {
  baseUrl: string;
  model: string;
  configured: boolean;
  hasApiKey: boolean;
}

