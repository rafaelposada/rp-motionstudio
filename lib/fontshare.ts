// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Fontshare (Indian Type Foundry) families, free for personal and commercial
// use under the ITF Free Font License or SIL OFL. The bundled catalog lists the
// families; each file is downloaded on first use and cached like Google fonts.
export interface FontshareFamily { family: string; slug: string; category: string; license: string; weights: number[] }

let catalog: Promise<FontshareFamily[]> | null = null;
export function fontshareCatalog(): Promise<FontshareFamily[]> {
  catalog ??= fetch('/fontshare-catalog.json').then((response) => {
    if (!response.ok) throw Error('Catálogo do Fontshare indisponível.');
    return response.json();
  }).catch(() => { catalog = null; return []; });
  return catalog;
}
export async function fontshareFamily(family: string) {
  return (await fontshareCatalog()).find((entry) => entry.family === family);
}
export const nearestWeight = (weights: number[], weight: number) => weights.reduce((best, next) => Math.abs(next - weight) < Math.abs(best - weight) ? next : best, weights[0] ?? 400);

// Only the family slug and weight are sent to Fontshare, never project text.
export async function fontshareFileUrl(entry: FontshareFamily, weight: number) {
  const response = await fetch(`https://api.fontshare.com/v2/css?f[]=${encodeURIComponent(entry.slug)}@${nearestWeight(entry.weights, weight)}&display=swap`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error('Fonte indisponível no Fontshare.');
  const css = await response.text();
  const url = css.match(/url\('?((?:https:)?\/\/cdn\.fontshare\.com\/[^')]+\.woff2)'?\)/)?.[1];
  if (!url) throw Error('Arquivo da fonte não encontrado no Fontshare.');
  return url.startsWith('//') ? `https:${url}` : url;
}
