// ============================================
// DONNÉES PARTAGÉES DU SECOURS ET ACTIONS NOMMÉES (lot 0, B1)
// ============================================
// Toutes les données partagées d'un secours (celles qui seront communes à tous les postes
// en réseau) sont rassemblées ici, et toutes leurs modifications passent par des ACTIONS
// NOMMÉES traitées par une seule fonction : reducteurDonnees(etat, action) → nouvel état.
//
// Règles (pour que le serveur puisse exécuter exactement la même fonction en réseau) :
// - fonction PURE : aucun accès à l'horloge, au hasard, au stockage, aux fenêtres
//   (alert, confirm) ni à l'écran ;
// - l'action apporte tout ce qui ne se calcule pas : identifiants (nouvelId()), heure
//   (horodatage ISO), numéros de main courante (reserverNumerosMC()) ;
// - l'état n'est jamais modifié en place : on renvoie un nouvel objet.

// Données partagées (les réglages propres à un poste — secrétaire courant, affichage — n'y sont pas)
const CLES_DONNEES = [
    'masterSauveteursList', 'activeSauveteurIds', 'sauveteurPermanentNumbers', 'nextPermanentNumber',
    'teams', 'usedTeamNumbers', 'secretaires', 'pointsPhone',
    'events', 'nextEventNumber',
    'planning', 'startHour', 'totalDays',
    'missionInfo', 'clotureInfo',
    'mcMode', 'mcIdentifiant', 'mcConfigured',
];

const POINT_PHONE_PC = { lettre: 'PC', nom: 'Poste de Commandement', sousTerre: false, typePP: 'surface', ordre: 0 };

// État d'un nouveau secours. startHour : heure de début du planning (fournie par l'appelant,
// car elle dépend de l'heure courante).
const etatInitialDonnees = (startHour) => ({
    masterSauveteursList: [],
    activeSauveteurIds: [],
    sauveteurPermanentNumbers: {},
    nextPermanentNumber: 1,
    teams: [],
    usedTeamNumbers: [],
    secretaires: ['Secrétaire 1', 'Secrétaire 2', 'Secrétaire 3'],
    pointsPhone: [POINT_PHONE_PC],
    events: [],
    nextEventNumber: 1,
    planning: {},
    startHour,
    totalDays: DEFAULT_TOTAL_DAYS,
    missionInfo: { typeSecours: 'secours', nomCavite: '', commune: '', delaiAlerteOccupation: 6 },
    clotureInfo: null,
    mcMode: 'principale',
    mcIdentifiant: '',
    mcConfigured: false,
});

// ---------- Outils internes (purs) ----------

// Numéro affiché d'une ligne de main courante (préfixe en main courante secondaire)
const formaterNumeroMC = (etat, n, avecPrefixe = true) => {
    const base = n.toString().padStart(3, '0');
    return (avecPrefixe && etat.mcMode === 'secondaire' && etat.mcIdentifiant) ? `${etat.mcIdentifiant}-${base}` : base;
};

// Heure « jj/mm/aaaa hh:mm:ss » affichée dans la main courante, à partir de l'horodatage ISO
const dateHeureFr = (iso) => new Date(iso).toLocaleString('fr-FR');

// Ligne de main courante créée par le système
const evenementSysteme = (etat, a, champs, avecPrefixe = true) => ({
    id: a.idEvenement,
    isoTimestamp: a.horodatage,
    secretaire: 'Système',
    dateHeure: dateHeureFr(a.horodatage),
    messageImportant: false,
    numero: formaterNumeroMC(etat, a.numero, avecPrefixe),
    fait: false,
    ...champs,
});

// Index du créneau de 15 min du planning correspondant à un horodatage (heure locale)
const indexCreneau = (etat, iso) => {
    const d = new Date(iso);
    let minutes = d.getHours() * 60 + d.getMinutes() - etat.startHour * 60;
    if (minutes < 0) minutes += 24 * 60;
    return Math.floor(minutes / 15);
};

// Case de planning vide
const creneauVide = v => !v || v === 'nondef' || v === 'effacer';

