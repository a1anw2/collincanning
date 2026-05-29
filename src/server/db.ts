/** Typed SQLite query helpers for Cannery. */

import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { config } from './config.js';
import { ensureDataDir } from './paths.js';
import {
  DEFAULT_WORKSPACE_ID,
  ensureGeneralChannel,
  getDefaultWorkspace,
  getOrCreateDefaultWorkspace,
  migrateLegacyWorkspacesToDefault,
} from './defaultWorkspace.js';
import { buildMentionLookup } from './lib/mentions.js';
import { normalizeUrl } from './tools/toolCache.js';
import type {
  ActionType,
  AgentMemory,
  AgentRecord,
  AgentRoundRecord,
  AgentStatus,
  ArtifactRecord,
  ArtifactType,
  MessageRecord,
  MessageType,
  PersonaRecord,
  ReactionRecord,
  ReactionType,
  Workspace,
  AiCallRecord,
  AiCallType,
  AiUsageSummary,
} from '../../shared/types.js';

let _db: Database.Database | null = null;

function runMigrations(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(workspaces)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'company_context')) {
    database.exec(`ALTER TABLE workspaces ADD COLUMN company_context TEXT`);
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id TEXT NOT NULL REFERENCES channels(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      PRIMARY KEY (channel_id, agent_id)
    )
  `);
  migrateLegacyWorkspacesToDefault();
  const personaColNames = () =>
    (database.prepare(`PRAGMA table_info(personas)`).all() as Array<{ name: string }>).map(
      (c) => c.name,
    );
  if (!personaColNames().includes('title')) {
    database.exec(`ALTER TABLE personas ADD COLUMN title TEXT`);
    database.exec(
      `UPDATE personas SET title = display_name WHERE title IS NULL AND display_name IS NOT NULL`,
    );
  }
  if (!personaColNames().includes('photo_filename')) {
    database.exec(`ALTER TABLE personas ADD COLUMN photo_filename TEXT`);
  }
}

export function getDb(): Database.Database {
  if (!_db) {
    ensureDataDir();
    _db = new Database(config.dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    runMigrations(_db);
  }
  return _db;
}

// --- Row mappers ---

interface WorkspaceRow {
  id: string;
  name: string;
  company_context: string | null;
  created_at: number;
  ended_at: number | null;
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    companyContext: row.company_context ?? null,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

interface PersonaRow {
  id: string;
  role: string;
  display_name: string;
  title: string | null;
  photo_filename: string | null;
  model: string;
  persona: string;
  base_delay_min: number;
  base_delay_max: number;
  created_at: number;
  updated_at: number;
}

function mapPersona(row: PersonaRow): PersonaRecord {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    title: row.title ?? null,
    photoFilename: row.photo_filename ?? null,
    model: row.model,
    persona: row.persona,
    baseDelayMin: row.base_delay_min,
    baseDelayMax: row.base_delay_max,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PERSONA_JOIN_SELECT = `p.display_name, p.title, p.photo_filename, p.persona AS persona_profile`;

interface AgentRowWithPersona extends AgentRow {
  display_name?: string;
  title?: string | null;
  photo_filename?: string | null;
  persona_profile?: string;
}

function mapAgentWithPersona(row: AgentRowWithPersona): AgentRecord {
  const agent = mapAgent(row);
  return {
    ...agent,
    displayName: row.display_name ?? agent.displayName,
    title: row.title ?? null,
    photoFilename: row.photo_filename ?? null,
    profile: row.persona_profile,
  };
}

interface MessageRowWithPersona {
  id: string;
  channel_id: string;
  agent_id: string | null;
  parent_id: string | null;
  content: string;
  type: string;
  created_at: number;
  round: number;
  role?: string;
  display_name?: string;
  title?: string | null;
  photo_filename?: string | null;
  persona_profile?: string;
}

function mapMessageRow(row: MessageRowWithPersona): MessageRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    agentId: row.agent_id,
    parentId: row.parent_id,
    content: row.content,
    type: row.type as MessageType,
    createdAt: row.created_at,
    round: row.round,
    role: row.role,
    displayName: row.display_name,
    title: row.title ?? null,
    photoFilename: row.photo_filename ?? null,
    profile: row.persona_profile,
  };
}

interface AgentRow {
  id: string;
  workspace_id: string;
  persona_id: string;
  role: string;
  model: string;
  status: string;
  joined_round: number;
  left_round: number | null;
  created_at: number;
  display_name?: string;
}

function mapAgent(row: AgentRow): AgentRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    personaId: row.persona_id,
    role: row.role,
    model: row.model,
    status: row.status as AgentStatus,
    joinedRound: row.joined_round,
    leftRound: row.left_round,
    createdAt: row.created_at,
    displayName: row.display_name,
  };
}

// --- Workspace ---

/** Company workspace (always exists after first boot). */
export function getActiveWorkspace(): Workspace {
  return getDefaultWorkspace() ?? getOrCreateDefaultWorkspace();
}

export { DEFAULT_WORKSPACE_ID, getDefaultWorkspace, getOrCreateDefaultWorkspace };

export function getWorkspace(id: string): Workspace | null {
  const row = getDb().prepare(`SELECT * FROM workspaces WHERE id = ?`).get(id) as
    | WorkspaceRow
    | undefined;
  return row ? mapWorkspace(row) : null;
}

export function createWorkspace(name: string, companyContext?: string | null): Workspace {
  const id = uuid();
  const now = Date.now();
  const context = companyContext?.trim() || null;
  getDb()
    .prepare(
      `INSERT INTO workspaces (id, name, company_context, created_at, ended_at)
       VALUES (?, ?, ?, ?, NULL)`,
    )
    .run(id, name, context, now);
  return { id, name, companyContext: context, createdAt: now, endedAt: null };
}

export function updateWorkspaceCompanyContext(id: string, companyContext: string | null): void {
  const context = companyContext?.trim() || null;
  getDb()
    .prepare(`UPDATE workspaces SET company_context = ? WHERE id = ?`)
    .run(context, id);
}

export function endWorkspace(id: string): void {
  getDb()
    .prepare(`UPDATE workspaces SET ended_at = ? WHERE id = ?`)
    .run(Date.now(), id);
}

export interface WorkspaceSummary {
  workspace: Workspace;
  messageCount: number;
  agentMessageCount: number;
}

/** Summary for the company workspace (#general). */
export function getDefaultWorkspaceSummary(): WorkspaceSummary {
  const ws = getDefaultWorkspace() ?? getOrCreateDefaultWorkspace();
  const row = getDb()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM messages m
         JOIN channels c ON c.id = m.channel_id AND c.workspace_id = ?) AS message_count,
        (SELECT COUNT(*) FROM messages m
         JOIN channels c ON c.id = m.channel_id AND c.workspace_id = ? AND m.type = 'message') AS agent_message_count`,
    )
    .get(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_ID) as {
    message_count: number;
    agent_message_count: number;
  };
  return {
    workspace: ws,
    messageCount: row.message_count,
    agentMessageCount: row.agent_message_count,
  };
}

