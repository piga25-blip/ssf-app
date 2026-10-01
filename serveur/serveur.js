// ============================================
// SERVEUR INTÉGRÉ (lot 1 du plan réseau)
// ============================================
// Sert l'interface de l'application (index.html, scripts, bibliothèques, images) au poste
// principal (fenêtre Electron) et, en mode réseau, aux autres postes du réseau local.
// Seule une liste précise de fichiers est servie : jamais main.js, les tests, la
// documentation, node_modules ni les fichiers de données.

const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.jsx': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
};

// Fichiers autorisés : à la racine, l'interface et ses scripts ; plus les dossiers hooks/, libs/, assets/
const RACINE_AUTORISEE = /^[A-Za-z0-9_-]+\.(html|js|jsx)$/;
const RACINE_INTERDITE = new Set(['main.js', 'preload.js']);
const DOSSIERS_AUTORISES = new Set(['hooks', 'libs', 'assets']);

// Chemin relatif demandé → chemin du fichier sur le disque, ou null si non autorisé
const fichierAutorise = (racine, chemin) => {
    let relatif;
    try { relatif = decodeURIComponent(chemin.split('?')[0]).replace(/^\/+/, ''); } catch (e) { return null; }
    if (relatif === '') relatif = 'index.html';
    const morceaux = relatif.split('/');
    if (morceaux.some(m => m === '' || m === '.' || m === '..')) return null;
    if (morceaux.length === 1) {
        if (!RACINE_AUTORISEE.test(relatif) || RACINE_INTERDITE.has(relatif) || relatif.startsWith('App_SSF_')) return null;
    } else if (!DOSSIERS_AUTORISES.has(morceaux[0])) {
        return null;
    }
    // Aucun « .. » ni morceau vide : le chemin reste forcément dans le dossier de l'application
    return path.join(racine, ...morceaux);
};

// Démarre le serveur. port : port souhaité (0 = au hasard, pour les tests) ; si le port est
// pris, essaie les suivants. hote : '127.0.0.1' (ce poste seulement) ou '0.0.0.0' (réseau local).
const demarrerServeur = ({ racine, port = 8080, hote = '127.0.0.1', essais = 20 }) => new Promise((resoudre, rejeter) => {
    const serveur = http.createServer((req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
        const fichier = fichierAutorise(racine, req.url);
        if (!fichier) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Introuvable'); return; }
        fs.readFile(fichier, (err, contenu) => {
            if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Introuvable'); return; }
            res.writeHead(200, {
                'Content-Type': TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            });
            res.end(req.method === 'HEAD' ? undefined : contenu);
        });
    });
    let tentative = 0;
    const ecouter = (p) => serveur.listen(p, hote);
    serveur.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port !== 0 && tentative < essais) { tentative++; ecouter(port + tentative); return; }
        rejeter(err);
    });
    serveur.once('listening', () => {
        serveur.removeAllListeners('error');
        serveur.on('error', (e) => console.error('Serveur SSF :', e.message));
        const etat = { serveur, port: serveur.address().port, hote };
        // Mode réseau : écoute sur ce poste seulement (127.0.0.1) ou sur le réseau local (0.0.0.0),
        // même port, sans couper l'application (les postes connectés se reconnectent seuls)
        etat.changerHote = (nouvelHote) => new Promise((ok, ko) => {
            if (nouvelHote === etat.hote) { ok(etat); return; }
            serveur.close();
            serveur.once('error', ko);
            serveur.listen(etat.port, nouvelHote, () => { serveur.removeListener('error', ko); etat.hote = nouvelHote; ok(etat); });
        });
        resoudre(etat);
    });
    ecouter(port);
});

// Adresses IPv4 de ce poste sur le réseau local (pour les autres postes)
const adressesReseau = () => {
    const resultat = [];
    for (const [nom, liste] of Object.entries(require('os').networkInterfaces())) {
        for (const i of liste || []) {
            if (i.family === 'IPv4' && !i.internal) resultat.push({ interface: nom, adresse: i.address });
        }
    }
    return resultat;
};

module.exports = { demarrerServeur, fichierAutorise, adressesReseau };
