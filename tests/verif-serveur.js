// ============================================
// VÉRIFICATION : serveur intégré (lot 1)
// ============================================
// Ce que le serveur sert, et surtout ce qu'il refuse de servir (code du « moteur »,
// tests, documentation, dépendances, fichiers hors du dossier de l'application).
// Exécuté dans Node.js, sans l'application. Utilisation : node tests/verif-serveur.js

const http = require('http');
const path = require('path');
const { demarrerServeur } = require('../serveur/serveur');

const RACINE = path.join(__dirname, '..');
const lire = (port, chemin) => new Promise((resoudre) => {
    // Chemin envoyé tel quel (sans normalisation) pour tester les tentatives de sortie du dossier
    const req = http.request({ host: '127.0.0.1', port, path: chemin, method: 'GET' }, (res) => {
        let corps = ''; res.on('data', d => corps += d); res.on('end', () => resoudre({ code: res.statusCode, type: res.headers['content-type'] || '', corps }));
    });
    req.on('error', (e) => resoudre({ code: 0, corps: e.message }));
    req.end();
});

(async () => {
    let nbKo = 0;
    const verifier = (libelle, ok, detail) => { if (!ok) nbKo++; console.log(`${ok ? '✅' : '❌'} ${libelle}${!ok && detail ? ' — ' + detail : ''}`); };
    const { serveur, port } = await demarrerServeur({ racine: RACINE, port: 0 });
    try {
        const servis = ['/', '/index.html', '/donnees.js', '/Events.jsx', '/hooks/useAlerts.js', '/libs/react.production.min.js', '/assets/SSF.ico'];
        for (const c of servis) {
            const r = await lire(port, c);
            verifier(`Servi : ${c}`, r.code === 200, `code ${r.code}`);
        }
        const r = await lire(port, '/index.html');
        verifier('index.html : type HTML', r.type.startsWith('text/html') && r.corps.includes('<div id="root">'), r.type);
        const refuses = ['/main.js', '/preload.js', '/package.json', '/serveur/serveur.js', '/tests/scenario-reference.js',
            '/docs/PLAN_RESEAU_LOCAL.md', '/node_modules/electron/package.json', '/../package.json', '/hooks/../main.js',
            '/%2e%2e/package.json', '/libs/%2e%2e/main.js', '/README.md', '/electron-builder.yml', '/.git/config'];
        for (const c of refuses) {
            const x = await lire(port, c);
            verifier(`Refusé : ${c}`, x.code === 404, `code ${x.code}`);
        }
        const p = await new Promise((resoudre) => {
            const req = http.request({ host: '127.0.0.1', port, path: '/index.html', method: 'POST' }, (res) => resoudre(res.statusCode));
            req.end();
        });
        verifier('Envoi de données (POST) refusé', p === 405, `code ${p}`);
        // Port déjà pris : le serveur essaie le suivant
        const second = await demarrerServeur({ racine: RACINE, port });
        verifier(`Port ${port} pris : le second serveur prend le suivant (${second.port})`, second.port === port + 1);
        second.serveur.close();
    } finally {
        serveur.close();
    }
    console.log(nbKo === 0 ? '\n✅ Serveur intégré conforme.' : '\n❌ Serveur intégré non conforme.');
    process.exitCode = nbKo === 0 ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
