// Film 2 : inscrire les points phones (lettre, nom, type de lieu, position), les modifier,
// les supprimer, et les voir dans la progression.
const { executer } = require('./outils');
const P = require('./preparation');

executer('02-points-phone', 'Inscrire les points phones', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await t.debutFilm();

    await t.chapitre('À quoi servent les points phones');
    await t.dire('Un point phone est un endroit de la cavité d\'où une équipe peut joindre le PC (téléphone filaire, TPS, Nicola…). Chacun reçoit une lettre : A, B, C…',
        'Quand une équipe appelle « on est au point B », le secrétaire n\'a qu\'à taper B : l\'application sait où se trouve l\'équipe, suit sa progression et met le planning à jour (sous terre, surface…).');
    await t.clic(t.bouton('Points Phone'));
    await t.dire('Le point « PC - Poste de Commandement » existe déjà : c\'est le point de départ et d\'arrivée de toutes les équipes.');

    await t.chapitre('Ajouter un point phone');
    const ligneAjout = p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') });
    await t.dire('Pour chaque point : on choisit la lettre, on écrit un nom parlant, puis on indique le TYPE DE LIEU (obligatoire).',
        'Le type de lieu décide de ce que devient le planning quand une équipe y passe : « Entrée cavité » = l\'équipe entre sous terre ; « Sous terre » = elle est sous terre ; « Surface » = mission en surface ; « Sortie cavité » pour une sortie distincte de l\'entrée ; « Hors site » pour un lieu extérieur (hôpital, base arrière…).');
    await t.choisir(ligneAjout.locator('select'), 'A');
    await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), 'Entrée de la cavité');
    await t.clic(t.etiquette('🚪 Entrée cavité'));
    await t.clic(t.bouton('+ Ajouter'));
    await t.dire('Le point A est ajouté. On continue avec les points sous terre, dans l\'ordre où les équipes les rencontrent.');
    await t.choisir(ligneAjout.locator('select'), 'B');
    await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), 'Puits P40');
    await t.clic(t.etiquette('🪨 Sous terre'));
    await t.clic(t.bouton('+ Ajouter'));
    await t.choisir(ligneAjout.locator('select'), 'C');
    await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), 'Salle du Camp');
    await t.clic(t.etiquette('🪨 Sous terre'));
    await t.clic(t.bouton('+ Ajouter'));
    await t.dire('Les lettres déjà prises sont grisées dans la liste déroulante : impossible de donner deux fois la même lettre.');

    await t.chapitre('Placer un point entre deux autres (position)');
    await t.dire('Un nouveau point est installé en cours de secours, ENTRE le P40 (B) et la Salle du Camp (C). On lui donne la lettre D, et la position 2.5 dans la case « Pos. ».',
        'La position règle l\'ordre des points dans le diagramme de progression : 1 = A, 2 = B, 3 = C… 2.5 le place entre B et C, sans avoir à renommer les autres points.');
    await t.choisir(ligneAjout.locator('select'), 'D');
    await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), 'Méandre de la Cascade');
    await t.saisir(t.champ('Pos.'), '2.5');
    await t.clic(t.etiquette('🪨 Sous terre'));
    await t.clic(t.bouton('+ Ajouter'));
    await t.dire('Dans la liste, D se range bien entre B et C. La case « Pos. » de chaque ligne reste modifiable à tout moment.');

    await t.chapitre('Modifier ou supprimer un point phone');
    await t.dire('« ✏️ Modifier » permet de corriger le nom, la lettre ou le type d\'un point. On renomme le point C.',
        'Les lignes de main courante qui citent ce point suivent automatiquement le nouveau nom.');
    const ligneC = p.locator('div.flex.items-center.gap-2:visible', { hasText: 'Salle du Camp' }).last();
    await t.clic(ligneC.locator('button', { hasText: '✏️ Modifier' }));
    await t.saisir(t.champ('Nom du point phone...'), 'Salle du Camp (bivouac)');
    await t.clic(p.locator('button:visible', { hasText: /^✓$/ }).first());
    await t.dire('Pour supprimer un point créé par erreur, on utilise la corbeille 🗑️. L\'application demande confirmation.');
    await t.choisir(ligneAjout.locator('select'), 'Z');
    await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), 'Point en trop');
    await t.clic(t.etiquette('🪨 Sous terre'));
    await t.clic(t.bouton('+ Ajouter'));
    const ligneZ = p.locator('div.flex.items-center.gap-2:visible', { hasText: 'Point en trop' }).last();
    await t.clic(ligneZ.locator('button', { hasText: '🗑️' }));
    await t.rythme(2);
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Un point phone peut aussi être tapé directement');
    await t.dire('Dans la main courante, le champ « Point Phone » se remplit en tapant simplement la lettre du point (A, B…).',
        'Le petit engrenage ⚙️ à côté du champ « Point Phone » ouvre aussi cette même fenêtre de gestion.');
    await t.viser(t.champ('A, B...'));
    await t.rythme(2);
    await t.dire('Les points phones servent ensuite partout : progression des équipes, planning, rapport de fin de mission. Voir le film « Suivre la progression d\'une équipe ».');
});
