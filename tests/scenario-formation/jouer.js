// ============================================
// SCÉNARIO DE FORMATION : vérification sur l'application
// ============================================
// Joue, étape par étape, le « Scénario de formation des gestionnaires SSF » (document Claude,
// export docs/Scenario_Formation_Gestionnaires_SSF.docx) sur la vraie application, avec un
// dossier de données jetable. Chaque étape est contrôlée ; une étape en échec est notée avec
// une capture d'écran et le jeu continue. L'horloge de la page est accélérée pour les rappels.
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
const CSV = `ID;Nom Prénom;Rôle;SSF
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
`;
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
    const ligne = async ({ texte: t = '', equipe, venant, dest, pp, sens, depart, lieu, important, rappel, fichier, categorie } = {}) => {
        if (dest) await p.locator('input[list="destinataires-list"]:visible').fill(dest);
        if (venant) await p.locator('input[list="expediteurs-list"]:visible').fill(venant);
        if (equipe) await p.locator('input[list="equipe-list"]:visible').fill(equipe);
        if (depart) { await lab('🚀 Départ PC').click(); if (lieu) await p.locator(`label[title^="${lieu}"]:visible`).click(); }
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
        const h = p.locator('h3:visible', { hasText: /Mise à jour planning|Qui est au point phone/ });
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
    const ouvrirListe = () => ouvrir('Gestion Liste Préfectorale', 'Liste Préfectorale');
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
    const secretaire = async (nom) => {
        await p.locator('button[title="Changer de secrétaire"], button[title="Définir le secrétaire"]').first().click();
        await champ('Ex: Martin DUPONT').fill(nom);
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
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill('Stagiaire UN'); await b(/^✓ Enregistrer$/).click(); }
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

    const PP = { F: 'F - Parking — Poste médical avancé', A: 'A - Entrée de la cavité', B: 'B - Tête du P40', C: 'C - Base du P40', D: 'D - Salle du Chaos', E: 'E - Point victime', G: 'G - Hôpital de Pontarlier' };

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
    await etape('1.0:14', 'Secrétaire du poste (🔄) + message de confirmation', async () => {
        await viderMsgs();
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill('Stagiaire UN'); await b(/^✓ Enregistrer$/).click(); await attendre(400); }
        await secretaire('Stagiaire UN');
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
    await etape('1.0:20', 'Ligne CODIS : Important, catégorie auto Secours', async () => {
        await champ('Description...').fill('Message du CODIS : spéléologue bloqué à moins 150 m, au-delà du puits P40, jambe blessée. Victime : Lucas FAIVRE, 34 ans.');
        await attendre(300);
        const c = await categorieForm();
        await lab('⚠️ Important').locator('input').check();
        await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
        verifier(c === 'secours', `catégorie détectée : ${c}`);
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
    await etape('2.0:30', 'Import CSV : 16 sauveteurs', async () => {
        await viderMsgs();
        await ouvrirListe();
        await p.locator('input[type="file"][accept*=".csv"]').setInputFiles(FICHIER_CSV);
        await attendre(800);
        await msgContient('16 sauveteur');
    });
    await etape('2.0:32', 'Recherche rapide et tri', async () => {
        await ouvrirListe();
        await champ('🔍 Recherche rapide...').fill('mor');
        await attendre(800);
        const lignes = await modale().locator('tbody tr').allInnerTexts();
        await champ('🔍 Recherche rapide...').fill('');
        verifier(lignes.some(l => l.includes('MOREAU')), `recherche « mor » : MOREAU absent`);
        if (lignes.length > 1) remarques.push(`2.0:32 : la recherche « mor » donne ${lignes.length} lignes : ${lignes.map(l => l.replace(/\s+/g, ' ').slice(0, 40)).join(' / ')}`);
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
    await etape('2.0:35', 'Supprimer LEROY Hugo → 15', async () => {
        await ouvrirListe();
        await p.locator('table:visible tbody tr', { hasText: 'LEROY' }).locator('button[title="Supprimer"]').click(); await attendre(400);
        const n = await modale().locator('tbody tr').count();
        verifier(n === 15, `liste : ${n} lignes`);
    });
    await etape('2.0:36', 'Sauveteur hors liste BLANC Olivier, ID EXT-…', async () => {
        await ouvrirListe();
        await champ('NOM').fill('BLANC'); await champ('Prénom').fill('Olivier'); await champ('Rôle').fill('Sauveteur montagne'); await champ('SSF / Service').fill('CRS');
        await b('+ Ajouter').click(); await attendre(400);
        const tr = await p.locator('table:visible tbody tr', { hasText: 'BLANC' }).innerText();
        verifier(/EXT-\d+/.test(tr), `ID de BLANC : ${tr}`);
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
    const vague1 = ['GIRARD Antoine', 'MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'ROBERT Emma', 'PETIT Félix', 'DURAND Gaëlle', 'MOREAU Inès', 'SIMON Julien', 'ROUX Pierre', 'BLANC Olivier'];
    await etape('2.0:39', 'Arrivée des 11 (recherche dans la fenêtre)', async () => {
        await ouvrirEnregistrement();
        await champ('🔍 Rechercher...').fill('gir'); await attendre(200); await champ('🔍 Rechercher...').fill('');
        for (const n of vague1) await p.locator('label:visible', { hasText: n }).first().locator('input').check();
        await b('Arrivée (11)').click(); await attendre(500);
    });
    await etape('2.0:43', 'N° de planning de MARTIN Alice', async () => {
        await ouvrirEnregistrement();
        const t = await p.locator('label:visible', { hasText: 'MARTIN Alice' }).last().innerText();
        verifier(/N°\d+/.test(t), `n° absent : ${t}`);
        await fermer();
    });
    await etape('2.0:44', 'Ligne « Arrivée de : … » (Système)', async () => { await contient('Arrivée de :'); });
    await etape('2.0:45', 'Planning : arrivés en Disponible', async () => { await attendreActivite('MARTIN Alice', 'Disponible'); });
    await etape('2.0:47', 'Ligne GIRARD, catégorie Personnel à la main', async () => {
        await champ('Description...').fill('GIRARD Antoine prend la direction des opérations souterraines.');
        await attendre(300);
        const c = await categorieForm();
        await p.locator('select:visible', { has: p.locator('option[value="progression"]') }).first().selectOption('personnel');
        await b(/^✓ ENREGISTRER$/).click(); await attendre(600);
        verifier(c === 'autre', `catégorie avant choix : ${c} (le scénario dit « reste Autre »)`);
    });

    // ══ PHASE 3 ══════════════════════════════════════════════════════════
    const POINTS = [['F', 'Parking — Poste médical avancé', '🌿 Surface', '1'], ['A', 'Entrée de la cavité', '🚪 Entrée cavité', '2'], ['B', 'Tête du P40', '🪨 Sous terre', '3'],
        ['C', 'Base du P40', '🪨 Sous terre', '4'], ['D', 'Salle du Chaos', '🪨 Sous terre', '5'], ['E', 'Point victime', '🪨 Sous terre', '6'], ['G', 'Hôpital de Pontarlier', '🚗 Hors site', '7']];
    await etape('3.0:50', 'Créer les 7 points phones (lettre, nom, type, position)', async () => {
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
    await etape('3.0:56', 'Modifier D → Salle du Chaos amont', async () => {
        await modifierPoint('Salle du Chaos', 'Salle du Chaos amont');
        verifier((await modale().innerText()).includes('Salle du Chaos amont'), 'nom non modifié');
        await fermer();
    });
    PP.D = 'D - Salle du Chaos amont';
    await etape('3.0:58', 'Équipe 1 : N°1, type Reconnaissance détecté, chef MARTIN', async () => {
        await equipes();
        await creerEquipe({ lieu: '🪨 Sous terre', titre: 'Reconnaissance jusqu\'à la victime', ordre: 'Descendre jusqu\'au point victime, faire le bilan, rendre compte par TPS à chaque point phone.', membres: ['MARTIN Alice', 'BERNARD Bruno', 'ROBERT Emma'], typeAttendu: 'Reconnaissance' });
        await contient('Équipe 1');
    });
    await etape('3.1:02', 'Équipe 2 : N°2 proposé, type ASV détecté', async () => {
        await equipes();
        const num = await p.locator('select:visible').filter({ has: p.locator('option', { hasText: 'déjà utilisé' }) }).first().inputValue();
        verifier(num === '2', `numéro proposé : ${num}`);
        await creerEquipe({ lieu: '🪨 Sous terre', titre: 'ASV et médicalisation de la victime', membres: ['DUBOIS Chloé', 'DURAND Gaëlle', 'PETIT Félix'], typeAttendu: 'ASV' });
    });
    await etape('3.1:04', 'Équipe 3 : BERNARD « déjà en Équipe 1 » → Annuler', async () => {
        await equipes();
        await viderMsgs();
        await lab('🪨 Sous terre').click();
        await champ('Titre (ex: Reconnaissance Zone Nord)').fill('Transmission, pose du TPS jusqu\'à la Salle du Chaos');
        const choix = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
        const val = await choix.inputValue();
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
    await etape('3.1:06', 'Équipe 4 surface, type Logistique', async () => {
        await equipes();
        await creerEquipe({ lieu: '🌿 Surface', titre: 'Logistique, acheminement du matériel en surface', membres: ['ROUX Pierre', 'BLANC Olivier'], typeAttendu: 'Logistique' });
    });
    await etape('3.1:08', 'En-tête équipe 1 (chef, nombre) et dépliage', async () => {
        await equipes();
        const t = (await carte('Équipe 1').innerText()).replace(/\s+/g, ' ');
        verifier(t.includes('3 mbr'), `en-tête : ${t.slice(0, 120)}`);
        if (!t.includes('👑')) remarques.push("3.1:08 : le badge « 👑 chef » de l'en-tête des équipes ne s'affiche jamais (classe CSS sm:inline-flex absente de la feuille compilée) ; le chef se voit en dépliant l'équipe (badge CHEF).");
        await deplier('Équipe 1');
        verifier((await carte('Équipe 1').innerText()).includes('CHEF'), 'badge CHEF absent après dépliage');
    });
    await etape('3.1:09', 'Imprimer la fiche de l\'équipe 1', async () => {
        await equipes();
        const avant = app.windows().length;
        await carte('Équipe 1').locator('button[title="Imprimer"]').click(); await attendre(1500);
        const fen = app.windows().slice(avant);
        verifier(fen.length > 0, 'aucune fenêtre d\'impression');
        const contenu = await fen[0].evaluate(() => document.body.innerText).catch(() => '');
        await fen[0].close().catch(() => {});
        verifier(contenu.includes('Ordre de mission'), 'fiche sans ordre de mission');
    });
    await etape('3.1:11', 'Export PDF et Excel des équipes', async () => {
        await equipes();
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await b('📄 Export PDF').click(); await attendre(1500);
        await b('📊 Export Excel').click(); await attendre(1500);
        const n = fs.readdirSync(TELECHARGEMENTS).length - avant;
        verifier(n === 2, `${n} fichier(s) téléchargé(s)`);
        await fermer();
    });
    await etape('3.1:13', 'Lignes de création + planning Engagé', async () => {
        await contient('Équipe 4');
        await attendreActivite('ROUX Pierre', 'Engagé');
    });

    // ══ PHASE 4 ══════════════════════════════════════════════════════════
    await etape('4.1:15', 'Équipe 1 Départ PC sous terre → fenêtre planning Approche', async () => {
        await ligne({ equipe: 'Équipe 1', depart: true, lieu: 'Sous terre' });
        await fenetrePlanning({ titre: 'approche' });
        await attendreActivite('MARTIN Alice', 'Approche');
    });
    await etape('4.1:18', 'Venant de MARTIN (équipe auto), A, Entre sous terre', async () => {
        await p.locator('input[list="expediteurs-list"]:visible').fill('MARTIN Alice');
        const eq = await p.locator('input[list="equipe-list"]:visible').inputValue();
        await ligne({ pp: PP.A, sens: '🪨 Entre sous terre', texte: 'Équipe 1 à l\'entrée, on entre.' });
        await fenetrePlanning({ titre: 'souterre' });
        verifier(eq === 'Équipe 1', `équipe remplie seule : « ${eq} »`);
        await attendreActivite('ROBERT Emma', 'Sous Terre');
    });
    await etape('4.1:21', 'Équipe 3 Départ PC puis « Au point phone » A, seule MOREAU', async () => {
        await ligne({ equipe: 'Équipe 3', depart: true, lieu: 'Sous terre' });
        await fenetrePlanning();
        await ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '📍 Au point phone', texte: 'Seule MOREAU Inès s\'arrête pour poser le TPS.' });
        const t = await fenetrePlanning({ toute: false, garder: ['MOREAU Inès'] });
        verifier(t.includes('Qui est au point phone'), `fenêtre : ${t}`);
    });
    await etape('4.1:24', 'MARTIN en tête du P40 (B)', async () => {
        await ligne({ venant: 'MARTIN Alice', pp: PP.B, texte: 'Équipe 1 en tête du P40, RAS.' });
        await fenetrePlanning();
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
    await etape('4.1:28', 'Message à destination de MARTIN → Communication', async () => {
        await p.locator('input[list="destinataires-list"]:visible').fill('MARTIN Alice');
        await champ('Description...').fill('Rendez compte dès votre arrivée au point E.');
        await attendre(300);
        const c = await categorieForm();
        await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
        verifier(c === 'communication', `catégorie : ${c}`);
    });
    let rappelSamu;
    await etape('4.1:30', 'Rappel SAMU à +30 min → PROGRAMMÉE', async () => {
        rappelSamu = (await maintenant()) + 30 * 60000;
        await ligne({ texte: 'Le SAMU demande un bilan médical dans 30 minutes.', rappel: rappelSamu });
        verifier((await derniereLigne()).includes('PROGRAMMÉE'), 'statut PROGRAMMÉE absent');
    });
    await etape('4.1:32', 'Rappel famille à +3 min → URGENT, fenêtre d\'alertes, Report 5 mn', async () => {
        await ligne({ texte: 'Rappeler la famille de la victime.', rappel: (await maintenant()) + 3 * 60000 });
        verifier((await derniereLigne()).includes('URGENT'), 'statut URGENT absent');
        await avancer(1);
        await p.locator('h3:visible', { hasText: 'Alertes en attente' }).waitFor({ timeout: 8000 });
        await b('Report 5 mn').click(); await attendre(500);
    });
    await etape('4.1:35', 'Pièce jointe croquis, téléchargement', async () => {
        await ligne({ texte: 'Croquis du P40 reçu.', fichier: CROQUIS });
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await p.locator('table tbody tr').first().locator('button[title^="Télécharger"]').click(); await attendre(1200);
        verifier(fs.readdirSync(TELECHARGEMENTS).length === avant + 1, 'pièce jointe non téléchargée');
    });
    await etape('4.1:37', 'Arrivée de la 2e vague (5)', async () => {
        await b('Enregistrement des sauveteurs').click();
        for (const n of ['THOMAS David', 'LAURENT Karine', 'LEFEBVRE Léo', 'MICHEL Manon', 'GARCIA Nora']) await p.locator('label:visible', { hasText: n }).first().locator('input').check();
        await b('Arrivée (5)').click(); await attendre(400); await fermer();
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
    await etape('4.1:46', 'Changer de secrétaire (relève)', async () => {
        await secretaire('Stagiaire DEUX');
        await ligne({ texte: 'Relève du secrétaire.' });
        verifier((await derniereLigne()).includes('Stagiaire DEUX'), 'nouvelle ligne pas au nom du nouveau secrétaire');
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
    await etape('5.2:05', 'Alerte SAMU : × puis revient, ✓ Valider dans le tableau', async () => {
        // Avancer jusqu'à l'échéance du rappel (statut URGENT ou DÉPASSÉE), sans aucune action,
        // puis laisser passer la vérification périodique (30 s) : la fenêtre doit s'ouvrir seule
        const ligneSamu = p.locator('table tbody tr', { hasText: 'Le SAMU demande un bilan' }).filter({ hasNotText: 'Rappel N°' }).first();
        for (let i = 0; i < 40 && !/URGENT|DÉPASSÉE/.test(await ligneSamu.innerText()); i++) { await p.clock.fastForward(60000); await attendre(300); }
        for (let i = 0; i < 3 && !(await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()); i++) { await p.clock.fastForward(31000); await attendre(800); }
        if (!(await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count())) {
            await p.screenshot({ path: path.join(SORTIE, 'diag-5_2_05.png') }).catch(() => {});
            const etat = (await ligneSamu.innerText()).replace(/\s+/g, ' ').slice(0, 200);
            const heure = await p.evaluate(() => new Date().toLocaleString('fr-FR'));
            remarques.push(`5.2:05 : à l'échéance du rappel SAMU, la fenêtre d'alertes ne s'ouvre pas seule (heure ${heure} ; ligne : ${etat}) ; elle apparaît à la ligne de main courante suivante.`);
            await ligne({ texte: 'Point de situation après la pause.' });
        }
        await p.locator('h3:visible', { hasText: 'Alertes en attente' }).waitFor({ timeout: 20000 });
        await p.locator('button[title^="Fermer (réapparaîtra"]').click(); await attendre(800);
        if (await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()) remarques.push("5.2:05 : le bouton « × » de la fenêtre d'alertes (« Fermer (réapparaîtra dans 30 secondes) ») ne ferme pas la fenêtre : elle reste à l'écran.");
        await avancer(1);
        await p.locator('h3:visible', { hasText: 'Alertes en attente' }).waitFor({ timeout: 20000 });
        const samu = p.locator('table tbody tr', { hasText: 'Le SAMU demande un bilan' }).filter({ hasNotText: 'Rappel N°' }).first();
        await samu.locator('button', { hasText: '✓ Valider' }).click(); await attendre(600);
        verifier((await samu.innerText()).includes('RÉALISÉE'), 'rappel SAMU non réalisé');
    });
    await etape('5.2:07', 'Équipe 2 Départ PC, entre sous terre', async () => {
        await ligne({ equipe: 'Équipe 2', depart: true, lieu: 'Sous terre' }); await fenetrePlanning();
        await ligne({ equipe: 'Équipe 2', pp: PP.A, sens: '🪨 Entre sous terre' }); await fenetrePlanning();
    });
    await etape('5.2:09', 'Scinder équipe 2 → 2B (PETIT seul)', async () => {
        await equipes(); await deplier('Équipe 2');
        await carte('Équipe 2').locator('button', { hasText: '✂️ Scinder' }).click();
        await p.locator('label:visible', { hasText: 'DURAND Gaëlle' }).last().locator('input').uncheck();
        await b('Créer Équipe 2B').click(); await attendre(600);
        await fermer();
        await contient('Scission Équipe 2 → Équipe 2B');
        await contient('Position initiale Équipe 2B');
    });
    await etape('5.2:12', 'THOMAS rejoint l\'équipe 1 (Ajouter des membres)', async () => {
        await equipes(); await deplier('Équipe 1');
        await carte('Équipe 1').locator('button', { hasText: 'Ajouter des Membres' }).click();
        await p.locator('div.bg-emerald-50:visible label', { hasText: 'THOMAS David' }).locator('input').check();
        await b(/Ajouter \(1\) membre/).click(); await attendre(500);
        verifier((await carte('Équipe 1').innerText()).includes('THOMAS David'), 'THOMAS absent de l\'équipe 1');
    });
    await etape('5.2:14', 'Mouvement BERNARD → T3', async () => {
        await deplier('Équipe 1');
        const l = carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'BERNARD Bruno' });
        await l.locator('input[placeholder="ID Équipe / PC"]').fill('T3');
        await l.locator('button', { hasText: 'Déplacer' }).click(); await attendre(500);
        await deplier('Équipe 3');
        verifier((await carte('Équipe 3').innerText()).includes('BERNARD Bruno'), 'BERNARD absent de l\'équipe 3');
    });
    await etape('5.2:15', 'ROBERT libérée au PC', async () => {
        await viderMsgs();
        await deplier('Équipe 1');
        const l = carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'ROBERT Emma' });
        await l.locator('input[placeholder="ID Équipe / PC"]').fill('PC');
        await l.locator('button', { hasText: 'Déplacer' }).click(); await attendre(500);
        await msgContient('Membre libéré au PC');
    });
    await etape('5.2:17', 'SIMON chef de l\'équipe 3 (glisser-déposer)', async () => {
        await deplier('Équipe 3');
        const membres = carte('Équipe 3').locator('div[draggable="true"]');
        const simon = membres.filter({ hasText: 'SIMON Julien' });
        await simon.dragTo(membres.first()); await attendre(500);
        const premier = await carte('Équipe 3').locator('div[draggable="true"]').first().innerText();
        verifier(premier.includes('SIMON') && premier.includes('CHEF'), `en tête : ${premier}`);
    });
    await etape('5.2:18', 'Modifier titre et ordre de mission de l\'équipe 3', async () => {
        await carte('Équipe 3').locator('div[title="Cliquer pour modifier"]').click(); await attendre(300);
        await champ('Titre (ex: Reconnaissance Zone Nord)').fill('Transmission jusqu\'au point victime');
        await champ('Détaillez précisément ce que l\'équipe doit faire...').fill('Prolonger le TPS jusqu\'au point victime.');
        await b('Sauvegarder les modifications').click(); await attendre(500);
        await fermer();
        await contient('Transmission jusqu\'au point victime');
    });
    await etape('5.2:20', 'Point H depuis ⚙️ du formulaire, Pos 4.5', async () => {
        await p.locator('button[title="Gérer les points phone"]').click();
        await p.locator('div.flex.gap-2:visible', { has: p.locator('input[placeholder="Pos."]') }).locator('select').selectOption('H');
        await champ('Ex: Base du P80, Poste médical...').fill('Étroiture');
        await champ('Pos.').fill('4.5');
        await lab('🪨 Sous terre').click();
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
    });
    await etape('5.2:23', 'Équipe 2B sort et rentre au PC (Approche), puis revient au PC (Disponible)', async () => {
        await ligne({ equipe: 'Équipe 2B', pp: PP.A, sens: '🏠 Sort — rentre au PC', texte: 'L\'équipe 2B est sortie de la cavité.' });
        await fenetrePlanning({ titre: 'approche' });
        await ligne({ equipe: 'Équipe 2B', pp: 'PC - Poste de Commandement', texte: 'L\'équipe 2B revient au PC.' });
        await fenetrePlanning({ titre: 'disponible' });
        await attendreActivite('PETIT Félix', 'Disponible');
    });
    await etape('5.2:25', 'Équipe 3 sort et reste à l\'entrée (Mission de surface)', async () => {
        await ligne({ equipe: 'Équipe 3', pp: PP.A, sens: '🌿 Sort — reste entrée' });
        await fenetrePlanning({ titre: 'mission_surface' });
    });
    await etape('5.2:26', 'Équipe 5 hors site, Départ PC 🚗', async () => {
        await equipes();
        await creerEquipe({ lieu: '🚗 Hors site', titre: 'Chercher la civière au dépôt de Besançon', membres: ['LEFEBVRE Léo', 'MICHEL Manon'] });
        await fermer();
        await ligne({ equipe: 'Équipe 5', depart: true, lieu: 'Hors site' });
        await fenetrePlanning({ titre: 'mission_hors_site' });
    });
    await etape('5.2:29', 'Fin de mission équipe 4 → dissoute, Disponible', async () => {
        await equipes(); await deplier('Équipe 4');
        await carte('Équipe 4').locator('button', { hasText: 'Fin de mission' }).click(); await attendre(500);
        await contient('Équipes Dissoutes');
    });
    await etape('5.2:31', 'Réactiver équipe 4, fin de mission 2B', async () => {
        await p.locator('div.bg-white:visible', { hasText: 'DISSOUTE' }).filter({ hasText: 'Équipe 4' }).locator('button', { hasText: 'Réactiver' }).click(); await attendre(500);
        await deplier('Équipe 2B');
        await carte('Équipe 2B').locator('button', { hasText: 'Fin de mission' }).click(); await attendre(500);
        await fermer();
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
    await etape('6.2:35', 'Activer le mode réseau (adresse, code)', async () => {
        while (await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()) { await p.locator('div.border-red-300:visible button', { hasText: '✓ Traité' }).first().click(); await attendre(500); }
        await b('🌐 Mode réseau').click();
        await b('Activer le mode réseau').click(); await attendre(1500);
        adresse = await p.locator('span.font-mono.text-xl').first().innerText();
        code = await p.locator('span.font-mono.text-2xl').first().innerText();
        verifier(/^http:\/\//.test(adresse) && /^\d{6}$/.test(code), `adresse ${adresse}, code ${code}`);
        if (!(await texte()).includes('Pare-feu')) remarques.push('6.2:35 : pas de mention du pare-feu en test (pare-feu désactivé avec des données jetables) — non vérifiable ici, vérifié lors des essais réels.');
    });
    await etape('6.2:38', 'Connexion d\'une tablette (code), nom de secrétaire', async () => {
        const donneesT = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-scenario-tab-'));
        const nav = await electron.launch({ args: [NAVIGATEUR], env: { ...process.env, SSF_TEST_USER_DATA: donneesT, SSF_URL: adresse + '/', SSF_TAILLE: '768x1000' } });
        postes.push(nav);
        tab = await nav.firstWindow();
        await nav.context().addInitScript(espion);
        await tab.reload();
        await tab.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await tab.locator('input[placeholder="000000"]').fill(code);
        await tab.locator('button:visible', { hasText: 'Se connecter' }).click(); await tab.waitForTimeout(2500);
        await tab.locator('button:visible', { hasText: /^🔄$/ }).first().click();
        await tab.locator('input[placeholder="Ex: Martin DUPONT"]:visible').fill('Assistant TABLETTE');
        await tab.locator('button:visible', { hasText: /^✓ Enregistrer$/ }).click(); await tab.waitForTimeout(500);
        const t = await tab.evaluate(() => document.body.innerText);
        verifier(t.includes('Connecté au poste principal'), 'bandeau « Connecté au poste principal » absent');
    });
    await etape('6.2:40', 'Tablette en consultation : saisie refusée', async () => {
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('Essai de saisie en consultation.');
        await tab.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click(); await tab.waitForTimeout(1500);
        const t = await p.evaluate(() => document.body.innerText);
        verifier(!t.includes('Essai de saisie en consultation'), 'ligne enregistrée malgré la consultation');
    });
    await etape('6.2:41', 'Rôle Saisie donné à la tablette', async () => {
        if (!(await p.locator('h2:visible', { hasText: 'Mode réseau' }).count())) await b('🌐 Mode réseau').click();
        await attendre(500);
        const l = p.locator('tr:visible').filter({ has: p.locator('select') }).last();
        await l.locator('select').selectOption('saisie'); await attendre(800);
    });
    await etape('6.2:42', 'Saisie depuis la tablette, « 📡 Saisie sur … » sur le PC', async () => {
        await tab.locator('input[list="equipe-list"]:visible').fill('Équipe 1');
        await tab.locator('input[list="pointsphone-list"]:visible').fill(PP.E);
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('De MARTIN : équipe 1 au point victime, bilan en cours.');
        await tab.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click(); await tab.waitForTimeout(2000);
        const mod = tab.locator('h3:visible', { hasText: /Mise à jour planning|Qui est au point phone/ });
        if (await mod.count()) await tab.locator('button:visible', { hasText: 'Valider (' }).click();
        await b(/^Fermer$/, { dernier: true }).click().catch(() => {});
        await attendre(800);
        await contient('équipe 1 au point victime');
        await contient('📡 Saisie sur');
    });
    await etape('6.2:44', 'Saisie simultanée : deux numéros distincts', async () => {
        await champ('Description...').fill('Top PC.');
        await tab.locator('textarea[placeholder="Description..."]:visible').fill('Top tablette.');
        await Promise.all([b(/^✓ ENREGISTRER$/).click(), tab.locator('button:visible', { hasText: /^✓ ENREGISTRER$/ }).click()]);
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
    await etape('6.2:46', 'Tablette : clôture et import refusés', async () => {
        const t = await tab.evaluate(() => document.body.innerText);
        const cloture = await tab.locator('button:visible', { hasText: 'Clôturer le secours' }).count();
        if (cloture) {
            await tab.locator('button:visible', { hasText: 'Clôturer le secours' }).click();
            await tab.locator('button:visible', { hasText: 'Heure actuelle' }).click().catch(() => {});
            await tab.waitForTimeout(1500);
            const tp = await p.evaluate(() => document.body.innerText);
            verifier(!tp.includes('CLÔTURÉ'), 'secours clôturé depuis la tablette !');
            const m = await tab.evaluate(() => window.__msgs.concat([document.body.innerText]).join(' '));
            verifier(/réservée|principal/i.test(m), 'pas de message de refus visible sur la tablette');
        } else {
            verifier(true, '');
            console.log('   (bouton Clôturer absent sur la tablette)', t.includes('Importer Tout') ? '— Importer Tout présent' : '');
        }
    });
    await etape('6.2:47', 'Case « Autoriser la saisie sur les autres postes »', async () => {
        await b('🌐 Mode réseau').click();
        await lab('Autoriser la saisie sur les autres postes').locator('input').check(); await attendre(500);
        await lab('Autoriser la saisie sur les autres postes').locator('input').uncheck(); await attendre(300);
    });
    await etape('6.2:49', 'Changer le code : la tablette redemande le code', async () => {
        await b('Changer le code').click(); await attendre(2000);
        const nouveau = await p.locator('span.font-mono.text-2xl').first().innerText();
        verifier(nouveau !== code, 'code inchangé');
        await tab.locator('input[placeholder="000000"]').waitFor({ timeout: 8000 });
        await tab.locator('input[placeholder="000000"]').fill(nouveau);
        await tab.locator('button:visible', { hasText: 'Se connecter' }).click(); await tab.waitForTimeout(2500);
        code = nouveau;
    });
    await etape('6.2:51', 'Perte de liaison : « Connexion perdue », copie de secours, reconnexion', async () => {
        await b(/^Désactiver$/).click(); await attendre(2000);
        let t = await tab.evaluate(() => document.body.innerText);
        verifier(/Connexion perdue/i.test(t), 'bandeau « Connexion perdue » absent');
        verifier(t.includes('Copie de secours'), 'bouton Copie de secours absent');
        await b('Activer le mode réseau').click();
        await tab.waitForTimeout(12000);
        t = await tab.evaluate(() => document.body.innerText);
        verifier(t.includes('Connecté au poste principal') || t.includes('000000') || await tab.locator('input[placeholder="000000"]').count() > 0, 'pas de reconnexion');
    });
    await etape('6.2:55', 'Désactiver le mode réseau', async () => {
        await b(/^Désactiver$/).click(); await attendre(800);
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
    await etape('7.3:01', 'Jours : 2', async () => { await p.locator('input[type="number"]:visible').fill('2'); await attendre(300); });
    await etape('7.3:02', 'Tri par nom', async () => { await p.locator('[title="Cliquer pour trier"]').first().click(); await attendre(300); });
    const cases = (nom) => p.locator('tr', { hasText: nom }).locator('td.time-slot-cell');
    const caseActuelle = async (nom) => cases(nom).evaluateAll(tds => { const vide = td => /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(getComputedStyle(td).backgroundColor); let i = tds.length - 1; while (i > 0 && vide(tds[i])) i--; return i; });
    const deplacerPalette = async () => { const ti = await p.locator('#palette-title').boundingBox(); await p.mouse.move(ti.x + 20, ti.y + 8); await p.mouse.down(); await p.mouse.move(80, 700, { steps: 8 }); await p.mouse.up(); };
    await etape('7.3:12', 'Palette déplaçable', async () => { await deplacerPalette(); });
    await etape('7.3:03', 'GIRARD : Directeur Secours Souterrain + ligne', async () => {
        const i = await caseActuelle('GIRARD Antoine');
        await cases('GIRARD Antoine').nth(Math.max(0, i - 2)).hover(); await p.mouse.down(); await cases('GIRARD Antoine').nth(i).hover(); await p.mouse.up();
        await b('Directeur Secours Souterrain').click(); await attendre(500);
        await onglet('Main Courante');
        await contient('Directeur Secours Souterrain');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:05', 'ROBERT et PETIT : Repas', async () => {
        for (const n of ['ROBERT Emma', 'PETIT Félix']) {
            const i = await caseActuelle(n);
            await cases(n).nth(i).click({ modifiers: n === 'PETIT Félix' ? ['Control'] : [] });
        }
        await b('Repas - Déjeuner').click(); await attendre(500);
        await onglet('Main Courante');
        await contient('Repas - Déjeuner');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:06', 'ROUX et BLANC : Repos sur site, 4h, rappel 30 min', async () => {
        for (const n of ['ROUX Pierre', 'BLANC Olivier']) {
            const i = await caseActuelle(n);
            await cases(n).nth(i).click({ modifiers: n === 'BLANC Olivier' ? ['Control'] : [] });
        }
        await b('Repos sur site').click(); await attendre(500);
        await p.locator('h3:visible', { hasText: 'Durée du repos' }).waitFor({ timeout: 4000 });
        await b(/^4h$/).click(); await b(/^30min$/).click();
        await b('✓ Valider', { dernier: true }).click(); await attendre(600);
        await contient('Rappel 30min avant');
        await onglet('Planning Opérationnel');
    });
    await etape('7.3:08', 'LAURENT : Brancardage refusé (pas d\'équipe)', async () => {
        await viderMsgs();
        const i = await caseActuelle('LAURENT Karine');
        await cases('LAURENT Karine').nth(i).click();
        await b('Brancardage').click(); await attendre(400);
        await msgContient('activité d\'équipe');
    });
    await etape('7.3:09', 'DUBOIS : poignée de recopie sur 4 cases', async () => {
        const i = await caseActuelle('DUBOIS Chloé');
        await cases('DUBOIS Chloé').nth(i).click(); await attendre(200);
        const poignee = p.locator('.fill-handle');
        verifier(await poignee.count() > 0, 'poignée de recopie absente');
        await poignee.first().hover(); await p.mouse.down(); await cases('DUBOIS Chloé').nth(i + 4).hover({ force: true }); await p.mouse.up(); await attendre(400);
        const j = await caseActuelle('DUBOIS Chloé');
        verifier(j >= i + 3, `recopie : dernière case ${j}, départ ${i}`);
    });
    await etape('7.3:10', 'Effacer les 2 dernières cases', async () => {
        const j = await caseActuelle('DUBOIS Chloé');
        await cases('DUBOIS Chloé').nth(j - 1).hover(); await p.mouse.down(); await cases('DUBOIS Chloé').nth(j).hover(); await p.mouse.up();
        await b('Efface l\'activité').click(); await attendre(400);
        const k = await caseActuelle('DUBOIS Chloé');
        verifier(k <= j - 2, `effacement : ${j} → ${k}`);
    });
    await etape('7.3:11', 'Mettre à jour les activités (confirmation)', async () => {
        await avancer(20);
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
    await etape('7.3:13', 'Synthèse : heure de référence, sélection, impression', async () => {
        await viderMsgs();
        await onglet('Synthèse Affectations');
        await p.locator('button[title="Reculer d\'une heure"]').click();
        await p.locator('button[title="Avancer d\'une heure"]').click();
        await b('Tout désélectionner').click();
        await lab('Sous Terre').locator('input').check();
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
    await etape('7.3:21', 'Progression des équipes : zoom, filtre, historique', async () => {
        await onglet('Progression Équipes');
        await p.locator('button[title="Agrandir"]').click(); await p.locator('button[title="Réduire"]').click(); await p.locator('button[title="Réinitialiser"]').click();
        await contient('Historique des localisations');
        await onglet('Main Courante');
    });

    // ══ PHASE 8 ══════════════════════════════════════════════════════════
    await etape('8.3:25', 'Victime sortie (F) puis évacuée (G), catégorie Secours', async () => {
        await champ('Description...').fill('La victime est sortie de la cavité, prise en charge au poste médical avancé.');
        await p.locator('input[list="pointsphone-list"]:visible').fill(PP.F);
        await attendre(300);
        const c = await categorieForm();
        await lab('⚠️ Important').locator('input').check();
        await b(/^✓ ENREGISTRER$/).click(); await attendre(600);
        await ligne({ texte: 'Victime évacuée vers l\'hôpital de Pontarlier.', pp: PP.G, important: true });
        verifier(c === 'secours', `catégorie : ${c}`);
    });
    const exporter = async () => { const avant = fs.readdirSync(TELECHARGEMENTS); await b('Exporter Tout').click(); await attendre(1500); return fs.readdirSync(TELECHARGEMENTS).filter(f => !avant.includes(f)); };
    let fichierExport;
    await etape('8.3:27', 'Exporter Tout', async () => { const n = await exporter(); verifier(n.length === 1, `${n.length} fichier(s)`); fichierExport = path.join(TELECHARGEMENTS, n[0]); });
    const idPrincipal = await p.locator('input[placeholder="Ex: GouffreA_2025"]').inputValue().catch(() => '');
    let fichierPCA;
    await etape('8.3:28', 'Relance, nouveau dossier PC Base Arrière PCA, recopie papier ROUX', async () => {
        await relancer();
        await ouvrirDossier({ cavite: 'Combe Noire PCA', commune: 'Nans-sous-Sainte-Anne', base: { id: 'PCA', auteur: 'ROUX Pierre' } });
        await contient('Recopie de la main courante papier rédigée par ROUX Pierre');
    });
    await etape('8.3:31', 'Trois lignes papier, rangement chronologique PCA-001', async () => {
        const lignesPapier = [[70, 'Route d\'accès fermée par la gendarmerie.'], [40, 'Véhicule du SSF 25 arrivé au parking.'], [110, 'Ambulance du SAMU arrivée au parking.']];
        let infos = [];
        for (const [min, txt] of lignesPapier) {
            const h = debutSeance + min * 60000;
            await p.locator('input[type="date"]:visible').first().fill(iso(h));
            await p.locator('input[type="time"]:visible').first().fill(hhmm(h));
            await champ('Description...').fill(txt);
            await b(/^✓ ENREGISTRER$/).click(); await attendre(700);
            infos.push(await p.locator('span.text-amber-800:visible').first().innerText().catch(() => ''));
        }
        verifier(infos[1].includes('rangée à sa place') && infos[1].includes('PCA-001'), `info 2e ligne : « ${infos[1]} »`);
    });
    await etape('8.3:35', 'Exporter Événements (SSF_Events_PCA_…)', async () => {
        const avant = fs.readdirSync(TELECHARGEMENTS);
        await b('Exporter Événements').click(); await attendre(1500);
        const n = fs.readdirSync(TELECHARGEMENTS).filter(f => !avant.includes(f));
        verifier(n.length === 1 && n[0].includes('SSF_Events_PCA'), `fichiers : ${n}`);
        fichierPCA = path.join(TELECHARGEMENTS, n[0]);
    });
    await etape('8.3:36', 'Relance, Rouvrir le dossier principal, PC de Terrain', async () => {
        await relancer();
        await b('Rouvrir un dossier').click(); await attendre(500);
        await contient('Combe Noire PCA');
        await p.locator('div.cursor-pointer:visible', { hasText: idPrincipal || 'Gouffre de la Combe Noire' }).first().click();
        await b('Rouvrir ce dossier').click(); await attendre(1000);
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer', { dernier: true }).click(); await attendre(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill('Stagiaire DEUX'); await b(/^✓ Enregistrer$/).click(); }
        await contient('Victime évacuée');
    });
    await etape('8.3:38', 'Importer MC (aperçu) : badges, fusion, lignes « 📝 papier »', async () => {
        await b('Importer MC (aperçu)').click();
        await p.locator('#mc-file-input').setInputFiles(fichierPCA); await attendre(800);
        await contient('Aperçu de la fusion chronologique');
        await b('Confirmer la Fusion').click(); await attendre(1000);
        await contient('📝 papier');
    });
    await etape('8.3:40', 'Importer Événements : confirmation puis Annuler', async () => {
        await viderMsgs(); await annulerProchaine();
        const n1 = await p.locator('table tbody tr').count();
        await p.locator('label', { hasText: 'Importer Événements' }).locator('input[type="file"]').setInputFiles(fichierPCA); await attendre(800);
        await msgContient('Importer 3 événement(s)');
        const n2 = await p.locator('table tbody tr').count();
        verifier(n1 === n2, `lignes : ${n1} → ${n2}`);
    });
    await etape('8.3:41', 'Sauvegardes : maintenant, Télécharger', async () => {
        await b('Sauvegardes auto').click();
        await b('Sauvegarder maintenant').click(); await attendre(800);
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await b('Télécharger').click(); await attendre(1200);
        verifier(fs.readdirSync(TELECHARGEMENTS).length === avant + 1, 'sauvegarde non téléchargée');
        await contient('Restaurer');
        await p.keyboard.press('Escape');
    });
    await etape('8.3:43', 'Exporter Tout puis Importer Tout : rien ne change', async () => {
        const n1 = await p.locator('table tbody tr').count();
        const f = await exporter();
        await viderMsgs();
        await p.locator('label', { hasText: 'Importer Tout' }).locator('input[type="file"]').setInputFiles(path.join(TELECHARGEMENTS, f[0])); await attendre(1500);
        await msgContient('écrasera');
        const n2 = await p.locator('table tbody tr').count();
        verifier(n1 === n2, `lignes : ${n1} → ${n2}`);
    });
    await etape('8.3:45', 'Clôture « Dernier événement + 5 min »', async () => {
        await b('Clôturer le secours').click();
        await b('Dernier événement + 5 min').click(); await attendre(1000);
        await contient('🔒 CLÔTURÉ');
        await contient('CLÔTURE DU SECOURS');
        verifier(await p.locator('input[placeholder="Ex: GouffreA_2025"]').isDisabled(), 'ID non verrouillé');
        verifier(!(await b('✏️ Modifier').count()), '« Modifier » encore visible');
    });
    await etape('8.3:46', 'Réouvrir, ligne, reclôturer à l\'heure actuelle', async () => {
        await b(/^Réouvrir$/).click(); await attendre(800);
        await ligne({ texte: 'Matériel récupéré et rangé.' });
        await b('Clôturer le secours').click();
        await b('Heure actuelle').click(); await attendre(800);
        await contient('🔒 CLÔTURÉ');
    });
    await etape('8.3:48', 'Rapport de fin de mission : aperçu, PDF, Excel', async () => {
        await onglet('Tableau de Bord');
        await b('Générer un Rapport').click(); await attendre(600);
        await contient('RAPPORT DE FIN DE MISSION');
        const avant = fs.readdirSync(TELECHARGEMENTS).length;
        await b('Exporter en PDF').click(); await attendre(1500);
        if (!(await b('Exporter en Excel').count())) { await b('Générer un Rapport').click(); await attendre(600); }
        await b('Exporter en Excel').click(); await attendre(1500);
        verifier(fs.readdirSync(TELECHARGEMENTS).length === avant + 2, 'rapport(s) non téléchargé(s)');
        await fermerTout();
        await onglet('Main Courante');
    });
    await etape('8.3:51', 'Archive finale (Exporter Tout)', async () => { const n = await exporter(); verifier(n.length === 1, 'pas de fichier'); });
    await etape('8.3:52', 'Mode maintenance : boutons visibles, non cliqués', async () => {
        await p.locator('#toggle-maintenance').check(); await attendre(200);
        verifier(await p.locator('button[title="Effacer les données du secours actuel uniquement"]').isVisible(), 'RESET APPLI absent');
        verifier(await p.locator('button[title="Vider TOUT le stockage du navigateur (tous les secours)"]').isVisible(), 'VIDER STORAGE absent');
        await p.locator('#toggle-maintenance').uncheck();
    });
    await etape('8.3:53', 'Relance, supprimer le dossier PCA, Tout supprimer (liste)', async () => {
        await relancer();
        await b('Rouvrir un dossier').click(); await attendre(500);
        await p.locator('div.cursor-pointer:visible', { hasText: 'Combe Noire PCA' }).locator('button', { hasText: 'Supprimer' }).click(); await attendre(800);
        verifier(!(await texte()).includes('Combe Noire PCA'), 'dossier PCA toujours listé');
        await p.locator('div.cursor-pointer:visible', { hasText: 'Gouffre de la Combe Noire' }).first().click();
        await b('Rouvrir ce dossier').click(); await attendre(1000);
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer', { dernier: true }).click(); await attendre(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await champ('Ex: Martin DUPONT').fill('Stagiaire DEUX'); await b(/^✓ Enregistrer$/).click(); }
        await viderMsgs();
        await b('Liste Préfectorale').click();
        await p.locator('button[title="Supprimer tous les sauveteurs de la liste"]').click(); await attendre(600);
        await msgContient('');
        await fermer();
    });

    ecrireRapport();
    await app.close().catch(() => {});
    try { fs.rmSync(donnees, { recursive: true, force: true }); } catch (e) { /* verrouillé */ }
})().catch(e => { console.error('ERREUR', e); ecrireRapport(); process.exitCode = 1; });