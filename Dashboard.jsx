// ============================================
// COMPOSANT SYNTHÈSE AFFECTATIONS
// ============================================
const SyntheseTab = ({ 
    masterSauveteursList, activeSauveteurIds, planning, totalDays, startHour
}) => {
    const totalSlots = getTotalSlots(totalDays);
    
    // Calculer l'heure actuelle par rapport au planning
    const getCurrentTimeInPlanning = () => {
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        
        // Calculer combien d'heures se sont écoulées depuis startHour aujourd'hui
        let hoursFromStart = currentHour - startHour;
        
        // Si on est avant l'heure de début, considérer qu'on est au début
        if (hoursFromStart < 0) {
            hoursFromStart = 0;
        }
        
        // Si on dépasse la durée du planning, mettre à la fin
        const maxHours = totalSlots / 2;
        if (hoursFromStart > maxHours) {
            hoursFromStart = maxHours;
        }
        
        return hoursFromStart;
    };
    
    const [referenceTime, setReferenceTime] = useState(getCurrentTimeInPlanning());
    const [selectedActivities, setSelectedActivities] = useState([]); // Vides par défaut
    const [printMode, setPrintMode] = useState('detail'); // 'all', 'synthese', 'detail'

    // Initialiser à l'heure actuelle au montage
    useEffect(() => {
        setReferenceTime(getCurrentTimeInPlanning());
    }, [totalSlots, startHour]);

    // Calculer les affectations à l'heure de référence
    const getAffectationsAtTime = () => {
        const slotIndex = Math.floor(referenceTime / TIME_PER_SLOT);
        const affectations = {};

        ACTIVITIES.forEach(activity => {
            affectations[activity.id] = [];
        });

        activeSauveteurIds.forEach(sauvId => {
            const sauvPlanning = planning[sauvId];
            if (!sauvPlanning) return;

            const activityId = sauvPlanning[slotIndex];
            if (activityId && activityId !== 'nondef') {
                const sauv = masterSauveteursList.find(s => s.id === sauvId);
                if (sauv) {
                    affectations[activityId].push(sauv);
                }
            }
        });

        return affectations;
    };

    const affectations = getAffectationsAtTime();

    // Calculer le total de sauveteurs affectés
    const totalAffectes = Object.values(affectations).reduce((sum, sauvs) => sum + sauvs.length, 0);

    const handleActivityToggle = (activityId) => {
        if (selectedActivities.includes(activityId)) {
            setSelectedActivities(selectedActivities.filter(id => id !== activityId));
        } else {
            setSelectedActivities([...selectedActivities, activityId]);
        }
    };

    const handlePrint = () => {
        // Appliquer la classe CSS selon le mode sélectionné
        if (printMode === 'synthese') {
            document.body.classList.add('print-synthese-only');
            document.body.classList.remove('print-detail-only');
        } else if (printMode === 'detail') {
            document.body.classList.add('print-detail-only');
            document.body.classList.remove('print-synthese-only');
        } else {
            // mode 'all' - afficher tout
            document.body.classList.remove('print-synthese-only', 'print-detail-only');
        }
        
        // Lancer l'impression
        window.print();
        
        // Nettoyer après impression
        setTimeout(() => {
            document.body.classList.remove('print-synthese-only', 'print-detail-only');
        }, 100);
    };

    // Formater l'heure de référence pour l'affichage en bleu
    const formatReferenceTime = (hours) => {
        const day = Math.floor(hours / 24) + 1;
        const hourInDay = hours % 24;
        const displayHour = Math.floor((startHour + hourInDay) % 24);
        const minutes = Math.round((hourInDay % 1) * 60);
        return `J${day} ${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    // Formater comme intervalle de temps (créneau de 15 minutes)
    const formatReferenceTimeAsInterval = (hours) => {
        // Calculer le début du créneau (arrondir au créneau de 15 min inférieur)
        const slotIndex = Math.floor(hours / TIME_PER_SLOT);
        const startHours = slotIndex * TIME_PER_SLOT;
        const endHours = startHours + TIME_PER_SLOT;
        
        // Formater le début
        const dayStart = Math.floor(startHours / 24) + 1;
        const hourInDayStart = startHours % 24;
        const displayHourStart = Math.floor((startHour + hourInDayStart) % 24);
        const minutesStart = Math.round((hourInDayStart % 1) * 60);
        
        // Formater la fin
        const hourInDayEnd = endHours % 24;
        const displayHourEnd = Math.floor((startHour + hourInDayEnd) % 24);
        const minutesEnd = Math.round((hourInDayEnd % 1) * 60);
        
        return `J${dayStart} ${displayHourStart.toString().padStart(2, '0')}:${minutesStart.toString().padStart(2, '0')} à ${displayHourEnd.toString().padStart(2, '0')}:${minutesEnd.toString().padStart(2, '0')}`;
    };

    // Formater pour le champ de saisie (format décimal avec 2 décimales pour correspondre au planning)
    const formatInputTime = (hours) => {
        const h = Math.floor(hours);
        const m = Math.round((hours % 1) * 60);
        const decimalMinutes = (m / 60 * 100).toFixed(0).padStart(2, '0');
        return `${h}.${decimalMinutes}`;
    };

    // Convertir depuis le format saisi vers les heures décimales
    const parseInputTime = (value) => {
        const parts = value.toString().split('.');
        const h = parseInt(parts[0]) || 0;
        const decimalMinutes = parseInt(parts[1]) || 0;
        const minutes = (decimalMinutes / 100) * 60;
        return h + (minutes / 60);
    };

    return (
        <div className="p-6">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-2xl font-bold text-blue-700 mb-6 no-print">
                    Synthèse de la Situation sur les Affectations (V10.36)
                </h2>

                {/* Contrôle de l'heure de référence */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6 no-print">
                    <div className="flex items-center gap-4">
                        <label className="font-semibold">Heure de référence (J1 HH:MM) :</label>
                        <input 
                            type="range" 
                            min="0" 
                            max={totalSlots / 2}
                            step="0.25"
                            value={referenceTime}
                            onChange={(e) => setReferenceTime(parseFloat(e.target.value))}
                            className="flex-1"
                        />
                        
                        {/* Boutons de navigation */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setReferenceTime(Math.max(0, referenceTime - 1))}
                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-lg"
                                title="Reculer d'une heure"
                            >
                                ⏪
                            </button>
                            <button
                                onClick={() => setReferenceTime(Math.max(0, referenceTime - 0.25))}
                                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-bold text-lg"
                                title="Reculer de 15 minutes"
                            >
                                ◀
                            </button>
                            <button
                                onClick={() => setReferenceTime(Math.min(totalSlots / 2, referenceTime + 0.25))}
                                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-bold text-lg"
                                title="Avancer de 15 minutes"
                            >
                                ▶
                            </button>
                            <button
                                onClick={() => setReferenceTime(Math.min(totalSlots / 2, referenceTime + 1))}
                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-lg"
                                title="Avancer d'une heure"
                            >
                                ⏩
                            </button>
                        </div>
                        
                        <span className="font-bold text-blue-700 text-xl">
                            {formatReferenceTimeAsInterval(referenceTime)}
                        </span>
                    </div>
                </div>

                {/* Titre pour l'impression uniquement */}
                <div className="print-only" style={{display: 'none'}}>
                    <h1 style={{fontSize: '18pt', fontWeight: 'bold', marginBottom: '10mm', color: '#1d4ed8'}}>
                        Synthèse de la Situation sur les Affectations (V10.36)
                    </h1>
                    <p style={{fontSize: '14pt', fontWeight: 'bold', marginBottom: '10mm', color: '#2563eb'}}>
                        Heure de référence : {formatReferenceTimeAsInterval(referenceTime)}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Section 1: Synthèse Globale */}
                    <div className="bg-blue-50 p-4 rounded-lg section-synthese">
                        <h3 className="font-bold text-lg mb-4 text-blue-800">
                            1. Synthèse Globale des Affectations (Comptage)
                        </h3>
                        <div className="bg-white rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-blue-600 text-white">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Activité</th>
                                        <th className="px-3 py-2 text-center">Sauveteurs affectés</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ACTIVITIES.filter(a => a.id !== 'nondef').map(activity => (
                                        <tr key={activity.id} className="border-b">
                                            <td 
                                                className="px-3 py-2 font-semibold"
                                                style={{ color: activity.color }}
                                            >
                                                {activity.name}
                                            </td>
                                            <td className="px-3 py-2 text-center font-bold">
                                                {affectations[activity.id]?.length || 0}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-100 font-bold">
                                        <td className="px-3 py-2">TOTAL (Sauveteurs Affectés)</td>
                                        <td className="px-3 py-2 text-center text-blue-700 text-lg">
                                            {totalAffectes}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 2: Détail des Sauveteurs */}
                    <div className="bg-gray-50 p-4 rounded-lg section-detail">
                        <h3 className="font-bold text-lg mb-4 text-blue-800">
                            2. Détail des Sauveteurs Affectés (Listes Imprimables)
                        </h3>
                        
                        {/* Sélection des activités */}
                        <div className="mb-4 no-print">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-semibold">Sélectionner les activités à afficher/imprimer :</p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setSelectedActivities(ACTIVITIES.filter(a => a.id !== 'nondef').map(a => a.id))}
                                        className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                    >
                                        ✓ Tout sélectionner
                                    </button>
                                    <button 
                                        onClick={() => setSelectedActivities([])}
                                        className="text-xs bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                                    >
                                        ✗ Tout désélectionner
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                {ACTIVITIES.filter(a => a.id !== 'nondef').map(activity => (
                                    <label key={activity.id} className="flex items-center gap-2 text-sm">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedActivities.includes(activity.id)}
                                            onChange={() => handleActivityToggle(activity.id)}
                                            className="w-4 h-4"
                                        />
                                        <span style={{ color: activity.color }} className="font-semibold">
                                            {activity.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Listes des sauveteurs */}
                        <div className="bg-white rounded-lg border max-h-96 overflow-y-auto p-4">
                            {ACTIVITIES.filter(a => 
                                a.id !== 'nondef' && 
                                selectedActivities.includes(a.id)
                            ).map(activity => {
                                const sauveteurs = affectations[activity.id] || [];
                                if (sauveteurs.length === 0) return null;
                                
                                return (
                                    <div key={activity.id} className="mb-4">
                                        <h4 
                                            className="font-bold mb-2 pb-1 border-b-2"
                                            style={{ color: activity.color, borderColor: activity.color }}
                                        >
                                            {activity.name} ({sauveteurs.length})
                                        </h4>
                                        <ul className="space-y-1 ml-4">
                                            {sauveteurs.map(sauv => (
                                                <li key={sauv.id} className="text-sm">
                                                    • <strong>{sauv.name}</strong> - {sauv.role} (SSF: {sauv.SSF})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                            {selectedActivities.every(id => !affectations[id] || affectations[id].length === 0) && (
                                <p className="text-gray-500 text-center py-8">
                                    Aucun sauveteur affecté aux activités sélectionnées
                                </p>
                            )}
                        </div>

                        {/* Sélecteur de mode d'impression */}
                        <div className="mt-4 bg-white p-3 rounded-lg border border-gray-300 no-print">
                            <p className="font-semibold text-sm mb-2">Que souhaitez-vous imprimer ?</p>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="printMode" 
                                        value="detail"
                                        checked={printMode === 'detail'}
                                        onChange={(e) => setPrintMode(e.target.value)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Uniquement les détails des sauveteurs affectés</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="printMode" 
                                        value="synthese"
                                        checked={printMode === 'synthese'}
                                        onChange={(e) => setPrintMode(e.target.value)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Uniquement la synthèse globale (comptage)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="printMode" 
                                        value="all"
                                        checked={printMode === 'all'}
                                        onChange={(e) => setPrintMode(e.target.value)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Tout imprimer (synthèse + détails)</span>
                                </label>
                            </div>
                        </div>

                        <button 
                            onClick={handlePrint}
                            className="w-full mt-4 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-semibold flex items-center justify-center gap-2 no-print"
                        >
                            🖨️ Imprimer la(les) liste(s)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ONGLET DASHBOARD - TABLEAU DE BORD
// ============================================
const DashboardTab = ({ 
    masterSauveteursList, 
    activeSauveteurIds, 
    planning, 
    totalDays, 
    startHour,
    teams,
    events,
    mcMode,
    mcIdentifiant
}) => {
    const [showReportModal, setShowReportModal] = useState(false);
    const [alertThreshold, setAlertThreshold] = useState(6); // Heures
    
    const getTotalSlots = (days) => days * 24 * 2;
    const totalSlots = getTotalSlots(totalDays);
    
    // Calcul des statistiques temps réel
    const calculateStatistics = () => {
        const stats = {
            totalSauveteurs: masterSauveteursList.length,
            sauveteursSurSite: activeSauveteurIds.length,
            sauveteursDispo: activeSauveteurIds.length - teams.filter(t => t.status !== 'dissolved').reduce((sum, t) => sum + t.members.length, 0),
            equipesActives: teams.filter(t => t.status !== 'dissolved').length,
            totalMembresEquipes: teams.filter(t => t.status !== 'dissolved').reduce((sum, t) => sum + t.members.length, 0),
            activites: {},
            tempsParSauveteur: {},
            alertes: [],
            hasPlanning: false
        };

        // Vérifier si le planning contient des données
        const planningKeys = Object.keys(planning);
        stats.hasPlanning = planningKeys.length > 0;

        if (stats.hasPlanning) {
            // Détecter le format du planning
            const firstKey = planningKeys[0];
            const firstValue = planning[firstKey];
            const isArrayFormat = Array.isArray(firstValue);

            // Calculer le temps par activité et par sauveteur DEPUIS LE PLANNING
            activeSauveteurIds.forEach(sauveteurId => {
                const sauveteur = masterSauveteursList.find(s => s.id === sauveteurId);
                if (!sauveteur) return;

                let totalHeures = 0;
                const activiteTemps = {};

                if (isArrayFormat) {
                    // FORMAT TABLEAU : planning[sauveteurId] = [activity1, activity2, ...]
                    const activities = planning[sauveteurId];
                    if (Array.isArray(activities)) {
                        activities.forEach((activityId, slot) => {
                            if (activityId && activityId !== 'nondef') {
                                totalHeures += 0.5;
                                activiteTemps[activityId] = (activiteTemps[activityId] || 0) + 0.5;
                                
                                if (!stats.activites[activityId]) {
                                    stats.activites[activityId] = { count: 0, heures: 0 };
                                }
                                stats.activites[activityId].heures += 0.5;
                            }
                        });
                    }
                } else {
                    // FORMAT CLÉ : planning["sauveteurId|slot"] = activity
                    for (let slot = 0; slot < totalSlots; slot++) {
                        const key = `${sauveteurId}|${slot}`;
                        const activityId = planning[key];
                        
                        if (activityId && activityId !== 'nondef') {
                            totalHeures += 0.5;
                            activiteTemps[activityId] = (activiteTemps[activityId] || 0) + 0.5;
                            
                            if (!stats.activites[activityId]) {
                                stats.activites[activityId] = { count: 0, heures: 0 };
                            }
                            stats.activites[activityId].heures += 0.5;
                        }
                    }
                }

                // Sauvegarder les stats du sauveteur seulement s'il a du temps
                if (totalHeures > 0) {
                    stats.tempsParSauveteur[sauveteurId] = {
                        nom: sauveteur.name,
                        totalHeures,
                        activites: activiteTemps
                    };

                    // Vérifier si approche limite réglementaire (10h = alerte orange, 12h = alerte rouge)
                    const sousTerreTotalHeures = (activiteTemps['souterre'] || 0);
                    if (sousTerreTotalHeures >= 10) {
                        stats.alertes.push({
                            type: sousTerreTotalHeures >= 12 ? 'danger' : 'warning',
                            message: `${sauveteur.name} : ${sousTerreTotalHeures}h sous terre`,
                            sauveteur: sauveteur.name,
                            heures: sousTerreTotalHeures
                        });
                    }
                }
            });

            // Compter les sauveteurs par activité
            Object.keys(stats.activites).forEach(actId => {
                let count = 0;
                activeSauveteurIds.forEach(sId => {
                    if (stats.tempsParSauveteur[sId]?.activites[actId] > 0) {
                        count++;
                    }
                });
                stats.activites[actId].count = count;
            });
            
            // Si aucun sauveteur n'a de temps, considérer comme pas de planning
            if (Object.keys(stats.tempsParSauveteur).length === 0) {
                stats.hasPlanning = false;
            }
        }
        
        if (!stats.hasPlanning) {
            // PAS DE PLANNING : Calculer des statistiques basiques
            // Compter les sauveteurs en équipe comme "intervention"
            if (stats.totalMembresEquipes > 0) {
                stats.activites['intervention'] = {
                    count: stats.totalMembresEquipes,
                    heures: 0
                };
            }
            
            // Compter les disponibles
            if (stats.sauveteursDispo > 0) {
                stats.activites['disponible'] = {
                    count: stats.sauveteursDispo,
                    heures: 0
                };
            }

            // Créer des entrées de base pour tempsParSauveteur
            activeSauveteurIds.forEach(sauveteurId => {
                const sauveteur = masterSauveteursList.find(s => s.id === sauveteurId);
                if (!sauveteur) return;

                const enEquipe = teams.filter(t => t.status !== 'dissolved').some(t => t.members.includes(sauveteurId));
                
                stats.tempsParSauveteur[sauveteurId] = {
                    nom: sauveteur.name,
                    totalHeures: 0,
                    activites: {},
                    enEquipe: enEquipe
                };
            });
        }

        // Alertes équipes longue durée (seulement pour équipes actives)
        teams.filter(t => t.status !== 'dissolved').forEach(team => {
            const createdAt = new Date(team.createdAt);
            const now = new Date();
            const heures = (now - createdAt) / (1000 * 60 * 60);
            
            if (heures >= alertThreshold) {
                stats.alertes.push({
                    type: heures >= alertThreshold * 1.5 ? 'danger' : 'warning',
                    message: `${team.name} en mission depuis ${heures.toFixed(1)}h`,
                    equipe: team.name,
                    heures: heures.toFixed(1)
                });
            }
        });

        return stats;
    };

    const stats = calculateStatistics();

    // État pour gérer le modal de prévisualisation
    const [showReportPreview, setShowReportPreview] = React.useState(false);
    const [dashboardSauveteurPage, setDashboardSauveteurPage] = React.useState(0);
    const [modalSauveteurPage, setModalSauveteurPage] = React.useState(0);

    // Fonction pour générer un rapport de fin de mission
    const generateMissionReport = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let yPos = 20;

        // En-tête
        doc.setFontSize(18);
        doc.setTextColor(0, 85, 164);
        doc.text('RAPPORT DE FIN DE MISSION', 105, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 105, yPos, { align: 'center' });
        yPos += 15;

        // Calculer les statistiques détaillées
        const departementLocal = '25'; // Département local (à adapter si besoin)
        
        // Catégoriser UNIQUEMENT les sauveteurs inscrits au planning (sur site)
        let ssfLocal = 0;
        let ssfAutreDept = 0;
        let autresIntervenants = 0;
        
        activeSauveteurIds.forEach(sauveteurId => {
            const s = masterSauveteursList.find(sauv => sauv.id === sauveteurId);
            if (!s) return;
            
            const ssf = s.SSF || '';
            
            // Vérifier si SSF est un nombre (département) ou un texte (autre intervenant)
            const isNumeric = /^\d+$/.test(ssf);
            
            if (!isNumeric || ssf === '') {
                // SSF est un texte (Gendarmerie, CRS, Pompier...) ou vide
                autresIntervenants++;
            } else if (ssf === departementLocal) {
                // SSF du département local
                ssfLocal++;
            } else {
                // SSF d'un autre département (numéro différent)
                ssfAutreDept++;
            }
        });

        // Statistiques générales
        doc.setFontSize(14);
        doc.setTextColor(0, 85, 164);
        doc.text('1. STATISTIQUES GÉNÉRALES', 14, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setTextColor(0);
        const generalStats = [
            ['Liste des Sauveteurs Engagés (Inscrits au Planning)', ''],
            ['  • SSF du département local (25)', ssfLocal.toString()],
            ['  • SSF d\'autres départements', ssfAutreDept.toString()],
            ['  • Autres (Gendarmerie, CRS, Pompier...)', autresIntervenants.toString()],
            ['  • Total sauveteurs inscrits', stats.sauveteursSurSite.toString()],
            ['', ''],
            ['Mobilisation Effective', ''],
            ['  • Sauveteurs venus sur site', stats.sauveteursSurSite.toString()],
            ['  • Équipes constituées', stats.equipesActives.toString()],
            ['', ''],
            ['Main Courante', ''],
            ['  • Total événements enregistrés', events.length.toString()]
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Indicateur', 'Valeur']],
            body: generalStats,
            theme: 'grid',
            headStyles: { fillColor: [0, 85, 164] },
            margin: { left: 14 },
            columnStyles: {
                0: { cellWidth: 120 },
                1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: function(data) {
                // Mettre en gras les lignes de section
                if (data.row.index === 0 || data.row.index === 6 || data.row.index === 10) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [230, 240, 255];
                }
                // Lignes vides
                if (data.row.index === 5 || data.row.index === 9) {
                    data.cell.styles.fillColor = [255, 255, 255];
                }
            }
        });

        // NOUVELLE PAGE pour les sauveteurs
        doc.addPage();
        yPos = 20;

        // Temps par sauveteur (TOUS les sauveteurs)
        doc.setFontSize(14);
        doc.setTextColor(0, 85, 164);
        doc.text('2. TEMPS PAR SAUVETEUR', 14, yPos);
        yPos += 8;

        const allSauveteurs = Object.values(stats.tempsParSauveteur)
            .sort((a, b) => b.totalHeures - a.totalHeures);
        
        const sauveteurData = allSauveteurs.map(s => [
            s.nom,
            `${s.totalHeures.toFixed(1)}h`,
            `${(s.activites['souterre'] || 0).toFixed(1)}h`,
            `${(s.activites['repos'] || 0).toFixed(1)}h`,
            `${(s.activites['surface'] || 0).toFixed(1)}h`,
            `${(s.activites['gestion'] || 0).toFixed(1)}h`
        ]);

        // Afficher tous les sauveteurs avec pagination automatique
        doc.autoTable({
            startY: yPos,
            head: [['Sauveteur', 'Total', 'Sous-terre', 'Repos', 'En surface', 'PC']],
            body: sauveteurData,
            theme: 'striped',
            headStyles: { fillColor: [0, 85, 164] },
            styles: { fontSize: 8 },
            margin: { left: 14, top: 20, bottom: 20 },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 20 },
                2: { cellWidth: 25 },
                3: { cellWidth: 20 },
                4: { cellWidth: 25 },
                5: { cellWidth: 20 }
            },
            showHead: 'everyPage'
        });

        // NOUVELLE PAGE pour les équipes
        doc.addPage();
        yPos = 20;

        // Chronologie des équipes
        doc.setFontSize(14);
        doc.setTextColor(0, 85, 164);
        doc.text('3. CHRONOLOGIE DES ÉQUIPES', 14, yPos);
        yPos += 8;

        // Afficher TOUTES les équipes (actives ET dissoutes)
        const allTeams = [...teams].sort((a, b) => {
            const numA = parseInt(a.id.replace('T', '')) || 0;
            const numB = parseInt(b.id.replace('T', '')) || 0;
            return numA - numB;
        });

        if (allTeams.length > 0) {
            allTeams.forEach((team, index) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }

                // En-tête de l'équipe
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                const status = team.status === 'dissolved' ? '[MISSION TERMINÉE]' : '[MISSION EN COURS]';
                const statusColor = team.status === 'dissolved' ? [200, 0, 0] : [0, 150, 0];
                
                doc.setFont(undefined, 'bold');
                doc.text(`${team.name} - ${team.mission}`, 14, yPos);
                doc.setTextColor(...statusColor);
                doc.text(status, 14 + doc.getTextWidth(`${team.name} - ${team.mission} `), yPos);
                doc.setTextColor(0, 0, 0);
                yPos += 6;

                // Informations de base
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                const createdAt = new Date(team.createdAt);
                doc.text(`Créée le: ${createdAt.toLocaleString('fr-FR')}`, 14, yPos);
                yPos += 5;
                
                if (team.dissolvedAt) {
                    const dissolvedAt = new Date(team.dissolvedAt);
                    doc.text(`Dissoute le: ${dissolvedAt.toLocaleString('fr-FR')}`, 14, yPos);
                    yPos += 5;
                }

                // Chef et membres initiaux
                if (team.history && team.history.length > 0 && team.history[0].action === 'creation') {
                    doc.setFont(undefined, 'bold');
                    doc.text(`Chef initial: ${team.history[0].details.chef}`, 14, yPos);
                    yPos += 4;
                    doc.text(`Membres initiaux: ${team.history[0].details.membres.join(', ')}`, 14, yPos);
                    yPos += 5;
                    doc.setFont(undefined, 'normal');
                }

                // Historique des changements (sans la création)
                const changes = team.history ? team.history.filter(h => h.action !== 'creation') : [];
                if (changes.length > 0) {
                    doc.setFont(undefined, 'bold');
                    doc.text('Historique des changements:', 14, yPos);
                    yPos += 5;
                    doc.setFont(undefined, 'normal');

                    changes.forEach(entry => {
                        if (yPos > 280) {
                            doc.addPage();
                            yPos = 20;
                        }

                        const timeOnly = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        
                        if (entry.action === 'ajout_membres') {
                            const origine = entry.details.origine ? ` (depuis ${entry.details.origine})` : '';
                            doc.text(`  • ${timeOnly} - Ajout membre${entry.details.membres.length > 1 ? 's' : ''}${origine}: ${entry.details.membres.join(', ')}`, 14, yPos);
                            yPos += 5;
                        } else if (entry.action === 'retrait_membre') {
                            const dest = entry.details.destination === 'PC' ? 'vers PC' : `vers ${entry.details.destination}`;
                            doc.text(`  • ${timeOnly} - Retrait membre ${dest}: ${entry.details.membre}`, 14, yPos);
                            yPos += 5;
                        } else if (entry.action === 'changement_chef') {
                            doc.text(`  • ${timeOnly} - ${entry.details.nouveau_chef} devient chef d'équipe`, 14, yPos);
                            yPos += 4;
                            doc.text(`    (ancien chef: ${entry.details.ancien_chef})`, 14, yPos);
                            yPos += 5;
                        } else if (entry.action === 'dissolution') {
                            doc.setTextColor(200, 0, 0);
                            doc.text(`  • ${timeOnly} - Dissolution de l'équipe`, 14, yPos);
                            doc.setTextColor(0, 0, 0);
                            yPos += 5;
                        }
                    });
                }

                yPos += 3;
                
                // Ligne de séparation entre équipes
                if (index < allTeams.length - 1) {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(14, yPos, 196, yPos);
                    yPos += 5;
                }
            });
        } else {
            doc.setFontSize(10);
            doc.text('Aucune équipe créée', 14, yPos);
        }

        doc.save(`rapport_mission_${new Date().toISOString().split('T')[0]}.pdf`);
        alert('✅ Rapport PDF généré avec succès !');
    };

    const generateMissionReportExcel = () => {
        // Calculer les statistiques détaillées
        const departementLocal = '25'; // Département local
        
        let ssfLocal = 0;
        let ssfAutreDept = 0;
        let autresIntervenants = 0;
        
        // Compter uniquement les sauveteurs inscrits au planning
        activeSauveteurIds.forEach(sauveteurId => {
            const s = masterSauveteursList.find(sauv => sauv.id === sauveteurId);
            if (!s) return;
            
            const ssf = s.SSF || '';
            const isNumeric = /^\d+$/.test(ssf);
            
            if (!isNumeric || ssf === '') {
                autresIntervenants++;
            } else if (ssf === departementLocal) {
                ssfLocal++;
            } else {
                ssfAutreDept++;
            }
        });

        // Feuille 1: Statistiques générales
        const generalData = [
            ['RAPPORT DE FIN DE MISSION'],
            [`Généré le ${new Date().toLocaleString('fr-FR')}`],
            [],
            ['STATISTIQUES GÉNÉRALES'],
            [],
            ['Liste des Sauveteurs Engagés (Inscrits au Planning)', ''],
            ['  SSF du département local (25)', ssfLocal],
            ['  SSF d\'autres départements', ssfAutreDept],
            ['  Autres (Gendarmerie, CRS, Pompier...)', autresIntervenants],
            ['  TOTAL sauveteurs inscrits', stats.sauveteursSurSite],
            [],
            ['Mobilisation Effective', ''],
            ['  Sauveteurs venus sur site', stats.sauveteursSurSite],
            ['  Sauveteurs disponibles (non en équipe)', stats.sauveteursDispo],
            ['  Équipes constituées', stats.equipesActives],
            ['  Total membres en équipe', stats.totalMembresEquipes],
            [],
            ['Main Courante', ''],
            ['  Total événements enregistrés', events.length]
        ];

        // Feuille 2: Temps par sauveteur
        const sauveteurData = [
            ['TEMPS PAR SAUVETEUR'],
            ['Nom', 'Total (h)', 'Sous-terre (h)', 'Repos (h)', 'En surface (h)', 'PC (h)', 'Disponible (h)', 'Engagé (h)'],
            ...Object.values(stats.tempsParSauveteur)
                .sort((a, b) => b.totalHeures - a.totalHeures)
                .map(s => [
                    s.nom,
                    s.totalHeures.toFixed(1),
                    (s.activites['souterre'] || 0).toFixed(1),
                    (s.activites['repos'] || 0).toFixed(1),
                    (s.activites['surface'] || 0).toFixed(1),
                    (s.activites['gestion'] || 0).toFixed(1),
                    (s.activites['disponible'] || 0).toFixed(1),
                    (s.activites['engage'] || 0).toFixed(1)
                ])
        ];

        // Feuille 3: Équipes
        const teamsData = [
            ['ÉQUIPES CRÉÉES'],
            ['Équipe', 'Chef', 'Nombre membres', 'Créée le', 'Mission'],
            ...teams.filter(t => t.status !== 'dissolved').map(t => {
                const chef = masterSauveteursList.find(s => s.id === t.members[0]);
                return [
                    t.name,
                    chef?.name || '-',
                    t.members.length,
                    new Date(t.createdAt).toLocaleString('fr-FR'),
                    t.mission || '-'
                ];
            })
        ];

        // Créer le fichier Excel
        const wb = XLSX.utils.book_new();
        
        const ws1 = XLSX.utils.aoa_to_sheet(generalData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Statistiques');
        
        const ws2 = XLSX.utils.aoa_to_sheet(sauveteurData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Temps Sauveteurs');
        
        const ws3 = XLSX.utils.aoa_to_sheet(teamsData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Équipes');

        XLSX.writeFile(wb, `rapport_mission_${new Date().toISOString().split('T')[0]}.xlsx`);
        alert('✅ Rapport Excel généré avec succès !');
    };

    // Calcul du pourcentage pour les graphiques
    const getActivityPercentage = (activityId) => {
        const activity = stats.activites[activityId];
        if (!activity) return 0;
        return stats.sauveteursSurSite > 0 
            ? ((activity.count / stats.sauveteursSurSite) * 100).toFixed(1)
            : 0;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-blue-800">📈 Tableau de Bord - Vue d'Ensemble</h2>
                <button
                    onClick={() => {
                        setShowReportPreview(true);
                        setModalSauveteurPage(0);
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold shadow-lg flex items-center gap-2"
                >
                    📋 Générer un Rapport
                </button>
            </div>

            {/* Message informatif si pas de planning */}
            {!stats.hasPlanning && (
                <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">ℹ️</span>
                        <div>
                            <h3 className="font-bold text-blue-900 mb-2">Mode Statistiques Simplifiées</h3>
                            <p className="text-sm text-blue-800">
                                Le planning opérationnel n'est pas encore rempli. Les statistiques affichées sont basées uniquement sur :
                            </p>
                            <ul className="text-sm text-blue-800 mt-2 ml-4 list-disc">
                                <li>Les sauveteurs présents sur site</li>
                                <li>Les équipes créées</li>
                                <li>La répartition actuelle (disponibles vs en équipe)</li>
                            </ul>
                            <p className="text-sm text-blue-800 mt-2 font-semibold">
                                💡 Pour obtenir des statistiques détaillées avec temps par activité, remplissez le Planning Opérationnel.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Cartes statistiques principales */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-6 rounded-lg shadow-lg">
                    <div className="text-4xl font-bold">{stats.totalSauveteurs}</div>
                    <div className="text-sm opacity-90 mt-2">Total Sauveteurs</div>
                    <div className="text-xs opacity-75 mt-1">Liste préfectorale</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-700 text-white p-6 rounded-lg shadow-lg">
                    <div className="text-4xl font-bold">{stats.sauveteursSurSite}</div>
                    <div className="text-sm opacity-90 mt-2">Sur Site</div>
                    <div className="text-xs opacity-75 mt-1">Actifs actuellement</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-6 rounded-lg shadow-lg">
                    <div className="text-4xl font-bold">{stats.sauveteursDispo}</div>
                    <div className="text-sm opacity-90 mt-2">Disponibles</div>
                    <div className="text-xs opacity-75 mt-1">Non affectés en équipe</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white p-6 rounded-lg shadow-lg">
                    <div className="text-4xl font-bold">{stats.equipesActives}</div>
                    <div className="text-sm opacity-90 mt-2">Équipes Actives</div>
                    <div className="text-xs opacity-75 mt-1">{stats.totalMembresEquipes} membres</div>
                </div>
            </div>

            {/* Statistiques Détaillées */}
            <div className="mb-6 bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4 text-blue-800">📊 Statistiques Détaillées</h3>
                <div className="grid grid-cols-3 gap-6">
                    {/* Liste des Sauveteurs Engagés */}
                    <div className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-bold text-gray-700 mb-3">Sauveteurs Inscrits au Planning</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">SSF département local (25):</span>
                                <span className="font-bold text-blue-600">
                                    {activeSauveteurIds.filter(id => {
                                        const s = masterSauveteursList.find(sauv => sauv.id === id);
                                        if (!s) return false;
                                        const ssf = s.SSF || '';
                                        return /^\d+$/.test(ssf) && ssf === '25';
                                    }).length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">SSF autres départements:</span>
                                <span className="font-bold text-blue-600">
                                    {activeSauveteurIds.filter(id => {
                                        const s = masterSauveteursList.find(sauv => sauv.id === id);
                                        if (!s) return false;
                                        const ssf = s.SSF || '';
                                        return /^\d+$/.test(ssf) && ssf !== '25';
                                    }).length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Autres (Gendarmerie, CRS, Pompier):</span>
                                <span className="font-bold text-blue-600">
                                    {activeSauveteurIds.filter(id => {
                                        const s = masterSauveteursList.find(sauv => sauv.id === id);
                                        if (!s) return false;
                                        const ssf = s.SSF || '';
                                        return !/^\d+$/.test(ssf) || ssf === '';
                                    }).length}
                                </span>
                            </div>
                            <div className="pt-2 mt-2 border-t flex justify-between font-bold">
                                <span>Total inscrits:</span>
                                <span className="text-blue-800">{stats.sauveteursSurSite}</span>
                            </div>
                        </div>
                    </div>

                    {/* Mobilisation */}
                    <div className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-bold text-gray-700 mb-3">Mobilisation Effective</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Sauveteurs sur site:</span>
                                <span className="font-bold text-green-600">{stats.sauveteursSurSite}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Disponibles:</span>
                                <span className="font-bold text-green-600">{stats.sauveteursDispo}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">En équipe:</span>
                                <span className="font-bold text-orange-600">{stats.totalMembresEquipes}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t flex justify-between font-bold">
                                <span>Équipes créées:</span>
                                <span className="text-orange-800">{stats.equipesActives}</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Courante */}
                    <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-bold text-gray-700 mb-3">Main Courante</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Total événements:</span>
                                <span className="font-bold text-purple-600">{events.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Événements importants:</span>
                                <span className="font-bold text-red-600">
                                    {events.filter(e => e.messageImportant).length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Mode:</span>
                                <span className="font-bold text-purple-600">
                                    {mcMode === 'principale' ? 'MC Principale' : `MC Secondaire (${mcIdentifiant})`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alertes */}
            {stats.alertes.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xl font-bold mb-3 text-red-700">🚨 Alertes Automatiques</h3>
                    <div className="space-y-2">
                        {stats.alertes.map((alerte, idx) => (
                            <div 
                                key={idx}
                                className={`p-4 rounded-lg flex items-center gap-3 ${
                                    alerte.type === 'danger' 
                                        ? 'bg-red-100 border-l-4 border-red-600' 
                                        : 'bg-orange-100 border-l-4 border-orange-500'
                                }`}
                            >
                                <span className="text-2xl">
                                    {alerte.type === 'danger' ? '🔴' : '🟠'}
                                </span>
                                <div className="flex-1">
                                    <div className="font-bold text-lg">{alerte.message}</div>
                                    <div className="text-sm opacity-75">
                                        {alerte.type === 'danger' ? 'ATTENTION : Limite critique atteinte' : 'Surveillance recommandée'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Répartition des activités */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-blue-800">📊 Répartition des Activités</h3>
                    <div className="space-y-3">
                        {ACTIVITIES.filter(a => a.id !== 'nondef').map(activity => {
                            const percentage = getActivityPercentage(activity.id);
                            const activityStats = stats.activites[activity.id];
                            
                            return (
                                <div key={activity.id}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold" style={{ color: activity.color }}>
                                            {activity.name}
                                        </span>
                                        <div className="text-sm font-bold">
                                            {activityStats?.count || 0} ({percentage}%)
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-6">
                                        <div 
                                            className="h-6 rounded-full flex items-center justify-end pr-2 text-white text-xs font-bold"
                                            style={{ 
                                                width: `${percentage}%`,
                                                backgroundColor: activity.color,
                                                minWidth: percentage > 0 ? '30px' : '0'
                                            }}
                                        >
                                            {percentage > 5 && `${percentage}%`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Liste complète des sauveteurs avec pagination */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-blue-800">
                        {stats.hasPlanning ? '🏆 Temps Total - Tous les Sauveteurs' : '👥 Sauveteurs Sur Site'}
                    </h3>
                    {(() => {
                        const allSauveteurs = stats.hasPlanning
                            ? Object.values(stats.tempsParSauveteur).sort((a, b) => b.totalHeures - a.totalHeures)
                            : Object.values(stats.tempsParSauveteur).sort((a, b) => a.nom.localeCompare(b.nom));
                        
                        const itemsPerPage = 15;
                        const totalPages = Math.ceil(allSauveteurs.length / itemsPerPage);
                        const startIndex = dashboardSauveteurPage * itemsPerPage;
                        const endIndex = startIndex + itemsPerPage;
                        const currentSauveteurs = allSauveteurs.slice(startIndex, endIndex);
                        
                        return (
                            <>
                                {allSauveteurs.length > 0 && (
                                    <div className="mb-3 flex justify-between items-center text-sm text-gray-600">
                                        <span>
                                            Total: {allSauveteurs.length} sauveteur{allSauveteurs.length > 1 ? 's' : ''}
                                        </span>
                                        <span>
                                            Affichage de {startIndex + 1} à {Math.min(endIndex, allSauveteurs.length)}
                                        </span>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    {stats.hasPlanning ? (
                                        // Avec planning : afficher avec temps
                                        currentSauveteurs.map((sauv, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl font-bold text-gray-400">#{startIndex + idx + 1}</span>
                                                    <span className="font-semibold">{sauv.nom}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-blue-600">
                                                        {sauv.totalHeures.toFixed(1)}h
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {(sauv.activites['souterre'] || 0).toFixed(1)}h sous terre
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        // Sans planning : lister avec statut
                                        currentSauveteurs.map((sauv, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold">{sauv.nom}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        sauv.enEquipe 
                                                            ? 'bg-orange-100 text-orange-800' 
                                                            : 'bg-green-100 text-green-800'
                                                    }`}>
                                                        {sauv.enEquipe ? '🚨 En équipe' : '✓ Disponible'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {allSauveteurs.length === 0 && (
                                        <div className="text-center py-8 text-gray-500">
                                            <p>Aucun sauveteur sur site</p>
                                            <p className="text-sm mt-2">Ajoutez des sauveteurs via "Enregistrement des sauveteurs"</p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="mt-4 flex justify-center items-center gap-2">
                                        <button
                                            onClick={() => setDashboardSauveteurPage(0)}
                                            disabled={dashboardSauveteurPage === 0}
                                            className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 text-sm font-semibold"
                                        >
                                            ««
                                        </button>
                                        <button
                                            onClick={() => setDashboardSauveteurPage(prev => Math.max(0, prev - 1))}
                                            disabled={dashboardSauveteurPage === 0}
                                            className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 text-sm font-semibold"
                                        >
                                            « Précédent
                                        </button>
                                        <span className="px-4 py-2 bg-gray-100 rounded text-sm font-semibold">
                                            Page {dashboardSauveteurPage + 1} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setDashboardSauveteurPage(prev => Math.min(totalPages - 1, prev + 1))}
                                            disabled={dashboardSauveteurPage >= totalPages - 1}
                                            className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 text-sm font-semibold"
                                        >
                                            Suivant »
                                        </button>
                                        <button
                                            onClick={() => setDashboardSauveteurPage(totalPages - 1)}
                                            disabled={dashboardSauveteurPage >= totalPages - 1}
                                            className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 text-sm font-semibold"
                                        >
                                            »»
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Paramètres d'alerte */}
            <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="text-lg font-bold mb-3">⚙️ Paramètres d'Alertes</h3>
                <div className="flex items-center gap-4">
                    <label className="font-semibold">Alerter si équipe en mission depuis plus de:</label>
                    <input
                        type="number"
                        value={alertThreshold}
                        onChange={(e) => setAlertThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                        className="px-3 py-2 border rounded-lg w-20"
                        min="1"
                    />
                    <span>heures</span>
                </div>
            </div>

            {/* Modal de Prévisualisation du Rapport */}
            {showReportPreview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* En-tête du modal */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
                            <h2 className="text-2xl font-bold">📋 Prévisualisation du Rapport de Fin de Mission</h2>
                            <button
                                onClick={() => setShowReportPreview(false)}
                                className="text-white hover:text-gray-200 text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>

                        {/* Contenu scrollable du rapport */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
                                {/* En-tête du rapport */}
                                <div className="text-center mb-8 pb-6 border-b-2 border-blue-600">
                                    <h1 className="text-3xl font-bold text-blue-800 mb-2">RAPPORT DE FIN DE MISSION</h1>
                                    <p className="text-gray-600">Généré le {new Date().toLocaleString('fr-FR')}</p>
                                </div>

                                {/* Section 1: Statistiques Générales */}
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold text-blue-700 mb-4 pb-2 border-b border-blue-300">
                                        1. STATISTIQUES GÉNÉRALES
                                    </h2>
                                    
                                    {/* Liste des Sauveteurs Engagés */}
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3 bg-blue-50 p-2 rounded">
                                            Liste des Sauveteurs Engagés (Inscrits au Planning)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3 ml-4">
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• SSF du département local (25):</span>
                                                <span className="font-bold text-blue-600">
                                                    {activeSauveteurIds.filter(id => {
                                                        const s = masterSauveteursList.find(sauv => sauv.id === id);
                                                        if (!s) return false;
                                                        const ssf = s.SSF || '';
                                                        return /^\d+$/.test(ssf) && ssf === '25';
                                                    }).length}
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• SSF d'autres départements:</span>
                                                <span className="font-bold text-blue-600">
                                                    {activeSauveteurIds.filter(id => {
                                                        const s = masterSauveteursList.find(sauv => sauv.id === id);
                                                        if (!s) return false;
                                                        const ssf = s.SSF || '';
                                                        return /^\d+$/.test(ssf) && ssf !== '25' && ssf !== '';
                                                    }).length}
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• Autres (Gendarmerie, CRS, Pompier...):</span>
                                                <span className="font-bold text-blue-600">
                                                    {activeSauveteurIds.filter(id => {
                                                        const s = masterSauveteursList.find(sauv => sauv.id === id);
                                                        if (!s) return false;
                                                        const ssf = s.SSF || '';
                                                        return !/^\d+$/.test(ssf) || ssf === '';
                                                    }).length}
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2 bg-blue-50 px-2">
                                                <span className="text-gray-900 font-semibold">• TOTAL sauveteurs inscrits:</span>
                                                <span className="font-bold text-blue-700">{stats.sauveteursSurSite}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobilisation Effective */}
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3 bg-blue-50 p-2 rounded">
                                            Mobilisation Effective
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3 ml-4">
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• Sauveteurs venus sur site:</span>
                                                <span className="font-bold text-blue-600">{stats.sauveteursSurSite}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• Sauveteurs disponibles (non en équipe):</span>
                                                <span className="font-bold text-blue-600">{stats.sauveteursDispo}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• Équipes constituées:</span>
                                                <span className="font-bold text-blue-600">{stats.equipesActives}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• Total membres en équipe:</span>
                                                <span className="font-bold text-blue-600">{stats.totalMembresEquipes}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main Courante */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3 bg-blue-50 p-2 rounded">
                                            Main Courante
                                        </h3>
                                        <div className="ml-4">
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-gray-700">• Total événements enregistrés:</span>
                                                <span className="font-bold text-blue-600">{events.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Temps par Sauveteur (Tous) */}
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold text-blue-700 mb-4 pb-2 border-b border-blue-300">
                                        2. TEMPS PAR SAUVETEUR
                                    </h2>
                                    {(() => {
                                        const allSauveteurs = Object.values(stats.tempsParSauveteur)
                                            .sort((a, b) => b.totalHeures - a.totalHeures);
                                        const itemsPerPage = 15;
                                        const totalPages = Math.ceil(allSauveteurs.length / itemsPerPage);
                                        const startIndex = modalSauveteurPage * itemsPerPage;
                                        const endIndex = startIndex + itemsPerPage;
                                        const currentSauveteurs = allSauveteurs.slice(startIndex, endIndex);
                                        
                                        return (
                                            <>
                                                <div className="mb-3 text-sm text-gray-600">
                                                    Total: {allSauveteurs.length} sauveteur{allSauveteurs.length > 1 ? 's' : ''} | 
                                                    Page {modalSauveteurPage + 1} sur {totalPages} | 
                                                    Affichage de {startIndex + 1} à {Math.min(endIndex, allSauveteurs.length)}
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm border-collapse">
                                                        <thead>
                                                            <tr className="bg-blue-600 text-white">
                                                                <th className="border border-blue-700 px-3 py-2 text-left">Sauveteur</th>
                                                                <th className="border border-blue-700 px-3 py-2 text-center">Total</th>
                                                                <th className="border border-blue-700 px-3 py-2 text-center">Sous-terre</th>
                                                                <th className="border border-blue-700 px-3 py-2 text-center">Repos</th>
                                                                <th className="border border-blue-700 px-3 py-2 text-center">En surface</th>
                                                                <th className="border border-blue-700 px-3 py-2 text-center">PC</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {currentSauveteurs.map((s, idx) => (
                                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                                    <td className="border border-gray-300 px-3 py-2">{s.nom}</td>
                                                                    <td className="border border-gray-300 px-3 py-2 text-center font-semibold">
                                                                        {s.totalHeures.toFixed(1)}h
                                                                    </td>
                                                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                                                        {(s.activites['souterre'] || 0).toFixed(1)}h
                                                                    </td>
                                                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                                                        {(s.activites['repos'] || 0).toFixed(1)}h
                                                                    </td>
                                                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                                                        {(s.activites['surface'] || 0).toFixed(1)}h
                                                                    </td>
                                                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                                                        {(s.activites['gestion'] || 0).toFixed(1)}h
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                
                                                {/* Pagination */}
                                                {totalPages > 1 && (
                                                    <div className="mt-4 flex justify-center items-center gap-2">
                                                        <button
                                                            onClick={() => setModalSauveteurPage(0)}
                                                            disabled={modalSauveteurPage === 0}
                                                            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
                                                        >
                                                            ««
                                                        </button>
                                                        <button
                                                            onClick={() => setModalSauveteurPage(prev => Math.max(0, prev - 1))}
                                                            disabled={modalSauveteurPage === 0}
                                                            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
                                                        >
                                                            « Précédent
                                                        </button>
                                                        <span className="px-4 py-1 bg-gray-100 rounded">
                                                            Page {modalSauveteurPage + 1} / {totalPages}
                                                        </span>
                                                        <button
                                                            onClick={() => setModalSauveteurPage(prev => Math.min(totalPages - 1, prev + 1))}
                                                            disabled={modalSauveteurPage >= totalPages - 1}
                                                            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
                                                        >
                                                            Suivant »
                                                        </button>
                                                        <button
                                                            onClick={() => setModalSauveteurPage(totalPages - 1)}
                                                            disabled={modalSauveteurPage >= totalPages - 1}
                                                            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
                                                        >
                                                            »»
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Section 3: Équipes Créées */}
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold text-blue-700 mb-4 pb-2 border-b border-blue-300">
                                        3. CHRONOLOGIE DES ÉQUIPES
                                    </h2>
                                    {teams.length > 0 ? (
                                        <div className="space-y-6">
                                            {[...teams].sort((a, b) => {
                                                const numA = parseInt(a.id.replace('T', '')) || 0;
                                                const numB = parseInt(b.id.replace('T', '')) || 0;
                                                return numA - numB;
                                            }).map((team, idx) => {
                                                const createdAt = new Date(team.createdAt);
                                                const dissolvedAt = team.dissolvedAt ? new Date(team.dissolvedAt) : null;
                                                const status = team.status === 'dissolved' ? 'MISSION TERMINÉE' : 'MISSION EN COURS';
                                                const statusColor = team.status === 'dissolved' ? 'text-red-600' : 'text-green-600';
                                                
                                                return (
                                                    <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-white shadow">
                                                        {/* En-tête équipe */}
                                                        <div className="flex justify-between items-start mb-3">
                                                            <h3 className="text-lg font-bold text-gray-800">
                                                                {team.name} - {team.mission}
                                                            </h3>
                                                            <span className={`font-semibold px-3 py-1 rounded ${statusColor} bg-opacity-10`}>
                                                                [{status}]
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Informations de base */}
                                                        <div className="text-sm text-gray-700 mb-3">
                                                            <p><strong>Créée le:</strong> {createdAt.toLocaleString('fr-FR')}</p>
                                                            {dissolvedAt && (
                                                                <p className="text-red-600">
                                                                    <strong>Dissoute le:</strong> {dissolvedAt.toLocaleString('fr-FR')}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Chef et membres initiaux */}
                                                        {team.history && team.history.length > 0 && team.history[0].action === 'creation' && (
                                                            <div className="text-sm text-gray-700 mb-3 bg-gray-50 p-2 rounded">
                                                                <p><strong>Chef initial:</strong> {team.history[0].details.chef}</p>
                                                                <p><strong>Membres initiaux:</strong> {team.history[0].details.membres.join(', ')}</p>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Historique détaillé - Seulement les changements */}
                                                        {team.history && team.history.filter(h => h.action !== 'creation').length > 0 && (
                                                            <div className="mt-3 pl-4 border-l-4 border-blue-300">
                                                                <h4 className="font-semibold text-gray-800 mb-2">Historique des changements:</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    {team.history.filter(h => h.action !== 'creation').map((entry, histIdx) => {
                                                                        const timestamp = new Date(entry.timestamp).toLocaleString('fr-FR');
                                                                        const timeOnly = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                                        
                                                                        if (entry.action === 'ajout_membres') {
                                                                            const origine = entry.details.origine ? ` (depuis ${entry.details.origine})` : '';
                                                                            return (
                                                                                <div key={histIdx} className="text-gray-700">
                                                                                    <p>
                                                                                        • <strong>{timeOnly}</strong> - Ajout membre{entry.details.membres.length > 1 ? 's' : ''}{origine}: {entry.details.membres.join(', ')}
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        } else if (entry.action === 'retrait_membre') {
                                                                            const dest = entry.details.destination === 'PC' ? 'vers PC' : `vers ${entry.details.destination}`;
                                                                            return (
                                                                                <div key={histIdx} className="text-gray-700">
                                                                                    <p>
                                                                                        • <strong>{timeOnly}</strong> - Retrait membre {dest}: {entry.details.membre}
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        } else if (entry.action === 'changement_chef') {
                                                                            return (
                                                                                <div key={histIdx} className="text-gray-700">
                                                                                    <p>
                                                                                        • <strong>{timeOnly}</strong> - {entry.details.nouveau_chef} devient chef d'équipe (ancien chef: {entry.details.ancien_chef})
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        } else if (entry.action === 'dissolution') {
                                                                            return (
                                                                                <div key={histIdx} className="text-red-600">
                                                                                    <p>
                                                                                        • <strong>{timeOnly}</strong> - Dissolution de l'équipe
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">Aucune équipe créée</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pied du modal avec boutons d'action */}
                        <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-t">
                            <button
                                onClick={() => setShowReportPreview(false)}
                                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 font-semibold"
                            >
                                Fermer
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        generateMissionReport();
                                        setShowReportPreview(false);
                                    }}
                                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2"
                                >
                                    📄 Exporter en PDF
                                </button>
                                <button
                                    onClick={() => {
                                        generateMissionReportExcel();
                                        setShowReportPreview(false);
                                    }}
                                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
                                >
                                    📊 Exporter en Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ============================================================
// COMPOSANT PROGRESSION DES ÉQUIPES (graphique temporel)
// ============================================================
const ProgressionTab = ({ events, pointsPhone, teams, masterSauveteursList }) => {

    const getTeamMembers = (teamName) => {
				const teamObj = teams.find(t => t.name === teamName);
				if (!teamObj) return [];

				return teamObj.members.map(id => {
					const sv = masterSauveteursList.find(s => s.id === id);
					return sv ? sv.name : id;
			});
		};
			
			const getTs = (ev) => {
        if (ev.isoTimestamp) return Date.parse(ev.isoTimestamp);
        if (ev.timestamp)    return Date.parse(ev.timestamp);
        if (typeof ev.id === 'number' && ev.id > 1e12) return ev.id;
        if (ev.dateHeure) {
            const m = ev.dateHeure.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2})?)/);
            if (m) return new Date(m[3], m[2]-1, m[1], m[4], m[5], m[6]||0).getTime();
        }
        return 0;
    };

    const ppLettre = (pp) => typeof pp === 'object' ? pp.lettre : (pp ? pp.split(' - ')[0].trim() : null);
    const ppNom    = (pp) => typeof pp === 'object' ? pp.nom    : (pp ? (pp.split(' - ')[1] || pp).trim() : '');

    const ppDefinis = (pointsPhone || []).filter(pp => {
        const lettre = typeof pp === 'object' ? pp.lettre : pp;
        return lettre && lettre !== 'PC';
    }).map(pp => ({
        lettre: ppLettre(pp), nom: ppNom(pp),
        label: typeof pp === 'object' ? `${pp.lettre} – ${pp.nom}` : pp,
        ordre: typeof pp === 'object' && pp.ordre !== undefined ? parseFloat(pp.ordre) : 999
    })).filter(p => p.lettre).sort((a, b) => a.ordre - b.ordre);

    const lettresEvents = [...new Set(
        events.filter(e => e.pointPhone).map(e => ppLettre(e.pointPhone)).filter(l => l && l !== 'PC')
    )].sort();

    const allPP = [...ppDefinis];
    lettresEvents.forEach(l => {
        if (!allPP.find(p => p.lettre === l)) allPP.push({ lettre: l, nom: '', label: l, ordre: 9999 });
    });

    const PALETTE = [
        '#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6',
        '#EC4899','#06B6D4','#84CC16','#F97316','#6366F1',
        '#14B8A6','#E11D48','#0EA5E9','#A3E635','#FB923C'
    ];

    const teamColorMap = React.useMemo(() => {
        const map = {};
        const names = [...new Set(events.filter(e => e.equipe).map(e => e.equipe))];
        names.forEach((t, i) => {
            // Détecter si c'est une sous-équipe (ex: "Équipe 2A", "Équipe 2B")
            const subMatch = t.match(/^Équipe\s+(\d+)([A-Za-z]+)$/);
            if (subMatch) {
                // Chercher la couleur de l'équipe parent (ex: "Équipe 2")
                const parentName = 'Équipe ' + subMatch[1];
                const parentColor = map[parentName];
                if (parentColor) {
                    map[t] = parentColor; // Même couleur que le parent
                } else {
                    map[t] = PALETTE[i % PALETTE.length];
                }
            } else {
                map[t] = PALETTE[i % PALETTE.length];
            }
        });
        return map;
    }, [events.map(e => e.equipe).join('|')]);

    // Dash pattern selon le suffixe de sous-équipe
    const teamDashPattern = (teamName) => {
        const subMatch = teamName.match(/^Équipe\s+\d+([A-Za-z]+)$/);
        if (!subMatch) return null; // Ligne continue
        const suffix = subMatch[1].toUpperCase();
        if (suffix === 'A') return '8 4';          // Tirets
        if (suffix === 'B') return '2 4';          // Points
        if (suffix === 'C') return '8 4 2 4';      // Tirets-points
        if (suffix === 'D') return '2 4 8 4 2 4';  // Points-tirets-points
        return '6 3';                              // Autre
    };

    const [selectedTeams, setSelectedTeams] = React.useState([]);
    const [pxPerHour, setPxPerHour] = React.useState(150); // zoom axe X
    React.useEffect(() => {
        const names = [...new Set(events.filter(e => e.equipe).map(e => e.equipe))];
        setSelectedTeams(names);
    }, [events.length]);

    const toggleTeam = (name) => setSelectedTeams(prev =>
        prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );

    const series = React.useMemo(() => {
        const byTeam = {};
        events.filter(e => e.pointPhone && e.equipe)
            .sort((a, b) => getTs(a) - getTs(b))
            .forEach(e => {
                const lettre = ppLettre(e.pointPhone);
                if (!lettre || lettre === 'PC') return; // Ignorer le PC
                if (!byTeam[e.equipe]) byTeam[e.equipe] = [];
                byTeam[e.equipe].push({ ts: getTs(e), lettre, dateHeure: e.dateHeure, evenement: e.evenement, numero: e.numero });
            });
        return byTeam;
    }, [events]);

    const eventsNoTeam = React.useMemo(() =>
        events.filter(e => e.pointPhone && !e.equipe && ppLettre(e.pointPhone) !== 'PC')
            .sort((a, b) => getTs(a) - getTs(b))
            .map(e => ({ ts: getTs(e), lettre: ppLettre(e.pointPhone), dateHeure: e.dateHeure, evenement: e.evenement, numero: e.numero }))
    , [events]);

    const allTs = events.filter(e => e.pointPhone && ppLettre(e.pointPhone) !== 'PC').map(getTs).filter(t => t > 0);
    const tsMin = allTs.length ? Math.min(...allTs) : Date.now() - 3600000;
    const tsMax = allTs.length ? Math.max(...allTs) : Date.now();
    const tsPad = Math.max((tsMax - tsMin) * 0.05, 300000);
    const tStart = tsMin - tsPad;
    const tEnd   = tsMax + tsPad;
    const tRange = tEnd - tStart || 1;

    const MARGIN = { top: 30, right: 30, bottom: 70, left: 130 };
    // Largeur dynamique : pxPerHour px par heure minimum, jamais moins de 940px
    const durationMs = allTs.length >= 2 ? (tsMax - tsMin) : 3600000;
    const durationHours = durationMs / 3600000;
    const PX_PER_HOUR = pxPerHour;
    const chartWidth = Math.max(940, Math.ceil(durationHours * PX_PER_HOUR) + MARGIN.left + MARGIN.right + 60);
    const chartHeight = Math.max(300, allPP.length * 60 + MARGIN.top + MARGIN.bottom);
    const innerW = chartWidth  - MARGIN.left - MARGIN.right;
    const innerH = chartHeight - MARGIN.top  - MARGIN.bottom;

    const yIndex = {};
    allPP.forEach((p, i) => { yIndex[p.lettre] = i; });
    const nbPP = allPP.length || 1;
    const yStep = innerH / (nbPP > 1 ? nbPP - 1 : 1);
    const yOf   = (lettre) => (yIndex[lettre] !== undefined ? yIndex[lettre] * yStep : 0);

    const xOf = (ts) => ((ts - tStart) / tRange) * innerW;

    const xTicks = (() => {
        const ticks = [];
        // Choisir un intervalle rond selon la durée totale
        const totalMinutes = (tEnd - tStart) / 60000;
        let intervalMin;
        if      (totalMinutes <= 60)   intervalMin = 5;
        else if (totalMinutes <= 180)  intervalMin = 15;
        else if (totalMinutes <= 480)  intervalMin = 30;
        else if (totalMinutes <= 1440) intervalMin = 60;
        else                           intervalMin = 120;
        const intervalMs = intervalMin * 60000;
        // Aligner sur des minutes rondes
        const firstTick = Math.ceil(tStart / intervalMs) * intervalMs;
        for (let ts = firstTick; ts <= tEnd; ts += intervalMs) {
            ticks.push({ ts, x: xOf(ts), label: new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) });
        }
        return ticks;
    })();

    const [tooltip, setTooltip] = React.useState(null);
    const visibleTeams = Object.keys(series).filter(t => selectedTeams.includes(t));
    const pathFor = (pts) => pts.length < 2 ? '' :
        pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.ts).toFixed(1)} ${yOf(p.lettre).toFixed(1)}`).join(' ');

    if (allPP.length === 0) return (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="text-6xl mb-4">📍</div>
            <div className="text-xl font-semibold mb-2">Aucun point phone défini</div>
            <div className="text-sm text-center max-w-sm">Définissez des points phone dans la configuration, puis associez-les aux événements.</div>
        </div>
    );

    if (allTs.length === 0) return (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-xl font-semibold mb-2">Aucune donnée de progression</div>
            <div className="text-sm text-center max-w-sm">Associez des points phone aux événements de la main courante pour voir la progression ici.</div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">📍 Progression des Équipes</h2>
                    <p className="text-sm text-gray-500 mt-1">Axe Y : points phone (entrée cavité en haut) · Axe X : temps</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                        <span className="text-xs text-gray-500 mr-1">Zoom :</span>
                        <button onClick={() => setPxPerHour(p => Math.max(60, p - 30))}
                            className="w-7 h-7 rounded font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center text-lg" title="Réduire">−</button>
                        <span className="text-xs font-semibold text-blue-700 w-16 text-center">{pxPerHour}px/h</span>
                        <button onClick={() => setPxPerHour(p => Math.min(600, p + 30))}
                            className="w-7 h-7 rounded font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center text-lg" title="Agrandir">+</button>
                        <button onClick={() => setPxPerHour(150)}
                            className="text-xs text-gray-400 hover:text-gray-600 ml-1" title="Réinitialiser">↺</button>
                    </div>
                    <div className="text-sm text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                        {allTs.length} point{allTs.length > 1 ? 's' : ''} de localisation
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-600 mb-3">Équipes visibles :</div>
                <div className="flex flex-wrap gap-2">
                    {Object.keys(series).map(team => (
                        <button key={team} onClick={() => toggleTeam(team)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                            style={{
                                backgroundColor: selectedTeams.includes(team) ? teamColorMap[team] + '22' : '#f3f4f6',
                                borderColor: selectedTeams.includes(team) ? teamColorMap[team] : '#d1d5db',
                                color: selectedTeams.includes(team) ? teamColorMap[team] : '#9ca3af'
                            }}>
                            <svg width="18" height="8" style={{flexShrink:0}}>
                                <line x1="0" y1="4" x2="18" y2="4"
                                    stroke={selectedTeams.includes(team) ? teamColorMap[team] : '#d1d5db'}
                                    strokeWidth="2.5"
                                    strokeDasharray={teamDashPattern(team) || 'none'}/>
                            </svg>
                            {team} <span className="opacity-60 text-xs">({series[team].length})</span>
                        </button>
                    ))}
                    {eventsNoTeam.length > 0 && (
                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-gray-300 text-gray-400 bg-gray-50">
                            <span className="w-3 h-3 rounded-full bg-gray-300 inline-block"/> Sans équipe ({eventsNoTeam.length})
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <div style={{ minWidth: chartWidth + 'px', padding: '16px' }}>
                    <svg width={chartWidth} height={chartHeight} style={{ display: 'block', userSelect: 'none' }}>
                        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                            {allPP.map((pp, i) => (
                                <line key={pp.lettre} x1={0} y1={yOf(pp.lettre)} x2={innerW} y2={yOf(pp.lettre)}
                                    stroke={i === 0 ? '#374151' : '#e5e7eb'} strokeWidth={i === 0 ? 2 : 1}
                                    strokeDasharray={i === 0 ? 'none' : '4 3'}/>
                            ))}
                            {xTicks.map((tick, i) => (
                                <line key={i} x1={tick.x} y1={0} x2={tick.x} y2={innerH} stroke="#f3f4f6" strokeWidth={1}/>
                            ))}
                            <text x={-8} y={-10} textAnchor="end" fontSize="10" fill="#6b7280" fontStyle="italic">← entrée</text>
                            {allPP.map(pp => (
                                <g key={pp.lettre} transform={`translate(0, ${yOf(pp.lettre)})`}>
                                    <text x={-10} y={0} textAnchor="end" dominantBaseline="middle" fontSize="13" fontWeight="bold" fill="#1e40af">{pp.lettre}</text>
                                    {pp.nom && <text x={-26} y={0} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#6b7280">
                                        {pp.nom.length > 14 ? pp.nom.substring(0, 13) + '…' : pp.nom}
                                    </text>}
                                </g>
                            ))}
                            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#374151" strokeWidth={2}/>
                            {xTicks.map((tick, i) => (
                                <g key={i} transform={`translate(${tick.x}, ${innerH})`}>
                                    <line x1={0} y1={0} x2={0} y2={6} stroke="#9ca3af" strokeWidth={1}/>
                                    <text x={0} y={20} textAnchor="middle" fontSize="10" fill="#6b7280" transform="rotate(-30)">{tick.label}</text>
                                </g>
                            ))}
                            {eventsNoTeam.length >= 2 && <path d={pathFor(eventsNoTeam)} fill="none" stroke="#d1d5db" strokeWidth={2} strokeDasharray="5 4"/>}
                            {eventsNoTeam.map((pt, i) => (
                                <circle key={i} cx={xOf(pt.ts)} cy={yOf(pt.lettre)} r={5} fill="white" stroke="#9ca3af" strokeWidth={2} style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: `N°${pt.numero} · Sans équipe\n${pt.lettre} – ${pt.dateHeure}\n${(pt.evenement || '').substring(0, 80)}` })}
                                    onMouseLeave={() => setTooltip(null)}/>
                            ))}
                            {visibleTeams.map(team => {
                                const pts = series[team]; const color = teamColorMap[team];
                                return (
                                    <g key={team}>
                                        {pts.length >= 2 && <path d={pathFor(pts)} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={teamDashPattern(team) || 'none'}/>}
                                        {pts.map((pt, i) => (
                                            <g key={i}>
                                                <circle cx={xOf(pt.ts)} cy={yOf(pt.lettre)} r={7} fill={color} stroke="white" strokeWidth={2} style={{ cursor: 'pointer' }}
  
                                                    
															onMouseEnter={(e) => {
																const members = getTeamMembers(team);

																setTooltip({
																	x: e.clientX,
																	y: e.clientY,
																	team,
																	color,
																		content: [
																		`N°${pt.numero} · ${team}`,
																		`📍 ${pt.lettre} · ${pt.dateHeure}`,
																		(pt.evenement || '').substring(0, 80),
																		'',
																		'👥 Membres :',
																		...members
																	].join('\n')
																});
}}
															
															
															
															
															onMouseLeave={() => setTooltip(null)}/>
                                                <text x={xOf(pt.ts)} y={yOf(pt.lettre) - 12} textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">{pt.lettre}</text>
                                            </g>
                                        ))}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
{tooltip && (
    <div
style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 9999, pointerEvents: 'none' }}
className="bg-gray-900 text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs"
    >
{tooltip.team && (
    <div className="font-bold mb-1" style={{ color: tooltip.color }}>
        {tooltip.team}
    </div>
)}

{tooltip.content.split('\n').map((line, i) => {
    const isMembersTitle = line === '👥 Membres :';
    const isMember =
        line &&
        !line.startsWith('N°') &&
        !line.startsWith('📍') &&
        line !== '' &&
        line !== '👥 Membres :' &&
        !line.includes('·');

    return (
        <div
            key={i}
            className={
                i === 0
                    ? 'font-semibold text-white'
                    : isMembersTitle
                    ? 'mt-2 font-bold text-blue-300'
                    : isMember
                    ? 'text-black bg-white px-1 rounded'
                    : 'text-gray-300'
            }
        >
            {line}
        </div>
    );
})}
    </div>
)}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Historique des localisations</span>
                    <span className="text-xs text-gray-400">({allTs.length} entrée{allTs.length > 1 ? 's' : ''})</span>
                </div>
                <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">N°</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Date/Heure</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Équipe</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Point Phone</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Événement</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.filter(e => e.pointPhone).sort((a, b) => getTs(a) - getTs(b)).map((ev, i) => {
                                const lettre = ppLettre(ev.pointPhone);
                                const isPC = lettre === 'PC';
                                return (
                                <tr key={i} className={isPC ? 'bg-blue-50' : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                    <td className="px-4 py-2 font-mono text-blue-700 font-bold text-xs">{ev.numero}</td>
                                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{ev.dateHeure}</td>
                                    <td className="px-4 py-2">
                                        {ev.equipe
                                            ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: teamColorMap[ev.equipe] || '#9ca3af' }}>{ev.equipe}</span>
                                            : <span className="text-gray-400 text-xs">–</span>}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="font-bold text-blue-700">{ppLettre(ev.pointPhone)}</span>
                                        {ppNom(ev.pointPhone) && <span className="text-gray-500 ml-1 text-xs">{ppNom(ev.pointPhone)}</span>}
                                        {isPC && <span className="ml-1 text-xs text-gray-400 italic">(non tracé)</span>}
                                    </td>
                                    <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{ev.evenement}</td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
