/** OpenRouter API client via OpenAI SDK. */

import OpenAI from 'openai';
import { config } from './config.js';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.openRouterApiKey,
  defaultHeaders: {
    'HTTP-Referer': config.publicUrl,
    'X-Title': 'Cannery',
  },
});
