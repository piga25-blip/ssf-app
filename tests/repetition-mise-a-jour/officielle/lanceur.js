// Lance la VERSION OFFICIELLE (dossier SSF_OFFICIELLE, par défaut C:\Projets\SSF = branche main)
// avec des données jetables : le dossier userData est redirigé AVANT le chargement de son
// main.js, et les fichiers de la page (index.html…) sont pris dans son dossier.
const path = require('path');
const { app, BrowserWindow } = require('electron');
const OFFICIELLE = process.env.SSF_OFFICIELLE || 'C:/Projets/SSF';
app.setPath('userData', process.env.SSF_VERIF_DONNEES);
const charger = BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile = function (fichier, options) {
    return charger.call(this, path.resolve(OFFICIELLE, fichier), options);
};
require(path.join(OFFICIELLE, 'main.js'));