// Affecte une activité au créneau slot d'une ligne de planning ; les créneaux vides qui le
// précèdent reprennent la dernière activité connue. Renvoie une nouvelle ligne.
const affecterCreneau = (ligne, slot, activite) => {
    const r = [...ligne];
    let derniere = null;
    for (let s = slot - 1; s >= 0; s--) { if (!creneauVide(r[s])) { derniere = r[s]; break; } }
    if (derniere) {
        for (let s = slot - 1; s >= 0; s--) { if (creneauVide(r[s])) r[s] = derniere; else break; }
    }
    r[slot] = activite;
    return r;
};

// Instant (ms) d'une date/heure affichée « jj/mm/aaaa hh:mm(:ss) » ou « jj/mm/aaaa à hh:mm »,
// à la minute (tri de l'import d'une main courante secondaire)
const dateHeureAffichee = (texte) => {
    try {
        const parts = texte.replace(' à ', ' ').split(/[\/\s:]/);
        if (parts.length >= 5) {
            const [jour, mois, annee, heure, minute] = parts.map(p => parseInt(p, 10));
            return new Date(annee, mois - 1, jour, heure, minute).getTime();
        }
    } catch (e) { /* format inattendu */ }
    return 0;
};

// Instant (ms) d'une ligne de main courante : horodatage ISO, sinon ancien identifiant
// numérique (Date.now(), anciennes versions), sinon date/heure affichée
const horodatageEvenement = (ev) => {
    if (ev.isoTimestamp) { const t = Date.parse(ev.isoTimestamp); if (!isNaN(t)) return t; }
    if (typeof ev.id === 'number' && ev.id > 1000000000000) return ev.id;
    if (ev.dateHeure) {
        const m = ev.dateHeure.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
        if (m) { const [, j, mo, a, h, mi, s = '00'] = m; return new Date(a, mo - 1, j, h, mi, s).getTime(); }
        const t = Date.parse(ev.dateHeure);
        if (!isNaN(t)) return t;
    }
    return 0;
};

// Identifiants uniques, de façon déterministe (version pure de garantirIdsUniques) :
// un doublon reçoit « identifiant~2 », « ~3 »…
const idsUniques = (events) => {
    const vus = new Set(events.map(e => e.id));
    const deja = new Set();
    return events.map(e => {
        if (!deja.has(e.id)) { deja.add(e.id); return e; }
        let n = 2;
        while (vus.has(`${e.id}~${n}`)) n++;
        const id = `${e.id}~${n}`;
        vus.add(id); deja.add(id);
        return { ...e, id };
    });
};

// Lettre d'un point phone (anciennes données : simple chaîne ; actuelles : objet)
const lettrePointPhone = (pp) => (typeof pp === 'object' ? pp.lettre : pp);

const nomsSauveteurs = (etat, ids) => ids
    .map(id => etat.masterSauveteursList.find(s => s.id === id))
    .filter(Boolean)
    .map(s => s.name);

// ---------- Actions ----------

