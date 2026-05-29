/** True when the client expects an HTML document (browser navigation). */

import type { FastifyRequest } from 'fastify';

export function wantsHtml(req: FastifyRequest): boolean {
  const accept = req.headers.accept ?? '';
  return accept.includes('text/html');
}
