/** Brave Search API wrapper for agent web search tool. */

import fetch from 'node-fetch';
import { config } from '../config.js';
import { getCachedSearch, setCachedSearch } from './toolCache.js';

export async function webSearch(query: string): Promise<string> {
  const cached = getCachedSearch(query);
  if (cached !== undefined) return cached;

  if (!config.braveSearchApiKey) {
    return 'Web search unavailable: BRAVE_SEARCH_API_KEY not configured.';
  }
  try {
    const params = new URLSearchParams({ q: query, count: '5' });
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': config.braveSearchApiKey,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return `Search failed (${res.status})`;
    const data = (await res.json()) as {
      web?: { results?: Array<{ title: string; description: string; url: string }> };
    };
    const results = data.web?.results ?? [];
    if (results.length === 0) return 'No results found.';
    const out = results
      .map((r, i) => `${i + 1}. ${r.title}\n${r.description}\n${r.url}`)
      .join('\n\n');
    setCachedSearch(query, out);
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Search error: ${msg}`;
  }
}
