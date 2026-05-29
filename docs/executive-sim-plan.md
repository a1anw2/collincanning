# Cannery - Implementation Plan

AI-powered executive channel simulation. Agents with distinct personas discuss
articles and topics in real time. Built with TypeScript, Fastify, React, SQLite,
and OpenRouter. The public UI is a read-only Slack clone. Viewers watch the
story unfold as it happens.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript 5+, strict mode |
| Server | Fastify 4 |
| SSE | @fastify/sse-v2 |
| Auth | @fastify/basic-auth |
| Static serving | @fastify/static |
| Database | better-sqlite3 |
| AI | openai SDK pointed at OpenRouter |
| Article extraction | node-fetch + @mozilla/readability + jsdom |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v3 |
| Components | shadcn/ui (Radix UI primitives + Tailwind) |
| Routing | react-router-dom v6 |
| ID generation | uuid |
| Environment | dotenv |

---

## Project Structure

```
/cannery
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  components.json              <- shadcn/ui config
  .env.example
  /src
    /server
      index.ts
      db.ts
      broker.ts
      orchestrator.ts
      registry.ts
      channel.ts
      memory.ts
      delay.ts
      openrouter.ts
      /agents
        base.ts
        factory.ts
      /tools
        index.ts
        fetchArticle.ts
        webSearch.ts
      /routes
        events.ts
        api.ts
        admin.ts
      /prompts
        mechanics.ts
        format.ts
        onboarding.ts
        summarize.ts
    /frontend
      index.html
      main.tsx
      App.tsx
      /pages
        Viewer.tsx              <- read-only Slack-clone channel view
        Admin.tsx               <- admin shell with nested routes
        AdminLogin.tsx          <- basic auth trigger page
      /admin
        Dashboard.tsx
        Personas.tsx
        PersonaEditor.tsx
        Agents.tsx
        Artifacts.tsx
        SimControl.tsx
      /components
        /ui                     <- shadcn/ui primitives (Button, Input, Badge, etc.)
          button.tsx
          input.tsx
          textarea.tsx
          badge.tsx
          avatar.tsx
          separator.tsx
          scroll-area.tsx
          tooltip.tsx
          dialog.tsx
          label.tsx
          card.tsx
        /layout
          SlackLayout.tsx       <- three-column shell (sidebar, channel, details)
          Sidebar.tsx           <- workspace name, channel list, agent list
          ChannelPane.tsx       <- scrollable message feed
          DetailPane.tsx        <- positions, artifacts, round info
        /channel
          MessageFeed.tsx       <- virtualized message list
          MessageBubble.tsx     <- single message with avatar, role, timestamp
          SystemMessage.tsx     <- join/leave/injection system lines
          TypingIndicator.tsx   <- animated dots, shows active thinkers
          ToolUseNotice.tsx     <- inline "CFO searched the web for..."
          PrivateMessageBubble.tsx  <- DM with lock badge, redact toggle
          InjectionBanner.tsx   <- new URL or talking point dropped in
        /sidebar
          WorkspaceHeader.tsx   <- workspace name + sim status dot
          ChannelList.tsx       <- #general and any DM channels
          AgentItem.tsx         <- avatar, role, online/thinking/away indicator
        /detail
          PositionCard.tsx      <- agent current stance
          ArtifactList.tsx      <- URLs and talking points in play
          RoundCounter.tsx      <- current round, end condition
        /admin
          PersonaForm.tsx       <- shared form for create and edit
          AgentRoster.tsx       <- active agents table with controls
          InjectionForm.tsx     <- URL and topic injection inputs
          SimStatusBar.tsx      <- running/stopped, round, stop button
      /hooks
        useSSE.ts               <- SSE connection, event routing, state
        useHistory.ts           <- hydrates messages on load
        useWorkspace.ts         <- workspace and agent metadata
        useAdminAuth.ts         <- tracks basic auth state
      /lib
        utils.ts                <- cn() helper and shared utilities
        formatters.ts           <- timestamps, role display names
        constants.ts            <- role colors, avatar initials
      /types
        index.ts                <- re-exports from shared types
  /shared
    types.ts                    <- types used by both server and frontend
  /schema
    init.sql
    seed.sql
```

