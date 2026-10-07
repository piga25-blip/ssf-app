// Films du « Scénario de formation des gestionnaires SSF » : un film par phase (8 phases).
// Chaque film rejoue d'abord, sans le filmer, les phases précédentes (même secours, même état),
// puis filme sa phase au rythme de démonstration. Les explications reprennent le document :
// ce que le formateur dicte, puis ce que fait le gestionnaire et pourquoi.
// Les étapes et sélecteurs sont ceux vérifiés par tests/scenario-formation/jouer.js.
const path = require('path');
const fs = require('fs');
const { executer } = require('./outils');

const RACINE = path.join(__dirname, '..', '..', '..');
const CSV = path.join(__dirname, '..', 'sortie', 'tutoriels', 'liste-formation.csv');
const CROQUIS = path.join(__dirname, 'croquis-P40.png');
fs.mkdirSync(path.dirname(CSV), { recursive: true });
fs.writeFileSync(CSV, `ID;Nom Prénom;Rôle;SSF
25-001;GIRARD Antoine;Directeur secours souterrain;25
25-002;MARTIN Alice;Chef d'équipe;25
25-003;BERNARD Bruno;Secouriste;25
25-004;DUBOIS Chloé;Médecin;25
25-005;THOMAS David;Secouriste;25
25-006;ROBERT Emma;Plongeur;25
25-007;PETIT Félix;Secouriste;25
25-008;DURAND Gaëlle;ASV;25
25-009;LEROY Hugo;Désobstruction;25
25-010;MOREAU Inès;Transmission;25
39-001;SIMON Julien;Conseiller technique;39
39-002;LAURENT Karine;Secouriste;39
70-001;LEFEBVRE Léo;Équipier;70
90-001;MICHEL Manon;Transmission;90
G-001;ROUX Pierre;Gendarme PGHM;Gendarmerie
P-001;GARCIA Nora;Infirmière;Pompier
`, 'utf8');

const PP = { F: 'F - Parking — Poste médical avancé', A: 'A - Entrée de la cavité', B: 'B - Tête du P40', C: 'C - Base du P40', E: 'E - Point victime', G: 'G - Hôpital de Pontarlier', PC: 'PC - Poste de Commandement' };
const dicte = (s) => `Le formateur dicte : « ${s} »`;

// ── Outils communs ──────────────────────────────────────────────────────
const outils = (t) => {
    const p = t.page;
    const o = {};
    o.attendre = (ms) => p.waitForTimeout(t.enPreparation ? Math.min(ms, 300) : ms);
    o.modale = () => p.locator('.modal-overlay:visible').last();
    o.fermer = async () => { await t.clic(t.bouton(/^Fermer$/, { dernier: true })); };
    o.annulerProchaine = () => p.evaluate(() => { window.__filmNon = 1; });
    o.ouvrir = async (titre, bouton) => { if (!(await p.locator('h2:visible', { hasText: titre }).count())) await t.clic(t.bouton(bouton)); };
    o.equipes = () => o.ouvrir('Gestion des Équipes', /^👥 Équipes$/);
    o.carte = (nom) => p.locator('div.overflow-hidden.border-blue-300:visible').filter({ has: p.locator('span.font-black', { hasText: new RegExp('^' + nom + '$') }) }).first();
    o.deplier = async (nom) => { if (!(await o.carte(nom).locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(o.carte(nom).locator('div.cursor-pointer').first()); };
    o.categorie = () => p.locator('select:visible', { has: p.locator('option[value="progression"]') }).first();
    o.maintenant = () => p.evaluate(() => Date.now());
    const deux = (n) => String(n).padStart(2, '0');
    o.heure = (ms) => { const d = new Date(ms); return deux(d.getHours()) + ':' + deux(d.getMinutes()); };
    o.date = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate()); };
    // Champs date / heure : valeur posée d'un coup (la frappe chiffre par chiffre se place mal)
    o.valeur = async (loc, v) => { await t.viser(loc); await loc.first().fill(v); await t.rythme(1.5); };
    // Ligne de main courante
    o.ligne = async ({ dest, venant, equipe, depart, lieu, pp, sens, texte, important, rappel, fichier, categorie } = {}) => {
        if (dest) await t.saisir(p.locator('input[list="destinataires-list"]:visible'), dest);
        if (venant) await t.saisir(p.locator('input[list="expediteurs-list"]:visible'), venant);
        if (equipe && !(venant && (await p.locator('input[list="equipe-list"]:visible').inputValue()) === equipe)) await t.saisir(p.locator('input[list="equipe-list"]:visible'), equipe);
        if (depart) { await t.clic(t.etiquette('🚀 Départ PC')); if (lieu) await t.clic(p.locator(`label[title^="${lieu}"]:visible`)); }
        if (pp) await t.saisir(p.locator('input[list="pointsphone-list"]:visible'), pp);
        if (sens) await t.clic(t.etiquette(sens));
        if (texte) await t.saisir(t.champ('Description...'), texte);
        if (important) await t.cocher(t.etiquette('⚠️ Important').locator('input'));
        if (rappel) {
            await o.valeur(p.locator('input[type="date"]:visible').first(), o.date(rappel));
            await o.valeur(p.locator('input[type="time"]:visible').first(), o.heure(rappel));
        }
        if (fichier) await t.fichier(t.etiquette('📎 Pièce jointe'), p.locator('input[type="file"][accept="image/*,.pdf,.doc,.docx"]'), fichier);
        if (categorie) await t.choisir(o.categorie(), categorie);
        await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    };
    // Fenêtre « Mise à jour planning » / « Qui est au point phone ? »
    o.planning = async ({ toute = true, garder = null, texte = null } = {}) => {
        const h = p.locator('h3:visible', { hasText: /Mise à jour planning|Qui est au point phone/ });
        await h.first().waitFor({ timeout: 5000 });
        const boite = p.locator('div:visible', { has: h }).last();
        if (texte) await t.dire(texte);
        if (toute) { const c = boite.locator('label', { hasText: 'Toute l\'équipe' }).locator('input'); if (!(await c.isChecked())) await t.cocher(c); }
        if (garder) {
            const toutes = boite.locator('label', { hasText: 'Toute l\'équipe' }).locator('input');
            if (await toutes.isChecked()) { await t.clic(toutes); }
            for (const n of garder) await t.cocher(boite.locator('label', { hasText: n }).locator('input'));
        }
        await t.clic(boite.locator('button', { hasText: 'Valider (' }));
    };
    o.secretaire = async (nom) => {
        await t.clic(p.locator('button[title="Changer de secrétaire"], button[title="Définir le secrétaire"]').first());
        await t.saisir(t.champ('Ex: Martin DUPONT'), nom);
        await t.clic(t.bouton(/^✓ Enregistrer$/));
    };
    o.creerEquipe = async ({ lieu, titre, ordre, membres }) => {
        await t.clic(t.etiquette(lieu));
        await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), titre);
        if (ordre) await t.saisir(t.champ('Détaillez précisément ce que l\'équipe doit faire...'), ordre);
        const choix = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
        if (!(await choix.inputValue())) await t.choisir(choix, { index: 1 });
        for (const n of membres) await t.cocher(p.locator('label:visible', { hasText: n }).last().locator('input[type="checkbox"]'));
        await t.clic(t.bouton('Créer l\'Équipe'));
    };
    o.ajouterPoint = async (lettre, nom, type, pos) => {
        await t.choisir(p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') }).locator('select'), lettre);
        await t.saisir(t.champ('Ex: Base du P80, Poste médical...'), nom);
        await t.saisir(t.champ('Pos.'), pos);
        await t.clic(t.etiquette(type));
        await t.clic(t.bouton('+ Ajouter'));
    };
    o.modifierPoint = async (nom, nouveau) => {
        await p.evaluate((nom) => {
            const m = [...document.querySelectorAll('h2')].find(h => h.innerText.includes('Gestion des Points Phone')).closest('.modal-overlay');
            const el = [...m.querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText && e.innerText.trim() === nom);
            let r = el; while (r && ![...r.querySelectorAll('button')].some(b => b.innerText.includes('Modifier'))) r = r.parentElement;
            [...r.querySelectorAll('button')].find(b => b.innerText.includes('Modifier')).setAttribute('data-film-cible', '1');
        }, nom);
        await t.clic(p.locator('[data-film-cible="1"]'));
        await t.saisir(o.modale().locator('input[placeholder="Nom du point phone..."]'), nouveau);
        await t.clic(o.modale().locator('button', { hasText: /^\s*✓\s*$/ }).first());
        await p.evaluate(() => document.querySelectorAll('[data-film-cible]').forEach(e => e.removeAttribute('data-film-cible')));
    };
    o.cases = (nom) => p.locator('tr', { hasText: nom }).locator('td.time-slot-cell');
    o.caseActuelle = (nom) => o.cases(nom).evaluateAll(tds => { const vide = td => /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(getComputedStyle(td).backgroundColor); let i = tds.length - 1; while (i > 0 && vide(tds[i])) i--; return i; });
    o.alerte = () => p.locator('h3:visible', { hasText: 'Alertes en attente' });
    return o;
};

