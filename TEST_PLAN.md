# Plan de test — poste de scoring

## 0. Validation automatique

- [ ] `npm install`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] aucune erreur TypeScript, Vitest ou Vite ;
- [ ] manifest et service worker PWA générés.

## 1. Menu de cible

- [ ] `#/` affiche uniquement le poste de scoring ;
- [ ] aucun accès à la création de tournoi, entraînement, statistiques ou
      championnat ;
- [ ] une cible accepte uniquement un entier de 1 à 999 ;
- [ ] la cible sélectionnée reste active après rafraîchissement ;
- [ ] « Changer de cible » rouvre le sélecteur ;
- [ ] FR/EN couvre tous les textes visibles.

## 2. Affectations automatiques

Préparer plusieurs fixtures avec des `target_number` différents.

- [ ] seules les fixtures de la cible sélectionnée sont affichées ;
- [ ] les cibles connues sont proposées comme raccourcis ;
- [ ] un changement `target_number` apparaît par Realtime ;
- [ ] le polling actualise aussi la liste si Realtime est indisponible ;
- [ ] le retour de focus actualise immédiatement la liste ;
- [ ] les matchs en cours précèdent disponibles, bloqués puis terminés ;
- [ ] le premier match jouable est marqué « Prochain ».

## 3. Connexion et RLS

- [ ] lecture des affectations sans connexion ;
- [ ] clic sur un match à démarrer redirige vers la connexion ;
- [ ] connexion avec le compte de scoring ;
- [ ] démarrage et mise à jour autorisés pour `authenticated` ;
- [ ] écriture refusée avec la seule clé anon ;
- [ ] déconnexion disponible depuis le menu ;
- [ ] aucune clé `service_role` dans le build.

## 4. Carte de match

- [ ] Night, tour, Best of, joueurs, score et statut visibles ;
- [ ] match sans deux joueurs non cliquable ;
- [ ] match bloqué non cliquable ;
- [ ] match terminé non cliquable ;
- [ ] match disponible affiche « Démarrer » ;
- [ ] match en cours affiche « Reprendre » ;
- [ ] score live actualisé.

## 5. Scoring conservé

- [ ] choisir le starter du premier leg ;
- [ ] 501, Double Out et format de la fixture corrects ;
- [ ] clavier, boutons rapides, Bust et Miss ;
- [ ] checkout et nombre de fléchettes ;
- [ ] historique, modification et Undo ;
- [ ] moyennes et legs gagnés ;
- [ ] alternance automatique du starter ;
- [ ] sauvegarde automatique et reprise après rafraîchissement ;
- [ ] verrou multi-appareil ;
- [ ] lecture seule proposée au poste verrouillé.

## 6. Fin et retour au menu

- [ ] le leg décisif termine le match ;
- [ ] vainqueur et score enregistrés ;
- [ ] progression du tableau recalculée ;
- [ ] les fixtures dépendantes sont débloquées ;
- [ ] retour automatique à `#/` ;
- [ ] le même numéro de cible est toujours sélectionné ;
- [ ] le match terminé apparaît dans l’historique ;
- [ ] le prochain match devient immédiatement identifiable.

## 7. Formats Premier League

- [ ] Nights 1–7 : Best of 5, premier à 3 ;
- [ ] demi-finales de Finals : Best of 9, premier à 5 ;
- [ ] finale de Finals : Best of 11, premier à 6 ;
- [ ] Finals ne modifie pas les points de ligue ;
- [ ] vainqueurs avancent dans les bons emplacements ;
- [ ] résultats répétés ne doublent pas les points.

## 8. Données et SQL

- [ ] migration `0007_scoring_station_targets.sql` appliquée ;
- [ ] `target_number` accepte null ou 1–999 ;
- [ ] index `premier_league_fixtures_target_number_idx` présent ;
- [ ] RLS existante de `premier_league_fixtures` inchangée ;
- [ ] les trois liens Premier League sont présents sur `matches` ;
- [ ] `encounter_id` reste null ;
- [ ] anciens matchs et clés LocalStorage restent lisibles.

## 9. Responsive/PWA

- [ ] sélecteur utilisable sur téléphone, tablette et écran de soirée ;
- [ ] cartes lisibles sans défilement horizontal ;
- [ ] prochain match visible immédiatement ;
- [ ] PWA installable et fonctionnelle après actualisation ;
- [ ] GitHub Pages ouvre les routes `#/`, `#/login` et `#/game/:id`.
