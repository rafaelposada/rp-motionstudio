import JSZip from 'jszip';
import { idbGet, idbPut, idbDelete, idbKeys } from './assetDb';
import { buildScenePartial, flushScene, type ScenePartial } from './scenePersist';
import { activeProjectId, createProject, listProjects, readProjectScene } from './projects';
import { useSceneStore } from '@/store/useSceneStore';
import { templates } from '@/templates';
import { prepareTextFonts } from './textLayers';
import { projectPreviewKey } from './projectPreviews';

interface Entry { key: string; path: string; type: string }
interface PackageManifest { format: 'motion-studio'; version: 1; name: string; kind?: 'draft' | 'template'; scene: ScenePartial; files: Entry[] }
const MAX_BYTES = 512 * 1024 * 1024;

export async function saveProjectPackage(id: string, kind: 'draft' | 'template' = 'draft') {
  flushScene();
  const current = useSceneStore.getState(), isActive = id === activeProjectId();
  const scene = isActive ? buildScenePartial(current) : readProjectScene(id);
  if (!scene) throw new Error('Projeto sem dados.');
  const name = listProjects().find((p) => p.id === id)?.name ?? 'Projeto';
  const zip = new JSZip();
  const files: Entry[] = [];
  let bytes = 0;
  const add = async (key: string, blob: Blob) => {
    if (files.some((file) => file.key === key)) return;
    bytes += blob.size;
    if (bytes > MAX_BYTES) throw new Error('O pacote ultrapassa o limite de 512 MB.');
    const path = `media/${files.length}`;
    zip.file(path, await blob.arrayBuffer());
    files.push({ key, path, type: blob.type });
  };
  for (const asset of scene.assets) {
    if (asset.origin === 'demo') continue;
    const blob = asset.origin === 'upload' ? await idbGet(asset.id) : asset.url ? await fetch(asset.url).then((r) => { if (!r.ok) throw new Error('Mídia inacessível.'); return r.blob(); }) : null;
    if (!blob) throw new Error(`Arquivo ausente: ${asset.name}. Vincule-o novamente em Mídia.`);
    await add(asset.id, blob);
  }
  await prepareTextFonts((scene.textLayers ?? []).filter((layer) => !layer.media).map((layer) => ({ ...layer, visible: true })));
  for (const layer of scene.textLayers ?? []) {
    if (layer.media) { const blob = await idbGet(layer.media.blobId); if (!blob) throw new Error(`Mídia ausente: ${layer.text}`); await add(layer.media.blobId, blob); continue; }
    const key = `font:${layer.font}:${layer.weight}`;
    const blob = await idbGet(key);
    if (blob) await add(key, blob);
  }
  for (const [key, id] of [['audio', scene.audioBlobId], ['logo', scene.logo.blobId], ['background', scene.background.blobId]] as const) {
    if (id) { const blob = await idbGet(id); if (!blob) throw new Error(`Mídia ausente: ${key}`); await add(`aux:${key}`, blob); }
  }
  // These URLs are deliberately omitted by the disk slice; package the live
  // sources when exporting the active scene, without touching other projects.
  if (isActive) {
    for (const [key, url] of [['audio', current.audioUrl], ['logo', current.logo.url], ['background', current.background.imageUrl]] as const) {
      if (url) await add(`aux:${key}`, await fetch(url).then((r) => r.blob()));
    }
  }
  zip.file('project.json', JSON.stringify({ format: 'motion-studio', version: 1, name, kind, scene, files } satisfies PackageManifest));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const response = await fetch('/api/project-package', { method: 'POST', headers: { 'X-Project-Name': encodeURIComponent(name), 'X-Package-Kind': kind }, body: blob });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ path: string }>;
}

export function validateManifest(data: unknown): asserts data is PackageManifest {
  const m = data as PackageManifest;
  if (!m || m.format !== 'motion-studio' || m.version !== 1 || typeof m.name !== 'string' || !m.scene || !Array.isArray(m.files) || m.files.length > 2000) throw new Error('Pacote de projeto inválido.');
  const s = m.scene;
  if (!Array.isArray(s.assets) || !Array.isArray(s.tracks) || !s.tracks.length || s.tracks.length > 100 || ![s.width, s.height, s.duration, s.fps].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0) || s.width > 8192 || s.height > 8192 || s.duration > 3600 || s.fps > 120) throw new Error('Configurações de projeto inválidas.');
  if (s.tracks.some((track) => !track || !(track.templateId in templates))) throw new Error('O pacote contém um modelo indisponível.');
  const keys = new Set<string>();
  for (const file of m.files) {
    if (typeof file.key !== 'string' || keys.has(file.key) || !/^media\/\d+$/.test(file.path) || typeof file.type !== 'string') throw new Error('Manifesto de mídia inválido.');
    keys.add(file.key);
  }
}

