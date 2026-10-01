// ============================================
// VÉRIFICATION : saisie de la main courante sur plusieurs postes (lot 2)
// ============================================
// Un poste principal et deux postes de saisie (fenêtres de navigateur sans jeton) :
// 1. saisie autorisée → les deux autres postes passent en « saisie » ;
// 2. trois lignes saisies EN MÊME TEMPS sur les trois postes → numéros uniques et consécutifs,
//    identiques sur tous les postes ; heure et poste de saisie donnés par le serveur ;
// 3. inscription autorisée sur un poste de saisie (lot 3) ; action réservée au poste principal
//    (clôture du secours) → refusée, rien d'enregistré ;
// 4. correction d'une ligne depuis un poste de saisie → historique visible sur le poste principal ;
// 5. rappel dépassé validé en même temps sur deux postes → une seule validation ;
// 6. passage d'une équipe à un point phone saisi sur un poste de saisie → planning mis à jour.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-saisie-multiposte.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { attendreEcriture, lireSecours, fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');
const NAVIGATEUR = path.join(__dirname, 'aides', 'navigateur');
const ID_SECOURS = /Gouffre Multiposte/;

(async () => {
    const dossiers = [0, 1, 2].map(i => fs.mkdtempSync(path.join(os.tmpdir(), `ssf-multi-${i}-`)));
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const apps = [];
    const secours = async () => { await attendreEcriture(); const tous = lireSecours(dossiers[0]); return tous[Object.keys(tous).find(k => ID_SECOURS.test(k))]; };
    try {
        // ===== Poste principal
        const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossiers[0], SSF_PORT: '0' } });
        apps.push(app);
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.__SSF_TEST__ = {}; window.alert = () => {}; window.confirm = () => true; });
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1000);
        const b = (page, t) => page.locator('button:visible', { hasText: t });
        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre Multiposte');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Multiville');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b(p, 'Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b(p, 'Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Principal');
        await b(p, /^✓ Enregistrer$/).click();
        // Équipe 1 (2 sauveteurs) et points phones, préparés par les actions nommées
        await p.evaluate(() => {
            const a = window.__SSF_TEST__.actions;
            a.ajouterSauveteurListe({ id: 'S1', name: 'ALPHA Anne', role: 'Secouriste', SSF: '00' });
            a.ajouterSauveteurListe({ id: 'S2', name: 'BRAVO Bob', role: 'Secouriste', SSF: '00' });
            a.arriveeSauveteurs(['S1', 'S2']);
            a.ajouterPointPhone('B', 'Puits', 'souterre', '');
            const h = new Date().toISOString();
            a.creerEquipe({ id: 'T1', name: 'Équipe 1', mission: 'Reconnaissance', ordreMission: '', typeMission: 'Reconnaissance', lieu: 'souterre',
                members: ['S1', 'S2'], createdAt: h, status: 'active', dissolvedAt: null, history: [] }, h, []);
        });
        await b(p, '🌐 Mode réseau').click();
        await b(p, 'Activer le mode réseau').click();
        await p.waitForTimeout(1500);
        const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
        // La case se coche à la réponse du serveur
        await p.locator('label', { hasText: 'Autoriser la saisie sur les autres postes' }).locator('input').click();
        await p.waitForFunction(() => [...document.querySelectorAll('label')].some(l => l.innerText.includes('Autoriser la saisie') && l.querySelector('input').checked), null, { timeout: 10000 });
        await p.waitForTimeout(800);
        await b(p, /^Fermer$/).last().click();

        // ===== Deux postes de saisie
        const postes = [];
        for (const i of [1, 2]) {
            const nav = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: dossiers[i], SSF_URL: adresse + '/' } });
            apps.push(nav);
            const v = await nav.firstWindow();
            await v.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
            await v.evaluate((n) => localStorage.setItem('ssf_current_secretaire', 'Secrétaire ' + n), i);
            await v.reload();
            await v.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
            await v.waitForTimeout(2000);
            postes.push(v);
        }
        const texte = (page) => page.evaluate(() => document.body.innerText);
        controler('1. Les deux autres postes sont en « saisie »', (await texte(postes[0])).includes('Poste de saisie') && (await texte(postes[1])).includes('Poste de saisie'));

        // ===== 2. Trois lignes en même temps
        const saisir = async (page, txt) => {
            await page.locator('textarea[placeholder="Description..."]').fill(txt);
            await page.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click();
        };
        await Promise.all([saisir(p, 'Ligne du poste principal'), saisir(postes[0], 'Ligne du poste de saisie 1'), saisir(postes[1], 'Ligne du poste de saisie 2')]);
        await p.waitForTimeout(2000);
        let s = await secours();
        const lignes = s.events.filter(e => /^Ligne du poste/.test(e.evenement || ''));
        const numeros = s.events.map(e => e.numero);
        controler(`2. Trois lignes enregistrées, numéros uniques : ${lignes.map(e => e.numero).join(', ')}`, lignes.length === 3 && new Set(numeros).size === numeros.length);
        const nums = numeros.map(Number).sort((x, y) => x - y);
        controler(`2. Numéros consécutifs de 1 à ${nums.length}, prochain numéro ${s.nextEventNumber}`, nums.every((n, i) => n === i + 1) && s.nextEventNumber === nums.length + 1);
        const distantes = lignes.filter(e => e.poste);
        controler(`2. Lignes des postes de saisie : poste noté (${distantes.map(e => e.poste).join(', ')}) et heure du serveur`,
            distantes.length === 2 && distantes.every(e => Math.abs(Date.parse(e.isoTimestamp) - Date.now()) < 60000));
        const vu = await Promise.all([p, ...postes].map(async page => {
            const t = await texte(page);
            return lignes.every(l => t.includes(l.evenement));
        }));
        controler('2. Les trois lignes sont visibles sur les trois postes', vu.every(Boolean));
        const memesNumeros = await Promise.all(postes.map(async page => {
            const t = await texte(page);
            return lignes.every(l => t.includes(l.numero));
        }));
        controler('2. Mêmes numéros affichés sur les postes de saisie', memesNumeros.every(Boolean));

        // ===== 3. Inscription autorisée (lot 3) ; clôture réservée au poste principal
        await b(postes[0], 'Liste Préfectorale').click();
        await postes[0].locator('input[placeholder="NOM"]:visible').fill('CHARLIE');
        await postes[0].locator('input[placeholder="Prénom"]:visible').fill('Carl');
        await b(postes[0], '+ Ajouter').click();
        await postes[0].waitForTimeout(1000);
        await b(postes[0], /^Fermer$/).last().click();
        await b(postes[0], 'Clôturer le secours').click();
        await b(postes[0], 'Heure actuelle').click();
        await postes[0].waitForTimeout(1000);
        const tInterdit = await texte(postes[0]);
        s = await secours();
        controler('3. Liste préfectorale depuis un poste de saisie : sauveteur ajouté', s.masterSauveteursList.some(x => x.name === 'CHARLIE Carl'));
        controler('3. Clôture depuis un poste de saisie : refusée avec message, rien d\'enregistré',
            tInterdit.includes('réservée au poste principal') && !s.clotureInfo && !s.events.some(e => (e.evenement || '').includes('CLÔTURE')));

        // ===== 4. Correction depuis un poste de saisie
        const ligneP = postes[0].locator('tr:visible', { hasText: 'Ligne du poste principal' }).first();
        await ligneP.locator('button', { hasText: '✏️' }).first().click();
        await postes[0].waitForTimeout(500);
        await postes[0].locator('textarea:visible').last().fill('Ligne du poste principal (corrigée sur le poste 1)');
        await b(postes[0], '💾 Enregistrer').click();
        await p.waitForTimeout(1500);
        const tCorr = await texte(p);
        s = await secours();
        const corrigee = s.events.find(e => (e.evenement || '').includes('corrigée sur le poste 1'));
        controler('4. Correction enregistrée avec l\'ancienne version, l\'auteur et le poste',
            corrigee && corrigee.corrections.length === 1 && corrigee.corrections[0].avant.evenement === 'Ligne du poste principal'
            && corrigee.corrections[0].par.includes('Secrétaire 1') && corrigee.corrections[0].par.includes('Poste'));
        controler('4. Poste principal : « Corrigée par … » affiché', tCorr.includes('Ligne du poste principal (corrigée sur le poste 1)') && tCorr.includes('Corrigée par Secrétaire 1'));

        // ===== 5. Rappel dépassé validé en même temps sur deux postes
        await p.evaluate(() => {
            const avant = new Date(Date.now() - 10 * 60000);
            const pad = (n) => String(n).padStart(2, '0');
            window.__SSF_TEST__.actions.ajouterLigneMC({
                id: 'rappel-test', isoTimestamp: new Date().toISOString(), dateHeure: new Date().toLocaleString('fr-FR'),
                secretaire: 'Principal', categorie: 'communication', evenement: 'Rappel à valider', numero: NUMERO_AUTO, fait: false,
                messageImportant: false, dateRappel: `${avant.getFullYear()}-${pad(avant.getMonth() + 1)}-${pad(avant.getDate())}`, heureRappel: `${pad(avant.getHours())}:${pad(avant.getMinutes())}`,
            });
        });
        await p.waitForTimeout(2000);
        const traiter = (page) => page.locator('div:visible', { hasText: 'Rappel à valider' })
            .filter({ has: page.locator('button', { hasText: 'Traité' }) }).last().locator('button', { hasText: 'Traité' }).click();
        await Promise.all([traiter(postes[0]), traiter(postes[1])]);
        await p.waitForTimeout(2000);
        s = await secours();
        const validations = s.events.filter(e => (e.evenement || '').includes('Rappel à valider') && (e.evenement || '').startsWith('✓'));
        controler(`5. Rappel validé sur deux postes en même temps : ${validations.length} ligne de validation`, validations.length === 1 && s.events.find(e => e.id === 'rappel-test').fait === true);

        // ===== 6. Passage d'une équipe au point phone B, saisi sur le poste de saisie 2
        await postes[1].locator('input[placeholder="T1..."]').fill('Équipe 1');
        await postes[1].locator('input[placeholder="A, B..."]').fill('B');
        await postes[1].locator('textarea[placeholder="Description..."]').fill('Équipe 1 au puits');
        await b(postes[1], /^✓ ENREGISTRER$/).click();
        await postes[1].waitForTimeout(800);
        await b(postes[1], '✓ Valider (').click();
        await p.waitForTimeout(2000);
        s = await secours();
        const passage = s.events.find(e => e.evenement === 'Équipe 1 au puits');
        const majPlanning = s.events.find(e => (e.evenement || '').includes('Activité "Sous Terre"'));
        const slot = (() => { const d = new Date(); let m = d.getHours() * 60 + d.getMinutes() - s.startHour * 60; if (m < 0) m += 1440; return Math.floor(m / 15); })();
        controler('6. Passage au point phone saisi sur un poste de saisie : ligne et mise à jour du planning',
            !!passage && passage.poste && !!majPlanning && s.planning.S1[slot] === 'souterre' && s.planning.S2[slot] === 'souterre');
    } finally {
        for (const a of apps.reverse()) await a.close().catch(() => {});
        dossiers.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Saisie sur plusieurs postes conforme.' : '\n❌ Saisie sur plusieurs postes non conforme.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
