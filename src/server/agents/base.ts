/** Base agent class — OpenRouter think loop with tools. */

import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { openrouter } from '../openrouter.js';
import { broker } from '../broker.js';
import { config } from '../config.js';
import * as db from '../db.js';
import { parseAgentResponse } from '../lib/agentResponse.js';
import { mechanics } from '../prompts/mechanics.js';
import { format } from '../prompts/format.js';
import { toolDefinitions, executeTool } from '../tools/index.js';
import { getOnboardingSummary, clearOnboarding } from '../registry.js';
import { recordAiCall } from '../aiUsage.js';
import { profileCardName } from '../../../shared/profilePhoto.js';
import type { AgentRecord, ArtifactRecord, MessageRecord } from '../../../shared/types.js';
import type { ParsedAgentResponse } from '../lib/agentResponse.js';

export interface ThinkResult {
  response: ParsedAgentResponse;
  thinkingTime: number;
  toolsUsed: string[];
}

export class Agent {
  constructor(public readonly record: AgentRecord) {}

  private buildSystemPrompt(): string {
    const persona = db.getPersona(this.record.personaId);
    if (!persona) throw new Error(`Persona ${this.record.personaId} not found`);
    return [persona.persona, mechanics, format].join('\n\n');
  }

  private buildUserContext(
    workspaceId: string,
    round: number,
    publicMessages: MessageRecord[],
    privateMessages: string,
    artifacts: ArtifactRecord[],
    memory: ReturnType<typeof db.getAgentMemory>,
    onboarding?: string,
  ): string {
    const parts: string[] = [];
    const workspace = db.getWorkspace(workspaceId);
    if (workspace?.companyContext) {
      parts.push(`## Company context\n${workspace.companyContext}`);
    }
    if (onboarding) parts.push(`## Joining mid-conversation\n${onboarding}`);
    if (memory?.episodicSummary) parts.push(`## Your episodic memory\n${memory.episodicSummary}`);
    if (memory?.currentPosition) parts.push(`## Your current position\n${memory.currentPosition}`);
    if (memory?.privateNotes) parts.push(`## Your private notes (only you see this)\n${memory.privateNotes}`);

    if (artifacts.length > 0) {
      parts.push('## Artifacts in play');
      for (const a of artifacts) {
        let line = `- [${a.type}] ${a.content}`;
        if (a.fetchedContent) line += `\n  Content: ${a.fetchedContent.slice(0, 2000)}`;
        if (a.targetAgentId) line += ' (directed)';
        parts.push(line);
      }
    }

    if (privateMessages) parts.push(`## Private messages to you\n${privateMessages}`);

    parts.push(`## Public channel (round ${round})`);
    const roster = db
      .listAgentsByWorkspace(workspaceId)
      .filter((a) => a.status === 'active' || a.status === 'away');
    if (roster.length > 0) {
      parts.push('## Colleagues in channel');
      for (const a of roster) {
        const name = profileCardName(a.role, a.displayName);
        const title = a.title?.trim();
        parts.push(
          title ? `- ${name} (${a.role}, ${title}) — @mention as @${name}` : `- ${name} (${a.role}) — @mention as @${name}`,
        );
      }
    }

    if (publicMessages.length === 0) {
      parts.push('(No messages yet)');
    } else {
      for (const m of publicMessages) {
        if (m.type !== 'message') {
          parts.push(`[${m.type}] ${m.content}`);
        } else {
          const speaker = profileCardName(m.role ?? 'System', m.displayName);
          parts.push(`${speaker}: ${m.content}`);
        }
      }
    }

    parts.push('\nRespond with your JSON action now.');
    return parts.join('\n\n');
  }

  async think(workspaceId: string, round: number): Promise<ThinkResult> {
    const start = Date.now();
    const toolsUsed: string[] = [];

    const onboarding = getOnboardingSummary(this.record.id);
    if (onboarding) clearOnboarding(this.record.id);

    const publicMessages = db.getRecentPublicMessages(
      workspaceId,
      config.workingMemoryMessages,
    );
    const artifacts = db.listArtifacts(workspaceId);
    const memory = db.getAgentMemory(this.record.id);

    const privates = db.getPrivateMessagesForAgent(this.record.id);
    const privateText = privates
      .map((p) => `${profileCardName(p.fromRole, p.fromDisplayName)}: ${p.content}`)
      .join('\n');

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      {
        role: 'user',
        content: this.buildUserContext(
          workspaceId,
          round,
          publicMessages,
          privateText,
          artifacts,
          memory,
          onboarding,
        ),
      },
    ];

    let toolCallsRemaining = config.maxToolCallsPerTurn;

    for (let attempt = 0; attempt < 2; attempt++) {
      const callStart = Date.now();
      const completion = await openrouter.chat.completions.create({
        model: this.record.model,
        messages,
        tools: toolDefinitions as ChatCompletionTool[],
        tool_choice: toolCallsRemaining > 0 ? 'auto' : 'none',
        max_tokens: 1500,
      });
      recordAiCall({
        workspaceId,
        agentId: this.record.id,
        role: this.record.role,
        callType: 'agent_think',
        model: this.record.model,
        round,
        completion,
        durationMs: Date.now() - callStart,
      });

      const choice = completion.choices[0]?.message;
      if (!choice) throw new Error('Empty completion');

      if (choice.tool_calls && choice.tool_calls.length > 0 && toolCallsRemaining > 0) {
        messages.push(choice);
        for (const tc of choice.tool_calls) {
          if (toolCallsRemaining <= 0) break;
          const fn = tc.function;
          const args = JSON.parse(fn.arguments || '{}') as Record<string, string>;
          toolsUsed.push(fn.name);
          toolCallsRemaining -= 1;

          broker.publish('agent:tool', {
            role: this.record.role,
            toolName: fn.name,
            input: JSON.stringify(args),
          });

          const result = await executeTool(fn.name, args, {
            workspaceId,
          });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }
        continue;
      }

      const raw = choice.content ?? '';
      const parsed = parseAgentResponse(raw);
      if (parsed) {
        return {
          response: parsed,
          thinkingTime: Date.now() - start,
          toolsUsed,
        };
      }

      messages.push(choice);
      messages.push({
        role: 'user',
        content: 'Respond with valid JSON only. No markdown fences.',
      });
    }

    return {
      response: { action: 'pass', done: false },
      thinkingTime: Date.now() - start,
      toolsUsed,
    };
  }
}
