// Films du « Scénario de formation des gestionnaires SSF » : un film par phase (8 phases).
// Chaque film rejoue d'abord, sans le filmer, les phases précédentes (même secours, même état),
// puis filme sa phase au rythme de démonstration. Les explications reprennent le document :
// ce que le formateur dicte, puis ce que fait le gestionnaire et pourquoi.
// Les étapes et sélecteurs sont ceux vérifiés par tests/scenario-formation/jouer.js.
const path = require('path');
const fs = require('fs');
const { executer, simultane } = require('./outils');

const RACINE = path.join(__dirname, '..', '..', '..');
const CSV = path.join(__dirname, '..', 'sortie', 'tutoriels', 'liste-formation.csv');
const CROQUIS = path.join(__dirname, 'croquis-P40.png');
fs.mkdirSync(path.dirname(CSV), { recursive: true });
fs.writeFileSync(CSV, `ID;Nom;Prénom;Rôle;SSF
25-001;GIRARD;Antoine;CT, Gestion PC;25
25-002;MARTIN;Alice;CE évacuation, Eq assistance victime;25
25-003;BERNARD;Bruno;Eq évacuation, Eq transmission;25
25-004;DUBOIS;Chloé;CE assistance victime, Médecin;25
25-005;THOMAS;David;Eq évacuation;25
25-006;ROBERT;Emma;Plongeur;25
25-007;PETIT;Félix;Eq assistance victime, Eq évacuation;25
25-008;DURAND;Gaëlle;Eq assistance victime, Infirmier;25
25-009;LEROY;Hugo;Eq désob, Artificier;25
25-010;MOREAU;Inès;CE transmission;25
39-001;SIMON;Julien;CT, Eq transmission;39
39-002;LAURENT;Karine;Eq évacuation;39
70-001;LEFEBVRE;Léo;CE évacuation, Eq transmission;70
90-001;MICHEL;Manon;Eq transmission;90
G-001;ROUX;Pierre;Gendarme PGHM, Gestion matériel;Gendarmerie
P-001;GARCIA;Nora;Infirmière;Pompier
25-011;VIDAL;Claire;Gestion PC, secrétaire;25
25-012;MOREL;Paul;Gestion PC, secrétaire;25
25-013;NICOLAS;Sarah;Gestion PC, secrétaire;25
25-014;FAURE;Lucie;CE transmission, TPS de surface;25
R-001;BOYER;Marc;Radioamateur;ADRASEC 25
`, 'utf8');

const PP = { F: 'F - Parking — Poste médical avancé', A: 'A - Entrée de la cavité', B: 'B - Tête du P40', C: 'C - Base du P40', E: 'E - Point victime', G: 'G - TPS de surface (plateau de Nans-sous-Sainte-Anne)', PC: 'PC - Poste de Commandement' };
// Les secrétaires du PC (dans la liste des sauveteurs, en « Gestion - PC » dès leur arrivée)
const SECRETAIRE_1 = 'Claire VIDAL', SECRETAIRE_2 = 'Paul MOREL', SECRETAIRE_3 = 'Sarah NICOLAS';
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
    o.ligne = async ({ dest, venant, equipe, depart, retour, lieu, pp, sens, texte, important, rappel, fichier, categorie } = {}) => {
        if (dest) await t.saisir(p.locator('input[list="destinataires-list"]:visible'), dest);
        if (venant) await t.saisir(p.locator('input[list="expediteurs-list"]:visible'), venant);
        if (equipe && !(venant && (await p.locator('input[list="equipe-list"]:visible').inputValue()) === equipe)) await t.saisir(p.locator('input[list="equipe-list"]:visible'), equipe);
        if (depart) { await t.clic(t.etiquette('🚀 Départ PC')); if (lieu) await t.clic(p.locator(`label[title^="${lieu}"]:visible`)); }
        if (retour) await t.clic(t.etiquette('🏠 Retour PC'));
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
        const h = p.locator('h3:visible', { hasText: /Mise à jour planning|Qui est au point phone|Retour au PC/ });
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
    o.secretaire = async (nom, dansListe) => {
        await t.clic(p.locator('button[title="Changer de secrétaire"], button[title="Définir le secrétaire"]').first());
        if (dansListe) await t.clic(p.locator('button:visible', { hasText: new RegExp('^' + dansListe + '$') }));
        else await t.saisir(t.champ('Ex: Martin DUPONT'), nom);
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
    // Liste déroulante d'un champ à suggestions (point phone…) : la liste du navigateur ne se
    // filme pas, elle est dessinée par-dessus la page le temps du choix. tt : poste (PC ou tablette)
    o.deroulante = async (tt, champ, valeur) => {
        const pg = tt.page;
        await champ.evaluate(e => e.scrollIntoView({ block: 'center' }));
        await tt.rythme(0.5);
        const b = await champ.boundingBox();
        await pg.evaluate(({ x, y, w, h, liste }) => {
            const fl = document.createElement('div');
            fl.id = 'film-fleche';
            fl.style.cssText = `position:fixed;left:${x + w - 24}px;top:${y}px;width:22px;height:${h}px;z-index:99998;display:flex;align-items:center;justify-content:center;font-size:12px;color:#374151`;
            fl.textContent = '▼';
            document.body.appendChild(fl);
            const options = [...document.querySelectorAll(`#${liste} option`)].map(op => op.value);
            const l = document.createElement('div');
            l.id = 'film-liste';
            l.style.cssText = `position:fixed;left:${x}px;top:${y + h + 2}px;width:${w}px;z-index:99999;background:#fff;border:1px solid #9ca3af;box-shadow:0 4px 12px rgba(0,0,0,.25);font:14px Arial;visibility:hidden`;
            options.forEach(v => { const d = document.createElement('div'); d.textContent = v; d.style.cssText = 'padding:7px 10px;color:#111'; d.onmouseenter = () => { d.style.background = '#dbeafe'; }; d.onmouseleave = () => { d.style.background = ''; }; l.appendChild(d); });
            document.body.appendChild(l);
            // Pas la place sous le champ : la liste s'ouvre au-dessus, comme celle du navigateur
            if (y + h + 2 + l.offsetHeight > window.innerHeight) l.style.top = Math.max(0, y - 2 - l.offsetHeight) + 'px';
        }, { x: b.x, y: b.y, w: b.width, h: b.height, liste: await champ.getAttribute('list') });
        await tt.clic(pg.locator('#film-fleche'));
        await pg.evaluate(() => { document.getElementById('film-liste').style.visibility = 'visible'; });
        await tt.rythme(1.5);
        const choix = pg.locator('#film-liste div', { hasText: valeur }).first();
        const point = await tt.viser(choix);
        await choix.evaluate(d => { d.style.background = '#dbeafe'; });
        await tt.rythme(0.8);
        await tt.onde(point);
        await pg.evaluate(() => { ['film-fleche', 'film-liste'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); });
        await champ.fill(valeur);
        await tt.rythme(1.5);
    };
    // Résultat d'une saisie : la ligne de main courante entourée, puis l'explication
    o.voirLigne = async (texte, explication, pourquoi) => {
        if (!(await p.locator('tbody tr:visible').count())) await t.vite(() => t.clic(t.bouton(/Main Courante/)));
        // texte : le texte cherché, ou [texte, texte absent de la ligne]
        const [avec, sans] = Array.isArray(texte) ? texte : [texte];
        const l = p.locator('tbody tr:visible', { hasText: avec }).filter(sans ? { hasNotText: sans } : {}).first();
        await l.scrollIntoViewIfNeeded().catch(() => {});
        await t.viser(l);
        if (process.env.FILM_RAPIDE) console.log('MC ▸ ' + (await l.innerText().catch(() => '?')).replace(/\s+/g, ' '));
        if (explication) await t.dire(explication, pourquoi);
        await p.evaluate(() => window.scrollTo(0, 0));
    };
    // Impression : la page s'ouvre d'habitude dans une nouvelle fenêtre ; pour le film, elle est
    // affichée par-dessus l'application (o.fermerApercu la retire)
    o.apercu = () => p.evaluate(() => {
        window.open = () => {
            let html = '';
            const cadre = document.createElement('div');
            cadre.id = 'film-apercu';
            cadre.style.cssText = 'position:fixed;inset:30px 60px;z-index:99999;background:#fff;box-shadow:0 0 0 9999px rgba(0,0,0,.45);border-radius:8px;overflow:hidden';
            return {
                document: {
                    write: (s) => { html += s; },
                    close: () => {
                        const f = document.createElement('iframe');
                        f.style.cssText = 'width:100%;height:100%;border:0';
                        f.srcdoc = html;
                        cadre.appendChild(f);
                        document.body.appendChild(cadre);
                    },
                },
                focus: () => {},
            };
        };
    });
    o.fermerApercu = () => p.evaluate(() => { const c = document.getElementById('film-apercu'); if (c) c.remove(); });
    // Fenêtres de Windows (enregistrer un fichier) : elles ne peuvent pas être filmées, un message dit ce qui s'ouvre
    o.windows = (texte) => p.evaluate((x) => window.__film && window.__film.message('💻 Fenêtre de Windows', x, 7000), texte);
    // Planning : grille défilée jusqu'à l'heure actuelle (à gauche de la palette), ligne entourée
    o.voirPlanning = async (nom, explication, pourquoi) => {
        await t.vite(() => t.clic(t.bouton('Planning Opérationnel')));
        await p.evaluate(() => {
            const grille = document.querySelector('.planning-table-wrapper');
            const maintenant = new Date();
            const heure = `${String(maintenant.getHours()).padStart(2, '0')}:00`;
            const th = grille && [...grille.querySelectorAll('th.header-time')].find(h => h.textContent.trim().endsWith(heure));
            const palette = document.getElementById('palette-title');
            if (!th || !palette) return;
            const x = th.getBoundingClientRect().left + th.offsetWidth * maintenant.getMinutes() / 60;
            grille.scrollLeft += x - (palette.getBoundingClientRect().left - 90);
        });
        const l = p.locator('tr:visible', { hasText: nom }).first();
        await l.scrollIntoViewIfNeeded().catch(() => {});
        await t.viser(l);
        if (explication) await t.dire(explication, pourquoi);
        if (process.env.FILM_PLANNING) await t.decrire(process.env.FILM_PLANNING + '-' + (o.nPl = (o.nPl || 0) + 1));
        await t.vite(() => t.clic(t.bouton(/Main Courante/)));
    };
    return o;
};

// ── Les 8 phases ────────────────────────────────────────────────────────
const PHASES = [];

// Phase 1 — Alerte et ouverture du secours
PHASES.push(async (t, o) => {
    const p = t.page;
    // Après « Enregistrer les modifications », l'application peut redemander le mode d'utilisation
    const reconfirmerMode = async () => {
        if (await t.bouton('Confirmer et Démarrer', { dernier: true }).isVisible().catch(() => false)) {
            await t.dire('L\'application redemande le mode d\'utilisation : on reconfirme « PC de Terrain ».');
            await t.vite(async () => {
                await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
                await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
            });
            await o.attendre(1500);
            if (await t.bouton(/^✓ Enregistrer$/).isVisible().catch(() => false)) await t.clic(t.bouton(/^✓ Enregistrer$/));
        }
    };

    await t.chapitre('Ouvrir le dossier');
    await t.dire(dicte('Le conseiller technique vous appelle : un spéléologue est bloqué au gouffre de la Combe Noire, à Nans-sous-Sainte-Anne. C\'est un exercice. Ouvrez le dossier.'),
        'Onglet « Nouveau dossier » : on choisit « Exercice » (jamais « Secours » en formation), puis le nom de la cavité et la commune.');
    await t.clic(p.getByText('EXERCICE', { exact: true }));
    await t.vite(async () => {
        await t.saisir(t.champ('Ex: Gouffre de Padirac, Grotte de Clamouse...'), 'Gouffre de la Combe Noire');
        await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Nans-sous-Sainte-Anne');
    });
    await t.dire('L\'application affiche l\'identifiant qu\'elle va donner au dossier : type, cavité et date.');
    await t.dire(dicte('Le délai d\'alerte des temps d\'engagement est de 6 heures.'),
        'Ce délai sert uniquement à penser à la relève : au-delà, l\'application signale le sauveteur engagé. Il se modifie à n\'importe quel moment du secours.');
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '6');
    await t.clic(t.bouton('Créer le dossier et continuer'));
    await t.dire(dicte('Vous êtes le PC de terrain.'), 'Le PC de terrain numérote 001, 002… La base arrière, elle, préfixe ses numéros : on la verra en phase 8.');
    await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
    await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
    await o.attendre(1500);

    await t.chapitre('Régler le poste');
    await t.dire(dicte('Vous êtes Claire VIDAL, secrétaire de ce poste.'), 'Le nom est mémorisé sur ce PC seulement ; il signe chaque ligne de main courante. La secrétaire est aussi sur le site : elle sera inscrite avec les sauveteurs.');
    if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await t.saisir(t.champ('Ex: Martin DUPONT'), SECRETAIRE_1); await t.clic(t.bouton(/^✓ Enregistrer$/)); }
    else await o.secretaire(SECRETAIRE_1);
    await t.viser(p.locator('input:visible').filter({ has: p.locator('xpath=self::*[@value="Claire VIDAL"]') }).or(p.getByText('Secrétaire', { exact: true })).first());
    await t.dire('Le nom du secrétaire est en haut du formulaire de main courante : il remplira la colonne « Secrétaire » de chaque ligne.');
    await t.dire(dicte('Mettez les sauvegardes automatiques toutes les 30 minutes.'));
    await t.clic(t.bouton('Sauvegardes auto'));
    await t.cocher(t.etiquette('30 min').locator('input'));
    await t.dire('Une copie de sécurité du secours sera faite toutes les 30 minutes ; les copies apparaîtront dans cette fenêtre, avec leur heure.');
    await p.keyboard.press('Escape');
    await t.viser(t.bouton('Sauvegardes auto'));
    await t.dire('Le badge « 30mn » sur le bouton rappelle que les sauvegardes automatiques sont actives.');
    await t.dire(dicte('Correction : le délai d\'alerte passe à 8 heures.'), '« Modifier » dans le bandeau jaune de l\'exercice corrige les informations du secours, sans changer de dossier.');
    await t.clic(t.bouton('✏️ Modifier'));
    await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '8');
    await t.clic(t.bouton('Enregistrer les modifications'));
    await reconfirmerMode();
    await t.dire(dicte('Ajoutez le mot « formation » à la fin de l\'ID secours.'));
    const id = p.locator('input[placeholder="Ex: GouffreA_2025"]');
    await t.completer(id, ' FORMATION');
    await t.clic(p.locator('button[title="Valider le nouvel ID"]'));
    await t.viser(p.getByText(/Actuel/).first());
    await t.dire('L\'identifiant du secours se termine maintenant par « Formation » : il est affiché à côté de « Actuel ».');
    await t.dire(dicte('Passez en plein écran, puis revenez.'));
    await t.clic(t.bouton('Plein écran'));
    await t.rythme(1.5);
    await t.clic(t.bouton('📐 Quitter'));

    await t.chapitre('Premières lignes de main courante');
    await t.dire(dicte('Message du CODIS pour le PC : « Spéléologue bloqué à moins 150 mètres, au-delà du puits P40, jambe blessée. Victime : Lucas FAIVRE, 34 ans. » C\'est important.'),
        'C\'est un message : on remplit « Message venant de » et « Message à destination de », puis le texte mot pour mot, sans le résumer. On coche « Important ».');
    await t.vite(() => o.ligne({ venant: 'CODIS', dest: 'PC', texte: 'Spéléologue bloqué à moins 150 m, au-delà du puits P40, jambe blessée. Victime : Lucas FAIVRE, 34 ans.', important: true }), 0.35);
    await o.voirLigne('Lucas FAIVRE',
        'La ligne 001 apparaît en haut du tableau : « Message de : CODIS pour : PC », le texte exact et le point d\'exclamation rouge du message important.',
        'La catégorie est « Secours » : les mots « victime » et « blessée » l\'emportent sur « Communication ». On peut toujours la changer dans la liste avant d\'enregistrer.');
    await t.dire(dicte('Le matériel de secours est demandé au dépôt de Besançon.'), 'Ce n\'est pas un message échangé : on écrit simplement l\'événement. Le mot « matériel » donne la catégorie « Logistique ».');
    await o.ligne({ texte: 'Le matériel de secours est demandé au dépôt de Besançon.' });
    await o.voirLigne('dépôt de Besançon', 'La ligne est enregistrée en « Logistique », avec l\'heure et le secrétaire.');
    await t.dire(dicte('Le PC est installé au parking de la cavité.'), 'Aucun mot-clé ici : la catégorie reste « Autre » et l\'application le rappelle. On choisit « Administratif ».');
    await t.clic(t.champ('Description...'));
    await o.ligne({ texte: 'Le PC est installé au parking de la cavité.', categorie: 'administratif' });
    await o.voirLigne('parking de la cavité', 'La ligne est rangée en « Administratif », la catégorie choisie.');
    const prochain = t.bouton(/Imprimer main courante/).locator('xpath=..').locator('strong');
    await t.viser(prochain);
    await t.dire('À côté du bouton « Imprimer main courante », le prochain numéro de ligne. La main courante peut être imprimée à tout moment.');
});

