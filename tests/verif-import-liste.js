// ============================================
// VÉRIFICATION : import CSV de la liste des sauveteurs, quel que soit l'encodage du fichier
// ============================================
// Remarque d'un utilisateur : une liste « pourtant en UTF-8 » s'affichait en symboles. Cause :
// fichier enregistré en UTF-16 (Excel « Texte Unicode », Bloc-notes « UTF-16 »), que l'import
// lisait comme du Windows-1252. Chaque encodage courant doit donner des noms lisibles, et un
// fichier illisible (classeur .xlsx) ne doit rien importer.
//
// Utilisation (depuis C:\Projets\SSF) : node tests/verif-import-liste.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');

// Une ligne de titres puis un sauveteur, au nom accentué propre à chaque fichier
const contenu = (id, nom, sep = ';') => `ID${sep}NOM Prénom${sep}Rôle${sep}SSF\r\n${id}${sep}${nom}${sep}Équipier${sep}34\r\n`;
const FICHIERS = [
    ['UTF-8', 'utf8.csv', Buffer.from(contenu('U8', 'AUBÉ Hélène'), 'utf8'), 'AUBÉ Hélène'],
    ['UTF-8 avec BOM (Excel « CSV UTF-8 »)', 'utf8-bom.csv', Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(contenu('U8B', 'BÉRAUD Noël'), 'utf8')]), 'BÉRAUD Noël'],
    ['Windows-1252 (Excel « CSV point-virgule »)', 'ansi.csv', Buffer.from(contenu('W', 'CÔTÉ Agnès'), 'latin1'), 'CÔTÉ Agnès'],
    ['UTF-16 LE avec BOM (Excel « Texte Unicode »)', 'unicode.txt', Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(contenu('U16', 'DÉSIRÉ Gaëlle', '\t'), 'utf16le')]), 'DÉSIRÉ Gaëlle'],
    ['UTF-16 LE sans BOM', 'utf16-sans-bom.csv', Buffer.from(contenu('U16S', 'ÉVRARD Jérôme'), 'utf16le'), 'ÉVRARD Jérôme'],
    ['UTF-16 BE avec BOM', 'utf16be.csv', Buffer.concat([Buffer.from([0xFE, 0xFF]), Buffer.from(contenu('U16B', 'FÈVRE Loïc'), 'utf16le').swap16()]), 'FÈVRE Loïc'],
];

