/** Detail pane stance list. */

export function PositionCard({
  positions,
  agents,
}: {
  positions: Map<string, string>;
  agents: Array<{ role: string; status: string }>;
}): React.ReactElement {
  return (
    <div className="p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slack-grey">Stances</h3>
      <ul className="mt-2 space-y-2">
        {agents
          .filter((a) => a.status !== 'left')
          .map((a) => (
            <li key={a.role} className="text-sm">
              <span className="font-bold text-slack-grey-darkest">{a.role}</span>
              <span className="text-slack-grey-dark">
                {' '}
                {positions.get(a.role) ? `"${positions.get(a.role)}"` : '—'}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