// ── Les 8 phases ────────────────────────────────────────────────────────
const PHASES = [];

// Phase 1 — Alerte et ouverture du secours
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Ouvrir le dossier');
    await t.dire(dicte('Le CTDS vous appelle : un spéléologue est bloqué au gouffre de la Combe Noire, à Nans-sous-Sainte-Anne. C\'est un exercice. Ouvrez le dossier.'),
        'Onglet « Nouveau dossier » : on choisit EXERCICE (jamais SECOURS en formation), puis le nom de la cavité et la commune.');
    await t.clic(p.getByText('EXERCICE', { exact: true }));
    await t.saisir(t.champ('Ex: Gouffre de Padirac, Grotte de Clamouse...'), 'Gouffre de la Combe Noire');
    await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Nans-sous-Sainte-Anne');
    await t.dire('L\'application affiche l\'identifiant qu\'elle va donner au dossier : type, cavité et date.');
    await t.dire(dicte('Le délai d\'alerte des temps d\'engagement est de 6 heures.'));
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '6');
    await t.clic(t.bouton('Créer le dossier et continuer'));
    await t.dire(dicte('Vous êtes le PC de terrain.'), 'Le PC de terrain numérote 001, 002… La base arrière, elle, préfixe ses numéros : on la verra en phase 8.');
    await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
    await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
    await o.attendre(1500);
    await t.chapitre('Régler le poste');
    await t.dire(dicte('Le secrétaire de ce poste, c\'est vous.'), 'Le nom est mémorisé sur ce PC seulement ; il signe chaque ligne de main courante.');
    if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await t.saisir(t.champ('Ex: Martin DUPONT'), 'Stagiaire UN'); await t.clic(t.bouton(/^✓ Enregistrer$/)); }
    else await o.secretaire('Stagiaire UN');
    await t.dire(dicte('Mettez les sauvegardes automatiques toutes les 30 minutes.'));
    await t.clic(t.bouton('Sauvegardes auto'));
    await t.cocher(t.etiquette('30 min').locator('input'));
    await p.keyboard.press('Escape');
    await t.dire('Le badge « 30mn » rappelle que les sauvegardes automatiques sont actives.');
    await t.dire(dicte('Correction : le délai d\'alerte passe à 8 heures.'), '« Modifier » dans le bandeau jaune EXERCICE corrige les informations du secours, sans changer de dossier.');
    await t.clic(t.bouton('✏️ Modifier'));
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '8');
    await t.clic(t.bouton('Enregistrer les modifications'));
    await t.dire(dicte('Ajoutez FORMATION à la fin de l\'ID secours.'));
    await t.completer(p.locator('input[placeholder="Ex: GouffreA_2025"]'), ' FORMATION');
    await t.clic(p.locator('button[title="Valider le nouvel ID"]'));
    await t.dire(dicte('Passez en plein écran, puis revenez.'));
    await t.clic(t.bouton('Plein écran'));
    await t.clic(t.bouton('📐 Quitter'));
    await t.chapitre('Premières lignes de main courante');
    await t.dire(dicte('Message du CODIS : spéléologue bloqué à moins 150 mètres, au-delà du puits P40, jambe blessée. Victime : Lucas FAIVRE, 34 ans. C\'est important.'),
        'Les mots « victime » et « blessée » font passer la catégorie à « Secours » toute seule (repère « ✨ Auto »). On coche « Important ».');
    await o.ligne({ texte: 'Message du CODIS : spéléologue bloqué à moins 150 m, au-delà du puits P40, jambe blessée. Victime : Lucas FAIVRE, 34 ans.', important: true });
    await t.dire(dicte('Le matériel de secours est demandé au dépôt de Besançon.'), 'Le mot « matériel » donne la catégorie « Logistique ».');
    await o.ligne({ texte: 'Le matériel de secours est demandé au dépôt de Besançon.' });
    await t.dire(dicte('Le PC est installé au parking de la cavité.'), 'Aucun mot-clé ici : la catégorie reste « Autre » et l\'application le rappelle. On choisit « Administratif ».');
    await t.clic(t.champ('Description...'));
    await o.ligne({ texte: 'Le PC est installé au parking de la cavité.', categorie: 'administratif' });
    await t.dire('En bas de page : le prochain numéro, le total des événements et les messages importants.');
});

