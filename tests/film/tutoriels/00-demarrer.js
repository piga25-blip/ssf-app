// Film 0 : démarrer un secours — nouveau dossier, mode d'utilisation, secrétaire, modifier
// les informations, rouvrir un dossier.
const { executer } = require('./outils');

executer('00-demarrer', 'Démarrer un secours', async (t) => {
    const p = t.page;
    await t.debutFilm();

    await t.chapitre('Créer le dossier du secours');
    await t.dire('Au lancement, l\'application propose de créer un nouveau dossier ou de rouvrir un dossier existant.',
        'Un dossier regroupe tout ce qui concerne UN secours (ou UN exercice) : main courante, sauveteurs, équipes, planning. Chaque secours a le sien.');
    await t.dire('On choisit d\'abord le type : SECOURS pour une intervention réelle, EXERCICE pour une simulation.',
        'Le type apparaît partout (en-tête, impressions, rapport) : impossible de confondre un exercice avec un vrai secours.');
    await t.clic(p.getByText('EXERCICE', { exact: true }));
    await t.saisir(t.champ('Ex: Gouffre de Padirac, Grotte de Clamouse...'), 'Gouffre de la Combe');
    await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Lanville');
    await t.dire('L\'identifiant du dossier est fabriqué automatiquement : type, cavité, date.');
    await t.dire('Le délai d\'alerte fixe la durée d\'engagement au-delà de laquelle l\'application signale un sauveteur (ici 6 heures).',
        'C\'est une sécurité : au-delà de ce temps, un sauveteur doit être relevé ou mis au repos.');
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '6');
    await t.clic(t.bouton('Créer le dossier et continuer'));

    await t.chapitre('Choisir le mode d\'utilisation');
    await t.dire('« PC de Terrain » : le poste principal, avec la main courante, le planning et les équipes. Numéros 001, 002…',
        '« PC Base Arrière » sert à un poste secondaire (alerte, véhicule, poste avancé) : ses numéros sont préfixés (MC2-001…) pour ne jamais se mélanger avec ceux du PC de terrain.');
    await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
    await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
    await p.waitForTimeout(1500);

    await t.chapitre('Indiquer le secrétaire');
    await t.dire('L\'application demande le nom du secrétaire qui tient ce poste.',
        'Chaque ligne de main courante portera ce nom : on sait qui a écrit quoi. Le nom est mémorisé sur ce PC.');
    await t.saisir(t.champ('Ex: Martin DUPONT'), 'Claire VIDAL');
    await t.clic(t.bouton(/^✓ Enregistrer$/));
    await t.dire('L\'écran principal s\'affiche : en haut, le dossier en cours (EXERCICE — Gouffre de la Combe). En dessous, les onglets et les boutons de gestion.');
    await t.rythme(3);
    await t.dire('Lors d\'une relève, le nouveau secrétaire clique sur 🔄 à côté de son nom pour se déclarer.');
    await t.clic(p.locator('button:visible', { hasText: /^🔄$/ }).first());
    await t.saisir(t.champ('Ex: Martin DUPONT').or(p.locator('input:visible').last()), 'Paul MOREL');
    await t.clic(t.bouton(/^✓ Enregistrer$/));

    await t.chapitre('Corriger les informations du secours');
    await t.dire('Une erreur dans le nom de la cavité ou la commune ? « ✏️ Modifier » dans l\'en-tête rouvre ces informations.');
    await t.clic(t.bouton('✏️ Modifier'));
    await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Lanville-sur-Combe');
    await t.clic(t.bouton('Enregistrer les modifications'));
    await t.dire('L\'application redemande ensuite le mode d\'utilisation : on reconfirme « PC de Terrain ».');
    if (await t.bouton('Confirmer et Démarrer', { dernier: true }).isVisible()) {
        await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
        await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
        await p.waitForTimeout(1500);
        if (await t.bouton(/^✓ Enregistrer$/).isVisible()) await t.clic(t.bouton(/^✓ Enregistrer$/));
    }
    await t.dire('Au prochain lancement de l\'application, l\'onglet « Rouvrir un dossier » de la fenêtre de démarrage permettra de reprendre ce secours là où on l\'a laissé.',
        'Les données sont enregistrées en continu sur le PC : un arrêt de l\'ordinateur ne fait rien perdre.');
    await t.rythme(3);
});
