// ============================================
// VÉRIFICATION : identifiants uniques des événements (lot 0, A2)
// ============================================
// 1. nouvelId() : 20 000 identifiants sans doublon, au format UUID, y compris avec la
//    version de secours (poste en http://192.168.x.x, sans crypto.randomUUID).
// 2. Un ancien dossier contenant des identifiants en double est réparé à la réouverture
//    (le premier garde son identifiant), et la validation d'un rappel ne touche plus
//    que l'événement concerné.
// 3. Un événement saisi reçoit un identifiant au format UUID.
//
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-identifiants.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');

const RACINE = path.join(__dirname, '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

(async () => {
    const dossierDonnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-ids-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossierDonnees } });
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    try {
        const page = await app.firstWindow();
        await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        const charger = async () => {
            await page.reload();
            await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
            await page.waitForTimeout(1000);
        };
        const bouton = (texte) => page.locator('button:visible', { hasText: texte });
        await charger();

        // 1. nouvelId()
        const r = await page.evaluate(() => {
            const test = () => {
                const ids = Array.from({ length: 10000 }, nouvelId);
                return { distincts: new Set(ids).size, exemple: ids[0], formatOk: ids.every(i => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(i)) };
            };
            const normal = test();
            const original = crypto.randomUUID;
            Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
            const secours = test();
            Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
            return { normal, secours };
        });
        controler(`nouvelId (randomUUID) : ${r.normal.distincts}/10000 distincts, format UUID (ex. ${r.normal.exemple})`, r.normal.distincts === 10000 && r.normal.formatOk);
        controler(`nouvelId (version de secours, sans randomUUID) : ${r.secours.distincts}/10000 distincts, format UUID (ex. ${r.secours.exemple})`, r.secours.distincts === 10000 && r.secours.formatOk);

        // 2. Ancien dossier avec identifiants en double (comme Date.now() dans la même milliseconde)
        await page.evaluate(() => {
            const ev = (id, numero, texte, rappel) => ({
                id, numero, evenement: texte, categorie: 'communication', secretaire: 'Ancien',
                isoTimestamp: '2026-03-14T07:00:00.000Z', dateHeure: '14/03/2026 08:00:00', fait: false,
                messageImportant: false, dateRappel: rappel ? '2026-03-14' : '', heureRappel: rappel ? '08:30' : '',
            });
            const dossier = {
                version: '13.41.11', rescueId: 'ANCIEN - Doublons - 14-03-2026', timestamp: '2026-03-14T07:00:00.000Z',
                masterSauveteursList: [], activeSauveteurIds: [], sauveteurPermanentNumbers: {}, nextPermanentNumber: 1,
                teams: [], usedTeamNumbers: [], secretaires: ['Ancien'], pointsPhone: [],
                missionInfo: { typeSecours: 'exercice', nomCavite: 'Doublons', commune: 'Vieilleville', delaiAlerteOccupation: 360 },
                clotureInfo: null, planning: {}, startHour: 0, totalDays: 3, mcMode: 'principale', mcIdentifiant: '', mcConfigured: true,
                events: [
                    ev(1773471600000, '001', 'Premier message', true),
                    ev(1773471600000, '002', 'Deuxième message (même milliseconde)', true),
                    ev(1773471600001, '003', 'Troisième message', false),
                ],
                nextEventNumber: 4,
            };
            localStorage.setItem('SSF_UNIFIED_STATE_ancien---doublons---14-03-2026_V13', JSON.stringify(dossier));
            localStorage.setItem('ssf_current_secretaire', 'Vérificateur');
        });
        await charger();
        await bouton('Rouvrir un dossier').click();
        await page.getByText('Doublons', { exact: false }).first().click();
        await bouton('Rouvrir').last().click();
        await page.waitForTimeout(1500);
        const lireEvenements = () => page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('SSF_UNIFIED_STATE_ancien---doublons---14-03-2026_V13'));
            return d.events.map(e => ({ id: e.id, numero: e.numero, fait: e.fait }));
        });
        let evs = await lireEvenements();
        controler(`Ancien dossier : identifiants ${JSON.stringify(evs.map(e => e.id))}`,
            new Set(evs.map(e => e.id)).size === 3 && evs[0].id === 1773471600000 && evs[2].id === 1773471600001 && UUID.test(evs[1].id));

        // Validation du rappel du 1er événement dans la fenêtre « Alertes en attente » :
        // avant réparation, le 2e (même identifiant) était validé en même temps
        const carte = page.locator('div:visible', { hasText: 'N°001' })
            .filter({ has: page.locator('button', { hasText: 'Traité' }) }).last();
        await carte.locator('button', { hasText: 'Traité' }).click();
        await page.waitForTimeout(1500);
        // Fermeture des fenêtres restantes (alerte 002, choix du mode)
        await page.locator('button:visible', { hasText: '×' }).last().click().catch(() => {});
        await page.getByText('PC de Terrain', { exact: false }).last().click();
        await bouton('Confirmer et Démarrer').last().click();
        await page.waitForTimeout(1000);
        evs = await lireEvenements();
        const e1 = evs.find(e => e.numero === '001'), e2 = evs.find(e => e.numero === '002');
        controler(`Validation du rappel 001 : 001 fait=${e1.fait}, 002 fait=${e2.fait}`, e1.fait === true && e2.fait === false);

        // 3. Nouvel événement saisi
        await page.locator('textarea[placeholder="Description..."]').fill('Nouveau message après réparation.');
        await bouton(/^✓ ENREGISTRER$/).click();
        await page.waitForTimeout(1500);
        const dernier = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('SSF_UNIFIED_STATE_ancien---doublons---14-03-2026_V13'));
            return d.events.find(e => (e.evenement || '').includes('Nouveau message'));
        });
        controler(`Nouvel événement : identifiant ${dernier && dernier.id}`, !!dernier && UUID.test(dernier.id));
    } finally {
        await app.close();
        fs.rmSync(dossierDonnees, { recursive: true, force: true });
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Identifiants uniques.' : '\n❌ Problème d\'identifiants.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
