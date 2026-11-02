// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import type { ReactNode } from 'react';
export default function InspectorIcon({ tab }: { tab: 'motion' | 'canvas' | 'media' | 'text' | 'layers' }) {
  const paths: Record<typeof tab, ReactNode> = {
    motion: <><path d="M3 12h8m-4-4 4 4-4 4M13 4h5v5M15 20h5v-5"/><path d="m14 10 4-6M17 14l3 6"/></>,
    canvas: <><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 2v6M16 16v6M2 9h6M16 15h6"/></>,
    media: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-6 6 7"/></>,
    text: <><path d="M4 6V4h16v2M12 4v16M8 20h8"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[tab]}</svg>;
}
