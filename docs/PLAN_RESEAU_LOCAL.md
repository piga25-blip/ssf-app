# Plan — Utilisation de l'application SSF en réseau local (hypothèse H1)

> Document de travail rédigé le 01/10/2026 (version de l'application : 13.41.10).
> Rien n'est encore codé : ce document sert de référence pour une future mise en œuvre.

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
  Seul le serveur doit les attribuer.
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

### Phase 9 – Déploiement
- Version majeure (14.0), puisque le stockage change.
- Notice utilisateur : matériel conseillé (routeur Wi-Fi portable), démarrage du mode
  réseau, connexion par QR code, que faire si le poste principal tombe.
- Vérifier que le poste principal fonctionne aussi sur Mac.

---

## 5. Découpage en livraisons successives

| Lot | Contenu | Intérêt |
|---|---|---|
| **1** | Phases 1 et 2, plus l'écran réseau. Les autres postes sont **en consultation seule** | Peu risqué, utile tout de suite (écran mural, chef d'opération), valide l'architecture |
| **2** | Saisie de la **main courante** et des **passages aux points phones** sur plusieurs postes (numéros et heure donnés par le serveur) | Les tâches les plus fréquentes pendant les missions |
| **3** | Inscription des sauveteurs, missions, équipes, planning sur plusieurs postes (étape A puis B) | Répartit la charge du début de secours ; partie la plus délicate |
| **4** | Code de session, rôles, reprise après panne, saisie hors connexion | Fiabilité sur le terrain |

---

## 6. Décisions à prendre

1. Faut-il qu'un poste continue à saisir pendant une coupure (option avancée) ou qu'il soit
   bloqué (option simple) ?
2. Quels rôles veut-on, et qui a le droit de modifier le planning et les équipes ?
3. Conflits sur le planning : la dernière saisie l'emporte avec notification, ou blocage de
   la case pendant qu'elle est modifiée ?
4. Faut-il prévoir des tablettes ou téléphones dès le départ (ce qui rend prioritaire la
   transformation préalable du code) ?
5. Commence-t-on par le lot 1 en consultation seule ?
