'use client';
import { useState, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { importProjectPackage, saveProjectPackage, storageReport } from '@/lib/projectPackage';
import { idbDelete } from '@/lib/assetDb';
import { useI18n } from '@/lib/useI18n';
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
export default function ProjectTools() {
  const { locale } = useI18n(); const pt = locale === 'pt';
  const activeId = useProjectStore((s) => s.activeId);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [report, setReport] = useState<Awaited<ReturnType<typeof storageReport>> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const run = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } };
  return <div className="project-tools">
    <button className="btn full" disabled={busy || !activeId} onClick={() => run(async () => { const saved = await saveProjectPackage(activeId!); setMessage(`${pt ? 'Pacote salvo em' : 'Package saved to'}: ${saved.path}`); })}>{pt ? 'Salvar pacote portátil' : 'Save portable package'}</button>
    <button className="btn full" disabled={busy} onClick={() => input.current?.click()}>{pt ? 'Importar pacote de projeto' : 'Import project package'}</button>
    <input ref={input} type="file" hidden accept=".zip" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { const project = await importProjectPackage(file); useProjectStore.getState().open(project.id); useProjectStore.getState().refresh(); setMessage(pt ? 'Projeto importado; o original foi preservado.' : 'Project imported; original preserved.'); }); }} />
    <button className="btn full" disabled={busy} onClick={() => run(async () => setReport(await storageReport()))}>{pt ? 'Ver armazenamento' : 'View storage'}</button>
    {report && <div className="ctl-hint">{mb(report.total)} · {report.count} {pt ? 'arquivos locais' : 'local files'}<br />{mb(report.orphaned.reduce((sum, file) => sum + file.size, 0))} {pt ? 'sem referência em projetos ou backups' : 'unreferenced by projects/backups'}
      {!!report.orphaned.length && <button className="btn full" disabled={busy} onClick={() => { if (window.confirm(pt ? 'Remover apenas arquivos sem referência? O histórico de desfazer será reiniciado. Projetos e backups serão preservados.' : 'Remove unreferenced files only? Undo history will reset. Projects and backups are preserved.')) void run(async () => { const fresh = await storageReport(); useHistoryStore.getState().reset(); for (const file of fresh.orphaned) await idbDelete(file.key); setReport(await storageReport()); setMessage(pt ? 'Arquivos órfãos removidos.' : 'Orphaned files removed.'); }); }}>{pt ? 'Limpar arquivos sem uso' : 'Clean unused files'}</button>}
    </div>}
    <p className="ctl-hint" role="status">{busy ? (pt ? 'Processando…' : 'Processing…') : message}</p>
  </div>;
}
