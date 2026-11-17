// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import type { LayerAnimation } from '@/lib/layerTransitions';
import { ControlRow } from './Controls';
import { tx } from '@/lib/tx';

const animations = [
  ['none', 'Sem animação', 'None'], ['fade', 'Desvanecer', 'Fade'], ['rise', 'Subir', 'Rise'], ['drop', 'Descer', 'Drop'],
  ['slideLeft', 'Deslizar à esquerda', 'Slide left'], ['slideRight', 'Deslizar à direita', 'Slide right'],
  ['zoomIn', 'Aproximar', 'Zoom in'], ['zoomOut', 'Afastar', 'Zoom out'],
  ['pop', 'Salto suave', 'Pop'], ['rotate', 'Girar', 'Rotate'], ['typewriter', 'Máquina de escrever', 'Typewriter'],
] as const;

type TransitionPhase = 'entrance' | 'exit';
export interface TransitionSettings {
  entrance?: LayerAnimation;
  exit?: LayerAnimation;
  entranceDuration?: number;
  exitDuration?: number;
}

export default function TransitionControls({ settings, length, pt, typewriter, onChange, onChoose }: {
  settings: TransitionSettings;
  length: number;
  pt: boolean;
  typewriter?: boolean;
  onChange: (patch: TransitionSettings) => void;
  onChoose?: (phase: TransitionPhase, mode: LayerAnimation) => void;
}) {
  return <div className="layer-animation-controls">
    {(['entrance', 'exit'] as const).map(phase => {
      const entrance = phase === 'entrance', mode = settings[phase] ?? 'none', durationKey = `${phase}Duration` as const;
      const max = Math.max(.05, length / 2);
      const label = entrance ? tx(pt, 'Animação de entrada', 'Entrance animation') : tx(pt, 'Animação de saída', 'Exit animation');
      const durationLabel = entrance ? tx(pt, 'Duração da entrada', 'Entrance duration') : tx(pt, 'Duração da saída', 'Exit duration');
      return <div className="transition-phase" key={phase}>
        <label className="text-edit-label">{label}<select className="field" value={mode} onChange={e => {
          const next = e.target.value as LayerAnimation;
          onChange({ [phase]: next });
          onChoose?.(phase, next);
        }}>
          {animations.filter(([id]) => typewriter || id !== 'typewriter').map(([id, br, en]) => <option key={id} value={id}>{tx(pt, br, en)}</option>)}
        </select></label>
        {mode !== 'none' && <ControlRow def={{ key: durationKey, label: durationLabel, type: 'slider', min: .05, max, step: .01, unit: 's', default: .35 }}
          value={Math.min(max, settings[durationKey] ?? .35)} onChange={value => onChange({ [durationKey]: Number(value) })} />}
      </div>;
    })}
  </div>;
}
