// Film 3 : les équipes — créer, ajouter un membre, scinder, déplacer un membre vers une autre
// équipe, fin de mission (et réactivation).
const { executer } = require('./outils');
const P = require('./preparation');

executer('03-equipes', 'Gérer les équipes', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma', 'DURAND Gaëlle']);
    await P.pointsPhone(t);
    await t.debutFilm();

    const carte = (nom) => p.locator('div.border-blue-300:visible').filter({ has: p.getByText(nom, { exact: true }) }).first();
    const deplier = async (nom) => {
        if (!(await carte(nom).locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(carte(nom).locator('div.cursor-pointer').first());
    };

    await t.chapitre('Créer une équipe');
    await t.dire('Les sauveteurs présents sur site sont regroupés en équipes. Le bouton « Équipes » ouvre la gestion des équipes : à gauche on crée, à droite les équipes actives.',
        'Une équipe est l\'unité suivie par le PC : sa mission, son chef, ses membres et sa position dans la cavité.');
    await t.clic(t.bouton(/^👥 Équipes$/));
    await t.dire('Le numéro est proposé automatiquement (le premier libre). On choisit ensuite le TYPE DE LIEU de la mission : sous terre, surface ou hors site.');
    await t.clic(t.etiquette('Sous terre'));
    await t.dire('Le titre résume la mission en quelques mots ; l\'ordre de mission la détaille.',
        'Le titre apparaît partout (main courante, planning, impressions). L\'ordre de mission est imprimable et remis au chef d\'équipe : chacun sait exactement ce qu\'il doit faire.');
    await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Reconnaissance du P40');
    await t.saisir(t.champ('Détaillez précisément ce que l\'équipe doit faire...'), 'Descendre le P40, reconnaître la galerie nord jusqu\'à la Salle du Camp. Appeler le PC à chaque point phone. Retour avant 14 h.');
    await t.dire('Le type de mission est obligatoire. Il est souvent détecté automatiquement à partir des mots du titre.');
    const typeMission = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
    if (!(await typeMission.inputValue())) await t.choisir(typeMission, { index: 1 });
    await t.dire('On coche les membres. ATTENTION : le PREMIER coché devient le CHEF d\'équipe.',
        'Le chef est le correspondant du PC pour l\'équipe : il apparaît en premier partout. L\'ordre se change plus tard par glisser-déposer.');
    for (const nom of ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David']) await t.cocher(t.etiquette(nom, { dernier: true }).locator('input[type="checkbox"]'));
    await t.clic(t.bouton('Créer l\'Équipe'));
    await t.dire('L\'équipe 1 apparaît à droite, dans « Équipes Actives ». Une ligne est aussi ajoutée automatiquement dans la main courante.');

    await t.dire('On crée de même une équipe de surface pour la logistique. Le numéro suivant (2) est déjà proposé : les numéros déjà utilisés sont grisés dans la liste.',
        'Un numéro d\'équipe n\'est jamais réutilisé pendant un secours : « Équipe 1 » désigne toujours la même équipe dans la main courante et le rapport.');
    await t.viser(p.locator('select:visible', { has: p.locator('option[value="3"]') }).first());
    await t.clic(t.etiquette('Surface'));
    await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Logistique surface');
    await t.choisir(typeMission, { label: '📦 Logistique' });
    for (const nom of ['ROBERT Emma']) await t.cocher(t.etiquette(nom, { dernier: true }).locator('input[type="checkbox"]'));
    await t.clic(t.bouton('Créer l\'Équipe'));

    await t.chapitre('Ajouter un membre à une équipe');
    await t.dire('On clique sur une équipe pour la déplier : membres, chef, et boutons d\'action (imprimer, ajouter des membres, scinder, fin de mission).');
    await deplier('Équipe 2');
    await t.dire('DURAND Gaëlle vient renforcer l\'équipe 2 : « Ajouter des Membres », on la coche, puis « Ajouter ».',
        'Un sauveteur déjà dans une autre équipe est signalé « déjà en Équipe… » : l\'application demande alors s\'il faut le retirer de son équipe actuelle.');
    await t.clic(carte('Équipe 2').locator('button', { hasText: 'Ajouter des Membres' }));
    await t.cocher(carte('Équipe 2').locator('label', { hasText: 'DURAND Gaëlle' }).locator('input[type="checkbox"]'));
    await t.clic(carte('Équipe 2').locator('button', { hasText: '✓ Ajouter (' }));
    await t.rythme(1.5);

    await t.chapitre('Scinder une équipe');
    await t.dire('Sous terre, l\'équipe 1 doit se séparer : une partie continue, l\'autre reste au P40. On « scinde » l\'équipe.',
        'Chaque groupe devient une équipe suivie séparément (position, planning), et la main courante garde la trace de la séparation.');
    await deplier('Équipe 1');
    await t.clic(carte('Équipe 1').locator('button', { hasText: '✂️ Scinder' }));
    await t.dire('On choisit le numéro de la nouvelle équipe (1B est proposé). Les membres COCHÉS partent dans la nouvelle équipe : par défaut, tous sauf le chef.',
        'Chaque ligne indique clairement « → Éq.1B » (part) ou « reste Éq.1 » (reste) : on vérifie avant de valider.');
    await t.clic(p.locator('label:visible', { hasText: 'BERNARD Bruno' }).last().locator('input[type="checkbox"]'));
    await t.dire('BERNARD Bruno est décoché : il reste dans l\'équipe 1 avec la cheffe MARTIN Alice. DUBOIS Chloé et THOMAS David partent dans l\'équipe 1B.');
    await t.clic(t.bouton('Créer Équipe 1B'));
    await t.dire('L\'équipe 1B est créée avec DUBOIS Chloé et THOMAS David. Elle hérite du titre et de la dernière position connue de l\'équipe 1.');

    await t.chapitre('Déplacer un membre dans une autre équipe');
    await t.dire('THOMAS David doit finalement rejoindre l\'équipe 1. Dans l\'équipe 1B, la zone « Mouvement Individuel Rapide » déplace une personne : on tape le numéro de l\'équipe de destination (1), puis « Déplacer ».',
        'Taper « PC » à la place d\'un numéro retire la personne de son équipe : elle redevient disponible au PC.');
    await deplier('Équipe 1B');
    const ligneThomas = carte('Équipe 1B').locator('div.flex.items-center.gap-2', { hasText: 'THOMAS David' });
    await t.saisir(ligneThomas.locator('input[placeholder="ID Équipe / PC"]'), '1');
    await t.clic(ligneThomas.locator('button', { hasText: 'Déplacer' }));
    await t.dire('THOMAS David est passé dans l\'équipe 1, avec MARTIN Alice et BERNARD Bruno.');
    await deplier('Équipe 1');
    await t.rythme(2.5);
    await t.dire('Cela marche aussi vers une sous-équipe issue d\'une scission : BERNARD Bruno rejoint l\'équipe 1B, on tape « 1B ».');
    const ligneBruno = carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'BERNARD Bruno' });
    await t.saisir(ligneBruno.locator('input[placeholder="ID Équipe / PC"]'), '1B');
    await t.clic(ligneBruno.locator('button', { hasText: 'Déplacer' }));
    await t.dire('BERNARD Bruno est maintenant dans l\'équipe 1B avec DUBOIS Chloé.');
    await deplier('Équipe 1B');
    await t.rythme(2);
    await t.dire('Autre méthode : « Ajouter des Membres » sur l\'équipe de destination, puis cocher la personne marquée « déjà en Équipe… ». L\'application demande alors s\'il faut la retirer de son équipe actuelle.');

    await t.chapitre('Fin de mission');
    await t.dire('Quand une équipe a terminé sa mission et que ses membres sont de retour, on clique sur « Fin de mission ».',
        'L\'équipe est dissoute : ses membres redeviennent disponibles pour une nouvelle équipe. La fin de mission est notée dans la main courante.');
    await deplier('Équipe 2');
    await t.clic(carte('Équipe 2').locator('button', { hasText: 'Fin de mission' }));
    await t.dire('L\'équipe 2 passe dans « Équipes Dissoutes », en bas de la fenêtre. En cas d\'erreur, « Réactiver » la remet en activité.');
    await p.locator('h3:visible', { hasText: 'Équipes Dissoutes' }).scrollIntoViewIfNeeded().catch(() => {});
    await t.rythme(3);
    if (process.env.FILM_RAPIDE) await t.decrire('03-equipes-fin');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await t.dire('Toutes ces opérations sont tracées automatiquement dans la main courante (création, renfort, scission, fin de mission).');
    await t.rythme(4);
});
