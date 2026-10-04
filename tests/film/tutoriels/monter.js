// ============================================
// FILMS DE FORMATION : montage
// ============================================
// Pour chaque tutoriel tourné (sortie/tutoriels/<id>/journal.json + vidéo) : carton d'ouverture
// avec le programme, puis la vidéo (1400×900, à gauche) avec le bandeau du chapitre en haut et
// les explications (« dire ») dans un panneau à droite. Un MP4 par tutoriel + un film complet.
// Utilisation (depuis C:\Projets\SSF-Reseau) : node tests/film/tutoriels/monter.js [id ...]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { TUTORIELS, GROUPES } = require('./liste');

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
const SORTIE = path.join(__dirname, '..', 'sortie', 'tutoriels');
const TRAVAIL = path.join(SORTIE, '_montage');
const FILMS = path.join(SORTIE, 'films');
fs.rmSync(TRAVAIL, { recursive: true, force: true });
fs.mkdirSync(TRAVAIL, { recursive: true });
fs.mkdirSync(FILMS, { recursive: true });
fs.copyFileSync('C:\\Windows\\Fonts\\arial.ttf', path.join(TRAVAIL, 'arial.ttf'));
fs.copyFileSync('C:\\Windows\\Fonts\\arialbd.ttf', path.join(TRAVAIL, 'arialbd.ttf'));

