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
//   (horodatage ISO) ; les numéros de main courante sont attribués ici (NUMERO_AUTO) ;
// - l'état n'est jamais modifié en place : on renvoie un nouvel objet.

// Données partagées (les réglages propres à un poste — secrétaire courant, affichage — n'y sont pas)
const CLES_DONNEES = [
    'masterSauveteursList', 'activeSauveteurIds', 'sauveteurPermanentNumbers', 'nextPermanentNumber',
    'teams', 'usedTeamNumbers', 'secretaires', 'pointsPhone',
    'events', 'nextEventNumber',
    'planning', 'startHour', 'totalDays',
    'missionInfo', 'clotureInfo',
    'mcMode', 'mcIdentifiant', 'mcConfigured', 'mcRecopie',
];

// Actions permises aux postes de saisie (autres postes du réseau, quand le poste principal autorise
// la saisie) — rôle « Saisie » de la décision 2 : main courante, points phones (lot 2), inscriptions,
// équipes et planning (lot 3). Restent au poste principal : dossier, infos et clôture du secours,
// imports, remises à zéro, secrétaires, réglages du planning, suppressions en masse.
const ACTIONS_SAISIE_DISTANTE = [
    // Main courante et points phones (lot 2)
    'MC/AJOUTER', 'MC/AJOUTER_PLUSIEURS', 'MC/MODIFIER', 'MC/INSERER', 'MC/VALIDER_RAPPEL', 'MC/REPORTER_RAPPEL',
    'MC/AJOUTER_PRESENTS_POINT_PHONE', 'PLANNING/AFFECTER_DEPUIS_MC', 'MC/RECOPIER',
    // Inscriptions (lot 3)
    'SAUVETEURS/LISTE_AJOUTER', 'SAUVETEURS/LISTE_MODIFIER', 'SAUVETEURS/LISTE_SUPPRIMER', 'SAUVETEURS/ARRIVEE', 'SAUVETEURS/DEPART',
    // Points phones (lot 3)
    'POINTS_PHONE/AJOUTER', 'POINTS_PHONE/MODIFIER', 'POINTS_PHONE/CHANGER_ORDRE', 'POINTS_PHONE/SUPPRIMER',
    // Équipes (lot 3)
    'EQUIPES/CREER', 'EQUIPES/MODIFIER', 'EQUIPES/DISSOUDRE', 'EQUIPES/REACTIVER', 'EQUIPES/AJOUTER_MEMBRES',
    'EQUIPES/LIBERER_MEMBRE', 'EQUIPES/DEPLACER_MEMBRE', 'EQUIPES/REORDONNER_MEMBRES', 'EQUIPES/SCINDER',
    // Planning (lot 3)
    'PLANNING/AFFECTER', 'PLANNING/RECOPIER', 'PLANNING/COMBLER_CRENEAUX',
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
    mcRecopie: null, // PC Base Arrière en recopie d'une main courante papier : { auteur, commenceLe }
});

// ---------- Numéros de main courante (lot 2) ----------
// Les écrans ne choisissent pas le numéro d'une nouvelle ligne : ils mettent l'un de ces marqueurs,
// remplacé ici par le prochain numéro au moment où l'action est appliquée. Tous les postes
// appliquant les actions dans l'ordre fixé par le serveur, ils obtiennent les mêmes numéros.
const NUMERO_AUTO = '#AUTO';                        // avec le préfixe de la MC secondaire (B-012)
const NUMERO_AUTO_SANS_PREFIXE = '#AUTO-SANS-PREFIXE'; // sans préfixe (certaines lignes système)

// ---------- Refus (lot 3) ----------
// Une action incompatible avec l'état actuel (ex. deux postes créent « Équipe 3 » au même instant)
// est refusée : le serveur ne l'applique pas et renvoie ce message au poste qui l'a envoyée.
const refuser = (message) => { const e = new Error(message); e.refus = true; throw e; };

// ---------- Outils internes (purs) ----------

// Numéro affiché d'une ligne de main courante (préfixe en main courante secondaire)
const formaterNumeroMC = (etat, n, avecPrefixe = true) => {
    const base = n.toString().padStart(3, '0');
    return (avecPrefixe && etat.mcMode === 'secondaire' && etat.mcIdentifiant) ? `${etat.mcIdentifiant}-${base}` : base;
};

