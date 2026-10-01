// Aide de test : un « autre poste » du réseau = une simple fenêtre de navigateur (sans jeton,
// sans preload) qui ouvre l'adresse SSF_URL, comme Chrome ou Edge sur un autre ordinateur.
const { app, BrowserWindow } = require('electron');
app.setPath('userData', process.env.SSF_TEST_USER_DATA);
app.whenReady().then(() => {
    const w = new BrowserWindow({ width: 1400, height: 900, webPreferences: { contextIsolation: true } });
    w.loadURL(process.env.SSF_URL);
});
