/** shadcn-style Input primitive. */

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-slack-border bg-slack-surface px-3 py-1 text-sm text-slack-text placeholder:text-slack-text-dim focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slack-active',
        className,
      )}
      {...props}
    />
  );
}
