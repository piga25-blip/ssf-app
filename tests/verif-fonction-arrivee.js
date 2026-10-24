// ============================================
// VÉRIFICATION : fonction de surface à l'arrivée (gestion, conseiller technique)
// ============================================
// 1. Fenêtre d'arrivée : « arrive en gestion » cochée d'office pour un rôle de gestion et pour
//    le secrétaire du poste ; « arrive comme conseiller technique » cochée d'office pour un rôle
//    de CT, même avec un rôle de gestion (CT privilégié) ; rien pour les autres rôles.
// 2. Arrivée : planning en « Gestion - PC » / « Conseiller technique » au créneau actuel et
//    lignes de main courante « 👔 Activité … affectée à ».
// 3. « Gestion - PC » posée depuis la palette sur un sauveteur sans équipe.
// 4. Secrétaire du poste choisi parmi les sauveteurs sur site : passe en « Gestion - PC ».
// Utilisation : node tests/verif-fonction-arrivee.js

process.env.FILM_RAPIDE = '1';
const { executer } = require('./film/tutoriels/outils');
const P = require('./film/tutoriels/preparation');

const controles = [];
const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };

const LISTE = [
    ['25-001', 'GIRARD Antoine', 'CT, Gestion PC', '25'],
    ['25-010', 'THOMAS David', 'Eq évacuation', '25'],
    ['25-011', 'VIDAL Claire', 'Eq évacuation', '25'],
    ['39-001', 'SIMON Julien', 'CT, Eq transmission', '39'],
    ['G-001', 'ROUX Pierre', 'Gendarme PGHM, Gestion matériel', 'Gendarmerie'],
    ['25-012', 'MOREL Paul', 'Gestion PC, secrétaire', '25'],
];

