// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// The active interface locale, readable outside React (tx, help texts).
// useUIStore keeps it in sync; it defaults to English like the store.
import type { Locale } from './i18n';
let current: Locale = 'en';
export const currentLocale = () => current;
export const setCurrentLocale = (locale: Locale) => { current = locale; };
