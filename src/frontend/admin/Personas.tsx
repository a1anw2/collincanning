/** Persona list and management links. */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { adminFetch } from '@/lib/adminApi';
import { profilePhotoUrl } from '@shared/profilePhoto';
import type { PersonaRecord } from '@shared/types';

export function Personas(): React.ReactElement {
  const [personas, setPersonas] = useState<PersonaRecord[]>([]);

  useEffect(() => {
    void adminFetch('/api/admin/personas')
      .then((r) => r.json())
      .then(setPersonas);
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Personas</h2>
        <Link to="/admin/personas/new">
          <Button size="sm">New persona</Button>
        </Link>
      </div>
      <ul className="space-y-2">
        {personas.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded border border-slack-border p-3"
          >
            <div className="flex items-center gap-3">
              {profilePhotoUrl(p.photoFilename) ? (
                <img
                  src={profilePhotoUrl(p.photoFilename)!}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded bg-slack-border text-xs font-bold text-white">
                  {p.role.slice(0, 2)}
                </span>
              )}
              <div>
                <span className="font-bold text-white">{p.displayName}</span>
                <span className="ml-2 text-sm text-slack-text-dim">{p.role}</span>
                {p.title && (
                  <p className="text-xs text-slack-text-dim">{p.title}</p>
                )}
              </div>
            </div>
            <Link to={`/admin/personas/${p.id}`} className="text-sm text-slack-active">
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
