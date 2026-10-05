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
    // Autres postes filmés (journaux plus anciens : une seule « tablette »)
    const autresPostes = (journal.postes || (journal.tablette ? [{ ...journal.tablette, nom: 'Tablette' }] : []))
        .filter(po => po.video && fs.existsSync(po.video));
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
${autresPostes.length
    // Deux postes : PC et tablette côte à côte, explications sur toute la largeur en bas
    ? 'Style: Panneau,Arial,29,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,46,46,912,1'
    : 'Style: Panneau,Arial,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,1432,30,150,1'}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${evts.join('\n')}
`);
    const entrees = ['-f', 'lavfi', '-i', `color=c=${FOND}:s=1920x1080:r=25:d=${(total + 3).toFixed(2)}`, '-i', video];
    let filtre;
    if (autresPostes.length) {
        // Plusieurs postes : ordinateurs (paysage) empilés à gauche, tablettes (portrait) côte à
        // côte à droite, sur la hauteur 100…890 ; explications en bas sur toute la largeur
        const fenetres = [{ nom: 'PC principal', largeur: 1400, hauteur: 900, entree: 1, decalage: 0 },
            ...autresPostes.map((po, i) => ({ ...po, entree: i + 2,
                // la vidéo d'un poste commence à l'ouverture de sa fenêtre
                decalage: Math.max(0, (po.fermeture - duree(po.video) * 1000 - debutVideo) / 1000 - coupe) }))];
        autresPostes.forEach(po => entrees.push('-i', po.video));
        const paysages = fenetres.filter(f => f.largeur > f.hauteur), portraits = fenetres.filter(f => f.largeur <= f.hauteur);
        const HZ = 790, ECART = 16;
        let hP = (HZ - (paysages.length - 1) * ECART) / paysages.length, hT = HZ;
        let colonne = paysages.length ? hP * 1400 / 900 : 0;
        const largeurs = () => colonne + portraits.reduce((s, f) => s + hT * f.largeur / f.hauteur, 0);
        const nbColonnes = (paysages.length ? 1 : 0) + portraits.length;
        const place = 1920 - (nbColonnes + 1) * ECART;
        if (largeurs() > place) { const k = place / largeurs(); hP *= k; hT *= k; colonne *= k; }
        const pair = v => Math.round(v / 2) * 2;
        let x = Math.round((1920 - largeurs() - (nbColonnes - 1) * ECART) / 2);
        const yHaut = 100 + Math.round((HZ - Math.max(hT, paysages.length * hP + (paysages.length - 1) * ECART)) / 2);
        paysages.forEach((f, i) => { f.w = pair(colonne); f.h = pair(hP); f.x = x; f.y = yHaut + Math.round(i * (hP + ECART)); });
        if (paysages.length) x += Math.round(colonne) + ECART;
        portraits.forEach(f => { f.h = pair(hT); f.w = pair(hT * f.largeur / f.hauteur); f.x = x; f.y = yHaut; x += f.w + ECART; });
        const echappe = s => s.replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:');
        const parties = fenetres.map(f => f.entree === 1
            ? `[1:v]trim=start=${coupe.toFixed(2)},setpts=PTS-STARTPTS,fps=25,scale=${f.w}:${f.h}[v1]`
            : `[${f.entree}:v]fps=25,scale=${f.w}:${f.h},setpts=PTS-STARTPTS+${f.decalage.toFixed(3)}/TB[v${f.entree}]`);
        parties.push(`[0:v]drawbox=x=0:y=900:w=1920:h=180:color=0x1e293b:t=fill[b0]`);
        fenetres.forEach((f, i) => parties.push(`[b${i}][v${f.entree}]overlay=x=${f.x}:y=${f.y}:eof_action=pass[b${i + 1}]`));
        const etiquettes = fenetres.map(f => `drawtext=fontfile=arialbd.ttf:text='${echappe(f.nom)}':fontcolor=white:fontsize=20:box=1:boxcolor=0x0f172a@0.8:boxborderw=6:x=${f.x + 6}:y=${f.y + 6}`).join(',');
        parties.push(`[b${fenetres.length}]${etiquettes},subtitles=${id}.ass:fontsdir=.,fade=in:st=0:d=0.5,fade=out:st=${(total + 2.5).toFixed(2)}:d=0.5[fin]`);
        filtre = parties.join(';\n');
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
