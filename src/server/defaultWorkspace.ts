/** Single company workspace — one #general across all sim runs. */

import { v4 as uuid } from 'uuid';
import { DEFAULT_WORKSPACE_ID } from '../../shared/constants.js';
import { getDb } from './db.js';
import type { Workspace } from '../../shared/types.js';

export { DEFAULT_WORKSPACE_ID };

export function getDefaultWorkspace(): Workspace | null {
  const row = getDb()
    .prepare(`SELECT * FROM workspaces WHERE id = ?`)
    .get(DEFAULT_WORKSPACE_ID) as
    | {
        id: string;
        name: string;
        company_context: string | null;
        created_at: number;
        ended_at: number | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    companyContext: row.company_context ?? null,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

export function getOrCreateDefaultWorkspace(
  name = 'Collins Canning Co.',
  companyContext?: string | null,
): Workspace {
  const existing = getDefaultWorkspace();
  const now = Date.now();
  const context = companyContext?.trim() || null;

  if (!existing) {
    getDb()
      .prepare(
        `INSERT INTO workspaces (id, name, company_context, created_at, ended_at)
         VALUES (?, ?, ?, ?, NULL)`,
      )
      .run(DEFAULT_WORKSPACE_ID, name, context, now);
  } else {
    getDb()
      .prepare(`UPDATE workspaces SET name = ?, company_context = COALESCE(?, company_context), ended_at = NULL WHERE id = ?`)
      .run(name, context, DEFAULT_WORKSPACE_ID);
  }

  const ws = getDefaultWorkspace()!;
  ensureGeneralChannel(ws.id);
  return ws;
}

export function ensureGeneralChannel(workspaceId: string): string {
  const row = getDb()
    .prepare(
      `SELECT id FROM channels WHERE workspace_id = ? AND name = 'general' AND type = 'public' LIMIT 1`,
    )
    .get(workspaceId) as { id: string } | undefined;
  if (row) return row.id;

  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO channels (id, workspace_id, name, type, created_at) VALUES (?, ?, 'general', 'public', ?)`,
    )
    .run(id, workspaceId, now);
  return id;
}

/** Merge legacy per-sim workspaces into the default #general (run once at migration). */
export function migrateLegacyWorkspacesToDefault(): void {
  getOrCreateDefaultWorkspace();
  const generalId = ensureGeneralChannel(DEFAULT_WORKSPACE_ID);

  const otherChannels = getDb()
    .prepare(
      `SELECT c.id, c.workspace_id FROM channels c
       WHERE c.workspace_id != ? AND (c.type = 'public' OR c.name = 'general')`,
    )
    .all(DEFAULT_WORKSPACE_ID) as Array<{ id: string; workspace_id: string }>;

  const moveMessages = getDb().prepare(
    `UPDATE messages SET channel_id = ? WHERE channel_id = ?`,
  );
  for (const ch of otherChannels) {
    moveMessages.run(generalId, ch.id);
  }

  getDb()
    .prepare(`UPDATE artifacts SET workspace_id = ? WHERE workspace_id != ?`)
    .run(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_ID);

  getDb()
    .prepare(`UPDATE agent_memory SET workspace_id = ? WHERE workspace_id != ?`)
    .run(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_ID);

  getDb()
    .prepare(`UPDATE agent_rounds SET workspace_id = ? WHERE workspace_id != ?`)
    .run(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_ID);

  getDb()
    .prepare(`UPDATE ai_calls SET workspace_id = ? WHERE workspace_id IS NOT NULL AND workspace_id != ?`)
    .run(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_ID);

  const otherAgents = getDb()
    .prepare(`SELECT id, persona_id, status FROM agents WHERE workspace_id != ?`)
    .all(DEFAULT_WORKSPACE_ID) as Array<{ id: string; persona_id: string; status: string }>;

  for (const old of otherAgents) {
    const inDefault = getDb()
      .prepare(
        `SELECT id FROM agents WHERE workspace_id = ? AND persona_id = ? LIMIT 1`,
      )
      .get(DEFAULT_WORKSPACE_ID, old.persona_id) as { id: string } | undefined;
    if (!inDefault) {
      getDb()
        .prepare(`UPDATE agents SET workspace_id = ? WHERE id = ?`)
        .run(DEFAULT_WORKSPACE_ID, old.id);
    }
  }

  const now = Date.now();
  getDb()
    .prepare(`UPDATE workspaces SET ended_at = ? WHERE id != ? AND ended_at IS NULL`)
    .run(now, DEFAULT_WORKSPACE_ID);

  purgeLegacyWorkspaces();
}

/** Remove non-default workspace rows and orphaned data after migration. */
export function purgeLegacyWorkspaces(): number {
  const legacy = getDb()
    .prepare(`SELECT id FROM workspaces WHERE id != ?`)
    .all(DEFAULT_WORKSPACE_ID) as Array<{ id: string }>;

  for (const { id } of legacy) {
    deleteWorkspaceTree(id);
  }
  return legacy.length;
}

function deleteWorkspaceTree(workspaceId: string): void {
  if (workspaceId === DEFAULT_WORKSPACE_ID) return;

  const database = getDb();
  const run = database.transaction(() => {
    const channelRows = database
      .prepare(`SELECT id FROM channels WHERE workspace_id = ?`)
      .all(workspaceId) as Array<{ id: string }>;
    const channelIds = channelRows.map((c) => c.id);

    if (channelIds.length > 0) {
      const inList = channelIds.map(() => '?').join(', ');
      database
        .prepare(
          `DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (${inList}))`,
        )
        .run(...channelIds);
      database
        .prepare(
          `DELETE FROM mentions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (${inList}))`,
        )
        .run(...channelIds);
      database.prepare(`DELETE FROM messages WHERE channel_id IN (${inList})`).run(...channelIds);
      database
        .prepare(`DELETE FROM channel_members WHERE channel_id IN (${inList})`)
        .run(...channelIds);
      database.prepare(`DELETE FROM dm_members WHERE channel_id IN (${inList})`).run(...channelIds);
    }

    database.prepare(`DELETE FROM channels WHERE workspace_id = ?`).run(workspaceId);

    const agentRows = database
      .prepare(`SELECT id, persona_id FROM agents WHERE workspace_id = ?`)
      .all(workspaceId) as Array<{ id: string; persona_id: string }>;
    for (const { id: agentId, persona_id: personaId } of agentRows) {
      const defaultAgent = database
        .prepare(
          `SELECT id FROM agents WHERE workspace_id = ? AND persona_id = ? LIMIT 1`,
        )
        .get(DEFAULT_WORKSPACE_ID, personaId) as { id: string } | undefined;

      if (defaultAgent) {
        database
          .prepare(`UPDATE messages SET agent_id = ? WHERE agent_id = ?`)
          .run(defaultAgent.id, agentId);
        database
          .prepare(`UPDATE mentions SET agent_id = ? WHERE agent_id = ?`)
          .run(defaultAgent.id, agentId);
        database
          .prepare(`UPDATE reactions SET agent_id = ? WHERE agent_id = ?`)
          .run(defaultAgent.id, agentId);
        database
          .prepare(`UPDATE artifacts SET target_agent_id = ? WHERE target_agent_id = ?`)
          .run(defaultAgent.id, agentId);
        database
          .prepare(`UPDATE ai_calls SET agent_id = ? WHERE agent_id = ?`)
          .run(defaultAgent.id, agentId);
      } else {
        database.prepare(`UPDATE messages SET agent_id = NULL WHERE agent_id = ?`).run(agentId);
        database.prepare(`DELETE FROM mentions WHERE agent_id = ?`).run(agentId);
        database.prepare(`DELETE FROM reactions WHERE agent_id = ?`).run(agentId);
        database
          .prepare(`UPDATE artifacts SET target_agent_id = NULL WHERE target_agent_id = ?`)
          .run(agentId);
        database.prepare(`UPDATE ai_calls SET agent_id = NULL WHERE agent_id = ?`).run(agentId);
      }

      database.prepare(`DELETE FROM dm_members WHERE agent_id = ?`).run(agentId);
      database.prepare(`DELETE FROM channel_members WHERE agent_id = ?`).run(agentId);
      database.prepare(`DELETE FROM agent_memory WHERE agent_id = ?`).run(agentId);
      database.prepare(`DELETE FROM agent_rounds WHERE agent_id = ?`).run(agentId);
    }
    database.prepare(`DELETE FROM agents WHERE workspace_id = ?`).run(workspaceId);
    database.prepare(`DELETE FROM agent_rounds WHERE workspace_id = ?`).run(workspaceId);
    database.prepare(`DELETE FROM artifacts WHERE workspace_id = ?`).run(workspaceId);
    database
      .prepare(`UPDATE ai_calls SET workspace_id = NULL WHERE workspace_id = ?`)
      .run(workspaceId);
    database.prepare(`DELETE FROM workspaces WHERE id = ?`).run(workspaceId);
  });
  run();
}
