// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/useI18n';
import { useUIStore } from '@/store/useUIStore';
import { getSaveState } from '@/lib/scenePersist';
export default function SaveStatus() {
  const { locale } = useI18n();
  const enabled = useUIStore(s => s.autosaveEnabled);
  const [state, setState] = useState(getSaveState);
  const status = state.status;
  useEffect(() => {
    const onStatus = () => setState(getSaveState());
    window.addEventListener('motion-save-status', onStatus);
    return () => window.removeEventListener('motion-save-status', onStatus);
  }, []);
  const help = locale === 'pt' ? 'Salvamento nos dados locais deste aplicativo. Clique para configurar.' : 'Saved in local application data. Click to configure.';
  return <button type="button" className={`save-status ${status === 'error' ? 'save-error' : ''}`} title={`${help}${state.savedAt ? ` ${new Date(state.savedAt).toLocaleTimeString()}` : ''}`} onClick={() => useUIStore.getState().setSettingsOpen(true, 'saving')}>
    <span role="status">{locale === 'pt' ? ({ saved: enabled ? 'Autossalvo' : 'Salvo · auto. desligado', pending: 'Não salvo', saving: 'Salvando…', error: 'Erro ao salvar' })[status] : ({ saved: enabled ? 'Autosaved' : 'Saved · auto off', pending: 'Unsaved', saving: 'Saving…', error: 'Save failed' })[status]}</span>
  </button>;
}
