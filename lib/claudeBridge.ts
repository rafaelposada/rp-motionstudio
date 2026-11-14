// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// What Claude can do in the editor (through the app's MCP server). Every
// command runs the same store actions as the panels and counts as one undo
// step, so anything Claude builds can be inspected, tweaked or undone by hand.
'use client';
import { useSceneStore, ASPECTS } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { getTemplate, templateList } from '@/templates';
import { getRendererInstance } from './rendererInstance';
import { enterProject } from './homeNavigation';
import { listProjects, activeProjectId } from './projects';
import { useBrandKits, applyKit } from './brandKits';
import { compositionOrder } from './composition';
import { deleteCompositionLayers } from './compositionActions';
import { idbDelete, idbPut } from './assetDb';
import { sceneRestoreRevision } from '@/store/useSceneStore';
import { runExport, type Fmt, type Res } from './exportRunner';
import { addShape } from '@/components/ShapePanel';
import type { ShapeSpec, TextLayer } from './textLayers';
import type { LayerAnimation } from './textLayers';
import { normalizeCode, CODE_EXAMPLE } from './codeLayer';

export interface MediaFile { name: string; mime: string; bytes: Uint8Array }
type Args = Record<string, any>;

const num = (v: unknown, fallback: number, min = -1e6, max = 1e6) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const str = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback;
const ANIMATIONS: LayerAnimation[] = ['none', 'fade', 'rise', 'drop', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'pop', 'rotate', 'typewriter'];
const animation = (v: unknown) => ANIMATIONS.includes(v as LayerAnimation) ? v as LayerAnimation : undefined;

// Layer properties Claude may set directly. Anything else is ignored.
const LAYER_KEYS = ['text', 'font', 'weight', 'size', 'color', 'x', 'y', 'rotation', 'opacity', 'scaleX', 'scaleY', 'align', 'lineHeight', 'letterSpacing', 'boxWidth', 'wrap', 'start', 'end', 'visible', 'locked', 'stroke', 'strokeWidth', 'fillOpacity', 'backdrop', 'backdropColor', 'backdropOpacity', 'backdropRadius', 'backdropBlur', 'shadowColor', 'shadowBlur', 'shadowX', 'shadowY', 'shadowOpacity', 'entrance', 'exit', 'entranceDuration', 'exitDuration', 'blend', 'tiltX', 'tiltY', 'fov', 'maskId', 'maskInvert', 'keyframes', 'code'] as const;
const SHAPE_KEYS = ['width', 'height', 'sides', 'points', 'innerRadius', 'fill', 'fillOpacity', 'stroke', 'strokeWidth', 'strokeOpacity', 'radius', 'cornerRadii'] as const;

function pick<T extends readonly string[]>(source: Args | undefined, keys: T) {
  const out: Args = {};
  if (source && typeof source === 'object') for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

async function waitForRenderer(timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (getRendererInstance() && useUIStore.getState().nav !== 'home') return getRendererInstance()!;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('O editor não abriu uma composição. Crie ou abra um projeto primeiro.');
}

function inEditor() {
  if (useUIStore.getState().nav === 'home' || !activeProjectId()) throw new Error('Nenhuma composição aberta. Use new_project ou open_project.');
}

// One command = one undo step.
async function recorded<T>(work: () => T | Promise<T>): Promise<T> {
  const history = useHistoryStore.getState();
  history.beginGesture();
  try { const result = await work(); history.endGesture(); return result; }
  catch (error) { history.endGesture(true); throw error; }
}

function layerSummary(layer: TextLayer) {
  return {
    id: layer.id, kind: layer.code ? 'code' : layer.media ? 'image' : layer.shape ? `shape:${layer.shape.kind}` : 'text',
    name: layer.text, x: Math.round(layer.x), y: Math.round(layer.y), rotation: layer.rotation, opacity: layer.opacity,
    start: layer.start, end: layer.end, visible: layer.visible,
    ...(layer.shape ? { width: layer.shape.width, height: layer.shape.height, fill: layer.shape.fill, media: layer.shape.media ? layer.shape.media.kind : undefined } : {}),
    ...(!layer.shape && !layer.media && !layer.code ? { font: layer.font, size: layer.size, weight: layer.weight, color: layer.color, entrance: layer.entrance, exit: layer.exit } : {}),
    ...(layer.code ? { width: layer.code.width, height: layer.code.height, engine: layer.code.engine } : {}),
  };
}

function state() {
  const s = useSceneStore.getState(), ui = useUIStore.getState(), project = activeProjectId();
  const template = getTemplate(s.activeTemplateId);
  return {
    project: project && ui.nav !== 'home' ? { id: project, name: listProjects().find((p) => p.id === project)?.name } : null,
    canvas: { aspect: s.aspect, width: s.width, height: s.height, duration: s.duration, fps: s.fps, frame: s.frame },
    template: { id: template.meta.id, name: template.meta.name, group: template.meta.group, values: s.values },
    background: { color: s.background.color, color2: s.background.color2, gradient: s.background.gradient, source: s.background.source },
    cards: s.assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, demo: a.origin === 'demo' })),
    layers: compositionOrder(s.tracks, s.textLayers).reverse().map((item) => {
      const layer = s.textLayers.find((l) => l.id === item.id);
      if (layer) return layerSummary(layer);
      const track = s.tracks.find((t) => t.id === item.id)!;
      return { id: track.id, kind: 'motion', name: track.name, template: track.templateId, visible: track.visible };
    }),
    brandKits: useBrandKits.getState().kits.map((k) => ({ id: k.id, name: k.name, colors: k.colors, heading: k.heading, body: k.body, logo: !!k.logo })),
    aspects: Object.keys(ASPECTS),
  };
}

