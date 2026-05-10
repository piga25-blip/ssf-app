const { contextBridge, ipcRenderer } = require('electron');

// Lue de façon synchrone : disponible dès que constants.js s'exécute
const _appVersion = ipcRenderer.sendSync('get-app-version-sync');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: _appVersion,
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_, percent) => cb(percent)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  installUpdate: () => ipcRenderer.send('install-update'),
});
