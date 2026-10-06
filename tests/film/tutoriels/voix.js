// ============================================
// FILMS DE FORMATION : essai de narration (voix de synthèse)
// ============================================
// Ajoute une voix qui lit les explications (« dire ») d'un film déjà monté par monter.js.
// Chaque explication est lue au moment où elle s'affiche ; si la phrase précédente n'est pas
// finie, l'image se fige le temps qu'elle se termine (rien n'est coupé ni décalé).
//
// Utilisation (depuis C:\Projets\SSF) :
//   node tests/film/tutoriels/voix.js neurale|windows [id ...]
//     neurale : voix neuronale Microsoft (Denise, Internet) ; windows : Hortense (hors ligne)
//     sans id : tous les films, puis les films complets de chaque série (avec la voix)
// Prérequis voix neuronale : python -m pip install edge-tts truststore
// Résultat : tests/film/sortie/tutoriels/films-voix/<film> - voix <...>.mp4

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { TUTORIELS, GROUPES } = require('./liste');

const [moteur, ...ids] = process.argv.slice(2);
const MOTEURS = {
    windows: { libelle: 'voix Windows (Hortense)', ext: 'wav' },
    neurale: { libelle: 'voix neuronale (Denise)', ext: 'mp3' },
};
if (!MOTEURS[moteur]) { console.log('Utilisation : node tests/film/tutoriels/voix.js neurale|windows [id ...]'); process.exit(1); }

const trouverFfmpeg = () => {
    const paquets = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    const gyan = fs.existsSync(paquets) && fs.readdirSync(paquets).find(d => d.startsWith('Gyan.FFmpeg'));
    const build = gyan && fs.readdirSync(path.join(paquets, gyan)).find(d => d.startsWith('ffmpeg-'));
    return build ? path.join(paquets, gyan, build, 'bin') + path.sep : '';
};
const FF = trouverFfmpeg();
const SORTIE = path.join(__dirname, '..', 'sortie', 'tutoriels');
const FILMS_VOIX = path.join(SORTIE, 'films-voix');
fs.mkdirSync(FILMS_VOIX, { recursive: true });
const duree = f => Number(execFileSync(FF + 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const ffmpeg = (args, cwd) => execFileSync(FF + 'ffmpeg', ['-v', 'error', '-y', ...args], { cwd, stdio: ['ignore', 'inherit', 'inherit'] });

const narrer = (id) => {
const TRAVAIL = path.join(SORTIE, '_voix', id, moteur);
fs.mkdirSync(TRAVAIL, { recursive: true });

// Film monté et horaires des explications (mêmes calculs que monter.js)
const index = TUTORIELS.findIndex(t => t[0] === id);
const [, titre, , groupeId] = TUTORIELS[index];
const groupe = GROUPES.find(g => g.id === groupeId);
const numero = TUTORIELS.filter(t => t[3] === groupeId).findIndex(t => t[0] === id) + 1;
const nomFilm = `${groupe.prefixe}${String(numero).padStart(2, '0')} - ${titre.replace(/[\\/:*?"<>|]/g, '-')}`;
const film = path.join(SORTIE, 'films', nomFilm + '.mp4');
const journal = JSON.parse(fs.readFileSync(path.join(SORTIE, id, 'journal.json'), 'utf8'));
const dv = duree(journal.video);
const debutVideo = journal.fermeture - dv * 1000;
const marqueDebut = journal.marques.find(m => m.type === 'debut');
const coupe = Math.max(0, ((marqueDebut ? marqueDebut.t : debutVideo) - debutVideo) / 1000);
const marques = journal.marques.filter(m => !marqueDebut || m.t >= marqueDebut.t).map(m => ({ ...m, s: (m.t - debutVideo) / 1000 - coupe }));
const chapitres = marques.filter(m => m.type === 'chapitre');
const ouverture = Math.max(8, 5 + chapitres.length * 1.2);   // durée du carton d'ouverture

// Textes lus : le titre sur le carton d'ouverture, puis chaque chapitre et chaque explication
const parler = s => s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}]/gu, '')
    .replace(/[«»"›]/g, '').replace(/N°/g, 'numéro ').replace(/\s+/g, ' ').trim();
const textes = [{ t: 0.8, texte: `Application SSF. Film numéro ${numero} : ${titre}.` }];
for (const m of marques) {
    if (m.type === 'chapitre') textes.push({ t: ouverture + m.s, texte: parler(m.texte) + '.' });
    if (m.type === 'dire') textes.push({ t: ouverture + m.s + 0.3, texte: parler(m.texte) + (m.pourquoi ? ' Pourquoi ? ' + parler(m.pourquoi) : '') });
}

// Synthèse vocale (fichiers gardés : une phrase inchangée n'est pas refaite)
const fichiers = textes.map((x, i) => path.join(TRAVAIL, `${String(i).padStart(3, '0')}.${MOTEURS[moteur].ext}`));
const aFaire = textes.map((x, i) => ({ texte: x.texte, fichier: fichiers[i] }))
    .filter(x => !fs.existsSync(x.fichier) || fs.readFileSync(x.fichier + '.txt', 'utf8') !== x.texte);
if (aFaire.length) {
    const liste = path.join(TRAVAIL, 'a-faire.json');
    fs.writeFileSync(liste, JSON.stringify(aFaire), 'utf8');
    if (moteur === 'windows') {
        const ps = path.join(TRAVAIL, 'synthese.ps1');
        fs.writeFileSync(ps, `Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Hortense Desktop')
$s.Rate = 0
foreach ($x in (Get-Content -Raw -Encoding UTF8 '${liste}' | ConvertFrom-Json)) {
  $s.SetOutputToWaveFile($x.fichier); $s.Speak($x.texte); $s.SetOutputToNull()
}
`, 'utf8');
        execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps], { stdio: 'inherit' });
    } else {
        const py = path.join(TRAVAIL, 'synthese.py');
        fs.writeFileSync(py, `import json, asyncio, sys
import truststore; truststore.inject_into_ssl()
import edge_tts
async def main():
    for x in json.load(open(sys.argv[1], encoding='utf-8')):
        await edge_tts.Communicate(x['texte'], 'fr-FR-DeniseNeural').save(x['fichier'])
asyncio.run(main())
`, 'utf8');
        execFileSync('python', [py, liste], { stdio: 'inherit' });
    }
    for (const x of aFaire) fs.writeFileSync(x.fichier + '.txt', x.texte, 'utf8');
}

