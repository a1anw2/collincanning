/** Round and end-condition display. */

export function RoundCounter({
  round,
  silenceStreak,
  silenceMax,
  doneCount,
  activeCount,
  ended,
  endReason,
}: {
  round: number;
  silenceStreak: number;
  silenceMax: number;
  doneCount: number;
  activeCount: number;
  ended: boolean;
  endReason: string | null;
}): React.ReactElement {
  return (
    <div className="border-t border-slack-grey-light p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slack-grey">Round</h3>
      <p className="mt-2 text-lg font-bold text-slack-grey-darkest">Round {round || '—'}</p>
      <p className="text-xs text-slack-grey-dark">Silence: {silenceStreak} / {silenceMax}</p>
      <p className="text-xs text-slack-grey-dark">
        All done: {doneCount} / {activeCount}
      </p>
      {ended && endReason && (
        <p className="mt-2 text-sm text-amber-700">Ended ({endReason})</p>
      )}
    </div>
  );
}
