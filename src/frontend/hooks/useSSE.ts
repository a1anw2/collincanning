/** SSE connection and sim state reducer for the viewer. */

import { useEffect, useReducer, useRef } from 'react';
import type {
  AgentRecord,
  ArtifactRecord,
  MessageRecord,
  PrivateMessageEvent,
  ReactionRecord,
  ReactionType,
} from '@shared/types';

interface SimState {
  messages: MessageRecord[];
  agents: AgentRecord[];
  positions: Map<string, string>;
  thinking: Map<string, string>;
  toolUse: Map<string, string>;
  artifacts: ArtifactRecord[];
  privateMessages: PrivateMessageEvent[];
  reactions: Record<string, ReactionRecord[]>;
  round: number;
  ended: boolean;
  endReason: string | null;
  running: boolean;
  workspaceName: string;
  companyContext: string | null;
  hydrated: boolean;
  hydrateKey: number;
}

/** One row per role; prefer hydrated UUID rows over SSE placeholders (id === role). */
function dedupeAgentsByRole(agents: AgentRecord[]): AgentRecord[] {
  const rank = (a: AgentRecord): number => {
    let score = 0;
    if (a.id !== a.role) score += 4;
    if (a.status === 'active') score += 2;
    else if (a.status === 'away') score += 1;
    return score;
  };
  const byRole = new Map<string, AgentRecord>();
  for (const agent of agents) {
    const prev = byRole.get(agent.role);
    if (!prev) {
      byRole.set(agent.role, agent);
      continue;
    }
    const keep =
      rank(agent) > rank(prev)
        ? agent
        : rank(agent) === rank(prev) && agent.createdAt >= prev.createdAt
          ? agent
          : prev;
    byRole.set(agent.role, keep);
  }
  return [...byRole.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function appendMessage(messages: MessageRecord[], msg: MessageRecord): MessageRecord[] {
  if (messages.some((m) => m.id === msg.id)) return messages;
  return [...messages, msg];
}

const initialState: SimState = {
  messages: [],
  agents: [],
  positions: new Map(),
  thinking: new Map(),
  toolUse: new Map(),
  artifacts: [],
  privateMessages: [],
  reactions: {},
  round: 0,
  ended: false,
  endReason: null,
  running: false,
  workspaceName: 'Cannery',
  companyContext: null,
  hydrated: false,
  hydrateKey: 0,
};

type SimAction =
  | { type: 'RESET' }
  | {
      type: 'HYDRATE_SNAPSHOT';
      messages: MessageRecord[];
      reactions: Record<string, ReactionRecord[]>;
      artifacts: ArtifactRecord[];
      positions: Map<string, string>;
      agents: AgentRecord[];
      workspaceName: string;
      companyContext: string | null;
      round: number;
      running: boolean;
    }
  | { type: 'SET_AGENTS'; agents: AgentRecord[] }
  | { type: 'SET_WORKSPACE'; name: string; companyContext: string | null }
  | { type: 'SET_META'; round: number; running: boolean }
  | { type: 'MESSAGE'; message: MessageRecord }
  | { type: 'SYSTEM_MESSAGE'; message: MessageRecord }
  | { type: 'PRIVATE_MESSAGE'; event: PrivateMessageEvent }
  | { type: 'THINKING'; role: string; displayName: string }
  | { type: 'CLEAR_THINKING'; role: string }
  | { type: 'TOOL_USE'; role: string; input: string }
  | { type: 'AGENT_JOIN'; agent: AgentRecord }
  | { type: 'AGENT_LEAVE'; role: string }
  | { type: 'POSITION_UPDATE'; role: string; position: string }
  | { type: 'ARTIFACT'; artifact: ArtifactRecord }
  | { type: 'REACTION'; messageId: string; role: string; reactionType: ReactionType }
  | { type: 'ROUND_START'; round: number }
  | { type: 'ROUND_END'; round: number }
  | { type: 'SIM_END'; round: number; reason: string }
  | { type: 'MEMORY_CLEAR' }
  | { type: 'THREAD_END'; round: number };

function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'RESET':
      return { ...initialState };
    case 'HYDRATE_SNAPSHOT':
      return {
        ...state,
        messages: action.messages,
        reactions: action.reactions,
        artifacts: action.artifacts,
        positions: action.positions,
        agents: dedupeAgentsByRole(action.agents),
        workspaceName: action.workspaceName,
        companyContext: action.companyContext,
        round: action.round,
        running: action.running,
        thinking: new Map(),
        toolUse: new Map(),
        hydrated: true,
        hydrateKey: state.hydrateKey + 1,
      };
    case 'SET_AGENTS':
      return { ...state, agents: dedupeAgentsByRole(action.agents) };
    case 'SET_WORKSPACE':
      return {
        ...state,
        workspaceName: action.name,
        companyContext: action.companyContext,
      };
    case 'SET_META':
      return { ...state, round: action.round, running: action.running };
    case 'MESSAGE': {
      const thinking = new Map(state.thinking);
      if (action.message.role) thinking.delete(action.message.role);
      return {
        ...state,
        messages: appendMessage(state.messages, action.message),
        thinking,
        toolUse: new Map(),
      };
    }
    case 'SYSTEM_MESSAGE':
      return {
        ...state,
        messages: appendMessage(state.messages, action.message),
      };
    case 'PRIVATE_MESSAGE':
      return { ...state, privateMessages: [...state.privateMessages, action.event] };
    case 'THINKING': {
      const thinking = new Map(state.thinking);
      thinking.set(action.role, action.displayName);
      return { ...state, thinking };
    }
    case 'CLEAR_THINKING': {
      const thinking = new Map(state.thinking);
      thinking.delete(action.role);
      return { ...state, thinking };
    }
    case 'TOOL_USE': {
      const toolUse = new Map(state.toolUse);
      toolUse.set(action.role, action.input);
      return { ...state, toolUse };
    }
    case 'AGENT_JOIN':
      return {
        ...state,
        agents: dedupeAgentsByRole([...state.agents, action.agent]),
      };
    case 'AGENT_LEAVE':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.role === action.role ? { ...a, status: 'left' as const } : a,
        ),
      };
    case 'POSITION_UPDATE': {
      const positions = new Map(state.positions);
      positions.set(action.role, action.position);
      return { ...state, positions };
    }
    case 'ARTIFACT': {
      if (state.artifacts.some((a) => a.id === action.artifact.id)) return state;
      return { ...state, artifacts: [...state.artifacts, action.artifact] };
    }
    case 'REACTION': {
      const reactions = { ...state.reactions };
      const list = [...(reactions[action.messageId] ?? [])];
      const idx = list.findIndex((r) => r.role === action.role);
      const rec: ReactionRecord = {
        id: `${action.messageId}-${action.role}`,
        messageId: action.messageId,
        agentId: '',
        type: action.reactionType,
        createdAt: Date.now(),
        role: action.role,
      };
      if (idx >= 0) list[idx] = rec;
      else list.push(rec);
      reactions[action.messageId] = list;
      return { ...state, reactions };
    }
    case 'ROUND_START':
      return { ...state, round: action.round, running: true };
    case 'ROUND_END':
      return { ...state, round: action.round };
    case 'SIM_END':
      return {
        ...state,
        round: action.round,
        ended: true,
        endReason: action.reason,
        running: false,
      };
    case 'MEMORY_CLEAR':
      return {
        ...state,
        positions: new Map(),
        privateMessages: [],
        hydrateKey: state.hydrateKey + 1,
      };
    case 'THREAD_END':
      return {
        ...state,
        messages: [],
        reactions: {},
        artifacts: [],
        positions: new Map(),
        privateMessages: [],
        thinking: new Map(),
        toolUse: new Map(),
        round: action.round,
        running: false,
        ended: false,
        endReason: null,
        agents: state.agents.map((a) =>
          a.status === 'left' ? a : { ...a, status: 'left' as const },
        ),
        hydrateKey: state.hydrateKey + 1,
      };
    default:
      return state;
  }
}

