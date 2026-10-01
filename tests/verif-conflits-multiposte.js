// ============================================
// VÉRIFICATION : conflits et avertissements entre postes (lot 3)
// ============================================
// Poste principal + un poste de saisie, actions envoyées AU MÊME INSTANT :
// 1. les deux créent « Équipe 2 » → une seule créée, l'autre poste reçoit un refus explicite ;
// 2. les deux ajoutent le point phone « C » → un seul, refus explicite pour l'autre ;
// 3. les deux inscrivent un sauveteur avec identifiant automatique EXT-001 → EXT-001 et EXT-002 ;
// 4. une ligne de main courante ouverte en modification sur le poste principal est corrigée sur
//    l'autre poste → avertissement « modifiée sur un autre poste » dans la fenêtre ;
// 5. planning modifié sur l'autre poste pendant que le poste principal le regarde → notification.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-conflits-multiposte.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { attendreEcriture, lireSecours, fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');
const NAVIGATEUR = path.join(__dirname, 'aides', 'navigateur');

(async () => {
    const dossiers = [0, 1].map(i => fs.mkdtempSync(path.join(os.tmpdir(), `ssf-conflits-${i}-`)));
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const apps = [];
    const secours = async () => { await attendreEcriture(); const tous = lireSecours(dossiers[0]); return tous[Object.keys(tous).find(k => /Gouffre Conflits/.test(k))]; };
    const stubs = () => { window.__SSF_TEST__ = {}; window.alert = () => {}; window.confirm = () => true; };
    try {
        const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossiers[0], SSF_PORT: '0' } });
        apps.push(app);
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(stubs);
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1000);
        const b = (page, t) => page.locator('button:visible', { hasText: t });
        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre Conflits');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Conflitville');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b(p, 'Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b(p, 'Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Principal');
        await b(p, /^✓ Enregistrer$/).click();
        await p.evaluate(() => {
            const a = window.__SSF_TEST__.actions;
            a.ajouterSauveteurListe({ id: 'S1', name: 'ALPHA Anne', role: 'Secouriste', SSF: '00' });
            a.ajouterSauveteurListe({ id: 'S2', name: 'BRAVO Bob', role: 'Secouriste', SSF: '00' });
            a.arriveeSauveteurs(['S1', 'S2']);
            a.ajouterLigneMC({ id: 'ligne-a-corriger', isoTimestamp: new Date().toISOString(), dateHeure: new Date().toLocaleString('fr-FR'),
                secretaire: 'Principal', categorie: 'communication', evenement: 'Ligne à corriger', numero: NUMERO_AUTO, fait: false, messageImportant: false });
        });
        await b(p, '🌐 Mode réseau').click();
        await b(p, 'Activer le mode réseau').click();
        await p.waitForTimeout(1500);
        const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
        await p.locator('label', { hasText: 'Autoriser la saisie sur les autres postes' }).locator('input').check();
        await p.waitForTimeout(800);
        await b(p, /^Fermer$/).last().click();

        const nav = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: dossiers[1], SSF_URL: adresse + '/' } });
        apps.push(nav);
        const v = await nav.firstWindow();
        await nav.context().addInitScript(stubs);
        await v.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await v.evaluate(() => localStorage.setItem('ssf_current_secretaire', 'Distant'));
        await v.reload();
        await v.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await v.waitForTimeout(2000);
        const texte = (page) => page.evaluate(() => document.body.innerText);

        // ===== 1. « Équipe 2 » créée au même instant sur les deux postes
        const creerEquipe2 = (page, membre) => page.evaluate((m) => {
            const h = new Date().toISOString();
            window.__SSF_TEST__.actions.creerEquipe({ id: 'T2', name: 'Équipe 2', mission: 'Mission de ' + m, ordreMission: '', typeMission: 'Divers', lieu: 'surface',
                members: [m], createdAt: h, status: 'active', dissolvedAt: null, history: [] }, h, []);
        }, membre);
        await Promise.all([creerEquipe2(p, 'S1'), creerEquipe2(v, 'S2')]);
        await p.waitForTimeout(1500);
        let s = await secours();
        const t2 = s.teams.filter(t => t.id === 'T2');
        const refus = (await texte(p)).includes('existe déjà') || (await texte(v)).includes('existe déjà');
        controler(`1. « Équipe 2 » créée au même instant : ${t2.length} équipe (${t2.map(t => t.mission).join(', ')}), refus affiché à l'autre poste`, t2.length === 1 && refus);

        // ===== 2. Point phone « C » ajouté au même instant
        await p.waitForTimeout(8500); // fin des messages précédents
        await Promise.all([
            p.evaluate(() => window.__SSF_TEST__.actions.ajouterPointPhone('C', 'Salle (principal)', 'souterre', '')),
            v.evaluate(() => window.__SSF_TEST__.actions.ajouterPointPhone('C', 'Salle (distant)', 'souterre', '')),
        ]);
        await p.waitForTimeout(1500);
        s = await secours();
        const c = s.pointsPhone.filter(pp => pp.lettre === 'C');
        const refusC = (await texte(p)).includes('« C » existe déjà') || (await texte(v)).includes('« C » existe déjà');
        controler(`2. Point phone « C » ajouté au même instant : ${c.length} (${c.map(x => x.nom).join(', ')}), refus affiché`, c.length === 1 && refusC);

        // ===== 3. Inscriptions avec identifiant automatique au même instant
        await Promise.all([
            p.evaluate(() => window.__SSF_TEST__.actions.ajouterSauveteurListe({ id: 'EXT-001', name: 'PREMIER Paul', role: 'Secouriste', SSF: '00', idAuto: true })),
            v.evaluate(() => window.__SSF_TEST__.actions.ajouterSauveteurListe({ id: 'EXT-001', name: 'SECOND Sam', role: 'Secouriste', SSF: '00', idAuto: true })),
        ]);
        await p.waitForTimeout(1500);
        s = await secours();
        const ext = s.masterSauveteursList.filter(x => x.id.startsWith('EXT-')).map(x => x.id).sort();
        controler(`3. Deux inscriptions automatiques simultanées : ${ext.join(', ')}`, ext.join() === 'EXT-001,EXT-002');

        // ===== 4. Ligne en cours de modification sur le poste principal, corrigée sur l'autre poste
        await p.locator('tr:visible', { hasText: 'Ligne à corriger' }).first().locator('button', { hasText: '✏️' }).first().click();
        await p.waitForTimeout(500);
        let tp = await texte(p);
        const pasAvant = !tp.includes('modifié(e) sur un autre poste');
        await v.evaluate(() => window.__SSF_TEST__.actions.modifierLigneMC('ligne-a-corriger', { evenement: 'Ligne corrigée à distance' }, 'Distant'));
        await p.waitForTimeout(1500);
        tp = await texte(p);
        controler('4. Fenêtre de modification : avertissement « modifiée sur un autre poste » (absent avant)', pasAvant && tp.includes('Cette ligne a été modifié(e) sur un autre poste'));
        await b(p, 'Annuler').last().click();

        // ===== 5. Planning modifié sur l'autre poste pendant que le poste principal le regarde
        await b(p, 'Planning Opérationnel').click();
        await p.waitForTimeout(500);
        await v.evaluate(() => window.__SSF_TEST__.actions.affecterPlanning([{ id: 'S2', slot: 2 }], 'repas_dejeuner', null));
        await p.waitForTimeout(1000);
        tp = await texte(p);
        controler('5. Poste principal : « Planning modifié sur « Poste … » »', /Planning modifié sur « Poste /.test(tp));
        s = await secours();
        controler('5. Case modifiée enregistrée', s.planning.S2[2] === 'repas_dejeuner');
    } finally {
        for (const a of apps.reverse()) await a.close().catch(() => {});
        dossiers.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Conflits et avertissements entre postes conformes.' : '\n❌ Conflits ou avertissements non conformes.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
