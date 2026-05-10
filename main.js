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
      // Babel standalone charge les JSX via XHR file://, nécessite webSecurity: false
      webSecurity: false,
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

// Version synchrone pour preload.js (disponible avant le chargement de la page)
ipcMain.on('get-app-version-sync', (event) => {
  event.returnValue = app.getVersion();
});
