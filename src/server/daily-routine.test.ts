import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emptyRoutine, readRoutine } from "../shared/daily-routine.js";
import { RevisionConflictError, VaultRepository } from "./repository.js";

const fixtures: { vault: string; repository: VaultRepository }[] = [];
async function fixture() {
  const vault = await mkdtemp(path.join(tmpdir(), "daily-routine-test-"));
  const repository = new VaultRepository(vault);
  fixtures.push({ vault, repository });
  await repository.initialize();
  return { vault, repository };
}
afterEach(async () => {
  for (const { vault, repository } of fixtures.splice(0)) {
    await repository.close();
    await rm(vault, { recursive: true, force: true });
  }
});

describe("daily routine persistence", () => {
  it("stores separate dates and reloads records after restart", async () => {
    const { vault, repository } = await fixture();
    const record = { ...emptyRoutine(), job: "投递一个匹配岗位", checks: { ...emptyRoutine().checks, job: "done" as const } };
    const first = await repository.saveDailyRoutine("2026-09-07", record, null);
    await repository.saveDailyRoutine("2026-09-08", emptyRoutine(), null);
    await repository.close();
    const reopened = new VaultRepository(vault);
    try {
      await reopened.initialize();
      expect(readRoutine(reopened.get(first.id))).toEqual(record);
      expect(reopened.list("daily")).toHaveLength(2);
    } finally { await reopened.close(); }
  });
  it("preserves body, YAML comments, unknown properties and existing logs", async () => {
    const { vault, repository } = await fixture();
    const daily = await repository.create("daily", { name: "2026-09-07", body: "原文\n![[附件.png]]\n<!-- 保留 -->\n", properties: { date: "2026-09-07", custom: "保留字段", habit_entries: [{ habit: "[[散步]]", value: 1 }], sop_entries: [{ id: "start", done: true }], daily_routine: { custom: "扩展", checks: { custom: "扩展状态" } } } });
    const file = path.join(vault, daily.path);
    const raw = (await readFile(file, "utf8")).replace("custom: 保留字段", "custom: 保留字段 # 保留注释");
    await writeFile(file, raw);
    // Re-read the external revision through the repository conflict path.
    await expect(repository.saveDailyRoutine("2026-09-07", emptyRoutine(), daily.revision)).rejects.toBeInstanceOf(RevisionConflictError);
    const latest = repository.get(daily.id)!;
    const updated = await repository.saveDailyRoutine("2026-09-07", emptyRoutine(), latest.revision);
    expect(updated.body).toBe(daily.body);
    expect(updated.properties.habit_entries).toEqual(daily.properties.habit_entries);
    expect(updated.properties.sop_entries).toEqual(daily.properties.sop_entries);
    expect(updated.properties.custom).toBe("保留字段");
    expect(updated.properties.daily_routine).toMatchObject({ custom: "扩展", checks: { custom: "扩展状态" } });
    expect(await readFile(file, "utf8")).toContain("# 保留注释");
  });
  it("rejects concurrent first saves without creating duplicate daily notes", async () => {
    const { repository } = await fixture();
    const results = await Promise.allSettled([
      repository.saveDailyRoutine("2026-09-07", emptyRoutine(), null),
      repository.saveDailyRoutine("2026-09-07", { ...emptyRoutine(), job: "另一个窗口" }, null)
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(repository.list("daily")).toHaveLength(1);
  });
  it("rejects stale writes after external edits and allows explicit unchecking", async () => {
    const { vault, repository } = await fixture();
    const first = await repository.saveDailyRoutine("2026-09-07", { ...emptyRoutine(), checks: { job: "done", thesis: "minimum", health: "rest" } }, null);
    const second = await repository.saveDailyRoutine("2026-09-07", emptyRoutine(), first.revision);
    expect(readRoutine(second).checks.job).toBe("pending");
    await appendFile(path.join(vault, second.path), "外部新正文\n");
    await expect(repository.saveDailyRoutine("2026-09-07", { ...emptyRoutine(), job: "旧草稿" }, second.revision)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await readFile(path.join(vault, second.path), "utf8")).not.toContain("旧草稿");
    await expect(repository.saveDailyRoutine("2026-02-30", emptyRoutine(), null)).rejects.toThrow();
  });
});
