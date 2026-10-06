# Passage de la version réseau en version officielle (14.0.0)

Préparé le 05/10/2026, **publié le 05/10/2026** (release GitHub `v14.0.0`, Windows et Mac).
Ce document garde la trace de la préparation et liste ce qui reste à faire après la publication.

## 1. Les dossiers de travail

| Dossier | Branche | Rôle |
|---|---|---|
| `C:\Projets\SSF` | `main` | **Version officielle publiée (14.0.0)** : contient désormais le code réseau. Les corrections futures se font ici. |
| `C:\Projets\SSF-Reseau` | `reseau-local` | Ancienne version réseau **de test** (« Application SSF Reseau (test) ») ; garde les anciens films tournés avec la version de test. |
| `C:\Projets\SSF-v14` | `version-14` | Branche de préparation de la 14 ; `main` a été avancé dessus. N'est plus nécessaire pour publier. |

## 2. Ce qui change pour les utilisateurs

- **Les données ne sont plus dans la mémoire du navigateur intégré** mais dans des fichiers :
  `%APPDATA%\Application SSF\secours\…` (un dossier par secours, avec un journal des modifications).
- **Au premier lancement de la 14**, les secours de la 13 sont repris automatiquement (fenêtre
  invisible, quelques secondes). L'ancienne mémoire n'est **jamais effacée**.
- **Utilisation sur un seul PC : identique.** Le mode réseau est désactivé par défaut.
- **Mode réseau** (nouveau, facultatif) : bouton « 🌐 Mode réseau » ; tablettes et autres PC par le
  navigateur (code QR, code de session, rôles saisie / consultation) ; pare-feu réglé
  automatiquement à l'activation.

## 3. Ce qui a été fait avant la publication

| Élément | État |
|---|---|
| Identité officielle dans `version-14` : `productName` « Application SSF », `appId` `fr.ssf.app`, nom de raccourci, titre de la fenêtre, mise à jour automatique **réactivée**, publication GitHub **réactivée**, version **14.0.0** | ✅ |
| Dossier de données : celui de la version officielle (`%APPDATA%\Application SSF`), découle du `productName` | ✅ |
| Règle du pare-feu : nom de l'application (« Application SSF ») | ✅ automatique |
| Tests automatiques (`npm test`, 14 vérifications dont le scénario de référence) | ✅ 05/10/2026 |
| **Répétition générale de la mise à jour** : un secours créé par la vraie 13.42.1 est repris à l'identique (événements, sauveteurs, équipes, points phones, planning, infos, réglages du poste), pas de seconde reprise, secours rouvert à l'écran — `node tests/repetition-mise-a-jour/repetition.js` | ✅ réussie |
| Essai réel du mode réseau (PC + tablette sur Livebox, pare-feu automatique) | ✅ (version de test) |
| **Essai pilote** : 14.0.0 installée par-dessus une 13.42.1 sur un PC portable contenant le dernier gros exercice — « tout fonctionne, même le réseau » (kit `dist/Kit-essai-pilote`, fiche `docs/essai-pilote`) | ✅ 05/10/2026 |
| **Notice de mise à jour** (Windows et Mac) : document Claude + export Word `docs/Notice_MiseAJour_SSF_14.docx` (non suivi par git) | ✅ |
| Films de formation : logiciel (8 films) et mode réseau (3 films) | ✅ tournés avec la version de test, puis **retournés avec la 14.0.0** après la publication (voir §6) |
| Décision Mac : la 14.0.0 sort pour Windows **et** Mac | ✅ |

## 4. La publication (05/10/2026)

1. `main` avancé sur `version-14` (avance rapide, commit `863118e`) et poussé.
2. `npm install` dans `C:\Projets\SSF` : indispensable, car les modules `ws` et `qrcode` du
   serveur intégré n'y étaient pas encore installés — sans eux, l'application publiée aurait
   planté au démarrage.
3. Contrôle de l'application construite avant publication : contenu de `app.asar` (`ws`, `qrcode`,
   `electron-updater` présents, `playwright` absent, mise à jour automatique active) et essai de
   l'exe construit (démarrage, enregistrement en fichiers, mode réseau, page servie aux autres postes).
4. `npm run publish` : release **`v14.0.0`** marquée « Latest », installateur Windows +
   `latest.yml` — les PC équipés proposent la mise à jour.
