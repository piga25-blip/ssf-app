// ============================================
// MODAL - RECHERCHE MAIN COURANTE
// ============================================
const RechercheMainCouranteModal = ({ events, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, important, alert, categories
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [sortColumn, setSortColumn] = useState('numero'); // numero, secretaire, timestamp, categorie
    const [sortDirection, setSortDirection] = useState('desc'); // asc ou desc

    const now = new Date();

    // Liste des catégories disponibles
    const availableCategories = [
        { id: 'secours', nom: '🚑 Secours', couleur: 'red' },
        { id: 'logistique', nom: '📦 Logistique', couleur: 'blue' },
        { id: 'communication', nom: '💬 Communication', couleur: 'green' },
        { id: 'equipe', nom: '👔 Équipe', couleur: 'purple' },
        { id: 'progression', nom: '📍 Progression', couleur: 'indigo' },
        { id: 'intendance', nom: '🍽️ Intendance', couleur: 'orange' },
        { id: 'incident', nom: '⚠️ Incident', couleur: 'yellow' },
        { id: 'administratif', nom: '📋 Administratif', couleur: 'gray' },
        { id: 'personnel', nom: '🧑‍⚕️ Personnel', couleur: 'cyan' },
        { id: 'autre', nom: '🎯 Autre', couleur: 'pink' }
    ];

    const getAlertStatus = (event) => {
        if (!event.dateRappel) return null;
        
        const rappelDate = new Date(event.dateRappel + 'T' + (event.heureRappel || '00:00'));
        const diff = rappelDate - now;
        const hours = diff / (1000 * 60 * 60);
        
        if (event.fait) return 'done';
        if (hours < 0) return 'passed';
        if (hours <= 2) return 'urgent';
        return 'scheduled';
    };

    const toggleCategory = (categoryId) => {
        setSelectedCategories(prev => {
            if (prev.includes(categoryId)) {
                return prev.filter(id => id !== categoryId);
            } else {
                return [...prev, categoryId];
            }
        });
    };

    const selectAllCategories = () => {
        setSelectedCategories(availableCategories.map(c => c.id));
    };

    const clearAllCategories = () => {
        setSelectedCategories([]);
    };

    const getFilteredEvents = () => {
        let filtered = events;

        // Filtre par type
        if (filterType === 'important') {
            filtered = filtered.filter(e => e.messageImportant);
        } else if (filterType === 'alert') {
            filtered = filtered.filter(e => e.dateRappel);
        } else if (filterType === 'categories') {
            // Filtre par catégories sélectionnées
            if (selectedCategories.length > 0) {
                filtered = filtered.filter(e => selectedCategories.includes(e.categorie));
            }
        }

        // Filtre par texte de recherche
        if (searchTerm.trim()) {
            filtered = filtered.filter(e => 
                e.evenement.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.secretaire.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.numero.includes(searchTerm)
            );
        }

        // Tri selon la colonne et direction sélectionnées
        return filtered.sort((a, b) => {
            let compareA, compareB;

            switch (sortColumn) {
                case 'numero':
                    // Extraire le nombre du numéro (ex: "001" -> 1, "A-001" -> 1)
                    const getNumericPart = (num) => {
                        const match = num.match(/(\d+)$/);
                        return match ? parseInt(match[1]) : 0;
                    };
                    compareA = getNumericPart(a.numero);
                    compareB = getNumericPart(b.numero);
                    break;
                case 'secretaire':
                    compareA = (a.secretaire || '').toLowerCase();
                    compareB = (b.secretaire || '').toLowerCase();
                    break;
                case 'timestamp':
                    compareA = new Date(a.timestamp || a.dateHeure).getTime();
                    compareB = new Date(b.timestamp || b.dateHeure).getTime();
                    break;
                case 'categorie':
                    compareA = (a.categorie || 'autre').toLowerCase();
                    compareB = (b.categorie || 'autre').toLowerCase();
                    break;
                default:
                    compareA = a.id;
                    compareB = b.id;
            }

            if (sortDirection === 'asc') {
                return compareA > compareB ? 1 : compareA < compareB ? -1 : 0;
            } else {
                return compareA < compareB ? 1 : compareA > compareB ? -1 : 0;
            }
        });
    };

    // Fonction pour changer le tri
    const handleSort = (column) => {
        if (sortColumn === column) {
            // Inverser la direction si même colonne
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Nouvelle colonne : tri décroissant par défaut
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const filteredEvents = getFilteredEvents();

    const alertCounts = {
        scheduled: events.filter(e => getAlertStatus(e) === 'scheduled').length,
        urgent: events.filter(e => getAlertStatus(e) === 'urgent').length,
        passed: events.filter(e => getAlertStatus(e) === 'passed').length,
        done: events.filter(e => getAlertStatus(e) === 'done').length
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">🔍 Recherche Main Courante</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    {/* Barre de recherche */}
                    <div className="mb-4">
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="🔍 Rechercher un événement, secrétaire, numéro..."
                            className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
                            autoFocus
                        />
                    </div>

                    {/* Filtres rapides */}
                    <div className="flex gap-3 mb-6 flex-wrap">
                        <button 
                            onClick={() => setFilterType('all')}
                            className={`px-4 py-2 rounded-lg font-semibold ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                            Tous ({events.length})
                        </button>
                        <button 
                            onClick={() => setFilterType('important')}
                            className={`px-4 py-2 rounded-lg font-semibold ${filterType === 'important' ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                            ⚠️ Messages Importants ({events.filter(e => e.messageImportant).length})
                        </button>
                        <button 
                            onClick={() => setFilterType('alert')}
                            className={`px-4 py-2 rounded-lg font-semibold ${filterType === 'alert' ? 'bg-orange-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                            🔔 Avec Alerte ({events.filter(e => e.dateRappel).length})
                        </button>
                        <button 
                            onClick={() => setFilterType('categories')}
                            className={`px-4 py-2 rounded-lg font-semibold ${filterType === 'categories' ? 'bg-purple-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                            🏷️ Catégories ({events.length})
                        </button>
                    </div>

                    {/* Interface de sélection des catégories */}
                    {filterType === 'categories' && (
                        <div className="mb-6 bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-purple-800">🏷️ Filtrer par Catégories</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={selectAllCategories}
                                        className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm font-semibold"
                                    >
                                        ✓ Tout sélectionner
                                    </button>
                                    <button 
                                        onClick={clearAllCategories}
                                        className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm font-semibold"
                                    >
                                        ✗ Tout décocher
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {availableCategories.map(category => {
                                    const count = events.filter(e => e.categorie === category.id).length;
                                    const isSelected = selectedCategories.includes(category.id);
                                    const colorClasses = {
                                        red: isSelected ? 'bg-red-100 border-red-500 border-2' : 'bg-red-50 border-red-200',
                                        blue: isSelected ? 'bg-blue-100 border-blue-500 border-2' : 'bg-blue-50 border-blue-200',
                                        green: isSelected ? 'bg-green-100 border-green-500 border-2' : 'bg-green-50 border-green-200',
                                        purple: isSelected ? 'bg-purple-100 border-purple-500 border-2' : 'bg-purple-50 border-purple-200',
                                        indigo: isSelected ? 'bg-indigo-100 border-indigo-500 border-2' : 'bg-indigo-50 border-indigo-200',
                                        orange: isSelected ? 'bg-orange-100 border-orange-500 border-2' : 'bg-orange-50 border-orange-200',
                                        yellow: isSelected ? 'bg-yellow-100 border-yellow-500 border-2' : 'bg-yellow-50 border-yellow-200',
                                        gray: isSelected ? 'bg-gray-200 border-gray-500 border-2' : 'bg-gray-100 border-gray-300',
                                        cyan: isSelected ? 'bg-cyan-100 border-cyan-500 border-2' : 'bg-cyan-50 border-cyan-200',
                                        pink: isSelected ? 'bg-pink-100 border-pink-500 border-2' : 'bg-pink-50 border-pink-200'
                                    };
                                    return (
                                        <label 
                                            key={category.id}
                                            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:shadow-md transition ${colorClasses[category.couleur]}`}
                                        >
                                            <input 
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleCategory(category.id)}
                                                className="w-5 h-5 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm">{category.nom}</div>
                                                <div className="text-xs text-gray-600">({count} événement{count !== 1 ? 's' : ''})</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="mt-3 text-sm text-gray-600">
                                {selectedCategories.length > 0 
                                    ? `${selectedCategories.length} catégorie(s) sélectionnée(s)` 
                                    : 'Aucune catégorie sélectionnée - Sélectionnez au moins une catégorie pour filtrer'}
                            </div>
                        </div>
                    )}

                    {/* Statistiques alertes */}
                    {filterType === 'alert' && (
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-center">
                                <div className="text-2xl font-bold text-blue-600">{alertCounts.scheduled}</div>
                                <div className="text-sm text-gray-600">Programmées</div>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-lg text-center">
                                <div className="text-2xl font-bold text-orange-600">{alertCounts.urgent}</div>
                                <div className="text-sm text-gray-600">Urgentes (≤2h)</div>
                            </div>
                            <div className="bg-red-50 p-3 rounded-lg text-center">
                                <div className="text-2xl font-bold text-red-600">{alertCounts.passed}</div>
                                <div className="text-sm text-gray-600">Dépassées</div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg text-center">
                                <div className="text-2xl font-bold text-green-600">{alertCounts.done}</div>
                                <div className="text-sm text-gray-600">Réalisées</div>
                            </div>
                        </div>
                    )}

                    {/* Résultats */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold">
                                Résultats : {filteredEvents.length} événement(s)
                            </div>
                            {/* Contrôles de tri */}
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600">Trier par :</span>
                                <button
                                    onClick={() => handleSort('numero')}
                                    className={`px-3 py-1 rounded ${sortColumn === 'numero' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                                >
                                    N° {sortColumn === 'numero' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </button>
                                <button
                                    onClick={() => handleSort('timestamp')}
                                    className={`px-3 py-1 rounded ${sortColumn === 'timestamp' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                                >
                                    Date {sortColumn === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </button>
                                <button
                                    onClick={() => handleSort('secretaire')}
                                    className={`px-3 py-1 rounded ${sortColumn === 'secretaire' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                                >
                                    Secrétaire {sortColumn === 'secretaire' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </button>
                                <button
                                    onClick={() => handleSort('categorie')}
                                    className={`px-3 py-1 rounded ${sortColumn === 'categorie' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                                >
                                    Catégorie {sortColumn === 'categorie' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </button>
                            </div>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {filteredEvents.length > 0 ? (
                                <div className="space-y-3">
                                    {filteredEvents.map(event => {
                                        const alertStatus = getAlertStatus(event);
                                        return (
                                            <div key={event.id} className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-blue-700 text-lg">N°{event.numero}</span>
                                                        {event.messageImportant && (
                                                            <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">IMPORTANT</span>
                                                        )}
                                                        {alertStatus && (
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                alertStatus === 'urgent' ? 'bg-orange-600 text-white' :
                                                                alertStatus === 'passed' ? 'bg-red-600 text-white' :
                                                                alertStatus === 'done' ? 'bg-green-600 text-white' :
                                                                'bg-blue-600 text-white'
                                                            }`}>
                                                                {alertStatus === 'urgent' ? '🔔 URGENT' :
                                                                 alertStatus === 'passed' ? '⚠️ DÉPASSÉE' :
                                                                 alertStatus === 'done' ? '✓ FAITE' :
                                                                 '📅 PROGRAMMÉE'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{event.dateHeure}</div>
                                                </div>
                                                <div className="mb-2">
                                                    <span className="text-sm font-semibold text-gray-600">Secrétaire: </span>
                                                    <span className="text-sm">{event.secretaire}</span>
                                                </div>
                                                {event.categorie && (
                                                    <div className="mb-2">
                                                        <span className="text-sm font-semibold text-gray-600">Catégorie: </span>
                                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'red' ? 'bg-red-100 text-red-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'blue' ? 'bg-blue-100 text-blue-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'green' ? 'bg-green-100 text-green-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'purple' ? 'bg-purple-100 text-purple-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'indigo' ? 'bg-indigo-100 text-indigo-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'orange' ? 'bg-orange-100 text-orange-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'gray' ? 'bg-gray-100 text-gray-800' :
                                                            availableCategories.find(c => c.id === event.categorie)?.couleur === 'cyan' ? 'bg-cyan-100 text-cyan-800' :
                                                            'bg-pink-100 text-pink-800'
                                                        }`}>
                                                            {availableCategories.find(c => c.id === event.categorie)?.nom}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="text-gray-700 whitespace-pre-line">{event.evenement}</div>
                                                {event.dateRappel && (
                                                    <div className="mt-3 bg-blue-50 p-2 rounded text-sm">
                                                        <span className="font-semibold">Rappel: </span>
                                                        {new Date(event.dateRappel).toLocaleDateString('fr-FR')} à {event.heureRappel}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-lg">Aucun événement trouvé</p>
                                    <p className="text-sm">Modifiez vos critères de recherche</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 font-semibold">
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// COMPOSANT MAIN COURANTE
// ============================================
const MainCouranteTab = ({ 
    events, setEvents, nextEventNumber, setNextEventNumber,
    secretaires, sauveteursSurSiteNoms, teams, sauveteursSurSite,
    showSearchModal, setShowSearchModal, mcMode, mcIdentifiant,
    pointsPhone, setPointsPhone, masterSauveteursList, categories,
    currentSecretaire, setCurrentSecretaire, showSecretaireModal, setShowSecretaireModal,
    showAlertsModal, setShowAlertsModal, alertModalPosition, setAlertModalPosition,
    isDraggingAlert, setIsDraggingAlert, dragStartPos, setDragStartPos,
    showGestionPointsPhone, setShowGestionPointsPhone,
    planning, setPlanning, startHour, totalDays, activeSauveteurIds,
    modalRepos, setModalRepos
}) => {
    const [formData, setFormData] = useState({
        secretaire: '',
        messageImportant: false,
        categorie: 'autre',
        fichier: null,
        evenement: '',
        dateRappel: '',
        heureRappel: '',
        expediteur: '',
        destinataire: '',
        pointPhone: '',
        personneConcernee: '',
        equipe: '',
        departDuPC: false,
        lieuDepart: 'souterre',
        sensEntree: null
    });
    const [insertAfterEvent, setInsertAfterEvent] = useState(null);
    const [insertBornes, setInsertBornes] = useState({ min: null, max: null, defaut: null });
    const [membresSelectionnes, setMembresSelectionnes] = useState([]);
    const [modalSelectionMembres, setModalSelectionMembres] = useState(null);
    const [insertFormData, setInsertFormData] = useState({
        secretaire: '',
        messageImportant: false,
        categorie: 'autre',
        fichier: null,
        evenement: '',
        dateRappel: '',
        heureRappel: '',
        expediteur: '',
        destinataire: '',
        pointPhone: '',
        personneConcernee: '',
         equipe: '',
         dateManuelle: '',
         heureManuelle: ''
    });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [rechercheRapide, setRechercheRapide] = useState('');
    const [showCategorieAlert, setShowCategorieAlert] = useState(false);
    const [sortColumn, setSortColumn] = useState('numero'); // numero, secretaire, timestamp, categorie
    const [sortDirection, setSortDirection] = useState('desc');
    // ── Refs navigation clavier (formulaire principal MC) ──────────────
    const refDestinataire = React.useRef(null);
    const refEquipe       = React.useRef(null);
    const refVenantDe     = React.useRef(null);
    const refPointPhone   = React.useRef(null);
    const refEvenement    = React.useRef(null);
    const refEnregistrer  = React.useRef(null);
    // Focus sur le 1er champ après enregistrement
    const focusDestinataire = () => setTimeout(() => refDestinataire.current?.focus(), 60);
    // ────────────────────────────────────────────────────────────────────
    const [editingEvent, setEditingEvent] = useState(null); // Événement en cours d'édition
    const [editFormData, setEditFormData] = useState({
        secretaire: '',
        messageImportant: false,
        categorie: 'autre',
        fichier: null,
        evenement: '',
        dateRappel: '',
        heureRappel: '',
        expediteur: '',
        destinataire: '',
        pointPhone: '',
        personneConcernee: '',
        equipe: '',
        departDuPC: false,
        lieuDepart: 'souterre',
        sensEntree: null
    });


    // Mettre à jour le champ secrétaire quand currentSecretaire change
    useEffect(() => {
        if (currentSecretaire) {
            setInsertFormData(prev => ({ ...prev, secretaire: currentSecretaire }));
            setFormData(prev => ({ ...prev, secretaire: currentSecretaire }));
        }
    }, [currentSecretaire]);

    // Créer le mapping sauveteur -> équipe
    const sauveteurToTeamMap = useMemo(() => {
        const map = {};
        teams.filter(t => t.status !== 'dissolved').forEach(team => {
            team.members.forEach(memberId => {
                map[memberId] = team.id;
            });
        });
        return map;
    }, [teams]);

    // Rafraîchir l'heure toutes les 30 secondes pour les alertes
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Gérer le drag de la modal d'alertes de manière globale
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDraggingAlert) {
                setAlertModalPosition({
                    x: Math.max(0, Math.min(window.innerWidth - 600, e.clientX - dragStartPos.x)),
                    y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragStartPos.y))
                });
            }
        };

        const handleMouseUp = () => {
            setIsDraggingAlert(false);
        };

        if (isDraggingAlert) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingAlert, dragStartPos]);

// Surveillance des alertes geree dans UnifiedSSFApp

    // Fonction de détection automatique de catégorie
    const detectCategorie = (formDataToCheck) => {
        const texte = (formDataToCheck.evenement || '').toLowerCase();
        
        // 🚑 SECOURS - Mots-clés : victime, civière, fiche bilan, blessé, soins, Bilan
        const motsClesSecours = ['victime', 'civière', 'civiere', 'fiche bilan', 'blessé', 'blesse', 'soins', 'trauma', 'brancardage'];
        if (motsClesSecours.some(mot => texte.includes(mot))) {
            return 'secours';
        }
        
        // 📦 LOGISTIQUE - Mots-clés : matériel, équipement, livraison, stock
        const motsClesLogistique = ['matériel', 'materiel', 'équipement', 'equipement', 'livraison', 'stock', 'commande', 'fourniture'];
        if (motsClesLogistique.some(mot => texte.includes(mot))) {
            return 'logistique';
        }
        
        // 💬 COMMUNICATION - Seulement si "Message à destination de" est renseigné
        if (formDataToCheck.destinataire) {
            return 'communication';
        }
        
        // 📍 PROGRESSION - Si départ PC, point phone, personne, équipe, ou expediteur seul
        if (formDataToCheck.departDuPC || formDataToCheck.expediteur || formDataToCheck.pointPhone || formDataToCheck.personneConcernee || formDataToCheck.equipe) {
            return 'progression';
        }
        
        // 🍽️ INTENDANCE - Mots-clés : repas, manger, pause, hébergement
        const motsClesIntendance = ['repas', 'manger', 'déjeuner', 'dejeuner', 'dîner', 'diner', 'pause', 'hébergement', 'hebergement', 'logement'];
        if (motsClesIntendance.some(mot => texte.includes(mot))) {
            return 'intendance';
        }
        
        // ⚠️ INCIDENT - Mots-clés : problème, danger, alerte OU date de rappel
        const motsClesIncident = ['problème', 'probleme', 'incident', 'danger', 'alerte', 'urgence', 'accident', 'panne'];
        if (motsClesIncident.some(mot => texte.includes(mot)) || formDataToCheck.dateRappel) {
            return 'incident';
        }
        
        // 📋 ADMINISTRATIF - Si pièce jointe
        if (formDataToCheck.fichier) {
            return 'administratif';
        }
        
        // 🧑‍⚕️ PERSONNEL - Mots-clés : arrivée, départ, sauveteur, relève
        const motsClesPersonnel = ['arrivée', 'arrivee', 'départ', 'depart', 'sauveteur', 'relève', 'releve', 'équipier', 'equipier', 'présence', 'presence'];
        if (motsClesPersonnel.some(mot => texte.includes(mot))) {
            return 'personnel';
        }
        
        // 🎯 AUTRE - Par défaut
        return 'autre';
    };

    // Fonction pour obtenir le niveau de priorité d'une catégorie (plus le nombre est petit, plus c'est prioritaire)
    const getPrioriteCategorie = (categorie) => {
        const priorites = {
            'secours': 1,        // TOUJOURS prioritaire
            'logistique': 2,
            'communication': 3,
            'progression': 4,
            'intendance': 5,
            'incident': 6,
            'administratif': 7,
            'personnel': 8,
            'autre': 9
        };
        return priorites[categorie] || 10;
    };

    // Détecter automatiquement la catégorie quand les champs changent
    useEffect(() => {
        const categorieDetectee = detectCategorie(formData);
        const prioriteActuelle = getPrioriteCategorie(formData.categorie);
        const prioriteDetectee = getPrioriteCategorie(categorieDetectee);
        
        // Changer la catégorie si :
        // 1. La catégorie détectée est plus prioritaire (nombre plus petit)
        // 2. OU la catégorie actuelle est "autre" et une catégorie est détectée
        if (prioriteDetectee < prioriteActuelle || (formData.categorie === 'autre' && categorieDetectee !== 'autre')) {
            setFormData(prev => ({...prev, categorie: categorieDetectee}));
            setShowCategorieAlert(false); // Masquer l'alerte si catégorie détectée
        }
    }, [formData.evenement, formData.expediteur, formData.destinataire, formData.pointPhone, 
        formData.personneConcernee, formData.equipe, formData.fichier, formData.dateRappel]);

    // Calculer le statut d'une alerte
    const getAlertStatus = (event) => {
        if (!event.dateRappel || !event.heureRappel) return null;
        if (event.fait) return 'done';

        const rappelDateTime = new Date(event.dateRappel + 'T' + event.heureRappel);
        const diffMs = rappelDateTime - currentTime;
        const diffMinutes = diffMs / (1000 * 60);

        if (diffMinutes < 0) return 'passed'; // Dépassée
        if (diffMinutes <= 10) return 'urgent'; // Moins de 10 minutes
        return 'scheduled'; // Programmée
    };

    // Valider une alerte
    const handleValidateAlert = (event) => {
        const updatedEvents = events.map(e => {
            if (e.id === event.id) {
                return { ...e, fait: true };
            }
            return e;
        });
        setEvents(updatedEvents);

        // Créer un événement de validation
        const validationEvent = {
            id: Date.now(),
            isoTimestamp: new Date().toISOString(),
            secretaire: formData.secretaire || 'Système',
            dateHeure: new Date().toLocaleString('fr-FR'),
            messageImportant: false,
            evenement: `✓ Rappel N°${event.numero} réalisé : ${event.evenement.substring(0, 50)}...`,
            numero: (mcMode === 'secondaire' && mcIdentifiant) ? 
                `${mcIdentifiant}-${nextEventNumber.toString().padStart(3, '0')}` : 
                nextEventNumber.toString().padStart(3, '0'),
            fait: false
        };
        
        setEvents([...updatedEvents, validationEvent]);
        setNextEventNumber(nextEventNumber + 1);
    };

    // Fonction pour ouvrir l'édition d'un événement
    const handleEditEvent = (event) => {
        setEditingEvent(event);
        setEditFormData({
            secretaire: event.secretaire || '',
            messageImportant: event.messageImportant || false,
            categorie: event.categorie || 'autre',
            fichier: event.fichier || null,
            evenement: event.evenement || '',
            dateRappel: event.dateRappel || '',
            heureRappel: event.heureRappel || '',
            expediteur: event.expediteur || '',
            destinataire: event.destinataire || '',
            pointPhone: event.pointPhone || '',
            personneConcernee: event.personneConcernee || '',
            equipe: event.equipe || '',
            departDuPC: event.departDuPC || false,
            lieuDepart: event.lieuDepart || 'souterre',
            sensEntree: event.sensEntree !== undefined ? event.sensEntree : null
        });
    };

    // Fonction pour sauvegarder les modifications
    const handleSaveEdit = () => {
        if (!editFormData.secretaire) {
            alert('Veuillez renseigner le secrétaire');
            return;
        }

        const hasLocationInfo = editFormData.pointPhone || editFormData.personneConcernee || editFormData.equipe;
        if (!editFormData.evenement && !hasLocationInfo) {
            alert('Veuillez renseigner soit un événement, soit au moins une information de localisation');
            return;
        }

        const updatedEvents = events.map(e => {
            if (e.id === editingEvent.id) {
                return {
                    ...e,
                    secretaire: editFormData.secretaire,
                    messageImportant: editFormData.messageImportant,
                    categorie: editFormData.categorie,
                    fichier: editFormData.fichier,
                    evenement: editFormData.evenement,
                    dateRappel: editFormData.dateRappel,
                    heureRappel: editFormData.heureRappel,
                    expediteur: editFormData.expediteur,
                    destinataire: editFormData.destinataire,
                    pointPhone: editFormData.pointPhone,
                    personneConcernee: editFormData.personneConcernee,
                    equipe: editFormData.equipe,
                    departDuPC: editFormData.departDuPC,
                    lieuDepart: editFormData.lieuDepart,
                    sensEntree: editFormData.sensEntree
                };
            }
            return e;
        });

        setEvents(updatedEvents);
        setEditingEvent(null);
        alert('✅ Événement modifié avec succès !');
    };

    // Fonction pour annuler l'édition
    const handleCancelEdit = () => {
        setEditingEvent(null);
        setEditFormData({
            secretaire: '',
            messageImportant: false,
            categorie: 'autre',
            fichier: null,
            evenement: '',
            dateRappel: '',
            heureRappel: '',
            expediteur: '',
            destinataire: '',
            pointPhone: '',
            personneConcernee: '',
            equipe: ''
        });
    };

    // Fonctions de gestion des Points Phone


    // Fonction d'impression de la main courante
    const handlePrintMainCourante = () => {
        // Création d'une nouvelle fenêtre pour l'impression
        const printWindow = window.open('', '_blank');
        
        // Déterminer le titre selon le mode
        const titre = mcMode === 'secondaire' 
            ? `Main Courante Secondaire - ${mcIdentifiant}` 
            : 'Main Courante Principale';
        
        // Statistiques
        const totalEvents = events.length;
        const messagesImportants = events.filter(e => e.messageImportant).length;
        const evenementsFaits = events.filter(e => e.fait).length;
        
        // Construction du HTML pour l'impression
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${titre}</title>
                <style>
                    @media print {
                        @page { margin: 1cm; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        color: #000;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 3px solid #2563eb;
                        padding-bottom: 20px;
                    }
                    .header h1 {
                        margin: 0;
                        color: #2563eb;
                        font-size: 24px;
                    }
                    .header .subtitle {
                        margin-top: 10px;
                        color: #666;
                        font-size: 14px;
                    }
                    .stats {
                        display: flex;
                        justify-content: space-around;
                        margin-bottom: 30px;
                        padding: 15px;
                        background-color: #f3f4f6;
                        border-radius: 8px;
                    }
                    .stats div {
                        text-align: center;
                    }
                    .stats .label {
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 5px;
                    }
                    .stats .value {
                        font-size: 20px;
                        font-weight: bold;
                        color: #2563eb;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th {
                        background-color: #2563eb;
                        color: white;
                        padding: 12px 8px;
                        text-align: left;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    td {
                        padding: 10px 8px;
                        border-bottom: 1px solid #e5e7eb;
                        font-size: 11px;
                        vertical-align: top;
                    }
                    tr:nth-child(even) {
                        background-color: #f9fafb;
                    }
                    .numero {
                        font-weight: bold;
                        color: #2563eb;
                    }
                    .important {
                        background-color: #fef2f2 !important;
                    }
                    .important .numero {
                        color: #dc2626;
                    }
                    .fait {
                        opacity: 0.6;
                    }
                    .badge-important {
                        background-color: #dc2626;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: bold;
                        margin-left: 5px;
                    }
                    .badge-fait {
                        background-color: #059669;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: bold;
                        margin-left: 5px;
                    }
                    .badge-imported {
                        background-color: #7c3aed;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: bold;
                        margin-left: 5px;
                    }
                    .evenement-text {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 2px solid #e5e7eb;
                        text-align: center;
                        font-size: 10px;
                        color: #666;
                    }
                    .no-print {
                        margin: 20px 0;
                        text-align: center;
                    }
                    @media print {
                        .no-print {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 ${titre}</h1>
                    <div class="subtitle">
                        Imprimé le ${new Date().toLocaleString('fr-FR')}
                    </div>
                </div>

                <div class="stats">
                    <div>
                        <div class="label">Total événements</div>
                        <div class="value">${totalEvents}</div>
                    </div>
                    <div>
                        <div class="label">Messages importants</div>
                        <div class="value" style="color: #dc2626;">${messagesImportants}</div>
                    </div>
                    <div>
                        <div class="label">Événements réalisés</div>
                        <div class="value" style="color: #059669;">${evenementsFaits}</div>
                    </div>
                </div>

                <div class="no-print">
                    <button onclick="window.print()" style="background-color: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold;">
                        🖨️ Imprimer
                    </button>
                    <button onclick="window.close()" style="background-color: #6b7280; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold; margin-left: 10px;">
                        Fermer
                    </button>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 6%;">N°</th>
                            <th style="width: 9%;">Secrétaire</th>
                            <th style="width: 11%;">Date/Heure</th>
                            <th style="width: 10%;">Catégorie</th>
                            <th style="width: 38%;">Événement</th>
                            <th style="width: 26%;">Localisation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${events.map(event => {
                            const localisation = [
                                event.pointPhone ? '📍 ' + event.pointPhone : '',
                                event.personneConcernee ? '👤 ' + event.personneConcernee : '',
                                event.equipe ? '👥 ' + event.equipe : ''
                            ].filter(Boolean).join('<br>');
                            const categorie = event.categorie ? event.categorie.charAt(0).toUpperCase() + event.categorie.slice(1) : '-';
                            return `
                            <tr class="${event.messageImportant ? 'important' : ''} ${event.fait ? 'fait' : ''}">
                                <td class="numero">${event.numero || '-'}</td>
                                <td>${event.secretaire || '-'}</td>
                                <td>${event.dateHeure || '-'}</td>
                                <td style="font-size:10px;">${categorie}</td>
                                <td>
                                    <div class="evenement-text">${event.evenement || '-'}</div>
                                    ${event.messageImportant ? '<span class="badge-important">⚠️ IMPORTANT</span>' : ''}
                                    ${event.fait ? '<span class="badge-fait">✓ FAIT</span>' : ''}
                                    ${event.importedFrom ? '<span class="badge-imported">📥 ' + event.importedFrom + '</span>' : ''}
                                </td>
                                <td style="font-size:10px;color:#374151;">${localisation || '-'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Document généré par Application SSF Unifiée V{APP_VERSION}</p>
                    <p>${titre} - ${totalEvents} événement(s)</p>
                </div>
            </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Déclencher l'impression automatiquement après un court délai
        setTimeout(() => {
            printWindow.focus();
        }, 250);
    };

    const handleSubmit = () => {
        // Vérifier le secrétaire (soit dans le champ, soit mémorisé)
        const secretaireValue = formData.secretaire || currentSecretaire;
        if (!secretaireValue) {
            alert('Veuillez renseigner au minimum le secrétaire');
            setShowSecretaireModal(true); // Ouvrir la modal pour définir le secrétaire
            return;
        }
        
        // Si le secrétaire n'était pas dans formData, l'ajouter
        if (!formData.secretaire && currentSecretaire) {
            setFormData(prev => ({ ...prev, secretaire: currentSecretaire }));
        }
        
        // Vérifier qu'il y a soit un événement, soit au moins un des 3 champs de localisation
        const hasLocationInfo = formData.pointPhone || formData.personneConcernee || formData.equipe;
        if (!formData.evenement && !hasLocationInfo) {
            alert('Veuillez renseigner soit un événement, soit au moins une information de localisation (Point Phone, Personne ou Équipe)');
            return;
        }
        // Si catégorie Communication → libellé obligatoire (minimum 1 caractère)
        if (formData.categorie === 'communication' && (!formData.evenement || formData.evenement.trim().length === 0)) {
            alert('Une communication doit avoir un libellé (au moins 1 caractère).');
            return;
        }
        
        let messageComplet = formData.evenement || '';
        // Ajouter mention Départ PC dans le libellé si coché
        if (formData.departDuPC && !messageComplet.toLowerCase().includes('départ')) {
            const lieuDepart = formData.lieuDepart || 'souterre';
            const lieuLabel = lieuDepart === 'souterre' ? 'Sous-terre → Approche'
                            : lieuDepart === 'surface' ? 'Surface → Mission de surface'
                            : 'Hors site → Mission hors site';
            const departMsg = 'Départ du PC - ' + lieuLabel;
            messageComplet = messageComplet ? messageComplet + '\n' + departMsg : departMsg;
        }
        // Ajouter mention sens entrée cavité dans le libellé
        if (formData.pointPhone) {
            const ppId3b = formData.pointPhone.indexOf(' - ') >= 0 ? formData.pointPhone.split(' - ')[0].trim() : formData.pointPhone.trim();
            const ppObj3b = pointsPhone.find(function(pp) { return (typeof pp === 'object' ? pp.lettre : pp) === ppId3b; });
            var nomPP3b = (ppObj3b ? (ppObj3b.nom || '') : formData.pointPhone || '').toLowerCase();
            var isEntreeSortie3b = ppObj3b && (ppObj3b.typePP === 'entree' || ppObj3b.typePP === 'sortie' || ppObj3b.estEntree ||
                nomPP3b.includes('entr') || nomPP3b.includes('sorti') || nomPP3b.includes('cavit'));
            if (isEntreeSortie3b) {
                const sensLabel = formData.sensEntree === true ? 'Entre sous terre'
                                : formData.sensEntree === 'surface' ? 'Sort de sous terre — reste à l\'entrée'
                                : formData.sensEntree === 'retourPC' ? 'Sort de sous terre — rentre au PC'
                                : 'Au point phone';
                if (!messageComplet.toLowerCase().includes(sensLabel.toLowerCase())) {
                    messageComplet = messageComplet ? messageComplet + '\n' + sensLabel : sensLabel;
                }
            }
        }
        if (formData.expediteur || formData.destinataire) {
            const prefix = (formData.expediteur ? 'Message de : ' + formData.expediteur : '') + 
                           (formData.destinataire ? ' pour ' + formData.destinataire : '');
            messageComplet = prefix + (messageComplet ? '\n' + messageComplet : '');
        }

        const newEvent = {
            id: Date.now(),
            isoTimestamp: new Date().toISOString(),
            secretaire: formData.secretaire,
            dateHeure: new Date().toLocaleString('fr-FR'),
            messageImportant: formData.messageImportant,
            categorie: formData.categorie,
            fichier: formData.fichier,
            evenement: messageComplet,
            dateRappel: formData.dateRappel,
            heureRappel: formData.heureRappel,
            pointPhone: formData.pointPhone,
            personneConcernee: formData.personneConcernee,
            equipe: formData.equipe,
            numero: (mcMode === 'secondaire' && mcIdentifiant) ? 
                `${mcIdentifiant}-${nextEventNumber.toString().padStart(3, '0')}` : 
                nextEventNumber.toString().padStart(3, '0'),
            fait: false
        };

        setEvents([...events, newEvent]);
        setNextEventNumber(nextEventNumber + 1);

        // ============================================================
        // MISE À JOUR PLANNING DEPUIS MC
        // ============================================================
        (function() {
            var ppEff = (formData.pointPhone || '').trim() || (formData.departDuPC ? 'PC' : '');
            if (!ppEff || !formData.equipe) return;
            var ppId2 = ppEff.indexOf(' - ') >= 0 ? ppEff.split(' - ')[0].trim() : ppEff;
            var ppObj2 = null;
            for (var pi = 0; pi < pointsPhone.length; pi++) {
                var pp2 = pointsPhone[pi];
                if ((typeof pp2 === 'object' ? pp2.lettre : pp2) === ppId2) { ppObj2 = pp2; break; }
            }
            var texte2 = (formData.evenement || '').toLowerCase();
            var estDepart2 = formData.departDuPC ||
                ['depart','départ','part ','quitte','engagement','deploye','descend'].some(function(m){return texte2.indexOf(m)>=0;});
            var estRetour2 = !estDepart2 &&
                ['retour','revient','arrive','remonte','sorti'].some(function(m){return texte2.indexOf(m)>=0;});
            var numEq = (formData.equipe.match(/(\d+)/) || [])[1] || '';
            var teamTrouve = null;
            // Priorité 1 : correspondance exacte du nom
            teamTrouve = teams.find(t => t.name === formData.equipe || t.id === formData.equipe) || null;
            // Priorité 2 : par ID ou numéro (seulement si pas trouvé exactement)
            if (!teamTrouve) {
                for (var ti = 0; ti < teams.length; ti++) {
                    var t2 = teams[ti];
                    var numT = (t2.name.match(/(\d+)/) || [])[1] || '';
                    if (t2.id === 'T' + numEq || numT === numEq) { teamTrouve = t2; break; }
                }
            }
            // Personne concernée : chercher dans masterSauveteursList
            var personneConcernee2 = (formData.expediteur || formData.personneConcernee || '').trim();
            var sauveteurCible = null;
            if (personneConcernee2) {
                for (var si = 0; si < masterSauveteursList.length; si++) {
                    var sv = masterSauveteursList[si];
                    if (sv.name === personneConcernee2 || sv.name.toLowerCase().includes(personneConcernee2.toLowerCase())) {
                        sauveteurCible = sv; break;
                    }
                }
            }
            var activite2 = null;
            var confirm2 = null;
            if (ppId2 === 'PC') {
                if (estDepart2) {
                var lieuEff = formData.lieuDepart || (teamTrouve && teamTrouve.lieu) || (teamTrouve && teamTrouve.sousTerre ? 'souterre' : 'surface');
                if (lieuEff === 'souterre') activite2 = 'approche';
                else if (lieuEff === 'horssite') activite2 = 'mission_hors_site';
                else activite2 = 'mission_surface';
            }
                else if (estRetour2) activite2 = 'disponible';
            } else if (ppObj2 && (ppObj2.typePP === 'entree' || ppObj2.typePP === 'sortie' || ppObj2.estEntree ||
                ((ppObj2.nom||'').toLowerCase().includes('entr') || (ppObj2.nom||'').toLowerCase().includes('sorti') || (ppObj2.nom||'').toLowerCase().includes('cavit')))) {
                // Entrée/sortie cavité : selon le sens choisi
                if (formData.sensEntree === null) {
                    // "Au point phone" = pas de modification planning
                } else if (formData.sensEntree === true) {
                    activite2 = 'souterre';
                    // Pas de confirmation — le type PP "Entre sous terre" est explicite
                } else if (formData.sensEntree === 'surface') {
                    activite2 = 'mission_surface';
                } else if (formData.sensEntree === 'retourPC') {
                    activite2 = 'approche';
                } else if (formData.sensEntree === false) {
                    activite2 = 'approche';
                }
            } else if (ppObj2 && (ppObj2.typePP === 'souterre' || ppObj2.sousTerre)) {
                activite2 = 'souterre';
                // Automatique — type PP = sous terre, pas besoin de confirmation
            } else if (ppObj2 && (ppObj2.typePP === 'entree' || ppObj2.typePP === 'sortie' || ppObj2.estEntree)) {
                activite2 = 'approche';
            } else if (ppObj2 && ppObj2.typePP === 'surface') {
                activite2 = 'mission_surface';
            } else if (ppObj2 && ppObj2.typePP === 'horssite') {
                activite2 = 'mission_hors_site';
            }
            if (!activite2) {
                // Pas de mise à jour planning, mais si équipe définie → proposer quand même la sélection membres pour le libellé MC
                if (teamTrouve && formData.pointPhone) {
                    var initSelecPP = sauveteurCible ? [sauveteurCible.id] : teamTrouve.members.slice();
                    setMembresSelectionnes(initSelecPP);
                    setModalSelectionMembres({ team: teamTrouve, sauveteurCible: sauveteurCible, activite: null, slotP: slotP, pointPhoneOnly: true, eventId: newEvent.id });
                }
                return;
            }
            // Plus de window.confirm — l'activité est déterminée par le type du point phone
            var nowP2 = new Date();
            var hP = nowP2.getHours() - startHour;
            if (hP < 0) hP += 24;
            var slotP = hP * 4 + Math.floor(nowP2.getMinutes() / 15);
            var totalSlotsP = getTotalSlots(totalDays);
            if (slotP < 0 || slotP >= totalSlotsP) return;
            // Déterminer les IDs à mettre à jour
            var idsAMettreAJour = [];
             var idsAMettreAJour = [];
             if (sauveteurCible || teamTrouve) {
                 // Ouvrir le modal de sélection des membres
                 var initSelec = sauveteurCible ? [sauveteurCible.id] : (teamTrouve ? teamTrouve.members.slice() : []);
                 setMembresSelectionnes(initSelec);
                 setModalSelectionMembres({ team: teamTrouve, sauveteurCible: sauveteurCible, activite: activite2, slotP: slotP });
                 return; // La suite se passe dans le modal
             }
             if (!teamTrouve && !sauveteurCible) return;
             if (idsAMettreAJour.length === 0) return;

             var act2 = activite2;
             setPlanning(function(prev) {
                 var np2 = Object.assign({}, prev);
                 idsAMettreAJour.forEach(function(memberId) {
                     if (!np2[memberId]) return;
                     var row2 = np2[memberId].slice();
                     var lastAct = null;
                     for (var s = slotP - 1; s >= 0; s--) {
                         if (row2[s] && row2[s] !== 'nondef' && row2[s] !== 'effacer') { lastAct = row2[s]; break; }
                     }
                     if (lastAct) {
                         for (var s2 = slotP - 1; s2 >= 0; s2--) {
                             if (!row2[s2] || row2[s2] === 'nondef' || row2[s2] === 'effacer') row2[s2] = lastAct;
                             else break;
                         }
                     }
                     row2[slotP] = act2;
                     np2[memberId] = row2;
                 });
                 return np2;
             });
        })();

        setFormData({
            secretaire: formData.secretaire,
            messageImportant: false,
            categorie: 'autre',
            fichier: null,
            evenement: '',
            dateRappel: '',
            heureRappel: '',
            expediteur: '',
            destinataire: '',
            pointPhone: '',
            personneConcernee: '',
            equipe: '',
            departDuPC: false,
            lieuDepart: 'souterre',
            sensEntree: null
        });
        focusDestinataire();
    };

    const handleInsertEvent = () => {
        // Vérifier le secrétaire (soit dans le champ, soit mémorisé)
        const secretaireValue = insertFormData.secretaire || currentSecretaire;
        if (!secretaireValue) {
            alert('Veuillez renseigner au minimum le secrétaire');
            setShowSecretaireModal(true); // Ouvrir la modal pour définir le secrétaire
            return;
        }
        
        // Si le secrétaire n'était pas dans insertFormData, l'ajouter
        if (!insertFormData.secretaire && currentSecretaire) {
            setInsertFormData(prev => ({ ...prev, secretaire: currentSecretaire }));
        }
        
        // Vérifier qu'il y a soit un événement, soit au moins un des 3 champs de localisation
        const hasLocationInfo = insertFormData.pointPhone || insertFormData.personneConcernee || insertFormData.equipe;
        if (!insertFormData.evenement && !hasLocationInfo) {
            alert('Veuillez renseigner soit un événement, soit au moins une information de localisation (Point Phone, Personne ou Équipe)');
            return;
        }
        
        let messageComplet = insertFormData.evenement || '';
        if (insertFormData.expediteur || insertFormData.destinataire) {
            const prefix = (insertFormData.expediteur ? 'Message de : ' + insertFormData.expediteur : '') + 
                           (insertFormData.destinataire ? ' pour ' + insertFormData.destinataire : '');
            messageComplet = prefix + (messageComplet ? '\n' + messageComplet : '');
        }

        // Trouver l'index de l'événement après lequel on insère
        const insertIndex = events.findIndex(e => e.id === insertAfterEvent.id);
        
        // Générer le nouveau numéro en ajoutant un suffixe (ex: 5a, 5b)
        const baseNumero = insertAfterEvent.numero;
        const existingSuffixes = events
            .filter(e => e.numero.startsWith(baseNumero) && e.numero !== baseNumero)
            .map(e => e.numero.replace(baseNumero, ''))
            .filter(s => s.match(/^[a-z]$/));
        
        let newSuffix = 'a';
        if (existingSuffixes.length > 0) {
            const lastSuffix = existingSuffixes.sort().pop();
            newSuffix = String.fromCharCode(lastSuffix.charCodeAt(0) + 1);
        }
        
        let eventDateHeure = new Date().toLocaleString('fr-FR');
        let eventIsoTimestamp = new Date().toISOString();
        if (insertFormData.heureManuelle) {
            const now = new Date();
            let jour = String(now.getDate()).padStart(2,'0');
            let mois = String(now.getMonth()+1).padStart(2,'0');
            let annee = now.getFullYear();
            if (insertFormData.dateManuelle) {
                // Le type="date" renvoie aaaa-mm-jj (format ISO)
                const parts = insertFormData.dateManuelle.split('-');
                if (parts.length === 3) { annee = parts[0]; mois = parts[1]; jour = parts[2]; }
            }
            const hParts = insertFormData.heureManuelle.split(':');
            const parsed = new Date(annee, parseInt(mois)-1, parseInt(jour), parseInt(hParts[0]), parseInt(hParts[1]));
            if (!isNaN(parsed.getTime())) {
                eventDateHeure = parsed.toLocaleString('fr-FR');
                eventIsoTimestamp = parsed.toISOString();
            }
        } else {
            // Calculer automatiquement le timestamp = milieu entre l'événement précédent et le suivant
            const tsAfter = insertAfterEvent.isoTimestamp
                ? Date.parse(insertAfterEvent.isoTimestamp)
                : (typeof insertAfterEvent.id === 'number' && insertAfterEvent.id > 1e12 ? insertAfterEvent.id : null);
            const nextEvent = insertIndex + 1 < events.length ? events[insertIndex + 1] : null;
            const tsBefore = nextEvent && nextEvent.isoTimestamp
                ? Date.parse(nextEvent.isoTimestamp)
                : (nextEvent && typeof nextEvent.id === 'number' && nextEvent.id > 1e12 ? nextEvent.id : null);
            if (tsAfter && tsBefore && tsBefore > tsAfter) {
                // Milieu exact entre les deux événements adjacents
                const tsMid = Math.round((tsAfter + tsBefore) / 2);
                const midDate = new Date(tsMid);
                eventDateHeure = midDate.toLocaleString('fr-FR');
                eventIsoTimestamp = midDate.toISOString();
            } else if (tsAfter) {
                // Pas d'événement suivant : 1 minute après l'événement précédent
                const tsMid = tsAfter + 60000;
                const midDate = new Date(tsMid);
                eventDateHeure = midDate.toLocaleString('fr-FR');
                eventIsoTimestamp = midDate.toISOString();
            }
        }

        // ── GARDE-FOU : vérifier que l'heure saisie manuellement est cohérente ──
        if (insertFormData.heureManuelle) {
            const tsNew = Date.parse(eventIsoTimestamp);
            const tsAfterCheck = insertAfterEvent.isoTimestamp ? Date.parse(insertAfterEvent.isoTimestamp) : null;
            const nextEventCheck = insertIndex + 1 < events.length ? events[insertIndex + 1] : null;
            const tsBeforeCheck = nextEventCheck && nextEventCheck.isoTimestamp ? Date.parse(nextEventCheck.isoTimestamp) : null;
            const fmtTs = (ts) => new Date(ts).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
            if (tsAfterCheck && tsNew < tsAfterCheck) {
                const confirm = window.confirm(
                    `⚠️ ATTENTION — Heure incohérente !\n\n` +
                    `L'heure saisie (${fmtTs(tsNew)}) est ANTÉRIEURE à l'événement précédent (${fmtTs(tsAfterCheck)}).\n\n` +
                    `Voulez-vous quand même insérer cet événement ?`
                );
                if (!confirm) return;
            } else if (tsBeforeCheck && tsNew > tsBeforeCheck) {
                const confirm = window.confirm(
                    `⚠️ ATTENTION — Heure incohérente !\n\n` +
                    `L'heure saisie (${fmtTs(tsNew)}) est POSTÉRIEURE à l'événement suivant (${fmtTs(tsBeforeCheck)}).\n\n` +
                    `Voulez-vous quand même insérer cet événement ?`
                );
                if (!confirm) return;
            }
        }

        const newEvent = {
            id: Date.now(),
            isoTimestamp: eventIsoTimestamp,
            secretaire: insertFormData.secretaire,
            dateHeure: eventDateHeure,
            messageImportant: insertFormData.messageImportant,
            categorie: insertFormData.categorie,
            fichier: insertFormData.fichier,
            evenement: messageComplet,
            dateRappel: insertFormData.dateRappel,
            heureRappel: insertFormData.heureRappel,
            pointPhone: insertFormData.pointPhone,
            personneConcernee: insertFormData.personneConcernee,
            equipe: insertFormData.equipe,
            numero: (mcMode === 'secondaire' && mcIdentifiant) ? 
                            `${mcIdentifiant}-${baseNumero}${newSuffix}` : 
                            `${baseNumero}${newSuffix}`,
            fait: false
        };

        // Insérer l'événement après l'événement sélectionné
        const newEvents = [...events];
        newEvents.splice(insertIndex + 1, 0, newEvent);
        setEvents(newEvents);
        
        // Réinitialiser le formulaire et fermer la modal
        setInsertFormData({
            secretaire: insertFormData.secretaire,
            messageImportant: false,
            evenement: '',
            dateRappel: '',
            heureRappel: '',
            expediteur: '',
            destinataire: '',
            pointPhone: '',
            personneConcernee: '',
            equipe: '',
            dateManuelle: '',
            heureManuelle: ''
        });
        setInsertAfterEvent(null);
    };

    const openInsertModal = (event) => {
        // Pré-remplir le formulaire d'insertion avec le secrétaire actuel
        setInsertFormData({
            secretaire: formData.secretaire || insertFormData.secretaire,
            messageImportant: false,
            evenement: '',
            dateRappel: '',
            heureRappel: '',
            expediteur: '',
            destinataire: '',
            pointPhone: '',
            personneConcernee: '',
            equipe: ''
        });
        setInsertAfterEvent(event);
    };

    return (
        <div>
            {/* Modal d'insertion d'événement */}
            {insertAfterEvent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">➕ Insérer un événement après N°{insertAfterEvent.numero}</h2>
                                <button onClick={() => setInsertAfterEvent(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg mb-4">
                                <p className="text-sm text-gray-700">
                                    <strong>Événement N°{insertAfterEvent.numero}:</strong> {insertAfterEvent.evenement.substring(0, 100)}...
                                </p>
                                {(() => {
                                    const insertIdx = events.findIndex(e => e.id === insertAfterEvent.id);
                                    const tsAfter = insertAfterEvent.isoTimestamp ? Date.parse(insertAfterEvent.isoTimestamp) : null;
                                    const nextEv = insertIdx + 1 < events.length ? events[insertIdx + 1] : null;
                                    const tsBefore = nextEv && nextEv.isoTimestamp ? Date.parse(nextEv.isoTimestamp) : null;
                                    let tsMid = null;
                                    if (tsAfter && tsBefore && tsBefore > tsAfter) tsMid = Math.round((tsAfter + tsBefore) / 2);
                                    else if (tsAfter) tsMid = tsAfter + 60000;
                                    if (!insertFormData.heureManuelle && tsMid) {
                                        return (
                                            <p className="text-xs text-blue-700 mt-2 font-semibold">
                                                🕐 Heure attribuée automatiquement : <strong>{new Date(tsMid).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</strong>
                                                {nextEv ? ` (milieu entre ${insertAfterEvent.dateHeure.split(' ')[1]||''} et ${nextEv.dateHeure.split(' ')[1]||''})` : ' (1 min après l\'événement précédent)'}
                                                <span className="ml-2 text-blue-500 italic">— ou saisissez une heure manuelle ci-dessous</span>
                                            </p>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-semibold">Secrétaire</label>
                                            <button
                                                onClick={() => setShowSecretaireModal(true)}
                                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                                                title={currentSecretaire ? "Changer de secrétaire" : "Définir le secrétaire"}
                                            >
                                                🔄 {currentSecretaire ? 'Changer' : 'Définir'}
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={insertFormData.secretaire}
                                            onChange={(e) => setInsertFormData({...insertFormData, secretaire: e.target.value})}
                                            placeholder={currentSecretaire || "Entrez votre nom"}
                                            className="w-full px-4 py-2 border rounded-lg"
                                        />
                                        {currentSecretaire && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Secrétaire actuel : {currentSecretaire}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                checked={insertFormData.messageImportant} 
                                                onChange={(e) => setInsertFormData({...insertFormData, messageImportant: e.target.checked})} 
                                                className="w-5 h-5" 
                                            />
                                            <span className="font-semibold">Message Important</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-2">
                                    <div className="col-span-3">
                                        <label className="block text-xs font-semibold mb-1">Message à destination de :</label>
                                        <input 
                                            list="insert-destinataires-list"
                                            value={insertFormData.destinataire} 
                                            onChange={(e) => setInsertFormData({...insertFormData, destinataire: e.target.value})} 
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="Nom..."
                                        />
                                        <datalist id="insert-destinataires-list">
                                            <option value="PC" />
                                            <option value="PCA" />
                                            {[...sauveteursSurSiteNoms].sort((a, b) => a.localeCompare(b)).map((a, i) => <option key={i} value={a} />)}
                                        </datalist>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold mb-1">👔 Équipe</label>
                                        <input 
                                            list="equipe-list-insert"
                                            value={insertFormData.equipe} 
                                            onChange={(e) => setInsertFormData({...insertFormData, equipe: e.target.value})} 
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="T1..."
                                        />
                                        <datalist id="equipe-list-insert">
                                            {teams.filter(t => t.status !== 'dissolved').map((team, i) => {
                                                const lastPP = events.filter(e => e.equipe === team.name && e.pointPhone).sort((a,b) => new Date(b.isoTimestamp||0)-new Date(a.isoTimestamp||0))[0];
                                                const ppLabel = lastPP ? ` | 📍${(typeof lastPP.pointPhone === 'object' ? lastPP.pointPhone.lettre : (lastPP.pointPhone||'').split(' - ')[0].trim())}` : '';
                                                const mission2 = team.mission ? (team.mission.length > 30 ? team.mission.substring(0,30)+'...' : team.mission) : '';
                                                return <option key={i} value={team.name} label={team.name + (mission2 ? ' : '+mission2 : '') + ppLabel} />;
                                            })}
                                        </datalist>
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block text-xs font-semibold mb-1">Message venant de :</label>
                                        <input 
                                            list="insert-expediteurs-list"
                                            value={insertFormData.expediteur} 
                                            onChange={(e) => {
                                                const nom = e.target.value;
                                                setInsertFormData({...insertFormData, expediteur: nom});
                                                
                                                // Auto-remplir l'équipe si pas déjà renseignée
                                                if (!insertFormData.equipe) {
                                                    const sauv = masterSauveteursList.find(s => s.name === nom);
                                                    if (sauv) {
                                                        const teamId = sauveteurToTeamMap[sauv.id];
                                                        if (teamId) {
                                                            const team = teams.find(t => t.id === teamId);
                                                            if (team) {
                                                                setInsertFormData({...insertFormData, expediteur: nom, equipe: team.name});
                                                            }
                                                        }
                                                    }
                                                }
                                            }}
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="Nom..."
                                        />
                                        <datalist id="insert-expediteurs-list">
                                            {(() => {
                                                // Si une équipe est sélectionnée, filtrer les noms par équipe
                                                if (insertFormData.equipe) {
                                                    const selectedTeam = teams.find(t => t.name === insertFormData.equipe);
                                                    if (selectedTeam) {
                                                        const teamMemberNames = sauveteursSurSite
                                                            .filter(s => selectedTeam.members.includes(s.id))
                                                            .map(s => s.nom)
                                                            .sort((a, b) => a.localeCompare(b));
                                                        return teamMemberNames.map((a, i) => <option key={i} value={a} />);
                                                    }
                                                }
                                                // Sinon, afficher tous les noms
                                                return [...sauveteursSurSiteNoms].sort((a, b) => a.localeCompare(b)).map((a, i) => <option key={i} value={a} />);
                                            })()}
                                        </datalist>
                                    </div>
                                    <div className="col-span-4">
                                        <label className="block text-xs font-semibold mb-1">📍 Point Phone</label>
                                        <input 
                                            list="pointsphone-list-insert"
                                            value={insertFormData.pointPhone} 
                                            onChange={(e) => setInsertFormData({...insertFormData, pointPhone: e.target.value})} 
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="A, B..."
                                        />
                                        <datalist id="pointsphone-list-insert">
                                            {[...pointsPhone].sort((a, b) => { const oa = typeof a === 'object' && a.ordre !== undefined ? parseFloat(a.ordre) : 999; const ob = typeof b === 'object' && b.ordre !== undefined ? parseFloat(b.ordre) : 999; return oa - ob; }).map((pp, i) => { const value = typeof pp === 'object' ? `${pp.lettre} - ${pp.nom}` : pp; return <option key={i} value={value} /> })}
                                        </datalist>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2">Événement</label>
                                    <textarea 
                                        value={insertFormData.evenement} 
                                        onChange={(e) => setInsertFormData({...insertFormData, evenement: e.target.value})} 
                                        className="w-full px-4 py-2 border rounded-lg"
                                        rows="4" 
                                        placeholder="Description..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Date du rappel</label>
                                        <input 
                                            type="date" 
                                            value={insertFormData.dateRappel} 
                                            onChange={(e) => setInsertFormData({...insertFormData, dateRappel: e.target.value})} 
                                            className="w-full px-4 py-2 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Heure du rappel</label>
                                        <input 
                                            type="time" 
                                            value={insertFormData.heureRappel} 
                                            onChange={(e) => setInsertFormData({...insertFormData, heureRappel: e.target.value})} 
                                            className="w-full px-4 py-2 border rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* Date/heure manuelle */}
                                <div style={{background:'#fffbeb',border:'1px solid #f59e0b',borderRadius:'6px',padding:'10px 14px',marginBottom:'8px'}}>
                                    <p style={{fontSize:'12px',fontWeight:'700',color:'#92400e',marginBottom:'6px'}}>⏰ Horodatage manuel (optionnel)</p>
                                    <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                                        <div>
                                            <label style={{fontSize:'11px',fontWeight:'600',color:'#78350f'}}>Date</label>
                                            <input type="date" value={insertFormData.dateManuelle||''}
                                                onChange={(e)=>setInsertFormData({...insertFormData,dateManuelle:e.target.value})}
                                                style={{display:'block',padding:'3px 6px',border:'1px solid #d97706',borderRadius:'4px',fontSize:'12px'}}
                                            />
                                        </div>
                                        <div>
                                            <label style={{fontSize:'11px',fontWeight:'600',color:'#78350f'}}>Heure</label>
                                            <input type="time" value={insertFormData.heureManuelle||''}
                                                onChange={(e)=>setInsertFormData({...insertFormData,heureManuelle:e.target.value})}
                                                style={{display:'block',padding:'3px 6px',border:'1px solid #d97706',borderRadius:'4px',fontSize:'12px'}}
                                            />
                                        </div>
                                        {insertBornes.min && <span style={{fontSize:'11px',color:'#6b7280'}}>Après : {insertBornes.min}</span>}
                                        {insertBornes.max && <span style={{fontSize:'11px',color:'#6b7280'}}>Avant : {insertBornes.max}</span>}
                                    </div>
                                    {/* Indicateur visuel en temps réel */}
                                    {insertFormData.heureManuelle && (() => {
                                        const insertIdx2 = events.findIndex(e => e.id === insertAfterEvent.id);
                                        const tsAfterV = insertAfterEvent.isoTimestamp ? Date.parse(insertAfterEvent.isoTimestamp) : null;
                                        const nextEvV = insertIdx2 + 1 < events.length ? events[insertIdx2 + 1] : null;
                                        const tsBeforeV = nextEvV && nextEvV.isoTimestamp ? Date.parse(nextEvV.isoTimestamp) : null;
                                        // Reconstruire le timestamp depuis les champs du formulaire
                                        const now2 = new Date();
                                        let j2 = String(now2.getDate()).padStart(2,'0'), m2 = String(now2.getMonth()+1).padStart(2,'0'), a2 = now2.getFullYear();
                                        if (insertFormData.dateManuelle) {
                                            const p2 = insertFormData.dateManuelle.split('-');
                                            if (p2.length === 3) { a2 = p2[0]; m2 = p2[1]; j2 = p2[2]; }
                                        }
                                        const hP2 = insertFormData.heureManuelle.split(':');
                                        const parsedV = new Date(a2, parseInt(m2)-1, parseInt(j2), parseInt(hP2[0]), parseInt(hP2[1]));
                                        if (isNaN(parsedV.getTime())) return null;
                                        const tsV = parsedV.getTime();
                                        const fmt2 = (ts) => new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
                                        if (tsAfterV && tsV < tsAfterV) return (
                                            <div style={{marginTop:'6px',padding:'5px 8px',borderRadius:'4px',background:'#fee2e2',border:'1px solid #f87171',fontSize:'11px',fontWeight:'700',color:'#b91c1c'}}>
                                                ⛔ Heure trop ancienne — antérieure à l'événement précédent ({fmt2(tsAfterV)})
                                            </div>
                                        );
                                        if (tsBeforeV && tsV > tsBeforeV) return (
                                            <div style={{marginTop:'6px',padding:'5px 8px',borderRadius:'4px',background:'#fee2e2',border:'1px solid #f87171',fontSize:'11px',fontWeight:'700',color:'#b91c1c'}}>
                                                ⛔ Heure trop récente — postérieure à l'événement suivant ({fmt2(tsBeforeV)})
                                            </div>
                                        );
                                        return (
                                            <div style={{marginTop:'6px',padding:'5px 8px',borderRadius:'4px',background:'#d1fae5',border:'1px solid #6ee7b7',fontSize:'11px',fontWeight:'700',color:'#065f46'}}>
                                                ✅ Heure valide — dans l'intervalle correct
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="flex gap-4 justify-end mt-6">
                                    <button 
                                        onClick={() => setInsertAfterEvent(null)}
                                        className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 font-semibold"
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        onClick={handleInsertEvent}
                                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold"
                                    >
                                        ➕ Insérer l'événement
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4 mb-6">
                <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-2">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold">Secrétaire</label>
                            <button
                                onClick={() => setShowSecretaireModal(true)}
                                className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-200"
                                title={currentSecretaire ? "Changer de secrétaire" : "Définir le secrétaire"}
                            >
                                🔄
                            </button>
                        </div>
                        <input
                            type="text"
                            value={formData.secretaire}
                            onChange={(e) => setFormData({...formData, secretaire: e.target.value})}
                            placeholder={currentSecretaire || "Votre nom"}
                            className="w-full px-2 py-2 border rounded text-sm bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>
                    <div className="col-span-1 flex items-end pb-1">
                        <label className="flex items-center gap-1">
                            <input 
                                type="checkbox" 
                                checked={formData.messageImportant} 
                                onChange={(e) => setFormData({...formData, messageImportant: e.target.checked})} 
                                className="w-4 h-4" 
                            />
                            <span className="font-semibold text-xs whitespace-nowrap">⚠️ Important</span>
                        </label>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold mb-1">📅 Date rappel</label>
                        <input 
                            type="date" 
                            value={formData.dateRappel} 
                            onChange={(e) => setFormData({...formData, dateRappel: e.target.value})} 
                            className="w-full px-2 py-1.5 border rounded text-sm bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold mb-1">⏰ Heure rappel</label>
                        <input 
                            type="time" 
                            value={formData.heureRappel} 
                            onChange={(e) => setFormData({...formData, heureRappel: e.target.value})} 
                            className="w-full px-2 py-1.5 border rounded text-sm bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>
                    <div className="col-span-5">
                        <label className="block text-xs font-semibold mb-1">📎 Pièce jointe</label>
                        <input 
                            type="file" 
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    if (file.size > 10 * 1024 * 1024) {
                                        alert('⚠️ Fichier trop volumineux (max 10 MB)');
                                        e.target.value = '';
                                        return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        setFormData({
                                            ...formData, 
                                            fichier: {
                                                nom: file.name,
                                                type: file.type,
                                                taille: file.size,
                                                data: event.target.result
                                            }
                                        });
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }}
                            className="w-full text-xs py-1.5 px-2 border rounded"
                        />
                        {formData.fichier && (
                            <div className="text-xs mt-1 flex items-center gap-1">
                                <span className="text-green-600">✓ {formData.fichier.nom.substring(0, 15)}{formData.fichier.nom.length > 15 ? '...' : ''}</span>
                                <button 
                                    onClick={() => setFormData({...formData, fichier: null})}
                                    className="text-red-600 hover:text-red-800 font-bold"
                                >×</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold mb-1">Message à destination de :</label>
                        <input
                            ref={refDestinataire}
                            list="destinataires-list"
                            value={formData.destinataire}
                            onChange={(e) => {
                                const dest = e.target.value;
                                const newCategorie = dest ? 'communication' : 'progression';
                                setFormData({...formData, destinataire: dest, categorie: newCategorie});
                            }}
                            onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); refEquipe.current?.focus(); } }}
                            className="w-full px-2 py-2 border rounded text-sm bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                            placeholder="Nom..."
                        />
                        <datalist id="destinataires-list">
                            <option value="PC" />
                            <option value="PCA" />
                            {[...sauveteursSurSiteNoms].sort((a, b) => a.localeCompare(b)).map((a, i) => <option key={i} value={a} />)}
                        </datalist>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold mb-1">👔 Équipe</label>
                        <input
                            ref={refEquipe}
                            list="equipe-list"
                            value={formData.equipe}
                            onChange={(e) => setFormData({...formData, equipe: e.target.value})}
                            onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); refVenantDe.current?.focus(); } }}
                            className="w-full px-2 py-2 border rounded text-sm bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                            placeholder="T1..."
                        />
                        <datalist id="equipe-list">
                             {teams.filter(function(t){ return t.status !== 'dissolved'; }).map(function(team, idx2) {
                                 var mission2 = team.mission ? (team.mission.length > 30 ? team.mission.substring(0,30)+'...' : team.mission) : '';
                                 // Dernier point phone connu
                                 var lastPP = events.filter(function(e){ return e.equipe === team.name && e.pointPhone; }).sort(function(a,b){ return new Date(b.isoTimestamp||0)-new Date(a.isoTimestamp||0); })[0];
                                 var ppLabel = lastPP ? (' | 📍' + (typeof lastPP.pointPhone === 'object' ? lastPP.pointPhone.lettre : (lastPP.pointPhone||'').split(' - ')[0].trim())) : '';
                                 var label2 = team.name + (mission2 ? ' : ' + mission2 : '') + ppLabel;
                                 return <option key={idx2} value={team.name} label={label2} />;
                             })}
                        </datalist>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold mb-1">Message venant de :</label>
                        <input 
                            list="expediteurs-list"
                            value={formData.expediteur} 
                             onChange={(e) => {
                                const nom = e.target.value;
                                // Auto-remplir l'équipe si pas déjà renseignée
                                let newEquipe = formData.equipe;
                                if (!formData.equipe) {
                                    const sauv = masterSauveteursList.find(s => s.name === nom);
                                    if (sauv) {
                                        const teamId = sauveteurToTeamMap[sauv.id];
                                        if (teamId) {
                                            const team = teams.find(t => t.id === teamId);
                                            if (team) newEquipe = team.name;
                                        }
                                    }
                                }
                                setFormData({...formData, expediteur: nom, equipe: newEquipe});
                            }}
                            ref={refVenantDe}
                            onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); refPointPhone.current?.focus(); } }}
                            className="w-full px-2 py-2 border rounded text-sm bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                            placeholder="Nom..."
                        />
                        <datalist id="expediteurs-list">
                            {(() => {
                                // Si une équipe est sélectionnée, filtrer les noms par équipe
                                if (formData.equipe) {
                                    const selectedTeam = teams.find(t => t.name === formData.equipe);
                                    if (selectedTeam) {
                                        const teamMemberNames = sauveteursSurSite
                                            .filter(s => selectedTeam.members.includes(s.id))
                                            .map(s => s.nom)
                                            .sort((a, b) => a.localeCompare(b));
                                        return teamMemberNames.map((a, i) => <option key={i} value={a} />);
                                    }
                                }
                                // Sinon, afficher tous les noms
                                return [...sauveteursSurSiteNoms].sort((a, b) => a.localeCompare(b)).map((a, i) => <option key={i} value={a} />);
                            })()}
                        </datalist>
                    </div>
                    <div className="col-span-2 flex items-end pb-1">
                        <label style={{cursor:"pointer",padding:"4px 8px",borderRadius:"4px",fontSize:"12px",fontWeight:"600",border:"1px solid",backgroundColor:formData.departDuPC?"#16a34a":"#fff",color:formData.departDuPC?"#fff":"#4b5563",borderColor:formData.departDuPC?"#16a34a":"#d1d5db",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"4px"}}><input type="checkbox" checked={formData.departDuPC} onChange={(e) => {
                                const checked = e.target.checked;
                                const pcPP = pointsPhone.find(function(pp){ return (typeof pp === 'object' ? pp.lettre : pp) === 'PC'; });
                                const pcLabel = pcPP ? 'PC - ' + pcPP.nom : 'PC - Poste de Commandement';
                                setFormData(Object.assign({}, formData, {
                                    departDuPC: checked,
                                    pointPhone: checked ? pcLabel : (formData.pointPhone === pcLabel ? '' : formData.pointPhone),
                                    destinataire: checked ? '' : formData.destinataire,
                                    categorie: checked ? 'progression' : (formData.destinataire ? 'communication' : 'progression')
                                }));
                            }} style={{display:"none"}} />🚀 Départ PC</label>
                        {formData.departDuPC && (
                            <div style={{display:'flex',gap:'4px',marginLeft:'4px'}}>
                                {[
                                    {val:'souterre', label:'🪨', title:'Sous terre → Approche'},
                                    {val:'surface', label:'🌿', title:'Surface → Mission surface'},
                                    {val:'horssite', label:'🚗', title:'Hors site → Mission hors site'}
                                ].map(function(opt) {
                                    return (
                                        <label key={opt.val} title={opt.title} style={{cursor:'pointer',padding:'2px 5px',borderRadius:'3px',fontSize:'11px',fontWeight:'700',border:'1px solid',backgroundColor:(formData.lieuDepart||'souterre')===opt.val?'#15803d':'#fff',color:(formData.lieuDepart||'souterre')===opt.val?'#fff':'#4b5563',borderColor:(formData.lieuDepart||'souterre')===opt.val?'#15803d':'#d1d5db'}}>
                                            <input type="radio" name="lieu-depart" checked={(formData.lieuDepart||'souterre')===opt.val} onChange={function(){setFormData(Object.assign({},formData,{lieuDepart:opt.val}));}} style={{display:'none'}} />
                                            {opt.label}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="col-span-4">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold">📍 Point Phone</label>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGestionPointsPhone(true); }}
                                className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-200"
                                title="Gérer les points phone"
                            >
                                ⚙️
                            </button>
                        </div>
                        <input 
                            list="pointsphone-list"
                            value={formData.pointPhone} 
                            onChange={(e) => setFormData({...formData, pointPhone: e.target.value})} 
                            ref={refPointPhone}
                            onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); refEvenement.current?.focus(); } }}
                            className="w-full px-2 py-2 border rounded text-sm bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                            placeholder="A, B..."
                        />
                        <datalist id="pointsphone-list">
                            {[...pointsPhone].sort((a, b) => { const oa = typeof a === 'object' && a.ordre !== undefined ? parseFloat(a.ordre) : 999; const ob = typeof b === 'object' && b.ordre !== undefined ? parseFloat(b.ordre) : 999; return oa - ob; }).map((pp, i) => { const value = typeof pp === 'object' ? `${pp.lettre} - ${pp.nom}` : pp; return <option key={i} value={value} /> })}
                        </datalist>
                        {/* Boutons radio Entre/Sort si PP est entrée/sortie cavité */}
                        {(() => {
                            if (!formData.pointPhone) return null;
                            const ppId3 = formData.pointPhone.indexOf(' - ') >= 0 ? formData.pointPhone.split(' - ')[0].trim() : formData.pointPhone.trim();
                            const ppObj3 = pointsPhone.find(function(pp) { return (typeof pp === 'object' ? pp.lettre : pp) === ppId3; });
                            // Détecter entrée/sortie par typePP OU par le nom du point phone
                            var nomPP3 = (ppObj3 ? (ppObj3.nom || '') : formData.pointPhone || '').toLowerCase();
                            var isEntreeSortie = ppObj3 && (ppObj3.typePP === 'entree' || ppObj3.typePP === 'sortie' || ppObj3.estEntree ||
                                nomPP3.includes('entr') || nomPP3.includes('sorti') || nomPP3.includes('cavit'));
                            if (!isEntreeSortie) return null;
                            return (
                                 <div className="flex gap-1 mt-1 flex-wrap">
                                     <label style={{cursor:'pointer',padding:'4px 8px',borderRadius:'5px',fontSize:'11px',fontWeight:'700',border:'1px solid',backgroundColor:formData.sensEntree===null?'#6b7280':'#fff',color:formData.sensEntree===null?'#fff':'#4b5563',borderColor:formData.sensEntree===null?'#6b7280':'#d1d5db'}} title="Passage au point phone — aucune modification du planning">
                                         <input type="radio" checked={formData.sensEntree===null} onChange={function(){setFormData(Object.assign({},formData,{sensEntree:null}));}} style={{display:'none'}} />
                                         📍 Au point phone
                                     </label>
                                     <label style={{cursor:'pointer',padding:'4px 8px',borderRadius:'5px',fontSize:'11px',fontWeight:'700',border:'1px solid',backgroundColor:formData.sensEntree===true?'#8b4513':'#fff',color:formData.sensEntree===true?'#fff':'#4b5563',borderColor:formData.sensEntree===true?'#8b4513':'#d1d5db'}} title="Planning → Sous terre">
                                         <input type="radio" checked={formData.sensEntree===true} onChange={function(){setFormData(Object.assign({},formData,{sensEntree:true}));}} style={{display:'none'}} />
                                         🪨 Entre sous terre
                                     </label>
                                     <label style={{cursor:'pointer',padding:'4px 8px',borderRadius:'5px',fontSize:'11px',fontWeight:'700',border:'1px solid',backgroundColor:formData.sensEntree==='surface'?'#15803d':'#fff',color:formData.sensEntree==='surface'?'#fff':'#4b5563',borderColor:formData.sensEntree==='surface'?'#15803d':'#d1d5db'}} title="Sort mais reste à l'entrée cavité — Planning → Surface">
                                         <input type="radio" checked={formData.sensEntree==='surface'} onChange={function(){setFormData(Object.assign({},formData,{sensEntree:'surface'}));}} style={{display:'none'}} />
                                         🌿 Sort — reste entrée
                                     </label>
                                     <label style={{cursor:'pointer',padding:'4px 8px',borderRadius:'5px',fontSize:'11px',fontWeight:'700',border:'1px solid',backgroundColor:formData.sensEntree==='retourPC'?'#0369a1':'#fff',color:formData.sensEntree==='retourPC'?'#fff':'#4b5563',borderColor:formData.sensEntree==='retourPC'?'#0369a1':'#d1d5db'}} title="Sort et remonte vers le PC — Planning → Approche">
                                         <input type="radio" checked={formData.sensEntree==='retourPC'} onChange={function(){setFormData(Object.assign({},formData,{sensEntree:'retourPC'}));}} style={{display:'none'}} />
                                         🏠 Sort — rentre au PC
                                     </label>
                                 </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Modal sélection membres pour mise à jour planning */}
    {modalSelectionMembres && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'#fff',borderRadius:'10px',padding:'24px',minWidth:'320px',maxWidth:'480px',width:'90%',boxShadow:'0 10px 40px rgba(0,0,0,0.3)'}}>
                <h3 style={{fontWeight:'700',fontSize:'16px',marginBottom:'8px'}}>
                    {modalSelectionMembres.pointPhoneOnly
                        ? `📍 Qui est au point phone ? (${modalSelectionMembres.team?.name || ''})`
                        : `Mise à jour planning — ${modalSelectionMembres.activite}`}
                </h3>
                <p style={{fontSize:'12px',color:'#6b7280',marginBottom:'12px'}}>
                    Sélectionnez les membres à mettre à jour :
                </p>
                {/* Case "Toute l'équipe" */}
                {modalSelectionMembres.team && (
                    <label style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 8px',borderRadius:'6px',background:'#eff6ff',marginBottom:'8px',cursor:'pointer',fontWeight:'700',fontSize:'13px'}}>
                        <input type="checkbox"
                            checked={membresSelectionnes.length === modalSelectionMembres.team.members.length}
                            onChange={function(e) {
                                setMembresSelectionnes(e.target.checked ? modalSelectionMembres.team.members.slice() : []);
                            }}
                            style={{width:'16px',height:'16px'}}
                        />
                        Toute l'équipe ({modalSelectionMembres.team.name})
                    </label>
                )}
                {/* Liste des membres */}
                <div style={{maxHeight:'240px',overflowY:'auto',marginBottom:'12px'}}>
                    {(modalSelectionMembres.team ? modalSelectionMembres.team.members : (modalSelectionMembres.sauveteurCible ? [modalSelectionMembres.sauveteurCible.id] : [])).map(function(memberId) {
                        var sv = masterSauveteursList.find(function(s){ return s.id === memberId; });
                        if (!sv) return null;
                        var checked = membresSelectionnes.indexOf(memberId) >= 0;
                        return (
                            <label key={memberId} style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 8px',borderRadius:'4px',cursor:'pointer',background:checked?'#f0fdf4':'transparent',marginBottom:'2px'}}>
                                <input type="checkbox"
                                    checked={checked}
                                    onChange={function() {
                                        setMembresSelectionnes(function(prev) {
                                            return checked ? prev.filter(function(id){ return id !== memberId; }) : [...prev, memberId];
                                        });
                                    }}
                                    style={{width:'15px',height:'15px'}}
                                />
                                <span style={{fontSize:'13px',fontWeight:checked?'600':'400'}}>{sv.name}</span>
                            </label>
                        );
                    })}
                </div>
                {/* Boutons */}
                <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                    <button onClick={function(){ setModalSelectionMembres(null); setMembresSelectionnes([]); }}
                        style={{padding:'7px 16px',borderRadius:'6px',border:'1px solid #d1d5db',background:'#fff',cursor:'pointer',fontSize:'13px'}}>
                        Annuler
                    </button>
                    <button onClick={function(){
                        if (membresSelectionnes.length === 0) { alert('Sélectionnez au moins un membre'); return; }
                        var modal = modalSelectionMembres;
                        var ids = membresSelectionnes.slice();
                        var act = modal.activite;
                        var slot = modal.slotP;
                        // Noms des membres sélectionnés pour le libellé
                        var nomsSelec = ids.map(function(id){
                            var sv2 = masterSauveteursList.find(function(s){ return s.id === id; });
                            return sv2 ? sv2.name : id;
                        }).join(', ');
                        // Détecter si toute l'équipe est sélectionnée
                        var touteEquipe = modal.team && ids.length === modal.team.members.length;
                        var mentionEquipe = touteEquipe
                            ? 'Toute l\'équipe (' + modal.team.name + ')'
                            : nomsSelec;

                        // Cas point phone only : mettre à jour le libellé de l'événement MC existant
                        if (modal.pointPhoneOnly && modal.eventId) {
                            setEvents(function(prev) {
                                return prev.map(function(ev) {
                                    if (ev.id !== modal.eventId) return ev;
                                    // Ajouter la mention des membres présents au point phone
                                    var suffix = '\nPrésents au point phone : ' + mentionEquipe;
                                    return {...ev, evenement: ev.evenement + suffix};
                                });
                            });
                            setModalSelectionMembres(null);
                            setMembresSelectionnes([]);
                            return;
                        }
                        // Créer l'événement MC
                        var ACTIVITES_PLANNING = [
                            { id: 'souterre', name: 'Sous Terre' }, { id: 'approche', name: 'Approche' },
                            { id: 'mission_surface', name: 'Mission de surface' }, { id: 'mission_hors_site', name: 'Mission hors site' },
                            { id: 'disponible', name: 'Disponible' }, { id: 'engage', name: 'Engagé' },
                            { id: 'repos_site', name: 'Repos sur site' }, { id: 'repos_domicile', name: 'Repos au domicile' },
                            { id: 'repas_dejeuner', name: 'Repas / Déjeuner' }, { id: 'quitter_secours', name: 'Quitter le secours' },
                            { id: 'gestion_pc', name: 'Gestion PC' }, { id: 'brancardage', name: 'Brancardage' },
                            { id: 'plongee', name: 'Plongée' }
                        ];
                        var actLabel = (ACTIVITES_PLANNING.find(function(a){ return a.id === act; }) || {name: act}).name;
                        var mcNum = (mcMode === 'secondaire' && mcIdentifiant)
                            ? mcIdentifiant + '-' + nextEventNumber.toString().padStart(3,'0')
                            : nextEventNumber.toString().padStart(3,'0');
                        var newMcEvent = {
                            id: Date.now(),
                            isoTimestamp: new Date().toISOString(),
                            secretaire: 'Système',
                            dateHeure: new Date().toLocaleString('fr-FR'),
                            messageImportant: false,
                            categorie: 'planning',
                            evenement: '📋 Planning — Activité "' + actLabel + '" affectée à : ' + mentionEquipe,
                            numero: mcNum,
                            equipe: modal.team ? modal.team.name : '',
                            fait: false
                        };
                        setEvents(function(prev){ return [...prev, newMcEvent]; });
                        setNextEventNumber(function(n){ return n + 1; });
                        // Mettre à jour le planning
                        setPlanning(function(prev) {
                            var np = Object.assign({}, prev);
                            ids.forEach(function(memberId) {
                                if (!np[memberId]) return;
                                var row = np[memberId].slice();
                                var lastAct = null;
                                for (var s = slot - 1; s >= 0; s--) {
                                    if (row[s] && row[s] !== 'nondef' && row[s] !== 'effacer') { lastAct = row[s]; break; }
                                }
                                if (lastAct) {
                                    for (var s2 = slot - 1; s2 >= 0; s2--) {
                                        if (!row[s2] || row[s2] === 'nondef' || row[s2] === 'effacer') row[s2] = lastAct;
                                        else break;
                                    }
                                }
                                row[slot] = act;
                                np[memberId] = row;
                            });
                            return np;
                        });
                        setModalSelectionMembres(null);
                        setMembresSelectionnes([]);
                    }}
                        style={{padding:'7px 16px',borderRadius:'6px',border:'none',background:'#16a34a',color:'#fff',cursor:'pointer',fontSize:'13px',fontWeight:'700'}}
                        disabled={membresSelectionnes.length === 0}>
                        ✓ Valider ({membresSelectionnes.length} membre(s))
                    </button>
                </div>
            </div>
        </div>
    )}

    {showCategorieAlert && (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-4 rounded-lg shadow-lg relative animate-pulse">
                        <button 
                            onClick={() => setShowCategorieAlert(false)}
                            className="absolute top-2 right-2 text-yellow-800 hover:text-yellow-900 font-bold text-xl"
                        >
                            ×
                        </button>
                        <div className="flex items-start">
                            <span className="text-2xl mr-3">💡</span>
                            <div>
                                <p className="font-bold text-lg mb-1">Pensez à choisir une catégorie appropriée !</p>
                                <p className="text-sm mb-1">La catégorie <span className="font-semibold">"🎯 Autre"</span> est actuellement sélectionnée par défaut.</p>
                                <p className="text-sm">Vous pouvez la changer dans le menu déroulant à gauche.</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                        <label className="block text-sm font-semibold mb-2">
                            🏷️ Catégorie 
                            {formData.categorie !== 'autre' && (
                                <span className="ml-1 text-xs text-green-600 font-normal">✨ Auto</span>
                            )}
                        </label>
                        <select 
                            value={formData.categorie} 
                            onChange={(e) => {
                                setFormData({...formData, categorie: e.target.value});
                                if (e.target.value !== 'autre') {
                                    setShowCategorieAlert(false);
                                }
                            }} 
                            className={`w-full px-3 py-2 border rounded-lg bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400 ${formData.categorie !== 'autre' ? 'border-green-500' : 'border-gray-300'}`}
                        >
                            {categories.map((cat, i) => <option key={i} value={cat.id}>{cat.nom}</option>)}
                        </select>
                    </div>
                    <div className="col-span-9">
                        <label className="block text-sm font-semibold mb-2">Événement</label>
                        <textarea 
                            value={formData.evenement} 
                            onChange={(e) => setFormData({...formData, evenement: e.target.value})} 
                            onFocus={(e) => {
                                if (formData.categorie === 'autre' && !showCategorieAlert) {
                                    setShowCategorieAlert(true);
                                    setTimeout(() => setShowCategorieAlert(false), 5000); // Disparaît après 5 secondes
                                }
                            }}
                            ref={refEvenement}
                            onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); refEnregistrer.current?.focus(); } }}
                            className="w-full px-4 py-2 border rounded-lg bg-green-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                            rows="4"
                            placeholder="Description..."
                        />
                    </div>
                </div>

                <div className="flex gap-4 items-center justify-between mt-6">
                    <div className="flex gap-4 items-center">
                        <button 
                            onClick={handlePrintMainCourante}
                            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2"
                            title="Imprimer la main courante"
                        >
                            🖨️ Imprimer main courante
                        </button>
                        <span>Prochain numéro : <strong className="text-blue-600 text-xl">{nextEventNumber}</strong></span>
                    </div>
                    <button
                        ref={refEnregistrer}
                        onClick={handleSubmit}
                        className="bg-green-600 text-white px-16 py-4 rounded-lg hover:bg-green-700 font-bold text-xl shadow-lg focus:outline-none focus:ring-4 focus:ring-green-300"
                    >
                        ✓ ENREGISTRER
                    </button>
                </div>
            </div>

            {/* Modal de recherche */}
            {showSearchModal && (
                <RechercheMainCouranteModal 
                    events={events}
                    onClose={() => setShowSearchModal(false)}
                />
            )}

            {/* Barre de recherche rapide */}
            <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
                <div className="flex gap-3 items-center">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            value={rechercheRapide}
                            onChange={(e) => setRechercheRapide(e.target.value)}
                            placeholder="Recherche rapide... (secrétaire, événement, équipe, point phone)"
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    {rechercheRapide && (
                        <>
                            <span className="text-sm text-gray-600 font-semibold">
                                {events.filter(e => 
                                    e.secretaire?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                    e.evenement?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                    e.equipe?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                    e.pointPhone?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                    e.personneConcernee?.toLowerCase().includes(rechercheRapide.toLowerCase())
                                ).length} résultat(s)
                            </span>
                            <button
                                onClick={() => setRechercheRapide('')}
                                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-semibold text-sm"
                            >
                                Effacer
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Fonction de tri des événements */}
            {(() => {
                const handleSort = (column) => {
                    if (sortColumn === column) {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                        setSortColumn(column);
                        setSortDirection('desc');
                    }
                };

                const getSortedEvents = (eventsToSort) => {
                    return [...eventsToSort].sort((a, b) => {
                        let compareA, compareB;

                        switch (sortColumn) {
                            case 'numero':
                                const parseNumero = (num) => {
                                    // Extraire la partie numérique et le suffixe alphabétique
                                    const match = num.match(/^(\d+)([a-z]*)$/i);
                                    if (match) {
                                        return {
                                            numeric: parseInt(match[1]),
                                            suffix: match[2] || '' // suffixe vide si pas de lettre
                                        };
                                    }
                                    return { numeric: 0, suffix: '' };
                                };
                                
                                const parsedA = parseNumero(a.numero);
                                const parsedB = parseNumero(b.numero);
                                
                                // Comparer d'abord la partie numérique
                                if (parsedA.numeric !== parsedB.numeric) {
                                    compareA = parsedA.numeric;
                                    compareB = parsedB.numeric;
                                } else {
                                    // Si les numéros sont identiques, comparer les suffixes
                                    // Un numéro sans suffixe vient après ceux avec suffixe en tri descendant
                                    compareA = parsedA.suffix;
                                    compareB = parsedB.suffix;
                                }
                                break;
                            case 'secretaire':
                                compareA = (a.secretaire || '').toLowerCase();
                                compareB = (b.secretaire || '').toLowerCase();
                                break;
                            case 'timestamp':
                                compareA = new Date(a.timestamp || a.dateHeure).getTime();
                                compareB = new Date(b.timestamp || b.dateHeure).getTime();
                                break;
                            case 'categorie':
                                compareA = (a.categorie || 'autre').toLowerCase();
                                compareB = (b.categorie || 'autre').toLowerCase();
                                break;
                            default:
                                compareA = a.id;
                                compareB = b.id;
                        }

                        if (sortDirection === 'asc') {
                            return compareA > compareB ? 1 : compareA < compareB ? -1 : 0;
                        } else {
                            return compareA < compareB ? 1 : compareA > compareB ? -1 : 0;
                        }
                    });
                };

                // Filtrer et trier les événements
                const filteredEvents = events.filter(e => 
                    !rechercheRapide || 
                    e.secretaire?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                    e.evenement?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                    e.equipe?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                    e.pointPhone?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                    e.personneConcernee?.toLowerCase().includes(rechercheRapide.toLowerCase())
                );
                
                const sortedEvents = getSortedEvents(filteredEvents);

                return null; // Cette partie ne rend rien, c'est juste pour définir les fonctions
            })()}

            {/* Modal d'édition d'événement */}
            {editingEvent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">✏️ Modifier l'événement N°{editingEvent.numero}</h2>
                                <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Secrétaire *</label>
                                        <input
                                            type="text"
                                            value={editFormData.secretaire}
                                            onChange={(e) => setEditFormData({...editFormData, secretaire: e.target.value})}
                                            className="w-full px-4 py-2 border rounded-lg"
                                        />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                checked={editFormData.messageImportant} 
                                                onChange={(e) => setEditFormData({...editFormData, messageImportant: e.target.checked})} 
                                                className="w-5 h-5" 
                                            />
                                            <span className="font-semibold">⚠️ Message Important</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2">🏷️ Catégorie</label>
                                    <select
                                        value={editFormData.categorie}
                                        onChange={(e) => setEditFormData({...editFormData, categorie: e.target.value})}
                                        className="w-full px-4 py-2 border rounded-lg"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.nom}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2">📝 Événement</label>
                                    <textarea
                                        value={editFormData.evenement}
                                        onChange={(e) => setEditFormData({...editFormData, evenement: e.target.value})}
                                        className="w-full px-4 py-2 border rounded-lg"
                                        rows="4"
                                        placeholder="Décrivez l'événement..."
                                    />
                                </div>

                                <div className="grid grid-cols-12 gap-2">
                                    <div className="col-span-3">
                                        <label className="block text-xs font-semibold mb-1">Message venant de :</label>
                                        <input 
                                            list="edit-expediteurs-list"
                                            value={editFormData.expediteur} 
                                            onChange={(e) => setEditFormData({...editFormData, expediteur: e.target.value})} 
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="Nom..."
                                        />
                                        <datalist id="edit-expediteurs-list">
                                            {[...sauveteursSurSiteNoms].sort((a, b) => a.localeCompare(b)).map((a, i) => <option key={i} value={a} />)}
                                        </datalist>
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block text-xs font-semibold mb-1">Message à destination de :</label>
                                        <input 
                                            list="edit-destinataires-list"
                                            value={editFormData.destinataire} 
                                            onChange={(e) => setEditFormData({...editFormData, destinataire: e.target.value})} 
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="Nom..."
                                        />
                                        <datalist id="edit-destinataires-list">
                                            {[...sauveteursSurSiteNoms].sort((a, b) => a.localeCompare(b)).map((a, i) => <option key={i} value={a} />)}
                                        </datalist>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold mb-1">📍 Point Phone</label>
                                        <input 
                                            list="edit-pointsphone-list"
                                            value={editFormData.pointPhone} 
                                            onChange={(e) => setEditFormData({...editFormData, pointPhone: e.target.value})} 
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="A, B..."
                                        />
                                        <datalist id="edit-pointsphone-list">
                                            {[...pointsPhone].sort((a, b) => { const oa = typeof a === 'object' && a.ordre !== undefined ? parseFloat(a.ordre) : 999; const ob = typeof b === 'object' && b.ordre !== undefined ? parseFloat(b.ordre) : 999; return oa - ob; }).map((pp, i) => { const value = typeof pp === 'object' ? `${pp.lettre} - ${pp.nom}` : pp; return <option key={i} value={value} /> })}
                                        </datalist>
                                    </div>
                                    {/* Départ PC + Lieu */}
                                    <div className="col-span-3" style={{display:'flex', flexDirection:'column', gap:'6px', justifyContent:'center'}}>
                                        <label className="flex items-center gap-2 cursor-pointer" style={{fontWeight:'700', fontSize:'13px'}}>
                                            <input type="checkbox" checked={editFormData.departDuPC||false}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const pcPP = pointsPhone.find(pp => (typeof pp==='object'?pp.lettre:pp)==='PC');
                                                    const pcLabel = pcPP ? 'PC - '+(pcPP.nom||'Poste de Commandement') : 'PC - Poste de Commandement';
                                                    setEditFormData({...editFormData, departDuPC: checked, pointPhone: checked ? pcLabel : editFormData.pointPhone});
                                                }}
                                                style={{width:'16px', height:'16px'}}
                                            />
                                            🚀 Départ PC
                                        </label>
                                        {editFormData.departDuPC && (
                                            <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                                                {[
                                                    {val:'souterre', label:'🪨 Sous terre', bg:'#8b4513', color:'white'},
                                                    {val:'surface', label:'🌿 Surface', bg:'#16a34a', color:'white'},
                                                    {val:'horssite', label:'🚗 Hors site', bg:'#6b7280', color:'white'}
                                                ].map(opt => (
                                                    <button key={opt.val} type="button"
                                                        onClick={() => setEditFormData({...editFormData, lieuDepart: opt.val})}
                                                        style={{
                                                            padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'600',
                                                            background: editFormData.lieuDepart===opt.val ? opt.bg : '#e5e7eb',
                                                            color: editFormData.lieuDepart===opt.val ? opt.color : '#374151',
                                                            border: editFormData.lieuDepart===opt.val ? '2px solid '+opt.bg : '2px solid #d1d5db',
                                                            cursor:'pointer'
                                                        }}
                                                    >{opt.label}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold mb-1">👤 Personne</label>
                                        <input 
                                            list="edit-personne-list"
                                            value={editFormData.personneConcernee} 
                                            onChange={(e) => {
                                                const nom = e.target.value;
                                                setEditFormData({...editFormData, personneConcernee: nom});
                                                
                                                // Auto-remplir l'équipe
                                                const sauv = masterSauveteursList.find(s => s.name === nom);
                                                if (sauv) {
                                                    const teamId = sauveteurToTeamMap[sauv.id];
                                                    if (teamId) {
                                                        const team = teams.find(t => t.id === teamId);
                                                        if (team) {
                                                            setEditFormData({...editFormData, personneConcernee: nom, equipe: team.name});
                                                        }
                                                    }
                                                }
                                            }}
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="Nom..."
                                        />
                                        <datalist id="edit-personne-list">
                                            {sauveteursSurSiteNoms.map((nom, i) => <option key={i} value={nom} />)}
                                        </datalist>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold mb-1">👔 Équipe</label>
                                        <input 
                                            list="edit-equipe-list"
                                            value={editFormData.equipe} 
                                            onChange={(e) => setEditFormData({...editFormData, equipe: e.target.value})} 
                                            className="w-full px-2 py-2 border rounded text-sm"
                                            placeholder="T1..."
                                        />
                                        <datalist id="edit-equipe-list">
                                            {teams.filter(t => t.status !== 'dissolved').map((team, i) => {
                                                const lastPP = events.filter(e => e.equipe === team.name && e.pointPhone).sort((a,b) => new Date(b.isoTimestamp||0)-new Date(a.isoTimestamp||0))[0];
                                                const ppLabel = lastPP ? ` | 📍${(typeof lastPP.pointPhone === 'object' ? lastPP.pointPhone.lettre : (lastPP.pointPhone||'').split(' - ')[0].trim())}` : '';
                                                const mission2 = team.mission ? (team.mission.length > 30 ? team.mission.substring(0,30)+'...' : team.mission) : '';
                                                return <option key={i} value={team.name} label={team.name + (mission2 ? ' : '+mission2 : '') + ppLabel} />;
                                            })}
                                        </datalist>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">📅 Date de rappel</label>
                                        <input
                                            type="date"
                                            value={editFormData.dateRappel}
                                            onChange={(e) => setEditFormData({...editFormData, dateRappel: e.target.value})}
                                            className="w-full px-4 py-2 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">⏰ Heure de rappel</label>
                                        <input
                                            type="time"
                                            value={editFormData.heureRappel}
                                            onChange={(e) => setEditFormData({...editFormData, heureRappel: e.target.value})}
                                            className="w-full px-4 py-2 border rounded-lg"
                                        />
                                    </div>
                                </div>

                                {editFormData.fichier ? (
                                    <div className="bg-gray-100 p-3 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">📎 {editFormData.fichier.nom}</span>
                                            <button 
                                                onClick={() => setEditFormData({...editFormData, fichier: null})}
                                                className="text-red-600 hover:text-red-800 font-bold"
                                            >Supprimer</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">📎 Pièce jointe</label>
                                        <input
                                            type="file"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    setEditFormData({...editFormData, fichier: {
                                                        nom: file.name,
                                                        type: file.type,
                                                        data: ev.target.result
                                                    }});
                                                };
                                                reader.readAsDataURL(file);
                                            }}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-semibold"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                                    >
                                        💾 Enregistrer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Tableau des événements */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-blue-600 text-white">
                            <tr>
                                <th 
                                    onClick={() => {
                                        if (sortColumn === 'numero') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortColumn('numero');
                                            setSortDirection('desc');
                                        }
                                    }}
                                    className="px-4 py-3 text-left text-sm cursor-pointer hover:bg-blue-700"
                                >
                                    N° {sortColumn === 'numero' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                    onClick={() => {
                                        if (sortColumn === 'secretaire') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortColumn('secretaire');
                                            setSortDirection('desc');
                                        }
                                    }}
                                    className="px-4 py-3 text-left text-sm cursor-pointer hover:bg-blue-700"
                                >
                                    Secrétaire {sortColumn === 'secretaire' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                    onClick={() => {
                                        if (sortColumn === 'timestamp') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortColumn('timestamp');
                                            setSortDirection('desc');
                                        }
                                    }}
                                    className="px-4 py-3 text-left text-sm cursor-pointer hover:bg-blue-700"
                                >
                                    Date/Heure {sortColumn === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-center text-sm">Important</th>
                                <th 
                                    onClick={() => {
                                        if (sortColumn === 'categorie') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortColumn('categorie');
                                            setSortDirection('desc');
                                        }
                                    }}
                                    className="px-4 py-3 text-left text-sm cursor-pointer hover:bg-blue-700"
                                >
                                    🏷️ Catégorie {sortColumn === 'categorie' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-left text-sm">Événement</th>
                                <th className="px-4 py-3 text-left text-sm">📍 Localisation</th>
                                <th className="px-4 py-3 text-center text-sm">📎 Fichier</th>
                                <th className="px-4 py-3 text-left text-sm">Rappel</th>
                                <th className="px-4 py-3 text-center text-sm">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.filter(e => 
                                !rechercheRapide || 
                                e.secretaire?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                e.evenement?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                e.equipe?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                e.pointPhone?.toLowerCase().includes(rechercheRapide.toLowerCase()) ||
                                e.personneConcernee?.toLowerCase().includes(rechercheRapide.toLowerCase())
                            ).sort((a, b) => {
                                // Tri selon la colonne et direction sélectionnées
                                let compareA, compareB;
                                
                                switch (sortColumn) {
                                    case 'numero':
                                        const parseNumero = (num) => {
                                            // Extraire la partie numérique et le suffixe alphabétique
                                            const match = num.match(/(\d+)([a-z]*)$/i);
                                            if (match) {
                                                return {
                                                    numeric: parseInt(match[1]),
                                                    suffix: match[2] || '' // suffixe vide si pas de lettre
                                                };
                                            }
                                            return { numeric: 0, suffix: '' };
                                        };
                                        
                                        const parsedA = parseNumero(a.numero);
                                        const parsedB = parseNumero(b.numero);
                                        
                                        // Comparer d'abord la partie numérique
                                        if (parsedA.numeric !== parsedB.numeric) {
                                            compareA = parsedA.numeric;
                                            compareB = parsedB.numeric;
                                        } else {
                                            // Si les numéros sont identiques, comparer les suffixes
                                            compareA = parsedA.suffix;
                                            compareB = parsedB.suffix;
                                        }
                                        break;
                                    case 'secretaire':
                                        compareA = (a.secretaire || '').toLowerCase();
                                        compareB = (b.secretaire || '').toLowerCase();
                                        break;
                                    case 'timestamp':
                                        compareA = new Date(a.timestamp || a.dateHeure).getTime();
                                        compareB = new Date(b.timestamp || b.dateHeure).getTime();
                                        break;
                                    case 'categorie':
                                        compareA = (a.categorie || 'autre').toLowerCase();
                                        compareB = (b.categorie || 'autre').toLowerCase();
                                        break;
                                    default:
                                        compareA = a.id;
                                        compareB = b.id;
                                }
                                
                                if (sortDirection === 'asc') {
                                    return compareA > compareB ? 1 : compareA < compareB ? -1 : 0;
                                } else {
                                    return compareA < compareB ? 1 : compareA > compareB ? -1 : 0;
                                }
                            }).map((event) => {
                                // Calculer le numéro maximum (sans suffixe) pour déterminer si on peut insérer
                                const getBaseNumeric = (num) => {
                                    const match = num.match(/(\d+)/);
                                    return match ? parseInt(match[1]) : 0;
                                };
                                
                                const maxNumeric = Math.max(...events.map(e => getBaseNumeric(e.numero)));
                                const eventNumeric = getBaseNumeric(event.numero);
                                const canInsert = eventNumeric < maxNumeric; // Ne peut insérer que si ce n'est pas le numéro max
                                
                                const alertStatus = getAlertStatus(event);
                                const rowClass = alertStatus === 'urgent' ? 'bg-orange-50 border-l-4 border-orange-600' :
                                                alertStatus === 'passed' ? 'bg-red-50 border-l-4 border-red-600' :
                                                alertStatus === 'done' ? 'bg-green-50' :
                                                '';
                                return (
                                    <tr key={event.id} className={`border-b hover:bg-blue-50 ${rowClass}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-blue-700">{event.numero}</span>
                                                {canInsert && (
                                                    <button
                                                        onClick={() => openInsertModal(event)}
                                                        className="text-green-600 hover:text-green-800 hover:bg-green-100 rounded p-1"
                                                        title="Insérer un événement après celui-ci"
                                                    >
                                                        ➕
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{event.secretaire}</td>
                                        <td className="px-4 py-3 text-sm">{event.dateHeure}</td>
                                        <td className="px-4 py-3 text-center">
                                            {event.messageImportant && (
                                                <span className="inline-flex items-center justify-center w-7 h-7 bg-red-600 text-white rounded-full font-bold">!</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {event.categorie && (
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'red' ? 'bg-red-100 text-red-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'blue' ? 'bg-blue-100 text-blue-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'green' ? 'bg-green-100 text-green-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'purple' ? 'bg-purple-100 text-purple-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'indigo' ? 'bg-indigo-100 text-indigo-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'orange' ? 'bg-orange-100 text-orange-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'gray' ? 'bg-gray-100 text-gray-800' :
                                                    categories.find(c => c.id === event.categorie)?.couleur === 'cyan' ? 'bg-cyan-100 text-cyan-800' :
                                                    'bg-pink-100 text-pink-800'
                                                }`}>
                                                    {categories.find(c => c.id === event.categorie)?.nom}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-pre-line max-w-md">{event.evenement}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex flex-col gap-1">
                                                {event.pointPhone && (
                                                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                                        📍 {event.pointPhone}
                                                    </span>
                                                )}
                                                {event.personneConcernee && (
                                                    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                                        👤 {event.personneConcernee}
                                                    </span>
                                                )}
                                                {event.equipe && (
                                                    <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                                                        👔 {event.equipe}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {event.fichier && (
                                                <button
                                                    onClick={() => {
                                                        const link = document.createElement('a');
                                                        link.href = event.fichier.data;
                                                        link.download = event.fichier.nom;
                                                        link.click();
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                                                    title={`Télécharger ${event.fichier.nom}`}
                                                >
                                                    📎 {event.fichier.nom.length > 15 ? event.fichier.nom.substring(0, 12) + '...' : event.fichier.nom}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {event.dateRappel && (
                                                <div className="flex flex-col gap-1">
                                                    <div>{new Date(event.dateRappel).toLocaleDateString('fr-FR')}</div>
                                                    <div>{event.heureRappel}</div>
                                                    {alertStatus && (
                                                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                            alertStatus === 'urgent' ? 'bg-orange-600 text-white' :
                                                            alertStatus === 'passed' ? 'bg-red-600 text-white' :
                                                            alertStatus === 'done' ? 'bg-green-600 text-white' :
                                                            'bg-blue-600 text-white'
                                                        }`}>
                                                            {alertStatus === 'urgent' ? '🔥 URGENT' :
                                                             alertStatus === 'passed' ? '⚠️ DÉPASSÉE' :
                                                             alertStatus === 'done' ? '✓ RÉALISÉE' :
                                                             '📅 PROGRAMMÉE'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEditEvent(event)}
                                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded p-2 transition-all"
                                                    title="Modifier cet événement"
                                                >
                                                    ✏️
                                                </button>
                                                {event.dateRappel && !event.fait && (
                                                    <button
                                                        onClick={() => handleValidateAlert(event)}
                                                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm font-semibold"
                                                        title="Marquer comme réalisée"
                                                    >
                                                        ✓ Valider
                                                    </button>
                                                )}
                                                {event.fait && (
                                                    <span className="text-green-600 font-bold">✓</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {events.length === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <p className="text-lg font-semibold">Aucun événement</p>
                            <p className="text-sm">Créez votre premier événement</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Statistiques */}
            <div className="mt-6 bg-white rounded-lg shadow-lg p-4">
                <div className="flex justify-between text-sm text-gray-600 flex-wrap gap-4">
                    <div>Total événements : <strong className="text-blue-600">{events.length}</strong></div>
                    <div>Messages importants : <strong className="text-red-600">{events.filter(e => e.messageImportant).length}</strong></div>
                    <div>Sauveteurs sur site : <strong className="text-purple-600">{sauveteursSurSite.length}</strong></div>
                    <div>Équipes actives : <strong className="text-amber-600">{teams.length}</strong></div>
                </div>
            </div>
        </div>
    );
};