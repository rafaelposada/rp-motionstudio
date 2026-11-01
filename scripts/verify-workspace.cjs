const path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict'), fs = require('node:fs');
require('sucrase/register');
const root = path.resolve(__dirname, '..'), resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args); };
const { useUIStore } = require('../store/useUIStore');
const { useSceneStore } = require('../store/useSceneStore');
const { useHistoryStore } = require('../store/useHistoryStore');
const { compositionOrder } = require('../lib/composition');
const { duplicateCompositionLayers, reorderCompositionLayer, selectModelForEditing, deleteCompositionLayers } = require('../lib/compositionActions');
const { groupFrame, transformGroupMember } = require('../lib/groupTransform');
const { placeholderFill } = require('../lib/placeholderPalette');
const { confirmLayer } = require('../lib/confirmLayer');
const { captureTimelineSelection, moveTimelineSelection, restoreTimelineSelection } = require('../lib/timelineSelection');
const { createProject, readProjectScene } = require('../lib/projects');
const { startSceneAutosave, setAutosaveTarget, getSaveState, flushScene } = require('../lib/scenePersist');

const data = new Map(), win = new EventTarget(), doc = new EventTarget();
let systemDark = true, focused = null;
global.window = Object.assign(win, { matchMedia: () => ({ matches: systemDark }) });
global.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
global.document = Object.assign(doc, { visibilityState: 'visible', activeElement: null, documentElement: { dataset: {}, style: { setProperty() {} } }, querySelector: () => null,
  body: { append() {} }, createElement: tag => ({ tag, children: [], setAttribute() {}, append(...items) { this.children.push(...items); }, showModal() {}, close() {}, remove() {}, addEventListener() {}, focus() { focused = this; } }) });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

