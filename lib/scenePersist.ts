// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { useSceneStore, type SceneState } from '@/store/useSceneStore';
import { writeProjectScene } from './projects';
import { useUIStore } from '@/store/useUIStore';

// Client-side scene persistence. Settings live in localStorage; uploaded media
// bytes live in IndexedDB (see lib/assetDb). A refresh restores the full working
// state instead of resetting to defaults.
//
// Why hand-rolled instead of zustand's persist middleware: `frame` changes every
// animation frame during playback. The middleware re-serializes and writes on
// EVERY store change, which would hammer localStorage ~30–60×/s. Here the auto-
// save is throttled and skips the write when the persisted slice is unchanged,
// so playback (frame-only churn) never touches disk.

export const SCENE_KEY = 'motion-scene-v1';

// The persisted slice — everything except the transient clock (frame/playing)
// and separately-stored custom presets. Uploaded assets keep only metadata; their
// url is rebuilt from IndexedDB on load, so a dead blob: string is never saved.
export function buildScenePartial(s: SceneState) {
  return {
    // Motion tracks are the source of truth for what animates; the flat
    // activeTemplateId/values/easing triple below is the active track's
    // projection, kept for scenes saved before tracks existed (hydrate folds a
    // trackless save back into a single track).
    tracks: s.tracks,
    textLayers: s.textLayers.map((layer) => layer.media ? { ...layer, media: { ...layer.media, url: '' } } : layer),
    compositeMode: s.compositeMode,
    guides: s.guides,
    markers: s.markers,
    activeTrackId: s.activeTrackId,
    activeTemplateId: s.activeTemplateId,
    values: s.values,
    easing: s.easing,
    fps: s.fps,
    duration: s.duration,
    aspect: s.aspect,
    width: s.width,
    height: s.height,
    customW: s.customW,
    customH: s.customH,
    safeArea: s.safeArea,
    audioUrl: s.audioUrl?.startsWith('blob:') ? null : s.audioUrl,
    audioBlobId: s.audioBlobId,
    audioSettings: s.audioSettings,
    // blob-backed logo/background images aren't persisted (they'd be dead on
    // reload); remote/color backgrounds and logos restore normally.
    background: s.background.imageUrl?.startsWith('blob:')
      ? { ...s.background, imageUrl: null }
      : s.background,
    logo: s.logo.url?.startsWith('blob:') ? { ...s.logo, url: null } : s.logo,
    cardShape: s.cardShape,
    videoEnd: s.videoEnd,
    effects: s.effects,
    assets: s.assets.map((a) => (a.origin === 'upload' ? { ...a, url: '' } : a)),
  };
}

export type ScenePartial = ReturnType<typeof buildScenePartial>;

// Read the legacy single-scene blob. Projects superseded it (see lib/projects),
// which migrates this into a project on first run; the key is kept as a backup.
export function loadScene(): ScenePartial | null {
  try {
    const raw = localStorage.getItem(SCENE_KEY);
    return raw ? (JSON.parse(raw) as ScenePartial) : null;
  } catch {
    return null;
  }
}

// Which project the autosave writes into. Set when a project is opened; while
// null, autosave holds its writes rather than guessing a destination and
// stamping a scene onto the wrong project.
let autosaveTarget: string | null = null;
let lastSig = '';
export interface SaveState { status: 'saved' | 'saving' | 'error' | 'pending'; savedAt: number | null }
let saveState: SaveState = { status: 'saved', savedAt: null };
export function getSaveState(): SaveState { return saveState; }
function reportSave(status: SaveState['status'], wrote = true) {
  saveState = { status, savedAt: status === 'saved' && wrote ? Date.now() : saveState.savedAt };
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('motion-save-status', { detail: status }));
}

export function setAutosaveTarget(projectId: string | null, seedSig?: ScenePartial | null): void {
  autosaveTarget = projectId;
  // Seed the change signature with what was just loaded, so merely opening a
  // project doesn't immediately rewrite it (and bump its updatedAt).
  lastSig = seedSig ? JSON.stringify(seedSig) : '';
  saveState = { status: 'saved', savedAt: null };
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('motion-save-status', { detail: 'saved' }));
}

/**
 * Write the live scene into the active project now, bypassing the throttle.
 * Call before switching projects, or the last edits land in the wrong one.
 */
export function flushScene(): void {
  if (!autosaveTarget) return;
  try {
    const partial = buildScenePartial(useSceneStore.getState());
    const sig = JSON.stringify(partial);
    if (sig === lastSig) { if (saveState.status !== 'saved') reportSave('saved', false); return; }
    writeProjectScene(autosaveTarget, partial);
    lastSig = sig;
    reportSave('saved');
  } catch {
    reportSave('error');
    /* quota exceeded or serialize error — skip this write, non-fatal */
  }
}

// Start throttled auto-save into the active project. Returns an unsubscribe. At
// most one write every ~500ms, and only when the serialized slice actually
// changed — so play/scrub (frame churn) produces zero writes.
export function startSceneAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let observed = useSceneStore.getState();
  const persistedKeys = [
    'tracks', 'textLayers', 'compositeMode', 'activeTrackId', 'fps', 'duration', 'aspect', 'width', 'height',
    'customW', 'customH', 'safeArea', 'background', 'logo', 'cardShape',
    'videoEnd', 'effects', 'assets', 'audioUrl', 'audioBlobId', 'audioSettings',
  ] as const;
  const flush = () => {
    timer = null;
    flushScene();
  };
  const schedule = () => {
    const prefs = useUIStore.getState();
    reportSave(prefs.autosaveEnabled ? 'saving' : 'pending');
    if (timer || !prefs.autosaveEnabled) return;
    timer = setTimeout(flush, prefs.autosaveDelay);
  };
  const stopScene = useSceneStore.subscribe((next) => {
    const changed = persistedKeys.some((key) => next[key] !== observed[key]);
    observed = next;
    // Playback changes only `frame`; skip the timer and JSON serialization.
    if (!changed) return;
    schedule();
  });
  const stopUI = useUIStore.subscribe((next, previous) => {
    if (next.autosaveEnabled === previous.autosaveEnabled && next.autosaveDelay === previous.autosaveDelay) return;
    if (timer) clearTimeout(timer); timer = null;
    if (saveState.status !== 'saved') schedule();
  });
  const leave = () => { if (useUIStore.getState().autosaveEnabled) { if (timer) clearTimeout(timer); timer = null; flushScene(); } };
  const visibility = () => { if (document.visibilityState === 'hidden') leave(); };
  const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur(); flushScene(); } };
  const beforeUnload=(event:BeforeUnloadEvent)=>{
    if(window.rpDesktop)return; // Native close coordinator owns the desktop prompt.
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    leave();
    if(autosaveTarget&&saveState.status!=='saved'){event.preventDefault();event.returnValue='';}
  };
  window.addEventListener('beforeunload',beforeUnload);
  window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', visibility); window.addEventListener('keydown', key);
  return () => { stopScene(); stopUI(); leave(); if (timer) clearTimeout(timer); window.removeEventListener('beforeunload',beforeUnload); window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('keydown', key); };
}
