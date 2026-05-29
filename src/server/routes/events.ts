/** SSE events route. */

import type { FastifyPluginAsync } from 'fastify';
import { broker } from '../broker.js';
import type { SSEEventType } from '../../../shared/types.js';

export const eventsRoute: FastifyPluginAsync = async (app) => {
  app.get('/', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    const send = (event: SSEEventType, data: unknown): void => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const unsubscribe = broker.subscribe((event, data) => {
      send(event, data);
    });

    req.raw.on('close', () => {
      unsubscribe();
    });
  });
};
