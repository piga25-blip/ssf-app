// ============================================
// MODE RÉSEAU (lot 1 du plan réseau)
// ============================================
// Fenêtre du poste principal : activer le mode réseau (les autres postes du réseau local peuvent
// alors ouvrir l'application dans leur navigateur), adresses à saisir, postes connectés.
// Bandeau des autres postes : consultation seule, état de la connexion.

let ModeReseauModal = ({ connexion, onClose }) => {
    useCloseOnEscape(onClose);
    const reseau = connexion.reseau;
    const [enCours, setEnCours] = React.useState(false);
    React.useEffect(() => { setEnCours(false); }, [reseau && reseau.actif]);
    const basculer = () => { setEnCours(true); connexion.envoyer({ type: 'modeReseau', actif: !(reseau && reseau.actif) }); };
    const autres = (connexion.postes || []).filter(p => p.role !== 'principal');
    const heure = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-overlay">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">🌐 Mode réseau</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    {!reseau ? (
                        <p className="text-gray-600">Connexion au serveur en cours…</p>
                    ) : (
                        <>
                            <div className={`p-4 rounded-lg mb-4 border-2 ${reseau.actif ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-300'}`}>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-bold text-lg">{reseau.actif ? '🟢 Mode réseau activé' : '⚪ Mode réseau désactivé'}</p>
                                        <p className="text-sm text-gray-600">
                                            {reseau.actif
                                                ? (reseau.saisieDistante
                                                    ? 'Les autres postes du réseau local peuvent ouvrir l\'application et saisir (voir ci-dessous).'
                                                    : 'Les autres postes du réseau local peuvent ouvrir l\'application (consultation seule).')
                                                : 'L\'application n\'est accessible que sur ce poste.'}
                                        </p>
                                    </div>
                                    <button onClick={basculer} disabled={enCours}
                                        className={`px-4 py-2 rounded-lg font-bold text-white whitespace-nowrap ${reseau.actif ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}>
                                        {enCours ? '…' : (reseau.actif ? 'Désactiver' : 'Activer le mode réseau')}
                                    </button>
                                </div>
                            </div>

                            {reseau.actif && (
                                <div className="mb-4">
                                    <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-4 py-3 mb-3">
                                        <span>🔒 Code de session : <span className="font-mono text-2xl font-bold tracking-widest">{reseau.code}</span></span>
                                        <button onClick={() => { if (window.confirm('Changer le code de session ? Tous les autres postes seront déconnectés et devront saisir le nouveau code.')) connexion.envoyer({ type: 'changerCode' }); }}
                                            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Changer le code</button>
                                    </div>
                                    <p className="font-semibold mb-2">Adresse à saisir dans le navigateur des autres postes :</p>
                                    {reseau.adresses.length === 0 ? (
                                        <p className="text-red-600 text-sm">⚠️ Aucun réseau détecté sur ce poste. Branchez-le au réseau local (câble ou Wi-Fi).</p>
                                    ) : reseau.adresses.map(a => (
                                        <div key={a.adresse} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-2 gap-3">
                                            <div>
                                                <span className="font-mono text-xl font-bold text-blue-800">http://{a.adresse}:{reseau.port}</span>
                                                <span className="block text-xs text-gray-500">{a.interface} — tablette : photographiez le code</span>
                                            </div>
                                            {a.qr && <img alt={'Code QR http://' + a.adresse + ':' + reseau.port} title="À photographier avec l'appareil photo d'une tablette"
                                                src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.qr)} style={{ width: '112px', height: '112px', flexShrink: 0 }} />}
                                        </div>
                                    ))}
                                    {reseau.adresses.length > 1 && (
                                        <p className="text-xs text-gray-500">Plusieurs réseaux détectés : utilisez l'adresse du réseau auquel les autres postes sont reliés.</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-2">
                                        Navigateurs pris en charge : Chrome, Edge, Firefox, Safari (versions récentes).
                                        Si un autre poste n'arrive pas à se connecter, vérifiez que le pare-feu de ce poste autorise l'application SSF.
                                    </p>
                                </div>
                            )}

                            <label className={`flex items-start gap-3 p-3 rounded-lg mb-4 border cursor-pointer ${reseau.saisieDistante ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                                <input type="checkbox" className="w-5 h-5 mt-1" checked={!!reseau.saisieDistante}
                                    onChange={(e) => connexion.envoyer({ type: 'saisieDistante', actif: e.target.checked })} />
                                <span>
                                    <span className="font-semibold">Autoriser la saisie sur les autres postes</span>
                                    <span className="block text-xs text-gray-500">Rôle par défaut des postes ; chaque poste connecté peut ensuite être réglé dans la liste ci-dessous.</span>
                                    <span className="block text-sm text-gray-600">Main courante, points phones, inscriptions, équipes et planning (numéros et heure donnés par ce poste). Restent réservés à ce poste : infos et clôture du secours, imports, remises à zéro, secrétaires, réglages du planning.</span>
                                </span>
                            </label>

                            <div>
                                <p className="font-semibold mb-2">Postes connectés ({autres.length})</p>
                                {autres.length === 0 ? (
                                    <p className="text-sm text-gray-500">Aucun autre poste connecté.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-gray-500"><th className="py-1">Poste</th><th>Adresse</th><th>Rôle</th><th>Depuis</th></tr></thead>
                                        <tbody>
                                            {autres.map((p, i) => (
                                                <tr key={i} className="border-t"><td className="py-1">🟢 {p.nom}</td><td className="font-mono">{p.adresse}</td><td>
                                                    <select value={p.role} onChange={(e) => connexion.envoyer({ type: 'roleDuPoste', idPoste: p.idPoste, role: e.target.value })}
                                                        className="border rounded px-1 py-0.5 text-sm" title="Rôle de ce poste">
                                                        <option value="saisie">✍️ Saisie</option>
                                                        <option value="consultation">👁 Consultation</option>
                                                    </select>
                                                </td><td>{heure(p.depuis)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}

                    <div className="mt-6 flex justify-end">
                        <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">Fermer</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Bandeau d'un autre poste du réseau (consultation ou saisie)
// surCopie : télécharge une copie complète du secours (comme « Exporter Tout »), à importer sur un
// autre ordinateur si le poste principal est hors service
let BandeauConsultation = ({ connexion, rescueId, surCopie }) => (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, marginBottom: '12px' }}>
        <div style={{ background: connexion.connecte ? '#1e3a8a' : '#b91c1c', color: 'white', padding: '8px 16px', borderRadius: '8px',
            fontWeight: 600, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span>{connexion.role === 'saisie' ? '✍️ Poste de saisie' : '👁 Poste en consultation seule'}{rescueId ? ' — ' + rescueId : ''}</span>
            <span>{connexion.connecte ? '🟢 Connecté au poste principal' : '🔴 Connexion perdue — reconnexion en cours… (saisie impossible)'}</span>
        </div>
        {!connexion.connecte && surCopie && (
            <div style={{ background: '#fee2e2', color: '#991b1b', border: '2px solid #ef4444', padding: '8px 16px', borderRadius: '8px', marginTop: '6px',
                fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Si le poste principal est hors service, téléchargez la dernière version reçue du secours pour l'importer sur un autre ordinateur (« Importer Tout »).</span>
                <button onClick={surCopie} style={{ background: '#b91c1c', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>💾 Copie de secours</button>
            </div>
        )}
        {connexion.versionChangee && (
            <div style={{ background: '#fef3c7', color: '#92400e', border: '2px solid #f59e0b', padding: '8px 16px', borderRadius: '8px', marginTop: '6px',
                fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span>⚠️ Le poste principal a été mis à jour (version {connexion.versionServeur}) : rechargez la page.</span>
                <button onClick={() => window.location.reload()} style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>Recharger</button>
            </div>
        )}
    </div>
);

// « Modifié entre-temps » (lot 3) : dans une fenêtre de modification, prévient si l'élément a été
// modifié ou supprimé sur un autre poste depuis l'ouverture de la fenêtre.
// avant : l'élément tel qu'il était à l'ouverture ; actuel : l'élément dans les données à jour.
let AvertissementModifieAilleurs = ({ avant, actuel, quoi }) => {
    if (!avant) return null;
    const style = { padding: '8px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', margin: '8px 0' };
    if (!actuel) {
        return <div style={{ ...style, background: '#fee2e2', color: '#991b1b', border: '2px solid #ef4444' }}>
            ⚠️ {quoi} a été supprimé(e) sur un autre poste pendant votre modification.
        </div>;
    }
    if (JSON.stringify(actuel) === JSON.stringify(avant)) return null;
    return <div style={{ ...style, background: '#fef3c7', color: '#92400e', border: '2px solid #f59e0b' }}>
        ⚠️ {quoi} a été modifié(e) sur un autre poste pendant votre modification : en enregistrant, vos changements remplaceront les siens.
    </div>;
};

// Code de session demandé par le serveur (autre poste, lot 4)
let ModalCodeSession = ({ connexion }) => {
    const [code, setCode] = React.useState('');
    const valider = () => { if (code.trim()) connexion.saisirCode(code.trim()); };
    return (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(30,58,138,0.9)', zIndex: 300 }}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full" style={{ maxWidth: '420px' }}>
                <h2 className="text-2xl font-bold mb-2">🔒 Code de session</h2>
                <p className="text-gray-600 mb-4">Saisissez le code à 6 chiffres affiché sur le poste principal (fenêtre « 🌐 Mode réseau »), ou photographiez son code QR.</p>
                {connexion.codeRequis && connexion.codeRequis.erreur && <p className="text-red-600 font-semibold mb-2">⚠️ {connexion.codeRequis.erreur}</p>}
                <input autoFocus inputMode="numeric" maxLength={6} value={code} placeholder="000000"
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') valider(); }}
                    className="w-full text-center font-mono text-3xl tracking-widest border-2 border-blue-300 rounded-lg py-3 mb-4" />
                <button onClick={valider} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg">Se connecter</button>
            </div>
        </div>
    );
};
