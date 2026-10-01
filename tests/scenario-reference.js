// ============================================
// SCÉNARIO DE SECOURS DE RÉFÉRENCE (lot 0)
// ============================================
// Pilote la vraie application comme un secrétaire (clics, saisies), avec une
// horloge maîtrisée, puis compare les données finales à une référence.
// Sert à vérifier qu'aucune étape du chantier réseau ne change le comportement.
//
// Utilisation (depuis C:\Projets\SSF-Reseau) :
//   node tests/scenario-reference.js                  → rejoue et compare à la référence
//   node tests/scenario-reference.js --maj-reference  → rejoue et enregistre la référence
//   node tests/scenario-reference.js --jusqua=<n>     → s'arrête après l'étape n et décrit l'écran
//   node tests/scenario-reference.js --visible        → ralentit pour suivre à l'écran
//
// Les données sont écrites dans un dossier jetable (SSF_TEST_USER_DATA) :
// les données réelles de l'application ne sont jamais touchées.

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');

const RACINE = path.join(__dirname, '..');
const DOSSIER_SORTIE = path.join(__dirname, 'sortie');
const FICHIER_REFERENCE = path.join(__dirname, 'reference', 'etat-final.json');
// Début fictif du secours : samedi 14 mars 2026, 08:00 (heure locale)
const DEBUT = new Date(2026, 2, 14, 8, 0, 0);

const args = process.argv.slice(2);
const MAJ_REFERENCE = args.includes('--maj-reference');
const VISIBLE = args.includes('--visible');
const JUSQUA = (args.find(a => a.startsWith('--jusqua=')) || '').split('=')[1] || null;

// ---------- Outils ----------

let page;
const erreurs = [];
const dialogues = [];

// Fait avancer l'horloge fictive (déclenche minuteries, sauvegarde différée…)
const attendre = async (secondes = 1) => {
    await page.clock.runFor(secondes * 1000);
    if (VISIBLE) await new Promise(r => setTimeout(r, 300));
};

// Clic sur un bouton visible par son texte : correspondance partielle SANS distinction
// de casse (« Enregistrer » trouve aussi « ENREGISTRER ») ; passer une expression
// régulière pour être exact. options.dernier : prend le dernier (fenêtre au premier plan).
const clic = async (texte, options = {}) => {
    const boutons = page.locator('button:visible', { hasText: texte });
    const bouton = options.dernier ? boutons.last() : boutons.nth(options.rang || 0);
    await bouton.click();
    await attendre(options.secondes || 1);
};

// Coche la case d'une ligne repérée par son texte (ex. nom d'un sauveteur)
const cocher = async (texteLigne, options = {}) => {
    const lignes = page.locator('label:visible', { hasText: texteLigne });
    await (options.dernier ? lignes.last() : lignes.first()).locator('input[type="checkbox"]').check();
    await attendre(0.2);
};

// Carte d'une équipe dans la fenêtre « Gestion des Équipes », dépliée si besoin
const carteEquipe = async (nom) => {
    const carte = page.locator('div.border-blue-300:visible').filter({ has: page.getByText(nom, { exact: true }) }).first();
    if (!(await carte.locator('button', { hasText: 'Fin de mission' }).isVisible())) {
        await carte.locator('div.cursor-pointer').first().click();
        await attendre(0.5);
    }
    return carte;
};

const SAUVETEURS = [
    // [NOM, Prénom, Rôle, SSF]
    ['MARTIN', 'Alice', 'Chef d\'équipe', '34'],
    ['BERNARD', 'Bruno', 'Secouriste', '34'],
    ['DUBOIS', 'Chloé', 'Médecin', '30'],
    ['THOMAS', 'David', 'Secouriste', '12'],
    ['ROBERT', 'Emma', 'Plongeur', '30'],
    ['PETIT', 'Félix', 'Secouriste', '48'],
];
const nomComplet = i => `${SAUVETEURS[i][0]} ${SAUVETEURS[i][1]}`;

// Saisie dans un champ visible repéré par son texte d'aide (placeholder)
const saisir = async (placeholder, valeur, options = {}) => {
    const champ = page.locator(`input[placeholder="${placeholder}"]:visible, textarea[placeholder="${placeholder}"]:visible`).nth(options.rang || 0);
    await champ.fill(String(valeur));
    await attendre(0.2);
};

