// ============================================
// MODAL - LISTE PRÉFECTORALE
// ============================================
let GestionListeModal = ({ masterSauveteursList, actions, activeSauveteurIds, sauveteurPermanentNumbers, onClose }) => {
    const [nouveauSauveteur, setNouveauSauveteur] = useState({ id: '', nom: '', prenom: '', role: '', ssf: '' });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [sortField, setSortField] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [searchTerm, setSearchTerm] = useState('');
    useCloseOnEscape(onClose);

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
        // Identifiant automatique : si un autre poste vient de le prendre, le suivant libre est attribué
        const idAuto = !nouveauSauveteur.id.trim();
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
            SSF: nouveauSauveteur.ssf || '00',
            ...(idAuto ? { idAuto: true } : {}),
        };

        actions.ajouterSauveteurListe(newSauv);
        setNouveauSauveteur({ id: '', nom: '', prenom: '', role: '', ssf: '' });
    };

    const supprimerSauveteur = (id) => {
        if (activeSauveteurIds.includes(id)) {
            alert('Impossible de supprimer un sauveteur actif au planning');
            return;
        }
        if (window.confirm('Voulez-vous vraiment supprimer ce sauveteur ?')) {
            actions.supprimerSauveteurListe(id);
        }
    };

    const supprimerTousLesSauveteurs = () => {
        const suppressibles = masterSauveteursList.filter(s => !activeSauveteurIds.includes(s.id));
        const nbActifs = masterSauveteursList.length - suppressibles.length;

        if (suppressibles.length === 0) {
            alert('Aucun sauveteur à supprimer (tous sont actifs au planning).');
            return;
        }

        const message = nbActifs > 0
            ? `Voulez-vous vraiment supprimer ${suppressibles.length} sauveteur(s) ?\n${nbActifs} sauveteur(s) actif(s) au planning seront conservés.`
            : `Voulez-vous vraiment supprimer les ${suppressibles.length} sauveteur(s) de la liste ?`;

        if (window.confirm(message)) {
            actions.supprimerSauveteursInactifs();
        }
    };

    const [editAvant, setEditAvant] = useState(null); // sauveteur tel qu'à l'ouverture (« modifié entre-temps »)
    const startEdit = (sauveteur) => {
        setEditAvant(sauveteur);
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
        
        actions.modifierSauveteurListe(editingId, { name: editData.name, role: editData.role, SSF: editData.SSF });
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
                // UTF-16 (Excel « Texte Unicode », Bloc-notes « UTF-16 »), UTF-8, sinon
                // Windows-1252 (CSV enregistré par Excel en français : accents)
                const octets = new Uint8Array(event.target.result);
                // Sans marque d'en-tête, l'UTF-16 se reconnaît aux octets nuls une position sur deux
                const echantillon = Math.min(octets.length, 400);
                let zerosPairs = 0, zerosImpairs = 0;
                for (let i = 0; i < echantillon; i++) if (octets[i] === 0) { if (i % 2) zerosImpairs++; else zerosPairs++; }
                let text;
                if (octets[0] === 0xFF && octets[1] === 0xFE) text = new TextDecoder('utf-16le').decode(octets);
                else if (octets[0] === 0xFE && octets[1] === 0xFF) text = new TextDecoder('utf-16be').decode(octets);
                else if (zerosImpairs > echantillon / 4 && zerosImpairs > zerosPairs) text = new TextDecoder('utf-16le').decode(octets);
                else if (zerosPairs > echantillon / 4) text = new TextDecoder('utf-16be').decode(octets);
                else {
                    try { text = new TextDecoder('utf-8', { fatal: true }).decode(octets); }
                    catch (e) { text = new TextDecoder('windows-1252').decode(octets); }
                }
                text = text.replace(/^﻿/, '');
                // Fichier illisible (classeur Excel .xlsx renommé, autre format) : ne rien importer
                if (/[\u0000�]/.test(text) || text.startsWith('PK')) {
                    alert('Ce fichier ne peut pas être lu : les noms apparaîtraient sous forme de symboles.\n\nDans Excel : Fichier › Enregistrer sous › type « CSV UTF-8 (délimité par des virgules) » ou « CSV (séparateur : point-virgule) », puis importer ce nouveau fichier.');
                    return;
                }
                // Séparateur, d'après la ligne de titres : point-virgule (Excel en français),
                // tabulation (copier-coller d'Excel, « Texte Unicode ») ou virgule
                const titres = text.split(/\r?\n/)[0] || '';
                const compte = (c) => titres.split(c).length - 1;
                const separateur = [';', '\t', ','].reduce((meilleur, c) => compte(c) > compte(meilleur) ? c : meilleur, ';');
                // Découpage en lignes et cellules ; une cellule entre guillemets peut contenir le
                // séparateur ou plusieurs lignes (plusieurs rôles dans une même case d'Excel)
                const lignes = [];
                let ligne = [], cellule = '', guillemets = false;
                for (let i = 0; i < text.length; i++) {
                    const c = text[i];
                    if (guillemets) {
                        if (c === '"' && text[i + 1] === '"') { cellule += '"'; i++; }
                        else if (c === '"') guillemets = false;
                        else cellule += c;
                    } else if (c === '"' && cellule.trim() === '') { cellule = ''; guillemets = true; }
                    else if (c === separateur) { ligne.push(cellule); cellule = ''; }
                    else if (c === '\n') { ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = ''; }
                    else if (c !== '\r') cellule += c;
                }
                ligne.push(cellule); lignes.push(ligne);

                // Colonnes repérées par leur titre : « ID ; Nom ; Prénom ; Rôle ; SSF » ou « ID ; NOM Prénom ; Rôle ; SSF »
                const normaliser = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
                const entetes = lignes[0].map(normaliser);
                const colonne = (test) => entetes.findIndex(test);
                let col = {
                    id: colonne(t => /^(id|n|no|num|numero|identifiant|matricule)$/.test(t)),
                    nomPrenom: colonne(t => /^(nom (et )?prenoms?|prenoms? (et )?nom|nom complet|identite)$/.test(t)),
                    nom: colonne(t => t === 'nom' || t === 'nom de famille'),
                    prenom: colonne(t => /^prenoms?$/.test(t)),
                    role: colonne(t => /^(roles?|specialites?|qualifications?|fonctions?|competences?)\b/.test(t)),
                    ssf: colonne(t => /^(ssf|departement|dept|dpt)\b/.test(t)),
                };
                // Titres non reconnus : ancien format, colonnes dans l'ordre ID ; NOM Prénom ; Rôle ; SSF
                if (col.nomPrenom < 0 && col.nom < 0) col = { id: 0, nomPrenom: 1, nom: -1, prenom: -1, role: 2, ssf: 3 };
                const lire = (cellules, i) => (i >= 0 && cellules[i] !== undefined ? cellules[i] : '').trim();

                const nouveauxSauveteurs = [];
                lignes.slice(1).forEach((cellules) => {
                    if (cellules.every(x => !x.trim())) return;
                    const name = col.nomPrenom >= 0 ? lire(cellules, col.nomPrenom) : [lire(cellules, col.nom), lire(cellules, col.prenom)].filter(Boolean).join(' ');
                    const id = lire(cellules, col.id);
                    // Plusieurs rôles dans la case (retours à la ligne, espaces multiples) : séparés par des virgules
                    const role = lire(cellules, col.role).split(/\s*\n\s*|\s{2,}|\t/).filter(Boolean).join(', ');
                    if (id && name) nouveauxSauveteurs.push({ id, name, role, SSF: lire(cellules, col.ssf) });
                });

                if (nouveauxSauveteurs.length > 0) {
                    actions.importerSauveteursListe(nouveauxSauveteurs);
                    alert(`${nouveauxSauveteurs.length} sauveteur(s) importé(s) avec succès`);
                } else {
                    alert('Aucun sauveteur importé.\n\nFormat attendu : une ligne de titres, puis une ligne par sauveteur, colonnes séparées par des points-virgules :\nID;Nom;Prénom;Rôle;SSF\n1;DUPONT;Marie;CE évacuation, Eq transmission;25\n(plusieurs spécialités dans la case Rôle, séparées par des virgules ; « NOM Prénom » dans une seule colonne est aussi accepté)');
                }
            } catch (error) {
                alert('Erreur lors de l\'importation du fichier CSV');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    // ===== Import de l'export Excel de la base nationale (sauveteurs.speleo-secours-francais.fr) =====
    // Une colonne par spécialité (0/1) : convertie en texte dans « Rôle ». Les coordonnées
    // (adresse, téléphones, e-mail) et les autres colonnes ne sont pas reprises. Après un aperçu,
    // la liste est REMPLACÉE par celle du fichier (les sauveteurs déjà venus sont conservés).
    const [apercuBase, setApercuBase] = useState(null);
    const SPECIALITES_BASE = [
        // [colonne (titre normalisé), texte si 1, colonne qui la remplace si elle vaut 1]
        ['gestion', 'Gestion PC'],
        ['chefequipeevac', 'CE évacuation'],
        ['evacuation', 'Eq évacuation', 'chefequipeevac'],
        ['chefequipeasv', 'CE assistance victime'],
        ['asv', 'Eq assistance victime', 'chefequipeasv'],
        ['medecin', 'Médecin'],
        ['infirmier', 'Infirmier'],
        ['transmission', 'Eq transmission'],
        ['desobstruction', 'Eq désob'],
        ['cpt', 'Artificier'],
        ['plongee', 'Plongeur'],
        ['eauxvives', 'Flottaison'],
        ['pompage', 'Pompage'],
        ['ventilation', 'Ventilation'],
        ['logistique', 'Logistique'],
        ['mines', 'Mines'],
    ];
    const lireExportBaseNationale = (octets, nomFichier) => {
        const classeur = XLSX.read(octets, { type: 'array' });
        const lignes = XLSX.utils.sheet_to_json(classeur.Sheets[classeur.SheetNames[0]], { header: 1, defval: '', raw: false });
        const normaliser = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        const entetes = (lignes[0] || []).map(normaliser);
        if (!['id', 'nom', 'prenom'].every(c => entetes.includes(c)) || !entetes.includes('chefequipeevac')) return null;
        const departement = (String(nomFichier).match(/SSF[-_ ]?(\d{2,3}|2A|2B)(?![0-9A-Za-z])/i) || [])[1] || '';
        const sauveteurs = [];
        lignes.slice(1).forEach(cellules => {
            const v = (col) => { const i = entetes.indexOf(col); return i >= 0 ? String(cellules[i] ?? '').trim() : ''; };
            const oui = (col) => /^(1|oui|x|vrai|true)$/i.test(v(col));
            const id = v('id'), nom = v('nom'), prenom = v('prenom');
            if (!id || !(nom || prenom)) return;
            const roles = [];
            if (v('fonction ct')) roles.push(v('fonction ct'));
            SPECIALITES_BASE.forEach(([col, texte, remplacee]) => { if (oui(col) && !(remplacee && oui(remplacee))) roles.push(texte); });
            const nonOperationnel = entetes.includes('operationnel') && !oui('operationnel');
            const nonFedere = entetes.includes('federe a date') && !oui('federe a date');
            if (nonOperationnel || nonFedere) roles.unshift(nonFedere ? 'NON OPÉRATIONNEL (non fédéré)' : 'NON OPÉRATIONNEL');
            sauveteurs.push({ id, name: [nom.toUpperCase(), prenom].filter(Boolean).join(' '), role: roles.join(', '), SSF: departement });
        });
        const ignorees = (lignes[0] || []).filter((t, i) => !['id', 'nom', 'prenom', 'fonction ct', 'operationnel', 'federe a date', ...SPECIALITES_BASE.map(s => s[0])].includes(entetes[i]));
        return { sauveteurs, departement, ignorees };
    };

    const handleImportBaseNationale = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const lu = lireExportBaseNationale(new Uint8Array(event.target.result), file.name);
                if (!lu) {
                    alert('Ce fichier n\'est pas un export de la base nationale.\n\nSur sauveteurs.speleo-secours-francais.fr : « Export de la liste » › « Export au format Excel », puis importer le fichier téléchargé.\n\nPour une liste préparée à la main, utiliser « 📂 Importer CSV ».');
                    return;
                }
                if (lu.sauveteurs.length === 0) { alert('Aucun sauveteur trouvé dans ce fichier.'); return; }
                setApercuBase({ ...lu, fichier: file.name });
            } catch (error) {
                alert('Ce fichier Excel ne peut pas être lu.');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    // Ce que l'import changera, pour l'aperçu
    const bilanApercu = (() => {
        if (!apercuBase) return null;
        const actuels = new Map(masterSauveteursList.map(s => [s.id, s]));
        const dansFichier = new Set(apercuBase.sauveteurs.map(s => s.id));
        const venus = new Set([...(activeSauveteurIds || []), ...Object.keys(sauveteurPermanentNumbers || {})]);
        const absents = masterSauveteursList.filter(s => !dansFichier.has(s.id));
        return {
            nouveaux: apercuBase.sauveteurs.filter(s => !actuels.has(s.id)).length,
            misAJour: apercuBase.sauveteurs.filter(s => actuels.has(s.id)).length,
            nomsDifferents: apercuBase.sauveteurs.filter(s => actuels.has(s.id) && actuels.get(s.id).name !== s.name),
            retires: absents.filter(s => !venus.has(s.id)),
            conserves: absents.filter(s => venus.has(s.id)),
            nonOperationnels: apercuBase.sauveteurs.filter(s => s.role.startsWith('NON OPÉRATIONNEL')).length,
        };
    })();

    const confirmerImportBase = () => {
        const ssf = apercuBase.departement.trim();
        actions.remplacerSauveteursListe(apercuBase.sauveteurs.map(s => ({ ...s, SSF: ssf })));
        alert(`${apercuBase.sauveteurs.length} sauveteur(s) importé(s) depuis la base nationale : la liste est remplacée.`);
        setApercuBase(null);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-overlay">
            <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Gestion de la liste des sauveteurs</h2>
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
                        <label className="ml-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 cursor-pointer" title="Fichier « Export au format Excel » de sauveteurs.speleo-secours-francais.fr : remplace la liste">
                            📊 Importer la base nationale (Excel)
                            <input type="file" accept=".xlsx,.xls" onChange={handleImportBaseNationale} className="hidden" />
                        </label>
                        <p className="text-xs mt-2">Format : 1re ligne = titres, puis une ligne par sauveteur : ID;Nom;Prénom;Rôle;SSF (séparateur point-virgule) — plusieurs spécialités dans Rôle, séparées par des virgules (« NOM Prénom » en une colonne aussi accepté)</p>
                        <p className="text-xs mt-1">Base nationale : sur sauveteurs.speleo-secours-francais.fr, « Export de la liste » › « Export au format Excel ». La liste est <strong>remplacée</strong> (aperçu avant) ; adresses, téléphones et e-mails ne sont pas repris.</p>
                    </div>

                    {apercuBase && bilanApercu && (
                        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-auto p-6">
                                <h3 className="text-xl font-bold mb-1">📊 Import de la base nationale — aperçu</h3>
                                <p className="text-sm text-gray-600 mb-4">Fichier : {apercuBase.fichier}</p>
                                <ul className="text-sm space-y-1 mb-4">
                                    <li><strong>{apercuBase.sauveteurs.length}</strong> sauveteurs dans le fichier : <strong>{bilanApercu.nouveaux}</strong> nouveaux, <strong>{bilanApercu.misAJour}</strong> mis à jour</li>
                                    {bilanApercu.nonOperationnels > 0 && <li>⚠️ <strong>{bilanApercu.nonOperationnels}</strong> marqués « NON OPÉRATIONNEL » (non opérationnels ou non fédérés à date)</li>}
                                    <li><strong>{bilanApercu.retires.length}</strong> retirés de la liste (absents du fichier){bilanApercu.retires.length > 0 && ` : ${bilanApercu.retires.slice(0, 8).map(s => s.name).join(', ')}${bilanApercu.retires.length > 8 ? '…' : ''}`}</li>
                                    {bilanApercu.conserves.length > 0 && <li><strong>{bilanApercu.conserves.length}</strong> conservés car déjà venus sur ce secours : {bilanApercu.conserves.map(s => s.name).join(', ')}</li>}
                                    {bilanApercu.nomsDifferents.length > 0 && <li className="text-orange-700">⚠️ Même ID, nom différent : {bilanApercu.nomsDifferents.map(s => `${s.id} → ${s.name}`).join(', ')}</li>}
                                </ul>
                                <label className="block text-sm font-semibold mb-1">SSF (département) appliqué à tous :</label>
                                <input
                                    type="text"
                                    value={apercuBase.departement}
                                    onChange={(e) => setApercuBase({ ...apercuBase, departement: e.target.value })}
                                    placeholder="ex. 25"
                                    className="px-3 py-2 border rounded mb-4 w-32"
                                />
                                <p className="text-xs text-gray-600 mb-1">Exemples de rôles obtenus :</p>
                                <ul className="text-xs text-gray-700 mb-4 list-disc pl-5">
                                    {apercuBase.sauveteurs.filter(s => s.role).slice(0, 3).map(s => <li key={s.id}>{s.role}</li>)}
                                </ul>
                                {apercuBase.ignorees.length > 0 && <p className="text-xs text-gray-500 mb-4">Colonnes non reprises : {apercuBase.ignorees.join(', ')}</p>}
                                <div className="flex gap-3 justify-end">
                                    <button onClick={() => setApercuBase(null)} className="px-4 py-2 rounded-lg border font-semibold">Annuler</button>
                                    <button onClick={confirmerImportBase} className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-semibold">✓ Remplacer la liste ({apercuBase.sauveteurs.length})</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold">Liste complète ({masterSauveteursList.length})</h3>
                                {editingId && <AvertissementModifieAilleurs avant={editAvant} actuel={masterSauveteursList.find(s => s.id === editingId)} quoi="Ce sauveteur" />}
                                <button
                                    onClick={supprimerTousLesSauveteurs}
                                    className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 text-xs font-semibold"
                                    title="Supprimer tous les sauveteurs de la liste"
                                >
                                    🗑️ Tout supprimer
                                </button>
                            </div>
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
GestionListeModal = React.memo(GestionListeModal);
