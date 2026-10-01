// ============================================
// STOCKAGE DES SECOURS EN FICHIERS (lot 1 du plan réseau)
// ============================================
// Un dossier par secours dans <données de l'application>/secours/<identifiant>/ :
//   dossier.json        identifiant du secours, version (n° de la dernière action enregistrée)
//   mission.json        infos du secours, clôture, secrétaires, mode de main courante
//   inscription.json    sauveteurs (liste, actifs, n° permanents)
//   main-courante.json  lignes de main courante, prochain numéro
//   planning.json       planning, heure de début, nombre de jours
//   equipes.json        équipes, n° d'équipe déjà utilisés
//   points-phone.json   points phones
//   journal.log         une ligne par action, dans l'ordre (qui, quoi, quand)
//   sauvegardes/        copies horodatées
//
// Écriture sûre : fichier temporaire puis renommage (une coupure ne laisse jamais un fichier
// à moitié écrit). Chaque partie garde le n° de la dernière action qu'elle contient. Une action
// est d'abord écrite dans le journal ; si l'application s'arrête avant que toutes les parties
// soient écrites, le journal est rejoué au chargement pour les parties en retard.

const fs = require('fs');
const path = require('path');

const PARTIES = {
    'mission.json': ['missionInfo', 'clotureInfo', 'secretaires', 'mcMode', 'mcIdentifiant', 'mcConfigured'],
    'inscription.json': ['masterSauveteursList', 'activeSauveteurIds', 'sauveteurPermanentNumbers', 'nextPermanentNumber'],
    'main-courante.json': ['events', 'nextEventNumber'],
    'planning.json': ['planning', 'startHour', 'totalDays'],
    'equipes.json': ['teams', 'usedTeamNumbers'],
    'points-phone.json': ['pointsPhone'],
};
const PARTIE_DE_CLE = {};
Object.entries(PARTIES).forEach(([fichier, cles]) => cles.forEach(c => { PARTIE_DE_CLE[c] = fichier; }));

const MAX_SAUVEGARDES = 20;

// Nom de dossier d'un secours (même transformation que l'ancienne clé de stockage du navigateur)
const nomDossier = (rescueId) => String(rescueId).trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'secours';

