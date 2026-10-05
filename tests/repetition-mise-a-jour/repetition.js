// ============================================
// RÉPÉTITION GÉNÉRALE DE LA MISE À JOUR 13 → 14 (reprise des données)
// ============================================
// Sur des données fabriquées par la VRAIE version officielle (dossier SSF_OFFICIELLE, par défaut
// C:\Projets\SSF = branche main), dans un dossier temporaire — les données réelles ne sont
// jamais touchées :
// 1. version officielle : dossier, liste, arrivées, points phones, équipes, main courante ;
// 2. contrôle : contenu de l'ancienne mémoire (lecteur) ;
// 3. cette version lancée sur une copie : reprise au premier lancement, puis comparaison ;
// 4. relance : pas de seconde reprise, secours rouvert à l'écran.
// Utilisation (depuis la racine du dépôt) : node tests/repetition-mise-a-jour/repetition.js
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const RESEAU = path.join(__dirname, '..', '..');
const { _electron: electron } = require(path.join(RESEAU, 'node_modules', 'playwright-core'));
const { lireSecours, fenetrePrincipale } = require(path.join(RESEAU, 'tests', 'outils-fichiers'));
const LANCEUR_MAIN = path.join(__dirname, 'officielle');
const ok = [];
const controler = (l, v) => { ok.push(v); console.log(`${v ? '✅' : '❌'} ${l}`); };

