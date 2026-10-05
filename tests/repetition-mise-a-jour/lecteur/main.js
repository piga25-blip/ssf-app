// Lit (sans rien modifier) les secours rangés dans la mémoire file:// d'un dossier de données
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.setPath('userData', process.env.DONNEES);
app.whenReady().then(async () => {
    const w = new BrowserWindow({ show: false });
    await w.loadFile(path.join(__dirname, 'page.html'));
    const res = await w.webContents.executeJavaScript(`(() => { const process_tout = ${process.env.TOUT === '1'};
        const out = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (process_tout) { out.push({ cle: k, taille: (localStorage.getItem(k) || '').length }); continue; }
            if (!k.startsWith('SSF_UNIFIED_STATE_')) continue;
            try { const d = JSON.parse(localStorage.getItem(k));
                out.push({ cle: k, rescueId: d.rescueId || null, evenements: (d.events || []).length, sauveteurs: (d.masterSauveteursList || []).length, equipes: (d.teams || []).length });
            } catch (e) { out.push({ cle: k, erreur: e.message }); }
        }
        return out;
    })()`);
    console.log('RESULTAT ' + JSON.stringify(res));
    app.quit();
});
