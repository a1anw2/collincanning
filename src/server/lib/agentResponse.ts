/** Zod schema for validating agent JSON responses. */

import { z } from 'zod';

const reactionSchema = z.object({
  messageId: z.string(),
  type: z.enum(['agree', 'disagree', 'interesting', 'question']),
});

export const agentResponseSchema = z.object({
  action: z.enum(['speak', 'private', 'pass', 'leave', 'react', 'meme']),
  to: z.string().optional(),
  content: z.string().optional(),
  memeUrl: z.string().optional(),
  memeName: z.string().optional(),
  done: z.boolean(),
  currentPosition: z.string().optional(),
  internalNotes: z.string().optional(),
  reaction: reactionSchema.optional(),
});

export type ParsedAgentResponse = z.infer<typeof agentResponseSchema>;

export function parseAgentResponse(raw: string): ParsedAgentResponse | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const json: unknown = JSON.parse(cleaned);
    const result = agentResponseSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
