// ============================================
// VÉRIFICATION : pare-feu du poste principal (mode réseau)
// ============================================
// 1. Lecture de l'état (sans droits) : règle existante → « autorisé », règle absente → « absent ».
// 2. Application, mode réseau activé avec une règle existante (SSF_PARE_FEU_NOM) : la fenêtre
//    « Mode réseau » affiche « les autres postes sont autorisés », sans demande d'autorisation.
// 3. Tests sans SSF_PARE_FEU_NOM : aucune vérification (aucune demande d'autorisation possible).
// Windows seulement (ailleurs : vérification ignorée). La règle « <nom de l'application> »
// doit exister (autoriser-pare-feu.cmd) pour le point 2 ; sinon il est ignoré.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-pare-feu.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('./outils-fichiers');
const { creerPareFeu } = require('../serveur/parefeu');

const RACINE = path.join(__dirname, '..');
const REGLE = require('../package.json').productName; // nom de la règle = nom de l'application

(async () => {
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    if (process.platform !== 'win32') { console.log('⏭️ Pare-feu : vérification Windows seulement.'); return; }

    // 1. Lecture
    const existante = await creerPareFeu({ nomRegle: REGLE }).etat();
    const absente = await creerPareFeu({ nomRegle: 'Règle SSF inexistante ' + Date.now() }).etat();
    controler(`Règle absente : « ${absente.statut} »`, absente.statut === 'absent');
    controler(`Autre système : « inconnu »`, (await creerPareFeu({ nomRegle: 'x', plateforme: 'linux' }).etat()).statut === 'inconnu');

    // 2 et 3. Affichage dans l'application
    const essai = async (env) => {
        const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-pare-feu-'));
        const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0', ...env } });
        try {
            const p = await fenetrePrincipale(app);
            await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
            await p.reload();
            await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
            await p.waitForTimeout(1000);
            const b = (t) => p.locator('button:visible', { hasText: t });
            await b('Passer').last().click().catch(() => {});
            await p.getByText('PC de Terrain', { exact: false }).last().click().catch(() => {});
            await b('Confirmer et Démarrer').last().click().catch(() => {});
            await p.waitForTimeout(1500);
            await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Test').catch(() => {});
            await b(/^✓ Enregistrer$/).click().catch(() => {});
            await b('🌐 Mode réseau').click();
            await b('Activer le mode réseau').click();
            await p.waitForFunction(() => document.body.innerText.includes('Mode réseau activé'), null, { timeout: 30000 });
            await p.waitForTimeout(1000);
            return await p.evaluate(() => document.body.innerText);
        } finally {
            await app.close().catch(() => {});
            fs.rmSync(donnees, { recursive: true, force: true });
        }
    };
    if (existante.statut === 'autorise') {
        controler(`Règle « ${REGLE} » existante : « autorisé »`, true);
        const t = await essai({ SSF_PARE_FEU_NOM: REGLE });
        controler('Fenêtre « Mode réseau » : « Pare-feu Windows : les autres postes sont autorisés »', t.includes('Pare-feu Windows : les autres postes sont autorisés'));
    } else {
        console.log(`⏭️ Règle « ${REGLE} » absente sur ce PC (${existante.statut}) : affichage « autorisé » non vérifié.`);
    }
    const t = await essai({});
    controler('Tests (sans SSF_PARE_FEU_NOM) : aucune ligne pare-feu, aucune demande d\'autorisation', !t.includes('Pare-feu'));

    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Pare-feu conforme.' : '\n❌ Pare-feu non conforme.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
