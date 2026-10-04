// ============================================
// PRÉCOMPILATION DE L'INTERFACE (lot 3, tablettes)
// ============================================
// L'interface est écrite en JSX, transformé par Babel DANS LE NAVIGATEUR de chaque poste à chaque
// ouverture (≈ 13 000 lignes + 2,8 Mo pour Babel lui-même) : plusieurs secondes sur une tablette.
// Le serveur fait cette transformation UNE fois, avec exactement les mêmes réglages que Babel dans
// le navigateur, et sert une page qui n'a plus besoin de Babel.
// Page d'origine (transformation dans le navigateur) toujours disponible : /index.html?babel=1

const fs = require('fs');
const path = require('path');

// dossierCache (facultatif) : résultats gardés sur disque d'un lancement à l'autre, indexés par le
// contenu du fichier (un fichier modifié est retransformé)
// version (facultative) : version de l'application, écrite dans la page servie (un navigateur n'a
// pas accès à la version de l'application : il affichait celle notée en dur dans index.html)
const creerPrecompilation = (racine, dossierCache = null, { version = null } = {}) => {
    let Babel = null;
    const babel = () => Babel || (Babel = require(path.join(racine, 'libs', 'babel.min.js')));
    const cache = new Map();   // chemin → { mtime, code }

    // Mêmes réglages que Babel dans le navigateur (libs/babel.min.js, transformScriptTags)
    const OPTIONS = {
        presets: ['react', 'env'],
        plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
        sourceMaps: false,
    };
    const transformer = (code, nomFichier) => {
        const cle = require('crypto').createHash('sha1').update(JSON.stringify(OPTIONS) + '\n' + code).digest('hex');
        const surDisque = dossierCache && path.join(dossierCache, cle + '.js');
        if (surDisque && fs.existsSync(surDisque)) return fs.readFileSync(surDisque, 'utf8');
        const resultat = babel().transform(code, { ...OPTIONS, filename: nomFichier }).code;
        if (surDisque) { try { fs.mkdirSync(dossierCache, { recursive: true }); fs.writeFileSync(surDisque, resultat); } catch (e) { /* cache facultatif */ } }
        return resultat;
    };

    const enCache = (fichier, fabriquer) => {
        const mtime = fs.statSync(fichier).mtimeMs;
        const c = cache.get(fichier);
        if (c && c.mtime === mtime) return c.code;
        const code = fabriquer();
        cache.set(fichier, { mtime, code });
        return code;
    };

    return {
        // Script transformé (fichier .js/.jsx chargé par index.html en type="text/babel")
        script(fichier) {
            return enCache(fichier, () => transformer(fs.readFileSync(fichier, 'utf8'), path.basename(fichier)));
        },

        // index.html sans Babel : scripts externes pointés vers leur version transformée, scripts
        // intégrés transformés sur place ; l'ordre d'exécution est le même
        page(fichierIndex) {
            return enCache(fichierIndex, () => {
                let html = fs.readFileSync(fichierIndex, 'utf8');
                if (version) {
                    html = html.replace(/<meta name="ssf-version"\s+content="[^"]*">/, `<meta name="ssf-version" content="${version}">`);
                    html = html.replace(/[ \t]*<meta name="ssf-date"\s+content="[^"]*">\r?\n?/, '');
                }
                html = html.replace(/[ \t]*<script src="\.\/libs\/babel\.min\.js"><\/script>\r?\n?/, '');
                html = html.replace(/<script type="text\/babel" src="([^"]+)"><\/script>/g, (m, src) => `<script src="${src}?compile=1"></script>`);
                let n = 0;
                html = html.replace(/<script type="text\/babel">([\s\S]*?)<\/script>/g, (m, code) => {
                    n++;
                    // « </script » ne doit pas apparaître dans un script intégré
                    return `<script>${transformer(code, 'index.html (script ' + n + ')').replace(/<\/script/gi, '<\\/script')}</script>`;
                });
                return html;
            });
        },

        // Transformation de tout à l'avance (au démarrage), pour que la première ouverture soit rapide
        prechauffer(fichierIndex) {
            const html = fs.readFileSync(fichierIndex, 'utf8');
            this.page(fichierIndex);
            for (const [, src] of html.matchAll(/<script type="text\/babel" src="([^"]+)"><\/script>/g)) {
                this.script(path.join(racine, src));
            }
        },
    };
};

module.exports = { creerPrecompilation };
