// Films de formation : ordre, fichier du tutoriel (sans .js), titre, résumé du carton d'ouverture
const TUTORIELS = [
    ['00-demarrer', 'Démarrer un secours', "Créer le dossier d'un secours ou d'un exercice, choisir le mode d'utilisation, indiquer le secrétaire, corriger les informations du secours."],
    ['01-sauveteurs', 'Inscrire les sauveteurs', "Charger la liste préfectorale depuis un fichier CSV, ajouter un sauveteur qui n'est pas sur la liste, puis enregistrer les arrivées et les départs sur site."],
    ['02-points-phone', 'Inscrire les points phones', "Déclarer les points phones de la cavité (lettre, nom, type de lieu, position), les modifier ou les supprimer."],
    ['03-equipes', 'Gérer les équipes', "Créer une équipe, ajouter un membre, scinder l'équipe, déplacer un membre dans une autre équipe, terminer la mission."],
    ['04-progression', "Suivre la progression d'une équipe", "Du départ du PC à l'entrée sous terre, les passages aux points phones, la sortie et le retour au PC, jusqu'à la fin de mission."],
    ['05-main-courante', 'Tenir la main courante', "Enregistrer un événement avec toutes ses options, ajouter un événement oublié, modifier un événement, programmer un rappel, joindre un fichier, retrouver un événement."],
    ['06-planning', 'Le planning et les tableaux de synthèse', "Lire le planning, saisir une activité à la main, le mettre à jour, puis utiliser la synthèse des affectations et le tableau de bord."],
    ['07-sauvegarde-cloture', 'Sauvegarder, faire le rapport et clôturer', "Les sauvegardes automatiques, Exporter / Importer Tout, le rapport de fin de mission et la clôture du secours."],
];

module.exports = { TUTORIELS };
