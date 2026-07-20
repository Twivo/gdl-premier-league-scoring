# Inventaire fonctionnel complet

Ce document décrit l’ensemble des fonctionnalités présentes dans le programme
**GDL Premier League Scoring** au 20 juillet 2026. Il couvre les fonctions
visibles dans l’application publiée, les services qui travaillent en arrière-plan
et les anciens modules toujours présents dans le code.

## 1. Périmètre et statut des fonctions

Trois statuts sont utilisés dans ce document :

- **Actif** : accessible dans l’application publiée depuis la navigation actuelle.
- **Service interne** : utilisé par une fonction active, mais sans écran autonome.
- **Module historique non exposé** : code toujours présent et fonctionnel dans le
  dépôt, mais aucune route de l’application actuelle ne permet d’y accéder.

Les routes actuellement publiées sont volontairement limitées :

| Route | Statut | Fonction |
| --- | --- | --- |
| `#/` | Actif | Station de scoring Premier League et sélection du board |
| `#/login` | Actif | Connexion du marqueur ou de l’organisateur |
| `#/game/:id` | Actif | Scoring d’un match |
| `#/live/:id` | Actif | Suivi public et lecture seule d’un match précis |
| Toute autre route | Actif | Redirection automatique vers la station de scoring |

La création des compétitions, l’affectation des matchs aux boards et
l’administration du tournoi sont actuellement déléguées au site externe du
tournoi. Les écrans historiques correspondants sont décrits à la section 11.

## 2. Station de scoring Premier League — actif

### 2.1 Sélection et mémorisation du board

- Sélection d’un numéro de board compris entre 1 et 999.
- Proposition automatique des numéros de boards réellement utilisés dans la
  compétition chargée.
- Possibilité de saisir manuellement un autre numéro valide.
- Mémorisation du board choisi dans le navigateur pour le retrouver après un
  rechargement ou une nouvelle ouverture.
- Migration automatique de l’ancienne préférence nommée `target` vers la
  préférence `board`, puis suppression de l’ancienne valeur.
- Possibilité de changer de board à tout moment depuis l’écran d’accueil.
- Fonctionnement maintenu si le stockage du navigateur est désactivé ou
  indisponible ; seule la mémorisation du choix est alors perdue.

### 2.2 Chargement de la compétition

- Recherche de la compétition Premier League courante et non terminée.
- Repli sur la compétition la plus récente lorsque la notion de compétition
  courante n’est pas disponible.
- Affichage du nom de la compétition et de son format.
- État d’attente explicite lorsqu’aucune compétition n’a encore été publiée.
- État vide explicite lorsqu’aucun match n’est affecté au board sélectionné.

### 2.3 Liste des matchs affectés au board

- Regroupement des matchs affectés au board sélectionné, toutes soirées
  confondues.
- Classement fonctionnel des matchs : en cours, disponibles, bloqués, puis
  terminés ; l’ordre de soirée, de tour et de passage départage les matchs.
- Séparation entre les matchs à jouer et l’historique des matchs terminés.
- Mise en évidence du prochain match jouable.
- Affichage des deux adversaires, du numéro de soirée, du tour, du format
  « Best of », du statut et du score en legs.
- Reconstruction du score en legs depuis le journal réel du match lorsqu’un
  match est déjà commencé.
- Bouton adapté à l’état : commencer, reprendre, attendre ou consulter.
- Interdiction visuelle et fonctionnelle de démarrer un match dont les joueurs
  ne sont pas encore connus ou dont les dépendances ne sont pas terminées.

### 2.4 Actualisation automatique

- Abonnement Supabase Realtime aux changements utiles de compétition, soirées,
  fixtures et matchs.
- Rafraîchissement de secours toutes les cinq secondes.
- Rafraîchissement immédiat lorsque la fenêtre reprend le focus.
- Mise à jour automatique des affectations, statuts et scores sans action du
  marqueur.

