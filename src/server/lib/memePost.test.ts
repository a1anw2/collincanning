import { describe, expect, it } from 'vitest';
import { formatMemeMessage, isAllowedMemeImageUrl } from './memePost.js';

describe('memePost', () => {
  it('allows imgflip CDN URLs', () => {
    expect(isAllowedMemeImageUrl('https://i.imgflip.com/30b1gx.jpg')).toBe(true);
    expect(isAllowedMemeImageUrl('https://evil.com/30b1gx.jpg')).toBe(false);
  });

  it('formats markdown image with optional caption', () => {
    expect(formatMemeMessage('Drake', 'https://i.imgflip.com/x.jpg', 'My take')).toBe(
      '![Drake](https://i.imgflip.com/x.jpg)\n\nMy take',
    );
  });
});
