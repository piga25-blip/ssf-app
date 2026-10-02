// ============================================
// FILM DES SCÉNARIOS : tournage
// ============================================
// Rejoue chaque scénario qui pilote l'interface en le filmant (film-hook.js : vidéo de chaque
// fenêtre, actions ralenties et surlignées, messages du test notés pour les sous-titres).
// Les tests ne sont pas modifiés. Un scénario qui échoue est relancé une fois (le ralenti et
// l'enregistrement chargent la machine : les tests « au même instant » y sont sensibles).
//
// Utilisation (depuis C:\Projets\SSF-Reseau) :
//   node tests/film/tourner.js                      → tous les scénarios
//   node tests/film/tourner.js verif-reseau ...     → seulement ceux-là
// Puis : node tests/film/monter.js                  → film MP4 (ffmpeg requis)
// Vidéos et journaux dans tests/film/sortie/ (non suivi par git).

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..', '..');
const SORTIE = path.join(__dirname, 'sortie');
const VIDEOS = path.join(SORTIE, 'videos');
const { SCENARIOS } = require('./etapes');

// Plusieurs postes en 3 colonnes : vidéo plus petite, pour moins charger la machine
const LARGEUR = { 'verif-saisie-multiposte': 700 };

const choisis = process.argv.slice(2);
const liste = SCENARIOS.map(s => s[0]).filter(id => !choisis.length || choisis.includes(id));
fs.mkdirSync(VIDEOS, { recursive: true });

const bilan = [];
for (const id of liste) {
    let code = 1;
    for (let essai = 1; essai <= 2 && code !== 0; essai++) {
        fs.rmSync(path.join(VIDEOS, id), { recursive: true, force: true });
        const journal = path.join(SORTIE, `log-${id}.txt`);
        const r = spawnSync(process.execPath, ['-r', path.join(__dirname, 'film-hook.js'), path.join('tests', id + '.js')], {
            cwd: RACINE,
            env: { ...process.env, FILM_DIR: VIDEOS, FILM_SCENARIO: id, ...(LARGEUR[id] ? { FILM_LARGEUR: String(LARGEUR[id]) } : {}) },
            encoding: 'utf8',
        });
        fs.writeFileSync(journal, (r.stdout || '') + (r.stderr || ''));
        code = r.status;
        console.log(`${code === 0 ? '✅' : '❌'} ${id}${essai > 1 ? ' (2e essai)' : ''}`);
    }
    bilan.push(code === 0);
}
const ok = bilan.every(Boolean);
console.log(ok ? '\n🎬 Tournage terminé : node tests/film/monter.js pour monter le film.' : '\n❌ Scénario(s) en échec : voir tests/film/sortie/log-*.txt');
process.exitCode = ok ? 0 : 1;
