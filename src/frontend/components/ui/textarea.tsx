/** shadcn-style Textarea primitive. */

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.ReactElement {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-slack-border bg-slack-surface px-3 py-2 text-sm text-slack-text placeholder:text-slack-text-dim focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slack-active',
        className,
      )}
      {...props}
    />
  );
}