/** @deprecated Legacy multi-workspace list — use getDefaultWorkspaceSummary */
export function listWorkspaceSummaries(_limit = 15): WorkspaceSummary[] {
  return [getDefaultWorkspaceSummary()];
}

/** Latest round number persisted for a workspace (for viewer after server restart). */
export function getWorkspaceMaxRound(workspaceId: string): number {
  const channel = getGeneralChannel(workspaceId);
  if (!channel) return 0;
  const msgRow = getDb()
    .prepare(`SELECT MAX(round) as max_round FROM messages WHERE channel_id = ?`)
    .get(channel.id) as { max_round: number | null } | undefined;
  const arRow = getDb()
    .prepare(`SELECT MAX(round) as max_round FROM agent_rounds WHERE workspace_id = ?`)
    .get(workspaceId) as { max_round: number | null } | undefined;
  return Math.max(msgRow?.max_round ?? 0, arRow?.max_round ?? 0);
}

// --- Personas ---

export function listPersonas(): PersonaRecord[] {
  const rows = getDb().prepare(`SELECT * FROM personas ORDER BY role`).all() as PersonaRow[];
  return rows.map(mapPersona);
}

export function getPersona(id: string): PersonaRecord | null {
  const row = getDb().prepare(`SELECT * FROM personas WHERE id = ?`).get(id) as
    | PersonaRow
    | undefined;
  return row ? mapPersona(row) : null;
}

export function createPersona(
  data: Omit<PersonaRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): PersonaRecord {
  const id = data.id ?? uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO personas (id, role, display_name, title, photo_filename, model, persona, base_delay_min, base_delay_max, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.role,
      data.displayName,
      data.title ?? null,
      data.photoFilename ?? null,
      data.model,
      data.persona,
      data.baseDelayMin,
      data.baseDelayMax,
      now,
      now,
    );
  return getPersona(id)!;
}

