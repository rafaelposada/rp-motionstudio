// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Inline bilingual strings: tx(pt, 'Português', 'English'). Spanish is looked
// up by the Portuguese text, with English as the fallback.
import { ES } from './i18nEs';
import { currentLocale } from './localeState';
export function tx(pt: boolean, ptText: string, en: string) {
  return pt ? ptText : currentLocale() === 'es' ? ES[ptText] ?? en : en;
}
export const esText = (ptText: string, en: string) => ES[ptText] ?? en;
// Templates with {name} slots, for strings that embed values.
export function txf(pt: boolean, ptText: string, en: string, vars: Record<string, string | number>) {
  let text = tx(pt, ptText, en);
  for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}
