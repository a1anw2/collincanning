/** Cannery Fastify server entry point. */

import Fastify from 'fastify';
import basicAuth from '@fastify/basic-auth';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import { config } from './config.js';
import { eventsRoute } from './routes/events.js';
import { apiRoutes } from './routes/api.js';
import { adminRoutes } from './routes/admin.js';
import { resolveFrontendRoot } from './frontendRoot.js';
import { resolveProfilesRoot } from './profilesRoot.js';
import { reconcileSimState } from './orchestrator.js';
import { log, logger } from './logger.js';

reconcileSimState();

const app = Fastify({ logger });

await app.register(basicAuth, {
  validate(username, password, _req, _reply, done) {
    const ok =
      username === config.adminUser && password === config.adminPassword;
    done(ok ? undefined : new Error('Unauthorized'));
  },
  authenticate: true,
});

await app.register(cors, { origin: true });

// API routes before static so /api and /admin are not swallowed by static files
await app.register(eventsRoute, { prefix: '/events' });
await app.register(apiRoutes, { prefix: '/api' });
await app.register(adminRoutes, { prefix: '/api/admin' });

await app.register(staticFiles, {
  root: resolveProfilesRoot(),
  prefix: '/profiles/',
  decorateReply: false,
});

const frontendRoot = resolveFrontendRoot();
await app.register(staticFiles, {
  root: frontendRoot,
  prefix: '/',
});

app.setNotFoundHandler((req, reply) => {
  const url = req.url.split('?')[0] ?? '';
  if (url.startsWith('/api') || url.startsWith('/events')) {
    return reply.status(404).send({ error: 'Not found' });
  }
  return reply.sendFile('index.html');
});

await app.listen({ port: config.port, host: config.host });
log.app.info({ url: config.publicUrl, frontendRoot }, 'Cannery server listening');
