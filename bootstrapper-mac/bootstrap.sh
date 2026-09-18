#!/bin/bash
# ======================================================================
# SSF Bootstrap (macOS)
# Télécharge et installe automatiquement la dernière version de SSF
# depuis GitHub Releases : piga25-blip/ssf-app
#
# Équivalent macOS de bootstrapper/bootstrap.nsi (Windows/NSIS).
# ======================================================================
set -euo pipefail

APP_NAME="Application SSF"
REPO="piga25-blip/ssf-app"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"
INSTALLED_APP="/Applications/${APP_NAME}.app"

WORK_DIR="$(mktemp -d /tmp/ssf_bootstrap.XXXXXX)"
MOUNT_POINT=""

# Le script est copié à la fois dans SSF-Bootstrap.app/Contents/MacOS/ (avec
# pick_asset.js dans ../Resources) et, en secours, en .command autonome à côté
# de pick_asset.js dans le même dossier. On essaie les deux emplacements.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PICK_ASSET_JS=""
for candidate in "$SCRIPT_DIR/../Resources/pick_asset.js" "$SCRIPT_DIR/pick_asset.js"; do
    if [ -f "$candidate" ]; then
        PICK_ASSET_JS="$candidate"
        break
    fi
done

cleanup() {
    if [ -n "$MOUNT_POINT" ]; then
        hdiutil detach "$MOUNT_POINT" -quiet -force >/dev/null 2>&1 || true
    fi
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

notify() {
    # $1 = message (affiché en notification macOS, non bloquant)
    local msg="$1"
    osascript <<EOF >/dev/null 2>&1 || true
display notification "$msg" with title "SSF Bootstrap"
EOF
}

fatal() {
    local msg="$1"
    osascript <<EOF >/dev/null 2>&1 || true
display dialog "$msg" with title "SSF Bootstrap — Erreur" buttons {"OK"} default button 1 with icon stop
EOF
    exit 1
}

if [ -z "$PICK_ASSET_JS" ]; then
    fatal "Fichier interne manquant (pick_asset.js). Réinstallez SSF-Bootstrap."
fi

# ---------- Écran de bienvenue ----------
if ! osascript <<'EOF' >/dev/null 2>&1
display dialog "Cet assistant va télécharger et installer automatiquement la dernière version de Application SSF.

Une connexion internet est requise.

Cliquez sur Installer pour continuer." with title "Application SSF — Installation" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler"
EOF
then
    exit 0
fi

# ---------- Étape 0 : détecter l'architecture ----------
ARCH_RAW="$(uname -m)"
if [ "$ARCH_RAW" = "arm64" ]; then
    IS_ARM="true"
else
    IS_ARM="false"
fi

# ---------- Étape 1 : interroger l'API GitHub ----------
notify "Connexion à GitHub…"

RELEASE_JSON="$WORK_DIR/release.json"
if ! curl -fsSL --connect-timeout 15 -H "User-Agent: SSF-Bootstrap-Mac/1.0" \
    -H "Accept: application/vnd.github+json" "$API_URL" -o "$RELEASE_JSON"; then
    fatal "Impossible de contacter GitHub.

Vérifiez votre connexion internet et réessayez."
fi

PICK_RESULT="$(osascript -l JavaScript "$PICK_ASSET_JS" "$RELEASE_JSON" "$IS_ARM" 2>/dev/null || true)"

case "$PICK_RESULT" in
    ERROR::*)
        fatal "${PICK_RESULT#ERROR::}"
        ;;
    "")
        fatal "Impossible d'analyser la réponse de GitHub."
        ;;
esac

DMG_URL="$(printf '%s\n' "$PICK_RESULT" | sed -n '1p')"
DMG_NAME="$(printf '%s\n' "$PICK_RESULT" | sed -n '2p')"
TAG_NAME="$(printf '%s\n' "$PICK_RESULT" | sed -n '3p')"

if [ -z "$DMG_URL" ] || [ -z "$DMG_NAME" ]; then
    fatal "Impossible de déterminer le fichier à télécharger."
fi

notify "Version $TAG_NAME trouvée."

# ---------- Étape 2 : télécharger le .dmg (avec progression) ----------
notify "Téléchargement de $DMG_NAME…"

DMG_PATH="$WORK_DIR/$DMG_NAME"