### 2.5 Démarrage et reprise d’un match

- Connexion obligatoire pour scorer un match Premier League lorsque Supabase
  Auth est disponible.
- Reprise directe d’un match déjà lié à la fixture.
- Pour un nouveau match, demande du joueur qui commence le premier leg.
- Alternance automatique du starter à chaque nouveau leg.
- Création d’un match en 501, simple, Double Out, avec le nombre de legs à
  gagner imposé par le tour du tournoi.
- Démarrage idempotent : plusieurs pressions ou deux tentatives simultanées ne
  doivent pas créer deux matchs pour la même fixture.
- Recherche et réutilisation d’un match déjà existant pour la fixture, même si
  son lien vers le tableau doit être réparé.
- Réparation ciblée des liens compétition, soirée et fixture sans écraser le
  journal des volées déjà enregistré.
- En cas de concurrence, reprise du match gagnant créé en base plutôt que perte
  ou duplication des données.
- Reprise possible d’un match orphelin existant même si la remise en lien avec
  le tableau rencontre temporairement une erreur.

## 3. Écran de scoring — actif

### 3.1 Présentation du match

- Affichage permanent des deux camps, de leurs scores restants et des legs
  gagnés.
- Mise en avant du joueur qui doit lancer.
- Étoile à côté du joueur qui a commencé le leg courant.
- Affichage du numéro du leg, de la variante X01 et de la règle Double Out.
- Grand score central pour le joueur actif, avec diminution en direct pendant
  la saisie.
- Affichage des moyennes et du nombre de fléchettes par camp.
- Interface sombre à forts contrastes, chiffres tabulaires et grandes zones
  tactiles adaptées à une station placée près du board.
- Mise en page responsive : dès la largeur tablette, les scores et l’historique
  restent à gauche tandis que le pavé passe à droite ; la hauteur des deux zones
  est compactée pour conserver l’ensemble dans une seule fenêtre.
- Mise en page centrale resserrée afin de laisser apparaître au minimum les
  deux dernières volées complètes de chaque joueur à 1024 × 768 ; trois volées
  complètes apparaissent à 768 × 1024.

### 3.2 Saisie d’une volée

- Pavé numérique tactile avec chiffres de 0 à 9.
- Retour arrière, validation et effacement de la saisie.
- Grand bouton de validation utilisable rapidement pendant un match.
- Raccourcis de scores courants : 26, 41, 45, 59, 60, 81, 99, 100, 140 et 180.
- Support du clavier physique : chiffres, `Entrée`, `Retour arrière` et `Échap`.
- Désactivation des raccourcis clavier globaux lorsqu’une fenêtre de dialogue
  doit recevoir la saisie.
- Deux modes de saisie acceptés :
  - score réalisé pendant la volée ;
  - score restant désiré, lorsqu’un nombre saisi dépasse 180.
- Le bouton central permet de valider directement le score restant affiché.
- Affichage immédiat d’un message métier lorsqu’une saisie est impossible.

### 3.3 Validation des règles de darts

- Score d’une volée obligatoirement entier et compris entre 0 et 180.
- Rejet des totaux impossibles avec trois fléchettes : 172, 173, 175, 176, 178
  et 179.
- Rejet d’une volée supérieure au score restant.
- Rejet d’une volée qui laisserait exactement 1.
- Un score restant de 0 n’est accepté que s’il existe un checkout Double Out
  valide.
- Checkout maximal reconnu : 170.
- Rejet des nombres « bogey » qui ne peuvent pas être terminés en trois
  fléchettes.
- Calcul du minimum physique de 1, 2 ou 3 fléchettes nécessaire pour un
  checkout.
- Le bull à 50 est reconnu comme un double pour terminer un leg.

### 3.4 Checkout et fin de leg

- Lorsqu’une saisie termine le leg, ouverture d’une confirmation dédiée.
- Choix du nombre de fléchettes réellement utilisées pour le checkout : 1, 2
  ou 3.
