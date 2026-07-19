# Mode d’emploi — poste de scoring

## 1. Choisir la cible

Ouvrir l’application sur `#/`, saisir le numéro inscrit sur le poste ou la
cible, puis choisir « Ouvrir cette cible ».

Lorsque le gestionnaire du tournoi a déjà affecté des matchs, les numéros de
cibles connus sont aussi proposés comme raccourcis. Le choix est mémorisé sur
l’appareil après un rafraîchissement ou une fermeture.

« Changer de cible » revient au sélecteur.

## 2. Attendre une affectation

La page peut rester ouverte pendant la soirée. Les affectations, changements de
joueurs et scores sont actualisés automatiquement par Supabase Realtime, avec
une vérification supplémentaire toutes les cinq secondes et au retour sur la
fenêtre.

Si aucun tournoi n’est publié, l’écran indique qu’il attend les données. Si le
tournoi existe mais qu’aucun match n’est affecté à cette cible, le poste reste
également en attente.

## 3. Se connecter

La lecture des affectations est publique. Pour démarrer ou reprendre un match en
mode Supabase, utiliser « Se connecter pour scorer » et le compte prévu pour
l’événement.

Le voyant vert confirme la connexion. Le même bouton permet ensuite de se
déconnecter. En mode local, aucune connexion cloud n’est demandée.

## 4. Démarrer ou reprendre un match

Les matchs en cours sont affichés avant les matchs disponibles. Le prochain
match jouable possède un repère « Prochain ».

- « Démarrer » : les deux joueurs sont connus et le match est débloqué ;
- « Reprendre » : un journal de scoring existe déjà ;
- « Bloqué » : le tour précédent n’est pas terminé ;
- « Terminé » : le résultat reste visible dans l’historique de la cible.

Cliquer sur une carte jouable. Pour un nouveau match, choisir le joueur qui
commence le premier leg. Le starter alterne ensuite automatiquement.

## 5. Scorer

L’écran X01 existant est conservé :

- clavier numérique et boutons rapides ;
- Bust, Miss et checkout ;
- nombre de fléchettes du checkout ;
- historique et modification d’une visite ;
- moyennes et legs gagnés ;
- Undo et forfait ;
- sauvegarde automatique ;
- reprise après rafraîchissement ;
- verrou empêchant deux appareils de scorer simultanément.

Les formats Premier League restent fixes : ligue en 501 Double Out Best of 5,
demi-finales de Finals en Best of 9 et finale en Best of 11.

## 6. Fin du match

Quand le nombre de legs requis est atteint, l’application :

1. sauvegarde le match ;
2. enregistre le vainqueur ;
3. met à jour la fixture et la progression du tableau ;
4. libère les matchs devenus disponibles ;
5. revient automatiquement au menu de la cible sélectionnée.

La cible reste mémorisée : il n’est pas nécessaire de la ressaisir.

## 7. Verrou et coupure

Si un autre appareil détient le verrou, le scoring est bloqué et une lecture
seule est proposée. Après une coupure ou un rafraîchissement, rouvrir la carte
« Reprendre » pour retrouver le journal enregistré.

Un seul appareil doit scorer un match à la fois.

## 8. Rôle du site de tournoi

Cette PWA ne crée plus les joueurs, la compétition ou le tableau. Le futur site
de gestion doit publier les fixtures et renseigner
`premier_league_fixtures.target_number`.

Une valeur `null` signifie « non affecté ». Les valeurs 1 à 999 correspondent
aux numéros proposés dans le menu.

## 9. Installation PWA

- Android/Chrome : menu puis « Installer l’application » ;
- iPhone/Safari : Partager puis « Sur l’écran d’accueil » ;
- ordinateur : icône d’installation dans la barre d’adresse.

Pour une soirée, installer un poste par cible, sélectionner son numéro une seule
fois et conserver la session de scoring active.
