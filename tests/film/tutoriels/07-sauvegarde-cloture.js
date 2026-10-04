// Film 7 : sauvegarder (sauvegardes automatiques, Exporter / Importer Tout), rapport de fin
// de mission, clôture du secours.
const { executer } = require('./outils');
const P = require('./preparation');

executer('07-sauvegarde-cloture', 'Sauvegarder, faire le rapport et clôturer', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David']);
    await P.pointsPhone(t);
    await P.creerEquipe(t, { titre: 'Reconnaissance du P40', membres: ['MARTIN Alice', 'BERNARD Bruno'] });
    await t.saisir(t.champ('Description...'), 'Victime remontée et prise en charge par le SAMU. Fin des opérations sous terre.');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await t.debutFilm();

    await t.chapitre('Les sauvegardes automatiques');
    await t.dire('Tout ce qui est saisi est enregistré immédiatement sur le PC. En plus, l\'application fait des copies de sécurité régulières.',
        'Si un fichier est abîmé ou une fausse manipulation faite, on peut revenir à une copie récente.');
    await t.clic(t.bouton('Sauvegardes auto'));
    await t.dire('On choisit l\'intervalle (30 minutes ou 1 heure). « Sauvegarder maintenant » fait une copie tout de suite, par exemple avant une opération délicate.');
    await t.clic(t.bouton('Sauvegarder maintenant'));
    await t.dire('Les copies apparaissent dans la liste, avec leur heure : chacune peut être restaurée.');
    await t.rythme(3);
    await p.keyboard.press('Escape');
    await t.rythme(1);
    if (await p.locator('h2:visible', { hasText: 'Sauvegardes Automatiques' }).count()) await t.clic(p.locator('button:visible', { hasText: '×' }).last());

    await t.chapitre('Exporter Tout / Importer Tout');
    await t.dire('« Exporter Tout » enregistre l\'ensemble du secours (main courante, sauveteurs, équipes, planning, points phones) dans UN fichier.',
        'Ce fichier sert à archiver le secours, à le transmettre, ou à le reprendre sur un autre PC si le premier tombe en panne.');
    await t.viser(t.bouton('Exporter Tout'));
    await t.rythme(2);
    await t.dire('« Importer Tout » recharge un tel fichier : on retrouve le secours exactement dans l\'état où il a été exporté.');
    await t.viser(t.bouton('Importer Tout'));
    await t.rythme(2);

    await t.chapitre('Le rapport de fin de mission');
    await t.dire('Dans le « Tableau de Bord », « Générer un Rapport » prépare le rapport de fin de mission.',
        'Il rassemble automatiquement les chiffres (sauveteurs, équipes, temps d\'engagement, main courante) : pas besoin de les recompter à la main.');
    await t.clic(t.bouton('Tableau de Bord'));
    await t.clic(t.bouton('Générer un Rapport'));
    await t.dire('Une prévisualisation s\'affiche. On la parcourt avant de l\'exporter en PDF (à imprimer, à envoyer) ou en Excel.');
    const corps = p.locator('div.overflow-y-auto:visible, div.overflow-auto:visible').last();
    for (let i = 0; i < 4; i++) { await corps.evaluate(el => el.scrollBy(0, 350)).catch(() => {}); await t.rythme(1.5); }
    await t.viser(t.bouton('Exporter en PDF'));
    await t.rythme(2);
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await t.clic(t.bouton('Main Courante'));

    await t.chapitre('Clôturer le secours');
    await t.dire('Quand le secours est terminé, « Clôturer le secours » (bouton rouge en haut) fixe l\'heure de fin.',
        'L\'heure de clôture figure dans le rapport et l\'export : elle marque officiellement la fin de l\'intervention.');
    await t.clic(t.bouton('Clôturer le secours'));
    await t.dire('On choisit l\'heure de clôture : juste après le dernier événement, ou l\'heure actuelle.');
    await t.clic(t.bouton('Dernier événement + 5 min'));
    await t.dire('Le secours est clôturé : l\'en-tête l\'indique. Un dossier clôturé peut être rouvert (« Rouvrir un dossier » au démarrage) : les informations et la clôture sont conservées.');
    await p.evaluate(() => window.scrollTo(0, 0));
    await t.rythme(4);
    if (process.env.FILM_RAPIDE) await t.decrire('07-fin');
});