- Désactivation des nombres de fléchettes physiquement impossibles pour le
  checkout saisi.
- Touches rapides 1, 2 et 3 mises en évidence lorsqu’un checkout est possible.
- Appui prolongé sur une de ces touches pour enregistrer directement le nombre
  de fléchettes du checkout.
- Action « Miss » pour enregistrer une volée à zéro lorsqu’un joueur manque une
  finition.
- Passage automatique au leg suivant et alternance du starter.
- Détection automatique de la victoire dès que le nombre de legs requis est
  atteint.

### 3.5 Bust, forfaits et corrections

- Action « Bust » disponible lorsque la situation la rend utile.
- Un bust conserve le score restant du début de la volée et compte les
  fléchettes jouées.
- Forfait d’un leg avec confirmation.
- Forfait du match avec confirmation.
- Pour une rencontre officielle, normalisation du score final en legs afin que
  le vainqueur atteigne bien le nombre de legs requis.
- Annulation du dernier événement enregistré.
- Modification d’une ancienne volée par pression sur la ligne correspondante.
- Nouvelle validation complète du score lors d’une correction.
- Modification du nombre de fléchettes si la volée corrigée devient un
  checkout.
- Recalcul de tout le match après une correction : ordre de lancer, scores,
  legs, vainqueur et statistiques suivants sont donc remis en cohérence.

### 3.6 Historique des volées

- Historique séparé pour chaque camp pendant le leg courant.
- Volées affichées de la plus récente à la plus ancienne sur l’écran de scoring.
- Pour chaque volée : score réalisé, mention bust ou checkout, score restant
  après la volée et nombre de fléchettes.
- Ligne sélectionnable pour ouvrir la correction de la volée.
- Historique conservé dans le journal d’événements du match et retrouvé à la
  reprise.

### 3.7 Fin de match

- Détection automatique de l’état terminé et du vainqueur.
- Pour les matchs génériques, écran final avec animation de confettis.
- Tableau comparatif : legs gagnés, moyenne trois fléchettes, moyenne First 9,
  total de fléchettes, meilleur et moins bon leg, meilleure volée, nombres de
  180, 140+, 100+, 60+ et busts.
- Mise en évidence de la meilleure valeur pour chaque statistique pertinente.
- Bouton de retour pour corriger le dernier score gagnant et rouvrir le match.
- Bouton de sortie vers le parcours appelant.
- Pour la Premier League, enregistrement du match terminé avant la remontée du
  résultat dans la fixture et le tableau.
- Écran de nouvelle tentative si l’enregistrement du résultat Premier League
  échoue temporairement.

## 4. Moteur de match X01 — service interne

### 4.1 Modèle événementiel

- Un match est défini par une configuration immuable et une liste ordonnée
  d’événements.
- Événements supportés : volée, bust, forfait de leg et forfait de match.
- L’état complet est reconstruit depuis ces données : score restant, leg
  courant, starter, joueur actif, legs gagnés, statut et vainqueur.
- Aucun score dérivé n’est considéré comme une seconde source de vérité.
- Cette reconstruction rend les fonctions d’annulation et de correction
  cohérentes sur l’ensemble des événements qui suivent.

### 4.2 Formats supportés par le moteur

- Variantes 501 et 601.
- Sortie Double Out.
- Simple, un joueur contre un joueur.
- Double, deux joueurs contre deux joueurs.
- Alternance stable des camps à chaque volée.
- En double, alternance stable des joueurs au sein de leur camp.
- Starter choisi manuellement, déterminé par un bull ou alterné suivant la
  configuration du match.
- Nombre configurable de legs nécessaires pour gagner.

La station Premier League active utilise seulement le sous-ensemble 501,
simple, Double Out et starter manuel au premier leg.

## 5. Premier League — règles et progression automatiques

### 5.1 Création et format métier

