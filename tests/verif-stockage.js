// ============================================
// VÉRIFICATION : stockage, journal et canal du serveur (lot 1)
// ============================================
// Exécuté dans Node.js, sans l'application, dans un dossier de données jetable :
// 1. fichiers par partie, journal, création différée d'un secours vide, renommage, liste ;
// 2. arrêt brutal : actions dans le journal mais fichiers pas encore écrits → rattrapées au
//    chargement, sans en appliquer deux fois ;
// 3. canal : le poste principal (jeton) modifie, le poste en consultation reçoit l'action et
//    ne peut rien modifier.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-stockage.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { creerMoteur } = require('../serveur/moteur');
const { demarrerServeur } = require('../serveur/serveur');
const { creerCanal } = require('../serveur/canal');

const RACINE = path.join(__dirname, '..');
let nbKo = 0;
const verifier = (libelle, ok, detail) => { if (!ok) nbKo++; console.log(`${ok ? '✅' : '❌'} ${libelle}${!ok && detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const ligne = (id, numero) => ({ id, numero, isoTimestamp: '2026-03-14T08:00:00.000Z', dateHeure: '14/03/2026 09:00:00', evenement: 'Ligne ' + numero, fait: false });

(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-stockage-'));
    try {
        // ===== 1. Fichiers et journal
        let moteur = creerMoteur({ racineApp: RACINE, racineDonnees: donnees, delaiEcritureMs: 50 });
        moteur.ouvrir('secours-courant');
        verifier('Secours neuf vide : pas encore écrit sur le disque', moteur.lister().length === 0);
        moteur.ouvrir('EXERCICE - Test - 14-03-2026');
        moteur.appliquer({ type: 'SAUVETEURS/LISTE_AJOUTER', sauveteur: { id: 'S1', name: 'ALPHA Anne', role: 'Secouriste', SSF: '00' } }, 'test');
        moteur.appliquer({ type: 'MC/AJOUTER', evenement: ligne('e1', '001') }, 'test');
        await pause(150);
        const rep = path.join(donnees, 'secours', 'exercice---test---14-03-2026');
        const fichiers = fs.readdirSync(rep).sort();
        verifier(`Fichiers du secours : ${fichiers.join(', ')}`, ['dossier.json', 'equipes.json', 'inscription.json', 'journal.log', 'main-courante.json', 'mission.json', 'planning.json', 'points-phone.json', 'sauvegardes'].every(f => fichiers.includes(f)));
        const journal = fs.readFileSync(path.join(rep, 'journal.log'), 'utf8').trim().split('\n').map(JSON.parse);
        verifier('Journal : 2 actions dans l\'ordre, avec origine et heure', journal.length === 2 && journal[0].version === 1 && journal[1].action.type === 'MC/AJOUTER' && journal[1].origine === 'test' && !!journal[1].recuLe);
        const mc = JSON.parse(fs.readFileSync(path.join(rep, 'main-courante.json'), 'utf8'));
        verifier('Main courante écrite (version 2)', mc.version === 2 && mc.donnees.events.length === 1);
        verifier('Liste des secours', moteur.lister().length === 1 && moteur.lister()[0].rescueId === 'EXERCICE - Test - 14-03-2026' && moteur.lister()[0].nbEvenements === 1);
        let refus = null;
        try { moteur.appliquer({ type: 'ACTION/INEXISTANTE' }); } catch (e) { refus = e.message; }
        verifier('Action invalide refusée sans rien écrire', /Action inconnue/.test(refus || '') && moteur.actif().version === 2);
        const sauvegarde = moteur.stockage.sauvegarder('EXERCICE - Test - 14-03-2026');
        verifier('Sauvegarde horodatée', fs.readdirSync(sauvegarde).includes('main-courante.json'));
        moteur.fermer();

        // ===== 2. Arrêt brutal : journal écrit, fichiers non écrits
        moteur = creerMoteur({ racineApp: RACINE, racineDonnees: donnees, delaiEcritureMs: 60000 });
        moteur.ouvrir('EXERCICE - Test - 14-03-2026');
        moteur.appliquer({ type: 'MC/AJOUTER', evenement: ligne('e2', '002') }, 'test');
        moteur.appliquer({ type: 'SAUVETEURS/LISTE_MODIFIER', id: 'S1', name: 'ALPHA Annie', role: 'Médecin', SSF: '30' }, 'test');
        // pas de fermer() : les fichiers ne sont pas écrits (écriture différée d'une minute)
        const mcAvant = JSON.parse(fs.readFileSync(path.join(rep, 'main-courante.json'), 'utf8'));
        verifier('Avant reprise : fichiers en retard sur le journal', mcAvant.version === 2 && mcAvant.donnees.events.length === 1);
        const reprise = creerMoteur({ racineApp: RACINE, racineDonnees: donnees, delaiEcritureMs: 50 });
        const ouvert = reprise.ouvrir('EXERCICE - Test - 14-03-2026');
        verifier('Reprise : actions du journal rattrapées', ouvert.version === 4 && ouvert.donnees.events.length === 2 && ouvert.donnees.masterSauveteursList[0].name === 'ALPHA Annie', { version: ouvert.version, n: ouvert.donnees.events.length });
        // Partie déjà à jour (écrite) + journal : l'action n'est pas appliquée deux fois
        const mcApres = JSON.parse(fs.readFileSync(path.join(rep, 'main-courante.json'), 'utf8'));
        verifier('Reprise : fichiers mis à jour', mcApres.version === 4 && mcApres.donnees.events.length === 2);
        reprise.fermer();
        const encore = creerMoteur({ racineApp: RACINE, racineDonnees: donnees }).ouvrir('EXERCICE - Test - 14-03-2026');
        verifier('Rechargement suivant : rien en double', encore.donnees.events.length === 2 && encore.version === 4);

        // Ligne recopiée du papier envoyée par un autre poste : l'heure du papier n'est pas recalée
        {
            const m = creerMoteur({ racineApp: RACINE, racineDonnees: donnees, delaiEcritureMs: 60000 });
            const papier = { id: 'p1', numero: '#AUTO', isoTimestamp: '2026-03-14T13:30:00.000Z', evenement: 'Papier', recopie: { par: 'Rita', le: '2000-01-01T00:00:00.000Z' } };
            const a = m.horodaterActionDistante({ type: 'MC/RECOPIER', evenement: papier }, 'Rita (192.168.1.30)');
            const b = m.horodaterActionDistante({ type: 'MC/AJOUTER', evenement: { ...papier, isoTimestamp: '2026-03-14T13:30:00.000Z' } }, 'Rita (192.168.1.30)');
            verifier("Recopie papier d'un autre poste : heure du papier gardée, heure de recopie = serveur",
                a.evenement.isoTimestamp === papier.isoTimestamp && a.evenement.recopie.par === 'Rita' && Date.now() - Date.parse(a.evenement.recopie.le) < 5000
                && a.evenement.poste === 'Rita (192.168.1.30)' && b.evenement.isoTimestamp !== papier.isoTimestamp, a.evenement);
            m.fermer();
        }

        // Renommage et suppression
        moteur = creerMoteur({ racineApp: RACINE, racineDonnees: donnees, delaiEcritureMs: 50 });
        moteur.ouvrir('EXERCICE - Test - 14-03-2026');
        moteur.renommer('EXERCICE - Test - 14-03-2026', 'EXERCICE - Test renommé');
        verifier('Renommage du secours', moteur.lister().map(d => d.rescueId).includes('EXERCICE - Test renommé') && moteur.actif().rescueId === 'EXERCICE - Test renommé');
        moteur.toutSupprimer();
        verifier('Suppression de tous les secours', moteur.lister().length === 0 && moteur.actif() === null);
        moteur.fermer();

        // ===== 3. Canal : poste principal et poste en consultation
        moteur = creerMoteur({ racineApp: RACINE, racineDonnees: donnees, delaiEcritureMs: 50 });
        const { serveur, port } = await demarrerServeur({ racine: RACINE, port: 0 });
        const canal = creerCanal({ serveurHttp: serveur, moteur, jetonPrincipal: 'JETON-TEST', versionApp: '99.0.0' });
        const connecter = (jeton) => new Promise((resoudre) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}/canal${jeton ? '?jeton=' + jeton : ''}`);
            const recus = [];
            ws.on('message', (m) => recus.push(JSON.parse(m)));
            ws.on('open', () => resoudre({ ws, recus, envoyer: (x) => ws.send(JSON.stringify(x)) }));
        });
        const principal = await connecter('JETON-TEST');
        const consultation = await connecter(null);
        const intrus = await connecter('MAUVAIS-JETON');
        await pause(200);
        verifier('Rôles : principal (bon jeton), consultation (sans jeton ou mauvais jeton)',
            principal.recus.find(m => m.type === 'bienvenue').role === 'principal'
            && consultation.recus.find(m => m.type === 'bienvenue').role === 'consultation'
            && intrus.recus.find(m => m.type === 'bienvenue').role === 'consultation');
        verifier('Version de l\'application transmise', consultation.recus.find(m => m.type === 'bienvenue').versionApp === '99.0.0');
        principal.envoyer({ type: 'ouvrir', rescueId: 'SECOURS - Canal', donneesSiNouveau: { missionInfo: { typeSecours: 'secours', nomCavite: 'Canal', commune: 'Ici', delaiAlerteOccupation: 360 } } });
        await pause(200);
        const etatRecu = consultation.recus.find(m => m.type === 'etat');
        verifier('Ouverture : état transmis au poste en consultation (données en cours reprises)', etatRecu && etatRecu.rescueId === 'SECOURS - Canal' && etatRecu.donnees.missionInfo.nomCavite === 'Canal');
        principal.envoyer({ type: 'action', ref: 'r1', action: { type: 'MC/AJOUTER', evenement: ligne('c1', '001') } });
        await pause(200);
        verifier('Action du poste principal acceptée', principal.recus.some(m => m.type === 'accepte' && m.ref === 'r1' && m.version === 1));
        verifier('Action transmise au poste en consultation', consultation.recus.some(m => m.type === 'action' && m.action.evenement.id === 'c1'));
        consultation.envoyer({ type: 'action', ref: 'x1', action: { type: 'MC/AJOUTER', evenement: ligne('pirate', '999') } });
        intrus.envoyer({ type: 'toutSupprimer' });
        await pause(200);
        verifier('Poste en consultation : modification refusée', consultation.recus.some(m => m.type === 'refus' && m.ref === 'x1') && moteur.actif().donnees.events.length === 1);
        verifier('Mauvais jeton : suppression refusée', intrus.recus.some(m => m.type === 'refus') && moteur.lister().length === 1);
        const postes = principal.recus.filter(m => m.type === 'postes').pop();
        verifier('Liste des postes connectés', postes && postes.liste.length === 3);
        consultation.ws.close();
        await pause(200);
        verifier('Déconnexion : liste mise à jour', principal.recus.filter(m => m.type === 'postes').pop().liste.length === 2);
        principal.ws.close(); intrus.ws.close();
        canal.fermer(); serveur.close(); moteur.fermer();
    } finally {
        fs.rmSync(donnees, { recursive: true, force: true });
    }
    console.log(nbKo === 0 ? '\n✅ Stockage, journal et canal conformes.' : '\n❌ Stockage, journal ou canal non conformes.');
    process.exitCode = nbKo === 0 ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
