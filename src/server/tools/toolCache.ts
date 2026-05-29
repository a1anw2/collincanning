/** In-memory cache shared by artifact prefetch and agent tools. */

const MAX_ENTRIES = 200;

const fetchByUrl = new Map<string, string>();
const searchByQuery = new Map<string, string>();

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    u.hash = '';
    const path = u.pathname.replace(/\/$/, '') || '/';
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function trimMap<K>(map: Map<K, string>): void {
  if (map.size <= MAX_ENTRIES) return;
  const drop = map.size - MAX_ENTRIES;
  const keys = [...map.keys()];
  for (let i = 0; i < drop; i++) map.delete(keys[i]!);
}

export function getCachedFetch(url: string): string | undefined {
  return fetchByUrl.get(normalizeUrl(url));
}

export function setCachedFetch(url: string, content: string): void {
  fetchByUrl.set(normalizeUrl(url), content);
  trimMap(fetchByUrl);
}

export function getCachedSearch(query: string): string | undefined {
  return searchByQuery.get(normalizeSearchQuery(query));
}

export function setCachedSearch(query: string, content: string): void {
  searchByQuery.set(normalizeSearchQuery(query), content);
  trimMap(searchByQuery);
}