const ACTIONS_DONNEES = {

    // ===== Sauveteurs : liste préfectorale =====

    'SAUVETEURS/LISTE_AJOUTER'(etat, { sauveteur }) {
        if (etat.masterSauveteursList.some(s => s.id === sauveteur.id)) return etat;
        return { ...etat, masterSauveteursList: [...etat.masterSauveteursList, sauveteur] };
    },

    'SAUVETEURS/LISTE_MODIFIER'(etat, { id, name, role, SSF }) {
        return { ...etat, masterSauveteursList: etat.masterSauveteursList.map(s => s.id === id ? { ...s, name, role, SSF } : s) };
    },

    'SAUVETEURS/LISTE_SUPPRIMER'(etat, { id }) {
        return { ...etat, masterSauveteursList: etat.masterSauveteursList.filter(s => s.id !== id) };
    },

    // Supprime tous les sauveteurs qui ne sont pas actifs au planning
    'SAUVETEURS/LISTE_SUPPRIMER_INACTIFS'(etat) {
        return { ...etat, masterSauveteursList: etat.masterSauveteursList.filter(s => etat.activeSauveteurIds.includes(s.id)) };
    },

    // Import d'un fichier : les sauveteurs importés remplacent ceux de même identifiant
    'SAUVETEURS/LISTE_IMPORTER'(etat, { sauveteurs }) {
        const conserves = etat.masterSauveteursList.filter(s => !sauveteurs.some(n => n.id === s.id));
        return { ...etat, masterSauveteursList: [...conserves, ...sauveteurs] };
    },

    // ===== Sauveteurs : arrivée et départ =====

    // Arrivée sur site : activation, n° permanent, créneau « disponible » au planning,
    // une ligne groupée de main courante. Un sauveteur déjà venu (parti puis revenu)
    // garde son n° et sa ligne de planning.
    'SAUVETEURS/ARRIVEE'(etat, a) {
        const totalSlots = getTotalSlots(etat.totalDays);
        const slot = indexCreneau(etat, a.horodatage);
        const dansPlanning = slot >= 0 && slot < totalSlots;
        let { activeSauveteurIds, sauveteurPermanentNumbers, nextPermanentNumber } = etat;
        const planning = { ...etat.planning };
        a.ids.forEach(id => {
            if (!activeSauveteurIds.includes(id)) {
                activeSauveteurIds = [...activeSauveteurIds, id];
                sauveteurPermanentNumbers = { ...sauveteurPermanentNumbers, [id]: nextPermanentNumber };
                nextPermanentNumber++;
                const ligne = Array(totalSlots).fill('nondef');
                if (dansPlanning) ligne[slot] = 'disponible';
                planning[id] = ligne;
            } else if (dansPlanning) {
                const ligne = planning[id] ? [...planning[id]] : Array(totalSlots).fill('nondef');
                while (ligne.length < totalSlots) ligne.push('nondef');
                ligne[slot] = 'disponible';
                planning[id] = ligne;
            }
        });
        const noms = nomsSauveteurs(etat, a.ids).join(', ');
        const evenement = evenementSysteme(etat, a, {
            categorie: 'personnel',
            evenement: etat.mcMode === 'secondaire' ? `Sauveteurs requis : ${noms}` : `Arrivée de : ${noms}`,
        });
        return {
            ...etat, activeSauveteurIds, sauveteurPermanentNumbers, nextPermanentNumber, planning,
            events: [...etat.events, evenement],
        };
    },

    // Départ du secours : retiré des équipes (les équipes devenues vides sont conservées),
    // gardé au planning avec « Quitter le secours » sur le créneau actuel (les créneaux vides
    // qui précèdent reprennent la dernière activité), une ligne de main courante.
    'SAUVETEURS/DEPART'(etat, a) {
        const totalSlots = getTotalSlots(etat.totalDays);
        const slot = indexCreneau(etat, a.horodatage);
        const vide = v => !v || v === 'nondef' || v === 'effacer';
        const planning = { ...etat.planning };
        a.ids.forEach(id => {
            if (!planning[id]) return;
            const ligne = [...planning[id]];
            let derniere = null;
            for (let s = slot - 1; s >= 0; s--) { if (!vide(ligne[s])) { derniere = ligne[s]; break; } }
            if (derniere) {
                for (let s = slot - 1; s >= 0; s--) { if (vide(ligne[s])) ligne[s] = derniere; else break; }
            }
            if (slot >= 0 && slot < totalSlots) ligne[slot] = 'quitter_secours';
            planning[id] = ligne;
        });
        const teams = etat.teams.map(t => ({ ...t, members: t.members.filter(id => !a.ids.includes(id)) }));
        const evenement = evenementSysteme(etat, a, {
            categorie: 'personnel',
            evenement: 'Départ de : ' + nomsSauveteurs(etat, a.ids).join(', '),
        });
        return { ...etat, planning, teams, events: [...etat.events, evenement] };
    },

    // ===== Points phones (repérés par leur lettre, unique) =====

    // ordreSaisi : position saisie (texte) ; vide ou invalide → après le dernier
    'POINTS_PHONE/AJOUTER'(etat, { lettre, nom, typePP, ordreSaisi }) {
        if (etat.pointsPhone.some(pp => lettrePointPhone(pp) === lettre)) return etat;
        const maxOrdre = etat.pointsPhone.reduce((max, pp) => {
            const o = typeof pp === 'object' && pp.ordre !== undefined ? parseFloat(pp.ordre) : 0;
            return Math.max(max, isNaN(o) ? 0 : o);
        }, 0);
        const ordreVal = (ordreSaisi || '').trim() !== '' ? parseFloat(ordreSaisi) : maxOrdre + 1;
        const pointPhone = {
            lettre, nom, typePP, sousTerre: typePP === 'souterre', estEntree: typePP === 'entree' || typePP === 'sortie',
            ordre: isNaN(ordreVal) ? maxOrdre + 1 : ordreVal,
        };
        return { ...etat, pointsPhone: [...etat.pointsPhone, pointPhone] };
    },

    'POINTS_PHONE/SUPPRIMER'(etat, { lettre }) {
        return { ...etat, pointsPhone: etat.pointsPhone.filter(pp => lettrePointPhone(pp) !== lettre) };
    },

    // Modifie un point phone ; les lignes de main courante qui le citaient sont mises à jour
    'POINTS_PHONE/MODIFIER'(etat, { ancienneLettre, lettre, nom, typePP }) {
        const position = etat.pointsPhone.findIndex(pp => lettrePointPhone(pp) === ancienneLettre);
        if (position < 0) return etat;
        const ancien = etat.pointsPhone[position];
        const ancienAffichage = typeof ancien === 'object' ? `${ancien.lettre} - ${ancien.nom}` : ancien;
        const nouveau = {
            lettre, nom, typePP, sousTerre: typePP === 'souterre', estEntree: typePP === 'entree' || typePP === 'sortie',
            ordre: typeof ancien === 'object' && ancien.ordre !== undefined ? ancien.ordre : position,
        };
        const nouvelAffichage = `${lettre} - ${nom}`;
        return {
            ...etat,
            pointsPhone: etat.pointsPhone.map((pp, i) => i === position ? nouveau : pp),
            events: etat.events.map(ev => (ev.pointPhone === ancienAffichage || ev.pointPhone === ancienneLettre)
                ? { ...ev, pointPhone: nouvelAffichage } : ev),
        };
    },

    'POINTS_PHONE/CHANGER_ORDRE'(etat, { lettre, ordre }) {
        return { ...etat, pointsPhone: etat.pointsPhone.map(pp => (typeof pp === 'object' && pp.lettre === lettre) ? { ...pp, ordre } : pp) };
    },

    // Ne garde que le point phone du PC
    'POINTS_PHONE/VIDER'(etat) {
        return { ...etat, pointsPhone: [POINT_PHONE_PC] };
    },

    // ===== Secrétaires =====

    'SECRETAIRES/AJOUTER'(etat, { nom }) {
        if (etat.secretaires.includes(nom)) return etat;
        return { ...etat, secretaires: [...etat.secretaires, nom].sort() };
    },

    'SECRETAIRES/SUPPRIMER'(etat, { nom }) {
        return { ...etat, secretaires: etat.secretaires.filter(s => s !== nom) };
    },

    // ===== Main courante =====

    // Ligne saisie (ou créée par un écran) : construite entièrement par l'appelant
    'MC/AJOUTER'(etat, { evenement }) {
        return { ...etat, events: [...etat.events, evenement] };
    },

    // Plusieurs lignes d'un coup (ex. fenêtre de repos : une ligne par groupe de sauveteurs)
    'MC/AJOUTER_PLUSIEURS'(etat, { evenements }) {
        return { ...etat, events: [...etat.events, ...evenements] };
    },

    'MC/MODIFIER'(etat, { id, champs }) {
        return { ...etat, events: etat.events.map(e => e.id === id ? { ...e, ...champs } : e) };
    },

    // Insertion juste après (ou avant) une ligne existante
    'MC/INSERER'(etat, { evenement, idReference, avant }) {
        const events = [...etat.events];
        const i = events.findIndex(e => e.id === idReference);
        events.splice(avant ? i : i + 1, 0, evenement);
        return { ...etat, events };
    },

    // Rappel marqué comme réalisé + ligne de validation (construite par l'appelant)
    'MC/VALIDER_RAPPEL'(etat, { id, evenementValidation }) {
        return { ...etat, events: [...etat.events.map(e => e.id === id ? { ...e, fait: true } : e), evenementValidation] };
    },

    'MC/REPORTER_RAPPEL'(etat, { id, dateRappel, heureRappel }) {
        return { ...etat, events: etat.events.map(e => e.id !== id ? e : { ...e, dateRappel, heureRappel }) };
    },

    // Passage d'une équipe à un point phone : membres présents ajoutés au texte de la ligne
    'MC/AJOUTER_PRESENTS_POINT_PHONE'(etat, { id, mention }) {
        return { ...etat, events: etat.events.map(e => e.id !== id ? e : { ...e, evenement: e.evenement + '\nPrésents au point phone : ' + mention }) };
    },

    // Import d'une main courante secondaire : fusion triée par date/heure affichée, puis
    // prochain numéro au-delà des numéros importés
    'MC/IMPORTER_SECONDAIRE'(etat, { evenements }) {
        const fusion = [...etat.events, ...evenements]
            .sort((a, b) => dateHeureAffichee(a.dateHeure) - dateHeureAffichee(b.dateHeure));
        const maxNum = Math.max(0, ...evenements.map(e => {
            const m = e.numero && e.numero.match(/\d+/);
            return m ? parseInt(m[0], 10) + 1 : 0;
        }));
        return { ...etat, events: idsUniques(fusion), nextEventNumber: Math.max(etat.nextEventNumber, maxNum) };
    },

    // Import d'événements (« Importer Événements ») : fusion strictement chronologique ; à
    // égalité, les lignes locales avant les importées
    'MC/IMPORTER_EVENEMENTS'(etat, { evenements }) {
        const fusion = [...etat.events, ...evenements].sort((a, b) => {
            const ta = horodatageEvenement(a), tb = horodatageEvenement(b);
            if (ta !== tb) return ta - tb;
            if (a.importedFrom && !b.importedFrom) return 1;
            if (!a.importedFrom && b.importedFrom) return -1;
            return 0;
        });
        return { ...etat, events: idsUniques(fusion) };
    },

    // ===== Planning depuis la main courante =====

    // Activité affectée aux membres d'une équipe (fenêtre « Mise à jour planning » après une
    // ligne de progression) + ligne de main courante (construite par l'appelant)
    'PLANNING/AFFECTER_DEPUIS_MC'(etat, { evenement, ids, activite, slot }) {
        const planning = { ...etat.planning };
        ids.forEach(id => { if (planning[id]) planning[id] = affecterCreneau(planning[id], slot, activite); });
        return { ...etat, planning, events: [...etat.events, evenement] };
    },

    // ===== Secours =====

    'SECOURS/CLOTURER'(etat, { horodatageCloture, evenement }) {
        return {
            ...etat,
            clotureInfo: { dateHeure: dateHeureFr(horodatageCloture), isoTimestamp: horodatageCloture },
            events: [...etat.events, evenement],
        };
    },

    'SECOURS/ROUVRIR'(etat) {
        return { ...etat, clotureInfo: null };
    },

    // Attribue un n° permanent aux sauveteurs actifs qui n'en ont pas (anciens dossiers)
    'SAUVETEURS/NUMEROTER_MANQUANTS'(etat) {
        const sansNumero = etat.activeSauveteurIds.filter(id => !etat.sauveteurPermanentNumbers[id]);
        if (sansNumero.length === 0) return etat;
        const sauveteurPermanentNumbers = { ...etat.sauveteurPermanentNumbers };
        let n = etat.nextPermanentNumber;
        sansNumero.forEach(id => { sauveteurPermanentNumbers[id] = n++; });
        return { ...etat, sauveteurPermanentNumbers, nextPermanentNumber: n };
    },

    // Compatibilité pendant la transition : remplace une donnée (valeur ou fonction de mise à
    // jour, comme un setter React). À supprimer quand toutes les modifications seront nommées.
    REMPLACER(etat, { cle, valeur }) {
        if (!CLES_DONNEES.includes(cle)) throw new Error(`Donnée inconnue : ${cle}`);
        const nouvelle = typeof valeur === 'function' ? valeur(etat[cle]) : valeur;
        return nouvelle === etat[cle] ? etat : { ...etat, [cle]: nouvelle };
    },
};

