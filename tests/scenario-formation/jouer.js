// ============================================
// SCÉNARIO DE FORMATION : vérification sur l'application
// ============================================
// Joue, étape par étape, le « Scénario de formation des gestionnaires SSF » (document Claude,
// export docs/Scenario_Formation_Gestionnaires_SSF.docx) sur la vraie application, avec un
// dossier de données jetable. Chaque étape est contrôlée ; une étape en échec est notée avec
// une capture d'écran et le jeu continue. L'horloge de la page est accélérée pour les rappels.
// Les étapes suivent le document revu avec les films S1 à S8 (octobre 2026) : secrétaires et
// renforts dans la liste, équipes avant les points phones, suivi de la civière, rapport détaillé.
//
// Utilisation (depuis C:\Projets\SSF) : node tests/scenario-formation/jouer.js
// Résultat : tests/scenario-formation/sortie/rapport.md (+ captures des étapes en échec)

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('../outils-fichiers');

const RACINE = path.join(__dirname, '..', '..');
const NAVIGATEUR = path.join(RACINE, 'tests', 'aides', 'navigateur');
const SORTIE = path.join(__dirname, 'sortie');
fs.rmSync(SORTIE, { recursive: true, force: true });
fs.mkdirSync(SORTIE, { recursive: true });
const TELECHARGEMENTS = path.join(SORTIE, 'telechargements');
fs.mkdirSync(TELECHARGEMENTS, { recursive: true });

// Liste de l'annexe du scénario
const CSV = `ID;Nom;Prénom;Rôle;SSF
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
`;
// Les secrétaires du PC (dans la liste des sauveteurs, en « Gestion - PC » dès leur arrivée)
const SECRETAIRE_1 = 'Claire VIDAL', SECRETAIRE_2 = 'Paul MOREL', SECRETAIRE_3 = 'Sarah NICOLAS';
const FICHIER_CSV = path.join(SORTIE, 'liste-formation.csv');
fs.writeFileSync(FICHIER_CSV, CSV, 'utf8');
const CROQUIS = path.join(SORTIE, 'croquis-P40.jpg');
fs.copyFileSync(path.join(RACINE, 'tests', 'film', 'tutoriels', 'croquis-P40.png'), CROQUIS);

// Messages de l'application notés (et réponse « Annuler » à la demande) ; impression neutralisée
const espion = () => {
    window.__msgs = window.__msgs || [];
    window.__non = 0;
    window.alert = (m) => { window.__msgs.push('A: ' + m); };
    window.confirm = (m) => { window.__msgs.push('C: ' + m); if (window.__non > 0) { window.__non--; return false; } return true; };
    window.print = () => { window.__msgs.push('IMPRESSION'); };
};

const resultats = [];
const remarques = [];
const ecrireRapport = () => {
    const ko = resultats.filter(r => !r.ok);
    const md = [`# Vérification du scénario de formation — ${new Date().toLocaleString('fr-FR')}`, '',
        `${resultats.length} étapes jouées : ${resultats.length - ko.length} conformes, ${ko.length} en écart.`, '',
        ...(remarques.length ? ['## Remarques', '', ...remarques.map(r => '- ' + r), ''] : []), '| Étape | Ce qui est vérifié | Résultat |', '| --- | --- | --- |',
        ...resultats.map(r => `| ${r.id} | ${r.desc} | ${r.ok ? '✅' : '❌ ' + r.msg.replace(/\|/g, '/')} |`)].join('\n');
    fs.writeFileSync(path.join(SORTIE, 'rapport.md'), md);
    console.log(`\n${resultats.length - ko.length}/${resultats.length} étapes conformes — rapport : ${path.join(SORTIE, 'rapport.md')}`);
};


