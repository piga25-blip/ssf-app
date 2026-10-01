// ============================================
// CANAL TEMPS RÉEL ENTRE LE SERVEUR ET LES POSTES (lot 1 du plan réseau)
// ============================================
// WebSocket sur /canal. Rôles :
// - « principal » : la fenêtre de l'application sur ce poste (jeton secret transmis par preload.js) ;
//   elle ouvre les secours et envoie toutes les actions nommées ;
// - « saisie » : autre poste, quand le poste principal autorise la saisie (lot 2) ; il peut envoyer
//   les actions de saisie (ACTIONS_SAISIE_DISTANTE : main courante, points phones, inscriptions,
//   équipes, planning), horodatées
//   par le serveur ;
// - « consultation » : autre poste sinon ; il reçoit l'état et les actions, ne peut rien modifier.
// Toute action acceptée est renvoyée à TOUS les postes, dans l'ordre où le serveur l'a appliquée.
//
// Messages poste → serveur : bonjour, ouvrir, action, lister, supprimer, toutSupprimer, renommer, modeReseau, saisieDistante
// Messages serveur → poste : bienvenue, etat, action, accepte, refus, postes, dossiers, reseau, role

const { WebSocketServer } = require('ws');

// reseau (facultatif) : { infos() → { actif, port, adresses }, basculer(actif) → Promise<infos> }
// saisie (facultatif) : { active() → booléen, changer(actif) } (saisie autorisée sur les autres postes)
const creerCanal = ({ serveurHttp, moteur, jetonPrincipal, versionApp, reseau = null, saisie = null, journalConsole = () => {} }) => {
    const wss = new WebSocketServer({ server: serveurHttp, path: '/canal', maxPayload: 20 * 1024 * 1024 });
    const postes = new Map();   // socket → { nom, role, adresse, depuis }

    const envoyer = (ws, message) => { if (ws.readyState === 1) ws.send(JSON.stringify(message)); };
    const diffuser = (message, sauf = null) => { for (const ws of postes.keys()) if (ws !== sauf) envoyer(ws, message); };
    const listePostes = () => [...postes.values()].map(p => ({ nom: p.nom, role: p.role, adresse: p.adresse, depuis: p.depuis }));
    const diffuserPostes = () => diffuser({ type: 'postes', liste: listePostes() });
    const etatActif = () => { const a = moteur.actif(); return a ? { rescueId: a.rescueId, version: a.version, donnees: a.donnees } : null; };

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, 'http://x');
        const roleDistant = () => (saisie && saisie.active() ? 'saisie' : 'consultation');
        const role = jetonPrincipal && url.searchParams.get('jeton') === jetonPrincipal ? 'principal' : roleDistant();
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
                // Poste de saisie : actions de saisie seulement (ACTIONS_SAISIE_DISTANTE)
                if (msg.type === 'action' && poste.role === 'saisie') {
                    if (!msg.action || !moteur.ACTIONS_SAISIE_DISTANTE.includes(msg.action.type)) {
                        refuser('Poste de saisie : cette action est réservée au poste principal.');
                        return;
                    }
                    const action = moteur.horodaterActionDistante(msg.action, poste.nom);
                    const version = moteur.appliquer(action, poste.nom);
                    envoyer(ws, { type: 'accepte', ref: msg.ref, version });
                    diffuser({ type: 'action', action, version });
                    return;
                }
                // Toute autre modification est réservée au poste principal
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
                    case 'saisieDistante': {
                        if (!saisie) { refuser('Saisie sur les autres postes indisponible'); return; }
                        saisie.changer(!!msg.actif);
                        const nouveauRole = saisie.active() ? 'saisie' : 'consultation';
                        for (const [s, p] of postes) {
                            if (p.role === 'principal') continue;
                            p.role = nouveauRole;
                            envoyer(s, { type: 'role', role: nouveauRole });
                        }
                        if (reseau) for (const [s, p] of postes) if (p.role === 'principal') envoyer(s, { type: 'reseau', ...reseau.infos() });
                        diffuserPostes();
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
