// ============================================
// FILMS DE FORMATION : outils communs
// ============================================
// Pilote la vraie application à un rythme de démonstration : pointeur de souris visible qui
// rejoint chaque élément, élément entouré avant l'action, saisie lettre par lettre, pauses
// longues. Les explications (dire) sont notées avec leur heure : le montage les affiche dans
// un panneau à droite de la vidéo. Messages de l'application (alert / confirm) affichés à
// l'écran au lieu de bloquer.
//
// FILM_RAPIDE=1 : sans pauses (pour mettre au point un tutoriel).

const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');
const { fenetrePrincipale } = require('../../outils-fichiers');

const RACINE = path.join(__dirname, '..', '..', '..');
const NAVIGATEUR = path.join(RACINE, 'tests', 'aides', 'navigateur');
const SORTIE = path.join(__dirname, '..', 'sortie', 'tutoriels');
const RAPIDE = process.env.FILM_RAPIDE === '1';

// Rythme (secondes)
const RYTHME = {
    avantAction: 1.6,      // pointeur sur l'élément, entouré, avant le clic
    apresAction: 2.2,      // laisser voir le résultat
    lettre: 0.07,          // saisie lettre par lettre
    lecture: (texte) => 2.5 + texte.split(/\s+/).length / 2.3, // ≈ 140 mots/min + marge
};

const pause = (s) => new Promise(r => setTimeout(r, RAPIDE ? Math.min(s * 1000, 150) : s * 1000));

// Scripts injectés dans la page : pointeur, surlignage, messages de l'application
const scriptPage = () => {
    const installer = () => {
        if (document.getElementById('__film_curseur')) return;
        const style = document.createElement('style');
        style.textContent = `
            #__film_curseur { position: fixed; left: 700px; top: 450px; width: 30px; height: 30px; z-index: 2147483647;
                pointer-events: none; transition: left .9s ease-in-out, top .9s ease-in-out; }
            #__film_curseur svg { filter: drop-shadow(1px 2px 2px rgba(0,0,0,.45)); }
            .__film_onde { position: fixed; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%;
                border: 3px solid #ff2d55; z-index: 2147483646; pointer-events: none; animation: __film_onde .7s ease-out forwards; }
            @keyframes __film_onde { to { transform: scale(4); opacity: 0; } }
            #__film_messages { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483645;
                display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: 760px; }
            .__film_message { background: #1e293b; color: #fff; padding: 14px 20px; border-radius: 10px; font: 16px/1.4 Arial, sans-serif;
                box-shadow: 0 8px 24px rgba(0,0,0,.35); border-left: 6px solid #facc15; white-space: pre-line; }
            .__film_message b { color: #facc15; }`;
        document.head.appendChild(style);
        const c = document.createElement('div');
        c.id = '__film_curseur';
        c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M3 2 L3 20 L8 15 L11.5 22 L14.5 20.5 L11 13.8 L18 13.8 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
        document.body.appendChild(c);
        const m = document.createElement('div');
        m.id = '__film_messages';
        document.body.appendChild(m);
    };
    window.__film = {
        curseur: (x, y) => { installer(); const c = document.getElementById('__film_curseur'); c.style.left = x + 'px'; c.style.top = y + 'px'; },
        onde: (x, y) => { installer(); const o = document.createElement('div'); o.className = '__film_onde'; o.dataset.vie = 2; o.style.left = x + 'px'; o.style.top = y + 'px'; document.body.appendChild(o); },
        message: (titre, texte, ms = 5000) => {
            installer();
            const d = document.createElement('div'); d.className = '__film_message';
            d.innerHTML = `<b>${titre}</b><br>`; d.appendChild(document.createTextNode(texte));
            d.dataset.vie = Math.round(ms / 500); document.getElementById('__film_messages').appendChild(d);
        },
        // Appelé toutes les 500 ms depuis le test (l'horloge de la page est arrêtée : pas de setTimeout)
        vieillir: (tout) => document.querySelectorAll('.__film_message, .__film_onde').forEach(e => {
            e.dataset.vie = tout ? 0 : Number(e.dataset.vie) - 1;
            if (Number(e.dataset.vie) <= 0) e.remove();
        }),
    };
    window.alert = (msg) => window.__film.message('💬 Message de l\'application', String(msg));
    window.confirm = (msg) => { window.__film.message('❓ Question de l\'application → réponse : OK', String(msg), 7000); return true; };
    if (document.readyState !== 'loading') installer(); else document.addEventListener('DOMContentLoaded', installer);
};

