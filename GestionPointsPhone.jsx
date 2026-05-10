// ============================================
// MODAL - GESTION POINTS PHONE
// ============================================
const GestionPointsPhoneModal = ({ pointsPhone, setPointsPhone, events, setEvents, onClose }) => {
    const [nouveauNom, setNouveauNom] = useState('');
    const [nouveauTypePP, setNouveauTypePP] = useState('');
    const [nouveauOrdre, setNouveauOrdre] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const [editLettre, setEditLettre] = useState('');
    const [editNom, setEditNom] = useState('');
    const [editTypePP, setEditTypePP] = useState('');

    // Générer les lettres A-Z pour le dropdown
    const lettres = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i));

    // Lettres déjà utilisées
    const lettresUtilisees = pointsPhone.map(pp => typeof pp === 'object' ? pp.lettre : pp);

    // Trouver la première lettre libre (hors PC)
    const premiereLetreLibre = () => {
        for (const l of lettres) {
            if (!lettresUtilisees.includes(l)) return l;
        }
        return 'A';
    };

    const [nouvelleLettre, setNouvelleLettre] = useState(() => premiereLetreLibre());

    // Mettre à jour la sélection quand pointsPhone change
    React.useEffect(() => {
        const libre = premiereLetreLibre();
        setNouvelleLettre(libre);
    }, [pointsPhone.length]);

    const ajouterPointPhone = () => {
        const nomTrimmed = nouveauNom.trim();
        if (!nomTrimmed) { alert('Veuillez renseigner un nom pour le point phone'); return; }
        if (!nouveauTypePP) { alert('⚠️ Veuillez sélectionner un type de lieu (Surface, Sous terre, etc.)'); return; }
        const existeDeja = pointsPhone.find(pp => typeof pp === 'object' ? pp.lettre === nouvelleLettre : pp === nouvelleLettre);
        if (existeDeja) { alert('Le point phone "' + nouvelleLettre + '" existe déjà'); return; }
        // Calcul de l'ordre : prendre le max existant + 1, ou utiliser la valeur saisie
        const maxOrdre = pointsPhone.reduce((max, pp) => {
            const o = typeof pp === 'object' && pp.ordre !== undefined ? parseFloat(pp.ordre) : 0;
            return Math.max(max, isNaN(o) ? 0 : o);
        }, 0);
        const ordreVal = nouveauOrdre.trim() !== '' ? parseFloat(nouveauOrdre) : maxOrdre + 1;
        setPointsPhone([...pointsPhone, { lettre: nouvelleLettre, nom: nomTrimmed, typePP: nouveauTypePP, sousTerre: nouveauTypePP === 'souterre', estEntree: nouveauTypePP === 'entree' || nouveauTypePP === 'sortie', ordre: isNaN(ordreVal) ? maxOrdre + 1 : ordreVal }]);
        setNouveauTypePP('');
        setNouveauOrdre('');
        setNouveauNom('');
        // Le useEffect ci-dessus recalcule automatiquement la prochaine lettre libre
    };

    const supprimerPointPhone = (pp) => {
        const displayText = typeof pp === 'object' ? `${pp.lettre} - ${pp.nom}` : pp;
        if (window.confirm(`Voulez-vous vraiment supprimer "${displayText}" ?`)) {
            setPointsPhone(pointsPhone.filter(p => p !== pp));
        }
    };

    const commencerModification = (index, pp) => {
        setEditingIndex(index);
        if (typeof pp === 'object') { setEditLettre(pp.lettre); setEditNom(pp.nom); setEditTypePP(pp.typePP || (pp.sousTerre ? 'souterre' : pp.estEntree ? 'entree' : '')); }
        else { setEditLettre(pp); setEditNom(''); setEditTypePP(''); }
    };

    const annulerModification = () => { setEditingIndex(null); setEditLettre(''); setEditNom(''); setEditTypePP(''); };

    const validerModification = (index) => {
        const nomTrimmed = editNom.trim();
        if (!nomTrimmed) { alert('Le nom du point phone ne peut pas être vide'); return; }
        if (!editTypePP) { alert('⚠️ Veuillez sélectionner un type de lieu'); return; }
        const existeDeja = pointsPhone.find((pp, idx) =>
            idx !== index && (typeof pp === 'object' ? pp.lettre === editLettre : pp === editLettre)
        );
        if (existeDeja) { alert(`Le point phone "${editLettre}" existe déjà`); return; }

        const ancienPP = pointsPhone[index];
        const ancienDisplay = typeof ancienPP === 'object' ? `${ancienPP.lettre} - ${ancienPP.nom}` : ancienPP;
        const nouveauPP = { lettre: editLettre, nom: nomTrimmed, typePP: editTypePP, sousTerre: editTypePP === 'souterre', estEntree: editTypePP === 'entree' || editTypePP === 'sortie', ordre: typeof ancienPP === 'object' && ancienPP.ordre !== undefined ? ancienPP.ordre : index };
        const nouveauDisplay = `${editLettre} - ${nomTrimmed}`;

        const newPointsPhone = [...pointsPhone];
        newPointsPhone[index] = nouveauPP;
        setPointsPhone(newPointsPhone);

        if (events && setEvents) {
            const updatedEvents = events.map(event => {
                if (event.pointPhone === ancienDisplay ||
                    event.pointPhone === (typeof ancienPP === 'object' ? ancienPP.lettre : ancienPP)) {
                    return { ...event, pointPhone: nouveauDisplay };
                }
                return event;
            });
            setEvents(updatedEvents);
            const nbModifies = updatedEvents.filter((e, i) => e.pointPhone !== events[i].pointPhone).length;
            if (nbModifies > 0) alert(`✅ Point phone modifié !\n${nbModifies} événement(s) mis à jour.`);
            else alert('✅ Point phone modifié avec succès !');
        }
        setEditingIndex(null); setEditLettre(''); setEditNom('');
    };

    const viderTout = () => {
        if (window.confirm('⚠️ Voulez-vous vraiment VIDER toute la liste des points phone ?')) {
            setPointsPhone([{ lettre: 'PC', nom: 'Poste de Commandement', sousTerre: false, typePP: 'surface', ordre: 0 }]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">📍 Gestion des Points Phone</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <p className="text-sm text-gray-700 mb-3">
                            💡 <strong>Astuce :</strong> Sélectionnez une lettre (A-Z) et ajoutez un nom descriptif pour chaque point phone. 
                            Vous pouvez ensuite les sélectionner dans les événements de la main courante.
                        </p>
                        <div className="flex gap-2">
                            <select
                                value={nouvelleLettre}
                                onChange={(e) => setNouvelleLettre(e.target.value)}
                                className="px-3 py-2 border rounded-lg font-semibold"
                            >
                                {lettres.map(lettre => {
                                    const utilisee = lettresUtilisees.includes(lettre);
                                    return (
                                        <option key={lettre} value={lettre} disabled={utilisee}
                                            style={{color: utilisee ? '#9ca3af' : 'inherit'}}>
                                            {utilisee ? '✓ ' + lettre + ' (prise)' : lettre}
                                        </option>
                                    );
                                })}
                            </select>
                            <input
                                type="text"
                                value={nouveauNom}
                                onChange={(e) => setNouveauNom(e.target.value)}
                                placeholder="Ex: Base du P80, Poste médical..."
                                className="flex-1 px-3 py-2 border rounded-lg"
                                onKeyPress={(e) => e.key === 'Enter' && ajouterPointPhone()}
                            />
                            <input
                                type="text"
                                value={nouveauOrdre}
                                onChange={(e) => setNouveauOrdre(e.target.value)}
                                placeholder="Pos."
                                title="Position dans le diagramme (ex: 3, 3.5). Laissez vide = auto (fin de liste)"
                                className="px-2 py-2 border rounded-lg text-center font-bold text-blue-700"
                                style={{width:'60px'}}
                            />
                            <button onClick={ajouterPointPhone} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold whitespace-nowrap">
                                + Ajouter
                            </button>
                        </div>
                        <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-600 mb-1">Type de lieu : {!nouveauTypePP && <span className="text-red-500 font-bold">⚠️ Obligatoire</span>}</p>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    {val:'surface', label:'🌿 Surface'},
                                    {val:'souterre', label:'🪨 Sous terre'},
                                    {val:'entree', label:'🚪 Entrée cavité'},
                                    {val:'sortie', label:'🚪 Sortie cavité'},
                                    {val:'horssite', label:'🚗 Hors site'}
                                ].map(function(opt) {
                                    return (
                                        <label key={opt.val} style={{cursor:'pointer',padding:'2px 6px',borderRadius:'4px',fontSize:'11px',fontWeight:'600',border:'1px solid',backgroundColor:nouveauTypePP===opt.val?'#1d4ed8':'#fff',color:nouveauTypePP===opt.val?'#fff':'#4b5563',borderColor:nouveauTypePP===opt.val?'#1d4ed8':(!nouveauTypePP?'#f97316':'#d1d5db')}}>
                                            <input type="radio" name="nouveau-type-pp" checked={nouveauTypePP===opt.val} onChange={function(){setNouveauTypePP(opt.val);}} style={{display:'none'}} />
                                            {opt.label}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-lg">Liste ({pointsPhone.length})</h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400 italic">Cliquez sur "Pos." pour réordonner dans le diagramme</span>
                                    {pointsPhone.length > 0 && (
                                        <button onClick={viderTout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold text-sm">
                                            🗑️ Vider tout
                                        </button>
                                    )}
                                </div>
                            </div>
                            {pointsPhone.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">
                                    Aucun point phone enregistré.<br/>
                                    Ajoutez-en un ci-dessus ou tapez-le directement dans un événement !
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {/* En-tête colonnes */}
                                    <div className="flex items-center gap-2 px-2 pb-1 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                                        <span style={{width:'44px'}} className="text-center">Pos. ↕</span>
                                        <span style={{width:'32px'}}>Let.</span>
                                        <span className="flex-1">Nom</span>
                                        <span style={{width:'80px'}}>Type</span>
                                        <span style={{width:'120px'}}></span>
                                    </div>
                                    {[...pointsPhone].sort((a, b) => {
                                        const oa = typeof a === 'object' && a.ordre !== undefined ? parseFloat(a.ordre) : 999;
                                        const ob = typeof b === 'object' && b.ordre !== undefined ? parseFloat(b.ordre) : 999;
                                        return oa - ob;
                                    }).map((pp, sortedIdx) => {
                                        const realIdx = pointsPhone.indexOf(pp);
                                        const ordreVal = typeof pp === 'object' && pp.ordre !== undefined ? pp.ordre : '';
                                        const typePP = typeof pp === 'object' ? (pp.typePP || (pp.sousTerre ? 'souterre' : '')) : '';
                                        const typeBadge = typePP === 'souterre' ? {label:'🪨', bg:'#78350f'} : typePP === 'surface' ? {label:'🌿', bg:'#15803d'} : typePP === 'entree' ? {label:'🚪↓', bg:'#1d4ed8'} : typePP === 'sortie' ? {label:'🚪↑', bg:'#7c3aed'} : typePP === 'horssite' ? {label:'🚗', bg:'#4b5563'} : {label:'?', bg:'#9ca3af'};
                                        return (
                                            <div key={realIdx} className="flex items-center gap-2 p-2 bg-white rounded border hover:border-blue-200 transition-colors">
                                                {editingIndex === realIdx ? (
                                                    <>
                                                        <input type="text" value={ordreVal} readOnly style={{width:'44px',textAlign:'center',padding:'2px 4px',border:'1px solid #d1d5db',borderRadius:'4px',fontSize:'12px',fontWeight:'700',color:'#1d4ed8',backgroundColor:'#eff6ff'}} title="Position (modifiable après validation)" />
                                                        <div className="flex gap-1 flex-1">
                                                            <select value={editLettre} onChange={(e) => setEditLettre(e.target.value)} className="px-1 py-1 border rounded font-semibold text-sm" style={{width:'44px'}}>
                                                                {lettres.map(lettre => (<option key={lettre} value={lettre}>{lettre}</option>))}
                                                            </select>
                                                            <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)}
                                                                className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Nom du point phone..."
                                                                onKeyPress={(e) => { if (e.key === 'Enter') validerModification(realIdx); if (e.key === 'Escape') annulerModification(); }}
                                                                autoFocus />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-gray-600 mb-0.5">Type : {!editTypePP && <span className="text-red-500">⚠️</span>}</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {[
                                                                    {val:'surface', label:'🌿'},
                                                                    {val:'souterre', label:'🪨'},
                                                                    {val:'entree', label:'🚪↓'},
                                                                    {val:'sortie', label:'🚪↑'},
                                                                    {val:'horssite', label:'🚗'}
                                                                ].map(function(opt) {
                                                                    return (
                                                                        <label key={opt.val} title={opt.val} style={{cursor:'pointer',padding:'2px 5px',borderRadius:'3px',fontSize:'13px',border:'1px solid',backgroundColor:editTypePP===opt.val?'#1d4ed8':'#fff',color:editTypePP===opt.val?'#fff':'#4b5563',borderColor:editTypePP===opt.val?'#1d4ed8':(!editTypePP?'#f97316':'#d1d5db')}}>
                                                                            <input type="radio" name="edit-type-pp" checked={editTypePP===opt.val} onChange={function(){setEditTypePP(opt.val);}} style={{display:'none'}} />
                                                                            {opt.label}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => validerModification(realIdx)} className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 font-semibold text-xs">✓</button>
                                                            <button onClick={annulerModification} className="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 font-semibold text-xs">✗</button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* Champ position modifiable inline */}
                                                        <input
                                                            type="text"
                                                            value={ordreVal}
                                                            onChange={(e) => {
                                                                const newPPs = [...pointsPhone];
                                                                const val = e.target.value;
                                                                newPPs[realIdx] = typeof pp === 'object' ? {...pp, ordre: val === '' ? '' : (isNaN(parseFloat(val)) ? val : parseFloat(val))} : pp;
                                                                setPointsPhone(newPPs);
                                                            }}
                                                            title="Position dans le diagramme — modifiez pour réordonner (ex: 3, 3.5, 4a)"
                                                            style={{width:'44px',textAlign:'center',padding:'2px 4px',border:'1px solid #93c5fd',borderRadius:'4px',fontSize:'13px',fontWeight:'700',color:'#1d4ed8',backgroundColor:'#eff6ff',cursor:'text'}}
                                                        />
                                                        <span style={{width:'32px',fontWeight:'700',color:'#1e40af',fontSize:'14px'}}>{typeof pp === 'object' ? pp.lettre : pp}</span>
                                                        <span className="flex-1 text-sm text-gray-700 truncate">{typeof pp === 'object' ? pp.nom : ''}</span>
                                                        <span title={typePP} style={{width:'28px',textAlign:'center',padding:'1px 4px',borderRadius:'4px',backgroundColor:typeBadge.bg,color:'white',fontSize:'13px'}}>{typeBadge.label}</span>
                                                        <div className="flex gap-2" style={{width:'120px',justifyContent:'flex-end'}}>
                                                            <button onClick={() => commencerModification(realIdx, pp)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs">✏️ Modifier</button>
                                                            <button onClick={() => supprimerPointPhone(pp)} className="text-red-600 hover:text-red-800 font-semibold text-xs">🗑️</button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
