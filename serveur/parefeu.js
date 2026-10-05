// ============================================
// PARE-FEU DU POSTE PRINCIPAL (mode réseau)
// ============================================
// Les autres postes doivent pouvoir joindre le serveur de ce poste (ports TCP 8080 à 8089).
// etat() lit la configuration sans droits particuliers ; autoriser() la corrige, avec la
// demande de confirmation du système (Windows : « Voulez-vous autoriser… » ; macOS : mot de
// passe administrateur).
//   Windows : règle entrante nommée comme l'application (identique à autoriser-pare-feu.cmd)
//   macOS   : pare-feu d'application (socketfilterfw) — désactivé par défaut, rien à faire alors
// Statuts : 'autorise', 'inutile' (pare-feu désactivé), 'absent' (aucune règle), 'bloque',
//           'inconnu' (système non géré ou lecture impossible)

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORTS = '8080-8089';
const SOCKETFILTERFW = '/usr/libexec/ApplicationFirewall/socketfilterfw';

const executer = (cmd, args, options = {}) => new Promise(resolve => {
    execFile(cmd, args, { windowsHide: true, timeout: 120000, ...options }, (erreur, sortie, sortieErreur) =>
        resolve({ code: erreur ? (typeof erreur.code === 'number' ? erreur.code : 1) : 0, sortie: String(sortie || ''), erreur: String(sortieErreur || '') }));
});

// nomRegle : nom de la règle Windows (celui de l'application) ; appMac : chemin du .app (macOS)
const creerPareFeu = ({ nomRegle, appMac = null, plateforme = process.platform }) => {
    const windows = {
        async etat() {
            const r = await executer('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${nomRegle}`], { encoding: 'latin1' });
            if (r.code !== 0) return { statut: 'absent' };
            // Sortie dans la langue de Windows (français / anglais) et l'encodage de la console
            // (« Activé », espace insécable avant « : » illisibles) : on ne s'appuie que sur le début
            // des libellés et sur les valeurs
            if (/^Action.{0,2}:\s*(Bloquer|Block)/im.test(r.sortie)) return { statut: 'bloque' };
            const active = /^(Activ|Enabled).{0,3}:\s*(Oui|Yes)/im.test(r.sortie);
            const autorise = /^Action.{0,2}:\s*(Autoriser|Allow)/im.test(r.sortie);
            const ports = /^LocalPort.{0,2}:\s*8080-8089/im.test(r.sortie);
            return { statut: active && autorise && ports ? 'autorise' : 'absent' };
        },
        async autoriser() {
            // Les mêmes commandes que autoriser-pare-feu.cmd, lancées avec les droits d'administrateur
            // (Windows demande confirmation) ; les règles du même nom sont d'abord retirées (dont un
            // éventuel « Bloquer » créé par Windows après un clic sur Annuler)
            const script = path.join(os.tmpdir(), `ssf-pare-feu-${process.pid}.cmd`);
            fs.writeFileSync(script, [
                '@echo off',
                `netsh advfirewall firewall delete rule name="${nomRegle}" >nul 2>&1`,
                `netsh advfirewall firewall add rule name="${nomRegle}" dir=in action=allow protocol=TCP localport=${PORTS} profile=any`,
            ].join('\r\n'), 'utf8');
            const r = await executer('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
                `try { Start-Process -FilePath '${script.replace(/'/g, "''")}' -Verb RunAs -Wait -WindowStyle Hidden -ErrorAction Stop } catch { exit 2 }`]);
            try { fs.unlinkSync(script); } catch (e) { /* déjà retiré */ }
            const etat = await windows.etat();
            if (r.code === 2 && etat.statut !== 'autorise') return { ...etat, refuse: true };
            return etat;
        },
    };

    const mac = {
        async etat() {
            if (!fs.existsSync(SOCKETFILTERFW)) return { statut: 'inconnu' };
            const g = await executer(SOCKETFILTERFW, ['--getglobalstate']);
            if (/disabled|désactivé|State = 0/i.test(g.sortie)) return { statut: 'inutile' };
            if (!appMac) return { statut: 'inconnu' };
            const a = await executer(SOCKETFILTERFW, ['--getappblocked', appMac]);
            if (/permitted|autoris/i.test(a.sortie)) return { statut: 'autorise' };
            if (/blocked|bloqu/i.test(a.sortie)) return { statut: 'bloque' };
            return { statut: 'absent' };
        },
        async autoriser() {
            if (!appMac) return { statut: 'inconnu' };
            const chemin = appMac.replace(/'/g, "'\\''");
            const commande = `${SOCKETFILTERFW} --add '${chemin}'; ${SOCKETFILTERFW} --unblockapp '${chemin}'`;
            const r = await executer('osascript', ['-e', `do shell script "${commande.replace(/"/g, '\\"')}" with administrator privileges`]);
            const etat = await mac.etat();
            if (r.code !== 0 && etat.statut !== 'autorise' && etat.statut !== 'inutile') return { ...etat, refuse: true };
            return etat;
        },
    };

    const systeme = plateforme === 'win32' ? windows : plateforme === 'darwin' ? mac : null;
    return {
        systeme: plateforme === 'win32' ? 'windows' : plateforme === 'darwin' ? 'macos' : 'autre',
        etat: async () => {
            if (!systeme) return { statut: 'inconnu' };
            try { return await systeme.etat(); } catch (e) { return { statut: 'inconnu' }; }
        },
        autoriser: async () => {
            if (!systeme) return { statut: 'inconnu' };
            try { return await systeme.autoriser(); } catch (e) { return { statut: 'inconnu', refuse: true }; }
        },
    };
};

module.exports = { creerPareFeu, PORTS };
