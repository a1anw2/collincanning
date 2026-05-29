/** shadcn-style Card layout primitive. */

import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-lg border border-slack-border bg-slack-surface-raised p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
