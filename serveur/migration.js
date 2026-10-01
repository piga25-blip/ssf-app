// ============================================
// REPRISE DES DONNÉES DES VERSIONS PRÉCÉDENTES (lot 1 du plan réseau)
// ============================================
// Jusqu'à la version 13, les secours étaient rangés dans la mémoire du navigateur intégré, sous
// l'adresse file://. L'application étant désormais servie par http://localhost, cette mémoire
// n'est plus visible. Au premier lancement, une page invisible ouverte en file:// la relit :
// - chaque secours (clé SSF_UNIFIED_STATE_…) est enregistré en fichiers par le serveur,
//   sauf s'il existe déjà ou s'il est vide ;
// - les réglages propres à ce poste (secrétaire, intervalle de sauvegarde…) sont gardés pour
//   être recopiés dans la nouvelle mémoire du navigateur.
// L'ancienne mémoire n'est jamais effacée. Un fichier témoin évite de recommencer.

const fs = require('fs');
const path = require('path');

const FICHIER_TEMOIN = 'reprise-memoire-navigateur.json';
const PREFIXE = 'SSF_UNIFIED_STATE_';
// Réglages propres au poste (repris tels quels)
const REGLAGES_POSTE = ['ssf_current_secretaire', 'ssf_autosave_interval', 'ssf_planning_auto_propagate',
    'ssf_mission_keywords', 'ssf_standalone_mode', 'ssf_standalone_id', 'ssf_planning_scroll', 'ssf_auto_saves'];

// Données d'un secours tel qu'il était enregistré dans la mémoire du navigateur → données partagées
const versDonnees = (brut, CLES_DONNEES) => {
    const d = {};
    CLES_DONNEES.forEach(c => { if (brut[c] !== undefined) d[c] = brut[c]; });
    return d;
};

// Convertit le contenu de l'ancienne mémoire (objet clé → texte). Renvoie le compte rendu.
const convertir = (contenu, { stockage, CLES_DONNEES, estVide }) => {
    const rapport = { faitLe: new Date().toISOString(), secours: [], ignores: [], erreurs: [], reglages: {} };
    for (const [cle, texte] of Object.entries(contenu || {})) {
        if (cle.startsWith(PREFIXE)) {
            try {
                const brut = JSON.parse(texte);
                const rescueId = brut.rescueId || cle.slice(PREFIXE.length).replace(/_V\d+$/, '');
                const donnees = versDonnees(brut, CLES_DONNEES);
                if (estVide(donnees)) { rapport.ignores.push({ rescueId, raison: 'vide' }); continue; }
                if (stockage.existe(rescueId)) { rapport.ignores.push({ rescueId, raison: 'déjà présent' }); continue; }
                stockage.creer(rescueId, donnees);
                rapport.secours.push(rescueId);
            } catch (e) {
                rapport.erreurs.push({ cle, erreur: e.message });
            }
        } else if (REGLAGES_POSTE.includes(cle)) {
            rapport.reglages[cle] = texte;
        }
    }
    return rapport;
};

// À appeler au démarrage, avant d'ouvrir la fenêtre principale
const reprendreMemoireNavigateur = ({ BrowserWindow, ipcMain, racineDonnees, moteur, delaiMaxMs = 15000 }) => new Promise((resoudre) => {
    const temoin = path.join(racineDonnees, FICHIER_TEMOIN);
    if (fs.existsSync(temoin)) { resoudre(null); return; }
    let fenetre = null, fini = false;
    const terminer = (rapport) => {
        if (fini) return; fini = true;
        ipcMain.removeAllListeners('migration-memoire-navigateur');
        if (fenetre && !fenetre.isDestroyed()) fenetre.destroy();
        fs.writeFileSync(temoin, JSON.stringify(rapport, null, 1));
        resoudre(rapport);
    };
    ipcMain.once('migration-memoire-navigateur', (event, contenu) => {
        let rapport;
        try { rapport = convertir(contenu, moteur.outilsReprise()); }
        catch (e) { rapport = { faitLe: new Date().toISOString(), secours: [], ignores: [], erreurs: [{ erreur: e.message }], reglages: {} }; }
        terminer(rapport);
    });
    fenetre = new BrowserWindow({
        show: false,
        webPreferences: { preload: path.join(__dirname, 'migration-preload.js'), contextIsolation: true, nodeIntegration: false },
    });
    fenetre.loadFile(path.join(__dirname, 'migration.html'));
    // Sécurité : ne jamais bloquer le démarrage
    setTimeout(() => terminer({ faitLe: new Date().toISOString(), secours: [], ignores: [], erreurs: [{ erreur: 'délai dépassé' }], reglages: {} }), delaiMaxMs);
});

// Réglages du poste repris et pas encore recopiés dans la nouvelle mémoire du navigateur
const reglagesARecopier = (racineDonnees) => {
    try {
        const r = JSON.parse(fs.readFileSync(path.join(racineDonnees, FICHIER_TEMOIN), 'utf8'));
        return r.reglagesRecopies ? null : (Object.keys(r.reglages || {}).length ? r.reglages : null);
    } catch (e) { return null; }
};
const marquerReglagesRecopies = (racineDonnees) => {
    const f = path.join(racineDonnees, FICHIER_TEMOIN);
    try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); r.reglagesRecopies = new Date().toISOString(); fs.writeFileSync(f, JSON.stringify(r, null, 1)); } catch (e) { /* rien à marquer */ }
};

module.exports = { reprendreMemoireNavigateur, convertir, reglagesARecopier, marquerReglagesRecopies, FICHIER_TEMOIN };
