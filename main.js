const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Tests automatiques (tests/scenario-reference.js) : dossier de données jetable,
// pour ne jamais toucher aux données de l'application.
if (process.env.SSF_TEST_USER_DATA) {
  app.setPath('userData', process.env.SSF_TEST_USER_DATA);
}

const crypto = require('crypto');
const { demarrerServeur } = require('./serveur/serveur');
const { creerMoteur } = require('./serveur/moteur');
const { creerCanal } = require('./serveur/canal');
const { reprendreMemoireNavigateur, reglagesARecopier, marquerReglagesRecopies } = require('./serveur/migration');

let mainWindow;
let serveurSSF = null; // { serveur, port, hote }
let moteurSSF = null;  // données des secours (fichiers, journal)
let canalSSF = null;   // canal temps réel avec les postes
// Jeton secret transmis à la seule fenêtre de ce poste (preload.js) : il en fait le poste principal
const JETON_PRINCIPAL = crypto.randomBytes(24).toString('hex');

// La fenêtre du poste principal charge l'application servie par le serveur intégré
// (http://localhost:port), exactement comme le feront les autres postes en réseau.
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
    },
    title: 'Application SSF',
  });

  mainWindow.loadURL(`http://localhost:${serveurSSF.port}/index.html`);
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(async () => {
  // Port : 8080 par défaut (les suivants s'il est pris) ; SSF_PORT=0 pour les tests (au hasard)
  const port = process.env.SSF_PORT !== undefined ? parseInt(process.env.SSF_PORT, 10) : 8080;
  serveurSSF = await demarrerServeur({ racine: __dirname, port, hote: '127.0.0.1' });
  moteurSSF = creerMoteur({ racineApp: __dirname, racineDonnees: app.getPath('userData') });
  // Premier lancement de cette version : reprise des secours rangés dans la mémoire du navigateur
  const rapport = await reprendreMemoireNavigateur({ BrowserWindow, ipcMain, racineDonnees: app.getPath('userData'), moteur: moteurSSF });
  if (rapport) console.log(`Reprise des données : ${rapport.secours.length} secours repris, ${rapport.ignores.length} ignoré(s), ${rapport.erreurs.length} erreur(s)`);
  canalSSF = creerCanal({ serveurHttp: serveurSSF.serveur, moteur: moteurSSF, jetonPrincipal: JETON_PRINCIPAL,
    versionApp: app.getVersion(), journalConsole: (m) => console.log(m) });
  console.log(`Serveur SSF : http://localhost:${serveurSSF.port}`);
  createWindow();

  // VERSION RÉSEAU (TEST) : mise à jour automatique désactivée, sinon elle
  // serait remplacée par la version officielle publiée sur GitHub.
  const MISE_A_JOUR_AUTO = false;

  mainWindow.webContents.once('did-finish-load', () => {
    if (MISE_A_JOUR_AUTO && app.isPackaged) {
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('Vérification MAJ échouée :', err.message);
      });
    }
  });
});

app.on('before-quit', () => {
  // Données en attente écrites avant de quitter
  if (moteurSSF) moteurSSF.fermer();
});

app.on('window-all-closed', () => {
  // Au démarrage, la fenêtre invisible de reprise des données se ferme avant l'ouverture de la
  // fenêtre principale : ce n'est pas une fermeture de l'application
  if (!mainWindow) return;
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

// Réglages de ce poste repris des versions précédentes, à recopier dans la mémoire du navigateur
ipcMain.on('get-reglages-repris-sync', (event) => {
  event.returnValue = (mainWindow && event.sender === mainWindow.webContents) ? reglagesARecopier(app.getPath('userData')) : null;
});
ipcMain.on('reglages-recopies', () => marquerReglagesRecopies(app.getPath('userData')));

// Jeton du poste principal, pour preload.js (uniquement la fenêtre de ce poste)
ipcMain.on('get-jeton-sync', (event) => {
  event.returnValue = (mainWindow && event.sender === mainWindow.webContents) ? JETON_PRINCIPAL : null;
});

// Version synchrone pour preload.js (disponible avant le chargement de la page)
ipcMain.on('get-app-version-sync', (event) => {
  event.returnValue = app.getVersion();
});
