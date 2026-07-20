# Plan de test manuel - MorgesDartsConnect

Ce plan sert a verifier rapidement les parcours critiques apres une modification.
Tester de preference en local et sur le site deploye.

## 0. Preparation

- [ ] Installer les dependances: `npm install`.
- [ ] Lancer les tests unitaires: `npm test`.
- [ ] Lancer le build: `npm run build`.
- [ ] Demarrer l'app: `npm run dev`.
- [ ] En mode cloud, verifier que `.env.local` contient `VITE_SUPABASE_URL` et
      `VITE_SUPABASE_ANON_KEY`.

Donnees recommandees:

- [ ] au moins 8 joueurs actifs;
- [ ] une equipe `Jedis` avec au moins 4 joueurs;
- [ ] une autre equipe avec au moins 4 joueurs;
- [ ] une saison courante.

## 1. Accueil

- [ ] Le logo MorgesDartsConnect s'affiche.
- [ ] Le favicon est visible dans l'onglet navigateur.
- [ ] Le switch FR/EN change les textes visibles.
- [ ] Le bouton `Se connecter` / `Se deconnecter` en haut de l'accueil ouvre la
      page de connexion ou ferme la session admin.
- [ ] Les boutons principaux sont visibles:
  - Nouvelle partie d'entrainement;
  - Match de championnat;
  - En direct;
  - Statistiques.
- [ ] Le QR code "Scan to watch" pointe vers `#/live`.
- [ ] Le bouton discret des regles droles ouvre puis ferme le popup.
- [ ] Si aucun match n'est en cours, aucune carte de reprise n'apparait.

## 2. Nouvelle partie d'entrainement

- [ ] Ouvrir `#/new`.
- [ ] Choisir 501 puis 601.
- [ ] Choisir simple puis double.
- [ ] Modifier le nombre de legs a gagner.
- [ ] Ajouter les joueurs via la recherche instantanee.
- [ ] En simple, l'app demande un joueur par cote.
- [ ] En double, l'app demande deux joueurs par cote.
- [ ] Choisir le starter manuellement.
- [ ] Choisir le bull-up et verifier le popup de selection du gagnant.
- [ ] Demarrer le match.

## 3. Scoring match

- [ ] Les chiffres sont assez gros pour etre lus depuis le board (environ 3 m):
      scores des deux joueurs et grand score central du joueur actif.
- [ ] Une etoile discrete apparait a cote du nom, dans la carte de score du
      joueur qui commence le leg, et reste sur cette carte pendant tout le leg.
- [ ] Saisir un score valide puis valider.
- [ ] Le grand score central diminue en direct pendant la saisie.
- [ ] Toucher le grand score central valide aussi la visite.
- [ ] Sur ordinateur, les touches `0-9` tapent le score, `Entree` valide,
      `Retour arriere` efface un chiffre et `Echap` efface la saisie.
- [ ] Le clavier physique ne reagit plus quand une fenetre de fermeture ou de
      correction est ouverte.
- [ ] Le grand score central en cours de saisie reste en couleur normale; le
      rouge apparait seulement pour une saisie invalide.
- [ ] Les scores restants, le joueur actif et l'historique se mettent a jour.
- [ ] Les scores rapides (colonnes laterales, `140` et `180`) valident
      immediatement.
- [ ] L'historique montre les dernieres visites de chaque joueur.
- [ ] Le bouton Bust apparait seulement quand il est pertinent.
- [ ] Les finishes proposent les choix de flechettes possibles.
- [ ] Un checkout termine le leg.
- [ ] Le starter alterne au leg suivant, et l'etoile passe sur la carte du
      nouveau starter.
- [ ] Gagner le nombre de legs requis affiche l'ecran final.
- [ ] Undo annule la derniere action.
- [ ] Une visite peut etre modifiee si l'UI le permet.
- [ ] La suppression de visite n'est pas disponible pendant un match.
- [ ] Forfeit leg demande confirmation et attribue le leg a l'adversaire.
- [ ] Forfeit match demande confirmation et termine le match.

## 4. Sauvegarde et reprise

- [ ] Pendant un match, rafraichir la page.
- [ ] L'accueil affiche une carte "partie en cours".
- [ ] Resume reprend exactement le bon score, leg et joueur actif.
- [ ] En mode cloud, verifier la reprise depuis un autre navigateur/appareil.
- [ ] En cas de perte reseau temporaire, verifier qu'aucune saisie n'est perdue
      apres reconnexion.

## 5. Live public

- [ ] Ouvrir `#/live` sans etre connecte.
- [ ] Les matchs en cours sont listables.
- [ ] Ouvrir un match live.
- [ ] Le live n'affiche aucun controle de scoring.
- [ ] Depuis un autre onglet, scorer une visite et verifier la mise a jour live.
- [ ] Terminer le match et verifier que le recap final reste lisible.

## 6. Statistiques / admin

- [ ] Ouvrir `#/admin`.
- [ ] Sans session, l'ecran de login apparait.
- [ ] Un mauvais mot de passe n'ouvre pas l'admin.
- [ ] Une connexion valide donne acces aux sections admin.
- [ ] Sign out ferme la session admin.