async function main() {
  const ui = useUIStore.getState(), scene = useSceneStore.getState();
  data.set('motion-ui-preferences', JSON.stringify({ theme: 'dark', locale: 'pt' })); ui.hydratePreferences();
  assert.equal(useUIStore.getState().appearance, 'dark', 'Legacy theme remains explicit');
  ui.setAppearance('system'); assert.equal(useUIStore.getState().theme, 'dark');
  systemDark = false; ui.syncSystemTheme(); assert.equal(useUIStore.getState().theme, 'light');
  ui.setAppearance('dark'); ui.syncSystemTheme(); assert.equal(useUIStore.getState().theme, 'dark');
  ui.setShowSelectionBox(false); ui.hydratePreferences(); assert.equal(useUIStore.getState().showSelectionBox, false);
  scene.resetScene(); scene.addTextLayer(); scene.addTextLayer();
  let state = useSceneStore.getState(); const model = state.tracks[0], [a, b] = state.textLayers;
  ui.selectLayer(a.id, 'overlay'); ui.selectLayer(b.id, 'overlay', true); ui.selectLayer(model.id, 'motion', true);
  assert.deepEqual(useUIStore.getState().selectedLayerIds, [a.id, b.id, model.id]);
  ui.selectLayer(a.id, 'overlay', false, true); assert.equal(useUIStore.getState().selectedLayerIds.length, 3, 'Dragging a selected name retains the group');
  ui.selectLayer(b.id, 'overlay', true); assert.deepEqual(useUIStore.getState().selectedLayerIds, [a.id, model.id]);
  const visible = useSceneStore.getState().tracks.map(t => t.visible); selectModelForEditing(model.id, true);
  assert.deepEqual(useSceneStore.getState().tracks.map(t => t.visible), visible, 'Shift selection does not alter visibility');

  const history = useHistoryStore.getState(), stop = history.start(); history.reset();
  const copies = duplicateCompositionLayers([a.id, b.id, model.id]);
  assert.equal(copies.length, 3); assert.equal(useHistoryStore.getState().past.length, 1, 'Group duplication is one undo');
  assert.deepEqual(useUIStore.getState().selectedLayerIds, copies);
  history.undo(); assert.equal(useSceneStore.getState().textLayers.length, 2); assert.equal(useSceneStore.getState().tracks.length, 1);
  history.redo(); assert.equal(useSceneStore.getState().textLayers.length, 4); assert.equal(useSceneStore.getState().tracks.length, 2);
  reorderCompositionLayer(copies[0], b.id, copies);
  const ordered = compositionOrder(useSceneStore.getState().tracks, useSceneStore.getState().textLayers);
  const indices = ordered.map((l, i) => copies.includes(l.id) ? i : -1).filter(i => i >= 0);
  assert.equal(indices[2] - indices[0], 2, 'Group reorder preserves contiguous relative order');
  assert.equal(new Set(ordered.map(l => l.z)).size, ordered.length);
  const count = ordered.length; reorderCompositionLayer(copies[0], copies[2], copies); assert.equal(compositionOrder(useSceneStore.getState().tracks, useSceneStore.getState().textLayers).length, count);
  const deleting = deleteCompositionLayers(copies); assert.equal(focused.textContent, 'Confirmar'); focused.onclick(); await deleting;
  assert.equal(useSceneStore.getState().textLayers.length, 2); assert.equal(useSceneStore.getState().tracks.length, 1);
  history.undo(); assert.equal(useSceneStore.getState().textLayers.length, 4);
  const confirm = confirmLayer('Fixture', true); assert.equal(focused.textContent, 'Confirmar'); focused.onclick(); assert.equal(await confirm, true);
  const staleDelete = deleteCompositionLayers([a.id]); scene.resetScene(); focused.onclick(); await staleDelete; assert.equal(useSceneStore.getState().textLayers.length, 0, 'Confirmation from an old project cannot remove a new scene layer');
  stop(); history.reset();

  scene.resetScene(); scene.addTextLayer(); const timed = useSceneStore.getState();
  const text = timed.textLayers[0], motion = timed.tracks[0];
  scene.patchTextLayer(text.id, { start: 1, end: 3 }); scene.patchTrack(motion.id, { inFrame: 60, outFrame: 120 });
  ui.setLayerSelection([text.id, motion.id], text.id);
  const windows = captureTimelineSelection(text.id); moveTimelineSelection(windows, 10);
  let shifted = useSceneStore.getState(); assert.equal(shifted.textLayers[0].start, 5); assert.equal(shifted.textLayers[0].end, 7); assert.equal(shifted.tracks[0].outFrame, 240);
  moveTimelineSelection(windows, -10); shifted = useSceneStore.getState(); assert.equal(shifted.textLayers[0].start, 0); assert.equal(shifted.tracks[0].inFrame, 30);
  restoreTimelineSelection(windows); assert.equal(useSceneStore.getState().textLayers[0].start, 1); assert.equal(useSceneStore.getState().tracks[0].inFrame, 60);
  scene.patchTextLayer(text.id, { locked: true }); assert.equal(captureTimelineSelection(motion.id).length, 1);

  for (let i = 0; i < 720; i++) {
    const member = { cx: 150 + i, cy: 300 - i, width: 80, height: 120, rotation: i % 360 - 180 };
    const group = groupFrame([member, { ...member, cx: -100, cy: -50 }]);
    const next = { ...group, cx: group.cx + 40, cy: group.cy - 20, width: group.width * 1.5, height: group.height * 1.5, rotation: 45 };
    const moved = transformGroupMember(member, group, next), restored = transformGroupMember(moved, next, group);
    for (const key of ['cx', 'cy', 'width', 'height', 'rotation']) near(restored[key], member[key]);
  }
  assert.equal(new Set(Array.from({ length: 193 }, (_, i) => placeholderFill(i))).size, 193);
  assert.match(fs.readFileSync(path.join(root, 'lib/renderer.ts'), 'utf8'), /texture === this.placeholder \? placeholderFill\(i\)/, 'Depth lighting must preserve placeholder gray');
  const effects = fs.readFileSync(path.join(root, 'components/EffectsPanel.tsx'), 'utf8');
  assert.ok(!/className=\{`effect-card[^]*?draggable[^]*?<div className="effect-card-head"/.test(effects), 'Effect card body must never be draggable');

  const timers = new Map(), realTimeout = global.setTimeout, realClear = global.clearTimeout; let timerId = 0;
  global.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }; global.clearTimeout = id => timers.delete(id);
  try {
    ui.setAutosave(true, 500); const project = createProject('Synthetic autosave fixture'); setAutosaveTarget(project.id);
    flushScene(); const unsubscribe = startSceneAutosave();
    scene.setFrame(12); assert.equal(timers.size, 0, 'Playback does not schedule saves');
    scene.setValue('count', 5); scene.setValue('count', 6); assert.equal(timers.size, 1, 'Edits share one write timer');
    const [id, timer] = [...timers][0]; assert.equal(timer.delay, 500); timers.delete(id); timer.fn();
    assert.equal(getSaveState().status, 'saved'); assert.equal(readProjectScene(project.id).values.count, 6);
    ui.setAutosave(false); scene.setValue('count', 7); assert.equal(timers.size, 0); assert.equal(getSaveState().status, 'pending');
    assert.equal(readProjectScene(project.id).values.count, 6); flushScene(); assert.equal(readProjectScene(project.id).values.count, 7);
    ui.setAutosave(true, 2000); scene.setValue('count', 8); assert.equal([...timers.values()][0].delay, 2000);
    window.dispatchEvent(new Event('pagehide')); assert.equal(readProjectScene(project.id).values.count, 8); assert.equal(timers.size, 0);
    unsubscribe(); scene.setValue('count', 9); assert.equal(timers.size, 0, 'Unmount removes subscriptions and timers');
  } finally { global.setTimeout = realTimeout; global.clearTimeout = realClear; }
  console.log('Workspace checks passed: system appearance, persistent BBox, Shift groups, batch duplication/deletion/reorder + undo, mixed timeline windows, 720 group transforms, placeholder grayscale, effect drag isolation, timed autosave and page-close flush.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