const ecrireSur = (fichier, contenu) => {
    const temporaire = fichier + '.tmp';
    const fd = fs.openSync(temporaire, 'w');
    try { fs.writeSync(fd, contenu); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporaire, fichier);
};
const lireJSON = (fichier) => { try { return JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch (e) { return null; } };

const creerStockage = (racineDonnees) => {
    const racine = path.join(racineDonnees, 'secours');
    fs.mkdirSync(racine, { recursive: true });
    const dossier = (id) => path.join(racine, nomDossier(id));

    return {
        racine,
        nomDossier,
        existe: (id) => fs.existsSync(path.join(dossier(id), 'dossier.json')),

        // Liste des secours enregistrés (pour « Rouvrir un dossier »)
        lister() {
            return fs.readdirSync(racine, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
                const rep = path.join(racine, d.name);
                const meta = lireJSON(path.join(rep, 'dossier.json'));
                if (!meta) return null;
                const mission = (lireJSON(path.join(rep, 'mission.json')) || {}).donnees || {};
                const mc = (lireJSON(path.join(rep, 'main-courante.json')) || {}).donnees || {};
                return {
                    rescueId: meta.rescueId, majLe: meta.majLe, version: meta.version,
                    missionInfo: mission.missionInfo || null, clotureInfo: mission.clotureInfo || null,
                    nbEvenements: (mc.events || []).length,
                };
            }).filter(Boolean).sort((a, b) => String(b.majLe).localeCompare(String(a.majLe)));
        },

        // Charge un secours : parties + rattrapage par le journal (appliquer = fonction réductrice)
        charger(id, appliquer) {
            const rep = dossier(id);
            const meta = lireJSON(path.join(rep, 'dossier.json'));
            if (!meta) return null;
            const parties = {};
            const donnees = {};
            for (const [fichier, cles] of Object.entries(PARTIES)) {
                const contenu = lireJSON(path.join(rep, fichier)) || { version: 0, donnees: {} };
                parties[fichier] = contenu.version || 0;
                cles.forEach(c => { if (contenu.donnees && c in contenu.donnees) donnees[c] = contenu.donnees[c]; });
            }
            // Rattrapage : actions du journal plus récentes que certaines parties
            const versionMin = Math.min(...Object.values(parties));
            const versionMax = Math.max(meta.version || 0, ...Object.values(parties));
            let version = versionMax;
            const journal = this.lireJournal(id).filter(e => e.version > versionMin);
            if (journal.length > 0 && appliquer) {
                let etat = { ...donnees };
                for (const entree of journal) {
                    // Action refusée au rattrapage : les parties qu'elle concerne la contiennent déjà
                    let suivant;
                    try { suivant = appliquer(etat, entree.action); } catch (e) { if (e.refus) { version = Math.max(version, entree.version); continue; } throw e; }
                    // Une partie déjà à jour garde son contenu ; les parties en retard reçoivent l'action
                    for (const [fichier, cles] of Object.entries(PARTIES)) {
                        if (parties[fichier] < entree.version) cles.forEach(c => { if (c in suivant) etat[c] = suivant[c]; });
                    }
                    version = Math.max(version, entree.version);
                }
                Object.assign(donnees, etat);
            }
            return { rescueId: meta.rescueId, version, donnees, rattrapees: journal.length };
        },

        // Nouveau secours (données initiales complètes)
        creer(id, donnees) {
            const rep = dossier(id);
            fs.mkdirSync(path.join(rep, 'sauvegardes'), { recursive: true });
            this.ecrireParties(id, donnees, Object.keys(PARTIES), 0);
        },

        // Une action, avant tout le reste (garantie en cas d'arrêt brutal)
        ajouterJournal(id, entree) {
            const fd = fs.openSync(path.join(dossier(id), 'journal.log'), 'a');
            try { fs.writeSync(fd, JSON.stringify(entree) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        },

        lireJournal(id) {
            let texte = '';
            try { texte = fs.readFileSync(path.join(dossier(id), 'journal.log'), 'utf8'); } catch (e) { return []; }
            return texte.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
        },

        // Écrit les parties indiquées (noms de fichiers) puis dossier.json
        ecrireParties(id, donnees, fichiers, version) {
            const rep = dossier(id);
            fs.mkdirSync(rep, { recursive: true });
            for (const fichier of fichiers) {
                const contenu = {};
                PARTIES[fichier].forEach(c => { contenu[c] = donnees[c]; });
                ecrireSur(path.join(rep, fichier), JSON.stringify({ version, donnees: contenu }));
            }
            const meta = this.lireMeta(id);
            ecrireSur(path.join(rep, 'dossier.json'), JSON.stringify({ rescueId: meta ? meta.rescueId : id, version, majLe: new Date().toISOString() }));
        },

        lireMeta: (id) => lireJSON(path.join(dossier(id), 'dossier.json')),

        // Copie horodatée des fichiers du secours (les plus anciennes au-delà de 20 sont supprimées)
        sauvegarder(id) {
            const rep = dossier(id);
            const cible = path.join(rep, 'sauvegardes', new Date().toISOString().replace(/[:.]/g, '-'));
            fs.mkdirSync(cible, { recursive: true });
            for (const f of ['dossier.json', ...Object.keys(PARTIES)]) {
                if (fs.existsSync(path.join(rep, f))) fs.copyFileSync(path.join(rep, f), path.join(cible, f));
            }
            const toutes = fs.readdirSync(path.join(rep, 'sauvegardes')).sort();
            toutes.slice(0, Math.max(0, toutes.length - MAX_SAUVEGARDES)).forEach(s => fs.rmSync(path.join(rep, 'sauvegardes', s), { recursive: true, force: true }));
            return cible;
        },

        supprimer(id) { fs.rmSync(dossier(id), { recursive: true, force: true }); },

        // Changement d'identifiant du secours : le dossier est renommé
        renommer(ancien, nouveau) {
            if (nomDossier(ancien) === nomDossier(nouveau)) return;
            if (fs.existsSync(dossier(nouveau))) throw new Error(`Le secours « ${nouveau} » existe déjà`);
            fs.renameSync(dossier(ancien), dossier(nouveau));
            const meta = lireJSON(path.join(dossier(nouveau), 'dossier.json')) || {};
            ecrireSur(path.join(dossier(nouveau), 'dossier.json'), JSON.stringify({ ...meta, rescueId: nouveau, majLe: new Date().toISOString() }));
        },
    };
};

module.exports = { creerStockage, PARTIES, PARTIE_DE_CLE, nomDossier };
