// ============================================
// FILM DES SCÉNARIOS : montage
// ============================================
// Monte le film à partir des vidéos tournées par tourner.js : carton de titre + vidéo(s) de
// chaque scénario (postes côte à côte quand plusieurs fenêtres sont ouvertes en même temps)
// + sous-titres tirés des messages du test.
// Utilisation (depuis C:ProjetsSSF-Reseau) :
//   node tests/film/monter.js [fichier.mp4]   → par défaut tests/film/sortie/SSF-Reseau-scenarios.mp4
// Nécessite ffmpeg (winget install Gyan.FFmpeg --source winget) : trouvé dans le PATH, dans
// FFMPEG_DIR, ou dans le dossier d'installation de winget.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const trouverFfmpeg = () => {
    if (process.env.FFMPEG_DIR) return path.join(process.env.FFMPEG_DIR) + path.sep;
    try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return ''; } catch (e) {}
    const paquets = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    const gyan = fs.existsSync(paquets) && fs.readdirSync(paquets).find(d => d.startsWith('Gyan.FFmpeg'));
    const build = gyan && fs.readdirSync(path.join(paquets, gyan)).find(d => d.startsWith('ffmpeg-'));
    if (build) return path.join(paquets, gyan, build, 'bin') + path.sep;
    throw new Error('ffmpeg introuvable : winget install Gyan.FFmpeg --source winget');
};
const FF = trouverFfmpeg();
const ICI = path.join(__dirname, 'sortie');
const VIDEOS = path.join(ICI, 'videos');
const TRAVAIL = path.join(ICI, 'montage');
const SORTIE = path.resolve(process.argv[2] || path.join(ICI, 'SSF-Reseau-scenarios.mp4'));
const { SCENARIOS, ETAPES } = require('./etapes');
fs.rmSync(TRAVAIL, { recursive: true, force: true });
fs.mkdirSync(TRAVAIL, { recursive: true });
fs.copyFileSync('C:\\Windows\\Fonts\\arial.ttf', path.join(TRAVAIL, 'arial.ttf'));
fs.copyFileSync('C:\\Windows\\Fonts\\arialbd.ttf', path.join(TRAVAIL, 'arialbd.ttf'));


