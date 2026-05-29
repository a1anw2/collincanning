/** Animated typing indicator for thinking agents. */

import { getRoleColor } from '@/lib/constants';

export interface TypingIndicatorProps {
  agents: Array<{ role: string; name: string }>;
}

function formatTypingNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function TypingIndicator({ agents }: TypingIndicatorProps): React.ReactElement | null {
  if (agents.length === 0) return null;

  const shown = agents.slice(0, 3);
  const names = shown.map((a) => a.name);
  const label = formatTypingNames(names);
  const verb = names.length === 1 ? 'is' : 'are';

  return (
    <div className="mb-4 flex items-center gap-2 text-sm text-slack-grey">
      <div className="flex -space-x-1">
        {shown.map((a) => {
          const c = getRoleColor(a.role);
          return (
            <div
              key={a.role}
              className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold ${c.bg} ${c.text}`}
              aria-hidden
            >
              {c.initial}
            </div>
          );
        })}
      </div>
      <span>
        <span className="font-medium text-slack-grey-darkest">{label}</span> {verb} typing…
      </span>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slack-grey animate-typing-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  );
}
