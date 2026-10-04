// ============================================
// VÉRIFICATION : défauts relevés en tournant les films de formation
// ============================================
// 1. Import CSV : séparateur virgule et fichier en Windows-1252 (Excel) acceptés ; fichier sans
//    ligne valide → message.
// 2. Création de deux équipes sans refermer la fenêtre : le numéro proposé passe au suivant.
// 3. « Mouvement Individuel Rapide » vers une sous-équipe issue d'une scission (1B).
// 4. Activité d'équipe (👥) au planning sur un sauveteur sans équipe → message.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-defauts-releves.js

process.env.FILM_RAPIDE = '1';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { executer } = require('./film/tutoriels/outils');
const P = require('./film/tutoriels/preparation');

const controles = [];
const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };

executer('_verif-defauts', 'vérification', async (t) => {
    const p = t.page;
    // Messages de l'application (alert / confirm affichés par les outils des films)
    const messages = () => p.evaluate(() => [...document.querySelectorAll('.__film_message')].map(m => m.innerText).join('\n'));
    const vider = () => p.evaluate(() => window.__film && window.__film.vieillir(true));
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-csv-'));

    await P.creerDossier(t);
    await vider();

    // 1. CSV
    await t.clic(t.bouton('Liste Préfectorale'));
    const entree = p.locator('input[type="file"][accept=".csv,.txt"]');
    const virgules = path.join(dossier, 'virgules-ansi.csv');
    fs.writeFileSync(virgules, Buffer.from('ID,Nom Prénom,Rôle,SSF\r\nA-1,MARTIN Alice,Chef d\'équipe,34\r\nA-2,DUBOIS Chloé,Médecin,30\r\n', 'latin1'));
    await entree.setInputFiles(virgules);
    await p.waitForTimeout(800);
    let texte = await p.evaluate(() => document.body.innerText);
    controler('CSV à virgules en Windows-1252 : 2 sauveteurs importés', (await messages()).includes('2 sauveteur(s) importé(s)'));
    controler('CSV Windows-1252 : accents corrects (DUBOIS Chloé, Médecin)', texte.includes('DUBOIS Chloé') && texte.includes('Médecin'));
    const pointsVirgules = path.join(dossier, 'points-virgules.csv');
    fs.writeFileSync(pointsVirgules, 'ID;Nom Prénom;Rôle;SSF\nB-1;BERNARD Bruno;Secouriste;34\nB-2;THOMAS David;Secouriste;12\nB-3;ROBERT Emma;Plongeur;30\n');
    await vider();
    await entree.setInputFiles(pointsVirgules);
    await p.waitForTimeout(800);
    controler('CSV à points-virgules (UTF-8) : toujours accepté', (await messages()).includes('3 sauveteur(s) importé(s)'));
    const invalide = path.join(dossier, 'invalide.csv');
    fs.writeFileSync(invalide, 'Nom\nMARTIN\n');
    await vider();
    await entree.setInputFiles(invalide);
    await p.waitForTimeout(800);
    controler('CSV sans ligne valide : message explicatif', (await messages()).includes('Aucun sauveteur importé'));
    controler('Format affiché à l\'écran corrigé', (await p.evaluate(() => document.body.innerText)).includes('ID ; NOM Prénom ; Rôle ; SSF'));
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    await P.arrivees(t, ['MARTIN Alice', 'DUBOIS Chloé', 'BERNARD Bruno', 'THOMAS David', 'ROBERT Emma']);
    await vider();

    // 2. Deux équipes sans refermer la fenêtre
    await t.clic(t.bouton(/^👥 Équipes$/));
    const creer = async (lieu, titre, membres) => {
        await t.clic(t.etiquette(lieu));
        await t.saisir(t.champ('Titre (ex: Reconnaissance Zone Nord)'), titre);
        const type = p.locator('select:visible', { has: p.locator('option', { hasText: 'Sélectionner un type' }) });
        if (!(await type.inputValue())) await t.choisir(type, { index: 1 });
        for (const nom of membres) await t.cocher(t.etiquette(nom, { dernier: true }).locator('input[type="checkbox"]'));
        await t.clic(t.bouton('Créer l\'Équipe'));
        await p.waitForTimeout(800);
    };
    await creer('Sous terre', 'Reconnaissance', ['MARTIN Alice', 'BERNARD Bruno', 'DUBOIS Chloé']);
    const numero = await p.locator('select:visible', { has: p.locator('option[value="3"]') }).first().inputValue();
    controler(`Après la création de l'équipe 1, numéro proposé : ${numero} (attendu 2)`, numero === '2');
    await vider();
    await creer('Surface', 'Logistique', ['ROBERT Emma']);
    controler('Deuxième équipe créée sans changer le numéro à la main', !(await messages()).includes('existe déjà') && (await p.evaluate(() => document.body.innerText)).includes('Équipe 2'));

    // 3. Scission puis déplacement vers 1B
    const carte = (nom) => p.locator('div.border-blue-300:visible').filter({ has: p.getByText(nom, { exact: true }) }).first();
    const deplier = async (nom) => { if (!(await carte(nom).locator('button', { hasText: 'Fin de mission' }).isVisible())) await t.clic(carte(nom).locator('div.cursor-pointer').first()); };
    await deplier('Équipe 1');
    await t.clic(carte('Équipe 1').locator('button', { hasText: '✂️ Scinder' }));
    await t.clic(p.locator('label:visible', { hasText: 'BERNARD Bruno' }).last().locator('input[type="checkbox"]'));
    await t.clic(t.bouton('Créer Équipe 1B'));
    await vider();
    await deplier('Équipe 1');
    const ligne = carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'BERNARD Bruno' });
    await t.saisir(ligne.locator('input[placeholder="ID Équipe / PC"]'), '1B');
    await t.clic(ligne.locator('button', { hasText: 'Déplacer' }));
    await p.waitForTimeout(800);
    controler('Mouvement Individuel Rapide vers 1B : membre déplacé', (await messages()).includes('Membre déplacé'));
    await deplier('Équipe 1B');
    controler('BERNARD Bruno est dans l\'équipe 1B', await carte('Équipe 1B').getByText('BERNARD Bruno').first().isVisible());
    await vider();
    await deplier('Équipe 1');
    const ligneMartin = carte('Équipe 1').locator('div.flex.items-center.gap-2', { hasText: 'MARTIN Alice' });
    await t.saisir(ligneMartin.locator('input[placeholder="ID Équipe / PC"]'), '1');
    await t.clic(ligneMartin.locator('button', { hasText: 'Déplacer' }));
    controler('Déplacement vers sa propre équipe : refusé avec message', (await messages()).includes('fait déjà partie'));
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    // 4. Activité d'équipe sur un sauveteur sans équipe
    await t.clic(t.bouton('Planning Opérationnel'));
    await vider();
    const cases = p.locator('tr', { hasText: 'THOMAS David' }).locator('td.time-slot-cell');
    await t.glisser(cases.nth(5), cases.nth(6));
    await t.clic(t.bouton('Gestion - PC'));
    controler('Activité 👥 sur un sauveteur sans équipe : message', (await messages()).includes('activité d\'équipe'));

    fs.rmSync(dossier, { recursive: true, force: true });
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Défauts relevés corrigés.' : '\n❌ Défaut(s) encore présent(s).');
    if (!ok) process.exitCode = 1;
});