// Heure « jj/mm/aaaa hh:mm:ss » affichée dans la main courante, à partir de l'horodatage ISO
const dateHeureFr = (iso) => new Date(iso).toLocaleString('fr-FR');

// Ligne de main courante créée par le système (numéro attribué à l'application de l'action)
const evenementSysteme = (etat, a, champs, avecPrefixe = true) => ({
    id: a.idEvenement,
    isoTimestamp: a.horodatage,
    secretaire: 'Système',
    dateHeure: dateHeureFr(a.horodatage),
    messageImportant: false,
    numero: avecPrefixe ? NUMERO_AUTO : NUMERO_AUTO_SANS_PREFIXE,
    fait: false,
    ...champs,
});

// Remplace les marqueurs NUMERO_AUTO des lignes par les numéros suivants, dans l'ordre des lignes
const numeroterLignes = (etat) => {
    if (!etat.events.some(e => e && (e.numero === NUMERO_AUTO || e.numero === NUMERO_AUTO_SANS_PREFIXE))) return etat;
    let n = etat.nextEventNumber;
    const events = etat.events.map(e => {
        if (!e || (e.numero !== NUMERO_AUTO && e.numero !== NUMERO_AUTO_SANS_PREFIXE)) return e;
        return { ...e, numero: formaterNumeroMC(etat, n++, e.numero === NUMERO_AUTO) };
    });
    return { ...etat, events, nextEventNumber: n };
};

// Recopie d'une main courante papier : lignes rangées par date/heure écrite sur le papier,
// puis renumérotées dans cet ordre (une ligne oubliée se range à sa place)
const rangerRecopie = (etat) => {
    const events = [...etat.events]
        .sort((a, b) => (Date.parse(a.isoTimestamp) || 0) - (Date.parse(b.isoTimestamp) || 0))
        .map((e, i) => ({ ...e, numero: formaterNumeroMC(etat, i + 1) }));
    return { ...etat, events, nextEventNumber: events.length + 1 };
};

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

