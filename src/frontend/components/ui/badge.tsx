/** shadcn-style Badge primitive. */

import { cn } from '@/lib/utils';

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-slack-border px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