// Démarre l'application (dossier de données jetable), horloge fictive qui part de `debut` et
// avance normalement (avancer() la fait sauter en avant)
const demarrer = async (id, { debut = new Date(2026, 2, 14, 8, 0, 0), env = {} } = {}) => {
    // Mise au point (FILM_RAPIDE) : dossier à part, pour ne jamais écraser l'enregistrement réel
    const dossierVideo = path.join(SORTIE, RAPIDE ? id + '-rapide' : id);
    fs.rmSync(dossierVideo, { recursive: true, force: true });
    fs.mkdirSync(dossierVideo, { recursive: true });
    const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-tuto-'));
    const app = await electron.launch({
        args: [RACINE], cwd: RACINE,
        env: { ...process.env, SSF_TEST_USER_DATA: donnees, SSF_PORT: '0', ...env },
        recordVideo: { dir: dossierVideo, size: { width: 1400, height: 900 } },
    });
    const page = await fenetrePrincipale(app);
    await app.context().addInitScript(scriptPage);
    // debut: 'reel' : horloge réelle (films réseau : les autres postes sont datés par le PC principal à l'heure réelle)
    if (debut !== 'reel') await page.clock.install({ time: debut });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
    await page.waitForTimeout(1500);

    const journal = { id, videoDebut: Date.now(), marques: [] };
    const minuterie = setInterval(() => page.evaluate(() => window.__film && window.__film.vieillir()).catch(() => {}), 500);
    const video = page.video();
    const t = new Tuto(page, journal);

    // Un autre poste qui ouvre `url` (fenêtre de navigateur, comme Chrome sur un autre appareil),
    // filmé lui aussi ; `nom` est l'étiquette affichée sous sa vidéo au montage.
    // ouvrirTablette : tablette en portrait ; ouvrirPoste({ largeur: 1400, hauteur: 900 }) : ordinateur
    const postes = [];
    t.ouvrirPoste = async (url, { largeur = 768, hauteur = 1000, nom = 'Tablette' } = {}) => {
        const donneesT = fs.mkdtempSync(path.join(os.tmpdir(), 'ssf-tuto-poste-'));
        const nav = await electron.launch({
            args: [NAVIGATEUR],
            env: { ...process.env, SSF_TEST_USER_DATA: donneesT, SSF_URL: url, SSF_TAILLE: `${largeur}x${hauteur}` },
            recordVideo: { dir: path.join(dossierVideo, 'poste-' + (postes.length + 1)), size: { width: largeur, height: hauteur } },
        });
        const pt = await nav.firstWindow();
        await nav.context().addInitScript(scriptPage);
        await pt.reload();
        await pt.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 60000 });
        const tt = new Tuto(pt, journal);
        tt.enPreparation = t.enPreparation;
        postes.push({ nav, video: pt.video(), donneesT, largeur, hauteur, nom,
            minuterie: setInterval(() => pt.evaluate(() => window.__film && window.__film.vieillir()).catch(() => {}), 500) });
        return tt;
    };
    // 768×1000 (format iPad) : la fenêtre doit tenir à l'écran, sinon Windows la raccourcit
    // et la vidéo garde une bande grise
    t.ouvrirTablette = (url, options = {}) => t.ouvrirPoste(url, { largeur: 768, hauteur: 1000, nom: 'Tablette', ...options });

    t.fermer = async () => {
        journal.postes = [];
        for (const tb of postes) {
            clearInterval(tb.minuterie);
            const videoT = tb.video ? await tb.video.path() : null;
            await tb.nav.close().catch(() => {});
            journal.postes.push({ video: videoT, fermeture: Date.now(), largeur: tb.largeur, hauteur: tb.hauteur, nom: tb.nom });
            try { fs.rmSync(tb.donneesT, { recursive: true, force: true }); } catch (e) { /* encore verrouillé */ }
        }
        if (journal.postes.length === 1) journal.tablette = journal.postes[0];
        clearInterval(minuterie);
        journal.video = video ? await video.path() : null;
        journal.fin = Date.now();
        await app.close().catch(() => {});
        journal.fermeture = Date.now();   // la vidéo se termine ici (sert à caler les explications)
        fs.writeFileSync(path.join(dossierVideo, 'journal.json'), JSON.stringify(journal, null, 1));
        try { fs.rmSync(donnees, { recursive: true, force: true }); } catch (e) { /* encore verrouillé : dossier temporaire laissé */ }
    };
    return t;
};

