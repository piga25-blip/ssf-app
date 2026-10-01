// ============================================
// VÉRIFICATION : actions nommées de donnees.js (lot 0, B1)
// ============================================
// Exécute la fonction réductrice DIRECTEMENT DANS NODE.JS, sans l'application ni navigateur :
// - preuve que donnees.js peut tourner tel quel sur un serveur (phase réseau) ;
// - chaque action est vérifiée, y compris celles que le scénario de référence ne parcourt pas ;
// - l'état reçu n'est jamais modifié (fonction pure).
//
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-actions.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.join(__dirname, '..');

// ---- Chargement de donnees.js dans un contexte isolé (comme sur un serveur)
// Dépendances : DEFAULT_TOTAL_DAYS, SLOTS_PER_DAY (constants.js) et getTotalSlots (utils.js)
const constantes = fs.readFileSync(path.join(RACINE, 'constants.js'), 'utf8');
const lire = (motif) => { const m = constantes.match(motif); if (!m) throw new Error('constante introuvable : ' + motif); return m[1]; };
const contexte = vm.createContext({ console });
vm.runInContext(`
    const DEFAULT_TOTAL_DAYS = ${lire(/const DEFAULT_TOTAL_DAYS = (\d+);/)};
    const SLOTS_PER_HOUR = ${lire(/const SLOTS_PER_HOUR = (\d+);/)};
    const SLOTS_PER_DAY = 24 * SLOTS_PER_HOUR;
    const getTotalSlots = (totalDays) => totalDays * SLOTS_PER_DAY;
`, contexte);
vm.runInContext(fs.readFileSync(path.join(RACINE, 'donnees.js'), 'utf8'), contexte, { filename: 'donnees.js' });
const { reducteurDonnees, etatInitialDonnees, ACTIONS_DONNEES } = vm.runInContext('({ reducteurDonnees, etatInitialDonnees, ACTIONS_DONNEES })', contexte);

// ---- Outils de test
let nbOk = 0, nbKo = 0;
const actionsTestees = new Set();
const verifier = (libelle, condition, detail) => {
    if (condition) nbOk++; else { nbKo++; console.log(`❌ ${libelle}${detail !== undefined ? ' — obtenu : ' + JSON.stringify(detail).slice(0, 300) : ''}`); }
};
// Applique une action et vérifie que l'état d'origine n'a pas été modifié
const appliquer = (etat, action) => {
    actionsTestees.add(action.type);
    const avant = JSON.stringify(etat);
    const apres = reducteurDonnees(etat, action);
    verifier(`${action.type} : état d'origine inchangé`, JSON.stringify(etat) === avant);
    return apres;
};
const iso = (h, m = 0) => new Date(2026, 2, 14, h, m, 0).toISOString();   // samedi 14 mars 2026, heure locale
const ligne = (id, numero, extra = {}) => ({ id, numero, isoTimestamp: iso(8), dateHeure: '14/03/2026 08:00:00', evenement: 'Ligne ' + numero, fait: false, ...extra });

// État de départ : planning commencé à 8 h, 3 sauveteurs dans la liste
const base = () => {
    let e = etatInitialDonnees(8);
    for (const [id, name] of [['S1', 'ALPHA Anne'], ['S2', 'BRAVO Bob'], ['S3', 'CHARLIE Carl']]) {
        e = appliquer(e, { type: 'SAUVETEURS/LISTE_AJOUTER', sauveteur: { id, name, role: 'Secouriste', SSF: '00' } });
    }
    return e;
};

