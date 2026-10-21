// Film 9 : le mode réseau — activer le mode réseau sur le PC principal, connecter une tablette
// (adresse, code de session, code QR), postes connectés et rôles (consultation / saisie), partage
// du travail (message et arrivée saisis sur la tablette, équipe créée sur le PC, progression sur la
// tablette) avec le résultat aussitôt visible sur l'autre poste, coupure du réseau pendant une
// saisie et retour de la connexion, changement de code.
const { executer } = require('./outils');
const P = require('./preparation');

executer('08-mode-reseau', 'Le mode réseau : connecter une tablette', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé']);
    await P.pointsPhone(t);
    await t.debutFilm();
    const capture = async (poste, nom) => { if (process.env.FILM_RAPIDE) await poste.decrire('08-' + nom).catch(() => {}); };

    // Sur un poste : la ligne de main courante voulue (la plus récente qui contient ce texte)
    const voirLigne = async (poste, texte, explication, pourquoi) => {
        await poste.vite(() => poste.clic(poste.bouton(/Main Courante/)));
        const l = poste.page.locator('tbody tr:visible', { hasText: texte }).first();
        await l.waitFor({ timeout: 10000 }).catch(() => {});
        await l.scrollIntoViewIfNeeded().catch(() => {});
        await poste.viser(l);
        if (process.env.FILM_RAPIDE) console.log('MC ▸ ' + (await l.innerText().catch(() => '?')).replace(/\s+/g, ' '));
        await t.dire(explication, pourquoi);
        await poste.page.evaluate(() => window.scrollTo(0, 0));
    };
    // Planning du PC : grille défilée jusqu'à l'heure actuelle, ligne du sauveteur entourée
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
        const l = p.locator('tr:visible', { hasText: nom }).first();
        await l.scrollIntoViewIfNeeded();
        await t.viser(l);
        await t.dire(explication, pourquoi);
        await t.vite(() => t.clic(t.bouton(/Main Courante/)));
    };
    // Fenêtre « Mode réseau » du PC : liste des postes connectés, en bas de la fenêtre
    const postesConnectes = async (explication, pourquoi) => {
        const titre = p.locator('text=/Postes connectés/').first();
        await titre.scrollIntoViewIfNeeded();
        // Liste vide (aucun poste) : pas de tableau, on n'attend rien
        const liste = p.locator('table:visible').filter({ has: p.locator('select') });
        await t.viser(titre);
        if (await liste.count()) {
            await liste.last().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
            await t.viser(liste.last());
        }
        await t.dire(explication, pourquoi);
    };
    const enregistrer = (poste) => poste.clic(poste.bouton(/^✓ ENREGISTRER$/));
    const valider = async (poste) => {
        const b = poste.page.locator('button:visible', { hasText: /✓ Valider \(/ });
        await b.first().waitFor({ timeout: 5000 }).catch(() => {});
        if (await b.count()) await poste.clic(b);
    };

    await t.chapitre('Le principe');
    await t.dire('Le mode réseau permet à d\'autres appareils (PC, tablette, téléphone) de suivre le secours et d\'y saisir, depuis un simple navigateur, sans rien installer.',
        'Le PC principal reste le seul à enregistrer les données : les autres postes passent par lui. Il suffit d\'un réseau local (box, routeur Wi-Fi ou partage de connexion), sans Internet.');
    await t.dire('On peut ainsi se partager le travail : une personne tient la main courante, une autre les inscriptions, une autre les équipes. Chacun voit aussitôt ce que les autres saisissent.');

    await t.chapitre('Activer le mode réseau sur le PC principal');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.dire('La fenêtre « Mode réseau » s\'ouvre. On clique sur « Activer le mode réseau ».');
    await t.clic(t.bouton('Activer le mode réseau'));
    await p.waitForTimeout(1500);
    const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
    const code = await p.locator('span.font-mono.text-2xl').first().innerText();
    await t.dire(`Le PC affiche : l'adresse à ouvrir dans le navigateur des autres postes (${adresse}), un code QR, et un code de session à 6 chiffres (${code}).`,
        'Le code de session empêche qu\'un appareil qui passe sur le même réseau se connecte au secours : seuls ceux à qui on donne le code peuvent entrer.');
    await capture(t, 'pc-actif');
    await postesConnectes('En bas de la fenêtre, la liste « Postes connectés » est encore vide : « Aucun autre poste connecté ».');

    await t.chapitre('Connecter la tablette');
    await t.dire('Sur la tablette, on ouvre le navigateur (Chrome, Safari, Edge…) et on tape l\'adresse affichée par le PC. Elle apparaît à droite.',
        'Plus simple encore : photographier le code QR avec la tablette ouvre directement la bonne adresse, code de session compris.');
    const tab = await t.ouvrirTablette(adresse + '/');
    await tab.rythme(2);
    await capture(tab, 'tablette-code');
    await t.dire('La tablette demande le code de session. On tape les 6 chiffres affichés par le PC.');
    await tab.saisir(tab.page.locator('input[placeholder="000000"]'), code);
    await tab.clic(tab.bouton('Se connecter'));
    await tab.page.waitForTimeout(2000);
    await capture(tab, 'tablette-connectee');
    await t.dire('Sur la tablette, on indique qui l\'utilise : bouton 🔄 à côté de « Secrétaire ».',
        'Ce nom signe les lignes saisies depuis la tablette.');
    await tab.clic(tab.page.locator('button:visible', { hasText: /^🔄$/ }).first());
    await tab.saisir(tab.champ('Ex: Martin DUPONT').or(tab.page.locator('input:visible').last()), 'Lucas BLANC');
    await tab.clic(tab.bouton(/^✓ Enregistrer$/));
    await t.dire('La tablette est connectée : elle affiche le même secours que le PC (bandeau « Connecté au poste principal »). Par défaut, elle est en consultation seule.',
        'Par prudence, un nouveau poste peut tout voir mais rien modifier tant que le PC principal ne l\'a pas autorisé.');
    await capture(tab, 'tablette-consultation');

    await t.chapitre('Autoriser la saisie sur la tablette');
    await postesConnectes('Sur le PC, en bas de la fenêtre « Mode réseau », la tablette apparaît dans les postes connectés, sous son adresse (« Poste 192.168… »). Son rôle se choisit poste par poste : « Consultation » ou « Saisie ».');
    await capture(t, 'pc-postes');
    const ligneTablette = p.locator('tr:visible').filter({ has: p.locator('select') }).last();
    await t.choisir(ligneTablette.locator('select'), 'saisie');
    await t.viser(ligneTablette);
    await t.dire('La tablette passe en « Poste de saisie ». La case « Autoriser la saisie sur les autres postes » donne ce rôle par défaut à tous les postes qui se connecteront ensuite.',
        'Restent réservés au PC principal : les informations et la clôture du secours, les imports, les remises à zéro, les secrétaires et les réglages du planning.');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('La tablette tient la main courante');
    await t.dire('Sur la tablette, on saisit un message comme sur le PC : « Message venant de », « Message à destination de », et le texte mot pour mot.');
    await tab.vite(async () => {
        await tab.saisir(tab.champ('Nom...', 1), 'Mairie de Lanville');
        await tab.saisir(tab.champ('Nom...', 0), 'Conseiller technique');
    });
    await tab.saisir(tab.champ('Description...'), 'La salle des fêtes est ouverte pour accueillir les familles.');
    await enregistrer(tab);
    await voirLigne(t, 'salle des fêtes est ouverte',
        'Sur le PC principal, la ligne apparaît aussitôt : son numéro, l\'heure, le secrétaire de la tablette (Lucas BLANC), le message, et la mention « Saisie sur Poste… ».',
        'Les numéros et les heures sont donnés par le PC principal : même si plusieurs postes saisissent en même temps, il n\'y a jamais deux fois le même numéro.');
    await capture(t, 'pc-ligne-tablette');

    await t.chapitre('La tablette inscrit un sauveteur');
    await t.dire('Un renfort arrive : THOMAS David. La personne à la tablette l\'inscrit, pendant que le PC continue son travail.');
    await P.arrivees(tab, ['THOMAS David']);
    await voirLigne(t, 'Arrivée de : THOMAS David',
        'Sur le PC, la ligne automatique « Arrivée de : THOMAS David » est déjà dans la main courante.');
    await voirPlanning('THOMAS David',
        'Et le planning du PC a une nouvelle ligne : THOMAS David, « Disponible » depuis son arrivée.');

    await t.chapitre('Le PC crée une équipe');
    await t.dire('Pendant ce temps, au PC, on crée l\'équipe 1 avec MARTIN Alice et BERNARD Bruno.');
    await t.vite(() => P.creerEquipe(t, { titre: 'Reconnaissance du P40', membres: ['MARTIN Alice', 'BERNARD Bruno'] }));
    await voirLigne(tab, 'Création Équipe 1',
        'Sur la tablette, la ligne « Création Équipe 1 » est arrivée d\'elle-même : la tablette sait que l\'équipe existe et peut suivre sa progression.');

    await t.chapitre('La tablette suit la progression');
    await t.dire('L\'équipe 1 appelle : elle quitte le PC. Sur la tablette : « Équipe 1 », puis « Départ PC ». Pas de texte : l\'équipe et le point phone suffisent.');
    await tab.saisir(tab.champ('T1...'), 'Équipe 1');
    await tab.clic(tab.etiquette('Départ PC'));
    await enregistrer(tab);
    await valider(tab);
    await voirLigne(t, 'Départ du PC',
        'Sur le PC, la ligne de progression de l\'équipe 1 est arrivée : « Départ du PC », point phone PC. Juste au-dessus, une ligne automatique note l\'activité « Approche » au planning.');
    await voirPlanning('MARTIN Alice',
        'Le planning du PC est à jour lui aussi : MARTIN Alice et BERNARD Bruno sont en « Approche ».',
        'Peu importe le poste qui saisit : tous les écrans montrent le même secours, au même moment.');

    await t.chapitre('Si le réseau est coupé');
    await t.dire('On simule une coupure : le PC désactive le mode réseau. La tablette affiche « Connexion perdue ».');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton(/^Désactiver$/));
    await t.vite(() => t.clic(t.bouton(/^Fermer$/, { dernier: true })));
    await p.waitForTimeout(2000);
    await capture(tab, 'tablette-coupee');
    await t.dire('À ce moment, l\'équipe 1 appelle du point A : elle entre sous terre. Le secrétaire de la tablette tape la ligne.');
    await tab.vite(async () => {
        await tab.saisir(tab.champ('T1...'), 'Équipe 1');
        await tab.saisir(tab.champ('A, B...'), 'A');
    });
    await tab.clic(tab.etiquette('Entre sous terre'));
    await enregistrer(tab);
    await tab.rythme(1);
    await capture(tab, 'tablette-hors-ligne');
    await t.dire('La tablette refuse : « Hors ligne : saisie impossible ». La ligne n\'est pas envoyée, mais ce qui a été tapé reste dans le formulaire.',
        'Rien n\'est envoyé plus tard sans contrôle. Si le PC principal est hors service, « Copie de secours » télécharge la dernière version du secours, à importer sur un autre ordinateur.');
    await t.dire('Le réseau revient : le PC réactive le mode réseau. La tablette se reconnecte toute seule.');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Activer le mode réseau'));
    await tab.page.locator('text=Connecté au poste principal').first().waitFor({ timeout: 30000 }).catch(() => {});
    await tab.page.waitForTimeout(1500);
    await capture(tab, 'tablette-retour');
    await postesConnectes('La tablette est de nouveau dans les postes connectés, avec son rôle « Saisie ».');
    await t.vite(() => t.clic(t.bouton(/^Fermer$/, { dernier: true })));
    await t.dire('Sur la tablette, la ligne attend toujours : on clique de nouveau sur « Enregistrer ».');
    await enregistrer(tab);
    await valider(tab);
    await voirLigne(t, 'Entre sous terre',
        'La ligne arrive sur le PC, avec l\'heure à laquelle elle a été enregistrée. Si l\'appel datait de plusieurs minutes, on le précise dans le texte.');
    await voirPlanning('MARTIN Alice', 'Et le planning du PC passe l\'équipe 1 en « Sous Terre ».');

    await t.chapitre('Changer le code de session');
    await t.dire('Si le code a été divulgué, ou en fin de secours, « Changer le code » sur le PC en crée un nouveau : tous les autres postes sont déconnectés et doivent saisir le nouveau code.');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Changer le code'));
    await p.waitForTimeout(2000);
    const nouveau = await p.locator('span.font-mono.text-2xl').first().innerText();
    await t.dire(`Nouveau code : ${nouveau}. La tablette redemande le code ; on le saisit pour la reconnecter.`);
    await tab.rythme(1);
    await tab.saisir(tab.page.locator('input[placeholder="000000"]'), nouveau);
    await tab.clic(tab.bouton('Se connecter'));
    await tab.page.waitForTimeout(2000);
    await capture(tab, 'tablette-reconnectee');
    await postesConnectes('La tablette est reconnectée, mais de nouveau en consultation seule : après un changement de code, le rôle « Saisie » est à redonner dans la liste des postes.',
        'Changer le code remet tout à plat : aucun appareil ne garde un droit de saisie sans que le PC principal le lui redonne.');
    await t.dire('En fin d\'utilisation, « Désactiver » sur le PC coupe l\'accès de tous les autres postes.');
    await t.viser(t.bouton(/^Désactiver$/));
    await t.rythme(2);
}, { debut: 'reel' }); // heure réelle : le PC principal date les lignes des autres postes à l'heure réelle
