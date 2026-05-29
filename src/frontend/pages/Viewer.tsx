/** Read-only Slack-clone channel viewer. */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_WORKSPACE_ID } from '@shared/constants';
import { profileCardName } from '@shared/profilePhoto';
import type { ChannelListItem } from '@shared/types';
import { SlackLayout } from '@/components/layout/SlackLayout';
import { ChannelComposer } from '@/components/channel/ChannelComposer';
import { ChannelHeader } from '@/components/channel/ChannelHeader';
import { MessageFeed } from '@/components/channel/MessageFeed';
import { WorkspaceHeader } from '@/components/sidebar/WorkspaceHeader';
import { AgentItem } from '@/components/sidebar/AgentItem';
import { SidebarSection } from '@/components/sidebar/SidebarSection';
import { PositionCard } from '@/components/detail/PositionCard';
import { ArtifactList } from '@/components/detail/ArtifactList';
import { RoundCounter } from '@/components/detail/RoundCounter';
import { useSSE } from '@/hooks/useSSE';

export function Viewer(): React.ReactElement {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const effectiveId = workspaceId === DEFAULT_WORKSPACE_ID ? workspaceId : DEFAULT_WORKSPACE_ID;
  const sim = useSSE(effectiveId);
  const [channels, setChannels] = useState<ChannelListItem[]>([]);

  useEffect(() => {
    if (workspaceId && workspaceId !== DEFAULT_WORKSPACE_ID) {
      navigate(`/w/${DEFAULT_WORKSPACE_ID}`, { replace: true });
    }
  }, [workspaceId, navigate]);

  useEffect(() => {
    void fetch(`/api/channels/${DEFAULT_WORKSPACE_ID}`)
      .then((r) => r.json())
      .then((list: ChannelListItem[]) => setChannels(list));
  }, [sim.hydrateKey]);

  const thinkingAgents = useMemo(
    () =>
      [...sim.thinking.entries()].map(([role, sseName]) => {
        const agent = sim.agents.find((a) => a.role === role);
        return {
          role,
          name: profileCardName(role, agent?.displayName ?? sseName),
        };
      }),
    [sim.thinking, sim.agents],
  );

  const workspaceName = sim.workspaceName;

  const activeAgents = sim.agents.filter((a) => a.status !== 'left');
  const sidebarAgents = activeAgents.length > 0 ? activeAgents : sim.agents;
  const doneCount = [...sim.positions.keys()].filter((r) =>
    activeAgents.some((a) => a.role === r),
  ).length;

  const channelTopic = (() => {
    if (sim.artifacts.length > 0) {
      return `Discussing shared material (${sim.artifacts.length} artifact${sim.artifacts.length === 1 ? '' : 's'})`;
    }
    if (sim.companyContext) {
      const preview = sim.companyContext.replace(/\s+/g, ' ').trim();
      return preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;
    }
    if (sim.running) return 'Waiting for moderator to share a URL or talking point';
    return 'Executive simulation channel — read-only viewer';
  })();

  return (
    <SlackLayout
      sidebar={
        <>
          <WorkspaceHeader
            name={workspaceName}
            running={sim.running && !sim.ended}
            round={sim.round}
          />
          <SidebarSection title="Channels">
            {(channels.length > 0 ? channels : [{ id: 'general', name: 'general', type: 'public' as const }]).map(
              (ch) => (
                <div
                  key={ch.id}
                  className={
                    ch.name === 'general'
                      ? 'bg-slack-teal-dark px-4 py-1 text-white'
                      : 'px-4 py-1 text-slack-text-dim'
                  }
                >
                  # {ch.name}
                  {ch.type === 'group' && ch.memberCount != null ? (
                    <span className="ml-1 text-xs opacity-70">({ch.memberCount})</span>
                  ) : null}
                </div>
              ),
            )}
          </SidebarSection>
          <SidebarSection title="Direct Messages">
            <div className="flex-1 overflow-y-auto">
              {sidebarAgents.map((a) => (
                <AgentItem
                  key={a.id}
                  agent={a}
                  position={sim.positions.get(a.role) ?? null}
                  isThinking={sim.thinking.has(a.role)}
                />
              ))}
            </div>
          </SidebarSection>
        </>
      }
      channel={
        <>
          <ChannelHeader
            topic={channelTopic}
            round={sim.round}
            running={sim.running && !sim.ended}
          />
          <MessageFeed
            messages={sim.messages}
            reactions={sim.reactions}
            toolUse={sim.toolUse}
            thinkingAgents={thinkingAgents}
            hydrateKey={sim.hydrateKey}
          />
          <ChannelComposer />
        </>
      }
      detail={
        <>
          {sim.companyContext && (
            <div className="border-b border-slack-grey-light p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slack-grey">
                Company context
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slack-grey-darkest">
                {sim.companyContext}
              </p>
            </div>
          )}
          <PositionCard positions={sim.positions} agents={sim.agents} />
          <ArtifactList artifacts={sim.artifacts} />
          <RoundCounter
            round={sim.round}
            silenceStreak={0}
            silenceMax={2}
            doneCount={doneCount}
            activeCount={activeAgents.length}
            ended={sim.ended}
            endReason={sim.endReason}
          />
          {sim.privateMessages.length > 0 && (
            <div className="border-t border-slack-grey-light p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slack-grey">
                Private Messages
              </h3>
              <ul className="mt-2 space-y-2 text-xs text-slack-grey-dark">
                {sim.privateMessages.map((pm) => (
                  <li key={pm.id}>
                    {pm.from} → {pm.to} (R{pm.round})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      }
    />
  );
}
