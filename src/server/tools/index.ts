/** OpenAI tool definitions for agent capabilities. */

import * as db from '../db.js';
import { fetchArticle } from './fetchArticle.js';
import { webSearch } from './webSearch.js';
import { setCachedFetch } from './toolCache.js';
import {
  formatMemeSearchResults,
  getTrendingMemeTemplates,
  searchMemeTemplates,
} from './justmeme.js';
import { isAllowedMemeImageUrl } from '../lib/memePost.js';

export interface ToolContext {
  workspaceId?: string;
}

export const toolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'fetch_article',
      description: 'Fetch and extract the main text content from a URL',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Article URL' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for current information',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_memes',
      description:
        'Search meme templates by name or vibe (via justmeme.wtf). Use before action "meme" to pick a template URL. Do not use every turn.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term, e.g. "drake", "this is fine", "distracted boyfriend"',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'trending_memes',
      description: 'Get currently trending meme templates when you want inspiration without a specific query',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, string>,
  ctx: ToolContext = {},
): Promise<string> {
  if (name === 'fetch_article') {
    const url = args['url'] ?? '';
    if (isAllowedMemeImageUrl(url)) {
      return 'That URL is a meme image, not an article. Use search_memes and action "meme" instead.';
    }
    if (ctx.workspaceId) {
      const fromArtifact = db.getArtifactFetchedContentByUrl(ctx.workspaceId, url);
      if (fromArtifact) {
        setCachedFetch(url, fromArtifact);
        return fromArtifact;
      }
    }
    return fetchArticle(url);
  }
  if (name === 'web_search') return webSearch(args['query'] ?? '');
  if (name === 'search_memes') {
    const templates = await searchMemeTemplates(args['query'] ?? '');
    return formatMemeSearchResults(templates);
  }
  if (name === 'trending_memes') {
    const templates = await getTrendingMemeTemplates();
    return formatMemeSearchResults(templates);
  }
  return `Unknown tool: ${name}`;
}
