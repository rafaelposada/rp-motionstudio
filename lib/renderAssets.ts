// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import type { SceneState } from '@/store/useSceneStore';
import { trackAssetIndices } from './tracks';
import { isVideoSource } from './videoTexture';

type RenderScene = Pick<SceneState,'tracks'|'activeTrackId'|'compositeMode'|'assets'|'background'|'logo'>;
export function renderableTracks(scene: Pick<RenderScene,'tracks'|'activeTrackId'|'compositeMode'>) {
  return scene.tracks.filter(track=>track.visible&&(scene.compositeMode==='stack'||track.id===scene.activeTrackId));
}
export function renderableAssets(scene:RenderScene) {
  const indices=new Set(renderableTracks(scene).flatMap(track=>trackAssetIndices(track,scene.assets)));
  return [...indices].map(index=>scene.assets[index]).filter(asset=>asset?.visible&&asset.origin!=='demo'&&!!asset.url);
}
export function renderableAssetUrls(scene:RenderScene) {
  return new Set([...renderableAssets(scene).map(asset=>asset.url),scene.logo.url,scene.background.source==='image'?scene.background.imageUrl:null]);
}
export function exportImageUrls(scene:RenderScene) {
  return [...new Set([...renderableAssets(scene).filter(asset=>!isVideoSource(asset.url,asset.kind)).map(asset=>asset.url),scene.logo.url,scene.background.source==='image'?scene.background.imageUrl:null].filter((url):url is string=>!!url))];
}
