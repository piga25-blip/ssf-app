# Scénario de secours de référence (lot 0)

Ce scénario pilote **la vraie application** comme le ferait un secrétaire : clics, saisies,
fenêtres. Il compare ensuite les données finales du secours à une **référence** enregistrée.
Il sert à vérifier, après chaque étape du chantier réseau, que le comportement de
l'application n'a pas changé sans qu'on le veuille.

## Lancer le scénario

Depuis `C:\Projets\SSF-Reseau` :

| Commande | Effet |
|---|---|
| **`npm test`** | **Lance tout** : 15 tests (environ 11 min) — à faire après chaque modification |
| `npm run test:scenario` | Rejoue le scénario et le compare à la référence → ✅ SUCCÈS ou ❌ ÉCHEC avec la liste des différences |
| `npm run test:scenario:maj` | Rejoue le scénario et **remplace** la référence (uniquement après un changement voulu et vérifié) |
| `node tests/scenario-reference.js --jusqua=12` | S'arrête après l'étape 12 et enregistre une capture et la description de l'écran dans `tests/sortie/` |
| `node tests/scenario-reference.js --visible` | Ralentit le déroulement pour le suivre à l'écran |

Durée : environ 1 min 30. La fenêtre de l'application s'ouvre et se ferme toute seule.

## Garanties

- **Données réelles jamais touchées :** chaque exécution utilise un dossier de données jetable
  (variable `SSF_TEST_USER_DATA`), supprimé à la fin.
- **Résultat reproductible :** l'horloge est fictive. Le secours se déroule le samedi
  14 mars 2026 de 08:01 à 10:13, et le temps n'avance que lorsque le scénario le décide
  (ce qui déclenche aussi les rappels et la recopie automatique du planning). Deux exécutions
  donnent un résultat **strictement identique**.
- **Fenêtres `alert` / `confirm` :** elles sont remplacées par des versions non bloquantes qui
  répondent « OK ». Leurs messages font partie de la référence : une fenêtre qui apparaît, disparaît
  ou change de texte est donc détectée.
- **Identifiants techniques neutralisés :** les identifiants (`Date.now()`, UUID) sont remplacés
  par `ID_1`, `ID_2`… dans leur ordre d'apparition. On peut changer leur mode de création
  (lot 0, A2) sans faire échouer la comparaison, mais un mauvais lien entre deux éléments
  est détecté.
- **Erreurs JavaScript :** toute erreur dans la page fait échouer le scénario.
- **Étapes 22a à 22c** (ajoutées le 01/10/2026) : leur référence a été produite avec le code
  d'AVANT les actions nommées (B1), puis le nouveau code a donné un résultat identique.
- **Sensibilité vérifiée le 01/10/2026 :** le changement volontaire d'un seul mot dans le texte
  d'un départ de sauveteur a bien été signalé (1 différence).

## Déroulement (26 étapes)

| N° | Étape | Ce qui est vérifié |
|---|---|---|
| 01 | Démarrage | L'application se charge |
| 02 | Nouveau dossier | Exercice « Gouffre du Test » à Testville, délai d'alerte 6 h |
| 03 | Mode et secrétaire | PC de Terrain (poste maître) ; secrétaire « Secrétaire TEST » |
| 04 | Liste préfectorale | 6 sauveteurs (MARTIN, BERNARD, DUBOIS, THOMAS, ROBERT, PETIT) |
| 05 | Arrivées | 5 sauveteurs arrivent : n° permanents, main courante, planning |
| 06 | Points phones | A Entrée de la cavité, B Puits P40, C Salle du Camp |
| 07 | Équipe 1 | Sous terre, reconnaissance, chef MARTIN + BERNARD + DUBOIS |
| 08 | Message simple | Message à destination de la préfecture |
| 09 | Départ équipe 1 | Départ PC + mise à jour du planning (approche) |
| 10 | Passage au point B | Progression + planning (sous terre) |
| 11 | Rappel | Message avec rappel à 08:45 |
| 12 | Validation du rappel | Rappel dépassé puis validé (ligne « Rappel réalisé ») |
| 13 | Équipe 2 | Surface, logistique, THOMAS + ROBERT |
| 14 | Départ équipe 2 | Départ PC en mission de surface |
| 15 | Passage au point C | Progression de l'équipe 1 |
| 16 | Arrivée tardive | PETIT arrive |
| 17 | Ajout de membre | PETIT ajouté à l'équipe 2 |
| 18 | Scission | Équipe 1 scindée → Équipe 1B (position initiale reprise) |
| 19 | Fin de mission | Dissolution de l'équipe 2 |
| 20 | Retour équipe 1 | Passage au point A, « sort — rentre au PC » |
| 21 | Correction | Modification d'une ligne de main courante existante |
| 22 | Départ sauveteur | DUBOIS quitte le secours (retiré des équipes, gardé au planning) |
| 22a | Grille du planning | Sélection de 2 cases à la souris + activité « Repas » de la palette (+ ligne de main courante) |
| 22b | Poignée de recopie | Les 2 cases recopiées sur la case suivante |
| 22c | Modification d'un point phone | B renommé « Puits P40 (relais) » : la ligne de main courante qui le cite suit |
| 23 | Clôture | Clôture à « dernier événement + 5 min » |

