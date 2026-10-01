// ============================================
// MOTEUR DE DONNÉES DU SERVEUR (lot 1 du plan réseau)
// ============================================
// Tient le secours actif (un seul à la fois, choisi sur le poste principal), applique les
// actions nommées avec EXACTEMENT la fonction de donnees.js (chargée telle quelle), écrit le
// journal puis les fichiers modifiés, et fait des sauvegardes horodatées.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { creerStockage, PARTIES, PARTIE_DE_CLE } = require('./stockage');

// donnees.js et les constantes dont il dépend, chargés dans un contexte isolé
const chargerDonneesJS = (racineApp) => {
    const constantes = fs.readFileSync(path.join(racineApp, 'constants.js'), 'utf8');
    const lire = (motif) => { const m = constantes.match(motif); if (!m) throw new Error('constante introuvable : ' + motif); return m[1]; };
    const contexte = vm.createContext({ console });
    vm.runInContext(`
        const DEFAULT_TOTAL_DAYS = ${lire(/const DEFAULT_TOTAL_DAYS = (\d+);/)};
        const SLOTS_PER_HOUR = ${lire(/const SLOTS_PER_HOUR = (\d+);/)};
        const SLOTS_PER_DAY = 24 * SLOTS_PER_HOUR;
        const getTotalSlots = (totalDays) => totalDays * SLOTS_PER_DAY;
    `, contexte);
    vm.runInContext(fs.readFileSync(path.join(racineApp, 'donnees.js'), 'utf8'), contexte, { filename: 'donnees.js' });
    return vm.runInContext('({ reducteurDonnees, etatInitialDonnees, CLES_DONNEES, idsUniques })', contexte);
};

// Secours sans aucune donnée saisie (rien à enregistrer)
const estVide = (d) => !(d.masterSauveteursList || []).length && !(d.events || []).length && !(d.teams || []).length
    && !Object.keys(d.planning || {}).length && !(d.missionInfo && d.missionInfo.nomCavite) && !d.clotureInfo && !d.mcConfigured;

const creerMoteur = ({ racineApp, racineDonnees, delaiEcritureMs = 300, intervalleSauvegardeMs = 30 * 60 * 1000 }) => {
    const { reducteurDonnees, etatInitialDonnees, CLES_DONNEES, idsUniques } = chargerDonneesJS(racineApp);
    const stockage = creerStockage(racineDonnees);
    let actif = null;            // { rescueId, version, donnees }
    let partiesAEcrire = new Set();
    let minuterieEcriture = null;
    let modifieDepuisSauvegarde = false;

    const ecrireMaintenant = () => {
        clearTimeout(minuterieEcriture); minuterieEcriture = null;
        if (!actif || partiesAEcrire.size === 0) return;
        stockage.ecrireParties(actif.rescueId, actif.donnees, [...partiesAEcrire], actif.version);
        partiesAEcrire = new Set();
    };

    const sauvegardePeriodique = setInterval(() => {
        if (actif && modifieDepuisSauvegarde) { ecrireMaintenant(); stockage.sauvegarder(actif.rescueId); modifieDepuisSauvegarde = false; }
    }, intervalleSauvegardeMs);
    if (sauvegardePeriodique.unref) sauvegardePeriodique.unref();

    return {
        stockage,
        actif: () => actif,
        lister: () => stockage.lister(),

        // Ouvre le secours rescueId et en fait le secours actif. S'il n'existe pas, il est créé avec
        // donneesSiNouveau (les données en cours sur le poste principal, comme « enregistrer sous »).
        // Un secours neuf encore vide n'est écrit sur le disque qu'à sa première modification.
        ouvrir(rescueId, donneesSiNouveau = null) {
            if (actif && actif.rescueId === rescueId) return actif;
            ecrireMaintenant();
            const initial = etatInitialDonnees(Math.max(0, new Date().getHours() - 1));
            const charge = stockage.charger(rescueId, reducteurDonnees);
            if (!charge) {
                const donnees = { ...initial };
                if (donneesSiNouveau) CLES_DONNEES.forEach(c => { if (donneesSiNouveau[c] !== undefined) donnees[c] = donneesSiNouveau[c]; });
                actif = { rescueId, version: 0, donnees, surDisque: false };
                if (!estVide(donnees)) { stockage.creer(rescueId, donnees); actif.surDisque = true; }
            } else {
                // Données manquantes (anciens dossiers) : valeurs d'un secours neuf
                const donnees = { ...initial };
                CLES_DONNEES.forEach(c => { if (charge.donnees[c] !== undefined) donnees[c] = charge.donnees[c]; });
                // Identifiants de lignes en double (anciennes versions) réparés une fois pour toutes
                const events = idsUniques(donnees.events || []);
                const repare = events.some((e, i) => e !== donnees.events[i]);
                donnees.events = events;
                // Le point phone du PC est toujours présent
                if (!(donnees.pointsPhone || []).some(pp => (typeof pp === 'object' ? pp.lettre : pp) === 'PC')) {
                    donnees.pointsPhone = [{ lettre: 'PC', nom: 'Poste de Commandement', sousTerre: false, typePP: 'surface', ordre: 0 }, ...(donnees.pointsPhone || [])];
                }
                actif = { rescueId: charge.rescueId || rescueId, version: charge.version, donnees, surDisque: true };
                if (repare || charge.rattrapees > 0) { partiesAEcrire = new Set(Object.keys(PARTIES)); ecrireMaintenant(); }
            }
            modifieDepuisSauvegarde = false;
            return actif;
        },

        // Applique une action nommée : journal d'abord, puis état, puis écriture (différée) des parties modifiées
        appliquer(action, origine = '') {
            if (!actif) throw new Error('Aucun secours ouvert');
            const nouveau = reducteurDonnees(actif.donnees, action);   // erreur → action refusée, rien n'est écrit
            if (!actif.surDisque) { stockage.creer(actif.rescueId, actif.donnees); actif.surDisque = true; }
            const version = actif.version + 1;
            stockage.ajouterJournal(actif.rescueId, { version, recuLe: new Date().toISOString(), origine, action });
            CLES_DONNEES.forEach(c => { if (nouveau[c] !== actif.donnees[c]) partiesAEcrire.add(PARTIE_DE_CLE[c]); });
            actif = { ...actif, version, donnees: nouveau };
            modifieDepuisSauvegarde = true;
            if (!minuterieEcriture) {
                minuterieEcriture = setTimeout(ecrireMaintenant, delaiEcritureMs);
                if (minuterieEcriture.unref) minuterieEcriture.unref();
            }
            return version;
        },

        renommer(ancien, nouveau) {
            // Secours neuf pas encore écrit sur le disque : seul son nom change
            if (actif && actif.rescueId === ancien && !actif.surDisque) { actif = { ...actif, rescueId: nouveau }; return; }
            ecrireMaintenant();
            stockage.renommer(ancien, nouveau);
            if (actif && actif.rescueId === ancien) actif = { ...actif, rescueId: nouveau };
        },

        // Maintenance : suppression de tous les secours enregistrés
        toutSupprimer() {
            stockage.lister().forEach(d => this.supprimer(d.rescueId));
            if (actif) this.supprimer(actif.rescueId);
        },

        supprimer(rescueId) {
            if (actif && actif.rescueId === rescueId) { clearTimeout(minuterieEcriture); minuterieEcriture = null; partiesAEcrire = new Set(); actif = null; }
            stockage.supprimer(rescueId);
        },

        ecrireMaintenant,
        fermer() { ecrireMaintenant(); clearInterval(sauvegardePeriodique); },
    };
};

module.exports = { creerMoteur, chargerDonneesJS };
