// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { Fragment } from 'react';
import { BLEND_GROUPS, blendLabel, blendMode, type BlendMode } from '@/lib/blendModes';
import { controlHelp } from '@/lib/controlHelp';
import { useI18n } from '@/lib/useI18n';
import InfoHint from './InfoHint';
import { tx } from '@/lib/tx';

// Grouped like Framer's menu: darkening, lightening, contrast, inversion and
// component modes, separated by native menu dividers.
export function BlendSelect({ value, onChange, className = 'field' }: { value: unknown; onChange: (mode: BlendMode) => void; className?: string }) {
  const { locale } = useI18n(), pt = locale === 'pt';
  return (
    <select className={className} value={blendMode(value)} aria-label={tx(pt, 'Mesclagem', 'Blending')} onChange={(e) => onChange(blendMode(e.target.value))}>
      {BLEND_GROUPS.map((group, index) => <Fragment key={group[0]}>
        {index > 0 && <hr />}
        {group.map((mode) => <option key={mode} value={mode}>{blendLabel(mode, pt)}</option>)}
      </Fragment>)}
    </select>
  );
}

export function BlendRow({ value, onChange }: { value: unknown; onChange: (mode: BlendMode) => void }) {
  const { locale } = useI18n(), label = tx(locale === 'pt', 'Mesclagem', 'Blending');
  return (
    <div className="ctl-row">
      <div className="ctl-label">
        <span>{label}</span>
        <InfoHint text={controlHelp({ key: '_blend', label: 'Blend', type: 'select', default: 'normal' }, locale, label)} name={label} />
      </div>
      <div className="ctl-input"><BlendSelect value={value} onChange={onChange} /></div>
    </div>
  );
}
