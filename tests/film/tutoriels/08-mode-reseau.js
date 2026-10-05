// Film 8 : le mode réseau — activer le mode réseau sur le PC principal, connecter une tablette
// (adresse, code de session, code QR), rôles (consultation / saisie), saisie depuis la tablette,
// changement de code, coupure du réseau.
const { executer } = require('./outils');
const P = require('./preparation');

executer('08-mode-reseau', 'Le mode réseau : connecter une tablette', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé']);
    await P.pointsPhone(t);
    await t.saisir(t.champ('Description...'), 'Point de situation : 3 sauveteurs sur site.');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await t.debutFilm();
    const capture = async (poste, nom) => { if (process.env.FILM_RAPIDE) await poste.decrire('08-' + nom).catch(() => {}); };

    await t.chapitre('Le principe');
    await t.dire('Le mode réseau permet à d\'autres appareils (PC, tablette, téléphone) de suivre le secours et d\'y saisir, depuis un simple navigateur, sans rien installer.',
        'Le PC principal reste le seul à enregistrer les données : les autres postes passent par lui. Il suffit d\'un réseau local (box, routeur Wi-Fi ou partage de connexion), sans Internet.');

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
    await t.dire('Si un autre poste n\'arrive pas à se connecter, vérifier que le pare-feu de Windows autorise l\'application SSF sur ce PC.');

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
        'Ce nom signe les lignes saisies depuis la tablette. Sur le PC, la tablette apparaît sous son adresse (« Poste 192.168… »).');
    await tab.clic(tab.page.locator('button:visible', { hasText: /^🔄$/ }).first());
    await tab.saisir(tab.champ('Ex: Martin DUPONT').or(tab.page.locator('input:visible').last()), 'Lucas BLANC');
    await tab.clic(tab.bouton(/^✓ Enregistrer$/));
    await t.dire('La tablette est connectée : elle affiche le même secours que le PC (bandeau « Connecté au poste principal »). Par défaut, elle est en CONSULTATION SEULE.',
        'Par prudence, un nouveau poste peut tout voir mais rien modifier tant que le PC principal ne l\'a pas autorisé.');
    await capture(tab, 'tablette-consultation');

    await t.chapitre('Autoriser la saisie sur la tablette');
    await t.dire('Sur le PC, la liste « Postes connectés » montre la tablette. Son rôle se choisit poste par poste : « Consultation » ou « Saisie ».');
    await capture(t, 'pc-postes');
    const ligneTablette = p.locator('tr:visible').filter({ has: p.locator('select') }).last();
    await t.choisir(ligneTablette.locator('select'), 'saisie');
    await t.dire('La tablette passe en « Poste de saisie ». La case « Autoriser la saisie sur les autres postes » donne ce rôle par défaut à tous les postes qui se connecteront ensuite.',
        'Restent réservés au PC principal : les informations et la clôture du secours, les imports, les remises à zéro, les secrétaires et les réglages du planning.');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Saisir depuis la tablette');
    await t.dire('Sur la tablette, on remplit la main courante comme sur le PC : ici, l\'équipe de reconnaissance appelle depuis le point B.');
    await tab.saisir(tab.champ('Description...'), 'Appel radio de MARTIN Alice : arrivée au P40, tout va bien.');
    await tab.clic(tab.bouton(/^✓ ENREGISTRER$/));
    await tab.page.waitForTimeout(1500);
    await t.dire('La ligne apparaît aussitôt sur le PC principal, avec son numéro, l\'heure, et le nom du poste qui l\'a saisie.',
        'Les numéros et les heures sont donnés par le PC principal : même si plusieurs postes saisissent en même temps, il n\'y a jamais deux fois le même numéro.');
    await p.locator('table:visible').first().scrollIntoViewIfNeeded().catch(() => {});
    await t.rythme(4);
    await capture(t, 'pc-ligne-tablette');
    await p.evaluate(() => window.scrollTo(0, 0));

    await t.chapitre('Changer le code de session');
    await t.dire('Si le code a été divulgué, ou en fin de secours, « Changer le code » sur le PC en crée un nouveau : tous les autres postes sont déconnectés et doivent saisir le nouveau code.');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Changer le code'));
    await p.waitForTimeout(2000);
    const nouveau = await p.locator('span.font-mono.text-2xl').first().innerText();
    await t.dire(`Nouveau code : ${nouveau}. La tablette redemande le code ; on le saisit pour la reconnecter.`);
    await tab.rythme(2);
    await tab.saisir(tab.page.locator('input[placeholder="000000"]'), nouveau);
    await tab.clic(tab.bouton('Se connecter'));
    await tab.page.waitForTimeout(2000);
    await capture(tab, 'tablette-reconnectee');
    await t.dire('La tablette est reconnectée, mais de nouveau en consultation seule : après un changement de code, le rôle « Saisie » est à redonner dans la liste des postes (ou cocher « Autoriser la saisie sur les autres postes »).',
        'Changer le code remet tout à plat : aucun appareil ne garde un droit de saisie sans que le PC principal le lui redonne.');

    await t.chapitre('Si le réseau est coupé');
    await t.dire('On simule une coupure : le PC désactive le mode réseau. La tablette affiche « Connexion perdue » et bloque la saisie.',
        'Une ligne tapée hors connexion n\'est jamais envoyée en retard sans contrôle : la tablette propose d\'en garder une copie de secours, à recopier quand la connexion revient.');
    await t.clic(t.bouton(/^Désactiver$/));
    await p.waitForTimeout(2000);
    await tab.saisir(tab.champ('Description...'), 'Message tapé pendant la coupure.');
    await tab.clic(tab.bouton(/^✓ ENREGISTRER$/));
    await tab.rythme(3);
    await capture(tab, 'tablette-hors-ligne');
    await t.dire('Quand le mode réseau est réactivé, la tablette se reconnecte toute seule.');
    await t.clic(t.bouton('Activer le mode réseau'));
    await tab.page.waitForTimeout(12000);
    await capture(tab, 'tablette-retour');
    await t.dire('En fin d\'utilisation, « Désactiver » sur le PC coupe l\'accès de tous les autres postes.');
    await t.rythme(3);
}, { debut: 'reel' }); // heure réelle : le PC principal date les lignes des autres postes à l'heure réelle
