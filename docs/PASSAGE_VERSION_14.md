# Passage de la version réseau en version officielle (14.0.0)

Préparé le 05/10/2026, **publié le 05/10/2026** (release GitHub `v14.0.0`, Windows et Mac).
Correctifs **14.0.1 publié le 06/10/2026**, **14.0.2 publié le 08/10/2026** **14.0.3** et **14.0.4 publiés le 16/10/2026** (voir §6).
Dernière mise à jour du document : 16/10/2026 (routeur de terrain, partage de connexion d'un smartphone, kits, 14.0.3, base nationale, 14.0.4, kits en 14.0.4).
Ce document garde la trace de la préparation et liste ce qui reste à faire après la publication.

## 1. Les dossiers de travail

| Dossier | Branche | Rôle |
|---|---|---|
| `C:\Projets\SSF` | `main` | **Version officielle publiée (14.0.4)** : contient désormais le code réseau. Les corrections futures se font ici. |
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
- **Fiche d'essai terrain mise à jour pour la 14.0.0** (06/10/2026) : `docs/essai-terrain`
  (version officielle, installation par mise à jour ou `SSF-Bootstrap.exe`, règle de pare-feu
  « Application SSF », données dans `%APPDATA%\Application SSF\secours` ;
  `retirer-pare-feu.cmd` retire aussi la règle de l'ancienne version de test). Kit reconstruit
  dans `dist/Kit-essai-terrain-14/` (non suivi par git) : fiche HTML et PDF, scripts,
  `SSF-Bootstrap.exe`, `Application-SSF-Setup-14.0.0.exe`.
- **Kit d'essai Mac préparé** (06/10/2026) : fiche `docs/essai-mac/Fiche essai Mac 14.html`
  (installation par le bootstrapper puis par le `.dmg`, déblocage Gatekeeper macOS 14 / 15,
  reprise des données d'une 13, fonctionnement, mode réseau et coupe-feu macOS, observation de
  la mise à jour automatique). Kit dans `dist/Kit-essai-Mac-14/` (non suivi par git) : fiche
  HTML et PDF, `SSF-Bootstrap-app-mac.zip`, `SSF-Bootstrap-command-mac.zip`,
  `Application-SSF-14.0.0-arm64.dmg` (puce Apple), `Application-SSF-14.0.0.dmg` (Intel).
- **Scénario de formation des gestionnaires** (06/10/2026) : exercice dicté de 2 h à 4 h couvrant
  toutes les fonctions (document Claude + `docs/Scenario_Formation_Gestionnaires_SSF.docx`, non
  suivi par git). **Joué sur l'application** par `node tests/scenario-formation/jouer.js`
  (112 étapes contrôlées, de jour comme de nuit) : il a révélé les défauts corrigés en 14.0.1.
- **Version 14.0.1 publiée** (06/10/2026, release `v14.0.1` « Latest », Windows et Mac) :
  « ✏️ Modifier » les infos du secours (plus de retour au choix du mode, formulaire à chaque
  ouverture) ; fenêtre d'alertes (ouverture seule à l'échéance, plus de blocage après « Traité »,
  « × » qui ferme vraiment) ; rappels entre minuit et 2 h datés du bon jour ; badge 👑 du chef et
  grilles à plusieurs colonnes. Test de non-régression `tests/verif-rappels.js` (dans `npm test`).
- **Films** (06–07/10/2026) : films des scénarios de test ralentis (pause de 1,8 s avant chaque
  action, arrêt sur image à chaque sous-titre ; 37,9 min) ; tous les films de formation existent
  aussi **avec une voix** qui lit les explications (voix neuronale Microsoft « Denise » :
  `node tests/film/tutoriels/voix.js neurale`, Internet + `python -m pip install edge-tts truststore`) ;
  nouvelle série « Film complet 3 - Scénario de formation » (8 films, un par phase, avec et sans
  voix). Copies : `E:\Vidéos\SSF-Films-de-formation\` (sans voix) et son sous-dossier
  `Avec la voix\`.
- **Version 14.0.2 publiée** (08/10/2026, release `v14.0.2` « Latest », Windows et Mac) : après
  le clic sur « Mise à jour prête — Cliquez pour redémarrer », le bandeau affiche aussitôt
  « ⏳ Installation en cours… » et ignore les clics suivants (remarque d'utilisateurs : doubles
  clics faute de retour visuel) ; mode réseau actif : mise à jour reportée, bandeau de nouveau
  cliquable. Test `tests/verif-bandeau-maj.js` (dans `npm test`). La confirmation n'apparaît
  qu'à partir des mises à jour faites depuis la 14.0.2.
- **Kits mis à jour pour la 14.0.2** (08/10/2026) : `dist/Kit-essai-terrain-14/`
  (`Application-SSF-Setup-14.0.2.exe`) et `dist/Kit-essai-Mac-14/`
  (`Application-SSF-14.0.2-arm64.dmg`, `Application-SSF-14.0.2.dmg`), fiches HTML et PDF à jour
  (`docs/essai-terrain`, `docs/essai-mac`).
- **Routeur de terrain** (16/10/2026) : essai avec un routeur TP-Link TL-WR841N. Le Wi-Fi
  fonctionnait, mais aucun poste n'ouvrait l'application sur le PC principal, alors que tout
  marchait sur la Livebox. Le routeur n'était pas en cause : Windows avait classé ce Wi-Fi en
  profil **« Public »**, qui refuse les connexions entrantes. Remède : Paramètres › Réseau et
  Internet › Wi-Fi › **Profil réseau : Privé**, puis désactiver et réactiver « 🌐 Mode réseau ».
  Windows retient ce choix pour chaque Wi-Fi ; c'est vérifié en repassant par la Livebox puis
  le TP-Link (tablette reconnectée aussitôt, smartphone par le code QR). Pour savoir de quel
  côté vient le blocage : si la page du routeur s'ouvre sur la tablette, il vient du PC
  principal ; sinon, vérifier « Client/AP Isolation » et le DHCP du routeur. La consigne a été
  ajoutée à la fiche d'essai terrain (partie 3 et encadré « En cas de problème de connexion »,
  PDF du kit refait) et à la notice (document Claude et `docs/Notice_MiseAJour_SSF_14.docx`,
  copiée dans `dist/Kit-essai-terrain-14/`).
- **Partage de connexion d'un smartphone** (16/10/2026) : essayé à la place du routeur, il
  fonctionne (PC, tablette et smartphone connectés). Seule difficulté : la tablette repartait sur
  la Livebox, qu'elle connaissait. Consignes ajoutées à la fiche d'essai terrain (partie 1 et
  encadré « En cas de problème de connexion ») et à la notice (« Matériel conseillé » et tableau
  « En cas de problème ») :
  - sur la tablette, désactiver la reconnexion automatique à la box, ou l'« Oublier » ;
  - sur le smartphone, bande 2,4 GHz (Android) ou « Optimiser la compatibilité » (iPhone) ;
  - sur le PC principal, passer ce Wi-Fi en profil « Privé », puis désactiver et réactiver le
    mode réseau ; l'adresse change, il faut rescanner le code QR.
- **Kits mis à jour** (16/10/2026), toujours en 14.0.2 :
  - `dist/Kit-essai-terrain-14/` : fiche HTML et PDF (routeur de terrain, partage de connexion)
    et `Notice_MiseAJour_SSF_14.docx` ajoutée ;
  - `dist/Kit-essai-Mac-14/` : la fiche Mac (`docs/essai-mac`) reçoit un encadré « Si la tablette
    n'arrive pas à se connecter » (page du routeur, coupe-feu, isolation et DHCP, partage de
    connexion ; pas de profil « Privé », qui n'existe pas sur Mac). La notice Word est ajoutée au
    kit et à la liste « Contenu du kit » de la fiche, et le PDF est refait.
- **Version 14.0.3 publiée** (16/10/2026, release `v14.0.3` « Latest », Windows et Mac, commit
  `89e3def`), suite aux remarques des conseillers techniques nationaux :
  - bouton « Liste Préfectorale » renommé **« 📋 Liste des sauveteurs »** (fenêtre « Gestion de la
    liste des sauveteurs », colonne de l'enregistrement des arrivées, tableau de bord) : tous les
    départements n'ont pas de liste préfectorale ;
  - **import CSV** : une liste enregistrée en UTF-16 (Excel « Texte Unicode », Bloc-notes)
    s'affichait en symboles. L'UTF-16 est maintenant lu, et un fichier illisible (classeur `.xlsx`
    renommé) est refusé avec une explication. Une liste déjà importée en symboles reste à
    supprimer et réimporter ;
  - **format de la liste** : colonnes repérées par leur titre. Format conseillé
    `ID;Nom;Prénom;Rôle;SSF`, plusieurs spécialités séparées par des virgules dans la case Rôle
    (« CE évacuation, Eq transmission ») ; aussi acceptés : « NOM Prénom » en une colonne,
    virgule ou tabulation, plusieurs lignes dans une case Excel. L'ID reste obligatoire ;
  - **tri par spécialité** à la création d'une équipe et dans « Ajouter des membres » : selon le
    type de mission, les chefs d'équipe de la spécialité (« CE … », « CT » pour la gestion), puis
    ses équipiers, puis les autres ; menu « Trier par spécialité ». Correspondances : Transmission
    (transmission, téléphone, TPS, SPL, radio), ASV (assistance victime, médecin, infirmier),
    Brancardage (évacuation), Désobstruction (désob, artificier), Plongée (plongeur seulement),
    Logistique (gestion matériel, pompage, ventilation, flottaison), Gestion (Gestion PC, CT) ;
  - test `tests/verif-import-liste.js` ajouté à `npm test` (encodages, format d'un département,
    tri d'une équipe téléphone).
- **Après la 14.0.3** (16/10/2026, commit `70dafa6`, pour la prochaine version) : la ligne
  « Format » sous « Importer CSV » affichait encore l'ancien format, corrigée. Notice et
  scénario de formation mis à jour (document Claude et Word) : nouveau nom du bouton, format
  conseillé, tri par spécialité ; l'annexe du scénario passe au format `ID;Nom;Prénom;Rôle;SSF`
  avec spécialités (à recopier dans `liste-formation.csv`) et l'étape de l'équipe 3 fait constater
  le tri. Scénario rejoué : 112/112. Notice Word copiée dans les deux kits.
- **Kits passés en 14.0.3** (16/10/2026, commit `68485ea`) :
  - `dist/Kit-essai-terrain-14/` : `Application-SSF-Setup-14.0.3.exe` (téléchargé depuis la
    release, identique à celui construit) ;
  - `dist/Kit-essai-Mac-14/` : `Application-SSF-14.0.3-arm64.dmg` et `Application-SSF-14.0.3.dmg` ;
  - fiches `docs/essai-terrain` et `docs/essai-mac` en 14.0.3, PDF refaits ; anciens
    installateurs 14.0.2 retirés.
- **Liste des sauveteurs depuis la base nationale** (16/10/2026), autre remarque des conseillers
  techniques ; l'import CSV reste disponible, en complément :
  - **« 📊 Importer la base nationale (Excel) »** (commit `af53de1`) : lit le fichier « Export au
    format Excel » de sauveteurs.speleo-secours-francais.fr (une colonne 0/1 par spécialité).
    Correspondances : CPT → Artificier, Gestion → Gestion PC, Eaux vives → Flottaison (rangée en
    Logistique), Pompage, Ventilation, Logistique → Logistique ; chefs d'équipe évacuation et ASV.
    Les sauveteurs non opérationnels ou non fédérés sont importés avec la mention « NON
    OPÉRATIONNEL ». Téléphones non repris. SSF lu dans le nom du fichier (modifiable). Aperçu
    (nouveaux, mis à jour, retirés), puis la liste est **remplacée** (action
    `SAUVETEURS/LISTE_REMPLACER`), en gardant les sauveteurs déjà arrivés sur le secours.
    Essai sur un vrai export (99 sauveteurs) ; le fichier, avec ses données personnelles, a été
    supprimé ensuite ;
  - **« 🌐 Récupérer depuis la base nationale »** (commit `dbd270b`, `serveur/base-nationale.js`) :
    ouvre le site dans une fenêtre de l'application (session séparée `persist:base-nationale`,
    navigation limitée au site). L'utilisateur s'identifie lui-même, clique sur « Export au
    format Excel » : le fichier est intercepté, passe par le même aperçu, puis est supprimé du
    disque. Connexion gardée, « Se déconnecter de la base » l'oublie. Test
    `tests/verif-base-nationale.js` (faux site local) dans `npm test` ; essai réel concluant.
- **Version 14.0.4 publiée** (16/10/2026, release `v14.0.4` « Latest », Windows et Mac, commit
  `0307b3d`) avec ces deux ajouts. Notice mise à jour (puce « Nouveautés de la 14.0.4 », ligne du
  tableau, section « Nouveau : la liste depuis la base nationale »), Word copié dans les kits.
- **Kits passés en 14.0.4** (16/10/2026) : `Application-SSF-Setup-14.0.4.exe` dans
  `dist/Kit-essai-terrain-14/`, `Application-SSF-14.0.4-arm64.dmg` et `Application-SSF-14.0.4.dmg`
  (téléchargés depuis la release) dans `dist/Kit-essai-Mac-14/` ; fiches `docs/essai-terrain` et
  `docs/essai-mac` en 14.0.4, PDF refaits ; installateurs 14.0.3 retirés.

## 7. Reste à faire

- **Scénario de formation** : ajouter la récupération depuis la base nationale (à faire plus tard,
  à la demande de l'utilisateur).
- **Films** : à retourner une fois les remarques des conseillers techniques traitées (bouton
  renommé, nouvelle liste, tri par spécialité, base nationale) ; les scripts sont à jour sauf
  pour la base nationale.
- **Essai sur un vrai Mac**, avec le kit `dist/Kit-essai-Mac-14/` : ni l'application 14 (serveur
  intégré, reprise des données, pare-feu macOS — partie Mac de `serveur/parefeu.js`) ni le
  bootstrapper Mac n'ont été essayés sur un Mac.
- **Mise à jour automatique sur Mac** : l'application n'étant pas signée par Apple, elle ne
  fonctionnera probablement pas. Vérifiable maintenant : un Mac en 14.0.0 ou 14.0.1 doit se voir
  proposer la 14.0.2. Sinon, les utilisateurs Mac relanceront le bootstrapper à chaque nouvelle version.
- **Bootstrapper Windows corrigé** : l'installation complète n'a pas encore été faite avec la
  nouvelle version (à vérifier à la prochaine installation).
- Désinstaller « Application SSF Reseau (test) » des PC d'essai et retirer sa règle de pare-feu
  (`retirer-pare-feu.cmd` du kit) : la 14 crée sa propre règle « Application SSF ». C'est fait
  sur le PC de développement (07/10/2026 : application, règle et dossier de données retirés).
- Les données de la version de test (`%APPDATA%\Application SSF Reseau (test)`) ne sont **pas**
  reprises par la 14 : exporter avant (« Exporter Tout ») ce qui doit être gardé.

## 8. Retour en arrière, en cas de problème

- La mise à jour automatique ne sait pas revenir à une version plus ancienne : un problème se
  corrige en publiant une nouvelle version, par exemple **14.0.5** (depuis `C:\Projets\SSF`, `main`).
- En urgence sur un PC : réinstaller la 13.42.1 (release GitHub v13.42.1). Comme l'ancienne
  mémoire n'est jamais effacée, la 13 retrouve les secours **tels qu'ils étaient avant la mise à
  jour** ; ce qui a été saisi avec la 14 serait à reprendre par « Exporter Tout » (14) puis
  « Importer Tout » (13) — **compatibilité de ce chemin non vérifiée** : à essayer avant d'en
  dépendre.
