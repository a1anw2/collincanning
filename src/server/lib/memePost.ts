/** Meme image URLs and channel post formatting. */

const ALLOWED_MEME_HOSTS = new Set(['i.imgflip.com', 'imgflip.com']);

export function isAllowedMemeImageUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return ALLOWED_MEME_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function formatMemeMessage(memeName: string, memeUrl: string, caption?: string | null): string {
  const alt = memeName.replace(/[\[\]()]/g, '').trim() || 'meme';
  let body = `![${alt}](${memeUrl.trim()})`;
  const text = caption?.trim();
  if (text) body += `\n\n${text}`;
  return body;
}
