const { contextBridge, ipcRenderer } = require('electron');

// Lue de façon synchrone : disponible dès que constants.js s'exécute
const _appVersion = ipcRenderer.sendSync('get-app-version-sync');
// Jeton du poste principal (donné par main.js à la seule fenêtre de ce poste)
const _jetonPrincipal = ipcRenderer.sendSync('get-jeton-sync');
// Réglages de ce poste repris des versions précédentes (une seule fois)
const _reglagesRepris = ipcRenderer.sendSync('get-reglages-repris-sync');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: _appVersion,
  jetonPrincipal: _jetonPrincipal,
  reglagesRepris: _reglagesRepris,
  reglagesRecopies: () => ipcRenderer.send('reglages-recopies'),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_, percent) => cb(percent)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  installUpdate: () => ipcRenderer.send('install-update'),
  refocusWindow: () => ipcRenderer.send('refocus-window'),
  unstickWindow: () => ipcRenderer.send('unstick-window'),
});
