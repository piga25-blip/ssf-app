// ============================================
// CONSTANTES
// ============================================
// Version extraite du nom de fichier — calculée ici ET dans le script pré-Babel
const APP_VERSION = (() => {
    // Priorité 1 : version Electron injectée par preload.js (app packagée ou npm start)
    // Format package.json : "13.36.0" → affiché "13.36"
    if (window.electronAPI?.appVersion) {
        const parts = window.electronAPI.appVersion.split('.');
        return parts.slice(0, 2).join('.');
    }
    // Priorité 2 : valeur calculée par le script pré-Babel (mode HTML standalone)
    if (window._SSF_VERSION) return window._SSF_VERSION;
    // Fallback : extraction depuis le nom du fichier HTML
    try {
        const raw = decodeURIComponent(window.location.href.split('/').pop().split('?')[0]);
        const filename = raw.replace(/_/g, ' ');
        const vMatch = filename.match(/[Vv](\d+)[\s\-](\d+)/);
        if (!vMatch) return '';
        const versionNum = vMatch[1] + '.' + vMatch[2];
        const dateAfterDu = filename.match(/\bdu\b[\s\-](\d{2})[\s\-](\d{2})[\s\-](\d{2,4})/i);
        if (dateAfterDu) {
            const y = dateAfterDu[3].length === 2 ? '20' + dateAfterDu[3] : dateAfterDu[3];
            return versionNum + ' du ' + dateAfterDu[1] + '-' + dateAfterDu[2] + '-' + y;
        }
        const fnNoV = filename.replace(vMatch[0], '');
        const dm = fnNoV.match(/(\d{2})[\s\-](\d{2})[\s\-](\d{2,4})/);
        if (dm) {
            const y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
            return versionNum + ' du ' + dm[1] + '-' + dm[2] + '-' + y;
        }
        return versionNum;
    } catch(e) { return ''; }
})();
const DEFAULT_RESCUE_ID = 'secours-courant';
const DEFAULT_TOTAL_DAYS = 3;
const SLOTS_PER_HOUR = 4;
const SLOTS_PER_DAY = 24 * SLOTS_PER_HOUR;
const TIME_PER_SLOT = 0.25;

const ACTIVITIES = [
    { id: 'directeur_souterrain', name: 'Directeur Secours Souterrain', color: '#ff00ff', teamRequired: false },
    { id: 'conseiller_technique', name: 'Conseiller technique', color: '#ffc0cb', teamRequired: false },
    { id: 'engage', name: 'Engagé', color: '#90ee90', teamRequired: true },
    { id: 'disponible', name: 'Disponible', color: '#008000', teamRequired: false },
    { id: 'repos_site', name: 'Repos sur site', color: '#00ffff', teamRequired: false },
    { id: 'repos_domicile', name: 'Repos au domicile', color: '#add8e6', teamRequired: false },
    { id: 'repas_dejeuner', name: 'Repas - Déjeuner', color: '#ffdead', teamRequired: false },
    { id: 'quitter_secours', name: 'Quitter le secours', color: '#404040', teamRequired: false },
    { id: 'gestion', name: 'Gestion - PC', color: '#ffff00', teamRequired: true },
    { id: 'approche', name: 'Approche', color: '#4b0082', teamRequired: true },
    { id: 'souterre', name: 'Sous Terre', color: '#8b4513', teamRequired: true },
    { id: 'brancardage', name: 'Brancardage', color: '#ff0000', teamRequired: true },
    { id: 'plongee', name: 'Plongée', color: '#0000ff', teamRequired: true },
    { id: 'mission_surface', name: 'Mission de surface', color: '#ffa500', teamRequired: true },
    { id: 'mission_hors_site', name: 'Mission hors du site', color: '#808080', teamRequired: true },
    { id: 'effacer', name: 'Efface l\'activité', color: '#ffffff', teamRequired: false },
    { id: 'nondef', name: 'Non Défini', color: '#ffffff', teamRequired: false },
];
