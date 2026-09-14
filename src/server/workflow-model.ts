import { z } from "zod";
import { asString, type EntityProperties, type VaultEntity, type WorkflowDefinition } from "../shared/domain.js";

export const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["vault_query", "rule", "approval", "vault_write"]),
  title: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
  next: z.array(z.string()).max(24).optional(),
  ui: z.object({ x: z.number(), y: z.number() }).optional()
});

export const workflowEditSchema = z.object({
  expectedRevision: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]),
  area: z.string().optional(),
  goal: z.string().optional(),
  project: z.string().optional(),
  plan: z.string().optional(),
  summary: z.string().max(1_000).optional(),
  body: z.string().optional(),
  steps: z.array(workflowStepSchema).min(1).max(24)
});

export function workflowFromEntity(entity: VaultEntity): WorkflowDefinition {
  if (entity.kind !== "workflow") throw new Error("实体不是工作流");
  const steps = z.array(workflowStepSchema).parse(entity.properties.steps ?? []);
  const status = z.enum(["draft", "active", "paused", "archived"])
    .catch("draft")
    .parse(entity.properties.status);
  return {
    id: entity.id,
    name: entity.name,
    path: entity.path,
    revision: entity.revision,
    status,
    trigger: "manual",
    version: Math.max(1, Number(entity.properties.version ?? 1)),
    area: asString(entity.properties.area) || undefined,
    goal: asString(entity.properties.goal) || undefined,
    project: asString(entity.properties.project) || undefined,
    plan: asString(entity.properties.plan) || undefined,
    approval: "before_write",
    summary: asString(entity.properties.summary) || undefined,
    body: entity.body,
    steps
  };
}

export function workflowProperties(definition: Omit<WorkflowDefinition, "id" | "path" | "revision" | "name" | "body">): EntityProperties {
  return {
    status: definition.status,
    trigger: "manual",
    version: definition.version,
    area: definition.area || undefined,
    goal: definition.goal || undefined,
    project: definition.project || undefined,
    plan: definition.plan || undefined,
    approval: "before_write",
    summary: definition.summary || undefined,
    steps: definition.steps
  };
}
