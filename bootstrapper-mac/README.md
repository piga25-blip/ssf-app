# SSF Bootstrap (macOS)

Équivalent macOS de `bootstrapper/bootstrap.nsi` (Windows). Télécharge et
installe automatiquement la dernière version d'Application SSF depuis
GitHub Releases (`piga25-blip/ssf-app`).

## Fichiers

- **`SSF-Bootstrap.app`** — version recommandée. Double-clic dans le Finder,
  aucune fenêtre de Terminal ne s'ouvre. Tous les messages passent par des
  notifications/dialogues macOS natifs (`osascript`).
- **`SSF-Bootstrap.command`** — version de secours identique en logique,
  mais ouvre une fenêtre Terminal visible pendant l'exécution. À utiliser
  si `.app` pose un souci sur une version de macOS donnée.
- `bootstrap.sh` — script source partagé par les deux (copié tel quel dans
  `SSF-Bootstrap.app/Contents/MacOS/SSF-Bootstrap` et dans `.command`).
- `pick_asset.js` — petit script JXA (JavaScript for Automation) qui
  parse la réponse JSON de l'API GitHub et choisit le bon `.dmg` selon
  l'architecture (`-arm64.dmg` pour Apple Silicon, `.dmg` simple pour Intel).

## Ce que fait le script

1. Boîte de dialogue de bienvenue (Installer / Annuler).
2. Détecte l'architecture (`uname -m` : `arm64` ou `x86_64`).
3. Interroge `GET /repos/piga25-blip/ssf-app/releases/latest`, choisit
   l'asset `.dmg` correspondant à l'architecture.
4. Télécharge le `.dmg` (notifications de progression tous les ~10%).
5. Monte l'image disque (`hdiutil attach`), copie l'app dans
   `/Applications` (remplace une version existante).
6. `xattr -cr` sur l'app installée pour retirer l'attribut de quarantine
   hérité du téléchargement — **sans ça, Gatekeeper bloquerait l'app à
   chaque lancement** (elle n'est pas signée/notariée, pas de compte
   Apple Developer).
7. Démonte l'image, nettoie les fichiers temporaires, lance l'app.

## ⚠️ Limite importante : Gatekeeper sur le bootstrapper lui-même

L'étape 6 (`xattr -cr`) protège l'**app installée** (SSF), mais ne peut pas
protéger **le bootstrapper lui-même** : dès qu'il est téléchargé (navigateur,
email, AirDrop…), macOS lui appose aussi l'attribut de quarantine — comme il
n'est pas signé/notarié non plus, son tout premier lancement déclenchera très
probablement le même blocage Gatekeeper que l'app.

**Ce n'est pas contournable sans compte Apple Developer** (99 $/an, pour
signer + notarier au moins le bootstrapper). En pratique :

- La première fois qu'un utilisateur reçoit `SSF-Bootstrap.app`, il devra
  faire **clic droit > Ouvrir** une fois (au lieu d'un double-clic).
- Ensuite, s'il **garde ce même fichier** et le relance pour les mises à
  jour futures, macOS ne le rebloquera pas (l'approbation Gatekeeper est
  mémorisée pour ce fichier précis) — double-clic normal à chaque fois.
- Si l'utilisateur re-télécharge une copie fraîche du bootstrapper plus
  tard, il refera un clic droit > Ouvrir une fois pour cette nouvelle copie.

Donc le bootstrapper ne supprime pas le clic droit ponctuel, il le déplace :
un seul clic droit sur le bootstrapper (réutilisable indéfiniment), au lieu
d'un clic droit à chaque nouvelle version de l'app elle-même.

## Empaqueter pour distribution

Le zip doit être créé **sur macOS** (`ditto` ou le Finder) pour conserver le
bit d'exécution et les métadonnées du bundle — un zip fait depuis Windows
(`Compress-Archive`) casse l'app. Comme ce dépôt est développé sous Windows,
utilisez le workflow GitHub Actions dédié :

```
gh workflow run package-mac-bootstrap.yml --repo piga25-blip/ssf-app
```

Puis récupérez l'artefact `SSF-Bootstrap-mac` (contient les deux zips) sur
la page du run, ou via :

```
gh run download --repo piga25-blip/ssf-app --name SSF-Bootstrap-mac
```

## Prérequis côté utilisateur

Aucun — tout repose sur des outils déjà présents sur macOS (`curl`,
`hdiutil`, `xattr`, `osascript`, `bash`). Pas de Homebrew, Xcode Command
Line Tools ou Python nécessaires.
