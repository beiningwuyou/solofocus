import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const runtime = path.join(root, "runtime");

await rm(runtime, { recursive: true, force: true });
await mkdir(runtime, { recursive: true });
await cp(path.join(root, "src/server/solofocus/schema.sql"), path.join(root, "dist-server/server/solofocus/schema.sql")).catch(() => {});
await cp(path.join(root, "dist-server"), path.join(runtime, "dist-server"), {
  recursive: true,
});
await cp(path.join(root, "package.json"), path.join(runtime, "package.json"));
await cp(path.join(root, "pnpm-lock.yaml"), path.join(runtime, "pnpm-lock.yaml"));

const result = spawnSync(
  "pnpm",
  [
    "--dir",
    runtime,
    "install",
    "--prod",
    "--frozen-lockfile",
    "--ignore-workspace",
    "--config.node-linker=hoisted",
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
