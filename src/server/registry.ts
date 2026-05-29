/** Dynamic agent join, leave, and status management. */

import { openrouter } from './openrouter.js';
import { broker } from './broker.js';
import * as db from './db.js';
import * as channel from './channel.js';
import { onboardingPrompt } from './prompts/onboarding.js';
import { buildPublicTranscript } from './memory.js';
import { recordAiCall } from './aiUsage.js';

const onboardingCache = new Map<string, string>();

export function getOnboardingSummary(agentId: string): string | undefined {
  return onboardingCache.get(agentId);
}

export function clearOnboarding(agentId: string): void {
  onboardingCache.delete(agentId);
}

export function clearWorkspaceOnboarding(workspaceId: string): void {
  for (const agent of db.listAgentsByWorkspace(workspaceId)) {
    onboardingCache.delete(agent.id);
  }
}

export async function addAgent(
  workspaceId: string,
  personaId: string,
  round: number,
): Promise<ReturnType<typeof db.createAgent>> {
  const agent = db.createAgent(workspaceId, personaId, round);
  const persona = db.getPersona(personaId);

  const transcript = buildPublicTranscript(workspaceId);
  const artifacts = db.listArtifacts(workspaceId);
  const artifactText = artifacts
    .map((a) => `[${a.type}] ${a.content}`)
    .join('\n');

  let summary = 'You are joining an ongoing executive discussion.';
  if (transcript || artifactText) {
    try {
      const callStart = Date.now();
      const completion = await openrouter.chat.completions.create({
        model: agent.model,
        messages: [
          { role: 'system', content: onboardingPrompt },
          {
            role: 'user',
            content: `Artifacts:\n${artifactText}\n\nTranscript:\n${transcript}`,
          },
        ],
        max_tokens: 500,
      });
      recordAiCall({
        workspaceId,
        agentId: agent.id,
        role: agent.role,
        callType: 'onboarding',
        model: agent.model,
        round,
        completion,
        durationMs: Date.now() - callStart,
      });
      summary = completion.choices[0]?.message?.content?.trim() ?? summary;
    } catch {
      summary = `Ongoing discussion about: ${artifacts[0]?.content ?? 'shared topics'}.`;
    }
  }
  onboardingCache.set(agent.id, summary);

  channel.postSystem(workspaceId, `${agent.role} has joined the channel`, round);
  broker.publish('agent:join', {
    id: agent.id,
    role: agent.role,
    displayName: persona?.displayName ?? agent.role,
    round,
  });

  return agent;
}

export function removeAgent(workspaceId: string, role: string, round: number): void {
  const agent = db.getAgentByRole(workspaceId, role);
  if (!agent || agent.status === 'left') return;

  db.updateAgentStatus(agent.id, 'left', round);
  channel.postSystem(workspaceId, `${role} has left the channel`, round);
  broker.publish('agent:leave', { role, round });
}

export function setAgentAway(workspaceId: string, role: string, round: number): void {
  const agent = db.getAgentByRole(workspaceId, role);
  if (!agent) return;
  db.updateAgentStatus(agent.id, 'away');
  channel.postSystem(workspaceId, `${role} stepped away`, round);
}

export function setAgentBack(workspaceId: string, role: string, round: number): void {
  const agent = db.getAgentByRole(workspaceId, role);
  if (!agent) return;
  db.updateAgentStatus(agent.id, 'active');
  channel.postSystem(workspaceId, `${role} is back`, round);
}
