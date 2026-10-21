// Film 6 : la main courante — enregistrer un événement (et ce qui s'affiche), message important
// (texte mot pour mot), rappel, pièce jointe, événement oublié (après / avant le premier),
// modification et historique, recherche, impression (possible à tout moment).
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
    const ligne = (texte) => p.locator('tbody tr:visible', { hasText: texte }).first();
    const prochain = () => t.bouton(/Imprimer main courante/).locator('xpath=..').locator('strong');
    // Main courante : la ligne voulue entourée, puis l'explication
    const voirLigne = async (texte, explication, pourquoi) => {
        const l = ligne(texte);
        await l.scrollIntoViewIfNeeded();
        await t.viser(l);
        if (process.env.FILM_RAPIDE) console.log('MC ▸ ' + (await l.innerText()).replace(/\s+/g, ' '));
        await t.dire(explication, pourquoi);
    };
    const haut = () => p.evaluate(() => window.scrollTo(0, 0));

    await t.chapitre('Enregistrer un événement simple');
    await t.dire('La main courante est le journal officiel du secours : tout ce qui se dit et se décide y est écrit, avec l\'heure et le nom du secrétaire.',
        'Elle sert pendant le secours (qui a dit quoi, quand) et après (rapport, enquête). Une ligne n\'est jamais effacée : on la corrige, et la correction est tracée.');
    await t.viser(ligne('Arrivée de'));
    await t.dire('Le tableau contient déjà des lignes écrites automatiquement par l\'application, à l\'arrivée des sauveteurs (secrétaire « Système »).');
    await haut();
    await t.dire('Le secrétaire est déjà renseigné (Claire VIDAL) : il est mémorisé. Le bouton 🔄 à côté permet de changer de secrétaire lors d\'une relève.');
    await t.viser(prochain());
    await t.dire('Avant d\'enregistrer, « Prochain numéro » indique le numéro que recevra la ligne.');
    await haut();
    await t.saisir(t.champ('Description...'), 'Point de situation : 3 sauveteurs sur site, attente du matériel de pompage.');
    await t.dire('La catégorie est souvent détectée automatiquement d\'après les mots tapés (« Auto »). On peut toujours la choisir dans la liste.',
        'Les catégories permettent ensuite de filtrer la main courante (par exemple : tous les messages « Communication »).');
    await enregistrer();
    await voirLigne('Point de situation : 3 sauveteurs',
        'La ligne apparaît en haut du tableau : son numéro, la date et l\'heure d\'enregistrement, le secrétaire, la catégorie et le texte.',
        'Les lignes les plus récentes sont en haut. L\'heure est prise automatiquement : le secrétaire n\'a pas à la taper.');
    await t.viser(prochain());
    await t.dire('Le « Prochain numéro » est passé au suivant. Le formulaire est vidé, prêt pour la ligne suivante, et le secrétaire reste renseigné.');
    await haut();

    await t.chapitre('Message reçu ou transmis, message important');
    await t.dire('Pour un message échangé entre deux personnes, on remplit « Message venant de » et « Message à destination de ».',
        'La ligne indiquera « Message de : … pour : … » : on sait qui a parlé à qui. Avec les deux champs remplis, la catégorie est « Communication ».');
    await t.vite(async () => {
        await t.saisir(t.champ('Nom...', 1), 'COS - Commandant BRUN');
        await t.saisir(t.champ('Nom...', 0), 'Conseiller technique');
    });
    await t.dire('Le texte du message est écrit mot pour mot, tel qu\'il a été dit, sans le résumer ni l\'interpréter.',
        'En cas de litige ou d\'enquête, c\'est la parole exacte qui compte.');
    await t.saisir(t.champ('Description...'), 'Je veux un point de situation toutes les heures, le premier à 9 heures.');
    await t.dire('La case « ⚠️ Important » signale un message essentiel : il ressort en couleur dans le tableau et dans les filtres.');
    await t.cocher(p.locator('label:visible', { hasText: 'Important' }).first().locator('input[type="checkbox"]'));
    await enregistrer();
    await voirLigne('point de situation toutes les heures',
        'Le point d\'exclamation rouge, dans la colonne « Important », signale le message. On y lit l\'expéditeur, le destinataire et le texte exact, rangés en « Communication ».');
    await haut();

    await t.chapitre('Un rappel à heure fixe');
    await t.dire('Une chose à faire plus tard (rappeler quelqu\'un, vérifier une équipe) ? On remplit la date et l\'heure de rappel.',
        'À l\'heure dite, l\'application affiche une alerte : rien n\'est oublié, même en pleine activité.');
    await t.saisir(t.champ('Description...'), 'Rappeler Météo France pour le bulletin orages.');
    await t.vite(async () => {
        await t.saisir(p.locator('input[type="date"]:visible').first(), '14032026', { iso: '2026-03-14' });
        await t.saisir(p.locator('input[type="time"]:visible').first(), '0815', { iso: '08:15' });
    });
    await t.dire('L\'application rappelle de choisir une catégorie quand elle n\'en a pas détecté : ici, « Communication ».');
    await t.choisir(p.locator('select:visible', { has: p.locator('option[value="communication"]') }).first(), 'communication');
    await enregistrer();
    await voirLigne('Rappeler Météo France',
        'La ligne affiche l\'heure du rappel prévu : 08 h 15. Tant qu\'il n\'est pas traité, il reste en attente.');
    await t.avancer(16, 'Le temps passe… À 08 h 15, l\'alerte se déclenche.');
    await t.dire('La fenêtre « Alertes en attente » s\'ouvre. « Report 5 mn » repousse le rappel ; « ✓ Traité » le valide.');
    const traite = p.locator('button:visible', { hasText: 'Traité' }).last();
    if (await traite.count()) await t.clic(traite);
    else await t.clic(ligne('Rappeler Météo France').locator('button', { hasText: 'Valider' }));
    await voirLigne('Rappel N°',
        'Une ligne de validation est ajoutée à la main courante : on sait que le rappel a été traité, et à quelle heure.');
    await t.viser(ligne('RÉALISÉE'));
    await t.dire('La ligne du rappel passe en vert, avec la mention « Réalisée ».');
    await haut();

    await t.chapitre('Joindre un fichier');
    await t.dire('Une photo, un croquis, un message écrit ? « Pièce jointe » permet de joindre un fichier à la ligne.');
    await t.saisir(t.champ('Description...'), 'Croquis du P40 transmis par l\'équipe de reconnaissance.');
    await t.fichier(p.locator('input[type="file"]:visible').first(), p.locator('input[type="file"]:visible').first(), path.join(__dirname, 'croquis-P40.png'));
    await t.dire('Le nom du fichier choisi s\'affiche sous le bouton, avant l\'enregistrement.');
    await enregistrer();
    await voirLigne('Croquis du P40',
        'Le trombone 📎 dans la colonne « Fichier » permet de rouvrir le fichier joint. Il est enregistré avec le secours.');
    await t.rythme(1);

    await t.chapitre('Ajouter un événement oublié');
    await t.dire('On s\'aperçoit qu\'un appel reçu juste après le point de situation n\'a pas été noté. Le bouton ➕ d\'une ligne insère un événement juste après elle.',
        'L\'événement oublié se range à sa vraie place dans la chronologie, sans renuméroter les lignes existantes (leurs numéros ont pu être communiqués).');
    await t.clic(ligne('Point de situation : 3 sauveteurs').locator('button[title="Insérer un événement après celui-ci"]'));
    const fenetreInsertion = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Insérer un événement' }) }).last();
    await t.dire('L\'heure est attribuée automatiquement (entre les deux lignes voisines). Si l\'on connaît l\'heure exacte, on la saisit dans « Horodatage manuel ».');
    await t.saisir(fenetreInsertion.locator('textarea').first(), 'Appel du maire de Lanville : salle des fêtes disponible pour l\'accueil des familles.');
    await t.clic(fenetreInsertion.locator('button', { hasText: 'Insérer l\'événement' }));
    await voirLigne('Appel du maire de Lanville',
        'La ligne insérée reçoit un numéro avec une lettre : elle se place juste après la ligne choisie, à l\'heure voulue.');
    await t.dire('Pour un événement survenu avant la toute première ligne, le bouton ⬆️➕ de la première ligne insère avant elle.');
    await t.viser(p.locator('button[title="Insérer un événement avant celui-ci (le tout premier événement)"]'));
    await t.rythme(1.5);

    await t.chapitre('Modifier un événement');
    await t.dire('Une faute, un mot oublié ? Le crayon ✏️ de la ligne ouvre la modification. Ici, la fin du message du commandant n\'avait pas été notée.',
        'La version d\'origine est conservée : la ligne affiche « Corrigée par… » et l\'historique reste consultable. La main courante reste fiable.');
    await t.clic(ligne('point de situation toutes les heures').locator('button[title="Modifier cet événement"]'));
    const fenetreModif = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Modifier l\'événement' }) }).last();
    await t.completer(fenetreModif.locator('textarea').first(), ' Prévenez-moi si la météo change.');
    await t.clic(t.bouton('💾 Enregistrer'));
    await voirLigne('Prévenez-moi si la météo change',
        'La ligne est corrigée et porte la mention « Corrigée par Claire VIDAL ». Un clic sur cette mention affiche la version précédente.');
    const corrigee = ligne('Prévenez-moi si la météo change').locator('[title="Voir les versions précédentes"]');
    if (await corrigee.count()) {
        await t.clic(corrigee);
        await t.dire('Le texte d\'origine s\'affiche sous la ligne, avec l\'heure de la correction et son auteur. Un nouveau clic le replie.');
        await t.vite(() => t.clic(corrigee));
    }

    await t.chapitre('Retrouver un événement');
    await haut();
    await t.dire('La recherche rapide, au-dessus du tableau, filtre instantanément par mot, secrétaire, équipe ou point phone.');
    const recherche = t.champ('Recherche rapide... (secrétaire, événement, équipe, point phone)');
    await t.saisir(recherche, 'météo');
    await t.dire('Seules les lignes contenant « météo » restent affichées.');
    await t.vite(() => t.saisir(recherche, ''));
    await t.dire('« Recherche Avancée » ajoute des filtres : messages importants, rappels, catégories.');
    await haut();
    await t.clic(t.bouton('Recherche Avancée'));
    await t.clic(t.bouton('Messages Importants'));
    await t.dire('Seuls les messages importants sont listés.');
    await t.vite(() => t.clic(t.bouton(/^Fermer$/, { dernier: true })));

    await t.chapitre('Imprimer la main courante');
    await t.dire('« Imprimer main courante » produit la version papier. On peut l\'imprimer à tout moment, pas seulement à la fin.',
        'Par exemple pour remettre une copie au conseiller technique, préparer une relève de secrétaire, ou garder une trace papier en cas de panne.');
    // La version papier s'ouvre d'habitude dans une nouvelle fenêtre : pour le film, elle est affichée par-dessus l'application
    await p.evaluate(() => {
        window.open = () => {
            let html = '';
            const cadre = document.createElement('div');
            cadre.id = 'film-apercu';
            cadre.style.cssText = 'position:fixed;inset:30px 60px;z-index:99999;background:#fff;box-shadow:0 0 0 9999px rgba(0,0,0,.45);border-radius:8px;overflow:hidden';
            return {
                document: {
                    write: (s) => { html += s; },
                    close: () => {
                        const f = document.createElement('iframe');
                        f.style.cssText = 'width:100%;height:100%;border:0';
                        f.srcdoc = html;
                        cadre.appendChild(f);
                        document.body.appendChild(cadre);
                    },
                },
                focus: () => {},
            };
        };
    });
    await t.clic(t.bouton(/Imprimer main courante/));
    await t.dire('Une fenêtre s\'ouvre avec toute la main courante mise en page : en-tête du secours, puis chaque ligne avec son numéro, son heure, son secrétaire et son texte.',
        'Le bouton « Imprimer » de cette fenêtre envoie la page à l\'imprimante, ou l\'enregistre en PDF.');
    await t.rythme(2);
    if (process.env.FILM_RAPIDE) await t.decrire('05-main-courante-apercu');
    await p.evaluate(() => { const c = document.getElementById('film-apercu'); if (c) c.remove(); });
    await t.rythme(1);
    if (process.env.FILM_RAPIDE) await t.decrire('05-main-courante-fin');
});
