import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import MiniSearch from "minisearch";
import {
  ENTITY_KINDS,
  appendStatusHistory,
  asString,
  canonicalStatus,
  checkStatusTransition,
  dashboardMetrics,
  statusMachineFor,
  todayIso,
  type BootstrapPayload,
  type EntityCreateInput,
  type EntityArchiveResult,
  type EntityKind,
  type EntityPatchInput,
  type EntityProperties,
  type EntityTrashResult,
  type PropertyValue,
  type SearchHit,
  type VaultEntity
} from "../shared/domain.js";
import { createMarkdown, parseMarkdown, rewriteMarkdown } from "./frontmatter.js";
import { dailyFor, routineDateSchema, routineSchema, type RoutineRecord } from "../shared/daily-routine.js";

const IGNORED_ROOTS = new Set([".obsidian", ".workbench-app", ".workbench-plugin", "90-Archive", "_System", "node_modules"]);
const IGNORED_FILES = new Set(["AGENTS.md"]);
const ROUTES: Record<EntityKind, string> = {
  area: "40-Domains",
  card: "40-Knowledge/Cards",
  vision: "20-Actions/Visions",
  principle: "30-Library/Principles",
  goal: "20-Actions/Goals",
  key_result: "20-Actions/KeyResults",
  project: "20-Actions/Projects",
  plan: "20-Actions/Plans",
  milestone: "20-Actions/Milestones",
  task: "20-Actions/Tasks",
  habit: "20-Actions/Habits",
  metric: "20-Actions/Metrics",
  opportunity: "40-Domains/Career/Opportunities",
  document: "30-Library/Documents",
  resource: "30-Library/Resources",
  inbox: "00-Inbox",
  daily: "10-Daily",
  review: "70-Reviews",
  workflow: "60-Automation/Workflows",
  workflow_version: "60-Automation/Versions",
  workflow_run: "60-Automation/Runs",
  agent_employee: "60-Automation/Agents",
  agent_activity: "60-Automation/Agents/Activity"
};

const DEFAULT_STATUS: Partial<Record<EntityKind, string>> = {
  area: "active",
  card: "draft",
  vision: "active",
  principle: "draft",
  goal: "planned",
  key_result: "active",
  project: "idea",
  plan: "planned",
  milestone: "planned",
  task: "todo",
  habit: "active",
  metric: "active",
  opportunity: "saved",
  document: "active",
  resource: "active",
  inbox: "new",
  daily: "active",
  review: "draft",
  workflow: "draft",
  workflow_version: "frozen",
  workflow_run: "completed",
  agent_employee: "on",
  agent_activity: "info"
};

export class RevisionConflictError extends Error {
  constructor(public readonly latest: VaultEntity) {
    super("文件已在 Obsidian 或其他窗口中修改");
    this.name = "RevisionConflictError";
  }
}

/** 状态流转不在白名单内。前端应据此提示用户，而不是静默写坏数据。 */
export class StatusTransitionError extends Error {
  constructor(
    public readonly kind: EntityKind,
    public readonly from: string,
    public readonly to: string,
    public readonly allowed: string[],
    message: string
  ) {
    super(message);
    this.name = "StatusTransitionError";
  }
}

export class VaultRepository {
  private entities = new Map<string, VaultEntity>();
  private watcher?: FSWatcher;
  private listeners = new Set<(event: { type: string; path: string }) => void>();
  private searchIndex = this.newSearchIndex();
  private routineWrites: Promise<unknown> = Promise.resolve();

  constructor(public readonly vaultPath: string, private readonly trashPath = path.join(homedir(), ".Trash")) {}