// Phase 2 — Arrivée des sauveteurs
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('La liste préfectorale');
    await t.dire(dicte('Chargez la liste préfectorale du département : fichier liste-formation sur le Bureau.'),
        'Le fichier CSV : une ligne de titres, puis ID ; NOM Prénom ; Rôle ; SSF. Point-virgule, virgule ou tabulation, accents d\'Excel acceptés.');
    await t.clic(t.bouton('Liste Préfectorale'));
    await t.fichier(t.bouton('Importer CSV'), p.locator('input[type="file"][accept*=".csv"]'), CSV);
    await t.dire(dicte('Retrouvez MOREAU Inès, puis triez la liste par SSF.'));
    await t.saisir(t.champ('🔍 Recherche rapide...'), 'mor');
    await t.saisir(t.champ('🔍 Recherche rapide...'), '');
    await t.clic(p.locator('th:visible', { hasText: 'SSF' }).first());
    await t.dire(dicte('ROBERT Emma est plongeur et secouriste.'));
    await t.clic(o.modale().locator('tbody tr', { hasText: 'ROBERT' }).locator('button[title="Modifier"]'));
    const role = o.modale().locator('tbody tr', { has: p.locator('input') }).locator('input').nth(2);
    await t.saisir(role, 'Plongeur / Secouriste');
    await t.clic(p.locator('button[title="Enregistrer"]'));
    await t.dire(dicte('LEROY Hugo a prévenu : il ne viendra pas. Retirez-le.'), 'On peut supprimer un sauveteur tant qu\'il n\'est pas inscrit au planning.');
    await t.clic(o.modale().locator('tbody tr', { hasText: 'LEROY' }).locator('button[title="Supprimer"]'));
    await t.chapitre('Un sauveteur hors liste');
    await t.dire(dicte('Un CRS est arrivé en renfort, il n\'est pas sur la liste : BLANC Olivier, CRS, sauveteur montagne.'),
        'On laisse l\'ID vide : l\'application en crée un (EXT-…). La colonne SSF accepte un texte (CRS, Gendarmerie…) : le rapport les compte à part.');
    await t.saisir(t.champ('NOM'), 'BLANC'); await t.saisir(t.champ('Prénom'), 'Olivier');
    await t.saisir(t.champ('Rôle'), 'Sauveteur montagne'); await t.saisir(t.champ('SSF / Service'), 'CRS');
    await t.clic(t.bouton('+ Ajouter'));
    await o.fermer();
    await t.chapitre('Les arrivées');
    await t.dire(dicte('Sont arrivés au PC : GIRARD, MARTIN, BERNARD, DUBOIS, ROBERT, PETIT, DURAND, MOREAU, SIMON, ROUX et BLANC.'),
        '« Enregistrement des sauveteurs » : on coche les présents dans la liste de gauche, puis « Arrivée ».');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    for (const n of ['GIRARD Antoine', 'MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'ROBERT Emma', 'PETIT Félix', 'DURAND Gaëlle', 'MOREAU Inès', 'SIMON Julien', 'ROUX Pierre', 'BLANC Olivier'])
        await t.cocher(p.locator('label:visible', { hasText: n }).first().locator('input'));
    await t.clic(t.bouton('Arrivée (11)'));
    await t.dire('Chaque sauveteur sur site reçoit un numéro de planning (N°). La main courante note « Arrivée de : … », le planning les met en « Disponible ».');
    await o.fermer();
    await t.dire(dicte('GIRARD Antoine prend la direction des opérations souterraines.'), 'Pas de mot-clé reconnu : on choisit la catégorie « Personnel ».');
    await o.ligne({ texte: 'GIRARD Antoine prend la direction des opérations souterraines.', categorie: 'personnel' });
});

// Phase 3 — Points phones et premières équipes
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Les points phones');
    await t.dire(dicte('Voici les points phones de la cavité : F parking, A entrée, B tête du P40, C base du P40, D salle du Chaos, E point victime, G hôpital de Pontarlier.'),
        'Chaque point : une lettre, un nom, une position (ordre dans le diagramme) et un type de lieu. Le type décide de l\'activité au planning quand une équipe y passe.');
    await t.clic(t.bouton('Points Phone'));
    for (const [l, nom, type, pos] of [['F', 'Parking — Poste médical avancé', '🌿 Surface', '1'], ['A', 'Entrée de la cavité', '🚪 Entrée cavité', '2'], ['B', 'Tête du P40', '🪨 Sous terre', '3'],
        ['C', 'Base du P40', '🪨 Sous terre', '4'], ['D', 'Salle du Chaos', '🪨 Sous terre', '5'], ['E', 'Point victime', '🪨 Sous terre', '6'], ['G', 'Hôpital de Pontarlier', '🚗 Hors site', '7']])
        await o.ajouterPoint(l, nom, type, pos);
    await t.dire(dicte('Correction : D s\'appelle Salle du Chaos amont.'));
    await o.modifierPoint('Salle du Chaos', 'Salle du Chaos amont');
    await t.dire('« Vider tout » efface toute la liste : on ne s\'en sert jamais pendant une opération.');
    await o.fermer();
    await t.chapitre('Créer les équipes');
    await t.dire(dicte('Équipe 1 : MARTIN Alice chef, BERNARD Bruno, ROBERT Emma. Titre : Reconnaissance jusqu\'à la victime. Sous terre.'),
        'Le premier coché devient le chef. Le type de mission est détecté dans le titre (« Reconnaissance »). L\'ordre de mission détaille la tâche.');
    await o.equipes();
    await o.creerEquipe({ lieu: '🪨 Sous terre', titre: 'Reconnaissance jusqu\'à la victime', ordre: 'Descendre jusqu\'au point victime, faire le bilan, rendre compte par TPS à chaque point phone.', membres: ['MARTIN Alice', 'BERNARD Bruno', 'ROBERT Emma'] });
    await t.dire(dicte('Équipe 2 : DUBOIS Chloé chef, DURAND Gaëlle, PETIT Félix. Titre : ASV et médicalisation de la victime. Sous terre.'), 'Le numéro suivant (2) est proposé tout seul.');
    await o.creerEquipe({ lieu: '🪨 Sous terre', titre: 'ASV et médicalisation de la victime', membres: ['DUBOIS Chloé', 'DURAND Gaëlle', 'PETIT Félix'] });
    await t.dire(dicte('Équipe 3 : MOREAU Inès chef, SIMON Julien. Titre : Transmission, pose du TPS. Ajoutez aussi BERNARD Bruno.'),
        'BERNARD est déjà dans l\'équipe 1 : l\'application demande s\'il faut l\'en retirer. Ici on répond « Annuler » : il reste en équipe 1.');
    await t.clic(t.etiquette('🪨 Sous terre'));
    await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Transmission, pose du TPS jusqu\'à la Salle du Chaos');
    for (const n of ['MOREAU Inès', 'SIMON Julien']) await t.cocher(p.locator('label:visible', { hasText: n }).last().locator('input[type="checkbox"]'));
    await o.annulerProchaine();
    await t.clic(p.locator('label:visible', { hasText: 'BERNARD Bruno' }).last().locator('input[type="checkbox"]'));
    const choix = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
    if (!(await choix.inputValue())) await t.choisir(choix, { index: 1 });
    await t.clic(t.bouton('Créer l\'Équipe (2)'));
    await t.dire(dicte('Équipe 4 : ROUX Pierre chef, BLANC Olivier. Titre : Logistique, acheminement du matériel en surface. Surface.'));
    await o.creerEquipe({ lieu: '🌿 Surface', titre: 'Logistique, acheminement du matériel en surface', membres: ['ROUX Pierre', 'BLANC Olivier'] });
    await t.chapitre('Lire, imprimer, exporter');
    await t.dire('Dans « Équipes Actives », l\'en-tête montre le lieu, le titre, le chef 👑 et le nombre de membres ; un clic déplie l\'équipe.');
    await o.deplier('Équipe 1');
    await t.dire(dicte('Imprimez la fiche de l\'équipe 1 pour la chef d\'équipe, puis exportez la liste des équipes en PDF et en Excel.'),
        'La fiche imprimée reprend l\'ordre de mission et la composition. Les exports servent au COS et aux comptes rendus.');
    const avant = t.app.windows().length;
    await t.clic(o.carte('Équipe 1').locator('button[title="Imprimer"]'));
    await o.attendre(2500);
    for (const w of t.app.windows().slice(avant)) await w.close().catch(() => {});
    await t.clic(t.bouton('📄 Export PDF'));
    await t.clic(t.bouton('📊 Export Excel'));
    await o.fermer();
    await t.dire('La main courante a noté chaque création d\'équipe, et le planning met les membres en « Engagé ».');
});

