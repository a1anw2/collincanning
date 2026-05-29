/** Simulation orchestrator — round loop and lifecycle. */

import { broker } from './broker.js';
import { config } from './config.js';
import * as db from './db.js';
import { getOrCreateDefaultWorkspace } from './defaultWorkspace.js';
import * as channel from './channel.js';
import { Agent } from './agents/base.js';
import * as registry from './registry.js';
import * as delay from './delay.js';
import { summarizeEpisodicForAgent, buildPublicTranscript } from './memory.js';
import { fetchArticle } from './tools/fetchArticle.js';
import type { ActionType, SimEndEvent } from '../../shared/types.js';
import type { ParsedAgentResponse } from './lib/agentResponse.js';
import { formatMemeMessage, isAllowedMemeImageUrl } from './lib/memePost.js';
import { log, logError } from './logger.js';

interface SimState {
  running: boolean;
  workspaceId: string | null;
  currentRound: number;
  silenceStreak: number;
}

const state: SimState = {
  running: false,
  workspaceId: null,
  currentRound: 0,
  silenceStreak: 0,
};

export function getSimState(): SimState {
  return { ...state };
}

export function isSimRunning(): boolean {
  return state.running;
}

/** @deprecated Single company workspace is always open; no stale workspace state. */
export function hasStaleActiveWorkspace(): boolean {
  return false;
}

/** Stop sim loop only (does not close the company workspace). */
export function forceEndActiveWorkspace(): string | null {
  const wsId = state.workspaceId ?? db.getActiveWorkspace().id;
  if (state.running) {
    endSim('silence', true);
    return wsId;
  }
  state.workspaceId = db.getActiveWorkspace().id;
  state.currentRound = db.getWorkspaceMaxRound(state.workspaceId);
  state.silenceStreak = 0;
  return wsId;
}

/** Align in-memory state with the company workspace after boot. */
export function reconcileSimState(): void {
  const ws = db.getActiveWorkspace();
  state.workspaceId = ws.id;
  if (!state.running) {
    state.currentRound = Math.max(1, db.getWorkspaceMaxRound(ws.id));
  }
  log.sim.debug(
    { workspaceId: ws.id, round: state.currentRound, running: state.running },
    'Sim state reconciled',
  );
}

function interestScoreForAction(action: ActionType): number {
  switch (action) {
    case 'speak':
      return 1.0;
    case 'meme':
      return 0.95;
    case 'private':
      return 0.8;
    case 'react':
      return 0.6;
    case 'pass':
      return 0.2;
    case 'leave':
      return 0;
    default:
      return 0.5;
  }
}

async function fetchArtifactAsync(artifactId: string, url: string): Promise<void> {
  const content = await fetchArticle(url);
  db.updateArtifactFetchedContent(artifactId, content);
}

function isAwaitingModeratorInput(workspaceId: string): boolean {
  if (db.listArtifacts(workspaceId).length > 0) return false;
  return !db.getPublicHistory(workspaceId).some((m) => m.type === 'message');
}

export async function startSim(params: {
  personaIds: string[];
  initialUrl?: string | null;
  workspaceName: string;
  companyContext?: string | null;
}): Promise<{ workspaceId: string }> {
  if (state.running) throw new Error('Simulation already running');

  const workspace = getOrCreateDefaultWorkspace(
    params.workspaceName,
    params.companyContext,
  );
  db.createGeneralChannel(workspace.id);
  state.workspaceId = workspace.id;
  const nextRound = Math.max(1, db.getWorkspaceMaxRound(workspace.id) + 1);
  state.currentRound = nextRound;
  state.silenceStreak = 0;
  state.running = true;

  for (const personaId of params.personaIds) {
    const { agent, joined } = db.ensureAgentForPersona(workspace.id, personaId, nextRound);
    if (joined) {
      const persona = db.getPersona(personaId);
      channel.postSystem(workspace.id, `${agent.role} has joined the channel`, nextRound);
      broker.publish('agent:join', {
        id: agent.id,
        role: agent.role,
        displayName: persona?.displayName ?? agent.role,
        round: nextRound,
      });
    }
  }

  const initialUrl = params.initialUrl?.trim();
  if (initialUrl) {
    const artifact = db.insertArtifact(workspace.id, 'url', initialUrl, nextRound, 'moderator');
    channel.postSystem(workspace.id, `New article shared: ${initialUrl}`, nextRound, 'injection');
    channel.publishArtifact(artifact);
    void fetchArtifactAsync(artifact.id, initialUrl);
  } else if (isAwaitingModeratorInput(workspace.id)) {
    channel.postSystem(
      workspace.id,
      'Simulation started. Waiting for moderator to share a URL or talking point.',
      nextRound,
    );
  }

  void runLoop();
  log.sim.info(
    {
      workspaceId: workspace.id,
      round: nextRound,
      personas: params.personaIds.length,
      hasInitialUrl: Boolean(initialUrl),
    },
    'Simulation started',
  );
  return { workspaceId: workspace.id };
}

export function stopSim(): void {
  if (state.running) {
    endSim('silence', true);
    return;
  }
  forceEndActiveWorkspace();
}

