// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('rpDesktop', Object.freeze({
  platform: process.platform,
  onRequest(callback) {
    const listener = (_event, request) => callback(request);
    ipcRenderer.on('rp:request', listener);
    ipcRenderer.send('rp:ready');
    return () => ipcRenderer.removeListener('rp:request', listener);
  },
  respond(id, result) { ipcRenderer.send('rp:response', {id, result}); },
  chooseFolder() { return ipcRenderer.invoke('rp:choose-folder'); },
  openProject() { return ipcRenderer.invoke('rp:open-project'); },
  prepareUpdate() { return ipcRenderer.invoke('rp:update-prepare'); },
  applyUpdate() { return ipcRenderer.invoke('rp:update-apply'); },
  onUpdateProgress(callback) {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('rp:update-progress', listener);
    return () => ipcRenderer.removeListener('rp:update-progress', listener);
  },
  appearance(theme) { if (theme === 'light' || theme === 'dark') ipcRenderer.send('rp:appearance', theme); },
}));
