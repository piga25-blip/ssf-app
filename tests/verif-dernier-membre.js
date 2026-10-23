// ============================================
// VÉRIFICATION : dernier membre d'une équipe parti par « Mouvement Individuel Rapide »
// ============================================
// Le dernier membre envoyé au PC (ou dans une autre équipe) termine la mission de son équipe
// comme « Fin de mission » : ligne « 🔚 Dissolution » dans la main courante, équipe gardée dans
// « Équipes Dissoutes » (réactivable quand il lui reste un membre), au lieu de disparaître.
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

    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    const lignes = await p.locator('table tbody tr').allInnerTexts();
    const dissolution = (n) => lignes.find(l => l.includes('Dissolution Équipe ' + n));
    controler('MC : « 🔚 Dissolution Équipe 1 », dernier membre BERNARD → PC', !!dissolution(1) && dissolution(1).includes('BERNARD Bruno → PC'));
    controler('MC : « 🔚 Dissolution Équipe 2 », dernier membre THOMAS → Équipe 3', !!dissolution(2) && dissolution(2).includes('THOMAS David → Équipe 3'));

    if (controles.some(ok => !ok)) throw new Error(`${controles.filter(ok => !ok).length} contrôle(s) en échec`);
});
