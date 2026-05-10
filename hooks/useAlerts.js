const useAlerts = ({ events, setEvents, nextEventNumber, setNextEventNumber }) => {
    const [showAlertsModal, setShowAlertsModal] = useState(false);
    const [alertModalPosition, setAlertModalPosition] = useState({ x: 0, y: 0 });
    const [isDraggingAlert, setIsDraggingAlert] = useState(false);
    const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
    const alertSnoozedUntil = useRef(0);

    const getAlertStatusGlobal = (event) => {
        if (!event.dateRappel || !event.heureRappel) return null;
        if (event.fait) return 'done';
        const rappelDateTime = new Date(event.dateRappel + 'T' + event.heureRappel);
        const diffMs = rappelDateTime - new Date();
        const diffMinutes = diffMs / (1000 * 60);
        if (diffMinutes < 0) return 'passed';
        if (diffMinutes <= 10) return 'urgent';
        return 'scheduled';
    };

    const handleValidateAlertGlobal = (event) => {
        const updatedEvents = events.map(e => e.id === event.id ? { ...e, fait: true } : e);
        const validationEvent = {
            id: Date.now(),
            isoTimestamp: new Date().toISOString(),
            secretaire: 'Système',
            dateHeure: new Date().toLocaleString('fr-FR'),
            messageImportant: false,
            evenement: '✓ Rappel N°' + event.numero + ' traité : ' + event.evenement.substring(0, 50) + '...',
            numero: nextEventNumber.toString().padStart(3, '0'),
            fait: false,
            categorie: 'autre'
        };
        setEvents([...updatedEvents, validationEvent]);
        setNextEventNumber(prev => prev + 1);
    };

    useEffect(() => {
        const checkAlerts = () => {
            const urgentAlerts = events.filter(e => {
                if (!e.dateRappel || e.fait) return false;
                const rappelDate = new Date(e.dateRappel + 'T' + (e.heureRappel || '00:00'));
                const diff = rappelDate - new Date();
                return diff < 0 || diff <= 2 * 60 * 60 * 1000;
            });
            if (urgentAlerts.length > 0 && !showAlertsModal && Date.now() > alertSnoozedUntil.current) {
                setShowAlertsModal(true);
                setAlertModalPosition({
                    x: Math.max(0, window.innerWidth / 2 - 300),
                    y: Math.max(0, window.innerHeight / 2 - 200)
                });
            }
        };
        checkAlerts();
        const interval = setInterval(checkAlerts, 30000);
        return () => clearInterval(interval);
    }, [events, showAlertsModal]);

    return {
        showAlertsModal, setShowAlertsModal,
        alertModalPosition, setAlertModalPosition,
        isDraggingAlert, setIsDraggingAlert,
        dragStartPos, setDragStartPos,
        alertSnoozedUntil,
        getAlertStatusGlobal,
        handleValidateAlertGlobal
    };
};
