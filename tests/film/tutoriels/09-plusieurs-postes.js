// Film réseau 2 : plusieurs ordinateurs et tablettes en même temps — rôles différents par poste,
// saisies simultanées (numéros uniques), équipe créée au même instant sur deux postes (un refus),
// progression saisie sur une tablette et suivie sur une autre, ligne modifiée entre-temps,
// actions réservées au PC principal.
const { executer, simultane } = require('./outils');
const P = require('./preparation');

executer('09-plusieurs-postes', 'Plusieurs ordinateurs et tablettes en même temps', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma', 'PETIT Félix']);
    await P.pointsPhone(t);
    await t.debutFilm();
    const capture = async (poste, nom) => { if (process.env.FILM_RAPIDE) await poste.decrire('09-' + nom).catch(() => {}); };
    const valider = async (poste) => { const b = poste.page.locator('button:visible', { hasText: /✓ Valider \(/ }); if (await b.count()) await poste.clic(b); };
    // Un poste dont l'utilisateur est déjà renseigné (son nom sert aussi de nom de poste sur le PC)
    const ouvrir = async (url, options, utilisateur) => {
        const poste = await t.ouvrirPoste(url, options);
        await poste.page.evaluate(n => localStorage.setItem('ssf_current_secretaire', n), utilisateur);
        await poste.page.reload();
        await poste.page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await poste.page.waitForTimeout(1500);
        return poste;
    };

    await t.chapitre('Une organisation à plusieurs postes');
    await t.dire('Sur un gros secours, le PC n\'est pas tenu par une seule personne. Ici : le PC principal (Claire), un second ordinateur pour le secrétariat (Paul), une tablette pour la logistique (Lucas) et une tablette d\'affichage pour le COS.',
        'Chacun travaille sur le même secours, en même temps, depuis son appareil : plus d\'aller-retour de papiers ni de recopie, et tout le monde voit la même situation.');

    await t.chapitre('Préparer le PC principal');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Activer le mode réseau'));
    await p.waitForTimeout(1500);
    const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
    const code = await p.locator('span.font-mono.text-2xl').first().innerText();
    await t.dire('On coche « Autoriser la saisie sur les autres postes » : les postes qui se connectent pourront saisir directement.',
        'C\'est le réglage par défaut des nouveaux postes ; on pourra ensuite mettre un poste particulier en consultation seule.');
    await t.clic(p.locator('label:visible', { hasText: 'Autoriser la saisie sur les autres postes' }).locator('input'));
    await p.waitForTimeout(1000);
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Connecter les autres postes');
    await t.dire('Le second ordinateur ouvre l\'adresse du PC principal dans son navigateur et saisit le code de session.');
    const pc2 = await ouvrir(adresse + '/', { largeur: 1400, hauteur: 900, nom: 'Ordinateur 2 (secrétariat)' }, 'Paul MOREL');
    await pc2.saisir(pc2.page.locator('input[placeholder="000000"]'), code);
    await pc2.clic(pc2.bouton('Se connecter'));
    await pc2.page.waitForTimeout(2000);
    await t.dire('Les deux tablettes photographient le code QR affiché par le PC : elles se connectent directement, sans taper le code.');
    const tab1 = await ouvrir(`${adresse}/?code=${code}`, { nom: 'Tablette 1 (logistique)' }, 'Lucas BLANC');
    const tab2 = await ouvrir(`${adresse}/?code=${code}`, { nom: 'Tablette 2 (affichage COS)' }, 'Affichage COS');
    await t.rythme(2);
    await capture(tab1, 'tab1-connectee');

    await t.chapitre('Un rôle pour chaque poste');
    await t.dire('Sur le PC principal, « Postes connectés » liste les trois appareils, nommés d\'après leur utilisateur. Tous sont en « Saisie » ; la tablette d\'affichage du COS passe en « Consultation ».',
        'Un écran d\'affichage n\'a pas besoin de saisir : en consultation seule, une erreur de manipulation ne peut rien modifier.');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await capture(t, 'pc-3-postes');
    await t.choisir(p.locator('tr:visible', { hasText: 'Affichage COS' }).locator('select'), 'consultation');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await tab2.rythme(2);

    await t.chapitre('Saisir à plusieurs en même temps');
    await t.dire('Trois messages arrivent au même moment : chacun les tape sur son poste…');
    await t.saisir(t.champ('Description...'), 'Appel du COS : renfort de 6 sauveteurs du 30 en route.');
    await pc2.saisir(pc2.champ('Description...'), 'Appel de la mairie : gymnase ouvert pour l\'hébergement.');
    await tab1.saisir(tab1.champ('Description...'), 'Livraison du groupe électrogène au PC.');
    await t.dire('… et tous les trois valident EN MÊME TEMPS.');
    await simultane([[t, t.bouton(/^✓ ENREGISTRER$/)], [pc2, pc2.bouton(/^✓ ENREGISTRER$/)], [tab1, tab1.bouton(/^✓ ENREGISTRER$/)]]);
    await t.dire('Les trois lignes reçoivent des numéros différents et qui se suivent, attribués par le PC principal dans l\'ordre d\'arrivée. Elles apparaissent sur TOUS les postes, y compris la tablette d\'affichage.',
        'Jamais deux lignes avec le même numéro, jamais une ligne perdue : la main courante reste unique et fiable, même à plusieurs.');
    for (const poste of [t, pc2, tab1, tab2]) await poste.page.locator('table:visible').first().scrollIntoViewIfNeeded().catch(() => {});
    await t.rythme(5);
    await capture(tab2, 'tab2-lignes');
    for (const poste of [t, pc2, tab1, tab2]) await poste.page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

    await t.chapitre('Deux postes créent une équipe en même temps');
    await t.dire("Claire (PC principal) et Paul (ordinateur 2) préparent chacun une équipe. Les deux formulaires proposent le numéro 1.");
    const formulaire = async (poste, titre, membres, lieu) => {
        await poste.clic(poste.bouton(/^👥 Équipes$/));
        await poste.clic(poste.etiquette(lieu));
        await poste.saisir(poste.champ('Titre (ex: Reconnaissance Zone Nord)'), titre);
        const type = poste.page.locator('select:visible', { has: poste.page.locator('option', { hasText: 'Sélectionner un type' }) });
        if (!(await type.inputValue())) await poste.choisir(type, { index: 1 });
        for (const nom of membres) await poste.cocher(poste.etiquette(nom, { dernier: true }).locator('input[type="checkbox"]'));
    };
    const numero = (poste) => poste.page.locator('select:visible', { has: poste.page.locator('option[value="3"]') }).first();
    await formulaire(t, 'Reconnaissance du P40', ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé'], 'Sous terre');
    await formulaire(pc2, 'Logistique surface', ['ROBERT Emma', 'PETIT Félix'], 'Surface');
    await t.dire("Paul valide le premier : son équipe devient l'équipe 1.");
    await pc2.clic(pc2.bouton("Créer l'Équipe"));
    await t.viser(numero(t));
    await t.dire("Sur le PC principal, le formulaire de Claire, resté ouvert, est passé tout seul au numéro 2 : le numéro 1 vient d'être pris sur un autre poste.",
        "Si deux postes validaient exactement au même instant le même numéro, le PC principal n'en enregistrerait qu'un et l'autre poste recevrait un refus clair (« existe déjà »). Jamais deux « Équipe 1 » différentes.");
    await capture(t, 'pc-numero-2');
    await t.clic(t.bouton("Créer l'Équipe"));
    await t.dire("Claire valide : son équipe devient l'équipe 2. Les deux équipes apparaissent sur tous les postes.");
    for (const poste of [t, pc2]) await poste.clic(poste.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Saisir sur une tablette, suivre sur une autre');
    await t.dire('Lucas (tablette 1) note le départ de l\'équipe 2 (reconnaissance du P40) : « Équipe 2 », bouton « Départ PC », puis il valide.');
    await tab1.saisir(tab1.champ('T1...'), 'Équipe 2');
    await tab1.clic(tab1.etiquette('Départ PC'));
    await tab1.saisir(tab1.champ('Description...'), 'Départ de l\'équipe 2 vers le P40.');
    await tab1.clic(tab1.bouton(/^✓ ENREGISTRER$/));
    await valider(tab1);
    await t.dire('Sur la tablette d\'affichage, le COS ouvre la « Synthèse Affectations » : il voit combien de sauveteurs sont en approche, sous terre, disponibles… et qui.',
        'Le COS suit la situation en direct, sans déranger le secrétariat.');
    await tab2.clic(tab2.bouton('Synthèse Affectations'));
    await tab2.rythme(5);
    await tab2.page.mouse.wheel(0, 500);
    await tab2.rythme(3);
    await capture(tab2, 'tab2-synthese');
    await tab2.clic(tab2.bouton('Main Courante'));

    await t.chapitre('Une ligne modifiée par quelqu\'un d\'autre');
    await t.dire('Claire ouvre une ligne pour la corriger… pendant que Paul corrige la même ligne sur l\'ordinateur 2.');
    const ligneMairie = (poste) => poste.page.locator('tr:visible', { hasText: 'gymnase ouvert' }).first();
    await t.clic(ligneMairie(t).locator('button[title="Modifier cet événement"]'));
    await pc2.clic(ligneMairie(pc2).locator('button[title="Modifier cet événement"]'));
    const fenetreModif = (poste) => poste.page.locator('div.bg-white:visible', { has: poste.page.locator('h2', { hasText: 'Modifier l\'événement' }) }).last();
    await pc2.completer(fenetreModif(pc2).locator('textarea').first(), ' Capacité : 80 lits.');
    await pc2.clic(pc2.bouton('💾 Enregistrer'));
    await t.dire('Sur le PC principal, la fenêtre de modification avertit aussitôt : « Cette ligne a été modifiée sur un autre poste ». Claire annule et reprend la version à jour.',
        'Sans cet avertissement, Claire aurait écrasé la correction de Paul sans le savoir.');
    await t.rythme(3);
    await capture(t, 'pc-modifiee-ailleurs');
    await t.clic(t.bouton('Annuler', { dernier: true }));

    await t.chapitre('Ce que seul le PC principal peut faire');
    await t.dire('Lucas tente de clôturer le secours depuis sa tablette. Il choisit l\'heure de clôture…',
        'Restent réservés au PC principal : les informations et la clôture du secours, les imports, les remises à zéro, les secrétaires et les réglages du planning. Les décisions qui engagent tout le secours restent entre les mains du poste maître.');
    await tab1.clic(tab1.bouton('Clôturer le secours'));
    const choix = tab1.page.locator('button:visible', { hasText: 'Dernier événement + 5 min' });
    if (await choix.count()) await tab1.clic(choix);
    await t.dire('… et le PC principal refuse : un message l\'explique sur la tablette, et le secours n\'est pas clôturé.');
    await tab1.rythme(3);
    await capture(tab1, 'tab1-cloture-refusee');
    if (await tab1.bouton('Annuler', { dernier: true }).count()) await tab1.clic(tab1.bouton('Annuler', { dernier: true })).catch(() => {});
    await t.dire('À la fin, « Désactiver » dans la fenêtre « Mode réseau » du PC principal déconnecte tous les autres postes d\'un coup.');
    await t.rythme(3);
}, { debut: 'reel' });
