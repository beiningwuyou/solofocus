import { access, copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parseMarkdown, rewriteMarkdown } from "../src/server/frontmatter.js";
import type { EntityProperties, PropertyValue } from "../src/shared/domain.js";

const vaultPath = path.resolve(process.env.WORKBENCH_VAULT_PATH ?? path.join(os.homedir(), "Library", "Application Support", "个人工作台", "vault"));
const migrationRoot = path.join(vaultPath, "_System", "Migrations");
const markerPath = path.join(migrationRoot, "four-level-actions-v1.json");
const today = new Date().toLocaleDateString("en-CA");
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupRoot = path.join(vaultPath, "_System", "Backups", `four-level-actions-${timestamp}`);

if (await exists(markerPath)) {
  console.log("四层行动模型已经迁移，跳过重复执行。");
  process.exit(0);
}

const sourceRoots = [
  "20-Actions",
  "30-Library",
  "40-Domains/Career/Opportunities",
  "60-Automation/Workflows",
  "70-Reviews",
  "_System/SCHEMA.md",
  "_System/Templates"
];

const backupFiles: string[] = [];
for (const relativeRoot of sourceRoots) {
  const absoluteRoot = path.join(vaultPath, relativeRoot);
  if (!await exists(absoluteRoot)) continue;
  const files = (await isMarkdownFile(absoluteRoot)) ? [absoluteRoot] : await markdownFiles(absoluteRoot);
  for (const file of files) {
    const relative = path.relative(vaultPath, file);
    const destination = path.join(backupRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(file, destination);
    backupFiles.push(relative);
  }
}

const plansDirectory = path.join(vaultPath, "20-Actions", "Plans");
const projectsDirectory = path.join(vaultPath, "20-Actions", "Projects");
const goalsDirectory = path.join(vaultPath, "20-Actions", "Goals");
await mkdir(plansDirectory, { recursive: true });
await mkdir(projectsDirectory, { recursive: true });

const planParents = new Map<string, string>();
let migratedProjects = 0;
let migratedPlans = 0;
let updatedRelations = 0;

for (const file of await directMarkdownFiles(projectsDirectory)) {
  const raw = await readFile(file, "utf8");
  const parsed = parseMarkdown(raw);
  if (parsed.properties.kind !== "project") continue;
  const projectLink = asText(parsed.properties.goal);
  const name = path.basename(file, ".md");
  if (projectLink) planParents.set(name, projectLink);
  const destination = path.join(plansDirectory, path.basename(file));
  await rewriteAndMove(file, destination, {
    kind: "plan",
    project: projectLink || parsed.properties.project,
    goal: undefined,
    tags: replaceTagPrefix(parsed.properties.tags, "project/", "plan/"),
    updated: today
  });
  migratedPlans += 1;
}

for (const file of await directMarkdownFiles(goalsDirectory)) {
  const raw = await readFile(file, "utf8");
  const parsed = parseMarkdown(raw);
  if (parsed.properties.kind !== "goal") continue;
  const destination = path.join(projectsDirectory, path.basename(file));
  await rewriteAndMove(file, destination, {
    kind: "project",
    goal: undefined,
    tags: replaceTagPrefix(parsed.properties.tags, "goal/", "project/"),
    updated: today
  });
  migratedProjects += 1;
}

const relationRoots = [
  "20-Actions/Tasks",
  "20-Actions/Habits",
  "20-Actions/Metrics",
  "30-Library/Documents",
  "30-Library/Resources",
  "40-Domains/Career/Opportunities",
  "60-Automation/Workflows",
  "70-Reviews"
];

for (const relativeRoot of relationRoots) {
  const root = path.join(vaultPath, relativeRoot);
  if (!await exists(root)) continue;
  for (const file of await markdownFiles(root)) {
    const raw = await readFile(file, "utf8");
    const parsed = parseMarkdown(raw);
    const oldGoal = asText(parsed.properties.goal);
    const oldProject = asText(parsed.properties.project);
    if (!oldGoal && !oldProject) continue;
    const planName = linkName(oldProject);
    const inferredProject = planName ? planParents.get(planName) : undefined;
    const nextProject = oldGoal || inferredProject;
    const nextPlan = oldProject;
    const rewritten = rewriteMarkdown(raw, {
      goal: undefined,
      project: nextProject || undefined,
      plan: nextPlan || undefined,
      updated: today
    });
    await writeFile(file, rewritten, "utf8");
    updatedRelations += 1;
  }
}

for (const file of await markdownFiles(path.join(vaultPath, "20-Actions", "KeyResults"))) {
  const raw = await readFile(file, "utf8");
  const parsed = parseMarkdown(raw);
  const oldGoal = asText(parsed.properties.goal);
  if (!oldGoal) continue;
  await writeFile(file, rewriteMarkdown(raw, { goal: undefined, project: oldGoal, updated: today }), "utf8");
  updatedRelations += 1;
}

for (const file of await markdownFiles(path.join(vaultPath, "20-Actions", "Milestones"))) {
  const raw = await readFile(file, "utf8");
  const parsed = parseMarkdown(raw);
  const oldProject = asText(parsed.properties.project);
  if (!oldProject) continue;
  await writeFile(file, rewriteMarkdown(raw, { project: undefined, plan: oldProject, updated: today }), "utf8");
  updatedRelations += 1;
}

await mkdir(migrationRoot, { recursive: true });
await writeFile(markerPath, JSON.stringify({
  migration: "four-level-actions-v1",
  completedAt: new Date().toISOString(),
  backup: path.relative(vaultPath, backupRoot),
  backupFiles: backupFiles.length,
  migratedProjects,
  migratedPlans,
  updatedRelations
}, null, 2), "utf8");

console.log(JSON.stringify({ backupRoot, backupFiles: backupFiles.length, migratedProjects, migratedPlans, updatedRelations }, null, 2));

async function rewriteAndMove(source: string, destination: string, changes: EntityProperties): Promise<void> {
  if (source !== destination && await exists(destination)) throw new Error(`迁移目标已存在：${destination}`);
  const raw = await readFile(source, "utf8");
  const rewritten = rewriteMarkdown(raw, changes);
  const temporary = `${destination}.migrating`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temporary, rewritten, "utf8");
  await rename(temporary, destination);
  if (source !== destination) await unlink(source);
}

async function markdownFiles(root: string): Promise<string[]> {
  if (!await exists(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await markdownFiles(absolute));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) output.push(absolute);
  }
  return output.sort();
}

async function directMarkdownFiles(root: string): Promise<string[]> {
  if (!await exists(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).map((entry) => path.join(root, entry.name)).sort();
}

async function exists(candidate: string): Promise<boolean> {
  return access(candidate).then(() => true).catch(() => false);
}

async function isMarkdownFile(candidate: string): Promise<boolean> {
  return candidate.toLowerCase().endsWith(".md");
}

function asText(value: PropertyValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function linkName(value: string): string {
  const match = value.match(/\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/);
  const resolved = match?.[1] ?? value;
  return resolved.split("/").pop() ?? resolved;
}

function replaceTagPrefix(value: PropertyValue | undefined, from: string, to: string): PropertyValue | undefined {
  if (!Array.isArray(value)) return value;
  return value.map((tag) => typeof tag === "string" && tag.startsWith(from) ? `${to}${tag.slice(from.length)}` : tag);
}
