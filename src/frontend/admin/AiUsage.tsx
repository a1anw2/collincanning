/** Admin page for AI call history and costs. */

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminApi';
import type { AiCallRecord, AiUsageSummary } from '@shared/types';

function formatCost(usd: number | null): string {
  if (usd == null || usd === 0) return '—';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function AiUsage(): React.ReactElement {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [calls, setCalls] = useState<AiCallRecord[]>([]);
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    const q = workspaceFilter.trim()
      ? `?workspaceId=${encodeURIComponent(workspaceFilter.trim())}`
      : '';
    const r = await adminFetch(`/api/admin/usage${q}`);
    if (!r.ok) return;
    const data = (await r.json()) as { summary: AiUsageSummary; calls: AiCallRecord[] };
    setSummary(data.summary);
    setCalls(data.calls);
    setLoading(false);
  }, [workspaceFilter]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">AI Usage &amp; Costs</h2>
          <p className="mt-1 text-sm text-slack-text-dim">
            Every OpenRouter call logged with tokens and cost (when reported).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slack-text-dim" htmlFor="ws-filter">
            Workspace ID
          </label>
          <input
            id="ws-filter"
            type="text"
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            placeholder="Filter (optional)"
            className="rounded border border-slack-border bg-slack-surface px-2 py-1 text-sm text-slack-text"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded bg-slack-active px-3 py-1 text-sm text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <p className="text-slack-text-dim">Loading…</p>
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slack-border bg-slack-surface p-4">
              <p className="text-xs uppercase text-slack-text-dim">Total calls</p>
              <p className="mt-1 text-2xl font-bold text-white">{summary.totalCalls}</p>
            </div>
            <div className="rounded-lg border border-slack-border bg-slack-surface p-4">
              <p className="text-xs uppercase text-slack-text-dim">Total tokens</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {summary.totalTokens.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-slack-border bg-slack-surface p-4">
              <p className="text-xs uppercase text-slack-text-dim">Total cost</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {formatCost(summary.totalCostUsd > 0 ? summary.totalCostUsd : null)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slack-border p-4">
              <h3 className="mb-2 text-sm font-semibold text-white">By role</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(summary.byRole).map(([role, s]) => (
                  <li key={role} className="flex justify-between text-slack-text">
                    <span>{role}</span>
                    <span className="text-slack-text-dim">
                      {s.calls} calls · {s.tokens.toLocaleString()} tok ·{' '}
                      {formatCost(s.costUsd > 0 ? s.costUsd : null)}
                    </span>
                  </li>
                ))}
                {Object.keys(summary.byRole).length === 0 && (
                  <li className="text-slack-text-dim">No data yet</li>
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-slack-border p-4">
              <h3 className="mb-2 text-sm font-semibold text-white">By model</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(summary.byModel).map(([model, s]) => (
                  <li key={model} className="flex justify-between gap-2 text-slack-text">
                    <span className="truncate font-mono text-xs">{model}</span>
                    <span className="shrink-0 text-slack-text-dim">
                      {formatCost(s.costUsd > 0 ? s.costUsd : null)}
                    </span>
                  </li>
                ))}
                {Object.keys(summary.byModel).length === 0 && (
                  <li className="text-slack-text-dim">No data yet</li>
                )}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slack-border">
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slack-surface-raised text-xs uppercase text-slack-text-dim">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Rnd</th>
                    <th className="px-3 py-2 text-right">Tokens</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-slack-border/50 hover:bg-slack-surface/80"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-slack-text-dim">
                        {formatTime(c.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-medium text-white">{c.role ?? '—'}</td>
                      <td className="px-3 py-2 text-slack-text-dim">{c.callType}</td>
                      <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-slack-text-dim">
                        {c.model}
                      </td>
                      <td className="px-3 py-2 text-slack-text-dim">{c.round ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-slack-text">
                        {c.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400">
                        {formatCost(c.costUsd)}
                      </td>
                      <td className="px-3 py-2 text-right text-slack-text-dim">
                        {c.durationMs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {calls.length === 0 && (
                <p className="p-6 text-center text-slack-text-dim">
                  No AI calls recorded yet. Start a simulation to generate usage.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