- Validation d’une liste de huit participants distincts.
- Génération de sept soirées de ligue.
- Chaque soirée comprend quatre quarts de finale, deux demi-finales et une
  finale.
- Tous les matchs des sept soirées sont en Best of 5, soit premier à trois legs.
- Génération des quarts par méthode circulaire afin que chaque paire de joueurs
  se rencontre exactement une fois sur les sept soirées.
- Propagation automatique du vainqueur d’un quart vers sa demi-finale, puis du
  vainqueur de la demi-finale vers la finale.
- Calcul du statut de la soirée, de son vainqueur et de sa date de fin.

### 5.2 Classement

- Attribution de cinq points au vainqueur d’une soirée.
- Attribution de trois points au finaliste battu.
- Attribution de deux points à chacun des demi-finalistes battus.
- Calcul, pour chaque joueur, de la position, des points, des soirées jouées et
  gagnées, des finales perdues, des demi-finales atteintes, des matchs gagnés et
  perdus, des legs gagnés et perdus et de la différence de legs.
- Départage dans cet ordre : points, soirées gagnées, différence de legs, legs
  gagnés, matchs gagnés, confrontation directe, puis nom du joueur.
- Sélection automatique du Top 4 après les sept soirées de ligue.

### 5.3 Finals Night

- Demi-finale entre le premier et le quatrième du classement.
- Demi-finale entre le deuxième et le troisième.
- Demi-finales en Best of 9, soit premier à cinq legs.
- Finale en Best of 11, soit premier à six legs.
- Propagation automatique des gagnants vers la finale.
- Enregistrement du champion et clôture de la compétition.

### 5.4 Verrous de progression et corrections

- Une soirée future reste bloquée tant que la précédente n’est pas terminée.
- Une soirée peut être débloquée explicitement par l’organisateur.
- La Finals Night reste bloquée tant que les sept soirées ne sont pas terminées,
  sauf dérogation d’administration.
- Un match déjà démarré reste toujours reprenable, même si les règles de
  planification ont changé ensuite.
- Validation du format fixe, des joueurs, du vainqueur et du score en legs lors
  de l’enregistrement d’un résultat.
- Possibilité interne de rouvrir un résultat uniquement si aucun match dépendant
  n’a déjà commencé ou été terminé.
- Lors d’une réouverture autorisée, retrait du joueur propagé et remise en attente
  des matchs dépendants.
- Modification interne des affiches de quarts avec règles de forçage destinées
  à éviter de casser un tableau déjà commencé.

Les écrans de création, de dérogation et de modification du tableau ne sont pas
exposés par l’application de scoring actuelle ; ils sont pilotés par le site du
tournoi.

## 6. Sauvegarde, reprise et tolérance réseau — actif et service interne

### 6.1 Sauvegarde du match

- Sauvegarde automatique de la configuration et du journal complet après chaque
  modification du match.
- Conservation des liens vers la saison, la rencontre par équipes ou la fixture
  Premier League pendant toutes les sauvegardes.
- Statut de sauvegarde visible : enregistré, en cours ou hors ligne.
- Une seule boucle séquentielle écrit en base afin d’éviter que deux sauvegardes
  ne se dépassent.
- La version la plus récente reste en mémoire tant qu’elle n’a pas été acceptée
  par la base.
- En cas d’échec réseau, nouvelle tentative toutes les 2,5 secondes.
- Une nouvelle volée remplace la version en attente par un journal complet plus
  récent ; elle n’est donc pas abandonnée.

### 6.2 Verrou de marqueur unique

- Identité temporaire propre à chaque onglet de navigateur.
- Verrou atomique posé sur le match par l’appareil qui score.
- Heartbeat du verrou toutes les huit secondes.
- Verrou considéré comme abandonné après vingt secondes sans heartbeat.
- Un deuxième appareil ne peut pas modifier le match tant que le premier tient
  le verrou ; il est redirigé vers le live en lecture seule.
