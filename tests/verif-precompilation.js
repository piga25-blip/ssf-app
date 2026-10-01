// ============================================
// VÉRIFICATION : interface précompilée par le serveur (lot 3, tablettes)
// ============================================
// Un autre poste ouvre l'application : la page précompilée ne charge pas Babel, s'affiche, et
// s'ouvre plus vite que la page d'origine (/index.html?babel=1, transformation dans le navigateur).
// Le cache sur disque évite de refaire la transformation au lancement suivant.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-precompilation.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { demarrerServeur } = require('../serveur/serveur');
const { creerMoteur } = require('../serveur/moteur');
const { creerCanal } = require('../serveur/canal');
const { creerPrecompilation } = require('../serveur/precompilation');

const RACINE = path.join(__dirname, '..');
const NAVIGATEUR = path.join(__dirname, 'aides', 'navigateur');

(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-precomp-'));
    const donneesNav = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-precomp-nav-'));
    const cache = path.join(donnees, 'cache-interface');
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const moteur = creerMoteur({ racineApp: RACINE, racineDonnees: donnees });
    let srv = null, canal = null, nav = null;
    try {
        let t = Date.now();
        creerPrecompilation(RACINE, cache).prechauffer(path.join(RACINE, 'index.html'));
        const premiere = Date.now() - t;
        t = Date.now();
        const precompilation = creerPrecompilation(RACINE, cache);
        precompilation.prechauffer(path.join(RACINE, 'index.html'));
        const suivante = Date.now() - t;
        controler(`Transformation : ${premiere} ms la première fois, ${suivante} ms au lancement suivant (cache sur disque)`, suivante < premiere / 3);

        srv = await demarrerServeur({ racine: RACINE, port: 0, precompilation });
        canal = creerCanal({ serveurHttp: srv.serveur, moteur, jetonPrincipal: 'J', versionApp: 'test' });
        const base = `http://127.0.0.1:${srv.port}/index.html`;
        nav = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: donneesNav, SSF_URL: 'about:blank' } });
        const page = await nav.firstWindow();
        const mesurer = async (url) => {
            const debut = Date.now();
            await page.goto(url);
            await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
            const duree = Date.now() - debut;
            const babel = await page.evaluate(() => typeof window.Babel !== 'undefined');
            const texte = await page.evaluate(() => document.body.innerText);
            return { duree, babel, ok: texte.includes('Poste en consultation seule') && texte.includes('Main Courante') };
        };
        await mesurer(base); // première ouverture (cache du navigateur, etc.)
        const origine = await mesurer(base + '?babel=1');
        const precomp = await mesurer(base);
        controler(`Page d'origine : Babel chargé, affichée en ${origine.duree} ms`, origine.babel && origine.ok);
        controler(`Page précompilée : sans Babel, affichée en ${precomp.duree} ms`, !precomp.babel && precomp.ok);
        controler(`Page précompilée plus rapide (${Math.round(origine.duree / Math.max(1, precomp.duree) * 10) / 10} fois)`, precomp.duree < origine.duree);
    } finally {
        if (nav) await nav.close().catch(() => {});
        if (canal) canal.fermer();
        if (srv) srv.serveur.close();
        moteur.fermer();
        fs.rmSync(donnees, { recursive: true, force: true });
        fs.rmSync(donneesNav, { recursive: true, force: true });
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Interface précompilée conforme.' : '\n❌ Interface précompilée non conforme.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
