/** Admin API routes with basic auth. */

import type { FastifyPluginAsync } from 'fastify';
import * as db from '../db.js';
import * as orchestrator from '../orchestrator.js';
import { getSimState, isSimRunning } from '../orchestrator.js';
export const adminRoutes: FastifyPluginAsync = async (app) => {
  const auth = { onRequest: [app.basicAuth] };

  app.get('/personas', auth, async () => db.listPersonas());

  app.get('/personas/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const persona = db.getPersona(id);
    if (!persona) return reply.status(404).send({ error: 'Not found' });
    return persona;
  });

  app.post('/personas', auth, async (req) => {
    const body = req.body as {
      role: string;
      displayName: string;
      title?: string | null;
      photoFilename?: string | null;
      model: string;
      persona: string;
      baseDelayMin?: number;
      baseDelayMax?: number;
    };
    return db.createPersona({
      role: body.role,
      displayName: body.displayName,
      title: body.title ?? null,
      photoFilename: body.photoFilename ?? null,
      model: body.model,
      persona: body.persona,
      baseDelayMin: body.baseDelayMin ?? 8000,
      baseDelayMax: body.baseDelayMax ?? 30000,
    });
  });

  app.put('/personas/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<{
      displayName: string;
      title: string | null;
      photoFilename: string | null;
      model: string;
      persona: string;
      baseDelayMin: number;
      baseDelayMax: number;
    }>;
    const updated = db.updatePersona(id, body);
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return updated;
  });

  app.delete('/personas/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (isSimRunning() && db.personaHasActiveAgent(id)) {
      return reply.status(400).send({ error: 'Persona is in active simulation' });
    }
    db.deletePersona(id);
    return { ok: true };
  });

  app.get('/workspaces', auth, async () => {
    const s = db.getDefaultWorkspaceSummary();
    return {
      id: s.workspace.id,
      name: s.workspace.name,
      companyContext: s.workspace.companyContext,
      createdAt: s.workspace.createdAt,
      messageCount: s.messageCount,
      agentMessageCount: s.agentMessageCount,
    };
  });

  app.get('/sim/status', auth, async () => {
    const sim = getSimState();
    const active = db.getActiveWorkspace();
    return {
      running: sim.running,
      workspaceId: sim.workspaceId ?? active.id,
      round: sim.running ? sim.currentRound : db.getWorkspaceMaxRound(active.id),
      silenceStreak: sim.silenceStreak,
      workspace: active,
      staleActiveWorkspace: false,
      canStart: !sim.running,
      agentCount: db.listAgentsByWorkspace(active.id).filter((a) => a.status !== 'left').length,
    };
  });

  app.post('/sim/clear', auth, async () => {
    const wsId = orchestrator.forceEndActiveWorkspace();
    return { ok: true, workspaceId: wsId };
  });

  app.post('/sim/memory/clear', auth, async () => {
    orchestrator.clearAllMemory();
    return { ok: true };
  });

  app.post('/sim/thread/end', auth, async () => {
    const result = orchestrator.endThread();
    return { ok: true, ...result };
  });

  app.patch('/sim/company-context', auth, async (req) => {
    const { companyContext } = req.body as { companyContext?: string };
    const active = db.getActiveWorkspace();
    db.updateWorkspaceCompanyContext(active.id, companyContext ?? null);
    return { ok: true };
  });

  app.post('/sim/start', auth, async (req, reply) => {
    const body = req.body as {
      personaIds: string[];
      initialUrl?: string | null;
      workspaceName?: string;
      companyContext?: string | null;
    };
    if (!body.personaIds?.length) {
      return reply.status(400).send({ error: 'personaIds required' });
    }
    try {
      const result = await orchestrator.startSim({
        personaIds: body.personaIds,
        initialUrl: body.initialUrl?.trim() || null,
        workspaceName: body.workspaceName ?? 'Collins Canning Co.',
        companyContext: body.companyContext?.trim() || null,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }
  });

  app.post('/sim/stop', auth, async () => {
    orchestrator.stopSim();
    return { ok: true };
  });

  app.post('/sim/inject/url', auth, async (req, reply) => {
    const { url } = req.body as { url: string };
    if (!url) return reply.status(400).send({ error: 'url required' });
    try {
      orchestrator.injectUrl(url);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }
  });

  app.post('/sim/inject/topic', auth, async (req, reply) => {
    const { content, targetRole } = req.body as { content: string; targetRole?: string };
    if (!content) return reply.status(400).send({ error: 'content required' });
    try {
      orchestrator.injectTopic(content, targetRole);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }
  });

  app.post('/sim/agents/add', auth, async (req, reply) => {
    const { personaId } = req.body as { personaId: string };
    try {
      await orchestrator.addAgentToSim(personaId);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }
  });

  app.post('/sim/agents/remove', auth, async (req, reply) => {
    const { role } = req.body as { role: string };
    try {
      orchestrator.removeAgentFromSim(role);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }
  });

  app.post('/sim/agents/away', auth, async (req, reply) => {
    const { role } = req.body as { role: string };
    try {
      orchestrator.setAgentAway(role);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }
  });

  app.get('/usage', auth, async (req) => {
    const workspaceId = (req.query as { workspaceId?: string }).workspaceId;
    const limit = Number((req.query as { limit?: string }).limit ?? 500);
    return {
      summary: db.getAiUsageSummary(workspaceId),
      calls: db.listAiCalls(limit, workspaceId),
    };
  });

  app.post('/sim/agents/back', auth, async (req, reply) => {
    const { role } = req.body as { role: string };
    try {
      orchestrator.setAgentBack(role);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }
  });
};
