// Outils des tests : lire et préparer les secours enregistrés en fichiers par le serveur
// (dossier de données jetable SSF_TEST_USER_DATA), avec le module de stockage du serveur.
const { creerStockage } = require('../serveur/stockage');

// Le serveur écrit les fichiers peu après chaque action : on lui laisse le temps de finir
const attendreEcriture = (ms = 1000) => new Promise(r => setTimeout(r, ms));

// { identifiant du secours → données } pour tous les secours enregistrés
const lireSecours = (dossierDonnees) => {
    const stockage = creerStockage(dossierDonnees);
    const resultat = {};
    for (const d of stockage.lister()) {
        const charge = stockage.charger(d.rescueId, null);
        if (charge) resultat[charge.rescueId] = charge.donnees;
    }
    return resultat;
};

// Un secours (données complètes) écrit sur disque, comme par une version précédente
const ecrireSecours = (dossierDonnees, rescueId, donnees) => {
    creerStockage(dossierDonnees).creer(rescueId, donnees);
};

// Fenêtre principale de l'application (servie en http://localhost) ; au premier lancement, une
// fenêtre invisible de reprise des données (file://) s'ouvre d'abord puis se ferme
const fenetrePrincipale = async (app, delaiMs = 60000) => {
    const fin = Date.now() + delaiMs;
    while (Date.now() < fin) {
        const w = app.windows().find(p => p.url().startsWith('http'));
        if (w) return w;
        await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('fenêtre principale introuvable');
};

module.exports = { attendreEcriture, lireSecours, ecrireSecours, fenetrePrincipale };
