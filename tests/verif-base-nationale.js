// ============================================
// VÉRIFICATION : « 🌐 Récupérer depuis la base nationale »
// ============================================
// Un faux site local imite sauveteurs.speleo-secours-francais.fr : page de connexion, page
// d'export avec les liens « Export au format Excel » et « vCard ». On vérifie que :
// 1. la fenêtre du site s'ouvre sur la page d'export (redirigée vers la connexion) ;
// 2. après connexion et clic sur l'export Excel, le fichier arrive dans l'aperçu, puis la liste ;
//    le lien vCard est ignoré ; le fichier téléchargé ne reste pas sur le disque ;
// 3. la connexion est gardée (2e récupération sans s'identifier), « Se déconnecter » l'oublie ;
// 4. fermer la fenêtre sans exporter ne change rien.
//
// Utilisation (depuis C:\Projets\SSF) : node tests/verif-base-nationale.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('./outils-fichiers');

const RACINE = path.join(__dirname, '..');
const XLSX = require(path.join(RACINE, 'libs', 'xlsx.full.min.js'));

// Export de la base (colonnes du vrai fichier, noms fictifs)
const exportExcel = () => {
    const titres = ['ID', 'Nom', 'Prenom', 'Sexe', 'Adresse', 'CPVille', 'Telperso', 'Teltravail', 'TelPortable', 'Email', 'Fonction CT',
        'ChefEquipeEvac', 'ChefEquipeASV', 'Medecin', 'Infirmier', 'Gestion', 'ASV', 'Transmission', 'Evacuation', 'Desobstruction', 'CPT',
        'Plongee', 'Pompage', 'Ventilation', 'Logistique', 'EauxVives', 'Mines', 'Operationnel', 'SpecialiteMedicale', 'Licence', 'Divers', 'TAGS', 'ID_AVEN2', 'Fédéré à date'];
    const ligne = (id, nom, prenom, d) => [id, nom, prenom, 1, 'x', 'x', '', '', '0600000000', 'x@x.fr', '', ...d, 1, '', '', '', '', id, 1];
    const f = XLSX.utils.aoa_to_sheet([titres,
        ligne(7001, 'Lambert', 'Lina', [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        ligne(7002, 'Masson', 'Marc', [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0]),
    ]);
    const c = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(c, f, 'Liste');
    return XLSX.write(c, { type: 'buffer', bookType: 'xlsx' });
};

// Faux site : cookie « session » après connexion
const site = http.createServer((req, res) => {
    const connecte = /session=ok/.test(req.headers.cookie || '');
    const u = new URL(req.url, 'http://x');
    const page = (html) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><meta charset="utf-8"><body>${html}</body>`); };
    if (u.pathname === '/login.php' && req.method === 'POST') {
        res.writeHead(302, { 'Set-Cookie': 'session=ok; Path=/; Max-Age=86400', Location: '/ssf_liste.php?mode=export' }); res.end(); return;
    }
    if (!connecte) {
        if (u.pathname === '/login.php') { page('<h1>Connexion</h1><form method="post" action="/login.php"><input name="login" id="login"><input type="password" name="mdp" id="mdp"><button id="entrer">Entrer</button></form>'); return; }
        res.writeHead(302, { Location: '/login.php' }); res.end(); return;
    }
    if (u.pathname === '/ssf_liste.php') {
        page('<h1>Export</h1><p>Export au format Excel : <a id="xls" href="ssf_dl_liste.php?mode=xls&ext=25">télécharger</a></p><p>Export au format vCard : <a id="vcf" href="ssf_dl_liste.php?mode=vcf&ext=25">télécharger</a></p>');
        return;
    }
    if (u.pathname === '/ssf_dl_liste.php' && u.searchParams.get('mode') === 'xls') {
        res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Liste_SSF-25_16_10_2026.xlsx"' });
        res.end(exportExcel()); return;
    }
    if (u.pathname === '/ssf_dl_liste.php') {
        res.writeHead(200, { 'Content-Type': 'text/vcard', 'Content-Disposition': 'attachment; filename="contacts.vcf"' }); res.end('BEGIN:VCARD\nEND:VCARD\n'); return;
    }
    res.writeHead(404); res.end();
});

(async () => {
    await new Promise(r => site.listen(0, '127.0.0.1', r));
    const URL_EXPORT = `http://127.0.0.1:${site.address().port}/ssf_liste.php?mode=export`;
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-base-nat-'));
    const app = await electron.launch({ args: [RACINE], cwd: RACINE, env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0', SSF_BASE_NATIONALE_URL: URL_EXPORT } });
    const controles = [];
    const controler = (libelle, ok) => { controles.push(ok); console.log(`${ok ? '✅' : '❌'} ${libelle}`); };
    const avant = new Set(fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('ssf-base-nationale-')));
    try {
        const p = await fenetrePrincipale(app);
        await app.context().addInitScript(() => { window.__alertes = []; window.alert = (m) => window.__alertes.push(String(m)); window.confirm = () => true; });
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        await p.waitForTimeout(1500);
        const b = (t) => p.locator('button:visible', { hasText: t });
        await p.getByText('EXERCICE', { exact: true }).click();
        await p.locator('input[placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."]').fill('Base nationale');
        await p.locator('input[placeholder="Ex: Saint-Martin-de-Londres..."]').fill('Ici');
        await p.locator('select:visible').filter({ has: p.locator('option[value="0"]') }).last().selectOption('6');
        await b('Créer le dossier et continuer').click();
        await p.getByText('PC de Terrain', { exact: false }).last().click();
        await b('Confirmer et Démarrer').last().click();
        await p.waitForTimeout(1500);
        if (await p.locator('h2:visible', { hasText: 'Secrétaire de ce PC' }).count()) { await p.locator('input[placeholder="Ex: Martin DUPONT"]').fill('Testeur'); await b(/^✓ Enregistrer$/).click(); }
        await b('Liste des sauveteurs').click();

        const ouvrirSite = async () => {
            const [w] = await Promise.all([app.waitForEvent('window'), b('Récupérer depuis la base nationale').click()]);
            await w.waitForLoadState('domcontentloaded');
            return w;
        };

        // 4. Fermer sans exporter : rien ne change
        let w = await ouvrirSite();
        controler(`Fenêtre ouverte, redirigée vers la connexion (${new URL(w.url()).pathname})`, new URL(w.url()).pathname === '/login.php');
        controler('Bouton « ⏳ Fenêtre de la base nationale ouverte… » pendant ce temps', await b('Fenêtre de la base nationale ouverte').count() === 1);
        await w.close();
        await p.waitForTimeout(500);
        controler('Fenêtre fermée sans export : pas d\'aperçu, bouton de nouveau disponible', await p.locator('h3:visible', { hasText: 'Import de la base nationale' }).count() === 0 && await b('Récupérer depuis la base nationale').count() === 1);

        // 1-2. Connexion, puis vCard (ignorée) et export Excel
        w = await ouvrirSite();
        await w.fill('#login', 'utilisateur'); await w.fill('#mdp', 'secret');
        await Promise.all([w.waitForURL(/ssf_liste\.php/), w.click('#entrer')]);
        await w.click('#vcf');
        await w.waitForTimeout(500);
        controler('Lien vCard ignoré : la fenêtre reste ouverte', !w.isClosed());
        await w.click('#xls');
        await p.locator('h3:visible', { hasText: 'Import de la base nationale' }).waitFor({ timeout: 10000 });
        controler('Export Excel récupéré : fenêtre fermée, aperçu affiché (2 sauveteurs, SSF 25)',
            w.isClosed() && (await p.locator('h3:visible', { hasText: 'Import de la base nationale' }).locator('..').innerText()).includes('2 sauveteurs dans le fichier')
            && (await p.locator('input[placeholder="ex. 25"]').inputValue()) === '25');
        await b(/Remplacer la liste \(2\)/).click();
        await p.waitForTimeout(600);
        const corps = await p.locator('body').innerText();
        controler('Liste importée : « LAMBERT Lina » CE évacuation, Eq transmission', corps.includes('LAMBERT Lina') && corps.includes('CE évacuation, Eq transmission'));
        const restes = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('ssf-base-nationale-') && !avant.has(f));
        controler('Fichier téléchargé (avec coordonnées) supprimé du disque', restes.length === 0);

        // 3. Connexion gardée, puis oubliée
        w = await ouvrirSite();
        controler('2e récupération : déjà connecté, directement sur la page d\'export', new URL(w.url()).pathname === '/ssf_liste.php');
        await w.close(); await p.waitForTimeout(400);
        await b('Se déconnecter de la base').click();
        await p.waitForTimeout(600);
        w = await ouvrirSite();
        controler('Après « Se déconnecter de la base » : connexion demandée de nouveau', new URL(w.url()).pathname === '/login.php');
        await w.close();
    } catch (e) {
        controler('Erreur : ' + e.message.split('\n')[0], false);
    } finally {
        await app.close().catch(() => {});
        site.close();
        try { fs.rmSync(donnees, { recursive: true, force: true }); } catch (e) { /* verrouillé */ }
    }
    const ok = controles.every(Boolean);
    console.log(ok ? '\n✅ Récupération depuis la base nationale conforme.' : '\n❌ Récupération depuis la base nationale NON conforme.');
    process.exitCode = ok ? 0 : 1;
})();
