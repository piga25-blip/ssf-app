// ============================================
// COUCHE D'ACCÈS AU localStorage
// ============================================
// Toutes les opérations sont protégées par try/catch.
// En navigation privée ou quota dépassé, les fonctions échouent
// silencieusement (log console) et renvoient une valeur neutre
// plutôt que de faire crasher l'application.
//
// Clés utilisées dans l'application :
//   'ssf_current_secretaire'        — nom du secrétaire (string)
//   'ssf_autosave_interval'         — intervalle autosave en minutes (string)
//   'ssf_auto_saves'                — sauvegardes automatiques (JSON array)
//   'ssf_standalone_mode'           — mode standalone (string)
//   'ssf_standalone_id'             — identifiant standalone (string)
//   'ssf_planning_scroll'           — position scroll planning (string)
//   'ssf_mission_keywords'          — mots-clés mission personnalisés (JSON array)
//   'SSF_UNIFIED_STATE_<id>_V<n>'   — état complet d'un secours (JSON object)

// Lit une valeur brute (string). Renvoie defaultValue si clé absente ou accès impossible.
const storageGet = (key, defaultValue = null) => {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
    } catch (e) {
        console.warn(`[storage] getItem("${key}") échoué :`, e);
        return defaultValue;
    }
};

// Lit et désérialise une valeur JSON. Renvoie defaultValue si clé absente, JSON invalide ou accès impossible.
const storageGetJSON = (key, defaultValue = null) => {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch (e) {
        console.warn(`[storage] getJSON("${key}") échoué :`, e);
        return defaultValue;
    }
};

// Écrit une valeur brute (convertie en string). Renvoie true si succès, false sinon.
const storageSet = (key, value) => {
    try {
        localStorage.setItem(key, String(value));
        return true;
    } catch (e) {
        console.warn(`[storage] setItem("${key}") échoué :`, e);
        return false;
    }
};

// Sérialise en JSON et écrit. Renvoie true si succès, false sinon (ex. QuotaExceededError).
const storageSetJSON = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn(`[storage] setJSON("${key}") échoué :`, e);
        return false;
    }
};

// Supprime une clé. Renvoie true si succès, false sinon.
const storageRemove = (key) => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.warn(`[storage] removeItem("${key}") échoué :`, e);
        return false;
    }
};

// Vide tout le localStorage. Renvoie true si succès, false sinon.
const storageClear = () => {
    try {
        localStorage.clear();
        return true;
    } catch (e) {
        console.warn('[storage] clear() échoué :', e);
        return false;
    }
};

// Renomme une clé de façon atomique (copie vers newKey puis supprime oldKey).
// Si la copie échoue, oldKey est conservée intacte. Renvoie true si succès.
const storageRenameKey = (oldKey, newKey) => {
    try {
        const data = localStorage.getItem(oldKey);
        if (data === null) return false;
        localStorage.setItem(newKey, data);
        localStorage.removeItem(oldKey);
        return true;
    } catch (e) {
        console.warn(`[storage] renameKey("${oldKey}" → "${newKey}") échoué :`, e);
        return false;
    }
};

// Retourne un tableau de { key, raw } pour toutes les clés commençant par prefix.
// En cas d'erreur d'accès (navigation privée stricte), renvoie [].
const storageGetAllByPrefix = (prefix) => {
    try {
        const results = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                try {
                    results.push({ key, raw: localStorage.getItem(key) });
                } catch (e) {
                    console.warn(`[storage] getItem("${key}") lors de l'énumération échoué :`, e);
                }
            }
        }
        return results;
    } catch (e) {
        console.warn(`[storage] getAllByPrefix("${prefix}") échoué :`, e);
        return [];
    }
};