CONTENT_LENGTH="$(curl -fsSIL --connect-timeout 15 -H "User-Agent: SSF-Bootstrap-Mac/1.0" "$DMG_URL" 2>/dev/null \
    | tr -d '\r' | awk -F': ' 'tolower($1) == "content-length" { v = $2 } END { print v }')"

set +e
curl -fsSL -H "User-Agent: SSF-Bootstrap-Mac/1.0" "$DMG_URL" -o "$DMG_PATH" &
CURL_PID=$!

LAST_DECILE=-1
while kill -0 "$CURL_PID" 2>/dev/null; do
    if [ -f "$DMG_PATH" ] && [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ] 2>/dev/null; then
        CUR_SIZE="$(stat -f%z "$DMG_PATH" 2>/dev/null || echo 0)"
        PCT=$(( CUR_SIZE * 100 / CONTENT_LENGTH ))
        DECILE=$(( PCT / 10 ))
        if [ "$DECILE" != "$LAST_DECILE" ]; then
            notify "Téléchargement… ${PCT}%"
            LAST_DECILE=$DECILE
        fi
    fi
    sleep 1
done
wait "$CURL_PID"
CURL_STATUS=$?
set -e

if [ "$CURL_STATUS" -ne 0 ] || [ ! -s "$DMG_PATH" ]; then
    fatal "Erreur lors du téléchargement de $DMG_NAME.

Vérifiez votre connexion internet et réessayez."
fi

notify "Téléchargement terminé."

# ---------- Étape 3 : monter l'image disque ----------
notify "Montage de l'image disque…"

MOUNT_POINT="$(hdiutil attach "$DMG_PATH" -nobrowse -readonly 2>/dev/null | grep -Eo '/Volumes/.*$' | tail -1)"

if [ -z "$MOUNT_POINT" ] || [ ! -d "$MOUNT_POINT" ]; then
    fatal "Impossible de monter l'image disque téléchargée."
fi

SRC_APP="$(find "$MOUNT_POINT" -maxdepth 1 -iname '*.app' | head -n 1)"
if [ -z "$SRC_APP" ]; then
    fatal "Aucune application trouvée dans l'image disque."
fi

# ---------- Étape 4 : installer dans /Applications ----------
notify "Installation dans /Applications…"

if [ -d "$INSTALLED_APP" ]; then
    rm -rf "$INSTALLED_APP"
fi
if ! cp -R "$SRC_APP" "$INSTALLED_APP"; then
    fatal "Impossible de copier l'application vers /Applications.

Vérifiez que vous avez les droits d'écriture sur ce dossier."
fi

hdiutil detach "$MOUNT_POINT" -quiet -force >/dev/null 2>&1 || true
MOUNT_POINT=""

# Retire l'attribut de quarantine hérité du .dmg téléchargé : sans ça,
# Gatekeeper bloquerait l'app installée (non signée/notariée) au premier
# lancement avec "développeur non identifié".
xattr -cr "$INSTALLED_APP" 2>/dev/null || true

# ---------- Étape 5 : terminer ----------
osascript <<EOF >/dev/null 2>&1 || true
display dialog "Application SSF (version ${TAG_NAME}) a été installée avec succès." with title "Installation réussie" buttons {"OK"} default button 1 with icon note
EOF

# `open` peut échouer juste après le xattr -cr ci-dessus si macOS n'a pas
# encore rafraîchi son cache Launch Services pour cette app tout juste
# copiée/modifiée. On retente quelques fois avant d'abandonner — et si ça
# échoue quand même, on prévient l'utilisateur au lieu de rester silencieux
# (l'installation, elle, a bien réussi : ce n'est pas une erreur fatale).
OPEN_OK=false
for attempt in 1 2 3; do
    if open "$INSTALLED_APP" 2>/dev/null; then
        OPEN_OK=true
        break
    fi
    sleep 1
done

if [ "$OPEN_OK" = false ]; then
    osascript <<EOF >/dev/null 2>&1 || true
display dialog "Application SSF a bien été installée dans /Applications, mais n'a pas pu être lancée automatiquement.

Ouvrez-la manuellement depuis le Finder ou le Launchpad." with title "SSF Bootstrap" buttons {"OK"} default button 1 with icon caution
EOF
fi