// Phase 2 — Arrivée des sauveteurs
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('La liste des sauveteurs');
    await t.dire(dicte('Chargez la liste des sauveteurs du département : fichier liste-formation sur le Bureau.'),
        'Le fichier CSV : une ligne de titres, puis ID ; Nom ; Prénom ; Rôle ; SSF, séparés par des points-virgules. Dans la case Rôle, plusieurs spécialités séparées par des virgules.');
    const liste = () => o.modale().locator('h3', { hasText: 'Liste complète' });
    await t.clic(t.bouton('Liste des sauveteurs'));
    await t.dire('Ici, la liste vient d\'un fichier. Elle peut aussi être récupérée depuis la base nationale, ou depuis un export Excel : voir le film « Inscrire les sauveteurs ».');
    await t.fichier(t.etiquette('Importer CSV'), p.locator('input[type="file"][accept*=".csv"]'), CSV);
    await t.viser(liste());
    await t.dire('L\'application confirme : 21 sauveteurs importés. Le titre « Liste complète (21) » le montre aussi.',
        'La liste contient aussi les secrétaires du PC (Gestion PC) et un radioamateur de l\'ADRASEC : toute personne présente sur le site doit y figurer.');
    await t.dire(dicte('Retrouvez MOREAU Inès, puis triez la liste par SSF.'));
    await t.saisir(t.champ('🔍 Recherche rapide...'), 'mor');
    await t.viser(o.modale().locator('tbody tr', { hasText: 'MOREAU' }));
    await t.dire('Seules les lignes qui contiennent « mor » restent affichées : MOREAU Inès est trouvée.');
    await t.vite(() => t.saisir(t.champ('🔍 Recherche rapide...'), ''));
    await t.clic(p.locator('th:visible', { hasText: 'SSF' }).first());
    await t.dire('Un clic sur l\'en-tête « SSF » range la liste par département ; un second clic inverse l\'ordre.');
    await t.dire(dicte('ROBERT Emma est plongeur et secouriste.'));
    await t.clic(o.modale().locator('tbody tr', { hasText: 'ROBERT' }).locator('button[title="Modifier"]'));
    // Cases de la ligne en modification : nom, rôle, SSF / service
    const role = o.modale().locator('tbody tr', { has: p.locator('input') }).locator('input').nth(1);
    await t.saisir(role, 'Plongeur / Secouriste');
    await t.clic(p.locator('button[title="Enregistrer"]'));
    await t.viser(o.modale().locator('tbody tr', { hasText: 'ROBERT' }));
    await t.dire('Dans la colonne « Rôle », sa ligne affiche le nouveau rôle : « Plongeur / Secouriste ». Son département (SSF 25) ne change pas.');
    await t.dire(dicte('LEROY Hugo a prévenu : il ne viendra pas. Retirez-le.'), 'On peut supprimer un sauveteur tant qu\'il n\'est pas inscrit au planning.');
    await t.clic(o.modale().locator('tbody tr', { hasText: 'LEROY' }).locator('button[title="Supprimer"]'));
    await t.viser(liste());
    await t.dire('Après confirmation, il disparaît : la liste passe à 20.');

    await t.chapitre('Un sauveteur hors liste');
    await t.dire(dicte('Un CRS est arrivé en renfort, il n\'est pas sur la liste : BLANC Olivier, CRS, sauveteur montagne.'),
        'On laisse l\'ID vide : l\'application en crée un (EXT-…). La colonne SSF accepte un texte (CRS, Gendarmerie…) : le rapport les compte à part.');
    await t.vite(async () => {
        await t.saisir(t.champ('NOM'), 'BLANC'); await t.saisir(t.champ('Prénom'), 'Olivier');
        await t.saisir(t.champ('Rôle'), 'Sauveteur montagne'); await t.saisir(t.champ('SSF / Service'), 'CRS');
    });
    await t.clic(t.bouton('+ Ajouter'));
    const blanc = o.modale().locator('tbody tr', { hasText: 'BLANC' });
    await blanc.scrollIntoViewIfNeeded().catch(() => {});
    await t.viser(blanc);
    if (process.env.FILM_RAPIDE) await t.decrire('S2-blanc');
    await t.dire('BLANC Olivier est dans la liste, avec un identifiant créé par l\'application (EXT-001) et « CRS » comme service. La liste repasse à 21.');
    await o.fermer();

    await t.chapitre('Les arrivées');
    await t.dire(dicte('Sont arrivés au PC : GIRARD, MARTIN, BERNARD, DUBOIS, ROBERT, PETIT, DURAND, MOREAU, SIMON, ROUX, BLANC, et vous-même, VIDAL Claire.'),
        '« Enregistrement des sauveteurs » : on coche les présents dans la liste de gauche, puis « Arrivée ». La secrétaire aussi : elle est sur le site.');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.vite(async () => {
        for (const n of ['GIRARD Antoine', 'MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'ROBERT Emma', 'PETIT Félix', 'DURAND Gaëlle', 'MOREAU Inès', 'SIMON Julien', 'ROUX Pierre', 'BLANC Olivier', 'VIDAL Claire'])
            await t.cocher(p.locator('label:visible', { hasText: n }).first().locator('input'));
    }, 0.35);
    const caseFonction = (nom, libelle) => p.locator('div.p-2:visible', { has: p.getByText(nom, { exact: true }) }).first().locator('label', { hasText: libelle });
    await t.viser(caseFonction('VIDAL Claire', 'arrive en gestion'));
    await t.dire('Sous VIDAL Claire et ROUX Pierre, la case « arrive en gestion » est déjà cochée : leur rôle dans la liste est « Gestion PC » ou « Gestion matériel », et VIDAL Claire est aussi la secrétaire de ce poste.',
        'Ils arriveront en « Gestion - PC » (jaune) au planning, sans équipe à créer.');
    await t.viser(caseFonction('SIMON Julien', 'conseiller technique'));
    await t.dire('Sous GIRARD Antoine et SIMON Julien, conseillers techniques, la case « arrive comme conseiller technique » est proposée, mais pas cochée.',
        'CT est une qualification, pas forcément leur fonction sur ce secours. Ici, GIRARD va diriger le secours et SIMON vient comme équipier transmission : on ne coche rien.');
    await t.clic(t.bouton('Arrivée (12)'));
    await t.viser(p.locator('h3:visible', { hasText: 'Sur site' }));
    if (process.env.FILM_RAPIDE) await t.decrire('S2-arrivees');
    await t.dire(dicte('Quel numéro de planning a MARTIN Alice ?'),
        'Les 12 passent dans la colonne « Sur site », chacun avec son numéro d\'arrivée (N°1, N°2…), qui sera son numéro au planning.');
    await o.fermer();
    await o.voirLigne('Arrivée de',
        'Dans la main courante, l\'application a écrit seule la ligne « Arrivée de : » avec les 12 noms, à l\'heure de l\'arrivée.',
        'Catégorie « Personnel », secrétaire « Système » : les arrivées sont tracées sans rien saisir.');
    await o.voirLigne('"Gestion - PC" affectée',
        'Juste après, une seconde ligne : « Activité "Gestion - PC" affectée à : ROUX Pierre, VIDAL Claire ».');
    await o.voirPlanning('VIDAL Claire',
        'Au planning, chacun a sa ligne, avec son numéro d\'arrivée, et « Disponible » (vert foncé) à partir de l\'heure d\'arrivée. ROUX Pierre (N° 10) et VIDAL Claire (N° 12) sont en « Gestion - PC » (jaune).');

    await t.chapitre('Le directeur du secours souterrain');
    await t.dire(dicte('GIRARD Antoine prend la direction des opérations souterraines.'), 'On l\'écrit d\'abord dans la main courante. Pas de mot-clé reconnu : on choisit la catégorie « Personnel ».');
    await o.ligne({ texte: 'GIRARD Antoine prend la direction des opérations souterraines.', categorie: 'personnel' });
    await o.voirLigne('direction des opérations', 'La ligne est enregistrée en « Personnel », la catégorie choisie.');
    await t.dire('Puis on le note au planning, à la main : on sélectionne sa case actuelle, et on clique « Directeur Secours Souterrain » dans la palette.',
        'Le directeur du secours souterrain n\'est dans aucune équipe : seule la palette peut le noter au planning.');
    await t.clic(t.bouton('Planning Opérationnel'));
    const i = await o.caseActuelle('GIRARD Antoine');
    await t.clic(o.cases('GIRARD Antoine').nth(i));
    await t.clic(t.bouton('Directeur Secours Souterrain'));
    await o.voirPlanning('GIRARD Antoine', 'Sa case est maintenant en « Directeur Secours Souterrain » (rose vif) ; la mise à jour du planning la prolongera ensuite.');
    await o.voirLigne('Directeur Secours Souterrain',
        'La palette a écrit seule une ligne dans la main courante : « Activité "Directeur Secours Souterrain" affectée à : GIRARD Antoine ».',
        'Toute modification faite à la main dans le planning est tracée dans la main courante.');

    await t.chapitre('Les renforts en alerte');
    await t.dire(dicte('Mettez en alerte, sans les faire venir pour l\'instant : THOMAS, LAURENT, LEFEBVRE, MICHEL et GARCIA ; MOREL Paul et NICOLAS Sarah pour le secrétariat ; FAURE Lucie et BOYER Marc, de l\'ADRASEC, pour le TPS de surface.'),
        'Un secours spéléo demande souvent plus de monde que prévu : on alerte à l\'avance, et on fait venir chacun au bon moment.');
    await t.dire('L\'application n\'a pas d\'état « en alerte » : on l\'écrit dans la main courante. Les personnes alertées restent dans la liste, sans arrivée ; on enregistrera leur arrivée quand elles viendront.');
    await t.vite(() => o.ligne({ texte: 'Mis en alerte, à faire venir plus tard : THOMAS David, LAURENT Karine, LEFEBVRE Léo, MICHEL Manon, GARCIA Nora ; secrétariat : MOREL Paul, NICOLAS Sarah ; TPS de surface : FAURE Lucie, BOYER Marc (ADRASEC).', categorie: 'personnel' }), 0.35);
    await o.voirLigne('Mis en alerte', 'La ligne garde la trace de qui a été alerté, et à quelle heure.');
});

