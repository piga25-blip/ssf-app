// ============================================
// VÉRIFICATION : code de session, rôles par poste, hors connexion (lot 4)
// ============================================
// 1. Mode réseau : code de session à 6 chiffres affiché sur le poste principal.
// 2. Autre poste sans code → fenêtre « Code de session », aucune donnée reçue ; mauvais code
//    refusé ; bon code → connecté, nommé d'après son secrétaire.
// 3. Adresse du code QR (?code=…) → connexion directe, code retiré de l'adresse.
// 4. Rôle réglé poste par poste : l'un en saisie, l'autre en consultation.
// 5. Changement du code → les autres postes sont déconnectés et doivent saisir le nouveau code.
// 6. Hors connexion : saisie bloquée avec message, copie de secours proposée ; rien n'est
//    envoyé au retour de la connexion.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-session.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { attendreEcriture, lireSecours, fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');
const NAVIGATEUR = path.join(__dirname, 'aides', 'navigateur');

(async () => {
    const dossiers = [0, 1, 2].map(i => fs.mkdtempSync(path.join(os.tmpdir(), `ssf-session-${i}-`)));
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const apps = [];
    const secours = async () => { await attendreEcriture(); const tous = lireSecours(dossiers[0]); return tous[Object.keys(tous).find(k => /Gouffre Session/.test(k))]; };
    const texte = (page) => page.evaluate(() => document.body.innerText);
    const b = (page, t) => page.locator('button:visible', { hasText: t });
    const pret = (page) => page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
    try {
        // ===== Poste principal
        const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossiers[0], SSF_PORT: '0' } });
        apps.push(app);
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await p.reload(); await pret(p); await p.waitForTimeout(1000);
        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre Session');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Codeville');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b(p, 'Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b(p, 'Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Principal');
        await b(p, /^✓ Enregistrer$/).click();
        await b(p, '🌐 Mode réseau').click();
        await b(p, 'Activer le mode réseau').click();
        await p.waitForTimeout(1500);
        const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
        let code = await p.locator('span.font-mono.text-2xl').first().innerText();
        controler(`1. Code de session affiché : ${code}`, /^\d{6}$/.test(code));

        // ===== 2. Autre poste A sans code
        const navA = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: dossiers[1], SSF_URL: adresse + '/' } });
        apps.push(navA);
        const a = await navA.firstWindow();
        await navA.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await pret(a);
        await a.evaluate(() => localStorage.setItem('ssf_current_secretaire', 'Aline'));
        await a.reload(); await pret(a); await a.waitForTimeout(1500);
        let t = await texte(a);
        controler('2. Sans code : fenêtre « Code de session », aucune donnée du secours', t.includes('Code de session') && !t.includes('Gouffre Session'));
        await a.locator('input[placeholder="000000"]').fill('999999');
        await b(a, 'Se connecter').click();
        await a.waitForTimeout(1500);
        t = await texte(a);
        const mauvais = code === '999999' || t.includes('Code incorrect');
        await a.locator('input[placeholder="000000"]').fill(code);
        await b(a, 'Se connecter').click();
        await a.waitForTimeout(2000);
        t = await texte(a);
        controler('2. Mauvais code refusé, bon code accepté (secours affiché)', mauvais && t.includes('Gouffre Session') && !t.includes('Code de session'));
        await b(p, /^Fermer$/).last().click();
        await b(p, '🌐 Mode réseau').click();
        await p.waitForTimeout(500);
        t = await texte(p);
        controler('2. Poste A nommé d\'après son secrétaire', /Aline \(\d+\.\d+\.\d+\.\d+\)/.test(t));

        // ===== 3. Autre poste B par l'adresse du code QR
        const navB = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: dossiers[2], SSF_URL: `${adresse}/?code=${code}` } });
        apps.push(navB);
        const bb = await navB.firstWindow();
        await navB.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await pret(bb); await bb.waitForTimeout(2000);
        t = await texte(bb);
        controler('3. Adresse du code QR : connexion directe, code retiré de l\'adresse', t.includes('Gouffre Session') && !bb.url().includes('code='));
        await bb.evaluate(() => localStorage.setItem('ssf_current_secretaire', 'Bruno'));
        await bb.reload(); await pret(bb); await bb.waitForTimeout(1500);

        // ===== 4. Rôles poste par poste (par défaut : consultation) → A en saisie
        await p.waitForTimeout(500);
        const ligneA = p.locator('tr', { hasText: 'Aline' });
        await ligneA.locator('select').selectOption('saisie');
        await p.waitForTimeout(1500);
        const saisir = async (page, txt) => {
            await page.locator('textarea[placeholder="Description..."]').fill(txt);
            await page.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click();
            await page.waitForTimeout(1500);
        };
        await saisir(a, 'Ligne du poste A');
        await saisir(bb, 'Ligne du poste B');
        let s = await secours();
        controler('4. Poste A (saisie) : ligne enregistrée ; poste B (consultation) : refusée',
            s.events.some(e => e.evenement === 'Ligne du poste A') && !s.events.some(e => e.evenement === 'Ligne du poste B')
            && (await texte(a)).includes('Poste de saisie') && (await texte(bb)).includes('consultation seule'));

        // ===== 5. Changement du code
        await b(p, 'Changer le code').click();
        await p.waitForTimeout(2000);
        const nouveau = await p.locator('span.font-mono.text-2xl').first().innerText();
        controler(`5. Nouveau code ${nouveau} : les autres postes doivent le saisir`, nouveau !== code && (await texte(a)).includes('Code de session') && (await texte(bb)).includes('Code de session'));
        code = nouveau;
        await a.locator('input[placeholder="000000"]').fill(code);
        await b(a, 'Se connecter').click();
        await a.waitForTimeout(2000);

        // ===== 6. Hors connexion (mode réseau désactivé)
        await b(p, /^Désactiver$/).click();
        await p.waitForTimeout(2000);
        await a.locator('textarea[placeholder="Description..."]').fill('Ligne saisie hors connexion');
        await a.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click();
        await a.waitForTimeout(500);
        t = await texte(a);
        controler('6. Hors connexion : saisie bloquée avec message, copie de secours proposée', t.includes('Hors ligne : saisie impossible') && t.includes('Copie de secours'));
        await b(p, 'Activer le mode réseau').click();
        await a.waitForTimeout(12000); // reconnexion automatique (délais jusqu'à 10 s)
        t = await texte(a);
        s = await secours();
        controler('6. Retour de la connexion : reconnecté, la ligne hors connexion n\'a pas été envoyée',
            t.includes('Connecté au poste principal') && !s.events.some(e => e.evenement === 'Ligne saisie hors connexion'));
    } finally {
        for (const x of apps.reverse()) await x.close().catch(() => {});
        dossiers.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Code de session, rôles et hors connexion conformes.' : '\n❌ Code de session, rôles ou hors connexion non conformes.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
