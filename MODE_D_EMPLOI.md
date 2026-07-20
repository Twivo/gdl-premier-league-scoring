# Mode d'emploi - MorgesDartsConnect

Ce guide explique comment utiliser l'application pendant une soiree de darts,
un entrainement ou un match de championnat a domicile des Jedis.

## 1. Acceder a l'application

Ouvrir l'application dans un navigateur recent sur telephone, tablette ou
ordinateur.

Depuis l'accueil, les actions principales sont:

- `Nouvelle partie d'entrainement`: lancer un match libre.
- `Match de championnat`: creer ou reprendre une rencontre officielle.
- `En direct`: regarder les matchs en cours.
- `Statistiques`: acceder a l'administration et aux stats.

Le bouton `FR / EN` en haut de l'accueil change la langue de l'interface. A cote,
le bouton `Se connecter` / `Se deconnecter` ouvre la page de connexion admin ou
ferme la session en cours, sans passer par le championnat.

## 2. Installer l'application sur un appareil

MorgesDartsConnect est une PWA. Selon le navigateur, il est possible de
l'installer comme une application:

- sur Android/Chrome: menu du navigateur puis `Installer l'application`;
- sur iPhone/Safari: bouton de partage puis `Sur l'ecran d'accueil`;
- sur ordinateur: icone d'installation dans la barre d'adresse si disponible.

Une fois installee, l'application s'ouvre presque comme une app native.

## 3. Nouvelle partie d'entrainement

Depuis l'accueil:

1. Cliquer sur `Nouvelle partie d'entrainement`.
2. Choisir le type de jeu: `501` ou `601`.
3. Choisir le mode: simple ou double.
4. Choisir le nombre de legs a gagner.
5. Ajouter les joueurs avec le bouton d'ajout et la recherche.
6. Choisir qui commence:
   - selection manuelle;
   - bull-up.
7. Demarrer la partie.

La partie est sauvegardee automatiquement. Si la page est fermee ou rafraichie,
elle peut etre reprise depuis l'accueil.

## 4. Saisir les scores pendant un match

L'ecran de scoring utilise de gros chiffres pour rester lisible depuis le board,
a environ 3 metres. Il montre:

- le joueur qui doit lancer, en grand;
- les scores restants des deux joueurs, en grand, avec une petite etoile a cote
  du nom du joueur qui commence le leg;
- le score restant du joueur actif en tres grand au centre, qui diminue en direct
  pendant la saisie;
- le clavier de saisie;
- l'historique des dernieres visites, une colonne par joueur;
- les actions utiles comme undo, bust ou forfait.

Pour saisir une visite:

1. Taper le score marque.
2. Appuyer sur `Valider` (ou toucher le grand score central).
3. L'application passe automatiquement au joueur suivant.

Les colonnes de scores rapides autour du clavier, ainsi que les boutons `140` et
`180`, valident directement certains scores frequents.

Sur ordinateur, le clavier physique peut piloter la saisie: les chiffres `0` a
`9` tapent le score, `Entree` valide, `Retour arriere` efface un chiffre et
`Echap` efface toute la saisie. Il est desactive quand une fenetre de fermeture
ou de correction est ouverte.

Le grand score central en cours de saisie reste en couleur normale; le rouge
signale seulement une saisie invalide.

## 5. Bust, miss et checkout

Si un joueur depasse le score restant, laisse 1, ou fait une sortie invalide,
l'application refuse la saisie ou gere le bust selon le cas.

Quand un checkout est possible:

- les choix de flechettes apparaissent;
- maintenir `1`, `2` ou `3` permet d'indiquer le nombre de flechettes utilisees;
- `Miss` enregistre une visite a 0 sans terminer le leg.

Quand le score arrive a 0 avec une sortie valide, le leg est termine et le score
de legs est mis a jour.

## 6. Corriger une erreur

Si une erreur vient d'etre saisie:

- utiliser `Undo` pour annuler la derniere action;
- ou cliquer une visite si l'interface propose la correction de cette visite.

La suppression de visite n'est pas disponible pendant un match. La correction
reste le moyen recommande pour garder l'historique coherent.

## 7. Forfait

Deux types de forfait peuvent etre proposes:

- `Forfeit leg`: donne le leg a l'adversaire;
- `Forfeit match`: termine le match et donne la victoire a l'adversaire.

Une confirmation est demandee avant d'appliquer le forfait.

## 8. Reprendre une partie

Si un match ou une rencontre est en cours, l'accueil affiche une carte de
reprise.

Cliquer sur `Reprendre` pour revenir exactement au bon endroit:

- score;
- leg;
- joueur actif;
- historique;
- etape de championnat si c'est une rencontre.