5. Version Mac créée automatiquement par `build-mac.yml` (déclencheur `release: published`) :
   `.dmg` et `.zip` puce Apple (`arm64`) et Intel, `latest-mac.yml`. ✅ réussie.

## 5. Installation chez les nouveaux utilisateurs

Fichiers à fournir, réunis dans `dist/A-distribuer-nouveaux-utilisateurs/` (non suivi par git) :

- **Windows** : `SSF-Bootstrap.exe` (source `bootstrapper/`, compilé par `bootstrapper/compile.ps1`).
  Il télécharge toujours la dernière version publiée : pas besoin de le recompiler à chaque version.
  Corrigé le 05/10/2026 après un essai sur portable où il affichait « Installation réussie » sans
  que l'application soit installée : il vérifie désormais l'installation réelle, réessaie trois
  fois en cas de connexion difficile, contrôle la taille du téléchargement et ne demande plus
  lui-même les droits d'administrateur.
- **Mac** : `SSF-Bootstrap-app-mac.zip` (recommandé) ou `SSF-Bootstrap-command-mac.zip`, produits
  par le workflow « Package macOS bootstrapper » (artefact conservé 90 jours sur GitHub ; dernier
  lancement le 05/10/2026).
- `LISEZ-MOI.txt` : marche à suivre.
- Sans bootstrapper : https://github.com/piga25-blip/ssf-app/releases/latest

En cas d'installation douteuse sur un PC : `dist/Diagnostic/diagnostic-ssf.cmd` (lecture seule)
écrit sur le Bureau où l'application est installée, sous quel compte, et où sont les données.

## 6. Fait après la publication

- **Bootstrapper Windows corrigé** (§5) et bootstrapper Mac refabriqué (05/10/2026).
- **Films de formation retournés avec la 14.0.0** (05/10/2026), depuis `C:\Projets\SSF` :
  les 11 films (8 « Le logiciel SSF » + 3 « Le mode réseau ») et les deux films complets, titre
  « Version 14.0.0 ». Pour les refaire : `npm run formation:tourner` puis
  `npm run formation:monter` (environ 2 h en tout) ; résultat dans
  `tests/film/sortie/tutoriels/` (non suivi par git). Copies de diffusion :
  `E:\Vidéos\SSF-Films-de-formation\`.
- **Films des scénarios de test retournés avec la 14.0.0** (05/10/2026), depuis `C:\Projets\SSF` :
  les 13 scénarios, tous réussis, film complet de 14,6 min + un film par scénario. Pour les
  refaire : `npm run film:tourner` puis `npm run film:monter` (environ 20 min) ; résultat dans
  `tests/film/sortie/` (non suivi par git). Copies : `E:\Vidéos\SSF-Reseau-scenarios.mp4` et
  `E:\Vidéos\SSF-Reseau-scenarios\` (noms lisibles, copiés à la main).

## 7. Reste à faire

- **Essai sur un vrai Mac** : ni l'application 14 (serveur intégré, reprise des données, pare-feu
  macOS — partie Mac de `serveur/parefeu.js`) ni le bootstrapper Mac n'ont été essayés sur un Mac.
- **Bootstrapper Windows corrigé** : l'installation complète n'a pas encore été faite avec la
  nouvelle version (à vérifier à la prochaine installation).
- Désinstaller « Application SSF Reseau (test) » des PC d'essai et retirer sa règle de pare-feu
  (`retirer-pare-feu.cmd` du kit) : la 14 crée sa propre règle « Application SSF ».
- Le kit d'essai terrain (`docs/essai-terrain`) parle encore de la version de test : à mettre à
  jour ou à archiver.
- Les données de la version de test (`%APPDATA%\Application SSF Reseau (test)`) ne sont **pas**
  reprises par la 14 : exporter avant (« Exporter Tout ») ce qui doit être gardé.

## 8. Retour en arrière, en cas de problème

- La mise à jour automatique ne sait pas revenir à une version plus ancienne : un problème se
  corrige en publiant une **14.0.1** (depuis `C:\Projets\SSF`, `main`).
- En urgence sur un PC : réinstaller la 13.42.1 (release GitHub v13.42.1). Comme l'ancienne
  mémoire n'est jamais effacée, la 13 retrouve les secours **tels qu'ils étaient avant la mise à
  jour** ; ce qui a été saisi avec la 14 serait à reprendre par « Exporter Tout » (14) puis
  « Importer Tout » (13) — **compatibilité de ce chemin non vérifiée** : à essayer avant d'en
  dépendre.
