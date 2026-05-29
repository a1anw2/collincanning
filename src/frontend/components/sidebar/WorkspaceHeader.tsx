/** Workspace title block in the indigo sidebar. */

export function WorkspaceHeader({
  name,
  running,
  round,
}: {
  name: string;
  running: boolean;
  round: number;
}): React.ReactElement {
  const subtitle = running
    ? `Simulation live${round > 0 ? ` · round ${round}` : ''}`
    : 'Executive channel viewer';

  return (
    <div className="mb-2 mt-3 flex justify-between px-4 text-white">
      <div className="min-w-0 flex-auto">
        <h1 className="mb-1 truncate text-xl font-semibold leading-tight">{name}</h1>
        <div className="mb-6 flex items-center">
          {running && (
            <svg className="mr-2 h-2 w-2 fill-current text-slack-green" viewBox="0 0 20 20" aria-hidden>
              <circle cx="10" cy="10" r="10" />
            </svg>
          )}
          <span className="truncate text-sm text-white opacity-50">{subtitle}</span>
        </div>
      </div>
      <div className="shrink-0 pt-1">
        <svg className="h-6 w-6 fill-current text-white opacity-25" viewBox="0 0 20 20" aria-hidden>
          <path
            d="M14 8a4 4 0 1 0-8 0v7h8V8zM8.027 2.332A6.003 6.003 0 0 0 4 8v6l-3 2v1h18v-1l-3-2V8a6.003 6.003 0 0 0-4.027-5.668 2 2 0 1 0-3.945 0zM12 18a2 2 0 1 1-4 0h4z"
            fillRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}
