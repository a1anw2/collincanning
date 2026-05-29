/** Admin dashboard overview. */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_WORKSPACE_ID } from '@shared/constants';
import { adminFetch } from '@/lib/adminApi';

interface SimStatus {
  running: boolean;
  workspaceId: string | null;
  round: number;
  agentCount: number;
}

interface CompanyWorkspace {
  id: string;
  name: string;
  messageCount: number;
  agentMessageCount: number;
}

export function Dashboard(): React.ReactElement {
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [company, setCompany] = useState<CompanyWorkspace | null>(null);

  useEffect(() => {
    void adminFetch('/api/admin/sim/status')
      .then((r) => r.json())
      .then(setStatus);
    void adminFetch('/api/admin/workspaces')
      .then((r) => r.json())
      .then(setCompany);
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-bold text-white">Dashboard</h2>
      {status?.running ? (
        <p className="text-slack-text">
          Simulation running — round {status.round}, {status.agentCount} agents.{' '}
          <Link to={`/w/${DEFAULT_WORKSPACE_ID}`} className="text-slack-active hover:underline">
            Open #general
          </Link>
        </p>
      ) : (
        <p className="text-slack-text">
          No active simulation.{' '}
          <Link to="/admin/sim" className="text-slack-active hover:underline">
            Start one
          </Link>
        </p>
      )}

      {company && (
        <div className="rounded-lg border border-slack-border bg-slack-surface-raised p-4">
          <h3 className="text-sm font-semibold uppercase text-slack-text-dim">Company channel</h3>
          <p className="mt-1 text-lg font-semibold text-white">{company.name}</p>
          <p className="mt-2 text-sm text-slack-text-dim">
            One shared <span className="text-slack-text">#general</span> for all sim runs —{' '}
            {company.messageCount} messages ({company.agentMessageCount} posts).
          </p>
          <Link
            to={`/w/${DEFAULT_WORKSPACE_ID}`}
            className="mt-3 inline-block text-sm text-slack-active hover:underline"
          >
            Open viewer →
          </Link>
        </div>
      )}
    </div>
  );
}
