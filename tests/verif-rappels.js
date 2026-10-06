// ============================================
// VÉRIFICATION : rappels et fenêtre d'alertes, « Modifier » les infos du secours
// ============================================
// Défauts trouvés en jouant le scénario de formation (06/10/2026) :
// 1. Rappel posé plus de 10 min à l'avance : la fenêtre d'alertes doit s'ouvrir seule à
//    l'échéance (10 min avant), sans action du secrétaire.
// 2. Après « ✓ Traité » d'un rappel, le rappel suivant doit encore ouvrir la fenêtre.
// 3. Le « × » de la fenêtre la ferme vraiment.
// 4. Date des rappels en heure locale (repos, report) : juste après minuit, pas la veille.
// 5. « ✏️ Modifier » les infos : pas de choix du mode ensuite, formulaire à chaque ouverture,
//    même dossier.
// 6. Badge « 👑 chef » visible dans l'en-tête d'une équipe.
//
// Utilisation (depuis C:\Projets\SSF) : node tests/verif-rappels.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');

(async () => {
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-rappels-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0' } });
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    try {
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.alert = () => {}; window.confirm = () => true; });
        await p.clock.install({ time: new Date(2026, 9, 6, 14, 0, 0) });
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1500);
        const b = (t) => p.locator('button:visible', { hasText: t });
        const fenetre = async () => (await p.locator('h3:visible', { hasText: 'Alertes en attente' }).count()) > 0;
        const avancer = async (min) => { for (let i = 0; i < min; i++) { await p.clock.fastForward(60000); await p.waitForTimeout(300); } };

        // Dossier
        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Rappels');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Ici');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b('Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Testeur'); await b(/^✓ Enregistrer$/).click(); }
        const idDossier = await p.locator('input[placeholder="Ex: GouffreA_2025"]').inputValue();

        // 5. « Modifier » deux fois
        let formulaire2 = true, mode = false;
        for (let i = 0; i < 2; i++) {
            await b('✏️ Modifier').click(); await p.waitForTimeout(1200);
            const select = p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last();
            if (!(await select.count())) { formulaire2 = false; break; }
            await select.selectOption(String(7 + i));
            await b('Enregistrer les modifications').click(); await p.waitForTimeout(800);
            if (await p.getByText("Choisissez votre mode d'utilisation").count()) mode = true;
        }
        controler('« Modifier » : pas de fenêtre du choix du mode ensuite', !mode);
        controler('« Modifier » : le formulaire s\'affiche à la 2e ouverture', formulaire2);
        controler('« Modifier » : même dossier', (await p.locator('input[placeholder="Ex: GouffreA_2025"]').inputValue()) === idDossier);

        // 1. et 2. Deux rappels : A à 14:03, B à 14:20
        const ligne = async (texte, heure) => {
            await p.locator('textarea[placeholder="Description..."]').fill(texte);
            await p.locator('input[type="date"]:visible').first().fill('2026-10-06');
            await p.locator('input[type="time"]:visible').first().fill(heure);
            await b(/^✓ ENREGISTRER$/).click(); await p.waitForTimeout(800);
        };
        await ligne('Rappel B à 14:20', '14:20');
        await ligne('Rappel A à 14:03', '14:03');
        controler('Rappel A urgent : fenêtre ouverte', await fenetre());
        // 3. × ferme vraiment
        await p.locator('button[title^="Fermer (réapparaîtra"]').click(); await p.waitForTimeout(500);
        controler('« × » ferme la fenêtre', !(await fenetre()));
        await avancer(1);
        controler('… et elle revient (rappel toujours en attente)', await fenetre());
        await avancer(3);
        await p.locator('div.border-red-300:visible', { hasText: 'Rappel A' }).locator('button', { hasText: '✓ Traité' }).click();
        await p.waitForTimeout(1000);
        await avancer(2);
        controler('A traité : fenêtre fermée (B pas encore à échéance)', !(await fenetre()));
        await avancer(4); // 14:10 → B à 10 min
        controler('B à échéance : fenêtre ouverte seule, sans action', await fenetre());

        // 4. Date locale juste après minuit
        const nuit = await p.evaluate(() => dateLocaleISO(new Date(2026, 9, 7, 0, 30)));
        controler(`Date locale à 0 h 30 le 7/10 : ${nuit}`, nuit === '2026-10-07');

        // 6. Badge 👑 du chef (classe sm:inline-flex)
        const badge = await p.evaluate(() => {
            const s = document.createElement('span'); s.className = 'hidden sm:inline-flex'; document.body.appendChild(s);
            const d = getComputedStyle(s).display; s.remove(); return d;
        });
        controler(`Classe « hidden sm:inline-flex » affichée (${badge})`, badge === 'inline-flex');
    } catch (e) {
        controler('Erreur : ' + e.message.split('\n')[0], false);
    } finally {
        await app.close().catch(() => {});
        try { fs.rmSync(donnees, { recursive: true, force: true }); } catch (e) { /* verrouillé */ }
    }
    const ok = controles.every(Boolean);
    console.log(ok ? '\n✅ Rappels et « Modifier » conformes.' : '\n❌ Rappels ou « Modifier » NON conformes.');
    process.exitCode = ok ? 0 : 1;
})();
