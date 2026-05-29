/** Simulation start, stop, inject, and agent controls. */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminFetch } from '@/lib/adminApi';
import type { PersonaRecord, Workspace } from '@shared/types';

const COMPANY_CONTEXT_STORAGE_KEY = 'cannery.companyContext';

interface SimStatus {
  running: boolean;
  round: number;
  agentCount: number;
  workspaceId: string | null;
  staleActiveWorkspace?: boolean;
  canStart?: boolean;
  workspace?: Workspace | null;
}

export function SimControl(): React.ReactElement {
  const [personas, setPersonas] = useState<PersonaRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [url, setUrl] = useState('');
  const [workspaceName, setWorkspaceName] = useState('Collins Canning Co.');
  const [companyContext, setCompanyContext] = useState(() => {
    try {
      return localStorage.getItem(COMPANY_CONTEXT_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [injectUrl, setInjectUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [message, setMessage] = useState('');

  const refresh = (): void => {
    void adminFetch('/api/admin/sim/status')
      .then((r) => r.json())
      .then((data: SimStatus) => {
        setStatus(data);
        if (data.workspace?.companyContext != null) {
          setCompanyContext(data.workspace.companyContext);
        }
      });
    void adminFetch('/api/admin/personas')
      .then((r) => r.json())
      .then((list: PersonaRecord[]) => {
        setPersonas(list);
        if (selected.size === 0) {
          setSelected(new Set(list.map((p) => p.id)));
        }
      });
  };

  useEffect(refresh, []);

  const persistCompanyContext = (value: string): void => {
    setCompanyContext(value);
    try {
      localStorage.setItem(COMPANY_CONTEXT_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const toggle = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const start = async (): Promise<void> => {
    const r = await adminFetch('/api/admin/sim/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personaIds: [...selected],
        initialUrl: url.trim() || null,
        workspaceName,
        companyContext: companyContext.trim() || null,
      }),
    });
    const data = await r.json();
    if (r.ok) {
      setMessage('Simulation started — #general continues from prior history.');
      refresh();
    } else {
      setMessage((data as { error: string }).error);
    }
  };

  const saveCompanyContext = async (): Promise<void> => {
    const r = await adminFetch('/api/admin/sim/company-context', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyContext: companyContext.trim() || null }),
    });
    if (r.ok) {
      setMessage('Company context updated for this workspace.');
      refresh();
    } else {
      const data = (await r.json()) as { error: string };
      setMessage(data.error);
    }
  };

  const stop = async (): Promise<void> => {
    await adminFetch('/api/admin/sim/stop', { method: 'POST' });
    setMessage('Simulation stopped.');
    refresh();
  };

  const showStartForm = !status?.running;

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-bold text-white">Sim Control</h2>
      {status && (
        <div className="space-y-2 text-sm text-slack-text-dim">
          {status.running ? (
            <p>
              Running — round {status.round}, {status.agentCount} agents
              {status.workspaceId && (
                <span className="block font-mono text-xs text-slack-text">
                  {status.workspaceId}
                </span>
              )}
            </p>
          ) : (
            <p>
              Stopped — #general history is kept. Start again to resume the round loop with the same
              channel.
            </p>
          )}
        </div>
      )}
      {message && <p className="text-sm text-yellow-400">{message}</p>}

      <div className="space-y-3 border-t border-slack-border pt-4">
        <h3 className="text-sm font-semibold text-white">Thread &amp; memory</h3>
        <p className="text-xs text-slack-text-dim">
          <strong>Clear memory</strong> wipes exec positions, episodic summaries, and private notes
          — #general messages stay. <strong>End thread</strong> stops the sim, clears the channel and
          memory, and posts a fresh-start line so you can inject a new topic.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                !window.confirm(
                  'Clear all agent memory (positions, episodic summaries, private notes)? Channel history will stay.',
                )
              ) {
                return;
              }
              void adminFetch('/api/admin/sim/memory/clear', { method: 'POST' }).then(async (r) => {
                if (r.ok) {
                  setMessage('Agent memory cleared.');
                  refresh();
                } else {
                  const data = (await r.json()) as { error?: string };
                  setMessage(data.error ?? 'Failed to clear memory');
                }
              });
            }}
          >
            Clear all memory
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              if (
                !window.confirm(
                  'End this thread? All #general messages and artifacts will be deleted, memory cleared, and the sim stopped. This cannot be undone.',
                )
              ) {
                return;
              }
              void adminFetch('/api/admin/sim/thread/end', { method: 'POST' }).then(async (r) => {
                const data = (await r.json()) as {
                  ok?: boolean;
                  messagesDeleted?: number;
                  artifactsDeleted?: number;
                  error?: string;
                };
                if (r.ok) {
                  setMessage(
                    `Thread ended (${data.messagesDeleted ?? 0} messages, ${data.artifactsDeleted ?? 0} artifacts removed). Start a new sim when ready.`,
                  );
                  refresh();
                } else {
                  setMessage(data.error ?? 'Failed to end thread');
                }
              });
            }}
          >
            End thread
          </Button>
        </div>
      </div>

      {showStartForm && (
        <>
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
            <p className="text-xs text-slack-text-dim">
              One shared #general for all runs. Starting a sim does not create a new workspace.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-context">Company context</Label>
            <Textarea
              id="company-context"
              value={companyContext}
              onChange={(e) => persistCompanyContext(e.target.value)}
              placeholder="Describe the company, industry, products, and what matters for this discussion…"
              className="min-h-[120px]"
            />
            <p className="text-xs text-slack-text-dim">
              Included in every agent&apos;s turn prompt. Saved in your browser for the next start.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial-url">Initial URL (optional)</Label>
            <Input
              id="initial-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Leave blank — execs wait until you inject a URL or topic"
            />
          </div>
          <div className="space-y-2">
            <Label>Personas</Label>
            {personas.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slack-text">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.role}
              </label>
            ))}
          </div>
          <Button type="button" onClick={() => void start()}>
            Start simulation
          </Button>
        </>
      )}

      {status?.running && (
        <>
          <Button type="button" variant="danger" onClick={() => void stop()}>
            Stop simulation
          </Button>
          <div className="space-y-2 border-t border-slack-border pt-4">
            <Label htmlFor="company-context-live">Company context</Label>
            <Textarea
              id="company-context-live"
              value={companyContext}
              onChange={(e) => persistCompanyContext(e.target.value)}
              className="min-h-[100px]"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => void saveCompanyContext()}>
              Save company context
            </Button>
          </div>
          <div className="space-y-2 border-t border-slack-border pt-4">
            <Label>Inject URL</Label>
            <div className="flex gap-2">
              <Input value={injectUrl} onChange={(e) => setInjectUrl(e.target.value)} />
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  void adminFetch('/api/admin/sim/inject/url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: injectUrl }),
                  }).then(() => setMessage('URL injected'))
                }
              >
                Drop in
              </Button>
            </div>
          </div>
          <div className="space-y-2 border-t border-slack-border pt-4">
            <Label>Agent roster</Label>
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminFetch('/api/admin/sim/agents/add', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ personaId: p.id }),
                    }).then(() => setMessage(`Added ${p.role}`))
                  }
                >
                  + {p.role}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {personas.map((p) => (
                <Button
                  key={p.role}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void adminFetch('/api/admin/sim/agents/remove', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ role: p.role }),
                    }).then(() => setMessage(`Removed ${p.role}`))
                  }
                >
                  Remove {p.role}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Talking point</Label>
            <div className="flex gap-2">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  void adminFetch('/api/admin/sim/inject/topic', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: topic }),
                  }).then(() => setMessage('Topic injected'))
                }
              >
                Inject
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