// Phase 3 — Premières équipes et points phones
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Créer les équipes');
    await o.equipes();
    await t.dire(dicte('Équipe 1 : MARTIN Alice chef, BERNARD Bruno, ROBERT Emma. Titre : Reconnaissance jusqu\'à la victime. Sous terre.'),
        'Le premier coché devient le chef. Le type de mission est détecté dans le titre (« Reconnaissance »). L\'ordre de mission détaille la tâche.');
    await t.vite(() => o.creerEquipe({ lieu: '🕳️ Sous terre', titre: 'Reconnaissance jusqu\'à la victime', ordre: 'Descendre jusqu\'au point victime, faire le bilan, rendre compte par TPS à chaque point phone.', membres: ['MARTIN Alice', 'BERNARD Bruno', 'ROBERT Emma'] }), 0.5);
    await t.viser(o.carte('Équipe 1'));
    await t.dire('L\'équipe 1 apparaît à droite, dans « Équipes Actives » : le lieu, le titre, la cheffe MARTIN Alice 👑 et le nombre de membres.');
    await o.fermer();
    await o.voirLigne('Création Équipe 1',
        'En main courante, l\'application a écrit seule la création : numéro, chef, mission et membres.');
    await o.voirLigne('"Engagé" affectée à : MARTIN Alice',
        'Juste après, une seconde ligne : « Activité "Engagé" affectée à : MARTIN Alice, BERNARD Bruno, ROBERT Emma ».');
    await o.voirPlanning('MARTIN Alice',
        'Au planning, les trois membres passent en « Engagé » (vert clair) ; la colonne « Équipe » affiche leur numéro d\'équipe, 1.');
    await o.equipes();
    await t.dire(dicte('Équipe 2 : DUBOIS Chloé chef, DURAND Gaëlle, PETIT Félix. Titre : ASV et médicalisation de la victime. Sous terre.'), 'Le numéro suivant (2) est proposé tout seul.');
    await t.vite(() => o.creerEquipe({ lieu: '🕳️ Sous terre', titre: 'ASV et médicalisation de la victime', membres: ['DUBOIS Chloé', 'DURAND Gaëlle', 'PETIT Félix'] }), 0.5);
    await t.dire(dicte('Équipe 3 : MOREAU Inès chef, SIMON Julien. Titre : Transmission, pose du TPS. Ajoutez aussi BERNARD Bruno.'));
    await t.clic(t.etiquette('🕳️ Sous terre'));
    await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Transmission, pose du TPS jusqu\'à la Salle du Chaos');
    for (const n of ['MOREAU Inès', 'SIMON Julien']) await t.cocher(p.locator('label:visible', { hasText: n }).last().locator('input[type="checkbox"]'));
    const bernard = p.locator('label:visible', { hasText: 'BERNARD Bruno' }).last();
    await t.viser(bernard);
    if (process.env.FILM_RAPIDE) await t.decrire('S3-bernard');
    await t.dire('À côté de BERNARD Bruno, l\'application indique « déjà en Équipe 1 ».',
        'Si on le coche, elle demande s\'il faut le retirer de l\'équipe 1. Ici on répond « Annuler » : il reste en équipe 1.');
    await o.annulerProchaine();
    await t.clic(bernard.locator('input[type="checkbox"]'));
    const choix = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
    if (!(await choix.inputValue())) await t.choisir(choix, { index: 1 });
    await t.clic(t.bouton('Créer l\'Équipe (2)'));
    await t.viser(o.carte('Équipe 3'));
    await t.dire('L\'équipe 3 est créée avec MOREAU Inès et SIMON Julien ; BERNARD Bruno est toujours dans l\'équipe 1.');
    await t.dire(dicte('Équipe 4 : BLANC Olivier. Titre : Logistique, acheminement du matériel en surface. Surface.'));
    await o.creerEquipe({ lieu: '🌿 Surface', titre: 'Logistique, acheminement du matériel en surface', membres: ['BLANC Olivier'] });
    await t.viser(o.carte('Équipe 4'));
    await t.dire('Quatre équipes actives. Chaque création a sa ligne en main courante, et ses membres passent en « Engagé » au planning.');

    await t.chapitre('Lire, imprimer, exporter');
    await t.dire('Dans « Équipes Actives », un clic sur l\'en-tête déplie l\'équipe : ses membres, son ordre de mission et ses boutons.');
    await o.deplier('Équipe 1');
    await t.dire(dicte('Imprimez la fiche de l\'équipe 1 pour la cheffe d\'équipe, puis exportez la liste des équipes en PDF et en Excel.'));
    await o.apercu();
    await t.clic(o.carte('Équipe 1').locator('button[title="Imprimer"]'));
    await t.dire('La fiche de l\'équipe s\'ouvre : son titre, son ordre de mission et sa composition, avec le chef en tête.',
        'Le bouton « Imprimer » de cette fenêtre l\'envoie à l\'imprimante. La fiche est remise au chef d\'équipe avant le départ.');
    if (process.env.FILM_RAPIDE) await t.decrire('S3-fiche');
    await o.fermerApercu();
    await o.windows('« Enregistrer sous » : on choisit où ranger le fichier. Nom proposé : equipes_' + o.date(await o.maintenant()) + '.pdf');
    await t.clic(t.bouton('📄 Export PDF'));
    await t.dire('Windows demande où enregistrer le fichier PDF ; l\'application confirme ensuite « Export PDF réussi ».',
        'Le PDF liste toutes les équipes actives : titre, ordre de mission, membres et heure de création. Il sert au conseiller technique et aux comptes rendus.');
    await o.windows('« Enregistrer sous » : nom proposé equipes_' + o.date(await o.maintenant()) + '.xlsx');
    await t.clic(t.bouton('📊 Export Excel'));
    await t.dire('Même chose pour le fichier Excel, qu\'on peut retravailler dans un tableur.');
    await o.fermer();

    await t.chapitre('Les points phones');
    await t.dire(dicte('Voici les points phones : F parking, A entrée de la cavité, B tête du P40, C base du P40, D salle du Chaos, E point victime.'),
        'Chaque point : une lettre, un nom, une position (ordre dans le diagramme) et un type de lieu. Le type décide de l\'activité au planning quand une équipe y passe.');
    await t.clic(t.bouton('Points Phone'));
    await t.vite(() => o.ajouterPoint('F', 'Parking — Poste médical avancé', '🌿 Surface', '1'), 0.5);
    await t.viser(o.modale().getByText('Parking — Poste médical avancé').first());
    await t.dire('F, le parking avec le poste médical avancé, est en surface : type « 🌿 Surface ». Il prend la position 1 dans le diagramme.');
    await t.vite(() => o.ajouterPoint('A', 'Entrée de la cavité', '🚪 Entrée cavité', '2'), 0.5);
    await t.dire('A, l\'entrée de la cavité : type « 🚪 Entrée cavité ». Une équipe qui y passe entre sous terre, ou en ressort.');
    await t.vite(async () => {
        for (const [l, nom, pos] of [['B', 'Tête du P40', '3'], ['C', 'Base du P40', '4'], ['D', 'Salle du Chaos', '5'], ['E', 'Point victime', '6']])
            await o.ajouterPoint(l, nom, '🕳️ Sous terre', pos);
    }, 0.25);
    await t.dire('B à E sont sous terre : type « 🕳️ Sous terre ».');
    await t.dire(dicte('Point G : TPS de surface, sur le plateau de Nans-sous-Sainte-Anne. Il sert de relais entre le fond et le PC.'),
        'Le radioamateur de l\'ADRASEC s\'y installera : il transmet au PC, par radio (talkie-walkie), les messages venus du fond.');
    await t.vite(() => o.ajouterPoint('G', 'TPS de surface (plateau de Nans-sous-Sainte-Anne)', '🌿 Surface', '7'), 0.4);
    await t.viser(o.modale().getByText('TPS de surface (plateau de Nans-sous-Sainte-Anne)').first());
    if (process.env.FILM_RAPIDE) await t.decrire('S3-point-G');
    await t.dire('Le point G est sur le site : son type est « 🌿 Surface ».',
        '« 🚗 Hors site » sert aux liaisons en dehors du site, par exemple pour aller chercher du matériel dans un lieu de stockage.');
    await t.dire(dicte('Correction : D s\'appelle Salle du Chaos amont.'));
    await o.modifierPoint('Salle du Chaos', 'Salle du Chaos amont');
    await t.viser(o.modale().getByText('Salle du Chaos amont').first());
    await t.dire('Le nom est corrigé dans la liste ; les lignes de main courante qui citeraient déjà le point D suivraient aussi.');
    await t.dire('« Vider tout » efface toute la liste : on ne s\'en sert jamais pendant une opération.');
    await o.fermer();
    await t.dire('Les points phones servent maintenant partout : le champ « Point Phone » de la main courante, le diagramme de progression des équipes et le planning.');
});

