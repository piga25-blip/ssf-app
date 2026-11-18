// ============================================
// VÉRIFICATION : profil du réseau du poste principal (public / privé, Windows)
// ============================================
// 1. Lecture réelle (Windows, sans droits) : une entrée par connexion, profil public / privé / domaine.
//    Autres systèmes : liste vide.
// 2. Application, profil simulé « public » (SSF_PROFIL_RESEAU_TEST) : la fenêtre « Mode réseau »
//    avertit sous l'adresse et propose « Passer ce réseau en privé » ; après le clic (simulé, sans
//    demande de Windows), le réseau est indiqué comme privé et l'avertissement disparaît.
// 3. Tests sans SSF_PROFIL_RESEAU_TEST : rien n'est lu ni affiché (aucune demande possible).
// Utilisation : node tests/verif-profil-reseau.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('./outils-fichiers');
const { creerProfilReseau } = require('../serveur/profil-reseau');

const RACINE = path.join(__dirname, '..');

(async () => {
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };

    // 1. Lecture
    controler('Autre système : aucun profil', (await creerProfilReseau({ plateforme: 'darwin' }).lire()).length === 0);
    if (process.platform === 'win32') {
        const profils = await creerProfilReseau().lire();
        controler(`Lecture Windows : ${profils.map(p => `${p.interface} → ${p.profil}`).join(', ') || 'aucune connexion'}`,
            profils.every(p => ['public', 'prive', 'domaine'].includes(p.profil) && typeof p.bloqueTout === 'boolean'));
    }

    // 2 et 3. Affichage dans l'application
    const essai = async (env, suite) => {
        const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-profil-'));
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
            return await suite(p, b);
        } finally {
            await app.close().catch(() => {});
            fs.rmSync(donnees, { recursive: true, force: true });
        }
    };
    const texte = (p) => p.evaluate(() => document.body.innerText);

    await essai({ SSF_PROFIL_RESEAU_TEST: 'public' }, async (p, b) => {
        const avant = await texte(p);
        controler('Réseau public : avertissement sous l\'adresse', avant.includes('réseau public'));
        controler('Réseau public : bouton « Passer ce réseau en privé »', (await b('Passer ce réseau en privé').count()) > 0);
        await b('Passer ce réseau en privé').first().click();
        await p.waitForFunction(() => document.body.innerText.includes('comme un réseau privé'), null, { timeout: 15000 }).catch(() => {});
        const apres = await texte(p);
        controler('Après le clic : réseau indiqué comme privé', apres.includes('comme un réseau privé'));
        controler('Après le clic : plus d\'avertissement ni de bouton', !apres.includes('réseau public') && (await b('Passer ce réseau en privé').count()) === 0);
    });
    await essai({}, async (p) => {
        controler('Tests (sans SSF_PROFIL_RESEAU_TEST) : aucun profil affiché', !(await texte(p)).includes('Windows considère'));
    });

    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Profil réseau conforme.' : '\n❌ Profil réseau non conforme.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
