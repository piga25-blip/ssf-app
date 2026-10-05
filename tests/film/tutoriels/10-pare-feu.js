// Film réseau 3 : le pare-feu réglé automatiquement à l'activation du mode réseau, la
// vérification à chaque ouverture de la fenêtre, le bouton « Autoriser dans le pare-feu » et la
// procédure manuelle. Windows seulement.
// Une règle propre au film (« Application SSF Reseau (film) ») est utilisée : la vraie règle de
// l'application n'est pas touchée. Les ajouts / retraits de règle demandent les droits
// d'administrateur (Windows peut demander confirmation) ; la règle du film est retirée à la fin.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { executer } = require('./outils');
const P = require('./preparation');

const REGLE_FILM = 'Application SSF Reseau (film)';

// Retire la règle du film (droits d'administrateur, comme l'application elle-même)
const retirerRegleFilm = () => {
    const script = path.join(os.tmpdir(), `ssf-film-pare-feu-${process.pid}.cmd`);
    fs.writeFileSync(script, `@echo off\r\nnetsh advfirewall firewall delete rule name="${REGLE_FILM}" >nul 2>&1\r\n`);
    spawnSync('powershell.exe', ['-NoProfile', '-Command', `Start-Process -FilePath '${script}' -Verb RunAs -Wait -WindowStyle Hidden`], { windowsHide: true });
    try { fs.unlinkSync(script); } catch (e) { /* déjà retiré */ }
};

if (process.platform !== 'win32') { console.log('⏭️ Film du pare-feu : Windows seulement.'); process.exit(0); }
retirerRegleFilm();

executer('10-pare-feu', 'Le pare-feu, réglé automatiquement', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await t.debutFilm();
    const capture = async (nom) => { if (process.env.FILM_RAPIDE) await t.decrire('10-' + nom).catch(() => {}); };

    await t.chapitre('Pourquoi le pare-feu');
    await t.dire('Le pare-feu de l\'ordinateur bloque par défaut les connexions qui arrivent d\'autres appareils. Sans autorisation, une tablette ou un autre PC ne pourrait pas joindre le PC principal : « Ce site est inaccessible ».',
        'Il faut donc autoriser une fois les ports de l\'application SSF (8080 à 8089) dans le pare-feu du PC principal. Ce réglage reste en place ensuite.');
    await t.dire('Depuis cette version, l\'application s\'en charge elle-même, au moment où l\'on active le mode réseau.');

    await t.chapitre('Activer le mode réseau : le pare-feu est réglé');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.dire('On clique sur « Activer le mode réseau ». L\'application vérifie le pare-feu et, si l\'autorisation manque, l\'ajoute.',
        'Windows peut alors demander « Voulez-vous autoriser cette application à apporter des modifications… » : répondre Oui. Sur ce PC, Windows l\'accorde sans rien demander. Sur un Mac, c\'est le mot de passe de l\'ordinateur qui est demandé (et rien du tout si le coupe-feu du Mac est désactivé).');
    await t.clic(t.bouton('Activer le mode réseau'));
    await p.waitForFunction(() => document.body.innerText.includes('les autres postes sont autorisés'), null, { timeout: 120000 });
    // La vidéo perd quelques images pendant le passage en administrateur (Windows bascule
    // d'écran) : laisser l'écran se mettre à jour avant d'expliquer
    await t.rythme(5);
    await t.viser(p.getByText('les autres postes sont autorisés').first());
    await t.dire('La fenêtre le confirme : « 🛡️ Pare-feu Windows : les autres postes sont autorisés ». Il n\'y a rien d\'autre à faire : les tablettes et les autres PC peuvent se connecter.');
    await capture('autorise');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('Si l\'autorisation disparaît');
    await t.dire('Il peut arriver que l\'autorisation soit retirée plus tard : antivirus, mise à jour de Windows, nettoyage du PC… Simulons-le : la règle est supprimée.',
        'À chaque ouverture de la fenêtre « Mode réseau », l\'application revérifie le pare-feu : on ne croit pas à tort que tout va bien.');
    retirerRegleFilm();
    await t.rythme(2);
    await t.clic(t.bouton('🌐 Mode réseau'));
    await p.waitForFunction(() => document.body.innerText.includes('Autoriser dans le pare-feu'), null, { timeout: 30000 });
    await t.viser(p.getByText('risque de bloquer').first());
    await t.dire('L\'encadré orange prévient : « Le pare-feu Windows risque de bloquer les autres postes ». Un clic sur « 🛡️ Autoriser dans le pare-feu » rétablit l\'autorisation.',
        'C\'est le même bouton à utiliser si l\'on a répondu « Non » (ou annulé) à la demande de Windows lors de l\'activation.');
    await capture('a-autoriser');
    await t.clic(t.bouton('Autoriser dans le pare-feu'));
    await p.waitForFunction(() => document.body.innerText.includes('les autres postes sont autorisés'), null, { timeout: 120000 });
    // La vidéo perd quelques images pendant le passage en administrateur (Windows bascule
    // d'écran) : laisser l'écran se mettre à jour avant d'expliquer
    await t.rythme(5);
    await t.viser(p.getByText('les autres postes sont autorisés').first());
    await t.dire('C\'est réglé : « les autres postes sont autorisés ».');
    await capture('re-autorise');
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    await t.chapitre('En dernier recours : la procédure manuelle');
    await t.dire('Si l\'ordinateur refuse toute modification (PC d\'entreprise verrouillé, compte sans droits), la fiche d\'essai terrain donne la procédure manuelle : le script « autoriser-pare-feu.cmd » du kit, ou la règle à créer soi-même dans le pare-feu Windows (ports TCP 8080 à 8089), ou le réglage du coupe-feu sur Mac.',
        'Sur un PC verrouillé, il faudra l\'aide de la personne qui l\'administre : la fiche lui donne exactement le réglage à faire.');
    await t.rythme(3);
}, { env: { SSF_PARE_FEU_NOM: REGLE_FILM } });

process.on('exit', () => retirerRegleFilm());
