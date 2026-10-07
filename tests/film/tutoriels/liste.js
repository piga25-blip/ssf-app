// Films de formation : fichier du tutoriel (sans .js), titre, résumé du carton d'ouverture, groupe.
// Chaque groupe a sa numérotation et son propre film complet (indépendant des autres groupes).
const GROUPES = [
    { id: 'logiciel', serie: 'formation au logiciel', prefixe: '', filmComplet: 'Film complet 1 - Le logiciel SSF' },
    { id: 'reseau', serie: 'formation au mode réseau', prefixe: 'R', filmComplet: 'Film complet 2 - Le mode réseau' },
    { id: 'scenario', serie: 'scénario de formation', prefixe: 'S', filmComplet: 'Film complet 3 - Scénario de formation' },
];

const TUTORIELS = [
    ['00-demarrer', 'Démarrer un secours', "Créer le dossier d'un secours ou d'un exercice, choisir le mode d'utilisation, indiquer le secrétaire, corriger les informations du secours.", 'logiciel'],
    ['01-sauveteurs', 'Inscrire les sauveteurs', "Charger la liste préfectorale depuis un fichier CSV, ajouter un sauveteur qui n'est pas sur la liste, puis enregistrer les arrivées et les départs sur site.", 'logiciel'],
    ['02-points-phone', 'Inscrire les points phones', "Déclarer les points phones de la cavité (lettre, nom, type de lieu, position), les modifier ou les supprimer.", 'logiciel'],
    ['03-equipes', 'Gérer les équipes', "Créer une équipe, ajouter un membre, scinder l'équipe, déplacer un membre dans une autre équipe, terminer la mission.", 'logiciel'],
    ['04-progression', "Suivre la progression d'une équipe", "Du départ du PC à l'entrée sous terre, les passages aux points phones, la sortie et le retour au PC, jusqu'à la fin de mission.", 'logiciel'],
    ['05-main-courante', 'Tenir la main courante', "Enregistrer un événement avec toutes ses options, ajouter un événement oublié, modifier un événement, programmer un rappel, joindre un fichier, retrouver un événement.", 'logiciel'],
    ['06-planning', 'Le planning et les tableaux de synthèse', "Lire le planning, saisir une activité à la main, le mettre à jour, puis utiliser la synthèse des affectations et le tableau de bord.", 'logiciel'],
    ['07-sauvegarde-cloture', 'Sauvegarder, faire le rapport et clôturer', "Les sauvegardes automatiques, Exporter / Importer Tout, le rapport de fin de mission et la clôture du secours.", 'logiciel'],
    ['08-mode-reseau', 'Le mode réseau : connecter une tablette', "Ouvrir le secours aux autres postes du réseau local : activer le mode réseau, connecter une tablette avec le code de session, lui donner le droit de saisir, changer le code, et ce qui se passe si le réseau est coupé.", 'reseau'],
    ['09-plusieurs-postes', 'Plusieurs ordinateurs et tablettes en même temps', "Un PC principal, un second ordinateur et deux tablettes sur le même secours : un rôle par poste, des saisies simultanées sans doublon de numéro, des équipes créées sur deux postes, une progression suivie en direct, et les protections quand deux personnes modifient la même chose.", 'reseau'],
    ['10-pare-feu', 'Le pare-feu, réglé automatiquement', "Pourquoi le pare-feu du PC principal doit laisser passer les autres postes, comment l'application l'autorise elle-même à l'activation du mode réseau, que faire si l'autorisation disparaît, et la procédure manuelle en dernier recours.", 'reseau'],
    ["S1-ouverture", "Phase 1 — Alerte et ouverture du secours", "Ouvrir le dossier d'exercice, régler le poste (secrétaire, sauvegardes, plein écran), corriger les informations du secours et écrire les premières lignes de main courante.", 'scenario'],
    ["S2-sauveteurs", "Phase 2 — Arrivée des sauveteurs", "Charger la liste préfectorale (CSV), la rechercher, la trier, la corriger, ajouter un sauveteur hors liste et enregistrer les arrivées.", 'scenario'],
    ["S3-equipes", "Phase 3 — Points phones et premières équipes", "Décrire la cavité par ses points phones, créer quatre équipes (titre, ordre de mission, lieu, chef), imprimer et exporter.", 'scenario'],
    ["S4-progression", "Phase 4 — Progression et main courante", "Suivre les équipes de point phone en point phone avec le planning, et utiliser toutes les options d'une ligne : rappels, pièce jointe, correction, insertion, recherches, impression.", 'scenario'],
    ["S5-imprevus", "Phase 5 — Imprévus et mouvements d'équipes", "Traiter le rappel du SAMU, scinder une équipe, ajouter et déplacer des membres, changer de chef, ajouter un point phone, sortir de la cavité, partir hors site, terminer et réactiver des missions.", 'scenario'],
    ["S6-reseau", "Phase 6 — Mode réseau", "Ouvrir le secours à une tablette, régler son rôle, saisir à plusieurs, changer le code de session et vivre une coupure du réseau.", 'scenario'],
    ["S7-planning", "Phase 7 — Planning, synthèse et tableaux de bord", "Compléter le planning à la main (palette, repos, activité d'équipe, poignée de recopie), puis lire la synthèse, le tableau de bord et la progression des équipes.", 'scenario'],
    ["S8-fin", "Phase 8 — Fin de secours", "Évacuer la victime, recopier une main courante papier sur un PC de base arrière et la fusionner, sauvegarder, clôturer, rouvrir et sortir le rapport de fin de mission.", 'scenario'],
];

module.exports = { TUTORIELS, GROUPES };
