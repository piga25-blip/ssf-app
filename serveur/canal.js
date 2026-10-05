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
// Messages poste → serveur : bonjour, ouvrir, action, lister, supprimer, toutSupprimer, renommer, modeReseau,
//   saisieDistante, roleDuPoste, changerCode
// Messages serveur → poste : bienvenue, etat, action, accepte, refus, postes, dossiers, reseau, role, code-requis

const { WebSocketServer } = require('ws');

// reseau (facultatif) : { infos() → { actif, port, adresses }, basculer(actif) → Promise<infos> }
// saisie (facultatif) : { active() → booléen, changer(actif) } (rôle par défaut des autres postes : saisie)
// session (facultatif, lot 4) : { code() → code à 6 chiffres ou null, changerCode(),
//   roleDe(idPoste) → rôle choisi pour ce poste ou undefined, definirRole(idPoste, role) }
const creerCanal = ({ serveurHttp, moteur, jetonPrincipal, versionApp, reseau = null, saisie = null, session = null, journalConsole = () => {} }) => {
    const wss = new WebSocketServer({ server: serveurHttp, path: '/canal', maxPayload: 20 * 1024 * 1024 });
    const postes = new Map();   // socket → { nom, role, adresse, depuis }

    const envoyer = (ws, message) => { if (ws.readyState === 1) ws.send(JSON.stringify(message)); };
    const diffuser = (message, sauf = null) => { for (const ws of postes.keys()) if (ws !== sauf) envoyer(ws, message); };
    const listePostes = () => [...postes.values()].map(p => ({ nom: p.nom, role: p.role, adresse: p.adresse, idPoste: p.idPoste, depuis: p.depuis }));
    // Rôle d'un autre poste : celui choisi pour lui sur le poste principal, sinon le rôle par défaut
    const roleDistant = (idPoste) => (session && idPoste && session.roleDe(idPoste)) || (saisie && saisie.active() ? 'saisie' : 'consultation');
    const informerPrincipal = () => { if (reseau) for (const [s, p] of postes) if (p.role === 'principal') envoyer(s, { type: 'reseau', ...reseau.infos() }); };
    const diffuserPostes = () => diffuser({ type: 'postes', liste: listePostes() });
    const etatActif = () => { const a = moteur.actif(); return a ? { rescueId: a.rescueId, version: a.version, donnees: a.donnees } : null; };

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, 'http://x');
        const estPrincipal = !!jetonPrincipal && url.searchParams.get('jeton') === jetonPrincipal;
        const idPoste = String(url.searchParams.get('poste') || '').slice(0, 64) || null;
        const adresse = (req.socket.remoteAddress || '').replace('::ffff:', '');
        // Code de session (lot 4) : sans le bon code, un autre poste ne reçoit rien
        const codeAttendu = session && session.code();
        if (!estPrincipal && codeAttendu && url.searchParams.get('code') !== codeAttendu) {
            envoyer(ws, { type: 'code-requis', erreur: url.searchParams.get('code') ? 'Code incorrect.' : null });
            ws.close(4001, 'code de session');
            return;
        }
        const role = estPrincipal ? 'principal' : roleDistant(idPoste);
        postes.set(ws, { nom: estPrincipal ? 'Poste principal' : 'Poste ' + adresse, role, adresse, idPoste, depuis: new Date().toISOString() });
        envoyer(ws, { type: 'bienvenue', role, versionApp, actif: etatActif(), nom: postes.get(ws).nom });
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
                        // Nom du poste : celui du secrétaire, avec l'adresse pour les autres postes
                        if (msg.nom) poste.nom = poste.role === 'principal' ? String(msg.nom).slice(0, 60) : `${String(msg.nom).slice(0, 40)} (${poste.adresse})`;
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
                    diffuser({ type: 'action', action, version, emetteur: poste.nom });
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
                        diffuser({ type: 'action', action: msg.action, version, emetteur: poste.nom });
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
                    case 'pareFeuAutoriser': {
                        if (!reseau || !reseau.autoriserPareFeu) { refuser('Réglage du pare-feu indisponible'); return; }
                        reseau.autoriserPareFeu()
                            .then(infos => { for (const [s, p] of postes) if (p.role === 'principal') envoyer(s, { type: 'reseau', ...infos }); })
                            .catch(e => refuser('Pare-feu : ' + e.message));
                        return;
                    }
                    case 'saisieDistante': {
                        if (!saisie) { refuser('Saisie sur les autres postes indisponible'); return; }
                        saisie.changer(!!msg.actif);
                        // Rôle par défaut : s'applique aux postes sans rôle choisi
                        for (const [s, p] of postes) {
                            if (p.role === 'principal') continue;
                            const r = roleDistant(p.idPoste);
                            if (r !== p.role) { p.role = r; envoyer(s, { type: 'role', role: r }); }
                        }
                        informerPrincipal();
                        diffuserPostes();
                        return;
                    }
                    case 'roleDuPoste': {
                        if (!session || !msg.idPoste || !['saisie', 'consultation'].includes(msg.role)) { refuser('Rôle impossible'); return; }
                        session.definirRole(String(msg.idPoste), msg.role);
                        for (const [s, p] of postes) if (p.idPoste === msg.idPoste && p.role !== 'principal') { p.role = msg.role; envoyer(s, { type: 'role', role: msg.role }); }
                        diffuserPostes();
                        return;
                    }
                    case 'changerCode': {
                        if (!session) { refuser('Code de session indisponible'); return; }
                        session.changerCode();
                        // Tous les autres postes doivent saisir le nouveau code
                        for (const [s, p] of postes) if (p.role !== 'principal') s.terminate();
                        informerPrincipal();
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

    return { wss, postes: listePostes, deconnecterDistants, informerPrincipal, fermer: () => { for (const ws of postes.keys()) ws.terminate(); wss.close(); } };
};

module.exports = { creerCanal };
