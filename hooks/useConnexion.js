// ============================================
// CONNEXION AU SERVEUR INTÉGRÉ (lot 1 du plan réseau)
// ============================================
// Canal permanent (WebSocket /canal) avec le serveur du poste principal.
// - Poste principal (fenêtre Electron, jeton secret) : ouvre les secours, envoie chaque action
//   nommée au serveur, qui l'enregistre (fichiers + journal) et la transmet aux autres postes.
// - Autre poste (navigateur) : reçoit l'état puis chaque action ; en « saisie » (si le poste principal
//   l'autorise), il peut aussi envoyer les actions de main courante et de points phones.
// Les messages émis avant la connexion (ou pendant une coupure) partent dès qu'elle est établie.

// Ce poste est-il le poste principal ? (jeton fourni par preload.js à la seule fenêtre Electron)
const JETON_PRINCIPAL = (window.electronAPI && window.electronAPI.jetonPrincipal) || null;
const EST_POSTE_PRINCIPAL = !!JETON_PRINCIPAL;

const useConnexion = ({ surEtat, surAction, surRefus }) => {
    const [connecte, setConnecte] = useState(false);
    const [role, setRole] = useState(EST_POSTE_PRINCIPAL ? 'principal' : 'consultation');
    const [postes, setPostes] = useState([]);
    const [dossiers, setDossiers] = useState(null);       // null = pas encore reçue
    const [versionServeur, setVersionServeur] = useState(null);
    const [reseau, setReseau] = useState(null);           // { actif, port, adresses } (poste principal)
    const [versionChangee, setVersionChangee] = useState(false); // poste principal mis à jour depuis le chargement de la page
    const versionInitiale = useRef(null);
    const [monNom, setMonNom] = useState(null);          // nom de ce poste pour le serveur
    const wsRef = useRef(null);
    const enAttente = useRef([]);
    const rappels = useRef({});
    rappels.current = { surEtat, surAction, surRefus };

    useEffect(() => {
        if (!window.location.host) return; // ouverte comme fichier : pas de serveur
        let ferme = false, delai = 1000, minuterie = null;
        const connecter = () => {
            const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const ws = new WebSocket(`${proto}://${window.location.host}/canal${JETON_PRINCIPAL ? '?jeton=' + encodeURIComponent(JETON_PRINCIPAL) : ''}`);
            wsRef.current = ws;
            ws.onopen = () => {
                delai = 1000;
                setConnecte(true);
                const file = enAttente.current; enAttente.current = [];
                file.forEach(m => ws.send(JSON.stringify(m)));
            };
            ws.onmessage = (ev) => {
                let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
                const r = rappels.current;
                switch (msg.type) {
                    case 'bienvenue':
                        setRole(msg.role); setVersionServeur(msg.versionApp); setMonNom(msg.nom || null);
                        if (versionInitiale.current === null) versionInitiale.current = msg.versionApp;
                        else if (msg.versionApp !== versionInitiale.current) setVersionChangee(true);
                        if (msg.actif && msg.role !== 'principal' && r.surEtat) r.surEtat(msg.actif);
                        break;
                    case 'etat': if (r.surEtat) r.surEtat(msg); break;
                    case 'action': if (r.surAction) r.surAction(msg.action, msg.version, msg.emetteur); break;
                    case 'postes': setPostes(msg.liste || []); break;
                    case 'dossiers': setDossiers(msg.liste || []); break;
                    case 'reseau': setReseau({ actif: msg.actif, port: msg.port, adresses: msg.adresses || [], saisieDistante: !!msg.saisieDistante }); break;
                    case 'role': setRole(msg.role); break;
                    case 'refus': if (r.surRefus) r.surRefus(msg.raison); break;
                    default: break;
                }
            };
            ws.onclose = () => {
                setConnecte(false);
                if (ferme) return;
                minuterie = setTimeout(connecter, delai);   // reconnexion, de plus en plus espacée
                delai = Math.min(delai * 2, 10000);
            };
        };
        connecter();
        return () => { ferme = true; clearTimeout(minuterie); if (wsRef.current) wsRef.current.close(); };
    }, []);

    const envoyer = useCallback((message) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
        else enAttente.current.push(message);
    }, []);

    return { connecte, role, monNom, postes, dossiers, versionServeur, versionChangee, reseau, envoyer, estPrincipal: role === 'principal' };
};
