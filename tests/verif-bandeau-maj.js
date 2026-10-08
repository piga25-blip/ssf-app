// ============================================
// VÉRIFICATION : bandeau de mise à jour (« Mise à jour prête — Cliquez pour redémarrer »)
// ============================================
// Remarque des utilisateurs : après le clic, rien n'indiquait qu'il était pris en compte, d'où un
// second clic. Le bandeau doit passer aussitôt à « Installation en cours… » et ignorer les clics
// suivants ; si la mise à jour est reportée (mode réseau actif), il redevient « Mise à jour prête ».
// Une mise à jour téléchargée est simulée (message « update-downloaded ») ; en test,
// l'application ne redémarre pas.
//
// Utilisation (depuis C:\Projets\SSF) : node tests/verif-bandeau-maj.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');

(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-maj-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0' } });
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    try {
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1500);
        const b = (t) => p.locator('button:visible', { hasText: t });
        // Message de mise à jour reportée : réponse automatique « OK »
        await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); });
        const bandeau = () => p.locator('#update-root');
        const texte = async () => (await bandeau().innerText()).trim();

        // Dossier, puis mode réseau actif
        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Bandeau');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Ici');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b('Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Testeur'); await b(/^✓ Enregistrer$/).click(); }
        await b('🌐 Mode réseau').click();
        await b('Activer le mode réseau').click();
        await p.waitForTimeout(1500);
        await b(/^Fermer$/).last().click();

        // Mise à jour téléchargée (simulée)
        await app.evaluate(({ webContents }) => { webContents.getAllWebContents().forEach(w => w.send('update-downloaded')); });
        await p.waitForTimeout(500);
        controler(`Bandeau « prête » : ${await texte()}`, (await texte()).includes('Mise à jour prête'));

        // 1. Mode réseau actif : reportée, le bandeau redevient « prête »
        await bandeau().locator('div').first().click();
        await p.waitForTimeout(1000);
        controler(`Mode réseau actif → bandeau : ${await texte()}`, (await texte()).includes('Mise à jour prête'));

        // 2. Mode réseau désactivé : confirmation immédiate, clics suivants ignorés
        await b('🌐 Mode réseau').click();
        await b(/^Désactiver$/).click();
        await p.waitForTimeout(800);
        await b(/^Fermer$/).last().click();
        await bandeau().locator('div').first().click();
        await p.waitForTimeout(300);
        controler(`Après le clic : ${await texte()}`, (await texte()).includes('Installation en cours'));
        await bandeau().locator('div').first().click();
        await p.waitForTimeout(500);
        controler('Second clic : toujours « Installation en cours »', (await texte()).includes('Installation en cours'));
    } catch (e) {
        controler('Erreur : ' + e.message.split('\n')[0], false);
    } finally {
        await app.close().catch(() => {});
        try { fs.rmSync(donnees, { recursive: true, force: true }); } catch (e) { /* verrouillé */ }
    }
    const ok = controles.every(Boolean);
    console.log(ok ? '\n✅ Bandeau de mise à jour conforme.' : '\n❌ Bandeau de mise à jour NON conforme.');
    process.exitCode = ok ? 0 : 1;
})();