class Tuto {
    constructor(page, journal) { this.page = page; this.journal = journal; this.enPreparation = true; this.nChap = 0; }

    noter(type, texte, extra = {}) { this.journal.marques.push({ t: Date.now(), type, texte, ...extra }); }

    // Fin de la préparation (non montrée) : le film commence ici
    async debutFilm() { await this.page.evaluate(() => window.__film && window.__film.vieillir(true)).catch(() => {}); this.enPreparation = false; await pause(0.5); this.noter('debut'); await pause(1); }

    // Titre de la partie (bandeau du haut)
    async chapitre(titre) {
        if (RAPIDE) await this.decrire(`${this.journal.id}-${String(++this.nChap).padStart(2, '0')}`).catch(() => {});
        this.noter('chapitre', titre); await pause(1.5);
    }

    // Explication affichée à droite : ce qu'on fait, et pourquoi
    async dire(texte, pourquoi = null) {
        this.noter('dire', texte, pourquoi ? { pourquoi } : {});
        if (!this.enPreparation) await pause(RYTHME.lecture(texte + ' ' + (pourquoi || '')));
    }

    // Avancer l'horloge de l'application (minutes)
    async avancer(minutes, texte = null) {
        if (texte) await this.dire(texte);
        await this.page.clock.fastForward(minutes * 60000);
        await pause(1);
    }

    async rythme(s) { if (!this.enPreparation) await pause(s); else await pause(0.1); }

    // Pointeur sur l'élément + contour, puis action
    async viser(locator) {
        await locator.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        await locator.first().scrollIntoViewIfNeeded().catch(() => {});
        const b = await locator.first().boundingBox().catch(() => null);
        if (b && !this.enPreparation) {
            const x = b.x + Math.min(b.width / 2, 40), y = b.y + b.height / 2;
            await this.page.evaluate(([x, y]) => window.__film && window.__film.curseur(x, y), [x, y]).catch(() => {});
            await locator.first().evaluate(el => { el.__o = el.style.outline; el.__oo = el.style.outlineOffset; el.style.outline = '4px solid #ff2d55'; el.style.outlineOffset = '2px'; }).catch(() => {});
            await pause(RYTHME.avantAction);
            await locator.first().evaluate(el => { el.style.outline = el.__o || ''; el.style.outlineOffset = el.__oo || ''; }).catch(() => {});
            return { x, y };
        }
        return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
    }

    async onde(p) { if (p && !this.enPreparation) await this.page.evaluate(([x, y]) => window.__film && window.__film.onde(x, y), [p.x, p.y]).catch(() => {}); }

    async clic(locator, options = {}) {
        const p = await this.viser(locator);
        await this.onde(p);
        await locator.first().click(options);
        await this.rythme(RYTHME.apresAction);
    }

    async cocher(locator) {
        const p = await this.viser(locator);
        await this.onde(p);
        await locator.first().check();
        await this.rythme(1.2);
    }

    // options.iso : valeur à utiliser sans frappe (champs date / heure : la frappe suit le format affiché)
    async saisir(locator, texte, options = {}) {
        const p = await this.viser(locator);
        await this.onde(p);
        await locator.first().click();
        if (!options.iso) await locator.first().fill('');
        if (this.enPreparation || RAPIDE) await locator.first().fill(String(options.iso || texte));
        else await locator.first().pressSequentially(String(texte), { delay: RYTHME.lettre * 1000 });
        await this.rythme(1.2);
    }