export function updatePersona(
  id: string,
  data: Partial<
    Pick<
      PersonaRecord,
      | 'displayName'
      | 'title'
      | 'photoFilename'
      | 'model'
      | 'persona'
      | 'baseDelayMin'
      | 'baseDelayMax'
    >
  >,
): PersonaRecord | null {
  const existing = getPersona(id);
  if (!existing) return null;
  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE personas SET display_name = ?, title = ?, photo_filename = ?, model = ?, persona = ?, base_delay_min = ?, base_delay_max = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      data.displayName ?? existing.displayName,
      data.title !== undefined ? data.title : existing.title,
      data.photoFilename !== undefined ? data.photoFilename : existing.photoFilename,
      data.model ?? existing.model,
      data.persona ?? existing.persona,
      data.baseDelayMin ?? existing.baseDelayMin,
      data.baseDelayMax ?? existing.baseDelayMax,
      now,
      id,
    );
  return getPersona(id);
}

export function deletePersona(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM personas WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function personaHasActiveAgent(personaId: string, workspaceId = DEFAULT_WORKSPACE_ID): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM agents WHERE workspace_id = ? AND persona_id = ? AND status != 'left' LIMIT 1`,
    )
    .get(workspaceId, personaId);
  return !!row;
}

/** @deprecated Use personaHasActiveAgent with orchestrator running check */
export function personaInActiveSim(personaId: string): boolean {
  return personaHasActiveAgent(personaId);
}

// --- Agents ---

export function listAgentsByWorkspace(workspaceId: string): AgentRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT a.*, ${PERSONA_JOIN_SELECT} FROM agents a
       JOIN personas p ON p.id = a.persona_id
       WHERE a.workspace_id = ? ORDER BY a.created_at`,
    )
    .all(workspaceId) as AgentRowWithPersona[];
  return rows.map(mapAgentWithPersona);
}

export function resolveAgentByMention(workspaceId: string, mention: string): AgentRecord | null {
  const trimmed = mention.trim();
  if (!trimmed) return null;
  const agents = listAgentsByWorkspace(workspaceId);
  const lookup = buildMentionLookup(agents);
  const id = lookup.get(trimmed) ?? lookup.get(trimmed.toLowerCase());
  if (id) return getAgent(id);
  return getAgentByRole(workspaceId, trimmed);
}

export function getAgentByRole(workspaceId: string, role: string): AgentRecord | null {
  const row = getDb()
    .prepare(
      `SELECT a.*, ${PERSONA_JOIN_SELECT} FROM agents a
       JOIN personas p ON p.id = a.persona_id
       WHERE a.workspace_id = ? AND a.role = ?`,
    )
    .get(workspaceId, role) as AgentRowWithPersona | undefined;
  return row ? mapAgentWithPersona(row) : null;
}

export function getAgent(id: string): AgentRecord | null {
  const row = getDb()
    .prepare(
      `SELECT a.*, ${PERSONA_JOIN_SELECT} FROM agents a
       JOIN personas p ON p.id = a.persona_id WHERE a.id = ?`,
    )
    .get(id) as AgentRowWithPersona | undefined;
  return row ? mapAgentWithPersona(row) : null;
}

