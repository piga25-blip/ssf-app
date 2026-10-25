// Captures d'écran du mode d'emploi (version 14) : un secours d'exemple est préparé comme
// pour les films, puis chaque écran décrit dans le mode d'emploi est photographié, sans les
// repères du tournage (curseur, messages).
// Utilisation : node tests/film/tutoriels/captures-mode-emploi.js
// Images : tests/film/sortie/mode-emploi/NN-nom.png
process.env.FILM_RAPIDE = '1';
const fs = require('fs');
const path = require('path');
const { executer } = require('./outils');
const P = require('./preparation');

const DOSSIER = path.join(__dirname, '..', 'sortie', 'mode-emploi');
fs.rmSync(DOSSIER, { recursive: true, force: true });
fs.mkdirSync(DOSSIER, { recursive: true });
const echecs = [];

executer('_captures-mode-emploi', 'captures', async (t) => {
    const p = t.page;
    let n = 0;
    // Photo de la fenêtre, repères du tournage masqués
    const photo = async (nom, page = p) => {
        n++;
        if (page === p) await sansToast();
        await page.addStyleTag({ content: '#__film_curseur,#__film_messages,.__film_message,.__film_onde,#__film_balise{display:none!important}' }).catch(() => {});
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(DOSSIER, `${String(n).padStart(2, '0')}-${nom}.png`) });
        console.log('📷 ' + nom);
    };
    // Une étape qui échoue n'arrête pas les suivantes
    const etape = async (nom, fn) => {
        await sansToast();
        try { await fn(); } catch (e) {
            echecs.push(nom); console.log(`❌ ${nom} : ${e.message.split('\n')[0]}`);
            await p.screenshot({ path: path.join(DOSSIER, `KO-${nom}.png`) }).catch(() => {});
        }
        await p.keyboard.press('Escape').catch(() => {});
    };
    // Messages passagers (« Planning mis à jour automatiquement »…) : l'horloge de la page est
    // arrêtée, ils ne disparaissent pas seuls et cacheraient les boutons du bas
    const sansToast = () => p.evaluate(() => document.querySelectorAll('body *').forEach(d => {
        if (getComputedStyle(d).position === 'fixed' && /mis à jour automatiquement/.test(d.innerText || '') && d.innerText.length < 200) d.style.display = 'none';
    })).catch(() => {});
    // Page défilée pour que le tableau de la main courante soit en haut de l'écran
    const voirTableauMC = () => p.evaluate(() => { const t = document.querySelector('table'); if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 70); });
    const fermer = async () => { const b = t.bouton(/^Fermer$/, { dernier: true }); if (await b.count()) await t.clic(b); };
    const enregistrer = async () => { await sansToast(); await t.clic(t.bouton(/^✓ ENREGISTRER$/)); };
    const valider = async () => { const b = p.locator('button:visible', { hasText: /✓ Valider \(/ }); await b.first().waitFor({ timeout: 4000 }).catch(() => {}); if (await b.count()) await t.clic(b); };
    const planningALHeure = () => p.evaluate(() => {
        const grille = document.querySelector('.planning-table-wrapper');
        const maintenant = new Date();
        const heure = `${String(maintenant.getHours()).padStart(2, '0')}:00`;
        const th = [...grille.querySelectorAll('th.header-time')].find(h => h.textContent.trim().endsWith(heure));
        const palette = document.getElementById('palette-title');
        if (!th || !palette) return;
        const x = th.getBoundingClientRect().left + th.offsetWidth * maintenant.getMinutes() / 60;
        grille.scrollLeft += x - (palette.getBoundingClientRect().left - 90);
    });

    // ---- Démarrage
    await etape('demarrage', async () => {
        await t.clic(p.getByText('EXERCICE', { exact: true }));
        await t.saisir(t.champ('Ex: Gouffre de Padirac, Grotte de Clamouse...'), 'Gouffre de la Combe');
        await t.saisir(t.champ('Ex: Saint-Martin-de-Londres...'), 'Lanville');
        await t.choisir(p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last(), '6');
        await photo('nouveau-dossier');
        await t.clic(t.bouton('Créer le dossier et continuer'));
        await t.clic(p.getByText('PC de Terrain', { exact: false }).last());
        await photo('mode-utilisation');
        await t.clic(t.bouton('Confirmer et Démarrer', { dernier: true }));
        await p.waitForTimeout(1500);
        await t.saisir(t.champ('Ex: Martin DUPONT'), 'Claire VIDAL');
        await photo('secretaire');
        await t.clic(t.bouton(/^✓ Enregistrer$/));
        await photo('ecran-principal');
    });

    // ---- Liste des sauveteurs, arrivées
    await etape('liste', async () => {
        await P.remplirListe(t);
        await t.clic(t.bouton('Liste des sauveteurs'));
        await photo('liste-sauveteurs');
        await fermer();
    });
    await etape('arrivees', async () => {
        await t.clic(t.bouton('Enregistrement des sauveteurs'));
        for (const nom of ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David', 'ROBERT Emma', 'PETIT Félix']) await t.cocher(t.etiquette(nom).locator('input[type="checkbox"]'));
        await photo('enregistrement-sauveteurs');
        await t.clic(t.bouton('Arrivée'));
        await fermer();
    });

    // ---- Points phones, équipes
    await etape('points-phone', async () => {
        await P.pointsPhone(t);
        await t.clic(t.bouton('Points Phone'));
        await photo('points-phone');
        await fermer();
    });
    await etape('equipes', async () => {
        await P.creerEquipe(t, { titre: 'Reconnaissance du P40', ordre: 'Descendre le P40 jusqu\'à la Salle du Camp. Appeler à chaque point phone.', membres: ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé', 'THOMAS David'] });
        await t.clic(t.bouton(/^👥 Équipes$/));
        await t.clic(t.etiquette('🕳️ Sous terre'));
        await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), 'Équipement du puits');
        await t.cocher(t.etiquette('ROBERT Emma', { dernier: true }).locator('input[type="checkbox"]'));
        await photo('equipes');
        await fermer();
        await t.clic(t.bouton('Planning Opérationnel'));
        await t.clic(p.locator('label:visible', { hasText: 'Mise à jour automatique du planning' }).locator('input'));
        await t.clic(t.bouton(/Main Courante/));
    });

    // ---- Main courante : progression de l'équipe 1
    const appel = async ({ pp, sens, retour, description, avant }) => {
        await t.clic(t.bouton(/Main Courante/));
        await t.saisir(t.champ('T1...'), 'Équipe 1');
        if (pp) await t.saisir(t.champ('A, B...'), pp);
        if (sens) await t.clic(t.etiquette(sens));
        if (retour) await t.clic(p.locator('label:visible', { hasText: 'Retour PC' }));
        if (description) await t.saisir(t.champ('Description...'), description);
        if (avant) await avant();
        await enregistrer();
        await valider();
    };
    await etape('mc-progression', async () => {
        await t.clic(t.bouton(/Main Courante/));
        await t.saisir(t.champ('Description...'), 'Point de situation : 6 sauveteurs sur site, attente du matériel de pompage.');
        await photo('formulaire-mc');
        await enregistrer();
        await t.avancer(10);
        await appel({ sens: 'Départ PC', avant: () => photo('depart-pc') });
        await valider();
        await t.avancer(20);
        await appel({ pp: 'A', avant: async () => { await t.clic(t.etiquette('Entre sous terre')); await photo('entree-cavite'); } });
        await valider();
        await t.avancer(25);
        await appel({ pp: 'B' });
        await t.avancer(30);
        await appel({ pp: 'C', description: 'Galerie nord obstruée par un éboulis, contournement par la gauche.' });
        await t.avancer(10);
        // Message mot pour mot
        await t.clic(t.bouton(/Main Courante/));
        await t.saisir(t.champ('T1...'), 'Équipe 1');
        await t.saisir(t.champ('A, B...'), 'C');
        await t.saisir(p.locator('label:visible', { hasText: 'Message à destination de' }).locator('..').locator('input').first(), 'Conseiller technique');
        await t.saisir(p.locator('label:visible', { hasText: 'Message venant de' }).locator('..').locator('input').first(), 'MARTIN Alice');
        await t.saisir(t.champ('Description...'), 'Nous avons trouvé la victime au fond de la Salle du Camp, consciente, douleur à la cheville.');
        await t.cocher(p.locator('label:visible', { hasText: 'Important' }).first().locator('input[type="checkbox"]'));
        await photo('message');
        await enregistrer();
        await valider();
        // Rappel
        await t.avancer(5);
        await t.saisir(t.champ('Description...'), 'Rappeler Météo France pour le bulletin orages.');
        // Heure de l'application (horloge du test), pas celle du PC
        const dans = new Date(await p.evaluate(() => Date.now()) + 10 * 60000);
        await t.saisir(p.locator('input[type="date"]:visible').first(), '', { iso: `${dans.getFullYear()}-${String(dans.getMonth() + 1).padStart(2, '0')}-${String(dans.getDate()).padStart(2, '0')}` });
        await t.saisir(p.locator('input[type="time"]:visible').first(), '', { iso: `${String(dans.getHours()).padStart(2, '0')}:${String(dans.getMinutes()).padStart(2, '0')}` });
        await t.choisir(p.locator('select:visible', { has: p.locator('option[value="communication"]') }).first(), 'communication');
        await enregistrer();
        await t.avancer(12);
        await photo('alertes');
        const traite = p.locator('button:visible', { hasText: '✓ Traité' });
        if (await traite.count()) await t.clic(traite.first());
        await voirTableauMC();
        await photo('liste-mc');
        await p.evaluate(() => window.scrollTo(0, 0));
    });
    await etape('recherche', async () => {
        await t.clic(t.bouton('Recherche Avancée'));
        await t.clic(t.bouton('Messages Importants'));
        await photo('recherche-avancee');
        await fermer();
    });

    // ---- Scission de l'équipe 1 au point C
    await etape('scinder', async () => {
        await t.clic(t.bouton(/^👥 Équipes$/));
        const carte = p.locator('div.border-blue-300:visible').filter({ has: p.getByText('Équipe 1', { exact: true }) }).first();
        if (!(await carte.locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(carte.locator('div.cursor-pointer').first());
        await photo('carte-equipe');
        await t.clic(carte.locator('button', { hasText: '✂️ Scinder' }));
        const fenetre = p.locator('div', { has: p.locator('h3', { hasText: '✂️ Scinder' }) }).last();
        await fenetre.locator('label', { hasText: 'BERNARD Bruno' }).locator('input[type="checkbox"]').uncheck();
        await photo('scinder');
        await t.clic(fenetre.locator('button', { hasText: 'Annuler' }));
        await fermer();
    });

    // ---- Retour au PC
    await etape('retour-pc', async () => {
        await t.avancer(40);
        await appel({ pp: 'A', sens: 'Sort — rentre au PC' });
        await valider();
        await t.avancer(20);
        await t.clic(t.bouton(/Main Courante/));
        await t.saisir(t.champ('T1...'), 'Équipe 1');
        await t.clic(p.locator('label:visible', { hasText: 'Retour PC' }));
        await enregistrer();
        await p.waitForTimeout(600);
        await photo('retour-pc');
        await p.locator('label:visible', { hasText: 'DUBOIS Chloé' }).locator('input[type="checkbox"]').first().uncheck().catch(() => {});
        await valider();
    });

    // ---- Planning
    await etape('planning', async () => {
        await t.clic(t.bouton('Planning Opérationnel'));
        await planningALHeure();
        await photo('planning');
        const cases = p.locator('tr', { hasText: 'PETIT Félix' }).locator('td.time-slot-cell');
        const i = await cases.evaluateAll(cs => { let k = 0; cs.forEach((c, j) => { if (getComputedStyle(c).backgroundColor !== 'rgb(255, 255, 255)') k = j; }); return k; });
        await cases.nth(i).click();
        await cases.nth(i + 1).click({ modifiers: ['Shift'] }).catch(() => {});
        await photo('planning-selection');
        await t.clic(t.bouton('Repas - Déjeuner'));
    });

    // ---- Synthèse, tableau de bord, rapport, progression
    await etape('synthese', async () => {
        await t.clic(t.bouton('Synthèse Affectations'));
        await t.clic(p.locator('button[title="Reculer de 15 minutes"]'));
        await t.clic(t.bouton('✓ Tout sélectionner'));
        await photo('synthese');
    });
    await etape('tableau-bord', async () => {
        await t.clic(t.bouton('Tableau de Bord'));
        await photo('tableau-bord');
        await t.clic(t.bouton('Générer un Rapport'));
        await p.waitForTimeout(800);
        await photo('rapport');
        await fermer();
    });
    await etape('progression', async () => {
        await t.clic(t.bouton('Progression Équipes'));
        await p.waitForTimeout(800);
        await photo('progression');
    });

    // ---- Sauvegardes, import d'une main courante secondaire
    await etape('sauvegardes', async () => {
        await t.clic(t.bouton(/Main Courante/));
        await t.clic(t.bouton('Sauvegardes auto'));
        await t.clic(t.bouton('Sauvegarder maintenant'));
        await p.waitForTimeout(600);
        await photo('sauvegardes-auto');
        const croix = p.locator('button:visible', { hasText: '×' });
        if (await croix.count()) await t.clic(croix.last());
    });
    await etape('import-mc', async () => {
        await t.clic(t.bouton('Importer MC (aperçu)'));
        const fenetreMC = p.locator('div.modal-overlay').last();
        await fenetreMC.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'mc-secondaire-MC2.json'));
        await p.waitForTimeout(800);
        await photo('import-mc-apercu');
        const retour = fenetreMC.locator('button', { hasText: 'Retour' });
        if (await retour.count()) await t.clic(retour.first());
        await fermer();
    });

    // ---- Mode réseau, tablette
    await etape('mode-reseau', async () => {
        await t.clic(t.bouton('Mode réseau'));
        await t.clic(t.bouton('Activer le mode réseau'));
        await p.waitForTimeout(1500);
        await photo('mode-reseau');
        const adresse = await p.locator('span.font-mono.text-xl').first().innerText();
        const code = await p.locator('span.font-mono.text-2xl').first().innerText();
        const tab = await t.ouvrirTablette(adresse + '/');
        await tab.page.waitForTimeout(1500);
        await photo('tablette-code', tab.page);
        await tab.saisir(tab.page.locator('input[placeholder="000000"]'), code);
        await tab.clic(tab.bouton('Se connecter'));
        await tab.page.waitForTimeout(2500);
        await photo('tablette-connectee', tab.page);
        await p.waitForTimeout(1000);
        const titre = p.locator('text=/Postes connectés/').first();
        await titre.scrollIntoViewIfNeeded();
        await photo('postes-connectes');
        await t.clic(t.bouton(/^Désactiver$/));
        await fermer();
    });

    // ---- Clôture, maintenance
    await etape('cloture', async () => {
        await t.clic(t.bouton('Clôturer le secours'));
        await p.waitForTimeout(500);
        await photo('cloture');
        await p.keyboard.press('Escape');
        const annuler = p.locator('button:visible', { hasText: /^Annuler$/ });
        if (await annuler.count()) await t.clic(annuler.last());
    });
    await etape('maintenance', async () => {
        const maintenance = p.locator('#toggle-maintenance');
        await t.cocher(maintenance);
        await photo('maintenance');
        await t.clic(maintenance);
    });

    console.log(echecs.length ? `\n❌ Étapes en échec : ${echecs.join(', ')}` : `\n✅ ${n} captures dans ${DOSSIER}`);
});