// Décrit l'écran courant (pour construire et déboguer le scénario)
const decrireEcran = async (nom) => {
    fs.mkdirSync(DOSSIER_SORTIE, { recursive: true });
    await page.screenshot({ path: path.join(DOSSIER_SORTIE, `${nom}.png`) });
    const info = await page.evaluate(() => {
        const visibles = sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent);
        return {
            titres: visibles('h1,h2,h3').map(h => h.innerText.trim().slice(0, 80)),
            boutons: visibles('button').map(b => b.innerText.trim().replace(/\s+/g, ' ').slice(0, 60)),
            champs: visibles('input,select,textarea').map(i => `${i.tagName.toLowerCase()}[${i.type}] placeholder="${i.placeholder || ''}" valeur="${(i.value || '').slice(0, 30)}"` + (i.tagName === 'SELECT' ? ' options=' + [...i.options].map(o => o.text.slice(0, 25)).join('|') : '')),
        };
    });
    fs.writeFileSync(path.join(DOSSIER_SORTIE, `${nom}.json`), JSON.stringify(info, null, 1));
    console.log(`📸 Écran « ${nom} » décrit dans tests/sortie/${nom}.json et .png`);
};

// Lit l'état enregistré du secours dans la mémoire du navigateur
const lireEtat = () => page.evaluate(() => {
    const cles = Object.keys(localStorage).filter(k => k.startsWith('SSF_UNIFIED_STATE_'));
    const etats = {};
    cles.forEach(k => { etats[k] = JSON.parse(localStorage.getItem(k)); });
    return etats;
});

// ---------- Normalisation et comparaison ----------

// Rend l'état comparable d'une version à l'autre :
// - clés d'objets triées ;
// - version de l'application retirée ;
// - identifiants techniques (Date.now() à 13 chiffres, UUID) remplacés par ID_1, ID_2…
//   dans leur ordre d'apparition : changer la façon de créer les identifiants (lot 0, A2)
//   ne doit pas faire échouer la comparaison, mais un mauvais lien entre éléments, si.
const normaliser = (etat) => {
    const trier = v => Array.isArray(v) ? v.map(trier)
        : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => { o[k] = trier(v[k]); return o; }, {})
        : v;
    const sansVersion = JSON.parse(JSON.stringify(etat), (k, v) => (k === 'version' ? undefined : v));
    const jetons = new Map();
    const jeton = brut => { if (!jetons.has(brut)) jetons.set(brut, `ID_${jetons.size + 1}`); return jetons.get(brut); };
    const texte = JSON.stringify(trier(sansVersion), null, 1)
        .replace(/"?\b\d{13}\b"?/g, m => `"${jeton(m.replace(/"/g, ''))}"`)
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, m => jeton(m));
    return JSON.parse(texte);
};

// Liste les différences entre deux valeurs (chemin → attendu / obtenu)
const differences = (attendu, obtenu, chemin = '', liste = []) => {
    if (liste.length >= 40) return liste;
    if (attendu && obtenu && typeof attendu === 'object' && typeof obtenu === 'object') {
        const cles = new Set([...Object.keys(attendu), ...Object.keys(obtenu)]);
        for (const k of cles) differences(attendu[k], obtenu[k], `${chemin}/${k}`, liste);
    } else if (JSON.stringify(attendu) !== JSON.stringify(obtenu)) {
        liste.push(`${chemin}\n    attendu : ${JSON.stringify(attendu)?.slice(0, 200)}\n    obtenu  : ${JSON.stringify(obtenu)?.slice(0, 200)}`);
    }
    return liste;
};

// ---------- Étapes du scénario ----------

