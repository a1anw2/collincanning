/** Structured logging — pino with pretty console output in development. */

import pino from 'pino';
import { config } from './config.js';

const prettyOptions = {
  colorize: true,
  translateTime: 'HH:MM:ss.l',
  ignore: 'pid,hostname',
  singleLine: true,
  levelFirst: true,
  messageFormat: '{if module}[{module}] {end}{msg}',
  customColors: 'info:blue,warn:yellow,error:red,debug:gray,fatal:bgRed',
} as const;

export const logger = pino({
  name: 'cannery',
  level: config.logLevel,
  ...(config.logPretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: prettyOptions,
        },
      }
    : {
        formatters: {
          level(label) {
            return { level: label };
          },
        },
      }),
});

/** Named child loggers for consistent console prefixes. */
export const log = {
  app: logger.child({ module: 'app' }),
  http: logger.child({ module: 'http' }),
  sim: logger.child({ module: 'sim' }),
  agent: logger.child({ module: 'agent' }),
  sse: logger.child({ module: 'sse' }),
  db: logger.child({ module: 'db' }),
  ai: logger.child({ module: 'ai' }),
};

export function logError(
  target: pino.Logger,
  message: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  target.error(
    {
      err: err instanceof Error ? err : new Error(String(err)),
      ...extra,
    },
    message,
  );
}