// ===== Sauveteurs
{
    let e = base();
    verifier('Liste : 3 sauveteurs', e.masterSauveteursList.length === 3);
    e = appliquer(e, { type: 'SAUVETEURS/LISTE_AJOUTER', sauveteur: { id: 'S1', name: 'DOUBLON' } });
    verifier('Liste : identifiant déjà présent ignoré', e.masterSauveteursList.length === 3 && e.masterSauveteursList[0].name === 'ALPHA Anne');
    e = appliquer(e, { type: 'SAUVETEURS/LISTE_MODIFIER', id: 'S2', name: 'BRAVO Robert', role: 'Médecin', SSF: '30' });
    verifier('Liste : modification', e.masterSauveteursList[1].name === 'BRAVO Robert' && e.masterSauveteursList[1].SSF === '30');
    e = appliquer(e, { type: 'SAUVETEURS/LISTE_IMPORTER', sauveteurs: [{ id: 'S3', name: 'CHARLIE Importé' }, { id: 'S4', name: 'DELTA Dan' }] });
    verifier('Liste : import (remplace le même identifiant, ajoute les nouveaux)', e.masterSauveteursList.map(s => s.name).join('|') === 'ALPHA Anne|BRAVO Robert|CHARLIE Importé|DELTA Dan');

    e = appliquer(e, { type: 'SAUVETEURS/ARRIVEE', ids: ['S1', 'S2'], horodatage: iso(10, 20), idEvenement: 'ev1', numero: 1 });
    verifier('Arrivée : sauveteurs actifs', JSON.stringify(e.activeSauveteurIds) === '["S1","S2"]');
    verifier('Arrivée : n° permanents 1 et 2', e.sauveteurPermanentNumbers.S1 === 1 && e.sauveteurPermanentNumbers.S2 === 2 && e.nextPermanentNumber === 3);
    verifier('Arrivée : « disponible » au créneau 10 h 15 (n° 9)', e.planning.S1[9] === 'disponible' && e.planning.S1[8] === 'nondef', e.planning.S1.slice(7, 11));
    verifier('Arrivée : ligne groupée', e.events.length === 1 && e.events[0].evenement === 'Arrivée de : ALPHA Anne, BRAVO Robert' && e.events[0].numero === '001' && e.events[0].secretaire === 'Système');

    e = appliquer(e, { type: 'SAUVETEURS/LISTE_SUPPRIMER_INACTIFS' });
    verifier('Liste : suppression des inactifs', e.masterSauveteursList.map(s => s.id).join('|') === 'S1|S2');
    e = appliquer(e, { type: 'SAUVETEURS/LISTE_SUPPRIMER', id: 'S2' });
    verifier('Liste : suppression', e.masterSauveteursList.length === 1);

    // Départ : retiré des équipes (équipe vide conservée), créneaux vides comblés, « quitter le secours »
    let d = base();
    d = appliquer(d, { type: 'SAUVETEURS/ARRIVEE', ids: ['S1'], horodatage: iso(9), idEvenement: 'a', numero: 1 });
    d = { ...d, teams: [{ id: 'T1', name: 'Équipe 1', members: ['S1'], status: 'active' }] };
    d = appliquer(d, { type: 'SAUVETEURS/DEPART', ids: ['S1'], horodatage: iso(10), idEvenement: 'b', numero: 2 });
    verifier('Départ : retiré de l\'équipe, équipe vide conservée', d.teams.length === 1 && d.teams[0].members.length === 0);
    verifier('Départ : créneaux 9 h–10 h comblés puis « quitter_secours » à 10 h', d.planning.S1.slice(4, 9).join(',') === 'disponible,disponible,disponible,disponible,quitter_secours', d.planning.S1.slice(4, 9));
    verifier('Départ : ligne de main courante', d.events[1].evenement === 'Départ de : ALPHA Anne' && d.events[1].numero === '002');

    // Retour sur site d'un sauveteur déjà venu : garde son n° permanent
    d = appliquer(d, { type: 'SAUVETEURS/ARRIVEE', ids: ['S1'], horodatage: iso(11), idEvenement: 'c', numero: 3 });
    verifier('Retour sur site : même n° permanent, « disponible » à 11 h', d.sauveteurPermanentNumbers.S1 === 1 && d.nextPermanentNumber === 2 && d.planning.S1[12] === 'disponible');

    // Main courante secondaire : préfixe et libellé
    let s = { ...base(), mcMode: 'secondaire', mcIdentifiant: 'B' };
    s = appliquer(s, { type: 'SAUVETEURS/ARRIVEE', ids: ['S3'], horodatage: iso(10), idEvenement: 'x', numero: 7 });
    verifier('Arrivée en MC secondaire : « Sauveteurs requis », numéro B-001 attribué', s.events[0].evenement === 'Sauveteurs requis : CHARLIE Carl' && s.events[0].numero === 'B-001' && s.nextEventNumber === 2);

    // Numérotation à l'application des actions (lot 2) : marqueurs NUMERO_AUTO
    const { NUMERO_AUTO, NUMERO_AUTO_SANS_PREFIXE } = vm.runInContext('({ NUMERO_AUTO, NUMERO_AUTO_SANS_PREFIXE })', contexte);
    let q = { ...base(), mcMode: 'secondaire', mcIdentifiant: 'C', nextEventNumber: 5 };
    q = appliquer(q, { type: 'MC/AJOUTER', evenement: ligne('n1', NUMERO_AUTO) });
    q = appliquer(q, { type: 'MC/AJOUTER_PLUSIEURS', evenements: [ligne('n2', NUMERO_AUTO_SANS_PREFIXE), ligne('n3', NUMERO_AUTO)] });
    q = appliquer(q, { type: 'MC/INSERER', evenement: ligne('n4', '005.1'), idReference: 'n1', avant: false });
    verifier('Numéros attribués dans l\'ordre (préfixe ou non), numéro d\'insertion conservé', q.events.map(e => e.numero).join('|') === 'C-005|005.1|006|C-007' && q.nextEventNumber === 8, q.events.map(e => e.numero));

    let n = { ...base(), activeSauveteurIds: ['S1', 'S2'], sauveteurPermanentNumbers: { S1: 4 }, nextPermanentNumber: 5 };
    n = appliquer(n, { type: 'SAUVETEURS/NUMEROTER_MANQUANTS' });
    verifier('N° permanents manquants attribués', n.sauveteurPermanentNumbers.S2 === 5 && n.nextPermanentNumber === 6);
    verifier('N° permanents : rien à faire → même état', reducteurDonnees(n, { type: 'SAUVETEURS/NUMEROTER_MANQUANTS' }) === n);
}

