// ============================================
// VÉRIFICATION : fenêtre « ✂️ Scinder » et rafraîchissement de la fenêtre Équipes
// ============================================
// Un membre décoché dans la fenêtre « Scinder » reste décoché quand l'application se rafraîchit
// pendant que la fenêtre est ouverte (ici : mise à jour automatique du planning au quart d'heure),
// et ne part pas dans la nouvelle équipe.
// Utilisation : node tests/verif-scinder.js

process.env.FILM_RAPIDE = '1';
const { executer } = require('./film/tutoriels/outils');
const P = require('./film/tutoriels/preparation');

const controles = [];
const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };

executer('_verif-scinder', 'vérification', async (t) => {
    const p = t.page;
    await P.creerDossier(t);
    await P.remplirListe(t, 4);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David']);
    await P.creerEquipe(t, { titre: 'Reconnaissance', membres: ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David'] });
    await t.clic(t.bouton(/Planning Op/));
    await t.cocher(p.locator('label:visible', { hasText: 'Mise à jour automatique du planning' }).locator('input'));
    await t.clic(t.bouton(/Main Courante/));

    await t.clic(t.bouton(/^👥 Équipes$/));
    const carte = p.locator('div.border-blue-300:visible').filter({ has: p.getByText('Équipe 1', { exact: true }) }).first();
    if (!(await carte.locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(carte.locator('div.cursor-pointer').first());
    await t.clic(carte.locator('button', { hasText: '✂️ Scinder' }));
    const fenetre = p.locator('div', { has: p.locator('h3', { hasText: '✂️ Scinder' }) }).last();
    const caseDe = (nom) => fenetre.locator('label', { hasText: nom }).locator('input[type="checkbox"]');
    await caseDe('DUBOIS Chloé').uncheck();
    await fenetre.locator('input[placeholder="Ex: 2B"]').fill('1C');
    controler('DUBOIS décochée avant le rafraîchissement', !(await caseDe('DUBOIS Chloé').isChecked()));

    // Rafraîchissement pendant que la fenêtre est ouverte : mise à jour automatique du planning
    // (40 min : le dernier quart d'heure terminé est alors vide, il est comblé)
    await p.clock.fastForward(40 * 60000);
    await p.waitForTimeout(1500);
    controler('DUBOIS toujours décochée après le rafraîchissement', !(await caseDe('DUBOIS Chloé').isChecked()));
    controler('BERNARD et THOMAS toujours cochés', (await caseDe('BERNARD Bruno').isChecked()) && (await caseDe('THOMAS David').isChecked()));
    controler('numéro saisi conservé (1C)', (await fenetre.locator('input[placeholder="Ex: 2B"]').inputValue()) === '1C');

    await t.clic(fenetre.locator('button', { hasText: '✂️ Créer Équipe' }));
    await p.waitForTimeout(800);
    const mc = await p.locator('table tbody tr', { hasText: 'Scission' }).first().innerText();
    controler('nouvelle équipe 1C avec BERNARD et THOMAS seulement',
        mc.includes('Équipe 1C') && mc.includes('BERNARD Bruno') && mc.includes('THOMAS David') && !mc.includes('DUBOIS Chloé'));

    if (controles.some(ok => !ok)) throw new Error(`${controles.filter(ok => !ok).length} contrôle(s) en échec`);
});
