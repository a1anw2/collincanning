/** Episodic memory summarization at orchestrator level. */

import { openrouter } from './openrouter.js';
import { summarizePrompt } from './prompts/summarize.js';
import { profileCardName } from '../../shared/profilePhoto.js';
import * as db from './db.js';
import { recordAiCall } from './aiUsage.js';
import type { AgentRecord } from '../../shared/types.js';

export async function summarizeEpisodicForAgent(
  agent: AgentRecord,
  publicTranscript: string,
): Promise<void> {
  if (!publicTranscript.trim()) return;

  const callStart = Date.now();
  const completion = await openrouter.chat.completions.create({
    model: agent.model,
    messages: [
      { role: 'system', content: summarizePrompt },
      {
        role: 'user',
        content: `Your role: ${agent.role}\n\nRecent discussion:\n${publicTranscript}`,
      },
    ],
    max_tokens: 400,
  });
  recordAiCall({
    workspaceId: agent.workspaceId,
    agentId: agent.id,
    role: agent.role,
    callType: 'summarize',
    model: agent.model,
    round: null,
    completion,
    durationMs: Date.now() - callStart,
  });

  const summary = completion.choices[0]?.message?.content?.trim();
  if (summary) {
    db.upsertAgentMemory(agent.id, { episodicSummary: summary });
  }
}

export function buildPublicTranscript(workspaceId: string): string {
  const messages = db.getPublicHistory(workspaceId);
  return messages
    .filter((m) => m.type === 'message' && m.role)
    .map((m) => `${profileCardName(m.role!, m.displayName)}: ${m.content}`)
    .join('\n\n');
}
