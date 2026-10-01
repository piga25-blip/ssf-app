// ============================================
// VÉRIFICATION : contrôle de version des autres postes (lot 1)
// ============================================
// Un autre poste ouvre l'application servie par le serveur (version 14.0.0). Le serveur est
// ensuite relancé en version 14.0.1 sur le même port (comme après une mise à jour du poste
// principal) : l'autre poste se reconnecte seul et demande de recharger la page.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-version.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');
const { _electron: electron } = require('playwright-core');
const { demarrerServeur } = require('../serveur/serveur');
const { creerMoteur } = require('../serveur/moteur');
const { creerCanal } = require('../serveur/canal');

const RACINE = path.join(__dirname, '..');
const NAVIGATEUR = path.join(__dirname, 'aides', 'navigateur');
const pause = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-version-'));
    const donneesAutre = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-version-autre-'));
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const moteur = creerMoteur({ racineApp: RACINE, racineDonnees: donnees, delaiEcritureMs: 50 });
    let srv = null, canal = null, autre = null;
    const lancer = async (port, versionApp) => {
        srv = await demarrerServeur({ racine: RACINE, port });
        canal = creerCanal({ serveurHttp: srv.serveur, moteur, jetonPrincipal: 'J', versionApp });
    };
    try {
        await lancer(0, '14.0.0');
        const port = srv.port;
        // Un secours ouvert par le « poste principal »
        const principal = new WebSocket(`ws://127.0.0.1:${port}/canal?jeton=J`);
        await new Promise(r => principal.on('open', r));
        principal.send(JSON.stringify({ type: 'ouvrir', rescueId: 'SECOURS - Version', donneesSiNouveau: { missionInfo: { typeSecours: 'secours', nomCavite: 'Gouffre Version', commune: 'Ici', delaiAlerteOccupation: 360 } } }));
        await pause(300);
        principal.close();

        autre = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: donneesAutre, SSF_URL: `http://127.0.0.1:${port}/` } });
        const vue = await autre.firstWindow();
        await vue.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await vue.waitForTimeout(1500);
        let t = await vue.evaluate(() => document.body.innerText);
        controler('Même version : pas de demande de rechargement', t.includes('Gouffre Version') && !t.includes('rechargez la page'));

        // « Mise à jour » du poste principal : serveur arrêté puis relancé en 14.0.1 sur le même port
        canal.fermer(); srv.serveur.close();
        await pause(500);
        await lancer(port, '14.0.1');
        await vue.waitForTimeout(6000); // reconnexion automatique (1 s, 2 s, …)
        t = await vue.evaluate(() => document.body.innerText);
        controler('Nouvelle version : demande de rechargement affichée', t.includes('Le poste principal a été mis à jour (version 14.0.1)') && t.includes('Connecté au poste principal'));
        await vue.locator('button', { hasText: 'Recharger' }).click();
        await vue.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await vue.waitForTimeout(1500);
        t = await vue.evaluate(() => document.body.innerText);
        controler('Après rechargement : plus de demande', !t.includes('rechargez la page') && t.includes('Gouffre Version'));
    } finally {
        if (autre) await autre.close().catch(() => {});
        if (canal) canal.fermer();
        if (srv) srv.serveur.close();
        moteur.fermer();
        fs.rmSync(donnees, { recursive: true, force: true });
        fs.rmSync(donneesAutre, { recursive: true, force: true });
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Contrôle de version conforme.' : '\n❌ Contrôle de version non conforme.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