    // Glisser d'un élément à un autre (sélection de cases, poignée de recopie…)
    // arrivee : un élément, ou { x, y } (position dans la fenêtre)
    async glisser(depart, arrivee) {
        const a = await this.viser(depart);
        await depart.first().hover();
        await this.page.mouse.down();
        const b = arrivee.first ? await arrivee.first().boundingBox() : { x: arrivee.x, y: arrivee.y, width: 0, height: 0 };
        if (b && !this.enPreparation) {
            await this.page.evaluate(([x, y]) => window.__film && window.__film.curseur(x, y), [b.x + b.width / 2, b.y + b.height / 2]).catch(() => {});
        }
        if (arrivee.first) await arrivee.first().hover({ steps: 12 });
        else await this.page.mouse.move(arrivee.x, arrivee.y, { steps: 12 });
        await this.rythme(0.9);
        await this.page.mouse.up();
        await this.rythme(RYTHME.apresAction);
        return a;
    }

    // Ajoute du texte à la fin d'un champ déjà rempli
    async completer(locator, texte) {
        const p = await this.viser(locator);
        await this.onde(p);
        await locator.first().click();
        await locator.first().press('Control+End');
        if (this.enPreparation || RAPIDE) await locator.first().fill((await locator.first().inputValue()) + texte);
        else await locator.first().pressSequentially(texte, { delay: RYTHME.lettre * 1000 });
        await this.rythme(1.2);
    }

    async choisir(locator, valeur) {
        const p = await this.viser(locator);
        await this.onde(p);
        await locator.first().selectOption(valeur);
        await this.rythme(1.5);
    }

    async fichier(locatorVisible, inputFichier, chemin) {
        const p = await this.viser(locatorVisible);
        await this.onde(p);
        await inputFichier.setInputFiles(chemin);
        await this.rythme(RYTHME.apresAction);
    }

    // Raccourcis
    bouton(texte, { dernier = false, rang = 0 } = {}) {
        const l = this.page.locator('button:visible', { hasText: texte });
        return dernier ? l.last() : l.nth(rang);
    }
    champ(placeholder, rang = 0) {
        return this.page.locator(`input[placeholder="${placeholder}"]:visible, textarea[placeholder="${placeholder}"]:visible`).nth(rang);
    }
    etiquette(texte, { dernier = false } = {}) {
        const l = this.page.locator('label:visible', { hasText: texte });
        return dernier ? l.last() : l.first();
    }

    // Capture + description de l'écran (mise au point)
    async decrire(nom) {
        const dossier = path.join(SORTIE, '_ecrans');
        fs.mkdirSync(dossier, { recursive: true });
        await this.page.screenshot({ path: path.join(dossier, nom + '.png') });
        const info = await this.page.evaluate(() => {
            const vis = sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent);
            return {
                titres: vis('h1,h2,h3,h4').map(h => h.innerText.trim().slice(0, 80)),
                boutons: vis('button').map(b => b.innerText.trim().replace(/\s+/g, ' ').slice(0, 60)),
                champs: vis('input,select,textarea').map(i => `${i.tagName.toLowerCase()}[${i.type}] ph="${i.placeholder || ''}" v="${(i.value || '').slice(0, 30)}"`),
            };
        });
        fs.writeFileSync(path.join(dossier, nom + '.json'), JSON.stringify(info, null, 1));
    }
}

// Actions au même instant sur plusieurs postes : [[poste, locator], …] — chaque élément est visé
// (pointeur, contour) en parallèle, puis tous les clics partent ensemble
const simultane = async (cibles) => {
    const points = await Promise.all(cibles.map(([poste, l]) => poste.viser(l)));
    await Promise.all(cibles.map(([poste], i) => poste.onde(points[i])));
    await Promise.all(cibles.map(([, l]) => l.first().click()));
    await pause(RYTHME.apresAction);
};

// Exécute un tutoriel : fonction (t) => {...}, avec capture d'écran en cas d'erreur
const executer = (id, titre, fn, options) => {
    (async () => {
        const t = await demarrer(id, options);
        t.noter('titre', titre);
        try {
            await fn(t);
            await t.rythme(3);
            console.log(`✅ ${id}`);
        } catch (e) {
            await t.decrire(`ERREUR-${id}`).catch(() => {});
            console.error(`❌ ${id} :`, e.message);
            process.exitCode = 1;
        } finally {
            await t.fermer();
        }
    })();
};

module.exports = { executer, simultane, RACINE };
