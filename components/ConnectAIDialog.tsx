// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useState } from 'react';
import { desktopAPI, type McpStatus } from '@/lib/desktop';
import { connectSnippets, DEFAULT_CONNECTOR, OPEN_CONNECT_EVENT } from '@/lib/aiConnect';
import { useUIStore } from '@/store/useUIStore';
import { tx } from '@/lib/tx';

type Target = 'claudeCode' | 'claudeApp' | 'codex';
const SEEN_KEY = 'motion-connect-ai-seen';

export function CopyBlock({ text, pt, label }: { text: string; pt: boolean; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  return <div className="connect-code">
    <pre aria-label={label}>{text}</pre>
    <button type="button" className="btn" onClick={copy}>{copied ? tx(pt, 'Copiado', 'Copied') : tx(pt, 'Copiar', 'Copy')}</button>
  </div>;
}

// Shown once on the home screen of the desktop app, and from the home card or
// Settings → Claude: how to connect Claude and Codex to this app.
export default function ConnectAIDialog() {
  const pt = useUIStore((s) => s.locale) === 'pt', onHome = useUIStore((s) => s.nav) === 'home';
  const [open, setOpen] = useState(false), [target, setTarget] = useState<Target>('claudeCode'), [status, setStatus] = useState<McpStatus | null>(null);
  const api = desktopAPI();
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CONNECT_EVENT, show);
    // First visit to the home screen after this update, once the welcome is done.
    try { if (api?.mcpStatus && onHome && localStorage.getItem('motion-welcome-seen') && !localStorage.getItem(SEEN_KEY)) setOpen(true); } catch { /* storage blocked */ }
    return () => window.removeEventListener(OPEN_CONNECT_EVENT, show);
  }, [api, onHome]);
  useEffect(() => { if (open) void api?.mcpStatus?.().then(setStatus).catch(() => {}); }, [open, api]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const close = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ } setOpen(false); };
  if (!open) return null;
  const snippets = connectSnippets(status?.connector ?? DEFAULT_CONNECTOR);
  const steps: Record<Target, { name: string; how: string; code: string }> = {
    claudeCode: { name: 'Claude Code', how: tx(pt, 'Rode uma vez no Terminal. Vale para todos os seus projetos.', 'Run once in Terminal. It applies to all your projects.'), code: snippets.claudeCode },
    claudeApp: { name: tx(pt, 'App do Claude', 'Claude app'), how: tx(pt, 'No app do Claude: Ajustes → Desenvolvedor → Editar configuração. Junte este bloco ao arquivo e reabra o Claude.', 'In the Claude app: Settings → Developer → Edit config. Merge this block into the file and reopen Claude.'), code: snippets.claudeApp },
    codex: { name: 'Codex', how: tx(pt, 'Cole no fim de ~/.codex/config.toml e reabra o Codex.', 'Paste at the end of ~/.codex/config.toml and reopen Codex.'), code: snippets.codex },
  };
  const step = steps[target];
  const state = !api?.mcpStatus ? 'web' : !status ? 'checking' : status.enabled && status.listening ? 'on' : status.enabled ? 'busy' : 'off';
  return <div className="modal-backdrop connect-backdrop" onClick={close}>
    <div className="modal connect-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title" onClick={(e) => e.stopPropagation()}>
      <header className="connect-head">
        <div><span className="eyebrow">{tx(pt, 'Novidade', 'New')}</span><h2 id="connect-title">{tx(pt, 'Crie vídeos conversando com o Claude ou o Codex', 'Create videos by talking to Claude or Codex')}</h2></div>
        <button type="button" className="settings-close" aria-label={tx(pt, 'Fechar', 'Close')} onClick={close}>×</button>
      </header>
      <p className="connect-lead">{tx(pt, 'Conecte uma vez e peça em uma frase: o assistente escolhe o modelo, coloca suas fotos e vídeos, escreve os textos, confere o resultado e exporta. Funciona com o app aberto ou fechado.', 'Connect once and ask in one sentence: the assistant picks the model, places your photos and videos, writes the text, checks the result and exports. Works with the app open or closed.')}</p>
      <div className={`connect-status ${state}`} role="status">
        <span aria-hidden="true" />
        {state === 'on' ? tx(pt, 'Conector ligado neste Mac', 'Connector on for this Mac')
          : state === 'off' ? tx(pt, 'Conector desligado em Configurações → Claude', 'Connector switched off in Settings → Claude')
          : state === 'busy' ? tx(pt, 'Outro programa ocupa a porta do conector; o app tenta de novo sozinho', 'Another program holds the connector port; the app keeps retrying')
          : state === 'web' ? tx(pt, 'Disponível no app de desktop', 'Available in the desktop app')
          : tx(pt, 'Verificando…', 'Checking…')}
      </div>
      <div className="media-fit-pills connect-tabs" role="tablist" aria-label={tx(pt, 'Onde conectar', 'Where to connect')}>
        {(Object.keys(steps) as Target[]).map((key) => <button key={key} type="button" role="tab" aria-selected={target === key} className={target === key ? 'active' : ''} onClick={() => setTarget(key)}>{steps[key].name}</button>)}
      </div>
      <p className="connect-how">{step.how}</p>
      <CopyBlock text={step.code} pt={pt} label={step.name} />
      <div className="connect-example">
        <span className="eyebrow">{tx(pt, 'Depois, é só pedir', 'Then just ask')}</span>
        <p>{tx(pt, '“Faz um Reels com as fotos da pasta Downloads/Ensaio, título Direito de Família, e exporta em MP4.”', '“Make a Reel with the photos in Downloads/Shoot, titled Family Law, and export it as MP4.”')}</p>
      </div>
      <footer className="connect-foot">
        <span>{tx(pt, 'Também em Configurações → Claude.', 'Also in Settings → Claude.')}</span>
        <button type="button" className="btn solid" onClick={close}>{tx(pt, 'Entendi', 'Got it')}</button>
      </footer>
    </div>
  </div>;
}