- Libération immédiate tentée à la sortie du match.
- Si la libération échoue, le verrou expire naturellement.
- Mode « fail-open » si Supabase n’est pas configuré, si la migration du verrou
  manque ou si le backend renvoie une erreur, afin de ne jamais rendre le
  scoring inutilisable.

### 6.3 Backends interchangeables

- Interface de dépôt unique pour isoler l’interface utilisateur du stockage.
- Backend Supabase lorsque l’URL et la clé anon sont configurées.
- Backend local basé sur le stockage du navigateur pour le développement, la
  démonstration et les anciens parcours sans cloud.
- Fournisseur d’authentification sélectionné de la même manière.
- Supabase reste la source de vérité des matchs dans le mode cloud ; les appels
  de données ne sont pas mis en cache par la PWA.

## 7. Live public — actif pour un match précis

- Accès direct en lecture seule par `#/live/:id` sans outil de scoring.
- Chargement et reconstruction du match depuis son journal d’événements.
- Actualisation périodique et abonnement aux changements temps réel lorsque le
  backend le permet.
- Affichage du badge LIVE ou terminé, de la variante, du format et du nombre de
  legs nécessaires.
- Affichage des deux camps, scores restants, legs gagnés et moyennes.
- Indication du camp qui doit lancer et, pour un double, du joueur précis.
- Indication d’une situation de checkout.
- Tableau chronologique des volées du leg courant.
- Génération d’un QR code vers l’adresse du live affiché.
- Pour un ancien match de championnat par équipes, affichage du score global de
  la rencontre et d’un récapitulatif de toutes les fixtures : type simple,
  double ou décisif, joueurs, statut et score en legs.

La liste générale `#/live` existe encore comme module historique, mais sa route
n’est plus publiée. Le live direct est conservé notamment comme solution de
repli lorsqu’un autre appareil détient le verrou de scoring.

## 8. Authentification, rôles et autorisations

### 8.1 Authentification active

- Connexion Supabase par adresse e-mail et mot de passe.
- Session persistante, rafraîchissement automatique du jeton et réaction aux
  changements de session.
- Déconnexion depuis la station de scoring.
- Redirection d’un utilisateur déjà connecté vers l’accueil du scoring.
- En mode local, absence volontaire de fausse connexion sécurisée et indication
  que l’application fonctionne localement.

### 8.2 Rôles disponibles dans le modèle

- Un compte lié à une équipe par `team_accounts` reçoit le rôle capitaine et le
  périmètre de cette équipe.
- Un compte authentifié sans ligne capitaine est considéré comme administrateur.
- Gardes de routes administrateur et capitaine présentes pour les modules
  historiques, même si ces routes ne sont plus branchées dans l’application
  publiée.

### 8.3 Sécurité des données

- Row-Level Security activée dans Supabase.
- Lectures publiques prévues pour les informations nécessaires au live.
- Écritures Premier League réservées aux utilisateurs authentifiés.
- Dans le modèle historique, création et scoring des matchs d’entraînement
  autorisés sans compte, mais suppression réservée à l’administrateur.
- Écritures d’équipe et de championnat limitées par rôle et par équipe.
- Attribution et retrait d’un compte capitaine par fonctions dédiées.
- Clé Supabase anon utilisée côté client comme prévu par Supabase ; les droits
  sensibles reposent sur les politiques RLS.
- Aucune clé `service_role` ne doit être utilisée dans le navigateur.
- Politique CSP dans la page HTML : sources restreintes, avec autorisation des
  connexions HTTPS et WebSocket nécessaires à Supabase et des outils locaux de
  développement.
- Protection des exports CSV historiques contre l’interprétation de cellules
  comme formules de tableur.

## 9. Internationalisation, ergonomie et PWA

### 9.1 Langues et interface

