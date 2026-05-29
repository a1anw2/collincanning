/** Timestamp and display formatters. */

export function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`;
}

export function formatFullTime(ts: number): string {
  return new Date(ts).toLocaleString();
}
