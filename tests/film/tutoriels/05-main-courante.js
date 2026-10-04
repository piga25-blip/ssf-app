// Film 5 : la main courante — enregistrer un événement (toutes les options), événement
// oublié (insertion après / avant le premier), modification et historique, rappel,
// pièce jointe, recherche.
const path = require('path');
const { executer } = require('./outils');
const P = require('./preparation');

executer('05-main-courante', 'Tenir la main courante', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé']);
    await P.pointsPhone(t);
    await t.debutFilm();

    const enregistrer = () => t.clic(t.bouton(/^✓ ENREGISTRER$/));
    const ligne = (texte) => p.locator('tr:visible', { hasText: texte }).first();

    await t.chapitre('Enregistrer un événement simple');
    await t.dire('La main courante est le journal officiel du secours : tout ce qui se dit et se décide y est écrit, avec l\'heure et le nom du secrétaire.',
        'Elle sert pendant le secours (qui a dit quoi, quand) et après (rapport, enquête). Une ligne n\'est jamais effacée : on la corrige, et la correction est tracée.');
    await t.dire('Le secrétaire est déjà renseigné (Claire VIDAL) : il est mémorisé. Le bouton 🔄 à côté permet de changer de secrétaire lors d\'une relève.');
    await t.saisir(t.champ('Description...'), 'Point de situation : 3 sauveteurs sur site, attente du matériel de pompage.');
    await t.dire('La catégorie est souvent détectée automatiquement d\'après les mots tapés (« Auto »). On peut toujours la choisir dans la liste.',
        'Les catégories permettent ensuite de filtrer la main courante (ex. : tous les messages « Communication »).');
    await enregistrer();
    await t.dire('La ligne apparaît dans le tableau avec son numéro (002 : la ligne 001 a été écrite automatiquement à l\'arrivée des sauveteurs), l\'heure et le secrétaire. Le « Prochain numéro » est affiché à côté du bouton Imprimer.');

    await t.chapitre('Message reçu ou transmis, message important');
    await t.dire('Pour un message échangé avec quelqu\'un, on remplit « Message venant de » et/ou « Message à destination de ».',
        'La ligne indiquera « Message de : … pour : … » : on sait qui a parlé à qui.');
    await t.saisir(t.champ('Nom...', 1), 'COS - Commandant BRUN');
    await t.saisir(t.champ('Nom...', 0), 'Préfecture');
    await t.saisir(t.champ('Description...'), 'Demande de point de situation toutes les heures.');
    await t.dire('La case « ⚠️ Important » signale un message essentiel : il ressort en couleur dans le tableau et dans les filtres.');
    await t.cocher(p.locator('label:visible', { hasText: 'Important' }).first().locator('input[type="checkbox"]'));
    await enregistrer();
    await t.rythme(2);

    await t.chapitre('Un rappel à heure fixe');
    await t.dire('Une chose à faire plus tard (rappeler quelqu\'un, vérifier une équipe) ? On remplit la date et l\'heure de rappel.',
        'À l\'heure dite, l\'application affiche une alerte : rien n\'est oublié, même en pleine activité.');
    await t.saisir(t.champ('Description...'), 'Rappeler Météo France pour le bulletin orages.');
    await t.saisir(p.locator('input[type="date"]:visible').first(), '14032026', { iso: '2026-03-14' });
    await t.saisir(p.locator('input[type="time"]:visible').first(), '0815', { iso: '08:15' });
    await t.dire('L\'application rappelle de choisir une catégorie quand elle n\'en a pas détecté : ici, « Communication ».');
    await t.choisir(p.locator('select:visible', { has: p.locator('option[value="communication"]') }).first(), 'communication');
    await enregistrer();
    await t.avancer(16, 'Le temps passe… À 08 h 15, l\'alerte se déclenche.');
    await t.dire('La fenêtre « Alertes en attente » s\'ouvre. « Report 5 mn » repousse le rappel ; « ✓ Traité » le valide.');
    const traite = p.locator('button:visible', { hasText: 'Traité' }).last();
    if (await traite.count()) await t.clic(traite);
    else await t.clic(ligne('Rappeler Météo France').locator('button', { hasText: 'Valider' }));
    await t.dire('Le rappel est marqué comme réalisé ✓, et une ligne de validation est ajoutée à la main courante.');

    await t.chapitre('Joindre un fichier');
    await t.dire('Une photo, un croquis, un message écrit ? « Pièce jointe » permet de joindre un fichier à la ligne.');
    await t.saisir(t.champ('Description...'), 'Croquis du P40 transmis par l\'équipe de reconnaissance.');
    await t.fichier(p.locator('input[type="file"]:visible').first(), p.locator('input[type="file"]:visible').first(), path.join(__dirname, 'croquis-P40.png'));
    await enregistrer();
    await t.dire('Le trombone 📎 dans la colonne « Fichier » permet de rouvrir le fichier joint.');
    await t.rythme(2);

    await t.chapitre('Ajouter un événement oublié');
    await t.dire('On s\'aperçoit qu\'un appel reçu juste après la ligne 002 n\'a pas été noté. Le bouton ➕ d\'une ligne insère un événement JUSTE APRÈS elle.',
        'L\'événement oublié se range à sa vraie place dans la chronologie, sans renuméroter les lignes existantes (leurs numéros ont pu être communiqués).');
    await p.locator('table:visible').first().scrollIntoViewIfNeeded();
    await t.clic(ligne('Point de situation : 3 sauveteurs').locator('button[title="Insérer un événement après celui-ci"]'));
    const fenetreInsertion = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Insérer un événement' }) }).last();
    await t.dire('L\'heure est attribuée automatiquement (entre les deux lignes voisines). Si l\'on connaît l\'heure exacte, on la saisit dans « Horodatage manuel ».');
    await t.saisir(fenetreInsertion.locator('textarea').first(), 'Appel du maire de Lanville : salle des fêtes disponible pour l\'accueil des familles.');
    await t.clic(fenetreInsertion.locator('button', { hasText: 'Insérer l\'événement' }));
    await t.dire('La ligne insérée reçoit le numéro 002a : elle se place entre 002 et 003.');
    await t.rythme(3);
    await t.dire('Pour un événement survenu AVANT la toute première ligne, le bouton ⬆️➕ de la ligne 001 insère avant elle.');
    await t.viser(p.locator('button[title="Insérer un événement avant celui-ci (le tout premier événement)"]'));
    await t.rythme(2);

    await t.chapitre('Modifier un événement');
    await t.dire('Une faute, une information à préciser ? Le crayon ✏️ de la ligne ouvre la modification.',
        'La version d\'origine est conservée : la ligne affiche « Corrigée par… » et l\'historique reste consultable. La main courante reste fiable.');
    await t.clic(ligne('Demande de point de situation').locator('button[title="Modifier cet événement"]'));
    const fenetreModif = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Modifier l\'événement' }) }).last();
    await t.completer(fenetreModif.locator('textarea').first(), ' Par téléphone, au cabinet du préfet.');
    await t.clic(t.bouton('💾 Enregistrer'));
    await t.dire('La ligne est corrigée et porte la mention « Corrigée par Claire VIDAL ». Un clic sur cette mention affiche la version précédente.');
    const corrigee = ligne('cabinet du préfet').locator('[title="Voir les versions précédentes"]');
    if (await corrigee.count()) await t.clic(corrigee);
    await t.rythme(3);

    await t.chapitre('Retrouver un événement');
    await t.dire('La recherche rapide, au-dessus du tableau, filtre instantanément par mot, secrétaire, équipe ou point phone.');
    await t.saisir(t.champ('Recherche rapide... (secrétaire, événement, équipe, point phone)'), 'météo');
    await t.rythme(3);
    await t.saisir(t.champ('Recherche rapide... (secrétaire, événement, équipe, point phone)'), '');
    await t.dire('« Recherche Avancée » ajoute des filtres : messages importants, rappels, catégories.');
    await p.evaluate(() => window.scrollTo(0, 0));
    await t.clic(t.bouton('Recherche Avancée'));
    await t.clic(t.bouton('Messages Importants'));
    await t.rythme(3);
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await t.dire('Enfin, « Imprimer main courante » produit la version papier, à joindre au rapport de fin de mission.');
    await t.viser(t.bouton('Imprimer main courante'));
    await t.rythme(3);
    if (process.env.FILM_RAPIDE) await t.decrire('05-main-courante-fin');
});