// ===== Points phones et secrétaires
{
    let e = base();
    e = appliquer(e, { type: 'POINTS_PHONE/AJOUTER', lettre: 'A', nom: 'Entrée', typePP: 'entree', ordreSaisi: '' });
    e = appliquer(e, { type: 'POINTS_PHONE/AJOUTER', lettre: 'B', nom: 'Puits', typePP: 'souterre', ordreSaisi: '2.5' });
    e = appliquer(e, { type: 'POINTS_PHONE/AJOUTER', lettre: 'A', nom: 'Doublon', typePP: 'surface', ordreSaisi: '' });
    verifier('Points phones : ajout (lettre déjà prise ignorée)', e.pointsPhone.map(p => p.lettre).join('|') === 'PC|A|B');
    verifier('Points phones : ordre automatique et saisi', e.pointsPhone[1].ordre === 1 && e.pointsPhone[2].ordre === 2.5 && e.pointsPhone[1].estEntree === true && e.pointsPhone[2].sousTerre === true);
    e = { ...e, events: [ligne('e1', '001', { pointPhone: 'B - Puits' }), ligne('e2', '002', { pointPhone: 'B' }), ligne('e3', '003', { pointPhone: 'A - Entrée' })] };
    e = appliquer(e, { type: 'POINTS_PHONE/MODIFIER', ancienneLettre: 'B', lettre: 'C', nom: 'Salle', typePP: 'souterre' });
    verifier('Points phones : modification (ordre conservé)', e.pointsPhone[2].lettre === 'C' && e.pointsPhone[2].ordre === 2.5);
    verifier('Points phones : lignes de main courante mises à jour', e.events.map(v => v.pointPhone).join('|') === 'C - Salle|C - Salle|A - Entrée');
    e = appliquer(e, { type: 'POINTS_PHONE/CHANGER_ORDRE', lettre: 'A', ordre: 7 });
    verifier('Points phones : changement d\'ordre', e.pointsPhone[1].ordre === 7);
    e = appliquer(e, { type: 'POINTS_PHONE/SUPPRIMER', lettre: 'A' });
    verifier('Points phones : suppression', e.pointsPhone.map(p => p.lettre).join('|') === 'PC|C');
    e = appliquer(e, { type: 'POINTS_PHONE/VIDER' });
    verifier('Points phones : vider (PC conservé)', e.pointsPhone.length === 1 && e.pointsPhone[0].lettre === 'PC');

    e = appliquer(e, { type: 'SECRETAIRES/AJOUTER', nom: 'Aline' });
    e = appliquer(e, { type: 'SECRETAIRES/AJOUTER', nom: 'Aline' });
    verifier('Secrétaires : ajout trié, sans doublon', e.secretaires.join('|') === 'Aline|Secrétaire 1|Secrétaire 2|Secrétaire 3');
    e = appliquer(e, { type: 'SECRETAIRES/SUPPRIMER', nom: 'Secrétaire 2' });
    verifier('Secrétaires : suppression', !e.secretaires.includes('Secrétaire 2'));
}