const ffprobeDuree = f => Number(execFileSync(FF + 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const ffmpeg = (args) => execFileSync(FF + 'ffmpeg', ['-v', 'error', '-y', ...args], { cwd: TRAVAIL, stdio: ['ignore', 'inherit', 'inherit'] });
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '25', '-an'];

// Coupe un texte en lignes d'au plus n caractères
const couper = (t, n) => {
    const lignes = []; let l = '';
    for (const m of t.split(' ')) { if ((l + ' ' + m).trim().length > n) { lignes.push(l); l = m; } else l = (l + ' ' + m).trim(); }
    if (l) lignes.push(l);
    return lignes.join('\n');
};
const fichierTexte = (nom, texte) => { fs.writeFileSync(path.join(TRAVAIL, nom), texte, 'utf8'); return nom; };
const hms = s => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

const carton = (nom, surtitre, titre, texte, duree) => {
    const f = [
        `drawtext=fontfile=arial.ttf:textfile=${fichierTexte(nom + '-a.txt', surtitre)}:fontcolor=0x93c5fd:fontsize=40:x=(w-tw)/2:y=330`,
        `drawtext=fontfile=arialbd.ttf:textfile=${fichierTexte(nom + '-b.txt', titre)}:fontcolor=white:fontsize=72:x=(w-tw)/2:y=410`,
        `drawtext=fontfile=arial.ttf:textfile=${fichierTexte(nom + '-c.txt', couper(texte, 70))}:fontcolor=0xe2e8f0:fontsize=38:line_spacing=14:x=(w-tw)/2:y=560`,
        `fade=in:st=0:d=0.4,fade=out:st=${duree - 0.4}:d=0.4`,
    ].join(',');
    ffmpeg(['-f', 'lavfi', '-i', `color=c=0x0f172a:s=1920x1080:r=25:d=${duree}`, '-vf', f, ...ENC, nom + '.mp4']);
    return nom + '.mp4';
};

// « ▶ 05-arrivee-sauveteurs  [08:01:18] » → « Étape 05 : Arrivée des sauveteurs (heure du secours 08:01) »
const joli = t => {
    const m = t.match(/^▶ (\d+[a-z]?)-(\S+)\s+\[(.+)\]/);
    return m ? `Étape ${m[1]} : ${ETAPES[m[2]] || m[2]}  (heure du secours ${m[3].slice(0, 5)})` : t;
};

const morceaux = [];
morceaux.push(carton('00-intro', 'Application SSF — version réseau', 'Les scénarios de vérification', 'Chaque scénario pilote la vraie application comme un secrétaire. Les actions sont ralenties et l\'élément cliqué est entouré en rouge. En bas : les contrôles effectués.', 7));

SCENARIOS.forEach(([id, titre, texte], i) => {
    const manifeste = path.join(VIDEOS, id, 'manifeste.json');
    if (!fs.existsSync(manifeste)) { console.log(`⚠️ ${id} : pas de manifeste, ignoré`); return; }
    const m = JSON.parse(fs.readFileSync(manifeste, 'utf8'));
    const fen = m.fenetres
        .filter(f => f.video && fs.existsSync(f.video) && /^https?:/.test(f.url))
        .map(f => ({ ...f, duree: ffprobeDuree(f.video) }))
        .filter(f => f.duree > 1.5)
        .sort((a, b) => a.debut - b.debut);
    if (!fen.length) { console.log(`⚠️ ${id} : aucune vidéo, ignoré`); return; }
    const n = String(i + 1).padStart(2, '0');
    morceaux.push(carton(`${n}-titre`, `Scénario ${i + 1} / ${SCENARIOS.length}`, titre, texte, 5));

    // Répartition en colonnes : une fenêtre va dans la première colonne libre (même rôle d'abord)
    const colonnes = [];
    for (const f of fen) {
        let c = colonnes.find(c => c.role === f.role && c.fin <= f.debut) || colonnes.find(c => c.fin <= f.debut && c.role === f.role);
        if (!c) { c = { role: f.role, fin: 0, fen: [] }; colonnes.push(c); }
        c.fen.push(f); c.fin = f.debut + f.duree * 1000;
    }
    colonnes.sort((a, b) => (a.role === 'principal' ? 0 : 1) - (b.role === 'principal' ? 0 : 1));
    const debut = fen[0].debut;
    const fin = Math.max(...fen.map(f => f.debut + f.duree * 1000));
    const duree = (fin - debut) / 1000 + 3;   // 3 s de plus pour lire le dernier contrôle

    const nc = colonnes.length;
    const W = nc === 1 ? 1680 : Math.floor((1920 - (nc + 1) * 16) / nc / 2) * 2;
    const H = Math.floor(W * 900 / 1400 / 2) * 2;
    const Y = nc === 1 ? 0 : 140;
    const entrees = ['-f', 'lavfi', '-i', `color=c=0x0f172a:s=1920x1080:r=25:d=${duree.toFixed(2)}`];
    const filtres = []; let base = '0:v'; let k = 0; let autre = 0;
    colonnes.forEach((c, ci) => {
        const X = nc === 1 ? 120 : 16 + ci * (W + 16);
        if (nc > 1) {
            const lib = c.role === 'principal' ? 'Poste principal (PC)' : `Autre poste${colonnes.filter(x => x.role !== 'principal').length > 1 ? ' ' + (++autre) : ''} (navigateur / tablette)`;
            filtres.push(`[${base}]drawtext=fontfile=arialbd.ttf:textfile=${fichierTexte(`${n}-col${ci}.txt`, lib)}:fontcolor=white:fontsize=34:x=${X}+(${W}-tw)/2:y=${Y - 55}[l${ci}]`);
            base = `l${ci}`;
        }
        for (const f of c.fen) {
            k++;
            entrees.push('-i', f.video);
            const dec = ((f.debut - debut) / 1000).toFixed(3);
            filtres.push(`[${k}:v]fps=25,scale=${W}:${H},setpts=PTS-STARTPTS+${dec}/TB[v${k}]`);
            filtres.push(`[${base}][v${k}]overlay=x=${X}:y=${Y}:eof_action=pass[o${k}]`);
            base = `o${k}`;
        }
    });

    // Sous-titres : chaque message du test, jusqu'au suivant (entre 2,5 et 5 s)
    const msgs = m.messages.filter(x => x.t >= debut - 2000).map(x => ({ t: Math.max(0, (x.t - debut) / 1000), texte: joli(x.texte.split('\n')[0]).slice(0, 110) }));
    const srt = msgs.map((x, j) => {
        const suiv = msgs[j + 1] ? msgs[j + 1].t : duree;
        const f2 = Math.min(duree, x.t + Math.min(5, Math.max(2.5, suiv - x.t)));
        return `${j + 1}\n${hms(x.t)} --> ${hms(f2)}\n${x.texte}\n`;
    }).join('\n');
    fichierTexte(`${n}.srt`, srt);
    filtres.push(`[${base}]subtitles=${n}.srt:fontsdir=.:force_style='FontName=Arial,FontSize=11,BorderStyle=3,Outline=3,Shadow=0,BackColour=&H40000000,MarginV=18'[s]`);
    filtres.push(`[s]fade=in:st=0:d=0.3,fade=out:st=${(duree - 0.4).toFixed(2)}:d=0.4[fin]`);
    fs.writeFileSync(path.join(TRAVAIL, `${n}.filtre`), filtres.join(';\n'));
    ffmpeg([...entrees, '-/filter_complex', `${n}.filtre`, '-map', '[fin]', '-t', duree.toFixed(2), ...ENC, `${n}-video.mp4`]);
    morceaux.push(`${n}-video.mp4`);
    console.log(`✅ ${id} : ${fen.length} fenêtre(s), ${nc} colonne(s), ${duree.toFixed(0)} s`);
});

morceaux.push(carton('99-fin', 'Application SSF — version réseau', 'Fin', 'Tous les scénarios ont été rejoués sur la vraie application.', 4));
fs.writeFileSync(path.join(TRAVAIL, 'liste.txt'), morceaux.map(f => `file '${f}'`).join('\n'));
ffmpeg(['-f', 'concat', '-safe', '0', '-i', 'liste.txt', '-c', 'copy', '-movflags', '+faststart', SORTIE]);
console.log(`🎬 Film : ${SORTIE} (${(ffprobeDuree(SORTIE) / 60).toFixed(1)} min)`);
