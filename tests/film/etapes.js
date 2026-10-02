// Scénarios filmés (ordre du film, titre et texte du carton) et libellés lisibles des étapes
// du scénario de référence (sous-titres du film)
const SCENARIOS = [
    ['scenario-reference', 'Scénario de secours de référence', 'Un secrétaire déroule un secours complet : dossier, sauveteurs, équipes, main courante, points phones, rappels, scission d\'équipe, clôture. L\'état final est comparé à la référence.'],
    ['verif-reouverture', 'Réouverture d\'un dossier clôturé', 'Le dossier est clôturé, l\'application redémarre, le dossier est rouvert : infos du secours et clôture sont conservées.'],
    ['verif-export-import', 'Exporter Tout / Importer Tout', 'Export complet d\'un secours, puis import d\'une version modifiée : les numéros du fichier sont bien repris.'],
    ['verif-identifiants', 'Identifiants uniques des événements', 'Un ancien dossier contenant des identifiants en double est réparé à la réouverture ; chaque événement a un identifiant unique.'],
    ['verif-copies-perimees', 'Données arrivées pendant une action', 'Une donnée arrive d\'un autre poste pendant une fenêtre de confirmation : elle n\'est plus effacée, pas de numéro en double.'],
    ['verif-reprise', 'Reprise des secours des versions précédentes', 'Les secours enregistrés par la version 13 sont repris automatiquement au premier lancement, une seule fois.'],
    ['verif-reseau', 'Mode réseau et poste en consultation', 'Le poste principal active le mode réseau ; un autre poste se connecte, voit les saisies en direct mais ne peut rien modifier.'],
    ['verif-version', 'Contrôle de version des autres postes', 'Après une mise à jour du poste principal, les autres postes se reconnectent et demandent de recharger la page.'],
    ['verif-precompilation', 'Interface précompilée pour les tablettes', 'Le serveur prépare l\'interface à l\'avance : elle s\'ouvre plus vite sur les autres postes.'],
    ['verif-saisie-multiposte', 'Saisie sur plusieurs postes', 'Trois postes saisissent en même temps : numéros de main courante uniques et dans l\'ordre, actions réservées au poste principal refusées ailleurs.'],
    ['verif-conflits-multiposte', 'Conflits entre postes', 'Deux postes font la même action au même instant : une seule est retenue, l\'autre reçoit un refus explicite ; avertissements « modifié entre-temps ».'],
    ['verif-session', 'Code de session, rôles, hors connexion', 'Code de session à 6 chiffres, rôle réglé poste par poste, changement de code, saisie bloquée hors connexion.'],
    ['verif-recopie-papier', 'Recopie d\'une main courante papier', 'PC Base Arrière : les lignes d\'une main courante papier sont recopiées avec leur date et heure d\'origine et rangées à leur place.'],
];

const ETAPES = {
    'demarrage': 'Démarrage de l\'application', 'nouveau-dossier': 'Création du dossier de secours', 'mode-pc-terrain': 'Choix du mode PC de Terrain',
    'liste-prefectorale': 'Liste préfectorale des sauveteurs', 'arrivee-sauveteurs': 'Arrivée des sauveteurs', 'points-phone': 'Points phones',
    'creation-equipe-1': 'Création de l\'équipe 1', 'mc-message-simple': 'Main courante : message simple', 'mc-depart-equipe-1': 'Main courante : départ de l\'équipe 1',
    'mc-rappel': 'Main courante : message avec rappel', 'alerte-rappel': 'Alerte de rappel', 'creation-equipe-2': 'Création de l\'équipe 2',
    'mc-depart-equipe-2-surface': 'Départ de l\'équipe 2 (surface)', 'arrivee-tardive': 'Arrivée tardive d\'un sauveteur', 'ajout-membre-equipe-2': 'Ajout d\'un membre à l\'équipe 2',
    'scission-equipe-1': 'Scission de l\'équipe 1', 'fin-de-mission-equipe-2': 'Fin de mission de l\'équipe 2', 'mc-retour-equipe-1': 'Retour de l\'équipe 1',
    'correction-evenement': 'Correction d\'un événement', 'depart-sauveteur': 'Départ d\'un sauveteur', 'planning-grille': 'Planning : grille',
    'planning-poignee-recopie': 'Planning : recopie par poignée', 'modification-point-phone': 'Modification d\'un point phone', 'cloture': 'Clôture du secours',
};

module.exports = { SCENARIOS, ETAPES };
