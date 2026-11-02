// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useHistoryStore } from '@/store/useHistoryStore';
import { RedoIcon, UndoIcon } from './EditorIcons';
import { useUIStore } from '@/store/useUIStore';

// Undo / redo, floating over the stage. It sits here rather than in the
// transport row because it acts on the scene, not on the clock — and the stage
// already owns the floating-control idiom (fullscreen, panel toggles).
export default function HistoryControls() {
  const pt = useUIStore(s => s.locale) === 'pt';
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  return (
    <div className="stage-history">
      <button
        className="stage-hist-btn"
        onClick={undo}
        disabled={!canUndo}
        title={pt ? 'Desfazer (Ctrl/⌘Z)' : 'Undo (Ctrl/⌘Z)'}
        aria-label={pt ? 'Desfazer' : 'Undo'}
      >
        <UndoIcon size={15} />
      </button>
      <span className="stage-hist-sep" />
      <button
        className="stage-hist-btn"
        onClick={redo}
        disabled={!canRedo}
        title={pt ? 'Refazer (Ctrl/⌘⇧Z)' : 'Redo (Ctrl/⌘⇧Z)'}
        aria-label={pt ? 'Refazer' : 'Redo'}
      >
        <RedoIcon size={15} />
      </button>
    </div>
  );
}
