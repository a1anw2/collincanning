/** Catches render errors and shows them instead of a blank screen. */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Cannery UI error', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slack-surface p-8 text-slack-text">
          <h1 className="text-xl font-bold text-red-400">Something went wrong</h1>
          <pre className="mt-4 overflow-auto rounded border border-slack-border bg-slack-surface-raised p-4 text-sm text-red-300">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