// ===== Main courante
{
    let e = { ...base(), events: [ligne('e1', '001', { dateRappel: '2026-03-14', heureRappel: '09:00' }), ligne('e2', '002')] };
    e = appliquer(e, { type: 'MC/AJOUTER', evenement: ligne('e3', '003') });
    e = appliquer(e, { type: 'MC/AJOUTER_PLUSIEURS', evenements: [ligne('e4', '004'), ligne('e5', '005')] });
    verifier('MC : ajout simple et multiple', e.events.map(v => v.id).join('|') === 'e1|e2|e3|e4|e5');
    e = appliquer(e, { type: 'MC/MODIFIER', id: 'e2', champs: { evenement: 'Corrigé', secretaire: 'Aline' } });
    verifier('MC : modification', e.events[1].evenement === 'Corrigé' && e.events[1].numero === '002');
    e = appliquer(e, { type: 'MC/INSERER', evenement: ligne('i1', '002.1'), idReference: 'e2', avant: false });
    e = appliquer(e, { type: 'MC/INSERER', evenement: ligne('i0', '000.1'), idReference: 'e1', avant: true });
    verifier('MC : insertion après et avant', e.events.map(v => v.id).join('|') === 'i0|e1|e2|i1|e3|e4|e5');
    e = appliquer(e, { type: 'MC/REPORTER_RAPPEL', id: 'e1', dateRappel: '2026-03-14', heureRappel: '09:05' });
    verifier('MC : report de rappel', e.events[1].heureRappel === '09:05');
    e = appliquer(e, { type: 'MC/VALIDER_RAPPEL', id: 'e1', evenementValidation: ligne('v1', '006') });
    verifier('MC : validation de rappel', e.events[1].fait === true && e.events[e.events.length - 1].id === 'v1');
    const nbAvant = e.events.length;
    e = appliquer(e, { type: 'MC/VALIDER_RAPPEL', id: 'e1', evenementValidation: ligne('v2', '007') });
    verifier('MC : rappel déjà validé → seconde validation ignorée (décision 8)', e.events.length === nbAvant && !e.events.some(x => x.id === 'v2'));
    // Historique des corrections (décision 9)
    let h = appliquer(e, { type: 'MC/MODIFIER', id: 'e3', champs: { evenement: 'Texte corrigé', destinataire: '', departDuPC: false }, par: 'Aline', horodatage: iso(10) });
    h = appliquer(h, { type: 'MC/MODIFIER', id: 'e3', champs: { evenement: 'Texte corrigé 2' }, par: 'Bob', horodatage: iso(11) });
    const e3 = h.events.find(x => x.id === 'e3');
    verifier('MC : historique des corrections (anciennes valeurs, auteur, heure ; champs vides ignorés)',
        e3.evenement === 'Texte corrigé 2' && e3.corrections.length === 2 && e3.corrections[0].avant.evenement === 'Ligne 003'
        && Object.keys(e3.corrections[0].avant).join() === 'evenement' && e3.corrections[1].par === 'Bob' && e3.corrections[1].le === iso(11), e3.corrections);
    const sansChangement = appliquer(h, { type: 'MC/MODIFIER', id: 'e3', champs: { evenement: 'Texte corrigé 2' }, par: 'Bob', horodatage: iso(12) });
    verifier('MC : modification sans changement → pas de nouvelle correction', sansChangement.events.find(x => x.id === 'e3').corrections.length === 2);
    e = appliquer(e, { type: 'MC/AJOUTER_PRESENTS_POINT_PHONE', id: 'e3', mention: 'Toute l\'équipe (Équipe 1)' });
    verifier('MC : présents au point phone', e.events.find(v => v.id === 'e3').evenement === 'Ligne 003\nPrésents au point phone : Toute l\'équipe (Équipe 1)');
    const r = appliquer({ ...e, nextEventNumber: 4 }, { type: 'MC/RESERVER_NUMEROS', jusqua: 9 });
    verifier('MC : réservation de numéros', r.nextEventNumber === 9 && reducteurDonnees(r, { type: 'MC/RESERVER_NUMEROS', jusqua: 5 }) === r);

    // Import d'une MC secondaire : tri par date/heure affichée, doublons d'identifiants, prochain numéro
    let m = { ...base(), nextEventNumber: 3, events: [
        { id: 'p1', numero: '001', dateHeure: '14/03/2026 08:00:00' },
        { id: 'p2', numero: '002', dateHeure: '14/03/2026 10:00:00' }] };
    m = appliquer(m, { type: 'MC/IMPORTER_SECONDAIRE', evenements: [
        { id: 'p1', numero: 'B-007', dateHeure: '14/03/2026 09:00:00' },
        { id: 's2', numero: 'B-008', dateHeure: '14/03/2026 11:00:00' }] });
    verifier('Import MC secondaire : fusion triée', m.events.map(v => v.numero).join('|') === '001|B-007|002|B-008');
    verifier('Import MC secondaire : identifiant en double renommé', m.events[1].id === 'p1~2' && new Set(m.events.map(v => v.id)).size === 4);
    verifier('Import MC secondaire : prochain numéro', m.nextEventNumber === 9);

    // Import d'événements : tri chronologique, lignes locales d'abord à égalité
    let i = { ...base(), events: [{ id: 'l1', isoTimestamp: iso(9), numero: '001' }, { id: 'l2', isoTimestamp: iso(11), numero: '002' }] };
    i = appliquer(i, { type: 'MC/IMPORTER_EVENEMENTS', evenements: [{ id: 'x1', isoTimestamp: iso(9), numero: 'A-001', importedFrom: 'A' }, { id: 'x2', isoTimestamp: iso(10), numero: 'A-002', importedFrom: 'A' }] });
    verifier('Import d\'événements : ordre chronologique', i.events.map(v => v.id).join('|') === 'l1|x1|x2|l2');
}