// Phase 4 — Progression et main courante
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Suivre la progression');
    await t.dire(dicte('L\'équipe 1 part du PC vers la cavité.'), '« Départ PC » + l\'équipe : l\'application propose de mettre ses membres en « Approche » au planning.');
    await o.ligne({ equipe: 'Équipe 1', depart: true, lieu: 'Sous terre' });
    await o.planning({ texte: 'On garde « Toute l\'équipe » et on valide.' });
    await t.dire(dicte('De MARTIN Alice : équipe 1 à l\'entrée, on entre.'),
        '« Message venant de » remplit l\'équipe tout seul. Au point A (entrée), on choisit le sens « Entre sous terre » : l\'équipe passe « Sous terre » au planning.');
    await o.ligne({ venant: 'MARTIN Alice', equipe: 'Équipe 1', pp: PP.A, sens: '🪨 Entre sous terre', texte: 'Équipe 1 à l\'entrée, on entre.' });
    await o.planning({ texte: 'Seule MARTIN est cochée (c\'est elle qui appelle) : on coche « Toute l\'équipe ».' });
    await t.dire(dicte('L\'équipe 3 part du PC. Puis : équipe 3 au point A, seule MOREAU Inès s\'y arrête pour poser le TPS.'),
        '« Au point phone » = simple passage, sans changement de planning : l\'application demande qui est présent.');
    await o.ligne({ equipe: 'Équipe 3', depart: true, lieu: 'Sous terre' });
    await o.planning();
    await o.ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '📍 Au point phone', texte: 'Seule MOREAU Inès s\'arrête pour poser le TPS.' });
    await o.planning({ toute: false, garder: ['MOREAU Inès'] });
    await t.dire(dicte('De MARTIN : équipe 1 en tête du P40, RAS.'), 'Point B est de type « sous terre » : le planning reste en « Sous terre ».');
    await o.ligne({ venant: 'MARTIN Alice', equipe: 'Équipe 1', pp: PP.B, texte: 'Équipe 1 en tête du P40, RAS.' });
    await o.planning();
    await t.dire(dicte('Équipe 1 arrivée en C, base du P40.'), 'Le point est tapé dans le texte : l\'application le remarque et propose de le sélectionner dans « Point Phone ».');
    await t.saisir(p.locator('input[list="equipe-list"]:visible'), 'Équipe 1');
    await t.saisir(t.champ('Description...'), 'Équipe 1 arrivée en C, base du P40.');
    await t.clic(t.bouton(/^Sélectionner$/));
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await o.planning().catch(() => {});
    await t.dire(dicte('Message du PC pour MARTIN Alice : rendez compte dès votre arrivée au point E.'), '« Message à destination de » : la catégorie passe à « Communication ».');
    await o.ligne({ dest: 'MARTIN Alice', texte: 'Rendez compte dès votre arrivée au point E.' });
    await t.chapitre('Les rappels');
    const samu = (await o.maintenant()) + 30 * 60000;
    await t.dire(dicte('Le SAMU demande un bilan médical dans 30 minutes. Mettez un rappel.'), 'Date et heure du rappel : la ligne affiche « 📅 PROGRAMMÉE ».');
    await o.ligne({ texte: 'Le SAMU demande un bilan médical dans 30 minutes.', rappel: samu });
    await t.dire(dicte('Rappelez la famille de la victime dans 3 minutes.'), 'Moins de 10 minutes : le rappel est « URGENT » et la fenêtre d\'alertes s\'ouvre. « Report 5 mn » la repousse.');
    await o.ligne({ texte: 'Rappeler la famille de la victime.', rappel: (await o.maintenant()) + 3 * 60000 });
    await o.alerte().waitFor({ timeout: 40000 });
    await t.clic(t.bouton('Report 5 mn'));
    await t.chapitre('Pièce jointe, renforts, alerte traitée');
    await t.dire(dicte('MARTIN envoie une photo du croquis du P40.'), 'La pièce jointe est gardée avec la ligne ; un clic sur 📎 la télécharge.');
    await o.ligne({ texte: 'Croquis du P40 reçu.', fichier: CROQUIS });
    await t.dire(dicte('Arrivent en renfort : THOMAS, LAURENT, LEFEBVRE, MICHEL et GARCIA.'));
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    for (const n of ['THOMAS David', 'LAURENT Karine', 'LEFEBVRE Léo', 'MICHEL Manon', 'GARCIA Nora']) await t.cocher(p.locator('label:visible', { hasText: n }).first().locator('input'));
    await t.clic(t.bouton('Arrivée (5)'));
    await o.fermer();
    await t.avancer(6, 'Six minutes plus tard, la fenêtre d\'alertes revient.');
    await o.alerte().waitFor({ timeout: 40000 });
    await t.dire(dicte('La famille a été rappelée.'), '« ✓ Traité » : la main courante note « Rappel N°… traité » et la ligne passe à « RÉALISÉE ».');
    await t.clic(p.locator('div.border-red-300:visible', { hasText: 'famille' }).locator('button', { hasText: '✓ Traité' }));
    await t.chapitre('Corriger, insérer, rechercher, imprimer');
    await t.dire(dicte('Erreur : la victime a 43 ans, pas 34.'), 'Le crayon ✏️ corrige une ligne. Rien n\'est effacé : « Corrigée par … » montre l\'ancienne version.');
    await t.clic(p.locator('table tbody tr', { hasText: 'Lucas FAIVRE, 34 ans' }).first().locator('button[title="Modifier cet événement"]'));
    const ta = p.locator('textarea[placeholder="Décrivez l\'événement..."]:visible');
    await t.saisir(ta, (await ta.inputValue()).replace('34 ans', '43 ans'));
    await t.clic(t.bouton('Enregistrer', { dernier: true }));
    await p.keyboard.press('Escape');
    await t.clic(p.locator('table tbody tr', { hasText: '43 ans' }).first().locator('button[title="Voir les versions précédentes"]'));
    await t.dire(dicte('J\'avais oublié : deux minutes après la ligne 003, la gendarmerie a bouclé l\'accès au parking.'),
        '➕ insère une ligne oubliée à sa place, avec l\'heure réelle. Elle prend le numéro « 003a » : les numéros déjà annoncés ne changent jamais.');
    const tr3 = p.locator('table tbody tr', { hasText: 'Le PC est installé au parking' }).first();
    const [h, m] = (await tr3.locator('td').nth(2).innerText()).split(' ')[1].slice(0, 5).split(':').map(Number);
    await t.clic(tr3.locator('button[title="Insérer un événement après celui-ci"]'));
    const f = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Insérer un événement' }) }).last();
    await t.saisir(f.locator('textarea').first(), 'La gendarmerie a bouclé l\'accès au parking.');
    const h2 = o.heure(new Date(2026, 0, 1, h, m + 2).getTime());
    await o.valeur(f.locator('input[type="time"]').last(), h2);
    await t.clic(f.locator('button', { hasText: 'Insérer l\'événement' }));
    await t.dire(dicte('Relève : votre binôme prend le clavier.'), 'Le bouton 🔄 change le secrétaire : les lignes suivantes portent son nom.');
    await o.secretaire('Stagiaire DEUX');
    await t.dire(dicte('Retrouvez tout ce qui parle du P40.'), 'La recherche rapide filtre le tableau (secrétaire, texte, équipe, point phone).');
    await t.saisir(t.champ('Recherche rapide... (secrétaire, événement, équipe, point phone)'), 'P40');
    await t.clic(t.bouton(/^Effacer$/));
    await t.dire(dicte('Combien de messages importants ? de rappels ? de lignes de progression ?'), 'La recherche avancée filtre par importance, rappels (avec leurs compteurs) et catégories.');
    await t.clic(t.bouton('Recherche Avancée'));
    await t.clic(t.bouton('Messages Importants'));
    await t.clic(t.bouton('Avec Alerte'));
    await t.clic(t.bouton(/Catégories \(/));
    await t.clic(t.bouton('Tout décocher'));
    await t.cocher(t.etiquette('📍 Progression').locator('input'));
    await o.fermer();
    await t.dire(dicte('Imprimez la main courante.'), 'L\'aperçu reprend les compteurs ; on imprime ou on ferme.');
    const avant = t.app.windows().length;
    await t.clic(t.bouton('Imprimer main courante'));
    await o.attendre(3000);
    for (const w of t.app.windows().slice(avant)) await w.close().catch(() => {});
    await t.avancer(10, 'Pause de 10 minutes. Pendant la pause, le rappel du SAMU arrive à échéance.');
});