En mode cloud, la reprise peut aussi fonctionner depuis un autre appareil.

## 9. Watch Live

La page `En direct` permet de suivre les matchs sans pouvoir les modifier.

Depuis l'accueil:

- cliquer sur `En direct`;
- ou scanner le QR code `Scan to watch`.

Le live est pratique pour:

- les spectateurs;
- un telephone pose a cote du board;
- une tablette dans la salle;
- un ecran TV.

## 10. Match de championnat

Le mode championnat est protege par connexion admin.

Depuis l'accueil:

1. Cliquer sur `Match de championnat`.
2. Se connecter si l'application le demande.
3. Verifier l'equipe a domicile.
4. Les Jedis sont selectionnes automatiquement a domicile.
5. Choisir l'equipe adverse.
6. Demarrer la composition.

Les autres equipes restent disponibles si un match exceptionnel demande une
selection manuelle.

## 11. Deroulement d'une rencontre championnat

Une rencontre contient 10 matchs:

1. 4 simples;
2. 2 doubles;
3. 4 simples.

L'application guide les etapes:

- composition des simples;
- bull-up;
- match;
- stats du match;
- match suivant;
- composition des doubles;
- derniers simples;
- resultat final.

Le score de rencontre est mis a jour automatiquement apres chaque match. Il est
affiche entre les matchs (composition, stats, resultat final). Pendant le scoring
d'un match, cette ligne est masquee pour agrandir le score restant au centre.

## 12. Modifier la configuration d'une rencontre

Pendant une rencontre, le bouton de configuration permet de modifier certains
parametres pour les matchs qui ne sont pas encore joues. Entre les matchs, il se
trouve dans le bandeau de la rencontre. Pendant le scoring d'un match, il reste
accessible sous le libelle `Configurer` dans la barre du haut, a cote de
`Annuler`.

Les matchs deja joues ou deja demarres doivent rester verrouilles afin de ne pas
casser l'historique.

## 13. Statistiques

La section `Statistiques` est protegee par connexion admin.

Elle permet de consulter:

- les stats par joueur;
- les moyennes;
- les records;
- l'historique des matchs;
- les details d'une rencontre;
- les bilans de saison.

Les filtres permettent de limiter les stats par saison, joueur, type de match,
variante ou periode.

## 14. Export CSV

Dans les statistiques, l'export CSV permet de recuperer les donnees visibles
dans un tableur.

Le fichier exporte est prevu pour etre ouvert dans Excel, LibreOffice ou Google
Sheets.

## 15. Gestion des joueurs

Dans `Statistiques > Joueurs`, un admin peut:

- ajouter un joueur;
- renommer un joueur;
- activer ou desactiver un joueur;
- rechercher un joueur;
- supprimer un joueur si aucune donnee historique ne bloque l'action.

Desactiver un joueur est souvent preferable a la suppression, car cela conserve
l'historique des matchs.

## 16. Gestion des equipes

Dans `Statistiques > Equipes`, un admin peut:

- creer une equipe;
- renommer une equipe;
- ajouter des joueurs via le dialogue de recherche;
- retirer des joueurs;
- supprimer une equipe.

Pour le championnat, chaque equipe doit avoir au moins 4 joueurs.

## 17. Conseils pendant un match

- Utiliser une tablette ou un telephone avec batterie suffisante.
- Eviter de scorer le meme match depuis deux appareils en meme temps.
- Utiliser le live pour les spectateurs plutot que de leur donner l'ecran de
  scoring.
- Corriger une visite rapidement si une erreur est detectee.
- Verifier les compositions de championnat avant de lancer le premier match.

## 18. Probleme courant

### Je ne vois pas les joueurs

Verifier dans l'admin que les joueurs existent et sont actifs.

### Je ne peux pas creer un championnat

Verifier:

- que vous etes connecte en admin;
- qu'il existe au moins deux equipes;
- que chaque equipe a au moins 4 joueurs.

### Le live ne bouge pas

Verifier la connexion reseau et rafraichir la page live. En mode local, le live
est limite a l'appareil/navigateur courant.

### Une partie a disparu de l'accueil

Verifier si elle est deja terminee. Les cartes de reprise affichent seulement
les matchs ou rencontres en cours.

### Les stats ne correspondent pas a ce que j'attends

Verifier les filtres actifs: saison, periode, joueur, type de match et variante.

## 19. Bonnes pratiques admin

- Garder une seule saison courante.
- Desactiver les anciens joueurs plutot que supprimer leur historique.
- Nommer clairement les equipes.
- Verifier les compositions avant chaque rencontre.
- Ne pas partager le compte admin avec les spectateurs.
