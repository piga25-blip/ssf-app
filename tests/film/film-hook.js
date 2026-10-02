// Chargé avec « node -r film-hook.js tests/xxx.js » : filme chaque fenêtre Electron lancée
// par le test (recordVideo de Playwright), ralentit et surligne chaque action, et note les
// messages du test (horodatés) pour en faire des sous-titres. Le test lui-même n'est pas modifié.
const path = require('path');
const fs = require('fs');

const SCENARIO = process.env.FILM_SCENARIO;
const DOSSIER = path.join(process.env.FILM_DIR, SCENARIO);
const PAUSE = Number(process.env.FILM_PAUSE || 700);
fs.mkdirSync(DOSSIER, { recursive: true });

const pw = require(require.resolve('playwright-core', { paths: [process.cwd()] }));
const fenetres = [];   // { video, debut, url, role }
const messages = [];   // { t, texte }
const t0 = Date.now();

const logOrig = console.log;
console.log = (...a) => {
    const texte = a.map(String).join(' ').trim();
    if (texte) messages.push({ t: Date.now(), texte });
    logOrig(...a);
};

const attendre = ms => new Promise(r => setTimeout(r, ms));
let locatorPatche = false;
let groupe = null;

const patcherLocator = (page) => {
    if (locatorPatche) return;
    locatorPatche = true;
    const proto = Object.getPrototypeOf(page.locator('body'));
    for (const nom of ['click', 'dblclick', 'fill', 'selectOption', 'check', 'uncheck', 'press', 'setInputFiles']) {
        const orig = proto[nom];
        if (typeof orig !== 'function') continue;
        proto[nom] = async function (...args) {
            // Actions lancées ensemble (Promise.all des tests « au même instant ») : même groupe,
            // donc même instant de départ après la pause — la simultanéité du test est conservée
            const maintenant = Date.now();
            if (!groupe || maintenant - groupe.debut > 100) groupe = { debut: maintenant, depart: maintenant + PAUSE };
            const depart = groupe.depart;
            // Surligne l'élément visé, laisse le temps de le voir, puis agit
            await Promise.race([this.evaluate(el => {
                el.scrollIntoView({ block: 'center', inline: 'nearest' });
                el.__filmOutline = el.style.outline;
                el.style.outline = '4px solid #ff2d55';
                el.style.outlineOffset = '2px';
                setTimeout(() => { el.style.outline = el.__filmOutline || ''; }, 900);
            }, null, { timeout: PAUSE - 100 }).catch(() => {}), attendre(PAUSE - 100)]);
            await attendre(depart - Date.now());
            const r = await orig.apply(this, args);
            await attendre(nom === 'fill' || nom === 'selectOption' ? PAUSE : PAUSE / 2);
            return r;
        };
    }
};

const launchOrig = pw._electron.launch.bind(pw._electron);
pw._electron.launch = async (options = {}) => {
    const role = (options.args || []).some(a => /aides[\\/]navigateur/.test(a)) ? 'autre' : 'principal';
    const app = await launchOrig({ ...options, recordVideo: { dir: DOSSIER, size: { width: Number(process.env.FILM_LARGEUR || 1400), height: Math.round(Number(process.env.FILM_LARGEUR || 1400) * 900 / 1400) } } });
    const suivre = (page) => {
        const f = { video: null, debut: Date.now(), url: '', role };
        fenetres.push(f);
        try { Promise.resolve(page.video() && page.video().path()).then(p => { f.video = p; }, () => {}); } catch (e) {}
        const majUrl = () => { try { f.url = page.url(); } catch (e) {} };
        page.on('framenavigated', majUrl);
        page.on('close', majUrl);
        majUrl();
        patcherLocator(page);
    };
    app.windows().forEach(suivre);
    app.on('window', suivre);
    return app;
};

process.on('exit', (code) => {
    fs.writeFileSync(path.join(DOSSIER, 'manifeste.json'), JSON.stringify({ scenario: SCENARIO, t0, fin: Date.now(), code, fenetres, messages }, null, 1));
});