// Phase 5 — Imprévus et mouvements d'équipes
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Le rappel du SAMU');
    for (let i = 0; i < 15 && !(await o.alerte().count()); i++) await t.page.clock.fastForward(60000);
    await o.alerte().waitFor({ timeout: 40000 });
    await t.dire(dicte('Le bilan a été transmis au SAMU.'), 'La fenêtre d\'alertes se ferme par « × » (elle revient moins d\'une minute après) ; on peut aussi valider le rappel dans le tableau.');
    await t.clic(p.locator('button[title^="Fermer (réapparaîtra"]'));
    await t.clic(p.locator('table tbody tr', { hasText: 'Le SAMU demande un bilan' }).filter({ hasNotText: 'Rappel N°' }).first().locator('button', { hasText: '✓ Valider' }));
    await t.chapitre('Scinder une équipe');
    await t.dire(dicte('L\'équipe 2 part du PC et entre sous terre.'));
    await o.ligne({ equipe: 'Équipe 2', depart: true, lieu: 'Sous terre' }); await o.planning();
    await o.ligne({ equipe: 'Équipe 2', pp: PP.A, sens: '🪨 Entre sous terre' }); await o.planning();
    await t.dire(dicte('L\'équipe 2 se divise : DUBOIS et DURAND restent avec la victime, PETIT remonte chercher la couverture chauffante.'),
        '« Scinder » : les membres cochés partent dans une nouvelle équipe (2B), qui hérite de la dernière position connue.');
    await o.equipes(); await o.deplier('Équipe 2');
    await t.clic(o.carte('Équipe 2').locator('button', { hasText: '✂️ Scinder' }));
    await t.clic(p.locator('label:visible', { hasText: 'DURAND Gaëlle' }).last().locator('input'));
    await t.clic(t.bouton('Créer Équipe 2B'));
    await t.chapitre('Renforts et mouvements');
    await t.dire(dicte('THOMAS David rejoint l\'équipe 1.'));
    await o.deplier('Équipe 1');
    await t.clic(o.carte('Équipe 1').locator('button', { hasText: 'Ajouter des Membres' }));
    await t.cocher(p.locator('div.bg-emerald-50:visible label', { hasText: 'THOMAS David' }).locator('input'));
    await t.clic(t.bouton(/Ajouter \(1\) membre/));
    await t.dire(dicte('BERNARD Bruno passe de l\'équipe 1 à l\'équipe 3. ROBERT Emma est libérée, elle remonte au PC.'),
        '« Mouvement Individuel Rapide » : on tape la destination (T3) ou PC, puis « Déplacer ».');
    await o.deplier('Équipe 1');
    const lB = o.carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'BERNARD Bruno' });
    await t.saisir(lB.locator('input[placeholder="ID Équipe / PC"]'), 'T3');
    await t.clic(lB.locator('button', { hasText: 'Déplacer' }));
    await o.deplier('Équipe 1');
    const lR = o.carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'ROBERT Emma' });
    await t.saisir(lR.locator('input[placeholder="ID Équipe / PC"]'), 'PC');
    await t.clic(lR.locator('button', { hasText: 'Déplacer' }));
    await t.dire(dicte('SIMON Julien devient chef de l\'équipe 3.'), 'On fait glisser son nom en tête de liste : le badge CHEF passe sur lui.');
    await o.deplier('Équipe 3');
    const membres = o.carte('Équipe 3').locator('div[draggable="true"]');
    await t.glisser(membres.filter({ hasText: 'SIMON Julien' }), membres.first());
    await t.dire(dicte('L\'équipe 3 change de mission : transmission jusqu\'au point victime.'), 'Un clic sur le titre de l\'équipe ouvre sa modification.');
    await t.clic(o.carte('Équipe 3').locator('div[title="Cliquer pour modifier"]'));
    await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Transmission jusqu\'au point victime');
    await t.saisir(t.champ('Détaillez précisément ce que l\'équipe doit faire...'), 'Prolonger le TPS jusqu\'au point victime.');
    await t.clic(t.bouton('Sauvegarder les modifications'));
    await o.fermer();
    await t.chapitre('Points phones en cours d\'opération');
    await t.dire(dicte('Nouveau point phone : H, Étroiture, entre C et D, sous terre.'), 'Depuis la main courante, le bouton ⚙️ ouvre les points phones. « Pos. » 4.5 le range entre C et D.');
    await t.clic(p.locator('button[title="Gérer les points phone"]'));
    await o.ajouterPoint('H', 'Étroiture', '🪨 Sous terre', '4.5');
    await t.dire(dicte('Correction : C s\'appelle désormais Base du P40, relais TPS.'), 'Les lignes de main courante qui citaient C sont mises à jour.');
    await o.modifierPoint('Base du P40', 'Base du P40, relais TPS');
    await o.fermer();
    await t.chapitre('Sorties, hors site, fins de mission');
    await t.dire(dicte('L\'équipe 2B est sortie de la cavité et rentre au PC. Puis : l\'équipe 2B revient au PC.'),
        'Au point A, « Sort — rentre au PC » met l\'équipe en « Approche » ; au PC, le mot « revient » la met en « Disponible ».');
    await o.ligne({ equipe: 'Équipe 2B', pp: PP.A, sens: '🏠 Sort — rentre au PC', texte: 'L\'équipe 2B est sortie de la cavité.' }); await o.planning();
    await o.ligne({ equipe: 'Équipe 2B', pp: PP.PC, texte: 'L\'équipe 2B revient au PC.' }); await o.planning();
    await t.dire(dicte('Équipe 5 : LEFEBVRE Léo chef, MICHEL Manon. Ils partent chercher la civière au dépôt de Besançon.'), 'Équipe « Hors site », puis départ du PC avec 🚗 : « Mission hors site » au planning.');
    await o.equipes();
    await o.creerEquipe({ lieu: '🚗 Hors site', titre: 'Chercher la civière au dépôt de Besançon', membres: ['LEFEBVRE Léo', 'MICHEL Manon'] });
    await o.fermer();
    await o.ligne({ equipe: 'Équipe 5', depart: true, lieu: 'Hors site' }); await o.planning();
    await t.dire(dicte('L\'équipe 4 a terminé : fin de mission. … Erreur : c\'est l\'équipe 2B qui a terminé, pas la 4.'),
        '« Fin de mission » dissout l\'équipe ; « Réactiver » annule une fin de mission faite par erreur.');
    await o.equipes(); await o.deplier('Équipe 4');
    await t.clic(o.carte('Équipe 4').locator('button', { hasText: 'Fin de mission' }));
    await t.clic(p.locator('div.bg-white:visible', { hasText: 'DISSOUTE' }).filter({ hasText: 'Équipe 4' }).locator('button', { hasText: 'Réactiver' }));
    await o.deplier('Équipe 2B');
    await t.clic(o.carte('Équipe 2B').locator('button', { hasText: 'Fin de mission' }));
    await o.fermer();
    await t.dire(dicte('GARCIA Nora quitte le secours.'), '« Départ » : la main courante note « Départ de : … », le planning « Quitter le secours ».');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.cocher(p.locator('label:visible', { hasText: 'GARCIA Nora' }).last().locator('input'));
    await t.clic(t.bouton('Départ (1)'));
    await o.fermer();
});

