/** Direct message row in the sidebar. */

import { PersonAvatar } from '@/components/profile/PersonAvatar';
import type { AgentRecord } from '@shared/types';

function StatusDot({ status, thinking }: { status: string; thinking: boolean }): React.ReactElement {
  if (thinking) {
    return (
      <svg className="mr-2 h-2 w-2 fill-current text-yellow-300" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="10" />
      </svg>
    );
  }
  if (status === 'left' || status === 'away') {
    return (
      <svg
        className="mr-2 h-2 w-2 stroke-current text-white"
        viewBox="0 0 22 22"
        fill="none"
        strokeWidth={3}
        aria-hidden
      >
        <circle cx="11" cy="11" r="9" />
      </svg>
    );
  }
  return (
    <svg className="mr-2 h-2 w-2 fill-current text-slack-green" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" />
    </svg>
  );
}

export function AgentItem({
  agent,
  position,
  isThinking,
}: {
  agent: AgentRecord;
  position: string | null;
  isThinking: boolean;
}): React.ReactElement {
  const left = agent.status === 'left';

  return (
    <div className={`mb-3 flex items-center gap-2 px-4 ${left ? 'opacity-50' : ''}`}>
      <StatusDot status={agent.status} thinking={isThinking} />
      <span className={`min-w-0 flex-1 truncate text-white ${left ? 'line-through opacity-75' : 'opacity-75'}`}>
        <span className="font-medium">{agent.role}</span>
        {isThinking && <span className="ml-1 animate-pulse">…</span>}
        {position && (
          <span className="block truncate text-xs opacity-60">&quot;{position}&quot;</span>
        )}
      </span>
      <div className="hidden shrink-0 sm:block">
        <PersonAvatar
          role={agent.role}
          displayName={agent.displayName}
          title={agent.title}
          photoFilename={agent.photoFilename}
          profile={agent.profile}
          size="sm"
          cardPlacement="above"
        />
      </div>
    </div>
  );
}
