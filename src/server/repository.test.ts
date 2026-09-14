import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RevisionConflictError, VaultRepository } from "./repository.js";

const temporaryVaults: string[] = [];

afterEach(async () => {
  for (const directory of temporaryVaults.splice(0)) await rm(directory, { recursive: true, force: true });
});

describe("VaultRepository", () => {
  it("creates, indexes and updates a Markdown entity", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const repository = new VaultRepository(vault);
    await repository.initialize();
    const created = await repository.create("task", {
      name: "验证原子写入",
      properties: { priority: "p1", due: "2026-08-03" },
      body: "# 完成定义\n\n保留正文。\n"
    });
    expect(repository.search("原子")[0]?.id).toBe(created.id);
    const updated = await repository.update(created.id, {
      expectedRevision: created.revision,
      properties: { status: "done" }
    });
    expect(updated.properties.status).toBe("done");
    expect(await readFile(path.join(vault, updated.path), "utf8")).toContain("保留正文");
    await repository.close();
  });

  it("rejects a stale revision after an external Obsidian-style edit", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const repository = new VaultRepository(vault);
    await repository.initialize();
    const created = await repository.create("document", { name: "并发文档", body: "原始正文\n" });
    await appendFile(path.join(vault, created.path), "Obsidian 外部修改\n", "utf8");
    await expect(repository.update(created.id, {
      expectedRevision: created.revision,
      body: "Web 修改\n"
    })).rejects.toBeInstanceOf(RevisionConflictError);
    const raw = await readFile(path.join(vault, created.path), "utf8");
    expect(raw).toContain("Obsidian 外部修改");
    expect(raw).not.toContain("Web 修改");
    await repository.close();
  });

  it("renames an entity while preserving its body and stable id", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const repository = new VaultRepository(vault);
    await repository.initialize();
    const created = await repository.create("project", { name: "旧项目名", body: "项目笔记正文\n" });
    await repository.create("task", { name: "关联任务", properties: { project: "[[旧项目名]]" } });
    const renamed = await repository.update(created.id, {
      expectedRevision: created.revision,
      name: "新项目名"
    });
    expect(renamed.id).toBe(created.id);
    expect(renamed.name).toBe("新项目名");
    expect(renamed.path).toContain("20-Actions/Projects/新项目名.md");
    expect(await readFile(path.join(vault, renamed.path), "utf8")).toContain("项目笔记正文");
    expect((await repository.list("task"))[0]?.properties.project).toBe("[[新项目名]]");
    await repository.close();
  });

  it("keeps workflow versions and run summaries out of ordinary search", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const repository = new VaultRepository(vault);
    await repository.initialize();
    await repository.create("workflow_version", { name: "不可搜索版本", properties: { summary: "隐藏自动化记录" } });
    await repository.create("workflow_run", { name: "不可搜索运行", properties: { summary: "隐藏自动化记录" } });
    const workflow = await repository.create("workflow", { name: "可搜索工作流", properties: { steps: [] } });
    expect(repository.search("隐藏自动化记录")).toHaveLength(0);
    expect(repository.search("可搜索工作流")[0]?.id).toBe(workflow.id);
    expect((await repository.bootstrap()).entities.some((entity) => entity.kind === "workflow_run" || entity.kind === "workflow_version")).toBe(false);
    await repository.close();
  });

  it("archives an entity without deleting its Markdown file", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const repository = new VaultRepository(vault);
    await repository.initialize();
    const created = await repository.create("task", { name: "可恢复任务", body: "保留归档正文\n" });
    const result = await repository.archive(created.id, created.revision);
    expect(result.originalPath).toBe(created.path);
    // 归档任务按领域分类：无归属任务归入「未分类」子文件夹
    expect(result.archivedPath).toContain("90-Archive/task/未分类/可恢复任务.md");
    expect(repository.get(created.id)).toBeUndefined();
    expect(await readFile(path.join(vault, result.archivedPath), "utf8")).toContain("保留归档正文");
    await repository.close();
  });

  it("restores an archived task as todo while preserving its body and id", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const repository = new VaultRepository(vault);
    await repository.initialize();
    const created = await repository.create("task", { name: "恢复执行", properties: { status: "done", custom_field: "保留" }, body: "归档正文\n" });
    await repository.archive(created.id, created.revision);
    const archived = (await repository.bootstrap()).archivedTasks?.find((entity) => entity.id === created.id);
    expect(archived).toBeDefined();
    const restored = await repository.restoreArchivedTask(created.id, archived!.revision);
    expect(restored.id).toBe(created.id);
    expect(restored.properties.status).toBe("todo");
    expect(restored.properties.custom_field).toBe("保留");
    expect(restored.body).toContain("归档正文");
    expect(restored.path).toContain("20-Actions/Tasks/恢复执行.md");
    expect((await repository.bootstrap()).archivedTasks).toHaveLength(0);
    await repository.close();
  });

  it("moves a deleted entity to a recoverable trash folder", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const trash = path.join(vault, ".Trash");
    const repository = new VaultRepository(vault, trash);
    await repository.initialize();
    const created = await repository.create("task", { name: "移入废纸篓", body: "可从废纸篓恢复\n" });
    const result = await repository.trash(created.id, created.revision);
    expect(result.originalPath).toBe(created.path);
    expect(result.trashedName).toBe("移入废纸篓.md");
    expect(repository.get(created.id)).toBeUndefined();
    expect(await readFile(path.join(trash, result.trashedName), "utf8")).toContain("可从废纸篓恢复");
    await repository.close();
  });

  it("does not trash a file after an external revision change", async () => {
    const vault = await mkdtemp(path.join(tmpdir(), "workbench-vault-"));
    temporaryVaults.push(vault);
    const trash = path.join(vault, ".Trash");
    const repository = new VaultRepository(vault, trash);
    await repository.initialize();
    const created = await repository.create("document", { name: "保留新修改", body: "原始正文\n" });
    await appendFile(path.join(vault, created.path), "Obsidian 新修改\n", "utf8");
    await expect(repository.trash(created.id, created.revision)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await readFile(path.join(vault, created.path), "utf8")).toContain("Obsidian 新修改");
    await repository.close();
  });
});
