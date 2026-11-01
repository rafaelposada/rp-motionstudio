import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { useProjectStore } from '@/store/useProjectStore';
import { flushScene } from './scenePersist';
import { getRendererInstance } from './rendererInstance';
import { saveProjectPreview } from './projectPreviews';

export async function showHome() {
  useSceneStore.getState().setPlaying(false);
  flushScene();
  const projects = useProjectStore.getState();
  try {
    if (projects.activeId) await saveProjectPreview(projects.activeId, getRendererInstance()?.extractCanvas());
  } catch { /* A missing thumbnail must never prevent returning home. */ }
  projects.refresh();
  useUIStore.getState().setNav('home');
}

export function enterProject(id: string) {
  useSceneStore.getState().setPlaying(false);
  useProjectStore.getState().open(id);
  useSceneStore.getState().setPlaying(false);
  useUIStore.getState().selectText(null);
  useUIStore.getState().setMobilePanelOpen(false);
  useUIStore.getState().setNav('library');
}
