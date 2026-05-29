/** justmeme.wtf API — meme template search (https://justmeme.wtf/api-docs). */

import fetch from 'node-fetch';

const BASE_URL = process.env['JUSTMEME_API_BASE'] ?? 'https://justmeme.wtf/api/v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface MemeTemplate {
  name: string;
  slug: string;
  url: string;
}

interface CacheEntry {
  at: number;
  templates: MemeTemplate[];
}

const searchCache = new Map<string, CacheEntry>();

function mapTemplate(raw: {
  name?: string;
  slug?: string;
  url?: string;
  id?: string;
}): MemeTemplate | null {
  const url = raw.url?.trim();
  const name = raw.name?.trim();
  if (!url || !name) return null;
  return {
    name,
    slug: raw.slug?.trim() || raw.id?.trim() || name.toLowerCase().replace(/\s+/g, '-'),
    url,
  };
}

export async function searchMemeTemplates(query: string, limit = 8): Promise<MemeTemplate[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = `${q.toLowerCase()}:${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.templates;
  }

  try {
    const params = new URLSearchParams({ q });
    const res = await fetch(`${BASE_URL}/templates/search?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Cannery/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { templates?: unknown[] };
    const templates = (data.templates ?? [])
      .map((t) => mapTemplate(t as { name?: string; slug?: string; url?: string; id?: string }))
      .filter((t): t is MemeTemplate => t !== null)
      .slice(0, limit);
    searchCache.set(cacheKey, { at: Date.now(), templates });
    return templates;
  } catch {
    return [];
  }
}

export async function getTrendingMemeTemplates(limit = 10): Promise<MemeTemplate[]> {
  try {
    const res = await fetch(`${BASE_URL}/trending`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Cannery/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { trending?: unknown[] };
    return (data.trending ?? [])
      .map((t) => mapTemplate(t as { name?: string; slug?: string; url?: string; id?: string }))
      .filter((t): t is MemeTemplate => t !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function formatMemeSearchResults(templates: MemeTemplate[]): string {
  if (templates.length === 0) {
    return 'No meme templates found. Try a different search (e.g. "drake", "this is fine", "distracted").';
  }
  const lines = templates.map(
    (t, i) => `${i + 1}. ${t.name}\n   url: ${t.url}\n   slug: ${t.slug}`,
  );
  return [
    'Pick one template, then use action "meme" with memeUrl and memeName from the list.',
    '',
    ...lines,
  ].join('\n');
}
