'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/useI18n';
export default function SaveStatus() {
  const { locale } = useI18n();
  const [status, setStatus] = useState('saved');
  useEffect(() => {
    const onStatus = (event: Event) => setStatus((event as CustomEvent<string>).detail);
    window.addEventListener('motion-save-status', onStatus);
    return () => window.removeEventListener('motion-save-status', onStatus);
  }, []);
  return <span className={`save-status ${status === 'error' ? 'save-error' : ''}`} role="status" title={status === 'error' ? (locale === 'pt' ? 'Falha ao salvar. Verifique o espaço disponível antes de fechar.' : 'Save failed. Check available storage before closing.') : undefined}>
    {locale === 'pt' ? ({ saved: 'Salvo', saving: 'Salvando…', error: 'Erro ao salvar' } as Record<string, string>)[status] : ({ saved: 'Saved', saving: 'Saving…', error: 'Save failed' } as Record<string, string>)[status]}
  </span>;
}