---

## Tailwind Configuration

File: `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/frontend/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Slack-inspired dark theme palette
        slack: {
          aubergine:  '#4A154B',  // sidebar background
          'aubergine-dark': '#3F0E40',
          hover:      '#350D36',
          active:     '#1164A3',
          text:       '#D1D2D3',
          'text-dim': '#868686',
          surface:    '#1A1D21',  // main background
          'surface-raised': '#222529',
          border:     '#383B3D',
          mention:    '#F2C744',
        }
      },
      fontFamily: {
        sans: ['Lato', 'ui-sans-serif', 'system-ui'],
        mono: ['ui-monospace', 'SFMono-Regular']
      },
      animation: {
        'typing-bounce': 'typing-bounce 1.2s ease-in-out infinite'
      },
      keyframes: {
        'typing-bounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' }
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
} satisfies Config;
```

---

## shadcn/ui Setup

File: `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/frontend/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

Install base components up front:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input textarea badge avatar
npx shadcn-ui@latest add separator scroll-area tooltip dialog label card
```

All shadcn components land in `src/frontend/components/ui/`. Do not modify them
directly. Override via Tailwind classes at the usage site.

---

## Shared Types

File: `shared/types.ts`

```typescript
export type AgentRole = string;

export type AgentStatus = 'active' | 'away' | 'left';

export type MessageType = 'message' | 'system' | 'injection';

export type ArtifactType = 'url' | 'talking_point';

export type ActionType = 'speak' | 'private' | 'pass' | 'leave';

export type ReactionType = 'agree' | 'disagree' | 'interesting' | 'question';

export type SSEEventType =
  | 'message:public'
  | 'message:private'
  | 'message:system'
  | 'agent:thinking'
  | 'agent:tool'
  | 'agent:join'
  | 'agent:leave'
  | 'artifact:inject'
  | 'position:update'
  | 'round:start'
  | 'round:end'
  | 'sim:end';

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  endedAt: number | null;
}

export interface PersonaRecord {
  id: string;
  role: string;
  displayName: string;
  model: string;
  persona: string;
  baseDelayMin: number;
  baseDelayMax: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentRecord {
  id: string;
  workspaceId: string;
  personaId: string;
  role: string;
  model: string;
  status: AgentStatus;
  joinedRound: number;
  leftRound: number | null;
  createdAt: number;
}

export interface MessageRecord {
  id: string;
  channelId: string;
  agentId: string | null;
  parentId: string | null;
  content: string;
  type: MessageType;
  createdAt: number;
  round: number;
  role?: string;           // joined from agents table for display
  displayName?: string;    // joined from personas table
}

export interface ArtifactRecord {
  id: string;
  workspaceId: string;
  type: ArtifactType;
  content: string;
  targetAgentId: string | null;
  injectedBy: string;
  injectedAt: number;
  round: number;
  fetchedContent: string | null;
}

export interface AgentMemory {
  id: string;
  agentId: string;
  workspaceId: string;
  episodicSummary: string | null;
  privateNotes: string | null;
  currentPosition: string | null;
  updatedAt: number;
}

export interface AgentRoundRecord {
  id: string;
  agentId: string;
  workspaceId: string;
  round: number;
  action: ActionType;
  done: boolean;
  interestScore: number;
  toolsUsed: string[] | null;
  thinkingTime: number | null;
  createdAt: number;
}

export interface AgentResponse {
  action: ActionType;
  to?: string;
  content?: string;
  done: boolean;
  currentPosition?: string;
  internalNotes?: string;
}

// SSE event payloads
export interface PublicMessageEvent extends MessageRecord {}

export interface PrivateMessageEvent {
  id: string;
  from: string;
  fromDisplayName: string;
  to: string;
  content: string;
  round: number;
  createdAt: number;
}

export interface AgentThinkingEvent {
  role: string;
  displayName: string;
}

export interface AgentToolEvent {
  role: string;
  toolName: string;
  input: string;
}

export interface AgentJoinEvent {
  role: string;
  displayName: string;
  round: number;
}

export interface AgentLeaveEvent {
  role: string;
  round: number;
}

export interface ArtifactInjectEvent extends ArtifactRecord {}

export interface PositionUpdateEvent {
  role: string;
  displayName: string;
  position: string;
}

export interface RoundEvent {
  round: number;
}

export interface SimEndEvent {
  round: number;
  reason: 'consensus' | 'silence';
}
```

