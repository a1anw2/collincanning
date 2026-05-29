/** Environment configuration for the Cannery server. */

import dotenv from 'dotenv';
import fs from 'fs';
import { DATA_DIR, DEFAULT_DB_PATH, ENV_PATH, ensureDataDir } from './paths.js';

ensureDataDir();
if (fs.existsSync(ENV_PATH)) {
  dotenv.config({ path: ENV_PATH });
}

const port = Number(process.env['PORT'] ?? 3000);
const host = process.env['HOST'] ?? '0.0.0.0';

export const config = {
  port,
  host,
  frontendPort: Number(process.env['FRONTEND_PORT'] ?? 5173),
  publicUrl: process.env['PUBLIC_URL'] ?? `http://localhost:${port}`,
  dbPath: process.env['DB_PATH'] ?? DEFAULT_DB_PATH,
  dataDir: DATA_DIR,
  openRouterApiKey: process.env['OPENROUTER_API_KEY'] ?? '',
  braveSearchApiKey: process.env['BRAVE_SEARCH_API_KEY'] ?? '',
  adminUser: process.env['ADMIN_USER'] ?? 'admin',
  adminPassword: process.env['ADMIN_PASSWORD'] ?? 'changeme',
  summarizeEveryNRounds: Number(process.env['SUMMARIZE_EVERY_N_ROUNDS'] ?? 3),
  workingMemoryMessages: Number(process.env['WORKING_MEMORY_MESSAGES'] ?? 10),
  maxToolCallsPerTurn: Number(process.env['MAX_TOOL_CALLS_PER_TURN'] ?? 2),
  silenceRoundsBeforeEnd: Number(process.env['SILENCE_ROUNDS_BEFORE_END'] ?? 2),
  showPrivateMessages: process.env['SHOW_PRIVATE_MESSAGES'] === 'true',
  logLevel:
    process.env['LOG_LEVEL'] ??
    (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
  logPretty:
    process.env['LOG_PRETTY'] !== 'false' && process.env['NODE_ENV'] !== 'production',
};
