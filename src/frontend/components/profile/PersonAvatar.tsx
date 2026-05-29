/** Avatar with hover profile card (photo, name, title, bio excerpt). */

import { useState } from 'react';
import { getRoleColor } from '@/lib/constants';
import {
  profileCardExcerpt,
  profileCardName,
  profileCardTitle,
  profilePhotoUrl,
} from '@shared/profilePhoto';

export interface PersonProfileProps {
  role: string;
  displayName?: string | null;
  title?: string | null;
  photoFilename?: string | null;
  profile?: string | null;
  size?: 'sm' | 'md';
  /** Where the hover card appears (sidebar uses above to avoid clipping). */
  cardPlacement?: 'below' | 'above';
}

export function PersonAvatar({
  role,
  displayName,
  title,
  photoFilename,
  profile,
  size = 'md',
  cardPlacement = 'below',
}: PersonProfileProps): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const colors = getRoleColor(role);
  const photoUrl = profilePhotoUrl(photoFilename);
  const name = profileCardName(role, displayName);
  const titleLine = profileCardTitle(role, displayName, title);
  const excerpt = profileCardExcerpt(profile);

  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-10 w-10 text-sm';

  return (
    <div className="group relative shrink-0">
      <div
        className={`flex ${dim} cursor-default items-center justify-center overflow-hidden rounded bg-slack-grey-lighter ring-1 ring-slack-grey-light`}
        aria-label={`${name}, ${titleLine}`}
      >
        {photoUrl && !imgFailed ? (
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className={`font-bold ${colors.bg} ${colors.text} flex h-full w-full items-center justify-center`}>
            {colors.initial}
          </span>
        )}
      </div>

      <div
        role="tooltip"
        className={`pointer-events-none absolute z-50 w-64 scale-95 rounded-lg border border-slack-grey-light bg-white p-3 opacity-0 shadow-lg transition duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 ${
          cardPlacement === 'above'
            ? 'bottom-full right-0 mb-2 origin-bottom-right'
            : 'left-0 top-full mt-2 origin-top-left'
        }`}
      >
        <div className="flex gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slack-grey-lighter">
            {photoUrl && !imgFailed ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className={`flex h-full w-full items-center justify-center text-lg font-bold ${colors.bg} ${colors.text}`}
              >
                {colors.initial}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slack-grey-darkest">{name}</p>
            <p className="truncate text-xs text-slack-grey">{titleLine}</p>
          </div>
        </div>
        {excerpt ? (
          <p className="mt-2 text-xs leading-relaxed text-slack-grey-dark">{excerpt}</p>
        ) : null}
      </div>
    </div>
  );
}
