// ============================================
// VÉRIFICATION : reprise des données des versions précédentes (lot 1)
// ============================================
// 1. Une aide de test remplit la mémoire du navigateur en file:// comme la version 13 :
//    un secours (avec deux lignes au même identifiant et sans point phone du PC), un secours
//    vide et des réglages du poste.
// 2. L'application est lancée sur ce dossier de données : le secours est repris en fichiers
//    (le vide est ignoré), les réglages du poste sont recopiés, le secours se rouvre à l'écran.
// 3. Second lancement : la reprise n'est pas refaite ; l'ancienne mémoire est intacte.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-reprise.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { attendreEcriture, lireSecours, fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');
const AIDE = path.join(__dirname, 'aides', 'memoire-ancienne');
const ID = 'EXERCICE - Ancien Gouffre - 01-09-2026';

const ancienSecours = {
    version: '13.41.13', rescueId: ID, timestamp: '2026-09-01T10:00:00.000Z',
    masterSauveteursList: [{ id: 'EXT-001', name: 'ANCIEN Albert', role: 'Secouriste', SSF: '25' }],
    activeSauveteurIds: ['EXT-001'], sauveteurPermanentNumbers: { 'EXT-001': 1 }, nextPermanentNumber: 2,
    teams: [], usedTeamNumbers: [], secretaires: ['Ancien'],
    pointsPhone: [{ lettre: 'A', nom: 'Entrée', typePP: 'entree', ordre: 1 }],
    missionInfo: { typeSecours: 'exercice', nomCavite: 'Ancien Gouffre', commune: 'Vieilleville', delaiAlerteOccupation: 360 },
    clotureInfo: null, planning: {}, startHour: 8, totalDays: 3, mcMode: 'principale', mcIdentifiant: '', mcConfigured: true,
    events: [
        { id: 1756720800000, numero: '001', evenement: 'Arrivée de : ANCIEN Albert', isoTimestamp: '2026-09-01T10:00:00.000Z', dateHeure: '01/09/2026 12:00:00', fait: false },
        { id: 1756720800000, numero: '002', evenement: 'Même milliseconde', isoTimestamp: '2026-09-01T10:00:00.000Z', dateHeure: '01/09/2026 12:00:00', fait: false },
    ],
    nextEventNumber: 3,
};

(async () => {
    const dossierDonnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-reprise-'));
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const env = { ...process.env, SSF_TEST_USER_DATA: dossierDonnees, SSF_PORT: '0' };
    try {
        // 1. Ancienne mémoire (file://)
        let aide = await electron.launch({ args: [AIDE], env });
        let page = await aide.firstWindow();
        await page.evaluate(({ id, secours }) => {
            localStorage.setItem('SSF_UNIFIED_STATE_exercice---ancien-gouffre---01-09-2026_V13', JSON.stringify(secours));
            localStorage.setItem('SSF_UNIFIED_STATE_secours-courant_V13', JSON.stringify({ rescueId: 'secours-courant', events: [], masterSauveteursList: [] }));
            localStorage.setItem('ssf_current_secretaire', 'Ancien secrétaire');
            localStorage.setItem('ssf_autosave_interval', '15');
        }, { id: ID, secours: ancienSecours });
        await aide.close();

        // 2. Premier lancement de la nouvelle version
        let app = await electron.launch({ args: [RACINE], cwd: RACINE, env });
        page = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await page.waitForTimeout(1000);
        const rapport = JSON.parse(fs.readFileSync(path.join(dossierDonnees, 'reprise-memoire-navigateur.json'), 'utf8'));
        controler(`Compte rendu : repris ${JSON.stringify(rapport.secours)}, ignorés ${JSON.stringify(rapport.ignores.map(i => i.rescueId + ' (' + i.raison + ')'))}`,
            rapport.secours.length === 1 && rapport.secours[0] === ID && rapport.ignores.some(i => i.rescueId === 'secours-courant' && i.raison === 'vide') && rapport.erreurs.length === 0);
        const reglages = await page.evaluate(() => ({ secretaire: localStorage.getItem('ssf_current_secretaire'), intervalle: localStorage.getItem('ssf_autosave_interval') }));
        controler(`Réglages du poste recopiés : ${JSON.stringify(reglages)}`, reglages.secretaire === 'Ancien secrétaire' && reglages.intervalle === '15');

        // Réouverture à l'écran
        await page.locator('button:visible', { hasText: 'Rouvrir un dossier' }).click();
        await page.getByText('Ancien Gouffre', { exact: false }).first().click();
        await page.locator('button:visible', { hasText: 'Rouvrir' }).last().click();
        await page.waitForTimeout(1500);
        const texte = await page.evaluate(() => document.body.innerText);
        controler('Secours rouvert : cavité, commune et lignes affichées', texte.includes('Ancien Gouffre') && texte.includes('Vieilleville') && texte.includes('Même milliseconde'));
        await attendreEcriture();
        const enregistre = lireSecours(dossierDonnees)[ID];
        controler(`Fichiers : identifiants réparés ${JSON.stringify(enregistre.events.map(e => e.id))}`, enregistre.events[0].id !== enregistre.events[1].id);
        controler('Fichiers : point phone du PC ajouté, sauveteur et n° permanent conservés',
            enregistre.pointsPhone[0].lettre === 'PC' && enregistre.masterSauveteursList[0].name === 'ANCIEN Albert' && enregistre.sauveteurPermanentNumbers['EXT-001'] === 1);
        await app.close();

        // 3. Second lancement : pas de nouvelle reprise ; ancienne mémoire intacte
        const temoinAvant = fs.readFileSync(path.join(dossierDonnees, 'reprise-memoire-navigateur.json'), 'utf8');
        app = await electron.launch({ args: [RACINE], cwd: RACINE, env });
        page = await fenetrePrincipale(app);
        await page.waitForTimeout(1500);
        const temoinApres = fs.readFileSync(path.join(dossierDonnees, 'reprise-memoire-navigateur.json'), 'utf8');
        controler('Second lancement : reprise non refaite (fenêtre invisible non rouverte)', JSON.parse(temoinApres).faitLe === JSON.parse(temoinAvant).faitLe && app.windows().length === 1);
        await app.close();
        aide = await electron.launch({ args: [AIDE], env });
        page = await aide.firstWindow();
        const ancienne = await page.evaluate(() => localStorage.getItem('SSF_UNIFIED_STATE_exercice---ancien-gouffre---01-09-2026_V13'));
        controler('Ancienne mémoire du navigateur intacte', !!ancienne && JSON.parse(ancienne).events.length === 2);
        await aide.close();
    } finally {
        fs.rmSync(dossierDonnees, { recursive: true, force: true });
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Reprise des données conforme.' : '\n❌ Reprise des données non conforme.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
