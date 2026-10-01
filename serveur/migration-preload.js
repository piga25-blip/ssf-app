// Préchargement de la page invisible de reprise des données (serveur/migration.html)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('migration', {
    envoyer: (contenu) => ipcRenderer.send('migration-memoire-navigateur', contenu),
});
