# Guide agent IA

Ce fichier sert de repere rapide pour les LLM et contributeurs qui travaillent
sur GDL Premier League Scoring.

## Objectif produit

GDL Premier League Scoring est la station de scoring des soirees Premier League
GDL: une tablette par board, qui affiche les matchs affectes a ce board et
permet de les scorer. La creation de la competition et l'affectation des
matchs sont faites par le site externe du tournoi.

L'application doit rester:

- rapide a utiliser pendant un match;
- fiable pour les resultats et le classement Premier League;
- lisible sur tablette, a environ 3 m du board;
- compatible avec les donnees existantes;
- utilisable en mode local sans Supabase;
- utilisable en mode cloud avec Supabase.

## Architecture rapide

- `src/domain`: logique metier pure, sans React ni I/O.
- `src/domain/rules`: validation X01, bust, checkout, ordre de lancer.
- `src/domain/championship`: logique pure des rencontres par equipes.
- `src/data`: interfaces repository/auth + implementations local/Supabase.
- `src/store`: contextes React, persistence, live, verrouillage et orchestration.
- `src/features`: ecrans organises par domaine fonctionnel.
- `src/components`: composants reutilisables (`components/ui`: Button, Modal,
  Loading, ConfirmProvider).
- `src/store/LangContext.tsx`: dictionnaire FR/EN des textes visibles.
- `supabase/migrations`: schema SQL et policies RLS.

## Routes principales

Routes publiees (voir `src/App.tsx`):

- `/`: station de scoring (`features/scoringStation`): choix du board et
  liste de ses matchs.
- `/login`: connexion du marqueur ou de l'organisateur.
- `/game/:id`: scoring d'un match.
- `/live/:id`: live read-only d'un match (aussi la solution de repli quand un
  autre appareil tient le verrou de scoring).
- toute autre route: redirection vers `/`.

Les ecrans historiques (accueil de club, entrainement `/new`, liste `/live`,
championnat par equipes, admin joueurs/equipes/stats, organisation Premier
League) sont toujours dans `src/features` mais leurs routes ont ete retirees.
Ne pas les rebrancher sans demande explicite et verification complete.

Le routeur est un `HashRouter`: les URLs finales utilisent `#/...`.

## Commandes utiles

```bash
npm run dev
npm test
npm run build
npm run preview
```

Avant de terminer une modification UI ou documentation liee au build:

```bash
npm run build
```

Pour une modification de logique darts, championnat ou stats:

```bash
npm test
npm run build
```

Pour une verification securite dependances:

```bash
npm audit --json
```

## Conventions de travail

- Faire des changements minimaux et scopes a la demande.
- Ne pas refactoriser globalement sans demande explicite.
- Ne pas casser la compatibilite des donnees existantes.
- Verifier `git status --short` avant de modifier puis avant de repondre.
- Ne pas ecraser ni annuler des changements locaux non lies.
- Ne jamais stocker de token, secret ou identifiant prive dans le code, les docs
  ou la config Git.
- Ne pas ajouter de dependance sans raison claire.
- Preferer une correction locale a une abstraction generale prematuree.
- Reutiliser les composants partages de `components/ui` (ex. `Loading`, `Button`)
  plutot que reinliner un markup equivalent.

## Internationalisation

- Aucun texte visible nouveau ne doit etre hardcode dans les composants.
- Ajouter les libelles dans `DICT` de `src/store/LangContext.tsx`.
- Toujours fournir `en` et `fr`.
- Utiliser `useT()` et `t('cle')` dans les composants.
- Verifier que le switch FR/EN ne cree pas de melange de langues.

## Logique match

- Un match est reconstruit depuis `config + events`.
- La logique de score doit rester dans `src/domain`.
- Eviter de dupliquer les regles de darts dans les composants UI.
- Une volee peut rester modifiable si l'UI le permet.
- Ne pas reintroduire la suppression de volee pendant un match sans demande
  explicite.
- Conserver les formats de `MatchRecord`, `GameEvent`, equipes, saisons et
  rencontres.
- L'ecran de scoring privilegie la lisibilite a distance (environ 3 m): gros
  chiffres pour les scores restants et le score central du joueur actif. Garder
  le clavier plus compact que les scores pour laisser voir l'historique.
