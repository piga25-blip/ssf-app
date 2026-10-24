// ============================================
// VÉRIFICATION : équipe vidée de tous ses membres
// ============================================
// Une équipe dont le dernier membre part (« Mouvement Individuel Rapide » vers le PC ou une autre
// équipe), ou dont tous les membres sont pris par une nouvelle équipe ou un ajout de membres,
// termine sa mission comme par « Fin de mission » : ligne « 🔚 Dissolution » dans la main
// courante, équipe gardée dans « Équipes Dissoutes » (réactivable s'il lui reste un membre), au
// lieu de disparaître ou de rester vide parmi les équipes actives. Une scission de tous les
// membres est refusée.
// Utilisation : node tests/verif-dernier-membre.js

process.env.FILM_RAPIDE = '1';
const { executer } = require('./film/tutoriels/outils');
const P = require('./film/tutoriels/preparation');

const controles = [];
const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };

executer('_verif-dernier-membre', 'vérification', async (t) => {
    const p = t.page;
    // Messages de l'application (alert), affichés dans la page par les outils de tournage
    const dernierMessage = async () => (await p.locator('.__film_message').allInnerTexts()).pop() || '';

    await P.creerDossier(t);
    await P.remplirListe(t, 4);
    await P.arrivees(t, ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David']);
    await P.creerEquipe(t, { titre: 'Reconnaissance', membres: ['MARTIN Alice', 'BERNARD Bruno'] });
    await P.creerEquipe(t, { titre: 'Topographie', membres: ['DUBOIS Chloé', 'THOMAS David'] });

    await t.clic(t.bouton(/^👥 Équipes$/));
    const carte = (nom) => p.locator('div.border-blue-300:visible').filter({ has: p.getByText(nom, { exact: true }) }).first();
    const deplacer = async (equipe, membre, vers) => {
        const c = carte(equipe);
        if (!(await c.locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(c.locator('div.cursor-pointer').first());
        const rangee = c.locator('div.flex.items-center.gap-2', { has: p.locator('span', { hasText: membre }) }).filter({ has: p.locator('input[placeholder="ID Équipe / PC"]') });
        await rangee.locator('input').fill(vers);
        await t.clic(rangee.locator('button', { hasText: 'Déplacer' }));
        await p.waitForTimeout(600);
    };
    const dissoutes = p.locator('div', { has: p.locator('h3', { hasText: /Équipes Dissoutes/ }) }).last();

    // Équipe 1 : un membre au PC, puis le dernier au PC
    await deplacer('Équipe 1', 'MARTIN Alice', 'PC');
    controler('premier membre libéré : pas de dissolution', !(await dernierMessage()).includes('dissoute') && await carte('Équipe 1').isVisible());
    await deplacer('Équipe 1', 'BERNARD Bruno', 'PC');
    controler('dernier membre au PC : message « elle est dissoute »', (await dernierMessage()).includes("Équipe 1 n'a plus de membre : elle est dissoute"));
    controler('Équipe 1 dans « Équipes Dissoutes »', await dissoutes.getByText('Équipe 1', { exact: true }).isVisible());

    // Équipe 2 : un membre vers l'Équipe 3 (nouvelle), puis le dernier aussi
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await P.creerEquipe(t, { titre: 'Évacuation', membres: ['MARTIN Alice'] });
    await t.clic(t.bouton(/^👥 Équipes$/));
    await deplacer('Équipe 2', 'DUBOIS Chloé', '3');
    await deplacer('Équipe 2', 'THOMAS David', '3');
    controler('dernier membre vers l\'Équipe 3 : message « elle est dissoute »', (await dernierMessage()).includes("Équipe 2 n'a plus de membre : elle est dissoute"));
    controler('Équipe 2 dans « Équipes Dissoutes »', await dissoutes.getByText('Équipe 2', { exact: true }).isVisible());

    // Réactivation : possible pour l'Équipe 1 (BERNARD gardé), refusée pour l'Équipe 2 (vide)
    const reactiver = (nom) => dissoutes.locator('div', { has: p.getByText(nom, { exact: true }) }).locator('button', { hasText: 'Réactiver' }).last();
    await t.clic(reactiver('Équipe 2'));
    controler('Équipe 2 vide : réactivation refusée avec un message', (await dernierMessage()).includes('ne peut pas être réactivée'));

    // Scission de tous les membres de l'Équipe 3 (MARTIN, DUBOIS, THOMAS) : refusée
    const c3 = carte('Équipe 3');
    if (!(await c3.locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(c3.locator('div.cursor-pointer').first());
    await t.clic(c3.locator('button', { hasText: '✂️ Scinder' }));
    const fenetre = p.locator('div', { has: p.locator('h3', { hasText: '✂️ Scinder' }) }).last();
    await fenetre.locator('label', { hasText: 'MARTIN Alice' }).locator('input[type="checkbox"]').check();
    await t.clic(fenetre.locator('button', { hasText: '✂️ Créer Équipe' }));
    controler('scission de tous les membres : refusée (« Gardez au moins un membre »)', (await dernierMessage()).includes('Gardez au moins un membre dans Équipe 3'));
    await t.clic(fenetre.locator('button', { hasText: 'Annuler' }));
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    // Nouvelle Équipe 4 avec tous les membres de l'Équipe 3 : l'Équipe 3 est dissoute
    await P.creerEquipe(t, { titre: 'Désobstruction', membres: ['MARTIN Alice', 'DUBOIS Chloé', 'THOMAS David'] });
    const questions = (await p.locator('.__film_message').allInnerTexts()).filter(m => m.includes('Déjà dans une autre équipe'));
    controler('création : la question annonce « Équipe 3 n\'aura plus de membre : elle sera dissoute »', questions.some(m => m.includes("Équipe 3 n'aura plus de membre : elle sera dissoute")));

    // Équipe 5 (BERNARD), puis ajout de tous les membres de l'Équipe 4 : l'Équipe 4 est dissoute
    await P.creerEquipe(t, { titre: 'Brancardage', membres: ['BERNARD Bruno'] });
    await t.clic(t.bouton(/^👥 Équipes$/));
    const c5 = carte('Équipe 5');
    if (!(await c5.locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(c5.locator('div.cursor-pointer').first());
    await t.clic(c5.locator('button', { hasText: '➕ Ajouter des Membres' }));
    for (const nom of ['MARTIN Alice', 'DUBOIS Chloé', 'THOMAS David']) await c5.locator('label', { hasText: nom }).locator('input[type="checkbox"]').check();
    await t.clic(c5.locator('button', { hasText: /✓ Ajouter \(3\)/ }));
    await p.waitForTimeout(600);
    controler('ajout : message « Équipe 4 n\'a plus de membre : elle est dissoute »', (await dernierMessage()).includes("Équipe 4 n'a plus de membre : elle est dissoute"));
    controler('Équipes 3 et 4 dans « Équipes Dissoutes », plus dans les actives',
        await dissoutes.getByText('Équipe 3', { exact: true }).isVisible() && await dissoutes.getByText('Équipe 4', { exact: true }).isVisible()
        && !(await carte('Équipe 3').isVisible()) && !(await carte('Équipe 4').isVisible()));

    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    const lignes = await p.locator('table tbody tr').allInnerTexts();
    const dissolution = (n) => lignes.find(l => l.includes('Dissolution Équipe ' + n));
    controler('MC : « 🔚 Dissolution Équipe 1 », dernier membre BERNARD → PC', !!dissolution(1) && dissolution(1).includes('BERNARD Bruno → PC'));
    controler('MC : « 🔚 Dissolution Équipe 2 », dernier membre THOMAS → Équipe 3', !!dissolution(2) && dissolution(2).includes('THOMAS David → Équipe 3'));
    controler('MC : « 🔚 Dissolution Équipe 3 », tous ses membres passent dans Équipe 4', !!dissolution(3) && dissolution(3).includes('Tous ses membres passent dans Équipe 4'));
    controler('MC : « 🔚 Dissolution Équipe 4 », tous ses membres passent dans Équipe 5', !!dissolution(4) && dissolution(4).includes('Tous ses membres passent dans Équipe 5'));

    if (controles.some(ok => !ok)) throw new Error(`${controles.filter(ok => !ok).length} contrôle(s) en échec`);
});