function templates(args: Args) {
  const group = str(args.group).toLowerCase();
  return templateList.filter((t) => !t.meta.catalogHidden && (!group || t.meta.group.toLowerCase().includes(group))).map((t) => ({
    id: t.meta.id, name: t.meta.name, group: t.meta.group, engine: t.meta.engine ?? 'pixi', spatial: !!t.meta.catalog3d, static: !!t.meta.staticByDefault, isNew: !!t.meta.isNew,
    ...(args.withControls ? { controls: t.controls.filter((c) => !c.advanced).map((c) => ({ key: c.key, label: c.label, type: c.type, min: c.min, max: c.max, options: c.options, default: c.default, unit: c.unit })) } : {}),
  }));
}

async function newProject(args: Args) {
  const name = str(args.name, 'Composição do Claude').slice(0, 80);
  useProjectStore.getState().create(name);
  const id = useProjectStore.getState().activeId;
  if (!id) throw new Error('Não foi possível criar o projeto.');
  enterProject(id);
  await waitForRenderer();
  await setComposition(args);
  return state();
}

async function setComposition(args: Args) {
  inEditor();
  return recorded(() => {
    const s = useSceneStore.getState();
    if (args.aspect) { if (!ASPECTS[args.aspect]) throw new Error(`Formato inválido. Use: ${Object.keys(ASPECTS).join(', ')}`); s.setAspect(args.aspect); }
    if (args.duration !== undefined) s.setDuration(num(args.duration, s.duration, 1, 120));
    if (args.template) { if (!templateList.some((t) => t.meta.id === args.template)) throw new Error('Modelo inexistente. Consulte list_templates.'); useSceneStore.getState().setActiveTemplate(args.template); }
    if (args.values && typeof args.values === 'object') for (const [key, value] of Object.entries(args.values)) useSceneStore.getState().setValue(key, value);
    if (args.background && typeof args.background === 'object') {
      const b = args.background;
      useSceneStore.getState().setBackground({ source: 'color', ...(b.color ? { color: str(b.color) } : {}), ...(b.color2 ? { color2: str(b.color2) } : {}), ...(b.gradient !== undefined ? { gradient: !!b.gradient } : {}) });
    }
    return state();
  });
}

function layerPatch(args: Args): Partial<TextLayer> {
  const patch = pick(args, LAYER_KEYS) as Partial<TextLayer> & Args;
  for (const key of ['entrance', 'exit'] as const) if (key in patch) patch[key] = animation(patch[key]) ?? 'none';
  if ('code' in patch) delete patch.code;
  return patch;
}

async function addText(args: Args) {
  inEditor();
  return recorded(() => {
    const s = useSceneStore.getState();
    s.addTextLayer();
    const layer = useSceneStore.getState().textLayers.at(-1)!;
    useSceneStore.getState().patchTextLayer(layer.id, { text: str(args.text, 'Seu texto'), x: s.width / 2, y: s.height / 2, ...layerPatch(args) });
    return layerSummary(useSceneStore.getState().textLayers.find((l) => l.id === layer.id)!);
  });
}

async function addShapeLayer(args: Args) {
  inEditor();
  const kinds: ShapeSpec['kind'][] = ['rect', 'ellipse', 'polygon', 'star', 'line'];
  const kind = kinds.includes(args.kind) ? args.kind as ShapeSpec['kind'] : 'rect';
  return recorded(() => {
    addShape(kind, useUIStore.getState().locale === 'pt');
    const layer = useSceneStore.getState().textLayers.at(-1)!;
    useSceneStore.getState().patchTextLayer(layer.id, { ...layerPatch(args), shape: { ...layer.shape!, ...pick(args.shape ?? args, SHAPE_KEYS) } });
    return layerSummary(useSceneStore.getState().textLayers.find((l) => l.id === layer.id)!);
  });
}

