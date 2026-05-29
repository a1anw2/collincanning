/** Resolves dist/frontend for dev (tsx) and production (compiled) layouts. */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function resolveFrontendRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), 'dist/frontend'),
    path.join(here, '../../dist/frontend'), // src/server → repo
    path.join(here, '../../../frontend'), // dist/server/src/server → dist
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return path.join(process.cwd(), 'dist/frontend');
}