(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-scenario-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0' } });
    await app.evaluate(({ session }, dossier) => {
        session.defaultSession.on('will-download', (e, item) => item.setSavePath(dossier + '\\' + Date.now() + '-' + item.getFilename()));
    }, TELECHARGEMENTS);
    let p = await fenetrePrincipale(app);
    await app.context().addInitScript(espion);
    // SSF_SCENARIO_DEBUT=« 2026-10-06T23:20 » : séance qui passe minuit (heure locale)
    await p.clock.install({ time: process.env.SSF_SCENARIO_DEBUT ? new Date(process.env.SSF_SCENARIO_DEBUT) : new Date() });
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    p.setDefaultTimeout(8000);
    const debutSeance = await p.evaluate(() => Date.now());
    const postes = [];

    // ── Outils ──────────────────────────────────────────────────────────
    let nEtape = 0;
    const attendre = (ms = 400) => p.waitForTimeout(ms);
    const b = (texte, { dernier = false } = {}) => { const l = p.locator('button:visible', { hasText: texte }); return dernier ? l.last() : l.first(); };
    const champ = (ph) => p.locator(`input[placeholder="${ph}"]:visible, textarea[placeholder="${ph}"]:visible`).first();
    const lab = (texte, { dernier = false } = {}) => { const l = p.locator('label:visible', { hasText: texte }); return dernier ? l.last() : l.first(); };
    const msgs = () => p.evaluate(() => window.__msgs.slice());
    const viderMsgs = () => p.evaluate(() => { window.__msgs.length = 0; });
    const annulerProchaine = (n = 1) => p.evaluate((n) => { window.__non = n; }, n);
    const texte = () => p.evaluate(() => document.body.innerText);
    const verifier = (cond, quoi) => { if (!cond) throw new Error(quoi); };
    const contient = async (t, quoi) => verifier((await texte()).includes(t), quoi || `texte attendu absent : « ${t} »`);
    const msgContient = async (t) => verifier((await msgs()).some(m => m.includes(t)), `message attendu absent : « ${t} » — reçus : ${JSON.stringify((await msgs()).slice(-3))}`);
    // Fenêtres de démarrage restées ouvertes (sans Échap) : Passer, puis PC de Terrain
    const debloquer = async () => {
        if (await p.getByText('Application SSF — Démarrage').count()) { await b('Passer').click().catch(() => {}); await attendre(600); }
        if (await p.getByText("Choisissez votre mode d'utilisation").count()) { await p.getByText('PC de Terrain', { exact: false }).last().click(); await b('Confirmer et Démarrer', { dernier: true }).click(); await attendre(1000); }
    };
    const fermerTout = async () => { if (await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()) await p.locator('button[title^="Fermer (réapparaîtra"]').click().catch(() => {}); await debloquer().catch(() => {}); for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape').catch(() => {}); await attendre(150); } };
    const maintenant = () => p.evaluate(() => Date.now());
    const hhmm = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const iso = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const avancer = async (minutes) => {
        await p.clock.fastForward(minutes * 60000); await attendre(800);
        const r = p.locator('input[placeholder="Recherche rapide... (secrétaire, événement, équipe, point phone)"]:visible');
        if (await r.count()) { await r.fill('x'); await r.fill(''); }
        await attendre(400);
    };

    const etape = async (id, desc, fn) => {
        nEtape++;
        try {
            await fn();
            resultats.push({ id, desc, ok: true });
            console.log(`✅ ${id} ${desc}`);
        } catch (e) {
            const msg = String(e.message || e).split('\n')[0].slice(0, 300);
            resultats.push({ id, desc, ok: false, msg });
            console.log(`❌ ${id} ${desc} — ${msg}`);
            await p.screenshot({ path: path.join(SORTIE, `KO-${String(nEtape).padStart(3, '0')}-${id.replace(/[^\w]/g, '_')}.png`) }).catch(() => {});
            await fermerTout().catch(() => {});
            if (/crashed|closed/i.test(msg)) throw e;
        }
    };

    // Ligne de main courante (formulaire principal)
    const ligne = async ({ texte: t = '', equipe, venant, dest, pp, sens, depart, retour, lieu, important, rappel, fichier, categorie } = {}) => {
        if (dest) await p.locator('input[list="destinataires-list"]:visible').fill(dest);
        if (venant) await p.locator('input[list="expediteurs-list"]:visible').fill(venant);
        if (equipe) await p.locator('input[list="equipe-list"]:visible').fill(equipe);
        if (depart) { await lab('🚀 Départ PC').click(); if (lieu) await p.locator(`label[title^="${lieu}"]:visible`).click(); }
        if (retour) await lab('🏠 Retour PC').click();
        if (pp) await p.locator('input[list="pointsphone-list"]:visible').fill(pp);
        if (sens) await lab(sens).click();
        if (t) await champ('Description...').fill(t);
        if (important) await lab('⚠️ Important').locator('input').check();
        if (rappel) {
            await p.locator('input[type="date"]:visible').first().fill(iso(rappel));
            await p.locator('input[type="time"]:visible').first().fill(hhmm(rappel));
        }
        if (fichier) { await p.locator('input[type="file"][accept="image/*,.pdf,.doc,.docx"]').setInputFiles(fichier); await attendre(500); }
        if (categorie) await p.locator('select:visible', { has: p.locator('option[value="progression"]') }).first().selectOption(categorie);
        await b(/^✓ ENREGISTRER$/).click();
        await attendre(700);
    };
    const categorieForm = () => p.locator('select:visible', { has: p.locator('option[value="progression"]') }).first().inputValue();
    // Fenêtre « Mise à jour planning » / « Qui est au point phone ? »
    const fenetrePlanning = async ({ toute = true, garder = null, titre = null } = {}) => {
        const h = p.locator('h3:visible', { hasText: /Mise à jour planning|Qui est au point phone|Retour au PC/ });
        await h.first().waitFor({ timeout: 4000 });
        const lu = await h.first().innerText();
        if (titre) verifier(lu.includes(titre), `fenêtre de planning : « ${lu} » au lieu de « ${titre} »`);
        const boite = p.locator('div:visible', { has: h }).last();
        if (toute) { const c = boite.locator('label', { hasText: 'Toute l\'équipe' }).locator('input'); if (!(await c.isChecked())) await c.check(); }
        if (garder) {
            const toutes = boite.locator('label', { hasText: 'Toute l\'équipe' }).locator('input');
            if (await toutes.isChecked()) await toutes.uncheck();
            for (const n of garder) await boite.locator('label', { hasText: n }).locator('input').check();
        }
        await boite.locator('button', { hasText: 'Valider (' }).click();
        await attendre(600);
        return lu;
    };
    const onglet = async (nom) => { await b(nom).click(); await attendre(600); };
    // Activité actuelle d'un sauveteur au planning (dernière case colorée)
    const activite = async (nom) => {
        await onglet('Planning Opérationnel');
        const r = await p.evaluate((nom) => {
            const tr = [...document.querySelectorAll('tr')].find(t => t.innerText.includes(nom) && t.querySelector('td.time-slot-cell'));
            if (!tr) return 'ligne introuvable';
            const cases = [...tr.querySelectorAll('td.time-slot-cell')];
            const vide = (c) => { const bg = getComputedStyle(c).backgroundColor; return bg === 'rgba(0, 0, 0, 0)' || bg === 'rgb(255, 255, 255)'; };
            const derniere = [...cases].reverse().find(c => !vide(c));
            if (!derniere) return 'aucune';
            const bg = getComputedStyle(derniere).backgroundColor;
            const hex = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
            try { const a = ACTIVITIES.find(a => hex(a.color) === bg); return a ? a.name : bg; } catch (e) { return bg; }
        }, nom);
        await onglet('Main Courante');
        return r;
    };
    const attendreActivite = async (nom, attendue) => { const a = await activite(nom); verifier(a === attendue, `planning de ${nom} : « ${a} » au lieu de « ${attendue} »`); };
    const derniereLigne = () => p.evaluate(() => { const tr = document.querySelector('table tbody tr'); return tr ? tr.innerText : ''; });
    const modale = () => p.locator('.modal-overlay:visible').last();
    const modifierPoint = async (nom, nouveau) => {
        await ouvrirPoints();
        await p.evaluate((nom) => {
            const m = [...document.querySelectorAll('h2')].find(h => h.innerText.includes('Gestion des Points Phone')).closest('.modal-overlay');
            const el = [...m.querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText && e.innerText.trim() === nom);
            let r = el; while (r && ![...r.querySelectorAll('button')].some(b => b.innerText.includes('Modifier'))) r = r.parentElement;
            [...r.querySelectorAll('button')].find(b => b.innerText.includes('Modifier')).click();
        }, nom);
        await attendre(300);
        await modale().locator('input[placeholder="Nom du point phone..."]').fill(nouveau);
        await modale().locator('button', { hasText: /^\s*✓\s*$/ }).first().click();
        await attendre(500);
    };
    const ouvert = async (titre) => (await p.locator('h2:visible', { hasText: titre }).count()) > 0;
    const ouvrir = async (titre, bouton) => { if (!(await ouvert(titre))) { await b(bouton).click(); await attendre(500); } };
    const ouvrirListe = () => ouvrir('Gestion de la liste des sauveteurs', 'Liste des sauveteurs');
    const ouvrirEnregistrement = () => ouvrir('Enregistrement des sauveteurs', 'Enregistrement des sauveteurs');
    const ouvrirPoints = () => ouvrir('Gestion des Points Phone', 'Points Phone');
    const equipes = () => ouvrir('Gestion des Équipes', /^👥 Équipes$/);
    const carte = (nom) => p.locator('div.overflow-hidden.border-blue-300:visible').filter({ has: p.locator('span.font-black', { hasText: new RegExp('^' + nom + '$') }) }).first();
    const deplier = async (nom) => { if (!(await carte(nom).locator('button', { hasText: 'Fin de mission' }).isVisible())) await carte(nom).locator('div.cursor-pointer').first().click(); await attendre(300); };
    const fermer = async () => { await b(/^Fermer$/, { dernier: true }).click(); await attendre(300); };
    const creerEquipe = async ({ lieu, titre, ordre, membres, typeAttendu }) => {
        await lab(lieu).click();
        await champ('Titre (ex: Reconnaissance Zone Nord)').fill(titre);
        if (ordre) await champ('Détaillez précisément ce que l\'équipe doit faire...').fill(ordre);
        const choix = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
        const val = await choix.inputValue();
        if (typeAttendu) verifier(val === typeAttendu, `type de mission détecté : « ${val} » au lieu de « ${typeAttendu} »`);
        if (!val) await choix.selectOption({ index: 1 });
        for (const n of membres) await p.locator('label:visible', { hasText: n }).last().locator('input[type="checkbox"]').check();
        await b('Créer l\'Équipe').click();
        await attendre(600);
    };
    const secretaire = async (nom, dansListe) => {
        await p.locator('button[title="Changer de secrétaire"], button[title="Définir le secrétaire"]').first().click();
        if (dansListe) await p.locator('button:visible', { hasText: new RegExp('^' + dansListe + '$') }).click();
        else await champ('Ex: Martin DUPONT').fill(nom);
        await b(/^✓ Enregistrer$/).click();
        await attendre(400);
    };
    const ouvrirDossier = async ({ cavite, commune, delai = '6', base = null }) => {
        if (await b('Nouveau dossier').count()) { await b('Nouveau dossier').click(); await attendre(300); }
        await p.getByText('EXERCICE', { exact: true }).click();
        await champ('Ex: Gouffre de Padirac, Grotte de Clamouse...').fill(cavite);
        await champ('Ex: Saint-Martin-de-Londres...').fill(commune);
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption(delai);
        await b('Créer le dossier et continuer').click();
        await attendre(500);
        if (base) {
            await p.getByText('PC Base Arrière', { exact: false }).last().click();
            await champ('Ex: MC2, VEHICULE1, BASE-A...').fill(base.id);
            if (base.auteur) { await lab('Recopie d\'une main courante papier').click(); await p.locator('input[placeholder="Ex: Martin DUPONT"]:visible').last().fill(base.auteur); }
        } else {
            await p.getByText('PC de Terrain', { exact: false }).last().click();
        }
        await b('Confirmer et Démarrer', { dernier: true }).click();
        await attendre(1500);
        // Fenêtre du secrétaire (si aucun secrétaire mémorisé)
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill(SECRETAIRE_2); await b(/^✓ Enregistrer$/).click(); }
    };
    const relancer = async () => {
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await attendre(1500);
    };
    // La fenêtre du choix du mode réapparaît après « Modifier » les infos du secours
    const modeSiDemande = async (id) => {
        await attendre(600);
        if (await p.locator('h1:visible', { hasText: 'Version' }).filter({ hasText: 'Application SSF Unifiée' }).count() && await p.getByText("Choisissez votre mode d'utilisation").count()) {
            remarques.push(`${id} : après « Enregistrer les modifications », la fenêtre « Choisissez votre mode d'utilisation » réapparaît (sans Annuler) : il faut rechoisir PC de Terrain.`);
            await p.getByText('PC de Terrain', { exact: false }).last().click();
            await b('Confirmer et Démarrer', { dernier: true }).click(); await attendre(1000);
        }
    };
    const prochainNumero = async () => (await p.locator('span', { hasText: 'Prochain numéro' }).locator('strong').innerText()).trim();

    const PP = { F: 'F - Parking — Poste médical avancé', A: 'A - Entrée de la cavité', B: 'B - Tête du P40', C: 'C - Base du P40', D: 'D - Salle du Chaos', E: 'E - Point victime', G: 'G - TPS de surface (plateau de Nans-sous-Sainte-Anne)' };

    // ══ PHASE 1 ══════════════════════════════════════════════════════════
    await etape('1.0:10', 'Nouveau dossier EXERCICE, ID généré', async () => {
        await p.getByText('EXERCICE', { exact: true }).click();
        await champ('Ex: Gouffre de Padirac, Grotte de Clamouse...').fill('Gouffre de la Combe Noire');
        await champ('Ex: Saint-Martin-de-Londres...').fill('Nans-sous-Sainte-Anne');
        await contient('EXERCICE - Gouffre de la Combe Noire -', 'ID généré non affiché');
    });
    await etape('1.0:12', 'Délai d\'alerte 6h, créer le dossier', async () => {
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b('Créer le dossier et continuer').click();
        await attendre(500);
    });
    await etape('1.0:13', 'Mode PC de Terrain', async () => {
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer', { dernier: true }).click();
        await attendre(1500);
        await contient('Mode: 🎯 PC de Terrain');
    });
    await etape('1.0:14', 'Secrétaire du poste Claire VIDAL (🔄) + message de confirmation', async () => {
        await viderMsgs();
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill(SECRETAIRE_1); await b(/^✓ Enregistrer$/).click(); await attendre(400); }
        await secretaire(SECRETAIRE_1);
        await msgContient('Secrétaire enregistré');
    });
    await etape('1.0:16', 'Sauvegardes auto 30 min, badge 30mn', async () => {
        await b('Sauvegardes auto').click();
        await lab('30 min').locator('input').check();
        await p.keyboard.press('Escape'); await attendre(300);
        await contient('30mn', 'badge « 30mn » absent');
    });
    await etape('1.0:17', 'Modifier les infos : délai 8h', async () => {
        await b('✏️ Modifier').click();
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('8');
        await b('Enregistrer les modifications').click();
        await modeSiDemande('1.0:17');
        // Deuxième ouverture : la fenêtre doit encore montrer le formulaire
        await b('✏️ Modifier').click(); await attendre(1200);
        const formulaire = await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).count();
        if (!formulaire) {
            remarques.push("1.0:17 : à la 2e ouverture de « ✏️ Modifier », la fenêtre « Démarrage — Modifier les informations du secours » affiche la liste « Rouvrir un dossier » au lieu du formulaire, sans onglets pour y revenir ; seuls « Rouvrir ce dossier » et « Passer » sont possibles.");
            await debloquer();
            throw new Error('2e « Modifier » : liste des dossiers au lieu du formulaire');
        }
        const v = await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().inputValue();
        await b('Enregistrer les modifications').click(); await modeSiDemande('1.0:17');
        verifier(v === '8', `délai relu : ${v}`);
    });
    await etape('1.0:18', 'Renommer l\'ID (ajout FORMATION)', async () => {
        const c = p.locator('input[placeholder="Ex: GouffreA_2025"]');
        const id = await c.inputValue();
        await c.fill(id + ' FORMATION');
        await p.locator('button[title="Valider le nouvel ID"]').click();
        await attendre(1200);
        await contient('FORMATION', 'ID renommé absent');
    });
    await etape('1.0:19', 'Plein écran puis quitter', async () => {
        await b('Plein écran').click(); await attendre(800);
        await b('📐 Quitter').click(); await attendre(800);
    });
    await etape('1.0:20', 'Message du CODIS pour le PC, Important : catégorie auto Secours (pas Communication)', async () => {
        await p.locator('input[list="expediteurs-list"]:visible').fill('CODIS');
        await p.locator('input[list="destinataires-list"]:visible').fill('PC');
        await champ('Description...').fill('Spéléologue bloqué à moins 150 m, au-delà du puits P40, jambe blessée. Victime : Lucas FAIVRE, 34 ans.');
        await attendre(300);
        const c = await categorieForm();
        await lab('⚠️ Important').locator('input').check();
        await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
        verifier(c === 'secours', `catégorie détectée : ${c}`);
        verifier((await derniereLigne()).includes('Message de : CODIS pour PC'), `ligne : ${(await derniereLigne()).slice(0, 120)}`);
    });
    await etape('1.0:23', 'Ligne matériel : catégorie auto Logistique', async () => {
        await champ('Description...').fill('Le matériel de secours est demandé au dépôt de Besançon.');
        await attendre(300);
        const c = await categorieForm();
        await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
        verifier(c === 'logistique', `catégorie détectée : ${c}`);
    });
    await etape('1.0:25', 'Alerte catégorie, choix Administratif', async () => {
        await champ('Description...').click();
        await attendre(300);
        await contient('Pensez à choisir une catégorie', 'encadré catégorie absent');
        await champ('Description...').fill('Le PC est installé au parking de la cavité.');
        await p.locator('select:visible', { has: p.locator('option[value="progression"]') }).first().selectOption('administratif');
        await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
    });
    await etape('1.0:27', 'Prochain numéro et compteurs', async () => {
        const n = await prochainNumero();
        verifier(n === '4' || n === '004', `prochain numéro : ${n}`);
        await contient('Total événements');
    });

    // ══ PHASE 2 ══════════════════════════════════════════════════════════
    await etape('2.0:30', 'Import CSV : 21 sauveteurs, « Liste complète (21) »', async () => {
        await viderMsgs();
        await ouvrirListe();
        await p.locator('input[type="file"][accept*=".csv"]').setInputFiles(FICHIER_CSV);
        await attendre(800);
        await msgContient('21 sauveteur');
        await contient('Liste complète (21)');
    });
    await etape('2.0:32', 'Recherche rapide et tri', async () => {
        await ouvrirListe();
        await champ('🔍 Recherche rapide...').fill('mor');
        await attendre(800);
        const lignes = await modale().locator('tbody tr').allInnerTexts();
        await champ('🔍 Recherche rapide...').fill('');
        verifier(lignes.some(l => l.includes('MOREAU')), `recherche « mor » : MOREAU absent`);
        if (lignes.length > 2) remarques.push(`2.0:32 : la recherche « mor » donne ${lignes.length} lignes : ${lignes.map(l => l.replace(/\s+/g, ' ').slice(0, 40)).join(' / ')}`);
        await p.locator('th:visible', { hasText: 'SSF' }).first().click();
        await p.locator('th:visible', { hasText: 'SSF' }).first().click();
    });
    await etape('2.0:34', 'Modifier le rôle de ROBERT Emma', async () => {
        await ouvrirListe();
        const tr = p.locator('table:visible tbody tr', { hasText: 'ROBERT' });
        await tr.locator('button[title="Modifier"]').click();
        const champs = p.locator('table:visible tbody tr', { has: p.locator('input') }).locator('input');
        const n = await champs.count();
        for (let i = 0; i < n; i++) { if ((await champs.nth(i).inputValue()) === 'Plongeur') await champs.nth(i).fill('Plongeur / Secouriste'); }
        await p.locator('button[title="Enregistrer"]').click(); await attendre(400);
        await contient('Plongeur / Secouriste');
    });
    await etape('2.0:35', 'Supprimer LEROY Hugo → 20', async () => {
        await ouvrirListe();
        await p.locator('table:visible tbody tr', { hasText: 'LEROY' }).locator('button[title="Supprimer"]').click(); await attendre(400);
        await contient('Liste complète (20)');
    });
    await etape('2.0:36', 'Sauveteur hors liste BLANC Olivier, ID EXT-…, liste à 21', async () => {
        await ouvrirListe();
        await champ('NOM').fill('BLANC'); await champ('Prénom').fill('Olivier'); await champ('Rôle').fill('Sauveteur montagne'); await champ('SSF / Service').fill('CRS');
        await b('+ Ajouter').click(); await attendre(400);
        const tr = await p.locator('table:visible tbody tr', { hasText: 'BLANC' }).innerText();
        verifier(/EXT-\d+/.test(tr), `ID de BLANC : ${tr}`);
        await contient('Liste complète (21)');
    });
    await etape('2.0:38', 'Doublon d\'ID 25-002 refusé', async () => {
        await ouvrirListe();
        await viderMsgs();
        await p.locator('input.bg-gray-100:visible').first().fill('25-002');
        await champ('NOM').fill('TEST'); await champ('Prénom').fill('Doublon');
        await b('+ Ajouter').click(); await attendre(300);
        await msgContient('existe déjà');
        await champ('NOM').fill(''); await champ('Prénom').fill(''); await p.locator('input.bg-gray-100:visible').first().fill('');
        await fermer();
    });
    const vague1 = ['GIRARD Antoine', 'MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'ROBERT Emma', 'PETIT Félix', 'DURAND Gaëlle', 'MOREAU Inès', 'SIMON Julien', 'ROUX Pierre', 'BLANC Olivier', 'VIDAL Claire'];
    // Case « arrive en gestion » / « arrive comme conseiller technique » sous un nom coché
    const caseFonction = (nom, libelle) => p.locator('div.p-2:visible', { has: p.getByText(nom, { exact: true }) }).first().locator('label', { hasText: libelle }).locator('input');
    await etape('2.0:39', 'Arrivée des 12, secrétaire comprise : gestion cochée (VIDAL, ROUX), CT coché (GIRARD, SIMON) et laissé coché', async () => {
        await ouvrirEnregistrement();
        await champ('🔍 Rechercher...').fill('gir'); await attendre(200); await champ('🔍 Rechercher...').fill('');
        for (const n of vague1) await p.locator('label:visible', { hasText: n }).first().locator('input').check();
        await attendre(300);
        for (const n of ['VIDAL Claire', 'ROUX Pierre']) verifier(await caseFonction(n, 'arrive en gestion').isChecked(), `« arrive en gestion » non cochée pour ${n}`);
        for (const n of ['GIRARD Antoine', 'SIMON Julien']) {
            const c = caseFonction(n, 'conseiller technique');
            verifier(await c.count() > 0, `« arrive comme conseiller technique » absente pour ${n}`);
            verifier(await c.isChecked(), `« arrive comme conseiller technique » non cochée pour ${n}`);
            const g = caseFonction(n, 'arrive en gestion');
            verifier(await g.count() === 0 || !(await g.isChecked()), `« arrive en gestion » cochée pour ${n} (le CT est privilégié)`);
        }
        await b('Arrivée (12)').click(); await attendre(500);
    });
    await etape('2.0:43', 'N° de planning de MARTIN Alice', async () => {
        await ouvrirEnregistrement();
        const t = await p.locator('label:visible', { hasText: 'MARTIN Alice' }).last().innerText();
        verifier(/N°\d+/.test(t), `n° absent : ${t}`);
        await fermer();
    });
    await etape('2.0:44', 'Lignes « Arrivée de : … » et « Gestion - PC » affectée à ROUX, VIDAL (Système)', async () => {
        await contient('Arrivée de :');
        await contient('"Gestion - PC" affectée à : ROUX Pierre, VIDAL Claire');
        await contient('"Conseiller technique" affectée à : GIRARD Antoine, SIMON Julien');
    });
    await etape('2.0:45', 'Planning : arrivés en Disponible, VIDAL et ROUX en Gestion - PC, GIRARD et SIMON en CT', async () => {
        await attendreActivite('MARTIN Alice', 'Disponible');
        await attendreActivite('VIDAL Claire', 'Gestion - PC');
        await attendreActivite('ROUX Pierre', 'Gestion - PC');
        await attendreActivite('GIRARD Antoine', 'Conseiller technique');
        await attendreActivite('SIMON Julien', 'Conseiller technique');
    });
    await etape('2.0:47', 'Ligne GIRARD, catégorie Personnel à la main', async () => {
        await champ('Description...').fill('GIRARD Antoine prend la direction du secours souterrain.');
        await attendre(300);
        const c = await categorieForm();
        await p.locator('select:visible', { has: p.locator('option[value="progression"]') }).first().selectOption('personnel');
        await b(/^✓ ENREGISTRER$/).click(); await attendre(600);
        verifier(c === 'autre', `catégorie avant choix : ${c} (le scénario dit « reste Autre »)`);
    });
    const cases = (nom) => p.locator('tr', { hasText: nom }).locator('td.time-slot-cell');
    const caseActuelle = async (nom) => cases(nom).evaluateAll(tds => { const vide = td => /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(getComputedStyle(td).backgroundColor); let i = tds.length - 1; while (i > 0 && vide(tds[i])) i--; return i; });
    await etape('2.0:48', 'GIRARD : Directeur Secours Souterrain par la palette + ligne', async () => {
        await onglet('Planning Opérationnel');
        await cases('GIRARD Antoine').nth(await caseActuelle('GIRARD Antoine')).click();
        await b('Directeur Secours Souterrain').click(); await attendre(500);
        await onglet('Main Courante');
        await contient('"Directeur Secours Souterrain" affectée à : GIRARD Antoine');
        await attendreActivite('GIRARD Antoine', 'Directeur Secours Souterrain');
    });
    await etape('2.0:49', 'Mise en alerte des renforts (ligne, catégorie Personnel)', async () => {
        await ligne({ texte: 'Mis en alerte, à faire venir plus tard : THOMAS David, LAURENT Karine, LEFEBVRE Léo, MICHEL Manon, GARCIA Nora ; secrétariat : MOREL Paul, NICOLAS Sarah ; TPS de surface : FAURE Lucie, BOYER Marc (ADRASEC).', categorie: 'personnel' });
        verifier((await derniereLigne()).includes('Mis en alerte'), 'ligne de mise en alerte absente');
    });

    // ══ PHASE 3 ══════════════════════════════════════════════════════════
    await etape('3.0:50', 'Équipe 1 : N°1, type Reconnaissance détecté, chef MARTIN', async () => {
        await equipes();
        await creerEquipe({ lieu: '🕳️ Sous terre', titre: 'Reconnaissance jusqu\'à la victime', ordre: 'Descendre jusqu\'au point victime, faire le bilan, rendre compte par TPS à chaque point phone.', membres: ['MARTIN Alice', 'BERNARD Bruno', 'ROBERT Emma'], typeAttendu: 'Reconnaissance' });
        await contient('Équipe 1');
    });
    await etape('3.0:54', 'Lignes « Création Équipe 1 » et « Engagé », planning Engagé', async () => {
        await fermer();
        await contient('Création Équipe 1');
        await contient('"Engagé" affectée à : MARTIN Alice, BERNARD Bruno, ROBERT Emma');
        await attendreActivite('ROBERT Emma', 'Engagé');
    });
    await etape('3.0:56', 'Équipe 2 : N°2 proposé, type ASV détecté', async () => {
        await equipes();
        const num = await p.locator('select:visible').filter({ has: p.locator('option', { hasText: 'déjà utilisé' }) }).first().inputValue();
        verifier(num === '2', `numéro proposé : ${num}`);
        await creerEquipe({ lieu: '🕳️ Sous terre', titre: 'ASV et médicalisation de la victime', membres: ['DUBOIS Chloé', 'DURAND Gaëlle', 'PETIT Félix'], typeAttendu: 'ASV' });
    });
    await etape('3.0:58', 'Équipe 3 : tri par spécialité, BERNARD « déjà en Équipe 1 » → Annuler', async () => {
        await equipes();
        await viderMsgs();
        await lab('🕳️ Sous terre').click();
        await champ('Titre (ex: Reconnaissance Zone Nord)').fill('Transmission, pose du TPS jusqu\'à la Salle du Chaos');
        const choix = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
        const val = await choix.inputValue();
        // Tri par spécialité : chefs d'équipe transmission, puis équipiers transmission
        const liste = (await p.locator('div.max-h-60:visible').first().innerText()).toUpperCase();
        const pos = (t) => liste.indexOf(t.toUpperCase());
        verifier(pos("👑 Chefs d'équipe transmission") >= 0 && pos("👑 Chefs d'équipe transmission") < pos('MOREAU Inès') && pos('MOREAU Inès') < pos('Équipiers transmission')
            && pos('Équipiers transmission') < pos('BERNARD Bruno') && pos('BERNARD Bruno') < pos('SIMON Julien') && pos('SIMON Julien') < pos('Autres sauveteurs'),
            'liste non rangée par spécialité (chefs transmission, équipiers transmission, autres)');
        for (const n of ['MOREAU Inès', 'SIMON Julien']) await p.locator('label:visible', { hasText: n }).last().locator('input[type="checkbox"]').check();
        await annulerProchaine();
        await p.locator('label:visible', { hasText: 'BERNARD Bruno' }).last().locator('input[type="checkbox"]').click();
        await msgContient('est actuellement dans Équipe 1');
        const coche = await p.locator('label:visible', { hasText: 'BERNARD Bruno' }).last().locator('input[type="checkbox"]').isChecked();
        verifier(!coche, 'BERNARD coché malgré Annuler');
        if (!val) await choix.selectOption({ index: 1 });
        await b('Créer l\'Équipe (2)').click(); await attendre(500);
        verifier(val === 'Transmission', `type détecté pour l'équipe 3 : « ${val} »`);
    });
    await etape('3.1:00', 'Équipe 4 surface (BLANC), type Logistique', async () => {
        await equipes();
        await creerEquipe({ lieu: '🌿 Surface', titre: 'Logistique, acheminement du matériel en surface', membres: ['BLANC Olivier'], typeAttendu: 'Logistique' });
    });
    await etape('3.1:01', 'En-tête équipe 1 (chef, nombre) et dépliage', async () => {
        await equipes();
        const t = (await carte('Équipe 1').innerText()).replace(/\s+/g, ' ');
        verifier(t.includes('3 mbr'), `en-tête : ${t.slice(0, 120)}`);
        if (!t.includes('👑')) remarques.push("3.1:01 : le badge « 👑 chef » de l'en-tête des équipes ne s'affiche pas ; le chef se voit en dépliant l'équipe (badge CHEF).");
        await deplier('Équipe 1');
        verifier((await carte('Équipe 1').innerText()).includes('CHEF'), 'badge CHEF absent après dépliage');
    });
    await etape('3.1:02', 'Imprimer la fiche de l\'équipe 1', async () => {
        await equipes();
        const avant = app.windows().length;
        await carte('Équipe 1').locator('button[title="Imprimer"]').click(); await attendre(1500);
        const fen = app.windows().slice(avant);
        verifier(fen.length > 0, 'aucune fenêtre d\'impression');
        const contenu = await fen[0].evaluate(() => document.body.innerText).catch(() => '');
        await fen[0].close().catch(() => {});
        verifier(contenu.includes('Ordre de mission'), 'fiche sans ordre de mission');
    });
    await etape('3.1:04', 'Export PDF et Excel des équipes', async () => {
        await equipes();
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await b('📄 Export PDF').click(); await attendre(1500);
        await b('📊 Export Excel').click(); await attendre(1500);
        const n = fs.readdirSync(TELECHARGEMENTS).length - avant;
        verifier(n === 2, `${n} fichier(s) téléchargé(s)`);
        await fermer();
        await attendreActivite('BLANC Olivier', 'Engagé');
    });
    const POINTS = [['F', 'Parking — Poste médical avancé', '🌿 Surface', '1'], ['A', 'Entrée de la cavité', '🚪 Entrée cavité', '2'], ['B', 'Tête du P40', '🕳️ Sous terre', '3'],
        ['C', 'Base du P40', '🕳️ Sous terre', '4'], ['D', 'Salle du Chaos', '🕳️ Sous terre', '5'], ['E', 'Point victime', '🕳️ Sous terre', '6'], ['G', 'TPS de surface (plateau de Nans-sous-Sainte-Anne)', '🌿 Surface', '7']];
    await etape('3.1:06', 'Créer les points phones F à E et G (TPS de surface, type Surface)', async () => {
        await ouvrirPoints();
        for (const [l, nom, type, pos] of POINTS) {
            await p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') }).locator('select').selectOption(l);
            await champ('Ex: Base du P80, Poste médical...').fill(nom);
            await champ('Pos.').fill(pos);
            await lab(type).click();
            await b('+ Ajouter').click(); await attendre(250);
        }
        await contient('Liste (8)', 'la liste ne compte pas 8 points');
    });
    await etape('3.1:12', 'Modifier D → Salle du Chaos amont ; « Vider tout » présent, non cliqué', async () => {
        await modifierPoint('Salle du Chaos', 'Salle du Chaos amont');
        verifier((await modale().innerText()).includes('Salle du Chaos amont'), 'nom non modifié');
        verifier(await b('Vider tout').count() > 0, '« Vider tout » absent');
        await fermer();
    });
    PP.D = 'D - Salle du Chaos amont';

    // ══ PHASE 4 ══════════════════════════════════════════════════════════
    await etape('4.1:15', 'Équipe 1 Départ PC sous terre → fenêtre planning Approche', async () => {
        await ligne({ equipe: 'Équipe 1', depart: true, lieu: 'Sous terre' });
        await fenetrePlanning({ titre: '— Approche' });
        await contient('"Approche" affectée à : Toute l\'équipe (Équipe 1)');
        await attendreActivite('MARTIN Alice', 'Approche');
    });
    await etape('4.1:18', 'Venant de MARTIN (équipe auto), A, Entre sous terre, sans texte', async () => {
        await p.locator('input[list="expediteurs-list"]:visible').fill('MARTIN Alice');
        const eq = await p.locator('input[list="equipe-list"]:visible').inputValue();
        await ligne({ pp: PP.A, sens: '🕳️ Entre sous terre' });
        await fenetrePlanning({ titre: '— Sous Terre' });
        verifier(eq === 'Équipe 1', `équipe remplie seule : « ${eq} »`);
        verifier((await p.locator('table tbody tr', { hasText: 'Message de : MARTIN Alice' }).first().innerText()).includes('Entre sous terre'), 'ligne sans « Entre sous terre »');
        await attendreActivite('ROBERT Emma', 'Sous Terre');
    });
    await etape('4.1:21', 'Équipe 3 : Départ PC, puis au point A SIMON entre, MOREAU reste à l\'entrée', async () => {
        await ligne({ equipe: 'Équipe 3', depart: true, lieu: 'Sous terre' });
        await fenetrePlanning();
        await ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '🕳️ Entre sous terre', texte: 'SIMON Julien entre seul et tire la ligne du TPS vers le P40.' });
        await fenetrePlanning({ toute: false, garder: ['SIMON Julien'] });
        await ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '🌿 Reste à l\'entrée', texte: 'MOREAU Inès pose le TPS à l\'entrée.' });
        await fenetrePlanning({ toute: false, garder: ['MOREAU Inès'] });
        await attendreActivite('SIMON Julien', 'Sous Terre');
        await attendreActivite('MOREAU Inès', 'Mission de surface');
    });
    await etape('4.1:24', 'MARTIN en tête du P40 (B)', async () => {
        await ligne({ venant: 'MARTIN Alice', pp: PP.B });
        await fenetrePlanning();
        await attendreActivite('MARTIN Alice', 'Sous Terre');
    });
    await etape('4.1:26', 'Suggestion de point phone C', async () => {
        await p.locator('input[list="equipe-list"]:visible').fill('Équipe 1');
        await champ('Description...').fill('Équipe 1 arrivée en C, base du P40.');
        await attendre(300);
        await contient('Vous semblez mentionner le point phone', 'suggestion absente');
        await b(/^Sélectionner$/).click();
        const v = await p.locator('input[list="pointsphone-list"]:visible').inputValue();
        await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
        await fenetrePlanning().catch(() => {});
        verifier(v.startsWith('C'), `point choisi : ${v}`);
    });
    await etape('4.1:28', 'Message de GIRARD pour MARTIN → Communication', async () => {
        await p.locator('input[list="expediteurs-list"]:visible').fill('GIRARD Antoine');
        await p.locator('input[list="destinataires-list"]:visible').fill('MARTIN Alice');
        await champ('Description...').fill('Rendez compte dès votre arrivée au point E.');
        await attendre(300);
        const c = await categorieForm();
        await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
        verifier(c === 'communication', `catégorie : ${c}`);
        verifier((await derniereLigne()).includes('Message de : GIRARD Antoine pour MARTIN Alice'), `ligne : ${(await derniereLigne()).slice(0, 120)}`);
    });
    let rappelSamu;
    await etape('4.1:30', 'Message du SAMU, rappel à +30 min → PROGRAMMÉE', async () => {
        rappelSamu = (await maintenant()) + 30 * 60000;
        await ligne({ venant: 'SAMU', dest: 'PC', texte: 'Envoyez-nous un bilan médical dans 30 minutes.', rappel: rappelSamu });
        verifier((await derniereLigne()).includes('PROGRAMMÉE'), 'statut PROGRAMMÉE absent');
    });
    await etape('4.1:32', 'Rappel famille à +3 min → URGENT, fenêtre d\'alertes, Report 5 mn', async () => {
        await ligne({ texte: 'Rappeler la famille de la victime.', rappel: (await maintenant()) + 3 * 60000 });
        verifier((await derniereLigne()).includes('URGENT'), 'statut URGENT absent');
        await avancer(1);
        await p.locator('h3:visible', { hasText: 'Alertes en attente' }).waitFor({ timeout: 8000 });
        await b('Report 5 mn').click(); await attendre(500);
    });
    await etape('4.1:35', 'Message de MARTIN pour le PC, pièce jointe croquis, téléchargement', async () => {
        await ligne({ venant: 'MARTIN Alice', dest: 'PC', texte: 'Croquis du P40.', fichier: CROQUIS });
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await p.locator('table tbody tr').first().locator('button[title^="Télécharger"]').click(); await attendre(1200);
        verifier(fs.readdirSync(TELECHARGEMENTS).length === avant + 1, 'pièce jointe non téléchargée');
    });
    await etape('4.1:37', 'Arrivée de 6 renforts, MOREL Paul en gestion cochée d\'office', async () => {
        await b('Enregistrement des sauveteurs').click();
        for (const n of ['THOMAS David', 'LAURENT Karine', 'LEFEBVRE Léo', 'MICHEL Manon', 'GARCIA Nora', 'MOREL Paul']) await p.locator('label:visible', { hasText: n }).first().locator('input').check();
        await attendre(300);
        verifier(await caseFonction('MOREL Paul', 'arrive en gestion').isChecked(), '« arrive en gestion » non cochée pour MOREL Paul');
        await b('Arrivée (6)').click(); await attendre(400); await fermer();
        await contient('Arrivée de : THOMAS David');
        await attendreActivite('MOREL Paul', 'Gestion - PC');
        await attendreActivite('THOMAS David', 'Disponible');
    });
    await etape('4.1:39', 'Fenêtre d\'alertes revient → Traité, ligne « Rappel réalisé »', async () => {
        await avancer(6);
        await p.locator('h3:visible', { hasText: 'Alertes en attente' }).waitFor({ timeout: 8000 });
        await p.locator('div.border-red-300:visible', { hasText: 'famille' }).locator('button', { hasText: '✓ Traité' }).click(); await attendre(600);
        await contient('traité :');
        await contient('RÉALISÉE');
    });
    await etape('4.1:41', 'Corriger la ligne 001, historique', async () => {
        const tr = p.locator('table tbody tr', { hasText: 'Lucas FAIVRE, 34 ans' }).first();
        await tr.locator('button[title="Modifier cet événement"]').click();
        const ta = p.locator('textarea[placeholder="Décrivez l\'événement..."]:visible');
        await ta.fill((await ta.inputValue()).replace('34 ans', '43 ans'));
        await b('Enregistrer', { dernier: true }).click(); await attendre(700);
        await fermerTout();
        const tr2 = p.locator('table tbody tr', { hasText: '43 ans' }).first();
        await tr2.locator('button[title="Voir les versions précédentes"]').click(); await attendre(300);
        verifier((await tr2.innerText()).includes('34 ans'), 'ancienne version non affichée');
    });
    await etape('4.1:43', 'Insérer après 003 à heure manuelle → 003a', async () => {
        const tr = p.locator('table tbody tr', { hasText: 'Le PC est installé au parking' }).first();
        const heure = (await tr.locator('td').nth(2).innerText()).split(' ')[1].slice(0, 5);
        const [h, m] = heure.split(':').map(Number);
        const t2 = hhmm(new Date(2026, 0, 1, h, m + 2).getTime());
        await tr.locator('button[title="Insérer un événement après celui-ci"]').click();
        const f = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Insérer un événement' }) }).last();
        await f.locator('textarea').first().fill('La gendarmerie a bouclé l\'accès au parking.');
        await f.locator('input[type="time"]').last().fill(t2);
        await f.locator('button', { hasText: 'Insérer l\'événement' }).click(); await attendre(700);
        await contient('003a');
    });
    await etape('4.1:45', 'Insérer avant la première ligne → 0z', async () => {
        await p.locator('button[title="Insérer un événement avant celui-ci (le tout premier événement)"]').click();
        const f = p.locator('div.bg-white:visible', { has: p.locator('h2', { hasText: 'Insérer un événement' }) }).last();
        await f.locator('textarea').first().fill('Un témoin avait prévenu la mairie.');
        await f.locator('button', { hasText: 'Insérer l\'événement' }).click(); await attendre(700);
        await contient('0z');
    });
    await etape('4.1:46', 'Relève : MOREL Paul choisi parmi les sauveteurs sur site', async () => {
        await secretaire(SECRETAIRE_2, 'MOREL Paul');
        verifier(await p.locator('input[placeholder="MOREL Paul"]:visible').count() > 0, 'secrétaire MOREL Paul non affiché');
    });
    await etape('4.1:47', 'Recherche rapide P40 puis Effacer', async () => {
        await champ('Recherche rapide... (secrétaire, événement, équipe, point phone)').fill('P40');
        await attendre(300);
        await contient('résultat(s)');
        await b(/^Effacer$/).click();
    });
    await etape('4.1:48', 'Recherche avancée : importants, alertes, catégories, tri', async () => {
        await b('Recherche Avancée').click();
        await b('Messages Importants').click();
        await b('Avec Alerte').click();
        await contient('Urgentes (≤2h)');
        await b(/Catégories \(/).click();
        await b('Tout décocher').click();
        await lab('📍 Progression').locator('input').check();
        await b(/^Date/).click();
        await fermer();
    });
    await etape('4.1:51', 'Tri du tableau par catégorie puis par N°', async () => {
        await p.locator('th', { hasText: 'Catégorie' }).last().click(); await attendre(200);
        await p.locator('th', { hasText: /^N°/ }).last().click().catch(async () => { await p.locator('thead th').first().click(); });
    });
    await etape('4.1:52', 'Imprimer la main courante (aperçu)', async () => {
        const avant = app.windows().length;
        await b('Imprimer main courante').click(); await attendre(1500);
        const fen = app.windows().slice(avant);
        verifier(fen.length > 0, 'aucune fenêtre d\'aperçu');
        const c = await fen[0].evaluate(() => document.body.innerText).catch(() => '');
        await fen[0].close().catch(() => {});
        verifier(c.includes('Total événements'), 'aperçu sans compteurs');
    });
    // Pause : le rappel SAMU devient urgent
    await avancer(10);

    // ══ PHASE 5 ══════════════════════════════════════════════════════════
    const ligneSamu = () => p.locator('table tbody tr', { hasText: 'Envoyez-nous un bilan médical' }).filter({ hasNotText: 'Rappel N°' }).first();
    await etape('5.2:05', 'Alerte SAMU : × puis revient, ✓ Valider dans le tableau', async () => {
        // Avancer jusqu'à l'échéance du rappel (statut URGENT ou DÉPASSÉE), sans aucune action,
        // puis laisser passer la vérification périodique (30 s) : la fenêtre doit s'ouvrir seule
        for (let i = 0; i < 40 && !/URGENT|DÉPASSÉE/.test(await ligneSamu().innerText()); i++) { await p.clock.fastForward(60000); await attendre(300); }
        for (let i = 0; i < 3 && !(await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()); i++) { await p.clock.fastForward(31000); await attendre(800); }
        if (!(await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count())) {
            await p.screenshot({ path: path.join(SORTIE, 'diag-5_2_05.png') }).catch(() => {});
            const etat = (await ligneSamu().innerText()).replace(/\s+/g, ' ').slice(0, 200);
            const heure = await p.evaluate(() => new Date().toLocaleString('fr-FR'));
            remarques.push(`5.2:05 : à l'échéance du rappel SAMU, la fenêtre d'alertes ne s'ouvre pas seule (heure ${heure} ; ligne : ${etat}) ; elle apparaît à la ligne de main courante suivante.`);
            await ligne({ texte: 'Point de situation après la pause.' });
        }
        await p.locator('h3:visible', { hasText: 'Alertes en attente' }).waitFor({ timeout: 20000 });
        await p.locator('button[title^="Fermer (réapparaîtra"]').click(); await attendre(800);
        if (await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()) remarques.push("5.2:05 : le bouton « × » de la fenêtre d'alertes (« Fermer (réapparaîtra dans 30 secondes) ») ne ferme pas la fenêtre : elle reste à l'écran.");
        await avancer(1);
        await p.locator('h3:visible', { hasText: 'Alertes en attente' }).waitFor({ timeout: 20000 });
        await ligneSamu().locator('button', { hasText: '✓ Valider' }).click(); await attendre(600);
        verifier((await ligneSamu().innerText()).includes('RÉALISÉE'), 'rappel SAMU non réalisé');
    });
    await etape('5.2:07', 'Équipe 2 Départ PC, entre sous terre', async () => {
        await ligne({ equipe: 'Équipe 2', depart: true, lieu: 'Sous terre' }); await fenetrePlanning();
        await attendreActivite('DUBOIS Chloé', 'Approche');
        await ligne({ equipe: 'Équipe 2', pp: PP.A, sens: '🕳️ Entre sous terre' }); await fenetrePlanning();
        await attendreActivite('DUBOIS Chloé', 'Sous Terre');
    });
    await etape('5.2:09', 'Scinder équipe 2 → 2B (PETIT seul)', async () => {
        await equipes(); await deplier('Équipe 2');
        await carte('Équipe 2').locator('button', { hasText: '✂️ Scinder' }).click();
        await p.locator('label:visible', { hasText: 'DURAND Gaëlle' }).last().locator('input').uncheck();
        await b('Créer Équipe 2B').click(); await attendre(600);
        const t = await carte('Équipe 2B').innerText();
        verifier(t.includes('ASV et médicalisation de la victime'), `mission reprise par la 2B : ${t.slice(0, 120)}`);
    });
    await etape('5.2:11', 'Nouvelle mission de la 2B (clic sur son titre)', async () => {
        await deplier('Équipe 2B');
        await carte('Équipe 2B').locator('div[title="Cliquer pour modifier"]').click(); await attendre(300);
        await champ('Titre (ex: Reconnaissance Zone Nord)').fill('Remonter chercher la couverture chauffante');
        await champ('Détaillez précisément ce que l\'équipe doit faire...').fill('Remonter au PC chercher la couverture chauffante pour la victime.');
        await b('Sauvegarder les modifications').click(); await attendre(500);
        verifier((await carte('Équipe 2B').innerText()).includes('Remonter chercher la couverture chauffante'), 'nouvelle mission absente de la carte');
        await fermer();
        await contient('Scission Équipe 2 → Équipe 2B');
        await contient('Position initiale Équipe 2B');
        await contient('Modification Équipe 2B');
        await attendreActivite('PETIT Félix', 'Sous Terre');
    });
    await etape('5.2:12', 'THOMAS rejoint l\'équipe 1 et part seul du PC (Approche)', async () => {
        await equipes(); await deplier('Équipe 1');
        await carte('Équipe 1').locator('button', { hasText: 'Ajouter des Membres' }).click();
        await p.locator('div.bg-emerald-50:visible label', { hasText: 'THOMAS David' }).locator('input').check();
        await b(/Ajouter \(1\) membre/).click(); await attendre(500);
        verifier((await carte('Équipe 1').innerText()).includes('THOMAS David'), 'THOMAS absent de l\'équipe 1');
        await fermer();
        await attendreActivite('THOMAS David', 'Engagé');
        await ligne({ equipe: 'Équipe 1', depart: true, lieu: 'Sous terre' });
        await fenetrePlanning({ toute: false, garder: ['THOMAS David'] });
        await attendreActivite('THOMAS David', 'Approche');
        await attendreActivite('MARTIN Alice', 'Sous Terre');
    });
    await etape('5.2:14', 'Mouvements BERNARD → T3 et ROBERT → 2B', async () => {
        await equipes(); await deplier('Équipe 1');
        for (const [nom, vers] of [['BERNARD Bruno', 'T3'], ['ROBERT Emma', '2B']]) {
            await deplier('Équipe 1');
            const l = carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: nom });
            await l.locator('input[placeholder="ID Équipe / PC"]').fill(vers);
            await l.locator('button', { hasText: 'Déplacer' }).click(); await attendre(500);
        }
        await deplier('Équipe 3');
        verifier((await carte('Équipe 3').innerText()).includes('BERNARD Bruno'), 'BERNARD absent de l\'équipe 3');
        await deplier('Équipe 2B');
        verifier((await carte('Équipe 2B').innerText()).includes('ROBERT Emma'), 'ROBERT absente de l\'équipe 2B');
    });
    await etape('5.2:17', 'SIMON chef de l\'équipe 3 (glisser-déposer)', async () => {
        await deplier('Équipe 3');
        const membres = carte('Équipe 3').locator('div[draggable="true"]');
        const simon = membres.filter({ hasText: 'SIMON Julien' });
        await simon.dragTo(membres.first()); await attendre(500);
        const premier = await carte('Équipe 3').locator('div[draggable="true"]').first().innerText();
        verifier(premier.includes('SIMON') && premier.includes('CHEF'), `en tête : ${premier}`);
        await fermer();
        await contient('BERNARD Bruno : Équipe 1 → Équipe 3');
        await contient('ROBERT Emma : Équipe 1 → Équipe 2B');
        await contient('Changement de chef Équipe 3');
    });
    await etape('5.2:20', 'Point H depuis ⚙️ du formulaire, Pos 4.5', async () => {
        await p.locator('button[title="Gérer les points phone"]').click();
        await p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') }).locator('select').selectOption('H');
        await champ('Ex: Base du P80, Poste médical...').fill('Étroiture');
        await champ('Pos.').fill('4.5');
        await lab('🕳️ Sous terre').click();
        await b('+ Ajouter').click(); await attendre(400);
        const ordre = await modale().innerText();
        const iC = ordre.indexOf('Base du P40'), iH = ordre.indexOf('Étroiture'), iD = ordre.indexOf('Salle du Chaos amont');
        verifier(iC < iH && iH < iD, `ordre : ${ordre.slice(0, 200)}`);
    });
    await etape('5.2:22', 'Renommer C → lignes mises à jour (message)', async () => {
        await viderMsgs();
        await modifierPoint('Base du P40', 'Base du P40, relais TPS');
        await msgContient('événement(s)');
        await fermer();
        await contient('Base du P40, relais TPS');
    });
    PP.C = 'C - Base du P40, relais TPS';
    await etape('5.2:23', 'Équipe 2B sort et rentre au PC (Approche)', async () => {
        await ligne({ equipe: 'Équipe 2B', pp: PP.A, sens: '🏠 Sort — rentre au PC' });
        await fenetrePlanning({ titre: '— Approche' });
        verifier((await p.locator('table tbody tr', { hasText: 'Équipe 2B' }).filter({ hasNotText: 'Planning' }).first().innerText()).includes('Sort de sous terre — rentre au PC'), 'ligne sans « Sort de sous terre — rentre au PC »');
        await attendreActivite('PETIT Félix', 'Approche');
        await attendreActivite('ROBERT Emma', 'Approche');
    });
    await etape('5.2:25', '« 🏠 Retour PC » de la 2B : toute l\'équipe revenue → Disponible, dissolution', async () => {
        await ligne({ equipe: 'Équipe 2B', retour: true });
        await fenetrePlanning();
        await contient('Dissolution Équipe 2B');
        await attendreActivite('PETIT Félix', 'Disponible');
        await attendreActivite('ROBERT Emma', 'Disponible');
    });
    await etape('5.2:25b', 'Équipe 3 au point A, reste à l\'entrée (Mission de surface)', async () => {
        await ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '🌿 Reste à l\'entrée' });
        await fenetrePlanning({ titre: '— Mission de surface' });
    });
    await etape('5.2:26', 'Équipe 5 hors site, Départ PC 🚗', async () => {
        await equipes();
        await creerEquipe({ lieu: '🚗 Hors site', titre: 'Chercher la civière au dépôt de Besançon', membres: ['LEFEBVRE Léo', 'MICHEL Manon'] });
        await fermer();
        await ligne({ equipe: 'Équipe 5', depart: true, lieu: 'Hors site' });
        await fenetrePlanning({ titre: '— Mission hors du site' });
        await attendreActivite('LEFEBVRE Léo', 'Mission hors du site');
    });
    await etape('5.2:27', 'Arrivée de FAURE et BOYER, équipe 6 de surface, Départ PC 🌿', async () => {
        await b('Enregistrement des sauveteurs').click();
        for (const n of ['FAURE Lucie', 'BOYER Marc']) await p.locator('label:visible', { hasText: n }).first().locator('input').check();
        await b('Arrivée (2)').click(); await attendre(400); await fermer();
        await equipes();
        await creerEquipe({ lieu: '🌿 Surface', titre: 'Transmission, TPS de surface et relais radio vers le PC', ordre: 'Installer le TPS de surface au point G et assurer la liaison radio avec le PC.', membres: ['FAURE Lucie', 'BOYER Marc'] });
        await contient('Équipe 6');
        await fermer();
        await ligne({ equipe: 'Équipe 6', depart: true, lieu: 'Surface' });
        await fenetrePlanning({ titre: '— Mission de surface' });
        await attendreActivite('BOYER Marc', 'Mission de surface');
    });
    await etape('5.2:28', 'Message de BOYER pour le PC au point G (relais radio)', async () => {
        await ligne({ venant: 'BOYER Marc', dest: 'PC', pp: PP.G, texte: 'TPS de surface installé au point G, liaison radio établie avec le PC.' });
        await fenetrePlanning().catch(() => {});
        const l = await p.locator('table tbody tr', { hasText: 'liaison radio établie' }).first().innerText();
        verifier(l.includes('Message de : BOYER Marc pour PC') && l.includes('G - TPS de surface'), `ligne : ${l.replace(/\s+/g, ' ').slice(0, 160)}`);
    });
    await etape('5.2:29', 'Fin de mission équipe 4 → dissoute, Disponible', async () => {
        await equipes(); await deplier('Équipe 4');
        await carte('Équipe 4').locator('button', { hasText: 'Fin de mission' }).click(); await attendre(500);
        await contient('Équipes Dissoutes');
    });
    await etape('5.2:30', 'Réactiver équipe 4 : les deux lignes restent, BLANC Engagé', async () => {
        await p.locator('div.bg-white:visible', { hasText: 'DISSOUTE' }).filter({ hasText: 'Équipe 4' }).locator('button', { hasText: 'Réactiver' }).first().click(); await attendre(500);
        await fermer();
        await contient('Dissolution Équipe 4');
        await attendreActivite('BLANC Olivier', 'Engagé');
    });
    await etape('5.2:32', '« 🏠 Retour PC » de l\'équipe 5 avec la civière → dissoute, Disponible', async () => {
        await avancer(40);
        await ligne({ equipe: 'Équipe 5', retour: true, texte: 'Civière rapportée du dépôt de Besançon.' });
        await fenetrePlanning();
        await contient('Dissolution Équipe 5');
        await attendreActivite('LEFEBVRE Léo', 'Disponible');
    });
    await etape('5.2:33', 'Départ de GARCIA → « Quitter le secours »', async () => {
        await b('Enregistrement des sauveteurs').click();
        await p.locator('label:visible', { hasText: 'GARCIA Nora' }).last().locator('input').check();
        await b('Départ (1)').click(); await attendre(500); await fermer();
        await contient('Départ de : GARCIA Nora');
        await attendreActivite('GARCIA Nora', 'Quitter le secours');
    });

    // ══ PHASE 6 ══════════════════════════════════════════════════════════
    let tab = null, adresse = '', code = '';
    const tb = (texte) => tab.locator('button:visible', { hasText: texte }).first();
    const texteTab = () => tab.evaluate(() => document.body.innerText);
    const roleTablette = () => p.locator('tr:visible').filter({ has: p.locator('select') }).last().locator('select');
    // Fenêtre de planning sur la tablette : « Toute l'équipe », puis Valider
    const planningTablette = async () => {
        const mod = tab.locator('button:visible', { hasText: 'Valider (' });
        await mod.first().waitFor({ timeout: 5000 }).catch(() => {});
        if (!(await mod.count())) return;
        const toute = tab.locator('label:visible', { hasText: 'Toute l\'équipe' }).locator('input');
        if (await toute.count() && !(await toute.isChecked())) await toute.check();
        await mod.first().click(); await tab.waitForTimeout(800);
    };
    await etape('6.2:35', 'Arrivée de NICOLAS (gestion cochée), activer le mode réseau (adresse, code)', async () => {
        while (await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()) { await p.locator('div.border-red-300:visible button', { hasText: '✓ Traité' }).first().click(); await attendre(500); }
        await b('Enregistrement des sauveteurs').click();
        await p.locator('label:visible', { hasText: 'NICOLAS Sarah' }).first().locator('input').check(); await attendre(300);
        verifier(await caseFonction('NICOLAS Sarah', 'arrive en gestion').isChecked(), '« arrive en gestion » non cochée pour NICOLAS Sarah');
        await b('Arrivée (1)').click(); await attendre(400); await fermer();
        await contient('Arrivée de : NICOLAS Sarah');
        await attendreActivite('NICOLAS Sarah', 'Gestion - PC');
        await b('🌐 Mode réseau').click();
        await b('Activer le mode réseau').click(); await attendre(1500);
        adresse = await p.locator('span.font-mono.text-xl').first().innerText();
        code = await p.locator('span.font-mono.text-2xl').first().innerText();
        verifier(/^http:\/\//.test(adresse) && /^\d{6}$/.test(code), `adresse ${adresse}, code ${code}`);
        if (!(await texte()).includes('Pare-feu')) remarques.push('6.2:35 : pas de mention du pare-feu en test (pare-feu désactivé avec des données jetables) — non vérifiable ici, vérifié lors des essais réels.');
    });
    await etape('6.2:38', 'Connexion d\'une tablette (code), secrétaire Sarah NICOLAS', async () => {
        const donneesT = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-scenario-tab-'));
        const nav = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: donneesT, SSF_URL: adresse + '/', SSF_TAILLE: '768x1000' } });
        postes.push(nav);
        tab = await nav.firstWindow();
        await nav.context().addInitScript(espion);
        await tab.reload();
        await tab.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await tab.locator('input[placeholder="000000"]').fill(code);
        await tb('Se connecter').click(); await tab.waitForTimeout(2500);
        await tb(/^🔄$/).click();
        await tab.locator('input[placeholder="Ex: Martin DUPONT"]:visible').fill(SECRETAIRE_3);
        await tb(/^✓ Enregistrer$/).click(); await tab.waitForTimeout(500);
        verifier((await texteTab()).includes('Connecté au poste principal'), 'bandeau « Connecté au poste principal » absent');
    });
    await etape('6.2:40', 'Tablette en consultation : saisie refusée', async () => {
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('Essai de saisie en consultation.');
        await tb(/^✓ ENREGISTRER$/).click(); await tab.waitForTimeout(1500);
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('');
        verifier(!(await texte()).includes('Essai de saisie en consultation'), 'ligne enregistrée malgré la consultation');
    });
    await etape('6.2:41', 'Rôle Saisie donné à la tablette : bandeau « Poste de saisie »', async () => {
        if (!(await p.locator('h2:visible', { hasText: 'Mode réseau' }).count())) await b('🌐 Mode réseau').click();
        await attendre(500);
        await roleTablette().selectOption('saisie'); await attendre(1500);
        verifier((await texteTab()).includes('Poste de saisie'), 'bandeau « Poste de saisie » absent sur la tablette');
        await fermer();
    });
    await etape('6.2:42', 'Saisie depuis la tablette (MARTIN, point E, « Bilan en cours. ») : « 📡 Saisie sur … » sur le PC', async () => {
        await tab.locator('input[list="expediteurs-list"]:visible').fill('MARTIN Alice');
        await tab.locator('input[list="pointsphone-list"]:visible').fill(PP.E);
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('Bilan en cours.');
        await tb(/^✓ ENREGISTRER$/).click(); await tab.waitForTimeout(1500);
        await planningTablette();
        await attendre(800);
        const l = await p.locator('table tbody tr', { hasText: 'Bilan en cours.' }).first().innerText();
        verifier(l.includes('Message de : MARTIN Alice') && l.includes('📡 Saisie sur') && l.includes(SECRETAIRE_3) && l.includes('E - Point victime'), `ligne sur le PC : ${l.replace(/\s+/g, ' ').slice(0, 200)}`);
    });
    await etape('6.2:44', 'Saisie simultanée : deux numéros distincts', async () => {
        await champ('Description...').fill('Top PC.');
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('Top tablette.');
        await Promise.all([b(/^✓ ENREGISTRER$/).click(), tb(/^✓ ENREGISTRER$/).click()]);
        await attendre(2000);
        const nums = await p.evaluate(() => [...document.querySelectorAll('table tbody tr')].filter(tr => /Top (PC|tablette)/.test(tr.innerText)).map(tr => tr.querySelector('td').innerText.trim()));
        verifier(nums.length === 2 && nums[0] !== nums[1], `numéros : ${JSON.stringify(nums)}`);
    });
    await etape('6.2:45', 'Correction depuis la tablette → « Corrigée par »', async () => {
        const tr = tab.locator('table tbody tr', { hasText: 'Top PC.' }).first();
        await tr.locator('button[title="Modifier cet événement"]').click();
        await tab.locator('textarea[placeholder="Décrivez l\'événement..."]:visible').fill('Top PC (corrigé depuis la tablette).');
        await tab.locator('button:visible', { hasText: 'Enregistrer' }).last().click(); await tab.waitForTimeout(1500);
        await tab.keyboard.press('Escape').catch(() => {});
        await attendre(800);
        await contient('Corrigée par');
    });
    await etape('6.2:46', 'Tablette : clôture refusée (réservée au poste principal)', async () => {
        const cloture = await tab.locator('button:visible', { hasText: 'Clôturer le secours' }).count();
        if (cloture) {
            await tb('Clôturer le secours').click();
            await tb('Heure actuelle').click().catch(() => {});
            await tab.waitForTimeout(1500);
            verifier(!(await texte()).includes('CLÔTURÉ'), 'secours clôturé depuis la tablette !');
            const m = await tab.evaluate(() => window.__msgs.concat([document.body.innerText]).join(' '));
            verifier(/réservée|principal/i.test(m), 'pas de message de refus visible sur la tablette');
        } else {
            console.log('   (bouton Clôturer absent sur la tablette)');
        }
    });
    await etape('6.2:47', 'Case « Autoriser la saisie sur les autres postes »', async () => {
        await b('🌐 Mode réseau').click();
        await lab('Autoriser la saisie sur les autres postes').locator('input').check(); await attendre(500);
        await lab('Autoriser la saisie sur les autres postes').locator('input').uncheck(); await attendre(300);
    });
    await etape('6.2:49', 'Changer le code : la tablette redemande le code, revient en consultation, Saisie redonnée', async () => {
        await b('Changer le code').click(); await attendre(2000);
        const nouveau = await p.locator('span.font-mono.text-2xl').first().innerText();
        verifier(nouveau !== code, 'code inchangé');
        await tab.locator('input[placeholder="000000"]').waitFor({ timeout: 8000 });
        await tab.locator('input[placeholder="000000"]').fill(nouveau);
        await tb('Se connecter').click(); await tab.waitForTimeout(2500);
        code = nouveau;
        const role = await roleTablette().inputValue();
        verifier(role === 'consultation', `rôle de la tablette après reconnexion : ${role}`);
        await roleTablette().selectOption('saisie'); await attendre(1500);
        verifier((await texteTab()).includes('Poste de saisie'), 'bandeau « Poste de saisie » absent après le changement de code');
    });
    await etape('6.2:51', 'Coupure : « Connexion perdue », saisie refusée et gardée, copie de secours, reconnexion en Saisie', async () => {
        await b(/^Désactiver$/).click(); await attendre(2000);
        await fermer();
        await tab.locator('text=/Connexion perdue/').first().waitFor({ timeout: 15000 });
        verifier((await texteTab()).includes('Copie de secours'), 'bouton Copie de secours absent');
        await tab.locator('input[list="expediteurs-list"]:visible').fill('MARTIN Alice');
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('Bilan terminé.');
        await tb(/^✓ ENREGISTRER$/).click(); await tab.waitForTimeout(1500);
        verifier(await tab.locator('textarea[placeholder="Description..."]:visible').inputValue() === 'Bilan terminé.', 'texte perdu après le refus hors ligne');
        verifier(!(await texte()).includes('Bilan terminé.'), 'ligne enregistrée hors ligne');
        await b('🌐 Mode réseau').click();
        await b('Activer le mode réseau').click();
        await tab.locator('text=Connecté au poste principal').first().waitFor({ timeout: 30000 });
        await tab.waitForTimeout(1500);
        verifier(await roleTablette().inputValue() === 'saisie', 'rôle Saisie perdu à la reconnexion');
        await fermer();
        await tb(/^✓ ENREGISTRER$/).click(); await tab.waitForTimeout(1500);
        await planningTablette();
        await attendre(800);
        await contient('Bilan terminé.');
    });
    await etape('6.2:55', 'Désactiver le mode réseau : la tablette perd la connexion', async () => {
        await b('🌐 Mode réseau').click();
        await b(/^Désactiver$/).click(); await attendre(800);
        verifier(await b('Activer le mode réseau').count() > 0, '« Activer le mode réseau » non proposé');
        await tab.locator('text=/Connexion perdue/').first().waitFor({ timeout: 15000 });
        await fermer();
        for (const n of postes) await n.close().catch(() => {});
    });

    // ══ PHASE 7 ══════════════════════════════════════════════════════════
    await etape('7.3:00', 'Début J1 refusé (sauveteurs inscrits)', async () => {
        await viderMsgs();
        await onglet('Planning Opérationnel');
        const s = p.locator('select:visible').filter({ has: p.locator('option', { hasText: '23:00' }) }).first();
        const v = await s.inputValue();
        await s.selectOption(String((Number(v) + 23) % 24)); await attendre(300);
        await msgContient('Impossible de modifier l\'heure de début');
    });
    await etape('7.3:01', 'Jours : 2 → la dernière colonne est le deuxième jour du calendrier (J2)', async () => {
        const n = p.locator('input[type="number"]:visible');
        await n.fill('2'); await attendre(300);
        await n.blur(); await attendre(300);
        verifier(await n.inputValue() === '2', `jours : ${await n.inputValue()}`);
        const derniere = (await p.locator('th.header-time').last().innerText()).trim();
        verifier(/^J2\b/.test(derniere), `dernière colonne : « ${derniere} »`);
    });
    await etape('7.3:02', 'Tri par nom', async () => { await p.locator('[title="Cliquer pour trier"]').first().click(); await attendre(300); });
    const deplacerPalette = async () => { const ti = await p.locator('#palette-title').boundingBox(); await p.mouse.move(ti.x + 20, ti.y + 8); await p.mouse.down(); await p.mouse.move(60, 420, { steps: 8 }); await p.mouse.up(); await attendre(200); };
    // Case du planning : palette écartée, case au milieu de l'écran, puis clic
    const cliquerCase = async (nom, i, modifiers = []) => {
        await deplacerPalette();
        const c = cases(nom).nth(i);
        await c.evaluate(td => td.scrollIntoView({ block: 'center', inline: 'center' }));
        await c.click({ modifiers });
    };
    await etape('7.3:12', 'Palette déplaçable', async () => { await deplacerPalette(); });
    await etape('7.3:03', 'GIRARD toujours Directeur Secours Souterrain (palette en phase 2, prolongé)', async () => {
        await attendreActivite('GIRARD Antoine', 'Directeur Secours Souterrain');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:05', 'ROBERT et PETIT (Ctrl + clic) : Repas, ligne Système et planning', async () => {
        for (const n of ['ROBERT Emma', 'PETIT Félix']) await cliquerCase(n, await caseActuelle(n), n === 'PETIT Félix' ? ['Control'] : []);
        await b('Repas - Déjeuner').click(); await attendre(500);
        await onglet('Main Courante');
        await contient('"Repas - Déjeuner" affectée à : ROBERT Emma, PETIT Félix');
        await attendreActivite('PETIT Félix', 'Repas - Déjeuner');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:06', 'ROUX et BLANC : Repos sur site, 4h, rappel 30 min', async () => {
        for (const n of ['ROUX Pierre', 'BLANC Olivier']) await cliquerCase(n, await caseActuelle(n), n === 'BLANC Olivier' ? ['Control'] : []);
        await b('Repos sur site').click(); await attendre(500);
        await p.locator('h3:visible', { hasText: 'Durée du repos' }).waitFor({ timeout: 4000 });
        await b(/^4h$/).click(); await b(/^30min$/).click();
        await b('✓ Valider', { dernier: true }).click(); await attendre(600);
        await contient('Rappel 30min avant');
        await attendreActivite('BLANC Olivier', 'Repos sur site');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:08', 'LAURENT : Brancardage refusé (pas d\'équipe), rien ne change', async () => {
        await viderMsgs();
        const avant = await prochainNumero().catch(() => '');
        await cliquerCase('LAURENT Karine', await caseActuelle('LAURENT Karine'));
        await b('Brancardage').click(); await attendre(400);
        await msgContient('activité d\'équipe');
        await onglet('Main Courante');
        verifier(await prochainNumero() === avant || !avant, 'une ligne de main courante a été écrite');
        await attendreActivite('LAURENT Karine', 'Disponible');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:09', 'DUBOIS : poignée de recopie sur 4 cases, ligne « prolongée (recopie) »', async () => {
        await deplacerPalette();
        const i = await caseActuelle('DUBOIS Chloé');
        await cases('DUBOIS Chloé').nth(i).evaluate(td => td.scrollIntoView({ block: 'center', inline: 'center' }));
        await cases('DUBOIS Chloé').nth(i).click(); await attendre(200);
        const poignee = p.locator('.fill-handle');
        verifier(await poignee.count() > 0, 'poignée de recopie absente');
        await poignee.first().hover(); await p.mouse.down(); await cases('DUBOIS Chloé').nth(i + 4).hover({ force: true }); await p.mouse.up(); await attendre(400);
        const j = await caseActuelle('DUBOIS Chloé');
        verifier(j >= i + 3, `recopie : dernière case ${j}, départ ${i}`);
        await onglet('Main Courante');
        await contient('prolongée (recopie) pour : DUBOIS Chloé');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:10', 'Effacer les 2 dernières cases', async () => {
        await deplacerPalette();
        const j = await caseActuelle('DUBOIS Chloé');
        await cases('DUBOIS Chloé').nth(j).evaluate(td => td.scrollIntoView({ block: 'center', inline: 'center' }));
        await cases('DUBOIS Chloé').nth(j - 1).hover(); await p.mouse.down(); await cases('DUBOIS Chloé').nth(j).hover(); await p.mouse.up();
        await b('Efface l\'activité').click(); await attendre(400);
        const k = await caseActuelle('DUBOIS Chloé');
        verifier(k <= j - 2, `effacement : ${j} → ${k}`);
    });
    await etape('7.3:11', 'Mise à jour automatique : encart au quart d\'heure suivant ; bouton « Mettre a jour » (confirmation)', async () => {
        await lab('Mise à jour automatique du planning').locator('input').check();
        const attente = await p.evaluate(() => { const d = new Date(); return 15 * 60000 - ((d.getMinutes() % 15) * 60000 + d.getSeconds() * 1000 + d.getMilliseconds()); });
        await p.clock.fastForward(attente + 3000); await attendre(1500);
        await p.locator('text=/Planning mis à jour automatiquement/').first().waitFor({ timeout: 8000 });
        await viderMsgs();
        await b('Mettre a jour les activites').click(); await attendre(500);
        const m = (await msgs()).join(' ');
        verifier(/Mise a jour|Aucun creneau/.test(m), `message : ${m.slice(0, 120)}`);
    });
    await etape('7.3:12b', 'Info-bulle de mission d\'équipe', async () => {
        const nom = p.locator('tr', { hasText: 'MARTIN Alice' }).locator('td', { hasText: /^Équipe 1$|^1$/ }).first();
        if (await nom.count()) { await nom.hover(); await attendre(300); }
        const t = await texte();
        verifier(t.includes('Mission Équipe') || t.includes('Mission 1') || t.includes('Mission T1'), 'info-bulle de mission non trouvée (survol du nom d\'équipe)');
    });
    await etape('7.3:13', 'Synthèse : « qui est disponible ? » (comptage et noms), heure de référence, impression', async () => {
        await viderMsgs();
        await onglet('Synthèse Affectations');
        const ligneDispo = await p.locator('.section-synthese tr', { hasText: 'Disponible' }).first().innerText();
        const nb = Number((ligneDispo.match(/\d+/) || ['0'])[0]);
        verifier(nb > 0, `comptage « Disponible » : ${ligneDispo.replace(/\s+/g, ' ')}`);
        await b('Tout désélectionner').click();
        await p.locator('.section-detail label', { hasText: /^Disponible$/ }).locator('input').check(); await attendre(300);
        const detail = await p.locator('.section-detail h4', { hasText: /^Disponible/ }).first().locator('xpath=..').innerText();
        verifier(detail.includes('LAURENT Karine'), `liste des disponibles : ${detail.replace(/\s+/g, ' ').slice(0, 200)}`);
        await p.locator('button[title="Reculer d\'une heure"]').click();
        await p.locator('button[title="Avancer d\'une heure"]').click();
        await b('Imprimer la(les) liste(s)').click(); await attendre(400);
        await lab('Tout imprimer').click().catch(async () => { await b('Tout imprimer').click(); });
        await attendre(800);
        const m = await msgs();
        verifier(m.includes('IMPRESSION') || app.windows().length > 1, 'aucune impression lancée');
    });
    await etape('7.3:17', 'Tableau de bord : cartes et statistiques', async () => {
        await onglet('Tableau de Bord');
        await contient('Statistiques Détaillées');
        await contient('SSF département local (25)');
    });
    await etape('7.3:19', 'Alerte « équipe en mission depuis plus de 1 heure »', async () => {
        await avancer(40);
        const s = p.locator('select:visible, input[type="number"]:visible').last();
        if ((await s.evaluate(e => e.tagName)) === 'SELECT') await s.selectOption('1'); else await s.fill('1');
        await attendre(500);
        const t = await p.locator('div:visible', { has: p.locator('h3', { hasText: 'Alertes Automatiques' }) }).last().innerText().catch(() => '');
        verifier(t.includes('Équipe 1'), `alertes automatiques : ${t.slice(0, 200)}`);
    });
    await etape('7.3:20', 'DUBOIS : équipe 2 en tête du P40, puis au point victime', async () => {
        await onglet('Main Courante');
        await ligne({ venant: 'DUBOIS Chloé', pp: PP.B }); await fenetrePlanning();
        await ligne({ venant: 'DUBOIS Chloé', pp: PP.E }); await fenetrePlanning();
        const l = await p.locator('table tbody tr', { hasText: 'Message de : DUBOIS Chloé' }).first().innerText();
        verifier(l.includes('Équipe 2') && l.includes('E - Point victime'), `ligne : ${l.replace(/\s+/g, ' ').slice(0, 160)}`);
        await attendreActivite('DURAND Gaëlle', 'Sous Terre');
    });
    // Graphique de progression : puces des équipes (masquer / afficher)
    const graphe = () => p.locator('svg[width]:visible').filter({ has: p.locator('text', { hasText: 'entrée de la cavité' }) }).first();
    const puce = (nom) => p.locator('button', { has: p.locator('svg') }).filter({ hasText: new RegExp('^' + nom + ' \\(') }).first();
    const afficher = async (noms) => {
        const toutes = await p.locator('button', { has: p.locator('svg line') }).filter({ hasText: /^Équipe / }).allInnerTexts();
        for (const t of toutes) {
            const nom = t.replace(/\s*\(\d+\)\s*$/, '').trim();
            const visible = await puce(nom).evaluate(el => getComputedStyle(el).color !== 'rgb(156, 163, 175)');
            if (visible !== noms.includes(nom)) { await puce(nom).click(); await attendre(150); }
        }
    };
    await etape('7.3:22', 'Progression : PC, surface, entrée, sous terre ; une équipe, plusieurs ; scission 2 / 2B ; zoom, historique', async () => {
        await onglet('Progression Équipes');
        const g = await graphe().innerHTML();
        for (const t of ['Surface', 'Sous terre', 'entrée de la cavité', 'Poste de Comm']) verifier(g.includes(t), `graphique sans « ${t} »`);
        await afficher(['Équipe 1']);
        const n1 = await graphe().locator('circle[r="7"]').count();
        verifier(n1 >= 5, `équipe 1 seule : ${n1} ronds`);
        await graphe().locator('circle[r="7"]').first().hover({ force: true }); await attendre(300);
        await p.mouse.move(5, 5);
        await puce('Équipe 3').click(); await attendre(200);
        verifier(await graphe().locator('circle[r="7"]').count() > n1, 'l\'équipe 3 ne s\'ajoute pas');
        await afficher(['Équipe 2', 'Équipe 2B']);
        verifier(await graphe().locator('path[stroke-dasharray="2 4"]').count() > 0, 'pas de ligne en pointillés pour la 2B');
        await graphe().locator('g').filter({ has: p.locator('path[stroke-dasharray="2 4"]') }).last().locator('circle[r="7"]').last().hover({ force: true }); await attendre(300);
        await p.mouse.move(5, 5);
        const toutes = await p.locator('button', { has: p.locator('svg line') }).filter({ hasText: /^Équipe / }).allInnerTexts();
        await afficher(toutes.map(s => s.replace(/\s*\(\d+\)\s*$/, '').trim()));
        await p.locator('button[title="Agrandir"]').click(); await p.locator('button[title="Réduire"]').click(); await p.locator('button[title="Réinitialiser"]').click();
        await contient('Historique des localisations');
        await onglet('Main Courante');
    });

    // ══ PHASE 8 ══════════════════════════════════════════════════════════
    const ligneSecours = async (opts, attendu) => {
        await ligne(opts);
        if (opts.pp) await fenetrePlanning().catch(() => {});
        const l = await p.locator('table tbody tr', { hasText: attendu }).first().innerText();
        verifier(l.includes('Secours'), `catégorie de « ${attendu} » : ${l.replace(/\s+/g, ' ').slice(0, 160)}`);
        return l;
    };
    await etape('8.3:25', 'DUBOIS : fiche bilan, trauma, victime → catégorie Secours (pas Progression)', async () => {
        await onglet('Main Courante');
        await ligneSecours({ venant: 'DUBOIS Chloé', pp: PP.E, texte: 'Fiche bilan numéro 2 : trauma de la jambe droite, attelle posée, victime stable.', important: true }, 'Fiche bilan numéro 2');
    });
    await etape('8.3:26', 'DUBOIS : soins, blessé, civière → Secours', async () => {
        await ligneSecours({ venant: 'DUBOIS Chloé', pp: PP.E, texte: 'Soins terminés, le blessé est conditionné dans la civière.' }, 'Soins terminés');
    });
    await etape('8.3:27', 'MARTIN : départ de la civière, brancardage → Secours', async () => {
        const l = await ligneSecours({ venant: 'MARTIN Alice', pp: PP.E, texte: 'Départ de la civière du point victime, brancardage par les équipes 1 et 2.', important: true }, 'Départ de la civière');
        verifier(l.includes('Équipe 1'), 'ligne sans l\'équipe 1');
    });
    let tsTeteP40 = 0, tsSortie = 0;
    await etape('8.3:28', 'Civière à la base, puis en tête du P40', async () => {
        await avancer(10);
        await ligneSecours({ venant: 'MARTIN Alice', pp: PP.C, texte: 'Civière à la base du P40.' }, 'Civière à la base');
        await avancer(10);
        await ligneSecours({ venant: 'MARTIN Alice', pp: PP.B, texte: 'Civière en tête du P40.' }, 'Civière en tête');
        tsTeteP40 = await maintenant();
    });
    await etape('8.3:29', 'Civière sortie de la cavité (reste à l\'entrée), équipe 2 aussi : Mission de surface', async () => {
        await avancer(10);
        await ligneSecours({ venant: 'MARTIN Alice', pp: PP.A, sens: '🌿 Reste à l\'entrée', texte: 'Civière sortie de la cavité, les équipes 1 et 2 l\'accompagnent au poste médical avancé.', important: true }, 'Civière sortie');
        tsSortie = await maintenant();
        await ligne({ equipe: 'Équipe 2', pp: PP.A, sens: '🌿 Reste à l\'entrée' }); await fenetrePlanning();
        await attendreActivite('MARTIN Alice', 'Mission de surface');
        await attendreActivite('DUBOIS Chloé', 'Mission de surface');
    });
    await etape('8.3:30', 'Victime prise en charge au point F, départ en ambulance (sans point phone)', async () => {
        await ligneSecours({ venant: 'DUBOIS Chloé', pp: PP.F, texte: 'Victime prise en charge par le SAMU au poste médical avancé.', important: true }, 'prise en charge par le SAMU');
        await ligneSecours({ venant: 'SAMU', texte: 'Départ de la victime en ambulance.', important: true }, 'Départ de la victime');
    });
    await etape('8.3:31', 'Recherche avancée, catégorie Secours seule : du CODIS à l\'ambulance', async () => {
        await b('Recherche Avancée').click();
        await b(/Catégories \(/).click();
        await b('Tout décocher').click();
        await lab('🚑 Secours').locator('input').check(); await attendre(300);
        const n = Number(((await p.getByText(/Résultats : \d+ événement/).first().innerText()).match(/\d+/) || ['0'])[0]);
        const liste = await p.locator('div.max-h-96.overflow-y-auto:visible').first().innerText();
        verifier(n >= 9 && liste.includes('CODIS') && liste.includes('Départ de la victime en ambulance'), `${n} lignes Secours`);
        await fermer();
    });
    await etape('8.3:32', 'Progression : équipes 1 et 2 seules (remontée de la civière)', async () => {
        await onglet('Progression Équipes');
        await afficher(['Équipe 1', 'Équipe 2']);
        verifier(await graphe().locator('circle[r="7"]').count() > 0, 'aucun rond affiché');
        const toutes = await p.locator('button', { has: p.locator('svg line') }).filter({ hasText: /^Équipe / }).allInnerTexts();
        await afficher(toutes.map(s => s.replace(/\s*\(\d+\)\s*$/, '').trim()));
        await onglet('Main Courante');
    });
    const exporter = async () => { const avant = fs.readdirSync(TELECHARGEMENTS); await b('Exporter Tout').click(); await attendre(1500); return fs.readdirSync(TELECHARGEMENTS).filter(f => !avant.includes(f)); };
    await etape('8.3:35', 'Exporter Tout', async () => { const n = await exporter(); verifier(n.length === 1, `${n.length} fichier(s)`); });
    const idPrincipal = await p.locator('input[placeholder="Ex: GouffreA_2025"]').inputValue().catch(() => '');
    let fichierPCA;
    await etape('8.3:36', 'Relance, nouveau dossier PC Base Arrière PCA, recopie papier de ROUX Pierre', async () => {
        await relancer();
        await ouvrirDossier({ cavite: 'Combe Noire PCA', commune: 'Nans-sous-Sainte-Anne', base: { id: 'PCA', auteur: 'ROUX Pierre' } });
        await contient('Recopie de la main courante papier rédigée par ROUX Pierre');
    });
    await etape('8.3:39', 'Trois lignes papier, rangement chronologique PCA-001 ; l\'ambulance entre deux lignes du PC', async () => {
        const lignesPapier = [[debutSeance + 70 * 60000, 'Route d\'accès fermée par la gendarmerie.'], [debutSeance + 40 * 60000, 'Véhicule du SSF 25 arrivé au parking.'], [(tsTeteP40 + tsSortie) / 2, 'Ambulance du SAMU arrivée au parking.']];
        let infos = [];
        for (const [h, txt] of lignesPapier) {
            await p.locator('input[type="date"]:visible').first().fill(iso(h));
            await p.locator('input[type="time"]:visible').first().fill(hhmm(h));
            await champ('Description...').fill(txt);
            await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
            infos.push(await p.locator('span.text-amber-800:visible').first().innerText().catch(() => ''));
        }
        verifier(infos[1].includes('rangée à sa place') && infos[1].includes('PCA-001'), `info 2e ligne : « ${infos[1]} »`);
    });
    await etape('8.3:43', 'Exporter Événements (SSF_Events_PCA_…)', async () => {
        const avant = fs.readdirSync(TELECHARGEMENTS);
        await b('Exporter Événements').click(); await attendre(1500);
        const n = fs.readdirSync(TELECHARGEMENTS).filter(f => !avant.includes(f));
        verifier(n.length === 1 && n[0].includes('SSF_Events_PCA'), `fichiers : ${n}`);
        fichierPCA = path.join(TELECHARGEMENTS, n[0]);
    });
    await etape('8.3:44', 'Relance, Rouvrir le dossier principal, PC de Terrain', async () => {
        await relancer();
        await b('Rouvrir un dossier').click(); await attendre(500);
        await contient('Combe Noire PCA');
        await p.locator('div.cursor-pointer:visible', { hasText: idPrincipal || 'Gouffre de la Combe Noire' }).first().click();
        await b('Rouvrir ce dossier').click(); await attendre(1000);
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer', { dernier: true }).click(); await attendre(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill(SECRETAIRE_2); await b(/^✓ Enregistrer$/).click(); }
        await contient('Départ de la victime en ambulance');
    });
    // Position d'une ligne dans un tableau (ordre d'affichage)
    const rang = (lignes, t) => lignes.findIndex(l => l.includes(t));
    await etape('8.3:46', 'Importer MC (aperçu) : l\'ambulance (PCA) entre deux lignes du PC, dans l\'aperçu et dans la main courante', async () => {
        await b('Importer MC (aperçu)').click();
        await p.locator('#mc-file-input').setInputFiles(fichierPCA); await attendre(800);
        await contient('Aperçu de la fusion chronologique');
        const apercu = await modale().locator('tbody tr').allInnerTexts();
        const [a1, a2, a3] = ['Civière en tête', 'Ambulance du SAMU', 'Civière sortie'].map(t => rang(apercu, t));
        verifier(a1 >= 0 && a1 < a2 && a2 < a3, `aperçu : rangs ${a1}, ${a2}, ${a3}`);
        await b('Confirmer la Fusion').click(); await attendre(1000);
        await contient('📝 papier');
        const mc = await p.locator('table tbody tr:visible').allInnerTexts();
        const [m1, m2, m3] = ['Civière sortie', 'Ambulance du SAMU', 'Civière en tête'].map(t => rang(mc, t));
        verifier(m1 >= 0 && m1 < m2 && m2 < m3, `main courante : rangs ${m1}, ${m2}, ${m3} (PCA-003 pas à son heure)`);
        verifier(mc[m2].includes('PCA-003'), `numéro de la ligne papier : ${mc[m2].slice(0, 40)}`);
    });
    await etape('8.3:48', 'Importer Événements : confirmation puis Annuler', async () => {
        await viderMsgs(); await annulerProchaine();
        const n1 = await p.locator('table tbody tr').count();
        await p.locator('label', { hasText: 'Importer Événements' }).locator('input[type="file"]').setInputFiles(fichierPCA); await attendre(800);
        await msgContient('Importer 3 événement(s)');
        const n2 = await p.locator('table tbody tr').count();
        verifier(n1 === n2, `lignes : ${n1} → ${n2}`);
    });
    await etape('8.3:49', 'Sauvegardes : maintenant, Télécharger', async () => {
        await b('Sauvegardes auto').click();
        await b('Sauvegarder maintenant').click(); await attendre(800);
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await b('Télécharger').click(); await attendre(1200);
        verifier(fs.readdirSync(TELECHARGEMENTS).length === avant + 1, 'sauvegarde non téléchargée');
        await contient('Restaurer');
        await p.keyboard.press('Escape');
    });
    await etape('8.3:51', 'Exporter Tout puis Importer Tout : rien ne change', async () => {
        const n1 = await p.locator('table tbody tr').count();
        const f = await exporter();
        await viderMsgs();
        await p.locator('label', { hasText: 'Importer Tout' }).locator('input[type="file"]').setInputFiles(path.join(TELECHARGEMENTS, f[0])); await attendre(1500);
        await msgContient('écrasera');
        const n2 = await p.locator('table tbody tr').count();
        verifier(n1 === n2, `lignes : ${n1} → ${n2}`);
    });
    await etape('8.3:53', 'Clôture « Dernier événement + 5 min »', async () => {
        await b('Clôturer le secours').click();
        await b('Dernier événement + 5 min').click(); await attendre(1000);
        await contient('🔒 CLÔTURÉ');
        await contient('CLÔTURE DU SECOURS');
        verifier(await p.locator('input[placeholder="Ex: GouffreA_2025"]').isDisabled(), 'ID non verrouillé');
        verifier(!(await b('✏️ Modifier').count()), '« Modifier » encore visible');
    });
    await etape('8.3:54', 'Réouvrir, ligne, reclôturer à l\'heure actuelle', async () => {
        await b(/^Réouvrir$/).click(); await attendre(800);
        await ligne({ texte: 'Matériel récupéré et rangé.' });
        await b('Clôturer le secours').click();
        await b('Heure actuelle').click(); await attendre(800);
        await contient('🔒 CLÔTURÉ');
    });
    await etape('8.3:56', 'Rapport : statistiques, temps par sauveteur (repos, surface, PC), chronologie des équipes ; PDF, Excel', async () => {
        await onglet('Tableau de Bord');
        await b('Générer un Rapport').click(); await attendre(600);
        const r = await modale().innerText();
        for (const t of ['RAPPORT DE FIN DE MISSION', '1. STATISTIQUES GÉNÉRALES', 'Mobilisation Effective', 'Total événements enregistrés', '2. TEMPS PAR SAUVETEUR', '3. CHRONOLOGIE DES ÉQUIPES',
            'Issue de la scission de Équipe 2', 'Scission vers Équipe 2B', 'Nouvelle mission', 'Réactivation de l\'équipe', 'Ordre de mission'])
            verifier(r.includes(t), `rapport sans « ${t} »`);
        // Colonnes : sauveteur, total, sous terre, repos, surface, PC
        const cellules = async (nom) => modale().locator('tbody tr', { hasText: nom }).first().locator('td').allInnerTexts();
        const roux = await cellules('ROUX Pierre'), girard = await cellules('GIRARD Antoine'), moreau = await cellules('MOREAU Inès');
        verifier(roux[3] !== '0h00' && roux[5] !== '0h00', `ROUX : repos ${roux[3]}, PC ${roux[5]}`);
        verifier(girard[5] !== '0h00', `GIRARD : PC ${girard[5]}`);
        verifier(moreau[4] !== '0h00', `MOREAU : surface ${moreau[4]}`);
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await b('Exporter en PDF').click(); await attendre(1500);
        if (!(await b('Exporter en Excel').count())) { await b('Générer un Rapport').click(); await attendre(600); }
        await b('Exporter en Excel').click(); await attendre(1500);
        verifier(fs.readdirSync(TELECHARGEMENTS).length === avant + 2, 'rapport(s) non téléchargé(s)');
        await fermerTout();
        await onglet('Main Courante');
    });
    await etape('8.3:59', 'Archive finale (Exporter Tout)', async () => { const n = await exporter(); verifier(n.length === 1, 'pas de fichier'); });
    await etape('8.4:00', 'Mode maintenance : boutons visibles, non cliqués', async () => {
        await p.locator('#toggle-maintenance').check(); await attendre(200);
        verifier(await p.locator('button[title="Effacer les données du secours actuel uniquement"]').isVisible(), 'RESET APPLI absent');
        verifier(await p.locator('button[title="Vider TOUT le stockage de ce PC (tous les secours)"]').isVisible(), 'VIDER STORAGE absent');
        await p.locator('#toggle-maintenance').uncheck();
    });
    await etape('8.4:01', 'Relance, supprimer le dossier PCA, Tout supprimer (liste)', async () => {
        await relancer();
        await b('Rouvrir un dossier').click(); await attendre(500);
        await p.locator('div.cursor-pointer:visible', { hasText: 'Combe Noire PCA' }).locator('button', { hasText: 'Supprimer' }).click(); await attendre(800);
        verifier(!(await texte()).includes('Combe Noire PCA'), 'dossier PCA toujours listé');
        await p.locator('div.cursor-pointer:visible', { hasText: 'Gouffre de la Combe Noire' }).first().click();
        await b('Rouvrir ce dossier').click(); await attendre(1000);
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer', { dernier: true }).click(); await attendre(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill(SECRETAIRE_2); await b(/^✓ Enregistrer$/).click(); }
        await viderMsgs();
        await b('Liste des sauveteurs').click();
        await p.locator('button[title="Supprimer tous les sauveteurs de la liste"]').click(); await attendre(600);
        await msgContient('');
        await fermer();
    });

    ecrireRapport();
    await app.close().catch(() => {});
    try { fs.rmSync(donnees, { recursive: true, force: true }); } catch (e) { /* verrouillé */ }
})().catch(e => { console.error('ERREUR', e); ecrireRapport(); process.exitCode = 1; });