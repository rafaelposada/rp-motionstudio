// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useSceneStore } from '@/store/useSceneStore';
import { editSelectedModels } from '@/lib/compositionEditing';
import { trackWindow, type MotionTrack } from '@/lib/tracks';
import TransitionControls from './TransitionControls';

export default function ModelTransitionControls({ track, pt }: { track: MotionTrack; pt: boolean }) {
  const duration = useSceneStore(s => s.duration), fps = useSceneStore(s => s.fps);
  const { inFrame, outFrame, length } = trackWindow(track, Math.round(duration * fps));
  return <TransitionControls pt={pt} settings={track} length={Math.max(0, length - 1) / fps}
    onChange={({ entrance, exit, ...timing }) => {
      editSelectedModels(track.id, () => ({
        ...timing, ...(entrance && entrance !== 'typewriter' ? { entrance } : {}), ...(exit && exit !== 'typewriter' ? { exit } : {}),
      }));
    }}
    onChoose={(phase, mode) => {
      if (mode === 'none') return;
      const scene = useSceneStore.getState(), seconds = track[`${phase}Duration`] ?? .35;
      const preview = Math.min(Math.floor((length - 1) / 2), Math.max(1, Math.round(seconds * fps / 2)));
      scene.setPlaying(false);
      scene.setFrame(phase === 'entrance' ? inFrame + preview : outFrame - 1 - preview);
    }}
  />;
}
