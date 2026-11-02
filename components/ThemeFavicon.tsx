// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';

// The SVG's media query covers the first load. Once preferences hydrate, the
// favicon follows the editor's appearance even when it differs from macOS.
export default function ThemeFavicon() {
  const theme = useUIStore((state) => state.theme);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => useUIStore.getState().syncSystemTheme();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const href = `/rp-motionstudio-${theme}.svg`;
    const sync = () => {
      for (const icon of document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) {
        if (icon.getAttribute('href') !== href) icon.setAttribute('href', href);
        if (icon.type !== 'image/svg+xml') icon.type = 'image/svg+xml';
        if (icon.sizes.value !== 'any') icon.sizes.value = 'any';
        icon.removeAttribute('media');
      }
    };
    sync();
    // Next can append file-based metadata after the editor has hydrated.
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    return () => observer.disconnect();
  }, [theme]);
  return null;
}