// ===== Planning
{
    let e = appliquer(base(), { type: 'SAUVETEURS/ARRIVEE', ids: ['S1', 'S2'], horodatage: iso(8), idEvenement: 'a', numero: 1 });
    e = appliquer(e, { type: 'PLANNING/AFFECTER', cellules: [{ id: 'S1', slot: 2 }, { id: 'S3', slot: 3 }], activite: 'souterre', evenement: null });
    verifier('Planning : activité posée (ligne créée si besoin)', e.planning.S1[2] === 'souterre' && e.planning.S3[3] === 'souterre' && e.planning.S3.length === 3 * 96);
    verifier('Planning : sans ligne de main courante', e.events.length === 1);
    e = appliquer(e, { type: 'PLANNING/AFFECTER', cellules: [{ id: 'S2', slot: 1 }], activite: 'repos_site', evenement: ligne('p', '002') });
    verifier('Planning : avec ligne de main courante', e.events.length === 2);
    e = appliquer(e, { type: 'PLANNING/RECOPIER', copies: [{ id: 'S2', slot: 5, idSource: 'S1', slotSource: 2 }, { id: 'S1', slot: 6, idSource: 'S2', slotSource: 1 }, { id: 'S1', slot: 7, idSource: 'INCONNU', slotSource: 0 }] });
    verifier('Planning : recopie (contenu d\'avant la recopie)', e.planning.S2[5] === 'souterre' && e.planning.S1[6] === 'repos_site' && e.planning.S1[7] === 'nondef');
    let c = { ...e, planning: { ...e.planning, S1: e.planning.S1.map((v, k) => k === 9 ? 'approche' : v) } };
    c = appliquer(c, { type: 'PLANNING/COMBLER_CRENEAUX', remplissages: [{ id: 'S1', activite: 'souterre', slotDebut: 7, slotFin: 10 }] });
    verifier('Planning : créneaux vides comblés, case remplie entre-temps conservée', c.planning.S1.slice(7, 11).join(',') === 'souterre,souterre,approche,souterre', c.planning.S1.slice(7, 11));
    c = appliquer(c, { type: 'PLANNING/REGLER_DEBUT', startHour: 6 });
    c = appliquer(c, { type: 'PLANNING/REGLER_DUREE', totalDays: 5 });
    verifier('Planning : réglages début et durée', c.startHour === 6 && c.totalDays === 5);

    // Depuis la main courante : créneaux vides précédents comblés, puis activité
    let p = appliquer(base(), { type: 'SAUVETEURS/ARRIVEE', ids: ['S1'], horodatage: iso(8), idEvenement: 'a', numero: 1 });
    p = appliquer(p, { type: 'PLANNING/AFFECTER_DEPUIS_MC', evenement: ligne('m', '002'), ids: ['S1', 'S9'], activite: 'souterre', slot: 3 });
    verifier('Planning depuis la MC : comblement + activité + ligne', p.planning.S1.slice(0, 4).join(',') === 'disponible,disponible,disponible,souterre' && p.events.length === 2);
}

