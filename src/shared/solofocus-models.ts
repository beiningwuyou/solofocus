export interface DomainPrinciple {
  id: string;
  rule: string;
}

export interface DomainItem {
  id: string;
  name: string;
  code: string;
  icon: string;
  color?: string;
  mission: string;
  principles: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  seq: number;
  name: string;
  status: "planning" | "in_progress" | "ready" | "completed";
  targetDate?: string;
  completedAt?: string;
  tasks?: TaskItem[];
}

export interface ProjectItem {
  id: string;
  domainId: string;
  domainName?: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed" | "idea";
  targetDate?: string;
  progress: number;
  agentNotes?: string;
  milestones?: ProjectMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  isCompleted: boolean;
}

export type TaskMode = "formal" | "adhoc" | "inbox";
export type TaskPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
export type TaskStatus = "todo" | "in_progress" | "done" | "deferred" | "archived";

export interface TaskItem {
  id: string; // e.g. "#T-0941"
  projectId?: string;
  projectName?: string;
  milestoneId?: string;
  domainId?: string;
  domainName?: string;
  title: string;
  description?: string;
  mode: TaskMode;
  priority: TaskPriority;
  status: TaskStatus;
  scheduledDate?: string; // YYYY-MM-DD
  dueDate?: string; // ISO or time string
  estimatedMinutes?: number;
  timerSeconds?: number;
  checklist?: TaskChecklistItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type HabitWindow = "morning" | "intermission" | "evening" | "anytime";

export interface HabitItem {
  id: string;
  domainId?: string;
  domainName?: string;
  name: string;
  template?: string;
  window: HabitWindow;
  mva: string;
  notes?: string;
  streakDays: number;
  isActive: boolean;
  historyLogs?: string[]; // YYYY-MM-DD strings
  createdAt: string;
  updatedAt: string;
}

export type SopCategory = "routine" | "quality" | "ops" | "delivery";

export interface SopStepItem {
  id: string;
  sopId: string;
  stepNum: number;
  phaseTitle: string;
  instruction: string;
  checklistItems: string[];
}

export interface SopItem {
  id: string;
  domainId?: string;
  domainName?: string;
  title: string;
  category: SopCategory;
  summary: string;
  totalSteps: number;
  executionCount: number;
  steps?: SopStepItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveEntry {
  id: string;
  entityType: "task" | "project";
  entityId: string;
  originalName: string;
  domainName: string;
  completedAt: string;
  archivedAt: string;
  snapshotData?: Record<string, unknown>;
}

export interface TrashEntry {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  deletedAt: string;
  expiresAt: string; // 30 days after deletedAt
}

export interface DatabaseSnapshotEntry {
  id: string;
  filename: string;
  sizeBytes: number;
  checksumSha256: string;
  recordCount: number;
  createdAt: string;
  isValid: boolean;
}

export interface SmartRecommendationItem {
  id: string;
  taskId: string;
  taskTitle: string;
  projectName?: string;
  reason: "待排期" | "低优先级" | "顺延推进";
  priority: TaskPriority;
}

export interface SystemStatusPayload {
  storageMb: number;
  storageUsagePercent: number;
  activeItemsCount: number;
  archivedItemsCount: number;
  snapshotsCount: number;
  sqliteVersion: string;
  walModeActive: boolean;
  lastSnapshotTime?: string;
  trashCount: number;
}

export interface SoloFocusBootstrapPayload {
  systemStatus: SystemStatusPayload;
  domains: DomainItem[];
  projects: ProjectItem[];
  tasks: TaskItem[];
  habits: HabitItem[];
  sops: SopItem[];
  recommendations: SmartRecommendationItem[];
  snapshots: DatabaseSnapshotEntry[];
  archives: ArchiveEntry[];
  trash: TrashEntry[];
}

export interface AiDailyBriefingItem {
  summary: string;
  workloadAnalysis: {
    totalEstimatedMinutes: number;
    averageDailyMinutes: number;
    isOverloaded: boolean;
    overloadRatio: number;
  };
  topFocusTasks: {
    taskId: string;
    taskTitle: string;
    projectName?: string;
    priority: TaskPriority;
    reason: string;
  }[];
  postponeRecommendations: {
    taskId: string;
    taskTitle: string;
    projectName?: string;
    suggestedDate: string;
    reason: string;
  }[];
  actionAdvice: string[];
  generatedAt: string;
}

export interface ApplyDailyPlanPayload {
  confirmedFocusTaskIds: string[];
  confirmedPostponeTaskIds: string[];
  postponeTargetDate?: string;
}

export interface SopRecommendationItem {
  sopId: string;
  title: string;
  category: SopCategory;
  summary: string;
  matchReason: string;
  stepCount: number;
  steps: { phaseTitle: string; instruction: string; checklistItems: string[] }[];
}

export interface SopExtractionDraft {
  title: string;
  category: SopCategory;
  summary: string;
  sourceProjectId: string;
  sourceProjectName: string;
  steps: { phaseTitle: string; instruction: string; checklistItems: string[] }[];
  rationale: string;
}

export interface AiConfigData {
  provider?: "agy-native" | "custom";
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  configured?: boolean;
}

export type EmailPresetKey = "custom" | "qq_enterprise" | "netease_enterprise" | "163" | "qq" | "outlook" | "gmail";

export interface EmailConfigData {
  enabled: boolean;
  imapHost: string;
  imapPort: number;
  secure: boolean;
  username: string;
  password?: string;
  hasPassword?: boolean;
  folder: string;
  autoSyncOnOpen: boolean;
  syncLimit: number;
  lookbackDays: number;
  preset: EmailPresetKey;
}

export interface EmailTaskCandidate {
  id: string; // unique ID for client tracking
  messageId: string;
  subject: string;
  from: string;
  date: string;
  extractedTitle: string;
  suggestedPriority: TaskPriority;
  suggestedMinutes: number;
  actionSummary: string;
  suggestedProjectId?: string;
  suggestedProjectName?: string;
  fullBodySnippet?: string;
}

export interface EmailSyncResult {
  success: boolean;
  totalFetched: number;
  newCandidates: EmailTaskCandidate[];
  ignoredCount: number;
  error?: string;
  lastSyncedAt: string;
}

export interface AdoptEmailTasksPayload {
  tasks: {
    candidateId: string;
    title: string;
    priority: TaskPriority;
    estimatedMinutes: number;
    projectId?: string;
    scheduledDate: string;
    notes?: string;
  }[];
}


