// ============================================
// VÉRIFICATION : « Exporter Tout » puis « Importer Tout »
// ============================================
// 1. Crée un secours (sauveteurs, arrivées, équipe, clôture) et capture le fichier exporté :
//    il doit contenir infos du secours, clôture, n° permanents et n° d'équipe utilisés.
// 2. Importe une version MODIFIÉE de ce fichier (autres numéros) : l'application doit
//    reprendre les numéros du fichier, pas garder ceux de la session en cours.
//
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-export-import.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');

const RACINE = path.join(__dirname, '..');

(async () => {
    const dossierDonnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-export-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossierDonnees } });
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    try {
        const page = await app.firstWindow();
        await app.context().addInitScript(() => {
            window.alert = () => {};
            window.confirm = () => true;
            // Capture du fichier exporté au lieu de le télécharger
            window.__exports = [];
            const BlobOrigine = window.Blob;
            window.Blob = function (parts, options) { window.__exports.push(parts.join('')); return new BlobOrigine(parts, options); };
        });
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await page.waitForTimeout(1000);
        const bouton = (texte) => page.locator('button:visible', { hasText: texte });
        const pause = (ms = 400) => page.waitForTimeout(ms);

        // 1. Secours de test
        await page.getByText('EXERCICE', { exact: true }).click();
        await page.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre Export');
        await page.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Exportville');
        await page.locator('select:visible').filter({ has: page.locator('option[value="0"]') }).last().selectOption('6');
        await bouton('Créer le dossier et continuer').click();
        await page.getByText('PC de Terrain', { exact: false }).last().click();
        await bouton('Confirmer et Démarrer').last().click();
        await pause(1500);
        await page.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Testeur');
        await bouton(/^✓ Enregistrer$/).click();

        await bouton('Liste Préfectorale').click();
        for (const [nom, prenom] of [['ALPHA', 'Anne'], ['BRAVO', 'Bob'], ['CHARLIE', 'Carl']]) {
            await page.locator('input[placeholder="NOM"]:visible').fill(nom);
            await page.locator('input[placeholder="Prénom"]:visible').fill(prenom);
            await bouton('+ Ajouter').click();
        }
        await bouton(/^Fermer$/).last().click();
        await bouton('Enregistrement des sauveteurs').click();
        for (const n of ['ALPHA Anne', 'BRAVO Bob', 'CHARLIE Carl']) {
            await page.locator('label:visible', { hasText: n }).first().locator('input[type="checkbox"]').check();
        }
        await bouton('Arrivée').click();
        await bouton(/^Fermer$/).last().click();
        await bouton(/^👥 Équipes$/).click();
        await page.locator('label:visible', { hasText: '🌿 Surface' }).first().click();
        await page.locator('input[placeholder="Titre (ex: Reconnaissance Zone Nord)"]').fill('Équipe export');
        await page.locator('select:visible', { has: page.locator('option', { hasText: 'Sélectionner un type' }) }).selectOption({ index: 1 });
        await page.locator('label:visible', { hasText: 'ALPHA Anne' }).last().locator('input[type="checkbox"]').check();
        await bouton('Créer l\'Équipe').click();
        await bouton(/^Fermer$/).last().click();
        await bouton('Clôturer le secours').click();
        await bouton('Heure actuelle').click();
        await pause(1000);

        // 2. Export
        await page.evaluate(() => { window.__exports = []; });
        await bouton('Exporter Tout').click();
        await pause(500);
        const texte = await page.evaluate(() => window.__exports.find(t => t.includes('"masterSauveteursList"')));
        const exporte = JSON.parse(texte);
        controler('Export : infos du secours (cavité, commune)', exporte.missionInfo?.nomCavite === 'Gouffre Export' && exporte.missionInfo?.commune === 'Exportville');
        controler('Export : clôture', !!exporte.clotureInfo?.dateHeure);
        controler(`Export : n° permanents ${JSON.stringify(exporte.sauveteurPermanentNumbers)}`, Object.keys(exporte.sauveteurPermanentNumbers || {}).length === 3);
        controler(`Export : prochain n° permanent = ${exporte.nextPermanentNumber}`, exporte.nextPermanentNumber === 4);
        controler(`Export : n° d'équipe utilisés ${JSON.stringify(exporte.usedTeamNumbers)}`, (exporte.usedTeamNumbers || []).length === 1);

        // 3. Import d'une version modifiée (numéros différents de la session en cours)
        const modifie = JSON.parse(texte);
        const ids = Object.keys(modifie.sauveteurPermanentNumbers);
        modifie.sauveteurPermanentNumbers = { [ids[0]]: 12, [ids[1]]: 10, [ids[2]]: 11 };
        modifie.nextPermanentNumber = 13;
        modifie.usedTeamNumbers = [...modifie.usedTeamNumbers, { numero: 'T7', mission: 'Ancienne mission' }];
        const fichier = path.join(dossierDonnees, 'import.json');
        fs.writeFileSync(fichier, JSON.stringify(modifie));
        await page.locator('input[type="file"][accept=".json"]').first().setInputFiles(fichier);
        await pause(1500);

        await page.evaluate(() => { window.__exports = []; });
        await bouton('Exporter Tout').click();
        await pause(500);
        const apres = JSON.parse(await page.evaluate(() => window.__exports.find(t => t.includes('"masterSauveteursList"'))));
        controler(`Import : n° permanents repris du fichier ${JSON.stringify(apres.sauveteurPermanentNumbers)}`,
            JSON.stringify(apres.sauveteurPermanentNumbers) === JSON.stringify(modifie.sauveteurPermanentNumbers));
        controler(`Import : prochain n° permanent = ${apres.nextPermanentNumber}`, apres.nextPermanentNumber === 13);
        controler('Import : n° d\'équipe utilisés repris du fichier', JSON.stringify(apres.usedTeamNumbers) === JSON.stringify(modifie.usedTeamNumbers));
        controler('Import : infos du secours et clôture', apres.missionInfo?.nomCavite === 'Gouffre Export' && !!apres.clotureInfo);
    } finally {
        await app.close();
        fs.rmSync(dossierDonnees, { recursive: true, force: true });
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Export / import complets.' : '\n❌ Export / import incomplets.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
