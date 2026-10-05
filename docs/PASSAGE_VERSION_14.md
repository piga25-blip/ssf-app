# Passage de la version réseau en version officielle (14.0.0)

Préparé le 05/10/2026. **Rien n'est publié** : ce document liste ce qui est prêt, ce qui reste
à décider et la marche à suivre le jour de la publication.

## 1. Les trois dossiers de travail

| Dossier | Branche | Rôle |
|---|---|---|
| `C:\Projets\SSF` | `main` | Version officielle publiée (13.42.1). Ne change pas avant la publication. |
| `C:\Projets\SSF-Reseau` | `reseau-local` | Version réseau **de test** (« Application SSF Reseau (test) »), utilisée pour les essais et les films. |
| `C:\Projets\SSF-v14` | `version-14` | **Version 14 prête à publier** : le code de `reseau-local` avec l'identité officielle. |

`reseau-local` contient toutes les corrections de `main` (fusion de la 13.42.1 faite le 05/10/2026).
Toute correction future faite dans `reseau-local` devra être reportée dans `version-14`
(`git merge reseau-local` depuis `C:\Projets\SSF-v14`).

## 2. Ce qui change pour les utilisateurs

- **Les données ne sont plus dans la mémoire du navigateur intégré** mais dans des fichiers :
  `%APPDATA%\Application SSF\secours\…` (un dossier par secours, avec un journal des modifications).
- **Au premier lancement de la 14**, les secours de la 13 sont repris automatiquement (fenêtre
  invisible, quelques secondes). L'ancienne mémoire n'est **jamais effacée**.
- **Utilisation sur un seul PC : identique.** Le mode réseau est désactivé par défaut.
- **Mode réseau** (nouveau, facultatif) : bouton « 🌐 Mode réseau » ; tablettes et autres PC par le
  navigateur (code QR, code de session, rôles saisie / consultation) ; pare-feu réglé
  automatiquement à l'activation.

## 3. Ce qui est fait

| Élément | État |
|---|---|
| Identité officielle remise dans `version-14` : `productName` « Application SSF », `appId` `fr.ssf.app`, nom de raccourci, titre de la fenêtre, mise à jour automatique **réactivée**, publication GitHub **réactivée**, version **14.0.0** | ✅ fait |
| Dossier de données : celui de la version officielle (`%APPDATA%\Application SSF`), découle du `productName` | ✅ |
| Règle du pare-feu : nom de l'application (« Application SSF ») | ✅ automatique |
| Tests automatiques sur `version-14` (`npm test`, 14 vérifications dont le scénario de référence) | ✅ 05/10/2026 — seul l'affichage « autorisés » du pare-feu est sauté (règle « Application SSF » pas encore créée sur ce PC) |
| **Répétition générale de la mise à jour** : un secours créé par la vraie 13.42.1 est repris à l'identique (événements, sauveteurs, équipes, points phones, planning, infos, réglages du poste), pas de seconde reprise, secours rouvert à l'écran — `node tests/repetition-mise-a-jour/repetition.js` | ✅ réussie |
| Essai réel du mode réseau (PC + tablette sur Livebox, pare-feu automatique) | ✅ (version de test) |
| Films de formation : logiciel (8 films) et mode réseau (3 films) | ✅ (tournés avec la version de test : titre « RÉSEAU (TEST) » visible) |

Note : sur le PC de développement, la version officielle installée ne contient actuellement
**aucun secours** (seulement des réglages) ; la répétition a donc été faite avec un secours
fabriqué par la version officielle elle-même, dans un dossier temporaire.

## 4. Décisions à prendre avant de publier

1. **Mac — décidé le 05/10/2026 : la 14.0.0 sort pour Windows ET Mac** (notice rédigée en ce
   sens). La version Mac est créée **automatiquement** à la publication
   (`.github/workflows/build-mac.yml`, déclencheur `release: published`). ⚠️ Elle n'a jamais été
   essayée sur un Mac (serveur intégré, reprise des données, pare-feu macOS — module
   `serveur/parefeu.js`, partie Mac non testée) : un essai sur un Mac avant la publication reste
   fortement conseillé (installateur produit à la main par le workflow `workflow_dispatch`).
2. **Essai pilote — FAIT le 05/10/2026, réussi** : sur un PC portable contenant le dernier gros exercice, « tout fonctionne, même le réseau » (kit `dist/Kit-essai-pilote`, fiche `docs/essai-pilote`). Rappel de la démarche : installer la 14.0.0 **par-dessus une
   13.42.1 qui contient de vrais secours**, vérifier que tout est là, puis essayer le mode réseau.
   ⚠️ L'installateur 14 a la même identité que la version officielle : il la **remplace**. Avant
   l'essai : « Exporter Tout » de chaque secours important et copie du dossier
   `%APPDATA%\Application SSF`.
3. **Notice de mise à jour** pour les utilisateurs (comme `Notice_MiseAJour_SSF.docx`) : ce qui
   change, le mode réseau en 5 étapes, le pare-feu, les films.
4. **Films** : les garder tels quels (version de test) ou les retourner avec la 14 (même outillage :
   `npm run formation:tourner` puis `npm run formation:monter`, environ 2 h en tout).

## 5. Le jour de la publication (après les décisions du §4)

1. Dans `C:\Projets\SSF-v14` : `npm test` complet, puis la répétition générale.
2. Fusion dans `main` (avance rapide, `main` est déjà contenu dans `version-14`) :
   `git -C C:\Projets\SSF merge --ff-only version-14`, puis `git push origin main`.
3. Publication Windows depuis `C:\Projets\SSF` : `GH_TOKEN=… npm run publish` (crée la release
   `v14.0.0`, installateur + `latest.yml` : les PC équipés proposeront la mise à jour).
4. Mac : selon la décision du §4.1.
5. Vérifier la release (pas en brouillon, `latest.yml` présent), puis installer la mise à jour sur
   un PC et rouvrir un secours existant.

## 6. Après la publication

- Désinstaller « Application SSF Reseau (test) » des PC d'essai et retirer sa règle de pare-feu
  (`retirer-pare-feu.cmd` du kit) : la 14 crée sa propre règle « Application SSF ».
- Le kit d'essai terrain (`docs/essai-terrain`) parle encore de la version de test : à mettre à
  jour ou à archiver.
- Les données de la version de test (`%APPDATA%\Application SSF Reseau (test)`) ne sont **pas**
  reprises par la 14 : exporter avant (« Exporter Tout ») ce qui doit être gardé.

## 7. Retour en arrière, en cas de problème

- La mise à jour automatique ne sait pas revenir à une version plus ancienne : un problème se
  corrige en publiant une **14.0.1**.
- En urgence sur un PC : réinstaller la 13.42.1 (release GitHub v13.42.1). Comme l'ancienne
  mémoire n'est jamais effacée, la 13 retrouve les secours **tels qu'ils étaient avant la mise à
  jour** ; ce qui a été saisi avec la 14 serait à reprendre par « Exporter Tout » (14) puis
  « Importer Tout » (13) — **compatibilité de ce chemin non vérifiée** : à essayer pendant
  l'essai pilote (§4.2) avant d'en dépendre.