// Phase 6 — Mode réseau
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Ouvrir le secours au réseau');
    await t.dire(dicte('Un second secrétaire arrive avec une tablette. Ouvrez le secours au réseau.'),
        'Seul le PC principal a l\'application : les autres postes n\'ont besoin que d\'un navigateur sur le même réseau. Windows peut demander d\'autoriser le pare-feu : « Oui ».');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Activer le mode réseau'));
    await o.attendre(1500);
    const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
    const code = await p.locator('span.font-mono.text-2xl').first().innerText();
    await t.dire(`Le PC affiche l'adresse (${adresse}), un code QR et le code de session (${code}).`, 'Sur une tablette, le plus simple est de photographier le code QR. Sinon : l\'adresse, avec http://, dans la barre d\'adresse du navigateur.');
    await t.chapitre('Connecter la tablette');
    const tab = await t.ouvrirTablette(adresse + '/');
    await tab.rythme(2);
    await t.dire('La tablette demande le code de session : on tape les 6 chiffres.');
    await tab.saisir(tab.page.locator('input[placeholder="000000"]'), code);
    await tab.clic(tab.bouton('Se connecter'));
    await tab.page.waitForTimeout(2000);
    await tab.clic(tab.page.locator('button:visible', { hasText: /^🔄$/ }).first());
    await tab.saisir(tab.champ('Ex: Martin DUPONT').or(tab.page.locator('input:visible').last()), 'Assistant TABLETTE');
    await tab.clic(tab.bouton(/^✓ Enregistrer$/));
    await t.dire('La tablette est connectée (« Connecté au poste principal »), mais en CONSULTATION SEULE : elle voit tout, ne modifie rien.');
    await t.chapitre('Rôles et saisie à plusieurs');
    await t.dire(dicte('Donnez-lui le droit de saisir.'), 'Dans « Postes connectés », le rôle de la tablette passe à « ✍️ Saisie ».');
    await t.choisir(p.locator('tr:visible').filter({ has: p.locator('select') }).last().locator('select'), 'saisie');
    await o.fermer();
    await t.dire(dicte('De MARTIN : équipe 1 au point victime, bilan en cours.'), 'Saisie sur la tablette : la ligne arrive aussitôt sur le PC, avec « 📡 Saisie sur … ».');
    await tab.saisir(tab.page.locator('input[list="equipe-list"]:visible'), 'Équipe 1');
    await tab.saisir(tab.page.locator('input[list="pointsphone-list"]:visible'), PP.E);
    await tab.saisir(tab.champ('Description...'), 'De MARTIN : équipe 1 au point victime, bilan en cours.');
    await tab.clic(tab.bouton(/^✓ ENREGISTRER$/));
    await tab.page.waitForTimeout(1500);
    const mod = tab.page.locator('button:visible', { hasText: 'Valider (' });
    if (await mod.count()) await tab.clic(mod);
    await t.dire(dicte('Au top, enregistrez tous les deux une ligne. Top !'), 'Les numéros et les heures sont donnés par le PC principal : deux lignes au même instant ont deux numéros différents.');
    await t.saisir(t.champ('Description...'), 'Top PC.');
    await tab.saisir(tab.champ('Description...'), 'Top tablette.');
    await Promise.all([t.bouton(/^✓ ENREGISTRER$/).click(), tab.bouton(/^✓ ENREGISTRER$/).click()]);
    await t.rythme(3);
    await t.chapitre('Code, coupure, désactivation');
    await t.dire(dicte('Le code a circulé par radio : changez-le.'), 'La tablette redemande le code, puis revient en consultation : le PC lui redonne « Saisie ».');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Changer le code'));
    await o.attendre(2000);
    const nouveau = await p.locator('span.font-mono.text-2xl').first().innerText();
    await tab.saisir(tab.page.locator('input[placeholder="000000"]'), nouveau);
    await tab.clic(tab.bouton('Se connecter'));
    await tab.page.waitForTimeout(2000);
    await t.dire(dicte('Panne : la tablette perd le réseau.'), 'La tablette affiche « Connexion perdue » et refuse la saisie ; « 💾 Copie de secours » garde la dernière version du secours. Au retour du réseau, elle se reconnecte seule.');
    await t.clic(t.bouton(/^Désactiver$/));
    await tab.rythme(4);
    await t.clic(t.bouton('Activer le mode réseau'));
    await tab.page.waitForTimeout(10000);
    await t.dire(dicte('Fin du travail à plusieurs.'), '« Désactiver » coupe l\'accès de tous les autres postes.');
    await t.clic(t.bouton(/^Désactiver$/));
    await o.fermer();
    await tab.fermerPoste();
});