export async function importProjectPackage(file: File) {
  if (file.size > MAX_BYTES) throw new Error('Pacote maior que 512 MB.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file('project.json');
  if (!manifestFile) throw new Error('Este arquivo não é um pacote Motion Studio.');
  const manifest: unknown = JSON.parse(await manifestFile.async('string'));
  validateManifest(manifest);
  const scene = structuredClone(manifest.scene);
  const mapping = new Map<string, string>();
  const written: string[] = [];
  let bytes = 0;
  try {
    for (const entry of manifest.files) {
      const source = zip.file(entry.path);
      if (!source) throw new Error(`Mídia ausente no pacote: ${entry.path}`);
      const data = await source.async('uint8array');
      bytes += data.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Mídia descompactada maior que 512 MB.');
      const key = entry.key.startsWith('font:') ? entry.key : `import_${crypto.randomUUID()}`;
      if (entry.key.startsWith('font:') && await idbGet(key)) { mapping.set(entry.key, key); continue; }
      await idbPut(key, new Blob([data as BlobPart], { type: entry.type }));
      written.push(key); mapping.set(entry.key, key);
    }
    scene.assets = scene.assets.map((asset) => {
      if (asset.origin === 'demo') return asset;
      const key = mapping.get(asset.id);
      if (!key) throw new Error(`Arquivo ausente: ${asset.name}`);
      return { ...asset, id: key, origin: 'upload' as const, url: '' };
    });
    scene.tracks = scene.tracks.map((track) => ({ ...track, assetIds: track.assetIds.map((id) => mapping.get(id) ?? id) }));
    scene.textLayers = (scene.textLayers ?? []).map((layer) => layer.media ? { ...layer, media: { ...layer.media, blobId: mapping.get(layer.media.blobId) ?? layer.media.blobId, url: '' } } : layer);
    for (const [key, field] of [['aux:audio', 'audioUrl'], ['aux:logo', 'logo'], ['aux:background', 'background']] as const) {
      const blobKey = mapping.get(key);
      const blob = blobKey ? await idbGet(blobKey) : null;
      if (blob) {
        if (field === 'audioUrl') { scene.audioUrl = null; scene.audioBlobId = blobKey; }
        else if (field === 'logo') scene.logo = { ...scene.logo, url: null, blobId: blobKey };
        else scene.background = { ...scene.background, imageUrl: null, blobId: blobKey };
      }
    }
    flushScene();
    return createProject(`${manifest.name} (importado)`, scene);
  } catch (error) {
    await Promise.all(written.map((key) => idbDelete(key)));
    throw error;
  }
}

export function referencedBlobKeys() {
  const keys = new Set<string>();
  for (const project of listProjects()) keys.add(projectPreviewKey(project.id));
  // Include backups. Confirmed cleanup separately resets the live undo history.
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (!key.startsWith('motion-project-') && key !== 'motion-scene-v1') continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let scene: ScenePartial;
    try { scene = JSON.parse(raw); } catch { throw new Error('Há um projeto ou backup ilegível. Limpeza bloqueada para preservar seus arquivos.'); }
    for (const asset of scene.assets ?? []) if (asset.origin === 'upload') keys.add(asset.id);
    for (const layer of scene.textLayers ?? []) keys.add(layer.media ? layer.media.blobId : `font:${layer.font}:${layer.weight}`);
    for (const id of [scene.audioBlobId, scene.logo?.blobId, scene.background?.blobId]) if (id) keys.add(id);
  }
  return keys;
}

export async function storageReport() {
  flushScene();
  const refs = referencedBlobKeys();
  const keys = await idbKeys();
  const entries = await Promise.all(keys.map(async (key) => ({ key: String(key), size: (await idbGet(String(key)))?.size ?? 0 })));
  const orphaned = entries.filter((entry) => !refs.has(entry.key) && !entry.key.startsWith('font:'));
  return { total: entries.reduce((sum, entry) => sum + entry.size, 0), count: entries.length, orphaned };
}
