// Film 4 : inscrire les points phones (lettre, nom, type de lieu, position), les modifier (et
// voir la main courante suivre le nouveau nom), les supprimer.
const { executer } = require('./outils');
const P = require('./preparation');

executer('02-points-phone', 'Inscrire les points phones', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t, 3);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé']);
    await P.creerEquipe(t, { titre: 'Reconnaissance du P40', membres: ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé'] });
    await t.debutFilm();

    // Ligne de main courante d'un appel de l'équipe 1 depuis un point phone
    const appel = async (pp, description) => {
        await t.vite(async () => {
            await t.saisir(t.champ('T1...'), 'Équipe 1');
            await t.saisir(t.champ('A, B...'), pp);
            await t.saisir(t.champ('Description...'), description);
            await t.clic(t.bouton(/^✓ ENREGISTRER$/));
            const valider = p.locator('button:visible', { hasText: /✓ Valider \(/ });
            if (await valider.count()) await t.clic(valider);
        });
    };
    // Lignes de main courante des appels depuis C : point phone (colonne Localisation) entouré
    const voirLocalisations = async () => {
        const lignes = p.locator('tr:visible', { hasText: 'depuis la salle' });
        await lignes.first().scrollIntoViewIfNeeded();
        for (let i = 0; i < await lignes.count(); i++) await t.viser(lignes.nth(i).getByText(/^📍/).first());
    };

    await t.chapitre('À quoi servent les points phones');
    await t.dire('Un point phone est un endroit de la cavité d\'où une équipe peut joindre le PC (téléphone filaire, TPS, Nicola…). Chacun reçoit une lettre : A, B, C…',
        'Quand une équipe appelle « on est au point B », le secrétaire n\'a qu\'à taper B : l\'application sait où se trouve l\'équipe, suit sa progression et met le planning à jour (sous terre, surface…).');
    await t.clic(t.bouton('Points Phone'));
    await t.dire('Le point « PC - Poste de Commandement » existe déjà : c\'est le point de départ et d\'arrivée de toutes les équipes.');

    await t.chapitre('Ajouter un point phone');
    const ligneAjout = p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') });
    await t.dire('Pour chaque point : on choisit la lettre, on écrit un nom parlant, puis on indique le type de lieu (obligatoire).',
        'Le type de lieu décide de ce que devient le planning quand une équipe y passe : « Entrée cavité » = l\'équipe entre sous terre ; « Sous terre » = elle est sous terre ; « Surface » = mission en surface ; « Sortie cavité » pour une sortie distincte de l\'entrée ; « Hors site » pour un point de liaison à l\'écart de la cavité (parking, TPS de surface servant de relais…).');
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
    await t.dire('Un nouveau point est installé en cours de secours, entre le P40 (B) et la Salle du Camp (C). On lui donne la lettre D, et la position 2.5 dans la case « Pos. ».',
        'La position règle l\'ordre des points dans le diagramme de progression : 1 = A, 2 = B, 3 = C… 2.5 le place entre B et C, sans avoir à renommer les autres points.');
    await t.choisir(ligneAjout.locator('select'), 'D');
    await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), 'Méandre de la Cascade');
    await t.saisir(t.champ('Pos.'), '2.5');
    await t.clic(t.etiquette('🪨 Sous terre'));
    await t.clic(t.bouton('+ Ajouter'));
    await t.dire('Dans la liste, D se range bien entre B et C. La case « Pos. » de chaque ligne reste modifiable à tout moment.');

    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Les points phones dans la main courante');
    await t.dire('Dans la main courante, le champ « Point Phone » se remplit en tapant simplement la lettre du point.',
        'Le petit engrenage ⚙️ à côté du champ « Point Phone » ouvre aussi la fenêtre de gestion des points phones.');
    await t.viser(t.champ('A, B...'));
    await t.dire('L\'équipe 1 appelle deux fois depuis la Salle du Camp : on tape « Équipe 1 », la lettre C, puis le message.',
        'Le détail du suivi d\'une équipe est montré dans le film sur la progression des équipes.');
    await appel('C', 'Équipe 1 arrivée, appel depuis la salle du Camp.');
    await t.avancer(20);
    await appel('C', 'Équipe 1 installe le point chaud, appel depuis la salle du Camp.');
    await voirLocalisations();
    await t.dire('Dans la colonne « Localisation », les deux lignes portent le point C.');

    await t.chapitre('Modifier un point phone');
    await t.clic(t.bouton('Points Phone'));
    await t.dire('« ✏️ Modifier » permet de corriger le nom, la lettre ou le type d\'un point. On renomme le point C en « Salle du Camp (bivouac) ».');
    const ligneC = p.locator('div.flex.items-center.gap-2:visible', { hasText: 'Salle du Camp' }).last();
    await t.clic(ligneC.locator('button', { hasText: '✏️ Modifier' }));
    await t.vite(() => t.saisir(t.champ('Nom du point phone...'), 'Salle du Camp (bivouac)'));
    await t.clic(p.locator('button:visible', { hasText: /^✓$/ }).first());
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await voirLocalisations();
    await t.dire('L\'application annonce « Point phone modifié, 2 événements mis à jour » : les deux lignes qui citaient le point C affichent maintenant « C - Salle du Camp (bivouac) ».',
        'Toutes les lignes déjà écrites suivent la modification : la main courante, la progression et le rapport restent cohérents.');

    await t.chapitre('Supprimer un point phone');
    await t.clic(t.bouton('Points Phone'));
    await t.dire('Pour supprimer un point créé par erreur, on utilise la corbeille 🗑️. L\'application demande confirmation.');
    await t.vite(async () => {
        await t.choisir(ligneAjout.locator('select'), 'Z');
        await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), 'Point en trop');
        await t.clic(t.etiquette('🪨 Sous terre'));
        await t.clic(t.bouton('+ Ajouter'));
    });
    const ligneZ = p.locator('div.flex.items-center.gap-2:visible', { hasText: 'Point en trop' }).last();
    await t.clic(ligneZ.locator('button', { hasText: '🗑️' }));
    await t.rythme(2);
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await t.dire('Les points phones servent ensuite partout : progression des équipes, planning, rapport de fin de mission. Voir le film « Suivre la progression d\'une équipe ».');
});