const ETAPES = [
    ['01-demarrage', async () => {
        // Rien : l'application vient de démarrer
    }],
    ['02-nouveau-dossier', async () => {
        await page.getByText('EXERCICE', { exact: true }).click();
        await saisir('Ex: Gouffre de Padirac, Grotte de Clamouse...', 'Gouffre du Test');
        await saisir('Ex: Saint-Martin-de-Londres...', 'Testville');
        await page.locator('select:visible').filter({ has: page.locator('option[value="0"]') }).last().selectOption('6');
        await clic('Créer le dossier et continuer');
    }],
    ['03-mode-pc-terrain', async () => {
        await page.getByText('PC de Terrain', { exact: false }).last().click();
        await page.locator('button:visible', { hasText: 'Confirmer et Démarrer' }).last().click();
        await attendre(2); // la fenêtre du secrétaire s'ouvre après 1 s
        await saisir('Ex: Martin DUPONT', 'Secrétaire TEST');
        await clic(/^✓ Enregistrer$/);
    }],
    ['04-liste-prefectorale', async () => {
        await clic('Liste Préfectorale');
        for (const [nom, prenom, role, ssf] of SAUVETEURS) {
            await saisir('NOM', nom);
            await saisir('Prénom', prenom);
            await saisir('Rôle', role);
            await saisir('SSF / Service', ssf);
            await clic('+ Ajouter');
        }
    }],
    ['05-arrivee-sauveteurs', async () => {
        await clic(/^Fermer$/, { dernier: true });
        await clic('Enregistrement des sauveteurs');
        for (let i = 0; i < 5; i++) await cocher(nomComplet(i));
        await clic('Arrivée');
        await clic(/^Fermer$/, { dernier: true });
    }],
    ['06-points-phone', async () => {
        await clic('Points Phone');
        const POINTS = [['A', 'Entrée de la cavité', '🚪 Entrée cavité'], ['B', 'Puits P40', '🪨 Sous terre'], ['C', 'Salle du Camp', '🪨 Sous terre']];
        for (const [lettre, nom, type] of POINTS) {
            const ligne = page.locator('div.flex.gap-2:visible', { has: page.locator('input[placeholder="Pos."]') });
            await ligne.locator('select').selectOption(lettre);
            await saisir('Ex: Base du P80, Poste médical...', nom);
            await page.locator('label:visible', { hasText: type }).first().click();
            await clic('+ Ajouter');
        }
        await clic(/^Fermer$/, { dernier: true });
    }],
    ['07-creation-equipe-1', async () => {
        await clic(/^👥 Équipes$/);
        await page.locator('label:visible', { hasText: '🪨 Sous terre' }).first().click();
        await saisir('Titre (ex: Reconnaissance Zone Nord)', 'Reconnaissance réseau Nord');
        await saisir('Détaillez précisément ce que l\'équipe doit faire...', 'Descendre au P40 et reconnaître la galerie nord.');
        await page.locator('select:visible', { has: page.locator('option', { hasText: 'Sélectionner un type' }) }).selectOption({ index: 1 });
        for (const i of [0, 1, 2]) await cocher(nomComplet(i), { dernier: true }); // 1er coché = chef
        await clic('Créer l\'Équipe');
        await clic(/^Fermer$/, { dernier: true });
    }],
    ['08-mc-message-simple', async () => {
        await attendre(60);
        await saisir('Nom...', 'Préfecture', { rang: 0 });
        await saisir('Description...', 'Point de situation transmis à la préfecture.');
        await clic(/^✓ ENREGISTRER$/);
    }],
    ['09-mc-depart-equipe-1', async () => {
        await attendre(60);
        await saisir('T1...', 'Équipe 1');
        await page.locator('label:visible', { hasText: 'Départ PC' }).click();
        await attendre(0.2);
        await saisir('Description...', 'Départ de l\'équipe 1 vers le P40.');
        await clic(/^✓ ENREGISTRER$/);
        await clic('✓ Valider'); // mise à jour du planning : toute l'équipe
    }],
    ['10-mc-passage-pp-B', async () => {
        await attendre(25 * 60);
        await saisir('T1...', 'Équipe 1');
        await saisir('A, B...', 'B');
        await saisir('Description...', 'Équipe 1 au P40, tout va bien.');
        await clic(/^✓ ENREGISTRER$/);
        await clic('✓ Valider');
    }],
    ['11-mc-rappel', async () => {
        await attendre(60);
        await saisir('Nom...', 'Météo France', { rang: 0 });
        await saisir('Description...', 'Rappeler Météo France pour le bulletin orages.');
        await page.locator('input[type="date"]:visible').first().fill('2026-03-14');
        await page.locator('input[type="time"]:visible').first().fill('08:45');
        await attendre(0.2);
        await clic(/^✓ ENREGISTRER$/);
    }],
    ['12-alerte-rappel', async () => {
        await attendre(20 * 60); // l'heure du rappel est dépassée
        await clic(/^✓ Valider$/);  // validation du rappel
    }],
    ['13-creation-equipe-2', async () => {
        await attendre(60);
        await clic(/^👥 Équipes$/);
        await page.locator('label:visible', { hasText: '🌿 Surface' }).first().click();
        await saisir('Titre (ex: Reconnaissance Zone Nord)', 'Logistique surface');
        await page.locator('select:visible', { has: page.locator('option', { hasText: 'Sélectionner un type' }) }).selectOption({ label: '📦 Logistique' });
        for (const i of [3, 4]) await cocher(nomComplet(i), { dernier: true });
        await clic('Créer l\'Équipe');
        await clic(/^Fermer$/, { dernier: true });
    }],
    ['14-mc-depart-equipe-2-surface', async () => {
        await attendre(60);
        await saisir('T1...', 'Équipe 2');
        await page.locator('label:visible', { hasText: 'Départ PC' }).click();
        await page.locator('label[title="Surface → Mission surface"]').click();
        await saisir('Description...', 'Départ de l\'équipe 2 pour la logistique surface.');
        await clic(/^✓ ENREGISTRER$/);
        await clic('✓ Valider');
    }],
    ['15-mc-passage-pp-C', async () => {
        await attendre(40 * 60);
        await saisir('T1...', 'Équipe 1');
        await saisir('A, B...', 'C');
        await saisir('Description...', 'Équipe 1 arrivée à la Salle du Camp.');
        await clic(/^✓ ENREGISTRER$/);
        await clic('✓ Valider');
    }],
    ['16-arrivee-tardive', async () => {
        await attendre(60);
        await clic('Enregistrement des sauveteurs');
        await cocher(nomComplet(5));
        await clic('Arrivée');
        await clic(/^Fermer$/, { dernier: true });
    }],
    ['17-ajout-membre-equipe-2', async () => {
        await attendre(60);
        await clic(/^👥 Équipes$/);
        const carte = await carteEquipe('Équipe 2');
        await carte.locator('button', { hasText: '➕ Ajouter des Membres' }).click();
        await attendre(0.5);
        await carte.locator('label', { hasText: nomComplet(5) }).locator('input[type="checkbox"]').check();
        await carte.locator('button', { hasText: '✓ Ajouter (' }).click();
        await attendre(1);
    }],
    ['18-scission-equipe-1', async () => {
        await attendre(60);
        const carte = await carteEquipe('Équipe 1');
        await carte.locator('button', { hasText: '✂️ Scinder' }).click();
        await attendre(0.5);
        await clic('✂️ Créer Équipe');
    }],
    ['19-fin-de-mission-equipe-2', async () => {
        await attendre(60);
        const carte = await carteEquipe('Équipe 2');
        await carte.locator('button', { hasText: 'Fin de mission' }).click();
        await attendre(1);
        await clic(/^Fermer$/, { dernier: true });
    }],
    ['20-mc-retour-equipe-1', async () => {
        await attendre(30 * 60);
        await saisir('T1...', 'Équipe 1');
        await saisir('A, B...', 'A');
        await page.locator('label:visible', { hasText: '🏠 Sort — rentre au PC' }).click();
        await saisir('Description...', 'Équipe 1 sortie de la cavité, retour au PC.');
        await clic(/^✓ ENREGISTRER$/);
        await clic('✓ Valider');
    }],
    ['21-correction-evenement', async () => {
        await attendre(60);
        const ligne = page.locator('tr:visible', { hasText: 'Point de situation transmis' }).first();
        await ligne.locator('button', { hasText: '✏️' }).first().click();
        await attendre(0.5);
        await page.locator('textarea:visible').last().fill('Point de situation transmis à la préfecture (corrigé : 3 équipes engagées).');
        await clic('💾 Enregistrer');
    }],
    ['22-depart-sauveteur', async () => {
        await attendre(60);
        await clic('Enregistrement des sauveteurs');
        await cocher(nomComplet(2), { dernier: true });
        await clic('Départ');
        await clic(/^Fermer$/, { dernier: true });
    }],
    ['23-cloture', async () => {
        await attendre(20 * 60);
        await clic('Clôturer le secours');
        await clic('Dernier événement + 5 min');
    }],
];

