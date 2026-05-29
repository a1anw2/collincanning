/** Parses @mentions by colleague name (display name), with role fallback. */

import { profileCardName } from '../../../shared/profilePhoto.js';

export interface MentionAgentRef {
  id: string;
  role: string;
  displayName?: string | null;
}

/** Keys point to agent id; includes full name, first name, and role for matching. */
export function buildMentionLookup(agents: MentionAgentRef[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of agents) {
    const name = profileCardName(a.role, a.displayName);
    const add = (key: string): void => {
      if (key) map.set(key, a.id);
    };
    add(name);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts[0]) add(parts[0]!);
    add(a.role);
  }
  return map;
}

function boundaryAfter(ch: string | undefined): boolean {
  return !ch || /[\s,.:;!?)\]"]/.test(ch);
}

/** Longest-key match at each @ so @Jordan Ellis wins over @Jordan. */
export function matchMentionedAgentIds(
  content: string,
  lookup: Map<string, string>,
): string[] {
  const keys = [...new Set(lookup.keys())].sort((a, b) => b.length - a.length);
  const ids: string[] = [];
  let i = 0;
  while (i < content.length) {
    if (content[i] !== '@') {
      i++;
      continue;
    }
    const after = content.slice(i + 1);
    let matched = false;
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      const lowerAfter = after.toLowerCase();
      if (after.startsWith(key) && boundaryAfter(after[key.length])) {
        ids.push(lookup.get(key)!);
        i += 1 + key.length;
        matched = true;
        break;
      }
      if (lowerAfter.startsWith(lowerKey) && boundaryAfter(after[lowerKey.length])) {
        ids.push(lookup.get(key)!);
        i += 1 + lowerKey.length;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  return [...new Set(ids)];
}

/** @deprecated Use matchMentionedAgentIds with buildMentionLookup */
export function parseMentionRoles(content: string): string[] {
  const re = /@([A-Za-z][A-Za-z0-9]*)/g;
  const roles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    roles.push(match[1] ?? '');
  }
  return [...new Set(roles)];
}
