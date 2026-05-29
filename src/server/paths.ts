/** Repo-local runtime paths (database, env). */

import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.join(process.cwd(), 'data');

export const ENV_PATH = path.join(DATA_DIR, '.env');

export const DEFAULT_DB_PATH = path.join(DATA_DIR, 'cannery.db');

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}
