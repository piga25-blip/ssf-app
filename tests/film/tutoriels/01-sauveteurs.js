// Film 1 : inscrire les sauveteurs — les façons de récupérer la liste des sauveteurs (base
// nationale en direct, export Excel de la base, fichier CSV), sauveteur non inscrit sur la liste,
// arrivée sur site et départ, avec ce qu'ils écrivent dans la main courante et au planning.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { executer, RACINE } = require('./outils');
const { creerDossier } = require('./preparation');

// Export Excel de la base nationale (colonnes du vrai fichier, noms fictifs) ; le nom du fichier
// donne le département (SSF-34)
const exportBaseNationale = () => {
    const XLSX = require(path.join(RACINE, 'libs', 'xlsx.full.min.js'));
    const titres = ['ID', 'Nom', 'Prenom', 'Sexe', 'Adresse', 'CPVille', 'Telperso', 'Teltravail', 'TelPortable', 'Email', 'Fonction CT',
        'ChefEquipeEvac', 'ChefEquipeASV', 'Medecin', 'Infirmier', 'Gestion', 'ASV', 'Transmission', 'Evacuation', 'Desobstruction', 'CPT',
        'Plongee', 'Pompage', 'Ventilation', 'Logistique', 'EauxVives', 'Mines', 'Operationnel', 'SpecialiteMedicale', 'Licence', 'Divers', 'TAGS', 'ID_AVEN2', 'Fédéré à date'];
    // spécialités dans l'ordre des colonnes ChefEquipeEvac … Mines
    const ligne = (id, nom, prenom, fonction, s, operationnel = 1) =>
        [id, nom, prenom, '', '', '', '', '', '', '', fonction, ...s, operationnel, '', '', '', '', '', 1];
    const feuille = XLSX.utils.aoa_to_sheet([titres,
        ligne(3401, 'MARTIN', 'Alice', 'CTDS', [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
        ligne(3402, 'BERNARD', 'Bruno', '', [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
        ligne(3403, 'DURAND', 'Gaëlle', '', [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        ligne(3404, 'PETIT', 'Félix', '', [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
        ligne(3405, 'LEROY', 'Hugo', '', [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0], 0),
        ligne(3406, 'MOREAU', 'Julie', '', [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]),
    ]);
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, 'Liste');
    const fichier = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-tuto-base-')), 'Liste_SSF-34_14_03_2026.xlsx');
    fs.writeFileSync(fichier, XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' }));
    return fichier;
};

executer('01-sauveteurs', 'Inscrire les sauveteurs', async (t) => {
    const p = t.page;
    await creerDossier(t);
    await t.debutFilm();

    await t.chapitre('La liste des sauveteurs');
    await t.dire('Avant l\'arrivée des sauveteurs, on charge la liste des sauveteurs qui peuvent être engagés.',
        'Elle évite de ressaisir chaque nom le jour du secours : il suffira de cocher les personnes qui se présentent.');
    await t.clic(t.bouton('Liste des sauveteurs'));
    await t.dire('La fenêtre « Gestion de la liste des sauveteurs » est vide pour l\'instant. Il y a trois façons de la remplir, présentées dans le cadre violet.');
    await t.viser(p.locator('button:visible', { hasText: 'Récupérer depuis la base nationale' }));
    await t.dire('1. « 🌐 Récupérer depuis la base nationale » : directement depuis le site de la base nationale des sauveteurs, si le PC a accès à Internet.');
    await t.viser(p.locator('label:visible', { hasText: 'Importer la base nationale (Excel)' }));
    await t.dire('2. « 📊 Importer la base nationale (Excel) » : le fichier exporté auparavant depuis ce même site, utile sur un PC sans Internet le jour du secours.');
    await t.viser(p.locator('label:visible', { hasText: 'Importer CSV' }));
    await t.dire('3. « 📂 Importer CSV » : une liste préparée à la main, par exemple dans Excel.');

    await t.chapitre('Récupérer la liste depuis la base nationale');
    await t.viser(p.locator('button:visible', { hasText: 'Récupérer depuis la base nationale' }));
    await t.dire('Ce bouton ouvre le site sauveteurs.speleo-secours-francais.fr dans une fenêtre de l\'application. On s\'y identifie avec son propre compte.',
        'L\'application ne voit pas le mot de passe. La connexion est gardée sur ce PC : « Se déconnecter de la base » l\'efface.');
    await t.dire('Sur le site, « Export de la liste » puis l\'icône « Export au format Excel » : la fenêtre se ferme et la liste arrive dans l\'application, avec un aperçu avant de l\'enregistrer.',
        'Le site n\'est pas montré dans ce film : il contient les coordonnées de vrais sauveteurs. L\'aperçu qui suit est le même avec les deux boutons « base nationale ».');

    await t.chapitre('Importer l\'export Excel de la base nationale');
    await t.dire('Ici, on importe un fichier exporté auparavant depuis le site (noms fictifs pour ce film).');
    await t.fichier(p.locator('label:visible', { hasText: 'Importer la base nationale (Excel)' }), p.locator('input[type="file"][accept=".xlsx,.xls"]'), exportBaseNationale());
    await t.dire('L\'aperçu indique ce que l\'import va changer : nombre de sauveteurs, nouveaux, mis à jour, retirés.',
        'L\'import REMPLACE la liste. Les sauveteurs déjà venus sur ce secours sont toujours conservés.');
    await t.dire('Un sauveteur non opérationnel ou non fédéré à date est signalé « NON OPÉRATIONNEL » dans son rôle.');
    await t.dire('Le département (SSF 34) est lu dans le nom du fichier et appliqué à tous. Les spécialités cochées sur le site deviennent le rôle de chacun.',
        'Adresses, téléphones et e-mails ne sont pas repris dans l\'application.');
    await t.clic(t.bouton('Remplacer la liste'));
    await p.locator('h3:visible', { hasText: 'Liste complète' }).scrollIntoViewIfNeeded();
    await t.dire('Les sauveteurs apparaissent dans la liste complète, en bas de la fenêtre.');
    await t.rythme(2);

    await t.chapitre('Importer un fichier CSV');
    await t.dire('Des renforts arrivent d\'autres départements. Leur liste a été préparée dans Excel et enregistrée au format CSV.');
    await t.dire('Le fichier contient une ligne de titres, puis une ligne par sauveteur : ID ; Nom ; Prénom ; Rôle ; SSF. Exemple :  30-001;DUBOIS;Chloé;Médecin;30',
        'Plusieurs spécialités vont dans la case Rôle, séparées par des virgules. Colonnes séparées par des points-virgules, des virgules ou des tabulations.');
    await t.fichier(p.locator('label:visible', { hasText: 'Importer CSV' }), p.locator('input[type="file"][accept=".csv,.txt"]'), path.join(__dirname, 'renforts-exemple.csv'));
    await t.dire('Le CSV s\'ajoute à la liste existante : les sauveteurs du département sont conservés.',
        'Un sauveteur déjà présent avec le même identifiant est mis à jour.');
    await p.locator('h3:visible', { hasText: 'Liste complète' }).scrollIntoViewIfNeeded();
    await t.rythme(2);
    await t.dire('La recherche rapide retrouve un sauveteur par son nom, son identifiant, son rôle ou son SSF.');
    await t.vite(() => t.saisir(t.champ('🔍 Recherche rapide...'), 'dubois'));
    await t.rythme(2);
    await t.vite(() => t.saisir(t.champ('🔍 Recherche rapide...'), ''));

    await t.chapitre('Ajouter un sauveteur qui n\'est pas sur la liste');
    await t.dire('Un sauveteur se présente mais il n\'est pas sur la liste (nouveau membre, renfort imprévu…). On l\'ajoute à la main en haut de la fenêtre.',
        'Tout sauveteur engagé doit être inscrit : c\'est ce qui permet de le placer dans une équipe, au planning, et de savoir à tout moment qui est sur site.');
    await p.locator('h3:visible', { hasText: 'Ajouter un sauveteur' }).scrollIntoViewIfNeeded();
    await t.dire('Le premier champ (identifiant) peut rester vide : l\'application attribue automatiquement un numéro EXT-001, EXT-002… qui signale un sauveteur ajouté hors liste.');
    await t.vite(async () => {
        await t.saisir(t.champ('NOM'), 'GARNIER');
        await t.saisir(t.champ('Prénom'), 'Inès');
        await t.saisir(t.champ('Rôle'), 'Eq assistance victime');
        await t.saisir(t.champ('SSF / Service'), '07');
    });
    await t.clic(t.bouton('+ Ajouter'));
    await t.dire('GARNIER Inès est ajoutée avec l\'identifiant EXT-001. Seuls le NOM et le prénom sont obligatoires ; sans rôle, « Secouriste » est mis par défaut.');
    await t.vite(() => t.saisir(t.champ('🔍 Recherche rapide...'), 'EXT'));
    await t.rythme(2.5);
    await t.vite(() => t.saisir(t.champ('🔍 Recherche rapide...'), ''));
    await t.dire('Le crayon ✏️ d\'une ligne permet de corriger un sauveteur, la corbeille de le retirer de la liste (impossible s\'il est déjà au planning).');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Enregistrer l\'arrivée des sauveteurs sur site');
    await t.dire('Être sur la liste ne veut pas dire être présent. Quand un sauveteur arrive au PC, on enregistre son arrivée.',
        'Seuls les sauveteurs « sur site » apparaissent au planning et peuvent être mis dans une équipe.');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.dire('À gauche : la liste des sauveteurs. On coche les sauveteurs qui viennent d\'arriver, puis « Arrivée ».');
    await t.vite(async () => {
        for (const nom of ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'GARNIER Inès']) {
            await t.cocher(t.etiquette(nom).locator('input[type="checkbox"]'));
        }
    });
    await t.clic(t.bouton('Arrivée'));
    await t.dire('Ils passent dans la colonne « Sur site », avec un numéro d\'ordre d\'arrivée (N°1, N°2…) qui sera leur numéro au planning.');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    const ligneArrivee = p.getByText(/Arrivée de :/).first();
    await ligneArrivee.scrollIntoViewIfNeeded();
    await t.dire('Dans la main courante, l\'application a écrit toute seule une ligne : « Arrivée de : » suivie des noms, à l\'heure de l\'arrivée.',
        'Catégorie « Personnel », secrétaire « Système » : les arrivées sont tracées sans rien saisir.');
    await t.viser(ligneArrivee);
    await t.rythme(2);
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.dire('On décale la palette d\'activités, qui cache la droite de la grille.');
    const titre = await p.locator('#palette-title').boundingBox();
    await t.vite(() => t.glisser(p.locator('#palette-title'), { x: titre.x + titre.width / 2 + 110, y: titre.y + titre.height / 2 + 250 }));
    await t.dire('Au planning, chacun a maintenant sa ligne, avec son numéro d\'arrivée, et « disponible » (en vert) à partir de l\'heure d\'arrivée.');
    await t.viser(p.getByText('THOMAS David').first());
    await t.rythme(2);

    await t.chapitre('Enregistrer un départ');
    await t.avancer(90, '1 h 30 plus tard… Comme du temps a passé, l\'application propose de prolonger le planning de chacun jusqu\'à maintenant : on accepte.');
    await t.clic(t.bouton(/Main Courante/));
    await t.dire('Quand un sauveteur quitte le site (fin de participation, relève), on le coche dans la colonne « Sur site » puis « Départ ».');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.cocher(p.locator('label:visible', { hasText: 'THOMAS David' }).last().locator('input[type="checkbox"]'));
    await t.clic(t.bouton('Départ'));
    await t.dire('THOMAS David est revenu dans la liste des sauveteurs : s\'il revient plus tard, il suffira d\'enregistrer à nouveau son arrivée.',
        'Il garde alors son numéro et sa ligne au planning.');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    const ligneDepart = p.getByText(/Départ de :/).first();
    await ligneDepart.scrollIntoViewIfNeeded();
    await t.dire('La main courante a reçu une nouvelle ligne : « Départ de : THOMAS David », à l\'heure du départ.');
    await t.viser(ligneDepart);
    await t.rythme(2);
    await t.clic(t.bouton('Planning Opérationnel'));
    const titre2 = await p.locator('#palette-title').boundingBox();
    await t.vite(() => t.glisser(p.locator('#palette-title'), { x: titre2.x + titre2.width / 2 + 110, y: titre2.y + titre2.height / 2 + 250 }));
    await t.dire('Au planning, THOMAS David garde sa ligne : « Quitter le secours » est inscrit à l\'heure du départ.',
        'La liste des présents reste juste à tout moment, ce qui compte pour la sécurité et pour le rapport de fin de mission.');
    await t.viser(p.getByText('THOMAS David').first());
    await t.rythme(4);
});