function endSim(reason: SimEndEvent['reason'], forced = false): void {
  const workspaceId = state.workspaceId ?? db.getActiveWorkspace().id;
  state.running = false;
  broker.publish('sim:end', {
    round: state.currentRound,
    reason: forced ? 'silence' : reason,
  });
  state.workspaceId = workspaceId;
  state.silenceStreak = 0;
  log.sim.info(
    { workspaceId, round: state.currentRound, reason: forced ? 'silence' : reason, forced },
    'Simulation ended',
  );
}

async function runLoop(): Promise<void> {
  while (state.running && state.workspaceId) {
    try {
      await runRound();
    } catch (err) {
      logError(log.sim, 'Round error', err, { round: state.currentRound });
    }
    if (!state.running) break;
    await new Promise((r) => setTimeout(r, 2000));
    state.currentRound += 1;
  }
}

async function runRound(): Promise<void> {
  const workspaceId = state.workspaceId;
  if (!workspaceId) return;

  const round = state.currentRound;
  broker.publish('round:start', { round });

  if (isAwaitingModeratorInput(workspaceId)) {
    broker.publish('round:end', { round });
    return;
  }

  const agents = db
    .listAgentsByWorkspace(workspaceId)
    .filter((a) => a.status === 'active');

  const prevScores = db.getPreviousRoundInterestScores(workspaceId, round);
  const sorted = [...agents].sort((a, b) => {
    const sa = prevScores.get(a.id) ?? 1;
    const sb = prevScores.get(b.id) ?? 1;
    if (sb !== sa) return sb - sa;
    return Math.random() - 0.5;
  });

  let allPass = true;

  log.sim.debug({ round, agents: sorted.length }, 'Round started');

  for (const agentRecord of sorted) {
    if (!state.running) break;

    const persona = db.getPersona(agentRecord.personaId);
    broker.publish('agent:thinking', {
      role: agentRecord.role,
      displayName: persona?.displayName ?? agentRecord.role,
    });

    await delay.waitForAgent(agentRecord);

    const agent = new Agent(agentRecord);
    let result: Awaited<ReturnType<Agent['think']>>;
    try {
      result = await agent.think(workspaceId, round);
    } catch (err) {
      logError(log.agent, 'Agent think failed', err, { role: agentRecord.role, round });
      result = {
        response: { action: 'pass', done: false },
        thinkingTime: 0,
        toolsUsed: [],
      };
    }

    await applyAction(
      workspaceId,
      agentRecord.id,
      agentRecord.role,
      round,
      result.response,
      persona?.displayName ?? agentRecord.role,
    );

    if (result.response.action !== 'pass') {
      allPass = false;
      log.agent.debug(
        {
          role: agentRecord.role,
          action: result.response.action,
          round,
          thinkingMs: result.thinkingTime,
        },
        'Agent action',
      );
    }

    db.upsertAgentRound(
      agentRecord.id,
      workspaceId,
      round,
      result.response.action,
      result.response.done,
      interestScoreForAction(result.response.action),
      result.toolsUsed.length > 0 ? result.toolsUsed : null,
      result.thinkingTime,
    );

    if (result.response.currentPosition) {
      const mem = db.getAgentMemory(agentRecord.id);
      const notes = result.response.internalNotes
        ? [mem?.privateNotes, result.response.internalNotes].filter(Boolean).join('\n')
        : (mem?.privateNotes ?? null);
      db.upsertAgentMemory(agentRecord.id, {
        currentPosition: result.response.currentPosition,
        privateNotes: notes,
      });
      broker.publish('position:update', {
        role: agentRecord.role,
        displayName: persona?.displayName ?? agentRecord.role,
        position: result.response.currentPosition,
      });
    } else if (result.response.internalNotes) {
      const mem = db.getAgentMemory(agentRecord.id);
      db.upsertAgentMemory(agentRecord.id, {
        privateNotes: [mem?.privateNotes, result.response.internalNotes].filter(Boolean).join('\n'),
      });
    }
  }

  if (round % config.summarizeEveryNRounds === 0) {
    const transcript = buildPublicTranscript(workspaceId);
    for (const a of agents) {
      void summarizeEpisodicForAgent(a, transcript);
    }
  }

  broker.publish('round:end', { round });

  if (checkConsensus(workspaceId, round, agents)) {
    endSim('consensus');
    return;
  }

  if (allPass) {
    state.silenceStreak += 1;
  } else {
    state.silenceStreak = 0;
  }

  if (state.silenceStreak >= config.silenceRoundsBeforeEnd) {
    endSim('silence');
  }
}

function checkConsensus(
  workspaceId: string,
  round: number,
  activeAgents: Array<{ id: string }>,
): boolean {
  if (activeAgents.length === 0) return true;
  for (const a of activeAgents) {
    const rec = db.getAgentRound(a.id, round);
    if (!rec?.done) return false;
  }
  return true;
}

