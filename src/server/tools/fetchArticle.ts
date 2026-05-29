/** Fetches and extracts article text from a URL. */

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { getCachedFetch, setCachedFetch } from './toolCache.js';

const MAX_CHARS = 8000;

export async function fetchArticle(url: string): Promise<string> {
  const cached = getCachedFetch(url);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Cannery/0.1 (article-fetch)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return `Failed to fetch (${res.status}): ${url}`;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const text = article?.textContent?.trim() ?? '';
    if (!text) return `Could not extract readable content from: ${url}`;
    const out = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
    setCachedFetch(url, out);
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Fetch error: ${msg}`;
  }
}
