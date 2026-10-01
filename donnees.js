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
    };
};