async function fetchWorkspaceSnapshot(workspaceId: string): Promise<{
  messages: MessageRecord[];
  reactions: Record<string, ReactionRecord[]>;
  artifacts: ArtifactRecord[];
  positions: Map<string, string>;
  agents: AgentRecord[];
  workspaceName: string;
  companyContext: string | null;
  round: number;
  running: boolean;
} | null> {
  const viewRes = await fetch(`/api/workspace/${workspaceId}`);
  if (!viewRes.ok) return null;

  const view = (await viewRes.json()) as {
    workspace: { name: string; companyContext: string | null };
    agents: AgentRecord[];
    round: number;
    running: boolean;
  };

  const [historyRes, reactionsRes, artifactsRes, positionsRes] = await Promise.all([
    fetch(`/api/history/${workspaceId}`),
    fetch(`/api/reactions/${workspaceId}`),
    fetch(`/api/artifacts/${workspaceId}`),
    fetch(`/api/positions/${workspaceId}`),
  ]);

  if (!historyRes.ok) {
    console.error('Failed to load channel history', historyRes.status);
    return null;
  }

  const messages = (await historyRes.json()) as MessageRecord[];
  const reactions = reactionsRes.ok
    ? ((await reactionsRes.json()) as Record<string, ReactionRecord[]>)
    : {};
  const artifacts = artifactsRes.ok ? ((await artifactsRes.json()) as ArtifactRecord[]) : [];
  const positionsRaw = positionsRes.ok
    ? ((await positionsRes.json()) as Record<string, string | null>)
    : {};

  const positions = new Map<string, string>();
  for (const [role, pos] of Object.entries(positionsRaw)) {
    if (pos) positions.set(role, pos);
  }

  return {
    messages,
    reactions,
    artifacts,
    positions,
    agents: view.agents,
    workspaceName: view.workspace.name,
    companyContext: view.workspace.companyContext,
    round: view.round,
    running: view.running,
  };
}

