// Aide de test : un « autre poste » du réseau = une simple fenêtre de navigateur (sans jeton,
// sans preload) qui ouvre l'adresse SSF_URL, comme Chrome ou Edge sur un autre ordinateur.
// SSF_TAILLE (ex. « 820x1180 », tablette en portrait) : taille de la fenêtre, 1400x900 sinon.
const { app, BrowserWindow } = require('electron');
app.setPath('userData', process.env.SSF_TEST_USER_DATA);
app.whenReady().then(() => {
    const [width, height] = (process.env.SSF_TAILLE || '1400x900').split('x').map(Number);
    const w = new BrowserWindow({ width, height, useContentSize: true, webPreferences: { contextIsolation: true } });
    w.loadURL(process.env.SSF_URL);
});