export function createAgent(
  workspaceId: string,
  personaId: string,
  round: number,
): AgentRecord {
  const persona = getPersona(personaId);
  if (!persona) throw new Error(`Persona ${personaId} not found`);
  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO agents (id, workspace_id, persona_id, role, model, status, joined_round, left_round, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, NULL, ?)`,
    )
    .run(id, workspaceId, personaId, persona.role, persona.model, round, now);

  const memId = uuid();
  getDb()
    .prepare(
      `INSERT INTO agent_memory (id, agent_id, workspace_id, episodic_summary, private_notes, current_position, updated_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, ?)`,
    )
    .run(memId, id, workspaceId, now);

  const agent = getAgent(id);
  if (!agent) throw new Error('Failed to create agent');
  return agent;
}

export function updateAgentStatus(agentId: string, status: AgentStatus, leftRound?: number): void {
  if (status === 'left' && leftRound !== undefined) {
    getDb()
      .prepare(`UPDATE agents SET status = ?, left_round = ? WHERE id = ?`)
      .run(status, leftRound, agentId);
  } else {
    getDb().prepare(`UPDATE agents SET status = ? WHERE id = ?`).run(status, agentId);
  }
}

// --- Channels ---

export function createGeneralChannel(workspaceId: string): string {
  return ensureGeneralChannel(workspaceId);
}

export function getGeneralChannel(workspaceId: string): { id: string } | null {
  const row = getDb()
    .prepare(
      `SELECT id FROM channels WHERE workspace_id = ? AND name = 'general' AND type = 'public' LIMIT 1`,
    )
    .get(workspaceId) as { id: string } | undefined;
  return row ?? null;
}

export interface ChannelListItem {
  id: string;
  workspaceId: string;
  name: string;
  type: 'public' | 'group' | 'dm';
  createdAt: number;
  memberCount: number | null;
}

export function listChannels(workspaceId: string): ChannelListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.workspace_id, c.name, c.type, c.created_at,
        CASE WHEN c.type = 'group' THEN
          (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id)
        ELSE NULL END AS member_count
       FROM channels c
       WHERE c.workspace_id = ? AND c.type != 'dm'
       ORDER BY CASE WHEN c.name = 'general' THEN 0 ELSE 1 END, c.name`,
    )
    .all(workspaceId) as Array<{
    id: string;
    workspace_id: string;
    name: string;
    type: string;
    created_at: number;
    member_count: number | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    type: r.type as ChannelListItem['type'],
    createdAt: r.created_at,
    memberCount: r.member_count,
  }));
}

/** Breakout channel for a subset of agents (future UI). */
export function createGroupChannel(workspaceId: string, name: string, agentIds: string[]): string {
  const slug = name.replace(/^#/, '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!slug || slug === 'general') throw new Error('Invalid group channel name');
  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO channels (id, workspace_id, name, type, created_at) VALUES (?, ?, ?, 'group', ?)`,
    )
    .run(id, workspaceId, slug, now);
  for (const agentId of agentIds) {
    addChannelMember(id, agentId);
  }
  return id;
}

export function addChannelMember(channelId: string, agentId: string): void {
  getDb()
    .prepare(`INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`)
    .run(channelId, agentId);
}

export function ensureAgentForPersona(
  workspaceId: string,
  personaId: string,
  round: number,
): { agent: AgentRecord; joined: boolean } {
  const row = getDb()
    .prepare(
      `SELECT a.*, ${PERSONA_JOIN_SELECT} FROM agents a
       JOIN personas p ON p.id = a.persona_id
       WHERE a.workspace_id = ? AND a.persona_id = ?
       ORDER BY a.created_at DESC LIMIT 1`,
    )
    .get(workspaceId, personaId) as AgentRowWithPersona | undefined;

  if (row) {
    const agent = mapAgentWithPersona(row);
    if (agent.status === 'left') {
      getDb()
        .prepare(`UPDATE agents SET status = 'active', left_round = NULL, joined_round = ? WHERE id = ?`)
        .run(round, agent.id);
      return { agent: { ...agent, status: 'active', leftRound: null, joinedRound: round }, joined: true };
    }
    if (agent.status === 'away') {
      getDb().prepare(`UPDATE agents SET status = 'active' WHERE id = ?`).run(agent.id);
      return { agent: { ...agent, status: 'active' }, joined: false };
    }
    return { agent, joined: false };
  }

  return { agent: createAgent(workspaceId, personaId, round), joined: true };
}

export function getOrCreateDmChannel(agentIdA: string, agentIdB: string): string {
  const row = getDb()
    .prepare(
      `SELECT c.id FROM channels c
       JOIN dm_members d1 ON d1.channel_id = c.id AND d1.agent_id = ?
       JOIN dm_members d2 ON d2.channel_id = c.id AND d2.agent_id = ?
       WHERE c.type = 'dm' LIMIT 1`,
    )
    .get(agentIdA, agentIdB) as { id: string } | undefined;
  if (row) return row.id;

  const agentA = getAgent(agentIdA);
  const agentB = getAgent(agentIdB);
  if (!agentA || !agentB) throw new Error('Agents not found for DM');

  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO channels (id, workspace_id, name, type, created_at) VALUES (?, ?, ?, 'dm', ?)`,
    )
    .run(id, agentA.workspaceId, `dm-${agentA.role}-${agentB.role}`, now);
  getDb().prepare(`INSERT INTO dm_members (channel_id, agent_id) VALUES (?, ?)`).run(id, agentIdA);
  getDb().prepare(`INSERT INTO dm_members (channel_id, agent_id) VALUES (?, ?)`).run(id, agentIdB);
  return id;
}

