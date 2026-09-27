# Mode d'emploi — GDL Premier League Scoring

Ce guide s'adresse au **marqueur** qui tient la tablette d'un board (une cible)
pendant une soirée Premier League.

La compétition, les soirées et l'affectation des matchs aux cibles sont
préparées sur le site du tournoi. L'application de scoring affiche ces matchs
automatiquement ; le marqueur n'a rien à créer.

## 1. Avant la soirée

- Une tablette chargée par cible (ou branchée), avec une connexion internet.
- Ouvrir <https://twivo.github.io/gdl-premier-league-scoring/> dans le
  navigateur.
- Conseillé : installer l'application sur l'écran d'accueil.
  - Android / Chrome : menu du navigateur puis `Installer l'application`.
  - iPad / Safari : bouton de partage puis `Sur l'écran d'accueil`.
- Avoir un compte marqueur (adresse e-mail et mot de passe) fourni par
  l'organisateur.

## 2. Choisir sa cible

À la première ouverture, l'écran `Choisissez votre cible` apparaît.

1. Toucher un des numéros proposés (ce sont les cibles réellement utilisées
   dans la compétition) ou saisir un numéro dans `Numéro de la cible`.
2. Toucher `Ouvrir cette cible`.

La tablette retient ce choix : au prochain lancement, elle s'ouvre directement
sur la même cible. Le bouton `Changer de cible` permet d'en changer à tout
moment.

Le bouton `FR / EN` change la langue de l'interface.

## 3. Se connecter

Il faut être connecté pour scorer. Toucher `Se connecter pour scorer`, saisir
l'e-mail et le mot de passe du compte marqueur, puis valider. Une fois
connecté, le bouton devient `Connecté · se déconnecter`.

## 4. La liste des matchs de la cible

L'écran de la cible affiche :

- **Matchs à jouer** : en cours, disponibles, puis bloqués ; le prochain match
  jouable est mis en avant (`Prochain`) ;
- **Terminés sur cette cible** : l'historique de la soirée.

Chaque carte indique les deux joueurs, la soirée, le tour (quart, demie,
finale), le format `Best of`, l'état et le score en legs.

Un match `Bloqué` / `En attente des qualifiés` ne peut pas encore commencer :
ses joueurs dépendent de matchs pas encore terminés. La liste se met à jour
toute seule dès qu'un résultat arrive ou que l'organisateur affecte un
nouveau match ; il n'y a rien à rafraîchir.

Messages possibles :

- `En attente des données du tournoi` : la compétition n'est pas encore
  publiée. Garder la page ouverte.
- `Aucun match attribué à cette cible` : vérifier le numéro de cible, ou
  attendre l'affectation par l'organisateur.

## 5. Démarrer un match

1. Toucher `Démarrer →` sur le match.
2. Indiquer **qui lance en premier au leg 1** en touchant son nom. Le choix
   reste modifiable tant qu'on n'a pas confirmé.
3. Toucher `Démarrer le match →`.

Le premier lancer alterne ensuite automatiquement à chaque leg. Une petite
étoile à côté du nom indique le joueur qui a commencé le leg en cours.

Tant qu'aucune fléchette n'a été saisie, le bouton `⇄` en haut de l'écran
permet encore d'inverser le joueur qui commence.

Un match déjà commencé affiche `Reprendre →` : il reprend exactement là où il
s'était arrêté (score, leg, joueur actif, historique).

## 6. Saisir une volée

L'écran de scoring montre en grand le joueur qui doit lancer, le score restant
des deux joueurs, et au centre le score restant du joueur actif, qui diminue
pendant la saisie.

**Avec le pavé :**

1. Taper le score de la volée (par exemple `8`, `5` pour 85).
2. Toucher le grand bouton vert `VALIDER` (ou `✓`).

**Avec un raccourci :** toucher directement `26`, `41`, `45`, `59`, `60`, `81`,
`99`, `100`, `140` ou `180`. La volée est validée tout de suite.

- Un raccourci supérieur ou égal au score restant clignote en rouge et n'est
  pas pris en compte.
- Les raccourcis sont désactivés tant qu'un nombre est en cours de saisie au
  pavé : finir la saisie ou l'effacer avec `⌫`.

