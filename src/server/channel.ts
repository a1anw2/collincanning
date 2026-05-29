/** Channel message posting with DB writes and SSE publish. */

import { broker } from './broker.js';
import * as db from './db.js';
import { buildMentionLookup, matchMentionedAgentIds } from './lib/mentions.js';
import type { ArtifactRecord, MessageType } from '../../shared/types.js';

export function postPublic(
  workspaceId: string,
  agentId: string,
  content: string,
  round: number,
): ReturnType<typeof db.insertMessage> {
  const channel = db.getGeneralChannel(workspaceId);
  if (!channel) throw new Error('General channel not found');

  const agents = db.listAgentsByWorkspace(workspaceId);
  const mentionLookup = buildMentionLookup(agents);
  const msg = db.insertMessage(channel.id, agentId, content, 'message', round);
  const mentioned = matchMentionedAgentIds(content, mentionLookup);
  if (mentioned.length > 0) db.insertMentions(msg.id, mentioned);

  const full = db.getPublicHistory(workspaceId).find((m) => m.id === msg.id) ?? msg;
  broker.publish('message:public', full);
  return full;
}

export function postSystem(
  workspaceId: string,
  content: string,
  round: number,
  type: MessageType = 'system',
): void {
  const channel = db.getGeneralChannel(workspaceId);
  if (!channel) return;
  const msg = db.insertMessage(channel.id, null, content, type, round);
  broker.publish('message:system', msg);
}

export function postPrivate(
  workspaceId: string,
  fromAgentId: string,
  toNameOrRole: string,
  content: string,
  round: number,
): void {
  const from = db.getAgent(fromAgentId);
  const to = db.resolveAgentByMention(workspaceId, toNameOrRole);
  if (!from || !to) throw new Error('Agent not found for private message');

  const channelId = db.getOrCreateDmChannel(from.id, to.id);
  const msg = db.insertMessage(channelId, from.id, content, 'message', round);

  broker.publish('message:private', {
    id: msg.id,
    from: from.role,
    fromDisplayName: from.displayName ?? from.role,
    to: to.role,
    content,
    round,
    createdAt: msg.createdAt,
  });
}

export function publishArtifact(artifact: ArtifactRecord): void {
  broker.publish('artifact:inject', artifact);
}