const reducteurDonnees = (etat, action) => {
    const traiter = ACTIONS_DONNEES[action.type];
    if (!traiter) throw new Error(`Action inconnue : ${action.type}`);
    return traiter(etat, action);
};

// ============================================
// PRÉPARATION DES ACTIONS (côté poste)
// ============================================
// Fonctions appelées par les écrans : elles ajoutent à l'action ce qui ne peut pas être
// calculé par la fonction pure (heure, identifiant, numéro de main courante) puis l'envoient.
// En réseau, c'est ici que l'action partira vers le serveur.
const creerActionsDonnees = (dispatch, reserverNumerosMC) => {
    // Une ligne de main courante : heure, identifiant et numéro
    const ligneMC = () => ({ horodatage: new Date().toISOString(), idEvenement: nouvelId(), numero: reserverNumerosMC() });
    return {
        // Sauveteurs
        ajouterSauveteurListe: (sauveteur) => dispatch({ type: 'SAUVETEURS/LISTE_AJOUTER', sauveteur }),
        modifierSauveteurListe: (id, champs) => dispatch({ type: 'SAUVETEURS/LISTE_MODIFIER', id, ...champs }),
        supprimerSauveteurListe: (id) => dispatch({ type: 'SAUVETEURS/LISTE_SUPPRIMER', id }),
        supprimerSauveteursInactifs: () => dispatch({ type: 'SAUVETEURS/LISTE_SUPPRIMER_INACTIFS' }),
        importerSauveteursListe: (sauveteurs) => dispatch({ type: 'SAUVETEURS/LISTE_IMPORTER', sauveteurs }),
        arriveeSauveteurs: (ids) => dispatch({ type: 'SAUVETEURS/ARRIVEE', ids, ...ligneMC() }),
        departSauveteurs: (ids) => dispatch({ type: 'SAUVETEURS/DEPART', ids, ...ligneMC() }),
        numeroterSauveteursManquants: () => dispatch({ type: 'SAUVETEURS/NUMEROTER_MANQUANTS' }),
        // Points phones
        ajouterPointPhone: (lettre, nom, typePP, ordreSaisi) => dispatch({ type: 'POINTS_PHONE/AJOUTER', lettre, nom, typePP, ordreSaisi }),
        supprimerPointPhone: (lettre) => dispatch({ type: 'POINTS_PHONE/SUPPRIMER', lettre }),
        modifierPointPhone: (ancienneLettre, lettre, nom, typePP) => dispatch({ type: 'POINTS_PHONE/MODIFIER', ancienneLettre, lettre, nom, typePP }),
        changerOrdrePointPhone: (lettre, ordre) => dispatch({ type: 'POINTS_PHONE/CHANGER_ORDRE', lettre, ordre }),
        viderPointsPhone: () => dispatch({ type: 'POINTS_PHONE/VIDER' }),
        // Main courante (lignes construites par les écrans : identifiant, numéro et heure compris)
        ajouterLigneMC: (evenement) => dispatch({ type: 'MC/AJOUTER', evenement }),
        ajouterLignesMC: (evenements) => dispatch({ type: 'MC/AJOUTER_PLUSIEURS', evenements }),
        modifierLigneMC: (id, champs) => dispatch({ type: 'MC/MODIFIER', id, champs }),
        insererLigneMC: (evenement, idReference, avant) => dispatch({ type: 'MC/INSERER', evenement, idReference, avant }),
        validerRappel: (id, evenementValidation) => dispatch({ type: 'MC/VALIDER_RAPPEL', id, evenementValidation }),
        reporterRappel: (id, dateRappel, heureRappel) => dispatch({ type: 'MC/REPORTER_RAPPEL', id, dateRappel, heureRappel }),
        ajouterPresentsPointPhone: (id, mention) => dispatch({ type: 'MC/AJOUTER_PRESENTS_POINT_PHONE', id, mention }),
        importerMCSecondaire: (evenements) => dispatch({ type: 'MC/IMPORTER_SECONDAIRE', evenements }),
        importerEvenements: (evenements) => dispatch({ type: 'MC/IMPORTER_EVENEMENTS', evenements }),
        affecterPlanningDepuisMC: (evenement, ids, activite, slot) => dispatch({ type: 'PLANNING/AFFECTER_DEPUIS_MC', evenement, ids, activite, slot }),
        // Secours
        cloturerSecours: (horodatageCloture, evenement) => dispatch({ type: 'SECOURS/CLOTURER', horodatageCloture, evenement }),
        rouvrirSecours: () => dispatch({ type: 'SECOURS/ROUVRIR' }),
        // Secrétaires
        ajouterSecretaire: (nom) => dispatch({ type: 'SECRETAIRES/AJOUTER', nom }),
        supprimerSecretaire: (nom) => dispatch({ type: 'SECRETAIRES/SUPPRIMER', nom }),
    };
};
