/** Read-only message composer chrome (Slack clone footer). */

export function ChannelComposer(): React.ReactElement {
  return (
    <div className="flex-none px-4 pb-6">
      <div className="flex overflow-hidden rounded-lg border-2 border-slack-grey">
        <span className="border-r-2 border-slack-grey p-2 text-3xl text-slack-grey">
          <svg className="block h-6 w-6 fill-current" viewBox="0 0 20 20" aria-hidden>
            <path d="M16 10c0 .553-.048 1-.601 1H11v4.399c0 .552-.447.601-1 .601-.553 0-1-.049-1-.601V11H4.601C4.049 11 4 10.553 4 10c0-.553.049-1 .601-1H9V4.601C9 4.048 9.447 4 10 4c.553 0 1 .048 1 .601V9h4.399c.553 0 .601.447.601 1z" />
          </svg>
        </span>
        <input
          type="text"
          readOnly
          className="w-full px-4 text-sm text-slack-grey-darkest"
          placeholder="Message #general"
          aria-label="Message #general (read-only)"
        />
      </div>
    </div>
  );
}
