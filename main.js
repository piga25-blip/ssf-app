const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Babel standalone charge les JSX via XHR file:// ; allowFileAccessFromFileURLs
      // autorise ces requêtes locales sans désactiver toute la Same-Origin Policy
      // (webSecurity: false était suspecté de causer un bug de focus clavier Electron/Windows)
      allowFileAccessFromFileURLs: true,
    },
    title: 'Application SSF',
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  mainWindow.webContents.once('did-finish-load', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('Vérification MAJ échouée :', err.message);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-available', info.version);
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow.webContents.send('update-progress', Math.round(progress.percent));
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => app.getVersion());

// Filet de sécurité (léger) : nudge de focus côté webContents, insuffisant
// à lui seul contre le bug ci-dessous mais conservé au cas où il aide dans
// d'autres situations.
ipcMain.on('refocus-window', () => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
    mainWindow.webContents.focus();
  }
});

// Contournement d'un bug connu Electron/Chromium sur Windows : après la
// fermeture d'une boîte de dialogue native bloquante (alert/confirm), la
// fenêtre parente reste parfois bloquée côté routage clavier OS — elle est
// visuellement au premier plan mais ne reçoit plus aucune entrée, même les
// raccourcis DevTools. Un minimiser/restaurer force Windows à recalculer le
// focus correctement, mais provoque une animation visible et désagréable.
// setEnabled(false)/setEnabled(true) est l'équivalent bas niveau Windows
// (EnableWindow) de ce qu'un dialogue natif modal fait à la fenêtre parente
// pour la bloquer/débloquer — sans déplacer ni minimiser la fenêtre, donc
// sans effet visuel. On reproduit ce cycle automatiquement juste après
// chaque alert()/confirm() (voir index.html), au lieu de demander à
// l'utilisateur de minimiser/restaurer manuellement.
ipcMain.on('unstick-window', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setEnabled(false);
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setEnabled(true);
    mainWindow.blur();
    mainWindow.focus();
    mainWindow.webContents.focus();
  }, 30);
});

// Version synchrone pour preload.js (disponible avant le chargement de la page)
ipcMain.on('get-app-version-sync', (event) => {
  event.returnValue = app.getVersion();
});