(async () => {
    const D = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-v13-'));
    const copieLecture = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-v13-lecture-'));
    const copieReseau = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-v13-reseau-'));
    try {
        // ---------- 1. Version officielle
        const app = await electron.launch({ args: [LANCEUR_MAIN], cwd: RESEAU, env: { ...process.env, SSF_VERIF_DONNEES: D } });
        const p = await app.firstWindow();
        await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1500);
        const b = (t, o = {}) => { const l = p.locator('button:visible', { hasText: t }); return o.dernier ? l.last() : l.first(); };
        const champ = ph => p.locator(`input[placeholder="${ph}"]:visible, textarea[placeholder="${ph}"]:visible`).first();
        console.log('Version officielle :', await app.evaluate(({ app }) => app.getVersion()), '| données :', await app.evaluate(({ app }) => app.getPath('userData')));
        await p.getByText('EXERCICE', { exact: true }).click();
        await champ('Ex: Gouffre de Padirac, Grotte de Clamouse...').fill('Gouffre de la Répétition');
        await champ('Ex: Saint-Martin-de-Londres...').fill('Migrationville');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b('Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer', { dernier: true }).click();
        await p.waitForTimeout(1500);
        await champ('Ex: Martin DUPONT').fill('Claire VIDAL');
        await b(/^✓ Enregistrer$/).click();
        await b('Liste Préfectorale').click();
        await p.locator('input[type="file"][accept=".csv,.txt"]').setInputFiles(path.join(RESEAU, 'tests', 'film', 'tutoriels', 'liste-prefectorale-exemple.csv'));
        await p.waitForTimeout(800);
        await b(/^Fermer$/, { dernier: true }).click();
        await b('Enregistrement des sauveteurs').click();
        for (const n of ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma']) await p.locator('label:visible', { hasText: n }).first().locator('input[type="checkbox"]').check();
        await b('Arrivée').click();
        await b(/^Fermer$/, { dernier: true }).click();
        await b('Points Phone').click();
        for (const [l, nom, type] of [['A', 'Entrée', 'Entrée cavité'], ['B', 'Puits P40', 'Sous terre']]) {
            await p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') }).locator('select').selectOption(l);
            await champ('Ex: Base du P80, Poste médical...').fill(nom);
            await p.locator('label:visible', { hasText: type }).first().click();
            await b('+ Ajouter').click();
        }
        await b(/^Fermer$/, { dernier: true }).click();
        await b(/^👥 Équipes$/).click();
        await p.locator('label:visible', { hasText: 'Sous terre' }).first().click();
        await champ('Titre (ex: Reconnaissance Zone Nord)').fill('Reconnaissance');
        await champ('Détaillez précisément ce que l\'équipe doit faire...').fill('Descendre au P40.');
        const type = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
        if (!(await type.inputValue())) await type.selectOption({ index: 1 });
        for (const n of ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé']) await p.locator('label:visible', { hasText: n }).last().locator('input[type="checkbox"]').check();
        await b('Créer l\'Équipe').click();
        await p.waitForTimeout(500);
        await b(/^Fermer$/, { dernier: true }).click();
        for (const txt of ['Point de situation au COS.', 'Appel de la mairie : gymnase ouvert.', 'Départ de l\'équipe 1.']) {
            await champ('Description...').fill(txt);
            await b(/^✓ ENREGISTRER$/).click();
            await p.waitForTimeout(400);
            const v = p.locator('button:visible', { hasText: /✓ Valider \(/ });
            if (await v.count()) await v.click();
        }
        await p.waitForTimeout(2500); // sauvegarde différée
        await app.close();

        // ---------- 2. Contrôle de l'ancienne mémoire
        fs.cpSync(D, copieLecture, { recursive: true });
        fs.cpSync(D, copieReseau, { recursive: true });
        const exe = require(path.join(RESEAU, 'node_modules', 'electron'));
        const sortie = execFileSync(exe, [path.join(__dirname, 'lecteur')], { env: { ...process.env, DONNEES: copieLecture }, encoding: 'utf8' });
        const anciens = JSON.parse(sortie.split('\n').find(l => l.startsWith('RESULTAT ')).slice(9));
        console.log(`\nAncienne mémoire (version officielle) : ${anciens.length} secours`);
        anciens.forEach(a => console.log(`   ${a.rescueId} : ${a.evenements} év., ${a.sauveteurs} sauveteurs, ${a.equipes} équipes`));
        controler('La version officielle a bien enregistré le secours', anciens.some(a => a.evenements > 3));

        // ---------- 3. Version réseau : premier lancement sur la copie
        const lancerReseau = async () => {
            const a = await electron.launch({ args: [RESEAU], cwd: RESEAU, env: { ...process.env, SSF_TEST_USER_DATA: copieReseau, SSF_PORT: '0' } });
            const page = await fenetrePrincipale(a, 120000);
            await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
            await page.waitForTimeout(3000);
            const texte = await page.evaluate(() => document.body.innerText);
            await a.close();
            return texte;
        };
        const ecran1 = await lancerReseau();
        const rapport = JSON.parse(fs.readFileSync(path.join(copieReseau, 'reprise-memoire-navigateur.json'), 'utf8'));
        const repris = lireSecours(copieReseau);
        console.log(`\nReprise : ${rapport.secours.length} repris, ${rapport.ignores.length} ignorés, ${rapport.erreurs.length} erreurs ; réglages : ${Object.keys(rapport.reglages || {}).join(', ')}`);
        for (const a of anciens) {
            if (!a.evenements && !a.sauveteurs && !a.equipes) {
                controler(`${a.rescueId} (vide) ignoré, comme prévu`, rapport.ignores.some(i => i.rescueId === a.rescueId && i.raison === 'vide'));
                continue;
            }
            const r = repris[a.rescueId];
            controler(`${a.rescueId} repris à l'identique (${a.evenements} év., ${a.sauveteurs} sauveteurs, ${a.equipes} équipes)`,
                !!r && (r.events || []).length === a.evenements && (r.masterSauveteursList || []).length === a.sauveteurs && (r.teams || []).length === a.equipes);
            if (r) controler(`   points phones, planning, infos du secours présents (${(r.pointsPhone || []).length} PP, ${Object.keys(r.planning || {}).length} lignes de planning)`,
                (r.pointsPhone || []).length >= 2 && Object.keys(r.planning || {}).length >= 5 && r.missionInfo && r.missionInfo.nomCavite === 'Gouffre de la Répétition');
        }
        controler('Secours rouvert à l\'écran au premier lancement de la version réseau', ecran1.includes('Gouffre de la Répétition'));
        controler('Réglages du poste repris (secrétaire)', !!(rapport.reglages && rapport.reglages.ssf_current_secretaire));

        // ---------- 4. Second lancement : pas de nouvelle reprise
        const avant = fs.readFileSync(path.join(copieReseau, 'reprise-memoire-navigateur.json'), 'utf8');
        const ecran2 = await lancerReseau();
        controler('Second lancement : pas de seconde reprise, secours toujours là',
            fs.readFileSync(path.join(copieReseau, 'reprise-memoire-navigateur.json'), 'utf8') === avant && ecran2.includes('Gouffre de la Répétition'));
    } finally {
        for (const d of [D, copieLecture, copieReseau]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
    }
    const tout = ok.length && ok.every(Boolean);
    console.log(tout ? '\n✅ Répétition réussie : la mise à jour reprend le secours de la version officielle.' : '\n❌ Répétition : écart constaté.');
    process.exitCode = tout ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