// Phase 4 — Progression et main courante
PHASES.push(async (t, o) => {
    const p = t.page;
    await t.chapitre('Le départ du PC');
    await t.dire(dicte('L\'équipe 1 part du PC vers la cavité.'),
        'On tape l\'équipe et on coche « 🚀 Départ PC », lieu « Sous terre ». Pas de texte à écrire : le départ suffit.');
    await o.ligne({ equipe: 'Équipe 1', depart: true, lieu: 'Sous terre' });
    await o.planning({ texte: 'La fenêtre « Mise à jour planning » propose « Approche » pour toute l\'équipe : on valide.' });
    await o.voirLigne('Départ du PC',
        'En main courante : « Départ du PC - Sous-terre → Approche », avec « Équipe 1 » dans la colonne Équipe.');
    await o.voirLigne('"Approche" affectée',
        'Une seconde ligne, écrite par la mise à jour du planning : « Activité "Approche" affectée à : Toute l\'équipe (Équipe 1) ».');
    await o.voirPlanning('MARTIN Alice',
        'Au planning, MARTIN, BERNARD et ROBERT passent en « Approche » (violet) : ils marchent vers la cavité.');

    await t.chapitre('Entrer sous terre');
    await t.dire(dicte('De MARTIN Alice : équipe 1 à l\'entrée, on entre.'),
        '« Message venant de » : MARTIN Alice remplit l\'équipe toute seule. Point A, sens « Entre sous terre ». Rien à écrire dans « Événement » : il n\'y a pas de renseignement en plus.');
    await t.vite(() => o.ligne({ venant: 'MARTIN Alice', equipe: 'Équipe 1', pp: PP.A, sens: '🕳️ Entre sous terre' }), 0.5);
    await o.planning({ texte: 'Seule MARTIN est cochée, c\'est elle qui appelle : on coche « Toute l\'équipe », puis on valide.' });
    await o.voirLigne('Entre sous terre',
        'La ligne porte le point A (colonne Localisation) et « Entre sous terre », sans rien avoir tapé.');
    await o.voirPlanning('MARTIN Alice', 'Au planning, l\'équipe 1 passe en « Sous Terre » (marron).');

    await t.chapitre('Une équipe qui se sépare à l\'entrée');
    await t.dire(dicte('L\'équipe 3 part du PC vers la cavité.'));
    await t.vite(() => o.ligne({ equipe: 'Équipe 3', depart: true, lieu: 'Sous terre' }));
    await o.planning();
    await o.voirPlanning('MOREAU Inès', 'MOREAU Inès et SIMON Julien passent en « Approche ».');
    await t.dire(dicte('Équipe 3 au point A : MOREAU Inès reste à l\'entrée pour poser le TPS. SIMON Julien entre seul et tire la ligne du TPS vers le P40.'),
        'Deux lignes, une par sauveteur. Ici il y a un renseignement en plus : on l\'écrit dans « Événement ».');
    await t.vite(() => o.ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '🕳️ Entre sous terre', texte: 'SIMON Julien entre seul et tire la ligne du TPS vers le P40.' }), 0.5);
    await o.planning({ toute: false, garder: ['SIMON Julien'], texte: 'Dans la fenêtre de planning, on ne garde que SIMON Julien : lui seul entre sous terre.' });
    await t.dire('Pour MOREAU Inès, le bouton « 🌿 Reste à l\'entrée » : elle arrive à l\'entrée et y reste, sans entrer sous terre.',
        'Ce bouton sert aussi à une équipe qui ressort et attend à l\'entrée. « 📍 Au point phone », lui, ne change pas le planning : c\'est un simple passage.');
    await t.vite(() => o.ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '🌿 Reste à l\'entrée', texte: 'MOREAU Inès pose le TPS à l\'entrée.' }), 0.5);
    await o.planning({ toute: false, garder: ['MOREAU Inès'], texte: 'Dans la fenêtre de planning, on ne garde que MOREAU Inès.' });
    await o.voirLigne('MOREAU Inès pose le TPS', 'En main courante, les deux lignes de l\'équipe 3 au point A : SIMON « Entre sous terre », MOREAU « Reste à l\'entrée ».');
    await o.voirPlanning('SIMON Julien',
        'Au planning, SIMON Julien est « Sous Terre » ; MOREAU Inès passe en « Mission de surface » (orange) : elle travaille à l\'entrée, pas sous terre.');

    await t.chapitre('Suivre la progression sous terre');
    await t.dire(dicte('De MARTIN : équipe 1 en tête du P40.'), 'Point B, de type « sous terre » : le planning reste en « Sous Terre ». Rien à écrire en plus.');
    await t.vite(() => o.ligne({ venant: 'MARTIN Alice', equipe: 'Équipe 1', pp: PP.B }), 0.5);
    await o.planning();
    await o.voirLigne('Tête du P40', 'La ligne porte le point B, « Tête du P40 », dans la colonne Localisation.');
    await t.dire(dicte('Équipe 1 arrivée en C, base du P40.'),
        'Si le secrétaire tape le point dans le texte au lieu de le choisir, l\'application le remarque et propose de le sélectionner dans « Point Phone ».');
    await t.saisir(p.locator('input[list="equipe-list"]:visible'), 'Équipe 1');
    await t.vite(() => t.saisir(t.champ('Description...'), 'Équipe 1 arrivée en C, base du P40.'), 0.5);
    await t.clic(t.bouton(/^Sélectionner$/));
    await t.clic(t.bouton(/^✓ ENREGISTRER$/));
    await o.planning().catch(() => {});
    await o.voirLigne('arrivée en C', 'La ligne est bien rangée au point C, base du P40.');
    await t.dire(dicte('Message de GIRARD Antoine pour MARTIN Alice : « Rendez compte dès votre arrivée au point E. »'),
        'C\'est un message : « Message venant de » GIRARD Antoine, « Message à destination de » MARTIN Alice, et le texte mot pour mot.');
    await t.vite(() => o.ligne({ venant: 'GIRARD Antoine', dest: 'MARTIN Alice', texte: 'Rendez compte dès votre arrivée au point E.' }), 0.5);
    await o.voirLigne('Rendez compte dès votre arrivée',
        'La ligne affiche « Message de : GIRARD Antoine pour : MARTIN Alice » ; la catégorie passe à « Communication ».');

    await t.chapitre('Les rappels');
    const samu = (await o.maintenant()) + 30 * 60000;
    await t.dire(dicte('Message du SAMU pour le PC : « Envoyez-nous un bilan médical dans 30 minutes. » Mettez un rappel.'),
        'Un message, avec la date et l\'heure du rappel.');
    await t.vite(() => o.ligne({ venant: 'SAMU', dest: 'PC', texte: 'Envoyez-nous un bilan médical dans 30 minutes.', rappel: samu }), 0.5);
    await o.voirLigne('bilan médical', 'La ligne affiche « 📅 Programmée » avec l\'heure du rappel.');
    await t.dire(dicte('Rappelez la famille de la victime dans 3 minutes.'),
        'Moins de 10 minutes avant l\'échéance : le rappel devient « urgent » et la fenêtre d\'alertes s\'ouvre.');
    await t.vite(async () => o.ligne({ texte: 'Rappeler la famille de la victime.', rappel: (await o.maintenant()) + 3 * 60000 }), 0.5);
    await o.alerte().waitFor({ timeout: 40000 });
    await t.viser(o.alerte());
    await t.dire('La fenêtre « Alertes en attente » montre le rappel. « Report 5 mn » le repousse de 5 minutes.');
    await t.clic(t.bouton('Report 5 mn'));

    await t.chapitre('Pièce jointe, renforts, alerte traitée');
    await t.dire(dicte('MARTIN Alice envoie au PC une photo du croquis du P40.'),
        'Un message venant de MARTIN Alice pour le PC, avec la photo en pièce jointe.');
    await t.vite(() => o.ligne({ venant: 'MARTIN Alice', dest: 'PC', texte: 'Croquis du P40.', fichier: CROQUIS }), 0.5);
    await o.voirLigne('Croquis du P40', 'La photo est gardée avec la ligne : un clic sur 📎 l\'ouvre.');
    await t.dire(dicte('Faites venir une partie des renforts mis en alerte : THOMAS, LAURENT, LEFEBVRE, MICHEL et GARCIA, et MOREL Paul pour relever au secrétariat. Ils sont arrivés.'),
        'Ils étaient dans la liste, en alerte : on enregistre maintenant leur arrivée. Pour MOREL Paul, « arrive en gestion » est cochée d\'office : son rôle est « Gestion PC, secrétaire ».');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.vite(async () => {
        for (const n of ['THOMAS David', 'LAURENT Karine', 'LEFEBVRE Léo', 'MICHEL Manon', 'GARCIA Nora', 'MOREL Paul']) await t.cocher(p.locator('label:visible', { hasText: n }).first().locator('input'));
    }, 0.35);
    await t.clic(t.bouton('Arrivée (6)'));
    await o.fermer();
    await o.voirLigne('Arrivée de : THOMAS', 'En main courante, l\'arrivée des six renforts, puis « Activité "Gestion - PC" affectée à : MOREL Paul ».');
    await o.voirPlanning('MOREL Paul', 'Au planning, six nouvelles lignes : les renforts en « Disponible », MOREL Paul en « Gestion - PC » (jaune).');
    await t.avancer(6, 'Six minutes plus tard, la fenêtre d\'alertes revient.');
    await o.alerte().waitFor({ timeout: 40000 });
    await t.dire(dicte('La famille a été rappelée.'), 'On clique « ✓ Traité » dans la fenêtre d\'alertes.');
    await t.clic(p.locator('div.border-red-300:visible', { hasText: 'famille' }).locator('button', { hasText: '✓ Traité' }));
    await o.voirLigne('Rappel N°', 'La main courante note « Rappel N°… réalisé », avec le début du texte du rappel.');
    await o.voirLigne(['Rappeler la famille', 'Rappel N°'], 'Et la ligne du rappel passe à « Réalisée ».');

    await t.chapitre('Corriger, insérer, rechercher, imprimer');
    await t.dire(dicte('Erreur : la victime a 43 ans, pas 34.'), 'Le crayon ✏️ corrige une ligne. Rien n\'est effacé.');
    await t.clic(p.locator('table tbody tr', { hasText: 'Lucas FAIVRE, 34 ans' }).first().locator('button[title="Modifier cet événement"]'));
    const ta = p.locator('textarea[placeholder="Décrivez l\'événement..."]:visible');
    await t.vite(async () => t.saisir(ta, (await ta.inputValue()).replace('34 ans', '43 ans')), 0.5);
    await t.clic(t.bouton('Enregistrer', { dernier: true }));
    await p.keyboard.press('Escape');
    await t.clic(p.locator('table tbody tr', { hasText: '43 ans' }).first().locator('button[title="Voir les versions précédentes"]'));
    await o.voirLigne('43 ans', 'La ligne 001 dit maintenant « 43 ans ». Le bouton d\'historique montre l\'ancienne version, « 34 ans », avec qui l\'a corrigée et quand.');
    await t.dire(dicte('J\'avais oublié : deux minutes après la ligne 003, la gendarmerie a bouclé l\'accès au parking.'),
        '➕ insère une ligne oubliée à sa place, avec l\'heure réelle. Elle prend le numéro « 003a » : les numéros déjà annoncés ne changent jamais.');
    const tr3 = p.locator('table tbody tr', { hasText: 'Le PC est installé au parking' }).first();
    const [h, m] = (await tr3.locator('td').nth(2).innerText()).split(' ')[1].slice(0, 5).split(':').map(Number);
    await t.clic(tr3.locator('button[title="Insérer un événement après celui-ci"]'));
    const f = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Insérer un événement' }) }).last();
    await t.vite(() => t.saisir(f.locator('textarea').first(), 'La gendarmerie a bouclé l\'accès au parking.'), 0.5);
    const h2 = o.heure(new Date(2026, 0, 1, h, m + 2).getTime());
    await o.valeur(f.locator('input[type="time"]').last(), h2);
    await t.clic(f.locator('button', { hasText: 'Insérer l\'événement' }));
    await o.voirLigne('bouclé l\'accès', `La ligne 003a se range juste après la 003, à ${h2}.`);
    await t.dire(dicte('Relève : MOREL Paul prend le clavier.'), 'Le bouton 🔄 change le secrétaire : on peut taper son nom, ou le choisir parmi les sauveteurs sur site.');
    await o.secretaire(SECRETAIRE_2, 'MOREL Paul');
    await t.viser(p.locator('input[placeholder="MOREL Paul"]:visible').first());
    await t.dire('Le champ « Secrétaire » affiche MOREL Paul : les lignes suivantes porteront son nom.');
    await t.dire(dicte('Retrouvez tout ce qui parle du P40.'), 'La recherche rapide filtre le tableau : secrétaire, texte, équipe, point phone.');
    await t.saisir(t.champ('Recherche rapide... (secrétaire, événement, équipe, point phone)'), 'P40');
    await o.attendre(600);
    const trouvees = await p.locator('tbody tr:visible').count();
    await t.viser(p.locator('tbody:visible').first());
    if (process.env.FILM_RAPIDE) await t.decrire('S4-recherche-P40');
    await t.dire(`Il reste ${trouvees} lignes : toutes celles qui citent le P40, dans le texte ou dans le point phone (B, tête du P40 ; C, base du P40).`);
    await t.clic(t.bouton(/^Effacer$/));
    await t.dire('« Effacer » remet toutes les lignes.');
    await t.dire(dicte('Combien de messages importants ? de rappels ? de lignes de progression ?'), 'La recherche avancée filtre par importance, par rappel et par catégorie.');
    await t.clic(t.bouton('Recherche Avancée'));
    const resultats = p.getByText(/Résultats : \d+ événement/).first();
    const compter = async () => (await resultats.innerText()).match(/\d+/)[0];
    await t.clic(t.bouton('Messages Importants'));
    await t.viser(resultats);
    await t.dire(`Messages importants : ${await compter()}.`);
    await t.clic(t.bouton('Avec Alerte'));
    await t.viser(resultats);
    await t.dire(`Lignes avec un rappel : ${await compter()}.`);
    await t.clic(t.bouton(/Catégories \(/));
    await t.clic(t.bouton('Tout décocher'));
    await t.cocher(t.etiquette('📍 Progression').locator('input'));
    await t.viser(resultats);
    await t.dire(`Lignes de progression : ${await compter()}.`);
    await o.fermer();
    await t.dire(dicte('Imprimez la main courante.'));
    await o.apercu();
    await t.clic(t.bouton(/Imprimer main courante/));
    await t.dire('La main courante mise en page s\'affiche : en-tête du secours, puis chaque ligne avec son numéro, son heure, son secrétaire et son texte.',
        'Le bouton « Imprimer » de cette fenêtre l\'envoie à l\'imprimante, ou l\'enregistre en PDF.');
    await o.fermerApercu();
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
    await t.clic(p.locator('table tbody tr', { hasText: 'Envoyez-nous un bilan médical' }).filter({ hasNotText: 'Rappel N°' }).first().locator('button', { hasText: '✓ Valider' }));
    await o.voirLigne(['Rappel N°', 'famille'], 'La main courante note « Rappel N°… réalisé » pour le bilan du SAMU, et la ligne du rappel passe à « Réalisée ».');

    await t.chapitre('Scinder une équipe');
    await t.dire(dicte('L\'équipe 2 part du PC et entre sous terre.'), 'Deux lignes : le départ du PC, puis le point A avec « Entre sous terre ».');
    await t.vite(() => o.ligne({ equipe: 'Équipe 2', depart: true, lieu: 'Sous terre' }), 0.5); await o.planning();
    await o.voirPlanning('DUBOIS Chloé', 'Au planning, l\'équipe 2 passe en « Approche » (violet).');
    await t.vite(() => o.ligne({ equipe: 'Équipe 2', pp: PP.A, sens: '🕳️ Entre sous terre' }), 0.5); await o.planning();
    await o.voirPlanning('DUBOIS Chloé', 'Puis en « Sous Terre » (marron) : DUBOIS, DURAND et PETIT sont dans la cavité.');
    await t.dire(dicte('L\'équipe 2 se divise : DUBOIS et DURAND restent avec la victime, PETIT remonte chercher la couverture chauffante.'),
        '« Scinder » : les membres cochés partent dans une nouvelle équipe (2B), qui hérite de la dernière position connue.');
    await o.equipes(); await o.deplier('Équipe 2');
    await t.clic(o.carte('Équipe 2').locator('button', { hasText: '✂️ Scinder' }));
    await t.dire('Tous les membres sauf le chef sont cochés d\'office : on décoche DURAND Gaëlle, qui reste avec la victime.');
    await t.clic(p.locator('label:visible', { hasText: 'DURAND Gaëlle' }).last().locator('input'));
    await t.clic(t.bouton('Créer Équipe 2B'));
    await t.viser(o.carte('Équipe 2B'));
    await t.dire('L\'équipe 2B est créée avec PETIT Félix. Elle reprend la mission de l\'équipe 2 : « ASV et médicalisation de la victime ». Ce n\'est plus sa mission.',
        'Un clic sur le titre de l\'équipe ouvre sa modification : on change l\'intitulé et l\'ordre de mission.');
    await o.deplier('Équipe 2B');
    await t.clic(o.carte('Équipe 2B').locator('div[title="Cliquer pour modifier"]'));
    await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Remonter chercher la couverture chauffante');
    await t.saisir(t.champ('Détaillez précisément ce que l\'équipe doit faire...'), 'Remonter au PC chercher la couverture chauffante pour la victime.');
    if (process.env.FILM_RAPIDE) await t.decrire('S5-modif-avant');
    await t.clic(t.bouton('Sauvegarder les modifications'));
    if (process.env.FILM_RAPIDE) await t.decrire('S5-modif-apres');
    await t.viser(o.carte('Équipe 2B'));
    await t.dire('La carte de l\'équipe 2B porte sa nouvelle mission.');
    await o.fermer();
    await o.voirLigne('Scission Équipe 2', 'En main courante : « Scission Équipe 2 → Équipe 2B », avec le membre détaché, PETIT Félix.');
    await o.voirLigne('Position initiale', 'Puis la position de départ de l\'équipe 2B : le dernier point connu de l\'équipe 2, le point A.');
    await o.voirLigne('Modification Équipe 2B', 'Et « Modification Équipe 2B », avec la nouvelle mission.');
    await o.voirPlanning('PETIT Félix', 'Au planning, PETIT Félix reste « Sous Terre » : il est encore dans la cavité, avec le numéro d\'équipe 2B.');

    await t.chapitre('Renforts et mouvements');
    await t.dire(dicte('THOMAS David rejoint l\'équipe 1. Il part du PC.'), '« Ajouter des Membres » dans la carte de l\'équipe, puis une ligne de départ du PC pour lui seul.');
    await o.equipes(); await o.deplier('Équipe 1');
    await t.clic(o.carte('Équipe 1').locator('button', { hasText: 'Ajouter des Membres' }));
    await t.cocher(p.locator('div.bg-emerald-50:visible label', { hasText: 'THOMAS David' }).locator('input'));
    await t.clic(t.bouton(/Ajouter \(1\) membre/));
    await o.fermer();
    await o.voirPlanning('THOMAS David', 'Au planning, THOMAS David passe en « Engagé », avec le numéro d\'équipe 1.');
    await t.vite(() => o.ligne({ equipe: 'Équipe 1', depart: true, lieu: 'Sous terre' }), 0.5);
    await o.planning({ toute: false, garder: ['THOMAS David'], texte: 'Dans la fenêtre de planning, on ne garde que THOMAS David : le reste de l\'équipe est déjà sous terre.' });
    await o.voirPlanning('THOMAS David', 'Il passe en « Approche » (violet) : il descend rejoindre son équipe, déjà sous terre.');
    await t.dire(dicte('BERNARD Bruno passe de l\'équipe 1 à l\'équipe 3. ROBERT Emma, fatiguée, remonte avec PETIT : elle passe dans l\'équipe 2B.'),
        '« Mouvement Individuel Rapide » : on tape la destination (T3, 2B) ou PC, puis « Déplacer ».');
    await o.equipes(); await o.deplier('Équipe 1');
    const lB = o.carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'BERNARD Bruno' });
    await t.saisir(lB.locator('input[placeholder="ID Équipe / PC"]'), 'T3');
    await t.clic(lB.locator('button', { hasText: 'Déplacer' }));
    await o.deplier('Équipe 1');
    const lR = o.carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'ROBERT Emma' });
    await t.saisir(lR.locator('input[placeholder="ID Équipe / PC"]'), '2B');
    await t.clic(lR.locator('button', { hasText: 'Déplacer' }));
    await t.dire(dicte('SIMON Julien devient chef de l\'équipe 3.'), 'On fait glisser son nom en tête de liste : le badge CHEF passe sur lui.');
    await o.deplier('Équipe 3');
    const membres = o.carte('Équipe 3').locator('div[draggable="true"]');
    await t.glisser(membres.filter({ hasText: 'SIMON Julien' }), membres.first());
    await o.fermer();
    await o.voirLigne('BERNARD Bruno : Équipe 1', 'En main courante : « BERNARD Bruno : Équipe 1 → Équipe 3 », puis « ROBERT Emma : Équipe 1 → Équipe 2B ».');
    await o.voirLigne('Changement de chef', 'Et « Changement de chef Équipe 3 », avec l\'ancien et le nouveau chef.');
    await o.voirPlanning('ROBERT Emma', 'Au planning, ROBERT Emma porte maintenant le numéro d\'équipe 2B, BERNARD Bruno le 3. Ils restent « Sous Terre ».');

    await t.chapitre('Points phones en cours d\'opération');
    await t.dire(dicte('Nouveau point phone : H, Étroiture, entre C et D, sous terre.'), 'Depuis la main courante, le bouton ⚙️ ouvre les points phones. « Pos. » 4.5 le range entre C et D.');
    await t.clic(p.locator('button[title="Gérer les points phone"]'));
    await t.vite(() => o.ajouterPoint('H', 'Étroiture', '🕳️ Sous terre', '4.5'), 0.5);
    await t.dire(dicte('Correction : C s\'appelle désormais Base du P40, relais TPS.'), 'Les lignes de main courante qui citaient C sont mises à jour.');
    await o.modifierPoint('Base du P40', 'Base du P40, relais TPS');
    await o.fermer();
    await o.voirLigne('relais TPS', 'La ligne de l\'équipe 1 au point C porte le nouveau nom : « Base du P40, relais TPS ».');

    await t.chapitre('Les retours au PC');
    await t.dire(dicte('L\'équipe 2B est sortie de la cavité, elle rentre au PC.'),
        'Point A, sens « 🏠 Sort — rentre au PC ». Rien à écrire en plus.');
    await t.vite(() => o.ligne({ equipe: 'Équipe 2B', pp: PP.A, sens: '🏠 Sort — rentre au PC' }), 0.5);
    await o.planning();
    await o.voirLigne('rentre au PC', 'En main courante : point A, « Sort de sous terre — rentre au PC ».');
    await o.voirPlanning('PETIT Félix', 'Au planning, PETIT Félix et ROBERT Emma repassent en « Approche » : ils marchent vers le PC.');
    await t.dire(dicte('L\'équipe 2B est arrivée au PC.'),
        'On tape l\'équipe et on clique « 🏠 Retour PC » : le point phone devient « PC ». Plus besoin d\'ouvrir la fenêtre des équipes.');
    await t.vite(() => o.ligne({ equipe: 'Équipe 2B', retour: true }), 0.5);
    await o.planning({ texte: 'L\'application demande qui est revenu : toute l\'équipe est cochée. Les deux sont là : on valide.' });
    await o.voirLigne('Dissolution Équipe 2B', 'En main courante : « Retour au PC », « Disponible » pour PETIT et ROBERT, puis « Dissolution Équipe 2B » : tous sont revenus, l\'équipe est dissoute.',
        'Si une partie seulement de l\'équipe était revenue, on décocherait les absents : les présents quittent l\'équipe, qui continue avec les autres.');
    await o.voirPlanning('PETIT Félix', 'Au planning, PETIT Félix et ROBERT Emma passent en « Disponible » (vert foncé) et n\'ont plus de numéro d\'équipe.');

    await t.chapitre('Hors site, TPS de surface, fin de mission');
    await t.dire(dicte('Équipe 5 : LEFEBVRE Léo chef, MICHEL Manon. Ils partent chercher la civière au dépôt de Besançon.'), 'Équipe « Hors site », puis départ du PC avec 🚗.');
    await o.equipes();
    await t.vite(() => o.creerEquipe({ lieu: '🚗 Hors site', titre: 'Chercher la civière au dépôt de Besançon', membres: ['LEFEBVRE Léo', 'MICHEL Manon'] }), 0.5);
    await o.fermer();
    await t.vite(() => o.ligne({ equipe: 'Équipe 5', depart: true, lieu: 'Hors site' }), 0.5); await o.planning();
    await o.voirPlanning('LEFEBVRE Léo', 'Au planning, LEFEBVRE Léo et MICHEL Manon passent en « Mission hors site ».');

    await t.dire(dicte('Faites venir FAURE Lucie et BOYER Marc, de l\'ADRASEC, mis en alerte. Ils sont arrivés.'),
        'Ils installent un TPS de surface au point G. Le radioamateur de l\'ADRASEC fait la liaison radio entre ce TPS et le PC.');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.vite(async () => {
        for (const n of ['FAURE Lucie', 'BOYER Marc']) await t.cocher(p.locator('label:visible', { hasText: n }).first().locator('input'));
    });
    await t.clic(t.bouton('Arrivée (2)'));
    await o.fermer();
    await t.dire(dicte('Équipe 6 : FAURE Lucie chef, BOYER Marc. Titre : Transmission, TPS de surface et relais radio vers le PC. Surface.'));
    await o.equipes();
    await t.vite(() => o.creerEquipe({ lieu: '🌿 Surface', titre: 'Transmission, TPS de surface et relais radio vers le PC', ordre: 'Installer le TPS de surface au point G et assurer la liaison radio avec le PC.', membres: ['FAURE Lucie', 'BOYER Marc'] }), 0.5);
    await o.fermer();
    await t.dire(dicte('L\'équipe 6 part du PC vers le point G.'), '« Départ PC », lieu « Surface ».');
    await t.vite(() => o.ligne({ equipe: 'Équipe 6', depart: true, lieu: 'Surface' }), 0.5); await o.planning();
    await o.voirPlanning('FAURE Lucie', 'Au planning, FAURE Lucie et BOYER Marc passent en « Mission de surface » (orange).');
    await t.dire(dicte('Message de BOYER Marc pour le PC : « TPS de surface installé au point G, liaison radio établie avec le PC. »'),
        'C\'est un message : « Message venant de », « Message à destination de », le point G et le texte mot pour mot.');
    await t.vite(() => o.ligne({ venant: 'BOYER Marc', dest: 'PC', pp: PP.G, texte: 'TPS de surface installé au point G, liaison radio établie avec le PC.' }), 0.5);
    await o.planning().catch(() => {});
    await o.voirLigne('liaison radio établie', 'La ligne affiche « Message de : BOYER Marc pour : PC », au point G.');

    await t.dire(dicte('L\'équipe 4 a terminé : fin de mission. … Erreur : l\'équipe 4 n\'a pas terminé.'),
        '« Fin de mission » dissout l\'équipe ; « Réactiver » annule une fin de mission faite par erreur.');
    await o.equipes(); await o.deplier('Équipe 4');
    await t.clic(o.carte('Équipe 4').locator('button', { hasText: 'Fin de mission' }));
    await t.clic(p.locator('div.bg-white:visible', { hasText: 'DISSOUTE' }).filter({ hasText: 'Équipe 4' }).locator('button', { hasText: 'Réactiver' }));
    await t.viser(o.carte('Équipe 4'));
    await t.dire('L\'équipe 4 est de nouveau active.');
    await o.fermer();
    await o.voirLigne('Dissolution Équipe 4', 'En main courante, les deux lignes restent : « Dissolution Équipe 4 », puis sa réactivation. Rien n\'est effacé.');
    await o.voirPlanning('BLANC Olivier', 'Au planning, BLANC Olivier est de nouveau « Engagé » dans l\'équipe 4.');

    await t.avancer(40, 'Quarante minutes plus tard… Comme du temps a passé, l\'application propose de prolonger le planning de chacun jusqu\'à maintenant : on accepte.');
    await t.dire(dicte('L\'équipe 5 est revenue au PC avec la civière.'), 'Il y a un renseignement en plus, la civière : on l\'écrit. Puis « 🏠 Retour PC ».');
    await t.vite(() => o.ligne({ equipe: 'Équipe 5', retour: true, texte: 'Civière rapportée du dépôt de Besançon.' }), 0.5);
    await o.planning();
    await o.voirLigne('Dissolution Équipe 5', 'En main courante, le retour au PC et la dissolution de l\'équipe 5.');
    await o.voirPlanning('LEFEBVRE Léo', 'Au planning, LEFEBVRE Léo et MICHEL Manon repassent en « Disponible ».');

    await t.dire(dicte('GARCIA Nora quitte le secours.'), '« Départ » dans l\'enregistrement des sauveteurs.');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.cocher(p.locator('label:visible', { hasText: 'GARCIA Nora' }).last().locator('input'));
    await t.clic(t.bouton('Départ (1)'));
    await o.fermer();
    await o.voirLigne('Départ de : GARCIA', 'La main courante note « Départ de : GARCIA Nora ».');
    await o.voirPlanning('GARCIA Nora', 'Au planning, elle passe en « Quitter le secours ».');
});

