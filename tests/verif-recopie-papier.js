// ============================================
// VÉRIFICATION : recopie d'une main courante papier (PC Base Arrière, 13.42.0)
// ============================================
// 1. Démarrage : plus de « Planning Déporté » ; PC Base Arrière en « Recopie d'une main courante
//    papier » (auteur du papier obligatoire).
// 2. Lignes saisies avec la date et l'heure du papier ; une ligne oubliée se range à sa place,
//    la main courante est renumérotée ; heure corrigée → rangée à nouveau.
// 3. Autre poste (saisie) : la ligne qu'il recopie garde l'heure du papier (pas recalée par le serveur).
// 4. Export des événements : repères de recopie présents.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-recopie-papier.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { attendreEcriture, lireSecours, fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');
const NAVIGATEUR = path.join(__dirname, 'aides', 'navigateur');

(async () => {
    const dossiers = [0, 1].map(i => fs.mkdtempSync(path.join(os.tmpdir(), `ssf-recopie-${i}-`)));
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const apps = [];
    const secours = async () => { await attendreEcriture(); const tous = lireSecours(dossiers[0]); return tous[Object.keys(tous).find(k => /Gouffre Papier/.test(k))]; };
    const stubs = () => { window.__alertes = []; window.alert = (m) => window.__alertes.push(String(m)); window.confirm = () => true; };
    const b = (page, t) => page.locator('button:visible', { hasText: t });
    const texte = (page) => page.evaluate(() => document.body.innerText);
    const derniereAlerte = (page) => page.evaluate(() => window.__alertes.slice(-1)[0] || '');
    const numeros = (s) => s.events.map(e => `${e.numero} ${e.dateHeure} ${e.evenement}`);
    try {
        const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossiers[0], SSF_PORT: '0' } });
        apps.push(app);
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(stubs);
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1000);
        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre Papier');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Papierville');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b(p, 'Créer le dossier et continuer').click();
        await p.waitForTimeout(800);
        let t = await texte(p);
        controler('1. Démarrage : plus de « Planning Déporté », PC de Terrain et PC Base Arrière proposés',
            !t.includes('Planning Déporté') && t.includes('PC de Terrain') && t.includes('PC Base Arrière'));
        await p.getByText('PC Base Arrière', { exact: false }).last().click();
        await p.locator('input[placeholder="Ex: MC2, VEHICULE1, BASE-A..."]').fill('vehicule1');
        await p.getByText('Recopie d\'une main courante papier').click();
        await b(p, 'Confirmer et Démarrer').last().click();
        await p.waitForTimeout(500);
        controler('1. Auteur du papier obligatoire', (await derniereAlerte(p)).includes('rédigé'));
        await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Paul PAPIER');
        await b(p, 'Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Rita RECOPIE');
        await b(p, /^✓ Enregistrer$/).click();
        await p.waitForTimeout(500);
        t = await texte(p);
        controler('1. Bandeau « Recopie de la main courante papier rédigée par Paul PAPIER »', t.includes('Recopie de la main courante papier rédigée par Paul PAPIER'));

        const saisir = async (page, date, heure, txt) => {
            if (date) await page.locator('input[type="date"]').first().fill(date);
            if (heure !== null) await page.locator('input[type="time"]').first().fill(heure);
            await page.locator('textarea[placeholder="Description..."]').fill(txt);
            await page.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click();
            await page.waitForTimeout(800);
        };
        await saisir(p, '2026-09-20', '', 'Sans heure');
        controler('2. Ligne sans heure refusée', (await derniereAlerte(p)).includes('date et l\'heure'));
        await saisir(p, '2026-09-20', '14:30', 'Équipe 1 entre sous terre');
        await saisir(p, null, '16:05', 'Équipe 1 au point C');
        await saisir(p, null, '15:10', 'Oubli : appel du CODIS');
        t = await texte(p);
        controler('2. Ligne oubliée annoncée à sa place', t.includes('Ligne rangée à sa place chronologique : N°VEHICULE1-002'));
        let s = await secours();
        controler('2. Ordre, numéros, heure du papier, auteur et recopieur enregistrés',
            numeros(s).join('|') === 'VEHICULE1-001 20/09/2026 14:30:00 Équipe 1 entre sous terre|VEHICULE1-002 20/09/2026 15:10:00 Oubli : appel du CODIS|VEHICULE1-003 20/09/2026 16:05:00 Équipe 1 au point C'
            && s.events.every(e => e.secretaire === 'Paul PAPIER' && e.recopie && e.recopie.par === 'Rita RECOPIE')
            && s.mcRecopie && s.mcRecopie.auteur === 'Paul PAPIER' && s.nextEventNumber === 4);
        controler('2. Repère « 📝 papier » dans le tableau', (await p.locator('span', { hasText: '📝 papier' }).count()) === 3);

        // Heure corrigée : 16:05 → 13:00, la ligne passe en tête
        await p.locator('tr:visible', { hasText: 'au point C' }).first().locator('button', { hasText: '✏️' }).first().click();
        await p.waitForTimeout(500);
        await p.locator('.modal-overlay input[type="time"]').first().fill('13:00');
        await b(p, /💾 Enregistrer/).last().click();
        await p.waitForTimeout(1000);
        s = await secours();
        controler('2. Heure corrigée → rangée à nouveau (VEHICULE1-001 à 13:00), correction historisée',
            s.events[0].numero === 'VEHICULE1-001' && s.events[0].dateHeure === '20/09/2026 13:00:00' && s.events[0].evenement.includes('au point C')
            && (s.events[0].corrections || []).length === 1);

        // ===== 3. Autre poste en saisie
        await b(p, '🌐 Mode réseau').click();
        await b(p, 'Activer le mode réseau').click();
        await p.waitForTimeout(1500);
        const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
        const codeSession = await p.locator('span.font-mono.text-2xl').first().innerText();
        await p.locator('label', { hasText: 'Autoriser la saisie sur les autres postes' }).locator('input').click();
        await p.waitForFunction(() => [...document.querySelectorAll('label')].some(l => l.innerText.includes('Autoriser la saisie') && l.querySelector('input').checked), null, { timeout: 10000 });
        await b(p, /^Fermer$/).last().click();
        const nav = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: dossiers[1], SSF_URL: adresse + '/?code=' + codeSession } });
        apps.push(nav);
        const v = await nav.firstWindow();
        await nav.context().addInitScript(stubs);
        await v.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await v.evaluate(() => localStorage.setItem('ssf_current_secretaire', 'Sam SAISIE'));
        await v.reload();
        await v.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await v.waitForTimeout(2000);
        await saisir(v, '2026-09-20', '14:45', 'Ligne recopiée sur un autre poste');
        await p.waitForTimeout(800);
        s = await secours();
        const distante = s.events.find(e => e.evenement === 'Ligne recopiée sur un autre poste');
        controler('3. Autre poste : heure du papier gardée, rangée à sa place, recopieur = secrétaire du poste',
            distante && distante.dateHeure === '20/09/2026 14:45:00' && distante.numero === 'VEHICULE1-003' && distante.recopie.par === 'Sam SAISIE' && /Sam SAISIE/.test(distante.poste || ''),
            distante);

        // ===== 4. Export des événements
        const fichier = path.join(dossiers[1], 'export.json');
        await app.evaluate(({ session }, f) => { session.defaultSession.once('will-download', (e, item) => item.setSavePath(f)); }, fichier);
        await b(p, '📤 Exporter Événements').click();
        await p.waitForTimeout(2000);
        const exp = JSON.parse(fs.readFileSync(fichier, 'utf8'));
        controler('4. Export des événements : auteur du papier et repères de recopie', exp.mcRecopie && exp.mcRecopie.auteur === 'Paul PAPIER' && exp.events.length === 4 && exp.events.every(e => e.recopie));
    } finally {
        for (const a of apps.reverse()) await a.close().catch(() => {});
        dossiers.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Recopie d\'une main courante papier conforme.' : '\n❌ Recopie d\'une main courante papier non conforme.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
