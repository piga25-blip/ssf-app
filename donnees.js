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

// ---------- Actions ----------

const ACTIONS_DONNEES = {

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
