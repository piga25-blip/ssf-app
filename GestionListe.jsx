// ============================================
// MODAL - LISTE PRÉFECTORALE
// ============================================
const GestionListeModal = ({ masterSauveteursList, setMasterSauveteursList, activeSauveteurIds, onClose }) => {
    const [nouveauSauveteur, setNouveauSauveteur] = useState({ id: '', nom: '', prenom: '', role: '', ssf: '' });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [sortField, setSortField] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [searchTerm, setSearchTerm] = useState('');

    // Générer le prochain ID automatiquement
    const genererProchainId = () => {
        // Extraire tous les numéros existants des IDs EXT-XXX (nouveau format seulement)
        // On ne prend que les IDs avec 1 à 4 chiffres pour ignorer les timestamps
        const existingNumbers = masterSauveteursList
            .filter(s => s.id && s.id.startsWith('EXT-'))
            .map(s => {
                const match = s.id.match(/^EXT-(\d{1,4})$/);
                return match ? parseInt(match[1], 10) : null;
            })
            .filter(n => n !== null && !isNaN(n));
        
        // Trouver le prochain numéro disponible
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        const nextNumber = maxNumber + 1;
        
        // Formater avec des zéros devant (001, 002, etc.)
        return `EXT-${nextNumber.toString().padStart(3, '0')}`;
    };

    const ajouterSauveteur = () => {
        if (!nouveauSauveteur.nom || !nouveauSauveteur.prenom) {
            alert('Veuillez renseigner le nom et le prénom');
            return;
        }
        
        // Générer automatiquement l'ID si vide, sinon utiliser celui saisi
        const id = nouveauSauveteur.id.trim() || genererProchainId();
        const name = `${nouveauSauveteur.nom.toUpperCase()} ${nouveauSauveteur.prenom}`;
        
        if (masterSauveteursList.find(s => s.id === id)) {
            alert('Cet ID existe déjà');
            return;
        }

        const newSauv = {
            id: id,
            name: name,
            role: nouveauSauveteur.role || 'Secouriste',
            SSF: nouveauSauveteur.ssf || '00'
        };

        setMasterSauveteursList([...masterSauveteursList, newSauv]);
        setNouveauSauveteur({ id: '', nom: '', prenom: '', role: '', ssf: '' });
    };

    const supprimerSauveteur = (id) => {
        if (activeSauveteurIds.includes(id)) {
            alert('Impossible de supprimer un sauveteur actif au planning');
            return;
        }
        if (window.confirm('Voulez-vous vraiment supprimer ce sauveteur ?')) {
            setMasterSauveteursList(masterSauveteursList.filter(s => s.id !== id));
        }
    };

    const startEdit = (sauveteur) => {
        setEditingId(sauveteur.id);
        setEditData({
            id: sauveteur.id,
            name: sauveteur.name,
            role: sauveteur.role,
            SSF: sauveteur.SSF
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    const saveEdit = () => {
        if (!editData.name || !editData.role || !editData.SSF) {
            alert('Veuillez remplir tous les champs');
            return;
        }
        
        setMasterSauveteursList(masterSauveteursList.map(s => 
            s.id === editingId ? { ...s, name: editData.name, role: editData.role, SSF: editData.SSF } : s
        ));
        setEditingId(null);
        setEditData({});
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortedAndFilteredList = () => {
        let filteredList = masterSauveteursList.filter(s => 
            s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.SSF.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filteredList.sort((a, b) => {
            let aVal = a[sortField] || '';
            let bVal = b[sortField] || '';
            
            if (sortField === 'SSF') {
                aVal = aVal.toString();
                bVal = bVal.toString();
            }
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getSortIcon = (field) => {
        if (sortField !== field) return '↕️';
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const lines = text.split('\n');
                const nouveauxSauveteurs = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line) {
                        const parts = line.split(';');
                        if (parts.length >= 4) {
                            const id = parts[0].trim();
                            const name = parts[1].trim();
                            const role = parts[2].trim();
                            const ssf = parts[3].trim();

                            if (id && name && role && ssf) {
                                nouveauxSauveteurs.push({ id, name, role, SSF: ssf });
                            }
                        }
                    }
                }

                if (nouveauxSauveteurs.length > 0) {
                    const existing = masterSauveteursList.filter(s => !nouveauxSauveteurs.find(n => n.id === s.id));
                    setMasterSauveteursList([...existing, ...nouveauxSauveteurs]);
                    alert(`${nouveauxSauveteurs.length} sauveteur(s) importé(s) avec succès`);
                }
            } catch (error) {
                alert('Erreur lors de l\'importation du fichier CSV');
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Gestion Liste Préfectorale</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <h3 className="font-bold mb-3">Ajouter un sauveteur</h3>
                        <div className="grid grid-cols-5 gap-3 mb-3">
                            <input 
                                type="text" 
                                value={nouveauSauveteur.id} 
                                onChange={(e) => setNouveauSauveteur({...nouveauSauveteur, id: e.target.value})} 
                                placeholder={genererProchainId()} 
                                className="px-3 py-2 border rounded text-gray-700 bg-gray-100" 
                                title="Laissez vide pour générer automatiquement"
                            />
                            <input type="text" value={nouveauSauveteur.nom} onChange={(e) => setNouveauSauveteur({...nouveauSauveteur, nom: e.target.value})} placeholder="NOM" className="px-3 py-2 border rounded uppercase" />
                            <input type="text" value={nouveauSauveteur.prenom} onChange={(e) => setNouveauSauveteur({...nouveauSauveteur, prenom: e.target.value})} placeholder="Prénom" className="px-3 py-2 border rounded" />
                            <input type="text" value={nouveauSauveteur.role} onChange={(e) => setNouveauSauveteur({...nouveauSauveteur, role: e.target.value})} placeholder="Rôle" className="px-3 py-2 border rounded" />
                            <input type="text" value={nouveauSauveteur.ssf} onChange={(e) => setNouveauSauveteur({...nouveauSauveteur, ssf: e.target.value})} placeholder="SSF / Service" className="px-3 py-2 border rounded" />
                        </div>
                        <button onClick={ajouterSauveteur} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold">+ Ajouter</button>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg mb-4">
                        <label className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 cursor-pointer">
                            📂 Importer CSV
                            <input type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />
                        </label>
                        <p className="text-xs mt-2">Format: ID,Nom Prénom,Rôle,SSF</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold">Liste complète ({masterSauveteursList.length})</h3>
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="🔍 Recherche rapide..."
                                className="px-3 py-2 border rounded-lg w-64"
                            />
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-200 sticky top-0">
                                    <tr>
                                        <th 
                                            className="px-3 py-2 text-left cursor-pointer hover:bg-gray-300"
                                            onClick={() => handleSort('id')}
                                        >
                                            ID {getSortIcon('id')}
                                        </th>
                                        <th 
                                            className="px-3 py-2 text-left cursor-pointer hover:bg-gray-300"
                                            onClick={() => handleSort('name')}
                                        >
                                            Nom {getSortIcon('name')}
                                        </th>
                                        <th 
                                            className="px-3 py-2 text-left cursor-pointer hover:bg-gray-300"
                                            onClick={() => handleSort('role')}
                                        >
                                            Rôle {getSortIcon('role')}
                                        </th>
                                        <th 
                                            className="px-3 py-2 text-left cursor-pointer hover:bg-gray-300"
                                            onClick={() => handleSort('SSF')}
                                        >
                                            SSF / Service {getSortIcon('SSF')}
                                        </th>
                                        <th className="px-3 py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSortedAndFilteredList().map((s) => (
                                        <tr key={s.id} className="border-b hover:bg-gray-100">
                                            <td className="px-3 py-2">{s.id}</td>
                                            {editingId === s.id ? (
                                                <>
                                                    <td className="px-3 py-2">
                                                        <input 
                                                            type="text" 
                                                            value={editData.name}
                                                            onChange={(e) => setEditData({...editData, name: e.target.value})}
                                                            className="w-full px-2 py-1 border rounded"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input 
                                                            type="text" 
                                                            value={editData.role}
                                                            onChange={(e) => setEditData({...editData, role: e.target.value})}
                                                            className="w-full px-2 py-1 border rounded"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input 
                                                            type="text" 
                                                            value={editData.SSF}
                                                            onChange={(e) => setEditData({...editData, SSF: e.target.value})}
                                                            className="w-full px-2 py-1 border rounded"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button 
                                                            onClick={saveEdit}
                                                            className="text-green-600 hover:text-green-800 mr-2"
                                                            title="Enregistrer"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button 
                                                            onClick={cancelEdit}
                                                            className="text-gray-600 hover:text-gray-800"
                                                            title="Annuler"
                                                        >
                                                            ✗
                                                        </button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-3 py-2">{s.name}</td>
                                                    <td className="px-3 py-2">{s.role}</td>
                                                    <td className="px-3 py-2">{s.SSF}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button 
                                                            onClick={() => startEdit(s)}
                                                            className="text-blue-600 hover:text-blue-800 mr-3"
                                                            title="Modifier"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button 
                                                            onClick={() => supprimerSauveteur(s.id)}
                                                            className="text-red-600 hover:text-red-800"
                                                            title="Supprimer"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
