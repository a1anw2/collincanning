/** Resolves public/profiles for static hosting. */

import fs from 'fs';
import path from 'path';

export function resolveProfilesRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'public/profiles'),
    path.join(process.cwd(), 'public', 'profiles'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  const fallback = path.join(process.cwd(), 'public/profiles');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}