// Phase 7 — Planning, synthèse et tableaux de bord
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Le planning à la main');
    await t.dire('Le planning se remplit tout seul à partir de la main courante. On le complète à la main pour ce que la main courante ne dit pas.');
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.dire(dicte('Le secours ne durera pas trois jours : réglez sur deux.'));
    await t.saisir(p.locator('input[type="number"]:visible'), '2');
    const ti = await p.locator('#palette-title').boundingBox();
    await t.glisser(p.locator('#palette-title'), { x: 120, y: ti.y + ti.height / 2 + 300 });
    await t.dire(dicte('GIRARD Antoine est Directeur des secours souterrains.'), 'On sélectionne ses cases, puis on clique l\'activité dans la palette : une ligne est ajoutée à la main courante.');
    let i = await o.caseActuelle('GIRARD Antoine');
    await t.glisser(o.cases('GIRARD Antoine').nth(Math.max(0, i - 2)), o.cases('GIRARD Antoine').nth(i));
    await t.clic(t.bouton('Directeur Secours Souterrain'));
    await t.dire(dicte('ROUX et BLANC vont dormir 4 heures sur le site, avec un rappel 30 minutes avant.'), '« Repos sur site » ouvre la fenêtre de durée : 4 h, rappel 30 min avant la fin.');
    await t.clic(o.cases('ROUX Pierre').nth(await o.caseActuelle('ROUX Pierre')));
    await o.cases('BLANC Olivier').nth(await o.caseActuelle('BLANC Olivier')).click({ modifiers: ['Control'] });
    await t.clic(t.bouton('Repos sur site'));
    await t.clic(t.bouton(/^4h$/));
    await t.clic(t.bouton(/^30min$/));
    await t.clic(t.bouton('✓ Valider', { dernier: true }));
    await t.clic(t.bouton('Planning Opérationnel'));
    await t.dire(dicte('LAURENT Karine part au brancardage.'), 'Brancardage est une activité d\'équipe (👥) : refusée pour un sauveteur sans équipe, avec un message.');
    await t.clic(o.cases('LAURENT Karine').nth(await o.caseActuelle('LAURENT Karine')));
    await t.clic(t.bouton('Brancardage'));
    await t.dire(dicte('DUBOIS reste auprès de la victime pour la prochaine heure.'), 'La poignée bleue au coin de la sélection prolonge l\'activité, comme dans un tableur.');
    i = await o.caseActuelle('DUBOIS Chloé');
    await t.clic(o.cases('DUBOIS Chloé').nth(i));
    const poignee = p.locator('.fill-handle');
    if (await poignee.count()) await t.glisser(poignee, o.cases('DUBOIS Chloé').nth(i + 4));
    await t.dire(dicte('Remplissez les trous du planning.'), '« Mettre à jour les activités » prolonge les activités en cours jusqu\'à maintenant.');
    await t.clic(t.bouton('Mettre a jour les activites'));
    await t.chapitre('Synthèse, tableau de bord, progression');
    await t.dire(dicte('Qui était sous terre il y a une heure ?'), '« Synthèse Affectations » compte les sauveteurs par activité à une heure donnée ; les listes s\'impriment.');
    await t.clic(t.bouton('Synthèse Affectations'));
    await t.clic(p.locator('button[title="Reculer d\'une heure"]'));
    await t.clic(p.locator('button[title="Avancer d\'une heure"]'));
    await t.dire(dicte('Combien de SSF du Doubs, d\'autres départements, d\'autres services ?'), 'Le tableau de bord donne les chiffres clés et les alertes de durée de mission.');
    await t.clic(t.bouton('Tableau de Bord'));
    await t.rythme(3);
    await p.mouse.wheel(0, 800);
    await t.rythme(3);
    await p.evaluate(() => window.scrollTo(0, 0));
    await t.dire(dicte('Où en est chaque équipe ?'), '« Progression Équipes » trace chaque équipe point phone par point phone (entrée en haut, temps vers la droite), avec l\'historique des localisations.');
    await t.clic(t.bouton('Progression Équipes'));
    await t.rythme(4);
    await t.clic(t.bouton('Main Courante'));
});

