CREATE TABLE IF NOT EXISTS workspaces (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  company_context  TEXT,
  created_at       INTEGER NOT NULL,
  ended_at         INTEGER
);

CREATE TABLE IF NOT EXISTS personas (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  title           TEXT,
  photo_filename  TEXT,
  model           TEXT NOT NULL,
  persona         TEXT NOT NULL,
  base_delay_min  INTEGER NOT NULL DEFAULT 8000,
  base_delay_max  INTEGER NOT NULL DEFAULT 30000,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  persona_id    TEXT NOT NULL REFERENCES personas(id),
  role          TEXT NOT NULL,
  model         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  joined_round  INTEGER NOT NULL DEFAULT 1,
  left_round    INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dm_members (
  channel_id    TEXT NOT NULL REFERENCES channels(id),
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  PRIMARY KEY (channel_id, agent_id)
);

/** Group / public channel membership (future breakout rooms). #general uses all active agents. */
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id    TEXT NOT NULL REFERENCES channels(id),
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  PRIMARY KEY (channel_id, agent_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  channel_id    TEXT NOT NULL REFERENCES channels(id),
  agent_id      TEXT,
  parent_id     TEXT REFERENCES messages(id),
  content       TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'message',
  created_at    INTEGER NOT NULL,
  round         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mentions (
  id            TEXT PRIMARY KEY,
  message_id    TEXT NOT NULL REFERENCES messages(id),
  agent_id      TEXT NOT NULL REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  type            TEXT NOT NULL,
  content         TEXT NOT NULL,
  target_agent_id TEXT REFERENCES agents(id),
  injected_by     TEXT NOT NULL,
  injected_at     INTEGER NOT NULL,
  round           INTEGER NOT NULL,
  fetched_content TEXT
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id),
  episodic_summary  TEXT,
  private_notes     TEXT,
  current_position  TEXT,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_rounds (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  round           INTEGER NOT NULL,
  action          TEXT NOT NULL,
  done            INTEGER NOT NULL DEFAULT 0,
  interest_score  REAL NOT NULL DEFAULT 1.0,
  tools_used      TEXT,
  thinking_time   INTEGER,
  created_at      INTEGER NOT NULL,
  UNIQUE(agent_id, round)
);

CREATE TABLE IF NOT EXISTS reactions (
  id          TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL REFERENCES messages(id),
  agent_id    TEXT NOT NULL REFERENCES agents(id),
  type        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE(message_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_round   ON messages(round);
CREATE INDEX IF NOT EXISTS idx_agent_rounds_ws  ON agent_rounds(workspace_id, round);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id, status);

CREATE TABLE IF NOT EXISTS ai_calls (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT REFERENCES workspaces(id),
  agent_id            TEXT REFERENCES agents(id),
  role                TEXT,
  call_type           TEXT NOT NULL,
  model               TEXT NOT NULL,
  round               INTEGER,
  prompt_tokens       INTEGER NOT NULL DEFAULT 0,
  completion_tokens   INTEGER NOT NULL DEFAULT 0,
  total_tokens        INTEGER NOT NULL DEFAULT 0,
  cost_usd            REAL,
  duration_ms         INTEGER NOT NULL,
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_calls_workspace ON ai_calls(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created ON ai_calls(created_at DESC);
