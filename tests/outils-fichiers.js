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

module.exports = { attendreEcriture, lireSecours, ecrireSecours };