// ===== Équipes
{
    let e = appliquer(base(), { type: 'SAUVETEURS/ARRIVEE', ids: ['S1', 'S2', 'S3'], horodatage: iso(8), idEvenement: 'a', numero: 1 });
    const equipe = (id, membres, mission = 'Reconnaissance') => ({ id, name: 'Équipe ' + id.slice(1), mission, members: membres, status: 'active', history: [] });
    e = appliquer(e, { type: 'EQUIPES/CREER', equipe: equipe('T1', ['S1', 'S2']), horodatage: iso(9), evenements: [ligne('c1', '002'), ligne('c2', '003')] });
    verifier('Équipes : création (+ numéro mémorisé, « engage », 2 lignes)', e.teams.length === 1 && e.usedTeamNumbers[0].numero === 'T1' && e.planning.S1[4] === 'engage' && e.events.length === 3);
    e = appliquer(e, { type: 'EQUIPES/CREER', equipe: equipe('T2', ['S2', 'S3'], 'Gestion PC'), horodatage: iso(9, 15), evenements: [] });
    verifier('Équipes : un membre quitte son ancienne équipe ; « gestion »', JSON.stringify(e.teams[0].members) === '["S1"]' && e.planning.S2[5] === 'gestion');
    e = appliquer(e, { type: 'EQUIPES/MODIFIER', id: 'T1', champs: { mission: 'Brancardage', ordreMission: 'Sortir la victime', typeMission: 'Brancardage', lieu: 'souterre' }, horodatage: iso(9, 30), ancienneMission: 'Reconnaissance', evenement: null });
    verifier('Équipes : modification + historique', e.teams[0].mission === 'Brancardage' && e.teams[0].history[0].details.ancienne_mission === 'Reconnaissance' && e.events.length === 3);
    e = appliquer(e, { type: 'EQUIPES/REORDONNER_MEMBRES', id: 'T2', membres: ['S3', 'S2'], changementChef: true, horodatage: iso(9, 45), evenement: ligne('r', '004') });
    verifier('Équipes : changement de chef', e.teams[1].members[0] === 'S3' && e.teams[1].history[0].details.nouveau_chef === 'CHARLIE Carl' && e.teams[1].history[0].details.ancien_chef === 'BRAVO Bob');
    e = appliquer(e, { type: 'EQUIPES/REORDONNER_MEMBRES', id: 'T2', membres: ['S3', 'S2'], changementChef: false, horodatage: iso(9, 50), evenement: null });
    verifier('Équipes : réordonner sans changement de chef → pas d\'historique', e.teams[1].history.length === 1);
    e = appliquer(e, { type: 'EQUIPES/AJOUTER_MEMBRES', id: 'T1', membres: ['S3'], horodatage: iso(10), evenement: ligne('am', '005') });
    verifier('Équipes : ajout de membre (retiré de son équipe)', JSON.stringify(e.teams[0].members) === '["S1","S3"]' && JSON.stringify(e.teams[1].members) === '["S2"]' && e.planning.S3[8] === 'engage');
    e = appliquer(e, { type: 'EQUIPES/DEPLACER_MEMBRE', idOrigine: 'T2', idDestination: 'T1', idMembre: 'S2', horodatage: iso(10, 15), evenement: null });
    verifier('Équipes : déplacement (équipe vidée supprimée)', e.teams.length === 1 && e.teams[0].members.includes('S2'));
    e = appliquer(e, { type: 'EQUIPES/LIBERER_MEMBRE', idEquipe: 'T1', idMembre: 'S3', horodatage: iso(10, 30), evenement: ligne('l', '006') });
    verifier('Équipes : libération vers le PC (« disponible »)', !e.teams[0].members.includes('S3') && e.planning.S3[10] === 'disponible');
    e = appliquer(e, { type: 'EQUIPES/SCINDER', idSource: 'T1', nouvelleEquipe: equipe('T1B', ['S2']), evenements: [ligne('s', '007')] });
    verifier('Équipes : scission', JSON.stringify(e.teams[0].members) === '["S1"]' && e.teams[1].id === 'T1B');
    e = appliquer(e, { type: 'EQUIPES/DISSOUDRE', id: 'T1', horodatage: iso(11), evenement: null });
    verifier('Équipes : fin de mission (conservée, « disponible »)', e.teams[0].status === 'dissolved' && e.teams[0].dissolvedAt === iso(11) && e.planning.S1[12] === 'disponible');
    e = appliquer(e, { type: 'EQUIPES/REACTIVER', id: 'T1', horodatage: iso(11, 15), evenement: ligne('ra', '008') });
    verifier('Équipes : réactivation (« engage »)', e.teams[0].status === 'active' && e.teams[0].dissolvedAt === null && e.planning.S1[13] === 'engage');
}

