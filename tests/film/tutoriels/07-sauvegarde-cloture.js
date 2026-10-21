// Film 8 : sauvegarder (sauvegardes automatiques, Exporter / Importer Tout et leurs fenêtres),
// importer les événements d'une main courante secondaire (direct, ou avec aperçu), rapport de fin
// de mission, clôture du secours (et sa ligne de main courante).
const fs = require('fs');
const path = require('path');
const { executer } = require('./outils');
const P = require('./preparation');

executer('07-sauvegarde-cloture', 'Sauvegarder, faire le rapport et clôturer', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David']);
    await P.pointsPhone(t);
    await P.creerEquipe(t, { titre: 'Reconnaissance du P40', membres: ['MARTIN Alice', 'BERNARD Bruno'] });
    // Le secours a duré un moment : les mains courantes secondaires (8 h 05 à 8 h 40) sont passées
    await p.clock.fastForward(60 * 60000);
    await t.saisir(t.champ('Description...'), 'Victime remontée et prise en charge par le Samu. Fin des opérations sous terre.');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await t.debutFilm();

    // Fenêtres de Windows (enregistrer, ouvrir un fichier) : elles ne peuvent pas être filmées,
    // un message à l'écran dit ce qui s'ouvre
    const windows = (texte) => p.evaluate((x) => window.__film && window.__film.message('💻 Fenêtre de Windows', x, 7000), texte);
    const ligne = (texte) => p.locator('tbody tr:visible', { hasText: texte }).first();
    const voirLigne = async (texte, explication, pourquoi) => {
        const l = ligne(texte);
        await l.scrollIntoViewIfNeeded();
        await t.viser(l);
        if (process.env.FILM_RAPIDE) console.log('MC ▸ ' + (await l.innerText()).replace(/\s+/g, ' '));
        await t.dire(explication, pourquoi);
    };
    const haut = () => p.evaluate(() => window.scrollTo(0, 0));

    await t.chapitre('Les sauvegardes automatiques');
    await t.dire('Tout ce qui est saisi est enregistré immédiatement sur le PC. En plus, l\'application fait des copies de sécurité régulières.',
        'Si un fichier est abîmé ou une fausse manipulation faite, on peut revenir à une copie récente.');
    await t.clic(t.bouton('Sauvegardes auto'));
    await t.dire('On choisit l\'intervalle (30 minutes ou 1 heure). « Sauvegarder maintenant » fait une copie tout de suite, par exemple avant une opération délicate.');
    await t.clic(t.bouton('Sauvegarder maintenant'));
    await t.dire('Les copies apparaissent dans la liste, avec leur heure : chacune peut être restaurée.');
    await t.rythme(2);
    await p.keyboard.press('Escape');
    await t.rythme(1);
    if (await p.locator('h2:visible', { hasText: 'Sauvegardes Automatiques' }).count()) await t.clic(p.locator('button:visible', { hasText: '×' }).last());

    await t.chapitre('Exporter Tout');
    await t.dire('« Exporter Tout » enregistre l\'ensemble du secours (main courante, sauveteurs, équipes, planning, points phones) dans un seul fichier.',
        'C\'est une copie complète du secours : pour le reprendre sur un autre PC, l\'archiver, ou le transmettre à certains organismes (le CTN, le SSF national…).');
    const avant = new Set(fs.readdirSync(t.telechargements));
    await t.clic(t.bouton('Exporter Tout'));
    await p.waitForTimeout(500);
    const fichierExport = fs.readdirSync(t.telechargements).find(f => !avant.has(f));
    const nomExport = fichierExport ? fichierExport.replace(/^\d+-/, '') : 'SSF_Unifie_….json';
    await windows(`« Enregistrer sous » : on choisit où ranger le fichier (clé USB, dossier partagé…). Nom proposé : ${nomExport}`);
    await t.dire('Windows ouvre la fenêtre « Enregistrer sous » : on choisit l\'endroit, par exemple une clé USB. Le nom proposé contient le nom du secours et la date.');
    await t.dire('L\'application confirme ensuite : « Données exportées avec succès ».');

    await t.chapitre('Importer Tout');
    await t.dire('« Importer Tout » recharge un tel fichier, par exemple sur un autre PC : on retrouve le secours exactement dans l\'état où il a été exporté.');
    const importTout = p.locator('label:visible', { hasText: 'Importer Tout' });
    await t.viser(importTout);
    await windows('« Ouvrir » : on choisit le fichier exporté (ici ' + nomExport + ').');
    await t.dire('Un clic ouvre la fenêtre « Ouvrir » de Windows : on choisit le fichier exporté.');
    await importTout.locator('input[type="file"]').setInputFiles(path.join(t.telechargements, fichierExport));
    if (process.env.FILM_RAPIDE) await t.decrire('07-import-tout');
    await t.rythme(1);
    await t.dire('L\'application prévient : l\'importation remplace toutes les données actuelles. On confirme, puis elle indique « Données importées avec succès ».',
        'Sur un PC qui contient déjà un autre secours, il faut donc d\'abord créer ou ouvrir le bon dossier avant d\'importer.');
    await t.vite(() => t.clic(t.bouton(/Main Courante/)));
    await t.viser(p.locator('tbody:visible').first());
    await t.dire('La main courante, les sauveteurs, les équipes et le planning sont rechargés tels qu\'ils étaient au moment de l\'export.');
    await haut();

    await t.chapitre('Importer les événements d\'une main courante secondaire');
    await t.dire('Un PC Base Arrière ou un véhicule peut tenir sa propre main courante secondaire (MC2, VEHICULE1…). À la fin, il exporte ses événements dans un fichier.',
        'Le PC de terrain les ajoute à sa main courante principale : tout le secours se retrouve dans un seul journal, dans l\'ordre chronologique.');
    await t.dire('Première façon : « Importer Événements ». Un clic ouvre la fenêtre « Ouvrir » de Windows, on choisit le fichier.');
    const importEv = p.locator('label:visible', { hasText: 'Importer Événements' });
    await t.viser(importEv);
    await windows('« Ouvrir » : on choisit le fichier de la main courante secondaire (ici SSF_Events_VEHICULE1….json).');
    await importEv.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'mc-secondaire-VEHICULE1.json'));
    await t.rythme(1);
    await t.dire('L\'application demande confirmation : combien d\'événements, de quelle main courante, et la date de l\'export. Les événements sont ensuite insérés à leur heure.');
    await voirLigne('Arrivée au parking de la cavité',
        'Les lignes de VEHICULE1 se rangent parmi celles du PC, à leur heure, avec leur numéro d\'origine (VEHICULE1-001, VEHICULE1-002) et leur secrétaire.');
    await haut();

    await t.dire('Deuxième façon, plus sûre : « Importer MC (aperçu) ». On voit le résultat de la fusion avant de confirmer.');
    await t.clic(t.bouton('Importer MC (aperçu)'));
    const fenetreMC = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Importer et Fusionner' }) }).last();
    await t.dire('La fenêtre rappelle les étapes : choisir le fichier, vérifier l\'aperçu, confirmer.');
    await t.viser(fenetreMC.locator('input[type="file"]'));
    await p.evaluate(() => window.__film && window.__film.message('💻 Fenêtre de Windows', '« Ouvrir » : on choisit le fichier de MC2.', 3000));
    await fenetreMC.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'mc-secondaire-MC2.json'));
    await t.rythme(1);
    await t.vite(() => t.viser(fenetreMC.locator('h3', { hasText: 'Fichier chargé' })));
    await t.dire('Le fichier est lu : main courante MC2, deux événements.');
    const apercu = fenetreMC.locator('table').first();
    await apercu.scrollIntoViewIfNeeded();
    await t.vite(() => t.viser(apercu));
    if (process.env.FILM_RAPIDE) await t.decrire('07-apercu');
    await t.dire('L\'aperçu montre la fusion dans l\'ordre chronologique, avec l\'origine de chaque ligne. « Retour » annule sans rien modifier.');
    await t.clic(fenetreMC.locator('button', { hasText: 'Confirmer la Fusion' }));
    await voirLigne('Matériel de pompage chargé',
        'Les événements de MC2 sont dans la main courante principale, avec leur numéro d\'origine (MC2-001, MC2-002) et leur heure.');
    await haut();

    await t.chapitre('Le rapport de fin de mission');
    await t.dire('Dans le « Tableau de Bord », « Générer un Rapport » prépare le rapport de fin de mission.',
        'Il rassemble automatiquement les chiffres (sauveteurs, équipes, temps d\'engagement, main courante) : pas besoin de les recompter à la main.');
    await t.clic(t.bouton('Tableau de Bord'));
    await t.clic(t.bouton('Générer un Rapport'));
    await t.dire('Une prévisualisation s\'affiche. On la parcourt avant de l\'exporter en PDF (à imprimer, à envoyer) ou en Excel.');
    const corps = p.locator('div.overflow-y-auto:visible, div.overflow-auto:visible').last();
    for (let i = 0; i < 4; i++) { await corps.evaluate(el => el.scrollBy(0, 350)).catch(() => {}); await t.rythme(1.2); }
    await t.viser(t.bouton('Exporter en PDF'));
    await t.rythme(1.5);
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await t.clic(t.bouton(/Main Courante/));

    await t.chapitre('Clôturer le secours');
    await t.dire('Quand le secours est terminé, « Clôturer le secours » (bouton rouge en haut) fixe l\'heure de fin.',
        'L\'heure de clôture figure dans le rapport et l\'export : elle marque officiellement la fin de l\'intervention.');
    await t.clic(t.bouton('Clôturer le secours'));
    await t.dire('On choisit l\'heure de clôture : juste après le dernier événement, ou l\'heure actuelle.');
    await t.clic(t.bouton('Dernier événement + 5 min'));
    await voirLigne('CLÔTURE DU SECOURS',
        'Une ligne est écrite automatiquement dans la main courante : « Clôture du secours », avec le nom de la cavité et l\'heure de clôture. Elle est marquée importante.');
    await haut();
    await t.dire('Le secours est clôturé : l\'en-tête l\'indique. Un dossier clôturé peut être rouvert (« Rouvrir un dossier » au démarrage) : les informations et la clôture sont conservées.');
    await t.rythme(2);

    await t.chapitre('Rappel : le mode maintenance');
    const maintenance = p.locator('#toggle-maintenance');
    await t.viser(p.locator('label[for="toggle-maintenance"]'));
    await t.dire('En haut à droite, la case « Mode maintenance » est réservée au responsable de l\'application.',
        'Elle donne accès à des boutons qui effacent des données sans retour possible : la main courante, document officiel du secours, serait perdue.');
    await t.cocher(maintenance);
    await t.viser(t.bouton('RESET APPLI'));
    await t.dire('« Reset appli » efface toutes les données du secours ouvert.');
    await t.viser(t.bouton('VIDER STORAGE'));
    await t.dire('« Vider storage » efface tous les secours enregistrés sur ce PC.',
        'Le responsable ne s\'en sert que pour préparer un PC, après avoir archivé les secours avec « Exporter Tout », et jamais pendant un secours.');
    await t.vite(() => t.clic(maintenance));
    await t.dire('On décoche la case : les boutons disparaissent. Un secrétaire n\'a jamais à s\'en servir.');
    await t.rythme(2);
    if (process.env.FILM_RAPIDE) await t.decrire('07-fin');
});