executer('_verif-fonction-arrivee', 'vérification', async (t) => {
    const p = t.page;
    const vider = () => p.evaluate(() => window.__film && window.__film.vieillir(true));
    const texte = () => p.evaluate(() => document.body.innerText);
    const bloc = (nom) => p.locator('div.p-2:visible', { has: p.getByText(nom, { exact: true }) }).first();
    const caseFonction = (nom, libelle) => bloc(nom).locator('label', { hasText: libelle }).locator('input[type="checkbox"]');

    // Le secrétaire du poste (Claire VIDAL) est saisi avant que la liste existe
    await P.creerDossier(t);
    await vider();
    await t.clic(t.bouton('Liste des sauveteurs'));
    for (const [id, nom, role, ssf] of LISTE) {
        const [NOM, ...prenom] = nom.split(' ');
        await t.saisir(p.locator('input.bg-gray-100:visible').first(), id);
        await t.saisir(t.champ('NOM'), NOM);
        await t.saisir(t.champ('Prénom'), prenom.join(' '));
        await t.saisir(t.champ('Rôle'), role);
        await t.saisir(t.champ('SSF / Service'), ssf);
        await t.clic(t.bouton('+ Ajouter'));
    }
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));

    // 1. Fenêtre d'arrivée
    await t.clic(t.bouton('Enregistrement des sauveteurs'));
    for (const [, nom] of LISTE.filter(([, n]) => n !== 'MOREL Paul')) await t.cocher(t.etiquette(nom).locator('input[type="checkbox"]'));
    controler('ROUX (gestion matériel) : « arrive en gestion » cochée', await caseFonction('ROUX Pierre', 'arrive en gestion').isChecked());
    controler('VIDAL (secrétaire du poste) : « arrive en gestion » cochée', await caseFonction('VIDAL Claire', 'arrive en gestion').isChecked());
    controler('SIMON (CT) : « arrive comme conseiller technique » cochée', await caseFonction('SIMON Julien', 'conseiller technique').isChecked());
    controler('GIRARD (CT, gestion PC) : les deux proposés, conseiller technique coché (privilégié)',
        (await caseFonction('GIRARD Antoine', 'arrive en gestion').count()) === 1 && !(await caseFonction('GIRARD Antoine', 'arrive en gestion').isChecked())
        && await caseFonction('GIRARD Antoine', 'conseiller technique').isChecked());
    controler('THOMAS (évacuation) : aucune case', (await bloc('THOMAS David').locator('label', { hasText: 'arrive' }).count()) === 0);
    // Décocher reste possible : GIRARD arrive « Disponible »
    await caseFonction('GIRARD Antoine', 'conseiller technique').uncheck();
    controler('GIRARD : conseiller technique décoché, gestion non cochée', !(await caseFonction('GIRARD Antoine', 'conseiller technique').isChecked())
        && !(await caseFonction('GIRARD Antoine', 'arrive en gestion').isChecked()));

    // 2. Arrivée
    await t.clic(t.bouton('Arrivée'));
    await t.clic(t.bouton(/^Fermer$/, { dernier: true }));
    let mc = await texte();
    controler('MC : « Gestion - PC » affectée à ROUX Pierre, VIDAL Claire', /Activité "Gestion - PC" affectée à : (ROUX Pierre, VIDAL Claire|VIDAL Claire, ROUX Pierre)/.test(mc));
    controler('MC : « Conseiller technique » affectée à SIMON Julien', mc.includes('Activité "Conseiller technique" affectée à : SIMON Julien'));
    const couleurs = async (nom) => p.locator('tr', { hasText: nom }).locator('td.time-slot-cell')
        .evaluateAll(cs => cs.map(c => getComputedStyle(c).backgroundColor));
    await t.clic(t.bouton('Planning Opérationnel'));
    const jaune = 'rgb(255, 255, 0)', rose = 'rgb(255, 192, 203)', vert = 'rgb(0, 128, 0)';
    controler('Planning : ROUX en jaune', (await couleurs('ROUX Pierre')).includes(jaune));
    controler('Planning : VIDAL en jaune', (await couleurs('VIDAL Claire')).includes(jaune));
    controler('Planning : SIMON en rose', (await couleurs('SIMON Julien')).includes(rose));
    controler('Planning : THOMAS et GIRARD en vert (Disponible)',
        (await couleurs('THOMAS David')).includes(vert) && (await couleurs('GIRARD Antoine')).includes(vert));

    // 3. Palette : « Gestion - PC » sans équipe
    await vider();
    const cases = p.locator('tr', { hasText: 'THOMAS David' }).locator('td.time-slot-cell');
    await t.glisser(cases.nth(5), cases.nth(6));
    await t.clic(t.bouton('Gestion - PC'));
    controler('Palette : « Gestion - PC » posée sur THOMAS (sans équipe)', (await couleurs('THOMAS David')).includes(jaune));

    // 4. Secrétaire choisi parmi les sauveteurs sur site
    await t.clic(t.bouton(/Main Courante/));
    await vider();
    await P.arrivees(t, ['MOREL Paul']);
    await t.clic(p.locator('button[title="Changer de secrétaire"]').first());
    await t.clic(p.locator('button', { hasText: /^GIRARD Antoine$/ }));
    await t.clic(t.bouton(/^✓ Enregistrer$/));
    mc = await texte();
    controler('Secrétaire GIRARD Antoine : ligne « Gestion - PC … (secrétaire de ce poste) »',
        mc.includes('Activité "Gestion - PC" affectée à : GIRARD Antoine (secrétaire de ce poste)'));
    await t.clic(t.bouton('Planning Opérationnel'));
    controler('Planning : GIRARD en jaune', (await couleurs('GIRARD Antoine')).includes(jaune));

    const ok = controles.length > 0 && controles.every(Boolean);
    console.log(ok ? '\n✅ Fonction de surface à l\'arrivée conforme.' : '\n❌ Défaut(s) encore présent(s).');
    if (!ok) process.exitCode = 1;
});
