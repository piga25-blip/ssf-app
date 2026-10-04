// Préparation (non filmée, ou filmée dans « démarrer un secours ») : dossier, secrétaire,
// liste préfectorale, arrivées, points phones, équipes — pour que chaque film commence
// directement sur son sujet.

const SAUVETEURS = [
    // [id, NOM Prénom, rôle, SSF]
    ['34-001', 'MARTIN Alice', 'Chef d\'équipe', '34'],
    ['34-002', 'BERNARD Bruno', 'Secouriste', '34'],
    ['30-001', 'DUBOIS Chloé', 'Médecin', '30'],
    ['12-001', 'THOMAS David', 'Secouriste', '12'],
    ['30-002', 'ROBERT Emma', 'Plongeur', '30'],
    ['48-001', 'PETIT Félix', 'Secouriste', '48'],
    ['34-003', 'DURAND Gaëlle', 'ASV', '34'],
    ['12-002', 'LEROY Hugo', 'Désobstruction', '12'],
];

const POINTS = [['A', 'Entrée de la cavité', '🚪 Entrée cavité'], ['B', 'Puits P40', '🪨 Sous terre'], ['C', 'Salle du Camp', '🪨 Sous terre']];

const creerDossier = async (t, { cavite = 'Gouffre de la Combe', commune = 'Lanville' } = {}) => {
    const p = t.page;
    await t.clic(p.getByText('EXERCICE', { exact: true }));
    await t.saisir(t.champ('Ex: Gouffre de Padirac, Grotte de Clamouse...'), cavite);
    await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), commune);
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '6');
    await t.clic(t.bouton('Créer le dossier et continuer'));
    await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
    await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
    await p.waitForTimeout(1500); // la fenêtre du secrétaire s'ouvre après 1 s
    await t.saisir(t.champ('Ex: Martin DUPONT'), 'Claire VIDAL');
    await t.clic(t.bouton(/^✓ Enregistrer$/));
};

const remplirListe = async (t, n = SAUVETEURS.length) => {
    await t.clic(t.bouton('Liste Préfectorale'));
    for (const [id, nom, role, ssf] of SAUVETEURS.slice(0, n)) {
        const [NOM, ...prenom] = nom.split(' ');
        await t.saisir(t.page.locator('input.bg-gray-100:visible').first(), id);
        await t.saisir(t.champ('NOM'), NOM);
        await t.saisir(t.champ('Prénom'), prenom.join(' '));
        await t.saisir(t.champ('Rôle'), role);
        await t.saisir(t.champ('SSF / Service'), ssf);
        await t.clic(t.bouton('+ Ajouter'));
    }
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
};

const arrivees = async (t, noms) => {
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    for (const nom of noms) await t.cocher(t.etiquette(nom).locator('input[type="checkbox"]'));
    await t.clic(t.bouton('Arrivée'));
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
};

const pointsPhone = async (t, points = POINTS) => {
    const p = t.page;
    await t.clic(t.bouton('Points Phone'));
    for (const [lettre, nom, type] of points) {
        await t.choisir(p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') }).locator('select'), lettre);
        await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), nom);
        await t.clic(t.etiquette(type));
        await t.clic(t.bouton('+ Ajouter'));
    }
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
};

const creerEquipe = async (t, { lieu = '🪨 Sous terre', titre, ordre = '', type = null, membres }) => {
    const p = t.page;
    await t.clic(t.bouton(/^👥 Équipes$/));
    await t.clic(t.etiquette(lieu));
    await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), titre);
    if (ordre) await t.saisir(t.champ('Détaillez précisément ce que l\'équipe doit faire...'), ordre);
    const choix = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
    await t.choisir(choix, type ? { label: type } : { index: 1 });
    for (const nom of membres) await t.cocher(t.etiquette(nom, { dernier: true }).locator('input[type="checkbox"]'));
    await t.clic(t.bouton('Créer l\'Équipe'));
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
};

module.exports = { SAUVETEURS, POINTS, creerDossier, remplirListe, arrivees, pointsPhone, creerEquipe };
