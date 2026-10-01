// ============================================
// VÉRIFICATION : réouverture d'un dossier clôturé
// ============================================
// Crée un dossier, le clôture, redémarre l'interface (même dossier de données),
// rouvre le dossier et vérifie que les infos du secours et la clôture sont conservées.
//
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-reouverture.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');

const RACINE = path.join(__dirname, '..');

(async () => {
    const dossierDonnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-reouverture-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossierDonnees, SSF_PORT: '0' } });
    let ok = false;
    try {
        const page = await app.firstWindow();
        await app.context().addInitScript(() => {
            window.alert = () => {};
            window.confirm = () => true;
        });
        const charger = async () => {
            await page.reload();
            await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
            await page.waitForTimeout(1000);
        };
        const bouton = (texte) => page.locator('button:visible', { hasText: texte });

        // 1. Nouveau dossier
        await charger();
        await page.getByText('EXERCICE', { exact: true }).click();
        await page.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre de Vérification');
        await page.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Contrôleville');
        await page.locator('select:visible').filter({ has: page.locator('option[value="0"]') }).last().selectOption('6');
        await bouton('Créer le dossier et continuer').click();
        await page.getByText('PC de Terrain', { exact: false }).last().click();
        await bouton('Confirmer et Démarrer').last().click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Vérificateur');
        await bouton(/^✓ Enregistrer$/).click();

        // 2. Un événement puis la clôture
        await page.locator('textarea[placeholder="Description..."]').fill('Événement de contrôle.');
        await bouton(/^✓ ENREGISTRER$/).click();
        await page.waitForTimeout(500);
        await bouton('Clôturer le secours').click();
        await bouton('Heure actuelle').click();
        await page.waitForTimeout(1500); // sauvegarde différée (600 ms)

        const avant = await page.evaluate(() => document.body.innerText);
        console.log('Avant redémarrage  : clôturé =', avant.includes('CLÔTURÉ'), '| cavité affichée =', avant.includes('Gouffre de Vérification'));
        const stocke = await page.evaluate(() => {
            const k = Object.keys(localStorage).find(c => c.includes('gouffre-de-v'));
            const d = k ? JSON.parse(localStorage.getItem(k)) : {};
            return { cle: k, missionInfo: d.missionInfo || null, clotureInfo: d.clotureInfo || null };
        });
        console.log('Dossier enregistré :', JSON.stringify(stocke));

        // 3. Redémarrage de l'interface et réouverture du dossier
        await charger();
        await bouton('Rouvrir un dossier').click();
        await page.getByText('Gouffre de Vérification', { exact: false }).first().click();
        await bouton('Rouvrir').last().click();
        await page.waitForTimeout(1500);
        const apres = await page.evaluate(() => document.body.innerText);
        const clotureOk = apres.includes('CLÔTURÉ');
        const caviteOk = apres.includes('Gouffre de Vérification') && apres.includes('Contrôleville');
        console.log('Après réouverture  : clôturé =', clotureOk, '| cavité et commune affichées =', caviteOk);
        // 4. Ancien dossier (enregistré avant la correction, sans ces infos) : la réouverture
        //    ne doit pas enregistrer de champs techniques (rawData = copie du dossier)
        await page.evaluate(() => {
            const k = Object.keys(localStorage).find(c => c.includes('gouffre-de-v'));
            const d = JSON.parse(localStorage.getItem(k));
            delete d.missionInfo; delete d.clotureInfo;
            localStorage.setItem(k, JSON.stringify(d));
        });
        await charger();
        await bouton('Rouvrir un dossier').click();
        await page.getByText('Gouffre de Vérification', { exact: false }).first().click();
        await bouton('Rouvrir').last().click();
        await page.waitForTimeout(1500);
        const ancien = await page.evaluate(() => {
            const k = Object.keys(localStorage).find(c => c.includes('gouffre-de-v'));
            return JSON.parse(localStorage.getItem(k)).missionInfo;
        });
        const ancienOk = !!ancien && !('rawData' in ancien) && !('rouvrir' in ancien);
        console.log('Ancien dossier     : missionInfo enregistré =', JSON.stringify(ancien), '→', ancienOk ? 'sans champ technique' : 'CHAMPS TECHNIQUES PRÉSENTS');
        ok = clotureOk && caviteOk && ancienOk;
    } finally {
        await app.close();
        fs.rmSync(dossierDonnees, { recursive: true, force: true });
    }
    console.log(ok ? '\n✅ Infos du secours et clôture conservées à la réouverture.' : '\n❌ Infos du secours ou clôture PERDUES à la réouverture.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
