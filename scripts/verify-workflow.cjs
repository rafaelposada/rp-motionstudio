const path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict');
require('sucrase/register');
const root = path.resolve(__dirname, '..'), resolve = Module._resolveFilename, load = Module._load;
Module._resolveFilename = function (request, parent, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args); };
const pending = new Map();
Module._load = function (request, parent, ...args) {
  if (request === '@/lib/assetDb' || request === './assetDb') return { idbGet: id => new Promise(done => pending.set(id, done)), idbPut: async () => {}, idbDelete: async () => {} };
  return load.call(this, request, parent, ...args);
};
const { useSceneStore, makeTrack } = require('../store/useSceneStore');
const { useUIStore } = require('../store/useUIStore');
const { useHistoryStore } = require('../store/useHistoryStore');
const { duplicateCompositionLayer, reorderCompositionLayer, selectModelForEditing, recoverModel } = require('../lib/compositionActions');
const { compositionOrder } = require('../lib/composition');
const { buildScenePartial } = require('../lib/scenePersist');
const { modelPathOffset, readMotionPath } = require('../lib/modelMotionPath');
const { effectList, effectDefaults } = require('../effects');
const { passesOf, pixiFragment, threeFragment } = require('../effects/adapters/glsl');
const { effectHelp } = require('../lib/effectHelp');
const { xyPadPoint } = require('../lib/xyPad');
const { isLocalFileRequest } = require('../lib/localDestinations');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
async function main() {
  assert.deepEqual(xyPadPoint(-1000, 900, 100, 100, 400), { x: -400, y: 400 }, 'Captured-pointer movement outside an XY pad must stay in range');
  assert.deepEqual(xyPadPoint(50, 50, 100, 100, 400), { x: 0, y: 0 });
  assert.equal(isLocalFileRequest(new Request('http://localhost:3002/api/export', { headers: { host: '127.0.0.1:3002', origin: 'http://127.0.0.1:3002' } })), true);
  assert.equal(isLocalFileRequest(new Request('http://localhost:3002/api/export', { headers: { host: '127.0.0.1:3002', origin: 'https://example.com' } })), false);
  const s = useSceneStore.getState(); s.resetScene(); s.addTextLayer();
  let state = useSceneStore.getState(), text = state.textLayers[0];
  s.patchTextLayer(text.id, { text: 'Fixture', start: 1, end: 6, scaleX: 1.3, fillOpacity: .5, media: { blobId: 'fixture', url: 'blob:fixture', width: 300, height: 100, fit: 'contain', cornerRadii: [1, 2, 3, 4] } });
  const history = useHistoryStore.getState(), stop = history.start(); history.reset();
  const copyId = duplicateCompositionLayer(text.id);
  state = useSceneStore.getState(); const copy = state.textLayers.find(l => l.id === copyId), original = state.textLayers.find(l => l.id === text.id);
  assert.notEqual(copy.id, text.id); assert.equal(copy.media.blobId, original.media.blobId); assert.deepEqual(copy.media.cornerRadii, [1, 2, 3, 4]);
  assert.notEqual(copy.media, original.media); near(copy.x, original.x + 24); assert.equal(copy.end, 6); assert.equal(copy.scaleX, 1.3);
  assert.equal(useHistoryStore.getState().past.length, 1); history.undo(); assert.equal(useSceneStore.getState().textLayers.length, 1); history.redo(); assert.equal(useSceneStore.getState().textLayers.length, 2);
  s.patchTextLayer(copyId, { locked: true }); assert.equal(duplicateCompositionLayer(copyId), null);
  const trackId = useSceneStore.getState().activeTrackId;
  s.patchTrack(trackId, { visible: false, inFrame: 30, outFrame: 120, offset: 27 }); s.setFrame(200);
  selectModelForEditing(trackId); assert.equal(useSceneStore.getState().tracks[0].visible, true); assert.equal(useSceneStore.getState().frame, 31);
  const modelCopy = duplicateCompositionLayer(trackId, 0);
  state = useSceneStore.getState(); const duplicate = state.tracks.find(t => t.id === modelCopy);
  assert.equal(duplicate.offset, 27); assert.equal(duplicate.inFrame, 30); assert.equal(duplicate.outFrame, 120); assert.equal(state.compositeMode, 'stack');
  assert.equal(useUIStore.getState().selectedMotionId, modelCopy);
  const destinationIndex = compositionOrder(useSceneStore.getState().tracks, useSceneStore.getState().textLayers).findIndex(l => l.id === modelCopy);
  reorderCompositionLayer(text.id, modelCopy);
  const order = compositionOrder(useSceneStore.getState().tracks, useSceneStore.getState().textLayers);
  assert.equal(new Set(order.map(l => l.z)).size, order.length); assert.equal(order[destinationIndex].id, text.id);
  // Reproduces the exact numeric transform in the supplied project, without
  // copying any personal artwork or project file into this repository.
  s.patchTrack(modelCopy, { transform: { x: 1235.699734687626, y: -2602.9219836559596, scale: 1.75796492142056, rotation: -15 } });
  recoverModel(modelCopy); assert.deepEqual(useSceneStore.getState().tracks.find(t => t.id === modelCopy).transform, { x: 0, y: 0, scale: 1, rotation: 0 });
  const snapshot = buildScenePartial(useSceneStore.getState()); s.hydrate(snapshot); assert.equal(useSceneStore.getState().textLayers.length, 2);
  s.hydrate({ tracks: [makeTrack('missing-model', 'Unavailable')] }); assert.equal(useSceneStore.getState().tracks.length, 1); assert.notEqual(useSceneStore.getState().tracks[0].id, trackId);
  stop(); history.reset();

  s.resetScene(); s.addTextLayer(); state = useSceneStore.getState(); text = state.textLayers[0];
  s.patchTextLayer(text.id, { text: 'Before', media: { blobId: 'slow', url: '', width: 100, height: 100, fit: 'contain' } });
  const restore = s.rehydrateUploads(); s.patchTextLayer(text.id, { text: 'Edited during restore', x: 712 }); pending.get('slow')(new Blob(['fixture'])); await restore;
  state = useSceneStore.getState(); assert.equal(state.textLayers[0].text, 'Edited during restore'); assert.equal(state.textLayers[0].x, 712); assert.ok(state.textLayers[0].media.url.startsWith('blob:'));
  s.patchTextLayer(text.id, { media: { ...state.textLayers[0].media, blobId: 'project-switch', url: '' } });
  const stale = s.rehydrateUploads(), next = buildScenePartial(useSceneStore.getState()); next.textLayers[0].x = 999; s.hydrate(next);
  pending.get('project-switch')(new Blob(['fixture'])); await stale;
  assert.equal(useSceneStore.getState().textLayers[0].x, 999); assert.equal(useSceneStore.getState().textLayers[0].media.url, '', 'Old async restore cannot touch another project, even with matching layer IDs');

  const model = makeTrack('wheel-01', 'Path'); model.values._motionPath = { enabled: true, duration: 4, loop: false, points: [{ x: 0, y: 0 }, { x: .2, y: -.1 }] };
  near(modelPathOffset(model, 0, 30, 1000, 500).x, 0); near(modelPathOffset(model, 60, 30, 1000, 500).x, 100); near(modelPathOffset(model, 120, 30, 1000, 500).y, -50); near(modelPathOffset(model, 900, 30, 1000, 500).x, 200);
  model.values._motionPath.loop = true; assert.deepEqual(modelPathOffset(model, 120, 30, 1000, 500), { x: 0, y: 0 });
  assert.equal(readMotionPath({ points: [{ x: NaN, y: 0 }] }).points.length, 2);

  assert.equal(effectList.length, 12); let passes = 0;
  for (const effect of effectList) {
    const defaults = effectDefaults(effect.meta.id); assert.ok(effectHelp(effect.meta.id, 'pt'), `Missing effect explanation: ${effect.meta.id}`);
    for (const pass of passesOf(effect)) {
      passes++; const uniforms = pass.uniforms(defaults, { width: 864, height: 1080, time: 1.7 });
      assert.deepEqual(Object.keys(uniforms).sort(), Object.keys(pass.uniformTypes || {}).sort(), effect.meta.id);
      for (const value of Object.values(uniforms)) assert.ok((Array.isArray(value) ? value : [value]).every(Number.isFinite), effect.meta.id);
      assert.match(pixiFragment(effect, pass), /void main\(/); assert.match(threeFragment(effect, pass), /void main\(/);
      assert.match(pixiFragment(effect, pass), /return uv \* uInputSize.xy;/, 'Pixi reciprocals must not become a pixel offset');
    }
  }
  console.log(`Workflow checks passed: duplicate/undo, mixed-layer order, hidden-model recovery, async project isolation, saved transform recovery, motion paths and ${passes} shader passes across 12 effects.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
