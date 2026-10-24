// ============================================
// VÉRIFICATION : textes affichés (version 14)
// ============================================
// 1. Fenêtre de démarrage : les données sont dans des fichiers sur le PC (plus « dans ce navigateur »).
// 2. Fenêtre « Mise à jour planning » : nom de l'activité (« Sous Terre »), pas son identifiant (« souterre »).
// Utilisation : node tests/verif-textes.js

process.env.FILM_RAPIDE = '1';
const { executer } = require('./film/tutoriels/outils');
const P = require('./film/tutoriels/preparation');

const controles = [];
const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };

executer('_verif-textes', 'vérification', async (t) => {
    const p = t.page;
    const demarrage = await p.locator('body').innerText();
    controler('démarrage : « enregistrées au fur et à mesure dans des fichiers sur ce PC »', demarrage.includes('enregistrées au fur et à mesure dans des fichiers sur ce PC'));
    controler('démarrage : plus de « sur ce navigateur »', !demarrage.includes('sur ce navigateur'));

    await P.creerDossier(t);
    await P.remplirListe(t, 2);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno']);
    await P.pointsPhone(t);
    await P.creerEquipe(t, { titre: 'Reconnaissance', membres: ['MARTIN Alice', 'BERNARD Bruno'] });
    // Point B (sous terre) : la fenêtre de mise à jour du planning s'ouvre
    await t.saisir(t.champ('T1...'), 'Équipe 1');
    await t.saisir(t.champ('A, B...'), 'B');
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    const titre = p.locator('h3:visible', { hasText: 'Mise à jour planning' }).first();
    await titre.waitFor({ timeout: 5000 }).catch(() => {});
    const texte = (await titre.innerText().catch(() => '')).trim();
    controler(`fenêtre du planning : « ${texte} »`, texte === 'Mise à jour planning — Sous Terre');

    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Textes affichés conformes.' : '\n❌ Défaut(s) encore présent(s).');
    if (!ok) process.exitCode = 1;
});
