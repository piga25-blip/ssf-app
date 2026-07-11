// ============================================
// UTILITAIRES
// ============================================
const getLocalStorageKey = (rescueId) => {
    const safeId = rescueId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const vMajor = APP_VERSION ? APP_VERSION.split('.')[0] : '13';
    return `SSF_UNIFIED_STATE_${safeId}_V${vMajor}`;
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

const getTotalSlots = (totalDays) => totalDays * SLOTS_PER_DAY;

const indexToTime = (index, startHour, totalDays) => {
    const totalSlots = getTotalSlots(totalDays);
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