// Phase 6 — Mode réseau
PHASES.push(async (t, o) => {
    const p = t.page;
    // Ligne de main courante d'un poste (PC ou tablette), entourée, puis l'explication
    const voirLigne = async (poste, texte, explication, pourquoi) => {
        await poste.vite(() => poste.clic(poste.bouton(/Main Courante/)));
        const [avec, sans] = Array.isArray(texte) ? texte : [texte];
        const l = poste.page.locator('tbody tr:visible', { hasText: avec }).filter(sans ? { hasNotText: sans } : {}).first();
        await l.waitFor({ timeout: 10000 }).catch(() => {});
        await l.scrollIntoViewIfNeeded().catch(() => {});
        await poste.viser(l);
        if (process.env.FILM_RAPIDE) console.log('MC ▸ ' + (await l.innerText().catch(() => '?')).replace(/\s+/g, ' '));
        await t.dire(explication, pourquoi);
        await poste.page.evaluate(() => window.scrollTo(0, 0));
    };
    // Fenêtre « Mode réseau » du PC : liste des postes connectés, en bas de la fenêtre
    const postesConnectes = async (explication, pourquoi) => {
        const titre = p.locator('text=/Postes connectés/').first();
        await titre.scrollIntoViewIfNeeded();
        await t.viser(titre);
        const liste = p.locator('table:visible').filter({ has: p.locator('select') });
        if (await liste.count()) { await liste.last().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await t.viser(liste.last()); }
        if (explication) await t.dire(explication, pourquoi);
    };
    const ligneTablette = () => p.locator('tr:visible').filter({ has: p.locator('select') }).last();
    const bandeau = (tab) => tab.page.locator('span:visible', { hasText: /Connecté au poste principal|Connexion perdue/ }).first();
    const nouveauCode = async () => { await o.attendre(2000); return p.locator('span.font-mono.text-2xl').first().innerText(); };

    await t.chapitre('Ouvrir le secours au réseau');
    await t.dire(dicte('NICOLAS Sarah, mise en alerte pour le secrétariat, arrive avec une tablette. Inscrivez son arrivée.'),
        'Comme toute personne présente sur le site. Son rôle « Gestion PC, secrétaire » coche d\'office « arrive en gestion ».');
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    await t.cocher(p.locator('label:visible', { hasText: 'NICOLAS Sarah' }).first().locator('input'));
    await t.clic(t.bouton('Arrivée (1)'));
    await o.fermer();
    await o.voirLigne('Arrivée de : NICOLAS', 'En main courante : « Arrivée de : NICOLAS Sarah », puis « Activité "Gestion - PC" affectée à : NICOLAS Sarah ».');
    await o.voirPlanning('NICOLAS Sarah', 'Au planning, NICOLAS Sarah est en « Gestion - PC » (jaune).');
    await t.dire(dicte('Ouvrez le secours au réseau pour sa tablette.'),
        'Seul le PC principal a l\'application : les autres postes n\'ont besoin que d\'un navigateur sur le même réseau. Windows peut demander d\'autoriser le pare-feu : « Oui ».');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Activer le mode réseau'));
    await o.attendre(1500);
    const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
    const code = await p.locator('span.font-mono.text-2xl').first().innerText();
    await t.viser(p.locator('span.font-mono.text-2xl').first());
    await t.dire(`Le PC affiche l'adresse (${adresse}), un code QR et le code de session (${code}).`,
        'Sur une tablette, le plus simple est de photographier le code QR. Sinon : l\'adresse, avec http://, dans la barre d\'adresse du navigateur.');

    await t.chapitre('Connecter la tablette');
    await t.dire('Sur la tablette, on ouvre le navigateur et on tape l\'adresse affichée par le PC. Elle apparaît à droite.');
    const tab = await t.ouvrirTablette(adresse + '/');
    await tab.rythme(2);
    await t.dire('La tablette demande le code de session : on tape les 6 chiffres affichés par le PC.');
    await tab.saisir(tab.page.locator('input[placeholder="000000"]'), code);
    await tab.clic(tab.bouton('Se connecter'));
    await tab.page.waitForTimeout(2000);
    await t.dire('Sur la tablette, on indique qui l\'utilise : bouton 🔄 à côté de « Secrétaire ».', 'Ce nom signe les lignes saisies depuis la tablette.');
    await tab.clic(tab.page.locator('button:visible', { hasText: /^🔄$/ }).first());
    await tab.saisir(tab.champ('Ex: Martin DUPONT').or(tab.page.locator('input:visible').last()), SECRETAIRE_3);
    await tab.clic(tab.bouton(/^✓ Enregistrer$/));
    await tab.viser(bandeau(tab));
    await t.dire('La tablette est connectée : « Connecté au poste principal ». Mais elle est en consultation seule : elle voit tout, elle ne modifie rien.',
        'Par prudence, un nouveau poste ne peut rien modifier tant que le PC principal ne l\'a pas autorisé.');

    await t.chapitre('Donner le droit de saisir');
    await t.dire(dicte('Donnez-lui le droit de saisir.'));
    await postesConnectes('Sur le PC, en bas de la fenêtre « Mode réseau », la tablette apparaît dans « Postes connectés ». Son rôle se choisit poste par poste.');
    await t.choisir(ligneTablette().locator('select'), 'saisie');
    await t.viser(ligneTablette());
    await t.dire('Sur le PC, le rôle de la tablette passe à « ✍️ Saisie ».');
    await tab.viser(bandeau(tab));
    await t.dire('Sur la tablette, le bandeau affiche aussitôt « ✍️ Poste de saisie ».',
        'Restent réservés au PC principal : les informations et la clôture du secours, les imports, les remises à zéro, les secrétaires et les réglages du planning.');
    await o.fermer();

    await t.chapitre('Saisir à plusieurs');
    await t.dire(dicte('De MARTIN Alice : équipe 1 au point victime, bilan en cours.'),
        'Saisie sur la tablette : « Message venant de » MARTIN Alice remplit l\'équipe, et il y a un renseignement en plus, « bilan en cours ».');
    await tab.vite(() => tab.saisir(tab.page.locator('input[list="expediteurs-list"]:visible'), 'MARTIN Alice'), 0.5);
    await t.dire('Pour le point phone, au lieu de taper, on peut cliquer sur la petite flèche au bout du champ : la liste des points phones s\'ouvre, on clique sur le bon.');
    await o.deroulante(tab, tab.page.locator('input[list="pointsphone-list"]:visible'), PP.E);
    if (process.env.FILM_RAPIDE) await tab.decrire('S6-liste');
    await tab.vite(() => tab.saisir(tab.champ('Description...'), 'Bilan en cours.'), 0.5);
    await tab.clic(tab.bouton(/^✓ ENREGISTRER$/));
    const mod = tab.page.locator('button:visible', { hasText: 'Valider (' });
    await mod.first().waitFor({ timeout: 5000 }).catch(() => {});
    if (await mod.count()) {
        await t.dire('La fenêtre de planning s\'ouvre sur la tablette : on coche « Toute l\'équipe », puis on valide.');
        const toute = tab.page.locator('label:visible', { hasText: 'Toute l\'équipe' }).locator('input');
        if (await toute.count() && !(await toute.isChecked())) await tab.cocher(toute);
        await tab.clic(mod);
    }
    await voirLigne(t, 'Bilan en cours.', 'Sur le PC, la ligne arrive aussitôt : point E, « Message de : MARTIN Alice », la secrétaire de la tablette (Sarah NICOLAS) et la mention « 📡 Saisie sur … ».');
    await t.dire(dicte('Au top, enregistrez tous les deux une ligne. Top !'), 'Les numéros et les heures sont donnés par le PC principal : deux lignes au même instant ont deux numéros différents.');
    await t.vite(() => t.saisir(t.champ('Description...'), 'Top PC.'), 0.5);
    await tab.vite(() => tab.saisir(tab.champ('Description...'), 'Top tablette.'), 0.5);
    await simultane([[t, t.bouton(/^✓ ENREGISTRER$/)], [tab, tab.bouton(/^✓ ENREGISTRER$/)]]);
    await t.rythme(3);
    await voirLigne(t, 'Top tablette.', 'Sur le PC, les deux lignes se suivent, chacune avec son numéro : aucun doublon.');

    await t.chapitre('Changer le code');
    await t.dire(dicte('Le code a circulé par radio : changez-le.'));
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Changer le code'));
    const nouveau = await nouveauCode();
    await t.viser(p.locator('span.font-mono.text-2xl').first());
    await t.dire(`Sur le PC, un nouveau code s'affiche : ${nouveau}. Tous les autres postes sont déconnectés.`);
    await tab.viser(tab.page.locator('input[placeholder="000000"]'));
    await t.dire('Sur la tablette, la demande de code revient : l\'ancien code ne marche plus. On tape le nouveau.');
    await tab.saisir(tab.page.locator('input[placeholder="000000"]'), nouveau);
    await tab.clic(tab.bouton('Se connecter'));
    await tab.page.waitForTimeout(2000);
    await postesConnectes('Sur le PC, la tablette est reconnectée, mais de nouveau en « Consultation » : après un changement de code, le droit de saisir est à redonner.',
        'Changer le code remet tout à plat : aucun appareil ne garde un droit de saisie sans que le PC principal le lui redonne.');
    await t.choisir(ligneTablette().locator('select'), 'saisie');
    await t.viser(ligneTablette());
    await tab.viser(bandeau(tab));
    await t.dire('On lui redonne « ✍️ Saisie » : le bandeau de la tablette repasse en « Poste de saisie ».');

    await t.chapitre('Coupure du réseau');
    await t.dire(dicte('Panne : le réseau est coupé.'), 'On simule la coupure depuis le PC : « Désactiver » dans la fenêtre « Mode réseau ».');
    await t.clic(t.bouton(/^Désactiver$/));
    await o.fermer();
    await tab.page.locator('text=/Connexion perdue/').first().waitFor({ timeout: 15000 }).catch(() => {});
    if (process.env.FILM_RAPIDE) await tab.decrire('S6-coupure');
    await tab.viser(bandeau(tab));
    await t.dire('Sur la tablette, le bandeau passe au rouge : « Connexion perdue — reconnexion en cours… (saisie impossible) ».',
        '« 💾 Copie de secours » télécharge la dernière version reçue du secours : si le PC principal est hors service, on l\'importe sur un autre ordinateur.');
    await t.dire(dicte('De MARTIN Alice : bilan terminé.'), 'La tablette essaie d\'enregistrer la ligne pendant la coupure.');
    await tab.vite(async () => {
        await tab.saisir(tab.page.locator('input[list="expediteurs-list"]:visible'), 'MARTIN Alice');
        await tab.saisir(tab.champ('Description...'), 'Bilan terminé.');
    }, 0.5);
    await tab.clic(tab.bouton(/^✓ ENREGISTRER$/));
    await t.dire('Elle refuse : « Hors ligne : saisie impossible ». Ce qui a été tapé reste dans le formulaire.', 'Rien n\'est envoyé plus tard sans contrôle.');
    await t.dire('Le réseau revient : sur le PC, on réactive le mode réseau. Le code ne change pas.');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton('Activer le mode réseau'));
    await tab.page.locator('text=Connecté au poste principal').first().waitFor({ timeout: 30000 }).catch(() => {});
    await tab.page.waitForTimeout(1500);
    await postesConnectes('Sur le PC, la tablette est revenue toute seule dans les postes connectés, avec son rôle « Saisie ».');
    await tab.viser(bandeau(tab));
    await t.dire('Sur la tablette : « Connecté au poste principal ». On clique de nouveau sur « Enregistrer ».');
    await o.fermer();
    await tab.clic(tab.bouton(/^✓ ENREGISTRER$/));
    if (await mod.count()) await tab.clic(mod);
    await voirLigne(t, 'Bilan terminé.', 'La ligne arrive sur le PC, avec l\'heure à laquelle elle a été enregistrée. Si l\'appel datait de plusieurs minutes, on le précise dans le texte.');

    await t.chapitre('Désactiver le réseau');
    await t.dire(dicte('Fin du travail à plusieurs.'), 'Sur le PC, « Désactiver » dans la fenêtre « Mode réseau » coupe l\'accès de tous les autres postes.');
    await t.clic(t.bouton('🌐 Mode réseau'));
    await t.clic(t.bouton(/^Désactiver$/));
    await t.viser(t.bouton('Activer le mode réseau'));
    await t.dire('Sur le PC, le mode réseau est désactivé : la fenêtre propose de nouveau « Activer le mode réseau ».');
    await tab.page.locator('text=/Connexion perdue/').first().waitFor({ timeout: 15000 }).catch(() => {});
    if (process.env.FILM_RAPIDE) await tab.decrire('S6-coupure');
    await tab.viser(bandeau(tab));
    await t.dire('Sur la tablette, « Connexion perdue » : elle ne peut plus rien saisir. On ferme son navigateur.',
        'Les lignes saisies sur la tablette sont dans la main courante du PC : rien n\'est à récupérer sur la tablette.');
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
    await t.glisser(p.locator('#palette-title'), { x: 160, y: ti.y + ti.height / 2 + 40 });
    await t.dire(dicte('Vérifiez que GIRARD Antoine est noté directeur du secours souterrain.'), 'Noté à la main depuis la palette en phase 2, il a été prolongé par la mise à jour du planning.');
    await t.viser(p.locator('tr:visible', { hasText: 'GIRARD Antoine' }).first());
    await t.dire(dicte('ROBERT et PETIT vont manger.'), 'On sélectionne leurs cases actuelles (Ctrl pour la seconde), puis on clique l\'activité dans la palette : une ligne est ajoutée à la main courante.');
    let i = await o.caseActuelle('ROBERT Emma');
    await t.clic(o.cases('ROBERT Emma').nth(i));
    await o.cases('PETIT Félix').nth(await o.caseActuelle('PETIT Félix')).click({ modifiers: ['Control'] });
    await t.clic(t.bouton('Repas - Déjeuner'));
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
    await t.dire(dicte('La victime est sortie de la cavité, prise en charge au poste médical avancé. Puis : victime évacuée vers l\'hôpital de Pontarlier.'), 'Deux lignes importantes : la première au point F ; la seconde sans point phone, car l\'hôpital est hors du site. Catégorie « Secours » détectée.');
    await o.ligne({ texte: 'La victime est sortie de la cavité, prise en charge au poste médical avancé.', pp: PP.F, important: true });
    await o.ligne({ texte: 'Victime évacuée vers l\'hôpital de Pontarlier.', important: true });
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
    if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await t.saisir(t.champ('Ex: Martin DUPONT'), SECRETAIRE_2); await t.clic(t.bouton(/^✓ Enregistrer$/)); }
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
    if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await t.saisir(t.champ('Ex: Martin DUPONT'), SECRETAIRE_2); await t.clic(t.bouton(/^✓ Enregistrer$/)); }
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
    // À partir de la phase 6 (mode réseau), le PC principal date les lignes des autres postes à
    // l'heure réelle : l'horloge du PC, partie plus tôt et avancée par les phases précédentes
    // (pauses, rappels), est amenée à l'heure réelle avant le film
    if (n >= 6) {
        const ecart = Date.now() - await t.page.evaluate(() => Date.now());
        if (ecart > 0) await t.page.clock.fastForward(ecart);
        await t.page.waitForTimeout(5000);
    }
    await t.debutFilm();
    await PHASES[n - 1](t, o);
// Phases 1 à 5 : séance commencée à 9 h ce jour (jamais à cheval sur minuit, quelle que soit
// l'heure du tournage). Phases 6 à 8 : séance commencée 2 h 30 avant le tournage (les phases
// précédentes avancent l'horloge d'environ 1 h 15), puis heure réelle.
}, { debut: n >= 6 ? new Date(Date.now() - 150 * 60000) : (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; })() });

module.exports = { film, PHASES };
