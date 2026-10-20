// Film 0 : démarrer un secours — nouveau dossier, mode d'utilisation (aperçu du PC Base
// Arrière), secrétaire, modifier les informations et le délai d'alerte, fermer puis rouvrir.
const { executer } = require('./outils');

executer('00-demarrer', 'Démarrer un secours', async (t) => {
    let p = t.page;
    await t.debutFilm();

    await t.chapitre('Créer le dossier du secours');
    await t.dire('Au lancement, l\'application propose de créer un nouveau dossier ou de rouvrir un dossier existant.',
        'Un dossier regroupe tout ce qui concerne UN secours (ou UN exercice) : main courante, sauveteurs, équipes, planning. Chaque secours a le sien.');
    await t.dire('On choisit d\'abord le type : SECOURS pour une intervention réelle, EXERCICE pour une simulation.',
        'Le type apparaît partout (en-tête, impressions, rapport) : impossible de confondre un exercice avec un vrai secours.');
    await t.clic(p.getByText('EXERCICE', { exact: true }));
    await t.vite(async () => {
        await t.saisir(t.champ('Ex: Gouffre de Padirac, Grotte de Clamouse...'), 'Gouffre de la Combe');
        await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Lanville');
    });
    await t.dire('L\'identifiant du dossier est fabriqué automatiquement : type, cavité, date.');
    await t.dire('Le délai d\'alerte : quand un sauveteur est engagé depuis plus longtemps que ce délai (ici 6 heures), l\'application affiche une alerte.',
        'Cette alerte sert uniquement à penser à organiser sa relève. Le délai peut être modifié à n\'importe quel moment du secours.');
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '6');
    await t.clic(t.bouton('Créer le dossier et continuer'));

    await t.chapitre('Choisir le mode d\'utilisation');
    await t.dire('« PC de Terrain » : le poste principal, avec la main courante, le planning et les équipes. Numéros 001, 002…');
    await t.dire('« PC Base Arrière » sert à un poste secondaire : alerte, véhicule, poste avancé. Voyons rapidement ce qu\'il propose.');
    await t.clic(p.getByText('PC Base Arrière', { exact: false }).last());
    await t.vite(() => t.saisir(t.champ('Ex: MC2, VEHICULE1, BASE-A...'), 'MC2'));
    await t.dire('Chaque PC Base Arrière a son identifiant : ses événements sont numérotés MC2-001, MC2-002…',
        'Ainsi ils ne se mélangent jamais avec ceux du PC de terrain, dans lequel ils pourront ensuite être fusionnés.');
    await t.dire('Il peut noter les événements en direct, ou recopier après coup une main courante écrite sur papier.');
    await t.clic(p.getByText('Recopie d\'une main courante papier', { exact: false }).last());
    await t.dire('Nous verrons le PC Base Arrière en détail dans un autre film. Ici, on choisit « PC de Terrain ».');
    await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
    await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
    await p.waitForTimeout(1500);

    await t.chapitre('Indiquer le secrétaire');
    await t.dire('L\'application demande le nom du secrétaire qui tient ce poste.',
        'Chaque ligne de main courante portera ce nom : on sait qui a écrit quoi. Le nom est mémorisé sur ce PC.');
    await t.saisir(t.champ('Ex: Martin DUPONT'), 'Claire VIDAL');
    await t.clic(t.bouton(/^✓ Enregistrer$/));
    await t.dire('L\'écran principal s\'affiche : en haut, le dossier en cours (EXERCICE — Gouffre de la Combe). En dessous, les onglets et les boutons de gestion.');
    await t.rythme(2);
    await t.dire('Lors d\'une relève, le nouveau secrétaire clique sur 🔄 à côté de son nom pour se déclarer.');
    await t.vite(async () => {
        await t.clic(p.locator('button:visible', { hasText: /^🔄$/ }).first());
        await t.saisir(t.champ('Ex: Martin DUPONT').or(p.locator('input:visible').last()), 'Paul MOREL');
        await t.clic(t.bouton(/^✓ Enregistrer$/));
    });

    await t.chapitre('Corriger les informations et le délai d\'alerte');
    await t.dire('Une erreur dans le nom de la cavité ou la commune ? « ✏️ Modifier » dans l\'en-tête rouvre ces informations.');
    await t.clic(t.bouton('✏️ Modifier'));
    await t.vite(() => t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Lanville-sur-Combe'));
    await t.dire('Le délai d\'alerte se change ici aussi, à n\'importe quel moment du secours : par exemple 8 heures au lieu de 6.');
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '8');
    await t.clic(t.bouton('Enregistrer les modifications'));
    if (await t.bouton('Confirmer et Démarrer', { dernier: true }).isVisible()) {
        await t.dire('L\'application redemande ensuite le mode d\'utilisation : on reconfirme « PC de Terrain ».');
        await t.vite(async () => {
            await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
            await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
        });
        await p.waitForTimeout(1500);
        if (await t.bouton(/^✓ Enregistrer$/).isVisible()) await t.clic(t.bouton(/^✓ Enregistrer$/));
    }

    await t.chapitre('Fermer l\'application, puis la rouvrir');
    await t.dire('On ferme maintenant l\'application, comme en fin de journée ou après une coupure de courant.',
        'Les données sont enregistrées en continu sur le PC, à chaque saisie : rien n\'est perdu.');
    p = await t.fermerEtRouvrir();
    await t.dire('Au lancement suivant, la fenêtre de démarrage s\'ouvre sur « Rouvrir un dossier » : notre exercice est dans la liste.');
    await t.clic(p.getByText('Gouffre de la Combe', { exact: false }).first());
    await t.clic(t.bouton('Rouvrir ce dossier'));
    await p.waitForTimeout(1500);
    if (await t.bouton('Confirmer et Démarrer', { dernier: true }).isVisible()) {
        await t.vite(async () => {
            await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
            await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
        });
        await p.waitForTimeout(1500);
    }
    if (await t.bouton(/^✓ Enregistrer$/).isVisible()) await t.clic(t.bouton(/^✓ Enregistrer$/));
    await t.dire('Le secours reprend là où on l\'avait laissé : même dossier, commune corrigée, mode PC de Terrain, et Paul MOREL toujours secrétaire.');
    await t.clic(t.bouton('✏️ Modifier'));
    await t.dire('Le délai d\'alerte modifié est conservé lui aussi : 8 heures.',
        'Tout ce qui a été saisi avant la fermeture est retrouvé de la même façon.');
    await t.clic(t.bouton(/^Annuler$/, { dernier: true }));
    await t.rythme(2);
// Port fixe, comme en utilisation réelle : ce que l'application mémorise sur le PC (secrétaire,
// mode) est retrouvé après la réouverture
}, { env: { SSF_PORT: '8091' } });
