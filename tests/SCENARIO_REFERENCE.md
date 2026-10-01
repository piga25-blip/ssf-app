# Scénario de secours de référence (lot 0)

Ce scénario pilote **la vraie application** comme le ferait un secrétaire : clics, saisies,
fenêtres. Il compare ensuite les données finales du secours à une **référence** enregistrée.
Il sert à vérifier, après chaque étape du chantier réseau, que le comportement de
l'application n'a pas changé sans qu'on le veuille.

## Lancer le scénario

Depuis `C:\Projets\SSF-Reseau` :

| Commande | Effet |
|---|---|
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
- **Sensibilité vérifiée le 01/10/2026 :** le changement volontaire d'un seul mot dans le texte
  d'un départ de sauveteur a bien été signalé (1 différence).

## Déroulement (23 étapes)

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
| 23 | Clôture | Clôture à « dernier événement + 5 min » |

Au passage, la **recopie automatique du planning** (toutes les 15 min) et la **vérification
des rappels** (toutes les 30 s) se déclenchent plusieurs fois.

Résultat de référence : 25 lignes de main courante, 3 équipes (dont une dissoute),
4 points phones (PC compris), planning de 6 sauveteurs, 16 messages de fenêtres.

## Non couvert pour l'instant

À ajouter si une étape du chantier touche ces fonctions :
- affectations faites directement dans la grille du **planning** (glisser-déposer, palette) ;
- **imports / exports** (JSON, Excel, PDF), impressions ;
- **réouverture** d'un dossier existant, changement d'identifiant de secours ;
- main courante **secondaire** (base arrière, planning déporté) et import dans la principale ;
- recherche avancée, tableau de bord, synthèse (affichage seul, sans modification des données).

## Fichiers

| Fichier | Rôle |
|---|---|
| `tests/scenario-reference.js` | Le scénario et l'outil de comparaison |
| `tests/reference/etat-final.json` | La référence (versionnée dans git) |
| `tests/sortie/` | Résultats de la dernière exécution : état obtenu, captures (non versionné) |
