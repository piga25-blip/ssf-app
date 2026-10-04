// Film 6 : le planning opérationnel (lecture, saisie d'une activité, poignée de recopie,
// mise à jour automatique), la synthèse des affectations et le tableau de bord.
const { executer } = require('./outils');
const P = require('./preparation');

executer('06-planning', 'Le planning et les tableaux de synthèse', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma']);
    await P.pointsPhone(t);
    await P.creerEquipe(t, { titre: 'Reconnaissance du P40', membres: ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé'] });
    await t.saisir(t.champ('T1...'), 'Équipe 1');
    await t.clic(t.etiquette('Départ PC'));
    await t.saisir(t.champ('Description...'), 'Départ de l\'équipe 1 vers la cavité.');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await t.clic(p.locator('button:visible', { hasText: /✓ Valider \(/ }));
    await p.clock.fastForward(30 * 60000);
    await t.saisir(t.champ('T1...'), 'Équipe 1');
    await t.saisir(t.champ('A, B...'), 'A');
    await t.clic(t.etiquette('Entre sous terre'));
    await t.saisir(t.champ('Description...'), 'Équipe 1 à l\'entrée, entre sous terre.');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    if (await p.locator('button:visible', { hasText: /✓ Valider \(/ }).count()) await t.clic(p.locator('button:visible', { hasText: /✓ Valider \(/ }));
    await t.debutFilm();

    await t.chapitre('Lire le planning');
    await t.dire('L\'onglet « Planning Opérationnel » montre, pour chaque sauveteur présent, son activité quart d\'heure par quart d\'heure.',
        'Le planning répond aux questions essentielles du PC : qui est sous terre, depuis quand, qui est disponible, qui doit se reposer.');
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.dire('À gauche : SSF, numéro d\'arrivée, nom, rôle, puis les totaux de temps (sous terre, repos, surface, PC) et l\'équipe. À droite : la grille horaire en couleurs.');
    await t.dire('Les couleurs viennent de la main courante : le départ de l\'équipe 1 a mis ses membres en « Approche » (violet), puis l\'entrée sous terre en « Sous Terre » (marron).',
        'Le secrétaire n\'a presque rien à saisir dans le planning : il se remplit tout seul à partir des messages des équipes.');
    await t.rythme(3);

    await t.chapitre('Saisir une activité à la main');
    await t.dire("La palette d'activités cache la droite de la grille : on la décale en la tirant par son titre.");
    const titre = await p.locator('#palette-title').boundingBox();
    await t.glisser(p.locator('#palette-title'), { x: titre.x + titre.width / 2 + 110, y: titre.y + titre.height / 2 });
    await t.dire("Pour un sauveteur hors équipe (repas, repos, rôle au PC…), on sélectionne des cases de sa ligne en glissant la souris, puis on clique une activité de la palette.",
        "Une activité ne se pose qu'à partir de l'arrivée du sauveteur sur site : avant, il n'est pas là.");
    const cases = p.locator('tr', { hasText: 'THOMAS David' }).locator('td.time-slot-cell');
    // Première case après l'arrivée (cases déjà colorées = activité en cours)
    const premiere = await cases.evaluateAll(tds => {
        const vide = td => /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(getComputedStyle(td).backgroundColor);
        const arrivee = tds.findIndex(td => !vide(td));
        return Math.max(0, arrivee) + 1;
    });
    await t.glisser(cases.nth(premiere), cases.nth(premiere + 2));
    await t.clic(t.bouton('Repas - Déjeuner'));
    await t.dire('THOMAS David est noté « Repas - Déjeuner » sur les cases choisies.',
        "Les activités marquées 👥 (Engagé, Approche, Sous Terre…) ne s'appliquent qu'aux membres d'une équipe : pour un sauveteur sans équipe, l'application refuse et explique pourquoi.");
    await t.dire('La « poignée de recopie » (petit carré au coin de la sélection) prolonge une activité, comme dans un tableur.');
    await t.glisser(cases.nth(premiere), cases.nth(premiere + 2));
    const poignee = p.locator('.fill-handle');
    if (await poignee.count()) await t.glisser(poignee, cases.nth(premiere + 4));

    await t.chapitre('Mise à jour automatique du planning');
    await t.dire('Quand le temps passe, les activités en cours doivent être prolongées. « Mettre à jour les activités » le fait d\'un clic ; la case « Mise à jour automatique » le fait seule, sans confirmation.',
        'Sans cela, la grille s\'arrêterait à la dernière saisie : le planning ne refléterait plus la réalité.');
    await t.viser(t.bouton('Mettre a jour les activites'));
    await t.rythme(2);
    await t.dire('« Début J1 » et « Jours » règlent la période affichée (jusqu\'à 14 jours pour un secours long).');
    await t.rythme(2);

    await t.chapitre('Synthèse des affectations');
    await t.dire('L\'onglet « Synthèse Affectations » compte les sauveteurs par activité à une heure donnée, et liste qui fait quoi.',
        'C\'est la photographie à transmettre au COS ou à la préfecture lors d\'un point de situation. Les listes s\'impriment.');
    await t.clic(t.bouton('Synthèse Affectations'));
    await t.rythme(4);
    await p.mouse.wheel(0, 500);
    await t.rythme(3);
    await p.evaluate(() => window.scrollTo(0, 0));

    await t.chapitre('Tableau de bord');
    await t.dire('Le « Tableau de Bord » donne les chiffres clés : sauveteurs inscrits et venus, équipes, nombre de messages, répartition des activités et temps total de chacun.');
    await t.clic(t.bouton('Tableau de Bord'));
    await t.rythme(4);
    await p.mouse.wheel(0, 700);
    await t.rythme(3);
    await t.dire('Les « Paramètres d\'Alertes » (en bas) règlent le délai d\'engagement au-delà duquel un sauveteur est signalé. « Générer un Rapport » prépare le rapport de fin de mission (voir le film suivant).');
    await t.rythme(3);
});
