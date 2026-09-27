# Plan de test manuel — GDL Premier League Scoring

Ce plan vérifie les parcours publiés de la station de scoring après une
modification. Tester de préférence en local puis sur le site déployé, sur une
tablette (portrait et paysage).

Les modules historiques non publiés (entraînement, championnat par équipes,
administration, statistiques) ne sont pas couverts ici : ils demandent une
vérification complète dédiée avant toute réactivation.

## 0. Préparation

- [ ] `npm install`
- [ ] `npm test` : tous les tests passent.
- [ ] `npm run build` : aucune erreur.
- [ ] `npm run dev`
- [ ] En mode cloud, `.env.local` contient `VITE_SUPABASE_URL` et
      `VITE_SUPABASE_ANON_KEY`.

Données recommandées (créées sur le site du tournoi / dans Supabase) :

- [ ] une compétition Premier League non terminée avec 8 joueurs ;
- [ ] des matchs affectés à au moins deux cibles ;
- [ ] un compte marqueur dans Supabase Auth.

## 1. Choix de la cible

- [ ] Première ouverture : l'écran `Choisissez votre cible` s'affiche.
- [ ] Les numéros de cibles utilisés dans la compétition sont proposés.
- [ ] Saisir un numéro manuel valide (1 à 999) ouvre cette cible.
- [ ] Recharger la page : la même cible est rouverte.
- [ ] `Changer de cible` permet d'en choisir une autre.
- [ ] Navigation privée (stockage indisponible) : la station fonctionne, seul
      le souvenir de la cible est perdu.
- [ ] Le bouton FR/EN change tous les textes visibles.

## 2. Liste des matchs

- [ ] Ordre : en cours, disponibles, bloqués, puis terminés.
- [ ] Le prochain match jouable porte la mention `Prochain`.
- [ ] Chaque carte montre joueurs, soirée, tour, `Best of`, état et score en
      legs.
- [ ] Un match bloqué ne peut pas être démarré.
- [ ] Sans compétition : `En attente des données du tournoi`.
- [ ] Cible sans match : `Aucun match attribué à cette cible`.
- [ ] Affecter un match à la cible depuis le site du tournoi : il apparaît
      sans recharger la page.

## 3. Connexion

- [ ] Sans session, démarrer un match demande la connexion.
- [ ] Un mauvais mot de passe est refusé.
- [ ] Une connexion valide affiche `Connecté · se déconnecter`.
- [ ] La déconnexion fonctionne.

## 4. Démarrage d'un match

- [ ] `Démarrer →` demande qui lance en premier au leg 1.
- [ ] Toucher un joueur le sélectionne sans lancer le match ; on peut changer
      d'avis.
- [ ] `Démarrer le match →` lance le match avec le bon joueur.
- [ ] Le match est en 501, Double Out, avec le nombre de legs du tour.
- [ ] Le bouton `⇄` inverse le joueur qui commence avant la première
      fléchette, puis disparaît.
- [ ] Double appui rapide sur démarrer : un seul match est créé.
- [ ] Un match commencé affiche `Reprendre →` et reprend au bon endroit.

## 5. Saisie des scores

- [ ] Pavé : taper un score puis `VALIDER` (vert) ou `✓`.
- [ ] Le score central diminue pendant la saisie ; il ne passe au rouge que
      pour une saisie invalide.
- [ ] Raccourcis 26 à 180 : validation immédiate.
- [ ] Un raccourci ≥ score restant clignote en rouge et n'est pas enregistré.
- [ ] Les raccourcis sont désactivés pendant une saisie au pavé.
- [ ] Un nombre > 180 est interprété comme le reste voulu.
- [ ] Clavier physique : `0-9`, `Entrée`, `Retour arrière`, `Échap`.
- [ ] Refus : > 180, 172/173/175/176/178/179, score > reste, reste de 1,
      finish sans sortie double.
- [ ] L'historique montre au moins les trois dernières volées de chaque
      joueur, sans débordement.

## 6. Checkout, Miss, Bust

- [ ] Sur un finish, les touches 1/2/3 possibles deviennent vertes.
- [ ] Appui long sur 1/2/3 termine le leg avec ce nombre de fléchettes ;
      appui court tape le chiffre.
- [ ] Saisir le score du finish ouvre le choix du nombre de fléchettes, les
      choix impossibles sont grisés.
- [ ] `Miss` enregistre une volée à 0.
- [ ] `BUST` n'apparaît que si le reste ≤ 180 et remet le score du début de
      volée.
- [ ] Le joueur qui commence alterne au leg suivant ; l'étoile suit.
- [ ] Le match se termine au nombre de legs requis.

## 7. Corrections et abandons

- [ ] `↩ Annuler` annule la dernière action.
- [ ] Toucher une ancienne volée ouvre la correction avec le pavé à l'écran
      (pas le clavier du système).
- [ ] Le premier chiffre tapé remplace le score pré-rempli.
- [ ] Après correction, scores, legs et vainqueur sont recalculés.
- [ ] `Abandonner le leg` et `Abandonner le match` demandent confirmation.

## 8. Fin de match et tableau

- [ ] À la fin : `Match terminé — enregistrement…` puis retour à la cible.
- [ ] Le match passe dans `Terminés sur cette cible` avec le bon score.
- [ ] Le vainqueur apparaît dans le match suivant du tableau.
- [ ] Couper le réseau à la fin du match : `Réessayer` apparaît et fonctionne
      au retour du réseau.

## 9. Réseau et verrou

- [ ] Couper le réseau pendant un match : `Hors ligne — nouvelle tentative`
      apparaît, le scoring continue.
- [ ] Rétablir le réseau : l'indicateur disparaît, aucune volée n'est perdue
      (vérifier sur le live ou après rechargement).
- [ ] Ouvrir le même match sur un deuxième appareil : `Match en cours
      ailleurs` et bouton `📺 En direct`.
- [ ] Fermer l'appareil marqueur : au bout d'environ 20 s, le deuxième
      appareil peut reprendre le match.

## 10. Live

- [ ] `#/live/:id` s'ouvre sans être connecté.
- [ ] Aucun contrôle de scoring n'est affiché.
- [ ] Scorer une volée ailleurs : le live se met à jour.
- [ ] Un bust n'affiche jamais de reste négatif.
- [ ] Le QR code ouvre la même page sur un téléphone.

## 11. Affichage

- [ ] Tablette portrait et paysage : une seule colonne, pavé ancré en bas,
      `VALIDER` entièrement visible.
- [ ] Scores lisibles à environ 3 m.
- [ ] Écran ≥ 1 536 px avec souris : vue gauche/droite.
- [ ] Les fenêtres (checkout, correction, confirmation) restent utilisables sur
      petit écran.

## 12. Sécurité

- [ ] Scorer demande une session.
- [ ] Le live reste en lecture seule.
- [ ] Aucune clé `service_role` ni secret dans le frontend ou les nouveaux
      fichiers.
- [ ] `npm audit --json` ne remonte pas de vulnérabilité connue.

## Non-régression ciblée

- station / liste des matchs : sections 1, 2 et 3 ;
- démarrage, scoring : sections 4 à 7 ;
- résultats et tableau : section 8 ;
- sauvegarde, verrou, live : sections 9 et 10 ;
- mise en page : section 11 ;
- sécurité / configuration : section 12.

## Rapport de bug

Noter : l'environnement (local ou prod), l'appareil et le navigateur, la cible
et le match concernés, l'action faite, le résultat attendu, le résultat
obtenu, et une capture si possible.