// ===== Dossier et secours
{
    let e = base();
    e = appliquer(e, { type: 'DOSSIER/CHARGER', valeurs: { events: [ligne('d1', '001')], nextEventNumber: 2, teams: [] } });
    verifier('Dossier : chargement (données fournies seulement)', e.events.length === 1 && e.nextEventNumber === 2 && e.masterSauveteursList.length === 3);
    let erreur = null;
    try { reducteurDonnees(e, { type: 'DOSSIER/CHARGER', valeurs: { inconnu: 1 } }); } catch (x) { erreur = x.message; }
    verifier('Dossier : donnée inconnue refusée', /Donnée inconnue/.test(erreur || ''));
    actionsTestees.add('DOSSIER/REINITIALISER');
    e = appliquer(e, { type: 'DOSSIER/REINITIALISER', valeurs: { masterSauveteursList: [], events: [], nextEventNumber: 1, startHour: 7 } });
    verifier('Dossier : remise à zéro', e.masterSauveteursList.length === 0 && e.events.length === 0 && e.startHour === 7);
    e = appliquer(e, { type: 'SECOURS/DEFINIR_INFOS', missionInfo: { typeSecours: 'exercice', nomCavite: 'Test', commune: 'Ici', delaiAlerteOccupation: 360 } });
    e = appliquer(e, { type: 'SECOURS/CONFIGURER_MC', mode: 'secondaire', identifiant: 'B' });
    verifier('Secours : infos et configuration MC', e.missionInfo.nomCavite === 'Test' && e.mcMode === 'secondaire' && e.mcIdentifiant === 'B' && e.mcConfigured === true);
    e = appliquer(e, { type: 'SECOURS/CLOTURER', horodatageCloture: iso(12), evenement: ligne('cl', 'B-001') });
    verifier('Secours : clôture', e.clotureInfo.isoTimestamp === iso(12) && /14\/03\/2026/.test(e.clotureInfo.dateHeure) && e.events.length === 1);
    e = appliquer(e, { type: 'SECOURS/ROUVRIR' });
    verifier('Secours : réouverture', e.clotureInfo === null);
    let erreur2 = null;
    try { reducteurDonnees(e, { type: 'ACTION/INEXISTANTE' }); } catch (x) { erreur2 = x.message; }
    verifier('Action inconnue refusée', /Action inconnue/.test(erreur2 || ''));
}

// ---- Toutes les actions doivent avoir été testées
const nonTestees = Object.keys(ACTIONS_DONNEES).filter(a => !actionsTestees.has(a));
verifier(`Toutes les actions sont testées (${Object.keys(ACTIONS_DONNEES).length})`, nonTestees.length === 0, nonTestees);

console.log(`${nbOk} contrôle(s) réussi(s), ${nbKo} échec(s), ${Object.keys(ACTIONS_DONNEES).length} actions nommées.`);
console.log(nbKo === 0 ? '\n✅ Actions nommées conformes (exécutées dans Node.js, hors application).' : '\n❌ Actions nommées non conformes.');
process.exitCode = nbKo === 0 ? 0 : 1;
