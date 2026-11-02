// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Brand kits: colors, fonts and a logo kept on this computer and applied to any
// composition. Kits live outside projects so every new piece can reuse them.
import { create } from 'zustand';
import { idbGet, idbPut, idbDelete } from './assetDb';
import { useSceneStore } from '@/store/useSceneStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { ensureFont, isTextLayer } from './textLayers';

export interface BrandKit { id: string; name: string; colors: string[]; heading: string; body: string; logo?: { blobId: string; name: string; width: number; height: number } }
const KEY = 'rp-brand-kits';
const HEX = /^#[0-9a-f]{6}$/i;
const clean = (kit: BrandKit): BrandKit => ({ ...kit, name: String(kit.name || 'Kit').slice(0, 60), colors: kit.colors.filter((c) => HEX.test(c)).slice(0, 10), heading: String(kit.heading || 'Inter').slice(0, 80), body: String(kit.body || kit.heading || 'Inter').slice(0, 80) });

export const useBrandKits = create<{ kits: BrandKit[]; hydrate: () => void; save: (kit: BrandKit) => void; remove: (id: string) => void }>((set, get) => ({
  kits: [],
  hydrate: () => { try { const list = JSON.parse(localStorage.getItem(KEY) ?? '[]'); if (Array.isArray(list)) set({ kits: list.map(clean) }); } catch { /* keep empty */ } },
  save: (kit) => { const kits = [...get().kits.filter((k) => k.id !== kit.id), clean(kit)]; set({ kits }); try { localStorage.setItem(KEY, JSON.stringify(kits)); } catch { /* storage full */ } },
  remove: (id) => { const gone = get().kits.find((k) => k.id === id); const kits = get().kits.filter((k) => k.id !== id); set({ kits }); try { localStorage.setItem(KEY, JSON.stringify(kits)); } catch { /* ignore */ } if (gone?.logo) void idbDelete(gone.logo.blobId).catch(() => {}); },
}));

// A starting kit from what the open composition already uses.
export function kitFromComposition(name: string): BrandKit {
  const s = useSceneStore.getState(), texts = s.textLayers.filter(isTextLayer);
  const colors = [...new Set([s.background.color, ...texts.map((l) => l.color), ...s.textLayers.flatMap((l) => l.shape ? [l.shape.fill, l.shape.stroke] : [])].filter((c): c is string => !!c && HEX.test(c)))];
  return { id: crypto.randomUUID(), name, colors: colors.slice(0, 6), heading: texts[0]?.font ?? 'Inter', body: texts[1]?.font ?? texts[0]?.font ?? 'Inter' };
}

export async function storeKitLogo(file: File) {
  const url = URL.createObjectURL(file), image = new Image(); image.src = url;
  try { await image.decode(); } finally { URL.revokeObjectURL(url); }
  const blobId = `kitlogo_${crypto.randomUUID()}`; await idbPut(blobId, file);
  return { blobId, name: file.name, width: image.naturalWidth, height: image.naturalHeight };
}

// Apply a kit: the first text gets the heading font, the rest the body font;
// texts take the first kit color, shapes the second, the background the last.
// The logo, if any, lands in the top-right corner as an absolute image.
export async function applyKit(kit: BrandKit, options: { fonts: boolean; colors: boolean; logo: boolean }) {
  const s = useSceneStore.getState(), history = useHistoryStore.getState();
  if (options.fonts) await Promise.all([ensureFont(kit.heading, 400).catch(() => {}), ensureFont(kit.body, 400).catch(() => {}), ensureFont(kit.heading, 700).catch(() => {})]);
  history.beginGesture();
  try {
    const textColor = kit.colors[0], shapeColor = kit.colors[1] ?? kit.colors[0], backdrop = kit.colors.length > 2 ? kit.colors[kit.colors.length - 1] : undefined;
    let index = 0;
    for (const layer of s.textLayers) {
      if (isTextLayer(layer)) {
        const change: Record<string, unknown> = {};
        if (options.fonts) { change.font = index === 0 ? kit.heading : kit.body; change.runs = layer.runs?.map((run) => ({ ...run, style: { ...run.style, font: undefined } })); }
        if (options.colors && textColor) change.color = textColor;
        s.patchTextLayer(layer.id, change);
        index++;
      } else if (layer.shape && options.colors && shapeColor) s.patchTextLayer(layer.id, { shape: { ...layer.shape, ...(layer.shape.fill ? { fill: shapeColor } : {}), ...(layer.shape.stroke ? { stroke: shapeColor } : {}) } });
    }
    if (options.colors && backdrop) s.setBackground({ source: 'color', color: backdrop, gradient: false });
    if (options.logo && kit.logo) {
      const blob = await idbGet(kit.logo.blobId);
      if (blob) {
        const copyId = `overlay_${crypto.randomUUID()}`; await idbPut(copyId, blob);
        const url = URL.createObjectURL(blob as Blob), width = Math.round(Math.min(s.width * .18, kit.logo.width)), height = Math.round(width * kit.logo.height / Math.max(1, kit.logo.width));
        s.addTextLayer(); const layer = useSceneStore.getState().textLayers.at(-1)!;
        s.patchTextLayer(layer.id, { text: kit.logo.name, media: { blobId: copyId, url, width, height, fit: 'contain' }, x: s.width - width / 2 - s.width * .06, y: height / 2 + s.height * .05, rotation: 0, opacity: 1 });
      }
    }
  } finally { history.endGesture(); }
}
