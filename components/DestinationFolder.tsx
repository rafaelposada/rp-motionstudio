'use client';
import { useEffect, useState } from 'react';
import { BASE_PATH, IS_STATIC_EXPORT } from '@/lib/paths';
import { useI18n } from '@/lib/useI18n';
import type { DestinationKind } from '@/lib/localDestinations';

export default function DestinationFolder({ kind, disabled = false }: { kind: DestinationKind; disabled?: boolean }) {
  const pt = useI18n().locale === 'pt', [path, setPath] = useState(''), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let alive = true; fetch(`${BASE_PATH}/api/destinations`).then(r => r.json()).then(data => { if (alive) { if (data.error) setError(data.error); else setPath(data[kind] ?? ''); } }).catch(() => { if (alive) setError(pt ? 'Pastas indisponíveis.' : 'Folders unavailable.'); }); return () => { alive = false; }; }, [kind, pt]);
  if (IS_STATIC_EXPORT) return null;
  const update = async (action: 'choose' | 'set') => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${BASE_PATH}/api/destinations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, kind, path }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setPath(data[kind]); setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const label = kind === 'exports' ? (pt ? 'Pasta de exportação' : 'Export folder') : kind === 'drafts' ? (pt ? 'Pasta dos rascunhos' : 'Drafts folder') : (pt ? 'Pasta dos templates' : 'Templates folder');
  return <div className="destination-folder">
    <label>{label}</label>
    <div className="destination-path"><span title={path}>{path || '…'}</span><button className="btn" disabled={disabled || busy} onClick={() => update('choose')}>{busy ? '…' : pt ? 'Escolher…' : 'Choose…'}</button></div>
    <button className="destination-manual" disabled={disabled || busy} onClick={() => setEditing(!editing)}>{pt ? 'Digitar caminho da pasta' : 'Enter folder path'}</button>
    {editing && <form className="destination-path" onSubmit={e => { e.preventDefault(); void update('set'); }}><input className="field" aria-label={label} value={path} onChange={e => setPath(e.target.value)} disabled={disabled || busy} /><button className="btn" disabled={disabled || busy}>{pt ? 'Salvar' : 'Save'}</button></form>}
    {error && <p className="ctl-hint" role="alert">{error}</p>}
  </div>;
}
