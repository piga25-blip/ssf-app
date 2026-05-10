const usePlanning = ({
    activeSauveteurIds, setActiveSauveteurIds,
    masterSauveteursList,
    nextPermanentNumber, setNextPermanentNumber,
    setSauveteurPermanentNumbers,
    mcMode, mcIdentifiant,
    events, nextEventNumber, setEvents, setNextEventNumber
}) => {
    const [planning, setPlanning] = useState({});
    const getDefaultStartHour = () => {
        const now = new Date();
        return Math.max(0, now.getHours() - 1);
    };
    const [startHour, setStartHour] = useState(getDefaultStartHour());
    const [totalDays, setTotalDays] = useState(DEFAULT_TOTAL_DAYS);
    const [selectedActivityId, setSelectedActivityId] = useState('nondef');
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [lastSelectedCell, setLastSelectedCell] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillStartCell, setFillStartCell] = useState(null);
    const [fillPreviewCells, setFillPreviewCells] = useState(new Set());
    const intervalRef = useRef(null);

    const verifierEtPropagerAvantAction = function() {
        const now = new Date();
        let minutesSinceStart = (now.getHours() * 60 + now.getMinutes()) - (startHour * 60);
        if (minutesSinceStart < 0) minutesSinceStart += 24 * 60;
        const slotEcoule = Math.floor(minutesSinceStart / 15) - 1;
        const totalSlots = getTotalSlots(totalDays);
        if (slotEcoule < 1 || slotEcoule >= totalSlots) return;

        const aCombler = [];
        activeSauveteurIds.forEach(function(id) {
            const row = planning[id];
            if (!row) return;
            if (row[slotEcoule] && row[slotEcoule] !== 'nondef' && row[slotEcoule] !== 'effacer') return;
            let premierVide = slotEcoule;
            for (let i = slotEcoule - 1; i >= 0; i--) {
                if (!row[i] || row[i] === 'nondef' || row[i] === 'effacer') { premierVide = i; } else { break; }
            }
            let activite = null, slotSource = -1;
            for (let i = premierVide - 1; i >= 0; i--) {
                if (row[i] && row[i] !== 'nondef' && row[i] !== 'effacer') { activite = row[i]; slotSource = i; break; }
            }
            if (!activite) return;
            aCombler.push({ id, activite, slotDebut: slotSource + 1, slotFin: slotEcoule });
        });

        if (aCombler.length === 0) return;

        const duree = Math.max.apply(null, aCombler.map(function(s) { return s.slotFin - s.slotDebut + 1; })) * 15;
        const confirmer = window.confirm(
            aCombler.length + ' sauveteur(s) ont des creneaux vides (jusqu a ' + duree + ' min).\n\nMettre a jour le planning avant de continuer ?'
        );
        if (!confirmer) return;

        setPlanning(function(prev) {
            const np = { ...prev };
            aCombler.forEach(function(s) {
                if (np[s.id]) {
                    const r = [...np[s.id]];
                    for (let slot = s.slotDebut; slot <= s.slotFin; slot++) {
                        if (!r[slot] || r[slot] === 'nondef' || r[slot] === 'effacer') r[slot] = s.activite;
                    }
                    np[s.id] = r;
                }
            });
            return np;
        });
    };

    const handleAddSauveteurToPlanning = useCallback((sauveteurId) => {
        verifierEtPropagerAvantAction();

        const now = new Date();
        const currentMinutesInDay = now.getHours() * 60 + now.getMinutes();
        const startMinutesInDay = startHour * 60;
        let minutesSinceStart = currentMinutesInDay - startMinutesInDay;
        if (minutesSinceStart < 0) minutesSinceStart += 24 * 60;
        const slotIndex = Math.floor(minutesSinceStart / 15);
        const totalSlots = getTotalSlots(totalDays);
        const sauv = masterSauveteursList.find(s => s.id === sauveteurId);

        if (!activeSauveteurIds.includes(sauveteurId)) {
            setActiveSauveteurIds(prev => [...prev, sauveteurId]);
            setNextPermanentNumber(prevNumber => {
                setSauveteurPermanentNumbers(prev => ({ ...prev, [sauveteurId]: prevNumber }));
                return prevNumber + 1;
            });
            const newPlanning = Array(totalSlots).fill('nondef');
            let eventNumberIncrement = 0;
            if (slotIndex >= 0 && slotIndex < totalSlots) {
                newPlanning[slotIndex] = 'disponible';
                if (sauv) {
                    const arriveeEvent = { id: Date.now(), isoTimestamp: new Date().toISOString(), secretaire: 'Système', dateHeure: new Date().toLocaleString('fr-FR'), messageImportant: false, categorie: 'personnel', evenement: `Arrivée de : ${sauv.name}`, numero: (mcMode === 'secondaire' && mcIdentifiant) ? `${mcIdentifiant}-${nextEventNumber.toString().padStart(3, '0')}` : nextEventNumber.toString().padStart(3, '0'), fait: false };
                    const disponibleEvent = { id: Date.now() + 1, isoTimestamp: new Date().toISOString(), secretaire: 'Système', dateHeure: new Date().toLocaleString('fr-FR'), messageImportant: false, categorie: 'personnel', evenement: `🧑‍⚕️ Activité "Disponible" affectée à : ${sauv.name}`, numero: (mcMode === 'secondaire' && mcIdentifiant) ? `${mcIdentifiant}-${(nextEventNumber + 1).toString().padStart(3, '0')}` : (nextEventNumber + 1).toString().padStart(3, '0'), fait: false };
                    setEvents(prev => [...prev, arriveeEvent, disponibleEvent]);
                    eventNumberIncrement = 2;
                }
            }
            if (eventNumberIncrement > 0) setNextEventNumber(nextEventNumber + eventNumberIncrement);
            setPlanning(prev => ({ ...prev, [sauveteurId]: newPlanning }));

        } else {
            let eventNumberIncrement = 0;
            if (slotIndex >= 0 && slotIndex < totalSlots) {
                setPlanning(prev => {
                    const existingRow = prev[sauveteurId] ? [...prev[sauveteurId]] : Array(totalSlots).fill('nondef');
                    while (existingRow.length < totalSlots) existingRow.push('nondef');
                    existingRow[slotIndex] = 'disponible';
                    return { ...prev, [sauveteurId]: existingRow };
                });
                if (sauv) {
                    const arriveeEvent = { id: Date.now(), isoTimestamp: new Date().toISOString(), secretaire: 'Système', dateHeure: new Date().toLocaleString('fr-FR'), messageImportant: false, categorie: 'personnel', evenement: `Arrivée de : ${sauv.name}`, numero: (mcMode === 'secondaire' && mcIdentifiant) ? `${mcIdentifiant}-${nextEventNumber.toString().padStart(3, '0')}` : nextEventNumber.toString().padStart(3, '0'), fait: false };
                    const disponibleEvent = { id: Date.now() + 1, isoTimestamp: new Date().toISOString(), secretaire: 'Système', dateHeure: new Date().toLocaleString('fr-FR'), messageImportant: false, categorie: 'personnel', evenement: `🧑‍⚕️ Retour sur site — Activité "Disponible" affectée à : ${sauv.name}`, numero: (mcMode === 'secondaire' && mcIdentifiant) ? `${mcIdentifiant}-${(nextEventNumber + 1).toString().padStart(3, '0')}` : (nextEventNumber + 1).toString().padStart(3, '0'), fait: false };
                    setEvents(prev => [...prev, arriveeEvent, disponibleEvent]);
                    eventNumberIncrement = 2;
                }
            }
            if (eventNumberIncrement > 0) setNextEventNumber(nextEventNumber + eventNumberIncrement);
        }
    }, [activeSauveteurIds, totalDays, startHour, masterSauveteursList, mcMode, mcIdentifiant, events, nextEventNumber, setEvents, setNextEventNumber]);

    const sauveursAyantQuitte = useMemo(() => {
        return activeSauveteurIds.filter(function(id) {
            const row = planning[id];
            if (!row) return false;
            for (var i = row.length - 1; i >= 0; i--) {
                if (row[i] && row[i] !== 'nondef' && row[i] !== 'effacer') {
                    return row[i] === 'quitter_secours';
                }
            }
            return false;
        });
    }, [activeSauveteurIds, planning]);

    // Propagation automatique du planning (toutes les 15 minutes)
    useEffect(() => {
        if (activeSauveteurIds.length === 0) return;
        const propagerAuto = () => {
            const now = new Date();
            let minutesSinceStart = (now.getHours() * 60 + now.getMinutes()) - (startHour * 60);
            if (minutesSinceStart < 0) minutesSinceStart += 24 * 60;
            const slotEcoule = Math.floor(minutesSinceStart / 15) - 1;
            const totalSlots = getTotalSlots(totalDays);
            if (slotEcoule < 0 || slotEcoule >= totalSlots) return;
            const sauveteursPropager = [];
            activeSauveteurIds.forEach(function(id) {
                const row = planning[id];
                if (!row) return;
                if (row[slotEcoule] && row[slotEcoule] !== 'nondef' && row[slotEcoule] !== 'effacer') return;
                let premierVide = slotEcoule;
                for (let i = slotEcoule - 1; i >= 0; i--) {
                    if (!row[i] || row[i] === 'nondef' || row[i] === 'effacer') { premierVide = i; } else { break; }
                }
                let activite = null, slotSource = -1;
                for (let i = premierVide - 1; i >= 0; i--) {
                    if (row[i] && row[i] !== 'nondef' && row[i] !== 'effacer') { activite = row[i]; slotSource = i; break; }
                }
                if (!activite) return;
                sauveteursPropager.push({ id, activite, slotDebut: slotSource + 1, slotFin: slotEcoule });
            });
            if (sauveteursPropager.length === 0) return;
            const noms = [...new Set(sauveteursPropager.map(function(s) { return s.activite; }))];
            const duree = Math.max.apply(null, sauveteursPropager.map(function(s) { return s.slotFin - s.slotDebut + 1; })) * 15;
            const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const msg = 'Mise a jour automatique - ' + heure + '\n\n' + sauveteursPropager.length + ' sauveteur(s), ' + duree + ' min max.\nActivi: ' + noms.join(', ') + '\n\nConfirmer ?';
            if (!window.confirm(msg)) return;
            setPlanning(function(prev) {
                const np = { ...prev };
                sauveteursPropager.forEach(function(s) {
                    if (np[s.id]) {
                        const r = [...np[s.id]];
                        for (let slot = s.slotDebut; slot <= s.slotFin; slot++) {
                            if (!r[slot] || r[slot] === 'nondef' || r[slot] === 'effacer') r[slot] = s.activite;
                        }
                        np[s.id] = r;
                    }
                });
                return np;
            });
        };
        const now = new Date();
        const msEcoules = (now.getMinutes() % 15) * 60000 + now.getSeconds() * 1000 + now.getMilliseconds();
        const msJusquAuProchain = 15 * 60000 - msEcoules;
        const t = setTimeout(() => {
            propagerAuto();
            intervalRef.current = setInterval(propagerAuto, 15 * 60000);
        }, msJusquAuProchain);
        return () => { clearTimeout(t); if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [activeSauveteurIds, planning, startHour, totalDays]);

    return {
        planning, setPlanning,
        startHour, setStartHour,
        totalDays, setTotalDays,
        selectedActivityId, setSelectedActivityId,
        selectedCells, setSelectedCells,
        lastSelectedCell, setLastSelectedCell,
        isDragging, setIsDragging,
        isFilling, setIsFilling,
        fillStartCell, setFillStartCell,
        fillPreviewCells, setFillPreviewCells,
        sauveursAyantQuitte,
        verifierEtPropagerAvantAction,
        handleAddSauveteurToPlanning
    };
};
