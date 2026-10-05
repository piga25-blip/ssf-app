// Films de formation : fichier du tutoriel (sans .js), titre, résumé du carton d'ouverture, groupe.
// Chaque groupe a sa numérotation et son propre film complet (indépendant des autres groupes).
const GROUPES = [
    { id: 'logiciel', serie: 'formation au logiciel', prefixe: '', filmComplet: 'Film complet 1 - Le logiciel SSF' },
    { id: 'reseau', serie: 'formation au mode réseau', prefixe: 'R', filmComplet: 'Film complet 2 - Le mode réseau' },
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
];

module.exports = { TUTORIELS, GROUPES };
