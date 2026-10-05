// ============================================
// FILMS DE FORMATION : tournage
// ============================================
// Tourne chaque tutoriel de liste.js (rythme de démonstration, fenêtre visible). Un tutoriel
// qui échoue est relancé une fois.
// Utilisation (depuis C:\Projets\SSF) :
//   node tests/film/tutoriels/tourner.js [id ...]     puis     node tests/film/tutoriels/monter.js
// Mise au point d'un tutoriel sans pauses : FILM_RAPIDE=1 node tests/film/tutoriels/<id>.js
// (capture de chaque chapitre dans tests/film/sortie/tutoriels/_ecrans).

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { TUTORIELS } = require('./liste');

const RACINE = path.join(__dirname, '..', '..', '..');
const JOURNAUX = path.join(__dirname, '..', 'sortie', 'tutoriels');
fs.mkdirSync(JOURNAUX, { recursive: true });
const choisis = process.argv.slice(2);
let ok = true;
for (const [id] of TUTORIELS) {
    if (choisis.length && !choisis.includes(id)) continue;
    let code = 1;
    for (let essai = 1; essai <= 2 && code !== 0; essai++) {
        const r = spawnSync(process.execPath, [path.join(__dirname, id + '.js')], { cwd: RACINE, env: { ...process.env, FILM_RAPIDE: '' }, encoding: 'utf8' });
        fs.writeFileSync(path.join(JOURNAUX, `log-${id}.txt`), (r.stdout || '') + (r.stderr || ''));
        code = r.status;
        console.log(`${code === 0 ? '✅' : '❌'} ${id}${essai > 1 ? ' (2e essai)' : ''}`);
    }
    ok = ok && code === 0;
}
console.log(ok ? '\n🎬 Tournage terminé : node tests/film/tutoriels/monter.js' : '\n❌ Tutoriel(s) en échec : voir tests/film/sortie/tutoriels/log-*.txt');
process.exitCode = ok ? 0 : 1;
