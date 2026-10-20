// Film 3 : les équipes — créer (numéro au choix), ajouter un membre, scinder, déplacer un membre
// vers une autre équipe, fin de mission ; après chaque action, ce qu'elle inscrit dans la
// fenêtre Équipes, la main courante et le planning (colonne Équipe, tri par équipe).
const { executer } = require('./outils');
const P = require('./preparation');

executer('03-equipes', 'Gérer les équipes', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma', 'DURAND Gaëlle', 'PETIT Félix']);
    await P.pointsPhone(t);
    // Planning prolongé sans fenêtre de confirmation quand l'heure avance (voir le film du planning)
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.clic(p.locator('label:visible', { hasText: 'Mise à jour automatique du planning' }).locator('input'));
    await t.clic(t.bouton(/Main Courante/));
    await t.debutFilm();

    const carte = (nom) => p.locator('div.border-blue-300:visible').filter({ has: p.getByText(nom, { exact: true }) }).first();
    const deplier = async (nom) => {
        if (!(await carte(nom).locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(carte(nom).locator('div.cursor-pointer').first());
    };
    // Depuis la main courante : au planning, la palette d'activités passerait devant la fenêtre
    const ouvrirEquipes = async () => {
        await t.vite(() => t.clic(t.bouton(/Main Courante/)));
        await t.clic(t.bouton(/^👥 Équipes$/));
    };
    const fermer = () => t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    // Main courante : la ligne écrite par l'application, entourée
    const voirMC = async (texte, explication, pourquoi) => {
        await t.vite(() => t.clic(t.bouton(/Main Courante/)));
        const ligne = p.getByText(texte).first();
        await ligne.scrollIntoViewIfNeeded();
        await t.viser(ligne);
        await t.dire(explication, pourquoi);
    };
    // Planning : grille défilée pour que l'heure actuelle soit juste à gauche de la palette
    // d'activités (qui cache la droite de la grille), ligne entourée
    const voirPlanning = async (nom, explication, pourquoi) => {
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
    // Ligne de main courante d'un appel d'équipe (sens : entrée / sortie à un point d'entrée)
    const appel = async ({ pp, sens, description }) => {
        await t.vite(async () => {
            await t.clic(t.bouton(/Main Courante/));
            await t.saisir(t.champ('T1...'), 'Équipe 3');
            await t.saisir(t.champ('A, B...'), pp);
            if (sens) await t.clic(t.etiquette(sens));
            await t.saisir(t.champ('Description...'), description);
            await t.clic(t.bouton(/^✓ ENREGISTRER$/));
            const valider = p.locator('button:visible', { hasText: /✓ Valider \(/ });
            if (await valider.count()) await t.clic(valider);
        });
    };

    await t.chapitre('Créer une équipe');
    await t.dire('Les sauveteurs présents sur site sont regroupés en équipes. Le bouton « Équipes » ouvre la gestion des équipes : à gauche on crée, à droite les équipes actives.',
        'Une équipe est l\'unité suivie par le PC : sa mission, son chef, ses membres et sa position dans la cavité.');
    await ouvrirEquipes();
    const numero = p.locator('select:visible', { has: p.locator('option[value="3"]') }).first();
    await t.viser(numero);
    await t.dire('L\'application propose le premier numéro libre, ici 1. On n\'est pas obligé de suivre cet ordre : on prend le numéro remis par le conseiller technique.',
        'Par exemple, le conseiller technique a prévu l\'équipe 3 pour la reconnaissance du P40 : on choisit 3.');
    await t.choisir(numero, '3');
    await t.dire('On choisit ensuite le type de lieu de la mission : sous terre, surface ou hors site.');
    await t.clic(t.etiquette('Sous terre'));
    await t.dire('Le titre résume la mission en quelques mots ; l\'ordre de mission la détaille.',
        'Le titre apparaît partout (main courante, planning, impressions). L\'ordre de mission est imprimable et remis au chef d\'équipe.');
    await t.vite(async () => {
        await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Reconnaissance du P40');
        await t.saisir(t.champ('Détaillez précisément ce que l\'équipe doit faire...'), 'Descendre le P40, reconnaître la galerie nord jusqu\'à la Salle du Camp. Appeler le PC à chaque point phone. Retour avant 14 h.');
    });
    await t.dire('Le type de mission est obligatoire. Il est souvent détecté automatiquement à partir des mots du titre.');
    const typeMission = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
    if (!(await typeMission.inputValue())) await t.choisir(typeMission, { index: 1 });
    await t.dire('On coche les membres. Attention : le premier sauveteur coché devient le chef d\'équipe.',
        'Le chef est le correspondant du PC pour l\'équipe : il apparaît en premier partout. L\'ordre se change plus tard par glisser-déposer.');
    await t.vite(async () => {
        for (const nom of ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David']) await t.cocher(t.etiquette(nom, { dernier: true }).locator('input[type="checkbox"]'));
    });
    await t.clic(t.bouton('Créer l\'Équipe'));
    await deplier('Équipe 3');
    await t.dire('L\'équipe 3 apparaît à droite, dans « Équipes actives » : son titre, son chef MARTIN Alice en premier, puis ses membres.',
        'Les boutons de la carte servent à imprimer l\'ordre de mission, ajouter des membres, scinder l\'équipe ou terminer la mission.');
    await fermer();
    await voirMC(/Création Équipe 3/,
        'Dans la main courante, l\'application a écrit seule la création de l\'équipe 3 : chef, mission et membres.',
        'Une deuxième ligne indique que l\'activité « engagé » est affectée aux membres, au planning.');
    await voirPlanning('MARTIN Alice',
        'Au planning, les quatre membres ont le numéro 3 dans la colonne « Équipe », et l\'activité « engagé » (vert clair) à partir de l\'heure de création.');

    await t.chapitre('Créer une deuxième équipe');
    await t.avancer(15, 'Un quart d\'heure plus tard, on crée une équipe de surface pour la logistique.');
    await ouvrirEquipes();
    await t.dire('Cette fois, le numéro 1 proposé convient. Les numéros déjà utilisés sont grisés et ne peuvent plus être choisis.',
        'Un numéro d\'équipe n\'est jamais réutilisé pendant un secours : « Équipe 3 » désigne toujours la même équipe dans la main courante et le rapport.');
    await t.viser(numero);
    await t.vite(async () => {
        await t.clic(t.etiquette('Surface'));
        await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Logistique surface');
        await t.choisir(typeMission, { label: '📦 Logistique' });
        for (const nom of ['ROBERT Emma', 'PETIT Félix']) await t.cocher(t.etiquette(nom, { dernier: true }).locator('input[type="checkbox"]'));
    });
    await t.clic(t.bouton('Créer l\'Équipe'));
    await t.dire('L\'équipe 1 rejoint l\'équipe 3 dans les équipes actives.');
    await fermer();
    await voirPlanning('ROBERT Emma',
        'Au planning, ROBERT Emma et PETIT Félix ont le numéro 1 dans la colonne « Équipe ».');
    await t.dire('Un clic sur le titre de la colonne « Équipe » trie le planning par numéro d\'équipe : les membres d\'une même équipe se retrouvent côte à côte.',
        'Un deuxième clic inverse le tri, un troisième revient à l\'ordre d\'arrivée. Les colonnes « N° » et « Nom & Prénom » se trient de la même façon.');
    await t.clic(p.locator('th:visible', { hasText: 'Équipe' }).first());
    await t.dire('Équipe 1 en haut, puis équipe 3. Les sauveteurs sans équipe (ici DURAND Gaëlle) sont à la fin, avec un tiret.');
    await t.viser(p.locator('tr:visible', { hasText: 'DURAND Gaëlle' }).first());
    await t.rythme(1.5);

    await t.chapitre('Ajouter un membre à une équipe');
    await t.avancer(15, 'Un quart d\'heure plus tard, DURAND Gaëlle vient renforcer l\'équipe 1.');
    await ouvrirEquipes();
    await deplier('Équipe 1');
    await t.dire('Sur la carte de l\'équipe 1 : « Ajouter des membres », on coche DURAND Gaëlle, puis « Ajouter ».',
        'Un sauveteur déjà dans une autre équipe est signalé « déjà en Équipe… » : l\'application demande alors s\'il faut le retirer de son équipe actuelle.');
    await t.vite(async () => {
        await t.clic(carte('Équipe 1').locator('button', { hasText: 'Ajouter des Membres' }));
        await t.cocher(carte('Équipe 1').locator('label', { hasText: 'DURAND Gaëlle' }).locator('input[type="checkbox"]'));
    });
    await t.clic(carte('Équipe 1').locator('button', { hasText: '✓ Ajouter (' }));
    await t.dire('L\'équipe 1 compte maintenant trois membres.');
    await fermer();
    await voirMC(/Ajout à Équipe 1/, 'Main courante : « Ajout à Équipe 1 », avec la mission et le nom du renfort.');
    await voirPlanning('DURAND Gaëlle', 'Planning : DURAND Gaëlle a maintenant le numéro 1 et passe en « engagé » à l\'heure de l\'ajout.');

    await t.chapitre('L\'équipe 3 passe sous terre');
    await t.avancer(15, 'Un quart d\'heure plus tard, l\'équipe 3 appelle depuis l\'entrée de la cavité (point A) : elle entre sous terre.');
    await t.dire('Le secrétaire l\'écrit dans la main courante : équipe 3, point A, sens « entre sous terre ». Le détail est montré dans le film sur la progression des équipes.');
    await appel({ pp: 'A', sens: 'Entre sous terre', description: 'Équipe 3 à l\'entrée, s\'engage dans la cavité.' });
    await voirPlanning('MARTIN Alice', 'Au planning, les membres de l\'équipe 3 passent « sous terre » (en marron) à l\'heure de l\'appel.');
    await t.avancer(15, 'Un quart d\'heure plus tard, l\'équipe 3 appelle du P40 (point B).');
    await appel({ pp: 'B', description: 'Équipe 3 au P40, tout va bien.' });

    await t.chapitre('Modifier une équipe déjà partie');
    await t.dire('Le titre, l\'ordre de mission, le type de mission et le type de lieu d\'une équipe se modifient à tout moment, même quand l\'équipe est déjà partie, ici sous terre.',
        'Par exemple, le conseiller technique demande à l\'équipe 3 d\'équiper aussi le P40.');
    await ouvrirEquipes();
    await deplier('Équipe 3');
    await t.clic(carte('Équipe 3').getByText('✏️ Modifier'));
    await t.dire('On clique sur « Modifier » dans la carte de l\'équipe : ses informations reviennent dans le formulaire de gauche. Seul le numéro ne peut pas changer.');
    await t.vite(async () => {
        await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Reconnaissance et équipement du P40');
        await t.completer(t.champ('Détaillez précisément ce que l\'équipe doit faire...'), ' Équiper le P40 en double pour l\'évacuation.');
    });
    await t.clic(t.bouton('Sauvegarder les modifications'));
    await carte('Équipe 3').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await t.viser(carte('Équipe 3').locator('h4').first());
    await t.dire('La carte de l\'équipe 3 affiche le nouveau titre et le nouvel ordre de mission ; l\'impression de l\'ordre de mission suit aussi.');
    await fermer();
    await voirMC(/Modification Équipe 3/, 'Main courante : « Modification Équipe 3 », avec la nouvelle mission.',
        'L\'ancienne mission reste dans l\'historique de l\'équipe : on sait ce qui a été demandé et quand.');

    await t.chapitre('Scinder une équipe');
    await t.dire('Au P40, l\'équipe 3 doit se séparer : une partie continue, l\'autre reste au P40.');
    // La mise à jour automatique du planning (déclenchée par l'heure qui avance) doit être passée
    // avant d'ouvrir « Scinder » : elle remettrait ses cases par défaut (défaut noté)
    await p.locator('text=Planning mis à jour automatiquement').first().waitFor({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await ouvrirEquipes();
    await deplier('Équipe 3');
    await t.clic(carte('Équipe 3').locator('button', { hasText: '✂️ Scinder' }));
    await t.dire('Le numéro de la nouvelle équipe est proposé : 3B. Les membres cochés partent dans la nouvelle équipe ; par défaut, tous sauf le chef.',
        'Chaque ligne indique « → Éq.3B » (part) ou « reste Éq.3 » (reste) : on vérifie avant de valider.');
    await t.dire('On décoche BERNARD Bruno : il restera dans l\'équipe 3 avec la cheffe MARTIN Alice. Puis « Créer Équipe 3B ».');
    // Valider aussitôt : un rafraîchissement de l'écran remet les cases par défaut (défaut noté)
    await t.vite(async () => {
        await t.clic(p.locator('label:visible', { hasText: 'BERNARD Bruno' }).last().locator('input[type="checkbox"]'));
        await t.clic(t.bouton('Créer Équipe 3B'));
    });
    await deplier('Équipe 3B');
    if (await carte('Équipe 3B').getByText('BERNARD Bruno').count()) throw new Error('scission : BERNARD Bruno est parti dans l\'équipe 3B');
    await t.dire('L\'équipe 3B est créée avec DUBOIS Chloé et THOMAS David. Elle reprend le titre et la dernière position connue de l\'équipe 3.');
    await fermer();
    await voirMC(/Scission Équipe 3/,
        'Main courante : « Scission Équipe 3 → Équipe 3B », avec les membres détachés.',
        'Une deuxième ligne note la position de départ de l\'équipe 3B : le dernier point connu de l\'équipe 3.');
    await voirPlanning('DUBOIS Chloé', 'Planning : DUBOIS Chloé et THOMAS David portent maintenant le numéro 3B ; ils restent « sous terre ».');

    await t.chapitre('Déplacer un membre dans une autre équipe');
    await t.avancer(15, 'Un quart d\'heure plus tard, THOMAS David doit finalement rejoindre l\'équipe 3.');
    await ouvrirEquipes();
    await deplier('Équipe 3B');
    await t.dire('Sur la carte de l\'équipe 3B, la zone « Mouvement individuel rapide » déplace une personne : on tape le numéro de l\'équipe de destination (3), puis « Déplacer ».',
        'Taper « PC » à la place d\'un numéro retire la personne de son équipe : elle redevient disponible au PC.');
    const ligneThomas = carte('Équipe 3B').locator('div.flex.items-center.gap-2', { hasText: 'THOMAS David' });
    await t.saisir(ligneThomas.locator('input[placeholder="ID Équipe / PC"]'), '3');
    await t.clic(ligneThomas.locator('button', { hasText: 'Déplacer' }));
    await deplier('Équipe 3');
    await t.dire('THOMAS David est passé dans l\'équipe 3, avec MARTIN Alice et BERNARD Bruno.',
        'Autre méthode : « Ajouter des membres » sur l\'équipe de destination, puis cocher la personne marquée « déjà en Équipe… ».');
    await fermer();
    await voirMC(/THOMAS David : Équipe 3B → Équipe 3/, 'Main courante : « THOMAS David : Équipe 3B → Équipe 3 ».');
    await voirPlanning('THOMAS David', 'Planning : THOMAS David porte de nouveau le numéro 3.');

    await t.chapitre('Fin de mission d\'une équipe revenue au complet');
    await t.avancer(30, 'Une demi-heure plus tard, l\'équipe 1 a terminé sa mission : ses trois membres sont de retour ensemble au PC.');
    await ouvrirEquipes();
    await deplier('Équipe 1');
    await t.dire('On clique sur « Fin de mission ».',
        'L\'équipe est dissoute : ses membres redeviennent disponibles pour une nouvelle équipe.');
    await t.clic(carte('Équipe 1').locator('button', { hasText: 'Fin de mission' }));
    await p.locator('h3:visible', { hasText: 'Équipes Dissoutes' }).scrollIntoViewIfNeeded().catch(() => {});
    await t.dire('L\'équipe 1 passe dans « Équipes dissoutes », en bas de la fenêtre. En cas d\'erreur, « Réactiver » la remet en activité.');
    await fermer();
    await voirMC(/Dissolution Équipe 1/, 'Main courante : « Dissolution Équipe 1 », avec la liste de ses membres.');
    await voirPlanning('ROBERT Emma',
        'Planning : ROBERT Emma, PETIT Félix et DURAND Gaëlle n\'ont plus de numéro d\'équipe (un tiret), et passent en « disponible » (vert foncé) à l\'heure de la fin de mission.',
        'Le planning garde la trace de leur mission : les cases « engagé » restent visibles avant la fin de mission.');

    await t.chapitre('Membres revenus séparément');
    await t.avancer(15, 'Un quart d\'heure plus tard, THOMAS David revient seul au PC ; MARTIN Alice et BERNARD Bruno sont encore en route.');
    await ouvrirEquipes();
    await deplier('Équipe 3');
    await t.dire('Quand les membres d\'une équipe reviennent séparément, on tape « PC » pour chacun dans « Mouvement individuel rapide », puis « Déplacer ».');
    const ligneThomas3 = carte('Équipe 3').locator('div.flex.items-center.gap-2', { hasText: 'THOMAS David' });
    await t.saisir(ligneThomas3.locator('input[placeholder="ID Équipe / PC"]'), 'PC');
    await t.clic(ligneThomas3.locator('button', { hasText: 'Déplacer' }));
    await t.dire('THOMAS David quitte l\'équipe 3, qui reste active avec MARTIN Alice et BERNARD Bruno.');
    await fermer();
    await voirMC(/THOMAS David libéré de Équipe 3 vers PC/, 'Main courante : « THOMAS David libéré de Équipe 3 vers PC ».');
    await voirPlanning('THOMAS David', 'Planning : THOMAS David n\'a plus de numéro d\'équipe et passe en « disponible ». Les deux autres membres restent « sous terre ».');

    await t.avancer(15, 'Un quart d\'heure plus tard, MARTIN Alice et BERNARD Bruno, les derniers membres de l\'équipe 3, arrivent au PC.');
    await ouvrirEquipes();
    await deplier('Équipe 3');
    await t.dire('Pour les derniers membres, on utilise « Fin de mission », et non « PC ».',
        'Si l\'on renvoie aussi le dernier membre avec « PC », l\'équipe disparaît simplement de la liste : pas de ligne « Dissolution » dans la main courante, et elle ne figure pas dans les équipes dissoutes.');
    await t.clic(carte('Équipe 3').locator('button', { hasText: 'Fin de mission' }));
    await p.locator('h3:visible', { hasText: 'Équipes Dissoutes' }).scrollIntoViewIfNeeded().catch(() => {});
    await t.dire('L\'équipe 3 rejoint l\'équipe 1 dans les équipes dissoutes. L\'équipe 3B, encore sous terre au P40, reste active.');
    await fermer();
    await voirMC(/Dissolution Équipe 3/, 'Main courante : « Dissolution Équipe 3 ».');
    await voirPlanning('MARTIN Alice', 'Planning : MARTIN Alice et BERNARD Bruno passent à leur tour en « disponible ».');
    await t.rythme(3);
});