// --- Messages ---

export function insertMessage(
  channelId: string,
  agentId: string | null,
  content: string,
  type: MessageType,
  round: number,
  parentId: string | null = null,
): MessageRecord {
  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO messages (id, channel_id, agent_id, parent_id, content, type, created_at, round)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, channelId, agentId, parentId, content, type, now, round);
  return getMessageById(id)!;
}

function getMessageById(id: string): MessageRecord | null {
  const row = getDb()
    .prepare(
      `SELECT m.*, a.role, p.display_name, p.title, p.photo_filename, p.persona AS persona_profile
       FROM messages m
       LEFT JOIN agents a ON a.id = m.agent_id
       LEFT JOIN personas p ON p.id = a.persona_id
       WHERE m.id = ?`,
    )
    .get(id) as MessageRowWithPersona | undefined;
  if (!row) return null;
  return mapMessageRow(row);
}

export function getPublicHistory(workspaceId: string): MessageRecord[] {
  const channel = getGeneralChannel(workspaceId);
  if (!channel) return [];
  const rows = getDb()
    .prepare(
      `SELECT m.*, a.role, p.display_name, p.title, p.photo_filename, p.persona AS persona_profile
       FROM messages m
       LEFT JOIN agents a ON a.id = m.agent_id
       LEFT JOIN personas p ON p.id = a.persona_id
       WHERE m.channel_id = ? ORDER BY m.created_at ASC`,
    )
    .all(channel.id) as MessageRowWithPersona[];
  return rows.map(mapMessageRow);
}

export function getPrivateMessagesForAgent(agentId: string): Array<{
  id: string;
  fromRole: string;
  fromDisplayName: string;
  toRole: string;
  content: string;
  round: number;
  createdAt: number;
}> {
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.content, m.round, m.created_at,
              sender.role as from_role, sp.display_name as from_display_name,
              recipient.role as to_role
       FROM messages m
       JOIN channels c ON c.id = m.channel_id AND c.type = 'dm'
       JOIN dm_members dm ON dm.channel_id = c.id
       JOIN agents sender ON sender.id = m.agent_id
       JOIN personas sp ON sp.id = sender.persona_id
       JOIN agents recipient ON recipient.id = dm.agent_id AND recipient.id != m.agent_id
       WHERE dm.agent_id = ? OR EXISTS (
         SELECT 1 FROM dm_members d2 WHERE d2.channel_id = c.id AND d2.agent_id = ?
       )
       AND (m.agent_id != ? OR EXISTS (
         SELECT 1 FROM dm_members d3
         JOIN agents a ON a.id = d3.agent_id
         WHERE d3.channel_id = c.id AND d3.agent_id = ? AND a.id != m.agent_id
       ))
       ORDER BY m.created_at`,
    )
    .all(agentId, agentId, agentId, agentId) as Array<{
    id: string;
    content: string;
    round: number;
    created_at: number;
    from_role: string;
    from_display_name: string;
    to_role: string;
  }>;

  return rows
    .filter((r) => r.from_role)
    .map((r) => ({
      id: r.id,
      fromRole: r.from_role,
      fromDisplayName: r.from_display_name,
      toRole: r.to_role,
      content: r.content,
      round: r.round,
      createdAt: r.created_at,
    }));
}

export function getRecentPublicMessages(
  workspaceId: string,
  limit: number,
): MessageRecord[] {
  const all = getPublicHistory(workspaceId);
  return all.slice(-limit);
}

// --- Mentions ---

export function insertMentions(messageId: string, agentIds: string[]): void {
  const stmt = getDb().prepare(
    `INSERT INTO mentions (id, message_id, agent_id) VALUES (?, ?, ?)`,
  );
  for (const agentId of agentIds) {
    stmt.run(uuid(), messageId, agentId);
  }
}

// --- Artifacts ---

export function insertArtifact(
  workspaceId: string,
  type: ArtifactType,
  content: string,
  round: number,
  injectedBy: string,
  targetAgentId: string | null = null,
): ArtifactRecord {
  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO artifacts (id, workspace_id, type, content, target_agent_id, injected_by, injected_at, round, fetched_content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(id, workspaceId, type, content, targetAgentId, injectedBy, now, round);
  return {
    id,
    workspaceId,
    type,
    content,
    targetAgentId,
    injectedBy,
    injectedAt: now,
    round,
    fetchedContent: null,
  };
}

export function updateArtifactFetchedContent(id: string, fetchedContent: string): void {
  getDb()
    .prepare(`UPDATE artifacts SET fetched_content = ? WHERE id = ?`)
    .run(fetchedContent, id);
}

/** Prefetched article text for a URL artifact in this workspace, if any. */
export function getArtifactFetchedContentByUrl(
  workspaceId: string,
  url: string,
): string | null {
  const key = normalizeUrl(url);
  const rows = getDb()
    .prepare(
      `SELECT content, fetched_content FROM artifacts
       WHERE workspace_id = ? AND type = 'url' AND fetched_content IS NOT NULL`,
    )
    .all(workspaceId) as Array<{ content: string; fetched_content: string }>;
  for (const row of rows) {
    if (normalizeUrl(row.content) === key) return row.fetched_content;
  }
  return null;
}

export function listArtifacts(workspaceId: string): ArtifactRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM artifacts WHERE workspace_id = ? ORDER BY injected_at`)
    .all(workspaceId) as Array<{
    id: string;
    workspace_id: string;
    type: string;
    content: string;
    target_agent_id: string | null;
    injected_by: string;
    injected_at: number;
    round: number;
    fetched_content: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    type: r.type as ArtifactType,
    content: r.content,
    targetAgentId: r.target_agent_id,
    injectedBy: r.injected_by,
    injectedAt: r.injected_at,
    round: r.round,
    fetchedContent: r.fetched_content,
  }));
}