// Met une activité sur le créneau actuel (horodatage) des sauveteurs indiqués qui ont une
// ligne de planning ; rien si l'heure est hors du planning. Renvoie le nouveau planning.
const affecterAuCreneauActuel = (etat, ids, horodatage, activite) => {
    const slot = indexCreneau(etat, horodatage);
    if (slot < 0 || slot >= getTotalSlots(etat.totalDays)) return etat.planning;
    const planning = { ...etat.planning };
    ids.forEach(id => { if (planning[id]) { const r = [...planning[id]]; r[slot] = activite; planning[id] = r; } });
    return planning;
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

// Prochain identifiant libre « EXT-nnn » de la liste préfectorale
const prochainIdExterne = (etat) => {
    const nums = etat.masterSauveteursList.map(s => (String(s.id).match(/^EXT-(\d{1,4})$/) || [])[1]).filter(Boolean).map(Number);
    return `EXT-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
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

    // idAuto : identifiant EXT-nnn proposé par le poste ; s'il vient d'être pris par un autre poste,
    // le suivant libre est attribué. Identifiant saisi à la main et déjà pris : refus.
    'SAUVETEURS/LISTE_AJOUTER'(etat, { sauveteur }) {
        const { idAuto, ...s } = sauveteur;
        const existant = etat.masterSauveteursList.find(x => x.id === s.id);
        if (existant) {
            if (!idAuto) refuser(`L'identifiant ${s.id} est déjà utilisé (« ${existant.name} »).`);
            s.id = prochainIdExterne(etat);
        }
        return { ...etat, masterSauveteursList: [...etat.masterSauveteursList, s] };
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
        if (etat.pointsPhone.some(pp => lettrePointPhone(pp) === lettre)) refuser(`Le point phone « ${lettre} » existe déjà (ajouté sur un autre poste ?).`);
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
        if (position < 0) refuser(`Le point phone « ${ancienneLettre} » n'existe plus (supprimé sur un autre poste ?).`);
        if (lettre !== ancienneLettre && etat.pointsPhone.some(pp => lettrePointPhone(pp) === lettre)) refuser(`Le point phone « ${lettre} » existe déjà.`);
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

    // Ancien distributeur de numéros (lot 0, remplacé au lot 2 par NUMERO_AUTO) : conservé pour
    // relire les journaux écrits avant le lot 2
    'MC/RESERVER_NUMEROS'(etat, { jusqua }) {
        return jusqua > etat.nextEventNumber ? { ...etat, nextEventNumber: jusqua } : etat;
    },


    // Ligne saisie (ou créée par un écran) : construite entièrement par l'appelant
    'MC/AJOUTER'(etat, { evenement }) {
        return { ...etat, events: [...etat.events, evenement] };
    },

    // Ligne recopiée d'une main courante papier : date/heure du papier, rangée à sa place
    'MC/RECOPIER'(etat, { evenement }) {
        return rangerRecopie({ ...etat, events: [...etat.events, evenement] });
    },

    // Plusieurs lignes d'un coup (ex. fenêtre de repos : une ligne par groupe de sauveteurs)
    'MC/AJOUTER_PLUSIEURS'(etat, { evenements }) {
        return { ...etat, events: [...etat.events, ...evenements] };
    },

    // Correction d'une ligne (décision 9) : les valeurs d'avant sont gardées dans « corrections »
    // avec l'auteur et l'heure ; rien n'est jamais effacé. par / horodatage : qui corrige, et quand.
    'MC/MODIFIER'(etat, { id, champs, par, horodatage, dejaRange }) {
        // Heure d'une ligne recopiée du papier corrigée : la main courante est rangée à nouveau
        if (etat.mcRecopie && champs.isoTimestamp && !dejaRange) {
            return rangerRecopie(ACTIONS_DONNEES['MC/MODIFIER'](etat, { id, champs, par, horodatage, dejaRange: true }));
        }
        return { ...etat, events: etat.events.map(e => {
            if (e.id !== id) return e;
            // Absent, vide, nul ou « non » : même valeur (un champ vide du formulaire n'est pas une correction)
            const norm = (v) => (v === undefined || v === null || v === '' || v === false) ? null : JSON.stringify(v);
            const modifies = Object.keys(champs).filter(c => norm(champs[c]) !== norm(e[c]));
            if (modifies.length === 0) return e;
            const avant = {};
            modifies.forEach(c => { avant[c] = e[c] === undefined ? null : e[c]; });
            const correction = { le: horodatage || null, par: par || '', avant };
            return { ...e, ...champs, corrections: [...(e.corrections || []), correction] };
        }) };
    },

    // Insertion juste après (ou avant) une ligne existante
    'MC/INSERER'(etat, { evenement, idReference, avant }) {
        const events = [...etat.events];
        const i = events.findIndex(e => e.id === idReference);
        events.splice(avant ? i : i + 1, 0, evenement);
        return { ...etat, events };
    },

    // Rappel marqué comme réalisé + ligne de validation (construite par l'appelant). Si deux postes
    // valident le même rappel, seule la première validation compte (décision 8).
    'MC/VALIDER_RAPPEL'(etat, { id, evenementValidation }) {
        const rappel = etat.events.find(e => e.id === id);
        if (!rappel || rappel.fait) return etat;
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

    // ===== Planning (grille) =====

    // Activité posée sur des cases de la grille (une ligne est créée si besoin) ; ligne de
    // main courante facultative (construite par l'appelant)
    'PLANNING/AFFECTER'(etat, { cellules, activite, evenement }) {
        const totalSlots = getTotalSlots(etat.totalDays);
        const planning = { ...etat.planning };
        cellules.forEach(({ id, slot }) => {
            const r = planning[id] ? [...planning[id]] : Array(totalSlots).fill('nondef');
            r[slot] = activite;
            planning[id] = r;
        });
        return { ...etat, planning, events: evenement ? [...etat.events, evenement] : etat.events };
    },

    // Poignée de recopie : chaque case reçoit le contenu (avant recopie) de sa case source
    'PLANNING/RECOPIER'(etat, { copies }) {
        const planning = { ...etat.planning };
        copies.forEach(({ id, slot, idSource, slotSource }) => {
            const source = etat.planning[idSource];
            if (!source || !planning[id]) return;
            const r = [...planning[id]];
            r[slot] = source[slotSource] || 'nondef';
            planning[id] = r;
        });
        return { ...etat, planning };
    },

    // Comble des créneaux vides avec une activité (recopie manuelle ou automatique du planning) ;
    // une case remplie entre-temps n'est pas écrasée
    'PLANNING/COMBLER_CRENEAUX'(etat, { remplissages }) {
        const planning = { ...etat.planning };
        remplissages.forEach(({ id, activite, slotDebut, slotFin }) => {
            if (!planning[id]) return;
            const r = [...planning[id]];
            for (let s = slotDebut; s <= slotFin; s++) { if (creneauVide(r[s])) r[s] = activite; }
            planning[id] = r;
        });
        return { ...etat, planning };
    },

    'PLANNING/REGLER_DEBUT'(etat, { startHour }) {
        return { ...etat, startHour };
    },

    'PLANNING/REGLER_DUREE'(etat, { totalDays }) {
        return { ...etat, totalDays };
    },

    // ===== Équipes =====
    // Les lignes de main courante (evenement / evenements) sont construites par l'appelant ;
    // null = pas de ligne (ex. certaines opérations en main courante secondaire).

    // Création : les membres quittent leur ancienne équipe ; numéro mémorisé ; activité
    // « Engagé » (ou « Gestion » si la mission contient « gestion ») au créneau actuel
    'EQUIPES/CREER'(etat, { equipe, horodatage, evenements }) {
        if (etat.teams.some(t => t.id === equipe.id)) refuser(`L'équipe « ${equipe.name} » existe déjà (créée sur un autre poste ?) : choisissez un autre numéro.`);
        if (etat.usedTeamNumbers.some(u => u.numero === equipe.id)) refuser(`Le numéro de « ${equipe.name} » a déjà été utilisé : choisissez un autre numéro.`);
        const teams = etat.teams
            .map(t => t.members.some(id => equipe.members.includes(id)) ? { ...t, members: t.members.filter(id => !equipe.members.includes(id)) } : t)
            .concat([equipe]);
        const activite = equipe.mission.toLowerCase().includes('gestion') ? 'gestion' : 'engage';
        return {
            ...etat, teams,
            usedTeamNumbers: [...etat.usedTeamNumbers, { numero: equipe.id, mission: equipe.mission }],
            planning: affecterAuCreneauActuel(etat, equipe.members, horodatage, activite),
            events: [...etat.events, ...evenements],
        };
    },

    'EQUIPES/MODIFIER'(etat, { id, champs, horodatage, ancienneMission, evenement }) {
        const teams = etat.teams.map(t => t.id !== id ? t : {
            ...t, ...champs,
            history: [...(t.history || []), {
                timestamp: horodatage, action: 'modification_mission',
                details: { ancienne_mission: ancienneMission, nouvelle_mission: champs.mission },
            }],
        });
        return { ...etat, teams, events: evenement ? [...etat.events, evenement] : etat.events };
    },

    // Fin de mission : l'équipe est marquée dissoute (conservée), ses membres « Disponible »
    'EQUIPES/DISSOUDRE'(etat, { id, horodatage, evenement }) {
        const equipe = etat.teams.find(t => t.id === id);
        if (!equipe) return etat;
        const teams = etat.teams.map(t => t.id !== id ? t : {
            ...t, status: 'dissolved', dissolvedAt: horodatage,
            history: [...(t.history || []), { timestamp: horodatage, action: 'dissolution', details: {} }],
        });
        return {
            ...etat, teams,
            planning: affecterAuCreneauActuel(etat, equipe.members, horodatage, 'disponible'),
            events: evenement ? [...etat.events, evenement] : etat.events,
        };
    },

    // Annule une fin de mission : l'équipe redevient active, ses membres « Engagé »
    'EQUIPES/REACTIVER'(etat, { id, horodatage, evenement }) {
        const equipe = etat.teams.find(t => t.id === id);
        if (!equipe) return etat;
        const teams = etat.teams.map(t => t.id !== id ? t : {
            ...t, status: 'active', dissolvedAt: null,
            history: [...(t.history || []), { timestamp: horodatage, action: 'reactivation', details: {} }],
        });
        // (pas de limite de fin de planning ici, comme avant)
        const slot = indexCreneau(etat, horodatage);
        const planning = { ...etat.planning };
        if (slot >= 0) equipe.members.forEach(m => { if (planning[m]) { const r = [...planning[m]]; r[slot] = 'engage'; planning[m] = r; } });
        return { ...etat, teams, planning, events: [...etat.events, evenement] };
    },

    // Ajout de membres : ils quittent leur ancienne équipe ; « Engagé » (ou « Gestion ») au créneau actuel
    'EQUIPES/AJOUTER_MEMBRES'(etat, { id, membres, horodatage, evenement }) {
        const equipe = etat.teams.find(t => t.id === id);
        if (!equipe || equipe.status === 'dissolved') refuser("Cette équipe n'existe plus ou a terminé sa mission (modifiée sur un autre poste ?).");
        const teams = etat.teams.map(t => {
            if (t.id === id) {
                return {
                    ...t, members: [...t.members, ...membres],
                    history: [...(t.history || []), { timestamp: horodatage, action: 'ajout_membres', details: { membres: nomsSauveteurs(etat, membres) } }],
                };
            }
            return t.members.some(m => membres.includes(m)) ? { ...t, members: t.members.filter(m => !membres.includes(m)) } : t;
        });
        const activite = equipe && equipe.mission.toLowerCase().includes('gestion') ? 'gestion' : 'engage';
        return {
            ...etat, teams,
            planning: affecterAuCreneauActuel(etat, membres, horodatage, activite),
            events: [...etat.events, evenement],
        };
    },

    // Membre libéré vers le PC : « Disponible » au créneau actuel ; une équipe vidée disparaît
    'EQUIPES/LIBERER_MEMBRE'(etat, { idEquipe, idMembre, horodatage, evenement }) {
        const nom = nomsSauveteurs(etat, [idMembre])[0];
        const teams = etat.teams.map(t => t.id !== idEquipe ? t : {
            ...t, members: t.members.filter(m => m !== idMembre),
            history: [...(t.history || []), { timestamp: horodatage, action: 'retrait_membre', details: { membre: nom, destination: 'PC' } }],
        }).filter(t => t.members.length > 0);
        return {
            ...etat, teams,
            planning: affecterAuCreneauActuel(etat, [idMembre], horodatage, 'disponible'),
            events: evenement ? [...etat.events, evenement] : etat.events,
        };
    },

    // Membre déplacé d'une équipe à une autre ; une équipe vidée disparaît
    'EQUIPES/DEPLACER_MEMBRE'(etat, { idOrigine, idDestination, idMembre, horodatage, evenement }) {
        const nom = nomsSauveteurs(etat, [idMembre])[0];
        const origine = etat.teams.find(t => t.id === idOrigine);
        const destination = etat.teams.find(t => t.id === idDestination);
        if (!origine || !destination) refuser("L'équipe d'origine ou de destination n'existe plus (modifiée sur un autre poste ?).");
        const teams = etat.teams.map(t => {
            if (t.id === idOrigine) return {
                ...t, members: t.members.filter(m => m !== idMembre),
                history: [...(t.history || []), { timestamp: horodatage, action: 'retrait_membre', details: { membre: nom, destination: destination.name } }],
            };
            if (t.id === idDestination) return {
                ...t, members: [...t.members, idMembre],
                history: [...(t.history || []), { timestamp: horodatage, action: 'ajout_membres', details: { membres: [nom], origine: origine.name } }],
            };
            return t;
        }).filter(t => t.members.length > 0);
        return { ...etat, teams, events: evenement ? [...etat.events, evenement] : etat.events };
    },

    // Nouvel ordre des membres (le premier est le chef). changementChef : un membre a été
    // glissé en première position (seul cas enregistré dans l'historique, comme avant)
    'EQUIPES/REORDONNER_MEMBRES'(etat, { id, membres, changementChef, horodatage, evenement }) {
        const teams = etat.teams.map(t => {
            if (t.id !== id) return t;
            const equipe = { ...t, members: membres };
            if (changementChef) {
                equipe.history = [...(t.history || []), {
                    timestamp: horodatage, action: 'changement_chef',
                    details: { ancien_chef: nomsSauveteurs(etat, [t.members[0]])[0], nouveau_chef: nomsSauveteurs(etat, [membres[0]])[0] },
                }];
            }
            return equipe;
        });
        return { ...etat, teams, events: evenement ? [...etat.events, evenement] : etat.events };
    },

    // Scission : les membres détachés forment la nouvelle équipe
    'EQUIPES/SCINDER'(etat, { idSource, nouvelleEquipe, evenements }) {
        if (!etat.teams.some(t => t.id === idSource)) refuser("L'équipe à scinder n'existe plus (modifiée sur un autre poste ?).");
        if (etat.teams.some(t => t.id === nouvelleEquipe.id || t.name === nouvelleEquipe.name)) refuser(`« ${nouvelleEquipe.name} » existe déjà (créée sur un autre poste ?).`);
        const teams = etat.teams
            .map(t => t.id === idSource ? { ...t, members: t.members.filter(m => !nouvelleEquipe.members.includes(m)) } : t)
            .concat([nouvelleEquipe]);
        return { ...etat, teams, events: [...etat.events, ...evenements] };
    },

    // ===== Dossier =====

    // Chargement d'un dossier (ouverture, réouverture, import complet, restauration d'une
    // sauvegarde) : les données fournies remplacent celles en cours, les autres sont gardées
    'DOSSIER/CHARGER'(etat, { valeurs }) {
        const nouveau = { ...etat };
        Object.keys(valeurs).forEach(cle => {
            if (!CLES_DONNEES.includes(cle)) throw new Error(`Donnée inconnue : ${cle}`);
            nouveau[cle] = valeurs[cle];
        });
        return nouveau;
    },

    // Remise à zéro (maintenance, remise à blanc) : valeurs vides fournies par l'appelant
    'DOSSIER/REINITIALISER'(etat, { valeurs }) {
        return ACTIONS_DONNEES['DOSSIER/CHARGER'](etat, { valeurs });
    },

    // ===== Secours =====

    'SECOURS/DEFINIR_INFOS'(etat, { missionInfo }) {
        return { ...etat, missionInfo };
    },

    // Mode de la main courante (principale / secondaire et son identifiant)
    'SECOURS/CONFIGURER_MC'(etat, { mode, identifiant, recopie }) {
        return { ...etat, mcMode: mode, mcIdentifiant: identifiant, mcConfigured: true, mcRecopie: recopie || null };
    },

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

};

// Version utilisée par l'écran d'un poste : une action renvoyée par le serveur a déjà été acceptée
// et s'applique sans erreur ; par sécurité, une erreur imprévue laisse l'écran intact.
const reducteurDonneesPoste = (etat, action) => {
    try { return reducteurDonnees(etat, action); }
    catch (e) { console.error('[donnees] action non appliquée sur ce poste :', action && action.type, e.message); return etat; }
};

const reducteurDonnees = (etat, action) => {
    const traiter = ACTIONS_DONNEES[action.type];
    if (!traiter) throw new Error(`Action inconnue : ${action.type}`);
    // Numéros des nouvelles lignes de main courante attribués ici (voir NUMERO_AUTO)
    return numeroterLignes(traiter(etat, action));
};

// ============================================
// PRÉPARATION DES ACTIONS (côté poste)
// ============================================
// Fonctions appelées par les écrans : elles ajoutent à l'action ce qui ne peut pas être
// calculé par la fonction pure (heure, identifiant) puis l'envoient au serveur.
// En réseau, c'est ici que l'action partira vers le serveur.
const creerActionsDonnees = (dispatch) => {
    // Une ligne de main courante : heure et identifiant (le numéro est attribué à l'application de l'action)
    const ligneMC = () => ({ horodatage: new Date().toISOString(), idEvenement: nouvelId() });
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
        recopierLigneMC: (evenement) => dispatch({ type: 'MC/RECOPIER', evenement }),
        ajouterLignesMC: (evenements) => dispatch({ type: 'MC/AJOUTER_PLUSIEURS', evenements }),
        modifierLigneMC: (id, champs, par) => dispatch({ type: 'MC/MODIFIER', id, champs, par, horodatage: new Date().toISOString() }),
        insererLigneMC: (evenement, idReference, avant) => dispatch({ type: 'MC/INSERER', evenement, idReference, avant }),
        validerRappel: (id, evenementValidation) => dispatch({ type: 'MC/VALIDER_RAPPEL', id, evenementValidation }),
        reporterRappel: (id, dateRappel, heureRappel) => dispatch({ type: 'MC/REPORTER_RAPPEL', id, dateRappel, heureRappel }),
        ajouterPresentsPointPhone: (id, mention) => dispatch({ type: 'MC/AJOUTER_PRESENTS_POINT_PHONE', id, mention }),
        importerMCSecondaire: (evenements) => dispatch({ type: 'MC/IMPORTER_SECONDAIRE', evenements }),
        importerEvenements: (evenements) => dispatch({ type: 'MC/IMPORTER_EVENEMENTS', evenements }),
        affecterPlanningDepuisMC: (evenement, ids, activite, slot) => dispatch({ type: 'PLANNING/AFFECTER_DEPUIS_MC', evenement, ids, activite, slot }),
        // Planning
        affecterPlanning: (cellules, activite, evenement) => dispatch({ type: 'PLANNING/AFFECTER', cellules, activite, evenement }),
        recopierPlanning: (copies) => dispatch({ type: 'PLANNING/RECOPIER', copies }),
        comblerCreneaux: (remplissages) => dispatch({ type: 'PLANNING/COMBLER_CRENEAUX', remplissages }),
        reglerDebutPlanning: (startHour) => dispatch({ type: 'PLANNING/REGLER_DEBUT', startHour }),
        reglerDureePlanning: (totalDays) => dispatch({ type: 'PLANNING/REGLER_DUREE', totalDays }),
        // Équipes (lignes de main courante construites par l'écran des équipes)
        creerEquipe: (equipe, horodatage, evenements) => dispatch({ type: 'EQUIPES/CREER', equipe, horodatage, evenements }),
        modifierEquipe: (id, champs, ancienneMission, evenement) => dispatch({ type: 'EQUIPES/MODIFIER', id, champs, ancienneMission, horodatage: new Date().toISOString(), evenement }),
        dissoudreEquipe: (id, horodatage, evenement) => dispatch({ type: 'EQUIPES/DISSOUDRE', id, horodatage, evenement }),
        reactiverEquipe: (id, horodatage, evenement) => dispatch({ type: 'EQUIPES/REACTIVER', id, horodatage, evenement }),
        ajouterMembresEquipe: (id, membres, horodatage, evenement) => dispatch({ type: 'EQUIPES/AJOUTER_MEMBRES', id, membres, horodatage, evenement }),
        libererMembre: (idEquipe, idMembre, horodatage, evenement) => dispatch({ type: 'EQUIPES/LIBERER_MEMBRE', idEquipe, idMembre, horodatage, evenement }),
        deplacerMembre: (idOrigine, idDestination, idMembre, horodatage, evenement) => dispatch({ type: 'EQUIPES/DEPLACER_MEMBRE', idOrigine, idDestination, idMembre, horodatage, evenement }),
        reordonnerMembres: (id, membres, changementChef, horodatage, evenement) => dispatch({ type: 'EQUIPES/REORDONNER_MEMBRES', id, membres, changementChef, horodatage, evenement }),
        scinderEquipe: (idSource, nouvelleEquipe, evenements) => dispatch({ type: 'EQUIPES/SCINDER', idSource, nouvelleEquipe, evenements }),
        // Dossier (les lignes de main courante chargées reçoivent des identifiants uniques)
        chargerDossier: (valeurs) => dispatch({ type: 'DOSSIER/CHARGER', valeurs: valeurs.events ? { ...valeurs, events: garantirIdsUniques(valeurs.events) } : valeurs }),
        reinitialiserDossier: (valeurs) => dispatch({ type: 'DOSSIER/REINITIALISER', valeurs }),
        // Secours
        definirInfosSecours: (missionInfo) => dispatch({ type: 'SECOURS/DEFINIR_INFOS', missionInfo }),
        configurerMC: (mode, identifiant, recopie = null) => dispatch({ type: 'SECOURS/CONFIGURER_MC', mode, identifiant, recopie }),
        cloturerSecours: (horodatageCloture, evenement) => dispatch({ type: 'SECOURS/CLOTURER', horodatageCloture, evenement }),
        rouvrirSecours: () => dispatch({ type: 'SECOURS/ROUVRIR' }),
        // Secrétaires
        ajouterSecretaire: (nom) => dispatch({ type: 'SECRETAIRES/AJOUTER', nom }),
        supprimerSecretaire: (nom) => dispatch({ type: 'SECRETAIRES/SUPPRIMER', nom }),
    };
};