- Interface française et anglaise à partir d’un dictionnaire local.
- Bascule FR/EN disponible sur la station.
- Préférence de langue mémorisée dans le navigateur.
- Messages métier traduits : scoring, validation, checkout, connexion, live,
  statistiques, championnat et administration historique.
- Composants partagés pour les boutons, fenêtres modales, chargements et
  confirmations.
- Désactivation de la sélection involontaire de texte et amélioration du toucher
  sur les commandes de scoring.

### 9.2 Application web installable

- Manifeste PWA « GDL Premier League Scoring » et nom court « GDL Scoring ».
- Installation sur écran d’accueil avec icônes standard et maskable 512 × 512.
- Mode d’affichage autonome, orientation libre et couleurs de thème sombres.
- Service worker mis à jour automatiquement.
- Préchargement uniquement de la coque de l’application : HTML, JavaScript,
  CSS, SVG et polices WOFF2.
- Les requêtes Supabase et API ne sont jamais interceptées ni mises en cache.
- Service worker désactivé en développement pour éviter les versions locales
  périmées.
- Routage par hash et base relative, compatible avec un sous-chemin GitHub Pages.

## 10. Statistiques calculées — service interne et écrans associés

### 10.1 Statistiques d’un match

- Legs gagnés.
- Total marqué et total de fléchettes.
- Moyenne sur trois fléchettes.
- Moyenne First 9.
- Checkouts réussis, tentatives de checkout et pourcentage de réussite.
- Meilleur checkout.
- Nombre de 180, 140+, 100+ et 60+.
- Nombre de busts et meilleure volée.
- Moyenne par leg.
- Meilleur leg et moins bon leg en nombre de fléchettes.
- En double, attribution des volées au joueur réel et calcul des legs sur
  l’ensemble des fléchettes du camp.

### 10.2 Agrégation joueur et saison

- Matchs joués, matchs gagnés et taux de victoire.
- Legs gagnés.
- Total marqué et total de fléchettes.
- Moyennes sur trois fléchettes, First 3 et First 9.
- Checkouts réussis, tentatives, pourcentage, checkout moyen et meilleur
  checkout.
- Comptages 180, 140+, 100+, 60+, busts et meilleure volée.
- Meilleur leg.
- Une tentative de checkout est comptée une seule fois par joueur et par leg
  dès qu’il atteint une zone de finition ; le checkout gagnant est enregistré
  avec sa valeur réelle.

## 11. Modules historiques présents mais non exposés

Les fonctions de cette section existent dans le dépôt et sont conservées, mais
les routes correspondantes ont été retirées de `App.tsx`. Elles ne doivent donc
pas être considérées comme disponibles dans la navigation de production sans
réactivation et nouvelle vérification complète.

### 11.1 Ancien accueil de club

- Accueil général avec création et reprise de matchs d’entraînement.
- Reprise des rencontres par équipes en cours.
- Accès aux sections championnat, live et administration.
- Compteur de matchs live et QR code.
- Connexion, déconnexion et changement FR/EN.
- Fenêtre ludique de règles de célébration des checkouts et des 180.

### 11.2 Configuration d’un match d’entraînement

- Choix entre 501 et 601.
- Choix simple ou double.
- Sélection et recherche des joueurs actifs, avec leur couleur.
- Choix de un à cinq legs nécessaires pour gagner.
- Choix du starter manuellement ou par résultat du bull.
- Alternance du starter entre les legs.
- Sauvegarde immédiate du nouveau match et lancement de l’écran de scoring.
- En mode local historique, utilisation possible sans connexion.

### 11.3 Championnat par équipes

- Création d’une rencontre entre deux équipes avec instantané des noms et des
  effectifs.
- Vérification d’un minimum de quatre joueurs par équipe.
- Format fixe initial de dix matchs : quatre simples, deux doubles, puis quatre
  simples.
