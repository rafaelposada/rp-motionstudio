'use client';

import { useId, useState } from 'react';
import { useI18n } from '@/lib/useI18n';

export default function InfoHint({ text, name }: { text: string; name: string }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info-hint" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="info-hint-button"
        aria-label={locale === 'pt' ? `Informações sobre ${name}` : `Information about ${name}`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      <span id={id} role="tooltip" className="info-hint-popover">{text}</span>
    </span>
  );
}

export function InfoLabel({ children, help, name, className = 'ctl-label' }: {
  children: React.ReactNode;
  help: string;
  name: string;
  className?: string;
}) {
  return <span className={className}>{children}<InfoHint text={help} name={name} /></span>;
}
