// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useState } from 'react';
import { desktopAPI, type McpStatus } from '@/lib/desktop';
import { tx } from '@/lib/tx';
import { connectSnippets } from '@/lib/aiConnect';


function CopyLine({ label, text, pt }: { label: string; text: string; pt: boolean }) {
  const [copied, setCopied] = useState(false);
  return <div className="claude-connect">
    <div className="claude-connect-head"><strong>{label}</strong>
      <button type="button" className="settings-auto" onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}>{copied ? tx(pt, 'Copiado', 'Copied') : tx(pt, 'Copiar', 'Copy')}</button>
    </div>
    <pre>{text}</pre>
  </div>;
}

// Lets Claude build and export compositions through the app's MCP server.
export default function ClaudeSettings({ pt }: { pt: boolean }) {
  const api = desktopAPI(), [status, setStatus] = useState<McpStatus | null>(null), [error, setError] = useState('');
  useEffect(() => { void api?.mcpStatus?.().then(setStatus).catch((e) => setError(String(e?.message ?? e))); }, [api]);
  const intro = <><h3>{tx(pt, 'Controle pelo Claude e pelo Codex', 'Claude and Codex control')}</h3>
    <p className="settings-description">{tx(pt, 'Com o conector, o Claude escolhe o modelo, coloca suas fotos e vídeos, escreve os textos, cria camadas de código e exporta o vídeo, a partir de um pedido simples. Funciona com o app aberto ou em segundo plano, e cada passo pode ser desfeito aqui.', 'With the connector, Claude picks the model, places your photos and videos, writes the text, creates code layers and exports the video from a simple request. It works with the app open or in the background, and every step can be undone here.')}</p></>;
  if (!api?.mcpStatus) return <>{intro}<p className="settings-description">{tx(pt, 'Disponível no aplicativo de desktop.', 'Available in the desktop app.')}</p></>;
  if (!status) return <>{intro}<p className="settings-description">{error || tx(pt, 'Verificando…', 'Checking…')}</p></>;
  const snippets = connectSnippets(status.connector);
  return <>{intro}
    <label className="settings-row"><span><strong>{tx(pt, 'Permitir controle pelo Claude', 'Allow Claude control')}</strong>
      <span className="settings-description">{status.listening ? tx(pt, `Só neste computador (127.0.0.1:${status.port}), com uma chave guardada nos dados do app.`, `This computer only (127.0.0.1:${status.port}), with a key kept in the app data.`) : tx(pt, 'A porta do conector está ocupada por outro programa. Feche-o e reabra o app.', 'Another program is using the connector port. Close it and reopen the app.')}</span></span>
      <input type="checkbox" checked={status.enabled} onChange={(e) => void api.setMcpEnabled!(e.target.checked).then(setStatus)} /></label>
    <CopyLine pt={pt} label={tx(pt, 'Claude Code · rode uma vez no Terminal', 'Claude Code · run once in Terminal')} text={snippets.claudeCode} />
    <CopyLine pt={pt} label={tx(pt, 'App do Claude · em claude_desktop_config.json', 'Claude app · in claude_desktop_config.json')} text={snippets.claudeApp} />
    <CopyLine pt={pt} label={tx(pt, 'Codex · no fim de ~/.codex/config.toml', 'Codex · at the end of ~/.codex/config.toml')} text={snippets.codex} />
    <p className="settings-description">{tx(pt, 'Depois é só pedir, por exemplo: “faz um Reels com as fotos da pasta Downloads/Ensaio e o título Direito de Família, e exporta em MP4”.', 'Then just ask, for example: “make a Reel with the photos in Downloads/Shoot titled Family Law and export it as MP4”.')}</p>
  </>;
}
