// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { tx } from '@/lib/tx';

type InspectorTab = 'motion' | 'canvas' | 'media' | 'text' | 'layers';
interface Step { target?: string; tab?: InspectorTab; titlePt: string; titleEn: string; pt: string; en: string }
const STEPS: Step[] = [
  { target: '.card.templates', titlePt: 'Modelos de movimento', titleEn: 'Motion templates', pt: 'Escolha aqui como os cartões se movem. Clique em um modelo para aplicá-lo à composição; o coração guarda nos favoritos.', en: 'Pick how the cards move. Click a template to apply it to the composition; the heart saves it to favorites.' },
  { target: '.stage-wrap', titlePt: 'A tela', titleEn: 'The canvas', pt: 'Esta é a prévia. Clique para selecionar, arraste para mover e use as alças para redimensionar e girar. Duplo clique edita um texto.', en: 'This is the preview. Click to select, drag to move and use the handles to resize and rotate. Double-click edits a text.' },
  { target: '.inspector-tabs', tab: 'motion', titlePt: 'Painel de ajustes', titleEn: 'Inspector', pt: 'Cada aba cuida de uma parte: Movimento, Tela (formato e fundo), Mídia, Texto e Camadas.', en: 'Each tab handles one part: Motion, Canvas (format and background), Media, Text and Layers.' },
  { target: '.inspector-content', tab: 'media', titlePt: 'Imagens, vídeos e formas', titleEn: 'Images, videos and shapes', pt: 'Na aba Mídia você envia as imagens dos cartões e adiciona formas, imagens soltas e áudio.', en: 'In the Media tab you upload the card images and add shapes, free images and audio.' },
  { target: '.inspector-content', tab: 'text', titlePt: 'Textos', titleEn: 'Text', pt: 'Adicione e estilize textos: fonte, cor, fundo, sombra e animação de entrada e saída. Atalho: T.', en: 'Add and style text: font, color, background, shadow and entrance and exit animation. Shortcut: T.' },
  { target: 'footer.card.bottom', titlePt: 'Linha do tempo', titleEn: 'Timeline', pt: 'Espaço toca e pausa. Arraste as barras para definir quando cada camada aparece. M cria um marcador onde as barras encaixam.', en: 'Space plays and pauses. Drag the bars to set when each layer appears. M adds a marker the bars snap to.' },
  { target: '.export-btn', titlePt: 'Exportar', titleEn: 'Export', pt: 'Quando estiver pronto, exporte em MP4, GIF, MOV com transparência ou em vários formatos de uma vez.', en: 'When you are ready, export to MP4, GIF, transparent MOV or several formats at once.' },
  { titlePt: 'Atalhos', titleEn: 'Shortcuts', pt: '⌘K abre a paleta com todas as ações, ⌘Z desfaz e ⌘, abre as configurações. Você pode rever este tutorial pela tela inicial.', en: '⌘K opens the palette with every action, ⌘Z undoes and ⌘, opens settings. You can replay this tutorial from the home screen.' },
];

export const startGuidedTour = () => window.dispatchEvent(new CustomEvent('rp-tour'));

const visibleRect = (selector?: string) => {
  const el = selector ? document.querySelector<HTMLElement>(selector) : null, r = el?.getBoundingClientRect();
  return r && r.width > 4 && r.height > 4 ? r : null;
};

// Spotlight walkthrough of the editor, one area at a time.
export default function GuidedTour() {
  const pt = useUIStore((s) => s.locale) === 'pt', nav = useUIStore((s) => s.nav);
  const [index, setIndex] = useState<number | null>(null), [rect, setRect] = useState<DOMRect | null>(null), [pos, setPos] = useState({ left: 0, top: 0 });
  const card = useRef<HTMLDivElement>(null), next = useRef<HTMLButtonElement>(null);
  const step = index === null ? null : STEPS[index];
  const close = useCallback(() => { setIndex(null); setRect(null); }, []);
  useEffect(() => {
    let timer = 0;
    const start = () => {
      // The editor may still be mounting after leaving the home screen.
      const began = performance.now();
      const wait = () => { if (document.querySelector('.stage-wrap') || performance.now() - began > 20000) setIndex(0); else timer = window.setTimeout(wait, 100); };
      wait();
    };
    window.addEventListener('rp-tour', start); return () => { window.removeEventListener('rp-tour', start); clearTimeout(timer); };
  }, []);
  useEffect(() => { if (nav === 'home') close(); }, [nav, close]);
  useEffect(() => {
    if (!step) return;
    if (step.tab) window.dispatchEvent(new CustomEvent('rp-inspector-tab', { detail: step.tab }));
    const measure = () => setRect(visibleRect(step.target));
    const timer = window.setTimeout(measure, step.tab ? 120 : 0);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(timer); window.removeEventListener('resize', measure); };
  }, [step]);
  useLayoutEffect(() => {
    const box = card.current; if (!box || !step) return;
    const w = box.offsetWidth, h = box.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, gap = 16, m = 12;
    const clamp = (v: number, max: number) => Math.max(m, Math.min(max - m, v));
    if (!rect) { setPos({ left: (vw - w) / 2, top: (vh - h) / 2 }); return; }
    const options = [
      { left: rect.right + gap, top: rect.top + rect.height / 2 - h / 2, fits: rect.right + gap + w + m <= vw },
      { left: rect.left - gap - w, top: rect.top + rect.height / 2 - h / 2, fits: rect.left - gap - w >= m },
      { left: rect.left + rect.width / 2 - w / 2, top: rect.bottom + gap, fits: rect.bottom + gap + h + m <= vh },
      { left: rect.left + rect.width / 2 - w / 2, top: rect.top - gap - h, fits: rect.top - gap - h >= m },
    ];
    const chosen = options.find((o) => o.fits) ?? { left: (vw - w) / 2, top: (vh - h) / 2 };
    setPos({ left: clamp(chosen.left, vw - w), top: clamp(chosen.top, vh - h) });
  }, [rect, step]);
  useEffect(() => { if (step) next.current?.focus({ preventScroll: true }); }, [step]);
  useEffect(() => {
    if (index === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); setIndex((i) => i === null || i >= STEPS.length - 1 ? null : i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setIndex((i) => Math.max(0, (i ?? 0) - 1)); }
    };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [index, close]);
  if (!step || index === null) return null;
  const last = index === STEPS.length - 1, pad = 6;
  return <div className="guided-tour" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
    <div className="guided-tour-blocker" onClick={close} />
    {rect ? <div className="guided-tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} /> : <div className="guided-tour-dim" />}
    <div ref={card} className="guided-tour-card" style={{ left: pos.left, top: pos.top }}>
      <span className="guided-tour-count">{index + 1} / {STEPS.length}</span>
      <h2 id="guided-tour-title">{tx(pt, step.titlePt, step.titleEn)}</h2>
      <p>{tx(pt, step.pt, step.en)}</p>
      <div className="guided-tour-actions">
        <button type="button" className="btn guided-tour-skip" onClick={close}>{last ? tx(pt, 'Fechar', 'Close') : tx(pt, 'Pular', 'Skip')}</button>
        <span />
        {index > 0 && <button type="button" className="btn" onClick={() => setIndex(index - 1)}>{tx(pt, 'Voltar', 'Back')}</button>}
        <button ref={next} type="button" className="btn solid" onClick={() => last ? close() : setIndex(index + 1)}>{last ? tx(pt, 'Concluir', 'Finish') : tx(pt, 'Próximo', 'Next')}</button>
      </div>
    </div>
  </div>;
}