// --- Memory ---

export function getAgentMemory(agentId: string): AgentMemory | null {
  const row = getDb()
    .prepare(`SELECT * FROM agent_memory WHERE agent_id = ?`)
    .get(agentId) as {
    id: string;
    agent_id: string;
    workspace_id: string;
    episodic_summary: string | null;
    private_notes: string | null;
    current_position: string | null;
    updated_at: number;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    workspaceId: row.workspace_id,
    episodicSummary: row.episodic_summary,
    privateNotes: row.private_notes,
    currentPosition: row.current_position,
    updatedAt: row.updated_at,
  };
}

export function upsertAgentMemory(
  agentId: string,
  updates: Partial<
    Pick<AgentMemory, 'episodicSummary' | 'privateNotes' | 'currentPosition'>
  >,
): void {
  const existing = getAgentMemory(agentId);
  const now = Date.now();
  if (!existing) return;
  getDb()
    .prepare(
      `UPDATE agent_memory SET episodic_summary = ?, private_notes = ?, current_position = ?, updated_at = ? WHERE agent_id = ?`,
    )
    .run(
      updates.episodicSummary ?? existing.episodicSummary,
      updates.privateNotes ?? existing.privateNotes,
      updates.currentPosition ?? existing.currentPosition,
      now,
      agentId,
    );
}

/** Clear episodic memory, notes, positions, and round history for all agents in a workspace. */
export function clearWorkspaceMemory(workspaceId: string): void {
  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE agent_memory SET episodic_summary = NULL, private_notes = NULL, current_position = NULL, updated_at = ?
       WHERE workspace_id = ?`,
    )
    .run(now, workspaceId);
  getDb().prepare(`DELETE FROM agent_rounds WHERE workspace_id = ?`).run(workspaceId);
}

export interface EndThreadResult {
  messagesDeleted: number;
  artifactsDeleted: number;
}

/**
 * End the #general thread: wipe public channel, artifacts, reactions; clear agent memory;
 * mark active agents as left so a new sim can start fresh.
 */
export function endGeneralThread(workspaceId: string): EndThreadResult {
  const channel = getGeneralChannel(workspaceId);
  if (!channel) {
    clearWorkspaceMemory(workspaceId);
    return { messagesDeleted: 0, artifactsDeleted: 0 };
  }

  const closeRound = Math.max(1, getWorkspaceMaxRound(workspaceId) + 1);
  const db_ = getDb();
  const end = db_.transaction(() => {
    db_.prepare(
      `DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id = ?)`,
    ).run(channel.id);
    db_.prepare(
      `DELETE FROM mentions WHERE message_id IN (SELECT id FROM messages WHERE channel_id = ?)`,
    ).run(channel.id);
    const msgDel = db_
      .prepare(`DELETE FROM messages WHERE channel_id = ?`)
      .run(channel.id);
    const artDel = db_
      .prepare(`DELETE FROM artifacts WHERE workspace_id = ?`)
      .run(workspaceId);
    clearWorkspaceMemory(workspaceId);
    db_.prepare(
      `UPDATE agents SET status = 'left', left_round = ? WHERE workspace_id = ? AND status != 'left'`,
    ).run(closeRound, workspaceId);
    return {
      messagesDeleted: msgDel.changes,
      artifactsDeleted: artDel.changes,
    };
  });
  return end();
}

// --- Rounds ---

export function upsertAgentRound(
  agentId: string,
  workspaceId: string,
  round: number,
  action: ActionType,
  done: boolean,
  interestScore: number,
  toolsUsed: string[] | null,
  thinkingTime: number | null,
): void {
  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO agent_rounds (id, agent_id, workspace_id, round, action, done, interest_score, tools_used, thinking_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent_id, round) DO UPDATE SET
         action = excluded.action,
         done = excluded.done,
         interest_score = excluded.interest_score,
         tools_used = excluded.tools_used,
         thinking_time = excluded.thinking_time`,
    )
    .run(
      id,
      agentId,
      workspaceId,
      round,
      action,
      done ? 1 : 0,
      interestScore,
      toolsUsed ? JSON.stringify(toolsUsed) : null,
      thinkingTime,
      now,
    );
}

