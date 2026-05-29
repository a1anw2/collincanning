/** @mention highlights inside message text. */

import type { ReactNode } from 'react';

/** Matches @First or @First Last (colleague names, not roles). */
const MENTION_REGEX = /@([A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*)?)/g;

export function renderMentionSpans(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="inline-block bg-slack-blue-lightest text-slack-blue no-underline"
      >
        @{match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts.length > 0 ? parts : [content];
}

/** @deprecated Use renderMentionSpans or MessageContent */
export function renderContentWithMentions(content: string): ReactNode[] {
  return renderMentionSpans(content);
}
