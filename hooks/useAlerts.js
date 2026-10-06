const useAlerts = ({ events, actions, actives = true }) => {
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
        const validationEvent = {
            id: nouvelId(),
            isoTimestamp: new Date().toISOString(),
            secretaire: 'Système',
            dateHeure: new Date().toLocaleString('fr-FR'),
            messageImportant: false,
            evenement: '✓ Rappel N°' + event.numero + ' traité : ' + event.evenement.substring(0, 50) + '...',
            numero: NUMERO_AUTO_SANS_PREFIXE, // attribué à l'application de l'action
            fait: false,
            categorie: 'autre'
        };
        actions.validerRappel(event.id, validationEvent);
    };

    useEffect(() => {
        // Alertes affichées sur les postes qui saisissent (principal et saisie) ; la première validation
        // les ferme partout (décision 8). Un poste en consultation ne peut pas les valider.
        if (!actives) return;
        const checkAlerts = () => {
            // Mêmes rappels que ceux que la fenêtre affiche (urgents ou dépassés) : sinon la fenêtre
            // était « ouverte » trop tôt, restait invisible, et n'apparaissait à l'échéance qu'à la
            // prochaine modification du secours
            const urgentAlerts = events.filter(e => {
                const statut = getAlertStatusGlobal(e);
                return statut === 'urgent' || statut === 'passed';
            });
            // Plus rien à afficher (rappel validé, ici ou sur un autre poste, après une réouverture
            // le temps que la validation revienne du serveur) : la fenêtre se referme vraiment, sinon
            // elle restait « ouverte » sans rien montrer et plus aucun rappel ne pouvait l'ouvrir
            if (urgentAlerts.length === 0) {
                if (showAlertsModal) setShowAlertsModal(false);
                return;
            }
            if (!showAlertsModal && Date.now() > alertSnoozedUntil.current) {
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
    }, [events, showAlertsModal, actives]);

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