export function getAgentRound(
  agentId: string,
  round: number,
): AgentRoundRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM agent_rounds WHERE agent_id = ? AND round = ?`)
    .get(agentId, round) as {
    id: string;
    agent_id: string;
    workspace_id: string;
    round: number;
    action: string;
    done: number;
    interest_score: number;
    tools_used: string | null;
    thinking_time: number | null;
    created_at: number;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    workspaceId: row.workspace_id,
    round: row.round,
    action: row.action as ActionType,
    done: row.done === 1,
    interestScore: row.interest_score,
    toolsUsed: row.tools_used ? (JSON.parse(row.tools_used) as string[]) : null,
    thinkingTime: row.thinking_time,
    createdAt: row.created_at,
  };
}

export function getPreviousRoundInterestScores(
  workspaceId: string,
  round: number,
): Map<string, number> {
  const prevRound = round - 1;
  if (prevRound < 1) return new Map();
  const rows = getDb()
    .prepare(
      `SELECT agent_id, interest_score FROM agent_rounds WHERE workspace_id = ? AND round = ?`,
    )
    .all(workspaceId, prevRound) as Array<{ agent_id: string; interest_score: number }>;
  return new Map(rows.map((r) => [r.agent_id, r.interest_score]));
}

export function resetDoneForRound(workspaceId: string, round: number): void {
  getDb()
    .prepare(
      `UPDATE agent_rounds SET done = 0 WHERE workspace_id = ? AND round = ?`,
    )
    .run(workspaceId, round);
}

export function getRoundSummaries(workspaceId: string): Array<{
  round: number;
  actions: Record<string, ActionType>;
  doneCount: number;
  activeCount: number;
}> {
  const rows = getDb()
    .prepare(
      `SELECT ar.round, ar.action, ar.done, a.role FROM agent_rounds ar
       JOIN agents a ON a.id = ar.agent_id
       WHERE ar.workspace_id = ? ORDER BY ar.round, a.role`,
    )
    .all(workspaceId) as Array<{
    round: number;
    action: string;
    done: number;
    role: string;
  }>;

  const byRound = new Map<
    number,
    { actions: Record<string, ActionType>; doneCount: number; roles: Set<string> }
  >();
  for (const row of rows) {
    let entry = byRound.get(row.round);
    if (!entry) {
      entry = { actions: {}, doneCount: 0, roles: new Set() };
      byRound.set(row.round, entry);
    }
    entry.actions[row.role] = row.action as ActionType;
    if (row.done === 1) entry.doneCount += 1;
    entry.roles.add(row.role);
  }

  return [...byRound.entries()].map(([round, e]) => ({
    round,
    actions: e.actions,
    doneCount: e.doneCount,
    activeCount: e.roles.size,
  }));
}

// --- Reactions ---

export function upsertReaction(
  messageId: string,
  agentId: string,
  type: ReactionType,
): ReactionRecord {
  const id = uuid();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO reactions (id, message_id, agent_id, type, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(message_id, agent_id) DO UPDATE SET type = excluded.type`,
    )
    .run(id, messageId, agentId, type, now);
  const agent = getAgent(agentId);
  return {
    id,
    messageId,
    agentId,
    type,
    createdAt: now,
    role: agent?.role,
  };
}