// ---------- Exécution ----------

(async () => {
    const dossierDonnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-scenario-'));
    const app = await electron.launch({
        args: [RACINE],
        cwd: RACINE,
        env: { ...process.env, SSF_TEST_USER_DATA: dossierDonnees },
    });
    try {
        page = await app.firstWindow();
        page.on('pageerror', e => erreurs.push(e.message));
        page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
        // Fenêtres alert / confirm remplacées par des versions NON bloquantes qui gardent
        // une trace du message et répondent « OK ». Une vraie fenêtre ouverte pendant que
        // l'horloge avance laisserait le temps s'écouler en arrière-plan pendant les
        // étapes suivantes : le résultat changerait d'une exécution à l'autre.
        await app.context().addInitScript(() => {
            window.__dialogues = [];
            window.alert = msg => { window.__dialogues.push(`alert: ${msg}`); };
            window.confirm = msg => { window.__dialogues.push(`confirm: ${msg}`); return true; };
        });

        // Horloge fictive installée avant le chargement de l'interface
        await page.clock.install({ time: DEBUT });
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        // Le chargement prend quelques secondes : on fige ensuite l'horloge à 08:01:00 pile
        await page.clock.pauseAt(new Date(DEBUT.getTime() + 60000));
        await attendre(2);

        for (const [nom, etape] of ETAPES) {
            console.log(`▶ ${nom}  [${await page.evaluate(() => new Date().toTimeString().slice(0, 8))}]`);
            await etape();
            if (JUSQUA && nom.startsWith(JUSQUA)) {
                await decrireEcran(nom);
                return;
            }
        }
        await attendre(2); // laisse partir la sauvegarde différée

        dialogues.push(...await page.evaluate(() => window.__dialogues));
        const resultat = normaliser({ etat: await lireEtat(), dialogues });
        fs.mkdirSync(DOSSIER_SORTIE, { recursive: true });
        fs.writeFileSync(path.join(DOSSIER_SORTIE, 'etat-final.json'), JSON.stringify(resultat, null, 1));

        if (erreurs.length) {
            console.log(`\n❌ ÉCHEC : ${erreurs.length} erreur(s) dans la page (voir ci-dessous).`);
            process.exitCode = 1;
        }
        if (MAJ_REFERENCE) {
            fs.mkdirSync(path.dirname(FICHIER_REFERENCE), { recursive: true });
            fs.writeFileSync(FICHIER_REFERENCE, JSON.stringify(resultat, null, 1));
            console.log(`\n💾 Référence enregistrée : tests/reference/etat-final.json`);
        } else if (!fs.existsSync(FICHIER_REFERENCE)) {
            console.log('\n⚠️ Pas encore de référence : lancer avec --maj-reference.');
            process.exitCode = 1;
        } else {
            const diff = differences(JSON.parse(fs.readFileSync(FICHIER_REFERENCE, 'utf8')), resultat);
            if (diff.length) {
                console.log(`\n❌ ÉCHEC : l'état final diffère de la référence (${diff.length >= 40 ? '40+' : diff.length} différence(s)) :\n`);
                console.log(diff.join('\n'));
                console.log('\nÉtat obtenu complet : tests/sortie/etat-final.json');
                process.exitCode = 1;
            } else if (!erreurs.length) {
                console.log('\n✅ SUCCÈS : état final identique à la référence.');
            }
        }
    } finally {
        if (erreurs.length) console.log('⚠️ Erreurs de la page :\n' + erreurs.join('\n'));
        if (dialogues.length) console.log('💬 Fenêtres de dialogue :\n' + dialogues.join('\n'));
        await app.close();
        fs.rmSync(dossierDonnees, { recursive: true, force: true });
    }
})().catch(e => { console.error('❌', e); process.exit(1); });
