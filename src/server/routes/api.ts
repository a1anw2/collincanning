/** Public REST API routes. */

import type { FastifyPluginAsync } from 'fastify';
import { DEFAULT_WORKSPACE_ID } from '../../../shared/constants.js';
import * as db from '../db.js';
import { getSimState } from '../orchestrator.js';
import { config } from '../config.js';

function buildWorkspaceView(workspaceId: string) {
  const workspace = db.getWorkspace(workspaceId);
  if (!workspace) return null;
  const sim = getSimState();
  const channel = db.getGeneralChannel(workspaceId);
  const live = sim.workspaceId === workspaceId && sim.running;
  return {
    workspace,
    agents: db.listAgentsByWorkspace(workspaceId),
    round: live ? sim.currentRound : db.getWorkspaceMaxRound(workspaceId),
    running: live,
    silenceStreak: sim.workspaceId === workspaceId ? sim.silenceStreak : 0,
    generalChannelId: channel?.id ?? '',
    showPrivateMessages: config.showPrivateMessages,
  };
}

export const apiRoutes: FastifyPluginAsync = async (app) => {
  app.get('/workspaces/recent', async () => {
    const s = db.getDefaultWorkspaceSummary();
    return [
      {
        id: s.workspace.id,
        name: s.workspace.name,
        messageCount: s.messageCount,
        agentMessageCount: s.agentMessageCount,
        createdAt: s.workspace.createdAt,
      },
    ];
  });

  app.get('/workspace/active', async () => {
    const active = db.getActiveWorkspace();
    return buildWorkspaceView(active.id);
  });

  app.get('/workspace/:id', async (req, reply) => {
    let { id } = req.params as { id: string };
    if (id !== DEFAULT_WORKSPACE_ID) {
      const legacy = db.getWorkspace(id);
      if (!legacy) return reply.status(404).send({ error: 'Workspace not found' });
      id = DEFAULT_WORKSPACE_ID;
    }
    const view = buildWorkspaceView(id);
    if (!view) return reply.status(404).send({ error: 'Workspace not found' });
    return view;
  });

  app.get('/channels/:workspaceId', async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    return db.listChannels(workspaceId);
  });

  app.get('/history/:workspaceId', async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    return db.getPublicHistory(workspaceId);
  });

  app.get('/positions/:workspaceId', async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const agents = db.listAgentsByWorkspace(workspaceId);
    const positions: Record<string, string | null> = {};
    for (const a of agents) {
      const mem = db.getAgentMemory(a.id);
      positions[a.role] = mem?.currentPosition ?? null;
    }
    return positions;
  });

  app.get('/rounds/:workspaceId', async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const sim = getSimState();
    return {
      summaries: db.getRoundSummaries(workspaceId),
      currentRound: sim.workspaceId === workspaceId ? sim.currentRound : 0,
      silenceStreak: sim.workspaceId === workspaceId ? sim.silenceStreak : 0,
    };
  });

  app.get('/reactions/:workspaceId', async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    return db.getReactionsForWorkspace(workspaceId);
  });

  app.get('/artifacts/:workspaceId', async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    return db.listArtifacts(workspaceId);
  });
};
