/** Initializes the SQLite database from schema SQL files. */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { ensureDataDir } from '../paths.js';
import { log } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

ensureDataDir();
const db = new Database(config.dbPath);
const initSql = fs.readFileSync(path.join(root, 'schema/init.sql'), 'utf8');
const seedSql = fs.readFileSync(path.join(root, 'schema/seed.sql'), 'utf8');

db.exec(initSql);
db.exec(seedSql);
db.close();

log.db.info({ path: config.dbPath }, 'Database initialized');
