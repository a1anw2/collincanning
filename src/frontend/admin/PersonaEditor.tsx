/** Create or edit a persona. */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { adminFetch } from '@/lib/adminApi';
import { profilePhotoUrl } from '@shared/profilePhoto';
import type { PersonaRecord } from '@shared/types';

export function PersonaEditor(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [role, setRole] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [photoFilename, setPhotoFilename] = useState('');
  const [model, setModel] = useState('');
  const [persona, setPersona] = useState('');
  const [delayMin, setDelayMin] = useState('8');
  const [delayMax, setDelayMax] = useState('30');
  const [saved, setSaved] = useState(false);
  const [photoPreviewFailed, setPhotoPreviewFailed] = useState(false);

  const photoPreviewUrl = profilePhotoUrl(photoFilename);

  useEffect(() => {
    setPhotoPreviewFailed(false);
  }, [photoFilename]);

  useEffect(() => {
    if (!isNew && id) {
      void adminFetch(`/api/admin/personas/${id}`)
        .then((r) => r.json())
        .then((p: PersonaRecord) => {
          setRole(p.role);
          setDisplayName(p.displayName);
          setTitle(p.title ?? '');
          setPhotoFilename(p.photoFilename ?? '');
          setModel(p.model);
          setPersona(p.persona);
          setDelayMin(String(p.baseDelayMin / 1000));
          setDelayMax(String(p.baseDelayMax / 1000));
        });
    }
  }, [id, isNew]);

  const save = async (): Promise<void> => {
    const body = {
      role,
      displayName,
      title: title.trim() || null,
      photoFilename: photoFilename.trim() || null,
      model,
      persona,
      baseDelayMin: Number(delayMin) * 1000,
      baseDelayMax: Number(delayMax) * 1000,
    };
    const url = isNew ? '/api/admin/personas' : `/api/admin/personas/${id}`;
    const method = isNew ? 'POST' : 'PUT';
    const r = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      setSaved(true);
      if (isNew) navigate('/admin/personas');
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-xl font-bold text-white">{isNew ? 'New' : 'Edit'} Persona</h2>
      <div className="space-y-2">
        <Label>Role</Label>
        <Input value={role} onChange={(e) => setRole(e.target.value)} readOnly={!isNew} />
      </div>
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How they appear on the profile card"
        />
      </div>
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chief Executive Officer"
        />
      </div>
      <div className="space-y-2">
        <Label>Profile photo filename</Label>
        <Input
          value={photoFilename}
          onChange={(e) => setPhotoFilename(e.target.value)}
          placeholder="ceo.jpg"
          className="font-mono text-sm"
        />
        <p className="text-xs text-slack-text-dim">
          Put the image in <code className="text-slack-text">public/profiles/</code> and enter the
          filename only. Hosted at{' '}
          <code className="text-slack-text">
            /profiles/{photoFilename.trim() || 'filename.jpg'}
          </code>
        </p>
        {photoPreviewUrl && !photoPreviewFailed ? (
          <img
            src={photoPreviewUrl}
            alt=""
            className="h-20 w-20 rounded-md border border-slack-border object-cover"
            onError={() => setPhotoPreviewFailed(true)}
          />
        ) : photoFilename.trim() ? (
          <p className="text-xs text-amber-400">Preview unavailable — check the file exists.</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>Model (OpenRouter)</Label>
        <Input value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Profile (persona prompt)</Label>
        <Textarea
          className="min-h-[200px] font-mono text-xs"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
        />
        <p className="text-xs text-slack-text-dim">
          Shown in the hover card (excerpt) and sent to the model each turn.
        </p>
      </div>
      <div className="flex gap-4">
        <div className="space-y-2">
          <Label>Delay min (sec)</Label>
          <Input type="number" value={delayMin} onChange={(e) => setDelayMin(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Delay max (sec)</Label>
          <Input type="number" value={delayMax} onChange={(e) => setDelayMax(e.target.value)} />
        </div>
      </div>
      <Button type="button" onClick={() => void save()}>
        Save
      </Button>
      {saved && (
        <p className="text-sm text-green-400">Saved. Changes apply on the next round.</p>
      )}
    </div>
  );
}
