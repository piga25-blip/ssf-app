// ============================================
// VÉRIFICATION : mode réseau et poste en consultation (lot 1)
// ============================================
// 1. Poste principal : création d'un secours, activation du mode réseau, adresse affichée.
// 2. Autre poste (fenêtre de navigateur sans jeton) : ouvre cette adresse → bandeau
//    « consultation seule », secours affiché.
// 3. Ligne saisie sur le poste principal → visible sur l'autre poste.
// 4. Tentative de saisie sur l'autre poste → refusée, rien n'est enregistré.
// 5. Liste des postes connectés ; désactivation du mode réseau → l'autre poste est déconnecté.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-reseau.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { attendreEcriture, lireSecours, fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');
const NAVIGATEUR = path.join(__dirname, 'aides', 'navigateur');

(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-reseau-'));
    const donneesAutre = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-autre-poste-'));
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    let app = null, autre = null;
    try {
        // 1. Poste principal
        app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0' } });
        const page = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await page.waitForTimeout(1000);
        const bouton = (p, t) => p.locator('button:visible', { hasText: t });
        await page.getByText('EXERCICE', { exact: true }).click();
        await page.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre Réseau');
        await page.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Lanville');
        await page.locator('select:visible').filter({ has: page.locator('option[value="0"]') }).last().selectOption('6');
        await bouton(page, 'Créer le dossier et continuer').click();
        await page.getByText('PC de Terrain', { exact: false }).last().click();
        await bouton(page, 'Confirmer et Démarrer').last().click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Principal');
        await bouton(page, /^✓ Enregistrer$/).click();

        await bouton(page, '🌐 Mode réseau').click();
        await bouton(page, 'Activer le mode réseau').click();
        await page.waitForTimeout(1500);
        const adresse = await page.locator('span.font-mono.text-xl').first().innerText().catch(() => null);
        const codeSession = await page.locator('span.font-mono.text-2xl').first().innerText();
        controler(`Mode réseau activé, adresse affichée : ${adresse}`, !!adresse && /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/.test(adresse));
        controler('Code QR de l\'adresse affiché', (await page.locator('img[alt^="Code QR"]').count()) > 0);
        await page.screenshot({ path: path.join(__dirname, 'sortie', 'mode-reseau.png') });
        await bouton(page, /^Fermer$/).last().click();
        if (!adresse) throw new Error('pas d\'adresse réseau sur ce poste : test impossible');

        // 2. Autre poste
        autre = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: donneesAutre, SSF_URL: adresse + '/?code=' + codeSession } });
        const vue = await autre.firstWindow();
        await vue.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await vue.waitForTimeout(2000);
        const texteAutre = () => vue.evaluate(() => document.body.innerText);
        let t = await texteAutre();
        controler('Autre poste : bandeau « consultation seule » et secours affiché', t.includes('Poste en consultation seule') && t.includes('Gouffre Réseau') && t.includes('Connecté au poste principal'));
        controler('Autre poste : pas de fenêtre de démarrage', !t.includes('Application SSF — Démarrage'));

        // 3. Ligne saisie sur le poste principal → visible sur l'autre poste
        await page.locator('textarea[placeholder="Description..."]').fill('Message diffusé aux autres postes.');
        await bouton(page, /^✓ ENREGISTRER$/).click();
        await vue.waitForTimeout(1500);
        t = await texteAutre();
        controler('Ligne du poste principal visible sur l\'autre poste', t.includes('Message diffusé aux autres postes.'));

        // 4. Tentative de saisie sur l'autre poste (secrétaire renseigné, pour aller jusqu'à l'envoi)
        await vue.evaluate(() => localStorage.setItem('ssf_current_secretaire', 'Secrétaire distant'));
        await vue.reload();
        await vue.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await vue.waitForTimeout(2000);
        await vue.locator('textarea[placeholder="Description..."]').fill('Tentative depuis un poste en consultation.');
        await vue.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click();
        await vue.waitForTimeout(1000);
        t = await texteAutre();
        controler('Autre poste : saisie refusée avec message', t.includes('consultation seule : modification impossible'));
        await attendreEcriture();
        const enregistre = Object.values(lireSecours(donnees)).find(d => d.missionInfo && d.missionInfo.nomCavite === 'Gouffre Réseau');
        controler('Rien d\'enregistré depuis l\'autre poste', enregistre && !enregistre.events.some(e => (e.evenement || '').includes('Tentative')));

        // 5. Postes connectés, puis désactivation
        await bouton(page, '🌐 Mode réseau').click();
        await page.waitForTimeout(500);
        let fenetre = await page.evaluate(() => document.body.innerText);
        controler('Poste principal : 1 poste connecté listé', fenetre.includes('Postes connectés (1)') && fenetre.includes('Consultation'));
        await bouton(page, /^Désactiver$/).click();
        await page.waitForTimeout(2000);
        fenetre = await page.evaluate(() => document.body.innerText);
        controler('Mode réseau désactivé : plus de poste connecté', fenetre.includes('Mode réseau désactivé') && fenetre.includes('Postes connectés (0)'));
        t = await texteAutre();
        controler('Autre poste : connexion perdue affichée', t.includes('Connexion perdue'));
        const reglages = JSON.parse(fs.readFileSync(path.join(donnees, 'reglages-serveur.json'), 'utf8'));
        controler('Réglage conservé (mode réseau désactivé)', reglages.modeReseau === false);
    } finally {
        if (autre) await autre.close().catch(() => {});
        if (app) await app.close().catch(() => {});
        fs.rmSync(donnees, { recursive: true, force: true });
        fs.rmSync(donneesAutre, { recursive: true, force: true });
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Mode réseau et consultation conformes.' : '\n❌ Mode réseau ou consultation non conformes.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
