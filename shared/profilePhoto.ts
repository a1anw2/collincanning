/** Profile images are served from /profiles/{filename} (see public/profiles/). */

const SAFE_FILENAME = /^[a-zA-Z0-9._-]+$/;

export function sanitizeProfileFilename(filename: string): string | null {
  const base = filename.trim().split(/[/\\]/).pop()?.trim();
  if (!base || !SAFE_FILENAME.test(base)) return null;
  return base;
}

export function profilePhotoUrl(filename: string | null | undefined): string | null {
  const safe = filename ? sanitizeProfileFilename(filename) : null;
  if (!safe) return null;
  return `/profiles/${encodeURIComponent(safe)}`;
}

export function profileCardName(role: string, displayName?: string | null): string {
  const n = displayName?.trim();
  return n || role;
}

export function profileCardTitle(
  role: string,
  displayName?: string | null,
  title?: string | null,
): string {
  const t = title?.trim();
  if (t) return t;
  if (displayName?.trim()) return role;
  return role;
}

export function profileCardExcerpt(persona: string | null | undefined, maxLen = 220): string {
  const text = persona?.trim().replace(/\s+/g, ' ') ?? '';
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}