export function getReactionsForWorkspace(
  workspaceId: string,
): Record<string, ReactionRecord[]> {
  const channel = getGeneralChannel(workspaceId);
  if (!channel) return {};
  const rows = getDb()
    .prepare(
      `SELECT r.*, a.role FROM reactions r
       JOIN messages m ON m.id = r.message_id
       JOIN agents a ON a.id = r.agent_id
       WHERE m.channel_id = ?`,
    )
    .all(channel.id) as Array<{
    id: string;
    message_id: string;
    agent_id: string;
    type: string;
    created_at: number;
    role: string;
  }>;

  const result: Record<string, ReactionRecord[]> = {};
  for (const row of rows) {
    const rec: ReactionRecord = {
      id: row.id,
      messageId: row.message_id,
      agentId: row.agent_id,
      type: row.type as ReactionType,
      createdAt: row.created_at,
      role: row.role,
    };
    if (!result[row.message_id]) result[row.message_id] = [];
    result[row.message_id]!.push(rec);
  }
  return result;
}

// --- AI usage ---

export interface AiCallInsert {
  id: string;
  workspaceId: string | null;
  agentId: string | null;
  role: string | null;
  callType: string;
  model: string;
  round: number | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  durationMs: number;
  createdAt: number;
}

export function insertAiCall(row: AiCallInsert): void {
  getDb()
    .prepare(
      `INSERT INTO ai_calls (
        id, workspace_id, agent_id, role, call_type, model, round,
        prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.workspaceId,
      row.agentId,
      row.role,
      row.callType,
      row.model,
      row.round,
      row.promptTokens,
      row.completionTokens,
      row.totalTokens,
      row.costUsd,
      row.durationMs,
      row.createdAt,
    );
}

export function listAiCalls(limit = 500, workspaceId?: string): AiCallRecord[] {
  const sql = workspaceId
    ? `SELECT * FROM ai_calls WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM ai_calls ORDER BY created_at DESC LIMIT ?`;
  const rows = (workspaceId
    ? getDb().prepare(sql).all(workspaceId, limit)
    : getDb().prepare(sql).all(limit)) as Array<{
    id: string;
    workspace_id: string | null;
    agent_id: string | null;
    role: string | null;
    call_type: string;
    model: string;
    round: number | null;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number | null;
    duration_ms: number;
    created_at: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    agentId: r.agent_id,
    role: r.role,
    callType: r.call_type as AiCallType,
    model: r.model,
    round: r.round,
    promptTokens: r.prompt_tokens,
    completionTokens: r.completion_tokens,
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }));
}

export function getAiUsageSummary(workspaceId?: string): AiUsageSummary {
  const where = workspaceId ? 'WHERE workspace_id = ?' : '';
  const params = workspaceId ? [workspaceId] : [];
  const totals = getDb()
    .prepare(
      `SELECT COUNT(*) as calls, COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(cost_usd), 0) as cost
       FROM ai_calls ${where}`,
    )
    .get(...params) as { calls: number; tokens: number; cost: number };

  const byRoleRows = getDb()
    .prepare(
      `SELECT role, COUNT(*) as calls, COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(cost_usd), 0) as cost
       FROM ai_calls ${where} GROUP BY role`,
    )
    .all(...params) as Array<{ role: string | null; calls: number; tokens: number; cost: number }>;

  const byModelRows = getDb()
    .prepare(
      `SELECT model, COUNT(*) as calls, COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(cost_usd), 0) as cost
       FROM ai_calls ${where} GROUP BY model`,
    )
    .all(...params) as Array<{ model: string; calls: number; tokens: number; cost: number }>;

  const byRole: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
  for (const r of byRoleRows) {
    const key = r.role ?? '—';
    byRole[key] = { calls: r.calls, tokens: r.tokens, costUsd: r.cost };
  }

  const byModel: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
  for (const r of byModelRows) {
    byModel[r.model] = { calls: r.calls, tokens: r.tokens, costUsd: r.cost };
  }

  return {
    totalCalls: totals.calls,
    totalTokens: totals.tokens,
    totalCostUsd: totals.cost,
    byRole,
    byModel,
  };
}