export function useSSE(workspaceId: string | undefined): SimState {
  const [state, dispatch] = useReducer(simReducer, initialState);
  const workspaceIdRef = useRef(workspaceId);

  useEffect(() => {
    if (!workspaceId) return;

    workspaceIdRef.current = workspaceId;
    dispatch({ type: 'RESET' });

    const hydrate = (): void => {
      const id = workspaceIdRef.current;
      if (!id) return;
      void fetchWorkspaceSnapshot(id).then((snapshot) => {
        if (!snapshot || workspaceIdRef.current !== id) return;
        dispatch({ type: 'HYDRATE_SNAPSHOT', ...snapshot });
      });
    };

    hydrate();

    const es = new EventSource('/events');

    es.addEventListener('open', () => {
      hydrate();
    });

    es.addEventListener('message:public', (e) => {
      const msg = JSON.parse(e.data) as MessageRecord;
      dispatch({ type: 'MESSAGE', message: msg });
    });

    es.addEventListener('message:system', (e) => {
      dispatch({ type: 'SYSTEM_MESSAGE', message: JSON.parse(e.data) as MessageRecord });
    });

    es.addEventListener('message:private', (e) => {
      dispatch({ type: 'PRIVATE_MESSAGE', event: JSON.parse(e.data) as PrivateMessageEvent });
    });

    es.addEventListener('agent:thinking', (e) => {
      const d = JSON.parse(e.data) as { role: string; displayName: string };
      dispatch({ type: 'THINKING', role: d.role, displayName: d.displayName });
    });

    es.addEventListener('agent:tool', (e) => {
      const d = JSON.parse(e.data) as { role: string; input: string; toolName?: string };
      dispatch({ type: 'TOOL_USE', role: d.role, input: d.input });
    });

    es.addEventListener('agent:join', (e) => {
      const d = JSON.parse(e.data) as {
        id?: string;
        role: string;
        displayName: string;
        round?: number;
      };
      dispatch({
        type: 'AGENT_JOIN',
        agent: {
          id: d.id ?? d.role,
          workspaceId,
          personaId: '',
          role: d.role,
          model: '',
          status: 'active',
          joinedRound: d.round ?? 0,
          leftRound: null,
          createdAt: Date.now(),
          displayName: d.displayName,
        },
      });
    });

    es.addEventListener('agent:leave', (e) => {
      const d = JSON.parse(e.data) as { role: string };
      dispatch({ type: 'AGENT_LEAVE', role: d.role });
    });

    es.addEventListener('position:update', (e) => {
      const d = JSON.parse(e.data) as { role: string; position: string };
      dispatch({ type: 'POSITION_UPDATE', role: d.role, position: d.position });
    });

    es.addEventListener('artifact:inject', (e) => {
      dispatch({ type: 'ARTIFACT', artifact: JSON.parse(e.data) as ArtifactRecord });
    });

    es.addEventListener('reaction:add', (e) => {
      const d = JSON.parse(e.data) as {
        messageId: string;
        role: string;
        type: ReactionType;
      };
      dispatch({
        type: 'REACTION',
        messageId: d.messageId,
        role: d.role,
        reactionType: d.type,
      });
    });

    es.addEventListener('round:start', (e) => {
      const d = JSON.parse(e.data) as { round: number };
      dispatch({ type: 'ROUND_START', round: d.round });
    });

    es.addEventListener('round:end', (e) => {
      const d = JSON.parse(e.data) as { round: number };
      dispatch({ type: 'ROUND_END', round: d.round });
    });

    es.addEventListener('sim:end', (e) => {
      const d = JSON.parse(e.data) as { round: number; reason: string };
      dispatch({ type: 'SIM_END', round: d.round, reason: d.reason });
    });

    es.addEventListener('memory:clear', () => {
      dispatch({ type: 'MEMORY_CLEAR' });
    });

    es.addEventListener('thread:end', (e) => {
      const d = JSON.parse(e.data) as { round: number };
      dispatch({ type: 'THREAD_END', round: d.round });
    });

    return () => {
      workspaceIdRef.current = undefined;
      es.close();
    };
  }, [workspaceId]);

  return state;
}