- Cible materielle: tablette tactile. Une tablette garde toujours une seule
  colonne, en portrait comme en paysage, avec le pave ancre en bas et
  l'historique juste au-dessus; la vue gauche/droite est reservee aux ecrans
  d'au moins 1 536 px pilotes a la souris. La hauteur des touches du pave est
  factorisee dans la constante `KEY_H` de `Keypad.tsx`.
- Les raccourcis de score (26 a 180) sont refuses sur place s'ils sont
  superieurs ou egaux au reste, et desactives pendant une saisie au pave.
- La correction d'une volee utilise le pave a l'ecran (pas le clavier du
  systeme); le premier chiffre tape remplace le score pre-rempli.
- Le joueur qui commence le leg 1 se choisit puis se confirme sur la station;
  le bouton `⇄` du bandeau permet de l'inverser tant qu'aucune flechette n'a
  ete lancee.
- Sur ordinateur, le clavier physique pilote la saisie: chiffres 0-9, Entree
  (valider), Retour arriere (effacer un chiffre), Echap (tout effacer). Un
  seul ecouteur window keydown, cable via une ref pour rester valide sans se
  dupliquer; desactive quand une modale (checkout/edition) est ouverte ou une
  fois le match termine.
- Le score central en cours de saisie reste en couleur de texte normale; le
  rouge (accent) est reserve aux saisies INVALIDES (avec le shake).
- Le joueur qui commence le leg est signale par une petite etoile discrete a cote
  du nom dans sa carte de score, pas par du texte dans la ligne d'info ni dans le
  bandeau du haut.
- Pendant le scoring d'un match de championnat, le bandeau du score de la
  rencontre est masque (gain de place pour le score restant central) ; le bouton
  « Configurer » vit alors dans la barre de controle, a cote de « Annuler ». Le
  bandeau revient entre les matchs (composition, stats, final).

## Premier League

- Logique pure dans `src/domain/premierLeague` (format, tableaux, classement),
  testee dans `src/domain/premierLeague/__tests__`.
- 8 joueurs, 7 soirees (quarts, demies, finale en Best of 5), points 5/3/2,
  Top 4 vers la Finals Night (demies Best of 9, finale Best of 11).
- Le demarrage d'un match de fixture doit rester idempotent: jamais deux
  matchs pour la meme fixture.

## Championnat par equipes (module historique, non publie)

- Le championnat est pense pour les Jedis a domicile.
- Dans la selection des equipes, les Jedis sont preselectionnes a domicile.
- Les autres equipes doivent rester selectionnables manuellement.
- Une rencontre contient 10 matchs: 4 simples, 2 doubles, 4 simples.
- Les matchs de championnat sont lies a un `encounter_id`.
- Les stats championnat doivent rester separees des matchs d'entrainement.

## Admin et donnees

- Joueurs, equipes, saisons et championnat sont des zones admin.
- L'app peut tourner sans Supabase: ne pas rendre le mode local inutilisable.
- Les changements de texte, filtres et dialogues ne doivent pas modifier les
  donnees stockees.
- Les listes longues de joueurs doivent privilegier recherche instantanee et
  selection directe.

## Securite

- Supabase anon key: publique par design.
- Jamais de cle `service_role` dans le frontend.
- Les protections critiques doivent etre cote base via RLS, pas seulement dans
  React.
- Le live doit rester read-only.
- Les exports CSV doivent neutraliser les cellules de type formule.
- Toute nouvelle table Supabase doit avoir RLS activee et des policies claires.
- Toute nouvelle connexion externe doit etre compatible avec la CSP de
  `index.html`.

## Documentation

- `README.md`: vue d'ensemble projet et architecture.
- `FONCTIONNALITES.md`: inventaire fonctionnel complet (publie / interne /
  historique).
- `MODE_D_EMPLOI.md`: guide du marqueur un soir de match.
- `SUPABASE_SETUP.md`: configuration backend cloud.
- `TEST_PLAN.md`: verification manuelle.
- `agent.md`: consignes pour assistants IA/contributeurs.

Quand un comportement change, mettre a jour la documentation correspondante dans
le meme changement si possible.
