'use client';
import { useEffect, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useUIStore } from '@/store/useUIStore';
import { storageReport } from '@/lib/projectPackage';
export default function HomeDashboard() {
  const projects = useProjectStore((s) => s.projects); const activeId = useProjectStore((s) => s.activeId);
  const [diagnostics, setDiagnostics] = useState<{ version: string; ffmpeg: string } | null>(null);
  const [storage, setStorage] = useState('');
  useEffect(() => { const controller = new AbortController(); fetch('/api/diagnostics', { signal: controller.signal }).then((r) => r.json()).then(setDiagnostics).catch(() => {}); storageReport().then((r) => setStorage(`${(r.total / 1048576).toFixed(1)} MB em ${r.count} arquivos locais`)).catch(() => setStorage('Armazenamento indisponível')); return () => controller.abort(); }, []);
  return <div className="home-dashboard"><span className="eyebrow">RP MotionStudio</span><h1>Seu próximo movimento.</h1><p>Projetos e imagens ficam neste Mac. Selecione um projeto à esquerda ou continue a composição aberta.</p>
    <button className="btn solid" onClick={() => useUIStore.getState().setNav('library')}>Continuar {projects.find((p) => p.id === activeId)?.name ?? 'projeto'}</button>
    <div className="home-diagnostics"><h3>Estado do aplicativo</h3><p>{storage}</p><p>Exportação: {diagnostics?.ffmpeg ?? 'Verificando…'}</p><small>Versão {diagnostics?.version ?? '…'}</small></div>
  </div>;
}
