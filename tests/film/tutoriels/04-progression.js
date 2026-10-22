// Film 5 : suivre la progression d'une équipe — départ du PC, entrée sous terre, passages aux
// points phones (sans texte quand le point phone suffit), messages (texte mot pour mot),
// remontée point par point, retour au PC avec le bouton « Retour PC » (membres revenus
// séparément, puis dissolution) ; à chaque fois, la main courante et le planning.
const { executer } = require('./outils');
const P = require('./preparation');

executer('04-progression', 'Suivre la progression d\'une équipe', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David']);
    await P.pointsPhone(t);
    await P.creerEquipe(t, { titre: 'Reconnaissance du P40', ordre: 'Descendre le P40 jusqu\'à la Salle du Camp. Appeler à chaque point phone.', membres: ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David'] });
    // Planning prolongé sans fenêtre de confirmation quand l'heure avance (voir le film du planning)
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.clic(p.locator('label:visible', { hasText: 'Mise à jour automatique du planning' }).locator('input'));
    await t.clic(t.bouton(/Main Courante/));
    await t.debutFilm();

    const valider = async (texte, pourquoi) => {
        const b = p.locator('button:visible', { hasText: /✓ Valider \(/ });
        if (await b.count()) {
            if (texte) await t.dire(texte, pourquoi);
            await t.clic(b);
        }
    };
    // Ligne de main courante : équipe, point phone, sens éventuel, texte seulement s'il apporte une information
    const appel = async ({ pp, sens, retour, description, texte, pourquoi }) => {
        await t.vite(async () => {
            await t.clic(t.bouton(/Main Courante/));
            await t.saisir(t.champ('T1...'), 'Équipe 1');
            if (pp) await t.saisir(t.champ('A, B...'), pp);
        });
        if (texte) await t.dire(texte, pourquoi);
        if (sens) await t.clic(t.etiquette(sens));
        if (retour) await t.clic(p.locator('label:visible', { hasText: 'Retour PC' }));
        if (description) await t.vite(() => t.saisir(t.champ('Description...'), description));
        await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    };
    // Main courante : les n dernières lignes (les plus récentes, en haut) entourées
    const voirMC = async (n, explication, pourquoi) => {
        await t.vite(() => t.clic(t.bouton(/Main Courante/)));
        const lignes = p.locator('tbody tr:visible');
        await lignes.first().scrollIntoViewIfNeeded();
        for (let i = n - 1; i >= 0; i--) await t.viser(lignes.nth(i));
        if (process.env.FILM_RAPIDE) console.log('MC ▸ ' + (await lignes.allInnerTexts()).slice(0, n).map(l => l.replace(/\s+/g, ' ')).join('\n     '));
        await t.dire(explication, pourquoi);
    };
    // Planning : grille défilée pour que l'heure actuelle soit juste à gauche de la palette
    // d'activités (qui cache la droite de la grille), lignes de l'équipe entourées
    const voirPlanning = async (explication, pourquoi, nom = 'MARTIN Alice') => {
        await t.vite(() => t.clic(t.bouton('Planning Opérationnel')));
        await p.evaluate(() => {
            const grille = document.querySelector('.planning-table-wrapper');
            const maintenant = new Date();
            const heure = `${String(maintenant.getHours()).padStart(2, '0')}:00`;
            const th = [...grille.querySelectorAll('th.header-time')].find(h => h.textContent.trim().endsWith(heure));
            const palette = document.getElementById('palette-title');
            if (!th || !palette) return;
            const x = th.getBoundingClientRect().left + th.offsetWidth * maintenant.getMinutes() / 60;
            grille.scrollLeft += x - (palette.getBoundingClientRect().left - 90);
        });
        const ligne = p.locator('tr:visible', { hasText: nom }).first();
        await ligne.scrollIntoViewIfNeeded();
        await t.viser(ligne);
        await t.dire(explication, pourquoi);
    };

    await t.chapitre('Le principe');
    await t.dire('L\'équipe 1 (MARTIN Alice, BERNARD Bruno, DUBOIS Chloé, THOMAS David) part reconnaître le P40. Les points phones A (entrée), B (P40) et C (Salle du Camp) sont déjà inscrits.',
        'À chaque appel de l\'équipe, le secrétaire écrit une ligne de main courante avec l\'équipe et le point phone. L\'application en déduit le reste : position, planning, diagramme de progression, durée sous terre.');
    await t.dire('Pour une progression, il n\'est pas nécessaire d\'écrire un texte dans « Événement » : l\'équipe et le point phone suffisent. On n\'écrit que s\'il y a une information en plus.');

    await t.chapitre('1. Départ du PC');
    await appel({
        texte: 'On tape « Équipe 1 », puis on clique sur « Départ PC ». Le point phone devient « PC » et la catégorie « Progression ». Le petit choix à côté (sous terre, surface, hors site) est déjà sur « sous terre ».',
        pourquoi: '« Départ PC » indique que l\'équipe quitte le PC : son temps d\'engagement commence.',
        sens: 'Départ PC',
    });
    await valider('L\'application propose de mettre à jour le planning des membres (« approche » = en route vers la cavité). Toute l\'équipe est cochée : on valide.');
    await voirMC(2, 'Main courante : la ligne « Départ du PC - Sous-terre → Approche » est écrite automatiquement, puis la ligne du planning « Approche » pour toute l\'équipe.');
    await voirPlanning('Planning : les quatre membres passent en « approche » à l\'heure du départ.');

    await t.avancer(25, '25 minutes plus tard, l\'équipe appelle depuis l\'entrée de la cavité.');
    await t.chapitre('2. Entrée sous terre (point A)');
    await appel({
        pp: 'A',
        texte: 'Point A = entrée de la cavité. Pour un point d\'entrée ou de sortie, l\'application demande le sens : simple passage, entrée sous terre, sortie en restant à l\'entrée, ou sortie avec retour au PC. Ici : « Entre sous terre ».',
        pourquoi: 'C\'est ce choix qui fait passer les membres « sous terre » au planning : on sait à tout moment qui est sous terre et depuis quand.',
        sens: 'Entre sous terre',
    });
    await valider();
    await voirMC(2, 'Main courante : « Entre sous terre » est écrit automatiquement, avec le point A. Puis la ligne du planning « Sous terre ».');
    await voirPlanning('Planning : les membres passent « sous terre » (en marron).');

    await t.avancer(40, '40 minutes plus tard : appel depuis le P40.');
    await t.chapitre('3. Passages aux points phones sous terre');
    await appel({ pp: 'B', texte: 'Point B = sous terre. On tape seulement l\'équipe et la lettre : pas de sens à choisir, pas de texte à écrire.' });
    await valider();
    await voirMC(2, 'Main courante : la ligne de l\'équipe 1 au point B, sans texte : le point phone suffit.');
    await voirPlanning('Planning : rien ne change, l\'équipe reste « sous terre ».');

    await t.avancer(35, '35 minutes plus tard : appel depuis la Salle du Camp, avec une information en plus.');
    await appel({ pp: 'C', description: 'Galerie nord obstruée par un éboulis, contournement par la gauche.', texte: 'Cette fois, l\'équipe donne une information utile : on l\'écrit dans « Événement ».' });
    await valider();
    await voirMC(2, 'Main courante : la ligne au point C avec l\'information donnée par l\'équipe.');

    await t.chapitre('4. Les messages');
    await t.dire('Un message est différent d\'une simple progression : on écrit le texte de la conversation, mot pour mot, sans aucune interprétation de la part du secrétaire.',
        'La main courante peut être relue plus tard (rapport, enquête) : elle doit dire exactement ce qui a été dit, par qui, et pour qui.');
    await t.vite(async () => {
        await t.saisir(p.locator('label:visible', { hasText: 'Message à destination de' }).locator('..').locator('input').first(), 'Conseiller technique');
        await t.saisir(p.locator('label:visible', { hasText: 'Message venant de' }).locator('..').locator('input').first(), 'MARTIN Alice');
        await t.saisir(t.champ('A, B...'), 'C');
    });
    await t.dire('MARTIN Alice, cheffe de l\'équipe 1, demande à parler au conseiller technique depuis le point C : « Message à destination de », « Message venant de », puis ses mots exacts.');
    await t.saisir(t.champ('Description...'), 'Ici Alice, à la Salle du Camp. On a trouvé une suite après l\'éboulis. On continue trente minutes et on rappelle.');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await valider();
    await voirMC(2, 'Main courante : « Message de : MARTIN Alice pour Conseiller technique », suivi du texte exact. La catégorie devient « Communication ».',
        'Comme MARTIN Alice fait partie de l\'équipe 1, l\'application ajoute aussi une ligne de planning qui confirme qu\'elle est sous terre.');
    await t.avancer(5);
    await t.vite(async () => {
        await t.saisir(p.locator('label:visible', { hasText: 'Message à destination de' }).locator('..').locator('input').first(), 'MARTIN Alice');
        await t.saisir(p.locator('label:visible', { hasText: 'Message venant de' }).locator('..').locator('input').first(), 'Conseiller technique');
        await t.saisir(t.champ('A, B...'), 'C');
    });
    await t.dire('Dans l\'autre sens, le conseiller technique fait passer un message à MARTIN Alice : « Message à destination de », « Message venant de », puis le texte transmis.');
    await t.saisir(t.champ('Description...'), 'Ne pas dépasser la cascade. Retour au PC avant 13 h.');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await valider();
    await voirMC(1, 'Main courante : « Message de : Conseiller technique pour MARTIN Alice », et le texte transmis.');
    await voirPlanning('Planning : un message ne change pas l\'activité des membres, ils restent « sous terre ».');

    await t.chapitre('5. Voir où en est l\'équipe');
    await t.dire('L\'onglet « Progression Équipes » montre le trajet de chaque équipe d\'un point phone à l\'autre, avec les heures de passage.',
        'En un coup d\'œil, le PC sait où est chaque équipe et depuis combien de temps elle n\'a pas appelé.');
    await t.clic(t.bouton('Progression Équipes'));
    await t.rythme(5);

    await t.avancer(50, '50 minutes plus tard : l\'équipe a terminé et remonte. Elle rappelle à chaque point phone, comme à l\'aller.');
    await t.chapitre('6. La remontée');
    await appel({ pp: 'C', texte: 'Départ de la Salle du Camp : point C, sans texte.' });
    await valider();
    await t.avancer(30, '30 minutes plus tard : au P40.');
    await appel({ pp: 'B' });
    await valider();
    await voirMC(4, 'Main courante : les passages au point C, puis au point B, à l\'heure de chaque appel.');
    await t.avancer(30, '30 minutes plus tard : l\'équipe sort de la cavité.');
    await appel({
        pp: 'A',
        texte: 'De nouveau au point A, cette fois on choisit « Sort — rentre au PC ».',
        pourquoi: '« Reste à l\'entrée » mettrait l\'équipe en mission de surface (elle reste à l\'entrée) ; « Sort — rentre au PC » la met en « approche » pour le trajet retour.',
        sens: 'Sort — rentre au PC',
    });
    await valider();
    await voirMC(2, 'Main courante : « Sort de sous terre — rentre au PC » est écrit automatiquement, puis la ligne du planning « Approche ».');
    await voirPlanning('Planning : les membres repassent en « approche » à la sortie de la cavité.');

    await t.avancer(20, '20 minutes plus tard : MARTIN Alice, BERNARD Bruno et THOMAS David arrivent au PC. DUBOIS Chloé est restée à l\'entrée pour ranger le matériel.');
    await t.chapitre('7. Retour au PC');
    await appel({
        texte: 'On tape « Équipe 1 » et on clique sur « Retour PC ». Le point phone devient « PC ».',
        pourquoi: 'Plus besoin d\'ouvrir la fenêtre des équipes : « Retour PC » s\'occupe du planning et de l\'équipe.',
        retour: true,
    });
    await t.dire('L\'application demande qui est revenu : toute l\'équipe est cochée. On décoche DUBOIS Chloé, qui n\'est pas encore là, puis on valide.',
        'Les membres cochés deviennent disponibles et quittent l\'équipe. S\'ils sont tous revenus, l\'équipe est dissoute.');
    await t.clic(p.locator('label:visible', { hasText: 'DUBOIS Chloé' }).last().locator('input'));
    await valider();
    await voirMC(5, 'Main courante : « Retour au PC », la ligne du planning « Disponible » pour les trois membres revenus, puis une ligne « libéré de Équipe 1 vers PC » pour chacun.');
    await voirPlanning('Planning : MARTIN Alice, BERNARD Bruno et THOMAS David passent en « disponible » (vert foncé) et n\'ont plus de numéro d\'équipe. DUBOIS Chloé est toujours dans l\'équipe 1, en « approche ».');

    await t.avancer(15, 'Un quart d\'heure plus tard, DUBOIS Chloé, la dernière de l\'équipe, arrive au PC.');
    await appel({ texte: 'Même chose : « Équipe 1 », « Retour PC », puis on valide.', retour: true });
    await valider();
    await voirMC(3, 'Main courante : « Retour au PC », la ligne du planning, puis « Dissolution Équipe 1 » : la dernière revenue, l\'équipe est dissoute automatiquement.',
        'Elle passe dans les équipes dissoutes : en cas d\'erreur, « Réactiver » dans la fenêtre des équipes la remet en activité.');
    await voirPlanning('Planning : DUBOIS Chloé passe à son tour en « disponible ».', null, 'DUBOIS Chloé');

    await t.chapitre('8. Toute la progression');
    await t.dire('Toute la progression est dans la main courante, du départ au retour, avec les heures. Elle se retrouve aussi dans le diagramme de progression.');
    await t.clic(t.bouton('Progression Équipes'));
    await t.rythme(5);
    if (process.env.FILM_RAPIDE) await t.decrire('04-progression-fin');
});
