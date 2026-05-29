/** SSE event broker — publish-only singleton. */

import type { SSEEventType } from '../../shared/types.js';
import { logError, log } from './logger.js';

type Subscriber = (event: SSEEventType, data: unknown) => void;

const subscribers = new Set<Subscriber>();

export const broker = {
  subscribe(fn: Subscriber): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },

  publish(event: SSEEventType, data: unknown): void {
    for (const fn of subscribers) {
      try {
        fn(event, data);
      } catch (err) {
        logError(log.sse, 'SSE subscriber error', err, { event });
      }
    }
  },
};