- Matchs en 501 Double Out, premier à deux legs par défaut.
- Starter décidé au bull pour le premier match, puis alterné.
- Construction progressive des blocs de fixtures.
- Composition des simples et doubles avant leur démarrage.
- Réorganisation de l’ordre des fixtures non commencées ; les matchs démarrés
  ou terminés restent verrouillés.
- Écran de préparation avant match avec composition et vainqueur du bull.
- Réutilisation du même moteur X01 et du même écran de scoring.
- Mise à jour automatique du score global de la rencontre.
- Si les dix matchs produisent un score de 5–5, création d’un double décisif.
- Pour le double décisif, obligation d’utiliser une nouvelle paire tant qu’une
  paire inédite est encore possible ; réutilisation autorisée seulement lorsque
  toutes les possibilités ont été épuisées.
- Impossibilité de clôturer une rencontre sur une égalité.
- Écran statistique après chaque match.
- Retour sur la volée gagnante pour corriger et rouvrir un résultat.
- Fenêtre de configuration permettant d’ajuster le nombre de legs, le camp qui
  commence, la politique d’alternance, l’ordre et les compositions des matchs
  non commencés.
- Écran final de rencontre avec statistiques agrégées par équipe et récompenses :
  MVP à la moyenne, meilleur checkout, meilleur First 9 et plus grand nombre de
  180.
- Récapitulatif live de la rencontre complète.

### 11.4 Espace administrateur

- Navigation historique : joueurs, équipes, statistiques, championnat et bilan
  de saison.
- Gestion des joueurs : création, recherche, tri par nom ou date, renommage,
  activation, désactivation et suppression confirmée.
- Conservation de l’historique lorsque les contraintes de base interdisent une
  suppression destructive.
- Gestion des équipes : création, recherche, renommage et suppression.
- Ajout et retrait de membres avec recherche et sélecteur de joueurs.
- Contrôle fonctionnel pour éviter qu’un joueur appartienne à plusieurs équipes.
- Attribution ou retrait du rôle de capitaine d’équipe à partir d’une adresse
  e-mail.
- Vue championnat : filtre par saison, rencontres, dates, statuts, vainqueurs et
  scores.
- Détail d’une rencontre : liste des fixtures, joueurs, statut, forfait éventuel
  et score en legs.
- Détail d’un match : résumé, métriques des participants et volées leg par leg.

### 11.5 Tableau de statistiques administrateur

- Données limitées aux matchs de championnat ; les entraînements sont exclus
  des classements et moyennes.
- Filtres par saison, simple/double/tous, variante 501/601/toutes, joueur et
  période.
- Périodes proposées : tout l’historique, aujourd’hui, sept derniers jours, mois
  courant, année courante ou dates personnalisées.
- Colonnes triables : matchs joués, gagnés, taux de victoire, legs, moyenne,
  First 9, First 3, checkout moyen, meilleur checkout, 180, 140+, 100+, 60+,
  busts, meilleure volée, meilleur leg et total de fléchettes.
- Filtrage sur un joueur et affichage de son historique : date, adversaire,
  format, score, résultat et moyenne.
- Ouverture du détail d’un match depuis l’historique.
- Export du tableau filtré au format CSV UTF-8 avec nom de saison assaini et
  neutralisation des débuts de cellule dangereux pour un tableur.

### 11.6 Profil joueur et bilan de saison

- Vue carrière : matchs, victoires, taux de victoire, moyenne et First 9.
- Courbe SVG d’évolution de la moyenne avec meilleure et dernière valeur.
- Historique des matchs du joueur.
- Records personnels, dont meilleur checkout et nombre de 180.
- Sélection d’un adversaire et confrontation directe : matchs, victoires,
  défaites, legs et moyennes.
- Sélection d’une saison pour le bilan général.
- Totaux de saison et nombre de rencontres de championnat.
- Récompenses de saison : MVP, meilleur checkout, plus de 180, meilleur First 9,
  plus de legs gagnés et plus de victoires.
- Classements dédiés aux meilleures moyennes, aux 180 et aux legs gagnés.