const duree = f => Number(execFileSync(FF + 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const ffmpeg = (args) => execFileSync(FF + 'ffmpeg', ['-v', 'error', '-y', ...args], { cwd: TRAVAIL, stdio: ['ignore', 'inherit', 'inherit'] });
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '25', '-an'];
const FOND = '0x0f172a';

const couper = (t, n) => {
    const lignes = []; let l = '';
    for (const m of t.split(' ')) { if ((l + ' ' + m).trim().length > n) { lignes.push(l); l = m; } else l = (l + ' ' + m).trim(); }
    if (l) lignes.push(l);
    return lignes.join('\n');
};
const ecrire = (nom, texte) => { fs.writeFileSync(path.join(TRAVAIL, nom), texte, 'utf8'); return nom; };
const ts = s => { const cs = Math.max(0, Math.round(s * 100)); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
// Texte pour les sous-titres ASS ; \h = espace insécable (pas de « : » ou de « » » seul en début de ligne)
const assTexte = s => s.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N')
    .replace(/ ([:;?!»])/g, '\\h$1').replace(/« /g, '«\\h');

const carton = (nom, lignes, d) => {
    // lignes : [{ texte, taille, couleur, gras, y }]
    const f = lignes.map((l, i) => `drawtext=fontfile=${l.gras ? 'arialbd' : 'arial'}.ttf:textfile=${ecrire(`${nom}-${i}.txt`, l.texte)}:fontcolor=${l.couleur || 'white'}:fontsize=${l.taille}:line_spacing=${l.interligne || 12}:x=${l.x === undefined ? '(w-tw)/2' : l.x}:y=${l.y}`);
    f.push(`fade=in:st=0:d=0.5,fade=out:st=${d - 0.5}:d=0.5`);
    ffmpeg(['-f', 'lavfi', '-i', `color=c=${FOND}:s=1920x1080:r=25:d=${d}`, '-vf', f.join(','), ...ENC, nom + '.mp4']);
    return nom + '.mp4';
};

const monter = (id, numero, titre, resume, groupe) => {
    const dossier = path.join(SORTIE, id);
    const journal = JSON.parse(fs.readFileSync(path.join(dossier, 'journal.json'), 'utf8'));
    const video = journal.video;
    const dv = duree(video);
    const debutVideo = journal.fermeture - dv * 1000;           // la vidéo s'arrête à la fermeture
    const marqueDebut = journal.marques.find(m => m.type === 'debut');
    const coupe = Math.max(0, ((marqueDebut ? marqueDebut.t : debutVideo) - debutVideo) / 1000);
    const marques = journal.marques.filter(m => !marqueDebut || m.t >= marqueDebut.t).map(m => ({ ...m, s: (m.t - debutVideo) / 1000 - coupe }));
    const total = dv - coupe;
    const tablette = journal.tablette && journal.tablette.video && fs.existsSync(journal.tablette.video) ? journal.tablette : null;
    const chapitres = marques.filter(m => m.type === 'chapitre');

    // Carton d'ouverture : titre + programme
    const programme = chapitres.map((c, i) => `${i + 1}.  ${c.texte}`).join('\n');
    const ouverture = carton(`${id}-ouverture`, [
        { texte: `Application SSF — ${groupe.serie}, film n° ${numero}`, taille: 36, couleur: '0x93c5fd', y: 170 },
        { texte: titre, taille: 74, gras: true, y: 235 },
        { texte: couper(resume, 75), taille: 34, couleur: '0xe2e8f0', y: 360, interligne: 14 },
        { texte: 'Au programme :', taille: 34, gras: true, couleur: '0xfacc15', x: 330, y: 540 },
        { texte: programme, taille: 32, couleur: 'white', x: 360, y: 600, interligne: 18 },
    ], Math.max(8, 5 + chapitres.length * 1.2));

    // Sous-titres ASS : bandeau (titre › chapitre) + panneau d'explications
    const evts = [];
    chapitres.forEach((c, i) => {
        const fin = i + 1 < chapitres.length ? chapitres[i + 1].s : total;
        evts.push(`Dialogue: 0,${ts(c.s)},${ts(fin)},Bandeau,,0,0,0,,{\\c&HFAC593&}${assTexte(titre)}   {\\c&HFFFFFF&}›   ${assTexte(c.texte)}`);
    });
    const dires = marques.filter(m => m.type === 'dire');
    dires.forEach((d, i) => {
        const fin = i + 1 < dires.length ? dires[i + 1].s : total;
        let txt = `{\\c&HFFFFFF&}${assTexte(d.texte)}`;
        if (d.pourquoi) txt += `\\N\\N{\\c&H15CCFA&\\b1}Pourquoi ?{\\b0}\\N{\\c&HB0E0F5&}${assTexte(d.pourquoi)}`;
        evts.push(`Dialogue: 0,${ts(d.s)},${ts(fin)},Panneau,,0,0,0,,${txt}`);
    });
    ecrire(`${id}.ass`, `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Bandeau,Arial,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,28,28,24,1
${tablette
    // Deux postes : PC et tablette côte à côte, explications sur toute la largeur en bas
    ? 'Style: Panneau,Arial,29,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,46,46,912,1'
    : 'Style: Panneau,Arial,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,1432,30,150,1'}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${evts.join('\n')}
`);
    const entrees = ['-f', 'lavfi', '-i', `color=c=${FOND}:s=1920x1080:r=25:d=${(total + 3).toFixed(2)}`, '-i', video];
    let filtre;
    if (tablette) {
        // Même hauteur (760) pour les deux postes : PC 1182×760, tablette à l'échelle
        const H = 760, WP = Math.round(1400 * H / 900 / 2) * 2;
        const WT = Math.round(tablette.largeur * H / tablette.hauteur / 2) * 2;
        const marge = Math.floor((1920 - WP - WT) / 3), xT = marge * 2 + WP;
        // La vidéo de la tablette commence à l'ouverture de sa fenêtre
        const debutTablette = tablette.fermeture - duree(tablette.video) * 1000;
        const decalage = Math.max(0, (debutTablette - debutVideo) / 1000 - coupe);
        entrees.push('-i', tablette.video);
        const etiquette = (texte, x, w) => `drawtext=fontfile=arialbd.ttf:text='${texte}':fontcolor=0x93c5fd:fontsize=24:x=${x}+(${w}-tw)/2:y=${100 + H + 8}`;
        filtre = [
            `[1:v]trim=start=${coupe.toFixed(2)},setpts=PTS-STARTPTS,fps=25,scale=${WP}:${H}[v]`,
            `[2:v]fps=25,scale=${WT}:${H},setpts=PTS-STARTPTS+${decalage.toFixed(3)}/TB[vt]`,
            `[0:v]drawbox=x=0:y=900:w=1920:h=180:color=0x1e293b:t=fill,${etiquette('PC principal', marge, WP)},${etiquette('Tablette', xT, WT)}[f]`,
            `[f][v]overlay=x=${marge}:y=100:eof_action=pass[o1]`,
            `[o1][vt]overlay=x=${xT}:y=100:eof_action=pass[o]`,
            `[o]subtitles=${id}.ass:fontsdir=.,fade=in:st=0:d=0.5,fade=out:st=${(total + 2.5).toFixed(2)}:d=0.5[fin]`,
        ].join(';\n');
    } else {
        filtre = [
            `[1:v]trim=start=${coupe.toFixed(2)},setpts=PTS-STARTPTS,fps=25[v]`,
            `[0:v]drawbox=x=1400:y=90:w=520:h=900:color=0x1e293b:t=fill,drawtext=fontfile=arialbd.ttf:text='EXPLICATIONS':fontcolor=0x64748b:fontsize=24:x=1432:y=110[f]`,
            `[f][v]overlay=x=0:y=90:eof_action=pass[o]`,
            `[o]subtitles=${id}.ass:fontsdir=.,fade=in:st=0:d=0.5,fade=out:st=${(total + 2.5).toFixed(2)}:d=0.5[fin]`,
        ].join(';\n');
    }
    ecrire(`${id}.filtre`, filtre);
    ffmpeg([...entrees, '-/filter_complex', `${id}.filtre`, '-map', '[fin]', '-t', (total + 3).toFixed(2), ...ENC, `${id}-video.mp4`]);

    const fermeture = carton(`${id}-fin`, [
        { texte: titre, taille: 56, gras: true, y: 420 },
        { texte: 'Fin du film', taille: 36, couleur: '0x93c5fd', y: 520 },
    ], 3);
    ecrire(`${id}-liste.txt`, [ouverture, `${id}-video.mp4`, fermeture].map(f => `file '${f}'`).join('\n'));
    const nom = `${groupe.prefixe}${String(numero).padStart(2, '0')} - ${titre.replace(/[\\/:*?"<>|]/g, '-')}.mp4`;
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', `${id}-liste.txt`, '-c', 'copy', '-movflags', '+faststart', path.join(FILMS, nom)]);
    console.log(`🎬 ${nom} (${(duree(path.join(FILMS, nom)) / 60).toFixed(1)} min)`);
    return [ouverture, `${id}-video.mp4`, fermeture];
};

// Chaque groupe (le logiciel, le mode réseau) a sa numérotation et son propre film complet
const choisis = process.argv.slice(2);
for (const groupe of GROUPES) {
    const morceaux = [];
    TUTORIELS.filter(tu => tu[3] === groupe.id).forEach(([id, titre, resume], i) => {
        if (choisis.length && !choisis.includes(id)) return;
        if (!fs.existsSync(path.join(SORTIE, id, 'journal.json'))) { console.log(`⚠️ ${id} : pas encore tourné`); return; }
        morceaux.push(...monter(id, i + 1, titre, resume, groupe));
    });
    if (!choisis.length && morceaux.length) {
        ecrire(`complet-${groupe.id}.txt`, morceaux.map(f => `file '${f}'`).join('\n'));
        const complet = path.join(SORTIE, groupe.filmComplet + '.mp4');
        ffmpeg(['-f', 'concat', '-safe', '0', '-i', `complet-${groupe.id}.txt`, '-c', 'copy', '-movflags', '+faststart', complet]);
        console.log(`🎞️  ${groupe.filmComplet} : ${complet} (${(duree(complet) / 60).toFixed(1)} min)`);
    }
}