---

## Database Schema

File: `schema/init.sql`

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  ended_at     INTEGER
);

CREATE TABLE IF NOT EXISTS personas (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
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
```

File: `schema/seed.sql`

```sql
INSERT OR IGNORE INTO personas
  (id, role, display_name, model, persona, base_delay_min, base_delay_max, created_at, updated_at)
VALUES
(
  'persona-ceo', 'CEO', 'Chief Executive Officer',
  'anthropic/claude-opus-4',
  'You are the CEO. You think strategically and long-term. You connect external developments to company direction and competitive position. You are decisive, occasionally impatient with detail, and focused on the big picture. You speak with authority but you listen. You are comfortable with ambiguity. Your first instinct when reading any article is to ask what this means for where the company is going.',
  8000, 25000, unixepoch() * 1000, unixepoch() * 1000
),
(
  'persona-cfo', 'CFO', 'Chief Financial Officer',
  'openai/gpt-4o',
  'You are the CFO. You are financially rigorous and skeptical of hype. You focus on risk, return, and cost structure. You challenge assumptions, ask for evidence, and quantify everything you can. You are direct and occasionally blunt but not hostile. You rarely speak first but when you do, people pay attention. Your first instinct when reading any article is to assess financial exposure and what it costs or saves.',
  15000, 45000, unixepoch() * 1000, unixepoch() * 1000
),
(
  'persona-cto', 'CTO', 'Chief Technology Officer',
  'google/gemini-2.5-pro',
  'You are the CTO. Technical accuracy matters to you. You distinguish between genuine capability and marketing language. You flag implementation reality versus theoretical potential. You think in systems, constraints, and second-order effects. You engage early when the topic is technical and hold back when it is not. Your first instinct when reading any article is to assess whether the technical claims stack up.',
  10000, 35000, unixepoch() * 1000, unixepoch() * 1000
),
(
  'persona-cmo', 'CMO', 'Chief Marketing Officer',
  'anthropic/claude-sonnet-4',
  'You are the CMO. You think in narrative, brand, and customer perception. You connect external trends to go-to-market opportunity. You are enthusiastic but not naive and you respect financial constraints even when you push against them. You tend to engage early and often. You like to build consensus but you will defend a position. Your first instinct when reading any article is to ask what this means for how customers see us.',
  5000, 20000, unixepoch() * 1000, unixepoch() * 1000
);
```

---

## Frontend UX - Slack Clone (Read-Only)

The viewer is a faithful Slack dark-theme clone. No input boxes, no send buttons.
Everything is display only. The only interactive elements are tooltips on hover
and the private message redact toggle in the detail pane.

### Three-column layout (`src/frontend/components/layout/SlackLayout.tsx`)

```
┌──────────────┬──────────────────────────────────┬─────────────────────┐
│   Sidebar    │        Channel Pane              │    Detail Pane      │
│   200px      │        flex-1                    │    280px            │
│   bg-auberg. │        bg-surface                │    bg-surface-raised│
└──────────────┴──────────────────────────────────┴─────────────────────┘
```

All three columns are full viewport height. Channel pane scrolls independently.
The layout never reflows or moves when new messages arrive. Auto-scroll to bottom
on new messages unless the user has scrolled up, in which case show a "jump to
latest" button.

### Sidebar (`src/frontend/components/sidebar/`)

```
Collins Canning Co.          ← WorkspaceHeader, bold, white text
● LIVE  Round 4              ← green pulsing dot when sim running

Channels
  # general                  ← active channel, highlighted

Direct Messages              ← section only shown if DMs exist
  CFO → CEO                  ← padlock icon, dimmed

Participants
  C  CEO                     ← Avatar initial, role name
     Watching carefully...   ← current position, truncated, dim text
  F  CFO
     Revenue risk is real    
  T  CTO  [thinking...]      ← animated dots when agent is thinking
  M  CMO
```

Agent status indicators:
- Green dot: active, last message recent
- Animated pulsing dot: currently thinking (between agent:thinking and next message event)
- Grey dot: passed last round
- Dim text + strikethrough: left the conversation

### Channel pane (`src/frontend/components/channel/`)

Header:
```
# general                                    Round 4 of ?   ● LIVE
─────────────────────────────────────────────────────────────────
```

Message feed - each message renders as a `MessageBubble`:

```
[C]  CEO  Today at 12:03
     The strategic angle here is clear. This shifts the competitive
     landscape in a way that directly affects our Q3 roadmap...
```

- Avatar is a colored circle with the role initial. Each role gets a consistent
  color derived from the role string (defined in `src/frontend/lib/constants.ts`).
- Role name in bold white, timestamp in dim text beside it.
- Message body in `text-slack-text`, full width.
- Consecutive messages from the same agent within 5 minutes collapse the avatar
  and name, showing only the message body indented, matching Slack behavior.

System messages render as a centered dim line:
```
────────  CEO has joined the channel  ────────
```

Tool use renders as an inline dim notice between messages:
```
[search icon]  CFO searched the web for "AI infrastructure costs 2025"
```

Injection banners render as a highlighted block:
```
┌─────────────────────────────────────────────────────┐
│  [link icon]  New article dropped in                │
│  https://example.com/article                        │
└─────────────────────────────────────────────────────┘
```

Typing indicators appear at the bottom of the feed when one or more agents are thinking:
```
[C][F]  CEO and CFO are thinking...
```

### Detail pane (`src/frontend/components/detail/`)

```
Stances
─────────────────────────────
CEO   "Watching carefully"
CFO   "Revenue risk is real"
CTO   "Claims don't add up"
CMO   "Big opportunity"

Artifacts
─────────────────────────────
[link]  https://article.com
        Dropped in Round 1

[quote] Is this a regulatory risk?
        Directed at CTO · Round 3

Round
─────────────────────────────
Round 4
Silence counter: 0 / 2
All done: 2 / 4
```

Private messages section (bottom of detail pane, only shown if DMs exist):
```
Private Messages
─────────────────────────────
[lock]  CFO → CEO  Round 2
        [Content hidden]     ← default
        [Show]               ← toggle, controlled by SHOW_PRIVATE_MESSAGES env
```

---

## Component Specifications

### `MessageBubble.tsx`

Props:
```typescript
interface MessageBubbleProps {
  message: MessageRecord;
  isCollapsed: boolean;   // consecutive same-sender collapse
  showRound?: boolean;    // optional round badge on first message of a round
}
```

Uses: `Avatar` (shadcn), `Tooltip` (shadcn, shows full timestamp on hover),
role color from `constants.ts`.

### `TypingIndicator.tsx`

Props:
```typescript
interface TypingIndicatorProps {
  agents: Array<{ role: string; displayName: string }>;
}
```

Three animated dots per active thinker. Uses CSS `animation-delay` to stagger
the bounce. Shows up to 3 avatars, then "+N more" if needed.

### `AgentItem.tsx`

Props:
```typescript
interface AgentItemProps {
  agent: AgentRecord & { displayName: string; currentPosition: string | null };
  isThinking: boolean;
}
```

### `PersonaForm.tsx`

Shared between create and edit. Fields:
- Display name (Input)
- Role (Input, readonly on edit)
- Model (Input, OpenRouter model string)
- Persona text (Textarea, large, monospace font)
- Base delay min / max (two number Inputs, shown as seconds in the UI,
  stored as ms in the DB)

On save, calls `PUT /admin/personas/:id` or `POST /admin/personas`.
Shows a success toast and notes that changes take effect on the next round.

### `InjectionForm.tsx`

Two separate forms on the same page:

URL injection:
- URL input
- Submit button: "Drop into channel"

Talking point injection:
- Text input for the talking point
- Optional role selector (dropdown of active agents) for directed points
- Submit button: "Inject talking point"

### `SimStatusBar.tsx`

Sticky bar at top of admin pages showing:
- Sim status (running / stopped)
- Current round
- Active agent count
- Stop button (confirms before stopping)

---

## Role Color Map

File: `src/frontend/lib/constants.ts`

Each role gets a consistent avatar background color and text color. These are
Tailwind color classes, not arbitrary values, so they are included in the
safelist if needed.

```typescript
export const ROLE_COLORS: Record<string, { bg: string; text: string; initial: string }> = {
  CEO: { bg: 'bg-violet-600',  text: 'text-white', initial: 'C' },
  CFO: { bg: 'bg-emerald-600', text: 'text-white', initial: 'F' },
  CTO: { bg: 'bg-blue-600',    text: 'text-white', initial: 'T' },
  CMO: { bg: 'bg-rose-600',    text: 'text-white', initial: 'M' },
};

export function getRoleColor(role: string) {
  return ROLE_COLORS[role] ?? { bg: 'bg-slate-600', text: 'text-white', initial: role[0] ?? '?' };
}
```

---

## SSE Hook

File: `src/frontend/hooks/useSSE.ts`

```typescript
import { useEffect, useReducer } from 'react';
import type {
  MessageRecord, AgentRecord, ArtifactRecord,
  PositionUpdateEvent, AgentThinkingEvent, AgentToolEvent,
  SimEndEvent
} from '../../../shared/types';

interface SimState {
  messages: MessageRecord[];
  agents: AgentRecord[];
  positions: Map<string, string>;
  thinking: Set<string>;
  toolUse: Map<string, string>;
  artifacts: ArtifactRecord[];
  round: number;
  ended: boolean;
  endReason: string | null;
}

// useReducer keeps SSE state updates predictable and avoids stale closures
type SimAction =
  | { type: 'HYDRATE'; messages: MessageRecord[] }
  | { type: 'MESSAGE'; message: MessageRecord }
  | { type: 'THINKING'; role: string; displayName: string }
  | { type: 'TOOL_USE'; role: string; toolName: string; input: string }
  | { type: 'AGENT_JOIN'; agent: AgentRecord }
  | { type: 'AGENT_LEAVE'; role: string }
  | { type: 'POSITION_UPDATE'; role: string; position: string }
  | { type: 'ARTIFACT'; artifact: ArtifactRecord }
  | { type: 'ROUND_START'; round: number }
  | { type: 'SIM_END'; round: number; reason: string };

export function useSSE(workspaceId: string) {
  const [state, dispatch] = useReducer(simReducer, initialState);

  useEffect(() => {
    fetch(`/api/history/${workspaceId}`)
      .then(r => r.json())
      .then((messages: MessageRecord[]) => dispatch({ type: 'HYDRATE', messages }));

    const es = new EventSource('/events');

    es.addEventListener('message:public', e => {
      const msg = JSON.parse(e.data) as MessageRecord;
      dispatch({ type: 'MESSAGE', message: msg });
      dispatch({ type: 'THINKING', role: msg.role ?? '', displayName: '' }); // clears indicator
    });

    es.addEventListener('agent:thinking', e => {
      const d = JSON.parse(e.data) as AgentThinkingEvent;
      dispatch({ type: 'THINKING', role: d.role, displayName: d.displayName });
    });

    es.addEventListener('agent:tool', e => {
      const d = JSON.parse(e.data) as AgentToolEvent;
      dispatch({ type: 'TOOL_USE', role: d.role, toolName: d.toolName, input: d.input });
    });

    es.addEventListener('position:update', e => {
      const d = JSON.parse(e.data) as PositionUpdateEvent;
      dispatch({ type: 'POSITION_UPDATE', role: d.role, position: d.position });
    });

    es.addEventListener('artifact:inject', e => {
      const d = JSON.parse(e.data) as ArtifactRecord;
      dispatch({ type: 'ARTIFACT', artifact: d });
    });

    es.addEventListener('round:start', e => {
      const d = JSON.parse(e.data) as { round: number };
      dispatch({ type: 'ROUND_START', round: d.round });
    });

    es.addEventListener('sim:end', e => {
      const d = JSON.parse(e.data) as SimEndEvent;
      dispatch({ type: 'SIM_END', round: d.round, reason: d.reason });
    });

    return () => es.close();
  }, [workspaceId]);

  return state;
}
```

---

## Auto-scroll Behavior

File: `src/frontend/components/channel/MessageFeed.tsx`

Track whether the user has scrolled up manually. If they are within 100px of the
bottom, auto-scroll on new messages. If they have scrolled up, show a floating
"Jump to latest" button anchored to the bottom-right of the channel pane. Clicking
it scrolls to bottom and re-enables auto-scroll.

```typescript
const isNearBottom = () => {
  const el = scrollRef.current;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
};
```

Use `useRef` for the scroll container and `useEffect` on messages length to trigger
scroll when auto-scroll is active.

---

## Admin Area

The admin area is behind `/admin` in React Router. Any request to `/admin/*` API
routes requires HTTP Basic Auth (Fastify `@fastify/basic-auth`). The browser
handles the credential dialog natively on the first 401.

`useAdminAuth.ts` fires a GET to `/admin/sim/status` on mount. If it resolves,
auth is confirmed and the admin UI renders. If it rejects, show a plain login
prompt that re-triggers the credential attempt.

Admin pages use the same Tailwind dark theme but with a lighter surface color to
visually distinguish them from the public viewer. The sidebar is replaced with a
simple top nav:

```
Cannery Admin
Dashboard  |  Personas  |  Sim Control  |  ← back to viewer
```

---

## Fastify Server

File: `src/server/index.ts`

```typescript
import Fastify from 'fastify';
import basicAuth from '@fastify/basic-auth';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import path from 'path';
import { eventsRoute } from './routes/events.js';
import { apiRoutes } from './routes/api.js';
import { adminRoutes } from './routes/admin.js';

const app = Fastify({ logger: true });

await app.register(basicAuth, {
  validate(username, password, _req, _reply, done) {
    const ok =
      username === process.env['ADMIN_USER'] &&
      password === process.env['ADMIN_PASSWORD'];
    done(ok ? undefined : new Error('Unauthorized'));
  },
  authenticate: true
});

await app.register(cors, { origin: true });

await app.register(staticFiles, {
  root: path.join(import.meta.dirname, '../../dist/frontend'),
  prefix: '/'
});

await app.register(eventsRoute, { prefix: '/events' });
await app.register(apiRoutes,   { prefix: '/api' });
await app.register(adminRoutes, { prefix: '/admin' });

// SPA fallback - serve index.html for all unmatched routes
app.setNotFoundHandler((_req, reply) => {
  reply.sendFile('index.html');
});

await app.listen({ port: Number(process.env['PORT'] ?? 3000) });
```

---

## API Routes

### Public (`src/server/routes/api.ts`)

| Method | Path | Returns |
|---|---|---|
| GET | /api/workspace/:id | Workspace + active agents + current round |
| GET | /api/history/:workspaceId | Full public message history with role/displayName joined |
| GET | /api/positions/:workspaceId | Current position per agent |
| GET | /api/rounds/:workspaceId | Per-round summary |

### Admin (`src/server/routes/admin.ts`)

All routes use `{ onRequest: [app.basicAuth] }` per route or on the plugin.

| Method | Path | Action |
|---|---|---|
| GET | /admin/personas | List all personas |
| GET | /admin/personas/:id | Single persona |
| POST | /admin/personas | Create persona |
| PUT | /admin/personas/:id | Update persona, takes effect next round |
| DELETE | /admin/personas/:id | Delete (blocked if in active sim) |
| GET | /admin/sim/status | Current sim state |
| POST | /admin/sim/start | Start: `{ personaIds, initialUrl, workspaceName }` |
| POST | /admin/sim/stop | Stop gracefully |
| POST | /admin/sim/inject/url | `{ url }` |
| POST | /admin/sim/inject/topic | `{ content, targetRole? }` |
| POST | /admin/sim/agents/add | `{ personaId }` |
| POST | /admin/sim/agents/remove | `{ role }` |
| POST | /admin/sim/agents/away | `{ role }` |
| POST | /admin/sim/agents/back | `{ role }` |

---

## Agent System Prompt Composition

Persona is loaded fresh from DB on every `agent.think()` call. Admin edits take
effect on the next round automatically with no restart.

```typescript
private buildSystemPrompt(): string {
  const persona = db.getPersona(this.record.personaId);
  if (!persona) throw new Error(`Persona ${this.record.personaId} not found`);
  return [persona.persona, mechanics, format].join('\n\n');
}
```

### Mechanics prompt (`src/server/prompts/mechanics.ts`)

```
You are participating in a group executive channel with other C-suite colleagues.
A URL has been shared for discussion. You have tools to fetch articles and search
the web for additional context.

The full public conversation history and any private messages addressed to you
will be shown before your turn. React to what others have said, not just the
original article. Address colleagues by their role when responding directly.

You have a budget of 2 tool calls per turn. Use them when they genuinely
change or support your argument.

A moderator may introduce new URLs or talking points during the conversation.
Treat these as significant new input. Set done to false if a new artifact has
been introduced since your last turn.

You may leave the conversation if your contribution is complete and the
discussion no longer requires your expertise. Prefer pass if temporarily
disengaged.
```

### Format prompt (`src/server/prompts/format.ts`)

```
Always respond with a single valid JSON object. No preamble, no text outside the JSON.

{
  "action": "speak" | "private" | "pass" | "leave",
  "to": "<role, only if action is private>",
  "content": "<your message, omit if action is pass>",
  "done": true | false,
  "currentPosition": "<one sentence summary of your current stance>",
  "internalNotes": "<your private reasoning, never shown to others>"
}

Rules:
- speak posts to the public channel
- private sends only to the person named in to
- pass means nothing to add this turn
- leave exits the conversation permanently this session
- Set done true only when you genuinely believe the conversation has concluded
- Never fabricate what others have said
- internalNotes is carried forward to your next turn only, never shared
```

---

## OpenRouter Client

File: `src/server/openrouter.ts`

```typescript
import OpenAI from 'openai';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://cannery.local',
    'X-Title': 'Cannery'
  }
});
```

---

## Environment Variables

File: `.env.example`

```
OPENROUTER_API_KEY=
BRAVE_SEARCH_API_KEY=
PORT=3000
DB_PATH=./cannery.db
ADMIN_USER=admin
ADMIN_PASSWORD=changeme
SUMMARIZE_EVERY_N_ROUNDS=3
WORKING_MEMORY_MESSAGES=10
MAX_TOOL_CALLS_PER_TURN=2
SILENCE_ROUNDS_BEFORE_END=2
SHOW_PRIVATE_MESSAGES=false
```

---

## Dependencies

File: `package.json`

```json
{
  "name": "cannery",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev:server":   "tsx watch src/server/index.ts",
    "dev:frontend": "vite",
    "dev":          "concurrently \"npm run dev:server\" \"npm run dev:frontend\"",
    "build":        "tsc -p tsconfig.json && vite build",
    "db:init":      "tsx src/server/scripts/initDb.ts",
    "start":        "node dist/server/index.js"
  },
  "dependencies": {
    "openai":                   "^4.0.0",
    "fastify":                  "^4.0.0",
    "@fastify/basic-auth":      "^5.0.0",
    "@fastify/static":          "^7.0.0",
    "@fastify/cors":            "^9.0.0",
    "@fastify/sse-v2":          "^2.0.0",
    "better-sqlite3":           "^9.0.0",
    "node-fetch":               "^3.0.0",
    "@mozilla/readability":     "^0.5.0",
    "jsdom":                    "^24.0.0",
    "uuid":                     "^9.0.0",
    "dotenv":                   "^16.0.0",
    "react":                    "^18.0.0",
    "react-dom":                "^18.0.0",
    "react-router-dom":         "^6.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx":                     "^2.0.0",
    "tailwind-merge":           "^2.0.0",
    "@radix-ui/react-avatar":   "^1.0.0",
    "@radix-ui/react-tooltip":  "^1.0.0",
    "@radix-ui/react-dialog":   "^1.0.0",
    "@radix-ui/react-scroll-area": "^1.0.0"
  },
  "devDependencies": {
    "typescript":           "^5.0.0",
    "@types/node":          "^20.0.0",
    "@types/better-sqlite3": "^7.0.0",
    "@types/jsdom":         "^21.0.0",
    "@types/react":         "^18.0.0",
    "@types/react-dom":     "^18.0.0",
    "@types/uuid":          "^9.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite":                 "^5.0.0",
    "tailwindcss":          "^3.0.0",
    "tailwindcss-animate":  "^1.0.0",
    "autoprefixer":         "^10.0.0",
    "postcss":              "^8.0.0",
    "tsx":                  "^4.0.0",
    "concurrently":         "^8.0.0"
  }
}
```

---

## Vite Config

File: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/frontend'),
      '@shared': path.resolve(__dirname, 'shared')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api':    'http://localhost:3000',
      '/admin':  'http://localhost:3000',
      '/events': 'http://localhost:3000'
    }
  }
});
```

---

## Build Order for Cursor / Claude Code

Follow this sequence. Each step is independently testable before moving on.

1. Scaffold: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`,
   `postcss.config.js`, `components.json`, folder structure, `.env.example`

2. `schema/init.sql` + `schema/seed.sql` + `src/server/db.ts`
   Schema, init script, all typed query helper functions

3. `shared/types.ts`
   All shared types, no logic

4. `src/server/tools/`
   `fetchArticle.ts` and `webSearch.ts`, test independently with a URL before wiring in

5. `src/server/prompts/`
   All prompt strings as exported constants

6. `src/server/agents/base.ts` + `factory.ts`
   Single agent returning valid JSON via OpenRouter, no delays, test in isolation

7. `src/server/channel.ts`
   Message posting and retrieval against DB

8. `src/server/broker.ts`
   SSE broker singleton

9. `src/server/orchestrator.ts`
   Single round, two agents, no memory, no delays, verify messages hit DB

10. `src/server/routes/` + `src/server/index.ts`
    Fastify up, SSE endpoint live, verify raw events reach browser with curl

11. `src/frontend/` - base setup
    Vite, Tailwind, shadcn/ui init, `globals.css`, `App.tsx`, routing shell

12. `src/frontend/components/layout/`
    `SlackLayout.tsx`, `Sidebar.tsx`, `ChannelPane.tsx`, `DetailPane.tsx`
    with static placeholder content

13. `src/frontend/hooks/useSSE.ts` + `useHistory.ts`
    Wire up live data, replace placeholder content with real messages

14. `src/frontend/components/channel/`
    `MessageBubble.tsx`, `SystemMessage.tsx`, `TypingIndicator.tsx`,
    `ToolUseNotice.tsx`, `InjectionBanner.tsx`, `PrivateMessageBubble.tsx`

15. `src/frontend/components/sidebar/` + `src/frontend/components/detail/`
    Agent list, position cards, artifact list, round counter

16. `src/server/memory.ts`
    Episodic summarization and private notes

17. `src/server/registry.ts`
    Dynamic agent join/leave/away

18. `src/server/delay.ts`
    Natural delays, add last so iteration stays fast

19. `src/frontend/pages/Admin.tsx` + `src/frontend/admin/`
    Admin shell, persona list, persona editor, sim control, agent roster

---

## Key Invariants

- DB is the source of truth. All state lives there, not in memory.
- Persona loads fresh from DB on every agent `think()` call. Admin edits take effect next round.
- Agents never see each other's `internalNotes` or DMs not addressed to them.
- Broker publishes only, never reads. Write to DB first, then publish to broker.
- Tool results are never posted to the channel directly. The agent decides what to share.
- A new agent always receives an onboarding summary before their first `think()` call.
- Episodic summarization runs at the orchestrator level, not inside `agent.think()`.
- Admin routes always require basic auth, registered per-route via `onRequest` hook.
- `SHOW_PRIVATE_MESSAGES` controls viewer display only. Private messages are always stored in full.
- The viewer is entirely read-only. No input elements in the channel pane or sidebar.
- Auto-scroll disengages when the user scrolls up. A "Jump to latest" button re-engages it.
- Role colors are defined once in `constants.ts` and used consistently across all components.
- shadcn/ui components in `src/frontend/components/ui/` are never modified directly.