// Placement : chaque phrase à son heure ; si la précédente n'est pas finie, l'image se fige
// à cet endroit le temps qu'elle se termine (+ 0,4 s de respiration)
let decalage = 0, finPrec = 0;
const gels = [], placements = [];
textes.forEach((x, i) => {
    const d = duree(fichiers[i]);
    let debut = x.t + decalage;
    if (debut < finPrec + 0.4) { const g = finPrec + 0.4 - debut; gels.push({ t: x.t, d: g }); decalage += g; debut += g; }
    placements.push({ debut, d });
    finPrec = debut + d;
});
const total = duree(film) + decalage;

// Image : morceaux coupés aux points de gel, chacun prolongé par une image figée
const bornes = [0, ...gels.map(g => g.t), duree(film)];
const parties = [];
for (let j = 0; j < bornes.length - 1; j++) {
    const g = gels[j];
    parties.push(`[0:v]trim=start=${bornes[j].toFixed(3)}:end=${bornes[j + 1].toFixed(3)},setpts=PTS-STARTPTS${g ? `,tpad=stop_mode=clone:stop_duration=${g.d.toFixed(3)}` : ''}[p${j}]`);
}
parties.push(`${parties.map((_, j) => `[p${j}]`).join('')}concat=n=${parties.length}:v=1:a=0[v]`);
// Son : chaque phrase retardée à sa place, puis mélangées
const entrees = ['-i', film];
fichiers.forEach((f, i) => {
    entrees.push('-i', f);
    const ms = Math.round(placements[i].debut * 1000);
    parties.push(`[${i + 1}:a]aresample=44100,aformat=channel_layouts=mono,adelay=${ms}:all=1[a${i}]`);
});
parties.push(`${fichiers.map((_, i) => `[a${i}]`).join('')}amix=inputs=${fichiers.length}:normalize=0:duration=longest,apad,atrim=end=${total.toFixed(2)}[a]`);
fs.writeFileSync(path.join(TRAVAIL, 'filtre.txt'), parties.join(';\n'));
const sortie = path.join(FILMS_VOIX, `${nomFilm} - ${MOTEURS[moteur].libelle}.mp4`);
ffmpeg([...entrees, '-/filter_complex', 'filtre.txt', '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '1', '-t', total.toFixed(2), '-movflags', '+faststart', sortie], TRAVAIL);
console.log(`🎙️  ${path.basename(sortie)} : ${textes.length} phrases, ${gels.length} arrêt(s) sur image (+${decalage.toFixed(0)} s), ${(duree(sortie) / 60).toFixed(1)} min`);
return sortie;
};

// Tous les films (ou ceux demandés), puis un film complet par série si tous ont été faits
const choisis = ids.length ? ids : TUTORIELS.map(t => t[0]);
const faits = {};
for (const id of choisis) {
    if (!fs.existsSync(path.join(SORTIE, id, 'journal.json'))) { console.log(`⚠️ ${id} : pas encore tourné`); continue; }
    faits[id] = narrer(id);
}
if (!ids.length) {
    for (const groupe of GROUPES) {
        const films = TUTORIELS.filter(t => t[3] === groupe.id).map(t => faits[t[0]]);
        if (films.some(f => !f)) continue;
        const liste = path.join(FILMS_VOIX, `complet-${groupe.id}.txt`);
        // Noms relatifs (dossier courant = films-voix) ; apostrophe écrite '\'' pour ffmpeg
        fs.writeFileSync(liste, films.map(f => "file '" + path.basename(f).split("'").join("'\\''") + "'").join('\n'), 'utf8');
        const complet = path.join(FILMS_VOIX, `${groupe.filmComplet} - ${MOTEURS[moteur].libelle}.mp4`);
        ffmpeg(['-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', '-movflags', '+faststart', complet], FILMS_VOIX);
        fs.rmSync(liste);
        console.log(`🎞️  ${path.basename(complet)} (${(duree(complet) / 60).toFixed(1)} min)`);
    }
}
