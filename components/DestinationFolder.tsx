// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useState } from 'react';
import { BASE_PATH, IS_STATIC_EXPORT } from '@/lib/paths';
import { useI18n } from '@/lib/useI18n';
import type { DestinationKind } from '@/lib/localDestinations';
import {desktopAPI} from '@/lib/desktop';
import { tx } from '@/lib/tx';

export default function DestinationFolder({ kind, disabled = false }: { kind: DestinationKind; disabled?: boolean }) {
  const pt = useI18n().locale === 'pt', [path, setPath] = useState(''), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let alive = true; fetch(`${BASE_PATH}/api/destinations`).then(r => r.json()).then(data => { if (alive) { if (data.error) setError(data.error); else setPath(data[kind] ?? ''); } }).catch(() => { if (alive) setError(tx(pt, 'Pastas indisponíveis.', 'Folders unavailable.')); }); return () => { alive = false; }; }, [kind, pt]);
  if (IS_STATIC_EXPORT) return null;
  const update = async (action: 'choose' | 'set') => {
    setBusy(true); setError('');
    try {
      let selected=path;
      if(action==='choose'&&desktopAPI()){
        const folder=await desktopAPI()!.chooseFolder();if(folder===null)return;selected=folder;action='set';
      }
      const response = await fetch(`${BASE_PATH}/api/destinations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, kind, path:selected }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setPath(data[kind]); setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const label = kind === 'exports' ? (tx(pt, 'Pasta de exportação', 'Export folder')) : kind === 'drafts' ? (tx(pt, 'Pasta dos rascunhos', 'Drafts folder')) : (tx(pt, 'Pasta dos templates', 'Templates folder'));
  return <div className="destination-folder">
    <label>{label}</label>
    <div className="destination-path"><span title={path}>{path || '…'}</span><button className="btn" disabled={disabled || busy} onClick={() => update('choose')}>{busy ? '…' : tx(pt, 'Escolher…', 'Choose…')}</button></div>
    <button className="destination-manual" disabled={disabled || busy} onClick={() => setEditing(!editing)}>{tx(pt, 'Digitar caminho da pasta', 'Enter folder path')}</button>
    {editing && <form className="destination-path" onSubmit={e => { e.preventDefault(); void update('set'); }}><input className="field" aria-label={label} value={path} onChange={e => setPath(e.target.value)} disabled={disabled || busy} /><button className="btn" disabled={disabled || busy}>{tx(pt, 'Salvar', 'Save')}</button></form>}
    {error && <p className="ctl-hint" role="alert">{error}</p>}
  </div>;
}
