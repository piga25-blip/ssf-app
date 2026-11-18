// ============================================
// PROFIL DU RÉSEAU DU POSTE PRINCIPAL (Windows, mode réseau)
// ============================================
// Windows classe chaque réseau en « public » (tout réseau inconnu : nouvelle box, Wi-Fi d'un gîte,
// partage de connexion…), « privé » ou « domaine ». Sur un réseau public, Windows et certains
// antivirus bloquent plus facilement les autres postes.
//   lire()                  : profil de chaque connexion, sans droits particuliers
//                             → [{ interface, nom, profil: 'public'|'prive'|'domaine', bloqueTout }]
//                             bloqueTout : case « Bloquer toutes les connexions entrantes » cochée
//                             pour ce profil (aucune règle de pare-feu ne s'applique alors)
//   passerEnPrive(interface): passe ce réseau en privé, avec la demande de confirmation de Windows
// Autres systèmes : pas de profil (liste vide).
// simulation ('public' | 'prive') : pour les tests, profil imposé à toutes les connexions, sans
// appel à Windows ni demande de confirmation.

const { execFile } = require('child_process');
const os = require('os');

const PROFILS = { Public: 'public', Private: 'prive', DomainAuthenticated: 'domaine' };

// Commande PowerShell passée en -EncodedCommand (aucun problème de guillemets ni d'accents)
const encoder = (script) => Buffer.from(script, 'utf16le').toString('base64');

const powershell = (script, timeout = 30000) => new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoder(script)],
        { windowsHide: true, timeout, encoding: 'utf8' },
        (erreur, sortie) => resolve({ code: erreur ? (typeof erreur.code === 'number' ? erreur.code : 1) : 0, sortie: String(sortie || '') }));
});

const LECTURE = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$bloque = @{}
Get-NetFirewallProfile | ForEach-Object { $bloque[$_.Name.ToString()] = ($_.Enabled -and $_.AllowInboundRules.ToString() -eq 'False') }
$cle = @{ Public = 'Public'; Private = 'Private'; DomainAuthenticated = 'Domain' }
@(Get-NetConnectionProfile | ForEach-Object {
    $c = $_.NetworkCategory.ToString()
    [pscustomobject]@{ interface = $_.InterfaceAlias; nom = $_.Name; categorie = $c; bloqueTout = [bool]$bloque[$cle[$c]] }
}) | ConvertTo-Json -Compress
`;

const creerProfilReseau = ({ plateforme = process.platform, simulation = null } = {}) => {
    if (simulation) {
        let profil = simulation;
        return {
            lire: async () => Object.entries(os.networkInterfaces())
                .filter(([, l]) => (l || []).some(i => i.family === 'IPv4' && !i.internal))
                .map(([nom]) => ({ interface: nom, nom: 'Réseau d\'essai', profil, bloqueTout: false })),
            passerEnPrive: async () => { profil = 'prive'; return { refuse: false }; },
        };
    }
    if (plateforme !== 'win32') return { lire: async () => [], passerEnPrive: async () => ({ refuse: true }) };
    return {
        async lire() {
            try {
                const r = await powershell(LECTURE);
                if (r.code !== 0 || !r.sortie.trim()) return [];
                let liste = JSON.parse(r.sortie.trim());
                if (!Array.isArray(liste)) liste = [liste];
                return liste.filter(p => p && p.interface).map(p => ({
                    interface: String(p.interface), nom: String(p.nom || ''), profil: PROFILS[p.categorie] || 'inconnu', bloqueTout: !!p.bloqueTout,
                }));
            } catch (e) { return []; }
        },
        // Set-NetConnectionProfile demande les droits d'administrateur : lancé par Start-Process
        // -Verb RunAs (Windows demande « Voulez-vous autoriser… ») ; refus ou annulation → refuse
        async passerEnPrive(nomInterface) {
            const alias = String(nomInterface).replace(/'/g, "''");
            const interieur = encoder(`Set-NetConnectionProfile -InterfaceAlias '${alias}' -NetworkCategory Private`);
            const r = await powershell(`try { Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${interieur}' -Verb RunAs -Wait -WindowStyle Hidden -ErrorAction Stop } catch { exit 2 }`, 120000);
            return { refuse: r.code !== 0 };
        },
    };
};

module.exports = { creerProfilReseau };
