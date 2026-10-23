// ============================================
// UTILITAIRES
// ============================================
const getLocalStorageKey = (rescueId) => {
    const safeId = rescueId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const vMajor = APP_VERSION ? APP_VERSION.split('.')[0] : '13';
    return `SSF_UNIFIED_STATE_${safeId}_V${vMajor}`;
};

// Identifiant unique d'un événement de main courante.
// Remplace Date.now(), qui donnait le même identifiant à deux événements créés dans la même
// milliseconde (même poste ou, en réseau, deux postes différents).
// crypto.randomUUID n'existe que dans un contexte sécurisé (https ou localhost) : un poste
// connecté en http://192.168.x.x ne l'aura pas, d'où la version de secours équivalente
// construite avec crypto.getRandomValues (disponible partout).
const nouvelId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const o = window.crypto.getRandomValues(new Uint8Array(16));
    o[6] = (o[6] & 0x0f) | 0x40; // UUID version 4
    o[8] = (o[8] & 0x3f) | 0x80;
    const h = [...o].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// Répare les identifiants en double hérités des anciennes versions (Date.now()) :
// le premier événement garde son identifiant, les suivants en reçoivent un nouveau.
// Sans cela, modifier ou valider l'un des deux modifierait aussi l'autre.
const garantirIdsUniques = (events) => {
    const vus = new Set();
    let repares = 0;
    const resultat = (events || []).map(ev => {
        if (ev && ev.id !== undefined && !vus.has(ev.id)) { vus.add(ev.id); return ev; }
        repares++;
        return { ...ev, id: nouvelId() };
    });
    if (repares > 0) console.warn(`[ids] ${repares} identifiant(s) d'événement en double ou absent(s) réparé(s)`);
    return repares > 0 ? resultat : (events || []);
};

const getContrastColor = (hexColor) => {
    const hex = hexColor.replace('#', '');
    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
};

// Date « aaaa-mm-jj » en heure LOCALE (toISOString donne la date UTC : la veille entre
// minuit et 2 h du matin en heure d'été, et un rappel se retrouvait alors déjà dépassé)
const dateLocaleISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const formatDecimalHours = (decimalHours) => {
    if (isNaN(decimalHours) || decimalHours < 0) return '00:00';
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Ferme une modale sur la touche Echap (filet de sécurité si un clic de fermeture normal a échoué)
const useCloseOnEscape = (onClose) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onCloseRef.current) onCloseRef.current();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);
};

// Filet de sécurité : si le rendu d'une modale plante, on évite qu'un fond
// "fixed inset-0" reste bloqué à l'écran (invisible ou non) en couvrant toute
// l'app sans qu'aucun bouton ne soit cliquable pour le fermer.
class ModalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Erreur dans une modale, fermeture forcée :', error, info);
    }

    render() {
        if (this.state.hasError) {
            const canClose = !!this.props.onClose;
            return (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-overlay">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 text-center">
                        <div className="text-4xl mb-3">⚠️</div>
                        <h2 className="text-xl font-bold text-red-700 mb-2">Une erreur est survenue</h2>
                        <p className="text-gray-600 text-sm mb-4">
                            Cette fenêtre a rencontré un problème inattendu.
                            {canClose
                                ? " Elle a été fermée pour éviter de bloquer l'application. Vos données n'ont pas été perdues."
                                : " Un redémarrage de l'application est nécessaire pour continuer."}
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false });
                                if (canClose) this.props.onClose();
                                else window.location.reload();
                            }}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold"
                        >
                            {canClose ? 'Fermer' : "Recharger l'application"}
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Le planning va de l'heure de début (J1) jusqu'à la fin du dernier jour du calendrier :
// réglé sur 2 jours avec un début à 06:00, il s'arrête à J2 23:45
const getTotalSlots = (totalDays, startHour = 0) => Math.max(SLOTS_PER_HOUR, totalDays * SLOTS_PER_DAY - (startHour || 0) * SLOTS_PER_HOUR);

