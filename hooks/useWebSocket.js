const useWebSocket = ({
    setEvents, setMasterSauveteursList, setTeams, setSecretaires, setPointsPhone,
    setMissionInfo, setClotureInfo, setPlanning, setActiveSauveteurIds,
    setNextEventNumber, setSauveteurPermanentNumbers, setNextPermanentNumber,
    setUsedTeamNumbers, setStartHour, setTotalDays, setMcMode, setMcIdentifiant, setMcConfigured
}) => {
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [notification, setNotification] = useState(null);
    const ws = useRef(null);
    const isReceivingData = useRef(false);
    const urlParams = new URLSearchParams(window.location.search);
    const userName = urlParams.get('userName') || 'Utilisateur';
    const pcName = urlParams.get('pcName') || 'PC';
    const userRole = urlParams.get('role') || 'admin';
    const userMode = urlParams.get('mode') || 'operationnel';
    const userId = useRef(`${pcName}-${Date.now()}`);

    useEffect(() => {
        if (!window.location.host) {
            console.log('⚠️ Mode fichier local - WebSocket désactivé');
            return;
        }
        const websocket = new WebSocket(`ws://${window.location.host}`);
        ws.current = websocket;
        websocket.onopen = () => {
            console.log('✅ WebSocket connecté');
            websocket.send(JSON.stringify({ type: 'connect', userId: userId.current, userName, pcName, role: userRole, mode: userMode }));
        };
        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'users_list' || data.type === 'connected_users') setConnectedUsers(data.users || []);
            if (data.type === 'initial_data' && data.data) {
                isReceivingData.current = true;
                if (data.data.events !== undefined) setEvents(data.data.events);
                if (data.data.masterSauveteursList !== undefined) setMasterSauveteursList(data.data.masterSauveteursList);
                if (data.data.teams !== undefined) setTeams(data.data.teams);
                if (data.data.secretaires !== undefined) setSecretaires(data.data.secretaires);
                if (data.data.pointsPhone !== undefined) {
                    const loadedPP = data.data.pointsPhone || [];
                    if (!loadedPP.find(function(pp) { return (typeof pp === 'object' ? pp.lettre : pp) === 'PC'; })) {
                        loadedPP.unshift({ lettre: 'PC', nom: 'Poste de Commandement', sousTerre: false, typePP: 'surface', ordre: 0 });
                    }
                    setPointsPhone(loadedPP);
                }
                if (data.data.missionInfo !== undefined) setMissionInfo(data.data.missionInfo);
                if (data.data.clotureInfo !== undefined) setClotureInfo(data.data.clotureInfo);
                if (data.data.planning !== undefined) setPlanning(data.data.planning);
                if (data.data.activeSauveteurIds !== undefined) setActiveSauveteurIds(data.data.activeSauveteurIds);
                if (data.data.nextEventNumber !== undefined) setNextEventNumber(data.data.nextEventNumber);
                if (data.data.sauveteurPermanentNumbers !== undefined) setSauveteurPermanentNumbers(data.data.sauveteurPermanentNumbers);
                if (data.data.nextPermanentNumber !== undefined) setNextPermanentNumber(data.data.nextPermanentNumber);
                if (data.data.usedTeamNumbers !== undefined) setUsedTeamNumbers(data.data.usedTeamNumbers);
                if (data.data.startHour !== undefined) setStartHour(data.data.startHour);
                if (data.data.totalDays !== undefined) setTotalDays(data.data.totalDays);
                if (data.data.mcMode !== undefined) setMcMode(data.data.mcMode);
                if (data.data.mcIdentifiant !== undefined) setMcIdentifiant(data.data.mcIdentifiant);
                if (data.data.mcConfigured !== undefined) setMcConfigured(data.data.mcConfigured);
                setTimeout(() => { isReceivingData.current = false; }, 1000);
            }
            if (data.type === 'data_changed' && data.data && data.updatedBy !== userName) {
                setNotification(`${data.updatedBy} a modifié les données`);
                setTimeout(() => setNotification(null), 3000);
                isReceivingData.current = true;
                if (data.data.events !== undefined) setEvents(data.data.events);
                if (data.data.masterSauveteursList !== undefined) setMasterSauveteursList(data.data.masterSauveteursList);
                if (data.data.teams !== undefined) setTeams(data.data.teams);
                if (data.data.secretaires !== undefined) setSecretaires(data.data.secretaires);
                if (data.data.pointsPhone !== undefined) {
                    const loadedPP = data.data.pointsPhone || [];
                    if (!loadedPP.find(function(pp) { return (typeof pp === 'object' ? pp.lettre : pp) === 'PC'; })) {
                        loadedPP.unshift({ lettre: 'PC', nom: 'Poste de Commandement', sousTerre: false, typePP: 'surface', ordre: 0 });
                    }
                    setPointsPhone(loadedPP);
                }
                if (data.data.missionInfo !== undefined) setMissionInfo(data.data.missionInfo);
                if (data.data.clotureInfo !== undefined) setClotureInfo(data.data.clotureInfo);
                if (data.data.planning !== undefined) setPlanning(data.data.planning);
                if (data.data.activeSauveteurIds !== undefined) setActiveSauveteurIds(data.data.activeSauveteurIds);
                if (data.data.nextEventNumber !== undefined) setNextEventNumber(data.data.nextEventNumber);
                if (data.data.sauveteurPermanentNumbers !== undefined) setSauveteurPermanentNumbers(data.data.sauveteurPermanentNumbers);
                if (data.data.nextPermanentNumber !== undefined) setNextPermanentNumber(data.data.nextPermanentNumber);
                if (data.data.usedTeamNumbers !== undefined) setUsedTeamNumbers(data.data.usedTeamNumbers);
                if (data.data.startHour !== undefined) setStartHour(data.data.startHour);
                if (data.data.totalDays !== undefined) setTotalDays(data.data.totalDays);
                if (data.data.mcMode !== undefined) setMcMode(data.data.mcMode);
                if (data.data.mcIdentifiant !== undefined) setMcIdentifiant(data.data.mcIdentifiant);
                if (data.data.mcConfigured !== undefined) setMcConfigured(data.data.mcConfigured);
                setTimeout(() => { isReceivingData.current = false; }, 1000);
            }
        };
        websocket.onerror = (error) => console.error('❌ Erreur WebSocket');
        websocket.onclose = () => console.log('❌ WebSocket déconnecté');
        const heartbeat = setInterval(() => {
            if (websocket.readyState === 1) websocket.send(JSON.stringify({ type: 'heartbeat', userId: userId.current }));
        }, 5000);
        return () => { clearInterval(heartbeat); websocket.close(); };
    }, []);

    return {
        connectedUsers, notification, setNotification,
        ws, isReceivingData,
        userName, pcName, userRole, userMode, userId
    };
};
