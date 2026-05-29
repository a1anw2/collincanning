/** Shared types for Cannery server and frontend. */

export type AgentRole = string;

export type AgentStatus = 'active' | 'away' | 'left';

export type MessageType = 'message' | 'system' | 'injection';

export type ArtifactType = 'url' | 'talking_point';

export type ActionType = 'speak' | 'private' | 'pass' | 'leave' | 'react' | 'meme';

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
  | 'sim:end'
  | 'reaction:add'
  | 'memory:clear'
  | 'thread:end';

export interface Workspace {
  id: string;
  name: string;
  companyContext: string | null;
  createdAt: number;
  endedAt: number | null;
}

export interface ChannelListItem {
  id: string;
  workspaceId: string;
  name: string;
  type: 'public' | 'group' | 'dm';
  createdAt: number;
  memberCount: number | null;
}

export interface PersonaRecord {
  id: string;
  role: string;
  displayName: string;
  /** Job title shown on profile hover card (e.g. Chief Executive Officer). */
  title: string | null;
  /** Filename only — image lives in public/profiles/, served at /profiles/{filename}. */
  photoFilename: string | null;
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
  displayName?: string;
  title?: string | null;
  photoFilename?: string | null;
  /** Persona bio text for profile hover card. */
  profile?: string;
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
  role?: string;
  displayName?: string;
  title?: string | null;
  photoFilename?: string | null;
  profile?: string;
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

export interface ReactionRecord {
  id: string;
  messageId: string;
  agentId: string;
  type: ReactionType;
  createdAt: number;
  role?: string;
}

export interface AgentResponse {
  action: ActionType;
  to?: string;
  content?: string;
  done: boolean;
  currentPosition?: string;
  internalNotes?: string;
  reaction?: { messageId: string; type: ReactionType };
}

export interface WorkspaceView {
  workspace: Workspace;
  agents: AgentRecord[];
  round: number;
  running: boolean;
  silenceStreak: number;
  generalChannelId: string;
}

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
  id: string;
  role: string;
  displayName: string;
  round: number;
}

export interface AgentLeaveEvent {
  role: string;
  round: number;
}

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

export interface ReactionAddEvent {
  messageId: string;
  role: string;
  type: ReactionType;
}

export type AiCallType = 'agent_think' | 'summarize' | 'onboarding';

export interface AiCallRecord {
  id: string;
  workspaceId: string | null;
  agentId: string | null;
  role: string | null;
  callType: AiCallType;
  model: string;
  round: number | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  durationMs: number;
  createdAt: number;
}

export interface AiUsageSummary {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  byRole: Record<string, { calls: number; tokens: number; costUsd: number }>;
  byModel: Record<string, { calls: number; tokens: number; costUsd: number }>;
}