## 7. Admin joueurs

- [ ] Ajouter un joueur.
- [ ] Renommer un joueur.
- [ ] Desactiver puis reactiver un joueur.
- [ ] Rechercher un joueur.
- [ ] Trier la liste si le controle est disponible.
- [ ] Supprimer un joueur sans match.
- [ ] Verifier qu'un joueur avec historique ne peut pas etre supprime si la
      base bloque l'operation; utiliser la desactivation a la place.

## 8. Admin equipes

- [ ] Creer une equipe.
- [ ] Renommer une equipe.
- [ ] Ouvrir le dialogue d'ajout joueur.
- [ ] Rechercher un joueur dans le dialogue.
- [ ] Selectionner un joueur et verifier l'ajout immediat.
- [ ] Retirer un joueur de l'equipe.
- [ ] Verifier qu'un joueur deja dans une equipe n'est pas propose comme membre
      disponible d'une autre equipe.
- [ ] Rechercher une equipe.
- [ ] Supprimer une equipe et verifier que les joueurs restent disponibles.

## 9. Match de championnat

- [ ] Ouvrir `#/championship/new`.
- [ ] Sans session admin, verifier la redirection login.
- [ ] Apres login, verifier que l'equipe Jedis est preselectionnee a domicile.
- [ ] Verifier que les autres equipes restent selectionnables.
- [ ] Verifier que les autres equipes sont affichees plus discretement.
- [ ] Choisir l'equipe adverse.
- [ ] Demarrer la composition des premiers simples.
- [ ] Les equipes doivent etre differentes.
- [ ] Chaque equipe doit avoir au moins 4 joueurs.

## 10. Composition championnat

- [ ] Composer les 4 premiers simples.
- [ ] Demarrer le match 1.
- [ ] Faire le bull-up.
- [ ] Verifier que le gagnant du bull commence.
- [ ] Pendant le scoring, le bandeau du score de rencontre est masque et le
      bouton `Configurer` est accessible dans la barre du haut, a cote de
      `Annuler`.
- [ ] Entre les matchs (composition, stats, final), le bandeau du score de
      rencontre reapparait.
- [ ] Terminer un match.
- [ ] Verifier que le score de rencontre augmente.
- [ ] Passer au match suivant.
- [ ] Apres 4 simples, composer les 2 doubles.
- [ ] Apres les doubles, composer les 4 derniers simples.
- [ ] Les matchs deja joues ne doivent pas etre modifies par la configuration.

## 11. Championnat final et admin championnat

- [ ] Terminer les 10 matchs.
- [ ] L'ecran final affiche le vainqueur, le score et les stats.
- [ ] Finish encounter revient a l'accueil.
- [ ] Ouvrir `#/admin/championship`.
- [ ] La rencontre apparait dans la liste.
- [ ] Ouvrir la rencontre.
- [ ] Ouvrir le detail d'un match.
- [ ] Les forfaits s'affichent sans erreur si un match a ete termine par forfait.

## 12. Dashboard statistiques

- [ ] Ouvrir `#/admin/stats`.
- [ ] Verifier les filtres: saison, joueur, type, variante, periode.
- [ ] Trier plusieurs colonnes.
- [ ] Selectionner un joueur et verifier son historique.
- [ ] Ouvrir le detail d'un match.
- [ ] Exporter en CSV.
- [ ] Ouvrir le CSV dans un tableur et verifier les colonnes.
- [ ] Les donnees potentiellement interpretees comme formules doivent etre
      neutralisees dans l'export.

## 13. Responsive

- [ ] Mobile portrait: scoring utilisable sans zoom.
- [ ] Tablette paysage et laptop: score, clavier et historique restent lisibles,
      et l'historique montre les dernieres visites sans deborder.
- [ ] Sur tablette d'au moins 11 pouces et grand ecran, les touches du clavier
      et le score restant central sont agrandis sans provoquer de debordement.
- [ ] Le clavier et le bouton `Valider` restent entierement visibles a l'ecran.
- [ ] Les textes des boutons ne debordent pas.
- [ ] Les popups restent accessibles sur petit ecran.
- [ ] Le logo d'accueil ne masque pas les boutons principaux.

## 14. Securite

- [ ] Les routes admin demandent une session.
- [ ] Les routes championnat demandent une session.
- [ ] Le live reste public et sans controle d'ecriture.
- [ ] La cle `service_role` Supabase n'est jamais presente dans le frontend.
- [ ] `npm audit --json` ne remonte aucune vulnerabilite connue.
- [ ] Les nouveaux fichiers ne contiennent pas de token ou secret.

## 15. Non-regression ciblee

Apres une modification dans une zone, verifier au minimum:

- UI accueil: sections 1 et 13;
- setup/scoring: sections 2, 3 et 4;
- live: section 5;
- admin joueurs/equipes: sections 6, 7 et 8;
- championnat: sections 9, 10 et 11;
- stats/export: section 12;
- securite/config: sections 6 et 14.

## Rapport de bug

Noter:

- l'environnement: local ou prod;
- le navigateur/appareil;
- les donnees utilisees;
- l'action faite;
- le resultat attendu;
- le resultat obtenu;
- une capture si possible.