(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-import-liste-'));
    const fichiers = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-csv-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0' } });
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    try {
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.__alertes = []; window.alert = (m) => window.__alertes.push(String(m)); window.confirm = () => true; });
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1500);
        const b = (t) => p.locator('button:visible', { hasText: t });

        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Import liste');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Ici');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b('Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Testeur'); await b(/^✓ Enregistrer$/).click(); }

        // Nouveau nom du bouton et de la fenêtre
        await b('Liste des sauveteurs').click();
        controler('Bouton « 📋 Liste des sauveteurs » et fenêtre « Gestion de la liste des sauveteurs »', await p.locator('h2:visible', { hasText: 'Gestion de la liste des sauveteurs' }).count() === 1);

        const champ = p.locator('input[type="file"][accept=".csv,.txt"]');
        const importer = async (nom, octets) => {
            const f = path.join(fichiers, nom);
            fs.writeFileSync(f, octets);
            await p.evaluate(() => { window.__alertes = []; });
            await champ.setInputFiles(f);
            await p.waitForTimeout(800);
            return p.evaluate(() => window.__alertes.join(' | '));
        };
        for (const [libelle, nom, octets, attendu] of FICHIERS) {
            const alerte = await importer(nom, octets);
            const lisible = (await p.locator('body').innerText()).includes(attendu);
            controler(`${libelle} : « ${attendu} » ${lisible ? 'lisible' : 'ILLISIBLE'} (${alerte})`, lisible && alerte.includes('1 sauveteur'));
        }

        // Classeur Excel renommé en .csv : refusé avec une explication, rien d'importé
        const avant = await p.locator('body').innerText();
        const alerte = await importer('classeur.csv', Buffer.concat([Buffer.from('PK\u0003\u0004', 'latin1'), Buffer.from([0, 0, 0x14, 0, 6, 0, 8, 0, 0, 0, 0x21, 0, 0xFF, 0xFE, 0x9C, 0x3B])]));
        controler(`Fichier illisible refusé : ${alerte.split('\n')[0]}`, alerte.includes('ne peut pas être lu') && (await p.locator('body').innerText()) === avant);

        // Format d'un département : Nom et Prénom séparés, tabulations, plusieurs rôles dans la case
        // (séparés par deux espaces, ou par des retours à la ligne dans une case entre guillemets)
        const departement = [
            'ID\tNom\tPrénom\tRôle\tSSF',
            '1\tALBA\tAndré\tEq évacuation  Eq transmission\t25',
            '2\tBRUN\tBéatrice\tCE transmission  Artificier\t25',
            '3\tCARRE\tCédric\tCE évacuation  CE flottaison  Eq transmission  Gestion matériel\t25',
            '4\tDUMAS\tDenise\tGestion PC\t25',
            '5\tESTÈVE\tÉric\tCT  Gestion PC  Eq évacuation  CE transmission  Artificier\t25',
            '6\tFORGE\tFanny\t"Eq assistance victime\r\nMédecin"\t25',
        ].join('\r\n') + '\r\n';
        const alerteDep = await importer('departement.txt', Buffer.from(departement, 'utf8'));
        controler(`Liste « ID, Nom, Prénom, Rôle, SSF » : ${alerteDep}`, alerteDep.includes('6 sauveteur'));
        const corps = await p.locator('body').innerText();
        controler('Nom + Prénom réunis (« ESTÈVE Éric »), rôles sur plusieurs lignes réunis (« Eq assistance victime, Médecin »)',
            corps.includes('ESTÈVE Éric') && corps.includes('Eq assistance victime, Médecin'));

        // Format conseillé : colonnes séparées par des points-virgules, spécialités par des virgules
        const conseille = 'ID;Nom;Prénom;Rôle;SSF\r\n7;GIRARD;Gilles;CE évacuation, Eq transmission, Artificier;25\r\n';
        const alerteConseille = await importer('conseille.csv', Buffer.from(conseille, 'utf8'));
        controler(`Format conseillé « ID;Nom;Prénom;Rôle;SSF », rôles séparés par des virgules : ${alerteConseille}`,
            alerteConseille.includes('1 sauveteur') && (await p.locator('body').innerText()).includes('CE évacuation, Eq transmission, Artificier'));

        // Arrivée de ces 6 sauveteurs, puis création d'une équipe téléphone
        await b(/^Fermer$/).last().click();
        await b('Enregistrement des sauveteurs').click();
        const noms = ['ALBA André', 'BRUN Béatrice', 'CARRE Cédric', 'DUMAS Denise', 'ESTÈVE Éric', 'FORGE Fanny'];
        for (const n of noms) await p.locator('label:visible', { hasText: n }).first().locator('input[type="checkbox"]').check();
        await b('Arrivée').click();
        await b(/^Fermer$/).last().click();
        await b(/^👥 Équipes$/).click();
        await p.locator('input[placeholder="Titre (ex: Reconnaissance Zone Nord)"]').fill('Téléphone fond');
        await p.waitForTimeout(300);
        // Ordre affiché : titres de groupes et noms, dans la liste de création
        const ordre = async () => p.locator('div.max-h-60:visible').first().evaluate(el =>
            [...el.querySelectorAll('p, label span.font-semibold')].map(x => x.innerText.trim()).filter(t => /^(👑|Équipiers|Autres|[A-ZÉÈ]+ )/.test(t)));
        const tel = await ordre();
        console.log('   Équipe téléphone :', tel.join(' / '));
        const attendu = ["👑 CHEFS D'ÉQUIPE TRANSMISSION (2)", 'BRUN Béatrice', 'ESTÈVE Éric', 'ÉQUIPIERS TRANSMISSION (2)', 'ALBA André', 'CARRE Cédric', 'AUTRES SAUVETEURS'];
        const telOk = tel.length > 7 && tel.slice(0, 7).every((x, i) => i === 6 ? x.toUpperCase().startsWith(attendu[i]) : x.toUpperCase() === attendu[i].toUpperCase());
        controler('Type « Transmission » détecté : chefs d\'équipe transmission, puis équipiers transmission, puis les autres', telOk);

        // Choix manuel d'une autre spécialité : évacuation (Brancardage)
        await p.locator('select:visible', { has: p.locator('option', { hasText: 'Selon le type de mission' }) }).selectOption('Brancardage');
        const evac = await ordre();
        console.log('   Tri « Brancardage » :', evac.join(' / '));
        controler('Tri manuel « Brancardage » : CARRE (CE évacuation) chef ; ALBA et ESTÈVE (Eq évacuation) équipiers',
            evac[0].toUpperCase().startsWith("👑 CHEFS D'ÉQUIPE ÉVACUATION") && evac[1] === 'CARRE Cédric' && evac[2].toUpperCase().startsWith('ÉQUIPIERS ÉVACUATION') && evac[3] === 'ALBA André' && evac[4] === 'ESTÈVE Éric');
        await p.locator('select:visible', { has: p.locator('option', { hasText: 'Selon le type de mission' }) }).selectOption('');
        const sans = await ordre();
        controler('« Sans tri » : ordre alphabétique, sans titres de groupes', !sans.some(x => /^(👑|Équipiers|Autres)/i.test(x)));

        // ===== Export Excel de la base nationale (mêmes colonnes que le vrai, noms fictifs) =====
        const XLSX = require(path.join(RACINE, 'libs', 'xlsx.full.min.js'));
        const titresBase = ['ID', 'Nom', 'Prenom', 'Sexe', 'Adresse', 'CPVille', 'Telperso', 'Teltravail', 'TelPortable', 'Email', 'Fonction CT',
            'ChefEquipeEvac', 'ChefEquipeASV', 'Medecin', 'Infirmier', 'Gestion', 'ASV', 'Transmission', 'Evacuation', 'Desobstruction', 'CPT',
            'Plongee', 'Pompage', 'Ventilation', 'Logistique', 'EauxVives', 'Mines', 'Operationnel', 'SpecialiteMedicale', 'Licence', 'Divers', 'TAGS', 'ID_AVEN2', 'Fédéré à date'];
        //            CTDS   CE-Ev CE-ASV Méd Inf Gest ASV Trans Evac Désob CPT Plong Pomp Vent Log EV Mines Op Fédéré
        const ligneBase = (id, nom, prenom, ct, drapeaux, op = 1, federe = 1) => {
            const [ceEv, ceAsv, med, inf, gest, asv, tr, ev, des, cpt, pl, po, ve, lo, eaux, mi] = drapeaux;
            return [id, nom, prenom, 1, '1 rue Fictive', '25000 Besançon', '', '', '0600000000', 'fictif@exemple.fr', ct,
                ceEv, ceAsv, med, inf, gest, asv, tr, ev, des, cpt, pl, po, ve, lo, eaux, mi, op, '', 'L-' + id, '', '', 'A' + id, federe];
        };
        const feuille = XLSX.utils.aoa_to_sheet([titresBase,
            ligneBase(5001, 'Gaillard', 'Hervé', 'CTDSA', [1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0]),
            ligneBase(5002, 'Hubert', 'Inès', '', [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0]),
            ligneBase(5003, 'Jacob', 'Jules', '', [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0),
            ligneBase(5004, 'Klein', 'Karima', '', [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0], 1, 0),
        ]);
        const classeur = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(classeur, feuille, 'Liste');
        const fichierBase = path.join(fichiers, 'Liste_SSF-25_16_10_2026.xlsx');
        fs.writeFileSync(fichierBase, XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' }));

        await b(/^Fermer$/).last().click();
        await b('Liste des sauveteurs').click();
        await p.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles(fichierBase);
        await p.waitForTimeout(800);
        const apercu = await p.locator('h3:visible', { hasText: 'Import de la base nationale' }).locator('..').innerText();
        console.log('   Aperçu :', apercu.split('\n').filter(l => /sauveteurs dans le fichier|NON OPÉRATIONNEL|retirés|conservés/.test(l)).join(' / '));
        controler('Aperçu : 4 sauveteurs, 4 nouveaux, 2 non opérationnels, les 6 déjà arrivés conservés',
            apercu.includes('4 sauveteurs dans le fichier : 4 nouveaux, 0 mis à jour') && apercu.includes('2 marqués « NON OPÉRATIONNEL »') && apercu.includes('6 conservés car déjà venus'));
        controler('Aperçu : SSF « 25 » repris du nom du fichier, coordonnées non reprises',
            (await p.locator('input[placeholder="ex. 25"]').inputValue()) === '25' && /Colonnes non reprises : .*Adresse.*TelPortable.*Email/.test(apercu));
        await b(/Remplacer la liste \(4\)/).click();
        await p.waitForTimeout(600);
        const apres = await p.locator('body').innerText();
        controler('Rôles convertis : « CTDSA, Gestion PC, CE évacuation, Artificier »', apres.includes('GAILLARD Hervé') && apres.includes('CTDSA, Gestion PC, CE évacuation, Artificier'));
        controler('Rôles convertis : « Eq évacuation, Eq assistance victime, Eq transmission, Flottaison »', apres.includes('Eq évacuation, Eq assistance victime, Eq transmission, Flottaison'));
        controler('Non opérationnel / non fédéré marqués', apres.includes('NON OPÉRATIONNEL, CE assistance victime, Médecin') && apres.includes('NON OPÉRATIONNEL (non fédéré), Eq évacuation, Plongeur, Pompage, Ventilation, Logistique'));
        controler('Liste remplacée : sauveteurs importés avant et jamais venus retirés (AUBÉ Hélène), déjà venus conservés (ALBA André)',
            !apres.includes('AUBÉ Hélène') && !apres.includes('GIRARD Gilles') && apres.includes('ALBA André') && apres.includes('Liste complète (10)'));
    } catch (e) {
        controler('Erreur : ' + e.message.split('\n')[0], false);
    } finally {
        await app.close().catch(() => {});
        for (const d of [donnees, fichiers]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* verrouillé */ } }
    }
    const ok = controles.every(Boolean);
    console.log(ok ? '\n✅ Import de la liste des sauveteurs conforme.' : '\n❌ Import de la liste des sauveteurs NON conforme.');
    process.exitCode = ok ? 0 : 1;
})();
