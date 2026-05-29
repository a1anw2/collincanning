/** Scrollable message feed with auto-scroll and jump-to-latest. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import type { MessageRecord, ReactionRecord } from '@shared/types';

const COLLAPSE_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;

export interface MessageFeedProps {
  messages: MessageRecord[];
  reactions: Record<string, ReactionRecord[]>;
  toolUse: Map<string, string>;
  thinkingAgents: Array<{ role: string; name: string }>;
  /** Bumps when history is loaded from the API (e.g. after refresh or SSE reconnect). */
  hydrateKey?: number;
}

export function MessageFeed({
  messages,
  reactions,
  toolUse,
  thinkingAgents,
  hydrateKey = 0,
}: MessageFeedProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevMessageCountRef = useRef(0);

  const rows = useMemo(() => {
    const items: Array<
      | { kind: 'message'; message: MessageRecord; collapsed: boolean }
      | { kind: 'tool'; role: string; input: string }
    > = [];
    for (const [role, input] of toolUse) {
      items.push({ kind: 'tool', role, input });
    }
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;
      const prev = messages[i - 1];
      const collapsed =
        !!prev &&
        prev.role === msg.role &&
        prev.type === 'message' &&
        msg.type === 'message' &&
        msg.createdAt - prev.createdAt < COLLAPSE_MS;
      items.push({ kind: 'message', message: msg, collapsed });
    }
    return items;
  }, [messages, toolUse]);

  const isNearBottom = useCallback((): boolean => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto'): void => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollHeight - el.clientHeight;
    if (behavior === 'smooth') {
      el.scrollTo({ top, behavior: 'smooth' });
    } else {
      el.scrollTop = top;
    }
  }, []);

  useLayoutEffect(() => {
    if (!autoScroll) return;

    const count = messages.length;
    const bulkLoad =
      hydrateKey > 0 ||
      (prevMessageCountRef.current === 0 && count > 0) ||
      count - prevMessageCountRef.current > 3;
    prevMessageCountRef.current = count;

    scrollToBottom(bulkLoad ? 'auto' : 'smooth');
  }, [
    autoScroll,
    messages.length,
    rows.length,
    thinkingAgents.length,
    hydrateKey,
    scrollToBottom,
  ]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl || !autoScroll) return;

    const ro = new ResizeObserver(() => {
      if (isNearBottom()) scrollToBottom('auto');
    });
    ro.observe(contentEl);
    return () => ro.disconnect();
  }, [autoScroll, isNearBottom, scrollToBottom]);

  const handleScroll = (): void => {
    setAutoScroll(isNearBottom());
  };

  const jumpToLatest = (): void => {
    setAutoScroll(true);
    scrollToBottom('smooth');
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4"
      >
        <div ref={contentRef}>
          {rows.map((row, index) =>
            row.kind === 'tool' ? (
              <div
                key={`tool-${row.role}-${index}`}
                className="mb-4 text-xs italic text-slack-grey"
              >
                {row.role} used a tool: {row.input.slice(0, 120)}
                {row.input.length > 120 ? '…' : ''}
              </div>
            ) : (
              <MessageBubble
                key={row.message.id}
                message={row.message}
                isCollapsed={row.collapsed}
                reactions={reactions[row.message.id]}
              />
            ),
          )}
          <TypingIndicator agents={thinkingAgents} />
        </div>
      </div>
      {!autoScroll && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-4 right-4 z-10 rounded-full bg-slack-blue px-4 py-2 text-sm font-medium text-white shadow-lg hover:opacity-90"
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
