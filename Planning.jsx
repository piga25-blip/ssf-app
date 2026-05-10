// COMPOSANT PLANNING
// ============================================
const PlanningTab = ({ 
    masterSauveteursList, activeSauveteurIds, sauveteurPermanentNumbers, planning, setPlanning,
    teams, startHour, setStartHour, totalDays, setTotalDays,
    selectedActivityId, setSelectedActivityId, selectedCells, setSelectedCells,
    lastSelectedCell, setLastSelectedCell, isDragging, setIsDragging,
    isFilling, setIsFilling, fillStartCell, setFillStartCell,
    fillPreviewCells, setFillPreviewCells,
    events, setEvents, nextEventNumber, setNextEventNumber,
    mcMode, mcIdentifiant, setActiveTab, setModalRepos
}) => {
    const totalSlots = getTotalSlots(totalDays);
    const [sortKey, setSortKey] = useState('entryOrder');
    const [sortDirection, setSortDirection] = useState('asc');
    const [statsMode, setStatsMode] = useState('total');
    const [hoveredTeam, setHoveredTeam] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    
    // ReferenceTime pour les calculs de statut (initialisé à 0)
    const [referenceTime, setReferenceTime] = React.useState(function() {
        var now = new Date();
        var h = now.getHours() + now.getMinutes() / 60;
        var diff = h - startHour;
        return diff < 0 ? diff + 24 : diff;
    });
    
    // Ref pour capturer l'état actuel de isFilling (évite les problèmes de closure dans les callbacks)
    const isFillingRef = React.useRef(isFilling);
    React.useEffect(() => {
        isFillingRef.current = isFilling;
    }, [isFilling]); // 'total' ou 'current'

    // Ref sur le wrapper du tableau + mémorisation scroll
    const planningWrapperRef = React.useRef(null);

    // Restaurer la position de scroll quand le planning s'affiche
    React.useEffect(() => {
        const wrapper = planningWrapperRef.current;
        if (!wrapper) return;

        // Restaurer la position sauvegardée
        const savedScroll = localStorage.getItem('ssf_planning_scroll');
        if (savedScroll !== null) {
            wrapper.scrollLeft = parseInt(savedScroll, 10);
        }

        // Sauvegarder la position à chaque scroll
        const handleScroll = () => {
            localStorage.setItem('ssf_planning_scroll', wrapper.scrollLeft);
        };
        wrapper.addEventListener('scroll', handleScroll);
        return () => wrapper.removeEventListener('scroll', handleScroll);
    }, []);

    const sauveteurToTeamMap = useMemo(() => {
        const map = {};
        teams.filter(t => t.status !== 'dissolved').forEach(team => {
            team.members.forEach(memberId => {
                map[memberId] = team.id;
            });
        });
        return map;
    }, [teams]);

    const getTeamMission = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.mission : '';
    };

    const activeSauveteursDetails = useMemo(() => {
        let list = activeSauveteurIds
            .map(id => masterSauveteursList.find(s => s.id === id))
            .filter(s => s);

        if (sortKey === 'entryOrder') {
            return list;
        }

        const sortableList = [...list];

        sortableList.sort((a, b) => {
            let comparison = 0;

            if (sortKey === 'numero') {
                // CORRECTION: Utiliser les numéros permanents au lieu de l'index
                const numA = sauveteurPermanentNumbers[a.id] || 999999;
                const numB = sauveteurPermanentNumbers[b.id] || 999999;
                comparison = numA - numB;
            } else if (sortKey === 'name') {
                comparison = a.name.localeCompare(b.name, 'fr', { numeric: true });
            } else if (sortKey === 'team') {
                const teamIdA = sauveteurToTeamMap[a.id] || 'Z';
                const teamIdB = sauveteurToTeamMap[b.id] || 'Z';
                
                const numA = parseInt(teamIdA.replace('T', ''), 10);
                const numB = parseInt(teamIdB.replace('T', ''), 10);

                if (!isNaN(numA) && !isNaN(numB) && teamIdA.startsWith('T') && teamIdB.startsWith('T')) {
                    comparison = numA - numB;
                } else {
                    comparison = teamIdA.localeCompare(teamIdB, 'fr', { numeric: true });
                }
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return sortableList;
    }, [activeSauveteurIds, masterSauveteursList, sortKey, sortDirection, sauveteurToTeamMap, sauveteurPermanentNumbers]);

    const handleSort = (key) => {
        if (sortKey === key) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else {
                setSortKey('entryOrder');
                setSortDirection('asc');
            }
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (key) => {
        if (sortKey !== key) return sortKey === 'entryOrder' ? '' : '—';
        return sortDirection === 'asc' ? '▲' : '▼';
    };

    const getCellKey = (rowId, colIndex) => `${rowId}|${colIndex}`;

    const sauveteurIdToIndexMap = useMemo(() => {
        return activeSauveteursDetails.reduce((map, s, index) => {
            map[s.id] = index;
            return map;
        }, {});
    }, [activeSauveteursDetails]);

    const getCellsInRectangularRange = useCallback((start, end) => {
        const startRowIndex = sauveteurIdToIndexMap[start.rowId];
        const endRowIndex = sauveteurIdToIndexMap[end.rowId];
        
        if (startRowIndex === undefined || endRowIndex === undefined) return [];

        const minRowIndex = Math.min(startRowIndex, endRowIndex);
        const maxRowIndex = Math.max(startRowIndex, endRowIndex);
        const minCol = Math.min(start.colIndex, end.colIndex);
        const maxCol = Math.max(start.colIndex, end.colIndex);
        
        const range = [];
        const safeMaxCol = Math.min(maxCol, totalSlots - 1);

        for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex++) {
            const rowId = activeSauveteursDetails[rowIndex].id;
            for (let colIndex = minCol; colIndex <= safeMaxCol; colIndex++) {
                range.push(getCellKey(rowId, colIndex));
            }
        }
        return range;
    }, [activeSauveteursDetails, sauveteurIdToIndexMap, totalSlots]);

    const handleMouseDown = useCallback((event, rowId, colIndex) => {
        console.log('handleMouseDown called', { 
            rowId, 
            colIndex, 
            target: event.target.className,
            isFillHandle: event.target.classList.contains('fill-handle'),
            isFillingRefCurrent: isFillingRef.current,
            currentSelectionSize: selectedCells.size
        });
        
        // CRITIQUE: Si on est déjà en mode recopie, ignorer complètement
        if (isFillingRef.current) {
            console.log('>>> IGNORING - Already in fill mode');
            return;
        }
        
        // Vérifier si on clique sur la poignée de recopie
        if (event.target.classList.contains('fill-handle')) {
            console.log('>>> IGNORING - Click was on fill handle');
            return; // Ne pas gérer ici, la poignée a son propre gestionnaire
        }
        
        if (colIndex >= totalSlots) return;
        
        const cellKey = getCellKey(rowId, colIndex);
        
        // Si on clique sur une cellule déjà sélectionnée ET qu'il y a plusieurs cellules sélectionnées
        // ne rien faire (permet de garder la sélection pour utiliser la poignée)
        // MAIS si c'est une sélection d'UNE SEULE cellule, on permet de refaire une sélection
        if (selectedCells.has(cellKey) && selectedCells.size > 1) {
            console.log('>>> Clicked on already selected cell in multi-selection - keeping selection');
            return;
        }
        
        // Sinon, nouvelle sélection
        console.log('>>> Starting new selection');
        setSelectedCells(new Set([cellKey]));
        setLastSelectedCell({ rowId, colIndex });
        setIsDragging(true);
        console.log('isDragging set to TRUE (normal mode)');
    }, [totalSlots, setSelectedCells, setLastSelectedCell, setIsDragging, selectedCells]);

    const handleMouseEnter = useCallback((rowId, colIndex) => {
        if (isFilling && fillStartCell && selectedCells.size > 0) {
            // Mode remplissage : calculer l'aperçu incluant la sélection originale
            
            // Trouver les limites de la sélection originale
            let minRow = Infinity, maxRow = -Infinity;
            let minCol = Infinity, maxCol = -Infinity;
            
            selectedCells.forEach(cellKey => {
                const [cellRowId, colIndexStr] = cellKey.split('|');
                const cellColIndex = parseInt(colIndexStr, 10);
                const cellRowIndex = sauveteurIdToIndexMap[cellRowId];
                
                if (cellRowIndex !== undefined) {
                    minRow = Math.min(minRow, cellRowIndex);
                    maxRow = Math.max(maxRow, cellRowIndex);
                }
                minCol = Math.min(minCol, cellColIndex);
                maxCol = Math.max(maxCol, cellColIndex);
            });
            
            // Position actuelle de la souris
            const currentRowIndex = sauveteurIdToIndexMap[rowId];
            if (currentRowIndex === undefined) return;
            
            // Calculer les nouvelles limites incluant la position de la souris
            const newMinRow = Math.min(minRow, currentRowIndex);
            const newMaxRow = Math.max(maxRow, currentRowIndex);
            const newMinCol = Math.min(minCol, colIndex);
            const newMaxCol = Math.max(maxCol, colIndex);
            
            // Créer le set de toutes les cellules à afficher en aperçu
            const previewSet = new Set();
            for (let r = newMinRow; r <= newMaxRow; r++) {
                const cellRowId = activeSauveteursDetails[r]?.id;
                if (cellRowId) {
                    for (let c = newMinCol; c <= newMaxCol; c++) {
                        if (c < totalSlots) {
                            previewSet.add(getCellKey(cellRowId, c));
                        }
                    }
                }
            }
            
            setFillPreviewCells(previewSet);
        } else if (isDragging && lastSelectedCell) {
            // Mode sélection normale
            const currentCoords = { rowId, colIndex };
            const newRangeKeys = getCellsInRectangularRange(lastSelectedCell, currentCoords);
            setSelectedCells(new Set(newRangeKeys));
        }
    }, [isDragging, isFilling, lastSelectedCell, fillStartCell, selectedCells, getCellsInRectangularRange, setSelectedCells, setFillPreviewCells, sauveteurIdToIndexMap, activeSauveteursDetails, totalSlots]);

    const handleMouseUp = useCallback(() => {
        // DEBUG: Afficher l'état actuel
        console.log('=== handleMouseUp ===');
        console.log('isFillingRef.current:', isFillingRef.current);
        console.log('isFilling (captured):', isFilling);
        console.log('isDragging:', isDragging);
        console.log('selectedCells.size:', selectedCells.size);
        console.log('fillPreviewCells.size:', fillPreviewCells.size);
        
        // PRIORITÉ ABSOLUE : MODE POIGNÉE DE RECOPIE
        // Utiliser isFillingRef.current pour avoir la valeur ACTUELLE
        if (isFillingRef.current) {
            console.log('>>> MODE POIGNÉE DE RECOPIE <<<');
            if (fillPreviewCells.size > 0 && selectedCells.size > 0) {
                // Recopier le contenu des cellules sélectionnées (INDÉPENDANT DE LA PALETTE)
                setPlanning(prevPlanning => {
                    const newPlanning = { ...prevPlanning };
                    
                    // Extraire les coordonnées min/max de la sélection originale
                    let minRow = Infinity, maxRow = -Infinity;
                    let minCol = Infinity, maxCol = -Infinity;
                    const selectedArray = Array.from(selectedCells);
                    
                    selectedArray.forEach(cellKey => {
                        const [rowId, colIndexStr] = cellKey.split('|');
                        const colIndex = parseInt(colIndexStr, 10);
                        const rowIndex = sauveteurIdToIndexMap[rowId];
                        
                        if (rowIndex !== undefined) {
                            minRow = Math.min(minRow, rowIndex);
                            maxRow = Math.max(maxRow, rowIndex);
                        }
                        minCol = Math.min(minCol, colIndex);
                        maxCol = Math.max(maxCol, colIndex);
                    });
                    
                    console.log('Selection bounds:', { minRow, maxRow, minCol, maxCol });
                    
                    const selectionHeight = maxRow - minRow + 1;
                    const selectionWidth = maxCol - minCol + 1;
                    
                    // Créer un tableau du contenu de la sélection
                    const selectionContent = [];
                    for (let r = 0; r < selectionHeight; r++) {
                        selectionContent[r] = [];
                        const sourceRowId = activeSauveteursDetails[minRow + r]?.id;
                        if (sourceRowId && prevPlanning[sourceRowId]) {
                            for (let c = 0; c < selectionWidth; c++) {
                                const sourceCol = minCol + c;
                                selectionContent[r][c] = prevPlanning[sourceRowId][sourceCol] || 'nondef';
                            }
                        }
                    }
                    
                    console.log('Selection content:', selectionContent);
                    
                    // Appliquer le contenu aux cellules d'aperçu
                    fillPreviewCells.forEach(cellKey => {
                        const [rowId, colIndexStr] = cellKey.split('|');
                        const colIndex = parseInt(colIndexStr, 10);
                        const rowIndex = sauveteurIdToIndexMap[rowId];
                        
                        if (rowIndex === undefined || colIndex >= totalSlots) return;
                        
                        // Calculer la position relative dans le motif
                        const relativeRow = (rowIndex - minRow) % selectionHeight;
                        const relativeCol = (colIndex - minCol) % selectionWidth;
                        
                        // Gérer les indices négatifs pour le remplissage vers le haut/gauche
                        const patternRow = relativeRow >= 0 ? relativeRow : selectionHeight + relativeRow;
                        const patternCol = relativeCol >= 0 ? relativeCol : selectionWidth + relativeCol;
                        
                        if (selectionContent[patternRow] && selectionContent[patternRow][patternCol]) {
                            const activityToCopy = selectionContent[patternRow][patternCol];
                            console.log(`Copying activity "${activityToCopy}" to ${rowId}|${colIndex}`);
                            
                            if (newPlanning[rowId]) {
                                const newRow = [...newPlanning[rowId]];
                                newRow[colIndex] = activityToCopy;
                                newPlanning[rowId] = newRow;
                            }
                        }
                    });
                    
                    return newPlanning;
                });
            }
            // Nettoyer les états du mode poignée
            setFillPreviewCells(new Set());
            setFillStartCell(null);
            setIsFilling(false);
            isFillingRef.current = false; // Réinitialiser la ref également
            setIsDragging(false);
            setSelectedCells(new Set()); // IMPORTANT : Enlever le cadre bleu
            setLastSelectedCell(null);
            console.log('>>> FIN MODE POIGNÉE - CADRE BLEU NETTOYÉ - RETURN EARLY <<<');
            // RETURN EARLY - Ne pas exécuter le code de la palette
            return;
        }
        
        // MODE SÉLECTION NORMALE : On vient de finir une sélection
        // TOUJOURS garder la sélection visible pour permettre la recopie avec la poignée
        // La palette appliquera l'activité uniquement si on clique dessus explicitement
        if (isDragging && selectedCells.size > 0) {
            console.log('>>> FIN DE SÉLECTION - Sélection gardée (poignée disponible) <<<');
            // Ne rien faire - la sélection reste active
            setIsDragging(false);
            return;
        }
        
        setIsDragging(false);
        console.log('=== END handleMouseUp ===\n');
    }, [isDragging, isFilling, selectedCells, fillPreviewCells, selectedActivityId, sauveteurToTeamMap, totalSlots, setPlanning, setSelectedCells, setLastSelectedCell, setIsDragging, setFillPreviewCells, setFillStartCell, setIsFilling, activeSauveteursDetails, sauveteurIdToIndexMap]);

    useEffect(() => {
        const handleGlobalMouseUp = () => handleMouseUp();
        document.addEventListener('mouseup', handleGlobalMouseUp);
        return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [handleMouseUp]);

    // Gestionnaire de la poignée de recopie
    const handleFillHandleMouseDown = useCallback((event, rowId, colIndex) => {
        console.log('=== FILL HANDLE MOUSE DOWN START ===');
        console.log('Event type:', event.type);
        console.log('Button:', event.button); // 0 = gauche, 2 = droit
        console.log('Position:', { rowId, colIndex });
        
        // CRITIQUE: Mettre à jour la ref IMMÉDIATEMENT (synchrone)
        isFillingRef.current = true;
        console.log('isFillingRef.current set to TRUE');
        
        // IMPORTANT: Désactiver isDragging pour empêcher toute interférence
        setIsDragging(false);
        setIsFilling(true);
        setFillStartCell({ rowId, colIndex });
        setFillPreviewCells(new Set([getCellKey(rowId, colIndex)]));
        
        console.log('States updated:', {
            isFilling: true,
            isFillingRef: isFillingRef.current,
            fillStartCell: { rowId, colIndex }
        });
        console.log('=== FILL HANDLE MOUSE DOWN END ===');
    }, [setIsFilling, setFillStartCell, setFillPreviewCells, setIsDragging]);

    // Trouver la cellule en bas à droite de la sélection pour la poignée
    const getFillHandlePosition = useCallback(() => {
        if (selectedCells.size === 0) return null;

        let maxRow = -1;
        let maxCol = -1;
        let maxRowId = null;

        for (const cellKey of selectedCells) {
            const [rowId, colIndexStr] = cellKey.split('|');
            const colIndex = parseInt(colIndexStr, 10);
            const rowIndex = sauveteurIdToIndexMap[rowId];

            if (rowIndex !== undefined && rowIndex > maxRow) {
                maxRow = rowIndex;
                maxRowId = rowId;
            }
            if (colIndex > maxCol) {
                maxCol = colIndex;
            }
        }

        // Vérifier que la cellule sélectionnée correspond bien à la dernière
        const bottomRightKey = getCellKey(maxRowId, maxCol);
        if (selectedCells.has(bottomRightKey)) {
            return { rowId: maxRowId, colIndex: maxCol };
        }

        return null;
    }, [selectedCells, sauveteurIdToIndexMap]);

    const fillHandlePos = getFillHandlePosition();

    const renderStatutCells = (sauveteurId, hasSelectedCells = false) => {
        const rowData = planning[sauveteurId] || [];
        const categories = {
            sousTerre: ['souterre', 'brancardage', 'plongee'], 
            repos: ['repos_site', 'repos_domicile', 'repas_dejeuner', 'disponible', 'engage'],
            enSurface: ['approche', 'mission_surface', 'mission_hors_site'],
            pc: ['directeur_souterrain', 'conseiller_technique', 'gestion']
        };

        // Calculer le CUMUL de tous les slots renseignés
        let sousTerreCount = 0, reposCount = 0, enSurfaceCount = 0, pcCount = 0;
        rowData.forEach(function(activity) {
            if (!activity || activity === 'nondef' || activity === 'effacer') return;
            if (categories.sousTerre.includes(activity)) sousTerreCount++;
            else if (categories.repos.includes(activity)) reposCount++;
            else if (categories.enSurface.includes(activity)) enSurfaceCount++;
            else if (categories.pc.includes(activity)) pcCount++;
        });
        const toHHMM = function(count) {
            const totalMin = count * 15;
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
        };
        const sousTerreHoursStr = toHHMM(sousTerreCount);
        const reposHoursStr = toHHMM(reposCount);
        const enSurfaceHoursStr = toHHMM(enSurfaceCount);
        const pcHoursStr = toHHMM(pcCount);

        const teamID = sauveteurToTeamMap[sauveteurId];
        const teamObj = teamID ? teams.find(t => t.id === teamID) : null;
        const teamNumberDisplay = teamObj ? teamObj.name.replace('Équipe ', '') : (teamID ? teamID.replace('T', '') : '—');
        
        const cellClass = hasSelectedCells ? 'cell-statut-calc row-selected-other' : 'cell-statut-calc';

        return (
            <>
                <td className={cellClass} style={{color: '#8B4513', fontWeight: 'bold'}}>{sousTerreHoursStr}</td>
                <td className={cellClass} style={{color: '#0066CC', fontWeight: 'bold'}}>{reposHoursStr}</td>
                <td className={cellClass} style={{color: '#228B22', fontWeight: 'bold'}}>{enSurfaceHoursStr}</td>
                <td className={cellClass} style={{color: '#FF8C00', fontWeight: 'bold'}}>{pcHoursStr}</td>
                <td className={`${cellClass} team-cell`}>
                    {teamID ? (
                        <span
                            style={{ cursor: 'pointer', fontWeight: 'bold' }}
                            onMouseEnter={(e) => {
                                setHoveredTeam(teamID);
                                const rect = e.target.getBoundingClientRect();
                                setTooltipPosition({ 
                                    x: rect.left + rect.width / 2, 
                                    y: rect.top - 10 
                                });
                            }}
                            onMouseLeave={() => setHoveredTeam(null)}
                        >
                            {teamNumberDisplay}
                        </span>
                    ) : '—'}
                </td>
            </>
        );
    };

    const renderFixedHeaders = () => {
        const headers = [
            <th key="ssf" className="header-ssf col-id-fix">SSF</th>,
            <th 
                key="num" 
                className="header-id col-id-fix sortable-header" 
                onClick={() => handleSort('numero')}
                title="Cliquer pour trier"
            >
                N° <span className="sort-icon">{getSortIcon('numero')}</span>
            </th>,
            <th 
                key="name" 
                className="header-name col-id-fix sortable-header"
                onClick={() => handleSort('name')}
                title="Cliquer pour trier"
            >
                Nom & Prénom <span className="sort-icon">{getSortIcon('name')}</span>
            </th>,
            <th key="role" className="header-role col-id-fix">Rôle</th>,
            <th key="sousTerre" className="header-statut statut-col-calc" style={{color: '#8B4513'}}>Sous terre</th>,
            <th key="repos" className="header-statut statut-col-calc" style={{color: '#0066CC'}}>Repos</th>,
            <th key="enSurface" className="header-statut statut-col-calc" style={{color: '#228B22'}}>En surface</th>,
            <th key="pc" className="header-statut statut-col-calc" style={{color: '#FF8C00'}}>PC</th>,
            <th 
                key="team" 
                className="header-statut statut-col-calc sortable-header"
                onClick={() => handleSort('team')}
                title="Cliquer pour trier"
            >
                Équipe <span className="sort-icon">{getSortIcon('team')}</span>
            </th>
        ];

        for (let i = 0; i < totalSlots; i++) {
            const { day, time, isHourStart, isDayStart } = indexToTime(i, startHour, totalDays);
            if (isHourStart) {
                const displayTime = time.substring(0, 5);
                headers.push(
                    <th 
                        key={`time-${i}`} 
                        colSpan={SLOTS_PER_HOUR} 
                        className="header-time"
                        style={{
                            borderLeft: isDayStart ? '2px solid #ffcc00' : '2px solid #000',
                            backgroundColor: day % 2 === 0 ? '#004080' : '#0055a4',
                            fontSize: '11px'
                        }}
                    >
                        J{day} {displayTime}
                    </th>
                );
            }
        }
        return headers;
    };

    const renderDataRows = () => {
        return activeSauveteursDetails.map((sauveteur, index) => {
            const sauveteurId = sauveteur.id;
            const rowData = planning[sauveteurId] || Array(totalSlots).fill('nondef');

            // Vérifier si cette ligne contient des cellules sélectionnées
            const hasSelectedCells = Array.from(selectedCells).some(cellKey => {
                const [rowId] = cellKey.split('|');
                return rowId === sauveteurId;
            });
            
            // Obtenir le numéro permanent du sauveteur
            const permanentNumber = sauveteurPermanentNumbers[sauveteurId] || '?';

            return (
                <tr key={sauveteurId}>
                    <td className={`cell-ssf cell-id-fix ${hasSelectedCells ? 'row-selected-other' : ''}`}>{sauveteur.SSF}</td>
                    <td className={`cell-id cell-id-fix ${hasSelectedCells ? 'row-selected-other' : ''}`}>{permanentNumber}</td>
                    <td className={`cell-name cell-id-fix ${hasSelectedCells ? 'row-has-selection' : ''}`}>{sauveteur.name}</td>
                    <td className={`cell-role cell-id-fix ${hasSelectedCells ? 'row-selected-other' : ''}`} title={sauveteur.role}>{sauveteur.role}</td>
                    {renderStatutCells(sauveteurId, hasSelectedCells)}
                    {rowData.map((activityId, colIndex) => {
                        const activity = ACTIVITIES.find(a => a.id === activityId) || ACTIVITIES.find(a => a.id === 'nondef');
                        const { isHourStart, isDayStart } = indexToTime(colIndex, startHour, totalDays);
                        const cellKey = getCellKey(sauveteurId, colIndex);
                        const isSelected = selectedCells.has(cellKey);
                        const isFillPreview = fillPreviewCells.has(cellKey);
                        const teamID = sauveteurToTeamMap[sauveteurId];
                        
                        // Vérifier si cette cellule doit afficher la poignée
                        const shouldShowHandle = fillHandlePos && 
                            fillHandlePos.rowId === sauveteurId && 
                            fillHandlePos.colIndex === colIndex;

                        return (
                            <td
                                key={colIndex}
                                className={`time-slot-cell ${isSelected ? 'selected-cell' : ''} ${isFillPreview ? 'fill-preview' : ''}`}
                                data-is-hour-start={isHourStart}
                                data-is-day-start={isDayStart}
                                style={{
                                    backgroundColor: activity.color,
                                    color: getContrastColor(activity.color),
                                }}
                                onMouseDownCapture={(e) => {
                                    // CAPTURE : se déclenche AVANT la propagation normale
                                    // Vérifier si on clique sur la poignée
                                    if (e.target.classList.contains('fill-handle')) {
                                        console.log('>>> CAPTURE: Click on fill-handle detected! <<<');
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleFillHandleMouseDown(e, sauveteurId, colIndex);
                                        return;
                                    }
                                }}
                                onMouseDown={(e) => {
                                    // Ne pas traiter si le clic est sur la poignée ou ses enfants
                                    if (e.target.classList.contains('fill-handle') || 
                                        e.target.closest('.fill-handle')) {
                                        console.log('>>> TD: Ignoring click on fill-handle');
                                        return;
                                    }
                                    handleMouseDown(e, sauveteurId, colIndex);
                                }}
                                onMouseEnter={() => handleMouseEnter(sauveteurId, colIndex)}
                                onContextMenu={(e) => {
                                    // Empêcher le menu contextuel sur les cellules
                                    if (e.target.classList.contains('fill-handle') || 
                                        e.target.closest('.fill-handle')) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }}
                            >
                                {activity.teamRequired && teamID ? (teams.find(t => t.id === teamID)?.name.replace('Équipe ', '') || teamID.replace('T','')) : ''}
                                {shouldShowHandle && (
                                    <div 
                                        className="fill-handle"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        title="Maintenez le clic gauche et glissez pour recopier"
                                    />
                                )}
                            </td>
                        );
                    })}
                </tr>
            );
        });
    };

    const propagerPlanningManuellement = function() {
        const now = new Date();
        let minutesSinceStart = (now.getHours() * 60 + now.getMinutes()) - (startHour * 60);
        if (minutesSinceStart < 0) minutesSinceStart += 24 * 60;
        const slotEcoule = Math.floor(minutesSinceStart / 15) - 1;
        const totalSlots = getTotalSlots(totalDays);
        if (slotEcoule < 0 || slotEcoule >= totalSlots) { alert('Aucun creneau ecoule dans la plage du planning.'); return; }
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
        if (sauveteursPropager.length === 0) { alert('Aucun creneau vide a combler. Tous les sauveteurs sont a jour.'); return; }
        const noms = [...new Set(sauveteursPropager.map(function(s) { return s.activite; }))];
        const duree = Math.max.apply(null, sauveteursPropager.map(function(s) { return s.slotFin - s.slotDebut + 1; })) * 15;
        const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const msg = 'Mise a jour - ' + heure + '\n\n' + sauveteursPropager.length + ' sauveteur(s), ' + duree + ' min max.\nActivites: ' + noms.join(', ') + '\n\nVoulez-vous remplir les creneaux vides ?';
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

    return (
        <div>
            {/* Contrôles */}
            <div className="mb-4 flex gap-4 items-center flex-wrap">
                <div>
                    <label className="font-semibold mr-2">Début J1:</label>
                    <select 
                        value={startHour} 
                        onChange={(e) => {
                            if (activeSauveteurIds.length > 0) {
                                alert('⚠️ Impossible de modifier l\'heure de début car des personnes sont déjà inscrites au planning.\n\nPour changer l\'heure de début, vous devez d\'abord :\n1. Réinitialiser (Mode Maintenance > RESET APPLI)\n2. Ou retirer toutes les personnes du planning');
                                return;
                            }
                            setStartHour(parseInt(e.target.value, 10));
                        }}
                        className="px-3 py-2 border rounded"
                        title={activeSauveteurIds.length > 0 ? 
                            "Impossible de modifier l'heure de début car des personnes sont inscrites" : 
                            "Heure de début du planning"
                        }
                        style={activeSauveteurIds.length > 0 ? {opacity: 0.6, cursor: 'not-allowed'} : {}}
                    >
                        {Array.from({length: 24}, (_, i) => (
                            <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="font-semibold mr-2">Jours (1-14):</label>
                    <input 
                        type="number" 
                        value={totalDays}
                        onChange={(e) => setTotalDays(Math.max(1, Math.min(14, parseInt(e.target.value, 10))))}
                        min="1" max="14"
                        className="px-3 py-2 border rounded w-20"
                    />
                </div>
                {/* Bouton statsMode désactivé - on affiche uniquement le créneau actuel */}
                <div style={{display: 'none'}}>
                    <button
                        onClick={() => setStatsMode(statsMode === 'total' ? 'current' : 'total')}
                        className={`px-4 py-2 rounded font-semibold text-sm transition-all ${
                            statsMode === 'total' 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                        title="Basculer entre total cumulé et période actuelle"
                    >
                        {statsMode === 'total' ? '📊 Mode: Total cumulé' : '⏱️ Mode: Période actuelle'}
                    </button>
                </div>
                
                <div>
                    <button onClick={propagerPlanningManuellement} style={{background:"#f97316",color:"white",padding:"8px 14px",borderRadius:"6px",fontWeight:"600",fontSize:"13px",cursor:"pointer",border:"none"}} title="Remplir les creneaux vides avec la derniere activite connue">
                        Mettre a jour les activites
                    </button>
                </div>
                {/* Message d'aide intégré à droite */}
                <div className="flex-1 bg-blue-50 border-l-4 border-blue-500 p-2 text-xs">
                    <p className="font-semibold text-blue-800">💡 Deux actions :</p>
                    <p className="text-blue-700">
                        <strong>🔄 Recopie :</strong> Sélectionnez des cellules → poignée bleue. 
                        <strong>🎨 Palette :</strong> Sélectionnez des cellules → cliquez sur l'activité.
                    </p>
                </div>
                
                <div className="ml-auto">
                    Activité: <span className="px-3 py-1 rounded" style={{
                        backgroundColor: ACTIVITIES.find(a => a.id === selectedActivityId)?.color,
                        color: getContrastColor(ACTIVITIES.find(a => a.id === selectedActivityId)?.color || '#fff')
                    }}>
                        {ACTIVITIES.find(a => a.id === selectedActivityId)?.name}
                    </span>
                </div>
            </div>

            {/* Tableau */}
            <div className="planning-table-wrapper" ref={planningWrapperRef}>
                <table className="planning-table">
                    <thead><tr>{renderFixedHeaders()}</tr></thead>
                    <tbody>{renderDataRows()}</tbody>
                </table>
            </div>

            {/* Palette - uniquement visible dans le Planning */}
            <PaletteActivites 
                selectedActivityId={selectedActivityId}
                setSelectedActivityId={setSelectedActivityId}
                selectedCells={selectedCells}
                setSelectedCells={setSelectedCells}
                setLastSelectedCell={setLastSelectedCell}
                planning={planning}
                setPlanning={setPlanning}
                sauveteurToTeamMap={sauveteurToTeamMap}
                totalSlots={totalSlots}
                events={events}
                setEvents={setEvents}
                nextEventNumber={nextEventNumber}
                setNextEventNumber={setNextEventNumber}
                mcMode={mcMode}
                mcIdentifiant={mcIdentifiant}
                masterSauveteursList={masterSauveteursList}
                setModalRepos={setModalRepos}
                setActiveTab={setActiveTab}
            />

            {/* Tooltip pour la mission de l'équipe */}
            {hoveredTeam && (
                <div 
                    style={{
                        position: 'fixed',
                        left: tooltipPosition.x + 'px',
                        top: tooltipPosition.y + 'px',
                        transform: 'translate(-50%, -100%)',
                        backgroundColor: '#1e40af',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        zIndex: 10000,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                        maxWidth: '300px'
                    }}
                >
                    <div style={{ marginBottom: '4px', fontSize: '11px', opacity: 0.9 }}>
                        Mission {hoveredTeam}:
                    </div>
                    <div>
                        {getTeamMission(hoveredTeam)}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// COMPOSANT PALETTE
// ============================================
const PaletteActivites = ({ 
    selectedActivityId, 
    setSelectedActivityId,
    selectedCells,
    setSelectedCells,
    setLastSelectedCell,
    planning,
    setPlanning,
    sauveteurToTeamMap,
    totalSlots,
    events,
    setEvents,
    nextEventNumber,
    setNextEventNumber,
    mcMode,
    mcIdentifiant,
    masterSauveteursList,
    setModalRepos,
    setActiveTab
}) => {
    
    const handleActivityClick = (activityId) => {
        console.log('>>> Palette: Activity clicked:', activityId);
        
        // Changer l'activité sélectionnée
        setSelectedActivityId(activityId);
        
        // Si des cellules sont sélectionnées, appliquer l'activité IMMÉDIATEMENT
        if (selectedCells.size > 0) {
            console.log('>>> Applying activity to', selectedCells.size, 'selected cells');
            const activity = ACTIVITIES.find(a => a.id === activityId);
            
            // Collecter les sauveteurs concernés AVANT de modifier le planning
            const sauveteursConcernes = [];
            
            for (const cellKey of selectedCells) {
                const [rowId, colIndexStr] = cellKey.split('|');
                const colIndex = parseInt(colIndexStr, 10);
                
                const isTeamActivity = activity && activity.teamRequired;
                const isInTeam = sauveteurToTeamMap[rowId];

                if (colIndex >= totalSlots) continue;
                if (isTeamActivity && !isInTeam) continue;

                if (!sauveteursConcernes.includes(rowId)) {
                    sauveteursConcernes.push(rowId);
                }
            }
            
            // Appliquer au planning
            setPlanning(prevPlanning => {
                const newPlanning = { ...prevPlanning };
                for (const cellKey of selectedCells) {
                    const [rowId, colIndexStr] = cellKey.split('|');
                    const colIndex = parseInt(colIndexStr, 10);
                    
                    const isTeamActivity = activity && activity.teamRequired;
                    const isInTeam = sauveteurToTeamMap[rowId];

                    if (colIndex >= totalSlots) continue;
                    if (isTeamActivity && !isInTeam) continue;

                    if (newPlanning[rowId]) {
                        const newRow = [...newPlanning[rowId]];
                        newRow[colIndex] = activityId;
                        newPlanning[rowId] = newRow;
                    } else {
                        // Créer une nouvelle ligne pour ce sauveteur
                        const newRow = Array(totalSlots).fill('nondef');
                        newRow[colIndex] = activityId;
                        newPlanning[rowId] = newRow;
                    }
                }
                return newPlanning;
            });
            
            // Créer un événement dans la Main Courante (sauf pour "effacer" et "nondef")
            if (activity && activity.id !== 'effacer' && activity.id !== 'nondef' && sauveteursConcernes.length > 0) {
                console.log('>>> Creating MC event for activity:', activity.name, 'sauveteurs:', sauveteursConcernes);
                
                // Récupérer les noms des sauveteurs
                const nomsSauveteurs = sauveteursConcernes
                    .map(id => masterSauveteursList.find(s => s.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');
                
                console.log('>>> Sauveteurs names:', nomsSauveteurs);
                
                // Déterminer la catégorie et l'icône selon l'activité
                let categorie = 'autre';
                let icone = '📅';
                
                // 📍 Progression : Mission de surface, Approche, Sous terre, Brancardage, Plongée
                if (['mission_surface', 'approche', 'souterre', 'brancardage', 'plongee'].includes(activity.id)) {
                    categorie = 'progression';
                    icone = '📍';
                }
                // 👔 Équipe : Engagé, Conseiller technique, Directeur secours, Gestion, Mission hors site
                else if (['engage', 'conseiller_technique', 'directeur_souterrain', 'gestion', 'mission_hors_site'].includes(activity.id)) {
                    categorie = 'equipe';
                    icone = '👔';
                }
                // 🛏️ Repos sur site ou domicile → ouvrir modale durée
                else if (['repos_site', 'repos_domicile'].includes(activity.id)) {
                    categorie = 'intendance';
                    icone = '🛏️';
                    const sauveursAvecNom = sauveteursConcernes.map(id => {
                        const s = masterSauveteursList.find(sv => sv.id === id);
                        return s ? { id, name: s.name } : null;
                    }).filter(Boolean);
                    setModalRepos({
                        sauveteurs: nomsSauveteurs,
                        sauveursListe: sauveursAvecNom,
                        activityName: activity.name,
                        icone,
                        categorie,
                        eventBase: {
                            secretaire: 'Système',
                            dateHeure: new Date().toLocaleString('fr-FR'),
                            isoTimestamp: new Date().toISOString(),
                            messageImportant: false,
                            categorie,
                            nextNum: nextEventNumber,
                            fait: false
                        }
                    });
                    setActiveTab('maincourante');
                    setNextEventNumber(nextEventNumber + sauveursAvecNom.length + 1);
                    return; // Ne pas créer l'événement ici
                }
                // 🍽️ Repas
                else if (activity.id.includes('repas')) {
                    categorie = 'intendance';
                    icone = '🍽️';
                }
                // 🧑‍⚕️ Disponible
                else if (activity.id === 'disponible') {
                    categorie = 'personnel';
                    icone = '🧑‍⚕️';
                }
                // 🚪 Quitter le secours
                else if (activity.id === 'quitter_secours') {
                    categorie = 'personnel';
                    icone = '🚪';
                }
                
                const newEvent = {
                    id: Date.now(),
            isoTimestamp: new Date().toISOString(),
                    secretaire: 'Système',
                    dateHeure: new Date().toLocaleString('fr-FR'),
                    messageImportant: false,
                    categorie: categorie,
                    evenement: `${icone} Activité "${activity.name}" affectée à : ${nomsSauveteurs}`,
                    numero: (mcMode === 'secondaire' && mcIdentifiant) ? 
                        `${mcIdentifiant}-${nextEventNumber.toString().padStart(3, '0')}` : 
                        nextEventNumber.toString().padStart(3, '0'),
                    fait: false
                };
                
                console.log('>>> New event created:', newEvent);
                console.log('>>> Current events count:', events.length);
                
                setEvents(prev => {
                    console.log('>>> Adding event to events array, prev length:', prev.length);
                    return [...prev, newEvent];
                });
                setNextEventNumber(prev => prev + 1);
                
                console.log('>>> MC event created successfully');
            } else {
                console.log('>>> No MC event created - activity:', activity?.id, 'sauveteurs:', sauveteursConcernes.length);
            }
            
            // Nettoyer la sélection après application
            setSelectedCells(new Set());
            setLastSelectedCell(null);
            console.log('>>> Activity applied, selection cleared');
        }
    };
    
    useEffect(() => {
        const palette = document.getElementById('activity-palette');
        const title = document.getElementById('palette-title');
        
        if (!palette || !title) return;

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        const handleMouseDown = (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = palette.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            palette.style.right = 'auto';
            palette.style.left = initialLeft + 'px';
            palette.style.top = initialTop + 'px';
            
            title.style.cursor = 'grabbing';
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            palette.style.left = (initialLeft + deltaX) + 'px';
            palette.style.top = (initialTop + deltaY) + 'px';
        };
        
        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                title.style.cursor = 'grab';
            }
        };

        title.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            title.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return (
        <div className="activity-palette" id="activity-palette">
            <h4 className="palette-title" id="palette-title">🎨 Palette d'Activités (Déplaçable)</h4>
            <div className="palette-grid">
                {ACTIVITIES.filter(a => a.id !== 'nondef').map(activity => (
                    <button
                        key={activity.id}
                        className={`palette-button ${activity.id === selectedActivityId ? 'active' : ''}`}
                        data-team-required={activity.teamRequired}
                        style={{
                            backgroundColor: activity.color,
                            color: getContrastColor(activity.color)
                        }}
                        onClick={() => handleActivityClick(activity.id)}
                    >
                        {activity.teamRequired && (
                            <span className="team-indicator" title="Nécessite d'être affecté à une équipe">
                                👥
                            </span>
                        )}
                        {activity.name}
                    </button>
                ))}
            </div>
        </div>
    );
};