// Texte en minuscules sans accents (comparaison des rôles et des noms)
const sansAccents = (texte) => (texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Fonction de surface lue dans la colonne « Rôle » de la liste des sauveteurs :
// gestion (secrétariat, matériel, logistique) et conseiller technique (CT, CTDS, CTDSA)
const fonctionsDuRole = (role) => {
    const r = sansAccents(role).replace(/['’]/g, ' ');
    return {
        gestion: /\b(gestion|secretaires?|secretariat|materiel|logistique)\b/.test(r),
        conseiller: /\b(ct|ctdsa?|conseill\w* technique)\b/.test(r),
    };
};

// Même personne : « Claire VIDAL » et « VIDAL Claire » (mots dans n'importe quel ordre, sans accents)
const memePersonne = (a, b) => {
    const mots = (t) => sansAccents(t).split(/[\s,;.-]+/).filter(Boolean).sort().join(' ');
    return !!mots(a) && mots(a) === mots(b);
};

// Nombre de créneaux du planning commencés à l'heure actuelle (créneau en cours compris).
// J1 commence à startHour le jour de la première ligne de main courante (la veille si cette
// ligne est avant startHour) ; sans main courante, pas de limite.
const creneauxEcoules = (startHour, events) => {
    const heures = (events || []).map(e => Date.parse(e && e.isoTimestamp)).filter(Number.isFinite);
    if (heures.length === 0) return Infinity;
    const premier = new Date(Math.min(...heures));
    const debut = new Date(premier);
    debut.setHours(startHour, 0, 0, 0);
    if (debut > premier) debut.setDate(debut.getDate() - 1);
    return Math.floor((Date.now() - debut.getTime()) / (15 * 60000)) + 1;
};

// Ordre de la main courante, de la plus ancienne ligne à la plus récente : rang de chaque
// ligne (Map id → rang). Les lignes de ce poste se suivent par numéro (001, 002, 002a…) ; une
// ligne venue d'une autre main courante (PCA-003, MC2-001) se range à son heure, après la
// dernière ligne de ce poste écrite avant elle
const ordreMainCourante = (events) => {
    const cle = (num) => { const m = String(num || '').match(/^(\d+)([a-z]*)$/i); return m ? [parseInt(m[1], 10), m[2].toLowerCase()] : null; };
    const heure = (e) => Date.parse(e.isoTimestamp) || 0;
    const locales = (events || []).filter(e => cle(e.numero)).map(e => ({ h: heure(e), c: cle(e.numero) }));
    const avant = (a, b) => a[0] - b[0] || a[1].localeCompare(b[1]);
    const rangs = (events || []).map(e => {
        const c = cle(e.numero);
        if (c) return { e, c, h: 0 };
        let dernier = [0, ''];
        locales.forEach(l => { if (l.h <= heure(e) && avant(l.c, dernier) > 0) dernier = l.c; });
        return { e, c: dernier, h: heure(e) || 1 };
    });
    rangs.sort((a, b) => avant(a.c, b.c) || a.h - b.h);
    return new Map(rangs.map((r, i) => [r.e.id, i]));
};

// Heure d'une ligne de main courante (horodatage exact, sinon le texte de la date)
const heureLigne = (e) => Date.parse(e.isoTimestamp) || new Date(e.timestamp || e.dateHeure).getTime() || 0;

const indexToTime = (index, startHour, totalDays) => {
    const totalSlots = getTotalSlots(totalDays, startHour);
    const safeIndex = Math.min(index, totalSlots - 1);
    const offsetInSlots = startHour * SLOTS_PER_HOUR;
    const absoluteSlotIndex = offsetInSlots + safeIndex;
    const day = Math.floor(absoluteSlotIndex / SLOTS_PER_DAY) + 1;
    const indexSinceStartOfDay = absoluteSlotIndex % SLOTS_PER_DAY;
    const minutesSinceStartOfDay = indexSinceStartOfDay * 15;
    const hour = String(Math.floor(minutesSinceStartOfDay / 60)).padStart(2, '0');
    const minute = String(minutesSinceStartOfDay % 60).padStart(2, '0');
    return {
        day: day,
        time: `${hour}:${minute}`,
        isHourStart: (minutesSinceStartOfDay % 60) === 0,
        isDayStart: indexSinceStartOfDay === 0
    };
};
