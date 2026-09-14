import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { SoloFocusRepository } from "./repository.js";
import { SoloFocusAgentEngine } from "./agent-engine.js";

export const soloFocusRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const repo = new SoloFocusRepository();
  const agent = new SoloFocusAgentEngine(repo);

  // Gracefully handle empty body with application/json header across all requests
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (!body || (typeof body === "string" && !body.trim())) {
      done(null, {});
      return;
    }
    try {
      const parsed = JSON.parse(body as string);
      done(null, parsed);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // 1. Bootstrap
  fastify.get("/api/solofocus/bootstrap", async (_req, reply) => {
    try {
      const data = repo.getBootstrap();
      return reply.send(data);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 2. Tasks
  fastify.post("/api/solofocus/tasks", async (req, reply) => {
    try {
      const body = req.body as any;
      const task = repo.createTask(body);
      return reply.status(201).send(task);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.patch("/api/solofocus/tasks/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      repo.updateTask(id, body);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/tasks/:id/toggle", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const res = repo.toggleTask(id);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/tasks/:id/schedule-today", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.scheduleTaskToToday(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/tasks/:id/apply-sop", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { sopId } = req.body as { sopId: string };
      repo.applySopToTask(id, sopId);
      return reply.send({ success: true, id, sopId });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/tasks/:id/archive", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.archiveTask(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete("/api/solofocus/tasks/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.deleteTask(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 3. Projects
  fastify.post("/api/solofocus/projects", async (req, reply) => {
    try {
      const body = req.body as any;
      const proj = repo.createProject(body);
      return reply.status(201).send(proj);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.patch("/api/solofocus/projects/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      repo.updateProject(id, body);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/projects/:id/distill-notes", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const notes = agent.distillProjectNotes(id);
      repo.updateProject(id, { agentNotes: notes });
      return reply.send({ success: true, id, notes });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete("/api/solofocus/projects/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.deleteProject(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/projects/:id/archive", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.archiveProject(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 4. Domains
  fastify.post("/api/solofocus/domains", async (req, reply) => {
    try {
      const body = req.body as any;
      const domain = repo.createDomain(body);
      return reply.status(201).send(domain);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.patch("/api/solofocus/domains/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      repo.updateDomain(id, body);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 5. Habits
  fastify.post("/api/solofocus/habits", async (req, reply) => {
    try {
      const body = req.body as any;
      const habit = repo.createHabit(body);
      return reply.status(201).send(habit);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/habits/:id/punch", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = (req.body as any) || {};
      const punchDate = body.punchDate || body.date;
      const res = repo.punchHabit(id, punchDate);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/habits/:id/toggle-active", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const isActive = repo.toggleHabitActive(id);
      return reply.send({ success: true, id, isActive });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete("/api/solofocus/habits/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.deleteHabit(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 6. SOPs
  fastify.post("/api/solofocus/sops", async (req, reply) => {
    try {
      const body = req.body as any;
      if (!body?.title?.trim()) {
        return reply.status(400).send({ error: "SOP 标题不能为空" });
      }
      const sop = repo.createSop(body);
      return reply.send({ success: true, sop });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.put("/api/solofocus/sops/:id/steps", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { steps } = req.body as { steps: any[] };
      repo.updateSopSteps(id, steps);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete("/api/solofocus/sops/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.deleteSop(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 7. Backup & Restore
  fastify.post("/api/solofocus/backup/restore", async (req, reply) => {
    try {
      const { targetSnapshotName, confirmInputName } = req.body as { targetSnapshotName: string; confirmInputName: string };
      const res = repo.verifyAndRestore(targetSnapshotName, confirmInputName);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/backup/snapshot", async (_req, reply) => {
    try {
      const snapshot = repo.createSnapshot();
      return reply.status(201).send(snapshot);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 7.1 Trash Management
  fastify.post("/api/solofocus/trash/:id/restore", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const res = repo.restoreTrashItem(id);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete("/api/solofocus/trash/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      repo.purgeTrashItem(id);
      return reply.send({ success: true, id });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/trash/clear", async (_req, reply) => {
    try {
      repo.clearAllTrash();
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 8. AI Agent Capabilities
  fastify.get("/api/solofocus/agent/daily-briefing", async (_req, reply) => {
    try {
      const briefing = await agent.generateDailyBriefing();
      return reply.send(briefing);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/agent/apply-daily-plan", async (req, reply) => {
    try {
      const body = req.body as any;
      const res = agent.applyDailyPlan(body);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/agent/recommend-sops", async (req, reply) => {
    try {
      const { projectName, domainId } = (req.body as any) || {};
      const recommendations = agent.recommendSopsForProject(projectName, domainId);
      return reply.send(recommendations);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/agent/extract-sop", async (req, reply) => {
    try {
      const { projectId } = (req.body as any) || {};
      if (!projectId) {
        return reply.status(400).send({ error: "projectId 必填" });
      }
      const draft = await agent.extractSopFromProject(projectId);
      return reply.send({ success: Boolean(draft), draft });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 9. AI Configuration
  fastify.get("/api/solofocus/ai-config", async (_req, reply) => {
    try {
      const { SoloFocusAiService } = await import("./ai-service.js");
      const service = new SoloFocusAiService();
      const cfg = service.getConfig();
      // Mask key partially if present for safe UI display
      const maskedKey = cfg.apiKey ? `${cfg.apiKey.slice(0, 3)}••••••••${cfg.apiKey.slice(-4)}` : "";
      return reply.send({
        ...cfg,
        apiKey: maskedKey,
        hasRawKey: Boolean(cfg.apiKey)
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/ai-config", async (req, reply) => {
    try {
      const { SoloFocusAiService } = await import("./ai-service.js");
      const service = new SoloFocusAiService();
      const updates = (req.body as any) || {};
      const saved = service.saveConfig(updates);
      return reply.send({ success: true, config: saved });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 10. Email Integration & Sync
  const { SoloFocusEmailService } = await import("./email-service.js");
  const emailService = new SoloFocusEmailService(repo);

  fastify.get("/api/solofocus/email/config", async (_req, reply) => {
    try {
      const cfg = emailService.getMaskedConfig();
      return reply.send(cfg);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/email/config", async (req, reply) => {
    try {
      const updates = (req.body as any) || {};
      const saved = emailService.saveConfig(updates);
      return reply.send({ success: true, config: emailService.getMaskedConfig() });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/email/test-connection", async (_req, reply) => {
    try {
      const res = await emailService.testConnection();
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  fastify.post("/api/solofocus/email/sync", async (_req, reply) => {
    try {
      const res = await emailService.syncAndExtractTasks();
      return reply.send(res);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get("/api/solofocus/email/candidates", async (_req, reply) => {
    try {
      const candidates = emailService.getCachedCandidates();
      return reply.send(candidates);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/email/adopt", async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      const tasks = Array.isArray(body.tasks) ? body.tasks : [];
      if (!tasks.length) {
        return reply.status(400).send({ error: "采纳任务列表不能为空" });
      }
      const res = emailService.adoptTasks(tasks);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post("/api/solofocus/email/dismiss", async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds : [];
      const res = emailService.dismissCandidates(candidateIds);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};