async function applyAction(
  workspaceId: string,
  agentId: string,
  role: string,
  round: number,
  response: ParsedAgentResponse,
  displayName: string,
): Promise<void> {
  switch (response.action) {
    case 'speak':
      if (response.content) channel.postPublic(workspaceId, agentId, response.content, round);
      break;
    case 'meme': {
      const memeUrl = response.memeUrl?.trim();
      if (!memeUrl || !isAllowedMemeImageUrl(memeUrl)) break;
      const memeName = response.memeName?.trim() || 'Meme';
      channel.postPublic(
        workspaceId,
        agentId,
        formatMemeMessage(memeName, memeUrl, response.content),
        round,
      );
      break;
    }
    case 'private':
      if (response.content && response.to) {
        channel.postPrivate(workspaceId, agentId, response.to, response.content, round);
      }
      break;
    case 'react':
      if (response.reaction) {
        const rec = db.upsertReaction(
          response.reaction.messageId,
          agentId,
          response.reaction.type,
        );
        broker.publish('reaction:add', {
          messageId: response.reaction.messageId,
          role,
          type: response.reaction.type,
        });
        void rec;
      }
      break;
    case 'leave':
      registry.removeAgent(workspaceId, role, round);
      break;
    case 'pass':
      break;
  }
  void displayName;
}

export function injectUrl(url: string): void {
  if (!state.workspaceId || !state.running) throw new Error('No active simulation');
  const artifact = db.insertArtifact(
    state.workspaceId,
    'url',
    url,
    state.currentRound,
    'moderator',
  );
  channel.postSystem(
    state.workspaceId,
    `New article shared: ${url}`,
    state.currentRound,
    'injection',
  );
  channel.publishArtifact(artifact);
  void fetchArtifactAsync(artifact.id, url);
  db.resetDoneForRound(state.workspaceId, state.currentRound);
  log.sim.info({ url, round: state.currentRound }, 'Moderator injected URL');
}

export function injectTopic(content: string, targetRole?: string): void {
  if (!state.workspaceId || !state.running) throw new Error('No active simulation');
  let targetAgentId: string | null = null;
  if (targetRole) {
    const agent = db.getAgentByRole(state.workspaceId, targetRole);
    targetAgentId = agent?.id ?? null;
  }
  const artifact = db.insertArtifact(
    state.workspaceId,
    'talking_point',
    content,
    state.currentRound,
    'moderator',
    targetAgentId,
  );
  channel.postSystem(
    state.workspaceId,
    `Talking point: ${content}`,
    state.currentRound,
    'injection',
  );
  channel.publishArtifact(artifact);
  db.resetDoneForRound(state.workspaceId, state.currentRound);
  log.sim.info(
    { round: state.currentRound, targetRole: targetRole ?? null },
    'Moderator injected talking point',
  );
}

export async function addAgentToSim(personaId: string): Promise<void> {
  if (!state.workspaceId || !state.running) throw new Error('No active simulation');
  await registry.addAgent(state.workspaceId, personaId, state.currentRound);
}

export function removeAgentFromSim(role: string): void {
  if (!state.workspaceId || !state.running) throw new Error('No active simulation');
  registry.removeAgent(state.workspaceId, role, state.currentRound);
}

export function setAgentAway(role: string): void {
  if (!state.workspaceId) throw new Error('No active simulation');
  registry.setAgentAway(state.workspaceId, role, state.currentRound);
}

export function setAgentBack(role: string): void {
  if (!state.workspaceId) throw new Error('No active simulation');
  registry.setAgentBack(state.workspaceId, role, state.currentRound);
}

function resolveWorkspaceId(workspaceId?: string): string {
  return workspaceId ?? state.workspaceId ?? db.getActiveWorkspace().id;
}

/** Clear agent episodic memory, private notes, positions, and round records (channel history unchanged). */
export function clearAllMemory(workspaceId?: string): void {
  const wsId = resolveWorkspaceId(workspaceId);
  db.clearWorkspaceMemory(wsId);
  registry.clearWorkspaceOnboarding(wsId);
  broker.publish('memory:clear', { workspaceId: wsId });
  log.sim.info({ workspaceId: wsId }, 'Agent memory cleared');
}

/**
 * Stop the current #general thread: end sim if running, wipe channel + artifacts + memory,
 * mark agents as left, post a divider system line for a fresh discussion.
 */
export function endThread(workspaceId?: string): db.EndThreadResult {
  const wsId = resolveWorkspaceId(workspaceId);
  if (state.running) endSim('silence', true);

  const leaving = db
    .listAgentsByWorkspace(wsId)
    .filter((a) => a.status === 'active' || a.status === 'away');

  const result = db.endGeneralThread(wsId);
  registry.clearWorkspaceOnboarding(wsId);

  for (const agent of leaving) {
    broker.publish('agent:leave', { role: agent.role, round: agent.leftRound ?? 0 });
  }

  const round = 1;
  state.workspaceId = wsId;
  state.currentRound = round;
  state.silenceStreak = 0;

  broker.publish('thread:end', { workspaceId: wsId, round });
  channel.postSystem(
    wsId,
    '--- Thread ended. Waiting for moderator to share a URL or talking point for a new discussion. ---',
    round,
  );
  log.sim.info({ workspaceId: wsId, ...result, agentsLeft: leaving.length }, 'Thread ended');
  return result;
}
