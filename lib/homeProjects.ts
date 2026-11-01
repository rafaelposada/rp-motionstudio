import type { ProjectMeta } from './projects';
import type { ScenePartial } from './scenePersist';

export function matchingProjects<T extends ProjectMeta>(projects: T[], query: string, sort: 'recent' | 'name') {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const wanted = normalize(query.trim());
  return projects.filter(project => normalize(project.name).includes(wanted)).sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) : b.updatedAt - a.updatedAt);
}

export function homeProjectSummary(scene: ScenePartial | null) {
  return {
    aspect: scene?.aspect && scene.aspect !== 'custom' ? scene.aspect : scene?.width && scene?.height ? `${scene.width} × ${scene.height}` : '—',
    duration: scene?.duration ?? null,
    layers: (scene?.tracks?.length ?? 0) + (scene?.textLayers?.length ?? 0),
  };
}
