/** Detail pane artifacts list. */

import { Link } from 'lucide-react';
import type { ArtifactRecord } from '@shared/types';

export function ArtifactList({ artifacts }: { artifacts: ArtifactRecord[] }): React.ReactElement {
  return (
    <div className="border-t border-slack-grey-light p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slack-grey">Artifacts</h3>
      <ul className="mt-2 space-y-3">
        {artifacts.map((a) => (
          <li key={a.id} className="text-sm">
            <div className="flex items-start gap-1 text-slack-blue">
              <Link className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="break-all text-slack-grey-darkest">{a.content}</span>
            </div>
            <p className="mt-0.5 text-xs text-slack-grey">Round {a.round}</p>
          </li>
        ))}
        {artifacts.length === 0 && (
          <li className="text-xs text-slack-grey">None yet</li>
        )}
      </ul>
    </div>
  );
}
