// ============================================
// MODAL - SECRÉTAIRES
// ============================================
const GestionSecretairesModal = ({ secretaires, setSecretaires, onClose }) => {
    const [nouveauSecretaire, setNouveauSecretaire] = useState('');

    const ajouterSecretaire = () => {
        if (!nouveauSecretaire.trim()) {
            alert('Veuillez renseigner le nom');
            return;
        }
        if (secretaires.includes(nouveauSecretaire.trim())) {
            alert('Ce secrétaire existe déjà');
            return;
        }
        setSecretaires([...secretaires, nouveauSecretaire.trim()].sort());
        setNouveauSecretaire('');
    };

    const supprimerSecretaire = (nom) => {
        if (window.confirm(`Voulez-vous vraiment supprimer ${nom} ?`)) {
            setSecretaires(secretaires.filter(s => s !== nom));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Gestion des Secrétaires</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>
                    
                    <div className="bg-teal-50 p-4 rounded-lg mb-6">
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={nouveauSecretaire}
                                onChange={(e) => setNouveauSecretaire(e.target.value)}
                                placeholder="Ex: Jean Dupont"
                                className="flex-1 px-3 py-2 border rounded-lg"
                                onKeyPress={(e) => e.key === 'Enter' && ajouterSecretaire()}
                            />
                            <button onClick={ajouterSecretaire} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold">
                                + Ajouter
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-4">Liste ({secretaires.length})</h3>
                        <div className="space-y-2">
                            {secretaires.map((secretaire, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white rounded border">
                                    <span>{secretaire}</span>
                                    <button onClick={() => supprimerSecretaire(secretaire)} className="text-red-600 hover:text-red-800 font-semibold">
                                        Supprimer
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
// ============================================
// MODAL - ENREGISTREMENT DES SAUVETEURS
// ============================================
const GestionPlanningModal = ({ 
    masterSauveteursList, activeSauveteurIds, setActiveSauveteurIds,
    teams, setTeams, events, setEvents, nextEventNumber, setNextEventNumber,
    planning, setPlanning, totalDays, onClose, handleAddSauveteurToPlanning, mcMode, mcIdentifiant, startHour
}) => {
    const [selectedSauveteurs, setSelectedSauveteurs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const listePrefectorale = masterSauveteursList
        .filter(s => !activeSauveteurIds.includes(s.id))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', {sensitivity: 'base'}));
    const sauveteursSurSite = activeSauveteurIds.map(id => {
        const sauv = masterSauveteursList.find(s => s.id === id);
        return sauv ? { ...sauv, numeroPlanning: activeSauveteurIds.indexOf(id) + 1 } : null;
    }).filter(Boolean)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', {sensitivity: 'base'}));

    const filteredListe = listePrefectorale.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleArrivee = () => {
        if (selectedSauveteurs.length === 0) {
            alert('Veuillez sélectionner au moins un sauveteur');
            return;
        }

        selectedSauveteurs.forEach(id => {
            handleAddSauveteurToPlanning(id);
        });

        const sauv = selectedSauveteurs.map(id => masterSauveteursList.find(s => s.id === id));
        const nomsArrivants = sauv.map(s => s.name).join(', ');

        // Message différent selon le mode MC
        const evenementMessage = (mcMode === 'secondaire') 
            ? `Sauveteurs requis : ${nomsArrivants}`
            : `Arrivée de : ${nomsArrivants}`;

        const newEvent = {
            id: Date.now(),
            isoTimestamp: new Date().toISOString(),
            secretaire: 'Système',
            dateHeure: new Date().toLocaleString('fr-FR'),
            messageImportant: false,
            categorie: 'personnel',
            evenement: evenementMessage,
            numero: (mcMode === 'secondaire' && mcIdentifiant) ? 
                `${mcIdentifiant}-${nextEventNumber.toString().padStart(3, '0')}` : 
                nextEventNumber.toString().padStart(3, '0'),
            fait: false
        };

        setEvents([...events, newEvent]);
        setNextEventNumber(nextEventNumber + 1);
        setSelectedSauveteurs([]);
        alert('✅ Sauveteurs ajoutés au planning !');
    };

    const handleDepart = () => {
        if (selectedSauveteurs.length === 0) {
            alert('Veuillez sélectionner au moins un sauveteur');
            return;
        }

        const sauv = selectedSauveteurs.map(id => {
            const s = masterSauveteursList.find(s => s.id === id);
            return s ? s.name : '';
        }).filter(Boolean);
        const nomsPartants = sauv.join(', ');

        setTeams(teams.map(team => ({
            ...team,
            members: team.members.filter(id => !selectedSauveteurs.includes(id))
        })).filter(team => team.members.length > 0));

        // Ne PAS supprimer du planning — juste marquer "Quitter le secours" sur le slot actuel
        const nowD = new Date();
        let hD = nowD.getHours() - startHour;
        if (hD < 0) hD += 24;
        const slotD = hD * 4 + Math.floor(nowD.getMinutes() / 15);
        const totalSlotsD = getTotalSlots(totalDays);

        setPlanning(function(prev) {
            const np = {...prev};
            selectedSauveteurs.forEach(function(id) {
                if (!np[id]) return;
                const row = [...np[id]];
                // Propager les slots vides précédents
                var lastAct = null;
                for (var s = slotD - 1; s >= 0; s--) {
                    if (row[s] && row[s] !== 'nondef' && row[s] !== 'effacer') { lastAct = row[s]; break; }
                }
                if (lastAct) {
                    for (var s2 = slotD - 1; s2 >= 0; s2--) {
                        if (!row[s2] || row[s2] === 'nondef' || row[s2] === 'effacer') row[s2] = lastAct;
                        else break;
                    }
                }
                if (slotD >= 0 && slotD < totalSlotsD) row[slotD] = 'quitter_secours';
                np[id] = row;
            });
            return np;
        });

        // Retirer des équipes uniquement — garder dans activeSauveteurIds pour rester visible dans le planning
        setTeams(teams.map(function(team) {
            return {...team, members: team.members.filter(function(id){ return !selectedSauveteurs.includes(id); })};
        }));
        // NE PAS retirer de activeSauveteurIds : la personne reste visible dans le planning

        const newEvent = {
            id: Date.now(),
            isoTimestamp: new Date().toISOString(),
            secretaire: 'Système',
            dateHeure: new Date().toLocaleString('fr-FR'),
            messageImportant: false,
            categorie: 'personnel',
            evenement: 'Départ de : ' + nomsPartants,
            numero: (mcMode === 'secondaire' && mcIdentifiant) ? 
                `${mcIdentifiant}-${nextEventNumber.toString().padStart(3, '0')}` : 
                nextEventNumber.toString().padStart(3, '0'),
            fait: false
        };

        setEvents([...events, newEvent]);
        setNextEventNumber(nextEventNumber + 1);
        setSelectedSauveteurs([]);
        alert('✅ Sauveteurs retirés du planning !');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Enregistrement des sauveteurs</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-green-50 p-4 rounded-lg">
                            <h3 className="font-bold text-lg mb-3">Liste Préfectorale ({listePrefectorale.length})</h3>
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="🔍 Rechercher..."
                                className="w-full px-3 py-2 border rounded-lg mb-3"
                            />
                            <div className="max-h-80 overflow-y-auto space-y-2">
                                {filteredListe.map(s => (
                                    <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-green-100 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedSauveteurs.includes(s.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedSauveteurs([...selectedSauveteurs, s.id]);
                                                } else {
                                                    setSelectedSauveteurs(selectedSauveteurs.filter(id => id !== s.id));
                                                }
                                            }}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm">{s.name}</span>
                                    </label>
                                ))}
                            </div>
                            <button 
                                onClick={handleArrivee}
                                disabled={selectedSauveteurs.length === 0}
                                className="w-full mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 font-semibold"
                            >
                                → Arrivée ({selectedSauveteurs.length})
                            </button>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-bold text-lg mb-3">Sur site ({sauveteursSurSite.length})</h3>
                            <div className="max-h-80 overflow-y-auto space-y-2 mt-11">
                                {sauveteursSurSite.map(s => (
                                    <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-blue-100 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedSauveteurs.includes(s.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedSauveteurs([...selectedSauveteurs, s.id]);
                                                } else {
                                                    setSelectedSauveteurs(selectedSauveteurs.filter(id => id !== s.id));
                                                }
                                            }}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm font-semibold text-blue-700 mr-2">N°{s.numeroPlanning}</span>
                                        <span className="text-sm">{s.name}</span>
                                    </label>
                                ))}
                            </div>
                            <button 
                                onClick={handleDepart}
                                disabled={selectedSauveteurs.length === 0}
                                className="w-full mt-4 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-300 font-semibold"
                            >
                                ← Départ ({selectedSauveteurs.length})
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">Fermer</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
// ============================================
// MODAUX MC SECONDAIRES
// ============================================
// Modal de configuration initiale MC
const McConfigModal = ({ mcMode, setMcMode, mcIdentifiant, setMcIdentifiant, onConfirm, onClose }) => {
    const [localMode, setLocalMode] = React.useState(mcMode || 'principale');
    const [localId, setLocalId] = React.useState(mcIdentifiant || '');

    const handleConfirm = () => {
if (localMode === 'secondaire' && !localId.trim()) {
    alert('Veuillez saisir un identifiant pour la main courante secondaire (ex: A, B, CT1, CT2...)');
    return;
}
setMcMode(localMode);
setMcIdentifiant(localMode === 'secondaire' ? localId.trim().toUpperCase() : '');
onConfirm();
    };

    return (
<div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
    <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
        <div className="p-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-blue-800 mb-2">📋 Configuration Main Courante</h2>
                <p className="text-gray-600">Choisissez le type de main courante à créer</p>
            </div>
            
            <div className="space-y-4 mb-8">
                {/* Mode Principale */}
                <div 
                    onClick={() => setLocalMode('principale')}
                    className={`p-6 border-4 rounded-xl cursor-pointer transition-all ${
                        localMode === 'principale' 
                            ? 'border-blue-600 bg-blue-50 shadow-lg scale-105' 
                            : 'border-gray-300 bg-white hover:border-blue-300'
                    }`}
                >
                    <div className="flex items-start gap-4">
                        <div className="text-4xl">🏛️</div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-blue-900 mb-2">Main Courante Principale (PC)</h3>
                            <p className="text-gray-700 text-sm">
                                Utilisée sur le Poste de Commandement principal. Les événements seront numérotés : 
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-1">001, 002, 003...</span>
                            </p>
                            <p className="text-blue-600 font-semibold mt-2 text-sm">
                                ✓ Peut importer et fusionner des MC secondaires
                            </p>
                        </div>
                        {localMode === 'principale' && (
                            <div className="text-3xl text-blue-600">✓</div>
                        )}
                    </div>
                </div>

                {/* Mode Secondaire */}
                <div 
                    onClick={() => setLocalMode('secondaire')}
                    className={`p-6 border-4 rounded-xl cursor-pointer transition-all ${
                        localMode === 'secondaire' 
                            ? 'border-amber-600 bg-amber-50 shadow-lg scale-105' 
                            : 'border-gray-300 bg-white hover:border-amber-300'
                    }`}
                >
                    <div className="flex items-start gap-4">
                        <div className="text-4xl">📱</div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-amber-900 mb-2">Main Courante Secondaire (Base Arrière)</h3>
                            <p className="text-gray-700 text-sm">
                                Utilisée en base arrière par les conseillers techniques ou gestionnaires. Nécessite un identifiant unique.
                            </p>
                            <p className="text-amber-600 font-semibold mt-2 text-sm">
                                ✓ Peut être fusionnée dans la MC principale
                            </p>
                            
                            {localMode === 'secondaire' && (
                                <div className="mt-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Identifiant de la MC Secondaire :
                                    </label>
                                    <input
                                        type="text"
                                        value={localId}
                                        onChange={(e) => setLocalId(e.target.value.toUpperCase())}
                                        placeholder="Ex: A, B, CT1, CT2, G1..."
                                        className="w-full px-4 py-3 border-2 border-amber-400 rounded-lg text-lg font-mono focus:border-amber-600 focus:outline-none"
                                        maxLength="10"
                                        autoFocus
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Les événements seront numérotés : 
                                        <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-1">
                                            {localId || 'X'}-001, {localId || 'X'}-002...
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                        {localMode === 'secondaire' && (
                            <div className="text-3xl text-amber-600">✓</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={handleConfirm}
                    className="flex-1 bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 font-bold text-lg transition-all hover:scale-105"
                >
                    ✓ Confirmer et Démarrer
                </button>
                {mcMode && (
                    <button
                        onClick={onClose}
                        className="px-6 py-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
                    >
                        Annuler
                    </button>
                )}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                    <strong>💡 Conseil :</strong> Si vous êtes sur le PC principal, choisissez "Principale". 
                    Si vous travaillez en base arrière avant l'arrivée sur site, choisissez "Secondaire".
                </p>
            </div>
        </div>
    </div>
</div>
    );
};
// Modal de changement de secrétaire
const SecretaireModal = ({ currentSecretaire, setCurrentSecretaire, onClose }) => {
    const [newName, setNewName] = React.useState(currentSecretaire || '');

    const handleSave = () => {
if (newName.trim()) {
    setCurrentSecretaire(newName.trim());
    localStorage.setItem('ssf_current_secretaire', newName.trim());
    alert(`✅ Secrétaire enregistré : ${newName.trim()}\n\nCe nom sera automatiquement utilisé pour vos prochains événements.`);
    onClose();
} else {
    alert('⚠️ Veuillez entrer un nom');
}
    };

    return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-blue-800">👤 Secrétaire de ce PC</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                    <strong>💡 Information :</strong> Le nom du secrétaire sera mémorisé sur <strong>ce PC uniquement</strong>. 
                    Il sera automatiquement utilisé pour pré-remplir le champ lors de la création d'événements.
                </p>
            </div>

            {currentSecretaire && (
                <div className="bg-gray-50 p-3 rounded border border-gray-300">
                    <p className="text-sm text-gray-700">
                        <strong>Nom actuel :</strong> {currentSecretaire}
                    </p>
                </div>
            )}

            <div>
                <label className="block text-sm font-semibold mb-2">
                    {currentSecretaire ? 'Nouveau nom :' : 'Votre nom :'}
                </label>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Martin DUPONT"
                    className="w-full px-4 py-3 border-2 border-blue-400 rounded-lg text-lg focus:border-blue-600 focus:outline-none"
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                />
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold transition-all"
                >
                    ✓ Enregistrer
                </button>
                <button
                    onClick={onClose}
                    className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
                >
                    Annuler
                </button>
            </div>
        </div>
    </div>
</div>
    );
};
// ============================================
// MODAL - INFORMATIONS DE MISSION (démarrage)
// ============================================
const MissionInfoModal = ({ onConfirm, onSkip, initialMissionInfo }) => {
    const [onglet, setOnglet] = React.useState('nouveau'); // 'nouveau' | 'rouvrir'
    // Onglet Nouveau dossier — pré-rempli si initialMissionInfo fourni
    const [typeSecours, setTypeSecours] = React.useState(initialMissionInfo?.typeSecours || 'secours');
    const [nomCavite, setNomCavite] = React.useState(initialMissionInfo?.nomCavite || '');
    const [commune, setCommune] = React.useState(initialMissionInfo?.commune || '');
    const [delaiAlerteOccupation, setDelaiAlerteOccupation] = React.useState(
initialMissionInfo?.delaiAlerteOccupation ? Math.round(initialMissionInfo.delaiAlerteOccupation / 60) : 10
    );
    const isModification = !!(initialMissionInfo?.nomCavite);
    // Onglet Rouvrir
    const [dossiersExistants, setDossiersExistants] = React.useState([]);
    const [dossierSelectionne, setDossierSelectionne] = React.useState(null);

    // Charger les dossiers existants depuis le localStorage au montage
    React.useEffect(() => {
const prefix = 'SSF_UNIFIED_STATE_';
const dossiers = [];
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
        try {
            const raw = localStorage.getItem(key);
            const data = JSON.parse(raw);
            // Reconstruire l'ID lisible depuis la clé
            // Clé: SSF_UNIFIED_STATE_secours---creux-serre---21-04-2026_V13
            const withoutPrefix = key.replace(prefix, '').replace(/_V\d+$/, '');
            // Tenter de lire le rescueId sauvegardé dans la donnée si dispo
            const rescueId = data.rescueId || withoutPrefix.replace(/-+/g, match => match.length > 1 ? ' - ' : '-');
            const nbEvents = (data.events || []).length;
            const nbSauveteurs = (data.activeSauveteurIds || []).length;
            const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString('fr-FR') : '—';
            dossiers.push({ key, rescueId, nbEvents, nbSauveteurs, timestamp, raw });
        } catch(e) {}
    }
}
// Trier par timestamp décroissant (plus récent en premier)
dossiers.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
setDossiersExistants(dossiers);
// Si des dossiers existent, ouvrir directement l'onglet "rouvrir"
if (dossiers.length > 0) setOnglet('rouvrir');
    }, []);

    const handleConfirmNouveau = () => {
if (!nomCavite.trim()) { alert('⚠️ Veuillez saisir le nom de la cavité'); return; }
if (!commune.trim()) { alert('⚠️ Veuillez saisir la commune'); return; }
if (!delaiAlerteOccupation || delaiAlerteOccupation < 1) { alert('⚠️ Veuillez sélectionner un délai valide'); return; }
onConfirm({ typeSecours, nomCavite: nomCavite.trim(), commune: commune.trim(), delaiAlerteOccupation: delaiAlerteOccupation * 60 });
    };

    const handleRouvrir = () => {
if (!dossierSelectionne) { alert('⚠️ Veuillez sélectionner un dossier'); return; }
// Passer la clé exacte + les données brutes pour un chargement fiable
onConfirm({ typeSecours: null, nomCavite: null, commune: null, delaiAlerteOccupation: 6, rouvrir: true, rescueId: dossierSelectionne.rescueId, localStorageKey: dossierSelectionne.key, rawData: dossierSelectionne.raw });
    };

    const isExercice = typeSecours === 'exercice';

    return (
<div className="fixed inset-0 flex items-center justify-center z-[200] p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
    <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" style={{ maxWidth: '680px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>

        {/* En-tête fixe */}
        <div className="bg-blue-900 p-5 text-center flex-shrink-0">
            <div className="text-4xl mb-1">🏔️</div>
            <h1 className="text-2xl font-black text-white tracking-wide">Application SSF — Démarrage</h1>
            <p className="text-blue-200 text-sm mt-1">{isModification ? 'Modifier les informations du secours en cours' : 'Choisissez comment démarrer cette session'}</p>
        </div>

        {/* Onglets */}
        {!isModification && (
        <div className="flex border-b flex-shrink-0">
            <button
                onClick={() => setOnglet('nouveau')}
                className={`flex-1 py-3 font-bold text-sm transition-all ${onglet === 'nouveau' ? 'bg-white border-b-4 border-blue-600 text-blue-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
                ➕ Nouveau dossier
            </button>
            <button
                onClick={() => setOnglet('rouvrir')}
                className={`flex-1 py-3 font-bold text-sm transition-all relative ${onglet === 'rouvrir' ? 'bg-white border-b-4 border-green-600 text-green-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
                📂 Rouvrir un dossier
                {dossiersExistants.length > 0 && (
                    <span className="ml-2 bg-green-600 text-white text-xs rounded-full px-2 py-0.5">{dossiersExistants.length}</span>
                )}
            </button>
        </div>
        )}

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-1 p-6">

            {/* ── ONGLET NOUVEAU DOSSIER ── */}
            {onglet === 'nouveau' && (
                <div className="space-y-5">
                    {/* Type d'intervention */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Type d'intervention</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div onClick={() => setTypeSecours('secours')}
                                className={`p-4 border-4 rounded-xl cursor-pointer transition-all text-center ${typeSecours === 'secours' ? 'border-red-600 bg-red-50 shadow-md' : 'border-gray-200 hover:border-red-300'}`}>
                                <div className="text-3xl">🚨</div>
                                <div className="font-black text-lg text-red-700 mt-1">SECOURS</div>
                                <div className="text-xs text-gray-500">Intervention réelle</div>
                                {typeSecours === 'secours' && <div className="text-xl mt-1">✅</div>}
                            </div>
                            <div onClick={() => setTypeSecours('exercice')}
                                className={`p-4 border-4 rounded-xl cursor-pointer transition-all text-center ${typeSecours === 'exercice' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                                <div className="text-3xl">🟡</div>
                                <div className="font-black text-lg text-amber-700 mt-1">EXERCICE</div>
                                <div className="text-xs text-gray-500">Simulation / manœuvre</div>
                                {typeSecours === 'exercice' && <div className="text-xl mt-1">✅</div>}
                            </div>
                        </div>
                    </div>

                    {/* Aperçu ID généré */}
                    {nomCavite.trim() && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm">
                            <span className="text-blue-500 font-semibold">ID généré : </span>
                            <span className="font-mono font-bold text-blue-800">
                                {(typeSecours === 'exercice' ? 'EXERCICE' : 'SECOURS')} - {nomCavite.trim()} - {String(new Date().getDate()).padStart(2,'0')}-{String(new Date().getMonth()+1).padStart(2,'0')}-{new Date().getFullYear()}
                            </span>
                        </div>
                    )}

                    {/* Nom cavité */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">🕳️ Nom de la cavité <span className="text-red-500">*</span></label>
                        <input type="text" value={nomCavite} onChange={(e) => setNomCavite(e.target.value)}
                            placeholder="Ex: Gouffre de Padirac, Grotte de Clamouse..."
                            className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg text-base focus:border-blue-600 focus:outline-none"
                            autoFocus onKeyPress={(e) => e.key === 'Enter' && handleConfirmNouveau()} />
                    </div>

                    {/* Commune */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">📍 Commune <span className="text-red-500">*</span></label>
                        <input type="text" value={commune} onChange={(e) => setCommune(e.target.value)}
                            placeholder="Ex: Saint-Martin-de-Londres..."
                            className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg text-base focus:border-blue-600 focus:outline-none"
                            onKeyPress={(e) => e.key === 'Enter' && handleConfirmNouveau()} />
                    </div>

                    {/* Délai alerte */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">⏱️ Délai d'alerte pour les temps d'engagement des sauveteurs <span className="text-red-500">*</span></label>
                        <div className="flex items-center gap-4">
                            <select
                                value={delaiAlerteOccupation}
                                onChange={(e) => setDelaiAlerteOccupation(parseInt(e.target.value))}
                                className="w-32 px-3 py-3 border-2 border-blue-300 rounded-lg text-xl font-bold text-center focus:border-blue-600 focus:outline-none bg-white cursor-pointer"
                            >
                                {Array.from({length: 17}, (_, i) => i + 4).map(h => (
                                    <option key={h} value={h}>{h}h</option>
                                ))}
                            </select>
                            <p className="text-sm text-gray-500 flex-1">
                                Définir le délai d'alerte pour les temps d'engagement des sauveteurs.
                                <span className="ml-1 font-semibold text-blue-600">→ {delaiAlerteOccupation}h00</span>
                            </p>
                        </div>
                    </div>

                </div>
            )}

            {/* ── ONGLET ROUVRIR ── */}
            {onglet === 'rouvrir' && (
                <div className="space-y-4">
                    {dossiersExistants.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <div className="text-5xl mb-3">📭</div>
                            <p className="font-semibold">Aucun dossier en mémoire</p>
                            <p className="text-sm mt-1">Créez un nouveau dossier depuis l'autre onglet.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-gray-500 mb-2">
                                {dossiersExistants.length} dossier{dossiersExistants.length > 1 ? 's' : ''} trouvé{dossiersExistants.length > 1 ? 's' : ''} en mémoire locale. Cliquez sur un dossier pour le sélectionner.
                            </p>
                            <div className="space-y-2">
                                {dossiersExistants.map((d, i) => (
                                    <div key={i}
                                        onClick={() => setDossierSelectionne(d)}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${dossierSelectionne && dossierSelectionne.key === d.key ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {d.rescueId.toUpperCase().startsWith('EXERCICE') ? <span className="text-lg">🟡</span> : <span className="text-lg">🚨</span>}
                                                    <span className="font-bold text-gray-800 truncate">{d.rescueId}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 flex gap-4">
                                                    <span>📅 {d.timestamp}</span>
                                                    <span>📋 {d.nbEvents} événement{d.nbEvents > 1 ? 's' : ''}</span>
                                                    <span>👥 {d.nbSauveteurs} sauveteur{d.nbSauveteurs > 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            {dossierSelectionne && dossierSelectionne.key === d.key && (
                                                <div className="text-2xl text-green-600 flex-shrink-0">✅</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleRouvrir}
                                disabled={!dossierSelectionne}
                                className="w-full py-4 rounded-xl font-black text-lg text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all hover:scale-105 shadow-lg">
                                📂 Rouvrir ce dossier
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>

        {/* Pied de page fixe avec boutons d'action */}
        <div className="flex-shrink-0 border-t bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">Les données sont sauvegardées localement sur ce navigateur.</p>
            <div className="flex items-center gap-3">
                {onglet === 'nouveau' && (
                    <button onClick={handleConfirmNouveau}
                        className="px-6 py-2 rounded-lg font-black text-base text-white transition-all shadow-md hover:scale-105"
                        style={{backgroundColor: isExercice ? '#f59e0b' : '#b91c1c', border: isExercice ? '1px solid #d97706' : '1px solid #991b1b'}}
                        onMouseEnter={e=>e.currentTarget.style.backgroundColor=isExercice?'#d97706':'#991b1b'}
                        onMouseLeave={e=>e.currentTarget.style.backgroundColor=isExercice?'#f59e0b':'#b91c1c'}
                    >
                        ✓ {isModification ? 'Enregistrer les modifications' : 'Créer le dossier et continuer'}
                    </button>
                )}
                <button
                    onClick={onSkip}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-md" style={{backgroundColor:"#f97316",border:"1px solid #ea580c"}} onMouseEnter={e=>e.target.style.backgroundColor="#ea580c"} onMouseLeave={e=>e.target.style.backgroundColor="#f97316"}
                    title="Démarrer sans renseigner les informations de mission"
                >
                    ⏭ Passer
                </button>
            </div>
        </div>
    </div>
</div>
    );
};
// Modal de sélection du mode STANDALONE
const ModeSelectionModal = ({ onConfirm }) => {
    const [selectedMode, setSelectedMode] = React.useState('');
    const [identifiant, setIdentifiant] = React.useState('');

    const handleConfirm = () => {
if (selectedMode === 'terrain') {
    // PC de Terrain : mode principale, numérotation simple
    onConfirm('principale', '');
} else if (selectedMode === 'planning') {
    // Mode Planning Déporté : mode secondaire, identifiant PLANNING
    onConfirm('secondaire', 'PLANNING');
} else if (selectedMode === 'base') {
    // PC Base Arrière : mode secondaire, avec identifiant
    if (!identifiant.trim()) {
        alert('⚠️ Veuillez saisir un identifiant pour le PC Base Arrière');
        return;
    }
    onConfirm('secondaire', identifiant.trim());
} else {
    alert('⚠️ Veuillez sélectionner un mode');
}
    };

    return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full p-8">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-800 mb-2">Application SSF Unifiée{APP_VERSION ? ' - Version ' + APP_VERSION : ''}</h1>
            <p className="text-xl text-gray-700">Choisissez votre mode d'utilisation</p>
        </div>

        <div className="space-y-6">
            {/* Mode PC de Terrain */}
            <div 
                onClick={() => setSelectedMode('terrain')}
                className={`border-4 rounded-lg p-6 cursor-pointer transition-all ${
                    selectedMode === 'terrain' 
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
            >
                <div className="flex items-center gap-4">
                    <div className="text-5xl">🎯</div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            PC de Terrain 🏛️ (Poste Maître)
                        </h2>
                        <p className="text-gray-700 mb-2">
                            Gestion complète : Main Courante + Planning + Équipes
                        </p>
                        <p className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded inline-block">
                            Numérotation : 001, 002, 003...
                        </p>
                    </div>
                    <div className="text-3xl">
                        {selectedMode === 'terrain' ? '✅' : '○'}
                    </div>
                </div>
            </div>

            {/* Mode Planning Déporté */}
            <div 
                onClick={() => setSelectedMode('planning')}
                className={`border-4 rounded-lg p-6 cursor-pointer transition-all ${
                    selectedMode === 'planning' 
                        ? 'border-green-600 bg-green-50' 
                        : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                }`}
            >
                <div className="flex items-center gap-4">
                    <div className="text-5xl">📅</div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            Planning Déporté 📊
                        </h2>
                        <p className="text-gray-700 mb-2">
                            Gestion du planning uniquement - À synchroniser avec le PC Maître
                        </p>
                        <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-2">
                            <li>Saisir les mêmes arrivées que le PC Maître</li>
                            <li>Créer les mêmes équipes</li>
                            <li>Gérer le planning des rotations</li>
                            <li>Exporter régulièrement vers le PC Maître</li>
                        </ul>
                        <p className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded inline-block">
                            Numérotation : PLANNING-001, PLANNING-002...
                        </p>
                    </div>
                    <div className="text-3xl">
                        {selectedMode === 'planning' ? '✅' : '○'}
                    </div>
                </div>
            </div>

            {/* Mode PC Base Arrière */}
            <div 
                onClick={() => setSelectedMode('base')}
                className={`border-4 rounded-lg p-6 cursor-pointer transition-all ${
                    selectedMode === 'base' 
                        ? 'border-amber-600 bg-amber-50' 
                        : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'
                }`}
            >
                <div className="flex items-center gap-4">
                    <div className="text-5xl">🚗</div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            PC Base Arrière 📡
                        </h2>
                        <p className="text-gray-700 mb-2">
                            (Alerte, véhicule, poste avancé, dispositif mobile)
                        </p>
                        <p className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded inline-block mb-3">
                            Numérotation avec préfixe : MC2-001, VEHICULE1-001...
                        </p>
                        {selectedMode === 'base' && (
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-gray-700">
                                    Identifiant de ce PC :
                                </label>
                                <input
                                    type="text"
                                    value={identifiant}
                                    onChange={(e) => setIdentifiant(e.target.value.toUpperCase())}
                                    placeholder="Ex: MC2, VEHICULE1, BASE-A..."
                                    className="w-full px-4 py-3 border-2 border-amber-400 rounded-lg text-lg font-mono focus:border-amber-600 focus:outline-none"
                                    maxLength="15"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Les événements seront numérotés : 
                                    <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-1">
                                        {identifiant || 'XXX'}-001, {identifiant || 'XXX'}-002...
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="text-3xl">
                        {selectedMode === 'base' ? '✅' : '○'}
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-8 flex gap-4">
            <button
                onClick={handleConfirm}
                className="flex-1 bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 font-bold text-lg transition-all hover:scale-105"
            >
                ✓ Confirmer et Démarrer
            </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
                <strong>💡 Information :</strong> Cette version STANDALONE fonctionne en mode solo (pas de synchronisation multi-utilisateurs). 
                Toutes les données sont sauvegardées localement sur ce PC.
            </p>
        </div>
    </div>
</div>
    );
};
// Modal d'import/fusion des MC Secondaires
const ImportMcModal = ({ events, setEvents, nextEventNumber, setNextEventNumber, onClose }) => {
    const [importedData, setImportedData] = React.useState(null);
    const [mergePreview, setMergePreview] = React.useState([]);
    const [showConfirm, setShowConfirm] = React.useState(false);

    const handleFileUpload = (e) => {
const file = e.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = (event) => {
    try {
        const data = JSON.parse(event.target.result);
        
        // Vérifier que c'est bien une MC secondaire
        if (!data.mcMode || data.mcMode !== 'secondaire') {
            alert('⚠️ Ce fichier ne semble pas être une Main Courante Secondaire valide.');
            return;
        }

        if (!data.mcIdentifiant) {
            alert('⚠️ Cette Main Courante Secondaire n\'a pas d\'identifiant.');
            return;
        }

        setImportedData(data);
        generateMergePreview(data);
        setShowConfirm(true);
    } catch (error) {
        alert('❌ Erreur lors de la lecture du fichier : ' + error.message);
    }
};
reader.readAsText(file);
    };

    const generateMergePreview = (data) => {
// Fusionner et trier par date/heure
const importedEvents = data.events || [];
const allEvents = [...events, ...importedEvents];

// Trier par timestamp (convertir dateHeure en timestamp pour comparaison)
allEvents.sort((a, b) => {
    const dateA = parseFrenchDate(a.dateHeure);
    const dateB = parseFrenchDate(b.dateHeure);
    return dateA - dateB;
});

setMergePreview(allEvents);
    };

    const parseFrenchDate = (dateStr) => {
// Format: "DD/MM/YYYY HH:MM:SS" ou "DD/MM/YYYY à HH:MM:SS"
try {
    const parts = dateStr.replace(' à ', ' ').split(/[\/\s:]/);
    if (parts.length >= 5) {
        const [day, month, year, hour, minute] = parts.map(p => parseInt(p, 10));
        return new Date(year, month - 1, day, hour, minute);
    }
} catch (e) {
    // En cas d'erreur, utiliser l'ID pour l'ordre
}
return new Date(0);
    };

    const confirmMerge = () => {
if (!importedData) return;

// Mettre à jour les événements
setEvents(mergePreview);

// Mettre à jour le prochain numéro si nécessaire
const maxNum = Math.max(
    nextEventNumber,
    ...(importedData.events || []).map(e => {
        const match = e.numero.match(/\d+/);
        return match ? parseInt(match[0], 10) + 1 : 0;
    })
);
setNextEventNumber(maxNum);

alert(`✓ ${importedData.events.length} événement(s) de la MC "${importedData.mcIdentifiant}" fusionné(s) avec succès !`);
onClose();
    };

    const getSourceBadge = (event) => {
if (!event.numero.match(/^[A-Z]+[0-9]*-/)) {
    return <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">PC</span>;
}
const prefix = event.numero.split('-')[0];
return <span className="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold">{prefix}</span>;
    };

    return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">📥 Importer et Fusionner une MC Secondaire</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>

            {!showConfirm ? (
                <div>
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-bold text-amber-900 mb-3">📋 Instructions</h3>
                        <ol className="space-y-2 text-sm text-gray-700">
                            <li className="flex gap-2">
                                <span className="font-bold">1.</span>
                                <span>Sélectionnez le fichier JSON exporté depuis une Main Courante Secondaire</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold">2.</span>
                                <span>Vérifiez l'aperçu de la fusion chronologique</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold">3.</span>
                                <span>Confirmez la fusion - les événements seront triés par ordre chronologique</span>
                            </li>
                        </ol>
                        <p className="mt-4 text-amber-800 font-semibold text-sm">
                            ⚠️ Important : L'identifiant de la MC secondaire sera conservé pour tracer l'origine de chaque événement.
                        </p>
                    </div>

                    <div className="border-4 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="mc-file-input"
                        />
                        <label htmlFor="mc-file-input" className="cursor-pointer">
                            <div className="text-6xl mb-4">📂</div>
                            <p className="text-xl font-bold text-blue-800 mb-2">
                                Cliquez pour sélectionner un fichier
                            </p>
                            <p className="text-gray-600">
                                Formats acceptés : .json (Main Courante exportée)
                            </p>
                        </label>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-bold text-green-900 mb-2">✓ Fichier chargé avec succès</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <strong>Identifiant MC :</strong>
                                <span className="ml-2 bg-amber-500 text-white px-3 py-1 rounded font-bold">
                                    {importedData.mcIdentifiant}
                                </span>
                            </div>
                            <div>
                                <strong>Événements :</strong>
                                <span className="ml-2">{importedData.events.length}</span>
                            </div>
                            <div>
                                <strong>Date export :</strong>
                                <span className="ml-2">{new Date(importedData.timestamp).toLocaleString('fr-FR')}</span>
                            </div>
                            <div>
                                <strong>Total après fusion :</strong>
                                <span className="ml-2 font-bold">{mergePreview.length} événements</span>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-bold text-lg mb-3">📊 Aperçu de la fusion chronologique</h3>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-200">
                                    <tr>
                                        <th className="p-2 text-left">Source</th>
                                        <th className="p-2 text-left">N°</th>
                                        <th className="p-2 text-left">Date/Heure</th>
                                        <th className="p-2 text-left">Événement</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mergePreview.map((event, idx) => (
                                        <tr key={idx} className="border-t hover:bg-gray-100">
                                            <td className="p-2">{getSourceBadge(event)}</td>
                                            <td className="p-2 font-mono font-bold">{event.numero}</td>
                                            <td className="p-2 text-xs">{event.dateHeure}</td>
                                            <td className="p-2 truncate max-w-md">{event.evenement.substring(0, 80)}...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={confirmMerge}
                            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold text-lg"
                        >
                            ✓ Confirmer la Fusion
                        </button>
                        <button
                            onClick={() => {
                                setShowConfirm(false);
                                setImportedData(null);
                                setMergePreview([]);
                            }}
                            className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
                        >
                            ← Retour
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
</div>
    );
};
