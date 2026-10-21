// Film 7 : le planning opérationnel (il se remplit presque seul : couleurs venues de l'inscription
// des sauveteurs, des équipes et de la main courante), saisie d'une activité, poignée de recopie,
// mise à jour automatique, synthèse des affectations à une heure donnée (dernier créneau terminé)
// et ses impressions, tableau de bord.
const { executer } = require('./outils');
const P = require('./preparation');

executer('06-planning', 'Le planning et les tableaux de synthèse', async (t) => {
    const p = t.page;
    const valider = async () => {
        const b = p.locator('button:visible', { hasText: /✓ Valider \(/ });
        if (await b.count()) await t.clic(b);
    };
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma']);
    await P.pointsPhone(t);
    await P.creerEquipe(t, { titre: 'Reconnaissance du P40', membres: ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé'] });
    await p.clock.fastForward(20 * 60000);
    await t.clic(t.bouton(/Main Courante/));
    await t.saisir(t.champ('T1...'), 'Équipe 1');
    await t.clic(t.etiquette('Départ PC'));
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await valider();
    await p.clock.fastForward(30 * 60000);
    await t.saisir(t.champ('T1...'), 'Équipe 1');
    await t.saisir(t.champ('A, B...'), 'A');
    await t.clic(t.etiquette('Entre sous terre'));
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await valider();
    await t.debutFilm();

    const ligneDe = (nom) => p.locator('tr:visible', { hasText: nom }).first();
    // Grille défilée pour que l'heure actuelle soit juste à gauche de la palette d'activités
    const versMaintenant = () => p.evaluate(() => {
        const grille = document.querySelector('.planning-table-wrapper');
        const maintenant = new Date();
        const heure = `${String(maintenant.getHours()).padStart(2, '0')}:00`;
        const th = [...grille.querySelectorAll('th.header-time')].find(h => h.textContent.trim().endsWith(heure));
        const palette = document.getElementById('palette-title');
        if (!th || !palette) return;
        const x = th.getBoundingClientRect().left + th.offsetWidth * maintenant.getMinutes() / 60;
        grille.scrollLeft += x - (palette.getBoundingClientRect().left - 90);
    });

    await t.chapitre('Lire le planning');
    await t.dire('L\'onglet « Planning Opérationnel » montre, pour chaque sauveteur présent, son activité quart d\'heure par quart d\'heure.',
        'Le planning répond aux questions essentielles du PC : qui est sous terre, depuis quand, qui est disponible, qui doit se reposer.');
    await t.dire('Avec l\'application, le planning se renseigne pratiquement seul : le secrétaire n\'a presque rien à y saisir.',
        'Il suffit de tenir la main courante, la liste des sauveteurs et les équipes : le planning en déduit les activités de chacun.');
    await t.clic(t.bouton('Planning Opérationnel'));
    await versMaintenant();
    await t.dire('À gauche : SSF, numéro d\'arrivée, nom, rôle, puis les totaux de temps (sous terre, repos, surface, PC) et l\'équipe. À droite : la grille horaire en couleurs.');
    await t.dire('Les couleurs inscrites automatiquement viennent de trois endroits : l\'inscription des sauveteurs, les équipes et la main courante.');
    await t.viser(ligneDe('ROBERT Emma'));
    await t.dire('L\'inscription des sauveteurs : l\'arrivée sur site met le sauveteur en « Disponible » (vert foncé). Son départ le mettra en « Quitter le secours ».');
    await t.viser(ligneDe('MARTIN Alice'));
    await t.dire('Les équipes : l\'ajout dans l\'équipe 1 a mis ses membres en « Engagé » (vert clair).',
        'Une scission, un retour au PC ou une fin de mission changent aussi le planning.');
    await t.viser(ligneDe('BERNARD Bruno'));
    await t.dire('La main courante : le départ du PC de l\'équipe 1 a mis ses membres en « Approche » (violet), puis l\'entrée sous terre au point A en « Sous Terre » (marron).',
        'Chaque message de progression d\'une équipe met à jour le planning de ses membres.');

    await t.chapitre('Saisir une activité à la main');
    await t.dire('Pour un sauveteur hors équipe (repas, repos, rôle au PC…), on sélectionne des cases de sa ligne en glissant la souris, puis on clique une activité de la palette.',
        'Une activité ne se pose qu\'à partir de l\'arrivée du sauveteur sur site : avant, il n\'est pas là.');
    const cases = ligneDe('THOMAS David').locator('td.time-slot-cell');
    // Première case après l'arrivée (cases déjà colorées = activité en cours)
    const premiere = await cases.evaluateAll(tds => {
        const vide = td => /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(getComputedStyle(td).backgroundColor);
        const arrivee = tds.findIndex(td => !vide(td));
        return Math.max(0, arrivee) + 1;
    });
    await t.glisser(cases.nth(premiere), cases.nth(premiere + 2));
    await t.clic(t.bouton('Repas - Déjeuner'));
    await t.viser(ligneDe('THOMAS David'));
    await t.dire('THOMAS David est noté « Repas - Déjeuner » sur les cases choisies.',
        'Les activités marquées 👥 (Engagé, Approche, Sous Terre…) ne s\'appliquent qu\'aux membres d\'une équipe : pour un sauveteur sans équipe, l\'application refuse et explique pourquoi.');
    const voirMC = async (n, explication, pourquoi) => {
        await t.vite(() => t.clic(t.bouton(/Main Courante/)));
        const lignes = p.locator('tbody tr:visible');
        await lignes.first().scrollIntoViewIfNeeded();
        for (let i = n - 1; i >= 0; i--) await t.viser(lignes.nth(i));
        if (process.env.FILM_RAPIDE) console.log('MC ▸ ' + (await lignes.allInnerTexts()).slice(0, n).map(l => l.replace(/\s+/g, ' ')).join('\n     '));
        await t.dire(explication, pourquoi);
        await t.vite(() => t.clic(t.bouton('Planning Opérationnel')));
        await versMaintenant();
    };
    await voirMC(1, 'Toute modification faite à la main dans le planning écrit automatiquement une ligne dans la main courante : « Activité "Repas - Déjeuner" affectée à : THOMAS David ».',
        'La main courante garde ainsi la trace de chaque changement d\'activité, même saisi directement dans le planning.');

    await t.dire('La « poignée de recopie » (petit carré au coin de la sélection) prolonge une activité, comme dans un tableur.',
        'Inutile de prolonger loin dans le temps : la mise à jour automatique prolonge déjà l\'activité en cours. La poignée sert aux cas particuliers, par exemple un repas prévu plus long.');
    await t.vite(() => t.glisser(cases.nth(premiere), cases.nth(premiere + 2)));
    const poignee = p.locator('.fill-handle');
    if (await poignee.count()) await t.glisser(poignee, cases.nth(premiere + 4));
    await t.viser(ligneDe('THOMAS David'));
    await t.dire('Le repas est prolongé jusqu\'à la case choisie, un peu au-delà de l\'heure actuelle.');
    await t.viser(ligneDe('THOMAS David').locator('td.cell-statut-calc').nth(1));
    await t.dire('Les totaux de temps ne comptent que jusqu\'à l\'heure actuelle : les cases posées à l\'avance ne comptent qu\'une fois leur heure passée.',
        'Ainsi, le temps sous terre ou de repos affiché est toujours le temps réellement passé.');
    await t.vite(async () => {
        await t.glisser(cases.nth(premiere + 5), cases.nth(premiere + 5));
        await t.clic(t.bouton(/^Disponible$/));
    });
    await t.viser(ligneDe('THOMAS David'));
    await t.dire('Après son repas, THOMAS David sera de nouveau « Disponible ».');
    await voirMC(2, 'La recopie et le retour en « Disponible » sont eux aussi notés dans la main courante.');

    await t.chapitre('Mise à jour automatique du planning');
    await t.dire('Quand le temps passe, les activités en cours doivent être prolongées. « Mettre à jour les activités » le fait d\'un clic ; la case « Mise à jour automatique » le fait seule, sans confirmation.',
        'Sans cela, la grille s\'arrêterait à la dernière saisie : le planning ne refléterait plus la réalité.');
    await t.viser(t.bouton('Mettre a jour les activites'));
    await t.cocher(p.locator('label:visible', { hasText: 'Mise à jour automatique du planning' }).locator('input'));
    await t.avancer(75, 'Une heure et quart plus tard…');
    await p.locator('text=Planning mis à jour automatiquement').first().waitFor({ timeout: 20000 }).catch(() => {});
    await versMaintenant();
    await t.viser(ligneDe('MARTIN Alice'));
    await t.dire('Le planning s\'est prolongé tout seul jusqu\'à l\'heure actuelle : l\'équipe 1 est toujours sous terre, THOMAS David et ROBERT Emma toujours disponibles.');
    await t.dire('« Début J1 » et « Jours » règlent la période affichée (jusqu\'à 14 jours pour un secours long).');
    await t.rythme(1);

    await t.chapitre('Synthèse des affectations');
    await t.dire('L\'onglet « Synthèse Affectations » compte les sauveteurs par activité à une heure donnée, et liste qui fait quoi.',
        'C\'est la photographie à donner (ou à transmettre) au conseiller technique, pour qu\'il puisse créer ses équipes et faire un point de situation. Toutes ces listes s\'impriment.');
    await t.clic(t.bouton('Synthèse Affectations'));
    const creneau = p.locator('span.text-blue-700.text-xl').first();
    await t.viser(creneau);
    await t.dire('L\'heure de référence s\'affiche en bleu : c\'est un créneau d\'un quart d\'heure. On la choisit avec le curseur, ou avec les flèches (une heure ou un quart d\'heure).');
    await t.dire('Au départ, c\'est le créneau en cours : il n\'est pas terminé, le planning n\'y est peut-être pas encore à jour. On recule donc d\'un quart d\'heure, jusqu\'au dernier créneau terminé.',
        'Les informations d\'un créneau terminé sont complètes : c\'est celui-là qu\'on donne au conseiller technique.');
    await t.clic(p.locator('button[title="Reculer de 15 minutes"]'));
    await t.viser(creneau);
    await t.viser(p.locator('.section-synthese'));
    await t.dire('À gauche, le comptage : combien de sauveteurs dans chaque activité sur ce créneau, et le total.');

    const activite = (nom) => p.locator('.section-detail label', { has: p.locator('span', { hasText: new RegExp(`^${nom}$`) }) }).locator('input');
    const listes = p.locator('.section-detail div.max-h-96');
    await t.dire('Exemple 1 : le conseiller technique veut composer une nouvelle équipe. Qui est disponible ? On coche « Disponible » dans le détail des sauveteurs affectés.');
    await t.cocher(activite('Disponible'));
    await t.viser(listes);
    await t.dire('La liste donne le nom, le rôle et le département de chaque sauveteur disponible sur ce créneau.');
    await t.dire('Exemple 2 : qui est sous terre ? On coche aussi « Sous Terre ».');
    await t.cocher(activite('Sous Terre'));
    await t.viser(listes);
    await t.dire('Les trois membres de l\'équipe 1 apparaissent sous « Sous Terre », à la suite des disponibles.');

    await t.dire('Exemple 3 : le conseiller technique veut connaître la situation à 8 h 30, à un moment précis du secours. On revient en arrière : ⏪ recule d\'une heure, ◀ d\'un quart d\'heure.',
        'Le comptage et les listes montrent alors la situation de ce créneau-là.');
    await t.clic(p.locator('button[title="Reculer d\'une heure"]'));
    await t.clic(p.locator('button[title="Reculer de 15 minutes"]'));
    await t.viser(creneau);
    await t.vite(async () => {
        await t.cocher(activite('Approche'));
        await t.cocher(activite('Repas - Déjeuner'));
    });
    await t.viser(listes);
    await t.dire('À 8 h 30, l\'équipe 1 était en approche, THOMAS David au repas, et ROBERT Emma seule disponible.');
    await t.dire('« ✓ Tout sélectionner » affiche toutes les activités d\'un coup : la photographie complète du créneau.');
    await t.clic(t.bouton('✓ Tout sélectionner'));
    if (process.env.FILM_RAPIDE) await t.decrire('06-planning-8h30');
    await t.vite(async () => {
        await t.clic(p.locator('button[title="Avancer d\'une heure"]'));
        await t.clic(p.locator('button[title="Avancer de 15 minutes"]'));
    });
    await t.viser(listes);
    await t.dire('Revenu au dernier créneau terminé, on a la situation actuelle complète, prête à imprimer.');
    await t.rythme(2);

    await t.chapitre('Imprimer les listes');
    await t.dire('« Que souhaitez-vous imprimer ? » : les détails des sauveteurs affectés, la synthèse globale (comptage), ou tout.',
        'Chaque liste imprimée porte l\'heure de référence : on sait de quel moment du secours elle parle.');
    // Pour le film, l'impression est montrée à l'écran (mise en page papier) au lieu d'ouvrir la fenêtre de l'imprimante
    await p.evaluate(() => { window.print = () => { window.__classesImpression = document.body.className; }; });
    const imprimer = async (mode, texte) => {
        await t.vite(() => t.clic(p.locator(`input[name="printMode"][value="${mode}"]`)));
        await t.clic(t.bouton('🖨️ Imprimer la(les) liste(s)'));
        await p.evaluate(() => { document.body.className = window.__classesImpression || ''; window.scrollTo(0, 0); });
        await p.emulateMedia({ media: 'print' });
        if (process.env.FILM_RAPIDE) await t.decrire(`06-planning-impression-${mode}`);
        await t.dire(texte);
        await p.emulateMedia({ media: 'screen' });
        await p.evaluate(() => document.body.classList.remove('print-synthese-only', 'print-detail-only', 'impression-synthese'));
    };
    await imprimer('detail', 'Les détails seuls : la liste des sauveteurs par activité, avec l\'heure de référence en titre.');
    await imprimer('all', 'Tout : le comptage, puis les listes. C\'est la feuille à remettre au conseiller technique.');

    await t.chapitre('Tableau de bord');
    await t.dire('Le « Tableau de Bord » donne les chiffres clés : sauveteurs inscrits et venus, équipes, nombre de messages, répartition des activités et temps total de chacun.');
    await t.clic(t.bouton('Tableau de Bord'));
    await t.rythme(3);
    await p.mouse.wheel(0, 700);
    await t.rythme(2);
    await t.dire('Les « Paramètres d\'Alertes » (en bas) règlent le délai d\'engagement au-delà duquel un sauveteur est signalé. « Générer un Rapport » prépare le rapport de fin de mission (voir le film suivant).');
    await t.rythme(2);
    if (process.env.FILM_RAPIDE) await t.decrire('06-planning-fin');
});
