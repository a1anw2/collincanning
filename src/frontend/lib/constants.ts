/** Role colors and display constants for the Slack UI. */

export const ROLE_COLORS: Record<string, { bg: string; text: string; initial: string }> = {
  CEO: { bg: 'bg-violet-600', text: 'text-white', initial: 'C' },
  CFO: { bg: 'bg-emerald-600', text: 'text-white', initial: 'F' },
  CTO: { bg: 'bg-blue-600', text: 'text-white', initial: 'T' },
  CMO: { bg: 'bg-rose-600', text: 'text-white', initial: 'M' },
};

export function getRoleColor(role: string): { bg: string; text: string; initial: string } {
  return (
    ROLE_COLORS[role] ?? {
      bg: 'bg-slate-600',
      text: 'text-white',
      initial: role[0]?.toUpperCase() ?? '?',
    }
  );
}

export const REACTION_EMOJI: Record<string, string> = {
  agree: '👍',
  disagree: '👎',
  interesting: '💡',
  question: '❓',
};
