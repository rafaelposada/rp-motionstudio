// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { moveCompositionLayer } from '@/lib/compositionActions';
import { tx } from '@/lib/tx';

// One icon set for every timeline lane, so model, text, shape and audio rows
// line their controls up in the same columns.
const stroke = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const EyeIcon = ({ off }: { off?: boolean }) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8S12 12.5 8 12.5 1.5 8 1.5 8z" {...stroke} />{off ? <path d="M3 13L13 3" {...stroke} /> : <circle cx="8" cy="8" r="1.8" fill="currentColor" />}</svg>;
export const LockIcon = ({ locked }: { locked?: boolean }) => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6" {...stroke} fill={locked ? 'currentColor' : 'none'} /><path d={locked ? 'M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2' : 'M5.2 7V5a2.8 2.8 0 0 1 5.4-1'} {...stroke} /></svg>;
export const DuplicateIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.5" y="2.5" width="8" height="8" rx="1.5" {...stroke} /><path d="M5.5 13.5h6a2 2 0 002-2v-6" {...stroke} /></svg>;
export const TrashIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5h10M6.5 5V3.5h3V5M5 5l.6 8h4.8L11 5" {...stroke} /></svg>;
export const SpeakerIcon = ({ muted }: { muted?: boolean }) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" {...stroke} />{muted ? <path d="M10.5 6l3 4M13.5 6l-3 4" {...stroke} /> : <path d="M10.5 5.6a3.4 3.4 0 0 1 0 4.8M12.3 4a5.6 5.6 0 0 1 0 8" {...stroke} />}</svg>;

// Stacking order: up = drawn nearer the viewer.
export function LaneOrder({ id, index, count, pt }: { id: string; index: number; count: number; pt: boolean }) {
  return <div className="tl-lane-order">
    <button type="button" className="tl-lane-arrow" title={tx(pt, 'Trazer à frente', 'Bring forward')} disabled={index < 0 || index === count - 1} onClick={(e) => { e.stopPropagation(); moveCompositionLayer(id, 1); }}>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 7.5L6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <button type="button" className="tl-lane-arrow" title={tx(pt, 'Enviar atrás', 'Send backward')} disabled={index <= 0} onClick={(e) => { e.stopPropagation(); moveCompositionLayer(id, -1); }}>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  </div>;
}
