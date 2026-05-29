/** Records OpenRouter completion usage and cost to the database. */

import { v4 as uuid } from 'uuid';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import * as db from './db.js';
import { log } from './logger.js';

export type AiCallType = 'agent_think' | 'summarize' | 'onboarding';

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export function recordAiCall(params: {
  workspaceId: string | null;
  agentId: string | null;
  role: string | null;
  callType: AiCallType;
  model: string;
  round: number | null;
  completion: ChatCompletion;
  durationMs: number;
}): void {
  const usage = (params.completion.usage ?? {}) as OpenRouterUsage;
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  const costUsd = usage.cost ?? null;

  db.insertAiCall({
    id: uuid(),
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    role: params.role,
    callType: params.callType,
    model: params.model,
    round: params.round,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    durationMs: params.durationMs,
    createdAt: Date.now(),
  });

  const who = params.role ?? params.callType;
  const costLabel =
    costUsd != null ? `$${costUsd.toFixed(6)}` : 'cost unknown';

  log.ai.info(
    {
      callType: params.callType,
      role: params.role,
      model: params.model,
      round: params.round,
      durationMs: params.durationMs,
      costUsd,
      promptTokens,
      completionTokens,
      totalTokens,
    },
    `${params.callType} · ${who} · ${params.durationMs}ms · ${costLabel} · ${totalTokens} tok`,
  );
}