  async initialize(): Promise<void> {
    await this.scan();
    this.watcher = chokidar.watch(this.vaultPath, {
      ignoreInitial: true,
      ignored: (candidate) => this.isIgnored(candidate),
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 }
    });
    this.watcher.on("add", (file) => void this.handleFileEvent("changed", file));
    this.watcher.on("change", (file) => void this.handleFileEvent("changed", file));
    this.watcher.on("unlink", (file) => void this.handleFileEvent("removed", file));
  }

  async close(): Promise<void> {
    await this.watcher?.close();
  }

  subscribe(listener: (event: { type: string; path: string }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(kind?: EntityKind): VaultEntity[] {
    return [...this.entities.values()]
      .filter((entity) => !kind || entity.kind === kind)
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  get(id: string): VaultEntity | undefined {
    return this.entities.get(id);
  }

  async bootstrap(): Promise<BootstrapPayload> {
    const today = todayIso();
    const entities = this.list().filter((entity) => entity.kind !== "workflow_version" && entity.kind !== "workflow_run");
    const archived = await this.listArchivedEntities();
    return {
      today,
      entities,
      archivedTasks: archived.filter((entity) => entity.kind === "task"),
      archivedProjects: archived.filter((entity) => entity.kind === "project"),
      metrics: dashboardMetrics(entities, today),
      vaultName: path.basename(this.vaultPath)
    };
  }

  /** 扫描 `90-Archive/<kind>/` 下的全部归档实体，kind 由目录名推断（任务、项目等）。 */
  private async listArchivedEntities(): Promise<VaultEntity[]> {
    const archiveRoot = path.join(this.vaultPath, "90-Archive");
    try { await stat(archiveRoot); } catch { return []; }
    const output: VaultEntity[] = [];
    const folders = await readdir(archiveRoot, { withFileTypes: true });
    for (const folder of folders) {
      if (!folder.isDirectory() || !ENTITY_KINDS.includes(folder.name as EntityKind)) continue;
      await this.collectArchivedFiles(path.join(archiveRoot, folder.name), folder.name as EntityKind, output);
    }
    return output.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  /** 递归收集归档目录下的 .md（归档任务按领域分子文件夹）。 */
  private async collectArchivedFiles(directory: string, kind: EntityKind, output: VaultEntity[]): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.collectArchivedFiles(absolute, kind, output);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const raw = await readFile(absolute, "utf8");
        const parsed = parseMarkdown(raw);
        const relative = path.relative(this.vaultPath, absolute).split(path.sep).join("/");
        const id = typeof parsed.properties.id === "string" ? parsed.properties.id : `path-${createHash("sha1").update(relative).digest("hex").slice(0, 16)}`;
        const info = await stat(absolute);
        output.push({ id, path: relative, name: path.basename(entry.name, ".md"), kind, revision: this.revision(raw), body: parsed.body, properties: parsed.properties, modifiedAt: info.mtime.toISOString() });
      }
    }
  }

  /** 日常记录串行保存，首次创建也检查冲突；只更新所属字段。 */
  saveDailyRoutine(date: string, record: RoutineRecord, expectedRevision: string | null): Promise<VaultEntity> {
    const write = this.routineWrites.catch(() => undefined).then(async () => {
      routineDateSchema.parse(date);
      const routine = routineSchema.parse(record);
      const folder = path.join(this.vaultPath, ROUTES.daily);
      await mkdir(folder, { recursive: true });
      for (const file of await this.walk(folder)) await this.loadFile(file);
      const daily = dailyFor(this.list("daily"), date);
      if (daily) {
        if (daily.revision !== expectedRevision) throw new RevisionConflictError(daily);
        const previous = daily.properties.daily_routine as Record<string, unknown> | undefined;
        return this.update(daily.id, {
          expectedRevision: daily.revision,
          properties: { daily_routine: { ...previous, ...routine, checks: { ...(previous?.checks as Record<string, unknown> ?? {}), ...routine.checks } } },
          actor: "ui"
        });
      }
      if (expectedRevision !== null) throw new Error("每日笔记已移动或删除，请重新载入后保存");
      return this.create("daily", { name: date, properties: { date, daily_routine: routine }, body: `# ${date}\n` });
    });
    this.routineWrites = write;
    return write;
  }

  async create(kind: EntityKind, input: EntityCreateInput): Promise<VaultEntity> {
    const now = todayIso();
    const id = randomUUID();
    // review 按类型分目录：周复盘 → 70-Reviews/71-周复盘，项目复盘 → 70-Reviews/72-项目复盘
    let route = ROUTES[kind];
    if (kind === "workflow_run") route = path.join(ROUTES[kind], now.slice(0, 7));
    else if (kind === "review") route = asString(input.properties?.review_type) === "project" ? "70-Reviews/72-项目复盘" : "70-Reviews/71-周复盘";
    const folder = path.join(this.vaultPath, route);
    await mkdir(folder, { recursive: true });
    const baseName = this.sanitizeName(input.name) || `${kind}-${id.slice(0, 8)}`;
    const filePath = await this.uniqueFilePath(folder, baseName);
    const properties: EntityProperties = {
      id,
      kind,
      status: DEFAULT_STATUS[kind],
      tags: [],
      created: now,
      updated: now,
      ...input.properties
    };
    await this.atomicWrite(filePath, createMarkdown(properties, input.body ?? ""));
    const entity = await this.loadFile(filePath);
    if (!entity) throw new Error("创建文件后无法重新读取");
    this.emit("changed", entity.path);
    return entity;
  }

  async update(id: string, input: EntityPatchInput): Promise<VaultEntity> {
    const current = this.entities.get(id);
    if (!current) throw new Error("未找到要更新的项目");
    const absolutePath = path.join(this.vaultPath, current.path);
    const raw = await readFile(absolutePath, "utf8");
    const revision = this.revision(raw);
    if (revision !== input.expectedRevision && !input.merge) {
      const latest = await this.loadFile(absolutePath);
      if (!latest) throw new Error("文件已被移动或删除");
      throw new RevisionConflictError(latest);
    }
    const original = parseMarkdown(raw);
    const nextName = input.name === undefined ? current.name : this.sanitizeName(input.name);
    if (!nextName) throw new Error("名称不能为空");
    const nextPath = path.join(path.dirname(absolutePath), `${nextName}.md`);
    if (nextPath !== absolutePath) {
      try {
        await stat(nextPath);
        throw new Error("同名项目已存在");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const mergedProperties = input.merge
      ? { ...original.properties, ...(input.properties ?? {}) }
      : { ...(input.properties ?? {}) };
    // 显式删除的字段保留 undefined 语义
    if (input.properties) {
      for (const [key, value] of Object.entries(input.properties)) {
        if (value === undefined) delete mergedProperties[key];
      }
    }
    const stableId = typeof original.properties.id === "string"
      ? original.properties.id
      : typeof mergedProperties.id === "string" ? mergedProperties.id : randomUUID();
    const changes: EntityProperties = {
      id: stableId,
      kind: current.kind,
      updated: todayIso(),
      ...mergedProperties
    };
    this.applyStatusTransition(current.kind, original.properties, changes, input);
    const nextBody = input.body === undefined && input.merge ? original.body : input.body;
    await this.atomicWrite(absolutePath, rewriteMarkdown(raw, changes, nextBody));
    if (nextPath !== absolutePath) await rename(absolutePath, nextPath);
    if (current.kind === "project" && nextName !== current.name) await this.relinkProjectTasks(current.name, nextName);
    const entity = await this.loadFile(nextPath);
    if (!entity) throw new Error("保存后无法重新读取文件");
    if (stableId !== id) this.entities.delete(id);
    if (nextPath !== absolutePath) this.emit("removed", current.path);
    this.emit("changed", entity.path);
    return entity;
  }

  /**
   * 校验状态流转并追加审计历史。
   *
   * - 只对配置了状态机的实体类型生效（当前：task / project）。
   * - `changes` 会被就地补上 `status_history`，随后与其它字段一起原子写回。
   * - 遗留状态值不拦截，只记账；真正非法的流转直接抛 StatusTransitionError。
   */
  private applyStatusTransition(
    kind: EntityKind,
    previousProperties: EntityProperties,
    changes: EntityProperties,
    options: { allowStatusOverride?: boolean; actor?: string; statusNote?: string } = {}
  ): void {
    if (!statusMachineFor(kind)) return;
    if (!("status" in changes)) return;
    const nextRaw = asString(changes.status as PropertyValue);
    if (!nextRaw) return;
    const previousRaw = asString(previousProperties.status as PropertyValue);
    if (canonicalStatus(kind, previousRaw) === canonicalStatus(kind, nextRaw) && previousRaw === nextRaw) return;

    const check = checkStatusTransition(kind, previousRaw, nextRaw);
    if (check.from === check.to) return;
    if (!check.ok && !options.allowStatusOverride) {
      throw new StatusTransitionError(kind, check.from, check.to, check.allowed, check.reason ?? "不允许的状态流转");
    }
    changes.status_history = appendStatusHistory(previousProperties.status_history, {
      from: previousRaw,
      to: nextRaw,
      at: new Date().toISOString(),
      by: options.actor ?? "app",
      note: options.statusNote ?? (check.ok ? undefined : "override")
    }) as EntityProperties["status_history"];
  }

  private async relinkProjectTasks(oldName: string, newName: string): Promise<void> {
    const activeTasks = this.list("task");
    for (const task of activeTasks) {
      if (this.relationName(task.properties.project) !== oldName) continue;
      await this.rewriteProjectLink(path.join(this.vaultPath, task.path), oldName, newName);
      await this.loadFile(path.join(this.vaultPath, task.path));
      this.emit("changed", task.path);
    }
    const archiveFolder = path.join(this.vaultPath, "90-Archive", "task");
    try { await stat(archiveFolder); } catch { return; }
    const archivedTasks: VaultEntity[] = [];
    await this.collectArchivedFiles(archiveFolder, "task", archivedTasks);
    for (const archived of archivedTasks) {
      if (this.relationName(archived.properties.project) !== oldName) continue;
      await this.rewriteProjectLink(path.join(this.vaultPath, archived.path), oldName, newName);
    }
  }

  private relationName(value: unknown): string {
    const raw = String(value ?? "");
    const match = raw.match(/\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/);
    return (match?.[1] ?? raw).split("/").pop() ?? "";
  }

  /**
   * 归档任务的分类文件夹：按「所属项目 → 项目的领域」决定。
   * 项目可能仍在活动区，也可能已归档；兜底用任务自身的 area；都没有归入「未分类」。
   */
  private async resolveTaskArea(task: VaultEntity): Promise<string> {
    const projectName = this.relationName(task.properties.project);
    if (projectName) {
      const project = [...this.entities.values()].find((entity) => entity.kind === "project" && entity.name === projectName)
        ?? (await this.listArchivedEntities()).find((entity) => entity.kind === "project" && entity.name === projectName);
      const projectArea = project ? this.relationName(project.properties.area) : "";
      if (projectArea) return projectArea;
    }
    const ownArea = this.relationName(task.properties.area);
    return ownArea || "未分类";
  }

  private async rewriteProjectLink(filePath: string, oldName: string, newName: string): Promise<void> {
    const raw = await readFile(filePath, "utf8");
    const parsed = parseMarkdown(raw);
    const current = String(parsed.properties.project ?? "");
    const next = current.replace(`[[${oldName}]]`, `[[${newName}]]`);
    if (next === current) return;
    await this.atomicWrite(filePath, rewriteMarkdown(raw, { ...parsed.properties, project: next, updated: todayIso() }, parsed.body));
  }

  async archive(id: string, expectedRevision: string): Promise<EntityArchiveResult> {
    const current = this.entities.get(id);
    if (!current) throw new Error("未找到要归档的内容");
    const absolutePath = path.join(this.vaultPath, current.path);
    const raw = await readFile(absolutePath, "utf8");
    if (this.revision(raw) !== expectedRevision) {
      const latest = await this.loadFile(absolutePath);
      if (!latest) throw new Error("文件已被移动或删除");
      throw new RevisionConflictError(latest);
    }

    const archiveFolder = path.join(this.vaultPath, "90-Archive", current.kind, current.kind === "task" ? await this.resolveTaskArea(current) : "");
    await mkdir(archiveFolder, { recursive: true });
    const archivedAbsolutePath = await this.uniqueFilePath(archiveFolder, this.sanitizeName(current.name) || `${current.kind}-${id.slice(0, 8)}`);
    await rename(absolutePath, archivedAbsolutePath);
    this.entities.delete(id);
    this.rebuildSearch();
    const archivedPath = path.relative(this.vaultPath, archivedAbsolutePath).split(path.sep).join("/");
    this.emit("removed", current.path);
    return { id, originalPath: current.path, archivedPath };
  }

  async restoreArchivedTask(id: string, expectedRevision: string): Promise<VaultEntity> {
    return this.restoreArchived("task", id, expectedRevision);
  }

  async restoreArchivedProject(id: string, expectedRevision: string): Promise<VaultEntity> {
    return this.restoreArchived("project", id, expectedRevision);
  }

  /** 把 `90-Archive/<kind>/` 下的归档实体恢复到原目录并重置为可用状态。 */
  private async restoreArchived(kind: EntityKind, id: string, expectedRevision: string): Promise<VaultEntity> {
    const current = (await this.listArchivedEntities()).find((entity) => entity.kind === kind && entity.id === id);
    if (!current) throw new Error("未找到要恢复的归档内容");
    const archivedAbsolutePath = path.join(this.vaultPath, current.path);
    const raw = await readFile(archivedAbsolutePath, "utf8");
    if (this.revision(raw) !== expectedRevision) {
      const parsed = parseMarkdown(raw);
      const info = await stat(archivedAbsolutePath);
      throw new RevisionConflictError({
        ...current,
        revision: this.revision(raw),
        body: parsed.body,
        properties: parsed.properties,
        modifiedAt: info.mtime.toISOString()
      });
    }

    const parsed = parseMarkdown(raw);
    const restoreChanges: EntityProperties = {
      ...parsed.properties,
      id: current.id,
      kind,
      status: kind === "task" ? "todo" : "active",
      updated: todayIso()
    };
    this.applyStatusTransition(kind, parsed.properties, restoreChanges, {
      allowStatusOverride: true,
      actor: "restore",
      statusNote: "从归档恢复"
    });
    await this.atomicWrite(archivedAbsolutePath, rewriteMarkdown(raw, restoreChanges, parsed.body));
    const folder = path.join(this.vaultPath, ROUTES[kind]);
    await mkdir(folder, { recursive: true });
    const restoredAbsolutePath = await this.uniqueFilePath(
      folder,
      this.sanitizeName(current.name) || `${kind}-${id.slice(0, 8)}`
    );
    await rename(archivedAbsolutePath, restoredAbsolutePath);
    const restored = await this.loadFile(restoredAbsolutePath);
    if (!restored) throw new Error("恢复后无法重新读取内容");
    this.emit("changed", restored.path);
    return restored;
  }

  async trash(id: string, expectedRevision: string): Promise<EntityTrashResult> {
    const current = this.entities.get(id);
    if (!current) throw new Error("未找到要删除的内容");
    const absolutePath = path.join(this.vaultPath, current.path);
    const raw = await readFile(absolutePath, "utf8");
    if (this.revision(raw) !== expectedRevision) {
      const latest = await this.loadFile(absolutePath);
      if (!latest) throw new Error("文件已被移动或删除");
      throw new RevisionConflictError(latest);
    }

    await mkdir(this.trashPath, { recursive: true });
    const trashedAbsolutePath = await this.uniqueFilePath(
      this.trashPath,
      this.sanitizeName(current.name) || `${current.kind}-${id.slice(0, 8)}`
    );
    await rename(absolutePath, trashedAbsolutePath);
    this.entities.delete(id);
    this.rebuildSearch();
    this.emit("removed", current.path);
    return { id, originalPath: current.path, trashedName: path.basename(trashedAbsolutePath) };
  }

  async checkInHabit(habitId: string, date = todayIso()): Promise<VaultEntity> {
    const habit = this.entities.get(habitId);
    if (!habit || habit.kind !== "habit") throw new Error("未找到习惯");
    let daily = this.list("daily").find((entity) => entity.name === date);
    if (!daily) {
      daily = await this.create("daily", {
        name: date,
        properties: { date, habit_entries: [], metric_entries: [] },
        body: `# ${date}\n\n## 今日记录\n`
      });
    }
    const entries = Array.isArray(daily.properties.habit_entries)
      ? [...daily.properties.habit_entries] as Record<string, unknown>[]
      : [];
    const index = entries.findIndex((entry) => String(entry.habit ?? "").includes(`[[${habit.name}]]`));
    if (index >= 0) entries.splice(index, 1);
    else entries.push({ habit: `[[${habit.name}]]`, value: 1, checked_at: new Date().toISOString() });
    return this.update(daily.id, {
      expectedRevision: daily.revision,
      properties: { habit_entries: entries }
    });
  }

  search(query: string): SearchHit[] {
    const normalized = query.trim();
    if (!normalized) return [];
    const indexed = this.searchIndex.search(normalized, { prefix: true, fuzzy: 0.2, boost: { name: 3, summary: 2 } })
      .map((result) => ({
        id: String(result.id),
        path: String(result.path),
        kind: result.kind as EntityKind,
        name: String(result.name),
        summary: String(result.summary ?? ""),
        score: result.score
      }));
    const seen = new Set(indexed.map((result) => result.id));
    const lowered = normalized.toLocaleLowerCase("zh-CN");
    const substringMatches = this.list().filter((entity) => {
      if (entity.kind === "workflow_version" || entity.kind === "workflow_run") return false;
      if (seen.has(entity.id)) return false;
      const tags = Array.isArray(entity.properties.tags) ? entity.properties.tags.join(" ") : "";
      return `${entity.name}\n${String(entity.properties.summary ?? "")}\n${tags}\n${entity.body}`
        .toLocaleLowerCase("zh-CN")
        .includes(lowered);
    }).map((entity) => ({
      id: entity.id,
      path: entity.path,
      kind: entity.kind,
      name: entity.name,
      summary: String(entity.properties.summary ?? ""),
      score: entity.name.toLocaleLowerCase("zh-CN").includes(lowered) ? 100 : 50
    }));
    return [...indexed, ...substringMatches].sort((a, b) => b.score - a.score).slice(0, 30);
  }

  private async scan(): Promise<void> {
    this.entities.clear();
    const files = await this.walk(this.vaultPath);
    for (const file of files) await this.loadFile(file);
    this.rebuildSearch();
  }

  private async walk(directory: string): Promise<string[]> {
    const output: string[] = [];
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || IGNORED_ROOTS.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) output.push(...await this.walk(absolute));
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) output.push(absolute);
    }
    return output;
  }

  private async loadFile(filePath: string): Promise<VaultEntity | undefined> {
    if (!filePath.toLowerCase().endsWith(".md") || this.isIgnored(filePath)) return undefined;
    const raw = await readFile(filePath, "utf8");
    const parsed = parseMarkdown(raw);
    const relative = path.relative(this.vaultPath, filePath).split(path.sep).join("/");
    const name = path.basename(filePath, path.extname(filePath));
    const propertyKind = String(parsed.properties.kind ?? "document");
    const kind = ENTITY_KINDS.includes(propertyKind as EntityKind) ? propertyKind as EntityKind : "document";
    const id = typeof parsed.properties.id === "string"
      ? parsed.properties.id
      : `path-${createHash("sha1").update(relative).digest("hex").slice(0, 16)}`;
    const info = await stat(filePath);
    const entity: VaultEntity = {
      id,
      path: relative,
      name,
      kind,
      revision: this.revision(raw),
      body: parsed.body,
      properties: parsed.properties,
      modifiedAt: info.mtime.toISOString()
    };
    for (const [existingId, existing] of this.entities) {
      if (existing.path === relative && existingId !== id) this.entities.delete(existingId);
    }
    this.entities.set(id, entity);
    this.rebuildSearch();
    return entity;
  }

  private async handleFileEvent(type: "changed" | "removed", filePath: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith(".md") || this.isIgnored(filePath)) return;
    const relative = path.relative(this.vaultPath, filePath).split(path.sep).join("/");
    if (type === "removed") {
      for (const [id, entity] of this.entities) if (entity.path === relative) this.entities.delete(id);
      this.rebuildSearch();
    } else {
      try {
        await this.loadFile(filePath);
      } catch (error) {
        console.error(`无法重新加载 ${relative}`, error);
      }
    }
    this.emit(type, relative);
  }

  private emit(type: string, relativePath: string): void {
    for (const listener of this.listeners) listener({ type, path: relativePath });
  }

  private isIgnored(candidate: string): boolean {
    const relative = path.relative(this.vaultPath, candidate);
    if (relative.startsWith("..")) return true;
    if (IGNORED_FILES.has(relative)) return true;
    return relative.split(path.sep).some((segment) => segment.startsWith(".") || IGNORED_ROOTS.has(segment));
  }

  private revision(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  private sanitizeName(value: string): string {
    return value.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  }

  private async uniqueFilePath(folder: string, baseName: string): Promise<string> {
    let candidate = path.join(folder, `${baseName}.md`);
    let index = 2;
    while (true) {
      try {
        const handle = await open(candidate, "wx");
        await handle.close();
        await unlink(candidate);
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        candidate = path.join(folder, `${baseName} ${index}.md`);
        index += 1;
      }
    }
  }

  private async atomicWrite(filePath: string, contents: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, contents, "utf8");
      await rename(temporary, filePath);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private newSearchIndex(): MiniSearch {
    return new MiniSearch({
      fields: ["name", "summary", "body", "tags"],
      storeFields: ["path", "kind", "name", "summary"],
      searchOptions: { prefix: true }
    });
  }

  private rebuildSearch(): void {
    this.searchIndex = this.newSearchIndex();
    this.searchIndex.addAll([...this.entities.values()]
      .filter((entity) => entity.kind !== "workflow_version" && entity.kind !== "workflow_run")
      .map((entity) => ({
      id: entity.id,
      path: entity.path,
      kind: entity.kind,
      name: entity.name,
      summary: String(entity.properties.summary ?? ""),
      body: entity.body,
      tags: Array.isArray(entity.properties.tags) ? entity.properties.tags.join(" ") : ""
      })));
  }
}
