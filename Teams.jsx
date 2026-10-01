// ============================================
// MODAL - ÉQUIPES
// ============================================
let GestionEquipesModal = ({
    teams, setTeams, usedTeamNumbers, setUsedTeamNumbers, masterSauveteursList, activeSauveteurIds,
    events, setEvents, nextEventNumber, setNextEventNumber, reserverNumerosMC, actions, onClose, mcMode, mcIdentifiant,
    startHour, totalDays, planning, setPlanning, verifierEtPropagerAvantAction, pointsPhone, sauveursAyantQuitte
}) => {
    const [nouvelleEquipe, setNouvelleEquipe] = useState({ numero: '', mission: '', ordreMission: '' });
    const [selectedMembres, setSelectedMembres] = useState([]);
    const [mouvements, setMouvements] = useState({});
    const [expandedTeams, setExpandedTeams] = useState(new Set());
    const [modalScindre, setModalScindre] = useState(null);
    const [addingMembersToTeam, setAddingMembersToTeam] = useState(null); // ID de l'équipe en mode ajout
    const [selectedNewMembres, setSelectedNewMembres] = useState([]); // Nouveaux membres à ajouter
    const [searchNewTeam, setSearchNewTeam] = useState(''); // Recherche dans la liste (création d'équipe)
    const [searchAddMembers, setSearchAddMembers] = useState(''); // Recherche dans la liste (ajout de membres)
    const [numeroError, setNumeroError] = useState('');
    const [typeMission, setTypeMission] = useState('');
    const [typeMissionSuggested, setTypeMissionSuggested] = useState(false);
    const [equipeLieu, setEquipeLieu] = useState(''); // 'souterre', 'surface', 'horssite' — vide = non sélectionné
    const [draggedMember, setDraggedMember] = useState(null); // Membre en cours de glissement
    const [draggedTeamId, setDraggedTeamId] = useState(null); // ID de l'équipe concernée
    useCloseOnEscape(onClose);
    const [editingTeam, setEditingTeam] = useState(null); // Équipe en cours d'édition
    const [showKeywordsModal, setShowKeywordsModal] = useState(false); // Modal de gestion des mots-clés

    // Types de mission disponibles (avec mots-clés par défaut)
    const typesMissionDefaults = [
        { id: 'Reconnaissance', nom: '🔍 Reconnaissance', keywords: ['reconnaissance', 'recon', 'explor', 'repérage'] },
        { id: 'Brancardage', nom: '🚑 Brancardage', keywords: ['brancard', 'transport', 'évac', 'sortie'] },
        { id: 'ASV', nom: '💗 ASV', keywords: ['asv', 'assistance', 'victime', 'soin', 'secours'] },
        { id: 'Logistique', nom: '📦 Logistique', keywords: ['logistique', 'matériel', 'appro', 'ravitaillement', 'surface'] },
        { id: 'Transmission', nom: '📡 Transmission', keywords: ['transmission', 'radio', 'communication', 'liaison', 'tel', 'phone', 'TPS', 'SPL'] },
        { id: 'Équipement', nom: '⚙️ Équipement', keywords: ['équipement', 'installation', 'montage', 'câble', 'tyrolienne', 'balancier'] },
        { id: 'Désobstruction', nom: '🔨 Désobstruction', keywords: ['désobstruction', 'déblai', 'déblayage', 'éboulis', 'obstacle', 'tir'] },
        { id: 'Plongée', nom: '🤿 Plongée', keywords: ['plongée', 'siphon', 'immersion', 'eau', 'aquatique'] },
        { id: 'Gestion', nom: '📋 Gestion', keywords: ['gestion', 'coordi', 'organisation', 'pc', 'direction'] },
        { id: 'Divers', nom: '🎯 Divers', keywords: [] }
    ];

    // Charger les mots-clés personnalisés depuis localStorage ou utiliser les défauts
    const loadCustomKeywords = () => {
        try {
            const saved = localStorage.getItem('ssf_mission_keywords');
            if (saved) {
                const parsed = JSON.parse(saved);
                return typesMissionDefaults.map(type => {
                    const custom = parsed.find(p => p.id === type.id);
                    return custom || type;
                });
            }
        } catch (e) {
            console.error('Erreur chargement mots-clés:', e);
        }
        return typesMissionDefaults;
    };

    const [typesMission, setTypesMission] = useState(loadCustomKeywords());

    // Sauvegarder les mots-clés dans localStorage
    const saveCustomKeywords = (types) => {
        try {
            localStorage.setItem('ssf_mission_keywords', JSON.stringify(types));
            setTypesMission(types);
        } catch (e) {
            console.error('Erreur sauvegarde mots-clés:', e);
            alert('Erreur lors de la sauvegarde des mots-clés');
        }
    };

    // Réinitialiser aux valeurs par défaut
    const resetToDefaults = () => {
        if (window.confirm('⚠️ Réinitialiser tous les mots-clés aux valeurs par défaut ?')) {
            saveCustomKeywords(typesMissionDefaults);
            alert('✅ Mots-clés réinitialisés !');
        }
    };

    // Fonction de détection automatique du type de mission
    const detectTypeMission = (missionText) => {
        if (!missionText || missionText.trim() === '') {
            setTypeMission('');
            setTypeMissionSuggested(false);
            return;
        }

        // Fonction pour normaliser le texte (enlever accents et mettre en minuscules)
        const normalize = (text) => {
            return text.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
        };

        const textNormalized = normalize(missionText);
        
        // Chercher le type correspondant
        for (const type of typesMission) {
            for (const keyword of type.keywords) {
                if (textNormalized.includes(normalize(keyword))) {
                    setTypeMission(type.id);
                    setTypeMissionSuggested(true);
                    return;
                }
            }
        }

        // Aucun type trouvé
        setTypeMission('');
        setTypeMissionSuggested(false);
    };

    // Enlève les accents et met en minuscules, pour une recherche insensible à la casse/accents
    const normaliserTexte = (texte) => (texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const membersInTeams = new Map();
    teams.filter(t => t.status !== 'dissolved').forEach(team => team.members.forEach(id => membersInTeams.set(id, team)));

    const availableMembers = activeSauveteurIds
        .filter(function(id) { return !(sauveursAyantQuitte || []).includes(id) && !membersInTeams.has(id); })
        .map(id => masterSauveteursList.find(s => s.id === id))
        .filter(Boolean)
        .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'fr', { sensitivity: 'base' }));

    // Tous les sauveteurs actifs (disponibles OU déjà en équipe), pour la recherche —
    // permet de retrouver et réaffecter quelqu'un sans devoir d'abord le retirer
    // manuellement de son équipe actuelle.
    const selectableMembers = activeSauveteurIds
        .filter(function(id) { return !(sauveursAyantQuitte || []).includes(id); })
        .map(id => masterSauveteursList.find(s => s.id === id))
        .filter(Boolean)
        .map(s => ({ ...s, currentTeam: membersInTeams.get(s.id) || null }))
        .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'fr', { sensitivity: 'base' }));

    const filtrerParRecherche = (liste, recherche) => {
        if (!recherche || !recherche.trim()) return liste;
        const q = normaliserTexte(recherche);
        return liste.filter(s => normaliserTexte(s.name).includes(q));
    };

    const creerEquipe = () => {
        setNumeroError('');
        
        if (!nouvelleEquipe.numero || !nouvelleEquipe.mission) {
            alert('Veuillez renseigner le numéro et le titre de l\'équipe');
            return;
        }
        if (!typeMission || typeMission === '') {
            alert('⚠️ Veuillez sélectionner un type de mission');
            return;
        }
        if (!equipeLieu) {
            alert('⚠️ Veuillez sélectionner un type de lieu (Sous terre, Surface ou Hors site)');
            return;
        }
        if (selectedMembres.length === 0) {
            alert('Veuillez sélectionner au moins un membre');
            return;
        }

        // Proposer la mise à jour des slots vides avant de créer l'équipe
        verifierEtPropagerAvantAction();

        const teamId = nouvelleEquipe.numero.startsWith('T') ? nouvelleEquipe.numero : `T${nouvelleEquipe.numero}`;

        // Vérifier si l'équipe existe actuellement
        if (teams.find(t => t.id === teamId)) {
            setNumeroError(`⚠️ L'équipe ${teamId} existe déjà ! Choisissez un autre numéro.`);
            alert(`⚠️ ATTENTION : L'équipe ${teamId} existe déjà !\nVeuillez choisir un autre numéro.`);
            return;
        }

        // Vérifier si le numéro a déjà été utilisé dans le passé
        const previousUse = usedTeamNumbers.find(u => u.numero === teamId);
        if (previousUse) {
            setNumeroError(`⚠️ Le numéro ${nouvelleEquipe.numero} a déjà été utilisé pour "${previousUse.mission}". Choisissez un autre numéro.`);
            alert(`⚠️ ATTENTION : Le numéro ${nouvelleEquipe.numero} a déjà été utilisé !\n\nMission précédente : ${previousUse.mission}\n\nVeuillez choisir un autre numéro.`);
            return;
        }

        const chefNom = masterSauveteursList.find(s => s.id === selectedMembres[0])?.name || '';
        const membresNoms = selectedMembres.map(id => masterSauveteursList.find(s => s.id === id)?.name).filter(Boolean);

        const newTeam = {
            id: teamId,
            name: `Équipe ${nouvelleEquipe.numero}`,
            mission: nouvelleEquipe.mission,
            ordreMission: nouvelleEquipe.ordreMission || '',
            typeMission: typeMission,
            lieu: equipeLieu,
            members: selectedMembres,
            createdAt: new Date().toISOString(),
            status: 'active', // active ou dissolved
            dissolvedAt: null,
            history: [
                {
                    timestamp: new Date().toISOString(),
                    action: 'creation',
                    details: {
                        chef: chefNom,
                        membres: membresNoms
                    }
                }
            ]
        };

        const membresNomsString = membresNoms.join(', ');

        // Message différent selon le mode MC
        const evenementMessage = (mcMode === 'secondaire') 
            ? `Prévision pour équipe (${nouvelleEquipe.mission}) : ${membresNomsString}`
            : `Création Équipe ${nouvelleEquipe.numero}\nChef: ${chefNom}\nMission: ${nouvelleEquipe.mission}\nMembres: ${membresNomsString}`;

        const horodatage = new Date().toISOString();
        const evenements = [{ id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: evenementMessage, numero: (mcMode === 'secondaire' && mcIdentifiant) ? `${mcIdentifiant}-${reserverNumerosMC().toString().padStart(3, '0')}` : reserverNumerosMC().toString().padStart(3, '0'), fait: false }];

        // Activité « Engagé » (« Gestion » pour une équipe de gestion) au quart d'heure actuel,
        // si l'heure est dans le planning : appliquée par l'action, avec sa ligne de main courante
        const slotIndex = indexCreneau({ startHour }, horodatage);
        if (slotIndex >= 0 && slotIndex < getTotalSlots(totalDays)) {
            const isGestion = nouvelleEquipe.mission.toLowerCase().includes('gestion');
            evenements.push({ id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: `👔 Activité "${isGestion ? 'Gestion' : 'Engage'}" affectée à : ${membresNomsString}`, numero: (mcMode === 'secondaire' && mcIdentifiant) ? `${mcIdentifiant}-${reserverNumerosMC().toString().padStart(3, '0')}` : reserverNumerosMC().toString().padStart(3, '0'), fait: false });
        }

        // Équipe créée (ses membres quittent leur ancienne équipe), numéro mémorisé, planning, main courante
        actions.creerEquipe(newTeam, horodatage, evenements);
        
        setNouvelleEquipe({ numero: '', mission: '', ordreMission: '' });
        setSelectedMembres([]);
        setTypeMission('');
        setTypeMissionSuggested(false);
        setEquipeLieu('');
        setSearchNewTeam('');
        alert('✅ Équipe créée !');
    };

    const chargerEquipePourEdition = (team) => {
        setEditingTeam(team);
        setNouvelleEquipe({
            numero: team.name.replace('Équipe ', ''),
            mission: team.mission,
            ordreMission: team.ordreMission || ''
        });
        setTypeMission(team.typeMission || '');
        // Priorité : team.lieu > rétro-compat sousTerre > vide (pas de défaut 'surface')
        setEquipeLieu(team.lieu || (team.sousTerre ? 'souterre' : ''));
        setTypeMissionSuggested(false);
        setSelectedMembres([]);
    };

    const annulerEdition = () => {
        setEditingTeam(null);
        setNouvelleEquipe({ numero: '', mission: '', ordreMission: '' });
        setTypeMission('');
        setTypeMissionSuggested(false);
        setEquipeLieu('');
        setNumeroError('');
    };

    const sauvegarderEditionEquipe = () => {
        if (!nouvelleEquipe.mission) {
            alert('Veuillez renseigner le titre de l\'équipe');
            return;
        }
        if (!typeMission || typeMission === '') {
            alert('⚠️ Veuillez sélectionner un type de mission');
            return;
        }
        if (!equipeLieu) {
            alert('⚠️ Veuillez sélectionner un type de lieu (Sous terre, Surface ou Hors site)');
            return;
        }

        // Ligne de main courante pour la modification de mission (MC principale uniquement)
        const horodatage = new Date().toISOString();
        const evenement = (!mcMode || mcMode === 'principale')
            ? { id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: `✏️ Modification ${editingTeam.name}\nNouvelle mission: ${nouvelleEquipe.mission}`, numero: reserverNumerosMC().toString().padStart(3, '0'), fait: false }
            : null;
        actions.modifierEquipe(editingTeam.id, {
            mission: nouvelleEquipe.mission,
            ordreMission: nouvelleEquipe.ordreMission || '',
            typeMission: typeMission,
            lieu: equipeLieu,
        }, editingTeam.mission, evenement);

        annulerEdition();
        alert('✅ Équipe modifiée !');
    };

    const dissoudreEquipe = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        if (window.confirm(`Dissoudre l'équipe ${team.name} ?`)) {
            const horodatage = new Date().toISOString();
            const membresNoms = team.members
                .map(memberId => masterSauveteursList.find(s => s.id === memberId)?.name)
                .filter(Boolean)
                .join(', ');
            // Ligne de main courante uniquement en MC principale
            const pointPhonePC = (function() { try { var pp = (pointsPhone||[]).find(function(pp){return (typeof pp==='object'?pp.lettre:pp)==='PC';}); return pp ? 'PC - '+(pp.nom||'Poste de Commandement') : 'PC - Poste de Commandement'; } catch(e){ return 'PC - Poste de Commandement'; } })();
            const evenement = (!mcMode || mcMode === 'principale')
                ? { id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: `🔚 Dissolution ${team.name}\nMembres: ${membresNoms}`, pointPhone: pointPhonePC, equipe: team.name, numero: reserverNumerosMC().toString().padStart(3, '0'), fait: false }
                : null;
            // Équipe marquée dissoute, membres « Disponible » au créneau actuel
            actions.dissoudreEquipe(teamId, horodatage, evenement);
        }
    };

    const ajouterMembresAEquipe = (teamId) => {
        if (selectedNewMembres.length === 0) {
            alert('⚠️ Veuillez sélectionner au moins un membre à ajouter.');
            return;
        }

        const horodatage = new Date().toISOString();
        const team = teams.find(t => t.id === teamId);
        const membresNoms = selectedNewMembres
            .map(id => masterSauveteursList.find(s => s.id === id)?.name)
            .filter(Boolean)
            .join(', ');

        // Message différent selon le mode MC
        const evenementMessage = (mcMode === 'secondaire')
            ? `➕ Ajout à ${team.name} (${team.mission}) : ${membresNoms}`
            : `➕ Ajout à ${team.name} : ${membresNoms}`;
        const evenement = { id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: evenementMessage, numero: (mcMode === 'secondaire' && mcIdentifiant) ? `${mcIdentifiant}-${reserverNumerosMC().toString().padStart(3, '0')}` : reserverNumerosMC().toString().padStart(3, '0'), fait: false };

        // Membres ajoutés (retirés de leur ancienne équipe), « Engagé » au créneau actuel, main courante
        actions.ajouterMembresEquipe(teamId, selectedNewMembres, horodatage, evenement);

        alert(`✅ ${selectedNewMembres.length} membre(s) ajouté(s) à l'équipe !`);
        setAddingMembersToTeam(null);
        setSelectedNewMembres([]);
        setSearchAddMembers('');
    };

    const deplacerMembre = (memberId, equipeOrigineId) => {
        const destination = (mouvements[memberId] || '').trim().toUpperCase();
        
        if (!destination) {
            alert('Veuillez saisir une destination (ID Équipe ou PC)');
            return;
        }

        const equipeOrigine = teams.find(t => t.id === equipeOrigineId);
        if (!equipeOrigine) return;

        const membre = masterSauveteursList.find(s => s.id === memberId);
        if (!membre) return;

        // Retour au PC
        if (destination === 'PC' || destination === '**PC**') {
            const horodatage = new Date().toISOString();
            // Ligne de main courante uniquement en MC principale
            const pointPhonePC = (function(){ try { var pp=(pointsPhone||[]).find(function(p){return (typeof p==='object'?p.lettre:p)==='PC';}); return pp?'PC - '+(pp.nom||'Poste de Commandement'):'PC - Poste de Commandement'; }catch(e){return 'PC - Poste de Commandement';} })();
            const evenement = (!mcMode || mcMode === 'principale')
                ? { id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: `↩️ ${membre.name} libéré de ${equipeOrigine.name} vers PC`, pointPhone: pointPhonePC, numero: reserverNumerosMC().toString().padStart(3, '0'), fait: false }
                : null;
            // Retiré de l'équipe (une équipe vidée disparaît), « Disponible » au créneau actuel
            actions.libererMembre(equipeOrigineId, memberId, horodatage, evenement);
            setMouvements({...mouvements, [memberId]: ''});
            alert('✅ Membre libéré au PC');
        }
        // Déplacement vers une autre équipe
        else {
            const teamIdDest = destination.startsWith('T') ? destination : `T${destination}`;
            const equipeDest = teams.find(t => t.id === teamIdDest);

            if (!equipeDest) {
                alert(`L'équipe de destination "${destination}" n'existe pas`);
                return;
            }

            const horodatage = new Date().toISOString();
            // Ligne de main courante uniquement en MC principale
            const evenement = (!mcMode || mcMode === 'principale')
                ? { id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: `🔄 ${membre.name} : ${equipeOrigine.name} → ${equipeDest.name}`, numero: reserverNumerosMC().toString().padStart(3, '0'), fait: false }
                : null;
            // Une équipe vidée disparaît
            actions.deplacerMembre(equipeOrigineId, teamIdDest, memberId, horodatage, evenement);
            setMouvements({...mouvements, [memberId]: ''});
            alert('✅ Membre déplacé');
        }
    };

    const reactiverEquipe = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        if (!window.confirm('Reactiver ' + team.name + ' ? Mission : ' + team.mission + ' - Les membres redeviendront engages.')) return;

        const horodatage = new Date().toISOString();
        const membresNoms = team.members.map(id => { const s = masterSauveteursList.find(s => s.id === id); return s ? s.name : id; }).join(', ');
        const evenement = { id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: true, categorie: 'equipe',
            evenement: '↩️ REACTIVATION ' + team.name + ' - Mission : ' + team.mission + ' - Membres : ' + membresNoms,
            numero: reserverNumerosMC().toString().padStart(3, '0'), fait: false };
        // Équipe active de nouveau, membres « Engagé » au créneau actuel
        actions.reactiverEquipe(teamId, horodatage, evenement);

        alert('✅ ' + team.name + ' réactivée ! Un événement a été ajouté à la Main Courante.');
    };

    const imprimerEquipe = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;
        
        const createdAt = new Date(team.createdAt);
        const dissolvedAt = team.dissolvedAt ? new Date(team.dissolvedAt) : null;
        const status = team.status === 'dissolved' ? '[MISSION TERMINÉE]' : '[MISSION EN COURS]';
        const statusColor = team.status === 'dissolved' ? '#dc2626' : '#16a34a';
        
        // Chef et membres initiaux
        let chefInitial = '';
        let membresInitiaux = '';
        if (team.history && team.history.length > 0 && team.history[0].action === 'creation') {
            chefInitial = team.history[0].details.chef;
            membresInitiaux = team.history[0].details.membres.join(', ');
        }
        
        // Composition actuelle
        let membresActuelsHTML = '';
        team.members.forEach((memberId, idx) => {
            const member = masterSauveteursList.find(s => s.id === memberId);
            if (member) {
                membresActuelsHTML += '<div class="membre">' + (idx === 0 ? '<span class="badge-chef">CHEF</span> ' : '') + member.name + '</div>';
            }
        });
        
        // Historique des changements (sans la création)
        let historiqueHTML = '';
        const changes = team.history ? team.history.filter(h => h.action !== 'creation') : [];
        if (changes.length > 0) {
            historiqueHTML = '<h2>Historique des changements</h2><div class="historique-list">';
            changes.forEach(entry => {
                const timeOnly = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                if (entry.action === 'ajout_membres') {
                    const origine = entry.details.origine ? ` (depuis ${entry.details.origine})` : '';
                    historiqueHTML += `<div class="hist-item"><strong>• ${timeOnly}</strong> - Ajout membre${entry.details.membres.length > 1 ? 's' : ''}${origine}: ${entry.details.membres.join(', ')}</div>`;
                } else if (entry.action === 'retrait_membre') {
                    const dest = entry.details.destination === 'PC' ? 'vers PC' : `vers ${entry.details.destination}`;
                    historiqueHTML += `<div class="hist-item"><strong>• ${timeOnly}</strong> - Retrait membre ${dest}: ${entry.details.membre}</div>`;
                } else if (entry.action === 'changement_chef') {
                    historiqueHTML += `<div class="hist-item"><strong>• ${timeOnly}</strong> - ${entry.details.nouveau_chef} devient chef d'équipe (ancien chef: ${entry.details.ancien_chef})</div>`;
                } else if (entry.action === 'dissolution') {
                    historiqueHTML += `<div class="hist-item hist-dissolution"><strong>• ${timeOnly}</strong> - Dissolution de l'équipe</div>`;
                }
            });
            historiqueHTML += '</div>';
        }
        
        const contenu = 
            '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
            '<title>' + team.name + '</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f9fafb}' +
            '.container{max-width:1000px;margin:0 auto;background:white;padding:40px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}' +
            '.header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #0055a4}' +
            '.header h1{color:#0055a4;margin:0 0 10px 0;font-size:28px}' +
            '.header .status{font-size:16px;font-weight:bold;margin:10px 0}' +
            '.header .date{color:#666;font-size:14px}' +
            '.info-box{margin:20px 0;padding:20px;background:#f3f4f6;border-radius:8px;border-left:4px solid #0055a4}' +
            '.info-row{margin:8px 0;line-height:1.6}' +
            '.label{font-weight:bold;color:#374151}' +
            '.info-initial{margin:20px 0;padding:15px;background:#e0f2fe;border-radius:8px;border-left:4px solid #0284c7}' +
            '.ordre-mission{margin:20px 0;padding:15px;background:#fffbeb;border-radius:8px;border-left:4px solid #f59e0b;white-space:pre-wrap;line-height:1.6}' +
            'h2{color:#1e40af;border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin:30px 0 15px 0;font-size:18px}' +
            '.membre{padding:10px 15px;border-bottom:1px solid #e5e7eb;background:white}' +
            '.membre:hover{background:#f9fafb}' +
            '.badge-chef{background:#16a34a;color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-right:8px}' +
            '.historique-list{background:#fef3c7;padding:15px;border-radius:8px;border-left:4px solid #f59e0b}' +
            '.hist-item{margin:8px 0;padding:8px;background:white;border-radius:4px;line-height:1.5}' +
            '.hist-dissolution{background:#fee2e2;color:#991b1b;border-left:3px solid #dc2626}' +
            '.footer{margin-top:40px;padding-top:20px;border-top:1px solid #d1d5db;text-align:center;color:#6b7280;font-size:12px}' +
            '.button-container{text-align:center;margin:30px 0;padding:20px;background:#e8f4ff;border-radius:8px}' +
            '.btn{padding:12px 30px;margin:0 10px;font-size:16px;font-weight:600;border:none;border-radius:6px;cursor:pointer}' +
            '.btn-print{background:#0055a4;color:white}' +
            '.btn-print:hover{background:#004080}' +
            '.btn-close{background:#6b7280;color:white}' +
            '.btn-close:hover{background:#4b5563}' +
            '@media print{' +
            '.button-container{display:none}' +
            'body{background:white}' +
            '.container{box-shadow:none;padding:20px}' +
            '}' +
            '</style></head><body>' +
            '<div class="container">' +
            '<div class="header">' +
            '<h1>📋 ' + team.name + ' - ' + team.mission + '</h1>' +
            '<div class="status" style="color:' + statusColor + '">' + status + '</div>' +
            '<div class="date">Imprimé le ' + new Date().toLocaleString('fr-FR') + '</div>' +
            '</div>' +
            '<div class="button-container">' +
            '<button class="btn btn-print" onclick="window.print()">🖨️ Imprimer</button>' +
            '<button class="btn btn-close" onclick="window.close()">Fermer</button>' +
            '</div>' +
            '<div class="info-box">' +
            '<div class="info-row"><span class="label">Créée le:</span> ' + createdAt.toLocaleString('fr-FR') + '</div>' +
            (dissolvedAt ? '<div class="info-row" style="color:#dc2626"><span class="label">Dissoute le:</span> ' + dissolvedAt.toLocaleString('fr-FR') + '</div>' : '') +
            '</div>' +
            (team.ordreMission ? '<h2>📜 Ordre de mission</h2><div class="ordre-mission">' + team.ordreMission + '</div>' : '') +
            (chefInitial ? '<div class="info-initial">' +
            '<div class="info-row"><span class="label">Chef initial:</span> ' + chefInitial + '</div>' +
            '<div class="info-row"><span class="label">Membres initiaux:</span> ' + membresInitiaux + '</div>' +
            '</div>' : '') +
            (team.status !== 'dissolved' ? '<h2>Composition actuelle de l\'équipe (' + team.members.length + ' membres)</h2>' + membresActuelsHTML : '') +
            historiqueHTML +
            '<div class="footer">Application SSF Unifiée V' + APP_VERSION + ' - ' + team.name + '</div>' +
            '</div>' +
            '</body></html>';
        
        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.write(contenu);
            printWin.document.close();
        }
    };

    // Fonctions de drag & drop pour réorganiser les membres
    const handleDragStart = (e, memberId, teamId) => {
        setDraggedMember(memberId);
        setDraggedTeamId(teamId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetIndex, teamId) => {
        e.preventDefault();
        
        if (!draggedMember || draggedTeamId !== teamId) return;

        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        const currentIndex = team.members.indexOf(draggedMember);
        if (currentIndex === -1) return;

        // Créer un nouveau tableau de membres réorganisé
        const newMembers = [...team.members];
        newMembers.splice(currentIndex, 1);
        newMembers.splice(targetIndex, 0, draggedMember);

        const horodatage = new Date().toISOString();
        const isChiefChange = targetIndex === 0 && currentIndex !== 0;

        // Ligne de main courante UNIQUEMENT si changement de chef (position 0), en MC principale
        let evenement = null;
        if (isChiefChange && (!mcMode || mcMode === 'principale')) {
            const nouveauChef = masterSauveteursList.find(s => s.id === draggedMember);
            const ancienChef = masterSauveteursList.find(s => s.id === team.members[0]);
            if (nouveauChef && ancienChef) {
                evenement = { id: nouvelId(), isoTimestamp: horodatage, secretaire: 'Système', dateHeure: new Date(horodatage).toLocaleString('fr-FR'), messageImportant: false, categorie: 'equipe', evenement: `👔 Changement de chef ${team.name}\nAncien chef: ${ancienChef.name}\nNouveau chef: ${nouveauChef.name}`, numero: reserverNumerosMC().toString().padStart(3, '0'), fait: false };
            }
        }
        actions.reordonnerMembres(teamId, newMembers, isChiefChange, horodatage, evenement);

        setDraggedMember(null);
        setDraggedTeamId(null);
    };

    const handleDragEnd = () => {
        setDraggedMember(null);
        setDraggedTeamId(null);
    };

    // Composant Modal de gestion des mots-clés
    const ModalMotsCles = () => {
        const [editingTypes, setEditingTypes] = useState(JSON.parse(JSON.stringify(typesMission)));
        const [editingTypeId, setEditingTypeId] = useState(null);
        const [newKeyword, setNewKeyword] = useState('');
        useCloseOnEscape(() => setShowKeywordsModal(false));

        const ajouterMotCle = (typeId) => {
            if (!newKeyword.trim()) return;
            
            setEditingTypes(editingTypes.map(type => {
                if (type.id === typeId) {
                    return {
                        ...type,
                        keywords: [...type.keywords, newKeyword.trim().toLowerCase()]
                    };
                }
                return type;
            }));
            setNewKeyword('');
        };

        const supprimerMotCle = (typeId, keyword) => {
            setEditingTypes(editingTypes.map(type => {
                if (type.id === typeId) {
                    return {
                        ...type,
                        keywords: type.keywords.filter(k => k !== keyword)
                    };
                }
                return type;
            }));
        };

        const sauvegarder = () => {
            saveCustomKeywords(editingTypes);
            setShowKeywordsModal(false);
            alert('✅ Mots-clés sauvegardés !');
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 modal-overlay">
                <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">⚙️ Gestion des Mots-Clés</h2>
                            <button onClick={() => setShowKeywordsModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                            <p className="text-sm text-gray-700">
                                💡 <strong>Astuce :</strong> Les mots-clés permettent la détection automatique du type de mission. 
                                Tapez un mot de la mission et le type sera suggéré automatiquement.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {editingTypes.filter(t => t.id !== 'Divers').map(type => (
                                <div key={type.id} className="border-2 rounded-lg p-4 bg-gray-50">
                                    <h3 className="font-bold text-lg mb-3">{type.nom}</h3>
                                    
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={editingTypeId === type.id ? newKeyword : ''}
                                            onFocus={() => setEditingTypeId(type.id)}
                                            onChange={(e) => setNewKeyword(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') ajouterMotCle(type.id);
                                            }}
                                            placeholder="Nouveau mot-clé..."
                                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                        />
                                        <button
                                            onClick={() => ajouterMotCle(type.id)}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold"
                                        >
                                            + Ajouter
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {type.keywords.length === 0 ? (
                                            <p className="text-gray-500 text-sm italic">Aucun mot-clé</p>
                                        ) : (
                                            type.keywords.map((keyword, idx) => (
                                                <div key={idx} className="bg-white border-2 border-blue-300 px-3 py-1 rounded-full flex items-center gap-2">
                                                    <span className="text-sm font-mono">{keyword}</span>
                                                    <button
                                                        onClick={() => supprimerMotCle(type.id, keyword)}
                                                        className="text-red-600 hover:text-red-800 font-bold text-sm"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={sauvegarder}
                                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
                            >
                                ✓ Sauvegarder
                            </button>
                            <button
                                onClick={resetToDefaults}
                                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 font-semibold"
                            >
                                🔄 Réinitialiser
                            </button>
                            <button
                                onClick={() => setShowKeywordsModal(false)}
                                className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 font-semibold"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-overlay">
            <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold">Gestion des Équipes</h2>
                            {teams.filter(t => t.status !== 'dissolved').length > 0 && (
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                                    Dernière: {teams.filter(t => t.status !== 'dissolved')[teams.filter(t => t.status !== 'dissolved').length - 1].name}
                                </span>
                            )}
                            <button
                                onClick={() => setShowKeywordsModal(true)}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-semibold flex items-center gap-2"
                                title="Gérer les mots-clés pour la détection automatique"
                            >
                                ⚙️ Mots-clés
                            </button>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    {showKeywordsModal && (
                        <ModalErrorBoundary onClose={() => setShowKeywordsModal(false)}>
                            <ModalMotsCles />
                        </ModalErrorBoundary>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-amber-50 p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-xl">
                                    {editingTeam ? `✏️ Modifier ${editingTeam.name}` : 'Créer une Équipe'}
                                </h3>
                                {editingTeam && (
                                    <button 
                                        onClick={annulerEdition}
                                        className="text-sm bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                                    >
                                        ✗ Annuler
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    {/* Sélecteur de numéro d'équipe — liste déroulante 1-100 */}
                                    {!editingTeam ? (
                                        <div>
                                            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                                                🔢 N° de l'Équipe <span className="text-red-500">*</span>
                                                {nouvelleEquipe.numero && <span className="ml-2 text-blue-700 font-black text-sm">→ Équipe {nouvelleEquipe.numero}</span>}
                                            </p>
                                            {(() => {
                                                const usedNums = new Set(usedTeamNumbers.map(u => u.numero.replace('T','')));
                                                let defaultNum = '1';
                                                for (let i = 1; i <= 100; i++) {
                                                    if (!usedNums.has(String(i))) { defaultNum = String(i); break; }
                                                }
                                                if (!nouvelleEquipe.numero && defaultNum) {
                                                    setTimeout(() => setNouvelleEquipe({...nouvelleEquipe, numero: defaultNum}), 0);
                                                }
                                                const isCustom = nouvelleEquipe.numero && isNaN(parseInt(nouvelleEquipe.numero));
                                                return (
                                                    <div className="flex gap-2 items-start">
                                                        <select
                                                            value={isCustom ? '' : nouvelleEquipe.numero}
                                                            onChange={(e) => { if (e.target.value) { setNouvelleEquipe({...nouvelleEquipe, numero: e.target.value}); setNumeroError(''); }}}
                                                            className={`flex-1 px-3 py-2 border-2 rounded-lg text-base font-semibold ${numeroError ? 'border-red-500 bg-red-50' : 'border-blue-300'}`}
                                                            style={{fontSize:'15px'}}
                                                        >
                                                            {isCustom && <option value="">— Numéro personnalisé —</option>}
                                                            {Array.from({length: 100}, (_, i) => i + 1).map(n => {
                                                                const numStr = String(n);
                                                                const isUsed = usedNums.has(numStr);
                                                                return (
                                                                    <option key={n} value={numStr} disabled={isUsed}
                                                                        style={{color: isUsed ? '#9ca3af' : '#1e40af', fontWeight: isUsed ? 'normal' : 'bold', backgroundColor: isUsed ? '#f3f4f6' : '#fff'}}>
                                                                        {isUsed ? `${n}  ✗ déjà utilisé` : `${n}`}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                type="text"
                                                                value={isCustom ? nouvelleEquipe.numero : ''}
                                                                onChange={(e) => { setNouvelleEquipe({...nouvelleEquipe, numero: e.target.value}); setNumeroError(''); }}
                                                                placeholder="Ex: 2A, 2B…"
                                                                className="px-2 py-2 border-2 border-dashed border-blue-300 rounded-lg text-sm font-bold text-blue-700 text-center"
                                                                style={{width:'80px'}}
                                                                title="Numéro personnalisé pour sous-équipe (ex: 2A, 2B)"
                                                            />
                                                            <span className="text-xs text-gray-400 text-center">Libre</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            {numeroError && (
                                                <p className="text-red-600 text-sm font-semibold mt-2 animate-pulse">{numeroError}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg border border-gray-300">
                                            <span className="text-2xl font-black text-blue-800">{nouvelleEquipe.numero}</span>
                                            <span className="text-sm text-gray-500 italic">— Le numéro ne peut pas être modifié</span>
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        <p className="text-xs font-semibold text-gray-600 mb-1">
                                            Type de lieu : {!equipeLieu && <span className="text-red-500 font-bold">⚠️ Obligatoire</span>}
                                        </p>
                                        <div className="flex gap-2">
                                            {[
                                                {val:'souterre', label:'🪨 Sous terre'},
                                                {val:'surface', label:'🌿 Surface'},
                                                {val:'horssite', label:'🚗 Hors site'}
                                            ].map(function(opt) {
                                                return (
                                                    <label key={opt.val} style={{cursor:'pointer',padding:'3px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:'600',border:'1px solid',backgroundColor:equipeLieu===opt.val?'#1d4ed8':'#fff',color:equipeLieu===opt.val?'#fff':'#4b5563',borderColor:equipeLieu===opt.val?'#1d4ed8':(!equipeLieu?'#f97316':'#d1d5db')}}>
                                                        <input type="radio" name="equipe-lieu" checked={equipeLieu===opt.val} onChange={function(){setEquipeLieu(opt.val);}} style={{display:'none'}} />
                                                        {opt.label}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {numeroError && !(!editingTeam) && (
                                        <p className="text-red-600 text-sm font-semibold mt-1 animate-pulse">
                                            {numeroError}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">📝 Titre de l'équipe <span className="text-red-500">*</span></p>
                                    <input
                                        type="text"
                                        value={nouvelleEquipe.mission}
                                        onChange={(e) => {
                                            setNouvelleEquipe({...nouvelleEquipe, mission: e.target.value});
                                            detectTypeMission(e.target.value);
                                        }}
                                        placeholder="Titre (ex: Reconnaissance Zone Nord)"
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">📜 Ordre de mission</p>
                                    <textarea
                                        value={nouvelleEquipe.ordreMission}
                                        onChange={(e) => {
                                            setNouvelleEquipe({...nouvelleEquipe, ordreMission: e.target.value});
                                        }}
                                        placeholder="Détaillez précisément ce que l'équipe doit faire..."
                                        rows={4}
                                        className="w-full px-3 py-2 border rounded-lg resize-y"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Type de Mission {typeMission === '' && <span className="text-red-600 text-xs">(⚠️ Le type de mission est obligatoire)</span>}
                                        {typeMissionSuggested && <span className="text-green-600 ml-2">✓ Détecté automatiquement</span>}
                                    </label>
                                    <select
                                        value={typeMission}
                                        onChange={(e) => {
                                            setTypeMission(e.target.value);
                                            setTypeMissionSuggested(false);
                                        }}
                                        className={`w-full px-3 py-2 border-2 rounded-lg ${
                                            typeMission === '' ? 'border-red-300 bg-red-50' : 
                                            typeMissionSuggested ? 'border-green-300 bg-green-50' : 
                                            'border-gray-300'
                                        }`}
                                    >
                                        <option value="">⚠️ Sélectionner un type</option>
                                        {typesMission.map(type => (
                                            <option key={type.id} value={type.id}>{type.nom}</option>
                                        ))}
                                    </select>
                                </div>
                                {!editingTeam && <p className="text-sm text-amber-700 font-semibold">⚠️ Le 1er sélectionné = Chef</p>}
                                {!editingTeam && (
                                    <input
                                        type="text"
                                        value={searchNewTeam}
                                        onChange={(e) => setSearchNewTeam(e.target.value)}
                                        placeholder="🔍 Rechercher un sauveteur par nom..."
                                        className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                                    />
                                )}
                                <div className="border rounded-lg p-3 max-h-60 overflow-y-auto bg-white">
                                    {editingTeam ? (
                                        <p className="text-center text-gray-500 py-4">Mode édition : la mission et le type peuvent être modifiés</p>
                                    ) : filtrerParRecherche(selectableMembers, searchNewTeam).length === 0 ? (
                                        <p className="text-center text-gray-500 py-4">{searchNewTeam ? 'Aucun sauveteur ne correspond' : 'Aucun sauveteur actif'}</p>
                                    ) : (
                                        filtrerParRecherche(selectableMembers, searchNewTeam).map(s => (
                                            <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-amber-50 rounded cursor-pointer border-b border-gray-100 last:border-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMembres.includes(s.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            if (s.currentTeam) {
                                                                const ok = window.confirm(`${s.name} est actuellement dans ${s.currentTeam.name}.\n\nLe retirer de ${s.currentTeam.name} pour l'affecter à cette nouvelle équipe ?`);
                                                                if (!ok) return;
                                                            }
                                                            setSelectedMembres([...selectedMembres, s.id]);
                                                        } else {
                                                            setSelectedMembres(selectedMembres.filter(id => id !== s.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 flex-shrink-0"
                                                />
                                                <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                                                    <span className="font-semibold">{s.name}</span>
                                                    <span className="text-gray-600">{s.role || '-'}</span>
                                                    <span className="text-gray-600">{s.SSF || '-'}</span>
                                                </div>
                                                {s.currentTeam && (
                                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
                                                        déjà en {s.currentTeam.name}
                                                    </span>
                                                )}
                                                {selectedMembres.includes(s.id) && (
                                                    <span className="ml-auto text-xs bg-blue-500 text-white px-2 py-1 rounded flex-shrink-0">
                                                        {selectedMembres.indexOf(s.id) + 1}
                                                    </span>
                                                )}
                                            </label>
                                        ))
                                    )}
                                </div>
                                <button
                                    onClick={editingTeam ? sauvegarderEditionEquipe : creerEquipe}
                                    className={`w-full ${editingTeam ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'} text-white px-4 py-3 rounded-lg font-semibold`}
                                >
                                    {editingTeam ? '✓ Sauvegarder les modifications' : `Créer l'Équipe (${selectedMembres.length})`}
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-bold text-xl mb-4">Équipes Actives ({teams.filter(t => t.status !== 'dissolved').length})</h3>
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {teams.filter(t => t.status !== 'dissolved').length === 0 ? (
                                    <p className="text-center py-12 text-gray-500">Aucune équipe</p>
                                ) : (
                                    [...teams.filter(t => t.status !== 'dissolved')].sort((a, b) => {
                                        const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
                                        const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
                                        return numA - numB;
                                    }).map(team => {
                                        const isExpanded = expandedTeams.has(team.id);
                                        const chef = masterSauveteursList.find(s => s.id === team.members[0]);
                                        return (
                                        <div key={team.id} className="bg-white rounded-lg border-2 border-blue-300 overflow-hidden">
                                            {/* ── EN-TÊTE COMPACT (toujours visible) ── */}
                                            <div
                                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors select-none"
                                                onClick={() => {
                                                    const next = new Set(expandedTeams);
                                                    if (next.has(team.id)) next.delete(team.id); else next.add(team.id);
                                                    setExpandedTeams(next);
                                                }}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="text-lg font-black text-blue-800 whitespace-nowrap">{team.name}</span>
                                                    {(() => {
                                                        const lieu = team.lieu || (team.sousTerre ? 'souterre' : null);
                                                        if (lieu === 'souterre') return <span title="Sous terre" style={{fontSize:'13px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px',backgroundColor:'#78350f',color:'white',whiteSpace:'nowrap'}}>🪨 S.Terre</span>;
                                                        if (lieu === 'surface') return <span title="Surface" style={{fontSize:'13px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px',backgroundColor:'#15803d',color:'white',whiteSpace:'nowrap'}}>🌿 Surface</span>;
                                                        if (lieu === 'horssite') return <span title="Hors site" style={{fontSize:'13px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px',backgroundColor:'#4b5563',color:'white',whiteSpace:'nowrap'}}>🚗 Hors site</span>;
                                                        return <span title="Lieu non défini" style={{fontSize:'13px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px',backgroundColor:'#f97316',color:'white',whiteSpace:'nowrap'}}>❓ Lieu ?</span>;
                                                    })()}
                                                    <span className="text-sm text-gray-500 truncate">{team.mission || '—'}</span>
                                                    {chef && (
                                                        <span className="hidden sm:inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                                                            👑 {chef.name}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-400 whitespace-nowrap">({team.members.length} mbr)</span>
                                                </div>
                                                <span className="text-gray-400 ml-2 text-lg">{isExpanded ? '▲' : '▼'}</span>
                                            </div>

                                            {/* ── CONTENU DÉPLOYÉ ── */}
                                            {isExpanded && (
                                                <div className="border-t border-blue-200 p-4">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div
                                                            className="flex items-center gap-3 cursor-pointer hover:bg-blue-50 p-2 rounded transition-colors flex-1"
                                                            onClick={() => chargerEquipePourEdition(team)}
                                                            title="Cliquer pour modifier"
                                                        >
                                                            <div className="flex-1">
                                                                <h4 className="text-lg font-bold text-blue-800">{team.name} — {team.mission}</h4>
                                                                {team.ordreMission && (
                                                                    <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">📜 {team.ordreMission}</p>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-blue-600">✏️ Modifier</span>
                                                        </div>
                                                        <button
                                                            onClick={() => imprimerEquipe(team.id)}
                                                            className="bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 ml-2"
                                                            title="Imprimer"
                                                        >
                                                            🖨️
                                                        </button>
                                                        <div className="flex gap-2 ml-2">
                                                            <button
                                                                onClick={() => {
                                                                    if (addingMembersToTeam === team.id) {
                                                                        setAddingMembersToTeam(null);
                                                                        setSelectedNewMembres([]);
                                                                    } else {
                                                                        setAddingMembersToTeam(team.id);
                                                                        setSelectedNewMembres([]);
                                                                        setSearchAddMembers('');
                                                                    }
                                                                }}
                                                                className={`px-3 py-1 rounded text-sm font-semibold ${addingMembersToTeam === team.id ? 'bg-gray-500 text-white hover:bg-gray-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                                                            >
                                                                {addingMembersToTeam === team.id ? '✕ Annuler' : '➕ Ajouter des Membres'}
                                                            </button>
                                                            <button
                                                                onClick={() => setModalScindre({ team, membresSelec: team.members.slice(1) })}
                                                                className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm font-semibold"
                                                                title="Scinder l'équipe en créant une sous-équipe"
                                                            >
                                                                ✂️ Scinder
                                                            </button>
                                                            <button
                                                                onClick={() => dissoudreEquipe(team.id)}
                                                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                                                            >
                                                                Fin de mission
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Section d'ajout de membres */}
                                                    {addingMembersToTeam === team.id && (
                                                        <div className="mb-4 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                                                            <h5 className="font-bold text-emerald-800 mb-1">➕ Ajouter des membres à {team.name}</h5>
                                                            <p className="text-sm text-emerald-700 mb-2 italic">Titre : {team.mission}</p>
                                                            {(() => {
                                                                const candidats = selectableMembers.filter(s => !team.members.includes(s.id));
                                                                const candidatsFiltres = filtrerParRecherche(candidats, searchAddMembers);
                                                                if (candidats.length === 0) {
                                                                    return <p className="text-sm text-gray-500 text-center py-3">Aucun sauveteur disponible</p>;
                                                                }
                                                                return (
                                                                    <>
                                                                        <input
                                                                            type="text"
                                                                            value={searchAddMembers}
                                                                            onChange={(e) => setSearchAddMembers(e.target.value)}
                                                                            placeholder="🔍 Rechercher un sauveteur par nom..."
                                                                            className="w-full px-3 py-2 border border-emerald-300 rounded text-sm mb-2"
                                                                        />
                                                                        <div className="max-h-48 overflow-y-auto border border-emerald-300 rounded bg-white mb-2">
                                                                            {candidatsFiltres.length === 0 ? (
                                                                                <p className="text-sm text-gray-500 text-center py-3">Aucun sauveteur ne correspond</p>
                                                                            ) : candidatsFiltres.map(s => (
                                                                                <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-emerald-50 cursor-pointer border-b last:border-b-0">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={selectedNewMembres.includes(s.id)}
                                                                                        onChange={(e) => {
                                                                                            if (e.target.checked) {
                                                                                                if (s.currentTeam) {
                                                                                                    const ok = window.confirm(`${s.name} est actuellement dans ${s.currentTeam.name}.\n\nLe retirer de ${s.currentTeam.name} pour l'affecter à ${team.name} ?`);
                                                                                                    if (!ok) return;
                                                                                                }
                                                                                                setSelectedNewMembres([...selectedNewMembres, s.id]);
                                                                                            } else {
                                                                                                setSelectedNewMembres(selectedNewMembres.filter(id => id !== s.id));
                                                                                            }
                                                                                        }}
                                                                                        className="w-4 h-4"
                                                                                    />
                                                                                    <span className="text-sm font-medium">{s.name}</span>
                                                                                    {s.currentTeam && (
                                                                                        <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
                                                                                            déjà en {s.currentTeam.name}
                                                                                        </span>
                                                                                    )}
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => ajouterMembresAEquipe(team.id)}
                                                                            disabled={selectedNewMembres.length === 0}
                                                                            className={`w-full py-2 rounded font-semibold text-sm ${selectedNewMembres.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                                                        >
                                                                            ✓ Ajouter ({selectedNewMembres.length}) membre{selectedNewMembres.length > 1 ? 's' : ''}
                                                                        </button>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    <div className="mb-3">
                                                        <p className="text-sm font-semibold mb-2">Membres ({team.members.length}):</p>
                                                        {team.members.map((memberId, idx) => {
                                                            const member = masterSauveteursList.find(s => s.id === memberId);
                                                            if (!member) return null;
                                                            const isDragging = draggedMember === memberId;
                                                            return (
                                                                <div
                                                                    key={memberId}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, memberId, team.id)}
                                                                    onDragOver={handleDragOver}
                                                                    onDrop={(e) => handleDrop(e, idx, team.id)}
                                                                    onDragEnd={handleDragEnd}
                                                                    className={`text-sm py-2 px-3 rounded cursor-move transition-all ${isDragging ? 'opacity-50 bg-blue-100' : 'hover:bg-gray-100 border border-transparent hover:border-blue-300'}`}
                                                                    style={{ cursor: 'grab' }}
                                                                >
                                                                    <span className="inline-block mr-2 text-gray-400">⋮⋮</span>
                                                                    {idx === 0 && <span className="bg-green-600 text-white px-2 py-1 rounded text-xs mr-2">CHEF</span>}
                                                                    {member.name}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-blue-200">
                                                        <p className="text-sm font-semibold mb-2">Mouvement Individuel Rapide</p>
                                                        <p className="text-xs text-gray-500 italic mb-3">Saisir l'ID Équipe Dest. (Ex: T2 ou 2) ou **PC** pour libérer l'individu.</p>
                                                        <div className="space-y-2">
                                                            {team.members.map((memberId) => {
                                                                const member = masterSauveteursList.find(s => s.id === memberId);
                                                                if (!member) return null;
                                                                return (
                                                                    <div key={memberId} className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium w-32 truncate">{member.name}</span>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="ID Équipe / PC"
                                                                            value={mouvements[memberId] || ''}
                                                                            onChange={(e) => setMouvements({...mouvements, [memberId]: e.target.value})}
                                                                            className="flex-1 px-2 py-1 border rounded text-sm"
                                                                        />
                                                                        <button
                                                                            onClick={() => deplacerMembre(memberId, team.id)}
                                                                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm font-semibold whitespace-nowrap"
                                                                        >
                                                                            Déplacer
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section équipes dissoutes */}
                    {teams.filter(t => t.status === 'dissolved').length > 0 && (
                        <div className="bg-red-50 p-4 rounded-lg mt-4 border border-red-200">
                            <h3 className="font-bold text-lg mb-3 text-red-700 flex items-center gap-2">
                                🔚 Équipes Dissoutes ({teams.filter(t => t.status === 'dissolved').length})
                                <span className="text-xs font-normal text-red-500 italic">— cliquer sur Réactiver pour annuler une dissolution</span>
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {teams.filter(t => t.status === 'dissolved').map(team => {
                                    const membresNoms = team.members.map(id => {
                                        const s = masterSauveteursList.find(s => s.id === id);
                                        return s ? s.name : id;
                                    }).join(', ');
                                    const dissolvedAt = team.dissolvedAt ? new Date(team.dissolvedAt).toLocaleString('fr-FR') : '—';
                                    return (
                                        <div key={team.id} className="bg-white border border-red-200 rounded-lg p-3 flex items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-red-700">{team.name}</span>
                                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">DISSOUTE</span>
                                                    <span className="text-xs text-gray-400">{dissolvedAt}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 truncate">Titre : {team.mission}</p>
                                                <p className="text-xs text-gray-500 truncate">Membres : {membresNoms}</p>
                                            </div>
                                            <button
                                                onClick={() => reactiverEquipe(team.id)}
                                                className="flex-shrink-0 bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 text-sm font-semibold whitespace-nowrap"
                                                title="Annuler la dissolution et remettre l'équipe en actif"
                                            >
                                                ↩️ Réactiver
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    if (teams.length === 0) {
                                        alert('⚠️ Aucune équipe à exporter');
                                        return;
                                    }
                                    
                                    const { jsPDF } = window.jspdf;
                                    const doc = new jsPDF();

                                    doc.setFontSize(18);
                                    doc.text('Équipes Actives', 14, 20);
                                    doc.setFontSize(10);
                                    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 28);

                                    const tableData = [];
                                    teams.filter(t => t.status !== 'dissolved').forEach(team => {
                                        const membersList = team.members
                                            .map(id => {
                                                const member = masterSauveteursList.find(s => s.id === id);
                                                return member ? member.name : id;
                                            })
                                            .join(', ');
                                        const createdDate = new Date(team.createdAt).toLocaleString('fr-FR');
                                        tableData.push([team.name, team.mission || '-', team.ordreMission || '-', team.members.length, membersList, createdDate]);
                                    });

                                    doc.autoTable({
                                        startY: 35,
                                        head: [['Équipe', 'Titre', 'Ordre de mission', 'Nb', 'Membres', 'Créée le']],
                                        body: tableData,
                                        theme: 'grid',
                                        headStyles: { fillColor: [0, 85, 164] },
                                        styles: { fontSize: 8 },
                                        columnStyles: {
                                            0: { cellWidth: 22 },
                                            1: { cellWidth: 28 },
                                            2: { cellWidth: 45 },
                                            3: { cellWidth: 12 },
                                            4: { cellWidth: 55 },
                                            5: { cellWidth: 30 }
                                        }
                                    });

                                    doc.save(`equipes_${new Date().toISOString().split('T')[0]}.pdf`);
                                    alert('✅ Export PDF réussi !');
                                }}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold"
                            >
                                📄 Export PDF
                            </button>
                            <button 
                                onClick={() => {
                                    if (teams.length === 0) {
                                        alert('⚠️ Aucune équipe à exporter');
                                        return;
                                    }
                                    
                                    const data = teams.filter(t => t.status !== 'dissolved').map(team => ({
                                        'Équipe': team.name,
                                        'Titre': team.mission || '-',
                                        'Ordre de mission': team.ordreMission || '-',
                                        'Nombre Membres': team.members.length,
                                        'Chef': (() => {
                                            const chef = masterSauveteursList.find(s => s.id === team.members[0]);
                                            return chef ? chef.name : '-';
                                        })(),
                                        'Membres': team.members
                                            .map(id => {
                                                const member = masterSauveteursList.find(s => s.id === id);
                                                return member ? member.name : id;
                                            })
                                            .join(', '),
                                        'Créée le': new Date(team.createdAt).toLocaleString('fr-FR'),
                                        'Statut': 'Active'
                                    }));

                                    const ws = XLSX.utils.json_to_sheet(data);
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, 'Équipes');
                                    XLSX.writeFile(wb, `equipes_${new Date().toISOString().split('T')[0]}.xlsx`);
                                    alert('✅ Export Excel réussi !');
                                }}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold"
                            >
                                📊 Export Excel
                            </button>
                        </div>
                        <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">Fermer</button>
                    </div>
                </div>
            </div>

            {/* ── MODALE SCINDER ── */}
            {modalScindre && (() => {
                const ScindreModal = () => {
                    const [membresSelec, setMembresSelec] = React.useState(modalScindre.membresSelec);
                    const [newNum, setNewNum] = React.useState(modalScindre.team.name.replace('Équipe ','') + 'B');
                    const team = modalScindre.team;
                    const baseNum = team.name.replace('Équipe ','');
                    const handleValider = () => {
                        if (membresSelec.length === 0) { alert('Sélectionnez au moins un membre à détacher'); return; }
                        if (!newNum.trim()) { alert('Saisissez un numéro'); return; }
                        const newName = 'Équipe ' + newNum.trim();
                        if (teams.find(t => t.name === newName)) { alert(`"${newName}" existe déjà`); return; }
                        const newTeam = { id: 'T'+newNum.trim()+'_'+Date.now(), name: newName, mission: team.mission, ordreMission: team.ordreMission || '', typeMission: team.typeMission, lieu: team.lieu, sousTerre: team.sousTerre, members: membresSelec, status: 'active' };
                        const membresRestants = team.members.filter(id => !membresSelec.includes(id));
                        const nomsDetaches = membresSelec.map(id=>{const s=masterSauveteursList.find(sv=>sv.id===id);return s?s.name:id;}).join(', ');
                        // Trouver le dernier point phone connu de l'équipe source
                        const eventsEquipeSource = events
                            .filter(e => e.equipe === team.name && e.pointPhone)
                            .sort((a, b) => new Date(b.isoTimestamp||0) - new Date(a.isoTimestamp||0));
                        const dernierPP = eventsEquipeSource.length > 0 ? eventsEquipeSource[0].pointPhone : null;
                        const nScission = reserverNumerosMC(dernierPP ? 2 : 1);
                        const numScission = (mcMode==='secondaire'&&mcIdentifiant)?`${mcIdentifiant}-${nScission.toString().padStart(3,'0')}`:nScission.toString().padStart(3,'0');
                        const numLocalisation = (mcMode==='secondaire'&&mcIdentifiant)?`${mcIdentifiant}-${(nScission+1).toString().padStart(3,'0')}`:(nScission+1).toString().padStart(3,'0');
                        const now = new Date();
                        // Horodatage légèrement avant la scission pour que ce soit le "premier" point de la nouvelle équipe
                        const tsLocalisation = new Date(now.getTime() - 30000); // 30s avant
                        const newEvents = [{
                            id: nouvelId(),
                            isoTimestamp: now.toISOString(),
                            secretaire: 'Système',
                            dateHeure: now.toLocaleString('fr-FR'),
                            messageImportant: false,
                            categorie: 'equipe',
                            evenement: `✂️ Scission ${team.name} → ${newName}\nMembres détachés : ${nomsDetaches}`,
                            numero: numScission,
                            fait: false
                        }];
                        if (dernierPP) {
                            newEvents.push({
                                id: nouvelId(),
                                isoTimestamp: tsLocalisation.toISOString(),
                                secretaire: 'Système',
                                dateHeure: tsLocalisation.toLocaleString('fr-FR'),
                                messageImportant: false,
                                categorie: 'progression',
                                evenement: `📍 Position initiale ${newName} (au moment de la scission)\nDernier point connu de ${team.name}`,
                                numero: numLocalisation,
                                equipe: newName,
                                pointPhone: dernierPP,
                                fait: false
                            });
                        }
                        // Membres détachés retirés de l'équipe source, nouvelle équipe, main courante
                        actions.scinderEquipe(team.id, newTeam, newEvents);
                        setModalScindre(null);
                    };
                    return (
                        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <div style={{background:'#fff',borderRadius:'12px',padding:'24px',minWidth:'340px',maxWidth:'480px',width:'90%',boxShadow:'0 10px 40px rgba(0,0,0,0.4)'}}>
                                <h3 style={{fontWeight:'800',fontSize:'17px',marginBottom:'4px'}}>✂️ Scinder {team.name}</h3>
                                <p style={{fontSize:'13px',color:'#6b7280',marginBottom:'16px'}}>Cochez les membres à détacher dans une nouvelle équipe</p>
                                <div style={{marginBottom:'14px'}}>
                                    <p style={{fontSize:'12px',fontWeight:'700',color:'#374151',marginBottom:'6px'}}>N° de la nouvelle équipe</p>
                                    <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                                        {['A','B','C','D'].map(suf=>(
                                            <button key={suf} type="button" onClick={()=>setNewNum(baseNum+suf)} style={{padding:'4px 10px',borderRadius:'6px',fontWeight:'700',fontSize:'13px',cursor:'pointer',border:newNum===baseNum+suf?'2px solid #7c3aed':'2px solid #d1d5db',backgroundColor:newNum===baseNum+suf?'#7c3aed':'#fff',color:newNum===baseNum+suf?'#fff':'#374151'}}>{baseNum}{suf}</button>
                                        ))}
                                        <input type="text" value={newNum} onChange={e=>setNewNum(e.target.value)} style={{padding:'4px 8px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',fontWeight:'700',width:'60px',textAlign:'center'}} placeholder="Ex: 2B" />
                                    </div>
                                </div>
                                <div style={{marginBottom:'16px',border:'1px solid #e5e7eb',borderRadius:'8px',overflow:'hidden'}}>
                                    <div style={{background:'#f3f4f6',padding:'8px 12px',fontSize:'12px',fontWeight:'700',color:'#374151'}}>Membres de {team.name} — cochez ceux à détacher</div>
                                    {team.members.map((id,idx)=>{
                                        const sv=masterSauveteursList.find(s=>s.id===id);
                                        if(!sv)return null;
                                        const checked=membresSelec.includes(id);
                                        const isChef=idx===0;
                                        return(
                                            <label key={id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid #f3f4f6',backgroundColor:checked?'#f5f3ff':'#fff'}}>
                                                <input type="checkbox" checked={checked} onChange={e=>setMembresSelec(prev=>e.target.checked?[...prev,id]:prev.filter(x=>x!==id))} style={{width:'15px',height:'15px'}} />
                                                {isChef&&<span style={{fontSize:'10px',background:'#16a34a',color:'white',padding:'1px 5px',borderRadius:'3px',fontWeight:'700'}}>CHEF</span>}
                                                <span style={{fontSize:'13px',fontWeight:isChef?'700':'400'}}>{sv.name}</span>
                                                {checked&&<span style={{marginLeft:'auto',fontSize:'11px',color:'#7c3aed',fontWeight:'700'}}>→ Éq.{newNum||'?'}</span>}
                                                {!checked&&<span style={{marginLeft:'auto',fontSize:'11px',color:'#9ca3af'}}>reste Éq.{baseNum}</span>}
                                            </label>
                                        );
                                    })}
                                </div>
                                <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
                                    <button onClick={()=>setModalScindre(null)} style={{padding:'8px 14px',borderRadius:'8px',background:'#f3f4f6',color:'#374151',fontWeight:'600',fontSize:'13px',cursor:'pointer',border:'none'}}>Annuler</button>
                                    <button onClick={handleValider} style={{padding:'8px 18px',borderRadius:'8px',background:'#7c3aed',color:'#fff',fontWeight:'800',fontSize:'14px',cursor:'pointer',border:'none'}}>✂️ Créer Équipe {newNum}</button>
                                </div>
                            </div>
                        </div>
                    );
                };
                return <ScindreModal />;
            })()}
        </div>
    );
};
GestionEquipesModal = React.memo(GestionEquipesModal);
