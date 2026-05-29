/** Single channel message (Adam Wathan Slack clone style). */

import { PersonAvatar } from '@/components/profile/PersonAvatar';
import { REACTION_EMOJI } from '@/lib/constants';
import { profileCardName } from '@shared/profilePhoto';
import { formatMessageTime } from '@/lib/formatters';
import { MessageContent } from './MessageContent';
import type { MessageRecord, ReactionRecord } from '@shared/types';

export interface MessageBubbleProps {
  message: MessageRecord;
  isCollapsed: boolean;
  reactions?: ReactionRecord[];
}

export function MessageBubble({
  message,
  isCollapsed,
  reactions = [],
}: MessageBubbleProps): React.ReactElement {
  const role = message.role ?? 'System';
  const speakerName = profileCardName(role, message.displayName);

  if (message.type === 'system' || message.type === 'injection') {
    return (
      <div className="mb-4 py-1 text-center text-xs text-slack-grey">
        {message.content}
      </div>
    );
  }

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  if (isCollapsed) {
    return (
      <div className="mb-4 flex items-start pl-[3.25rem] text-sm">
        <div className="min-w-0 flex-1 overflow-hidden">
          <MessageContent content={message.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start text-sm">
      <div className="mr-3">
        <PersonAvatar
          role={role}
          displayName={message.displayName}
          title={message.title}
          photoFilename={message.photoFilename}
          profile={message.profile}
        />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div>
          <span className="font-bold text-black">{speakerName}</span>
          <span className="ml-2 text-xs text-slack-grey">{formatMessageTime(message.createdAt)}</span>
        </div>
        <MessageContent content={message.content} />
        {Object.keys(grouped).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(grouped).map(([type, count]) => (
              <span
                key={type}
                className="rounded-full border border-slack-grey-light bg-slack-grey-lighter px-2 py-0.5 text-xs text-slack-grey-darkest"
              >
                {REACTION_EMOJI[type] ?? type} {count > 1 ? count : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
