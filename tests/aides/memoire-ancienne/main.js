// Aide de test : ouvre une page en file:// (comme l'application jusqu'à la version 13) dans le
// dossier de données SSF_TEST_USER_DATA, pour y préparer la « mémoire du navigateur » d'avant.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.setPath('userData', process.env.SSF_TEST_USER_DATA);
app.whenReady().then(() => {
    const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
    w.loadFile(path.join(__dirname, 'page.html'));
});
