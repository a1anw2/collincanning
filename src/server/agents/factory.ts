/** Factory for creating Agent instances from records. */

import { Agent } from './base.js';
import * as db from '../db.js';
import type { AgentRecord } from '../../../shared/types.js';

export function createAgentFromRecord(record: AgentRecord): Agent {
  return new Agent(record);
}

export function createAgentById(id: string): Agent | null {
  const record = db.getAgent(id);
  if (!record) return null;
  return new Agent(record);
}