Au passage, la **recopie automatique du planning** (toutes les 15 min) et la **vérification
des rappels** (toutes les 30 s) se déclenchent plusieurs fois.

Résultat de référence : 26 lignes de main courante, 3 équipes (dont une dissoute),
4 points phones (PC compris), planning de 6 sauveteurs, 16 messages de fenêtres.

## Non couvert pour l'instant

À ajouter si une étape du chantier touche ces fonctions :
- **imports / exports** (JSON, Excel, PDF), impressions ;
- **réouverture** d'un dossier existant, changement d'identifiant de secours ;
- main courante **secondaire** (base arrière, planning déporté) et import dans la principale ;
- recherche avancée, tableau de bord, synthèse (affichage seul, sans modification des données).

## Vérifications complémentaires

Tests ciblés, ajoutés lors de la correction de défauts de la version officielle (13.41.11) :

| Commande | Ce qui est vérifié |
|---|---|
| `node tests/verif-reouverture.js` | Un dossier clôturé, rouvert après redémarrage, reste clôturé avec sa cavité et sa commune ; un ancien dossier rouvert n'enregistre pas de champs techniques |
| `node tests/verif-export-import.js` | « Exporter Tout » contient infos du secours, clôture, n° permanents et n° d'équipe ; « Importer Tout » les reprend du fichier |
| `node tests/verif-serveur.js` | Serveur intégré (lot 1) : fichiers servis, et surtout refusés (code du « moteur », tests, documentation, dépendances, sorties du dossier) ; port suivant si le port est pris |
| `node tests/verif-stockage.js` | Stockage du serveur (lot 1) : fichiers par partie, journal, **reprise après arrêt brutal** (actions du journal rattrapées sans doublon), renommage, suppression ; canal : rôles (jeton), diffusion des actions, refus des modifications d'un poste en consultation, liste des postes |
| `node tests/verif-reprise.js` | Reprise des secours des versions précédentes (mémoire du navigateur en `file://`) : secours repris en fichiers (vide ignoré), réglages du poste recopiés, réouverture à l'écran, pas de seconde reprise, ancienne mémoire intacte |
| `node tests/verif-reseau.js` | Mode réseau de bout en bout : activation, adresse affichée, autre poste (navigateur sans jeton) en consultation, mise à jour en direct, saisie refusée, liste des postes, désactivation → autre poste déconnecté |
| `node tests/verif-saisie-multiposte.js` | Saisie sur plusieurs postes (lot 2) : un poste principal et deux postes de saisie ; trois lignes saisies en même temps → numéros uniques et consécutifs identiques partout, heure et poste donnés par le serveur ; action interdite refusée ; correction depuis un poste de saisie avec historique ; rappel validé en même temps sur deux postes → une seule validation ; passage d'une équipe à un point phone → planning mis à jour |
| `node tests/verif-conflits-multiposte.js` | Conflits entre postes (lot 3) : même équipe, même point phone et identifiants automatiques créés au même instant sur deux postes (un seul retenu, refus explicite, ou identifiant suivant) ; avertissement « modifiée sur un autre poste » dans une fenêtre de modification ; notification « planning modifié sur … » |
| `node tests/verif-precompilation.js` | Interface précompilée par le serveur (lot 3, tablettes) : page sans Babel, affichée environ 20 fois plus vite (0,2 s au lieu de 3,8 s) ; cache sur disque |
| `node tests/verif-session.js` | Lot 4 : code de session (sans code aucune donnée, mauvais code refusé, adresse du code QR), poste nommé d'après son secrétaire, rôle réglé poste par poste, changement du code → postes déconnectés, saisie bloquée hors connexion sans envoi au retour, copie de secours proposée |
| `node tests/verif-version.js` | Poste principal relancé dans une autre version : l'autre poste se reconnecte seul et demande de recharger la page |
| `node tests/verif-actions.js` | Les 46 actions nommées de `donnees.js` (lot 0, B1), exécutées **directement dans Node.js** sans l'application : résultat de chaque action et état d'origine jamais modifié (158 contrôles, environ 1 s). Prouve que `donnees.js` pourra tourner sur le serveur |
| `node tests/verif-copies-perimees.js` | Modifications sur copie périmée (lot 0, A3) : une donnée ajoutée « d'ailleurs » au milieu d'une action (ligne de main courante, équipe, point phone, sauveteur) n'est plus effacée, et les numéros de main courante restent uniques. Vérifié le 01/10/2026 : l'ancien code perdait les 4 données |
| `node tests/verif-identifiants.js` | Identifiants d'événements uniques (lot 0, A2) : 10 000 tirages sans doublon, y compris sans `crypto.randomUUID` (postes en `http://`) ; un ancien dossier avec doublons est réparé et valider un rappel ne touche plus que l'événement concerné |

## Fichiers

| Fichier | Rôle |
|---|---|
| `tests/scenario-reference.js` | Le scénario et l'outil de comparaison |
| `tests/verif-*.js` | Vérifications complémentaires |
| `tests/reference/etat-final.json` | La référence (versionnée dans git) |
| `tests/sortie/` | Résultats de la dernière exécution : état obtenu, captures (non versionné) |