async function updateLayer(args: Args) {
  inEditor();
  const s = useSceneStore.getState(), layer = s.textLayers.find((l) => l.id === args.id);
  if (!layer) throw new Error('Camada não encontrada. Consulte get_state.');
  return recorded(() => {
    const patch: Partial<TextLayer> = layerPatch(args.patch ?? {});
    if (layer.shape && args.patch?.shape) patch.shape = { ...layer.shape, ...pick(args.patch.shape, SHAPE_KEYS) };
    if (layer.code && args.patch?.code) patch.code = normalizeCode({ ...layer.code, ...args.patch.code });
    useSceneStore.getState().patchTextLayer(layer.id, patch);
    return layerSummary(useSceneStore.getState().textLayers.find((l) => l.id === layer.id)!);
  });
}

async function removeLayer(args: Args) {
  inEditor();
  const ids: string[] = Array.isArray(args.ids) ? args.ids : [args.id];
  const s = useSceneStore.getState();
  const known = ids.filter((id) => s.textLayers.some((l) => l.id === id) || s.tracks.some((t) => t.id === id));
  if (!known.length) throw new Error('Camada não encontrada.');
  await recorded(async () => {
    for (const id of known) {
      if (s.textLayers.some((l) => l.id === id)) useSceneStore.getState().removeTextLayer(id);
      else if (useSceneStore.getState().tracks.length > 1) useSceneStore.getState().removeTrack(id);
    }
  });
  void deleteCompositionLayers; // panels confirm deletions; commands are explicit already
  return state().layers;
}

function mediaKind(file: MediaFile) { return file.mime.startsWith('video/') ? 'video' : 'image'; }

async function mediaSize(url: string, kind: 'image' | 'video') {
  if (kind === 'image') { const image = new Image(); image.src = url; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }
  const video = document.createElement('video'); video.preload = 'metadata'; video.muted = true; video.src = url;
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Vídeo ilegível.')); });
  const size = { width: video.videoWidth, height: video.videoHeight }; video.removeAttribute('src'); video.load(); return size;
}

// Photos and videos read from disk by the app (Claude passes the paths).
async function addMedia(args: Args, files: MediaFile[]) {
  inEditor();
  if (!files.length) throw new Error('Nenhum arquivo de imagem ou vídeo foi lido.');
  const target = str(args.target, 'cards');
  if (target === 'cards') {
    return recorded(() => {
      if (args.replace) useSceneStore.getState().clearAssets();
      useSceneStore.getState().addAssets(files.map((f) => { const blob = new Blob([f.bytes as BlobPart], { type: f.mime }); return { name: f.name, url: URL.createObjectURL(blob), kind: mediaKind(f), blob }; }));
      return state().cards;
    });
  }
  const file = files[0], kind = mediaKind(file), blob = new Blob([file.bytes as BlobPart], { type: file.mime }), url = URL.createObjectURL(blob);
  const revision = sceneRestoreRevision(), size = await mediaSize(url, kind);
  if (target === 'shape') {
    const layer = useSceneStore.getState().textLayers.find((l) => l.id === args.layerId && l.shape);
    if (!layer) throw new Error('Informe layerId de uma forma para receber a mídia.');
    const blobId = `shapefill_${crypto.randomUUID()}`; await idbPut(blobId, blob);
    if (revision !== sceneRestoreRevision()) { await idbDelete(blobId); throw new Error('O projeto mudou durante a importação.'); }
    return recorded(() => {
      const shape = useSceneStore.getState().textLayers.find((l) => l.id === layer.id)!.shape!;
      useSceneStore.getState().patchTextLayer(layer.id, { shape: { ...shape, media: { blobId, url, kind, ...size, name: file.name, fit: args.fit ?? 'fill' } } });
      return layerSummary(useSceneStore.getState().textLayers.find((l) => l.id === layer.id)!);
    });
  }
  if (kind !== 'image') throw new Error('Camadas soltas aceitam só imagem; para vídeo use target "cards" ou "shape".');
  const blobId = `overlay_${crypto.randomUUID()}`; await idbPut(blobId, blob);
  if (revision !== sceneRestoreRevision()) { await idbDelete(blobId); throw new Error('O projeto mudou durante a importação.'); }
  return recorded(() => {
    const s = useSceneStore.getState(); s.addTextLayer();
    const layer = useSceneStore.getState().textLayers.at(-1)!, width = num(args.width, Math.min(s.width * .35, size.width), 1, 8000);
    useSceneStore.getState().patchTextLayer(layer.id, { text: file.name, media: { blobId, url, width, height: width * size.height / size.width, fit: 'contain' }, x: s.width / 2, y: s.height / 2, ...layerPatch(args) });
    return layerSummary(useSceneStore.getState().textLayers.find((l) => l.id === layer.id)!);
  });
}

