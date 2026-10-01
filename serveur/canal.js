// ============================================
// CANAL TEMPS RÉEL ENTRE LE SERVEUR ET LES POSTES (lot 1 du plan réseau)
// ============================================
// WebSocket sur /canal. Rôles :
// - « principal » : la fenêtre de l'application sur ce poste (jeton secret transmis par preload.js) ;
//   elle ouvre les secours et envoie les actions nommées ;
// - « consultation » : tout autre poste ; il reçoit l'état et les actions, ne peut rien modifier.
//
// Messages poste → serveur : bonjour, ouvrir, action, lister, supprimer, toutSupprimer, renommer, modeReseau
// Messages serveur → poste : bienvenue, etat, action, accepte, refus, postes, dossiers, reseau

const { WebSocketServer } = require('ws');

// reseau (facultatif) : { infos() → { actif, port, adresses }, basculer(actif) → Promise<infos> }
const creerCanal = ({ serveurHttp, moteur, jetonPrincipal, versionApp, reseau = null, journalConsole = () => {} }) => {
    const wss = new WebSocketServer({ server: serveurHttp, path: '/canal', maxPayload: 20 * 1024 * 1024 });
    const postes = new Map();   // socket → { nom, role, adresse, depuis }

    const envoyer = (ws, message) => { if (ws.readyState === 1) ws.send(JSON.stringify(message)); };
    const diffuser = (message, sauf = null) => { for (const ws of postes.keys()) if (ws !== sauf) envoyer(ws, message); };
    const listePostes = () => [...postes.values()].map(p => ({ nom: p.nom, role: p.role, adresse: p.adresse, depuis: p.depuis }));
    const diffuserPostes = () => diffuser({ type: 'postes', liste: listePostes() });
    const etatActif = () => { const a = moteur.actif(); return a ? { rescueId: a.rescueId, version: a.version, donnees: a.donnees } : null; };

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, 'http://x');
        const role = jetonPrincipal && url.searchParams.get('jeton') === jetonPrincipal ? 'principal' : 'consultation';
        const adresse = (req.socket.remoteAddress || '').replace('::ffff:', '');
        postes.set(ws, { nom: role === 'principal' ? 'Poste principal' : 'Poste ' + adresse, role, adresse, depuis: new Date().toISOString() });
        envoyer(ws, { type: 'bienvenue', role, versionApp, actif: etatActif() });
        if (role === 'principal' && reseau) envoyer(ws, { type: 'reseau', ...reseau.infos() });
        diffuserPostes();

        ws.on('message', (brut) => {
            let msg;
            try { msg = JSON.parse(brut); } catch (e) { return; }
            const poste = postes.get(ws);
            const refuser = (raison) => envoyer(ws, { type: 'refus', ref: msg.ref, raison });
            try {
                switch (msg.type) {
                    case 'bonjour':
                        if (msg.nom) poste.nom = String(msg.nom).slice(0, 60);
                        diffuserPostes();
                        return;
                    case 'lister':
                        envoyer(ws, { type: 'dossiers', liste: moteur.lister() });
                        return;
                }
                // Toute modification est réservée au poste principal
                if (poste.role !== 'principal') { refuser('Poste en consultation seule : modification impossible.'); return; }
                switch (msg.type) {
                    case 'ouvrir': {
                        moteur.ouvrir(String(msg.rescueId), msg.donneesSiNouveau || null);
                        diffuser({ type: 'etat', ...etatActif() });
                        return;
                    }
                    case 'action': {
                        const version = moteur.appliquer(msg.action, poste.nom);
                        envoyer(ws, { type: 'accepte', ref: msg.ref, version });
                        // À tous les postes, celui qui l'a envoyée compris : chacun l'applique dans cet ordre
                        diffuser({ type: 'action', action: msg.action, version });
                        return;
                    }
                    case 'renommer': {
                        moteur.renommer(String(msg.ancien), String(msg.nouveau));
                        diffuser({ type: 'etat', ...etatActif() });
                        return;
                    }
                    case 'toutSupprimer': {
                        moteur.toutSupprimer();
                        envoyer(ws, { type: 'dossiers', liste: moteur.lister() });
                        return;
                    }
                    case 'modeReseau': {
                        if (!reseau) { refuser('Mode réseau indisponible'); return; }
                        reseau.basculer(!!msg.actif)
                            .then(infos => { for (const [s, p] of postes) if (p.role === 'principal') envoyer(s, { type: 'reseau', ...infos }); })
                            .catch(e => refuser('Mode réseau : ' + e.message));
                        return;
                    }
                    case 'supprimer': {
                        moteur.supprimer(String(msg.rescueId));
                        envoyer(ws, { type: 'dossiers', liste: moteur.lister() });
                        return;
                    }
                    default:
                        refuser('Message inconnu : ' + msg.type);
                }
            } catch (e) {
                journalConsole('Erreur canal : ' + e.message);
                refuser(e.message);
            }
        });

        ws.on('close', () => { postes.delete(ws); diffuserPostes(); });
    });

    // Mode réseau désactivé : les postes connectés depuis le réseau sont déconnectés
    const estLocale = (a) => a === '127.0.0.1' || a === '::1' || a === 'localhost';
    const deconnecterDistants = () => { for (const [ws, p] of postes) if (!estLocale(p.adresse)) ws.terminate(); };

    return { wss, postes: listePostes, deconnecterDistants, fermer: () => { for (const ws of postes.keys()) ws.terminate(); wss.close(); } };
};

module.exports = { creerCanal };