### 11.7 Espace capitaine d’équipe

- Navigation historique : nouvelle rencontre, historique, statistiques et
  effectif.
- Équipe du capitaine imposée par son compte.
- Création d’une rencontre avec l’équipe du capitaine à domicile, choix de
  l’adversaire et contrôle du minimum de quatre joueurs.
- Utilisation de la saison courante.
- Gestion d’effectif : création d’un joueur et ajout immédiat, ajout d’un joueur
  existant sans équipe, recherche et retrait de l’effectif.
- Le retrait d’un joueur de l’effectif ne supprime pas son historique.
- Statistiques de l’équipe par joueur : matchs, victoires, taux de victoire et
  moyenne, avec ouverture du profil.
- Historique de l’équipe : adversaire, date, score, victoire/défaite ou en cours,
  bilan cumulé et ouverture de la rencontre.
- Politiques RLS limitant le capitaine aux écritures de sa propre équipe et aux
  rencontres qui la concernent.

### 11.8 Liste générale des lives

- Liste historique des matchs en cours avec rafraîchissement toutes les cinq
  secondes.
- Ouverture du live en lecture seule d’un match sélectionné.
- Dans l’implémentation Supabase actuelle, cette liste exclut les fixtures
  Premier League et vise les anciens matchs d’entraînement ou par équipes.

## 12. Modèle de données et intégrations

- Joueurs actifs ou inactifs, avec nom et couleur.
- Équipes, membres et comptes capitaines.
- Saisons avec contrainte d’unicité de la saison courante.
- Matchs avec configuration, journal d’événements, statut, vainqueur, liens
  rapides vers les joueurs et dates de création/fin.
- Rencontres de championnat avec instantanés d’équipes et fixtures imbriquées.
- Compétitions Premier League, participants, soirées, fixtures, affectations aux
  boards, résultats et dérogations de progression.
- Contrainte d’unicité empêchant plusieurs matchs de scorer la même fixture
  Premier League.
- Contraintes SQL, clés étrangères, déclencheurs `updated_at` et publications
  Realtime.
- Client Supabase pour Postgres, Auth et Realtime.
- Dépôt local offrant la même interface pour les tests et démonstrations.

## 13. Déploiement et qualité

- Construction avec React, TypeScript, Vite et Tailwind CSS.
- Tests unitaires Vitest du moteur de scoring, des validations, des checkouts,
  des statistiques, du championnat par équipes, de la Premier League et de son
  dépôt local.
- Compilation TypeScript vérifiée pendant le build de production.
- Déploiement GitHub Pages automatique à chaque push sur la branche `main`.
- Workflow GitHub Actions sous Node.js 22 : installation reproductible avec
  `npm ci`, build, création de l’artefact Pages puis publication.
- Une seule publication Pages à la fois ; une publication plus récente annule
  celle qui est devenue obsolète.
- Variables Supabase injectées au build depuis les secrets GitHub Actions.

## 14. Limites fonctionnelles actuelles à connaître

- L’application publiée est une station de scoring Premier League, pas le site
  complet d’administration du tournoi.
- Seuls les quatre parcours listés à la section 1 sont actuellement accessibles.
- La station ne crée pas elle-même une compétition et n’affecte pas les boards ;
  elle consomme les données préparées par le site du tournoi.
- Le moteur sait gérer 601 et les doubles, mais la Premier League active impose
  501 et simple.
- La PWA conserve la coque de l’interface, mais un accès réseau reste nécessaire
  pour charger et synchroniser les données Supabase.
- En mode cloud, une coupure réseau conserve les nouvelles volées en mémoire et
  les réessaie, mais fermer l’onglet avant leur synchronisation peut perdre cette
  mémoire non encore envoyée.
- Les modules historiques décrits à la section 11 nécessitent de remettre leurs
  routes en service et de refaire une validation fonctionnelle avant de les
  annoncer comme disponibles en production.
