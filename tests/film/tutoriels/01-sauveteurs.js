// Film 1 : inscrire les sauveteurs — liste préfectorale importée d'un fichier CSV, sauveteur
// non inscrit sur la liste, arrivée sur site, départ.
const path = require('path');
const { executer } = require('./outils');
const { creerDossier } = require('./preparation');

executer('01-sauveteurs', 'Inscrire les sauveteurs', async (t) => {
    const p = t.page;
    await creerDossier(t);
    await t.debutFilm();

    await t.chapitre('La liste préfectorale');
    await t.dire('Avant l\'arrivée des sauveteurs, on charge la liste préfectorale : la liste des sauveteurs agréés du département, fournie par le CTDS ou la préfecture.',
        'Elle évite de ressaisir chaque nom le jour du secours : il suffira de cocher les personnes qui se présentent.');
    await t.clic(t.bouton('Liste Préfectorale'));
    await t.dire('La fenêtre « Gestion Liste Préfectorale » est vide pour l\'instant. Le bouton violet « Importer CSV » charge toute la liste en une fois.');

    await t.chapitre('Importer la liste depuis un fichier CSV');
    await t.dire('Le fichier CSV contient une ligne par sauveteur, avec 4 colonnes séparées par des POINTS-VIRGULES : identifiant ; NOM Prénom ; rôle ; SSF. La première ligne (titres des colonnes) est ignorée.',
        'Attention : l\'écran indique « ID,Nom Prénom,Rôle,SSF » avec des virgules, mais seul le point-virgule fonctionne. C\'est le format par défaut d\'Excel en français (« CSV séparateur point-virgule »).');
    await t.dire('Exemple de ligne :  34-001;MARTIN Alice;Chef d\'équipe;34');
    await t.fichier(p.locator('label:visible', { hasText: 'Importer CSV' }), p.locator('input[type="file"][accept=".csv,.txt"]'), path.join(__dirname, 'liste-prefectorale-exemple.csv'));
    await t.dire('L\'application confirme le nombre de sauveteurs importés. Ils apparaissent dans la liste complète, en bas de la fenêtre.');
    await p.locator('h3:visible', { hasText: 'Liste complète' }).scrollIntoViewIfNeeded();
    await t.rythme(3);
    await t.dire('La recherche rapide retrouve un sauveteur par son nom, son identifiant, son rôle ou son SSF.');
    await t.saisir(t.champ('🔍 Recherche rapide...'), 'dubois');
    await t.rythme(2);
    await t.saisir(t.champ('🔍 Recherche rapide...'), '');

    await t.chapitre('Ajouter un sauveteur qui n\'est pas sur la liste');
    await t.dire('Un sauveteur se présente mais il n\'est pas sur la liste préfectorale (renfort d\'un autre département, nouveau membre…). On l\'ajoute à la main en haut de la fenêtre.',
        'Tout sauveteur engagé doit être inscrit : c\'est ce qui permet de le placer dans une équipe, au planning, et de savoir à tout moment qui est sur site.');
    await p.locator('h3:visible', { hasText: 'Ajouter un sauveteur' }).scrollIntoViewIfNeeded();
    await t.dire('Le premier champ (identifiant) peut rester vide : l\'application attribue automatiquement un numéro EXT-001, EXT-002… qui signale un sauveteur ajouté hors liste.');
    await t.saisir(t.champ('NOM'), 'GARNIER');
    await t.saisir(t.champ('Prénom'), 'Inès');
    await t.saisir(t.champ('Rôle'), 'Secouriste');
    await t.saisir(t.champ('SSF / Service'), '07');
    await t.clic(t.bouton('+ Ajouter'));
    await t.dire('GARNIER Inès est ajoutée avec l\'identifiant EXT-001. Seuls le NOM et le prénom sont obligatoires ; sans rôle, « Secouriste » est mis par défaut.');
    await t.saisir(t.champ('🔍 Recherche rapide...'), 'EXT');
    await t.rythme(2.5);
    await t.saisir(t.champ('🔍 Recherche rapide...'), '');
    await t.dire('Le crayon ✏️ d\'une ligne permet de corriger un sauveteur, la corbeille de le retirer de la liste (impossible s\'il est déjà au planning).');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Enregistrer l\'arrivée des sauveteurs sur site');
    await t.dire('Être sur la liste ne veut pas dire être présent. Quand un sauveteur arrive au PC, on enregistre son arrivée.',
        'Seuls les sauveteurs « sur site » apparaissent au planning et peuvent être mis dans une équipe.');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.dire('À gauche : la liste préfectorale. On coche les sauveteurs qui viennent d\'arriver, puis « Arrivée ».');
    for (const nom of ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'GARNIER Inès']) {
        await t.cocher(t.etiquette(nom).locator('input[type="checkbox"]'));
    }
    await t.clic(t.bouton('Arrivée'));
    await t.dire('Ils passent dans la colonne « Sur site », avec un numéro d\'ordre d\'arrivée (N°1, N°2…) qui sera leur numéro au planning.');
    await t.rythme(2);

    await t.chapitre('Enregistrer un départ');
    await t.dire('Quand un sauveteur quitte le site (fin de participation, relève), on le coche dans la colonne « Sur site » puis « Départ ».',
        'Il disparaît du planning à partir de cet instant : la liste des présents reste juste, ce qui compte pour la sécurité et pour le rapport de fin de mission.');
    await t.cocher(p.locator('label:visible', { hasText: 'THOMAS David' }).last().locator('input[type="checkbox"]'));
    await t.clic(t.bouton('Départ'));
    await t.dire('THOMAS David est revenu dans la liste préfectorale : s\'il revient plus tard, il suffira d\'enregistrer à nouveau son arrivée.');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await t.dire('Les sauveteurs présents sont maintenant visibles dans l\'onglet « Planning Opérationnel ».');
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.rythme(4);
});
