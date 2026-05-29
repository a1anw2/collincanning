/** #general channel top bar with search. */

export function ChannelHeader({
  topic,
  round,
  running,
}: {
  topic: string;
  round: number;
  running: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-none items-center border-b px-6 py-2">
      <div className="flex min-w-0 flex-col">
        <h3 className="mb-1 font-extrabold text-slack-grey-darkest">#general</h3>
        <div className="truncate text-sm text-slack-grey-dark">
          {topic}
          {round > 0 && (
            <span className="text-slack-grey">
              {' '}
              · Round {round}
              {running && (
                <span className="ml-2 inline-flex items-center gap-1 text-slack-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-slack-green" />
                  LIVE
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      <div className="relative ml-auto hidden md:block">
        <input
          type="search"
          placeholder="Search"
          readOnly
          className="appearance-none rounded-lg border border-slack-grey py-2 pl-8 pr-4 text-sm text-slack-grey-darkest placeholder:text-slack-grey"
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-4 w-4 fill-current text-slack-grey" viewBox="0 0 20 20" aria-hidden>
            <path d="M12.9 14.32a8 8 0 1 1 1.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
