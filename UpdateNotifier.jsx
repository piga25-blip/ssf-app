const UpdateNotifier = () => {
  const [etat, setEtat] = React.useState('idle'); // idle | disponible | telechargement | pret | installation
  const [nouvelleVersion, setNouvelleVersion] = React.useState('');
  const [progression, setProgression] = React.useState(0);

  React.useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable((version) => {
      setNouvelleVersion(version);
      setEtat('disponible');
    });

    window.electronAPI.onUpdateProgress((percent) => {
      setProgression(percent);
      setEtat('telechargement');
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setEtat('pret');
    });
  }, []);

  if (!window.electronAPI || etat === 'idle') return null;

  // Le clic est confirmé tout de suite (« Installation en cours… ») et les clics suivants sont
  // ignorés ; si la mise à jour est reportée (mode réseau actif), le bandeau redevient cliquable
  const handleClick = async () => {
    if (etat !== 'pret') return;
    setEtat('installation');
    try {
      const reponse = await window.electronAPI.installUpdate();
      if (reponse && reponse.reporte) setEtat('pret');
    } catch (e) {
      setEtat('pret');
    }
  };

  const bgColor = etat === 'pret' || etat === 'installation'
    ? '#15803d'
    : etat === 'telechargement'
    ? '#1d4ed8'
    : '#d97706';

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed', top: '12px', right: '12px', zIndex: 99999,
        backgroundColor: bgColor,
        color: 'white', borderRadius: '8px', padding: '10px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        cursor: etat === 'pret' ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: '10px',
        fontSize: '13px', fontWeight: '600',
        transition: 'background-color 0.3s',
        minWidth: '240px',
        userSelect: 'none',
      }}
    >
      {etat === 'disponible' && (
        <>
          <span style={{ fontSize: '16px' }}>⬆</span>
          <span>Mise à jour v{nouvelleVersion} disponible — téléchargement en cours…</span>
        </>
      )}
      {etat === 'telechargement' && (
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: '4px' }}>Téléchargement... {progression}%</div>
          <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '4px', height: '4px' }}>
            <div style={{ background: 'white', borderRadius: '4px', height: '4px', width: `${progression}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      {etat === 'pret' && (
        <>
          <span style={{ fontSize: '16px' }}>✓</span>
          <span>Mise à jour prête — Cliquez pour redémarrer</span>
        </>
      )}
      {etat === 'installation' && (
        <>
          <span style={{ fontSize: '16px' }}>⏳</span>
          <span>Installation en cours… L'application va se fermer puis redémarrer toute seule. Merci de patienter.</span>
        </>
      )}
    </div>
  );
};

ReactDOM.render(<UpdateNotifier />, document.getElementById('update-root'));
