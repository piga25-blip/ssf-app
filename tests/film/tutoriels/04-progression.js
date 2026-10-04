// Film 4 : suivre la progression d'une équipe — départ du PC, entrée sous terre, passages aux
// points phones, sortie, retour au PC, fin de mission ; planning et diagramme de progression.
const { executer } = require('./outils');
const P = require('./preparation');

executer('04-progression', 'Suivre la progression d\'une équipe', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma']);
    await P.pointsPhone(t);
    await P.creerEquipe(t, { titre: 'Reconnaissance du P40', ordre: 'Descendre le P40 jusqu\'à la Salle du Camp. Appeler à chaque point phone.', membres: ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé'] });
    await t.debutFilm();

    const validerPlanning = async (texte) => {
        const b = p.locator('button:visible', { hasText: /✓ Valider \(/ });
        if (await b.count()) {
            if (texte) await t.dire(texte);
            await t.clic(b);
        }
    };
    const message = async ({ pp, sens, texte, pourquoi, description }) => {
        await t.saisir(t.champ('T1...'), 'Équipe 1');
        if (pp) await t.saisir(t.champ('A, B...'), pp);
        if (texte) await t.dire(texte, pourquoi);
        if (sens) await t.clic(t.etiquette(sens));
        await t.saisir(t.champ('Description...'), description);
        await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    };

    await t.chapitre('Le principe');
    await t.dire('L\'équipe 1 (MARTIN Alice, BERNARD Bruno, DUBOIS Chloé) part reconnaître le P40. Les points phones A (entrée), B (P40) et C (Salle du Camp) sont déjà inscrits.',
        'À chaque appel de l\'équipe, le secrétaire écrit UNE ligne de main courante avec l\'équipe et le point phone. L\'application en déduit tout le reste : position, planning, diagramme de progression, durée sous terre.');

    await t.chapitre('1. Départ du PC');
    await message({
        texte: 'Dans « Équipe » on tape le nom de l\'équipe, puis on clique « Départ PC ». Le point phone devient automatiquement « PC » et la catégorie « Progression ».',
        pourquoi: 'Le bouton « Départ PC » indique clairement que l\'équipe QUITTE le PC : son temps d\'engagement commence.',
        sens: 'Départ PC',
        description: 'Départ de l\'équipe 1 vers la cavité. Mission : reconnaissance du P40.',
    });
    await validerPlanning('L\'application propose de mettre à jour le planning des membres (« approche » = en route vers la cavité). On garde toute l\'équipe cochée et on valide.');
    await t.dire('La ligne est enregistrée avec son numéro et son heure.');

    await t.avancer(25, '25 minutes plus tard, l\'équipe appelle depuis l\'entrée de la cavité.');
    await t.chapitre('2. Entrée sous terre (point A)');
    await message({
        pp: 'A',
        texte: 'Point A = entrée de la cavité. Pour un point d\'entrée ou de sortie, l\'application demande le SENS : simple passage, entrée sous terre, sortie en restant à l\'entrée, ou sortie avec retour au PC.',
        pourquoi: 'C\'est ce choix qui fait passer les membres « sous terre » au planning : on sait à tout moment qui est sous terre et depuis quand.',
        sens: 'Entre sous terre',
        description: 'Équipe 1 à l\'entrée, s\'engage dans la cavité.',
    });
    await validerPlanning('Mise à jour du planning : l\'équipe passe « sous terre ».');

    await t.avancer(40, '40 minutes plus tard : appel depuis le P40.');
    await t.chapitre('3. Passages aux points phones sous terre');
    await message({
        pp: 'B',
        texte: 'Point B = sous terre. Il suffit de taper la lettre : pas de sens à choisir, l\'équipe est sous terre.',
        description: 'Équipe 1 au P40, tout va bien, poursuit vers la Salle du Camp.',
    });
    await validerPlanning();
    await t.avancer(35, '35 minutes plus tard : appel depuis la Salle du Camp.');
    await message({ pp: 'C', description: 'Équipe 1 arrivée à la Salle du Camp. Début de la reconnaissance.' });
    await validerPlanning();

    await t.chapitre('Voir où en est l\'équipe');
    await t.dire('L\'onglet « Progression Équipes » montre le trajet de chaque équipe d\'un point phone à l\'autre, avec les heures de passage.',
        'En un coup d\'œil, le PC sait où est chaque équipe et depuis combien de temps elle n\'a pas appelé.');
    await t.clic(t.bouton('Progression Équipes'));
    await t.rythme(5);
    await t.dire('Le « Planning Opérationnel » montre, quart d\'heure par quart d\'heure, l\'activité de chaque sauveteur : approche, sous terre…');
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.rythme(5);
    await t.clic(t.bouton('Main Courante'));

    await t.avancer(90, '1 h 30 plus tard : l\'équipe a terminé et ressort de la cavité. (Quand du temps a passé, l\'application propose de prolonger automatiquement le planning de chacun : on accepte.)');
    await t.chapitre('4. Sortie de la cavité');
    await message({
        pp: 'A',
        texte: 'De nouveau au point A, cette fois on choisit « Sort — rentre au PC ».',
        pourquoi: '« Sort — reste entrée » mettrait l\'équipe en mission surface (elle reste à l\'entrée) ; « Sort — rentre au PC » la met en « approche » pour le trajet retour.',
        sens: 'Sort — rentre au PC',
        description: 'Équipe 1 sortie de la cavité, retour vers le PC.',
    });
    await validerPlanning();

    await t.avancer(20, '20 minutes plus tard : l\'équipe arrive au PC.');
    await t.chapitre('5. Retour au PC');
    await message({
        pp: 'PC',
        texte: 'Point phone « PC », et une description qui dit le RETOUR (« retour », « arrive », « revient »…).',
        pourquoi: 'L\'application reconnaît ces mots : les membres redeviennent « disponibles » au planning. Avec « Départ PC » ou les mots « départ », « quitte », « descend »… elle comprend au contraire un départ.',
        description: 'Retour de l\'équipe 1 au PC, RAS. Compte rendu : galerie nord reconnue jusqu\'à la Salle du Camp.',
    });
    await validerPlanning();

    await t.chapitre('6. Fin de mission');
    await t.dire('Le compte rendu fait, on clôt la mission de l\'équipe : « Équipes », on déplie l\'équipe 1, « Fin de mission ».',
        'L\'équipe est dissoute et ses membres sont libres pour une autre mission. Le film « Gérer les équipes » détaille cette étape.');
    await t.clic(t.bouton(/^👥 Équipes$/));
    const carte = p.locator('div.border-blue-300:visible').filter({ has: p.getByText('Équipe 1', { exact: true }) }).first();
    if (!(await carte.locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(carte.locator('div.cursor-pointer').first());
    await t.clic(carte.locator('button', { hasText: 'Fin de mission' }));
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await t.dire('Toute la progression est dans la main courante, du départ au retour, avec les heures. Elle se retrouve aussi dans le diagramme de progression.');
    await t.clic(t.bouton('Progression Équipes'));
    await t.rythme(5);
    if (process.env.FILM_RAPIDE) await t.decrire('04-progression-fin');
});
