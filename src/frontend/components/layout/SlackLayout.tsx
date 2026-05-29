/** Three-column Slack clone layout (CodePen JOQWVa). */

export function SlackLayout({
  sidebar,
  channel,
  detail,
}: {
  sidebar: React.ReactNode;
  channel: React.ReactNode;
  detail: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen w-full overflow-hidden font-sans antialiased">
      <aside className="flex w-64 shrink-0 flex-col bg-slack-indigo-darker pb-6 text-slack-purple-lighter">
        {sidebar}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">{channel}</main>
      <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slack-grey-light bg-white xl:block">
        {detail}
      </aside>
    </div>
  );
}