async function setCodeLayer(args: Args) {
  inEditor();
  const s = useSceneStore.getState();
  const existing = args.id ? s.textLayers.find((l) => l.id === args.id && l.code) : undefined;
  if (args.id && !existing) throw new Error('Camada de código não encontrada.');
  return recorded(() => {
    const id = existing?.id ?? (() => { useSceneStore.getState().addTextLayer(); return useSceneStore.getState().textLayers.at(-1)!.id; })();
    const base = existing?.code ?? { engine: '2d' as const, width: s.width, height: s.height, source: CODE_EXAMPLE, params: {} };
    useSceneStore.getState().patchTextLayer(id, {
      ...(existing ? {} : { text: str(args.name, 'Código'), x: s.width / 2, y: s.height / 2 }),
      ...layerPatch(args),
      code: normalizeCode({ ...base, ...pick(args, ['engine', 'width', 'height', 'source', 'params'] as const) }),
    });
    return layerSummary(useSceneStore.getState().textLayers.find((l) => l.id === id)!);
  });
}

// The current frame as an image, so Claude checks its work instead of guessing.
async function snapshot(args: Args) {
  inEditor();
  const renderer = await waitForRenderer(), s = useSceneStore.getState();
  const frame = Math.round(num(args.time, s.frame / s.fps, 0, s.duration) * s.fps);
  await renderer.seekVideos?.(frame);
  renderer.captureFrame(frame, 'image/png');
  const source = renderer.extractCanvas(), edge = num(args.maxEdge, 1024, 256, 2048);
  const k = Math.min(1, edge / Math.max(source.width, source.height));
  const out = document.createElement('canvas'); out.width = Math.round(source.width * k); out.height = Math.round(source.height * k);
  out.getContext('2d')!.drawImage(source, 0, 0, out.width, out.height);
  window.dispatchEvent(new Event('motion-canvas-edit')); // repaint the live preview at its own frame
  return { image: out.toDataURL('image/png'), time: frame / s.fps, width: out.width, height: out.height };
}

async function exportVideo(args: Args) {
  inEditor();
  await waitForRenderer();
  const formats: Fmt[] = ['mp4', 'gif', 'both', 'mov'], resolutions: Res[] = ['1080p', '2k', '4k'];
  const format = formats.includes(args.format) ? args.format as Fmt : 'mp4', res = resolutions.includes(args.resolution) ? args.resolution as Res : '1080p';
  const extra = Array.isArray(args.extraAspects) ? args.extraAspects.filter((a: string) => ASPECTS[a] && a !== useSceneStore.getState().aspect) : [];
  return runExport({ format, res, extraAspects: extra });
}

async function applyBrandKit(args: Args) {
  inEditor();
  if (!useBrandKits.getState().kits.length) useBrandKits.getState().hydrate();
  const kit = useBrandKits.getState().kits.find((k) => k.id === args.id || k.name === args.name);
  if (!kit) throw new Error('Kit de marca não encontrado. Consulte get_state.');
  await applyKit(kit, { fonts: args.fonts !== false, colors: args.colors !== false, logo: !!args.logo });
  return state();
}

export async function runClaudeCommand(command: string, args: Args = {}, files: MediaFile[] = []) {
  if (!useBrandKits.getState().kits.length) useBrandKits.getState().hydrate();
  switch (command) {
    case 'get_state': return state();
    case 'list_templates': return templates(args);
    case 'list_projects': return listProjects().map((p) => ({ id: p.id, name: p.name, updatedAt: new Date(p.updatedAt).toISOString() }));
    case 'open_project': {
      if (!listProjects().some((p) => p.id === args.id)) throw new Error('Projeto não encontrado. Consulte list_projects.');
      enterProject(args.id); await waitForRenderer(); return state();
    }
    case 'new_project': return newProject(args);
    case 'set_composition': return setComposition(args);
    case 'add_text': return addText(args);
    case 'add_shape': return addShapeLayer(args);
    case 'update_layer': return updateLayer(args);
    case 'remove_layer': return removeLayer(args);
    case 'add_media': return addMedia(args, files);
    case 'set_code_layer': return setCodeLayer(args);
    case 'apply_brand_kit': return applyBrandKit(args);
    case 'snapshot': return snapshot(args);
    case 'export_video': return exportVideo(args);
    case 'undo': useHistoryStore.getState().undo(); return state();
    case 'redo': useHistoryStore.getState().redo(); return state();
    default: throw new Error(`Comando desconhecido: ${command}`);
  }
}
