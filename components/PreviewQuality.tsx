// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useState } from 'react';
import { QUALITY_DENSITY, getLightPlayback, getPreviewQuality, setLightPlayback, setPreviewQuality, type PreviewQuality } from '@/lib/previewResolution';
import { useSceneStore } from '@/store/useSceneStore';
import { tx } from '@/lib/tx';

const OPTIONS: { value: PreviewQuality; pt: string; en: string; hintPt: string; hintEn: string }[] = [
  { value: 'fast', pt: 'Rápida', en: 'Fast', hintPt: 'Menos GPU e bateria', hintEn: 'Less GPU and battery' },
  { value: 'balanced', pt: 'Equilibrada', en: 'Balanced', hintPt: 'Boa para a maioria', hintEn: 'Good for most work' },
  { value: 'high', pt: 'Alta', en: 'High', hintPt: 'Nitidez de tela Retina', hintEn: 'Retina sharpness' },
];

// One control for preview density, used in the Canvas tab (compact) and in
// Settings → Preview (with explanations). Export always uses its own resolution.
export default function PreviewQuality({ pt, compact = false }: { pt: boolean; compact?: boolean }) {
  const [quality, setQuality] = useState<PreviewQuality>('high'), [light, setLight] = useState(true);
  const width = useSceneStore((s) => s.width), height = useSceneStore((s) => s.height);
  useEffect(() => {
    const sync = () => { setQuality(getPreviewQuality()); setLight(getLightPlayback()); };
    sync(); window.addEventListener('motion-preview-quality', sync);
    return () => window.removeEventListener('motion-preview-quality', sync);
  }, []);
  const density = Math.min(QUALITY_DENSITY[quality], typeof window === 'undefined' ? 2 : Math.max(1, window.devicePixelRatio || 1));
  return <div className={`preview-quality ${compact ? 'compact' : ''}`}>
    <div className="preview-quality-options" role="radiogroup" aria-label={tx(pt, 'Qualidade da prévia', 'Preview quality')}>
      {OPTIONS.map((option) => <button key={option.value} type="button" role="radio" aria-checked={quality === option.value}
        className={`preview-quality-option ${quality === option.value ? 'active' : ''}`} onClick={() => setPreviewQuality(option.value)}>
        <strong>{tx(pt, option.pt, option.en)}</strong>{!compact && <small>{tx(pt, option.hintPt, option.hintEn)}</small>}
      </button>)}
    </div>
    <p className="preview-quality-readout">{tx(pt, 'Prévia desenhada em', 'Preview drawn at')} {Math.round(width * density)} × {Math.round(height * density)} px · {tx(pt, 'a exportação usa a própria resolução.', 'export uses its own resolution.')}</p>
    <label className="preview-quality-toggle">
      <input type="checkbox" checked={light} onChange={(e) => setLightPlayback(e.target.checked)} />
      <span><strong>{tx(pt, 'Prévia leve durante a reprodução', 'Lighter preview while playing')}</strong>{!compact && <small>{tx(pt, 'Desenha em 1× enquanto toca e volta à qualidade escolhida ao pausar. Deixa a reprodução mais fluida em projetos pesados.', 'Draws at 1× while playing and returns to the chosen quality when paused. Keeps playback smoother in heavy projects.')}</small>}</span>
    </label>
  </div>;
}
