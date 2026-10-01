# Plan — Utilisation de l'application SSF en réseau local (hypothèse H1)

> Document de travail rédigé le 01/10/2026 (version de l'application : 13.41.10).
> Rien n'est encore codé : ce document sert de référence pour une future mise en œuvre.

## Organisation du travail

| Dossier | Branche git | Rôle |
|---|---|---|
| `C:\Projets\SSF` | `main` | Version officielle : corrections et mises à jour publiées |
| `C:\Projets\SSF-Reseau` | `reseau-local` | Version réseau, **jamais publiée** tant qu'elle n'est pas validée |

Le second dossier est un *worktree* git : même projet, deux dossiers de travail.
Les corrections de `main` sont reprises dans `reseau-local` uniquement sur décision
(`git merge main` depuis `C:\Projets\SSF-Reseau`).

La version réseau a une **identité distincte** pour cohabiter sans risque avec la version officielle :

| Élément | Version officielle | Version réseau (test) |
|---|---|---|
| Nom (`productName`) | Application SSF | Application SSF Reseau (test) |
| Identifiant (`appId`) | `fr.ssf.app` | `fr.ssf.app.reseau` |
| Dossier de données | `%APPDATA%\Application SSF` | `%APPDATA%\Application SSF Reseau (test)` |
| Titre de la fenêtre | Application SSF Unifiée | … – RÉSEAU (TEST) |
| Mise à jour automatique | active | **désactivée** (`MISE_A_JOUR_AUTO` dans `main.js`) |
| Publication GitHub | `gh release create` | **aucune** (`publish: null`, scripts `publish` supprimés) |

⚠️ **Au moment de la fusion finale dans `main`**, ces six éléments devront être remis à
l'identique de la version officielle. Sinon, la mise à jour s'installerait comme une
application séparée et ne retrouverait pas les données des utilisateurs.

---

## 0. Pourquoi est-ce intéressant d'avoir l'application en réseau

- Au début d'un secours, les gestionnaires (secrétaires) doivent gérer plusieurs choses :
  - l'inscription des sauveteurs ;
  - les premières données de la main courante ;
  - donner la liste des sauveteurs disponibles pour la création des équipes ;
  - la création des missions et des équipes ;
  - la création des points phones.
- Dès le départ en mission d'une équipe :
  - gérer ses déplacements à chaque passage aux points phones ;
  - poursuivre également ce qui est réalisé au début d'un secours.
- En plus de tout cela, gérer tous les imprévus.

**Conséquence :** ces tâches se déroulent en parallèle et sur un seul poste. Elles créent
un goulot d'étranglement. Le réseau local permettrait de répartir la charge, avec par exemple :

| Poste | Tâche principale |
|---|---|
| Poste 1 (principal) | Main courante, imprévus, coordination |
| Poste 2 | Inscription des sauveteurs, liste des disponibles |
| Poste 3 | Missions, équipes, planning |
| Poste 4 (ou tablette) | Suivi des passages aux points phones |
| Écran mural | Consultation seule (situation des équipes, planning) |

Toutes ces tâches travaillent sur **les mêmes données**, et chaque poste doit voir en
temps réel ce que font les autres. Par exemple, un sauveteur inscrit sur le poste 2 doit
apparaître immédiatement comme disponible sur le poste 3.

---

## 1. Les options étudiées

| Hypothèse | Principe | Verdict |
|---|---|---|
| **H1** | Le poste principal sert aussi de serveur ; les autres postes s'y connectent avec un navigateur | ✅ **Retenue** |
| H2 | La même application installée partout, en mode « principal » ou « secondaire » | Évolution possible de H1 |
| H3 | Un fichier commun dans un dossier partagé Windows | ❌ Déconseillée (écrasements, pas de temps réel, corruption) |
| H4 | Synchronisation directe entre postes (Yjs / Automerge) | Très résistante aux coupures, mais complexe |
| H5 | Un petit serveur dédié séparé (mini-PC + CouchDB / PouchDB) | Solide, mais un appareil de plus |
| H6 | Prise en main à distance (bureau à distance / VNC) | Aucun développement, mais une seule saisie à la fois |

---

## 2. Ce qui existe déjà dans le code

**Un ancien branchement réseau, à moitié présent.** `hooks/useWebSocket.js` contient le côté
« poste connecté » d'une ancienne version réseau. La partie serveur n'existe plus dans le projet.
- Le poste se connecte, se présente (nom, poste, rôle) et signale régulièrement qu'il est toujours là.
- Il reçoit l'état complet (`initial_data`), puis à chaque modification faite ailleurs (`data_changed`).
- À chaque sauvegarde, il renvoie l'**état complet** (`data_update`, dans `index.html` vers la ligne 830).
- L'en-tête de l'écran affiche déjà la liste des connectés.

⚠️ Ce fonctionnement par état complet fait que le dernier qui enregistre efface les saisies
des autres. On ne peut pas le réutiliser tel quel, mais l'emplacement et l'affichage sont prêts.

**La main courante principale / secondaire** (`mcMode`, `mcIdentifiant`, numéros du type
`A-001`) est déjà une façon de faire saisir plusieurs postes sans conflit, en séparant les
numéros, puis en important les données. Ce principe de numérotation peut resservir.

**Le stockage actuel** se fait dans la mémoire du navigateur intégré à Electron (`storage.js`),
sous la clé unique `SSF_UNIFIED_STATE_<id>_V<n>`, réécrite en entier toutes les 600 ms au plus.

---

## 3. Architecture cible

```
            ┌──────────────── POSTE PRINCIPAL (Electron) ────────────────┐
            │  Partie « moteur » (main.js)                               │
            │   ├─ Serveur web    → sert index.html, *.jsx, libs         │
            │   ├─ Serveur WebSocket → reçoit / diffuse les actions      │
            │   ├─ Données de référence → fichier dans le dossier de     │
            │   │                         l'application                  │
            │   └─ Journal des actions + sauvegardes horodatées          │
            │  Fenêtre de l'application = elle-même un poste connecté    │
            │                             à http://localhost:8080        │
            └────────────────────────────┬───────────────────────────────┘
                                         │ Wi-Fi / câble local
          ┌──────────────────┬───────────┴───────┬───────────────────┐
     PC portable 2      Tablette            Écran mural          Mac
     (navigateur)       (navigateur)        (consultation seule) (navigateur)
```

**Principe essentiel : un seul fonctionnement pour tout le monde.** La fenêtre du poste
principal passe elle aussi par le serveur local, au lieu d'écrire directement dans sa
mémoire de navigateur. On évite ainsi deux comportements différents à maintenir.

---

## 4. Les phases

### Phase 0 – Décisions préalables
- Port utilisé (8080 proposé) et interrupteur « Mode réseau », **désactivé par défaut**.
  Sans lui, l'application reste strictement locale, comme aujourd'hui.
- Liste des données partagées et des données propres à chaque poste :

| Partagées (serveur) | Propres à chaque poste (mémoire du navigateur) |
|---|---|
| sauveteurs, équipes, planning, main courante, points phone, infos mission, clôture, numérotation | secrétaire en cours, position de défilement du planning, onglet affiché, réglages d'affichage |

- Navigateurs pris en charge : Chrome, Edge, Firefox et Safari dans leurs versions récentes.

### Phase 1 – Les données de référence passent dans la partie « moteur »
- Enregistrement dans un fichier du dossier de l'application :
  `%APPDATA%/Application SSF/secours/<id>.json`.
- Écriture sûre : fichier temporaire puis renommage, pour qu'une coupure de courant ne
  corrompe pas le fichier.
- Journal des actions : une ligne horodatée par modification (qui a fait quoi, possibilité
  de rejouer, sauvegardes fiables).
- Les sauvegardes automatiques (`ssf_auto_saves`) sont faites par le serveur.
- ⚠️ **Récupérer les données existantes.** En passant de `file://` à `http://localhost`,
  la mémoire du navigateur change d'origine : les secours existants deviendraient invisibles.
  Au premier lancement de la nouvelle version, il faut copier toutes les clés
  `SSF_UNIFIED_STATE_*` vers le nouveau stockage.

#### Découpage des sauvegardes par partie

Au lieu d'un seul bloc, un dossier par secours avec un fichier par partie :

```
%APPDATA%/Application SSF/secours/<id-du-secours>/
   ├─ mission.json        infos mission, clôture, secrétaires, réglages
   ├─ inscription.json    sauveteurs inscrits, sauveteurs actifs, n° permanents
   ├─ main-courante.json  événements, n° du prochain événement, mode principal/secondaire
   ├─ planning.json       grille, heure de début, nombre de jours
   ├─ equipes.json        équipes, n° d'équipe déjà utilisés
   ├─ points-phone.json   liste des points phones
   ├─ journal.log         historique de chaque modification (qui, quoi, quand)
   └─ sauvegardes/        copies horodatées
```

Correspondance avec l'état actuel (`SSF_UNIFIED_STATE_<id>`) :

| Fichier | Champs actuels |
|---|---|
| `mission.json` | `missionInfo`, `clotureInfo`, `secretaires`, `version` |
| `inscription.json` | `masterSauveteursList`, `activeSauveteurIds`, `sauveteurPermanentNumbers`, `nextPermanentNumber` |
| `main-courante.json` | `events`, `nextEventNumber`, `mcMode`, `mcIdentifiant`, `mcConfigured` |
| `planning.json` | `planning`, `startHour`, `totalDays` |
| `equipes.json` | `teams`, `usedTeamNumbers` |
| `points-phone.json` | `pointsPhone` |

**Ce qu'on y gagne :**
- en réseau, seule la partie modifiée est enregistrée et envoyée aux autres postes ;
- un fichier abîmé n'affecte pas les autres parties ;
- restauration ciblée (ex. seulement le planning) ;
- export d'une partie seule (ex. la main courante pour archivage) ;
- fin de la limite de taille de la mémoire du navigateur (environ 5 à 10 Mo).

**Point de vigilance : les parties dépendent les unes des autres.** Vérifié dans le code :
la main courante est alimentée automatiquement par presque tous les modules.

| Module | Action | Parties modifiées |
|---|---|---|
| Enregistrement des sauveteurs (`Modals.jsx`, `hooks/usePlanning.js`) | Arrivée | inscription **+ main courante** (lignes « arrivée » et « disponible ») **+ planning** |
| | Départ | inscription **+ planning + main courante** |
| Équipes (`Teams.jsx`) | création, départ, retour, scission… | équipes **+ main courante + planning** |
| Points phones (`GestionPointsPhone.jsx`) | passages, gestion | points phones **+ main courante** |
| Planning (`Planning.jsx`) | affectations, repos | planning **+ main courante** |
| Main courante (`Events.jsx`) | certaines saisies | main courante **+ planning + points phones** |
| Liste de référence (`GestionListe.jsx`) | annuaire des sauveteurs | inscription seulement |

Il existe aussi des **liens entre fichiers** : les équipes et le planning désignent les
sauveteurs par leur identifiant, qui se trouve dans `inscription.json`.

**Conséquences et règles :**
1. **Une action = un bloc unique.** Une modification qui touche plusieurs parties est d'abord
   notée dans `journal.log`, puis les fichiers concernés sont écrits. Si l'application
   s'arrête au milieu, elle relit le journal au redémarrage et termine l'écriture.
   Exemple : une inscription écrit en une seule fois l'inscription, la main courante et le
   planning. Sinon, on pourrait avoir un sauveteur inscrit sans ligne d'arrivée.
2. **`main-courante.json` est le fichier le plus sollicité** : presque toutes les actions de
   tous les postes y ajoutent une ligne.
3. **La sauvegarde complète réunit toutes les parties au même instant.** Pour une restauration
   partielle, l'application vérifie d'abord les liens (ex. un planning restauré ne doit pas
   désigner des sauveteurs qui n'existent plus) et prévient en cas de problème.
4. **Un numéro de version commun** figure dans chaque fichier pour détecter un mélange de versions.
5. **L'export d'un secours complet en un seul fichier** reste possible (échange, archivage).
6. **Lien main courante ↔ journal.** La main courante est déjà, en pratique, un journal de
   l'opération lisible par les secrétaires. Le journal technique reste nécessaire (détail
   exact de chaque modification), mais chaque ligne de main courante générée automatiquement
   garde la référence de l'action qui l'a créée (ex. quelle ligne correspond à quelle inscription).

### Phase 2 – Serveur web intégré
- Il fournit les fichiers de l'interface (`index.html`, `*.jsx`, `hooks/`, `libs/`, `assets/`)
  et un canal WebSocket pour les échanges en direct.
- Mode réseau désactivé : il n'écoute que le poste lui-même. Mode réseau activé : il
  accepte les connexions du réseau local.
- La fenêtre Electron charge `http://localhost:8080` au lieu du fichier local
  (l'option `allowFileAccessFromFileURLs` ne sert plus).
- **Pare-feu Windows** : l'installateur ajoute lui-même une règle (plus fiable sur le
  terrain), ou Windows pose la question au premier démarrage du mode réseau.
- **Performances sur tablette** : les ~13 000 lignes de JSX sont transformées dans le navigateur
  à chaque ouverture (Babel). Solutions : transformer le code une fois pour toutes à la
  construction, ou que le serveur garde la version transformée en mémoire.

### Phase 3 – Le serveur devient l'arbitre (le cœur du chantier)
On remplace l'envoi de l'état complet par **des actions précises, validées et numérotées
par le serveur**.

Les échanges se font dans cet ordre :
1. **Connexion** : le poste envoie son nom, son poste, son rôle et le code de session ;
   le serveur répond avec l'état complet et un numéro de version.
2. **Action** : par exemple « ajout d'un événement », avec un identifiant propre à l'action.
3. **Réponse du serveur** : il valide, donne un numéro de version, attribue lui-même les
   numéros (n° d'événement, n° permanent, n° d'équipe), confirme au poste et diffuse aux autres.
4. **Refus** (conflit, droits) : le poste annule sa modification et affiche un message.

| Partie | Risque de conflit | Règle proposée |
|---|---|---|
| Main courante | faible (ajouts) | ajout libre ; **numéro et heure donnés par le serveur** ; modification ligne par ligne, la dernière l'emporte |
| Rappels / alertes | faible | « réalisée » est définitif, la première validation l'emporte |
| Passages aux points phones | faible | chaque passage est un ajout horodaté par le serveur |
| Planning | moyen | une case = plus petit élément modifiable ; la dernière saisie l'emporte, avec notification |
| Équipes | élevé (scission, dissolution, chef) | actions globales (« scinder l'équipe 3 ») vérifiées par le serveur ; refusées si l'équipe a changé entre-temps |
| Sauveteurs / listes | moyen | modification fiche par fiche |
| Infos mission, clôture, réglages | faible mais sensible | réservés au rôle administrateur |

- **Numérotation** : `nextEventNumber`, `nextPermanentNumber` et `usedTeamNumbers` sont
  aujourd'hui calculés par chaque poste, donc deux postes donneraient le même numéro.
  Seul le serveur doit les attribuer. **C'est la priorité absolue pour la main courante** :
  tous les postes y créent des lignes en même temps (un poste inscrit, un autre fait partir
  une équipe, un troisième enregistre un passage au point phone).
- **Heure** : l'heure de la main courante doit être celle du serveur, car les horloges des
  postes peuvent être décalées.
- **Passer en deux étapes :**
  - **Étape A** : découper l'état en parties (main courante, planning, équipes…), chacune
    avec un numéro de version. Le serveur refuse une partie modifiée entre-temps par quelqu'un d'autre.
  - **Étape B** : passer aux actions précises, d'abord pour la main courante et le planning.

### Phase 4 – Adaptation de l'interface
- Réécriture de `useWebSocket.js` ; suppression de la sauvegarde globale toutes les 600 ms
  (`index.html`, vers la ligne 811) : chaque geste envoie son action.
- **Affichage immédiat** de la modification, corrigé si le serveur la refuse.
- **Reconnexion automatique** avec essais de plus en plus espacés, puis demande de ce qui a
  changé depuis la dernière version (ou de l'état complet).
- **Témoin de connexion** toujours visible : 🟢 connecté, 🟠 reconnexion, 🔴 hors ligne.
- **Saisies pendant une coupure** :
  - option simple : saisie impossible hors connexion ;
  - option avancée : saisies en attente envoyées au retour du réseau (en s'appuyant sur la
    logique principale / secondaire et les numéros préfixés).
- **Fonctions propres à Electron** (mises à jour, `refocusWindow`, version) : vérifier
  qu'elles se désactivent proprement dans un navigateur. Tester aussi l'import / export
  Excel et JSON ainsi que l'impression.

### Phase 5 – Identité, droits, sécurité
- **Code de session** de 4 à 6 chiffres, affiché sur le poste principal et intégré au QR code.
  On peut le changer pour exclure tous les postes.
- **Rôles** :
  - **Administrateur** (poste principal) : tout ;
  - **Saisie** : main courante, planning, équipes, points phones ;
  - **Consultation** : écran mural, chef d'opération.
- Le secrétaire en cours reste choisi sur chaque poste. Il est envoyé avec chaque action et
  enregistré dans le journal.
- Le poste principal peut déconnecter un poste. Réseau local uniquement, aucune ouverture
  vers internet.

### Phase 6 – Écran « Mode réseau » sur le poste principal
- Interrupteur d'activation.
- Adresse(s) affichée(s) (ex. `http://192.168.1.20:8080`), QR code, code de session.
- Liste des connectés : nom, poste, rôle, dernière activité.
- Bouton « Exporter l'état complet » pour pouvoir changer de poste principal.

### Phase 7 – Robustesse et reprise
- Sauvegardes horodatées faites par le serveur, intervalle réglable, rotation des anciennes copies.
- **Si le poste principal tombe en panne**, on peut :
  - redémarrer l'application, qui reprend depuis le fichier et le journal ;
  - ou faire d'un autre PC le nouveau poste principal, à partir du dernier export ou d'une
    sauvegarde. On peut aussi prévoir que les postes connectés gardent une copie récente
    téléchargeable.
- Empêcher la mise en veille du poste principal tant que le mode réseau est actif.

### Phase 8 – Tests
1. Deux postes ajoutent un événement à la même seconde : numéros distincts, ordre cohérent.
2. Deux postes modifient la même case du planning.
3. Un poste scinde une équipe pendant qu'un autre y ajoute un membre.
4. Inscription d'un sauveteur sur un poste : il apparaît aussitôt comme disponible sur le
   poste qui crée les équipes.
5. Coupure Wi-Fi de 30 s puis de 10 min sur un poste.
6. Arrêt brutal du poste principal, puis redémarrage : aucune perte de données.
7. 10 postes connectés, dont une tablette : temps de chargement et réactivité.
8. Récupération des données existantes lors de la mise à jour depuis la version 13.41.
9. Mode réseau désactivé : comportement strictement identique à aujourd'hui.
10. Arrêt brutal de l'application pendant une inscription (ou un départ d'équipe) : au
    redémarrage, l'inscription, la ligne de main courante et le planning sont tous présents
    (ou tous absents), jamais partiellement.
11. Restauration du seul planning à partir d'une sauvegarde : l'application signale les
    sauveteurs absents de l'inscription.
12. Inscription, départ d'équipe et passage au point phone lancés en même temps depuis trois
    postes : trois lignes de main courante aux numéros distincts et consécutifs.

### Phase 9 – Déploiement
- Version majeure (14.0), puisque le stockage change.
- Notice utilisateur : matériel conseillé (routeur Wi-Fi portable), démarrage du mode
  réseau, connexion par QR code, que faire si le poste principal tombe.
- Vérifier que le poste principal fonctionne aussi sur Mac.

---

## 5. Bilan complet avant codage (check-up du 01/10/2026)

Relecture du code (version 13.41.10) pour repérer ce que le plan ne couvrait pas encore.

### A. Points bloquants (à traiter avant tout code réseau)

#### A1. Des modifications automatiques tourneraient en double sur chaque poste
Certaines modifications se font sans action d'un secrétaire. En réseau, **chaque poste
ouvert les ferait en même temps** :
- **Recopie automatique du planning toutes les 15 minutes** (`hooks/usePlanning.js:151`) :
  avec 4 postes, elle serait faite 4 fois, en conflit.
- **Attribution automatique des n° permanents** aux sauveteurs du planning qui n'en ont pas
  (`index.html:847`) : deux postes pourraient donner deux numéros différents au même sauveteur.
- **Vérification des alertes toutes les 30 s** (`hooks/useAlerts.js:53`) : la fenêtre
  « URGENT » s'afficherait sur tous les postes. Il faut décider qui la voit et qui la valide.

➡️ **Règle :** toute modification automatique est faite **par le serveur uniquement**,
jamais par les postes.

#### A2. Identifiants créés à partir de l'heure
De nombreux éléments reçoivent un identifiant `id: Date.now()` (l'heure à la milliseconde) :
38 endroits, dont 12 dans `Teams.jsx`. Deux postes qui créent un élément à la même
milliseconde, ou un poste qui en crée deux d'affilée, obtiennent **le même identifiant**.
Dégâts silencieux : mauvaise ligne modifiée ou supprimée.

➡️ Identifiants garantis uniques (`crypto.randomUUID()`) ou attribués par le serveur.

#### A3. Modifications à partir d'une copie périmée des données
À une quinzaine d'endroits (`Teams.jsx`, `Events.jsx`, `Modals.jsx`, `useAlerts.js`,
`GestionListe.jsx`, `GestionPointsPhone.jsx`), le code reconstruit la liste entière à partir
de la copie qu'il avait au moment du clic : `setEvents([...events, nouvelEvent])` puis
`setNextEventNumber(nextEventNumber + 1)`. Si une ligne venue d'un autre poste arrive
entre-temps, **elle est effacée**. Cela peut déjà arriver aujourd'hui sur un seul poste lors
d'actions rapides enchaînées.

➡️ Le problème disparaît avec les actions envoyées au serveur. Si on passe d'abord par
l'étape A (par parties), corriger ces endroits avant.

#### A4. Aucun test automatique
Le chantier touche **environ 200 endroits** qui modifient les données partagées, dans
13 000 lignes, sans aucun test.

➡️ Avant de commencer :
- écrire un **scénario de secours de référence** (inscriptions, équipes, départs, points
  phones, planning, clôture) à rejouer manuellement ou automatiquement ;
- comparer le résultat avant et après chaque étape.

### B. Points importants

**B1. Regrouper d'abord toutes les modifications en un seul endroit.** Remplacer les ~200
modifications directes depuis les écrans par des **actions nommées** (« inscrire un
sauveteur », « faire partir une équipe »…), toutes traitées au même endroit. Rien de réseau :
l'application reste sur un seul poste. Ensuite, passer en réseau revient à envoyer ces
actions au serveur. C'est l'étape qui réduit le plus le risque.

**B2. La branche `reseau-local` va s'éloigner de `main`.** Plus les corrections continuent sur
`main`, plus le report sera difficile. Trois possibilités :
- reporter `main` dans `reseau-local` **chaque semaine** ;
- geler les évolutions de `main` pendant le chantier (corrections urgentes seulement) ;
- **ou** sortir l'étape B1 dans une mise à jour normale (rien de réseau), si c'est jugé
  compatible avec la consigne « rien du réseau dans les mises à jour ».

**B3. Mise à jour automatique en plein secours.** Une installation sur le poste principal le
redémarre et coupe tous les postes ; les postes ouverts garderaient l'ancienne interface.

➡️ Aucune installation tant que le mode réseau est actif ; contrôle de version à la
connexion, avec message « rechargez la page » si les versions diffèrent.

**B4. Plusieurs secours et changement de secours** (`setCurrentRescueId`, `index.html:1482`,
2063, 2103). Le serveur ne propose qu'**un secours actif à la fois**, choisi sur le poste
principal ; les autres postes basculent automatiquement ou sont déconnectés.

**B5. Imports et restaurations** (six imports de fichiers : main courante, liste de
sauveteurs, restauration, import d'une main courante secondaire). En réseau, ils remplacent
les données de tout le monde.

➡️ Réservés à l'administrateur, avec confirmation, faits par le serveur et notés dans le journal.

**B6. Lien avec les modes actuels.** Trois façons de travailler à plusieurs coexisteraient :
PC de terrain / PC base arrière, main courante principale / secondaire avec import, réseau local.
Suggestion :
- la main courante secondaire reste utile pour un poste **hors du réseau** (PC avancé sans
  Wi-Fi), avec import plus tard ;
- en réseau, la numérotation par le serveur remplace les préfixes `A-`, `B-`.

**B7. Données personnelles (RGPD).** Les fiches sauveteurs circulent sur le Wi-Fi et restent
sur les appareils connectés.

➡️ Wi-Fi protégé (WPA2/3) ; code de session ; aucune copie complète gardée sur les
tablettes ; purge ou archivage en fin de secours.

**B8. Valeur juridique de la main courante.** En réseau, garantir : aucune suppression
définitive, seulement des corrections tracées ; un auteur et un poste par ligne ; l'heure
du serveur. ➡️ À valider avec les règles internes du SSF.

**B9. Réglages à classer entre partagés et propres à chaque poste.**

| Réglage | Proposition |
|---|---|
| `ssf_planning_auto_propagate` (recopie automatique) | **partagé**, recopie faite par le serveur (voir A1) |
| `ssf_autosave_interval` | réglage du serveur |
| `ssf_mission_keywords` | partagé |
| `ssf_current_secretaire`, défilement, onglet | propres au poste |
| `ssf_standalone_mode` / `_id` | à revoir avec B6 |

**B10. Impressions et exports.** Les exports PDF et Excel (jsPDF, XLSX, une dizaine
d'endroits) fonctionnent dans un navigateur, mais le téléchargement et l'impression se
comportent différemment sur tablette (iPad notamment). À ajouter aux tests.

### C. Points de détail

| Sujet | Remarque |
|---|---|
| Fonctionnement sans internet | ✅ Vérifié : React, Babel, Tailwind, jsPDF et XLSX sont fournis avec l'application |
| Saisie simultanée dans les fenêtres | Si deux secrétaires ouvrent la même fiche ou équipe, prévenir « modifié entre-temps par X » |
| Taille d'écran | Interface prévue pour 1024 px minimum : téléphones en consultation seule, ou interface simplifiée pour les points phones |
| Alimentation électrique | Poste principal sur secteur ou batterie externe, mise en veille désactivée |
| Recherche de l'adresse | Une carte réseau virtuelle (VPN, Hyper-V) peut afficher une mauvaise adresse IP : proposer de choisir la carte |
| Performances | Après plusieurs jours, envoyer seulement les changements, pas l'état complet |
| Ancien code réseau | Supprimer ou réécrire `hooks/useWebSocket.js` et l'affichage des connectés dans l'en-tête |
| Fichiers anciens | `App_SSF_ V13-35…html` et ses `.bak` : le serveur ne doit fournir qu'une liste précise de fichiers |
| Journal | Prévoir sa rotation et sa taille maximale |

---

## 6. Découpage en livraisons successives (mis à jour après le bilan)

| Lot | Contenu |
|---|---|
| **0 – Préparation** ✅ (rien de réseau) | ✅ scénario de référence (A4, fait le 01/10/2026 : `tests/SCENARIO_REFERENCE.md`), ✅ identifiants uniques (A2, fait le 01/10/2026 : `nouvelId()` / `garantirIdsUniques()` dans `utils.js`), ✅ copies périmées corrigées (A3, fait le 01/10/2026 : mises à jour à partir de l'état le plus récent + distributeur de numéros `reserverNumerosMC()` dans `index.html`), ✅ **modifications regroupées en actions nommées (B1, fait le 01/10/2026 : `donnees.js`, voir « Architecture des données » ci-dessous)** |
| **1** ✅ | stockage en fichiers découpés + journal + serveur, postes **en consultation seule** ; modifications automatiques faites par le serveur (A1) ; blocage des mises à jour pendant le mode réseau (B3) |
| **2** | saisie de la **main courante** et des **passages aux points phones** sur plusieurs postes (numéros et heure donnés par le serveur) |
| **3** | inscription des sauveteurs, missions, équipes, planning sur plusieurs postes (étape A puis B) ; avertissement de modification simultanée dans les fenêtres |
| **4** | code de session, rôles, imports réservés à l'administrateur (B5), reprise après panne, saisie hors connexion |

---

## 6 bis. Architecture des données après le lot 0

- **`donnees.js`** contient toutes les données partagées d'un secours (sauveteurs, équipes,
  points phones, secrétaires, main courante, planning, infos et clôture du secours, mode de main
  courante) et **46 actions nommées** (`SAUVETEURS/ARRIVEE`, `EQUIPES/SCINDER`,
  `MC/VALIDER_RAPPEL`…), traitées par une seule fonction **pure** : `reducteurDonnees(etat, action)`.
- Aucune donnée partagée n'est modifiée ailleurs : les écrans appellent `actions.xxx(...)`
  (`creerActionsDonnees`), qui ajoute l'heure, l'identifiant et le numéro de main courante, puis
  envoie l'action.
- Une action applique **en une seule fois** tous ses effets (ex. une fin de mission : équipe,
  planning et ligne de main courante).
- **Pour le réseau (lot 1 et suivants)** : le poste n'appliquera plus l'action lui-même, il
  l'enverra au serveur, qui exécutera la même fonction `reducteurDonnees` (vérifié : elle tourne
  dans Node.js, test `tests/verif-actions.js`), attribuera les numéros et diffusera l'action.
- Reste local à chaque poste : secrétaire courant, affichage, sélection dans le planning.

---

## 6 ter. Lot 1 réalisé (01/10/2026)

| Étape | Contenu |
|---|---|
| 1.1 | Serveur intégré (`serveur/serveur.js`) : la fenêtre du poste principal charge l'application par `http://localhost:8080` (port suivant s'il est pris) ; liste blanche stricte des fichiers servis |
| 1.2 | Données enregistrées par le serveur : un dossier par secours dans `<données de l'application>/secours/`, un fichier par partie, `journal.log` (écrit avant les fichiers ; rattrapage après arrêt brutal), sauvegardes horodatées toutes les 30 min (20 gardées) ; `donnees.js` exécuté côté serveur (`serveur/moteur.js`) ; canal temps réel WebSocket `/canal` (`serveur/canal.js`, `hooks/useConnexion.js`) |
| 1.3 | Reprise des secours des versions précédentes (`serveur/migration.js`) au premier lancement ; ancienne mémoire jamais effacée ; compte rendu dans `reprise-memoire-navigateur.json` |
| 1.4 | Bouton « 🌐 Mode réseau » : écoute sur le réseau local (0.0.0.0) ou ce poste seul (127.0.0.1) sans redémarrer, adresse à saisir, postes connectés ; réglage conservé (`reglages-serveur.json`, désactivé par défaut) ; désactivation → postes distants déconnectés |
| 1.5 | Postes en consultation : bandeau, aucune fenêtre de démarrage ni de configuration, aucune modification automatique, modifications refusées par le serveur ; contrôle de version (demande de rechargement) ; installation d'une mise à jour bloquée tant que le mode réseau est actif |

**Fonctionnement :** le poste principal (fenêtre Electron, reconnu par un jeton secret fourni par
`preload.js`) applique chaque action tout de suite puis l'envoie au serveur, qui l'enregistre et la
transmet aux autres postes. Les autres postes (navigateur) reçoivent l'état puis chaque action.

**Reste à prévoir (lots suivants) :**
- lot 2 : saisie sur plusieurs postes → numéros de main courante attribués par le serveur, ordre des
  actions décidé par le serveur ; les créneaux du planning calculés à partir de l'heure locale
  (`indexCreneau`) supposent que tous les postes sont sur le même fuseau horaire ;
- installateur : règle de pare-feu Windows pour l'application (sinon Windows pose la question au
  premier passage en mode réseau) ; QR code de l'adresse (avec les tablettes, lot 3) ;
- modifications automatiques (recopie du planning, n° permanents, alertes) : faites par le poste
  principal ; à confier au serveur quand plusieurs postes saisiront (A1) ;
- fusion finale dans `main` : rétablir l'identité de l'application (voir « Organisation du travail »).

---

## 7. Décisions prises (01/10/2026)

| N° | Sujet | Décision |
|---|---|---|
| 1 | Coupure réseau sur un poste | **Saisie bloquée** : le poste affiche 🔴 hors ligne et empêche la saisie jusqu'au retour du réseau. La saisie mise en attente pourra être ajoutée au lot 4. |
| 2 | Rôles | **3 rôles** : Administrateur (poste principal : tout), Saisie (main courante, inscriptions, équipes, planning, points phones), Consultation (écran mural, chef d'opération). |
| 3 | Conflit sur une case du planning | **La dernière saisie l'emporte**, l'autre poste est prévenu (« case modifiée par X »). |
| 4 | Appareils | **PC d'abord** (Windows / Mac) ; tablettes au lot 3, avec la transformation préalable du code (chargement mesuré : ~4 s sur PC au 01/10/2026). Téléphones non prévus. |
| 5 | Ordre de départ | **Lot 0 (préparation, rien de réseau) puis lot 1** (serveur + consultation seule). |
| 6 | Modes existants (terrain / base arrière, main courante secondaire) | **Conservés pour les postes hors réseau** (PC avancé sans Wi-Fi, base arrière éloignée), avec import plus tard. En réseau, le serveur numérote (plus de préfixes `A-`, `B-`). |
| 7 | Reprise des corrections de `main` | **À chaque correction** : après chaque mise à jour officielle, la correction est reprise dans `reseau-local` (`git merge main` depuis `C:\Projets\SSF-Reseau`). |
| 8 | Alertes urgentes | **Tous les postes de saisie les voient, tous peuvent valider** : la première validation ferme l'alerte partout et est notée avec son auteur. La vérification des alertes est faite par le serveur (A1). |
| 9 | Corrections de la main courante | **Historique des corrections** : la ligne affiche la valeur corrigée avec « corrigée par X à HH:MM », l'ancienne version reste consultable. Aucune suppression possible (comme aujourd'hui). |

Constat du 01/10/2026 pour la décision 9 : aujourd'hui une ligne de main courante ne peut pas
être supprimée, mais elle peut être modifiée sans trace (ni ancienne valeur, ni auteur).