// Phase 8 — Fin de secours
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Évacuation et sauvegarde');
    await t.dire(dicte('La victime est sortie de la cavité, prise en charge au poste médical avancé. Puis : victime évacuée vers l\'hôpital de Pontarlier.'), 'Deux lignes importantes, points F puis G ; catégorie « Secours » détectée.');
    await o.ligne({ texte: 'La victime est sortie de la cavité, prise en charge au poste médical avancé.', pp: PP.F, important: true });
    await o.ligne({ texte: 'Victime évacuée vers l\'hôpital de Pontarlier.', pp: PP.G, important: true });
    await t.dire(dicte('Par précaution, exportez tout avant de fermer l\'application.'), '« Exporter Tout » : tout le secours dans un seul fichier, à archiver.');
    await t.clic(t.bouton('Exporter Tout'));
    const idPrincipal = await p.locator('input[placeholder="Ex: GouffreA_2025"]').inputValue();
    await t.chapitre('Recopier une main courante papier');
    await t.dire(dicte('L\'adjudant ROUX a tenu une main courante papier au parking. Recopiez-la sur un PC de base arrière.'),
        'On relance l\'application, nouveau dossier, mode « PC Base Arrière » avec l\'identifiant PCA, et « Recopie d\'une main courante papier ».');
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
    await o.attendre(1500);
    await t.clic(t.bouton('Nouveau dossier'));
    await t.clic(p.getByText('EXERCICE', { exact: true }));
    await t.saisir(t.champ('Ex: Gouffre de Padirac, Grotte de Clamouse...'), 'Combe Noire PCA');
    await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Nans-sous-Sainte-Anne');
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '6');
    await t.clic(t.bouton('Créer le dossier et continuer'));
    await t.clic(p.getByText('PC Base Arrière', { exact: false }).last());
    await t.saisir(t.champ('Ex: MC2, VEHICULE1, BASE-A...'), 'PCA');
    await t.clic(t.etiquette('Recopie d\'une main courante papier'));
    await t.saisir(p.locator('input[placeholder="Ex: Martin DUPONT"]:visible').last(), 'ROUX Pierre');
    await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
    await o.attendre(1500);
    if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await t.saisir(t.champ('Ex: Martin DUPONT'), 'Stagiaire DEUX'); await t.clic(t.bouton(/^✓ Enregistrer$/)); }
    await t.dire('Pour chaque ligne du papier : l\'heure écrite, puis le texte. Les lignes se rangent dans l\'ordre chronologique et sont numérotées PCA-001, PCA-002…');
    const maintenant = await o.maintenant();
    for (const [min, txt] of [[-70, 'Route d\'accès fermée par la gendarmerie.'], [-100, 'Véhicule du SSF 25 arrivé au parking.'], [-30, 'Ambulance du SAMU arrivée au parking.']]) {
        const hh = o.heure(maintenant + min * 60000);
        await o.valeur(p.locator('input[type="time"]:visible').first(), hh);
        await t.saisir(t.champ('Description...'), txt);
        await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    }
    await t.dire(dicte('Envoyez ces lignes au PC de terrain.'), '« Exporter Événements » crée le fichier à importer sur le PC de terrain.');
    const dl = fs.readdirSync(t.telechargements);
    await t.clic(t.bouton('Exporter Événements'));
    await o.attendre(1500);
    let nouveau = null;
    for (let i = 0; i < 40 && !nouveau; i++) { nouveau = fs.readdirSync(t.telechargements).find(f => !dl.includes(f) && f.includes('SSF_Events_PCA') && !f.endsWith('.crdownload')); if (!nouveau) await p.waitForTimeout(250); }
    if (!nouveau) throw new Error('fichier SSF_Events_PCA non exporté');
    const fichierPCA = path.join(t.telechargements, nouveau);
    await t.chapitre('Fusionner sur le PC de terrain');
    await t.dire(dicte('Revenez sur le PC de terrain.'), 'On relance l\'application et on rouvre le dossier principal (onglet « Rouvrir un dossier »).');
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
    await o.attendre(1500);
    await t.clic(p.locator('div.cursor-pointer:visible', { hasText: idPrincipal }).first());
    await t.clic(t.bouton('Rouvrir ce dossier'));
    await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
    await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
    await o.attendre(1500);
    if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await t.saisir(t.champ('Ex: Martin DUPONT'), 'Stagiaire DEUX'); await t.clic(t.bouton(/^✓ Enregistrer$/)); }
    await t.dire(dicte('Intégrez la main courante papier.'), '« Importer MC (aperçu) » montre la fusion chronologique avant de confirmer. Les lignes recopiées portent « 📝 papier ».');
    await t.clic(t.bouton('Importer MC (aperçu)'));
    await t.fichier(p.getByText('Cliquez pour sélectionner un fichier'), p.locator('#mc-file-input'), fichierPCA);
    await t.rythme(3);
    await t.clic(t.bouton('Confirmer la Fusion'));
    await t.chapitre('Clôture et rapport');
    await t.dire(dicte('Faites une sauvegarde maintenant.'), 'Les sauvegardes automatiques se téléchargent ou se restaurent depuis cette fenêtre.');
    await t.clic(t.bouton('Sauvegardes auto'));
    await t.clic(t.bouton('Sauvegarder maintenant'));
    await t.rythme(2);
    await p.keyboard.press('Escape');
    await t.dire(dicte('Le COS déclare la fin du secours. Clôturez.'), 'On choisit l\'heure de clôture ; une ligne de clôture est écrite et le secours est verrouillé.');
    await t.clic(t.bouton('Clôturer le secours'));
    await t.clic(t.bouton('Dernier événement + 5 min'));
    await t.dire(dicte('Un message arrive encore : rouvrez, notez-le, reclôturez.'), '« Réouvrir » : rien n\'est perdu.');
    await t.clic(t.bouton(/^Réouvrir$/));
    await o.ligne({ texte: 'Matériel récupéré et rangé.' });
    await t.clic(t.bouton('Clôturer le secours'));
    await t.clic(t.bouton('Heure actuelle'));
    await t.dire(dicte('Sortez le rapport de fin de mission.'), 'Tableau de bord, « Générer un Rapport » : aperçu, puis export PDF (et Excel en rouvrant l\'aperçu).');
    await t.clic(t.bouton('Tableau de Bord'));
    await t.clic(t.bouton('Générer un Rapport'));
    await t.rythme(4);
    await t.clic(t.bouton('Exporter en PDF'));
    await t.clic(t.bouton('Main Courante'));
    await t.dire(dicte('Archivez le secours. Voici ce qu\'on ne touche pas.'), '« Exporter Tout » une dernière fois. Le mode maintenance (RESET APPLI, VIDER STORAGE) efface des secours : on le montre, on ne clique jamais.');
    await t.clic(t.bouton('Exporter Tout'));
    await t.cocher(p.locator('#toggle-maintenance'));
    await t.rythme(3);
    await t.clic(p.locator('#toggle-maintenance'));
    await t.dire('Fin du scénario : place au débriefing.');
});

// ── Un film par phase ───────────────────────────────────────────────────
const film = (n, id, titre) => executer(id, titre, async (t) => {
    const o = outils(t);
    for (let k = 0; k < n - 1; k++) await PHASES[k](t, o);   // phases précédentes, non filmées
    await t.debutFilm();
    await PHASES[n - 1](t, o);
}, { debut: new Date() });

module.exports = { film, PHASES };
