/** Natural thinking delays per agent persona. */

import * as db from './db.js';
import type { AgentRecord } from '../../shared/types.js';

export async function waitForAgent(agent: AgentRecord): Promise<void> {
  const persona = db.getPersona(agent.personaId);
  if (!persona) return;
  const min = persona.baseDelayMin;
  const max = persona.baseDelayMax;
  const ms = min + Math.random() * (max - min);
  await new Promise((resolve) => setTimeout(resolve, ms));
}
