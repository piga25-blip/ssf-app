const UpdateNotifier = () => {
  const [etat, setEtat] = React.useState('idle'); // idle | disponible | telechargement | pret
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

  const handleClick = () => {
    if (etat === 'pret') window.electronAPI.installUpdate();
  };

  const bgColor = etat === 'pret'
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
        cursor: etat === 'telechargement' ? 'default' : 'pointer',
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
          <span>Mise à jour v{nouvelleVersion} disponible — Cliquez pour télécharger</span>
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
    </div>
  );
};

ReactDOM.render(<UpdateNotifier />, document.getElementById('update-root'));