**Saisir le reste plutôt que le score :** un nombre saisi au-dessus de 180
est compris comme le score restant voulu. On peut aussi toucher le grand score
central (`Reste (toucher pour valider)`) pour valider le reste affiché.

**Sur ordinateur :** les touches `0` à `9` tapent le score, `Entrée` valide,
`Retour arrière` efface un chiffre, `Échap` efface la saisie.

L'application refuse ce qui est impossible et affiche la raison : score
au-dessus de 180, total impossible avec trois fléchettes (172, 173, 175, 176,
178, 179), score supérieur au reste, reste de 1, finish qui n'est pas une
sortie double.

## 7. Checkout, Miss et Bust

Quand le joueur est sur un finish possible, les touches `1`, `2` et `3`
deviennent vertes et le message `Checkout — maintenir 1 / 2 / 3 pour le nombre
de fléchettes` s'affiche.

- **Checkout réussi** : **maintenir** la touche correspondant au nombre de
  fléchettes utilisées (1, 2 ou 3). Un simple appui tape le chiffre, comme
  d'habitude.
- On peut aussi saisir le score du finish et valider : une fenêtre demande
  alors le nombre de fléchettes (les choix impossibles sont grisés).
- **Miss** : le joueur a raté sa finition sans marquer ; la volée compte 0.
- **BUST** : le joueur a dépassé, laissé 1 ou raté la sortie double. Son score
  revient à celui du début de la volée.

Quand un leg se termine, le score de legs se met à jour et le leg suivant
commence avec l'autre joueur. Le match s'arrête dès qu'un joueur atteint le
nombre de legs requis.

## 8. Corriger une erreur

- **La dernière saisie est fausse** : toucher `↩ Annuler`.
- **Une volée plus ancienne est fausse** : toucher la ligne dans l'historique
  des volées. Une fenêtre s'ouvre avec le pavé ; le premier chiffre tapé
  remplace le score affiché. Valider.

Après une correction, toute la suite du match est recalculée : scores, legs,
joueur qui commence et vainqueur restent cohérents.

## 9. Abandons

- `Abandonner le leg` : le leg est donné à l'adversaire.
- `Abandonner le match` : le match se termine et l'adversaire gagne.

Une confirmation est toujours demandée.

## 10. Fin du match

À la fin, l'application affiche `Match terminé — enregistrement avant le
retour à la cible…`, envoie le résultat au tableau de la compétition, puis
revient à la liste de la cible. Le vainqueur apparaît automatiquement dans le
match suivant du tableau.

Si l'enregistrement échoue (réseau), toucher `Réessayer`.

## 11. Coupure réseau

Continuer à scorer normalement. Un petit indicateur `Hors ligne — nouvelle
tentative` apparaît en haut ; l'application réessaie seule toutes les
2,5 secondes et envoie toutes les volées dès le retour du réseau. Ne pas
fermer la page tant que l'indicateur est affiché.

## 12. Suivre un match en direct

Chaque match a une page live en lecture seule (`#/live/…`) : scores, legs,
moyennes, joueur qui lance et volées du leg en cours, mis à jour en direct.
La page affiche un QR code pour la partager.

Si on ouvre sur un deuxième appareil un match déjà scoré ailleurs, ce deuxième
appareil affiche `Match en cours ailleurs` (un seul marqueur par match) et
propose `📺 En direct`.
Si la tablette du marqueur s'éteint, le match se libère tout seul au bout
d'environ 20 secondes et peut être repris depuis une autre tablette.

## 13. Problèmes courants

| Problème | Que faire |
| --- | --- |
| Aucun match sur ma cible | Vérifier le numéro de cible ; attendre l'affectation par l'organisateur. |
| Le bouton démarrer est grisé | Le match attend ses qualifiés ou la soirée précédente n'est pas terminée. |
| On me demande de me connecter | Se connecter avec le compte marqueur (section 3). |
| « Match en cours ailleurs » | Le match est scoré sur une autre tablette ; utiliser celle-ci, ou attendre 20 s si elle est éteinte. Le bouton `📺 En direct` ouvre le live. |
| Un raccourci ne fait rien | Il dépasse le reste, ou un nombre est en cours de saisie au pavé. |
| « Hors ligne » | Continuer ; la sauvegarde repart seule (section 11). |
