// pick_asset.js — appelé via `osascript -l JavaScript pick_asset.js <release.json> <true|false>`
// Lit la réponse JSON de l'API GitHub (releases/latest) et choisit le bon .dmg
// selon l'architecture : suffixe "-arm64.dmg" pour Apple Silicon, ".dmg" simple
// (sans -arm64) pour Intel. Imprime "URL\nNOM\nTAG" sur 3 lignes, ou
// "ERROR::message" en cas de problème.

function run(argv) {
    ObjC.import('Foundation')
    var app = Application.currentApplication()
    app.includeStandardAdditions = true

    var jsonPath = argv[0]
    var wantArm64 = argv[1] === 'true'

    var jsonText
    try {
        jsonText = app.read(Path(jsonPath))
    } catch (e) {
        return "ERROR::Impossible de lire la réponse de GitHub."
    }

    var data
    try {
        data = JSON.parse(jsonText)
    } catch (e) {
        return "ERROR::Réponse de GitHub invalide (JSON illisible)."
    }

    if (data.message && !data.assets) {
        // Réponse d'erreur de l'API GitHub (ex: rate limit, repo introuvable)
        return "ERROR::GitHub a répondu : " + data.message
    }

    if (!data.assets || data.assets.length === 0) {
        return "ERROR::Aucune release trouvée sur GitHub."
    }

    var asset = null
    for (var i = 0; i < data.assets.length; i++) {
        var n = data.assets[i].name
        if (!/\.dmg$/.test(n)) continue
        var isArm = /-arm64\.dmg$/.test(n)
        if (wantArm64 === isArm) {
            asset = data.assets[i]
            break
        }
    }

    if (!asset) {
        var archLabel = wantArm64 ? "Apple Silicon (arm64)" : "Intel (x86_64)"
        return "ERROR::Aucun fichier .dmg pour " + archLabel + " trouvé dans la dernière release."
    }

    return asset.browser_download_url + "\n" + asset.name + "\n" + data.tag_name
}
