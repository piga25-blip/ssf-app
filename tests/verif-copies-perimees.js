// ============================================
// VÉRIFICATION : modifications faites sur une copie périmée (lot 0, A3)
// ============================================
// Simule une donnée « arrivée d'ailleurs » (autre poste, minuterie…) AU MILIEU d'une action :
// pendant la fenêtre de confirmation, une donnée est ajoutée ; l'action se termine ensuite.
// Avant la correction, l'action réécrivait la liste à partir de sa copie et effaçait la donnée
// ajoutée entre-temps, et deux lignes de main courante pouvaient recevoir le même numéro.
//
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/verif-copies-perimees.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');

const RACINE = path.join(__dirname, '..');

(async () => {
    const dossierDonnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-a3-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: dossierDonnees } });
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    try {
        const page = await app.firstWindow();
        await app.context().addInitScript(() => {
            window.__SSF_TEST__ = {};
            window.alert = () => {};
            // Une « injection » programmée s'exécute pendant la prochaine fenêtre de confirmation
            window.confirm = () => {
                const f = window.__injection; window.__injection = null;
                if (f) f(window.__SSF_TEST__);
                return true;
            };
        });
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await page.waitForTimeout(1000);
        const bouton = (texte) => page.locator('button:visible', { hasText: texte });
        const pause = (ms = 400) => page.waitForTimeout(ms);
        const etat = () => page.evaluate(() => {
            const k = Object.keys(localStorage).find(c => c.includes('gouffre-a3'));
            return JSON.parse(localStorage.getItem(k));
        });

        // Préparation : dossier, 4 sauveteurs (3 arrivés), une équipe, 2 points phones
        await page.getByText('EXERCICE', { exact: true }).click();
        await page.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Gouffre A3');
        await page.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Concurrenceville');
        await page.locator('select:visible').filter({ has: page.locator('option[value="0"]') }).last().selectOption('6');
        await bouton('Créer le dossier et continuer').click();
        await page.getByText('PC de Terrain', { exact: false }).last().click();
        await bouton('Confirmer et Démarrer').last().click();
        await pause(1500);
        await page.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Testeur');
        await bouton(/^✓ Enregistrer$/).click();
        await bouton('Liste Préfectorale').click();
        for (const [nom, prenom] of [['ALPHA', 'Anne'], ['BRAVO', 'Bob'], ['CHARLIE', 'Carl'], ['DELTA', 'Dan']]) {
            await page.locator('input[placeholder="NOM"]:visible').fill(nom);
            await page.locator('input[placeholder="Prénom"]:visible').fill(prenom);
            await bouton('+ Ajouter').click();
        }
        await bouton(/^Fermer$/).last().click();
        await bouton('Enregistrement des sauveteurs').click();
        for (const n of ['ALPHA Anne', 'BRAVO Bob', 'CHARLIE Carl']) {
            await page.locator('label:visible', { hasText: n }).first().locator('input[type="checkbox"]').check();
        }
        await bouton('Arrivée').click();
        await bouton(/^Fermer$/).last().click();
        await bouton('Points Phone').click();
        for (const [lettre, nom] of [['A', 'Entrée'], ['B', 'Puits']]) {
            await page.locator('div.flex.gap-2:visible', { has: page.locator('input[placeholder="Pos."]') }).locator('select').selectOption(lettre);
            await page.locator('input[placeholder="Ex: Base du P80, Poste médical..."]').fill(nom);
            await page.locator('label:visible', { hasText: '🪨 Sous terre' }).first().click();
            await bouton('+ Ajouter').click();
        }
        await bouton(/^Fermer$/).last().click();
        await bouton(/^👥 Équipes$/).click();
        await page.locator('label:visible', { hasText: '🌿 Surface' }).first().click();
        await page.locator('input[placeholder="Titre (ex: Reconnaissance Zone Nord)"]').fill('Équipe concurrente');
        await page.locator('select:visible', { has: page.locator('option', { hasText: 'Sélectionner un type' }) }).selectOption({ index: 1 });
        await page.locator('label:visible', { hasText: 'ALPHA Anne' }).last().locator('input[type="checkbox"]').check();
        await bouton('Créer l\'Équipe').click();
        await pause(800);

        // 1. Fin de mission de l'équipe 1 ; pendant la confirmation, un autre poste ajoute
        //    une ligne de main courante et une équipe
        await page.evaluate(() => {
            window.__injection = (api) => {
                const n = api.reserverNumerosMC();
                api.setEvents(prev => [...prev, {
                    id: 'externe-1', isoTimestamp: new Date().toISOString(), dateHeure: new Date().toLocaleString('fr-FR'),
                    secretaire: 'Autre poste', categorie: 'communication', evenement: 'Message saisi sur un autre poste',
                    numero: String(n).padStart(3, '0'), fait: false, messageImportant: false,
                }]);
                api.setTeams(prev => [...prev, { id: 'T9', name: 'Équipe 9', mission: 'Créée sur un autre poste', members: [], status: 'active', history: [] }]);
            };
        });
        const carte = page.locator('div.border-blue-300:visible').filter({ has: page.getByText('Équipe 1', { exact: true }) }).first();
        await carte.locator('div.cursor-pointer').first().click();
        await pause();
        await carte.locator('button', { hasText: 'Fin de mission' }).click();
        await pause(1200);
        let e = await etat();
        const externe = e.events.find(v => v.id === 'externe-1');
        const dissolution = e.events.find(v => (v.evenement || '').includes('Dissolution Équipe 1'));
        controler('Fin de mission : la ligne saisie sur l\'autre poste est conservée', !!externe);
        controler('Fin de mission : la ligne de dissolution est créée', !!dissolution);
        controler('Fin de mission : l\'équipe créée sur l\'autre poste est conservée', e.teams.some(t => t.id === 'T9'));
        controler('Fin de mission : l\'équipe 1 est dissoute', e.teams.some(t => t.name === 'Équipe 1' && t.status === 'dissolved'));
        const numeros = e.events.map(v => v.numero);
        controler(`Numéros de main courante tous différents : ${numeros.join(', ')}`, new Set(numeros).size === numeros.length);
        controler(`Prochain numéro cohérent : ${e.nextEventNumber}`, e.nextEventNumber === Math.max(...numeros.map(Number)) + 1);
        await bouton(/^Fermer$/).last().click();

        // 2. Suppression du point phone B ; pendant la confirmation, un autre poste ajoute le point Z
        await page.evaluate(() => {
            window.__injection = (api) => api.setPointsPhone(prev => [...prev, { lettre: 'Z', nom: 'Ajouté ailleurs', typePP: 'surface', sousTerre: false, ordre: 9 }]);
        });
        await bouton('Points Phone').click();
        await page.locator('div:visible', { hasText: 'Puits' }).filter({ has: page.locator('button', { hasText: '🗑️' }) }).last()
            .locator('button', { hasText: '🗑️' }).click();
        await pause(1200);
        e = await etat();
        const lettres = e.pointsPhone.map(p => p.lettre);
        controler(`Points phones après suppression de B : ${lettres.join(', ')}`, !lettres.includes('B') && lettres.includes('Z') && lettres.includes('A'));
        await bouton(/^Fermer$/).last().click();

        // 3. Suppression de DELTA de la liste ; pendant la confirmation, un autre poste ajoute ECHO
        await page.evaluate(() => {
            window.__injection = (api) => api.setMasterSauveteursList(prev => [...prev, { id: 'EXT-099', name: 'ECHO Eve', role: 'Secouriste', SSF: '00' }]);
        });
        await bouton('Liste Préfectorale').click();
        await page.locator('tr:visible', { hasText: 'DELTA Dan' }).locator('button[title="Supprimer"]').click();
        await pause(1200);
        e = await etat();
        const noms = e.masterSauveteursList.map(s => s.name);
        controler(`Liste après suppression de DELTA : ${noms.join(', ')}`, !noms.includes('DELTA Dan') && noms.includes('ECHO Eve'));
    } finally {
        await app.close();
        fs.rmSync(dossierDonnees, { recursive: true, force: true });
    }
    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Aucune donnée perdue, numéros uniques.' : '\n❌ Données perdues ou numéros en double.');
    process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error('❌', e); process.exit(1); });
