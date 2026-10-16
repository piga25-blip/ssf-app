// ============================================
// RÉCUPÉRATION DE LA LISTE DEPUIS LA BASE NATIONALE (sauveteurs.speleo-secours-francais.fr)
// ============================================
// Ouvre le site dans une fenêtre de l'application. L'utilisateur s'identifie LUI-MÊME :
// l'application ne voit ni ne garde l'identifiant ni le mot de passe. Quand il clique sur
// « Export au format Excel », le fichier est intercepté et rendu à l'interface, qui affiche
// l'aperçu d'import. La connexion est gardée dans une session séparée (« persist:base-nationale »),
// comme le ferait un navigateur, et peut être effacée (deconnecterBaseNationale).

const { BrowserWindow, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Adresse de la page d'export ; remplaçable pour les tests automatiques (faux site local)
const URL_EXPORT = process.env.SSF_BASE_NATIONALE_URL || 'https://sauveteurs.speleo-secours-francais.fr/ssf_liste.php?mode=export';
const PARTITION = 'persist:base-nationale';
const TITRE = 'Base nationale — identifiez-vous, puis « Export de la liste » › « Export au format Excel »';

let fenetre = null;

const recupererBaseNationale = (parent) => new Promise((resolve) => {
    if (fenetre && !fenetre.isDestroyed()) { fenetre.focus(); resolve({ dejaOuverte: true }); return; }
    const origine = new URL(URL_EXPORT).origin;
    const ses = session.fromPartition(PARTITION);
    let fini = false;
    const terminer = (resultat) => {
        if (fini) return;
        fini = true;
        ses.removeListener('will-download', telechargement);
        if (fenetre && !fenetre.isDestroyed()) fenetre.close();
        fenetre = null;
        resolve(resultat);
    };

    // Seul l'export Excel est récupéré ; les autres téléchargements (PDF, vCard) sont ignorés
    const telechargement = (event, item) => {
        const nom = item.getFilename() || 'liste.xlsx';
        if (!/\.xlsx?$/i.test(nom) && !/mode=xls/i.test(item.getURL())) { item.cancel(); return; }
        const cible = path.join(os.tmpdir(), `ssf-base-nationale-${Date.now()}-${path.basename(nom)}`);
        item.setSavePath(cible);
        item.once('done', (e, etat) => {
            if (etat !== 'completed') { terminer({ erreur: 'Le téléchargement de la liste a échoué.' }); return; }
            try {
                const octets = fs.readFileSync(cible);
                terminer({ nom, octets: octets.toString('base64') });
            } catch (err) {
                terminer({ erreur: 'Le fichier téléchargé ne peut pas être lu.' });
            } finally {
                // Le fichier contient des coordonnées : il ne reste pas sur le disque
                try { fs.rmSync(cible, { force: true }); } catch (err) { /* déjà supprimé */ }
            }
        });
    };
    ses.on('will-download', telechargement);

    fenetre = new BrowserWindow({
        width: 1100, height: 800, parent, title: TITRE, autoHideMenuBar: true,
        webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    fenetre.on('page-title-updated', (e) => e.preventDefault());
    // Navigation limitée au site ; les autres liens s'ouvrent dans le navigateur de l'ordinateur
    fenetre.webContents.on('will-navigate', (e, url) => {
        if (new URL(url).origin !== origine) { e.preventDefault(); shell.openExternal(url); }
    });
    fenetre.webContents.setWindowOpenHandler(({ url }) => {
        if (new URL(url).origin === origine) fenetre.loadURL(url);
        else shell.openExternal(url);
        return { action: 'deny' };
    });
    fenetre.on('closed', () => terminer({ annule: true }));
    fenetre.loadURL(URL_EXPORT).catch(() => { /* page d'erreur affichée par la fenêtre */ });
});

// Oublie la connexion au site (cookies de la session séparée)
const deconnecterBaseNationale = async () => {
    await session.fromPartition(PARTITION).clearStorageData();
    return { ok: true };
};

module.exports = { recupererBaseNationale, deconnecterBaseNationale };
